from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


SOURCE_DIR = Path("docs/category_icon")
OUTPUT_DIR = Path("public/images/categories")


def color_distance_from_background(rgb: np.ndarray, background: np.ndarray) -> np.ndarray:
    diff = rgb.astype(np.int16) - background.astype(np.int16)
    return np.sqrt(np.sum(diff * diff, axis=2))


def background_color(rgb: np.ndarray) -> np.ndarray:
    corners = np.concatenate(
        [
            rgb[:20, :20].reshape(-1, 3),
            rgb[:20, -20:].reshape(-1, 3),
            rgb[-20:, :20].reshape(-1, 3),
            rgb[-20:, -20:].reshape(-1, 3),
        ],
        axis=0,
    )
    return np.median(corners, axis=0).astype(np.uint8)


def active_bbox(rgb: np.ndarray, background: np.ndarray, threshold: float = 10.0):
    active = color_distance_from_background(rgb, background) > threshold
    coords = np.argwhere(active)
    if len(coords) == 0:
        raise ValueError("No foreground pixels found.")

    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    return x_min, y_min, x_max + 1, y_max + 1


def outside_background_mask(rgb: np.ndarray, background: np.ndarray, threshold: float = 18.0) -> np.ndarray:
    h, w, _ = rgb.shape
    candidate = color_distance_from_background(rgb, background) <= threshold
    outside = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((y, x))

    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not outside[y, x]:
                outside[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                queue.append((ny, nx))

    return outside


def process_icon(name: str, outline_radius: int = 2, vertical_padding: int = 82) -> None:
    source_path = SOURCE_DIR / name
    output_path = OUTPUT_DIR / name

    source = Image.open(source_path).convert("RGB")
    source_rgb = np.array(source)
    bg = background_color(source_rgb)

    x_min, y_min, x_max, y_max = active_bbox(source_rgb, bg)
    cropped = source.crop((x_min, y_min, x_max, y_max)).convert("RGBA")
    cropped_rgb = np.array(cropped.convert("RGB"))

    outside = outside_background_mask(cropped_rgb, bg)

    gray = np.array(cropped.convert("L"))
    line_seed = gray < 185
    line_mask = Image.fromarray((line_seed * 255).astype(np.uint8), "L")
    line_mask = line_mask.filter(ImageFilter.MaxFilter(outline_radius * 2 + 1))
    line_mask = line_mask.filter(ImageFilter.GaussianBlur(0.35))
    line_alpha = np.array(line_mask)

    rgba = np.array(cropped)
    rgba[outside, 3] = 0
    rgba[~outside, 3] = 255

    # Match the existing icon family: dark wine-brown outlines over warm off-white fill.
    line_color = np.array([86, 62, 69], dtype=np.uint8)
    alpha = (line_alpha / 255.0)[:, :, None]
    rgba[:, :, :3] = (rgba[:, :, :3] * (1.0 - alpha) + line_color * alpha).astype(np.uint8)
    rgba[outside & (line_alpha < 8), 3] = 0
    rgba[outside & (line_alpha >= 8), 3] = line_alpha[outside & (line_alpha >= 8)]

    processed = Image.fromarray(rgba, "RGBA")
    visible = np.argwhere(np.array(processed)[:, :, 3] > 10)
    y0, x0 = visible.min(axis=0)
    y1, x1 = visible.max(axis=0)
    processed = processed.crop((x0, y0, x1 + 1, y1 + 1))

    canvas_size = processed.height + vertical_padding
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = ((canvas_size - processed.width) // 2, vertical_padding // 2)
    canvas.alpha_composite(processed, offset)
    canvas.save(output_path, "PNG")

    print(f"{name}: {source.size} -> {canvas.size}, drawing={processed.size}, offset={offset}")


if __name__ == "__main__":
    process_icon("bodycare.png")
    process_icon("haircare.png")
    process_icon("feminine-hygiene.png")
