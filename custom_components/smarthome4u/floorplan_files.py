"""Read-only selection of floorplan images already stored in Home Assistant."""

from __future__ import annotations

import os
from pathlib import Path, PurePosixPath

MAX_BYTES = 8 * 1024 * 1024
MAX_FILES = 300
MAX_DIRECTORIES = 1500
EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def image_extension(content: bytes) -> str | None:
    """Identify the actual image format rather than trusting the file name."""
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "webp"
    return None


def _file(root: Path, relative: str) -> Path:
    if (not isinstance(relative, str) or not relative or "\\" in relative
            or "\0" in relative or ":" in relative):
        raise ValueError("Neplatná cesta k obrázku.")
    parts = PurePosixPath(relative).parts
    if relative.startswith("/") or any(part in (".", "..") for part in parts):
        raise ValueError("Neplatná cesta k obrázku.")
    path = root.joinpath(*parts)
    if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Obrázek je mimo složku médií.")
    return path


def list_images(roots: dict[str, Path]) -> list[dict]:
    """Return a bounded list without following directory links."""
    files = []
    for source, root in roots.items():
        if not root.is_dir():
            continue
        directories = 0
        for current, children, names in os.walk(root, followlinks=False):
            directories += 1
            if directories > MAX_DIRECTORIES:
                break
            children[:] = [name for name in children if not (Path(current) / name).is_symlink()]
            for name in names:
                path = Path(current) / name
                if path.suffix.lower() not in EXTENSIONS or path.is_symlink():
                    continue
                try:
                    size = path.stat().st_size
                except OSError:
                    continue
                if not 0 < size <= MAX_BYTES:
                    continue
                relative = path.relative_to(root).as_posix()
                parent = PurePosixPath(relative).parent
                files.append({
                    "source": source,
                    "path": relative,
                    "name": name,
                    "folder": "" if str(parent) == "." else str(parent),
                    "size": size,
                })
                if len(files) >= MAX_FILES:
                    return sorted(files, key=lambda item: (item["source"], item["path"].casefold()))
    return sorted(files, key=lambda item: (item["source"], item["path"].casefold()))


def read_image(roots: dict[str, Path], selection: object) -> tuple[bytes, str]:
    """Validate a selected path again at read time, including size and signature."""
    if not isinstance(selection, dict):
        raise ValueError("Vyberte obrázek ze souborů Home Assistanta.")
    source = selection.get("source")
    relative = selection.get("path")
    if not isinstance(source, str) or source not in roots:
        raise ValueError("Neplatný zdroj obrázku.")
    path = _file(roots[source], relative)
    if path.suffix.lower() not in EXTENSIONS or not path.is_file():
        raise ValueError("Obrázek už není dostupný.")
    try:
        with path.open("rb") as stream:
            content = stream.read(MAX_BYTES + 1)
    except OSError as err:
        raise ValueError("Obrázek už není dostupný.") from err
    if not content or len(content) > MAX_BYTES:
        raise ValueError("Obrázek je větší než 8 MB nebo je prázdný.")
    extension = image_extension(content)
    if extension is None:
        raise ValueError("Podporujeme PNG, JPG a WEBP.")
    return content, extension
