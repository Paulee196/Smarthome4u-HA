"""Role boundaries and per-account presentation settings."""

import json
from types import SimpleNamespace

import pytest
from homeassistant.core import HomeAssistant

from custom_components.smarthome4u import api
from custom_components.smarthome4u.const import DOMAIN
from custom_components.smarthome4u.storage import Settings


async def test_personal_layouts_do_not_change_the_shared_dashboard(
    hass: HomeAssistant,
) -> None:
    settings = Settings(hass)
    await settings.load()
    await settings.set_favorites(["entity:light.shared"])

    first = settings.presentation("first", "user")
    # Viewing the default must not freeze it for a user who has not edited it.
    assert first.favorites == ["entity:light.shared"]
    assert "first" not in settings.data["profiles"]

    await settings.set_favorites(["entity:light.updated"])
    assert settings.presentation("first", "user").favorites == ["entity:light.updated"]

    first = settings.presentation("first", "user")
    await first.set_favorites(["entity:light.first"])
    await first.set_board("prehled", 1, [{"id": "a", "type": "entities"}])
    await first.set_room_order(["kitchen"])

    assert settings.favorites == ["entity:light.updated"]
    assert settings.board("prehled") is None
    assert settings.layout["rooms"] == []
    assert settings.presentation("second", "user").favorites == ["entity:light.updated"]

    reloaded = Settings(hass)
    await reloaded.load()
    assert reloaded.presentation("first", "user").favorites == ["entity:light.first"]
    assert reloaded.presentation("first", "user").board("prehled")["blocks"][0]["id"] == "a"
    assert reloaded.presentation("first", "user").layout["rooms"] == ["kitchen"]
    assert reloaded.presentation("second", "user").favorites == ["entity:light.updated"]


async def test_technician_role_does_not_grant_admin(hass: HomeAssistant) -> None:
    settings = Settings(hass)
    await settings.load()
    await settings.claim_admin("owner")
    await settings.set_role("installer", "technician")

    assert settings.role("owner", True) == "admin"
    assert settings.role("installer", False) == "technician"
    assert settings.role("member", False) == "user"
    assert settings.presentation("installer", "technician") is settings

    await settings.set_role("installer", "user")
    assert settings.role("installer", False) == "user"


async def test_write_permissions_use_the_server_role() -> None:
    class View:
        current_role = "user"

        def role(self, _request):
            return self.current_role

        def require_admin(self, request):
            if self.role(request) != "admin":
                raise api.ApiError("forbidden", 403)

        @api.technician
        async def manage_device(self, _request):
            return True

        @api.admin
        async def grant_role(self, _request):
            return True

    view = View()
    with pytest.raises(api.ApiError) as denied:
        await view.manage_device({})
    assert denied.value.status == 403

    view.current_role = "technician"
    assert await view.manage_device({}) is True
    with pytest.raises(api.ApiError) as denied:
        await view.grant_role({})
    assert denied.value.status == 403


async def test_user_can_edit_own_board_but_not_devices(hass: HomeAssistant) -> None:
    class Request(dict):
        def __init__(self, user_id: str, payload: dict):
            super().__init__(hass_user=SimpleNamespace(id=user_id, is_admin=False))
            self.payload = payload

        async def json(self):
            return self.payload

    settings = Settings(hass)
    await settings.load()
    await settings.claim_admin("owner")
    hass.data.setdefault(DOMAIN, {})["settings"] = settings

    response = await api.DashboardView(hass).post(
        Request("member", {"preset": "prehled", "blocks": []})
    )
    assert response.status == 200
    assert settings.presentation("member", "user").board("prehled")["blocks"] == []
    assert settings.board("prehled") is None

    response = await api.DeviceView(hass).post(Request("member", {}), "missing")
    assert response.status == 403
    assert json.loads(response.body)["error"] == "forbidden"

    await settings.set_role("installer", "technician")
    response = await api.RoleView(hass).post(
        Request("installer", {"role": "technician"}), "member"
    )
    assert response.status == 403
