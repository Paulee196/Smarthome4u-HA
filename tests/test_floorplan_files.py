"""Selection of existing images must stay inside HA's allowed directories."""

import pytest

from custom_components.smarthome4u.floorplan_files import list_images, read_image

PNG = b"\x89PNG\r\n\x1a\n" + b"example"


def test_lists_and_reads_existing_image(tmp_path):
    media = tmp_path / "media"
    nested = media / "home"
    nested.mkdir(parents=True)
    (nested / "plan.png").write_bytes(PNG)
    (nested / "notes.txt").write_bytes(b"private")

    files = list_images({"media:local": media})
    assert files == [{
        "source": "media:local", "path": "home/plan.png", "name": "plan.png",
        "folder": "home", "size": len(PNG),
    }]
    assert read_image({"media:local": media}, files[0]) == (PNG, "png")


def test_rejects_traversal_and_fake_image(tmp_path):
    media = tmp_path / "media"
    media.mkdir()
    (tmp_path / "secret.png").write_bytes(PNG)
    (media / "fake.png").write_bytes(b"not an image")
    roots = {"media:local": media}

    with pytest.raises(ValueError):
        read_image(roots, {"source": "media:local", "path": "../secret.png"})
    with pytest.raises(ValueError):
        read_image(roots, {"source": "media:local", "path": "fake.png"})
    with pytest.raises(ValueError):
        read_image(roots, {"source": "unknown", "path": "fake.png"})
