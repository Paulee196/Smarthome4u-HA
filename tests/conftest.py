"""Společné nastavení testů."""

import pytest

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def povolit_vlastni_integrace(enable_custom_integrations):
    """Bez tohohle Home Assistant vlastní integrace v testech nenačte."""
    yield
