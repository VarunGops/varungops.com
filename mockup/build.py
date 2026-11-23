"""Assemble varungops-mockup.html from the parts in src/.  usage: python3 build.py"""
from pathlib import Path

here = Path(__file__).parent
src = here / "src"
js = (src / "main.js").read_text(encoding="utf-8")
assert js.count("/*__SMOKE__*/") == 1
js = js.replace("/*__SMOKE__*/", (src / "smoke.js").read_text(encoding="utf-8").rstrip("\n"))
assert js.count("/*__HEART__*/") == 1
js = js.replace("/*__HEART__*/", (src / "heart.js").read_text(encoding="utf-8").rstrip("\n"))
page = (src / "head.html").read_text(encoding="utf-8") + "\n" + (src / "body.html").read_text(encoding="utf-8") + "\n<script>\n(() => {\n'use strict';\n" + js + "})();\n</script>\n"
(here / "varungops-mockup.html").write_text(page, encoding="utf-8")
print("built", len(page), "bytes")

# base64 copies of the binary data, for hosts that only serve text
import base64
for name in ("brain", "tracts", "heart"):
    raw = (here / "data" / f"{name}.bin").read_bytes()
    (here / "data" / f"{name}.b64.txt").write_bytes(base64.b64encode(raw))
    print(f"  data/{name}.b64.txt", len(raw) * 4 // 3, "bytes")
