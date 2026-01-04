import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDED PRNG - Mulberry32 algorithm for deterministic randomness
// ═══════════════════════════════════════════════════════════════════════════════
class SeededRNG {
  constructor(seed) {
    this.seed = this.hashString(seed);
    this.state = this.seed;
  }

  hashString(str) {
    if (typeof str === 'number') return str >>> 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  }

  next() {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  reset() {
    this.state = this.seed;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLEX NOISE - Seeded implementation for coherent terrain
// ═══════════════════════════════════════════════════════════════════════════════
class SeededNoise {
  constructor(rng) {
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    
    // Fisher-Yates shuffle with seeded RNG
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
    
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    
    this.F2 = 0.5 * (Math.sqrt(3) - 1);
    this.G2 = (3 - Math.sqrt(3)) / 6;
  }

  noise2D(xin, yin) {
    const { perm, permMod12, grad3, F2, G2 } = this;
    let n0, n1, n2;
    
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }
    
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = permMod12[ii + perm[jj]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1]];
    const gi2 = permMod12[ii + 1 + perm[jj + 1]];
    
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 < 0) n0 = 0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0][0]*x0 + grad3[gi0][1]*y0);
    }
    
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 < 0) n1 = 0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1][0]*x1 + grad3[gi1][1]*y1);
    }
    
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 < 0) n2 = 0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2][0]*x2 + grad3[gi2][1]*y2);
    }
    
    return 70 * (n0 + n1 + n2);
  }

  fractalNoise(x, y, octaves = 4, lacunarity = 2, persistence = 0.5) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    
    return total / maxValue;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIOME CONFIGURATIONS - SVGA-style color palettes
// ═══════════════════════════════════════════════════════════════════════════════
const BIOMES = {
  grassland: {
    name: 'Grassland',
    heightScale: 8,
    noiseScale: 0.08,
    octaves: 4,
    colors: {
      deep:   new THREE.Color(0x1a472a),  // Dark forest green
      low:    new THREE.Color(0x2d5a27),  // Forest floor
      mid:    new THREE.Color(0x4a7c23),  // Grass green
      high:   new THREE.Color(0x7cb342),  // Light grass
      peak:   new THREE.Color(0xa5d64a),  // Bright meadow
    },
    wireColor: new THREE.Color(0x1b5e20),
    thresholds: { deep: -0.3, low: 0, mid: 0.3, high: 0.6 }
  },
  
  desert: {
    name: 'Desert',
    heightScale: 6,
    noiseScale: 0.06,
    octaves: 3,
    colors: {
      deep:   new THREE.Color(0x8b4513),  // Saddle brown (rocky)
      low:    new THREE.Color(0xc19a6b),  // Desert sand
      mid:    new THREE.Color(0xd4a574),  // Warm sand
      high:   new THREE.Color(0xe6c99a),  // Light dune
      peak:   new THREE.Color(0xfae5c3),  // Bright sand peak
    },
    wireColor: new THREE.Color(0x8b5a2b),
    thresholds: { deep: -0.4, low: -0.1, mid: 0.2, high: 0.5 }
  },
  
  tundra: {
    name: 'Tundra',
    heightScale: 5,
    noiseScale: 0.05,
    octaves: 5,
    colors: {
      deep:   new THREE.Color(0x2f4f4f),  // Dark slate
      low:    new THREE.Color(0x607d8b),  // Blue grey
      mid:    new THREE.Color(0x90a4ae),  // Permafrost
      high:   new THREE.Color(0xb0bec5),  // Light frost
      peak:   new THREE.Color(0xeceff1),  // Snow
    },
    wireColor: new THREE.Color(0x455a64),
    thresholds: { deep: -0.35, low: -0.05, mid: 0.25, high: 0.55 }
  },
  
  volcanic: {
    name: 'Volcanic',
    heightScale: 12,
    noiseScale: 0.07,
    octaves: 4,
    colors: {
      deep:   new THREE.Color(0x1a1a1a),  // Obsidian black
      low:    new THREE.Color(0x3d2817),  // Scorched earth
      mid:    new THREE.Color(0x5d4037),  // Volcanic rock
      high:   new THREE.Color(0xbf360c),  // Molten orange
      peak:   new THREE.Color(0xff5722),  // Lava glow
    },
    wireColor: new THREE.Color(0xff3d00),
    thresholds: { deep: -0.4, low: -0.1, mid: 0.3, high: 0.7 }
  },
  
  ocean: {
    name: 'Ocean Floor',
    heightScale: 15,
    noiseScale: 0.04,
    octaves: 5,
    colors: {
      deep:   new THREE.Color(0x0d1b2a),  // Abyss
      low:    new THREE.Color(0x1b3a4b),  // Deep ocean
      mid:    new THREE.Color(0x2e6171),  // Mid depth
      high:   new THREE.Color(0x4a8fa8),  // Shallow
      peak:   new THREE.Color(0x7ec8e3),  // Near surface
    },
    wireColor: new THREE.Color(0x0077b6),
    thresholds: { deep: -0.5, low: -0.2, mid: 0.1, high: 0.4 }
  },
  
  alien: {
    name: 'Alien World',
    heightScale: 10,
    noiseScale: 0.09,
    octaves: 4,
    colors: {
      deep:   new THREE.Color(0x1a0033),  // Deep purple void
      low:    new THREE.Color(0x4a0080),  // Alien rock
      mid:    new THREE.Color(0x7b1fa2),  // Crystal purple
      high:   new THREE.Color(0x00e676),  // Bioluminescent
      peak:   new THREE.Color(0x76ff03),  // Bright bio
    },
    wireColor: new THREE.Color(0x00c853),
    thresholds: { deep: -0.35, low: 0, mid: 0.35, high: 0.65 }
  },
  
  canyon: {
    name: 'Canyon',
    heightScale: 18,
    noiseScale: 0.05,
    octaves: 6,
    colors: {
      deep:   new THREE.Color(0x3e2723),  // Canyon floor
      low:    new THREE.Color(0x6d4c41),  // Lower rock
      mid:    new THREE.Color(0xa1887f),  // Sandstone
      high:   new THREE.Color(0xd7ccc8),  // Upper layers
      peak:   new THREE.Color(0xff8a65),  // Sun-kissed rim
    },
    wireColor: new THREE.Color(0x795548),
    thresholds: { deep: -0.4, low: -0.15, mid: 0.2, high: 0.55 }
  },
  
  marsh: {
    name: 'Marshland',
    heightScale: 3,
    noiseScale: 0.1,
    octaves: 5,
    colors: {
      deep:   new THREE.Color(0x1b3022),  // Deep water
      low:    new THREE.Color(0x2e4a3a),  // Murky water
      mid:    new THREE.Color(0x4a6741),  // Wet grass
      high:   new THREE.Color(0x6b8e4e),  // Reed green
      peak:   new THREE.Color(0x8bc34a),  // Bright vegetation
    },
    wireColor: new THREE.Color(0x33691e),
    thresholds: { deep: -0.25, low: 0.05, mid: 0.25, high: 0.5 }
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HEIGHT-TO-COLOR INTERPOLATION (SVGA vertex coloring)
// ═══════════════════════════════════════════════════════════════════════════════
function getVertexColor(height, biome) {
  const { colors, thresholds } = biome;
  const h = height;
  
  // Determine which color band and interpolate
  if (h < thresholds.deep) {
    return colors.deep.clone();
  } else if (h < thresholds.low) {
    const t = (h - thresholds.deep) / (thresholds.low - thresholds.deep);
    return colors.deep.clone().lerp(colors.low, t);
  } else if (h < thresholds.mid) {
    const t = (h - thresholds.low) / (thresholds.mid - thresholds.low);
    return colors.low.clone().lerp(colors.mid, t);
  } else if (h < thresholds.high) {
    const t = (h - thresholds.mid) / (thresholds.high - thresholds.mid);
    return colors.mid.clone().lerp(colors.high, t);
  } else {
    const t = Math.min((h - thresholds.high) / (1 - thresholds.high), 1);
    return colors.high.clone().lerp(colors.peak, t);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TERRAIN MESH COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function TerrainMesh({ 
  seed, 
  biomeType, 
  resolution = 64, 
  size = 50,
  wireframe = true,
  showSolid = true,
  wireframeOpacity = 0.8,
  solidOpacity = 0.9,
  position = [0, 0, 0]
}) {
  const meshRef = useRef();
  const wireRef = useRef();
  
  const biome = BIOMES[biomeType] || BIOMES.grassland;
  
  const { geometry, heightMap } = useMemo(() => {
    const rng = new SeededRNG(seed);
    const noise = new SeededNoise(rng);
    
    const geo = new THREE.PlaneGeometry(size, size, resolution, resolution);
    geo.rotateX(-Math.PI / 2);
    
    const positions = geo.attributes.position.array;
    const colors = new Float32Array(positions.length);
    const heights = [];
    
    const vertexCount = (resolution + 1) * (resolution + 1);
    
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      
      // Multi-octave noise for terrain height
      const nx = x * biome.noiseScale;
      const nz = z * biome.noiseScale;
      
      let height = noise.fractalNoise(nx, nz, biome.octaves, 2.0, 0.5);
      
      // Add some variation based on biome
      const detail = noise.noise2D(nx * 3, nz * 3) * 0.15;
      height = height + detail;
      
      // Clamp and scale
      height = Math.max(-1, Math.min(1, height));
      heights.push(height);
      
      // Apply height to Y position
      positions[i * 3 + 1] = height * biome.heightScale;
      
      // Calculate vertex color based on height
      const color = getVertexColor(height, biome);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    
    return { geometry: geo, heightMap: heights };
  }, [seed, biomeType, resolution, size]);
  
  return (
    <group position={position}>
      {/* Solid terrain with vertex colors */}
      {showSolid && (
        <mesh ref={meshRef} geometry={geometry}>
          <meshBasicMaterial 
            vertexColors 
            side={THREE.DoubleSide}
            transparent
            opacity={solidOpacity}
            flatShading
          />
        </mesh>
      )}
      
      {/* Wireframe overlay */}
      {wireframe && (
        <mesh ref={wireRef} geometry={geometry}>
          <meshBasicMaterial 
            color={biome.wireColor}
            wireframe
            transparent
            opacity={wireframeOpacity}
          />
        </mesh>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FABRIC.JS 2D OVERLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function TerrainOverlay({ 
  seed, 
  biomeType, 
  showMinimap = true,
  showLegend = true,
  showCoords = true 
}) {
  const canvasRef = useRef(null);
  const biome = BIOMES[biomeType] || BIOMES.grassland;
  
  useEffect(() => {
    if (!canvasRef.current || !showMinimap) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = 120;
    canvas.width = size;
    canvas.height = size;
    
    // Generate minimap from seed
    const rng = new SeededRNG(seed);
    const noise = new SeededNoise(rng);
    
    const imageData = ctx.createImageData(size, size);
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x / size - 0.5) * 2 * biome.noiseScale * 50;
        const ny = (y / size - 0.5) * 2 * biome.noiseScale * 50;
        
        let height = noise.fractalNoise(nx, ny, biome.octaves, 2.0, 0.5);
        height = Math.max(-1, Math.min(1, height));
        
        const color = getVertexColor(height, biome);
        const idx = (y * size + x) * 4;
        imageData.data[idx] = Math.floor(color.r * 255);
        imageData.data[idx + 1] = Math.floor(color.g * 255);
        imageData.data[idx + 2] = Math.floor(color.b * 255);
        imageData.data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add scanline effect for SVGA feel
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < size; i += 2) {
      ctx.fillRect(0, i, size, 1);
    }
    
    // Border
    ctx.strokeStyle = biome.wireColor.getStyle();
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
    
  }, [seed, biomeType, showMinimap]);
  
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      fontFamily: '"IBM Plex Mono", "Courier New", monospace',
      fontSize: 11,
      color: '#0f0',
      textShadow: '0 0 4px #0f0',
      zIndex: 100,
    }}>
      {/* Minimap */}
      {showMinimap && (
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          padding: 8,
          border: `1px solid ${biome.wireColor.getStyle()}`,
          boxShadow: `0 0 10px ${biome.wireColor.getStyle()}40`,
        }}>
          <div style={{ marginBottom: 6, letterSpacing: 2 }}>◈ TERRAIN MAP</div>
          <canvas ref={canvasRef} style={{ display: 'block', imageRendering: 'pixelated' }} />
        </div>
      )}
      
      {/* Legend */}
      {showLegend && (
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          padding: 8,
          border: `1px solid ${biome.wireColor.getStyle()}`,
          boxShadow: `0 0 10px ${biome.wireColor.getStyle()}40`,
        }}>
          <div style={{ marginBottom: 6, letterSpacing: 2 }}>◈ ELEVATION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Object.entries(biome.colors).map(([key, color]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 16,
                  height: 8,
                  background: color.getStyle(),
                  border: '1px solid rgba(255,255,255,0.3)'
                }} />
                <span style={{ textTransform: 'uppercase' }}>{key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Coordinates / Info */}
      {showCoords && (
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          padding: 8,
          border: `1px solid ${biome.wireColor.getStyle()}`,
          boxShadow: `0 0 10px ${biome.wireColor.getStyle()}40`,
        }}>
          <div style={{ marginBottom: 4, letterSpacing: 2 }}>◈ SYSTEM</div>
          <div>SEED: {typeof seed === 'string' ? seed.substring(0, 12) : seed}</div>
          <div>BIOME: {biome.name.toUpperCase()}</div>
          <div>H.SCALE: {biome.heightScale}u</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE CONTROLS & CAMERA
// ═══════════════════════════════════════════════════════════════════════════════
function SceneSetup({ ambientIntensity = 0.6 }) {
  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight position={[50, 50, 25]} intensity={0.5} />
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={150}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PROCEDURAL TERRAIN COMPONENT (Exported)
// ═══════════════════════════════════════════════════════════════════════════════
export function ProceduralTerrain({
  seed = 'default-terrain-seed',
  biome = 'grassland',
  resolution = 64,
  size = 50,
  wireframe = true,
  showSolid = true,
  wireframeOpacity = 0.7,
  solidOpacity = 1.0,
  showOverlay = true,
  showMinimap = true,
  showLegend = true,
  showCoords = true,
  showGrid = true,
  backgroundColor = '#0a0a0a',
  cameraPosition = [40, 30, 40],
  style = {},
  className = '',
  onTerrainGenerated = null,
}) {
  // Notify parent when terrain is generated
  useEffect(() => {
    if (onTerrainGenerated) {
      onTerrainGenerated({ seed, biome, resolution, size });
    }
  }, [seed, biome, resolution, size, onTerrainGenerated]);
  
  return (
    <div 
      className={className}
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        background: backgroundColor,
        ...style 
      }}
    >
      <Canvas
        camera={{ position: cameraPosition, fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: backgroundColor }}
      >
        <color attach="background" args={[backgroundColor]} />
        <fog attach="fog" args={[backgroundColor, 60, 150]} />
        
        <SceneSetup />
        
        <TerrainMesh
          seed={seed}
          biomeType={biome}
          resolution={resolution}
          size={size}
          wireframe={wireframe}
          showSolid={showSolid}
          wireframeOpacity={wireframeOpacity}
          solidOpacity={solidOpacity}
        />
        
        {showGrid && (
          <Grid
            args={[100, 100]}
            position={[0, -0.1, 0]}
            cellSize={2}
            cellThickness={0.5}
            cellColor="#1a1a1a"
            sectionSize={10}
            sectionThickness={1}
            sectionColor="#2a2a2a"
            fadeDistance={100}
            fadeStrength={1}
            infiniteGrid
          />
        )}
      </Canvas>
      
      {showOverlay && (
        <TerrainOverlay
          seed={seed}
          biomeType={biome}
          showMinimap={showMinimap}
          showLegend={showLegend}
          showCoords={showCoords}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════
export { BIOMES, SeededRNG, SeededNoise, getVertexColor };
export const BIOME_TYPES = Object.keys(BIOMES);

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO APPLICATION
// ═══════════════════════════════════════════════════════════════════════════════
export default function TerrainDemo() {
  const [seed, setSeed] = useState('cosmic-landscape-42');
  const [biome, setBiome] = useState('grassland');
  const [resolution, setResolution] = useState(64);
  const [wireframe, setWireframe] = useState(true);
  const [showSolid, setShowSolid] = useState(true);
  
  const randomizeSeed = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let newSeed = '';
    for (let i = 0; i < 16; i++) {
      newSeed += chars[Math.floor(Math.random() * chars.length)];
    }
    setSeed(newSeed);
  };
  
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: '#000',
      fontFamily: '"IBM Plex Mono", monospace',
      overflow: 'hidden'
    }}>
      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 100,
        background: 'rgba(0,0,0,0.9)',
        border: '1px solid #333',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        color: '#0f0',
        fontSize: 12,
        minWidth: 220,
        boxShadow: '0 0 20px rgba(0,255,0,0.1)',
      }}>
        <div style={{ 
          borderBottom: '1px solid #333', 
          paddingBottom: 8, 
          letterSpacing: 3,
          fontSize: 14 
        }}>
          ◈ TERRAIN CONTROL
        </div>
        
        {/* Seed Input */}
        <div>
          <label style={{ display: 'block', marginBottom: 4, opacity: 0.7 }}>SEED</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              style={{
                flex: 1,
                background: '#111',
                border: '1px solid #333',
                color: '#0f0',
                padding: '6px 8px',
                fontFamily: 'inherit',
                fontSize: 11,
              }}
            />
            <button
              onClick={randomizeSeed}
              style={{
                background: '#1a1a1a',
                border: '1px solid #0f0',
                color: '#0f0',
                padding: '6px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              RND
            </button>
          </div>
        </div>
        
        {/* Biome Select */}
        <div>
          <label style={{ display: 'block', marginBottom: 4, opacity: 0.7 }}>BIOME</label>
          <select
            value={biome}
            onChange={(e) => setBiome(e.target.value)}
            style={{
              width: '100%',
              background: '#111',
              border: '1px solid #333',
              color: '#0f0',
              padding: '6px 8px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {BIOME_TYPES.map(b => (
              <option key={b} value={b}>{BIOMES[b].name.toUpperCase()}</option>
            ))}
          </select>
        </div>
        
        {/* Resolution Slider */}
        <div>
          <label style={{ display: 'block', marginBottom: 4, opacity: 0.7 }}>
            RESOLUTION: {resolution}
          </label>
          <input
            type="range"
            min="16"
            max="128"
            step="8"
            value={resolution}
            onChange={(e) => setResolution(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#0f0' }}
          />
        </div>
        
        {/* Toggles */}
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
              style={{ accentColor: '#0f0' }}
            />
            WIRE
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showSolid}
              onChange={(e) => setShowSolid(e.target.checked)}
              style={{ accentColor: '#0f0' }}
            />
            SOLID
          </label>
        </div>
      </div>
      
      {/* Terrain Viewer */}
      <ProceduralTerrain
        seed={seed}
        biome={biome}
        resolution={resolution}
        wireframe={wireframe}
        showSolid={showSolid}
        wireframeOpacity={0.6}
        solidOpacity={0.95}
        showOverlay={true}
        showMinimap={true}
        showLegend={true}
        showCoords={true}
        showGrid={true}
        backgroundColor="#050505"
      />
      
      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#333',
        fontSize: 10,
        letterSpacing: 2,
        fontFamily: '"IBM Plex Mono", monospace',
      }}>
        PROCEDURAL TERRAIN v1.0 • DRAG TO ROTATE • SCROLL TO ZOOM
      </div>
    </div>
  );
}
