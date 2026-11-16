"""Prepare traceable public lecture assets. No generated historical source material."""
import csv
import html
import io
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
FRONT = ROOT / "frontend"
DATA = FRONT / "data"
ASSETS = FRONT / "assets"
DATA.mkdir(exist_ok=True)
ASSETS.mkdir(exist_ok=True)


def get(url):
    with urlopen(Request(url, headers={"User-Agent": "TRC-Research-Workbench/2.0"}), timeout=35) as response:
        return response.read()


class Blocks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.blocks, self.buf, self.images = [], [], []
        self.skip = 0
        self.kind = "p"

    def flush(self):
        text = " ".join("".join(self.buf).split())
        self.buf = []
        if text:
            self.blocks.append({"id": f"p{len(self.blocks)+1:03}", "kind": self.kind, "text": text})

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if self.skip:
            return
        if tag in ("h1", "h2", "h3", "h4", "p", "li", "blockquote", "tr"):
            self.flush()
            self.kind = tag
        if tag == "br":
            self.buf.append(" ")
        if tag == "img":
            a = dict(attrs)
            if a.get("src"):
                self.images.append({"url": a["src"], "alt": a.get("alt", "강연 슬라이드")})

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
            return
        if not self.skip and tag in ("h1", "h2", "h3", "h4", "p", "li", "blockquote", "tr"):
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.buf.append(data)


wp_file = ROOT.parent / "tmp" / "trc-review" / "wp1130.json"
post = json.loads(wp_file.read_text(encoding="utf-8-sig")) if wp_file.exists() else json.loads(get("https://blog.soohwalee.com/wp-json/wp/v2/posts/1130"))
parser = Blocks()
parser.feed(post["content"]["rendered"])
parser.flush()
images = []
for item in parser.images:
    name = item["url"].rsplit("/", 1)[-1]
    target = ASSETS / name
    if not target.exists():
        target.write_bytes(get(item["url"]))
    images.append({**item, "src": f"assets/{name}"})
lecture = {"title": html.unescape(post["title"]["rendered"]), "url": post["link"], "published": post["date"], "modified": post["modified"], "source_type": "공개 강연 편집 채록본", "audio_available": False, "blocks": parser.blocks, "images": images}
(DATA / "lecture.json").write_text(json.dumps(lecture, ensure_ascii=False, indent=2), encoding="utf-8")

csv_url = "https://raw.githubusercontent.com/danilofreire/pinochet/master/data/pinochet.csv"
raw = get(csv_url)
csv_rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
print("Dataset rows:", len(csv_rows))
print("Coordinate flags:", Counter(r.get("exact_coordinates_1") for r in csv_rows))
source_map = {}
for idx, row in enumerate(csv_rows, 1):
    flag = str(row.get("exact_coordinates_1", "")).lower()
    source_map[f"CHL_REAL_{idx:04d}"] = {
        "coordinate_precision": "exact" if flag in ("1", "true", "t") else "approximate" if flag in ("0", "false", "f") else "unknown",
        "date_in_source": row.get("start_date_daily", ""),
        "location_start": row.get("location_1", ""),
        "location_end": row.get("location_2", ""),
        "gender": row.get("gender", ""),
        "source_page": row.get("page", ""),
    }
(ROOT / "backend" / "source_metadata.json").write_text(json.dumps(source_map, ensure_ascii=False), encoding="utf-8")

for url, name in [
    ("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "leaflet.js"),
    ("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "leaflet.css"),
]:
    target = ASSETS / name
    if not target.exists():
        target.write_bytes(get(url))
print("Lecture blocks:", len(parser.blocks), "Slide images:", len(images))
