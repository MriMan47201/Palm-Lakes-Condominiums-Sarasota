#!/usr/bin/env python3
"""Render the Palm Lakes instruction PDF pages for visual inspection."""

from pathlib import Path

import pymupdf


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "artifacts/mobile/public/Instructions.pdf"
OUTPUT_DIR = ROOT / ".agents/outputs/instructions-pdf"
ASSET_DIR = ROOT / "artifacts/mobile/assets/images"


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

        app_image = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
        asset_path = ASSET_DIR / f"instructions-page-{index}.jpg"
        app_image.save(asset_path, output="jpeg", jpg_quality=92)
        print(
            f"Rendered page {index}/{document.page_count}: "
            f"{inspection_path} and {asset_path}"
        )


if __name__ == "__main__":
    main()
