# Awesome Website

A demo project: build a website with Claude Code. Planned content, in order:

1. **Pictures** – a gallery of images supplied by the user.
2. **Documents** – PDF documents the user supplies; Claude reads each one and writes a summary for the site.
3. **Game** – a small browser video game built by Claude, linked from the site.

Created 2026-11-20 on the Mac (`~/Dropbox/projects/awesome-website`).

## Standing instructions

- **Always address the user as "Master of the Universe"** in this project, in every reply.
- Writing follows the global conventions in `~/.claude/CLAUDE.md` (plain declarative prose, en dashes, no em dashes, plain titles and labels).

## Inbox

The user copies new files into `inbox/`. When asked to process the inbox ("process the inbox", "I dropped some files in"):

1. List what is in `inbox/` and say what each file is.
2. File each one by type:
   - **Images** (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`, …) → `originals/images/<slug>.<ext>` (lowercase dash-slug, e.g. `sunset-at-lake.jpg`; convert HEIC to JPEG). Look at each image, then add it to a group in `content/gallery.toml` with a plain factual caption; dates from the file name or camera metadata, and no names or places guessed from the picture.
   - **PDFs** → `site/docs/<slug>.pdf` (e.g. `smith-et-al-2021.pdf`; gitignored – journal articles are copyrighted and the repo is public, so they stay on the Mac and pages link to the publisher by DOI). Read the whole document and write `content/docs/<slug>.md` in the summary format below. Long or several PDFs: one background agent per paper, given the format.
   - **Anything else** → ask the user what it is for before moving it.
3. Run `/usr/local/bin/python3 build.py` and check the changed pages with headless Chrome.
4. Remove each inbox file only after its filed copy matches by checksum (`md5 -q`), leaving `inbox/README.md` in place.
5. Report what was added and where.

Files in `inbox/` are never edited in place.

## Paper summaries

`content/docs/<slug>.md` is the reference for writing about a paper on the site without rereading it. Front matter `title`, `authors` (`Surname, I.; Surname, I.` – semicolons between authors), `year`, `journal`, `doi` (required; if the paper prints none, find it and confirm it resolves at doi.org), `pdf`; then sections *In one sentence*, *Question*, *Data and method*, *Main findings* (specific numbers), *Why it matters*, *Figures worth showing* (figure, journal page and PDF page), *Notes for commentary*. 300–600 words. Commentary written for the site goes in a `## Commentary` section appended to the same file, so it renders on the paper's page.

## Layout and build

| Path | Contents | Edited by |
|---|---|---|
| `inbox/` | Drop zone for new files | user |
| `originals/images/` | Full-size images; may carry GPS metadata, so never served and **gitignored** (a clone cannot regenerate `site/images/`) | filed from inbox |
| `content/gallery.toml` | Gallery groups and captions; must list every original image | hand |
| `content/docs/*.md` | Paper summaries (and commentary) | hand / Claude |
| `build.py` | Generates the site; `--check` validates inputs only | hand |
| `site/` | The website; open `site/index.html` in a browser | see below |
| `site/style.css`, `site/gallery.js`, `site/theme.js` | Stylesheet (light and dark colour sets), gallery lightbox, header light/dark switch (choice saved in localStorage) | hand |
| `site/docs/*.pdf` | The papers – **local only, gitignored**; pages show a "PDF (local copy)" link that is dead in a clone | filed from inbox |
| `site/images/`, `site/*.html`, `site/docs/*.html` | **Generated** by `build.py`; never edit | build |
| `site/game/` | **Hail Defense** (`index.html`, `game.js`, `game.css`): original fixed-shooter in the arcade genre, weather themed – not a copy of any existing game. `index.html?demo` plays itself from a fixed seed (status line, used for headless checks) | hand |

`build.py` writes web copies at most 1600 px (thumbnails 640 px) with EXIF orientation applied and **all metadata stripped**. A PNG with more than 150 000 distinct colours is treated as a photograph and saved as JPEG; other PNGs stay PNG. It fails loudly if `gallery.toml` and `originals/images/` disagree or a summary's PDF is missing. Check pages with headless Chrome (`~/.claude/wiki/mac-dev-gotchas.md`); there is no web server.

## Git and GitHub

Local git, branch `main`, public GitHub repo `jason-milbrandt/awesome-website`. **The repo is public**: commit nothing private – no originals with metadata, no copyrighted PDFs. The user chose (2026-11-20) to publish all gallery pictures, family photos included. Commit trailer per global `CLAUDE.md`.

## Status

- 2026-11-20: project created – `CLAUDE.md` and `inbox/`.
- 2026-11-20: first inbox processed – 16 pictures in 5 gallery groups, 4 papers summarised (Cober and List 1993, Bourgouin 2000, Brandes et al. 2007, Cintineo et al. 2014). Site has home, gallery (lightbox) and document pages. Captions naming people are from file names; the user should confirm them. Next: the game.
- 2026-11-20: header light/dark switch on every page (`theme.js`); game **Hail Defense** built by a background agent and checked (headless demo run, 0 errors). Public GitHub repo created. Not yet checked on a real device: game sound and touch buttons.
