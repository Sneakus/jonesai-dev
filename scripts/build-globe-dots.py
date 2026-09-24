import csv
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
cities_text = (root / "data" / "cities.js").read_text(encoding="utf-8")
start = cities_text.index("const CITY_PULSES = ") + len("const CITY_PULSES = ")
end = cities_text.index("};", start)
cities = json.loads(cities_text[start:end].strip().replace("'", '"') + "}")
picks = json.loads((root / "data" / "worldcup-picks.json").read_text(encoding="utf-8"))
paper = (243, 239, 230)

def pale(hex_color: str) -> bool:
    value = int(hex_color[1:], 16)
    channels = (
        ((value >> 16) & 255) * 0.7 + paper[0] * 0.3,
        ((value >> 8) & 255) * 0.7 + paper[1] * 0.3,
        (value & 255) * 0.7 + paper[2] * 0.3,
    )
    luminance = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255
    return luminance > 0.72

fill_is_pale = {}
for country in picks["countries"]:
    fill_is_pale[country["iso"]] = pale(picks["teamColors"][country["topPick"]])

state = 1

def random_unit() -> float:
    global state
    state = (state + 0x6D2B79F5) & 0xFFFFFFFF
    value = state
    value = (value ^ (value >> 15)) * (value | 1) & 0xFFFFFFFF
    value ^= (value + ((value ^ (value >> 7)) * (value | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
    return ((value ^ (value >> 14)) & 0xFFFFFFFF) / 4294967296

def weighted_point(points: list[list[float]]) -> tuple[float, float]:
    total = sum(point[2] for point in points)
    mark = random_unit() * total
    running = 0.0
    chosen = points[-1]
    for point in points:
        running += point[2]
        if running >= mark:
            chosen = point
            break
    latitude = chosen[0] + (random_unit() * 2 - 1) * 0.14
    longitude = chosen[1] + (random_unit() * 2 - 1) * 0.18
    return longitude, latitude

dots: list[list[float]] = []
skipped: list[str] = []
rows = csv.DictReader((root / "data" / "worldcup-predictions-by-country.csv").open(encoding="utf-8"))
for row in rows:
    iso = row["nation_iso2"]
    count = int(row["predictions"])
    points = cities.get(iso)
    if not points:
        skipped.append(f"{iso} ({count})")
        continue
    light = 0 if fill_is_pale.get(iso) else 1
    for _ in range(count):
        longitude, latitude = weighted_point(points)
        dots.append([round(longitude, 3), round(latitude, 3), light])

out = root / "data" / "worldcup-dots.json"
out.write_text(json.dumps(dots, separators=(",", ":")), encoding="utf-8")
print(f"dots {len(dots)}")
print(f"skipped {skipped}")
