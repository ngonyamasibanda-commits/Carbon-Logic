#!/usr/bin/env python3
"""Assemble the full app walkthrough from the original tutorial screenshots."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "tutorial" / "shots"
WORK = ROOT / "tutorial" / ".work" / "full-tutorial"
OUT = ROOT / "tutorial" / "Carbon-Logic-tutorial.mp4"
FFMPEG = ROOT / "tutorial" / ".tools" / "node_modules" / "ffmpeg-static" / "ffmpeg"
W, H, FPS = 1920, 1080, 30
NAVY = (2, 35, 78, 255)
GREEN = (108, 190, 44, 255)
WHITE = (255, 255, 255, 255)

FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
FONT_REG = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
if not FONT_BOLD.exists():
    FONT_BOLD = Path("/Library/Fonts/Arial Bold.ttf")
    FONT_REG = Path("/Library/Fonts/Arial.ttf")


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), size)


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
    dest.parent.mkdir(parents=True, exist_ok=True)
    crop_16x9(im, focus).resize((2560, 1440), Image.Resampling.LANCZOS).save(dest, "PNG")


def card(path: Path, lines: list[tuple[str, int, tuple[int, int, int]]]) -> None:
    im = Image.new("RGB", (W, H), NAVY[:3])
    draw = ImageDraw.Draw(im)
    bar = Image.new("RGB", (W, 14), GREEN[:3])
    im.paste(bar, (0, 0))
    im.paste(bar, (0, H - 14))
    y = 300
    for text, size, color in lines:
        f = font(size, bold=True)
        bbox = draw.textbbox((0, 0), text, font=f)
        tw = bbox[2] - bbox[0]
        draw.text(((W - tw) // 2, y), text, font=f, fill=color)
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
    draw.text((48, H - band.size[1] + 22), headline, font=font(40), fill=WHITE)
    if sub:
        draw.text((48, H - 62), sub, font=font(24, bold=False), fill=(198, 220, 168, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def ken_burns(plate_png: Path, overlay_png: Path | None, seconds: float, dest: Path) -> None:
    frames = max(int(round(seconds * FPS)), 2)
    dest.parent.mkdir(parents=True, exist_ok=True)
    z_inc = 0.06 / max(frames - 1, 1)
    filt = (
        f"zoompan=z='min(zoom+{z_inc:.6f},1.06)':x='iw/2-(iw/zoom/2)':"
        f"y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},format=yuv420p"
    )
    cmd = [str(FFMPEG), "-y", "-loop", "1", "-i", str(plate_png)]
    if overlay_png:
        cmd += ["-i", str(overlay_png)]
        filt = filt + "[v];[v][1:v]overlay=0:0:format=auto,format=yuv420p"
        cmd += ["-filter_complex", filt, "-t", f"{seconds:.3f}", "-r", str(FPS), "-an", str(dest)]
    else:
        cmd += ["-vf", filt, "-t", f"{seconds:.3f}", "-r", str(FPS), "-an", str(dest)]
    run(cmd)


def still(plate_png: Path, seconds: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            str(FFMPEG),
            "-y",
            "-loop",
            "1",
            "-i",
            str(plate_png),
            "-vf",
            "scale=1920:1080,format=yuv420p",
            "-t",
            f"{seconds:.3f}",
            "-r",
            str(FPS),
            "-an",
            str(dest),
        ]
    )


SCENES: list[dict] = [
    {
        "id": "00-open",
        "kind": "card",
        "seconds": 4.0,
        "lines": [
            ("Carbon Logic", 88, WHITE),
            ("Full app tutorial", 40, GREEN),
            ("Meridian Construction Group — dummy inventory", 26, (180, 196, 214)),
        ],
    },
    {"id": "01-login", "src": "cl-01-login.png", "headline": "Sign in", "sub": "Password, magic link, or SSO.", "focus": "center", "seconds": 4.0},
    {"id": "02-dash", "src": "t-03-dashboard-top.png", "headline": "Dashboard", "sub": "Year-to-date footprint, live.", "focus": "top", "seconds": 4.5},
    {"id": "03-dash-charts", "src": "t-04-dashboard-charts.png", "headline": "Dashboard charts", "sub": "Scope split and year-on-year.", "focus": "top", "seconds": 4.0},
    {"id": "04-sites", "src": "t-05-facilities.png", "headline": "Facilities", "sub": "Sites, depots, warehouses, offices.", "focus": "center", "seconds": 4.0},
    {"id": "05-input", "src": "t-06-input-hub.png", "headline": "Data input", "sub": "Pick a category and log activity.", "focus": "top", "seconds": 4.0},
    {"id": "06-scope3", "src": "t-07-input-hub-scope3.png", "headline": "Scope 3 categories", "sub": "Freight, waste, materials, travel.", "focus": "center", "seconds": 4.0},
    {"id": "07-form", "src": "t-08-machinery-form.png", "headline": "Heavy machinery", "sub": "The form before you fill it.", "focus": "center", "seconds": 4.0},
    {"id": "08-filled", "src": "t-08b-machinery-filled.png", "headline": "Log an entry", "sub": "Excavator · diesel · 4,200 L.", "focus": "center", "seconds": 4.5},
    {"id": "09-extra", "src": "t-09-machinery-additional.png", "headline": "Additional data", "sub": "Site, evidence, tags, comments.", "focus": "center", "seconds": 4.0},
    {"id": "10-rows", "src": "t-10-machinery-results.png", "headline": "Results table", "sub": "Every row, with tCO₂e.", "focus": "bottom", "seconds": 4.0},
    {"id": "11-materials", "src": "t-11-materials-results.png", "headline": "Bulk materials", "sub": "Concrete, steel, cement.", "focus": "bottom", "seconds": 4.0},
    {"id": "12-factors", "src": "t-12-factors-top.png", "headline": "Emission factors", "sub": "Published conversion values.", "focus": "top", "seconds": 4.0},
    {"id": "13-factor-list", "src": "t-13-factors-list.png", "headline": "Factor library", "sub": "Source, unit, and kg CO₂e.", "focus": "center", "seconds": 4.0},
    {"id": "14-analysis", "src": "t-14-analysis-top.png", "headline": "Analysis", "sub": "Filter by month, site, category.", "focus": "top", "seconds": 4.0},
    {"id": "15-trend", "src": "t-15-analysis-trend.png", "headline": "Monthly trend", "sub": "Scope 1, 2 and 3 over time.", "focus": "center", "seconds": 4.5},
    {"id": "16-intensity", "src": "t-16-analysis-intensity.png", "headline": "Intensity", "sub": "tCO₂e per £m turnover.", "focus": "center", "seconds": 4.0},
    {"id": "17-scope-table", "src": "t-17-analysis-scope-table.png", "headline": "By scope and category", "sub": "Where the tonnes sit.", "focus": "center", "seconds": 4.0},
    {"id": "18-cat15", "src": "t-18-analysis-cat15.png", "headline": "GHG Protocol 1–15", "sub": "Empty means not logged, not zero.", "focus": "center", "seconds": 4.5},
    {"id": "19-sources", "src": "t-19-analysis-top-sources.png", "headline": "Top sources", "sub": "The activities that move the total.", "focus": "center", "seconds": 4.0},
    {"id": "20-combined", "src": "t-20-combined-top.png", "headline": "Combined results", "sub": "The full inventory in one place.", "focus": "top", "seconds": 4.5},
    {"id": "21-plain", "src": "t-21-combined-plain.png", "headline": "In plain language", "sub": "What the numbers mean.", "focus": "center", "seconds": 4.5},
    {"id": "22-s1", "src": "t-22-combined-scope1.png", "headline": "Scope 1", "sub": "Direct emissions from owned assets.", "focus": "center", "seconds": 4.0},
    {"id": "23-s3", "src": "t-23-combined-cat15.png", "headline": "Scope 3 completeness", "sub": "Ready for SECR and PPN 06/21.", "focus": "center", "seconds": 4.5},
    {"id": "24-sites-table", "src": "t-24-combined-by-site.png", "headline": "By site", "sub": "Which facility owns which tonnes.", "focus": "center", "seconds": 4.0},
    {"id": "25-targets", "src": "t-25-targets-top.png", "headline": "Science-based targets", "sub": "Near-term and net-zero.", "focus": "top", "seconds": 4.0},
    {"id": "26-settings", "src": "t-26-targets-settings.png", "headline": "Target settings", "sub": "Base year, horizon, pathway.", "focus": "center", "seconds": 4.0},
    {"id": "27-legs", "src": "t-27-targets-legs.png", "headline": "The three legs", "sub": "Scope 1+2, Scope 3, net-zero.", "focus": "top", "seconds": 4.5},
    {"id": "28-pathway", "src": "t-28-targets-pathway.png", "headline": "Decarbonisation pathway", "sub": "Required cut through to 2050.", "focus": "top", "seconds": 4.5},
    {"id": "29-criteria", "src": "t-29-targets-criteria.png", "headline": "Criteria checks", "sub": "Against the SBTi corporate rules.", "focus": "center", "seconds": 4.0},
    {"id": "30-language", "src": "t-30-targets-language.png", "headline": "Target language", "sub": "Wording for the validation pack.", "focus": "center", "seconds": 4.0},
    {"id": "31-progress", "src": "t-31-targets-progress.png", "headline": "Progress", "sub": "Logged years vs the pathway.", "focus": "center", "seconds": 4.0},
    {"id": "32-learn", "src": "t-32-learn.png", "headline": "Learning Hub", "sub": "Scopes, factors, and how to report.", "focus": "top", "seconds": 4.0},
    {"id": "33-faqs", "src": "t-33-faqs.png", "headline": "FAQs", "sub": "The questions reporters actually ask.", "focus": "top", "seconds": 4.0},
    {"id": "34-people", "src": "t-34-people.png", "headline": "People & access", "sub": "Invite, roles, and isolation.", "focus": "top", "seconds": 4.0},
    {"id": "35-account", "src": "t-35-account.png", "headline": "Account", "sub": "Profile, organisation, session.", "focus": "top", "seconds": 4.0},
    {
        "id": "36-end",
        "kind": "card",
        "seconds": 4.5,
        "lines": [
            ("Carbon Logic", 88, WHITE),
            ("Every screen. One inventory.", 36, GREEN),
            ("carbon-logic.vercel.app", 28, (180, 196, 214)),
        ],
    },
]


def main() -> None:
    if not FFMPEG.exists():
        raise SystemExit(f"ffmpeg missing at {FFMPEG}")
    if WORK.exists():
        for child in WORK.iterdir():
            if child.is_file():
                child.unlink()
    WORK.mkdir(parents=True, exist_ok=True)

    clips: list[Path] = []
    timeline: list[dict] = []
    t = 0.0
    for scene in SCENES:
        sid = scene["id"]
        scene_dir = WORK / sid
        scene_dir.mkdir(exist_ok=True)
        seconds = float(scene["seconds"])
        clip = scene_dir / "clip.mp4"
        plate_png = scene_dir / "plate.png"
        if scene.get("kind") == "card":
            card(plate_png, scene["lines"])
            still(plate_png, seconds, clip)
            headline = scene["lines"][0][0]
        else:
            src = SHOTS / scene["src"]
            if not src.exists():
                raise SystemExit(f"missing shot {src}")
            plate(src, plate_png, scene.get("focus", "center"))
            ov = scene_dir / "overlay.png"
            overlay(ov, scene["headline"], scene.get("sub", ""))
            ken_burns(plate_png, ov, seconds, clip)
            headline = scene["headline"]
        clips.append(clip)
        timeline.append({"id": sid, "start": round(t, 2), "duration": round(seconds, 2), "headline": headline})
        t += seconds

    concat = WORK / "v.txt"
    concat.write_text("".join(f"file '{c}'\n" for c in clips))
    run(
        [
            str(FFMPEG),
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-an",
            str(OUT),
        ]
    )
    (WORK / "timeline.json").write_text(json.dumps({"seconds": t, "scenes": timeline}, indent=2))
    print(f"OUTPUT {OUT}")
    print(f"TOTAL {t:.2f}s")


if __name__ == "__main__":
    main()
