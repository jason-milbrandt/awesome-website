#!/usr/local/bin/python3
"""Build the static site in site/ from originals/ and content/.

    /usr/local/bin/python3 build.py          # build
    /usr/local/bin/python3 build.py --check  # verify inputs only, write nothing

Inputs
  originals/images/*          full-size images (never published directly)
  content/gallery.toml        groups and captions; must list every original image
  content/docs/<slug>.md      paper summaries (YAML-style front matter + markdown);
                              `doi:` is required; the PDF named in `pdf:` is optional
                              (PDFs are copyrighted, kept on the Mac only, not in git)
Outputs (generated, safe to delete and rebuild)
  site/images/<name>          web copy: max 1600 px, EXIF orientation applied, metadata stripped
  site/images/thumbs/<name>   thumbnail: max 640 px
  site/index.html, site/gallery.html, site/docs/index.html, site/docs/<slug>.html
Hand-written, not generated: site/style.css, site/gallery.js, site/game/
Local only (gitignored): site/docs/*.pdf
"""
import html
import re
import sys
import tomllib
import urllib.parse
from pathlib import Path

import markdown
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
ORIG = ROOT / "originals" / "images"
CONTENT = ROOT / "content"
SITE = ROOT / "site"
WEB_MAX, THUMB_MAX = 1600, 640
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def fail(msg):
    sys.exit(f"build.py: {msg}")


# ---------------------------------------------------------------- inputs
def load_gallery():
    groups = tomllib.loads((CONTENT / "gallery.toml").read_text())["group"]
    listed = [img["file"] for g in groups for img in g["images"]]
    on_disk = sorted(p.name for p in ORIG.iterdir() if p.suffix.lower() in IMAGE_EXT)
    missing = [f for f in listed if f not in on_disk]
    unlisted = [f for f in on_disk if f not in listed]
    dupes = sorted({f for f in listed if listed.count(f) > 1})
    if missing or unlisted or dupes:
        fail(f"gallery.toml out of step with originals/images: missing={missing} "
             f"unlisted={unlisted} duplicated={dupes}")
    return groups


def parse_front_matter(text, path):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        fail(f"{path}: no front matter")
    meta = {}
    for line in m.group(1).splitlines():
        if line.strip():
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip()
    return meta, m.group(2)


def load_docs():
    docs = []
    for path in sorted((CONTENT / "docs").glob("*.md")):
        meta, body = parse_front_matter(path.read_text(), path)
        for key in ("title", "authors", "year", "journal", "doi"):
            if key not in meta:
                fail(f"{path}: front matter lacks '{key}'")
        meta["has_pdf"] = bool(meta.get("pdf")) and (SITE / "docs" / meta["pdf"]).exists()
        body = re.sub(r"^# .*\n", "", body.lstrip(), count=1)  # title is rendered from front matter
        one = re.search(r"## In one sentence\s*\n+(.+?)\n\s*\n", body, re.S)
        meta.update(slug=path.stem, body=body,
                    one_sentence=" ".join(one.group(1).split()) if one else "")
        docs.append(meta)
    return sorted(docs, key=lambda d: d["year"])


# ---------------------------------------------------------------- images
PHOTO_COLOURS = 150_000  # a PNG with more distinct colours (at 800 px) is a photograph


def png_kind(src):
    """Return (transparent, photographic) for a PNG source."""
    im = Image.open(src).convert("RGBA")
    im.thumbnail((800, 800))
    transparent = im.getchannel("A").getextrema()[0] < 250
    return transparent, len(im.convert("RGB").getcolors(1 << 24)) > PHOTO_COLOURS


def output_names(src):
    """(web name, thumb name). JPEG for photos (including photos saved as PNG);
    PNG kept for transparency, and for figures/line art in the full-size copy."""
    if src.suffix.lower() != ".png":
        return src.stem + ".jpg", src.stem + ".jpg"
    transparent, photo = png_kind(src)
    web = src.stem + (".jpg" if photo and not transparent else ".png")
    return web, src.stem + (".png" if transparent else ".jpg")


def render_image(src, dst, max_px):
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return False
    im = ImageOps.exif_transpose(Image.open(src))
    im.thumbnail((max_px, max_px), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.suffix == ".png":
        im.save(dst, optimize=True)          # no pnginfo passed: text chunks dropped
    else:
        im.convert("RGB").save(dst, quality=85, optimize=True, progressive=True)  # no exif passed: metadata dropped
    return True


def build_images(groups):
    n = 0
    for g in groups:
        for img in g["images"]:
            src = ORIG / img["file"]
            web, thumb = output_names(src)
            n += render_image(src, SITE / "images" / web, WEB_MAX)
            n += render_image(src, SITE / "images" / "thumbs" / thumb, THUMB_MAX)
            with Image.open(SITE / "images" / "thumbs" / thumb) as t:
                img["thumb_size"] = t.size
            img["web"], img["thumb"] = web, thumb
    return n


# ---------------------------------------------------------------- pages
NAV = [("Home", "index.html"), ("Pictures", "gallery.html"),
       ("Documents", "docs/index.html"), ("Game", "game/index.html")]


def page(title, body, depth=0, active=""):
    up = "../" * depth
    nav = "".join(
        f'<a href="{up}{href}"{" aria-current=\"page\"" if label == active else ""}>{label}</a>'
        for label, href in NAV)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} – Awesome Website</title>
<link rel="stylesheet" href="{up}style.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="{up}index.html">Awesome Website</a>
  <nav>{nav}</nav>
</header>
<main>
{body}
</main>
<footer class="site-footer">Built with Claude Code · page generated by build.py</footer>
</body>
</html>
"""


def gallery_page(groups):
    sections = []
    for g in groups:
        figs = []
        for img in g["images"]:
            cap = html.escape(img["caption"])
            w, h = img["thumb_size"]
            figs.append(
                f'<figure><a href="images/{img["web"]}" data-caption="{cap}">'
                f'<img src="images/thumbs/{img["thumb"]}" alt="{cap}" width="{w}" height="{h}" loading="lazy"></a>'
                f'<figcaption>{cap}</figcaption></figure>')
        sections.append(f'<section class="group"><h2>{html.escape(g["title"])}</h2>'
                        f'<div class="grid">{"".join(figs)}</div></section>')
    body = ('<h1>Pictures</h1><p class="lede">Select a picture to view it full size; '
            'arrow keys move between pictures, Escape closes.</p>' + "".join(sections) +
            '<script src="gallery.js"></script>')
    return page("Pictures", body, 0, "Pictures")


def docs_index(docs):
    items = "".join(
        f'<li><a href="{d["slug"]}.html"><span class="doc-title">{html.escape(d["title"])}</span></a>'
        f'<span class="doc-meta">{html.escape(d["authors"])} · {d["year"]} · {html.escape(d["journal"])}</span>'
        f'<p>{html.escape(d["one_sentence"])}</p></li>' for d in docs)
    body = ('<h1>Documents</h1><p class="lede">Summaries of scientific papers, '
            'each linked to the publisher\'s page.</p>'
            f'<ul class="doc-list">{items}</ul>')
    return page("Documents", body, 1, "Documents")


def doc_page(d):
    md = markdown.markdown(d["body"], extensions=["extra", "sane_lists"])
    url = "https://doi.org/" + urllib.parse.quote(d["doi"], safe="/()")
    pdf = (f' <a class="local-pdf" href="{html.escape(d["pdf"])}">PDF (local copy)</a>'
           if d["has_pdf"] else "")
    body = (f'<p class="crumb"><a href="index.html">Documents</a></p>'
            f'<h1>{html.escape(d["title"])}</h1>'
            f'<p class="doc-meta">{html.escape(d["authors"])} · {d["year"]} · {html.escape(d["journal"])}'
            f' · doi:{html.escape(d["doi"])}</p>'
            f'<p><a class="button" href="{html.escape(url)}">Publisher\'s page</a>{pdf}</p>'
            f'<article class="summary">{md}</article>')
    return page(d["title"], body, 1, "Documents")


def home_page(groups, docs):
    n_img = sum(len(g["images"]) for g in groups)
    strip = [img for g in groups for img in g["images"]
             if g["title"] in ("Aircraft field work", "Colleagues and conferences", "Science figures")][:4]
    thumbs = "".join(f'<img src="images/thumbs/{i["thumb"]}" alt="{html.escape(i["caption"])}">' for i in strip)
    game = SITE / "game" / "index.html"
    game_ready = game.exists() and PLACEHOLDER not in game.read_text()
    body = f"""
<section class="hero">
  <h1>Awesome Website</h1>
  <p>A demonstration site built with Claude Code: pictures, summaries of scientific papers, and a small browser game.</p>
</section>
<div class="cards">
  <a class="card" href="gallery.html">
    <div class="card-strip">{thumbs}</div>
    <h2>Pictures</h2><p>{n_img} pictures in {len(groups)} groups.</p>
  </a>
  <a class="card" href="docs/index.html">
    <h2>Documents</h2><p>{len(docs)} paper summaries, each linked to the publisher.</p>
    <ul>{"".join(f"<li>{html.escape(short_authors(d['authors']))} ({d['year']})</li>" for d in docs)}</ul>
  </a>
  <a class="card{'' if game_ready else ' card-pending'}" href="game/index.html">
    <h2>Game</h2><p>{'A small browser game.' if game_ready else 'In preparation.'}</p>
  </a>
</div>"""
    return page("Home", body, 0, "Home")


PLACEHOLDER = "In preparation."


def short_authors(authors):
    """'Cober, S. G.; List, R.' -> 'Cober and List'; three or more -> 'Brandes et al.'"""
    names = [a.split(",")[0].strip() for a in authors.split(";")]
    if len(names) == 1:
        return names[0]
    return f"{names[0]} and {names[1]}" if len(names) == 2 else f"{names[0]} et al."


def game_placeholder():
    return page("Game", f'<h1>Game</h1><p class="lede">{PLACEHOLDER}</p>', 1, "Game")


def main():
    check = "--check" in sys.argv
    groups = load_gallery()
    docs = load_docs()
    if check:
        print(f"ok: {sum(len(g['images']) for g in groups)} images, {len(docs)} docs")
        return
    n = build_images(groups)
    out = {
        SITE / "index.html": home_page(groups, docs),
        SITE / "gallery.html": gallery_page(groups),
        SITE / "docs" / "index.html": docs_index(docs),
        **{SITE / "docs" / f"{d['slug']}.html": doc_page(d) for d in docs},
    }
    game = SITE / "game" / "index.html"
    if not game.exists() or PLACEHOLDER in game.read_text():
        out[game] = game_placeholder()
    for path, text in out.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    print(f"built: {len(out)} pages, {n} image files rendered, {len(docs)} docs")


if __name__ == "__main__":
    main()
