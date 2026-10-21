"""Capability metadata and HA service names used by dashboard controls."""

from custom_components.smarthome4u.capability import classify, resolve_action


def test_media_controls_follow_supported_features() -> None:
    capabilities = classify(
        "media_player", None,
        {"supported_features": 1 | 4 | 16 | 32 | 128 | 256 | 4096 | 16384},
    )
    assert capabilities["canPlay"]
    assert capabilities["canPause"]
    assert capabilities["canStop"]
    assert capabilities["canPrevious"]
    assert capabilities["canNext"]
    assert capabilities["canTurnOn"]
    assert capabilities["canTurnOff"]
    assert capabilities["volume"]

    assert resolve_action("media_player", "media_player", "play") == (
        "media_player", "media_play", {}
    )
    assert resolve_action("media_player", "media_player", "pause") == (
        "media_player", "media_pause", {}
    )
    assert resolve_action("media_player", "media_player", "previous") == (
        "media_player", "media_previous_track", {}
    )
    assert resolve_action("media_player", "media_player", "next") == (
        "media_player", "media_next_track", {}
    )
    assert resolve_action("media_player", "media_player", "turn_on") == (
        "media_player", "turn_on", {}
    )


def test_cover_controls_follow_supported_features() -> None:
    capabilities = classify("cover", None, {"supported_features": 2})
    assert capabilities["open"] is False
    assert capabilities["close"] is True
    assert capabilities["stop"] is False
