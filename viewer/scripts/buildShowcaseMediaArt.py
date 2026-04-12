from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont


def load_font(size: int, *, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def fit_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    src_ratio = image.width / image.height
    dst_ratio = size[0] / size[1]
    if src_ratio > dst_ratio:
        scaled_height = size[1]
        scaled_width = round(scaled_height * src_ratio)
    else:
        scaled_width = size[0]
        scaled_height = round(scaled_width / src_ratio)
    resized = image.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
    left = max(0, (scaled_width - size[0]) // 2)
    top = max(0, (scaled_height - size[1]) // 2)
    return resized.crop((left, top, left + size[0], top + size[1]))


def prepare_motion_frame(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGB")
    crop = (
        int(image.width * 0.05),
        int(image.height * 0.03),
        int(image.width * 0.95),
        int(image.height * 0.97),
    )
    framed = image.crop(crop)
    return framed.resize((960, 540), Image.Resampling.LANCZOS)


def build_motion_gif(frames_dir: Path, output_path: Path) -> None:
    frame_paths = sorted(frames_dir.glob("motion-*.png"))
    if not frame_paths:
        raise RuntimeError("No motion frames found to build the flagship replay GIF.")
    frames = [prepare_motion_frame(path).convert("P", palette=Image.Palette.ADAPTIVE) for path in frame_paths]
    durations = [1000, 700, 700, 700, 700, 1400][: len(frames)]
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )


def build_social_preview(overview_path: Path, output_path: Path) -> None:
    canvas = Image.new("RGB", (1280, 640), ImageColor.getrgb("#eef2f7"))
    draw = ImageDraw.Draw(canvas)

    draw.rounded_rectangle((28, 24, 1252, 616), radius=30, fill=ImageColor.getrgb("#f8fafc"))
    draw.rounded_rectangle((28, 24, 42, 616), radius=8, fill=ImageColor.getrgb("#2563eb"))
    draw.rounded_rectangle((42, 24, 56, 180), radius=8, fill=ImageColor.getrgb("#fde68a"))

    headline_font = load_font(48, bold=True)
    subhead_font = load_font(30, bold=False)
    label_font = load_font(22, bold=True)
    detail_font = load_font(22, bold=False)

    draw.text((96, 74), "Glass", font=label_font, fill=ImageColor.getrgb("#64748b"))
    draw.text(
        (96, 118),
        "See what your code or\nagent actually did.",
        font=headline_font,
        fill=ImageColor.getrgb("#0f172a"),
    )
    draw.text(
        (96, 230),
        "Replay-first bounded investigation surface",
        font=subhead_font,
        fill=ImageColor.getrgb("#334155"),
    )
    draw.text(
        (96, 286),
        "scene -> change -> evidence -> receipt",
        font=label_font,
        fill=ImageColor.getrgb("#2563eb"),
    )
    draw.text(
        (96, 336),
        "Bounded showcase only. Optional local live shell is secondary.",
        font=detail_font,
        fill=ImageColor.getrgb("#475569"),
    )
    draw.text(
        (96, 390),
        "Flagship replay: canonical_v15_append_heavy",
        font=detail_font,
        fill=ImageColor.getrgb("#334155"),
    )

    screenshot = Image.open(overview_path).convert("RGB")
    screenshot_crop = screenshot.crop(
        (
            int(screenshot.width * 0.08),
            int(screenshot.height * 0.08),
            int(screenshot.width * 0.92),
            int(screenshot.height * 0.72),
        )
    )
    preview = fit_cover(screenshot_crop, (500, 352))
    preview_mask = rounded_mask(preview.size, 24)

    shadow = Image.new("RGBA", (preview.width + 22, preview.height + 22), (0, 0, 0, 0))
    shadow_mask = rounded_mask((preview.width, preview.height), 24)
    shadow.paste((15, 23, 42, 80), (11, 11), shadow_mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    canvas.paste(shadow, (704, 156), shadow)

    preview_rgba = preview.convert("RGBA")
    preview_rgba.putalpha(preview_mask)
    canvas.paste(preview_rgba, (716, 168), preview_rgba)

    border = ImageDraw.Draw(canvas)
    border.rounded_rectangle((716, 168, 1216, 520), radius=24, outline=ImageColor.getrgb("#cbd5e1"), width=3)

    canvas.save(output_path, format="PNG")


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit("Usage: buildShowcaseMediaArt.py <frames_dir> <overview_png> <motion_gif> <social_png>")
    frames_dir = Path(sys.argv[1])
    overview_path = Path(sys.argv[2])
    motion_output = Path(sys.argv[3])
    social_output = Path(sys.argv[4])
    build_motion_gif(frames_dir, motion_output)
    build_social_preview(overview_path, social_output)


if __name__ == "__main__":
    main()
