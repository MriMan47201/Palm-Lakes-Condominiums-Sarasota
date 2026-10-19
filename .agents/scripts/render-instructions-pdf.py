#!/usr/bin/env python3
"""Render the Palm Lakes instruction PDF and create cropped viewer assets."""

from pathlib import Path

import pymupdf


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "artifacts/mobile/public/Instructions.pdf"
OUTPUT_DIR = ROOT / ".agents/outputs/instructions-pdf"
ASSET_DIR = ROOT / "artifacts/mobile/assets/images"
VIEWER_CROP_PADDING = 8


def content_bounds(page: pymupdf.Page) -> pymupdf.Rect:
    bounds: pymupdf.Rect | None = None
    for block in page.get_text("dict")["blocks"]:
        if block["type"] == 0:
            text = "".join(
                span["text"]
                for line in block["lines"]
                for span in line["spans"]
            ).strip()
            if not text:
                continue
        elif block["type"] != 1:
            continue

        block_bounds = pymupdf.Rect(block["bbox"])
        bounds = block_bounds if bounds is None else bounds | block_bounds

    if bounds is None:
        raise ValueError(f"Page {page.number + 1} has no visible content to crop")

    bounds.x0 -= VIEWER_CROP_PADDING
    bounds.y0 -= VIEWER_CROP_PADDING
    bounds.x1 += VIEWER_CROP_PADDING
    bounds.y1 += VIEWER_CROP_PADDING
    return bounds & page.rect


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    document = pymupdf.open(SOURCE)
    for index, page in enumerate(document, start=1):
        inspection_image = page.get_pixmap(
            matrix=pymupdf.Matrix(1.5, 1.5),
            alpha=False,
        )
        inspection_path = OUTPUT_DIR / f"page-{index}.png"
        inspection_image.save(inspection_path)

        crop = content_bounds(page)
        app_image = page.get_pixmap(
            matrix=pymupdf.Matrix(2, 2),
            clip=crop,
            alpha=False,
        )
        asset_path = ASSET_DIR / f"instructions-page-{index}.jpg"
        app_image.save(asset_path, output="jpeg", jpg_quality=92)
        print(
            f"Rendered page {index}/{document.page_count}: "
            f"{inspection_path} and cropped viewer asset {asset_path} "
            f"({crop.width:.1f} × {crop.height:.1f} pt)"
        )


if __name__ == "__main__":
    main()
