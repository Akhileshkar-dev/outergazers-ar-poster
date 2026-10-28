# README — Team Outergazers WebAR Source Package
**For teammates: how to run, edit, rebuild and deploy this project**

---

## Production URL
```
https://outergazers-webar-task3.vercel.app
```

## Registration URL
```
https://outergazer.in/events/intracollege-gamejam-2026
```

> DO NOT change the registration URL in index.html without team approval.

---

## What Is In This Archive

This is the **complete development source package** for the Team Outergazers WebAR experience.
It includes every editable source file, all version history .bak backups, build scripts,
scroll artwork components, audio files, test pages and seven checkpoint snapshots covering
the full development history from the earliest prototype to the final locked build.

The working project lives in `webar-prototype-outergazers/`.
Historical checkpoints are in `_checkpoints/` — treat them as read-only references.

---

## Tech Stack

| Component | Version |
|---|---|
| AR Framework | MindAR 1.2.5 (image tracking) |
| 3D Scene | A-Frame 1.5.0 |
| 3D Models | GLB (GLTF Binary) |
| Local Server | Node.js (built-in, no npm needed) |
| Deployment | Vercel |

---

## Prerequisites

- **Node.js v16+** — https://nodejs.org (only needed for local server)
- **Python 3.8+** — only if you need to rebuild scroll artwork (optional)
- **Pillow** — `pip install Pillow` — only for scroll build scripts
- **Blender 5.2+** — only if editing 3D models
- A modern browser: Chrome 90+ or Safari 15+ recommended
- HTTPS is required for camera access. The local server uses `127.0.0.1` which is fine for desktop.
  For mobile testing, use ngrok (see below).

---

## Running Locally (30 seconds)

1. Open a terminal in the `webar-prototype-outergazers/` folder.
2. Start the dev server:
   ```bash
   node serve.js
   ```
3. Open in browser:
   ```
   http://127.0.0.1:8089
   ```
4. Allow camera access when prompted.
5. Point the camera at the GameJam 2026 poster.

### Mobile Testing Over LAN (ngrok)
```bash
# In a second terminal:
ngrok http 8089
# Copy the https:// URL and open it on your phone
```

---

## Project Structure

```
webar-prototype-outergazers/
│
├── index.html                    ← Main AR experience (EDIT THIS to change the scene)
├── outergazers-timeline.js       ← Animation timeline controller (EDIT THIS to change sequences)
├── serve.js                      ← Local dev server (no changes needed)
├── vercel.json                   ← Deployment config
├── compile_mind_target.html      ← In-browser tool to recompile poster.mind
├── .env.example                  ← Environment variable template
├── SOURCE_MANIFEST.md            ← Full file catalogue for this archive
├── README_SOURCE_GUIDE.md        ← This file
│
├── assets/
│   ├── *.glb                     ← 3D models (runtime exports — see "Editing 3D Models")
│   ├── images/                   ← Scroll artwork and poster images
│   ├── audio/                    ← Sound effects (MP3/MPEG + WAV cinematic pack)
│   └── explosion/
│       ├── frames/               ← 61 individual explosion frame PNGs (SOURCE)
│       ├── explosion_spritesheet.png  ← Assembled spritesheet (GENERATED)
│       └── explosion_metadata.json   ← Spritesheet config
│
├── Sounds/                       ← Legacy audio path (kept for backward compat)
│
├── *.py                          ← Scroll artwork build scripts
├── *.bak                         ← Version history (see "Development History")
│
└── _checkpoints/                 ← Read-only historical snapshots
    ├── webar-prototype/
    ├── webar-prototype-outergazers-checkpoint-20261012-0930/
    ├── OUTERGAZERS_CHECKPOINT_2026-10-13_15-17-44/
    ├── OUTERGAZERS_CHECKPOINT_TASK13_2026-10-15_15-28-09/
    ├── OUTERGAZERS_FONT_FBX_TEST/
    ├── OUTERGAZERS_FINAL_APPROVED_CHECKPOINT_20261023_141643/
    └── webar-prototype-outergazers_BACKUP_FINAL_WORKING_20261023_0905/
```

---

## Editing the JavaScript (outergazers-timeline.js)

This is the main file to change for:
- Adjusting animation timing (search for `delay:` or `duration:`)
- Changing particle counts, sizes or colours (search for `particles`)
- Modifying scroll reveal timing (search for `scrollReveal`)
- Changing the registration button URL (search for `outergazer.in`)
- Adding or removing animation stages

**Before editing:** make a backup first:
```powershell
Copy-Item outergazers-timeline.js outergazers-timeline.js.pre_mychange.bak
```

**LOCKED settings — do not change without team approval:**
- `filterMinCF: 0.001` / `filterBeta: 1000` / `missTolerance: 15` / `warmupTolerance: 5` (Task 4)
- Root scale `0.183 0.183 0.183` and position `0 -0.488 0` (Task 5 Opt 1)

---

## Editing the HTML (index.html)

Change this file to:
- Add or remove A-Frame entities
- Change the MindAR tracking parameters (see LOCKED settings above)
- Modify the scroll UI layout
- Change fonts or overlay elements

---

## Editing 3D Models

The GLB files are self-contained runtime exports. The originating Blender source files
for the individual models (Grass_Spawn, Obsidian_Portal, Portal_Surface, chest, text)
were **not found on disk** and are listed as missing in SOURCE_MANIFEST.md.

**What you can do:**
1. Import any GLB into Blender (File > Import > glTF 2.0) — geometry and animations will load.
   Note: material nodes may not perfectly match the original authoring setup.
2. `outer_cinematic_assembly.blend` (in the project root) is a Blender scene file —
   open it in Blender 5.2+ to see what it contains.
3. For the OUTERGAZERS 3D text: recreate it in Blender using any suitable font with bevel,
   export as GLB, and replace `assets/outergazers_text_fbx_style.glb`.

---

## Rebuilding Scroll Artwork

The scroll uses component PNG images assembled by Python scripts.

**Source components (in project root):**
- `master_full_scroll.png` — main scroll artwork
- `orig_gamejam_center.png` — GameJam event center panel
- `master_full_top/bottom_roller.png` — roller strips
- `master_top/bot_left/right.png` — corner end-caps

**To rebuild the scroll after changing source PNGs:**
```bash
# Requires: pip install Pillow
python generate_flawless_scroll.py          # Re-generates roller strips and corners
python build_full_repaired_scroll.py        # Assembles the full scroll composite
```

The output files will be placed in the project root and should then be copied to
`assets/images/` if they are to replace the production scroll texture.

---

## Rebuilding the Poster Target (poster.mind)

> **Task 4 LOCKED — do not rebuild unless you are changing the poster image.**

If the AR poster image changes and you need a new `poster.mind`:

1. Open `compile_mind_target.html` in a desktop browser (Chrome recommended).
2. Drop the new poster PNG onto the page.
3. Wait for compilation (typically 10–30 seconds).
4. Download the generated `poster.mind` file.
5. Replace `assets/poster.mind` (back up the old one first).
6. Test thoroughly before deploying — tracking quality depends on the poster content.

---

## Rebuilding the Explosion Spritesheet

The 61 individual source frames are in `assets/explosion/frames/frame_000.png` to `frame_060.png`.
If you change any frames, regenerate the spritesheet using an image montage tool or adapt
the existing metadata in `assets/explosion/explosion_metadata.json` to match the new layout.

---

## Deployment (Vercel)

The project is already live at:
```
https://outergazers-webar-task3.vercel.app
```

**To redeploy after making changes:**

1. Install Vercel CLI (one-time):
   ```bash
   npm i -g vercel
   ```
2. Log in with the team Vercel account:
   ```bash
   vercel login
   ```
3. Link the directory (one-time, or use the `.vercel/project.json` already present):
   ```bash
   vercel link
   ```
4. Deploy to production:
   ```bash
   vercel --prod
   ```

> The `.vercel/project.json` file links this directory to the existing project
> `outergazers-webar-task3`. You need the Vercel account owner credentials to deploy.

**Environment variables:**
The `.env.local` file contains a live OIDC token and is **NOT included** in this archive.
Use `.env.example` as a template. Run `vercel link` to regenerate the real `.env.local`.

---

## Development History (Version Backups)

Every major change was backed up as a `.bak` file alongside the working file.
The naming convention is:

```
index.html.pre_<description>.bak           ← pre-edit snapshot
index.html.task<N>_backup.bak              ← post-task snapshot
outergazers-timeline.js.pre_<desc>.bak
outergazers-timeline.js.task<N>_backup.bak
```

To restore an earlier version:
```powershell
Copy-Item index.html.task10_backup.bak index.html
```

The earliest version of the entire codebase is in `_checkpoints/webar-prototype/`
(2 files: original index.html + first poster.mind).

---

## Task Status Reference

| Task | Description | Status |
|---|---|---|
| 1 | Basic AR anchor + A-Frame scene setup | Complete |
| 2 | 3D models + animation timeline | Complete |
| 3 | Initial MindAR poster target | Complete |
| 4 | Final tracking config (filterMinCF/Beta/missTolerance) | **LOCKED** |
| 5 Opt 1 | Performance optimisation (FPS improvements) | **LOCKED** |
| 6 | Chest scale + 100ms reveal fix | Complete |
| 13 | Chest 1.9x scale, explosion billboard, scroll reveal | Complete |

---

## Sensitive Files — What Is Excluded

| File | Why Excluded |
|---|---|
| .env.local | Contains live Vercel OIDC authentication token — never commit this file |

Use `.env.example` as a template. The `.vercel/project.json` (project + org IDs) is safe to share.

---

## Known Missing Sources

The following files **do not exist on disk** and could not be included:

| Missing | Impact |
|---|---|
| Blender source for Grass_Spawn.glb | Cannot re-author grass animation from scratch without it |
| Blender source for Obsidian_Portal_Construction.glb | Cannot re-author portal animation from scratch |
| Blender source for Portal_Surface.glb | Cannot re-author portal surface shader |
| Blender source for chest.glb | Cannot re-author Ender Chest model from scratch |
| Blender source for outergazers_text_fbx_style.glb | Cannot change text geometry without re-modelling |
| Poster source vector/PSD | Raster PNG is available; vector design file not found |

All GLBs can be imported into Blender for limited editing.

---

## Team

**Team Outergazers**
Developed for Outergazer.in Intra-College GameJam 2026

*Source package assembled: 27 October 2026*
