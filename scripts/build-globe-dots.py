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

def rings_for(geometry: dict) -> list[list[list[float]]]:
    kind = geometry["type"]
    coords = geometry["coordinates"]
    if kind == "Polygon":
        return [coords]
    if kind == "MultiPolygon":
        return coords
    return []

def decode_topo(topo: dict, geometry: dict) -> list[list[list[float]]]:
    scale = topo["transform"]["scale"]
    translate = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        arcs.append(points)
    polygons = []
    groups = geometry["arcs"] if geometry["type"] == "MultiPolygon" else [geometry["arcs"]]
    for polygon in groups:
        rings = []
        for ring_indexes in polygon:
            ring = []
            for index in ring_indexes:
                arc = arcs[index] if index >= 0 else list(reversed(arcs[~index]))
                ring.extend(arc if not ring else arc[1:])
            rings.append(ring)
        polygons.append(rings)
    return polygons

def in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    count = len(ring)
    j = count - 1
    for i in range(count):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside

def in_polygons(lon: float, lat: float, polygons: list) -> bool:
    for rings in polygons:
        if not rings or not in_ring(lon, lat, rings[0]):
            continue
        if any(in_ring(lon, lat, hole) for hole in rings[1:]):
            continue
        return True
    return False

atlas = json.loads((root / "public" / "globe" / "countries-110m.json").read_text(encoding="utf-8"))
ids = json.loads((root / "public" / "globe" / "country-ids.json").read_text(encoding="utf-8"))
outlines: dict[str, list] = {}
for geometry in atlas["objects"]["countries"]["geometries"]:
    iso = ids.get(str(geometry.get("id", "")))
    if not iso or iso == "GB":
        continue
    outlines[iso] = decode_topo(atlas, geometry)
nations = json.loads((root / "data" / "uk-nations.json").read_text(encoding="utf-8"))
for feature in nations["features"]:
    outlines[feature["properties"]["iso2"]] = rings_for(feature["geometry"])

dots: list[list[float]] = []
shortfalls: list[str] = []
for country in picks["countries"]:
    iso = country["iso"]
    votes = int(country["totalVotes"])
    points = cities.get(iso)
    if not points:
        shortfalls.append(f"{iso}: 0 of {votes} votes, no city points for this country")
        continue
    shape = outlines.get(iso)
    light = 0 if fill_is_pale.get(iso, True) else 1
    placed = 0
    for _ in range(votes):
        for _attempt in range(40):
            longitude, latitude = weighted_point(points)
            if shape and not in_polygons(longitude, latitude, shape):
                continue
            dots.append([round(longitude, 3), round(latitude, 3), light])
            placed += 1
            break
    if placed != votes:
        reason = "no country outline" if not shape else "city points kept falling outside the outline"
        shortfalls.append(f"{iso}: {placed} of {votes} votes, {reason}")

out = root / "data" / "worldcup-dots.json"
out.write_text(json.dumps(dots, separators=(",", ":")), encoding="utf-8")
print(f"dots {len(dots)}")
print(f"votes {sum(int(country['totalVotes']) for country in picks['countries'])}")
if shortfalls:
    print("shortfalls")
    for line in shortfalls:
        print(line)
else:
    print("shortfalls none")
