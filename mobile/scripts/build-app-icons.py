#!/usr/bin/env python3
"""
Build the home-screen icon set from the brand keyhole.

iOS masks whatever it is given and composites it on nothing — a transparent
source renders black and the champagne mark loses its ground. So every icon is
generated opaque: the void field, a soft champagne bloom behind the mark, and
the keyhole itself at a size that survives the platform's own corner mask.

    python3 scripts/build-app-icons.py

Writes into public/icons/. Re-run after changing public/brand/keyhole-source.png.
"""

from __future__ import annotations

import pathlib

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "brand" / "keyhole-source.png"
OUT = ROOT / "public" / "icons"

MASTER = 1024

# mobile-ui-tokens.json — the icon may not invent colour.
VOID = (0x06, 0x0D, 0x0B)
RAISED = (0x10, 0x1C, 0x17)
CHAMPAGNE = (0xE8, 0xC8, 0x7A)


def radial(size: int, inner: tuple[int, int, int], outer: tuple[int, int, int]) -> Image.Image:
    """Field gradient — lit from just above centre, like every glass surface."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    cx, cy = size / 2, size * 0.44
    dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (size * 0.72)
    t = np.clip(dist, 0.0, 1.0)[..., None]
    inner_arr = np.array(inner, dtype=np.float32)
    outer_arr = np.array(outer, dtype=np.float32)
    return Image.fromarray((inner_arr + (outer_arr - inner_arr) * t).astype(np.uint8), "RGB")


def bloom(size: int, cy_frac: float, radius_frac: float, peak: float) -> Image.Image:
    """The champagne halo the mark sits in. Quadratic falloff, never a hard edge."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    dist = np.sqrt((x - size / 2) ** 2 + (y - size * cy_frac) ** 2) / (size * radius_frac)
    alpha = np.clip(1.0 - dist, 0.0, 1.0) ** 2 * peak
    layer = np.zeros((size, size, 4), dtype=np.uint8)
    layer[..., 0], layer[..., 1], layer[..., 2] = CHAMPAGNE
    layer[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(layer, "RGBA")


def compose(mark_height_frac: float, cy_frac: float) -> Image.Image:
    """One icon at master resolution. `mark_height_frac` is of the full canvas."""
    canvas = radial(MASTER, RAISED, VOID).convert("RGBA")
    canvas.alpha_composite(bloom(MASTER, cy_frac, 0.46, 0.16))

    mark = Image.open(SOURCE).convert("RGBA")
    target_h = int(MASTER * mark_height_frac)
    target_w = round(mark.width * (target_h / mark.height))
    mark = mark.resize((target_w, target_h), Image.LANCZOS)

    canvas.alpha_composite(
        mark,
        ((MASTER - target_w) // 2, int(MASTER * cy_frac) - target_h // 2),
    )
    return canvas.convert("RGB")


def emit(image: Image.Image, name: str, size: int) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    image.resize((size, size), Image.LANCZOS).save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}  {size}x{size}")


def main() -> None:
    # Standard: the mark reads large because iOS only rounds the corners.
    standard = compose(mark_height_frac=0.56, cy_frac=0.5)
    # Maskable: Android may crop to a circle, so the mark stays inside the
    # 80% safe zone with the field bleeding to every edge.
    maskable = compose(mark_height_frac=0.40, cy_frac=0.5)

    print("home-screen icons")
    emit(standard, "apple-touch-icon.png", 180)
    emit(standard, "icon-192.png", 192)
    emit(standard, "icon-512.png", 512)
    emit(maskable, "icon-maskable-512.png", 512)
    emit(standard, "favicon-32.png", 32)


if __name__ == "__main__":
    main()
