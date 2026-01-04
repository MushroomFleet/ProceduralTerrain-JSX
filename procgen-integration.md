# Procedural Deterministic Terrain Integration Guide

A comprehensive guide for integrating the seeded procedural terrain generation system into your React/Three.js applications.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Dependencies](#dependencies)
3. [Installation](#installation)
4. [Core Architecture](#core-architecture)
5. [Quick Start Integration](#quick-start-integration)
6. [API Reference](#api-reference)
7. [Customization](#customization)
8. [Advanced Usage](#advanced-usage)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

---

## System Overview

This terrain generation system provides **deterministic procedural terrain** using seeded noise algorithms. Given the same seed, the system will always produce identical terrain geometry and coloring, making it ideal for:

- Multiplayer games requiring synchronized world generation
- Procedural worlds with save/load functionality
- Tile-based infinite terrain systems
- Level generation with reproducible results

### Key Features

| Feature | Description |
|---------|-------------|
| **Deterministic Seeds** | String or numeric seeds produce identical terrain every time |
| **8 Biome Presets** | Grassland, Desert, Tundra, Volcanic, Ocean, Alien, Canyon, Marsh |
| **SVGA Vertex Shading** | Retro flat-shaded aesthetic with elevation-based coloring |
| **Wireframe Overlay** | Toggle wireframe rendering with biome-specific colors |
| **2D Minimap** | Canvas-based top-down terrain preview with scanline effect |
| **Configurable Resolution** | Adjustable vertex density for performance tuning |

---

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "three": "^0.150.0"
  }
}
```

### Optional (for enhanced integration)

```json
{
  "dependencies": {
    "@react-three/fiber": "^8.0.0",
    "@react-three/drei": "^9.0.0"
  }
}
```

---

## Installation

### Option A: Direct File Import

1. Copy `ProceduralTerrain.jsx` into your project's components directory
2. Import the components you need:

```jsx
import { 
  ProceduralTerrain,    // Full component with canvas
  BIOMES,               // Biome configurations
  BIOME_TYPES,          // Array of biome keys
  SeededRNG,            // Deterministic random number generator
  SeededNoise,          // Seeded simplex noise
  getVertexColor        // Height-to-color function
} from './components/ProceduralTerrain';
```

### Option B: Standalone HTML

For prototyping or non-React environments, use `demo.html` which loads all dependencies from CDN and runs in any modern browser.

---

## Core Architecture

### Component Hierarchy

```
ProceduralTerrain (Main wrapper)
├── ThreeTerrain (Three.js canvas + scene management)
│   ├── Scene (background, fog, lights)
│   ├── Camera (perspective, orbit controls)
│   ├── TerrainMesh (solid geometry with vertex colors)
│   ├── WireframeMesh (wireframe overlay)
│   └── GridHelper (reference grid)
├── TerrainHUD (2D overlay)
│   ├── Minimap (canvas-rendered top-down view)
│   ├── ElevationLegend (color key)
│   └── SystemInfo (seed, biome, scale)
└── ControlPanel (optional UI)
```

### Data Flow

```
Seed (string/number)
    ↓
SeededRNG (Mulberry32 PRNG)
    ↓
SeededNoise (Simplex noise with seeded permutation)
    ↓
Height values per vertex
    ↓
getVertexColor() → Vertex colors based on biome thresholds
    ↓
THREE.BufferGeometry with position + color attributes
```

---

## Quick Start Integration

### Minimal Integration (Vanilla Three.js)

```jsx
import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';

// Import core utilities from ProceduralTerrain.jsx
import { SeededRNG, SeededNoise, BIOMES, getVertexColor } from './ProceduralTerrain';

function MyTerrainScene({ seed = 'my-world', biome = 'grassland' }) {
  const containerRef = useRef(null);
  
  // Generate geometry (memoized for performance)
  const terrainGeometry = useMemo(() => {
    const biomeConfig = BIOMES[biome];
    const rng = new SeededRNG(seed);
    const noise = new SeededNoise(rng);
    
    const size = 50;
    const resolution = 64;
    const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
    geometry.rotateX(-Math.PI / 2);
    
    const positions = geometry.attributes.position.array;
    const colors = new Float32Array(positions.length);
    const vertexCount = (resolution + 1) ** 2;
    
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      
      // Generate height from noise
      const nx = x * biomeConfig.noiseScale;
      const nz = z * biomeConfig.noiseScale;
      let height = noise.fractalNoise(nx, nz, biomeConfig.octaves, 2.0, 0.5);
      height = Math.max(-1, Math.min(1, height));
      
      // Apply to geometry
      positions[i * 3 + 1] = height * biomeConfig.heightScale;
      
      // Calculate vertex color
      const color = getVertexColor(height, biomeConfig);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    
    return geometry;
  }, [seed, biome]);
  
  useEffect(() => {
    // Initialize Three.js scene...
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    // Add terrain mesh
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(terrainGeometry, material);
    scene.add(mesh);
    
    // ... rest of Three.js setup
  }, [terrainGeometry]);
  
  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

### Integration with @react-three/fiber

```jsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SeededRNG, SeededNoise, BIOMES, getVertexColor } from './ProceduralTerrain';

function TerrainMesh({ seed, biome, resolution = 64, size = 50 }) {
  const { geometry, wireColor } = useMemo(() => {
    const biomeConfig = BIOMES[biome];
    const rng = new SeededRNG(seed);
    const noise = new SeededNoise(rng);
    
    const geo = new THREE.PlaneGeometry(size, size, resolution, resolution);
    geo.rotateX(-Math.PI / 2);
    
    const positions = geo.attributes.position.array;
    const colors = new Float32Array(positions.length);
    
    for (let i = 0; i < (resolution + 1) ** 2; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      const nx = x * biomeConfig.noiseScale;
      const nz = z * biomeConfig.noiseScale;
      
      let height = noise.fractalNoise(nx, nz, biomeConfig.octaves, 2.0, 0.5);
      height = Math.max(-1, Math.min(1, height));
      
      positions[i * 3 + 1] = height * biomeConfig.heightScale;
      
      const color = getVertexColor(height, biomeConfig);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    
    return { geometry: geo, wireColor: biomeConfig.wireColor };
  }, [seed, biome, resolution, size]);
  
  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometry} position={[0, 0.01, 0]}>
        <meshBasicMaterial color={wireColor} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// Usage in your app
function App() {
  return (
    <Canvas camera={{ position: [40, 30, 40], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <TerrainMesh seed="my-world-42" biome="volcanic" />
      <OrbitControls />
    </Canvas>
  );
}
```

---

## API Reference

### SeededRNG Class

Mulberry32 pseudorandom number generator with string/number seed support.

```typescript
class SeededRNG {
  constructor(seed: string | number)
  
  next(): number           // Returns 0-1 float
  range(min, max): number  // Returns float in range
  reset(): void            // Reset to initial seed state
}
```

**Example:**
```js
const rng = new SeededRNG('my-seed');
console.log(rng.next());        // 0.7364829...
console.log(rng.range(0, 100)); // 42.158...

rng.reset();
console.log(rng.next());        // 0.7364829... (same as before)
```

### SeededNoise Class

2D Simplex noise with seeded permutation table.

```typescript
class SeededNoise {
  constructor(rng: SeededRNG)
  
  noise2D(x, y): number  // Returns -1 to 1
  fractalNoise(
    x, y, 
    octaves = 4, 
    lacunarity = 2, 
    persistence = 0.5
  ): number              // Multi-octave noise, -1 to 1
}
```

**Example:**
```js
const rng = new SeededRNG('terrain-seed');
const noise = new SeededNoise(rng);

// Single sample
const height = noise.noise2D(5.5, 3.2);

// Multi-octave for natural terrain
const terrainHeight = noise.fractalNoise(x * 0.1, z * 0.1, 4, 2.0, 0.5);
```

### BIOMES Object

Predefined biome configurations.

```typescript
interface BiomeConfig {
  name: string;
  heightScale: number;      // Vertical scale multiplier
  noiseScale: number;       // Horizontal frequency (smaller = larger features)
  octaves: number;          // Noise detail layers
  colors: {
    deep: RGB;              // Lowest elevation
    low: RGB;
    mid: RGB;
    high: RGB;
    peak: RGB;              // Highest elevation
  };
  wireColor: string;        // Hex color for wireframe
  thresholds: {
    deep: number;           // Height value boundaries (-1 to 1)
    low: number;
    mid: number;
    high: number;
  };
}

const BIOMES: Record<string, BiomeConfig>
const BIOME_TYPES: string[]  // ['grassland', 'desert', ...]
```

### getVertexColor Function

Maps height value to biome color with interpolation.

```typescript
function getVertexColor(
  height: number,      // -1 to 1
  biome: BiomeConfig
): { r: number, g: number, b: number }  // 0-1 RGB values
```

---

## Customization

### Creating Custom Biomes

```js
const CUSTOM_BIOMES = {
  ...BIOMES,
  
  crystalline: {
    name: 'Crystal Caverns',
    heightScale: 14,
    noiseScale: 0.06,
    octaves: 5,
    colors: {
      deep:   { r: 0.05, g: 0.05, b: 0.15 },
      low:    { r: 0.10, g: 0.15, b: 0.35 },
      mid:    { r: 0.20, g: 0.40, b: 0.60 },
      high:   { r: 0.50, g: 0.70, b: 0.90 },
      peak:   { r: 0.85, g: 0.95, b: 1.00 },
    },
    wireColor: '#4fc3f7',
    thresholds: { deep: -0.4, low: -0.1, mid: 0.2, high: 0.6 }
  }
};
```

### Modifying Noise Parameters

For different terrain characteristics:

| Parameter | Effect | Typical Range |
|-----------|--------|---------------|
| `noiseScale` | Feature size (lower = larger hills) | 0.02 - 0.15 |
| `octaves` | Detail levels (higher = more detail) | 2 - 8 |
| `lacunarity` | Frequency multiplier per octave | 1.5 - 2.5 |
| `persistence` | Amplitude decay per octave | 0.3 - 0.7 |
| `heightScale` | Vertical exaggeration | 2 - 25 |

### Adding Custom Height Modifiers

```js
// Island falloff (edges lower than center)
function applyIslandFalloff(height, x, z, size) {
  const dx = x / (size / 2);
  const dz = z / (size / 2);
  const dist = Math.sqrt(dx * dx + dz * dz);
  const falloff = Math.max(0, 1 - dist * dist);
  return height * falloff - (1 - falloff) * 0.5;
}

// Terrace/plateau effect
function terraceHeight(height, levels = 5) {
  return Math.round(height * levels) / levels;
}

// Ridge/mountain spine
function ridgeNoise(noise, x, z, scale) {
  const n = noise.noise2D(x * scale, z * scale);
  return 1 - Math.abs(n); // Inverts valleys to ridges
}
```

---

## Advanced Usage

### Infinite Terrain with Chunks

```jsx
function TerrainChunk({ chunkX, chunkZ, seed, biome, chunkSize = 50 }) {
  // Combine world seed with chunk coordinates for unique but deterministic chunks
  const chunkSeed = `${seed}_${chunkX}_${chunkZ}`;
  
  const geometry = useMemo(() => {
    const rng = new SeededRNG(chunkSeed);
    const noise = new SeededNoise(rng);
    const biomeConfig = BIOMES[biome];
    
    // Offset noise sampling by chunk position for seamless tiling
    const offsetX = chunkX * chunkSize;
    const offsetZ = chunkZ * chunkSize;
    
    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 32, 32);
    geo.rotateX(-Math.PI / 2);
    
    const positions = geo.attributes.position.array;
    
    for (let i = 0; i < 33 * 33; i++) {
      const localX = positions[i * 3];
      const localZ = positions[i * 3 + 2];
      
      // World-space noise coordinates
      const worldX = (localX + offsetX) * biomeConfig.noiseScale;
      const worldZ = (localZ + offsetZ) * biomeConfig.noiseScale;
      
      const height = noise.fractalNoise(worldX, worldZ, biomeConfig.octaves);
      positions[i * 3 + 1] = height * biomeConfig.heightScale;
    }
    
    geo.computeVertexNormals();
    return geo;
  }, [chunkSeed, biome, chunkSize]);
  
  return (
    <mesh 
      geometry={geometry} 
      position={[chunkX * chunkSize, 0, chunkZ * chunkSize]}
    >
      <meshBasicMaterial vertexColors />
    </mesh>
  );
}

// Render visible chunks around player
function InfiniteTerrain({ playerPosition, viewDistance = 3 }) {
  const chunks = [];
  const px = Math.floor(playerPosition.x / 50);
  const pz = Math.floor(playerPosition.z / 50);
  
  for (let x = px - viewDistance; x <= px + viewDistance; x++) {
    for (let z = pz - viewDistance; z <= pz + viewDistance; z++) {
      chunks.push(
        <TerrainChunk key={`${x}_${z}`} chunkX={x} chunkZ={z} seed="world" biome="grassland" />
      );
    }
  }
  
  return <>{chunks}</>;
}
```

### Extracting Height at Runtime

```js
// Create a height sampler for collision/physics
function createHeightSampler(seed, biome) {
  const rng = new SeededRNG(seed);
  const noise = new SeededNoise(rng);
  const biomeConfig = BIOMES[biome];
  
  return function getHeightAt(worldX, worldZ) {
    const nx = worldX * biomeConfig.noiseScale;
    const nz = worldZ * biomeConfig.noiseScale;
    
    let height = noise.fractalNoise(nx, nz, biomeConfig.octaves, 2.0, 0.5);
    height = Math.max(-1, Math.min(1, height));
    
    return height * biomeConfig.heightScale;
  };
}

// Usage
const getHeight = createHeightSampler('my-world', 'canyon');
const playerY = getHeight(player.x, player.z) + playerHeight;
```

### Biome Blending

```js
function blendBiomes(height, x, z, biomeA, biomeB, blendNoise, blendScale = 0.02) {
  // Use noise to determine blend factor
  const blend = (blendNoise.noise2D(x * blendScale, z * blendScale) + 1) / 2;
  
  const colorA = getVertexColor(height, biomeA);
  const colorB = getVertexColor(height, biomeB);
  
  return {
    r: colorA.r * (1 - blend) + colorB.r * blend,
    g: colorA.g * (1 - blend) + colorB.g * blend,
    b: colorA.b * (1 - blend) + colorB.b * blend
  };
}
```

---

## Performance Optimization

### Resolution Guidelines

| Use Case | Recommended Resolution | Vertices |
|----------|------------------------|----------|
| Mobile / Low-end | 32 | ~1,000 |
| Standard | 64 | ~4,000 |
| High quality | 96 | ~9,000 |
| Maximum detail | 128 | ~16,000 |

### Optimization Techniques

1. **Geometry Instancing** for repeated terrain chunks
2. **LOD (Level of Detail)** - reduce resolution with distance
3. **Frustum Culling** - don't render off-screen chunks
4. **Web Workers** - generate geometry off main thread
5. **Geometry Caching** - store generated chunks in memory/IndexedDB

```jsx
// Simple LOD example
function TerrainWithLOD({ distance, ...props }) {
  const resolution = useMemo(() => {
    if (distance < 50) return 64;
    if (distance < 100) return 32;
    return 16;
  }, [distance]);
  
  return <TerrainMesh resolution={resolution} {...props} />;
}
```

### Memory Management

```js
// Dispose geometry when unmounting
useEffect(() => {
  return () => {
    if (meshRef.current) {
      meshRef.current.geometry.dispose();
      meshRef.current.material.dispose();
    }
  };
}, []);
```

---

## Troubleshooting

### Common Issues

**Terrain appears flat**
- Check `heightScale` value (try 10-20)
- Verify noise scale isn't too large (try 0.05-0.1)
- Ensure height is being applied to Y axis (index `i * 3 + 1`)

**Seams between chunks**
- Use world-space coordinates for noise sampling
- Ensure chunk edges share identical vertex positions
- Apply same noise parameters across all chunks

**Performance issues**
- Reduce resolution
- Implement chunk culling
- Use `useMemo` to prevent unnecessary regeneration
- Consider Web Workers for generation

**Colors not appearing**
- Add `vertexColors: true` to material
- Verify color buffer attribute is set correctly
- Check color values are 0-1 (not 0-255)

### Debug Helpers

```js
// Visualize height values
function debugHeightmap(seed, biome, size = 100) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const rng = new SeededRNG(seed);
  const noise = new SeededNoise(rng);
  const biomeConfig = BIOMES[biome];
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size - 0.5) * 10 * biomeConfig.noiseScale;
      const ny = (y / size - 0.5) * 10 * biomeConfig.noiseScale;
      const h = (noise.fractalNoise(nx, ny, biomeConfig.octaves) + 1) / 2;
      
      ctx.fillStyle = `rgb(${h * 255}, ${h * 255}, ${h * 255})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  document.body.appendChild(canvas);
}
```

---

## License & Credits

- **Noise Algorithm**: Based on Stefan Gustavson's Simplex Noise implementation
- **PRNG**: Mulberry32 algorithm
- **Three.js**: MIT License - https://threejs.org

---

*Generated for Procedural Terrain System v1.0*
