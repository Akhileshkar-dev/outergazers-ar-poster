# Team Outergazers — WebAR Experience

> **FINAL LOCKED BUILD** — Task 4 Tracking Configuration + Task 5 Optimisation 1 (26 Oct 2026)

A Minecraft-themed, image-target WebAR experience built with **A-Frame 1.5.0** and **MindAR 1.2.5**.
Point a phone camera at the printed GameJam 2026 poster and watch a full cinematic scene unfold in
augmented reality — grass spawns, an obsidian portal constructs block-by-block, an Ender Chest flies
through the portal, a creeper explosion fills the screen, and a parchment scroll unfurls revealing the
GameJam event details with a live registration button.

---

## 🌐 Production URL

**Live experience (mobile-optimised, HTTPS):**
```
https://outergazers-webar-task3.vercel.app
```

Scan this URL with your phone camera or share it with participants.  
HTTPS is required for WebXR camera access.

---

## 📋 Registration URL

```
https://outergazer.in/events/intracollege-gamejam-2026
```

This link is also embedded in the interactive registration button that appears on the AR scroll
after the full experience plays.

---

## 🗂 Project Structure

```
webar-prototype-outergazers/
├── index.html                          # Main AR experience entry point
├── outergazers-timeline.js             # Master timeline & sequence controller
├── poster.mind                         # Compiled MindAR image target (Task 4 final)
├── vercel.json                         # Vercel deployment config (CORS, MIME types)
├── serve.js                            # Local dev server (Node.js, no dependencies)
├── README.md                           # This file
├── .vercelignore                       # Vercel deployment exclusions
├── .gitignore                          # Git exclusions
│
├── assets/
│   ├── Grass_Spawn.glb                 # Grass platform 3D model + animations
│   ├── Obsidian_Portal_Construction.glb # Obsidian portal 3D model + animations
│   ├── Portal_Surface.glb              # Portal energy surface 3D model
│   ├── chest.glb                       # Ender Chest 3D model (lid animation)
│   ├── outergazers_text_fbx_style.glb  # OUTERGAZERS 3D silver text model
│   │
│   ├── images/
│   │   ├── scroll_blank_base.png       # Scroll parchment base texture
│   │   ├── A Call to Adventure_ GameJam 2026.png  # Event scroll artwork
│   │   ├── SCROLL FOR AR POSTER.png    # Scroll poster variant
│   │   └── scroll_poster.png           # Final poster image
│   │
│   ├── audio/
│   │   ├── Grass Sound Effect .mp3.mpeg
│   │   ├── Portal Sound Effect .mp3.mpeg
│   │   ├── Ender Chest Sound Effect .mp3.mpeg
│   │   ├── Explosion .mp3.mpeg
│   │   ├── obsidian block.mp3.mpeg     # Fallback obsidian sound
│   │   └── extra/                      # Cinematic sound design upgrade
│   │       ├── obsidian_place.wav
│   │       ├── letter_swoosh.wav
│   │       ├── letter_whoosh.wav
│   │       ├── letter_settle.wav
│   │       ├── title_shimmer.wav
│   │       ├── chest_land_thud.wav
│   │       ├── parchment_unfurl.wav
│   │       └── parchment_settle.wav
│   │
│   └── explosion/
│       ├── explosion_spritesheet.png   # 61-frame Minecraft creeper explosion
│       └── explosion_metadata.json     # Spritesheet layout config
│
└── Sounds/                             # Fallback audio directory (legacy path)
    ├── Grass Sound Effect .mp3.mpeg
    ├── Portal Sound Effect .mp3.mpeg
    ├── Ender Chest Sound Effect .mp3.mpeg
    ├── Explosion .mp3.mpeg
    └── obsidian block.mp3.mpeg
```

---

## 🚀 Running Locally

### Prerequisites

- **Node.js** (v16 or newer)
- A modern browser (Chrome or Safari recommended)
- HTTPS is required for camera access. The local server binds to `127.0.0.1` which works for
  desktop testing. For **mobile testing over a LAN**, use a tunnel tool such as `ngrok`.

### Quick Start

1. Open a terminal in the project root.
2. Start the local dev server:

```bash
node serve.js
```

3. Navigate to:

```
http://127.0.0.1:8089
```

4. Allow camera access when prompted.
5. Point the camera at the printed **GameJam 2026** poster (or display it on a second screen).

> **Mobile tip:** Run `ngrok http 8089` to get a public HTTPS tunnel URL for on-device testing.

---

## 📱 How to Use the AR Experience

1. **Open the URL** on a mobile device (Android Chrome or iOS Safari).
2. **Allow camera access** when prompted.
3. **Point the camera at the poster** — keep it centered in the scanning frame.
4. **Watch the cinematic sequence:**
   - Grass platform spawns block-by-block (~3.7s)
   - Obsidian blocks construct the Nether Portal (~8.0s)
   - Portal energy surface activates (~9.0s)
   - Ender Chest emerges, flies through the portal, and lands (~12.0s)
5. **Tap the Ender Chest** to trigger the interaction.
6. A **creeper explosion** fills the screen.
7. The **event scroll** unfurls — read the GameJam details.
8. Tap **Register Now** to open the registration page.
9. Use the **↺ Replay** button (top-right) to restart at any time.

---

## 🔒 Task Status

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Basic AR anchor + A-Frame scene setup | ✅ Complete |
| Task 2 | 3D models + animation timeline | ✅ Complete |
| Task 3 | Initial MindAR poster target compilation | ✅ Complete |
| **Task 4** | **Final tracking config (filterMinCF: 0.001, filterBeta: 1000, missTolerance: 15, warmupTolerance: 5)** | ✅ **LOCKED** |
| **Task 5 Opt 1** | **Performance optimisation — 36.4ms peak spike reduction, Chest Phase +6.2 FPS, Scroll Phase +5.9 FPS** | ✅ **LOCKED** |
| Task 6 | Chest scale + 100ms reveal fix | ✅ Complete |
| Task 13 | Chest 1.9× scale, creeper explosion billboard, scroll reveal | ✅ Complete |

---

## 🛠 Deployment (Vercel)

The project is already live. To redeploy from this archive:

1. Install Vercel CLI: `npm i -g vercel`
2. From the project root: `vercel --prod`

The `.vercel/project.json` file links this directory to the existing Vercel project
(`outergazers-webar-task3`). Your Vercel account credentials are required.

> **Do not modify** `poster.mind`, `index.html`, or `outergazers-timeline.js` without first
> creating a backup. The Task 4 tracking configuration and Task 5 Optimisation 1 are locked
> and approved.

---

## 📐 Technical Details

| Setting | Value |
|---------|-------|
| AR Framework | MindAR 1.2.5 + A-Frame 1.5.0 |
| Image Target | `poster.mind` (single target, index 0) |
| Tracking Filter | `filterMinCF: 0.001`, `filterBeta: 1000` |
| Miss Tolerance | 15 frames |
| Warmup Tolerance | 5 frames |
| Root Scale | `0.183 0.183 0.183` |
| Root Position | `0 -0.488 0` |
| Chest Visual Scale | `1.0` |
| Scroll Artwork | `1145 × 1374 px` (aspect ratio 0.8333) |
| Explosion Frames | 61 frames via spritesheet |

---

## 👥 Team

**Team Outergazers**  
Developed for the Outergazer.in Intra-College GameJam 2026

---

*Packaged: 27 October 2026*
