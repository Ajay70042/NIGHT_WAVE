from PIL import Image, ImageDraw, ImageFont
import math

def create_icon(size, output_path):
    img = Image.new("RGBA", (size, size), (10, 10, 14, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw glowing rounded background
    margin = int(size * 0.08)
    corner = int(size * 0.22)
    
    # Gradient-like background aura
    for i in range(margin, margin + int(size * 0.15), 2):
        alpha = int(30 * (1 - (i - margin) / (size * 0.15)))
        draw.rounded_rectangle(
            [margin - (i - margin), margin - (i - margin), size - margin + (i - margin), size - margin + (i - margin)],
            radius=corner,
            fill=(134, 59, 255, alpha)
        )

    # Core card
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=corner,
        fill=(18, 16, 28, 255),
        outline=(163, 230, 53, 200),
        width=max(2, int(size * 0.015))
    )

    # Draw stylish 'NW' / Wave symbol
    center_x = size // 2
    center_y = size // 2
    
    # Draw sound wave bars
    bar_width = max(4, int(size * 0.04))
    gap = max(3, int(size * 0.025))
    heights = [0.2, 0.35, 0.5, 0.3, 0.45, 0.25]
    total_w = len(heights) * bar_width + (len(heights) - 1) * gap
    start_x = center_x - total_w // 2
    
    colors = [
        (163, 230, 53, 255),  # Lime
        (56, 189, 248, 255),   # Sky
        (236, 72, 153, 255),  # Pink
        (168, 85, 247, 255),  # Purple
        (251, 191, 36, 255),  # Amber
        (163, 230, 53, 255),  # Lime
    ]

    for idx, h in enumerate(heights):
        bx = start_x + idx * (bar_width + gap)
        bh = int(size * h)
        by1 = center_y - bh // 2
        by2 = center_y + bh // 2
        draw.rounded_rectangle(
            [bx, by1, bx + bar_width, by2],
            radius=bar_width // 2,
            fill=colors[idx]
        )

    img.save(output_path, "PNG")
    print(f"Saved {output_path} ({size}x{size})")

create_icon(192, "frontend/public/icon-192.png")
create_icon(512, "frontend/public/icon-512.png")
create_icon(180, "frontend/public/apple-touch-icon.png")
