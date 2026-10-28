/**
 * Team Outergazers - WebAR Master Timeline & Sequence Controller (Task 6: Chest Scale & 100ms Reveal)
 * 
 * SEQUENCE FLOW:
 * 1. Approved AR Animation:
 *    - Phase 1: Grass Platform Spawns (0.000s - 3.708s)
 *    - Phase 2: Obsidian Portal Constructs ONE BY ONE (4.167s - 8.042s)
 *    - Pause: Final Obsidian Block reaches destination, frame complete (8.042s - 8.667s)
 *    - Phase 3: Portal Surface Activates (8.667s - 9.042s)
 *    - Short Pause: Portal visibly swirling and active for ~1.46s (9.042s - 10.500s)
 *    - Phase 4: Ender Chest Emerges from portal (10.333s), Launches (10.500s), Lands (11.500s), Bounces & Settles (11.833s).
 * 2. COMPLETED -> READY_FOR_TAP (at 12.000s / Frame 288):
 *    - Immediately enables chest interaction once settled!
 *    - UI hint shows "Tap the Chest to Open! (👆)".
 * 3. User taps chest:
 *    - Responsive hit detection (Hitbox + Raycast + Screen-space proximity).
 * 4. OPENING_CHEST (0.45s):
 *    - Authentic lid opening from 0.042s to 1.250s.
 * 4. ENDER CHEST SIZE & ANIMATION (TASK 13 ISSUE 1):
 *    - Increased visible chest size by 1.9x (proportional to portal and grass platform).
 *    - Applied safely at dedicated model root level (this.models.chest.scale).
 *    - Flight trajectory, landing position, settling bounce, and lid animation 100% preserved.
 *    - Hitbox (5.8x5.8x5.8) and tap threshold (150px) scaled to match.
 * 5. POSTER-FILLING CREEPER EXPLOSION (TASK 13 ISSUE 2):
 *    - Active content cropped to 1280x720 (16:9) and billboard width 11.0 units in root space.
 *    - Fills ~95.6% of poster width (11.0 * 0.925 * 0.094 = 0.956).
 *    - Irregular Minecraft voxel silhouette with stepped 8x8 blocks, transparent borders (max alpha = 0).
 *    - All competing scene elements hidden during explosion.
 * 6. IMMEDIATE EVENT PARCHMENT REVEAL (TASK 13 ISSUE 3):
 *    - Zero-delay immediate transition upon explosion completion (explosion hidden instantly).
 *    - Starts from visibly large initial scale (0.65) so it is legible from frame 0.
 *    - Smooth 0.42s expansion to 1.0 (within required 0.35-0.50s range).
 * 7. INTERACTION_COMPLETE:
 *    - Parchment stays stable, centered over poster, prominent, and readable.
 */

// =============================================================================
// EVENT PAPER CONFIGURATION (Keep separate from animation logic for easy editing)
// =============================================================================
// TASK 6 (FIX 1): Restored previous approved chest scale (1.0) matching reference screenshot
const CHEST_VISUAL_SCALE = 1.0;
// Baseline vertical alignment (natural model origin sits directly on grass surface)
const CHEST_BOTTOM_ALIGN_Y = 0.0;

// =============================================================================
// OPTION A: APPROVED ARTWORK & SCROLL GEOMETRY CONFIGURATION
// Native artwork: SCROLL FOR AR POSTER.png (1145 x 1374, Aspect Ratio: 0.8333)
// =============================================================================
const EVENT_PAPER_CONFIG = {
  baseImageUrl: './assets/images/scroll_blank_base.png?v=20261026_scroll_perfect',
  printImageUrl: './assets/images/A Call to Adventure_ GameJam 2026.png?v=20261026_scroll_perfect',
  imageUrl: './assets/images/A Call to Adventure_ GameJam 2026.png?v=20261026_scroll_perfect',
  fallbackImageUrl: './assets/images/A Call to Adventure_ GameJam 2026.png?v=20261026_scroll_perfect',
  registrationUrl: 'https://outergazer.in/events/intracollege-gamejam-2026',
  aspectRatio: 1145 / 1374, // 0.8333333333333334
  // Substantially enlarged foreground dimensions (1.71875x scale): dominating mobile AR view
  // Width: 13.750 (spans X: [-6.875, +6.875], generously covers title width [-3.0, +3.0] and portal [-2.4, +2.4])
  // Height: 16.500 (spans Y: [-4.05, +12.45], generously covers chest [0.5, 3.8] and title [5.2, 6.7] with margins on every side)
  paperHeight: 16.50,
  paperWidth: 16.50 * (1145 / 1374), // 13.750 units (exact native aspect ratio, zero stretching)
  // Emergence origin at chest opening:
  // Starts visibly distinguishable at chest mouth (scale 0.48, z 3.50)
  emergeStartPos: new THREE.Vector3(0, 3.10, 3.50),
  emergeStartScale: new THREE.Vector3(0.48, 0.48, 0.48),
  // Resting elevation in prominent foreground (Z = 5.20, Y = 4.20), covering both Ender Chest and title completely
  restPos: new THREE.Vector3(0, 4.20, 5.20),
  restScale: new THREE.Vector3(1.0, 1.0, 1.0),
  // Button bounding box relative to artwork (x: [0.2358, 0.7817], y: [0.6281, 0.7100] from top)
  buttonFrame: {
    xMinRel: 0.2358,
    xMaxRel: 0.7817,
    yTopRel: 0.6281,
    yBottomRel: 0.7100
  }
};

// =============================================================================
// MASTER SEQUENCE & INTERACTION STATES
// =============================================================================
const SEQUENCE_STATE = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED'
};

const INTERACTION_STATE = {
  READY_FOR_TAP: 'READY_FOR_TAP',
  OPENING_CHEST: 'OPENING_CHEST',
  PLAYING_EXPLOSION: 'PLAYING_EXPLOSION',
  EMERGING_SCROLL: 'EMERGING_SCROLL',
  UNFURLING_SCROLL: 'UNFURLING_SCROLL',
  READING_SCROLL: 'READING_SCROLL',
  PLAYING_TEXT_REVEAL: 'PLAYING_TEXT_REVEAL',
  INTERACTION_COMPLETE: 'INTERACTION_COMPLETE'
};

// =============================================================================
// CUSTOM PROCEDURAL PORTAL SHADER
// =============================================================================
const PortalShaderDef = {
  uniforms: {
    uTime: { value: 0 },
    uEmissionStrength: { value: 1.5 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uEmissionStrength;
    varying vec2 vUv;

    vec2 hash22(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float noise(vec2 p) {
      const float K1 = 0.366025404;
      const float K2 = 0.211324865;
      vec2 i = floor(p + (p.x + p.y) * K1);
      vec2 a = p - i + (i.x + i.y) * K2;
      float m = step(a.y, a.x);
      vec2 o = vec2(m, 1.0 - m);
      vec2 b = a - o + K2;
      vec2 c = a - 1.0 + 2.0 * K2;
      vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
      vec3 n = h * h * h * h * vec3(dot(a, hash22(i + 0.0)), dot(b, hash22(i + o)), dot(c, hash22(i + 1.0)));
      return dot(n, vec3(70.0)) * 0.5 + 0.5;
    }

    void main() {
      vec2 uv = vUv;
      vec2 grid = vec2(32.0, 48.0);
      vec2 div_res = floor(uv * grid) / grid;
      vec2 mult_blocks = div_res * vec2(2.0, 3.0);
      vec2 center_uv = fract(mult_blocks) - vec2(0.5);
      float length_node = length(center_uv);
      float time_val = uTime * 0.5;
      vec2 noise_uv = div_res + vec2(time_val * 0.5);
      float n = noise(noise_uv * 5.0);
      float dist_mult = length_node * 15.0;
      float noise_mult = n * 8.0;
      float sub_time = (dist_mult + noise_mult) - (time_val * 4.0);
      float fac = (sin(sub_time) + 1.0) * 0.5;

      vec3 c0 = vec3(34.0/255.0, 3.0/255.0, 60.0/255.0);
      vec3 c1 = vec3(53.0/255.0, 12.0/255.0, 89.0/255.0);
      vec3 c2 = vec3(73.0/255.0, 20.0/255.0, 117.0/255.0);
      vec3 c3 = vec3(98.0/255.0, 27.0/255.0, 155.0/255.0);

      vec3 col = c0;
      if (fac > 0.75) {
        col = mix(c2, c3, (fac - 0.75) * 4.0);
      } else if (fac > 0.5) {
        col = mix(c1, c2, (fac - 0.5) * 4.0);
      } else if (fac > 0.25) {
        col = mix(c0, c1, (fac - 0.25) * 4.0);
      }

      gl_FragColor = vec4(col * uEmissionStrength, 0.95);
    }
  `
};

// =============================================================================
// REVISED APPROVED MASTER TIMELINE (24 FPS, Consistent Absolute Timeline System)
// =============================================================================
const TIMELINE = {
  FPS: 24,

  // Phase 1: Grass Platform Spawning (0.000s - 3.708s)
  GRASS_SPAWN_START: 0.0,
  GRASS_SPAWN_FINISH: 3.708,

  // Phase 2: Obsidian Portal Construction (4.167s - 8.042s)
  // All 14 blocks assemble sequentially one-by-one: 11 -> 13 -> 14 -> 12 -> 09,10 -> 07,08 -> 05,06 -> 01 -> 02 -> 03 -> 04!
  OBSIDIAN_START: 4.167,    // Frame 100: Assembly begins
  OBSIDIAN_FINISH: 8.042,   // Frame 193: Final block Obsidian_04 docks into frame

  // Short Pause: Portal frame complete (8.042s - 8.667s)

  // Phase 3: Portal Surface Activation (8.667s - 9.042s)
  PORTAL_ACTIVATE_START: 8.667, // Frame 208: Energy emergence begins
  PORTAL_ACTIVATE_FINISH: 9.042, // Frame 217: Energy fully expanded

  // Short Pause: Portal visibly active and swirling (~1.46s pause before chest emerges)
  // Active energy swirl displays from 9.042s to 10.500s!

  // Phase 4: Ender Chest Emergence, Launch & Settle
  CHEST_REVEAL: 10.333,     // Frame 248: Visible at portal center
  CHEST_LAUNCH: 10.500,     // Frame 252: Begins parabolic arc flight
  CHEST_IMPACT: 11.500,     // Frame 276: Lands on grass platform
  CHEST_SETTLE: 11.833,     // Frame 284: Squashes, stretches, settles into final pose

  // Master Timeline Completion
  TOTAL_DURATION: 288 / 24  // 12.000s (Frame 288): Immediately after settle, enables tap prompt
};

// =============================================================================
// WEBAR SOUND EFFECTS CONFIGURATION & ACCURATE SPAWN EVENT DEFINITIONS
// =============================================================================
const AUDIO_CONFIG = {
  grass: {
    url: './assets/audio/Grass Sound Effect .mp3.mpeg',
    fallbackUrl: null,
    duration: 1.728, // Natural trimmed duration (~1.73s)
    baseGain: 0.45
  },
  obsidian: {
    url: './assets/audio/extra/obsidian_place.wav',
    fallbackUrl: './assets/audio/obsidian block.mp3.mpeg',
    duration: 0.320, // Punchy trimmed Minecraft stone placement impact (0.32s)
    baseGain: 0.65
  },
  portal: {
    url: './assets/audio/Portal Sound Effect .mp3.mpeg',
    fallbackUrl: null,
    duration: 4.344, // Natural trimmed duration (~4.34s)
    baseGain: 0.70
  },
  chest: {
    url: './assets/audio/Ender Chest Sound Effect .mp3.mpeg',
    fallbackUrl: null,
    duration: 1.968, // Natural trimmed duration (~1.97s)
    baseGain: 0.80
  },
  explosion: {
    url: './assets/audio/Explosion .mp3.mpeg',
    fallbackUrl: null,
    duration: 2.016, // Natural trimmed duration (~2.02s)
    baseGain: 0.85
  },
  // Cinematic Sound Design Upgrade (Stored in ./assets/audio/extra/)
  letterWhoosh: {
    url: './assets/audio/extra/letter_swoosh.wav',
    fallbackUrl: './assets/audio/extra/letter_whoosh.wav',
    duration: 0.170, // Quick, airy, energetic swoosh (0.17s)
    baseGain: 0.40
  },
  letterSettle: {
    url: './assets/audio/extra/letter_settle.wav',
    duration: 0.090,
    baseGain: 0.28
  },
  titleShimmer: {
    url: './assets/audio/extra/title_shimmer.wav',
    duration: 0.850,
    baseGain: 0.50
  },
  chestLand: {
    url: './assets/audio/extra/chest_land_thud.wav',
    duration: 0.350,
    baseGain: 0.75
  },
  parchmentUnfurl: {
    url: './assets/audio/extra/parchment_unfurl.wav',
    duration: 0.420,
    baseGain: 0.65
  },
  parchmentSettle: {
    url: './assets/audio/extra/parchment_settle.wav',
    duration: 0.220,
    baseGain: 0.30
  }
};

// 40 Individual Grass Blocks and their authored spawn timestamps from Grass_Spawn_Animation
const GRASS_BLOCK_SPAWNS = [
  { id: 'GrassBlock_18', time: 0.500 },
  { id: 'GrassBlock_23', time: 0.500 },
  { id: 'GrassBlock_17', time: 0.958 },
  { id: 'GrassBlock_19', time: 0.958 },
  { id: 'GrassBlock_22', time: 0.958 },
  { id: 'GrassBlock_24', time: 0.958 },
  { id: 'GrassBlock_13', time: 1.250 },
  { id: 'GrassBlock_28', time: 1.250 },
  { id: 'GrassBlock_12', time: 1.500 },
  { id: 'GrassBlock_14', time: 1.500 },
  { id: 'GrassBlock_27', time: 1.500 },
  { id: 'GrassBlock_29', time: 1.500 },
  { id: 'GrassBlock_16', time: 1.667 },
  { id: 'GrassBlock_20', time: 1.667 },
  { id: 'GrassBlock_21', time: 1.667 },
  { id: 'GrassBlock_25', time: 1.667 },
  { id: 'GrassBlock_08', time: 2.000 },
  { id: 'GrassBlock_11', time: 2.000 },
  { id: 'GrassBlock_15', time: 2.000 },
  { id: 'GrassBlock_26', time: 2.000 },
  { id: 'GrassBlock_30', time: 2.000 },
  { id: 'GrassBlock_33', time: 2.000 },
  { id: 'GrassBlock_07', time: 2.167 },
  { id: 'GrassBlock_09', time: 2.167 },
  { id: 'GrassBlock_32', time: 2.167 },
  { id: 'GrassBlock_34', time: 2.167 },
  { id: 'GrassBlock_06', time: 2.542 },
  { id: 'GrassBlock_10', time: 2.542 },
  { id: 'GrassBlock_31', time: 2.542 },
  { id: 'GrassBlock_35', time: 2.542 },
  { id: 'GrassBlock_03', time: 2.750 },
  { id: 'GrassBlock_38', time: 2.750 },
  { id: 'GrassBlock_02', time: 2.875 },
  { id: 'GrassBlock_04', time: 2.875 },
  { id: 'GrassBlock_37', time: 2.875 },
  { id: 'GrassBlock_39', time: 2.875 },
  { id: 'GrassBlock_01', time: 3.167 },
  { id: 'GrassBlock_05', time: 3.167 },
  { id: 'GrassBlock_36', time: 3.167 },
  { id: 'GrassBlock_40', time: 3.167 }
];

// 14 Individual Obsidian Blocks and their authored sequential docking timestamps
const OBSIDIAN_BLOCK_SPAWNS = [
  { id: 'Obsidian_11', time: 4.167 },
  { id: 'Obsidian_13', time: 4.542 },
  { id: 'Obsidian_14', time: 4.917 },
  { id: 'Obsidian_12', time: 5.292 },
  { id: 'Obsidian_09', time: 5.667 },
  { id: 'Obsidian_10', time: 5.667 },
  { id: 'Obsidian_07', time: 6.042 },
  { id: 'Obsidian_08', time: 6.042 },
  { id: 'Obsidian_05', time: 6.417 },
  { id: 'Obsidian_06', time: 6.417 },
  { id: 'Obsidian_01', time: 6.792 },
  { id: 'Obsidian_02', time: 7.167 },
  { id: 'Obsidian_03', time: 7.542 },
  { id: 'Obsidian_04', time: 7.917 }
];

// =============================================================================
// AFRAME COMPONENT: outergazers-sequence
// =============================================================================
AFRAME.registerComponent('outergazers-sequence', {
  schema: {
    fps: { type: 'number', default: 24 },
    totalFrames: { type: 'number', default: 288 } // 12.000s
  },

  init: function () {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[Outergazers] Initializing master sequence controller (TASK 12 FINAL)...');
    this.masterFPS = this.data.fps;
    this.totalDuration = this.data.totalFrames / this.masterFPS;

    // State machines
    this.sequenceState = SEQUENCE_STATE.READY;
    this.interactionState = INTERACTION_STATE.READY_FOR_TAP;

    this.isTimelineActive = false;
    this.masterTime = 0.0;
    this.isTargetTracked = false;
    this.isSequenceCompleted = false;
    this.hasTitleBeenRevealed = false; // Task 8: Dedicated title reveal state flag

    // Sound Effects State
    this.playedGrassSounds = new Set();
    this.playedObsidianSounds = new Set();
    this.hasPortalSoundPlayed = false;
    this.hasExplosionSoundPlayed = false;
    this.hasChestSoundPlayed = false;
    this.hasChestLandSoundPlayed = false;
    this.playedLetterWhooshSounds = new Set();
    this.playedLetterSettleSounds = new Set();
    this.hasTitleShimmerSoundPlayed = false;
    this.hasParchmentUnfurlSoundPlayed = false;
    this.hasParchmentSettleSoundPlayed = false;
    this.setupAudio();
    
    // Performance: Cache DOM references and reusable vectors to eliminate per-frame allocations
    this.trackingHintEl = document.querySelector('#tracking-hint');
    this.sceneEl = document.querySelector('a-scene');
    this.regBtn = document.querySelector('#register-btn');
    this._chestBasePos = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._localCamPos = new THREE.Vector3();
    this._pTL = new THREE.Vector3();
    this._pBR = new THREE.Vector3();
    this._lastRegBtnBounds = null;
    this._regBtnVisible = false;
    this._lastHintText = '';
    this._lastHintBg = '';

    // Mobile GPU optimization: clamp WebGL pixel ratio to 2.0 max to prevent massive fillrate lag
    if (this.sceneEl) {
      const applyDpr = () => {
        if (this.sceneEl.renderer) {
          const maxDpr = Math.min(window.devicePixelRatio || 1, 2.0);
          this.sceneEl.renderer.setPixelRatio(maxDpr);
          console.log('[Outergazers] Mobile GPU optimization: WebGL pixel ratio clamped to', maxDpr);
        }
      };
      if (this.sceneEl.renderer) applyDpr();
      else this.sceneEl.addEventListener('render-target-loaded', applyDpr);
    }

    // Visibility change handling for mobile tab switching and screen locking
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.masterGain && this.audioCtx) {
          this.masterGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
        }
      } else {
        if (this.isTargetTracked && this.masterGain && this.audioCtx) {
          this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
      }
    });
    this.modelsLoadedCount = 0;
    this.isReady = false;
    this.pendingStartOnReady = false;
    this.loggedPhase = 0;

    // Optimisation 1: Settled-state flags to avoid re-evaluating completed mixers
    this._grassSettled = false;
    this._obsidianSettled = false;
    this._portalSettled = false;

    // Timers & Durations
    this.chestOpenTimer = 0.0;
    this.chestOpenDuration = 0.45; // Quick, responsive lid opening (0.45s)

    // Creeper explosion duration (all 61 frames across 1.50s)
    this.explosionTimer = 0.0;
    this.explosionDuration = 1.50;

    // TASK 6 (FIX 2): Exactly 100 milliseconds (0.1s) post-explosion reveal delay
    this.postExplosionTimer = 0.0;
    this.postExplosionDelay = 0.000; // 0 ms - immediate scroll reveal on explosion completion
    this.explosionFinishedTimestamp = 0;
    this.hasTriggeredReveal = false;

    this.scrollEmergeTimer = 0.0;
    this.scrollEmergeDuration = 1.25; // Continuous smooth journey from chest to foreground (1.25s)
    this.eventPaperTimer = 0.0;
    this.eventPaperDuration = 1.60; // Smooth progressive parchment unroll animation (1.60s)
    this.lowerRollerMesh = null;
    this.rollerStartY = 5.008; // Snug beneath top roller for height = 16.50
    this.rollerEndY = -7.169; // Bottom edge for height = 16.50

    // Model references & Animation Mixers
    this.models = {
      grass: null,
      obsidian: null,
      portalSurface: null,
      chest: null,
      chestEl: null,
      text: null,
      textEl: null,
      textContainer: null
    };

    this.mixers = {
      grass: null,
      obsidian: null,
      portalSurface: null,
      chest: null,
      text: null
    };

    // OUTERGAZERS Cinematic 3D Text Reveal Animation State (Task 12 Physics & Cyan)
    this.textAction = null;
    this.textRevealTimer = 0.0;
    this.textRevealDuration = 3.600; // Snappy, energetic emergence of OUTERGAZERS & GAMEJAM 2026 title
    this.isTextRevealPlaying = false;
    this.hasTextRevealCompleted = false;
    this.textHeroMaterial = null;
    this.textHaloMaterial = null;
    this.silverEnvMap = null;
    this.textLetterNodes = [];

    // Chest Parabolic Trajectory State (Launched at 10.50s, Lands at 11.50s, Settles at 11.83s)
    this.chestState = {
      startPos: new THREE.Vector3(0, 6.0037, -0.65),
      endPos: new THREE.Vector3(0, 3.00, 3.07),
      settlePos: new THREE.Vector3(0, 3.00, 3.12),
      arcHeight: 1.8,
      idleAmplitude: 5 * (Math.PI / 180),
      idleFrequency: 1.5,
      idlePeriod: 2.5,
      idleBurstDuration: 1.2,
      shakesPerBurst: 3,
      baseScale: new THREE.Vector3(1, 1, 1),
      squashScale: new THREE.Vector3(1.15, 0.85, 1.15),
      isLaunched: false,
      isIdleJiggling: false,
      hasBeenTapped: false,
      idleTimer: 0
    };

    window.outergazersTimeline = this;

    // Bind event handlers
    this.onTargetFound = this.onTargetFound.bind(this);
    this.onTargetLost = this.onTargetLost.bind(this);
    this.handleChestTap = this.handleChestTap.bind(this);
    this.handleScrollButtonTap = this.handleScrollButtonTap.bind(this);
    this.updateRegisterButtonOverlay = this.updateRegisterButtonOverlay.bind(this);

    // MindAR target listener on ar-target entity
    const targetEntity = this.el;
    targetEntity.addEventListener('targetFound', this.onTargetFound);
    targetEntity.addEventListener('targetLost', this.onTargetLost);

    // Setup 3D models and interaction helpers
    this.setupModels();

    // Attach tap/click listeners
    this.setupTapListeners();
  },

  setupAudio: function () {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[Outergazers Audio] Web Audio API not supported on this browser.');
      return;
    }
    this.audioCtx = new AudioContextClass();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
    this.masterGain.connect(this.audioCtx.destination);

    this.audioBuffers = {
      grass: null,
      obsidian: null,
      portal: null,
      chest: null,
      explosion: null,
      letterWhoosh: null,
      letterSettle: null,
      titleShimmer: null,
      chestLand: null,
      parchmentUnfurl: null,
      parchmentSettle: null
    };
    this.activeAudioNodes = [];

    const loadBuffer = (key, url, fallbackUrl) => {
      fetch(encodeURI(url))
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.arrayBuffer();
        })
        .catch(err => {
          if (fallbackUrl) {
            console.warn('[Outergazers Audio] Failed to load ' + url + ', trying fallback: ' + fallbackUrl);
            return fetch(encodeURI(fallbackUrl)).then(res => {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.arrayBuffer();
            });
          }
          throw err;
        })
        .then(ab => this.audioCtx.decodeAudioData(ab))
        .then(buf => {
          this.audioBuffers[key] = buf;
          console.log('[Outergazers Audio] Loaded buffer:', key, 'duration:', buf.duration.toFixed(2), 's');
        })
        .catch(err => {
          console.warn('[Outergazers Audio] Could not load sound file ' + key + ' (' + url + '):', err);
        });
    };

    loadBuffer('grass', AUDIO_CONFIG.grass.url, AUDIO_CONFIG.grass.fallbackUrl);
    loadBuffer('obsidian', AUDIO_CONFIG.obsidian.url, AUDIO_CONFIG.obsidian.fallbackUrl);
    loadBuffer('portal', AUDIO_CONFIG.portal.url, AUDIO_CONFIG.portal.fallbackUrl);
    loadBuffer('chest', AUDIO_CONFIG.chest.url, AUDIO_CONFIG.chest.fallbackUrl);
    loadBuffer('explosion', AUDIO_CONFIG.explosion.url, AUDIO_CONFIG.explosion.fallbackUrl);
    loadBuffer('letterWhoosh', AUDIO_CONFIG.letterWhoosh.url);
    loadBuffer('letterSettle', AUDIO_CONFIG.letterSettle.url);
    loadBuffer('titleShimmer', AUDIO_CONFIG.titleShimmer.url);
    loadBuffer('chestLand', AUDIO_CONFIG.chestLand.url);
    loadBuffer('parchmentUnfurl', AUDIO_CONFIG.parchmentUnfurl.url);
    loadBuffer('parchmentSettle', AUDIO_CONFIG.parchmentSettle.url);

    // Mobile Autoplay unlock: resume AudioContext on first user gesture
    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().then(() => {
          console.log('[Outergazers Audio] AudioContext unlocked successfully via user gesture.');
        });
      }
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  },

  playSoundSegment: function (key, duration, gainVal, startDelaySec, fadeInSec, fadeOutSec, pitchShift) {
    if (!this.audioCtx || !this.audioBuffers || !this.audioBuffers[key]) return null;

    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const ctxTime = this.audioCtx.currentTime || 0;
      const now = Math.max(ctxTime, 0.001) + (startDelaySec || 0);
      const buffer = this.audioBuffers[key];
      const dur = (duration && duration < buffer.duration) ? duration : buffer.duration;
      const targetGain = gainVal !== undefined ? gainVal : 0.5;

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      if (pitchShift && pitchShift !== 1.0) {
        source.playbackRate.setValueAtTime(pitchShift, now);
      }

      const voiceGain = this.audioCtx.createGain();
      const attack = Math.max(fadeInSec || 0.02, 0.001);
      voiceGain.gain.setValueAtTime(0.0001, now);
      if (now + attack > now) {
        voiceGain.gain.linearRampToValueAtTime(targetGain, now + attack);
      } else {
        voiceGain.gain.setValueAtTime(targetGain, now);
      }

      const fadeOut = Math.max(fadeOutSec || 0.20, 0.001);
      const fadeStart = Math.max(now + attack, now + dur - fadeOut);
      voiceGain.gain.setValueAtTime(targetGain, fadeStart);
      if (now + dur > fadeStart) {
        voiceGain.gain.linearRampToValueAtTime(0.0001, now + dur);
      } else {
        voiceGain.gain.setValueAtTime(0.0001, now + dur);
      }

      source.connect(voiceGain);
      if (this.masterGain) {
        voiceGain.connect(this.masterGain);
      } else {
        voiceGain.connect(this.audioCtx.destination);
      }

      source.start(now, 0, dur);

      const nodeRef = { source: source, gain: voiceGain };
      this.activeAudioNodes.push(nodeRef);
      source.onended = () => {
        const idx = this.activeAudioNodes.indexOf(nodeRef);
        if (idx !== -1) this.activeAudioNodes.splice(idx, 1);
      };

      return nodeRef;
    } catch (err) {
      console.warn('[Outergazers Audio] playSoundSegment non-fatal error:', err.message);
      return null;
    }
  },

  playGrassBlockSound: function (block, waveIndex) {
    // Trimmed clip (~1.73s natural duration), micro-stagger and gentle gain scaling to prevent overlap distortion
    const jitter = (waveIndex || 0) * 0.012; // 12ms micro-stagger
    const gain = Math.max(0.24, AUDIO_CONFIG.grass.baseGain / Math.sqrt(1 + (waveIndex || 0)));
    const pitch = 0.98 + (((block.id.charCodeAt(block.id.length - 1)) % 5) * 0.01);
    this.playSoundSegment('grass', AUDIO_CONFIG.grass.duration, gain, jitter, 0.02, 0.15, pitch);
  },

  playObsidianBlockSound: function (block, waveIndex) {
    // Punchy authentic Minecraft stone/obsidian placement sound with micro-offset for simultaneous block pairs
    const jitter = (waveIndex || 0) * 0.012; // 12ms micro-stagger
    const gain = Math.max(0.40, AUDIO_CONFIG.obsidian.baseGain / Math.sqrt(1 + (waveIndex || 0)));
    const pitch = 0.96 + (((block.id.charCodeAt(block.id.length - 1)) % 4) * 0.02);
    this.playSoundSegment('obsidian', AUDIO_CONFIG.obsidian.duration, gain, jitter, 0.002, 0.04, pitch);
  },

  playPortalActivationSound: function () {
    // Trimmed clip (~4.34s natural duration), smooth 0.2s fade in, 0.4s fade out
    console.log('[Outergazers Audio] Playing Portal activation sound (' + AUDIO_CONFIG.portal.duration + 's).');
    this.playSoundSegment('portal', AUDIO_CONFIG.portal.duration, AUDIO_CONFIG.portal.baseGain, 0, 0.20, 0.40, 1.0);
  },

  playChestOpenSound: function () {
    // Trimmed clip (~1.97s natural duration), crisp lid creak attack and resonant close
    console.log('[Outergazers Audio] Playing Ender Chest opening sound (' + AUDIO_CONFIG.chest.duration + 's).');
    this.playSoundSegment('chest', AUDIO_CONFIG.chest.duration, AUDIO_CONFIG.chest.baseGain, 0, 0.01, 0.20, 1.0);
  },

  playExplosionSound: function () {
    // Trimmed clip (~2.02s natural duration), sharp instant attack and resonant decay
    console.log('[Outergazers Audio] Playing Creeper Explosion sound (' + AUDIO_CONFIG.explosion.duration + 's).');
    this.playSoundSegment('explosion', AUDIO_CONFIG.explosion.duration, AUDIO_CONFIG.explosion.baseGain, 0, 0.005, 0.30, 1.0);
  },

  playLetterWhooshSound: function (letterIndex) {
    // Subtle ascending pitch from 0.96 to 1.14 across the 11 letters for energetic airy sweep
    const pitch = 0.96 + ((letterIndex || 0) * 0.018);
    this.playSoundSegment('letterWhoosh', AUDIO_CONFIG.letterWhoosh.duration, AUDIO_CONFIG.letterWhoosh.baseGain, 0, 0.01, 0.04, pitch);
  },

  playLetterSettleSound: function (letterIndex) {
    // Subtle ascending pitch from 0.92 to 1.14 across the 11 letters
    const pitch = 0.92 + ((letterIndex || 0) * 0.022);
    this.playSoundSegment('letterSettle', AUDIO_CONFIG.letterSettle.duration, AUDIO_CONFIG.letterSettle.baseGain, 0, 0.005, 0.03, pitch);
  },

  playTitleShimmerSound: function () {
    console.log('[Outergazers Audio] Playing OUTERGAZERS Title Assembled shimmer sound.');
    this.playSoundSegment('titleShimmer', AUDIO_CONFIG.titleShimmer.duration, AUDIO_CONFIG.titleShimmer.baseGain, 0, 0.03, 0.30, 1.0);
  },

  playChestLandSound: function () {
    console.log('[Outergazers Audio] Playing Ender Chest Landing thud impact.');
    this.playSoundSegment('chestLand', AUDIO_CONFIG.chestLand.duration, AUDIO_CONFIG.chestLand.baseGain, 0, 0.005, 0.12, 1.0);
  },

  playParchmentUnfurlSound: function () {
    console.log('[Outergazers Audio] Playing Parchment Unfurl paper roll sound.');
    this.playSoundSegment('parchmentUnfurl', AUDIO_CONFIG.parchmentUnfurl.duration, AUDIO_CONFIG.parchmentUnfurl.baseGain, 0, 0.02, 0.10, 1.0);
  },

  playParchmentSettleSound: function () {
    console.log('[Outergazers Audio] Playing Parchment Settle soft rustle sound.');
    this.playSoundSegment('parchmentSettle', AUDIO_CONFIG.parchmentSettle.duration, AUDIO_CONFIG.parchmentSettle.baseGain, 0, 0.02, 0.08, 1.0);
  },

  stopAllAudio: function () {
    if (this.activeAudioNodes && this.activeAudioNodes.length > 0) {
      for (let i = 0; i < this.activeAudioNodes.length; i++) {
        try {
          this.activeAudioNodes[i].source.stop();
        } catch (e) {}
      }
      this.activeAudioNodes = [];
    }
  },

  updateTrackingHintText: function (text, bg) {
    if (!this.trackingHintEl) {
      this.trackingHintEl = document.querySelector('#tracking-hint');
    }
    if (this.trackingHintEl && (this._lastHintText !== text || this._lastHintBg !== bg)) {
      this._lastHintText = text;
      this._lastHintBg = bg || '';
      this.trackingHintEl.innerText = text;
      if (bg) this.trackingHintEl.style.background = bg;
    }
  },

  setupTapListeners: function () {
    const self = this;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    function onPointerDown(e) {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else {
        touchStartX = e.clientX;
        touchStartY = e.clientY;
      }
      touchStartTime = Date.now();
    }

    function onPointerUp(e) {
      let clientX, clientY;
      if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      if (clientX === undefined || clientY === undefined) return;

      const dx = clientX - touchStartX;
      const dy = clientY - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = Date.now() - touchStartTime;

      if (dist < 30 && elapsed < 650) {
        if (!self.handleScrollButtonTap(clientX, clientY)) {
          self.handleChestTap(clientX, clientY);
        }
      }
    }

    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchend', onPointerUp, { passive: true });
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);

    window.addEventListener('click', (e) => {
      if (!self.handleScrollButtonTap(e.clientX, e.clientY)) {
        self.handleChestTap(e.clientX, e.clientY);
      }
    });
  },

  setupModels: function () {
    const self = this;
    const rootEl = document.querySelector('#outergazers-root');
    const grassEl = document.querySelector('#model-grass');
    const obsidianEl = document.querySelector('#model-obsidian');
    const portalEl = document.querySelector('#model-portal');
    const chestEl = document.querySelector('#model-chest');
    const textContainer = document.querySelector('#outergazers-text-container');
    const textEl = document.querySelector('#model-text');

    self.models.root = rootEl;
    self.models.chestEl = chestEl;
    self.models.textContainer = textContainer;
    self.models.textEl = textEl;

    if (textContainer) {
      // Reposition text container directly in portal central area above Ender Chest
      textContainer.setAttribute('position', '0 5.267 2.1');
      if (textContainer.object3D) {
        textContainer.object3D.position.set(0, 5.267, 2.1);
      }
    }

    self.setExperienceVisible(false);

    self.setupInteractionHitbox();
    self.setupExplosionMesh();
    self.setupEventPaperMesh();

    function checkAllLoaded() {
      self.modelsLoadedCount++;
      if (self.modelsLoadedCount >= 5) {
        self.isReady = true;
        console.log('[Outergazers] All 5 GLB models loaded & ready.');
        if (self.pendingStartOnReady && self.isTargetTracked) {
          self.startSequenceFromBeginning();
        }
      }
    }

    if (grassEl) {
      grassEl.addEventListener('model-loaded', (e) => {
        self.models.grass = e.detail.model;
        self.applyPixelArtFiltering(e.detail.model);
        if (e.detail.model.animations && e.detail.model.animations.length > 0) {
          self.mixers.grass = new THREE.AnimationMixer(e.detail.model);
          const action = self.mixers.grass.clipAction(e.detail.model.animations[0]);
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
          action.play();
          self.mixers.grass.setTime(0);
        }
        checkAllLoaded();
      });
    }

    if (obsidianEl) {
      obsidianEl.addEventListener('model-loaded', (e) => {
        self.models.obsidian = e.detail.model;
        self.applyPixelArtFiltering(e.detail.model);
        if (e.detail.model.animations && e.detail.model.animations.length > 0) {
          self.mixers.obsidian = new THREE.AnimationMixer(e.detail.model);
          const action = self.mixers.obsidian.clipAction(e.detail.model.animations[0]);
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
          action.play();
          self.mixers.obsidian.setTime(0);
        }
        checkAllLoaded();
      });
    }

    if (portalEl) {
      portalEl.addEventListener('model-loaded', (e) => {
        self.models.portalSurface = e.detail.model;

        self.portalMaterial = new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(PortalShaderDef.uniforms),
          vertexShader: PortalShaderDef.vertexShader,
          fragmentShader: PortalShaderDef.fragmentShader,
          transparent: true,
          side: THREE.DoubleSide
        });

        self.models.portalSurface.traverse((child) => {
          if (child.isMesh) {
            child.material = self.portalMaterial;
          }
        });

        if (e.detail.model.animations && e.detail.model.animations.length > 0) {
          self.mixers.portalSurface = new THREE.AnimationMixer(e.detail.model);
          const action = self.mixers.portalSurface.clipAction(e.detail.model.animations[0]);
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
          action.play();
          self.mixers.portalSurface.setTime(0);
        }

        self.setPortalVisible(false);
        checkAllLoaded();
      });
    }

    if (chestEl) {
      chestEl.addEventListener('model-loaded', (e) => {
        self.models.chest = e.detail.model;
        self.models.chestEl = chestEl;
        self.applyPixelArtFiltering(e.detail.model);

        // TASK 13 ISSUE 1: Increase chest visible size by 1.9x at dedicated model root level
        // TASK 15: Slightly reduced chest visible scale (1.65x, ~13.2% reduction) & flush grass bottom alignment
        self.models.chest.scale.set(CHEST_VISUAL_SCALE, CHEST_VISUAL_SCALE, CHEST_VISUAL_SCALE);
        self.models.chest.position.y = CHEST_BOTTOM_ALIGN_Y;

        if (e.detail.model.animations && e.detail.model.animations.length > 0) {
          self.mixers.chest = new THREE.AnimationMixer(e.detail.model);
          const action = self.mixers.chest.clipAction(e.detail.model.animations[0]);
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
          action.play();
          self.mixers.chest.setTime(0.042); // Closed lid pose
        }

        self.setChestVisible(false);
        checkAllLoaded();
      });

      chestEl.addEventListener('click', () => {
        self.handleChestTap(window.innerWidth / 2, window.innerHeight / 2, true);
      });
    }

    if (textEl) {
      textEl.addEventListener('model-loaded', (e) => {
        self.models.text = e.detail.model;
        self.models.textEl = textEl;
        console.log('[Outergazers] Text reveal GLB loaded successfully.');

        // TASK 12: Configure shining cyan material, additive glow halo, and letter nodes
        self.setupTextMaterialsAndHalo(e.detail.model);

        if (e.detail.model.animations && e.detail.model.animations.length > 0) {
          const clip = e.detail.model.animations.find(a => a.name === 'outergazers_text_reveal') || e.detail.model.animations[0];
          console.log('[Outergazers] Found text animation clip:', clip.name, 'authored duration:', clip.duration, 's');
          self.mixers.text = new THREE.AnimationMixer(e.detail.model);
          self.textAction = self.mixers.text.clipAction(clip);
          self.textAction.setLoop(THREE.LoopOnce);
          self.textAction.clampWhenFinished = true;
          self.textRevealDuration = 3.600; // Snappy, energetic emergence of OUTERGAZERS & GAMEJAM 2026 title
        } else {
          console.error('[Outergazers ERROR] No animations found in outergazers_text_reveal.glb!');
        }

        self.setTextVisible(false);
        checkAllLoaded();
      });

      textEl.addEventListener('model-error', (err) => {
        console.error('[Outergazers ERROR] Failed to load outergazers_text_reveal.glb:', err);
      });
    }
  },

  applyPixelArtFiltering: function (model) {
    if (!model) return;
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap'].forEach((mapName) => {
            if (mat[mapName]) {
              mat[mapName].magFilter = THREE.NearestFilter;
              mat[mapName].minFilter = THREE.NearestFilter;
              mat[mapName].needsUpdate = true;
            }
          });
        });
      }
    });
  },

  setupInteractionHitbox: function () {
    const rootEl = document.querySelector('#outergazers-root');
    if (!rootEl || !rootEl.object3D) return;

    // TASK 6 (FIX 1): Hitbox matching approved 1.0 scale chest (3.2 x 3.2 x 3.2 units)
    const boxGeo = new THREE.BoxGeometry(3.2, 3.2, 3.2);
    const boxMat = new THREE.MeshBasicMaterial({ visible: false });

    this.chestHitbox = new THREE.Mesh(boxGeo, boxMat);
    this.chestHitbox.position.set(0, 3.0, 3.12);
    rootEl.object3D.add(this.chestHitbox);
    console.log('[Outergazers] Interaction hitbox attached to root container.');
  },

  createFireflyTexture: function () {
    if (this.fireflyTexture) return this.fireflyTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Vibrant radial fire flake / spark texture with solid incandescent core and rich outer glow
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.22, 'rgba(255, 242, 170, 0.98)');
    grad.addColorStop(0.50, 'rgba(255, 145, 20, 0.82)');
    grad.addColorStop(0.78, 'rgba(235, 60, 10, 0.45)');
    grad.addColorStop(1.0, 'rgba(200, 20, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    this.fireflyTexture = new THREE.CanvasTexture(canvas);
    this.fireflyTexture.needsUpdate = true;
    return this.fireflyTexture;
  },

  setupExplosionMesh: function () {
    if (this.explosionMesh) return;
    const rootEl = document.querySelector('#outergazers-root');
    if (!rootEl || !rootEl.object3D) return;

    // Unified container for full explosion effect positioned directly at chest mouth
    this.explosionMesh = new THREE.Group();
    this.explosionMesh.renderOrder = 2800;
    this.explosionMesh.frustumCulled = false;
    // SettlePos of chest is (0, 3.00, 3.12). Position explosion at chest opening (0, 3.20, 3.20)
    this.explosionMesh.position.set(0, 3.20, 3.20);
    this.explosionMesh.scale.set(2.8, 2.8, 2.8);
    this.explosionMesh.visible = false;
    rootEl.object3D.add(this.explosionMesh);

    // 1. Existing explosion asset: Irregular Creeper explosion spritesheet
    const loader = new THREE.TextureLoader();
    this.explosionTexture = loader.load('./assets/explosion/explosion_spritesheet.png', (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1.0 / 8.0, 1.0 / 8.0);
      tex.offset.set(1.0 / 8.0, 7.0 / 8.0);
      tex.needsUpdate = true;
      console.log('[Outergazers] Irregular Creeper explosion spritesheet loaded successfully.');
    });
    this.explosionTexture.wrapS = THREE.RepeatWrapping;
    this.explosionTexture.wrapT = THREE.RepeatWrapping;
    this.explosionTexture.repeat.set(1.0 / 8.0, 1.0 / 8.0);
    this.explosionTexture.offset.set(1.0 / 8.0, 7.0 / 8.0);

    const planeGeo = new THREE.PlaneGeometry(15.5, 15.5 * (9.0 / 16.0));
    this.explosionPlaneMat = new THREE.MeshBasicMaterial({
      map: this.explosionTexture,
      transparent: true,
      opacity: 1.0,
      alphaTest: 0.01,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    });
    this.explosionQuad = new THREE.Mesh(planeGeo, this.explosionPlaneMat);
    this.explosionQuad.renderOrder = 2800;
    this.explosionQuad.frustumCulled = false;
    this.explosionMesh.add(this.explosionQuad);

    // 2. Fiery burst particle system: orange/yellow fire flakes, glowing sparks, and embers
    const PARTICLE_COUNT = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    this.fireflyData = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const typeRand = Math.random();
      let pType, speed, drag, loft, wobbleFreq, wobbleAmp, baseSize, flickerSpeed, r, g, b;

      if (typeRand < 0.50) {
        // 1. Fiery Orange/Yellow Fire Flakes (50%)
        pType = 'flake';
        speed = 2.0 + Math.random() * 3.2;
        drag = 0.935 + Math.random() * 0.025;
        loft = 0.7 + Math.random() * 0.7;
        wobbleFreq = 7.0 + Math.random() * 8.0;
        wobbleAmp = 0.20 + Math.random() * 0.25;
        baseSize = 0.85 + Math.random() * 0.65;
        flickerSpeed = 10.0 + Math.random() * 10.0;
        r = 1.0;
        g = 0.52 + Math.random() * 0.28;
        b = 0.03 + Math.random() * 0.12;
      } else if (typeRand < 0.75) {
        // 2. Glowing Sparks (25%) - Fast, brilliant incandescent yellow-white
        pType = 'spark';
        speed = 3.6 + Math.random() * 4.2;
        drag = 0.955 + Math.random() * 0.025;
        loft = 0.25 + Math.random() * 0.45;
        wobbleFreq = 3.0 + Math.random() * 5.0;
        wobbleAmp = 0.06 + Math.random() * 0.10;
        baseSize = 0.40 + Math.random() * 0.35;
        flickerSpeed = 24.0 + Math.random() * 16.0;
        r = 1.0;
        g = 0.90 + Math.random() * 0.10;
        b = 0.55 + Math.random() * 0.35;
      } else {
        // 3. Embers (25%) - Deep glowing red-orange, strong thermal rise
        pType = 'ember';
        speed = 1.2 + Math.random() * 2.2;
        drag = 0.925 + Math.random() * 0.025;
        loft = 1.4 + Math.random() * 1.0;
        wobbleFreq = 4.0 + Math.random() * 5.0;
        wobbleAmp = 0.25 + Math.random() * 0.25;
        baseSize = 0.55 + Math.random() * 0.45;
        flickerSpeed = 6.0 + Math.random() * 8.0;
        r = 1.0;
        g = 0.24 + Math.random() * 0.18;
        b = 0.01 + Math.random() * 0.04;
      }

      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * (pType === 'ember' ? 1.5 : 1.35) + (pType === 'ember' ? 1.0 : 0.6);
      const vz = Math.cos(phi) * speed * 0.85 + 0.4;

      this.fireflyData.push({
        pType: pType,
        initSpeed: speed,
        vx: vx,
        vy: vy,
        vz: vz,
        drag: drag,
        loft: loft,
        wobbleFreq: wobbleFreq,
        wobbleAmp: wobbleAmp,
        phase: Math.random() * Math.PI * 2,
        baseSize: baseSize,
        flickerSpeed: flickerSpeed,
        r: r,
        g: g,
        b: b,
        baseG: g,
        baseB: b
      });

      colors[i * 3 + 0] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
      sizes[i] = baseSize;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.computeBoundingSphere();

    const texture = this.createFireflyTexture();

    const material = new THREE.PointsMaterial({
      size: 1.45,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      vertexColors: true
    });

    this.fireflyPoints = new THREE.Points(geometry, material);
    this.fireflyPoints.renderOrder = 3200;
    this.fireflyPoints.frustumCulled = false;
    this.explosionMesh.add(this.fireflyPoints);

    this.fireflyGeo = geometry;
    this.fireflyMat = material;
    this.fireflyPositions = positions;
    this.fireflyColors = colors;
    this.fireflySizes = sizes;

    console.log('[Outergazers] Complete explosion effect (spritesheet + fiery burst particles) attached to root.');
  },



  resetFireflies: function () {
    if (!this.fireflyData || !this.fireflyPositions) return;
    const pos = this.fireflyPositions;
    for (let i = 0; i < this.fireflyData.length; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 0.25;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.25;

      const p = this.fireflyData[i];
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = p.initSpeed;
      p.vx = Math.sin(phi) * Math.cos(theta) * speed;
      p.vy = Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * (p.pType === 'ember' ? 1.5 : 1.35) + (p.pType === 'ember' ? 1.0 : 0.6);
      p.vz = Math.cos(phi) * speed * 0.85 + 0.4;
    }
    this.fireflyGeo.attributes.position.needsUpdate = true;
    if (this.fireflyMat) {
      this.fireflyMat.opacity = 1.0;
      this.fireflyMat.size = 1.45;
    }
  },

  updateFireflies: function (dt, elapsed, dur) {
    if (!this.fireflyData || !this.fireflyMat) return;
    const progress = Math.min(elapsed / dur, 1.0);
    const geo = this.fireflyGeo;
    const pos = this.fireflyPositions;
    const col = this.fireflyColors;
    const sz = this.fireflySizes;
    const pData = this.fireflyData;

    let globalAlpha = 1.0;
    if (progress > 0.65) {
      globalAlpha = 1.0 - Math.pow((progress - 0.65) / 0.35, 1.5);
    }
    this.fireflyMat.opacity = Math.max(0.0, globalAlpha);

    let scaleFactor = 1.0;
    if (progress < 0.12) {
      scaleFactor = progress / 0.12;
    } else {
      scaleFactor = 1.0 - (progress - 0.12) * 0.35;
    }
    this.fireflyMat.size = 1.45 * Math.max(0.35, scaleFactor);

    for (let i = 0; i < pData.length; i++) {
      const p = pData[i];

      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy = (p.vy - 0.15 * dt) * Math.pow(p.drag, dt * 60) + p.loft * dt;
      p.vz *= Math.pow(p.drag, dt * 60);

      const t = elapsed;
      const wobbleX = Math.sin(t * p.wobbleFreq + p.phase) * p.wobbleAmp * dt;
      const wobbleY = Math.cos(t * p.wobbleFreq * 0.8 + p.phase) * p.wobbleAmp * dt;
      const wobbleZ = Math.sin(t * p.wobbleFreq * 1.2 + p.phase) * p.wobbleAmp * dt;

      pos[i * 3 + 0] += (p.vx + wobbleX) * dt;
      pos[i * 3 + 1] += (p.vy + wobbleY) * dt;
      pos[i * 3 + 2] += (p.vz + wobbleZ) * dt;

      const flicker = 0.75 + 0.25 * Math.sin(t * p.flickerSpeed + p.phase);

      let scaleFactor = 1.0;
      if (progress < 0.12) {
        scaleFactor = progress / 0.12;
      } else {
        scaleFactor = 1.0 - (progress - 0.12) * 0.35;
      }

      sz[i] = p.baseSize * scaleFactor * flicker * 0.9;

      if (p.pType === 'spark') {
        // Glowing sparks: incandescent yellow-white, fading slightly to gold
        col[i * 3 + 0] = 1.0;
        col[i * 3 + 1] = Math.max(0.75, p.baseG - progress * 0.20);
        col[i * 3 + 2] = Math.max(0.20, p.baseB * (1.0 - progress * 0.70));
      } else if (p.pType === 'ember') {
        // Embers: deep glowing orange-red, warm thermal pulse
        const pulse = Math.sin(t * p.flickerSpeed + p.phase) * 0.08;
        col[i * 3 + 0] = 1.0;
        col[i * 3 + 1] = Math.max(0.18, Math.min(0.50, p.baseG + pulse - progress * 0.10));
        col[i * 3 + 2] = p.baseB * Math.max(0.0, 1.0 - progress);
      } else {
        // Orange/yellow fire flakes: warm vibrant fire colors
        const pulse = Math.sin(t * 4.0 + p.phase) * 0.07;
        col[i * 3 + 0] = 1.0;
        col[i * 3 + 1] = Math.max(0.42, Math.min(0.85, p.baseG + pulse - progress * 0.15));
        col[i * 3 + 2] = p.baseB * (1.0 - progress * 0.65);
      }
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  },

  setupEventPaperMesh: function () {
    if (this.eventPaperMesh) return;
    const rootEl = document.querySelector('#outergazers-root');
    if (!rootEl || !rootEl.object3D) return;

    const pw = EVENT_PAPER_CONFIG.paperWidth;
    const ph = EVENT_PAPER_CONFIG.paperHeight;

    // 1. Initial placeholder canvas texture
    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.width = 1145;
    placeholderCanvas.height = 1374;
    const pctx = placeholderCanvas.getContext('2d');
    pctx.fillStyle = '#f5e6c8';
    pctx.fillRect(0, 0, 1145, 1374);

    const initialTex = new THREE.CanvasTexture(placeholderCanvas);
    initialTex.encoding = THREE.sRGBEncoding;

    // 2. Main Poster Plane Geometry
    const paperGeo = new THREE.PlaneGeometry(pw, ph, 1, 32);

    // 3. Shader Material separating Blank Base Paper from Poster Print Artwork
    const uniforms = {
      uBaseTexture: { value: initialTex },
      uPrintTexture: { value: initialTex },
      revealCutoff: { value: 0.8472 }, // Paper physical unroll cutoff
      printCutoff: { value: 1.05 }     // Progressive print reveal cutoff (1.05 = 100% blank)
    };

    const paperMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uBaseTexture;
        uniform sampler2D uPrintTexture;
        uniform float revealCutoff;
        uniform float printCutoff;
        varying vec2 vUv;

        void main() {
          // 1. Unfurl reveal cutoff (from top down)
          if (vUv.y < revealCutoff) {
            discard;
          }

          vec4 baseCol = texture2D(uBaseTexture, vUv);
          vec4 printCol = texture2D(uPrintTexture, vUv);

          // Use the clean alpha from the print artwork and base paper
          float alpha = max(baseCol.a, printCol.a);

          // 2. Discard transparent exterior background
          if (alpha < 0.05) {
            discard;
          }

          // 3. Progressive print reveal onto parchment
          float printFactor = clamp((vUv.y - printCutoff) / 0.04, 0.0, 1.0);
          vec3 finalRgb = mix(baseCol.rgb, printCol.rgb, printFactor);

          gl_FragColor = vec4(finalRgb, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false
    });

    paperMat.userData.uniforms = uniforms;
    paperMat.userData.revealCutoff = uniforms.revealCutoff;
    paperMat.userData.printCutoff = uniforms.printCutoff;

    this.eventPaperMesh = new THREE.Mesh(paperGeo, paperMat);
    this.eventPaperMesh.renderOrder = 3000; // Render in front of AR models
    this.eventPaperMesh.position.copy(EVENT_PAPER_CONFIG.emergeStartPos);
    this.eventPaperMesh.scale.copy(EVENT_PAPER_CONFIG.emergeStartScale);
    this.eventPaperMesh.rotation.set(0, 0, 0); // STRICTLY UPRIGHT in AR poster space
    this.eventPaperMesh.visible = false;

    // 4. Lower Roller Traveling Mesh (Supports the illusion of unrolling)
    const rollerHeight = ph * (210 / 1374); // 2.5218
    const rollerGeo = new THREE.PlaneGeometry(pw, rollerHeight);
    const uvs = rollerGeo.attributes.uv;
    uvs.setXY(0, 0.0, 0.1528); // top-left
    uvs.setXY(1, 1.0, 0.1528); // top-right
    uvs.setXY(2, 0.0, 0.0000); // bottom-left
    uvs.setXY(3, 1.0, 0.0000); // bottom-right
    uvs.needsUpdate = true;

    const rollerMat = new THREE.MeshBasicMaterial({
      map: initialTex,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.05,
      depthWrite: false,
      depthTest: false
    });

    this.lowerRollerMesh = new THREE.Mesh(rollerGeo, rollerMat);
    this.lowerRollerMesh.renderOrder = 3001;
    this.rollerStartY = (ph / 2) - rollerHeight - (rollerHeight / 2); // 5.0078
    this.rollerEndY = (-ph / 2) + (rollerHeight / 2); // -7.1693
    this.lowerRollerMesh.position.set(0, this.rollerStartY, 0.015);
    this.lowerRollerMesh.visible = false;
    this.eventPaperMesh.add(this.lowerRollerMesh);

    rootEl.object3D.add(this.eventPaperMesh);

    // 5. Asynchronously load Blank Parchment Base and Poster Artwork
    const texLoader = new THREE.TextureLoader();

    texLoader.load(EVENT_PAPER_CONFIG.baseImageUrl, (loadedBaseTex) => {
      loadedBaseTex.encoding = THREE.sRGBEncoding;
      loadedBaseTex.generateMipmaps = true;
      loadedBaseTex.minFilter = THREE.LinearMipmapLinearFilter;
      loadedBaseTex.magFilter = THREE.LinearFilter;
      loadedBaseTex.wrapS = THREE.ClampToEdgeWrapping;
      loadedBaseTex.wrapT = THREE.ClampToEdgeWrapping;
      loadedBaseTex.needsUpdate = true;

      uniforms.uBaseTexture.value = loadedBaseTex;
      rollerMat.map = loadedBaseTex;
      rollerMat.needsUpdate = true;
      console.log('[Outergazers] Blank parchment base texture loaded successfully.');
    });

    texLoader.load(EVENT_PAPER_CONFIG.printImageUrl, (loadedPrintTex) => {
      loadedPrintTex.encoding = THREE.sRGBEncoding;
      loadedPrintTex.generateMipmaps = true;
      loadedPrintTex.minFilter = THREE.LinearMipmapLinearFilter;
      loadedPrintTex.magFilter = THREE.LinearFilter;
      loadedPrintTex.wrapS = THREE.ClampToEdgeWrapping;
      loadedPrintTex.wrapT = THREE.ClampToEdgeWrapping;
      loadedPrintTex.needsUpdate = true;

      uniforms.uPrintTexture.value = loadedPrintTex;
      console.log('[Outergazers] Transparent poster print artwork loaded successfully.');
    });

    console.log('[Outergazers] Upright Scroll Mesh with print-on-unfurl attached to root.');
  },

  handleChestTap: function (clientX, clientY, forceDirectHit) {
    if (this.sequenceState !== SEQUENCE_STATE.COMPLETED) {
      console.log('[Outergazers] Tap ignored: Main sequence not yet COMPLETED (current:', this.sequenceState, ')');
      return;
    }
    // Only allow tap after title reveal has completely finished
    if (this.isTextRevealPlaying || !this.hasTextRevealCompleted) {
      console.log('[Outergazers] Tap ignored: Title reveal is still playing');
      return;
    }
    // Prevent repeated taps from triggering duplicate animations
    if (this.interactionState !== INTERACTION_STATE.READY_FOR_TAP || this.chestState.hasBeenTapped) {
      console.log('[Outergazers] Tap ignored: Chest already tapped or interactionState is', this.interactionState);
      return;
    }
    if (!this.models.chest) return;

    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl || !sceneEl.camera) return;
    const camera = sceneEl.camera;

    let isHit = Boolean(forceDirectHit);

    if (!isHit && clientX !== undefined && clientY !== undefined) {
      sceneEl.object3D.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      if (this.chestHitbox) this.chestHitbox.updateMatrixWorld(true);
      if (this.models.chest) this.models.chest.updateMatrixWorld(true);

      const canvas = sceneEl.canvas || document.body;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Collect all candidate 3D objects with categories
      const targets = [];
      if (this.chestHitbox) targets.push({ obj: this.chestHitbox, type: 'chest' });
      if (this.models.chest) targets.push({ obj: this.models.chest, type: 'chest' });
      if (this.models.text) targets.push({ obj: this.models.text, type: 'text' });
      if (this.models.portal) targets.push({ obj: this.models.portal, type: 'portal' });
      if (this.models.obsidian) targets.push({ obj: this.models.obsidian, type: 'portal' });
      if (this.models.grass) targets.push({ obj: this.models.grass, type: 'ground' });

      const hitList = [];
      targets.forEach(t => {
        if (!t.obj) return;
        const hits = raycaster.intersectObject(t.obj, true);
        hits.forEach(h => hitList.push({ hit: h, type: t.type }));
      });
      hitList.sort((a, b) => a.hit.distance - b.hit.distance);

      if (hitList.length > 0) {
        const closest = hitList[0];
        if (closest.type === 'chest') {
          isHit = true;
          console.log('[Outergazers] Chest tap confirmed via 3D raycast on chest/hitbox!');
        } else {
          // Explicitly ensure taps on title, portal, or surrounding ground DO NOT count as chest taps!
          console.log('[Outergazers] Tap hit ' + closest.type + ' instead of chest. Ignored.');
          return;
        }
      } else {
        // Raycaster hit no 3D geometry in scene (empty camera background)
        const chestWorld = new THREE.Vector3();
        this.models.chest.getWorldPosition(chestWorld);
        chestWorld.project(camera);

        const chestScreenX = ((chestWorld.x + 1) / 2) * rect.width + rect.left;
        const chestScreenY = ((-chestWorld.y + 1) / 2) * rect.height + rect.top;
        const tapDistance = Math.hypot(clientX - chestScreenX, clientY - chestScreenY);

        // Require tap to be within 85px of chest screen center
        if (tapDistance <= 210) { // Scaled 2.5x for larger chest
          isHit = true;
          console.log('[Outergazers] Chest tap confirmed via tight proximity (dist:', tapDistance.toFixed(1), 'px)');
        } else {
          console.log('[Outergazers] Tap missed chest (dist:', tapDistance.toFixed(1), 'px). Ignored.');
          return;
        }
      }
    }

    if (!isHit) return;

    // Trigger chest opening strictly on confirmed tap
    console.log('[Outergazers] User tap confirmed on chest! Opening Ender Chest.');
    this.chestState.hasBeenTapped = true;
    this.chestState.isIdleJiggling = false;
    if (this.models.chest) {
      this.models.chest.rotation.y = 0;
    }
    this.chestOpenTimer = 0.0;
    this.interactionState = INTERACTION_STATE.OPENING_CHEST;
    this.playChestOpenSound();

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      hint.innerText = 'Opening Ender Chest... 📦';
      hint.style.background = 'rgba(218, 165, 32, 0.95)';
    }
  },

  triggerExplosion: function () {
    console.log('[Outergazers] triggerExplosion() called. Playing Creeper explosion while AR world stays visible.');
    this.interactionState = INTERACTION_STATE.PLAYING_EXPLOSION;

    // Trigger Explosion Sound Effect (4-6s segment, synchronized with visual blast)
    if (!this.hasExplosionSoundPlayed) {
      this.hasExplosionSoundPlayed = true;
      this.playExplosionSound();
    }
    this.explosionTimer = 0.0;
    this.postExplosionTimer = 0.0;
    this.explosionFinishedTimestamp = 0;
    this.hasTriggeredReveal = false;

    // TASK 15: PRESERVE AR WORLD DURING EXPLOSION!
    // Grass, Obsidian, Portal, and opened Chest remain 100% visible throughout the blast!
    this.setGrassVisible(true);
    this.setObsidianVisible(true);
    this.setPortalVisible(true);
    this.setChestVisible(true);

    if (this.hasTitleBeenRevealed) {
      this.setTextVisible(true);
      this.resetTextToRestingPose();
    }
    this.chestState.isIdleJiggling = false;
    if (this.mixers.chest) {
      this.mixers.chest.setTime(1.250); // Locked in fully opened pose
    }

    if (!this.explosionMesh) {
      this.setupExplosionMesh();
    }

    if (this.resetFireflies) {
      this.resetFireflies();
    }

    if (this.explosionMesh) {
      this.explosionMesh.visible = true;
      this.explosionMesh.position.set(0, 3.20, 3.20);
      this.explosionMesh.scale.set(2.8, 2.8, 2.8);
      if (this.explosionPlaneMat) {
        this.explosionPlaneMat.opacity = 1.0;
      }
      if (this.explosionTexture) {
        this.explosionTexture.offset.x = 1.0 / 8.0;
        this.explosionTexture.offset.y = 7.0 / 8.0;
      }
      this.updateBillboard(this.explosionMesh);
    }

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      hint.innerText = '💥 BOOM! Creeper Explosion! 💥';
      hint.style.background = 'rgba(239, 68, 68, 0.95)';
    }

    // TASK FIX: Trigger scroll reveal immediately when explosion fires (zero delay!)
    this.hasTriggeredReveal = true;
    this.triggerScrollEmergence();
  },
  triggerScrollEmergence: function () {
    console.log('[Outergazers] triggerScrollEmergence() called immediately with explosion. Scroll emerging from chest...');
    this.interactionState = INTERACTION_STATE.EMERGING_SCROLL;
    this.scrollEmergeTimer = 0.0;
    this.scrollEmergeDuration = 1.00; // Snappy smooth emergence journey (1.00s)
    this.eventPaperTimer = 0.0;
    this.eventPaperDuration = 1.25; // Continuous unfurling during emergence
    this.hasParchmentUnfurlSoundPlayed = false;
    this.hasParchmentSettleSoundPlayed = false;

    // Keep explosion burst visible and synchronized during scroll emergence!

    // Keep AR world fully visible behind scroll
    this.setGrassVisible(true);
    this.setObsidianVisible(true);
    this.setPortalVisible(true);
    this.setChestVisible(true);
    if (this.mixers.chest) {
      this.mixers.chest.setTime(1.250); // Chest stays open
    }

    if (!this.eventPaperMesh) {
      this.setupEventPaperMesh();
    }

    if (this.eventPaperMesh) {
      this.eventPaperMesh.visible = true;
      this.eventPaperMesh.rotation.set(0, 0, 0); // STRICTLY UPRIGHT
      this.eventPaperMesh.position.copy(EVENT_PAPER_CONFIG.emergeStartPos);
      this.eventPaperMesh.scale.copy(EVENT_PAPER_CONFIG.emergeStartScale);
      if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.revealCutoff) {
        this.eventPaperMesh.material.userData.revealCutoff.value = 0.8472; // Closed scroll presentation
      }
      if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.printCutoff) {
        this.eventPaperMesh.material.userData.printCutoff.value = 1.05; // Blank parchment initially
      }
      if (this.lowerRollerMesh) {
        this.lowerRollerMesh.visible = true;
        this.lowerRollerMesh.position.set(0, this.rollerStartY, 0.015);
      }
    }

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      hint.innerText = 'Call to Adventure Scroll Emerging... 📜';
      hint.style.background = 'rgba(168, 85, 247, 0.95)';
    }
  },

  triggerScrollUnfurl: function () {
    console.log('[Outergazers] triggerScrollUnfurl() called. Unrolling parchment...');
    this.interactionState = INTERACTION_STATE.UNFURLING_SCROLL;
    this.eventPaperTimer = 0.0;
    this.eventPaperDuration = 1.60; // Smooth 1.60s unroll

    // Play parchment unfurl sound as reveal starts
    if (!this.hasParchmentUnfurlSoundPlayed) {
      this.hasParchmentUnfurlSoundPlayed = true;
      this.playParchmentUnfurlSound();
    }

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      hint.innerText = 'Unrolling Call to Adventure... 📜';
      hint.style.background = 'rgba(168, 85, 247, 0.95)';
    }
  },
  updateBillboard: function (mesh) {
    if (!mesh || !mesh.visible || !mesh.parent) return;
    // The parchment scroll must ALWAYS stay strictly upright in AR poster space (pitch = 0, roll = 0)!
    if (mesh === this.eventPaperMesh || mesh === this.explosionMesh) {
      mesh.rotation.set(0, 0, 0);
      return;
    }
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl && sceneEl.camera) {
      const camPos = new THREE.Vector3();
      sceneEl.camera.getWorldPosition(camPos);
      const localCamPos = mesh.parent.worldToLocal(camPos.clone());
      mesh.lookAt(localCamPos);
    }
  },

  setExperienceVisible: function (visible) {
    const rootEl = document.querySelector('#outergazers-root');
    if (rootEl) {
      rootEl.setAttribute('visible', visible);
      if (rootEl.object3D) rootEl.object3D.visible = visible;
    }
    if (!visible) {
      this.setTextVisible(false);
      const regBtn = document.querySelector('#register-btn');
      if (regBtn) regBtn.style.display = 'none';
    }
  },

  createProceduralSilverEnvMap: function () {
    if (this.silverEnvMap) return this.silverEnvMap;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Studio HDR-style gradient for shiny polished silver metal (#D3D3D3 base target)
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, '#ffffff'); // Pure white zenith highlight
    grad.addColorStop(0.18, '#edf2f7'); // Crisp silver sky reflection
    grad.addColorStop(0.38, '#dce3eb'); // Polished silver upper reflection
    grad.addColorStop(0.48, '#ffffff'); // Razor-sharp horizon specular gleam
    grad.addColorStop(0.52, '#d3d3d3'); // Base silver #D3D3D3 horizon
    grad.addColorStop(0.65, '#8e99a8'); // Midtone metallic falloff
    grad.addColorStop(0.85, '#5a6575'); // Ground shadow
    grad.addColorStop(1.00, '#2e3540'); // Deep floor reflection
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Studio vertical softboxes for crisp metallic reflections & highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillRect(60, 0, 36, 256);
    ctx.fillRect(200, 0, 65, 256);
    ctx.fillRect(360, 0, 32, 256);
    ctx.fillRect(450, 0, 22, 256);

    // Horizontal metallic bevel reflection band
    const hGrad = ctx.createLinearGradient(0, 114, 0, 142);
    hGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    hGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
    hGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 114, 512, 28);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;

    const renderer = (this.el && this.el.sceneEl) ? this.el.sceneEl.renderer : (document.querySelector('a-scene') ? document.querySelector('a-scene').renderer : null);

    if (renderer) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const rt = pmrem.fromEquirectangular(texture);
        texture.dispose();
        pmrem.dispose();
        this.silverEnvMap = rt.texture;
        return this.silverEnvMap;
      } catch (e) {
        console.warn('[Outergazers] PMREM generation fallback:', e);
      }
    }

    this.silverEnvMap = texture;
    return this.silverEnvMap;
  },

  setupTextMaterialsAndHalo: function (textModel) {
    if (!textModel) return;

    const envMap = this.createProceduralSilverEnvMap();

    this.textLetterNodes = [];

    // All letters of OUTERGAZERS + GAMEJAM 2026 bottom line with authored resting positions in glTF space
    const letterConfigs = [
      { name: 'Letter_00_O', letter: 'O', start: 0.10, restX: -10.0000, restY: 1.4792, restZ: -0.8125 },
      { name: 'Letter_01_U', letter: 'U', start: 0.28, restX: -8.0000, restY: 1.4744, restZ: -0.8125 },
      { name: 'Letter_02_T', letter: 'T', start: 0.46, restX: -6.0000, restY: 1.4697, restZ: -0.8125 },
      { name: 'Letter_03_E', letter: 'E', start: 0.64, restX: -4.0000, restY: 1.4650, restZ: -0.8125 },
      { name: 'Letter_04_R', letter: 'R', start: 0.82, restX: -2.0000, restY: 1.4603, restZ: -0.8125 },
      { name: 'Letter_05_G', letter: 'G', start: 1.00, restX: 0.0000, restY: 1.4556, restZ: -0.8125 },
      { name: 'Letter_06_A', letter: 'A', start: 1.18, restX: 2.0000, restY: 1.4509, restZ: -0.8125 },
      { name: 'Letter_07_Z', letter: 'Z', start: 1.36, restX: 4.0000, restY: 1.4462, restZ: -0.8125 },
      { name: 'Letter_08_E', letter: 'E', start: 1.54, restX: 6.0000, restY: 1.4414, restZ: -0.8125 },
      { name: 'Letter_09_R', letter: 'R', start: 1.72, restX: 8.0000, restY: 1.4367, restZ: -0.8125 },
      { name: 'Letter_10_S', letter: 'S', start: 1.90, restX: 10.0000, restY: 1.4320, restZ: -0.8125 },
      { name: 'Line_GameJam_2026', letter: 'GAMEJAM 2026', start: 2.15, restX: -0.0008, restY: -1.4759, restZ: -2.0625 }
    ];

    // Traverse all meshes to apply nearest-neighbor pixel filtering and emissive luminescence
    textModel.traverse((node) => {
      if (node.isMesh && node.material) {
        const mat = node.material;
        if (mat.map) {
          mat.map.magFilter = THREE.NearestFilter;
          mat.map.minFilter = THREE.NearestFilter;
          mat.map.generateMipmaps = false;
          mat.map.needsUpdate = true;
        }
        mat.roughness = 0.40;
        mat.metalness = 0.10;
        if (envMap) {
          mat.envMap = envMap;
          mat.envMapIntensity = 0.65;
        }
        if (mat.map) {
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.38;
        }
        mat.side = THREE.FrontSide;
        mat.alphaTest = 0.05;
        mat.needsUpdate = true;
      }
    });

    letterConfigs.forEach((cfg) => {
      const node = textModel.getObjectByName(cfg.name);
      if (node && node.isMesh && node.geometry) {
        this.textLetterNodes.push({
          node: node,
          config: cfg
        });
      }
    });

    console.log('[Outergazers] Configured ' + this.textLetterNodes.length + ' title nodes with new Minecraft font & pixel art style.');
  },

  updateTextEmergencePhysics: function (dt, timer) {
    if (!this.textLetterNodes || this.textLetterNodes.length === 0) return;

    const launchY = 2.95;
    const launchZ = -11.0;
    const flightDuration = 0.75;

    for (let i = 0; i < this.textLetterNodes.length; i++) {
      const item = this.textLetterNodes[i];
      const node = item.node;
      const cfg = item.config;
      const tElapsed = timer - cfg.start;

      if (tElapsed < 0) {
        node.visible = false;
        node.scale.set(0.0001, 0.0001, 0.0001);
        node.position.set(cfg.restX * 0.15, launchY, launchZ);
        node.rotation.set(0, 0, 0);
        continue;
      }

      if (this.playedLetterWhooshSounds && !this.playedLetterWhooshSounds.has(cfg.name)) {
        this.playedLetterWhooshSounds.add(cfg.name);
        this.playLetterWhooshSound(i % 11);
      }

      node.visible = true;
      const u = Math.min(tElapsed / flightDuration, 1.0);

      if (u >= 1.0) {
        node.position.set(cfg.restX, cfg.restY, cfg.restZ);
        node.rotation.set(0, 0, 0);
        node.scale.set(1.0, 1.0, 1.0);
        if (this.playedLetterSettleSounds && !this.playedLetterSettleSounds.has(cfg.name)) {
          this.playedLetterSettleSounds.add(cfg.name);
        }
        continue;
      }

      // 1. Vertical Rise Physics (Y in model space = Up)
      let progressY;
      if (u < 0.68) {
        const p = u / 0.68;
        progressY = p * p * (3.0 - 2.0 * p);
      } else {
        const p = (u - 0.68) / 0.32;
        const bounce = Math.sin(p * Math.PI * 2.5) * Math.exp(-p * 3.8) * 0.08;
        progressY = 1.0 + bounce * (1.0 - p);
      }
      const y = launchY + (cfg.restY - launchY) * progressY;

      // 2. Lateral Fanning (X in model space)
      const launchX = cfg.restX * 0.20;
      let progressX;
      if (u < 0.28) {
        progressX = (u / 0.28) * 0.20;
      } else {
        const p = (u - 0.28) / 0.72;
        const bounceX = Math.sin(p * Math.PI * 2.0) * Math.exp(-p * 3.2) * 0.04 * Math.sign(cfg.restX);
        progressX = 0.20 + 0.80 * (1.0 - Math.pow(1.0 - p, 3)) + bounceX * (1.0 - p);
      }
      const x = launchX + (cfg.restX - launchX) * progressX;

      // 3. Dynamic Forward Emergence Arc (Z in model space = Towards viewer)
      const arc = Math.sin(u * Math.PI) * 0.40;
      const progressZ = 1.0 - Math.pow(1.0 - u, 2);
      const z = launchZ + (cfg.restZ - launchZ) * progressZ + arc;

      // 4. Controlled Rotational Tumble
      const decay = Math.exp(-u * 3.6);
      const letterFactor = cfg.restX / 10.0;
      const rotX = -Math.sin(u * Math.PI) * 0.25 * decay;
      const rotY = Math.sin(u * Math.PI * 1.5) * 0.18 * letterFactor * decay;
      const rotZ = 0;

      // 5. Scale Evolution
      let scale = 1.0;
      if (u < 0.20) {
        scale = 0.40 + (u / 0.20) * 0.60;
      } else if (u < 0.75) {
        const p = (u - 0.20) / 0.55;
        scale = 1.0 + Math.sin(p * Math.PI) * 0.06;
      } else {
        scale = 1.0;
      }

      node.position.set(x, y, z);
      node.rotation.set(rotX, rotY, rotZ);
      node.scale.set(scale, scale, scale);
    }
  },

  resetTextToRestingPose: function () {
    if (!this.textLetterNodes) return;
    for (let i = 0; i < this.textLetterNodes.length; i++) {
      const item = this.textLetterNodes[i];
      if (item && item.node) {
        item.node.visible = true;
        item.node.position.set(item.config.restX, item.config.restY, item.config.restZ);
        item.node.rotation.set(0, 0, 0);
        item.node.scale.set(1.0, 1.0, 1.0);
      }
    }
  },

  setTextVisible: function (visible) {
    if (this.models.textContainer) {
      this.models.textContainer.setAttribute('visible', visible);
      if (this.models.textContainer.object3D) {
        this.models.textContainer.object3D.visible = visible;
      }
    }
    if (this.models.textEl && this.models.textEl.object3D) {
      this.models.textEl.object3D.visible = visible;
    }
    if (this.models.text) {
      this.models.text.visible = visible;
      if (!visible) {
        this.models.text.traverse((c) => {
          if (c.isMesh) c.visible = false;
        });
      } else if (!this.isTextRevealPlaying) {
        this.models.text.traverse((c) => {
          if (c.isMesh) c.visible = true;
        });
      }
    }
  },

  revealTitleAbovePortal: function () {
    console.log('[Outergazers] Revealing OUTERGAZERS title above portal frame (one-time event).');
    this.hasTitleBeenRevealed = true;
    this.isTextRevealPlaying = false;
    this.setTextVisible(true);
    this.resetTextToRestingPose();
  },

  startTextReveal: function () {
    console.log('[Outergazers] Chest settling complete! Starting 11s OUTERGAZERS text reveal animation with portal emergence physics...');
    this.interactionState = INTERACTION_STATE.PLAYING_TEXT_REVEAL;
    this.isTextRevealPlaying = true;
    this.textRevealTimer = 0.0;
    this.hasTextRevealCompleted = false;
    if (this.playedLetterWhooshSounds) this.playedLetterWhooshSounds.clear();
    if (this.playedLetterSettleSounds) this.playedLetterSettleSounds.clear();

    this.setTextVisible(true);

    if (this.textAction && this.mixers.text) {
      this.textAction.reset();
      this.textAction.timeScale = 11.0 / 8.4; // Synchronize GLB clip with compressed 8.4s timeline (~23.6% faster)
      this.textAction.play();
    }

    // Apply t = 0 physics state immediately
    this.updateTextEmergencePhysics(0, 0.0);

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      hint.innerText = '✨ OUTERGAZERS Reveal ✨';
      hint.style.background = 'rgba(0, 229, 255, 0.95)';
    }
  },

  setGrassVisible: function (visible) {
    const grassEl = document.querySelector('#model-grass');
    if (grassEl) {
      grassEl.setAttribute('visible', visible);
      if (grassEl.object3D) grassEl.object3D.visible = visible;
    }
    if (this.models.grass) {
      this.models.grass.visible = visible;
      this.models.grass.traverse((c) => { if (c.isMesh) c.visible = visible; });
    }
  },

  setObsidianVisible: function (visible) {
    const obsidianEl = document.querySelector('#model-obsidian');
    if (obsidianEl) {
      obsidianEl.setAttribute('visible', visible);
      if (obsidianEl.object3D) obsidianEl.object3D.visible = visible;
    }
    if (this.models.obsidian) {
      this.models.obsidian.visible = visible;
      this.models.obsidian.traverse((c) => { if (c.isMesh) c.visible = visible; });
    }
  },

  setPortalVisible: function (visible) {
    const portalEl = document.querySelector('#model-portal');
    if (portalEl) {
      portalEl.setAttribute('visible', visible);
      if (portalEl.object3D) portalEl.object3D.visible = visible;
    }
    if (this.models.portalSurface) {
      this.models.portalSurface.visible = visible;
      this.models.portalSurface.traverse((c) => { if (c.isMesh) c.visible = visible; });
    }
  },

  setChestVisible: function (visible) {
    const chestEl = document.querySelector('#model-chest');
    if (chestEl) {
      chestEl.setAttribute('visible', visible);
      if (chestEl.object3D) chestEl.object3D.visible = visible;
    }
    if (this.models.chest) {
      this.models.chest.visible = visible;
      this.models.chest.traverse((c) => { if (c.isMesh) c.visible = visible; });
    }
  },

  resetAllToZeroState: function () {
    this.masterTime = 0.0;
    this.loggedPhase = 0;
    this.interactionState = INTERACTION_STATE.READY_FOR_TAP;
    this.chestOpenTimer = 0.0;
    this.explosionTimer = 0.0;
    this.postExplosionTimer = 0.0;
    this.explosionFinishedTimestamp = 0;
    this.hasTriggeredReveal = false;
    this.eventPaperTimer = 0.0;

    // Reset mixers to initial time
    this._grassSettled = false;
    this._obsidianSettled = false;
    this._portalSettled = false;
    if (this.mixers.grass) this.mixers.grass.setTime(0);
    if (this.mixers.obsidian) this.mixers.obsidian.setTime(0);
    if (this.mixers.portalSurface) this.mixers.portalSurface.setTime(0);
    if (this.mixers.chest) this.mixers.chest.setTime(0.042); // Closed lid

    // Hide portal surface, chest, explosion, paper, text
    this.setPortalVisible(false);
    this.setChestVisible(false);
    this.setTextVisible(false);
    if (this.explosionMesh) this.explosionMesh.visible = false;
    this.chestSettleTimer = 0.0;
    this.scrollEmergeTimer = 0.0;
    this.scrollReadTimer = 0.0;
    this.eventPaperTimer = 0.0;
    this.hasTriggeredReveal = false;

    if (this.eventPaperMesh) {
      this.eventPaperMesh.visible = false;
      this.eventPaperMesh.rotation.set(0, 0, 0); // STRICTLY UPRIGHT
      this.eventPaperMesh.position.copy(EVENT_PAPER_CONFIG.emergeStartPos);
      this.eventPaperMesh.scale.copy(EVENT_PAPER_CONFIG.emergeStartScale);
      if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.revealCutoff) {
        this.eventPaperMesh.material.userData.revealCutoff.value = 0.8472; // Closed scroll presentation
      }
      if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.printCutoff) {
        this.eventPaperMesh.material.userData.printCutoff.value = 1.05; // Reset to blank paper
      }
    }
    if (this.lowerRollerMesh) {
      this.lowerRollerMesh.visible = false;
      if (this.rollerStartY !== undefined) {
        this.lowerRollerMesh.position.set(0, this.rollerStartY, 0.015);
      }
    }
    const regBtn = document.querySelector('#register-btn');
    if (regBtn) {
      regBtn.style.display = 'none';
    }

    this.hasTitleBeenRevealed = false;
    this.hasTextRevealCompleted = false;
    this.isTextRevealPlaying = false;
    this.textRevealTimer = 0.0;
    if (this.textAction && this.mixers.text) {
      this.textAction.stop();
      this.mixers.text.setTime(0);
    }
    this.updateTextEmergencePhysics(0, 0.0);

    if (this.models.chestEl && this.models.chestEl.object3D) {
      this.models.chestEl.object3D.position.copy(this.chestState.startPos);
      this.models.chestEl.object3D.scale.set(1, 1, 1);
    }
    if (this.models.chest) {
      this.models.chest.scale.set(CHEST_VISUAL_SCALE, CHEST_VISUAL_SCALE, CHEST_VISUAL_SCALE);
      this.models.chest.position.y = CHEST_BOTTOM_ALIGN_Y;
      this.models.chest.rotation.y = 0;
    }

    this.chestState.isLaunched = false;
    this.chestState.isIdleJiggling = false;
    this.chestState.hasBeenTapped = false;
    this.chestState.idleTimer = 0;

    // Reset Audio State
    if (this.playedGrassSounds) this.playedGrassSounds.clear();
    if (this.playedObsidianSounds) this.playedObsidianSounds.clear();
    this.hasPortalSoundPlayed = false;
    this.hasExplosionSoundPlayed = false;
    this.hasChestSoundPlayed = false;
    this.hasChestLandSoundPlayed = false;
    if (this.playedLetterWhooshSounds) this.playedLetterWhooshSounds.clear();
    if (this.playedLetterSettleSounds) this.playedLetterSettleSounds.clear();
    this.hasTitleShimmerSoundPlayed = false;
    this.hasParchmentUnfurlSoundPlayed = false;
    this.hasParchmentSettleSoundPlayed = false;
    this.stopAllAudio();

    // Reset timeline animation frame to 0
    this.applyTimelineFrame(0.0, 0);
  },


  // =============================================================================
  // REGISTRATION BUTTON OVERLAY & INTERACTION HELPERS (Section 4)
  // =============================================================================
  setupRegisterButtonOverlay: function () {
    const regBtn = document.querySelector('#register-btn');
    if (regBtn && !regBtn.dataset.bound) {
      regBtn.dataset.bound = 'true';
      regBtn.href = EVENT_PAPER_CONFIG.registrationUrl;
      regBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('[Outergazers] Register button clicked -> ' + EVENT_PAPER_CONFIG.registrationUrl);
      });
      ['pointerdown', 'mousedown', 'touchstart', 'touchend'].forEach((evt) => {
        regBtn.addEventListener(evt, (e) => { e.stopPropagation(); }, { passive: false });
      });
    }
  },

  updateRegisterButtonOverlay: function () {
    if (!this.regBtn) {
      this.regBtn = document.querySelector('#register-btn');
      if (!this.regBtn) return;
    }

    // Visible once unroll reaches the button area (70% down), and remains active through reading, title reveal, & complete states
    const isRevealed = (this.interactionState === INTERACTION_STATE.UNFURLING_SCROLL && (this.eventPaperTimer / this.eventPaperDuration) >= 0.70) ||
                       (this.interactionState === INTERACTION_STATE.EMERGING_SCROLL && (this.eventPaperTimer / this.eventPaperDuration) >= 0.70) ||
                       (this.interactionState === INTERACTION_STATE.READING_SCROLL) ||
                       (this.interactionState === INTERACTION_STATE.PLAYING_TEXT_REVEAL) ||
                       (this.interactionState === INTERACTION_STATE.INTERACTION_COMPLETE);

    if (!isRevealed || !this.eventPaperMesh || !this.eventPaperMesh.visible || !this.isTargetTracked) {
      if (this._regBtnVisible) {
        this._regBtnVisible = false;
        this.regBtn.style.display = 'none';
      }
      return;
    }

    const sceneEl = this.sceneEl || document.querySelector('a-scene');
    if (!sceneEl || !sceneEl.camera) {
      if (this._regBtnVisible) {
        this._regBtnVisible = false;
        this.regBtn.style.display = 'none';
      }
      return;
    }

    const camera = sceneEl.camera;
    this.eventPaperMesh.updateMatrixWorld(true);

    const pw = EVENT_PAPER_CONFIG.paperWidth;
    const ph = EVENT_PAPER_CONFIG.paperHeight;
    const bf = EVENT_PAPER_CONFIG.buttonFrame;

    // Button frame bounds in local mesh space
    const xMin = (bf.xMinRel - 0.5) * pw;
    const xMax = (bf.xMaxRel - 0.5) * pw;
    const yTop = (0.5 - bf.yTopRel) * ph;
    const yBottom = (0.5 - bf.yBottomRel) * ph;

    if (!this._pTL) this._pTL = new THREE.Vector3();
    if (!this._pBR) this._pBR = new THREE.Vector3();

    this._pTL.set(xMin, yTop, 0.05).applyMatrix4(this.eventPaperMesh.matrixWorld).project(camera);
    this._pBR.set(xMax, yBottom, 0.05).applyMatrix4(this.eventPaperMesh.matrixWorld).project(camera);

    // Behind camera check
    if (this._pTL.z > 1.0 || this._pBR.z > 1.0) {
      if (this._regBtnVisible) {
        this._regBtnVisible = false;
        this.regBtn.style.display = 'none';
      }
      return;
    }

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const sx1 = (this._pTL.x * 0.5 + 0.5) * screenW;
    const sy1 = (-this._pTL.y * 0.5 + 0.5) * screenH;
    const sx2 = (this._pBR.x * 0.5 + 0.5) * screenW;
    const sy2 = (-this._pBR.y * 0.5 + 0.5) * screenH;

    const left = Math.min(sx1, sx2);
    const top = Math.min(sy1, sy2);
    const width = Math.abs(sx2 - sx1);
    const height = Math.abs(sy2 - sy1);

    if (width < 6 || height < 6 || left > screenW || top > screenH || (left + width) < 0 || (top + height) < 0) {
      if (this._regBtnVisible) {
        this._regBtnVisible = false;
        this.regBtn.style.display = 'none';
      }
      return;
    }

    // Only update styles if bounds changed by > 0.5px
    if (!this._lastRegBtnBounds ||
        Math.abs(this._lastRegBtnBounds.left - left) > 0.5 ||
        Math.abs(this._lastRegBtnBounds.top - top) > 0.5 ||
        Math.abs(this._lastRegBtnBounds.width - width) > 0.5 ||
        Math.abs(this._lastRegBtnBounds.height - height) > 0.5 ||
        !this._regBtnVisible) {
      
      this._lastRegBtnBounds = { left, top, width, height };
      this._regBtnVisible = true;
      this.regBtn.style.display = 'block';
      this.regBtn.style.left = left.toFixed(1) + 'px';
      this.regBtn.style.top = top.toFixed(1) + 'px';
      this.regBtn.style.width = width.toFixed(1) + 'px';
      this.regBtn.style.height = height.toFixed(1) + 'px';
    }
  },

  handleScrollButtonTap: function (clientX, clientY) {
    const isRevealed = (this.interactionState === INTERACTION_STATE.UNFURLING_SCROLL && (this.eventPaperTimer / this.eventPaperDuration) >= 0.70) ||
                       (this.interactionState === INTERACTION_STATE.EMERGING_SCROLL && (this.eventPaperTimer / this.eventPaperDuration) >= 0.70) ||
                       (this.interactionState === INTERACTION_STATE.READING_SCROLL) ||
                       (this.interactionState === INTERACTION_STATE.PLAYING_TEXT_REVEAL) ||
                       (this.interactionState === INTERACTION_STATE.INTERACTION_COMPLETE);
    if (!isRevealed) {
      return false;
    }
    if (!this.eventPaperMesh || !this.eventPaperMesh.visible || !this.isTargetTracked) return false;

    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl || !sceneEl.camera) return false;
    const canvas = sceneEl.canvas || document.body;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, sceneEl.camera);
    const hits = raycaster.intersectObject(this.eventPaperMesh, false);
    if (hits.length > 0 && hits[0].uv) {
      const u = hits[0].uv.x;
      const v = hits[0].uv.y;
      const bf = EVENT_PAPER_CONFIG.buttonFrame;
      const vMin = 1.0 - bf.yBottomRel; // 0.2686
      const vMax = 1.0 - bf.yTopRel;    // 0.3705
      if (u >= bf.xMinRel && u <= bf.xMaxRel && v >= vMin && v <= vMax) {
        console.log('[Outergazers] 3D Raycast hit REGISTER NOW button! Opening ' + EVENT_PAPER_CONFIG.registrationUrl);
        window.open(EVENT_PAPER_CONFIG.registrationUrl, '_blank', 'noopener,noreferrer');
        return true;
      }
    }
    return false;
  },

  replayExperience: function () {
    console.log('[Outergazers] Replay button tapped! Resetting and restarting complete AR experience from beginning.');
    this.resetAllToZeroState();
    if (this.isTargetTracked) {
      this.startSequenceFromBeginning();
    } else {
      this.sequenceState = SEQUENCE_STATE.READY;
      this.isTimelineActive = false;
      this.isSequenceCompleted = false;
      this.pendingStartOnReady = false;
      this.setExperienceVisible(false);
      const hint = document.querySelector('#tracking-hint');
      if (hint) {
        hint.innerText = 'Point camera at the printed poster';
        hint.style.background = 'rgba(15, 23, 42, 0.85)';
      }
    }
  },

  startSequenceFromBeginning: function () {
    console.log('[Outergazers DIAGNOSTIC] startSequenceFromBeginning() called. State: READY -> PLAYING');
    this.resetAllToZeroState();
    this.sequenceState = SEQUENCE_STATE.PLAYING;
    this.isTimelineActive = true;
    this.isSequenceCompleted = false;
    this.pendingStartOnReady = false;

    this.setExperienceVisible(true);
    this.setGrassVisible(true);
    this.setObsidianVisible(true);

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      hint.innerText = 'Poster Detected - Spawning Grass Platform';
      hint.style.background = 'rgba(34, 197, 94, 0.85)';
    }
  },

  resumeSequence: function () {
    console.log('[Outergazers DIAGNOSTIC] resumeSequence() called. State: PAUSED -> PLAYING at t =', this.masterTime);
    this.sequenceState = SEQUENCE_STATE.PLAYING;
    this.isTimelineActive = true;
    this.setExperienceVisible(true);

    this.applyTimelineFrame(this.masterTime, 0);

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      if (this.masterTime < TIMELINE.OBSIDIAN_START) {
        hint.innerText = 'Poster Detected - Spawning Grass Platform';
        hint.style.background = 'rgba(34, 197, 94, 0.85)';
      } else if (this.masterTime < TIMELINE.PORTAL_ACTIVATE_START) {
        hint.innerText = 'Grass Complete - Constructing Portal';
        hint.style.background = 'rgba(168, 85, 247, 0.85)';
      } else if (this.masterTime < TIMELINE.CHEST_REVEAL) {
        hint.innerText = 'Portal Frame Built - Activating Energy';
        hint.style.background = 'rgba(192, 38, 211, 0.85)';
      } else {
        hint.innerText = 'Chest Emerging From Portal!';
        hint.style.background = 'rgba(59, 130, 246, 0.85)';
      }
    }
  },

  showCompletedScene: function () {
    console.log('[Outergazers DIAGNOSTIC] showCompletedScene() called.');
    this.sequenceState = SEQUENCE_STATE.COMPLETED;
    this.isTimelineActive = false;
    this.masterTime = this.totalDuration;
    this.setExperienceVisible(true);

    // TASK 15: AR World (Grass, Obsidian, Portal, Chest) is ALWAYS kept visible!
    if (this.mixers.grass) {
      this.mixers.grass.setTime(TIMELINE.GRASS_SPAWN_FINISH);
      this._grassSettled = true;
    }
    if (this.mixers.obsidian) {
      this.mixers.obsidian.setTime(TIMELINE.OBSIDIAN_FINISH);
      this._obsidianSettled = true;
    }
    if (this.mixers.portalSurface) {
      this.mixers.portalSurface.setTime(TIMELINE.PORTAL_ACTIVATE_FINISH);
      this._portalSettled = true;
    }

    this.setGrassVisible(true);
    this.setObsidianVisible(true);
    this.setPortalVisible(true);
    this.setChestVisible(true);

    // Ensure text reveal state is properly restored on target found
    if (this.hasTextRevealCompleted) {
      this.setTextVisible(true);
      this.resetTextToRestingPose();
    } else if (this.isTextRevealPlaying) {
      this.setTextVisible(true);
      this.updateTextEmergencePhysics(0, this.textRevealTimer);
    } else {
      this.setTextVisible(false);
    }

    if (this.models.chestEl && this.models.chestEl.object3D) {
      this.models.chestEl.object3D.position.copy(this.chestState.settlePos);
      this.models.chestEl.object3D.scale.set(1, 1, 1);
    }
    if (this.models.chest) {
      this.models.chest.scale.set(CHEST_VISUAL_SCALE, CHEST_VISUAL_SCALE, CHEST_VISUAL_SCALE);
      this.models.chest.position.y = CHEST_BOTTOM_ALIGN_Y;
    }

    if (this.interactionState === INTERACTION_STATE.INTERACTION_COMPLETE) {
      if (this.mixers.chest) this.mixers.chest.setTime(1.250);
      if (this.explosionMesh) this.explosionMesh.visible = false;
      this.setTextVisible(false);
      this.setChestVisible(false);
      if (this.eventPaperMesh) {
        this.eventPaperMesh.visible = true;
        this.eventPaperMesh.rotation.set(0, 0, 0); // STRICTLY UPRIGHT
        this.eventPaperMesh.position.copy(EVENT_PAPER_CONFIG.restPos);
        this.eventPaperMesh.scale.copy(EVENT_PAPER_CONFIG.restScale);
        if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.revealCutoff) {
          this.eventPaperMesh.material.userData.revealCutoff.value = 0.0000;
        }
        if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.printCutoff) {
          this.eventPaperMesh.material.userData.printCutoff.value = 0.0000;
        }
      }
      if (this.lowerRollerMesh) {
        this.lowerRollerMesh.visible = true;
        this.lowerRollerMesh.position.set(0, this.rollerEndY, 0.015);
      }
    } else if (this.interactionState === INTERACTION_STATE.UNFURLING_SCROLL ||
               this.interactionState === INTERACTION_STATE.EMERGING_SCROLL) {
      if (this.mixers.chest) this.mixers.chest.setTime(1.250);
      if (this.explosionMesh) this.explosionMesh.visible = (this.explosionTimer < this.explosionDuration);
    } else if (this.interactionState === INTERACTION_STATE.PLAYING_TEXT_REVEAL) {
      this.setTextVisible(true);
      this.setChestVisible(true);
      if (this.eventPaperMesh) this.eventPaperMesh.visible = false;
    } else if (this.interactionState === INTERACTION_STATE.PLAYING_EXPLOSION) {
      if (this.mixers.chest) this.mixers.chest.setTime(1.250);
      if (this.eventPaperMesh) this.eventPaperMesh.visible = false;
      if (this.explosionMesh) {
        this.explosionMesh.visible = true;
        this.updateBillboard(this.explosionMesh);
      }
    } else if (this.interactionState === INTERACTION_STATE.OPENING_CHEST) {
      if (this.explosionMesh) this.explosionMesh.visible = false;
      if (this.eventPaperMesh) this.eventPaperMesh.visible = false;
    } else {
      if (this.mixers.chest) this.mixers.chest.setTime(0.042);
      this.chestState.isIdleJiggling = true;
      if (this.explosionMesh) this.explosionMesh.visible = false;
      if (this.eventPaperMesh) this.eventPaperMesh.visible = false;
    }

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      if (this.interactionState === INTERACTION_STATE.INTERACTION_COMPLETE) {
        hint.innerText = 'Event Details Revealed! 🎉';
        hint.style.background = 'rgba(34, 197, 94, 0.95)';
      } else if (this.interactionState === INTERACTION_STATE.REVEALING_EVENT) {
        hint.innerText = 'Revealing Event Details... 📜';
        hint.style.background = 'rgba(168, 85, 247, 0.95)';
      } else if (this.interactionState === INTERACTION_STATE.PLAYING_EXPLOSION) {
        hint.innerText = 'BOOM! Creeper Explosion!';
        hint.style.background = 'rgba(239, 68, 68, 0.95)';
      } else if (this.interactionState === INTERACTION_STATE.OPENING_CHEST) {
        hint.innerText = 'Opening Ender Chest...';
        hint.style.background = 'rgba(168, 85, 247, 0.95)';
      } else if (this.interactionState === INTERACTION_STATE.PLAYING_TEXT_REVEAL) {
        hint.innerText = '✨ OUTERGAZERS Reveal ✨';
        hint.style.background = 'rgba(168, 85, 247, 0.95)';
      } else {
        hint.innerText = 'Tap the Chest to Open! (👆)';
        hint.style.background = 'rgba(218, 165, 32, 0.95)';
      }
    }
  },
  onTargetFound: function () {
    console.log('[Outergazers DIAGNOSTIC] targetFound event fired. State:', this.sequenceState);
    this.isTargetTracked = true;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
    }

    if (!this.isReady) {
      this.pendingStartOnReady = true;
      return;
    }

    switch (this.sequenceState) {
      case SEQUENCE_STATE.READY:
        this.startSequenceFromBeginning();
        break;
      case SEQUENCE_STATE.PAUSED:
        this.resumeSequence();
        break;
      case SEQUENCE_STATE.COMPLETED:
        this.showCompletedScene();
        break;
      case SEQUENCE_STATE.PLAYING:
        this.setExperienceVisible(true);
        break;
    }
  },

  onTargetLost: function () {
    console.log('[Outergazers DIAGNOSTIC] targetLost event fired. State:', this.sequenceState);
    this.isTargetTracked = false;
    this.setExperienceVisible(false);
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
    }

    const hint = document.querySelector('#tracking-hint');
    if (hint) {
      hint.innerText = 'Point camera at the printed poster';
      hint.style.background = 'rgba(15, 23, 42, 0.85)';
    }

    switch (this.sequenceState) {
      case SEQUENCE_STATE.PLAYING:
        this.sequenceState = SEQUENCE_STATE.PAUSED;
        this.isTimelineActive = false;
        break;
      case SEQUENCE_STATE.COMPLETED:
        break;
      case SEQUENCE_STATE.READY:
        this.pendingStartOnReady = false;
        break;
    }
  },

  tick: function (time, timeDelta) {
    const dt = Math.min((timeDelta || 16.66) / 1000.0, 0.1);

    if (this.portalMaterial && this.portalMaterial.uniforms) {
      this.portalMaterial.uniforms.uTime.value = time * 0.001;
    }

    if (!this.isTargetTracked) return;

    if (this.sequenceState === SEQUENCE_STATE.PLAYING) {
      this.masterTime += dt;
      if (this.masterTime >= this.totalDuration) {
        this.masterTime = this.totalDuration;
        this.sequenceState = SEQUENCE_STATE.COMPLETED;
        this.isTimelineActive = false;
        this.isSequenceCompleted = true;
        console.log('[Outergazers] Chest landing complete at t =', this.masterTime, '- Triggering OUTERGAZERS title animation from portal!');

        // REQUIRED STEP 3: Only AFTER the chest lands, trigger the OUTERGAZERS title animation!
        this.interactionState = INTERACTION_STATE.PLAYING_TEXT_REVEAL;
        this.startTextReveal();
      }

      this.applyTimelineFrame(this.masterTime, dt);
    } else if (this.sequenceState === SEQUENCE_STATE.COMPLETED) {
      const currentFrame = Math.floor(this.masterTime * this.masterFPS) + 1;

      // STEP 3: Update letter-by-letter emergence physics until complete
      if (this.isTextRevealPlaying) {
        if (this.mixers.text) {
          this.mixers.text.update(dt);
        }
        this.textRevealTimer += dt;
        this.updateTextEmergencePhysics(dt, this.textRevealTimer);

        if (this.textRevealTimer >= this.textRevealDuration) {
          this.isTextRevealPlaying = false;
          this.hasTextRevealCompleted = true;
          this.resetTextToRestingPose();
          this.setTextVisible(true);
          console.log('[Outergazers] Title reveal complete! Leaving chest CLOSED and idle, waiting strictly for user tap.');

          if (!this.hasTitleShimmerSoundPlayed) {
            this.hasTitleShimmerSoundPlayed = true;
            this.playTitleShimmerSound();
          }

          // Leave chest CLOSED and idle indefinitely! NO timer opening!
          this.interactionState = INTERACTION_STATE.READY_FOR_TAP;
          this.chestState.hasBeenTapped = false;
          this.chestState.isIdleJiggling = true;
          if (this.mixers.chest) {
            this.mixers.chest.setTime(0.042); // Strictly closed lid
          }

          const hint = document.querySelector('#tracking-hint');
          if (hint) {
            hint.innerText = 'Tap the Chest to Open! 📦';
            hint.style.background = 'rgba(218, 165, 32, 0.95)';
          }
        }
      }

      switch (this.interactionState) {
        case INTERACTION_STATE.PLAYING_TEXT_REVEAL:
          // Chest rests settled on the grass at settlePos; title letters emerging from portal
          break;

        case INTERACTION_STATE.READY_FOR_TAP:
          // Chest remains CLOSED and idle, waiting indefinitely for user tap
          if (this.mixers.chest) {
            this.mixers.chest.setTime(0.042);
          }
          this.updateChest(currentFrame, dt, this.masterTime);
          break;

        case INTERACTION_STATE.OPENING_CHEST:
          // REQUIRED STEP 4: Chest lid opens in 0.45s
          this.chestOpenTimer += dt;
          const openProgress = Math.min(this.chestOpenTimer / this.chestOpenDuration, 1.0);
          const clipTime = 0.042 + openProgress * (1.250 - 0.042);
          if (this.mixers.chest) {
            this.mixers.chest.setTime(clipTime);
          }
          if (this.chestOpenTimer >= this.chestOpenDuration) {
            console.log('[Outergazers] Chest opened! Triggering Creeper explosion.');
            if (this.mixers.chest) {
              this.mixers.chest.setTime(1.250);
            }
            // REQUIRED STEP 5: Play the chest explosion!
            this.triggerExplosion();
          }
          break;

        case INTERACTION_STATE.PLAYING_EXPLOSION:
          // Immediately after explosion event begins, trigger synchronized scroll emergence
          this.explosionTimer += dt;
          if (this.updateFireflies) {
            this.updateFireflies(dt, this.explosionTimer, this.explosionDuration);
          }
          if (this.explosionMesh) {
            this.updateBillboard(this.explosionMesh);
          }
          if (!this.hasTriggeredReveal) {
            this.hasTriggeredReveal = true;
            console.log('[Outergazers] Explosion started! Immediately triggering synchronized scroll emergence from chest.');
            this.triggerScrollEmergence();
          }
          break;

        case INTERACTION_STATE.EMERGING_SCROLL:
          // Rolled scroll visibly emerges from chest opening and unfurls concurrently while emerging!
          this.scrollEmergeTimer += dt;
          const emNorm = Math.min(this.scrollEmergeTimer / this.scrollEmergeDuration, 1.0);
          const emEase = 1.0 - Math.pow(1.0 - emNorm, 3.0); // Smooth cubic ease-out

          // Keep AR background (chest & title) visible while small scroll emerges
          this.setChestVisible(true);
          if (this.hasTitleBeenRevealed) {
            this.setTextVisible(true);
          }

          // Continue animating Creeper explosion spritesheet & fireflies concurrently during scroll emergence
          if (this.explosionTimer < this.explosionDuration) {
            this.explosionTimer += dt;
            const expProgress = Math.min(this.explosionTimer / this.explosionDuration, 1.0);
            const frameIndex = Math.min(Math.floor(expProgress * 60) + 1, 60);
            const col = frameIndex % 8;
            const row = Math.floor(frameIndex / 8);
            if (this.explosionTexture) {
              this.explosionTexture.offset.x = col / 8.0;
              this.explosionTexture.offset.y = (7 - row) / 8.0;
            }
            if (this.explosionPlaneMat) {
              this.explosionPlaneMat.opacity = expProgress > 0.60 ? Math.max(0.0, (1.0 - expProgress) / 0.40) : 1.0;
            }
            if (this.updateFireflies) {
              this.updateFireflies(dt, this.explosionTimer, this.explosionDuration);
            }
            if (this.explosionMesh) {
              this.updateBillboard(this.explosionMesh);
            }
            if (this.explosionTimer >= this.explosionDuration && this.explosionMesh) {
              this.explosionMesh.visible = false;
            }
          }

          // Emergence handles position and scale progression:
          if (this.eventPaperMesh) {
            this.eventPaperMesh.visible = true;
            this.eventPaperMesh.rotation.set(0, 0, 0); // Strictly upright in AR space
            this.eventPaperMesh.position.lerpVectors(
              EVENT_PAPER_CONFIG.emergeStartPos,
              EVENT_PAPER_CONFIG.restPos,
              emEase
            );
            const startS = EVENT_PAPER_CONFIG.emergeStartScale.x;
            const restS = EVENT_PAPER_CONFIG.restScale.x;
            const emScale = startS + (restS - startS) * emEase;
            this.eventPaperMesh.scale.set(emScale, emScale, emScale);
          }

          // Start unfurling while emerging (begins at t >= 0.15s into emergence)
          if (this.scrollEmergeTimer >= 0.15) {
            if (!this.hasParchmentUnfurlSoundPlayed) {
              this.hasParchmentUnfurlSoundPlayed = true;
              this.playParchmentUnfurlSound();
            }

            this.eventPaperTimer += dt;
            const unfurlNorm = Math.min(this.eventPaperTimer / this.eventPaperDuration, 1.0);
            const unfurlEase = 1.0 - Math.pow(1.0 - unfurlNorm, 3.0);
            const cutoff = 0.8472 * (1.0 - unfurlEase);

            const printProgress = Math.max(0.0, (unfurlNorm - 0.05) / 0.95);
            const printEase = 1.0 - Math.pow(1.0 - printProgress, 3.0);
            const printCutoff = 1.05 * (1.0 - printEase);

            if (this.eventPaperMesh) {
              if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.revealCutoff) {
                this.eventPaperMesh.material.userData.revealCutoff.value = cutoff;
              }
              if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.printCutoff) {
                this.eventPaperMesh.material.userData.printCutoff.value = printCutoff;
              }
            }
            if (this.lowerRollerMesh) {
              this.lowerRollerMesh.visible = true;
              const curRollerY = this.rollerStartY + (this.rollerEndY - this.rollerStartY) * unfurlEase;
              this.lowerRollerMesh.position.set(0, curRollerY, 0.015);
            }

            if (unfurlNorm >= 0.40) {
              this.setTextVisible(false);
              this.setChestVisible(false);
            }

            this.updateRegisterButtonOverlay();
          }

          // Complete both emergence and unfurl cleanly
          if (this.scrollEmergeTimer >= this.scrollEmergeDuration && this.eventPaperTimer >= this.eventPaperDuration) {
            if (this.explosionMesh) {
              this.explosionMesh.visible = false;
            }
            if (!this.hasParchmentSettleSoundPlayed) {
              this.hasParchmentSettleSoundPlayed = true;
              this.playParchmentSettleSound();
            }
            console.log('[Outergazers] Scroll fully unrolled and poster artwork 100% printed in foreground!');
            this.interactionState = INTERACTION_STATE.INTERACTION_COMPLETE;

            if (this.eventPaperMesh) {
              this.eventPaperMesh.position.copy(EVENT_PAPER_CONFIG.restPos);
              this.eventPaperMesh.scale.copy(EVENT_PAPER_CONFIG.restScale);
              if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.revealCutoff) {
                this.eventPaperMesh.material.userData.revealCutoff.value = 0.0000;
              }
              if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.printCutoff) {
                this.eventPaperMesh.material.userData.printCutoff.value = 0.0000;
              }
            }
            if (this.lowerRollerMesh) {
              this.lowerRollerMesh.visible = false;
            }

            this.setTextVisible(false);
            this.setChestVisible(false);

            const hint = document.querySelector('#tracking-hint');
            if (hint) {
              hint.innerText = 'Tap REGISTER NOW To Join! 🎯';
              hint.style.background = 'rgba(220, 38, 38, 0.95)';
            }
            this.updateRegisterButtonOverlay();
          }
          break;

        case INTERACTION_STATE.UNFURLING_SCROLL:
          // Handled in coordinated emergence & unfurl
          break;

        case INTERACTION_STATE.INTERACTION_COMPLETE:
          // REQUIRED STEP 8: Hold scroll in foreground with fully printed poster, readable indefinitely
          this.setTextVisible(false);
          this.setChestVisible(false);
          if (this.explosionMesh) {
            this.explosionMesh.visible = false;
          }
          if (this.eventPaperMesh && this.eventPaperMesh.visible) {
            this.eventPaperMesh.rotation.set(0, 0, 0); // Strictly upright
            this.eventPaperMesh.position.copy(EVENT_PAPER_CONFIG.restPos);
            this.eventPaperMesh.scale.copy(EVENT_PAPER_CONFIG.restScale);
            if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.revealCutoff) {
              this.eventPaperMesh.material.userData.revealCutoff.value = 0.0000;
            }
            if (this.eventPaperMesh.material && this.eventPaperMesh.material.userData.printCutoff) {
              this.eventPaperMesh.material.userData.printCutoff.value = 0.0000;
            }
            if (this.lowerRollerMesh) {
              this.lowerRollerMesh.visible = false;
            }
          }
          this.updateRegisterButtonOverlay();
          break;
      }
    }
  },

  applyTimelineFrame: function (t, dt) {
    const currentFrame = Math.floor(t * this.masterFPS) + 1;

    // -------------------------------------------------------------
    // PHASE 1: Grass Platform Spawning (0.000s <= t < 4.167s / Frame 100)
    // -------------------------------------------------------------
    if (t < TIMELINE.OBSIDIAN_START) {
      if (this.loggedPhase < 1) {
        this.loggedPhase = 1;
        console.log('[Outergazers DIAGNOSTIC] Starting PHASE 1: Grass Platform Spawning');
      }
      if (this.mixers.grass) {
        this.mixers.grass.setTime(t);
      }
      if (this.mixers.obsidian) {
        this.mixers.obsidian.setTime(0);
      }
      this.setPortalVisible(false);
      this.setChestVisible(false);

      // Trigger Grass block sound effects synchronized to actual block spawn events
      if (this.sequenceState === SEQUENCE_STATE.PLAYING && this.playedGrassSounds) {
        let grassWaveIndex = 0;
        for (let i = 0; i < GRASS_BLOCK_SPAWNS.length; i++) {
          const b = GRASS_BLOCK_SPAWNS[i];
          if (t >= b.time && !this.playedGrassSounds.has(b.id)) {
            this.playedGrassSounds.add(b.id);
            this.playGrassBlockSound(b, grassWaveIndex++);
          }
        }
      }
    } else {
      if (this.mixers.grass && !this._grassSettled) {
        this.mixers.grass.setTime(TIMELINE.GRASS_SPAWN_FINISH);
        this._grassSettled = true;
      }
    }

    // -------------------------------------------------------------
    // PHASE 2: Obsidian Portal Construction (4.167s <= t < 8.667s)
    // Evaluates GLB clip directly at absolute master time t!
    // Blocks construct one by one in approved order: 11 -> 13 -> 14 -> 12 -> 09,10 -> 07,08 -> 05,06 -> 01 -> 02 -> 03 -> 04!
    // -------------------------------------------------------------
    if (t >= TIMELINE.OBSIDIAN_START && t < TIMELINE.PORTAL_ACTIVATE_START) {
      // Trigger Obsidian block placement sounds synchronized to actual docking events
      if (this.sequenceState === SEQUENCE_STATE.PLAYING && this.playedObsidianSounds) {
        let obsWaveIndex = 0;
        for (let i = 0; i < OBSIDIAN_BLOCK_SPAWNS.length; i++) {
          const b = OBSIDIAN_BLOCK_SPAWNS[i];
          if (t >= b.time && !this.playedObsidianSounds.has(b.id)) {
            this.playedObsidianSounds.add(b.id);
            this.playObsidianBlockSound(b, obsWaveIndex++);
          }
        }
      }
      if (this.loggedPhase < 2) {
        this.loggedPhase = 2;
        console.log('[Outergazers DIAGNOSTIC] Starting PHASE 2: Obsidian Sequential Construction');
      }
      if (this.mixers.obsidian) {
        if (t <= TIMELINE.OBSIDIAN_FINISH) {
          this.mixers.obsidian.setTime(t);
        } else if (!this._obsidianSettled) {
          // Final block Obsidian_04 docked at 8.042s; frame complete and locked!
          this.mixers.obsidian.setTime(TIMELINE.OBSIDIAN_FINISH);
          this._obsidianSettled = true;
        }
      }
      this.setPortalVisible(false);
      this.setChestVisible(false);

      if (t > 4.2 && t < 4.4) {
        this.updateTrackingHintText('Grass Complete - Constructing Portal', 'rgba(168, 85, 247, 0.85)');
      } else if (t >= TIMELINE.OBSIDIAN_FINISH && t < TIMELINE.PORTAL_ACTIVATE_START) {
        this.updateTrackingHintText('Portal Frame Complete!', 'rgba(168, 85, 247, 0.85)');
      }
    } else if (t >= TIMELINE.PORTAL_ACTIVATE_START) {
      if (this.mixers.obsidian && !this._obsidianSettled) {
        this.mixers.obsidian.setTime(TIMELINE.OBSIDIAN_FINISH);
        this._obsidianSettled = true;
      }
    }

    // -------------------------------------------------------------
    // PHASE 3: Portal Surface Activation (8.667s <= t < 10.333s)
    // Activates strictly after obsidian frame construction is complete!
    // Portal energy emerges (8.667s - 9.042s) then remains visibly active and swirling for ~1.46s!
    // -------------------------------------------------------------
    if (t >= TIMELINE.PORTAL_ACTIVATE_START && t < TIMELINE.CHEST_REVEAL) {
      if (this.loggedPhase < 3) {
        this.loggedPhase = 3;
        console.log('[Outergazers DIAGNOSTIC] Starting PHASE 3: Portal Surface Activation & Visible Energy Swirl');
      }

      // Trigger Portal Activation sound effect once when portal energy begins emerging
      if (this.sequenceState === SEQUENCE_STATE.PLAYING && !this.hasPortalSoundPlayed) {
        this.hasPortalSoundPlayed = true;
        this.playPortalActivationSound();
      }
      this.setPortalVisible(true);
      if (this.mixers.portalSurface) {
        if (t <= TIMELINE.PORTAL_ACTIVATE_FINISH) {
          this.mixers.portalSurface.setTime(t);
        } else if (!this._portalSettled) {
          // Locked at full expansion while shader swirl continues
          this.mixers.portalSurface.setTime(TIMELINE.PORTAL_ACTIVATE_FINISH);
          this._portalSettled = true;
        }
      }
      this.setChestVisible(false);

      if (t > 8.7 && t < 9.1) {
        this.updateTrackingHintText('Portal Frame Built - Activating Energy', 'rgba(192, 38, 211, 0.85)');
      } else if (t >= 9.1 && t < TIMELINE.CHEST_REVEAL) {
        this.updateTrackingHintText('Nether Portal Active!', 'rgba(192, 38, 211, 0.85)');
      }
    } else if (t >= TIMELINE.CHEST_REVEAL) {
      this.setPortalVisible(true);
      if (this.mixers.portalSurface && !this._portalSettled) {
        this.mixers.portalSurface.setTime(TIMELINE.PORTAL_ACTIVATE_FINISH);
        this._portalSettled = true;
      }
    }

    // -------------------------------------------------------------
    // PHASE 4: Ender Chest Emergence & Trajectory (t >= 10.333s)
    // -------------------------------------------------------------
    this.updateChest(currentFrame, dt);
  },

  updateChest: function (frame, dt, t) {
    if (!this.models.chest || !this.models.chestEl) return;

    const chestObj = this.models.chestEl.object3D;
    const s = this.chestState;

    // Continuous time parameters (matches 24 fps keyframes exactly, interpolates smoothly at 60/120 Hz)
    const tReveal = TIMELINE.CHEST_REVEAL; // 10.333s
    const tLaunch = TIMELINE.CHEST_LAUNCH; // 10.500s
    const tImpact = TIMELINE.CHEST_IMPACT; // 11.500s
    const tSettle = TIMELINE.CHEST_SETTLE; // 11.833s
    const curT = t !== undefined ? t : (frame - 1) / this.masterFPS;

    // Trigger chest landing impact sound exactly when chest hits the grass platform (t >= 11.500s)
    if (curT >= tImpact && !this.hasChestLandSoundPlayed) {
      this.hasChestLandSoundPlayed = true;
      this.playChestLandSound();
    }

    if (curT < tReveal) {
      this.setChestVisible(false);
      chestObj.position.copy(s.startPos);
      chestObj.scale.set(1, 1, 1);
    } else if (curT >= tReveal && curT < tLaunch) {
      if (this.loggedPhase < 4) {
        this.loggedPhase = 4;
        console.log('[Outergazers DIAGNOSTIC] Starting PHASE 4: Chest Emergence at Portal');
      }
      this.setChestVisible(true);
      chestObj.position.copy(s.startPos);
      chestObj.scale.set(1, 1, 1);
      this.updateTrackingHintText('Chest Emerging From Portal!', 'rgba(59, 130, 246, 0.85)');
    } else if (curT >= tLaunch && curT <= tImpact) {
      this.setChestVisible(true);
      const progress = Math.min(Math.max((curT - tLaunch) / (tImpact - tLaunch), 0.0), 1.0);
      if (!this._chestBasePos) this._chestBasePos = new THREE.Vector3();
      this._chestBasePos.lerpVectors(s.startPos, s.endPos, progress);
      const arc = s.arcHeight * 4.0 * progress * (1.0 - progress);
      this._chestBasePos.y += arc;
      chestObj.position.copy(this._chestBasePos);
      chestObj.scale.set(1, 1, 1);
    } else if (curT > tImpact && curT <= tImpact + (2.0 / 24.0)) {
      this.setChestVisible(true);
      const progress = Math.min((curT - tImpact) / (2.0 / 24.0), 1.0);
      chestObj.position.copy(s.endPos);
      chestObj.scale.lerpVectors(s.baseScale, s.squashScale, progress);
    } else if (curT > tImpact + (2.0 / 24.0) && curT <= tImpact + (4.0 / 24.0)) {
      this.setChestVisible(true);
      const progress = Math.min((curT - (tImpact + (2.0 / 24.0))) / (2.0 / 24.0), 1.0);
      chestObj.position.copy(s.endPos);
      chestObj.scale.lerpVectors(s.squashScale, s.baseScale, progress);
    } else if (curT > tImpact + (4.0 / 24.0) && curT <= tSettle) {
      this.setChestVisible(true);
      const progress = Math.min((curT - (tImpact + (4.0 / 24.0))) / (tSettle - (tImpact + (4.0 / 24.0))), 1.0);
      chestObj.position.lerpVectors(s.endPos, s.settlePos, progress);
      chestObj.scale.set(1, 1, 1);
    } else if (curT > tSettle) {
      this.setChestVisible(true);
      chestObj.position.copy(s.settlePos);
      chestObj.scale.set(1, 1, 1);
    }

    // Idle jiggle is active only after chest settles and before user taps
    if (curT >= tSettle && !s.hasBeenTapped && this.interactionState === INTERACTION_STATE.READY_FOR_TAP) {
      s.isIdleJiggling = true;
    }

    if (s.isIdleJiggling && !s.hasBeenTapped) {
      s.idleTimer += dt;
      const cycleTime = s.idleTimer % s.idlePeriod;

      if (cycleTime < s.idleBurstDuration) {
        const progress = cycleTime / s.idleBurstDuration;
        const envelope = Math.sin(progress * Math.PI);
        const angle = Math.sin(progress * Math.PI * (s.shakesPerBurst * 2.0)) * s.idleAmplitude * envelope;
        this.models.chest.rotation.y = angle;
      } else {
        this.models.chest.rotation.y = 0;
      }
    }
  }
});
