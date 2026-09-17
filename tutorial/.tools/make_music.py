#!/usr/bin/env python3
"""Upbeat drum-led marketing bed: four-on-the-floor, busy hats, punchy snare."""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
BPM = 126
BEAT = 60.0 / BPM
SECONDS = 42
OUT = Path(__file__).resolve().parents[1] / ".work" / "music.wav"
rng = random.Random(7)


def clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x


def exp_env(t: float, attack: float, decay: float) -> float:
    if t < 0:
        return 0.0
    if t < attack:
        return t / max(attack, 1e-6)
    return math.exp(-(t - attack) / max(decay, 1e-6))


def noise() -> float:
    return rng.random() * 2 - 1


def hp_noise(prev: float, x: float, a: float = 0.92) -> tuple[float, float]:
    y = a * (prev + x)
    return y, y


def mix_into(buf: list[float], start: int, grain: list[float], gain: float) -> None:
    n = len(buf)
    for i, s in enumerate(grain):
        j = start + i
        if 0 <= j < n:
            buf[j] += s * gain


def kick() -> list[float]:
    length = int(0.22 * RATE)
    out = [0.0] * length
    for i in range(length):
        t = i / RATE
        freq = 168 * math.exp(-t * 28) + 42
        body = math.sin(2 * math.pi * freq * t)
        click = math.sin(2 * math.pi * 1800 * t) * exp_env(t, 0.0004, 0.008)
        out[i] = body * exp_env(t, 0.0015, 0.11) * 1.15 + click * 0.22
    return out


def snare() -> list[float]:
    length = int(0.18 * RATE)
    out = [0.0] * length
    hp = 0.0
    for i in range(length):
        t = i / RATE
        tone = math.sin(2 * math.pi * 196 * t) * exp_env(t, 0.001, 0.055)
        snap = noise()
        hp, snap = hp_noise(hp, snap, 0.86)
        out[i] = tone * 0.45 + snap * exp_env(t, 0.0006, 0.04) * 0.85
    return out


def clap() -> list[float]:
    length = int(0.16 * RATE)
    out = [0.0] * length
    bursts = (0.0, 0.011, 0.019, 0.028)
    for start in bursts:
        for i in range(length):
            t = i / RATE - start
            if t < 0 or t > 0.05:
                continue
            out[i] += noise() * exp_env(t, 0.0004, 0.018) * (0.55 if start == 0.028 else 0.28)
    return out


def closed_hat() -> list[float]:
    length = int(0.055 * RATE)
    out = [0.0] * length
    hp = 0.0
    for i in range(length):
        t = i / RATE
        hp, n = hp_noise(hp, noise(), 0.96)
        out[i] = n * exp_env(t, 0.0003, 0.012)
    return out


def open_hat() -> list[float]:
    length = int(0.22 * RATE)
    out = [0.0] * length
    hp = 0.0
    for i in range(length):
        t = i / RATE
        hp, n = hp_noise(hp, noise(), 0.97)
        out[i] = n * exp_env(t, 0.0004, 0.09)
    return out


def bass_note(freq: float, dur: float) -> list[float]:
    length = int(dur * RATE)
    out = [0.0] * length
    for i in range(length):
        t = i / RATE
        wave = math.tanh(1.6 * math.sin(2 * math.pi * freq * t) + 0.25 * math.sin(4 * math.pi * freq * t))
        out[i] = wave * exp_env(t, 0.006, dur * 0.55)
    return out


def main() -> None:
    n = int(RATE * SECONDS)
    left = [0.0] * n
    right = [0.0] * n
    side = [1.0] * n

    k = kick()
    s = snare()
    c = clap()
    ch = closed_hat()
    oh = open_hat()

    sixteenth = BEAT / 4
    hat_vel = [1.0, 0.32, 0.62, 0.28, 0.88, 0.3, 0.7, 0.34, 0.95, 0.28, 0.6, 0.3, 0.82, 0.36, 0.68, 0.4]
    roots = [49.00, 49.00, 43.65, 36.71]  # G1, G1, F1, D1

    steps = int(SECONDS / sixteenth)
    for step in range(steps):
        t0 = step * sixteenth
        i0 = int(t0 * RATE)
        beat = step // 4
        sixteenth_in_bar = step % 16
        bar = beat // 4

        # Four-on-the-floor kick + ducking envelope
        if step % 4 == 0:
            mix_into(left, i0, k, 1.0)
            mix_into(right, i0, k, 1.0)
            for j in range(int(0.22 * RATE)):
                idx = i0 + j
                if idx < n:
                    side[idx] = min(side[idx], 0.18 + 0.82 * (1 - math.exp(-j / (0.07 * RATE))))

        # Snare / clap on 2 and 4
        if step % 16 in (4, 12):
            mix_into(left, i0, s, 0.72)
            mix_into(right, i0, s, 0.72)
            mix_into(left, i0, c, 0.38)
            mix_into(right, i0 + 40, c, 0.38)

        # Closed hats: 16ths, slightly swung, panned
        vel = hat_vel[sixteenth_in_bar]
        swing = int(0.006 * RATE) if step % 2 else 0
        mix_into(left, i0 + swing, ch, 0.42 * vel)
        mix_into(right, i0 + swing + 18, ch, 0.50 * vel)

        # Extra off-beat hats in the second half of each 8 bars
        if bar % 8 >= 4 and step % 2 == 1:
            mix_into(left, i0 + swing, ch, 0.18)
            mix_into(right, i0 + swing, ch, 0.16)

        # Open hat on the last 8th of even bars
        if sixteenth_in_bar == 14 and bar % 2 == 0:
            mix_into(left, i0, oh, 0.28)
            mix_into(right, i0, oh, 0.32)

        # Bass on each beat, sidechained later
        if step % 4 == 0:
            root = roots[bar % len(roots)]
            note = bass_note(root, BEAT * 0.95)
            mix_into(left, i0, note, 0.34)
            mix_into(right, i0, note, 0.34)

    for i in range(n):
        duck = side[i]
        l = (left[i] * (0.55 + 0.45 * duck) if True else left[i])
        r = right[i] * (0.55 + 0.45 * duck)
        # Soft clip / tape-ish saturation
        left[i] = math.tanh(l * 1.15)
        right[i] = math.tanh(r * 1.15)

    peak = max(max(abs(x) for x in left), max(abs(x) for x in right), 1e-6)
    scale = 0.92 / peak
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "w") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        frames = bytearray()
        for i in range(n):
            frames += struct.pack("<hh", int(left[i] * scale * 32767), int(right[i] * scale * 32767))
        wf.writeframes(frames)
    print(OUT)


if __name__ == "__main__":
    main()
