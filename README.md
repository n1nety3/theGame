# The Game - Planetary Grid Architecture

An online planetary grid strategy game built from the ground up.

## 🪐 Game Hierarchy & Core Logic

| Level | Structure | Total Sub-units | Wireframe Border & Fill | Description |
|---|---|---|---|---|
| **Planet** | Sphere | 100+ Zones (~108,000 Plots) | **Core Yellow Border** (`#ffe600`), Dark Cosmic Void (`#050814`) | 3D wireframe spherical world rotating in space with hundreds of distributed zones. |
| **Zone** | 3 x 3 Blocks | 9 Blocks (900 Plots) | **Neon Violet Border** (`#a855f7`, 3px), Deep Indigo Fill (`#1a0f30`) | Regional sector container containing 9 blocks. |
| **Block** | 10 x 10 Plots | 100 Plots | **Golden Amber Border** (`#f59e0b`, 2px), Dark Navy Fill (`#0c1c38`) | Chessboard / Sudoku-style 10x10 matrix of squares with row/col coordinates (0..9). |
| **Plot** | 1 x 1 Square | Atomic Unit | Custom state border & fill | The fundamental building block where functions are defined. |

### Plot Functions & Manipulability States
- 🔒 **System Defined & Locked**: Crimson border (`#ef4444`) & deep red fill (`#3e0b0b`). Non-manipulable by users.
- ⚙️ **System Defined & Open**: Bright orange border (`#f97316`) & rust fill (`#3b1704`). User can modify parameters.
- ⚡ **User Defined & Active**: Neon emerald border (`#10b981`) & forest fill (`#06402b`). Active user function.
- 🛡️ **User Defined & Fortified**: Cyan border (`#06b6d4`) & deep teal fill (`#072e3d`). User-locked function.
- · **Empty Plot**: Slate dashed border (`#334155`) & blueprint slate fill (`#0f172a`). Available for development.

### 🎮 Unified 3D Planetary Working Ground & Controls
- **Continuous 3D Spherical Ground**: The whole planet is completely covered with 120 contiguous zones (10 latitude rows x 12 longitude columns) tessellating the globe with zero gaps, hosting ~108,000 plots.
- **Smooth Zoom Continuum**:
  - **Zoom In (Zone / Surface Mode)**: Camera smoothly descends to the active block (e.g. `Block [1,1]`), with neighboring blocks and adjacent zones curving away over the spherical horizon.
  - **Zoom Out (Orbit Void)**: Camera smoothly pulls back into deep space, revealing all 120 zones covering the globe against the dark cosmic void (`#050814`) with 2,800 twinkling stars and atmospheric rim glow.
  - **No Abrupt Swaps**: Single unified WebGL render loop with damped spherical lerping.
- **Controls & Keybindings**:
  - `A, S, W, D` & `Arrow Keys` (Left, Down, Up, Right): Move around the planet across zones and blocks (hold `Shift` for turbo speed).
  - `Mouse Scroll Wheel`: Seamless smooth zoom in and zoom out between Orbit and Zone view.
  - `Mouse Left Click + Drag`: Minimal dragging of the planet surface, **only draggable when in Zone View** (dragging is disabled in Orbit View to prevent erratic spinning).
  - `Mouse Right Click`: Smoothly exit Zone View back to Orbit View (or recenter orientation).
  - `Mouse Left Click`: Cycle plot state in Zone View, or enter/warp to zone in Orbit View.
  - `Double Click / Recenter Button [R]`: Instantly re-align to primary Block `[1,1]`.

---

## 🔷 Alternative Architecture: Geodesic Hexagonal Grid

In this alternative version, **Zones, Blocks, and Plots are regular hexagons** rather than square/rectangular latitude-longitude patches.

### Why Hexagons on a Sphere?
- **Zero Polar Pinching**: Standard latitude-longitude square grids suffer from severe polar compression (squares shrink by over 80% at high latitudes and collapse to a point at the poles). A geodesic **Goldberg Polyhedron** (dual of a subdivided icosahedron) distributes cells isotropically across the entire sphere with **±3.8% equal-area uniformity**!
- **Equidistant Neighbors**: Every hexagonal plot has 6 equidistant orthogonal neighbors ($d = 1.0$), eliminating diagonal distance disparities found in squares ($\sqrt{2} \approx 1.414$).
- **Euler's Polyhedral Discovery**: By topology ($\chi = V - E + F = 2$), a closed sphere requires **exactly 12 pentagons**. In this model, 150 regular hexagonal sectors form the continents, while the 12 pentagons are integrated into game lore as **Planetary Apex Conduits** (ancient planetary power anchors).

| Level | Hexagonal Structure | Total Sub-units | Description |
|---|---|---|---|
| **Planet** | Goldberg Sphere | 162 Zones (150 Hexagons + 12 Apex Pentagons) | 3D geodesic world with ±3.8% area uniformity and zero polar distortion. |
| **Zone** | 7-Block Rosette | 7 Hexagonal Blocks (1 Primary Center + 6 Perimeter) | Natural hexagonal clustering rosette forming a large hexagonal sector. |
| **Block** | Concentric Hex Rings | 37 Hexagonal Plots (Radius 3 concentric rings) | Pointy-topped hexagonal plots with axial coordinates $(q, r)$. |
| **Plot** | Regular Hexagon | Atomic Unit | 6 equidistant neighbors, manipulability states, hazard striping, and audio chimes. |

### Accessing Both Versions:
- **Square Grid (Default)**: `http://localhost:3000` or `standalone_wireframe.html`
- **Hexagonal Grid (Alternative)**: `http://localhost:3000/hex` or `standalone_hex_wireframe.html`

---

## 🚀 Running the Local Live Server

```bash
# Start server (default port 3000)
npm start
# or directly with Node:
node server/server.js
```

Open your browser at:
- **Square Grid Version**: [http://localhost:3000](http://localhost:3000) (or `standalone_wireframe.html`)
- **Hexagonal Grid Version**: [http://localhost:3000/hex](http://localhost:3000/hex) (or `standalone_hex_wireframe.html`)

---

## 🗺️ Roadmap
- [x] **Step 1: Game Structure & Wireframe** (Planet > Zone > Block > Plot logic & live visualizer)
- [x] **Step 1.1: Unified 3D Spherical Working Ground** (Smooth Zoom: Void ↔ Surface Block with Neighbor Framing & Spherical Curvature)
- [ ] **Step 2: Login & Authentication**
- [ ] **Step 3: Visuals & UI Polish**
- [ ] **Step 4: Sound Effects & Themes**
- [ ] **Step 5: Hosting on `games.acopone.com`**
- [ ] **Step 6: Scores & Leaderboards**
- [ ] **Step 7: Multiplayer Real-time Sessions**