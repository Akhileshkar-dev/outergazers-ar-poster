# Team Outergazers — WebAR Experience 🎮

> **FINAL PRODUCTION RELEASE** — Outergazers GameJam 2026

An immersive, Minecraft-themed WebAR experience built with **A-Frame 1.5.0** and **MindAR 1.2.5**.

Point your mobile phone camera at the physical or digital **GameJam 2026 Poster** (`poster.jpg`) and watch a full cinematic 3D sequence unfold in augmented reality:
1. **Grass Base Spawns** block-by-block with authentic Minecraft placement SFX.
2. **Obsidian Nether Portal** assembles cube-by-cube with glowing purple portal energy.
3. **Ender Chest** glides out of the Nether portal, bounces with physics onto the grass, and awaits interaction.
4. **Cinematic 3D Minecraft Font**: "OUTERGAZERS" (scaled 1.8X) and "GAMEJAM 2026" (in fiery orange) hover dynamically above the portal.
5. **Interactive Chest Tap**: Tapping the chest triggers an authentic 61-frame Creeper explosion with smoke particles and audio.
6. **1.5X Foreground Event Parchment**: The royal event scroll unfurls in the foreground displaying the jam themes, dates (**Oct 29 – Nov 29**), and an interactive **REGISTER NOW** button.
7. **Replay Controller**: Reset and replay the experience at any time using the HUD replay button.

---

## 🌐 Live Production URLs

* **Primary WebAR**: [https://ar-task3.vercel.app](https://ar-task3.vercel.app)
* **Direct Production URL**: [https://outergazers-ar-poster.vercel.app](https://outergazers-ar-poster.vercel.app)
* **Prototype Mirror**: [https://outergazers-webar-task3.vercel.app](https://outergazers-webar-task3.vercel.app)

> *HTTPS is mandatory for mobile browser camera permissions (WebRTC / WebXR).*

---

## 🎯 Image Target (Scanner Marker)

To view the AR experience:
1. Open the [Live WebAR URL](https://ar-task3.vercel.app) on your mobile phone (Chrome on Android or Safari on iOS).
2. Point your camera at [`poster.jpg`](./poster.jpg) (either printed on paper or displayed on your laptop/desktop screen).

---

## 🗂 Project Structure

```
outergazers-ar-poster/
├── index.html                          # Main WebAR entry point (A-Frame scene + Camera Optimizer)
├── outergazers-timeline.js             # Master cinematic timeline & interaction controller
├── poster.mind                         # Compiled MindAR image tracking target
├── poster.jpg                          # Original image target poster (printable/scannable)
├── build_perfect_text_glb.py           # Generator tool for 3D Minecraft text font GLB
├── vercel.json                         # Vercel deployment configuration (CORS, cache headers)
├── serve.js                            # Local zero-dependency dev server
├── README.md                           # Documentation and reuse guide
├── .gitignore                          # Clean repository ignore configuration
│
└── assets/
    ├── Grass_Spawn.glb                 # 10x10 grass island 3D model with cube textures
    ├── Obsidian_Portal_Construction.glb # Obsidian Nether Portal 3D model with stone textures
    ├── Portal_Surface.glb              # Animated purple Nether portal energy surface
    ├── chest.glb                       # Ender Chest 3D model (with animated lid)
    ├── outergazers_text_fbx_style.glb  # 3D Minecraft text ("OUTERGAZERS" 1.8X + orange "GAMEJAM")
    │
    ├── images/
    │   ├── scroll_blank_base.png       # Opaque parchment scroll background texture
    │   └── A Call to Adventure_ GameJam 2026.png # Transparent event artwork overlay
    │
    ├── audio/
    │   ├── Grass Sound Effect .mp3.mpeg
    │   ├── Portal Sound Effect .mp3.mpeg
    │   ├── Ender Chest Sound Effect .mp3.mpeg
    │   ├── Explosion .mp3.mpeg
    │   ├── obsidian block.mp3.mpeg
    │   └── extra/                      # Cinematic SFX suite
    │       ├── obsidian_place.wav
    │       ├── letter_swoosh.wav
    │       ├── letter_whoosh.wav
    │       ├── letter_settle.wav
    │       ├── title_shimmer.wav
    │       ├── chest_land_thud.wav
    │       ├── parchment_unfurl.wav
    │       └── parchment_settle.wav
    │
    └── explosion/
        ├── explosion_spritesheet.png   # 61-frame high-resolution Creeper explosion
        └── explosion_metadata.json     # Spritesheet coordinates and frame timings
```

---

## 🚀 Quick Start / Local Development

### 1. Clone the repository
```bash
git clone https://github.com/Akhileshkar-dev/outergazers-ar-poster.git
cd outergazers-ar-poster
```

### 2. Start a local HTTP server
Using Node.js:
```bash
node serve.js
```
*Or using Python 3:*
```bash
python -m http.server 8089
```

### 3. Open in Browser
Open `http://127.0.0.1:8089` on desktop or test over LAN with an HTTPS tunnel (e.g. `ngrok http 8089` or `cloudflared`).

---

## ⚡ Key Technical Innovations & Optimizations

### 1. Butter-Smooth Tracking (OneEuroFilter)
MindAR's raw default parameters can cause high-frequency camera shake on mobile sensors. We tuned the tracking filter in `index.html`:
```html
mindar-image="imageTargetSrc: ./poster.mind; filterMinCF: 0.0001; filterBeta: 0.01; missTolerance: 25; warmupTolerance: 5;"
```
* **`filterMinCF: 0.0001`**: 10x stronger low-pass smoothing when stationary. Completely locks models in place.
* **`filterBeta: 0.01`**: 100,000x lower noise multiplication. Prevents microscopic hand tremors from shaking the 3D scene.
* **`missTolerance: 25`**: Holds tracking across brief camera blurs (~0.8s) without snapping or jittering.

### 2. Universal Camera FOV & Zoom Optimizer
Solves the issue where some multi-camera Android devices (e.g., Samsung, OnePlus, Xiaomi) open the web camera in a cropped 2X zoom mode:
* Injects a lightweight `navigator.mediaDevices.getUserMedia` interceptor.
* Requests `{ width: { ideal: 1920 }, height: { ideal: 1080 } }` to force **full-sensor binning** instead of a 2X center cutout.
* Queries `track.getCapabilities().zoom` and resets the optical lens back to **`1.0X` wide angle**.

### 3. Progressive Scroll Unfurling Shader
The event scroll utilizes a custom two-pass GLSL discard shader:
* **Base Parchment Layer**: Unrolls smoothly from a rolled scroll at the chest mouth to a 1.5X reading scale in the foreground.
* **Artwork Print Layer**: Progressively prints the event details as the paper unfurls.
* **Interactive HTML/CSS Overlay**: Automatically projects 3D matrix bounds to screen space so users can tap "REGISTER NOW" directly on any screen size.

---

## 🛠 Reusing & Customizing This Project

1. **Changing the Target Image**:
   * Replace `poster.jpg` with your own poster.
   * Compile a new `.mind` file using the [MindAR Web Compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile) or the offline compiler tool.
   * Save as `poster.mind`.

2. **Customizing 3D Text**:
   * Modify or re-run `python build_perfect_text_glb.py` to regenerate `assets/outergazers_text_fbx_style.glb` with custom text, scale, or colors.

3. **Adjusting Scroll Scale & Content**:
   * In `outergazers-timeline.js`, adjust `EVENT_PAPER_CONFIG.restScale` (default: `Vector3(1.5, 1.5, 1.5)`).
   * Update `EVENT_PAPER_CONFIG.registrationUrl` to point to your event registration link.

---

## 👥 Credits & Registration
* **Event**: Intra-College GameJam 2026
* **Website**: [outergazer.in](https://outergazer.in)
* **Registration**: [https://outergazer.in/events/intracollege-gamejam-2026](https://outergazer.in/events/intracollege-gamejam-2026)
