# The Game - Planetary Grid Architecture

An online planetary grid strategy game built from the ground up.

## 🪐 Game Hierarchy & Core Logic

| Level | Structure | Total Sub-units | Wireframe Border & Fill | Description |
|---|---|---|---|---|
| **Planet** | Sphere | 100+ Zones (~108,000 Plots) | **Cyan Border** (`#00f0ff`), Dark Cosmic Void (`#050814`) | 3D wireframe spherical world rotating in space with hundreds of distributed zones. |
| **Zone** | 3 x 3 Blocks | 9 Blocks (900 Plots) | **Neon Violet Border** (`#a855f7`, 3px), Deep Indigo Fill (`#1a0f30`) | Regional sector container containing 9 blocks. |
| **Block** | 10 x 10 Plots | 100 Plots | **Golden Amber Border** (`#f59e0b`, 2px), Dark Navy Fill (`#0c1c38`) | Chessboard / Sudoku-style 10x10 matrix of squares with row/col coordinates (0..9). |
| **Plot** | 1 x 1 Square | Atomic Unit | Custom state border & fill | The fundamental building block where functions are defined. |

### Plot Functions & Manipulability States
- 🔒 **System Defined & Locked**: Crimson border (`#ef4444`) & deep red fill (`#3e0b0b`). Non-manipulable by users.
- ⚙️ **System Defined & Open**: Bright orange border (`#f97316`) & rust fill (`#3b1704`). User can modify parameters.
- ⚡ **User Defined & Active**: Neon emerald border (`#10b981`) & forest fill (`#06402b`). Active user function.
- 🛡️ **User Defined & Fortified**: Cyan border (`#06b6d4`) & deep teal fill (`#072e3d`). User-locked function.
- · **Empty Plot**: Slate dashed border (`#334155`) & blueprint slate fill (`#0f172a`). Available for development.

---

## 🚀 Running the Local Live Server

```bash
# Start server (default port 3000)
npm start
# or directly with Node:
node server/server.js
```

Open your browser at: **[http://localhost:3000](http://localhost:3000)**

---

## 🗺️ Roadmap
- [x] **Step 1: Game Structure & Wireframe** (Planet > Zone > Block > Plot logic & live visualizer)
- [ ] **Step 2: Login & Authentication**
- [ ] **Step 3: Visuals & UI**
- [ ] **Step 4: Polishing & Sound Effects**
- [ ] **Step 5: Hosting on `games.acopone.com`**
- [ ] **Step 6: Scores & Leaderboards**
- [ ] **Step 7: Multiplayer Real-time Sessions**