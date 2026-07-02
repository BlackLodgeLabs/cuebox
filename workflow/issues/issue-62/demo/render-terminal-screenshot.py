#!/usr/bin/env python3
"""Render terminal output text to a PNG screenshot for demo artifacts."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} <input.txt> <output.png>", file=sys.stderr)
        sys.exit(1)

    text = Path(sys.argv[1]).read_text(encoding="utf-8")
    out = Path(sys.argv[2])

    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    ]
    font = None
    for fp in font_paths:
        if Path(fp).exists():
            font = ImageFont.truetype(fp, 14)
            break
    if font is None:
        font = ImageFont.load_default()

    lines = text.rstrip("\n").split("\n")
    line_height = 20
    padding = 16
    max_width = max(font.getlength(line) for line in lines) if lines else 0
    width = int(max_width) + padding * 2
    height = len(lines) * line_height + padding * 2

    img = Image.new("RGB", (width, height), color=(30, 30, 30))
    draw = ImageDraw.Draw(img)
    y = padding
    for line in lines:
        color = (80, 250, 123) if line.startswith("PASS") else (248, 248, 242)
        if line.startswith("FAIL"):
            color = (255, 85, 85)
        draw.text((padding, y), line, fill=color, font=font)
        y += line_height

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
