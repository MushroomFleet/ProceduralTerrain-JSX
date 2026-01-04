# 🏔️ ProceduralTerrain-JSX

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Three.js](https://img.shields.io/badge/Three.js-r128+-black?logo=three.js)](https://threejs.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://reactjs.org/)

**Deterministic procedural terrain generation for React/Three.js applications.**

A seeded noise-based terrain system featuring SVGA-style flat vertex shading, multiple biome presets, wireframe overlays, and 2D minimap generation. Perfect for games, visualizations, and creative coding projects requiring reproducible procedural landscapes.

![Procedural Terrain Demo](https://img.shields.io/badge/demo-live_preview-brightgreen)

---

## ✨ Features

- 🎲 **Deterministic Seeds** — Same seed always produces identical terrain
- 🌍 **8 Biome Presets** — Grassland, Desert, Tundra, Volcanic, Ocean Floor, Alien World, Canyon, Marshland
- 🎨 **SVGA Aesthetic** — Retro flat-shaded vertex coloring with elevation bands
- 📐 **Wireframe Overlay** — Toggleable wireframe with biome-specific colors
- 🗺️ **2D Minimap** — Canvas-rendered top-down preview with CRT scanline effect
- ⚡ **Configurable Resolution** — Adjustable vertex density (16-128)
- 🔌 **Easy Integration** — Drop-in component for React/Three.js projects

---

## 📁 Repository Contents

| File | Description |
|------|-------------|
| `ProceduralTerrain.jsx` | Main React component with all terrain generation logic |
| `demo.html` | Standalone browser demo (no build step required) |
| `procgen-integration.md` | Comprehensive integration documentation |

---

## 🚀 Quick Start

### Option 1: Instant Preview

Simply download and open `demo.html` in any modern browser. No installation or build process required — all dependencies load from CDN.

```bash
# Clone the repository
git clone https://github.com/MushroomFleet/ProceduralTerrain-JSX.git

# Open the demo
open demo.html
```

**Controls:**
- 🖱️ **Drag** to rotate camera
- 🔄 **Scroll** to zoom in/out
- 📱 **Touch** supported on mobile

### Option 2: React Integration

1. Copy `ProceduralTerrain.jsx` into your project
2. Install dependencies:

```bash
npm install three
```

3. Import and use:

```jsx
import * as THREE from 'three';
import { SeededRNG, SeededNoise, BIOMES, getVertexColor } from './ProceduralTerrain';

// Generate terrain with a seed
const rng = new SeededRNG('my-world-seed');
const noise = new SeededNoise(rng);
const biome = BIOMES.volcanic;

// Sample height at any coordinate
const height = noise.fractalNoise(x * biome.noiseScale, z * biome.noiseScale, biome.octaves);
```

---

## 📖 Documentation

For complete integration instructions, API reference, and advanced usage patterns, see:

### 📄 [procgen-integration.md](./procgen-integration.md)

The integration guide covers:

- **Core Architecture** — Component hierarchy and data flow
- **API Reference** — `SeededRNG`, `SeededNoise`, `BIOMES`, `getVertexColor`
- **Quick Start Examples** — Vanilla Three.js and @react-three/fiber
- **Custom Biomes** — Creating your own terrain types
- **Advanced Patterns** — Infinite terrain chunks, height sampling, biome blending
- **Performance Optimization** — Resolution guidelines and memory management
- **Troubleshooting** — Common issues and debug helpers

---

## 🌄 Biome Showcase

| Biome | Height Scale | Character |
|-------|--------------|-----------|
| 🌿 Grassland | 8 | Rolling hills, meadows |
| 🏜️ Desert | 6 | Gentle dunes, arid plains |
| ❄️ Tundra | 5 | Frozen wastes, permafrost |
| 🌋 Volcanic | 12 | Dramatic peaks, lava fields |
| 🌊 Ocean Floor | 15 | Deep trenches, underwater ridges |
| 👽 Alien World | 10 | Bioluminescent, otherworldly |
| 🏜️ Canyon | 18 | Deep cuts, layered rock |
| 🌿 Marshland | 3 | Flat wetlands, subtle variation |

---

## 🔧 Configuration

```jsx
// Terrain parameters
const config = {
  seed: 'any-string-or-number',  // Deterministic seed
  biome: 'volcanic',              // Biome preset key
  resolution: 64,                 // Vertex density (16-128)
  size: 50,                       // World units
  showWireframe: true,            // Toggle wireframe overlay
  showSolid: true,                // Toggle solid mesh
};
```

---

## 🎮 Use Cases

- **Procedural Games** — Infinite worlds with save/load support
- **Multiplayer Sync** — Identical terrain across all clients
- **Data Visualization** — Terrain-based data representation
- **Creative Coding** — Generative art and demos
- **Prototyping** — Quick terrain for game jams

---

## 📦 Dependencies

**Required:**
- `three` ^0.128.0+

**Optional (for enhanced integration):**
- `react` ^18.0.0
- `react-dom` ^18.0.0
- `@react-three/fiber` ^8.0.0
- `@react-three/drei` ^9.0.0

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- 🐛 Report bugs
- 💡 Suggest new biomes
- 🔧 Submit pull requests
- 📖 Improve documentation

---

## 📜 License

MIT License — free for personal and commercial use.

---

## 📚 Citation

### Academic Citation

If you use this codebase in your research or project, please cite:

```bibtex
@software{procedural_terrain_jsx,
  title = {ProceduralTerrain-JSX: Deterministic Procedural Terrain Generation for React/Three.js},
  author = {Drift Johnson},
  year = {2025},
  url = {https://github.com/MushroomFleet/ProceduralTerrain-JSX},
  version = {1.0.0}
}
```

### Donate

[![Ko-Fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/driftjohnson)
