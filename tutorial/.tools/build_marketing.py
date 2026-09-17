#!/usr/bin/env python3
"""Build the sub-2-minute Carbon Logic construction marketing video."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "tutorial" / "shots"
WORK = ROOT / "tutorial" / ".work"
OUT = ROOT / "tutorial" / "Carbon-Logic-construction.mp4"
FFMPEG = ROOT / "tutorial" / ".tools" / "node_modules" / "ffmpeg-static" / "ffmpeg"
FFPROBE = shutil.which("ffprobe")
W, H, FPS = 1920, 1080, 30
NAVY = (2, 35, 78, 255)
GREEN = (108, 190, 44, 255)
WHITE = (255, 255, 255, 255)
INK = (15, 30, 51, 255)

FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
FONT_REG = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
if not FONT_BOLD.exists():
    FONT_BOLD = Path("/Library/Fonts/Arial Bold.ttf")
    FONT_REG = Path("/Library/Fonts/Arial.ttf")


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold else FONT_REG
    return ImageFont.truetype(str(path), size)


def crop_16x9(im: Image.Image, focus: str = "center") -> Image.Image:
    w, h = im.size
    target = 16 / 9
    if w / h > target:
        nw = int(h * target)
        x0 = {"left": 0, "right": w - nw}.get(focus, (w - nw) // 2)
        return im.crop((x0, 0, x0 + nw, h))
    nh = int(w / target)
    y0 = 0 if focus == "top" else (h - nh) // 2
    if focus == "bottom":
        y0 = h - nh
    return im.crop((0, y0, w, y0 + nh))


def plate(src: Path, dest: Path, focus: str = "center") -> None:
    im = Image.open(src).convert("RGB")
    cropped = crop_16x9(im, focus)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cropped.resize((2560, 1440), Image.Resampling.LANCZOS).save(dest, "PNG")


def card(path: Path, lines: list[tuple[str, int, tuple[int, int, int, int]]]) -> None:
    im = Image.new("RGB", (W, H), NAVY[:3])
    draw = ImageDraw.Draw(im)
    bar = Image.new("RGB", (W, 14), GREEN[:3])
    im.paste(bar, (0, 0))
    im.paste(bar, (0, H - 14))
    y = 280
    for text, size, color in lines:
        f = font(size, bold=True)
        bbox = draw.textbbox((0, 0), text, font=f)
        tw = bbox[2] - bbox[0]
        draw.text(((W - tw) // 2, y), text, font=f, fill=color[:3])
        y += size + 28
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")


def overlay(path: Path, headline: str, sub: str = "") -> None:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    band = Image.new("RGBA", (W, 168 if sub else 118), (2, 35, 78, 210))
    im.paste(band, (0, H - band.size[1]), band)
    accent = Image.new("RGBA", (10, band.size[1]), GREEN)
    im.paste(accent, (0, H - band.size[1]), accent)
    hf = font(46)
    draw.text((48, H - band.size[1] + 22), headline, font=hf, fill=WHITE)
    if sub:
        draw.text((48, H - 62), sub, font=font(26, bold=False), fill=(198, 220, 168, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def duration_of(audio: Path) -> float:
    if FFPROBE:
        out = subprocess.check_output(
            [FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(audio)],
            text=True,
        ).strip()
        return float(out)
    # afinfo fallback
    info = subprocess.check_output(["afinfo", str(audio)], text=True)
    for line in info.splitlines():
        if "estimated duration" in line.lower():
            return float(line.split(":")[-1].strip().split()[0])
    raise RuntimeError(f"Could not read duration of {audio}")


def say(text: str, dest: Path, rate: int = 195) -> float:
    dest.parent.mkdir(parents=True, exist_ok=True)
    aiff = dest.with_suffix(".aiff")
    run(["say", "-r", str(rate), "-o", str(aiff), text])
    run([str(FFMPEG), "-y", "-i", str(aiff), "-c:a", "aac", "-b:a", "192k", str(dest)])
    aiff.unlink(missing_ok=True)
    return duration_of(dest)


def ken_burns(plate_png: Path, overlay_png: Path | None, seconds: float, dest: Path, zoom_end: float = 1.12) -> None:
    frames = max(int(round(seconds * FPS)), 2)
    dest.parent.mkdir(parents=True, exist_ok=True)
    z_inc = (zoom_end - 1.0) / max(frames - 1, 1)
    filt = (
        f"zoompan=z='min(zoom+{z_inc:.6f},{zoom_end})':x='iw/2-(iw/zoom/2)':"
        f"y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},format=yuv420p"
    )
    cmd = [str(FFMPEG), "-y", "-loop", "1", "-i", str(plate_png)]
    if overlay_png:
        cmd += ["-i", str(overlay_png)]
        filt = filt + f"[v];[v][1:v]overlay=0:0:format=auto,format=yuv420p"
        cmd += ["-filter_complex", filt, "-t", f"{seconds:.3f}", "-r", str(FPS), "-an", str(dest)]
    else:
        cmd += ["-vf", filt, "-t", f"{seconds:.3f}", "-r", str(FPS), "-an", str(dest)]
    run(cmd)


def still(plate_png: Path, overlay_png: Path | None, seconds: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [str(FFMPEG), "-y", "-loop", "1", "-i", str(plate_png)]
    if overlay_png:
        cmd += [
            "-i",
            str(overlay_png),
            "-filter_complex",
            "overlay=0:0:format=auto,format=yuv420p",
            "-t",
            f"{seconds:.3f}",
            "-r",
            str(FPS),
            "-an",
            str(dest),
        ]
    else:
        cmd += ["-vf", "scale=1920:1080,format=yuv420p", "-t", f"{seconds:.3f}", "-r", str(FPS), "-an", str(dest)]
    run(cmd)


SCENES = [
    {
        "id": "01-hook",
        "kind": "card",
        "lines": [
            ("21,579 tCO₂e", 96, WHITE),
            ("Construction. Mining. Logistics.", 42, GREEN),
            ("Carbon accounting for all three.", 28, (180, 196, 214, 255)),
        ],
        "vo": "Every construction site burns diesel, pours concrete, and buys steel. Carbon Logic turns that into a G H G Protocol inventory.",
        "min": 6.2,
    },
    {
        "id": "02-dashboard",
        "src": "t-03-dashboard-top.png",
        "focus": "top",
        "headline": "Year to date. Live.",
        "sub": "3,836 tCO₂e  ·  8.2% down vs last year",
        "vo": "Meridian Construction. Year to date: three thousand eight hundred tonnes. Eight percent down versus last year.",
        "min": 5.4,
        "zoom": 1.10,
    },
    {
        "id": "03-form",
        "src": "t-08b-machinery-filled.png",
        "focus": "center",
        "headline": "Log a site in seconds.",
        "sub": "Excavator. Diesel. 4,200 litres. Riverside Quarter.",
        "vo": "Log excavators, site fuel, and ready-mix in seconds. Factors do the maths.",
        "min": 5.0,
        "zoom": 1.08,
    },
    {
        "id": "04-materials",
        "src": "t-11-materials-results.png",
        "focus": "bottom",
        "headline": "Concrete. Steel. Cement.",
        "sub": "The tonnes that actually move a footprint.",
        "vo": "",
        "min": 3.0,
        "zoom": 1.10,
    },
    {
        "id": "05-combined",
        "src": "t-20-combined-top.png",
        "focus": "top",
        "headline": "21,579 tCO₂e from 138 activities.",
        "sub": "Scope 1 · 2 · 3. Automatic.",
        "vo": "The full footprint: twenty-one thousand five hundred tonnes from one hundred thirty-eight activities.",
        "min": 5.6,
        "zoom": 1.08,
    },
    {
        "id": "06-plain",
        "src": "t-21-combined-plain.png",
        "focus": "center",
        "headline": "85% is Scope 3.",
        "sub": "That’s construction. The app says so in plain language.",
        "vo": "Eighty-five percent is Scope 3 — materials, freight, and waste.",
        "min": 4.6,
        "zoom": 1.08,
    },
    {
        "id": "07-cat15",
        "src": "t-23-combined-cat15.png",
        "focus": "center",
        "headline": "Every GHG category. Filled in.",
        "sub": "Ready for SECR and PPN 06/21.",
        "vo": "Every G H G category, ready for S E C R and P P N 06 21.",
        "min": 5.0,
        "zoom": 1.08,
    },
    {
        "id": "08-trend",
        "src": "t-15-analysis-trend.png",
        "focus": "center",
        "headline": "See the year, not a spreadsheet.",
        "sub": "Monthly trend across Scope 1, 2 and 3.",
        "vo": "",
        "min": 3.2,
        "zoom": 1.10,
    },
    {
        "id": "09-targets",
        "src": "t-27-targets-legs.png",
        "focus": "top",
        "headline": "47.2% off Scope 1 + 2 by 2033.",
        "sub": "1.5°C aligned. Built from the live inventory.",
        "vo": "Set a science-based target. Forty-seven percent off Scope 1 and 2 by 2033.",
        "min": 5.4,
        "zoom": 1.08,
    },
    {
        "id": "10-pathway",
        "src": "t-28-targets-pathway.png",
        "focus": "top",
        "headline": "A pathway to net zero.",
        "sub": "Near-term cut, then 90% by 2050.",
        "vo": "A pathway to net zero.",
        "min": 4.4,
        "zoom": 1.12,
    },
    {
        "id": "11-facilities",
        "src": "t-05-facilities.png",
        "focus": "center",
        "headline": "Sites. Team. Access.",
        "sub": "The rest of the job, in one place.",
        "vo": "",
        "min": 2.2,
        "zoom": 1.06,
    },
    {
        "id": "12-export",
        "src": "t-20-combined-top.png",
        "focus": "top",
        "headline": "Export the inventory. One click.",
        "sub": "CSV for the model. PDF for the client.",
        "vo": "Export the inventory. One click.",
        "min": 3.6,
        "zoom": 1.06,
    },
    {
        "id": "13-cta",
        "kind": "card",
        "lines": [
            ("Carbon Logic", 88, WHITE),
            ("Built for construction, mining, & logistics.", 36, GREEN),
            ("carbon-logic.vercel.app", 30, (180, 196, 214, 255)),
        ],
        "vo": "Carbon Logic. Carbon accounting built for construction.",
        "min": 5.2,
    },
]


def main() -> None:
    if not FFMPEG.exists():
        raise SystemExit(f"ffmpeg missing at {FFMPEG}")
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)

    clips: list[Path] = []
    audio_parts: list[Path] = []
    timeline: list[dict] = []
    t = 0.0

    for scene in SCENES:
        sid = scene["id"]
        scene_dir = WORK / sid
        scene_dir.mkdir()
        vo_text = scene.get("vo") or ""
        if vo_text:
            vo_path = scene_dir / "vo.m4a"
            vo_dur = say(vo_text, vo_path)
        else:
            vo_path = scene_dir / "silence.m4a"
            seconds = scene["min"]
            run(
                [
                    str(FFMPEG),
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    "anullsrc=r=44100:cl=stereo",
                    "-t",
                    f"{seconds:.3f}",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "192k",
                    str(vo_path),
                ]
            )
            vo_dur = seconds
        seconds = max(scene["min"], vo_dur + 0.35)
        if vo_dur + 0.2 < seconds:
            # pad audio to match picture
            padded = scene_dir / "vo-pad.m4a"
            run(
                [
                    str(FFMPEG),
                    "-y",
                    "-i",
                    str(vo_path),
                    "-af",
                    f"apad=pad_dur={seconds - vo_dur:.3f}",
                    "-t",
                    f"{seconds:.3f}",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "192k",
                    str(padded),
                ]
            )
            vo_path = padded

        plate_png = scene_dir / "plate.png"
        ov_png = scene_dir / "overlay.png"
        clip = scene_dir / "clip.mp4"
        if scene.get("kind") == "card":
            card(plate_png, scene["lines"])
            still(plate_png, None, seconds, clip)
        else:
            src = SHOTS / scene["src"]
            plate(src, plate_png, scene.get("focus", "center"))
            overlay(ov_png, scene["headline"], scene.get("sub", ""))
            ken_burns(plate_png, ov_png, seconds, clip, scene.get("zoom", 1.10))

        clips.append(clip)
        audio_parts.append(vo_path)
        timeline.append(
            {
                "id": sid,
                "start": round(t, 2),
                "duration": round(seconds, 2),
                "headline": scene.get("headline") or scene["lines"][0][0],
                "vo": vo_text,
            }
        )
        t += seconds

    concat_v = WORK / "v.txt"
    concat_a = WORK / "a.txt"
    concat_v.write_text("".join(f"file '{c}'\n" for c in clips))
    concat_a.write_text("".join(f"file '{a}'\n" for a in audio_parts))
    video = WORK / "video.mp4"
    audio = WORK / "audio.m4a"
    run(
        [
            str(FFMPEG),
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_v),
            "-c",
            "copy",
            str(video),
        ]
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_a),
            "-c",
            "copy",
            str(audio),
        ]
    )
    run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(video),
            "-i",
            str(audio),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(OUT),
        ]
    )
    info = subprocess.check_output(
        [str(FFMPEG), "-i", str(OUT)],
        stderr=subprocess.STDOUT,
        text=True,
    )
    print(info)
    print(f"OUTPUT {OUT}")
    print(f"TOTAL {t:.2f}s")
    (WORK / "timeline.json").write_text(json.dumps({"seconds": t, "scenes": timeline}, indent=2))
    script = ROOT / "tutorial" / "SCRIPT.md"
    lines = [
        "# Carbon Logic — construction marketing cut",
        "",
        f"Runtime: **{t:.1f} seconds**. Dummy company: Meridian Construction Group.",
        "",
        "| Start | Dur | On screen | Narration |",
        "| --- | --- | --- | --- |",
    ]
    for row in timeline:
        vo = row["vo"].replace("|", "/") if row["vo"] else "—"
        lines.append(f"| {row['start']:.1f}s | {row['duration']:.1f}s | {row['headline']} | {vo} |")
    lines += [
        "",
        "Claims match the dummy inventory on screen: 21,579 tCO₂e from 138 activities,",
        "85% Scope 3, 8.2% reduction vs a 4,180 tCO₂e baseline, 47.2% near-term Scope 1+2 target.",
        "",
    ]
    script.write_text("\n".join(lines))


if __name__ == "__main__":
    main()
