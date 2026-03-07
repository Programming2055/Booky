"""
Generate extension icons for Booky Chrome Extension.
Requires: pillow (pip install pillow)
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Please install Pillow: pip install pillow")
    exit(1)

import os
import math

# Icon sizes required by Chrome
SIZES = [16, 32, 48, 128]

# Modern color palette
BLUE = (66, 133, 244)        # Main blue color
BLUE_DARK = (48, 99, 182)    # Darker blue for depth
WHITE = (255, 255, 255)
CREAM = (255, 250, 240)      # Warm page color
GOLD = (255, 193, 7)         # Bookmark accent
SHADOW = (0, 0, 0, 40)       # Soft shadow

def create_rounded_rect_mask(size, radius):
    """Create a rounded rectangle mask"""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    return mask

def create_icon(size):
    """Create a modern book icon with bookmark"""
    # Create base image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate proportions
    padding = max(1, size // 10)
    radius = max(2, size // 6)
    
    # Main area
    x1, y1 = padding, padding
    x2, y2 = size - padding, size - padding
    
    # Draw shadow (offset slightly)
    shadow_offset = max(1, size // 20)
    shadow_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_img)
    shadow_draw.rounded_rectangle(
        [x1 + shadow_offset, y1 + shadow_offset, x2 + shadow_offset, y2 + shadow_offset],
        radius=radius, fill=(0, 0, 0, 60)
    )
    img = Image.alpha_composite(img, shadow_img)
    draw = ImageDraw.Draw(img)
    
    # Draw main book body (blue background)
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=BLUE)
    
    # Draw open book pages (cream/white area)
    page_margin = max(2, size // 8)
    page_x1 = x1 + page_margin
    page_y1 = y1 + page_margin
    page_x2 = x2 - page_margin
    page_y2 = y2 - page_margin
    page_radius = max(1, radius // 2)
    
    draw.rounded_rectangle([page_x1, page_y1, page_x2, page_y2], 
                          radius=page_radius, fill=CREAM)
    
    # Draw center spine line (book fold)
    center_x = (page_x1 + page_x2) // 2
    spine_width = max(1, size // 20)
    draw.line([(center_x, page_y1 + 2), (center_x, page_y2 - 2)], 
              fill=BLUE_DARK, width=spine_width)
    
    # Draw text lines on left page
    line_color = (200, 200, 200)
    line_width = max(1, size // 40)
    line_gap = max(3, (page_y2 - page_y1) // 6)
    
    for i in range(1, 5):
        line_y = page_y1 + i * line_gap
        if line_y < page_y2 - line_gap // 2:
            # Left page lines
            left_line_end = center_x - max(2, size // 16)
            line_length_var = (i % 2) * max(2, size // 12)  # Vary line lengths
            draw.line([(page_x1 + 3, line_y), (left_line_end - line_length_var, line_y)], 
                      fill=line_color, width=line_width)
            # Right page lines
            right_line_start = center_x + max(2, size // 16)
            draw.line([(right_line_start, line_y), (page_x2 - 3 - line_length_var, line_y)], 
                      fill=line_color, width=line_width)
    
    # Draw bookmark ribbon (gold accent)
    bookmark_width = max(2, size // 8)
    bookmark_x = page_x2 - bookmark_width - max(1, size // 16)
    bookmark_top = y1
    bookmark_bottom = page_y1 + (page_y2 - page_y1) // 2
    
    # Bookmark body
    draw.rectangle([bookmark_x, bookmark_top, bookmark_x + bookmark_width, bookmark_bottom],
                   fill=GOLD)
    
    # Bookmark triangle point at bottom
    triangle_height = max(2, bookmark_width // 2)
    triangle_points = [
        (bookmark_x, bookmark_bottom),
        (bookmark_x + bookmark_width, bookmark_bottom),
        (bookmark_x + bookmark_width // 2, bookmark_bottom + triangle_height)
    ]
    draw.polygon(triangle_points, fill=GOLD)
    
    # Add subtle highlight on top-left corner
    if size >= 32:
        highlight_size = max(3, size // 10)
        for i in range(highlight_size):
            alpha = int(30 * (1 - i / highlight_size))
            draw.arc([x1 + 2, y1 + 2, x1 + highlight_size * 2, y1 + highlight_size * 2],
                    180, 270, fill=(255, 255, 255, alpha), width=1)
    
    return img

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("Generating Booky extension icons...")
    
    for size in SIZES:
        icon = create_icon(size)
        filename = f"icon{size}.png"
        filepath = os.path.join(script_dir, filename)
        icon.save(filepath, 'PNG')
        print(f"  Created {filename}")
    
    print("\nDone! Icons created successfully.")
    print("Reload the extension in chrome://extensions/ to see the new icons.")

if __name__ == '__main__':
    main()
