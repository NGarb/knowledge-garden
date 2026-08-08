#!/usr/bin/env python3
"""Generate PWA + Apple touch icons for Garden.

A minimal 'connected notes' graph (light marks on zinc-900) — reads as a
knowledge garden and stays crisp at small sizes. Rendered large, then
downscaled with antialiasing.
"""
from PIL import Image, ImageDraw

BG = (24, 24, 27, 255)       # zinc-900
MARK = (244, 244, 245, 255)  # zinc-100
SUPER = 4                    # supersample factor

# Node positions and edges on a 512 design grid.
NODES = [(196, 200), (330, 168), (168, 330), (300, 322), (360, 372)]
EDGES = [(0, 1), (0, 2), (0, 3), (1, 3), (3, 4), (2, 3)]
NODE_R = 22
EDGE_W = 12


def draw_mark(size: int, rounded: bool, transparent: bool) -> Image.Image:
    s = size * SUPER
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background (rounded for manifest icons, full square for apple-touch).
    bg = BG if not transparent else BG  # bg always opaque where painted
    if rounded:
        radius = int(s * 0.22)
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=bg)
    else:
        d.rectangle([0, 0, s - 1, s - 1], fill=bg)

    scale = s / 512.0
    def p(pt):
        return (pt[0] * scale, pt[1] * scale)

    # Edges
    for a, b in EDGES:
        d.line([p(NODES[a]), p(NODES[b])], fill=MARK, width=int(EDGE_W * scale))
    # Nodes
    for n in NODES:
        cx, cy = p(n)
        r = NODE_R * scale
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=MARK)

    img = img.resize((size, size), Image.LANCZOS)
    if not transparent:
        # Flatten onto opaque bg (Apple ignores alpha; avoid black fringing).
        flat = Image.new("RGB", (size, size), BG[:3])
        flat.paste(img, (0, 0), img)
        return flat
    return img


def main():
    draw_mark(512, rounded=True, transparent=True).save("public/icons/icon-512.png")
    draw_mark(192, rounded=True, transparent=True).save("public/icons/icon-192.png")
    draw_mark(180, rounded=False, transparent=False).save("public/apple-touch-icon.png")
    print("wrote icon-512.png, icon-192.png, apple-touch-icon.png")


if __name__ == "__main__":
    main()
