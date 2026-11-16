import json
import posixpath
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image
from io import BytesIO

deck = Path(r"C:\Users\westw\OneDrive\2026 신규문서\2026.11 라틴아메리카진실화해위원회의과거사정리\라틴아메리카진실화해위원회의과거사정리-한국에제공하는시사점(202610).pptx")
root = Path(__file__).resolve().parents[1]
dest = root / "frontend" / "assets" / "lecture-original"
dest.mkdir(parents=True, exist_ok=True)
ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main", "p": "http://schemas.openxmlformats.org/presentationml/2006/main"}
records = []
with zipfile.ZipFile(deck) as z:
    slides = sorted((n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)), key=lambda x: int(re.search(r"slide(\d+)",x).group(1)))
    for name in slides:
        number = int(re.search(r"slide(\d+)",name).group(1))
        tree = ET.fromstring(z.read(name))
        text = " ".join(e.text or "" for e in tree.findall(".//a:t", ns))
        relname = f"ppt/slides/_rels/slide{number}.xml.rels"
        rels = {e.attrib["Id"]: e.attrib["Target"] for e in ET.fromstring(z.read(relname))} if relname in z.namelist() else {}
        for pic in tree.findall(".//p:pic", ns):
            blip = pic.find(".//a:blip", ns)
            if blip is None:
                continue
            rid = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            if rid not in rels:
                continue
            target = posixpath.normpath(posixpath.join("ppt/slides", rels[rid]))
            if target not in z.namelist():
                continue
            raw = z.read(target)
            try:
                image = Image.open(BytesIO(raw))
                w,h = image.size
            except Exception:
                continue
            if w < 250 or h < 180:
                continue
            filename = f"slide{number:02d}-{Path(target).name}"
            (dest / filename).write_bytes(raw)
            records.append({"id":f"ppt-{number}-{Path(target).stem}", "slide":number,"src":f"assets/lecture-original/{filename}","width":w,"height":h,"slide_text":text,"source":"박구병 강연자료 원본 PPTX (2026.10)","caption":f"박구병 강연자료 {number}번 슬라이드의 원본 이미지"})
(root / "frontend" / "data" / "photos.json").write_text(json.dumps(records, ensure_ascii=False, indent=2),encoding="utf-8")
print("Extracted",len(records),"images")
for r in records:
    print(f"slide {r['slide']:02}  {r['width']}x{r['height']}  {r['src']}  {r['slide_text'][:70]}")
