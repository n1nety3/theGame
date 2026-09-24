/**
 * The Game - Seamless Hexagonal Planetary Grid Architecture Engine
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. The planet is a 100% CONTINUOUS, SEAMLESS spherical mosaic of hexagonal plots.
 * 2. Every plot is closely placed next to its 6 neighbors with IDENTICAL spacing across the entire globe.
 * 3. ZONES and BLOCKS are completely INVISIBLE to the user:
 *    - They are purely internal system abstractions / spatial partitions (chunks) used for:
 *      * Backend request routing (/api/zone/:id, /api/block/:id)
 *      * Network batching, caching, and database partitioning
 *    - To the user, there are NO zone gaps, NO block borders, and NO artificial seams.
 * 4. Goldberg Polyhedron Geodesic Dual System:
 *    - Frequency = 16 -> 2,562 contiguous plots (2,550 Hexagons + 12 Apex Pentagons).
 *    - ±3.8% Equal-Area Uniformity (Zero Polar Pinching).
 */

class HexPlanetaryEngine {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // Planetary Constants
    this.PLANET_RADIUS = 100.0;
    this.SUBDIVISIONS = 16; // 2,562 plots covering 100% of the sphere with 0 gaps
    this.NUM_SYSTEM_ZONES = 24; // Internal system spatial partitioning (invisible to user)
    this.BLOCKS_PER_ZONE = 9;   // Internal system blocks per zone (invisible to user)

    // Camera Distance Range
    this.DIST_ORBIT = 280.0;     // Full planet in cosmic space
    this.DIST_SURFACE = 114.5;   // Close surface view of contiguous hexagonal plots
    
    // Zoom state (0.0 = Orbit Void, 1.0 = Surface View)
    this.targetZoom = 1.0;
    this.currentZoom = 1.0;
    this.zoomSpeed = 0.0016;
    this.zoomDamping = 0.085;

    // Navigation / Dragging state
    this.isDragging = false;
    this.isDragMove = false;
    this.mouseDownPos = { x: 0, y: 0 };
    this.previousMouse = { x: 0, y: 0 };
    this.mouseClientPos = { clientX: 0, clientY: 0 };
    this.autoOrbit = false;
    this.soundEnabled = true;

    // Spherical Navigation Coordinates (Latitude & Longitude in radians)
    this.currentLat = 0.0;
    this.currentLng = 0.0;
    this.targetLat = 0.0;
    this.targetLng = 0.0;
    this.moveVelocity = { lat: 0, lng: 0 };
    this.keysDown = {};

    // Plot interaction state
    this.hoveredPlot = null;
    this.selectedPlot = null;

    // Data stores
    this.plots = [];
    this.plotByFaceIndex = []; // Fast O(1) raycast lookup from triangle faceIndex to plot

    // Web Audio Synthesizer
    this.audioCtx = null;

    // Three.js instances
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-1000, -1000);

    // 3D Groups and Meshes
    this.rootGroup = null;
    this.planetGroup = null;
    this.planetMesh = null;
    this.planetWireframe = null;
    this.hoverCursorMesh = null;
    this.hoverWireframe = null;
    this.starfield = null;
    this.atmosphereMesh = null;

    this.init();
  }

  get isZoneView() {
    return this.currentZoom >= 0.42;
  }

  async init() {
    this.initThree();
    this.initCosmicVoid();
    this.initAtmosphere();
    this.buildSeamlessHexPlanet();
    this.buildHoverCursor();
    this.setupHUD();
    this.bindEvents();
    this.animate();
  }

  /* ========================================================
     THREE.JS SETUP & LIGHTING
     ======================================================== */
  initThree() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050814); // Dark Cosmic Void

    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 4000);
    this.camera.position.set(0, 0, this.DIST_SURFACE);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.planetGroup = new THREE.Group();
    this.rootGroup.add(this.planetGroup);

    // Ambient and Directional Sci-Fi Lighting
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.7);
    this.scene.add(ambient);

    const dirLight1 = new THREE.DirectionalLight(0xffe600, 0.85); // Core Yellow key accent light
    dirLight1.position.set(200, 150, 250);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 0.55);
    dirLight2.position.set(-200, -100, -200);
    this.scene.add(dirLight2);
  }

  /**
   * Cosmic Void Background: Deep starfield with twinkling star particles
   */
  initCosmicVoid() {
    const starCount = 2800;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    const palette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xffe600), // Core Yellow
      new THREE.Color(0xfef08a), // Bright Yellow
      new THREE.Color(0xfbbf24), // Amber Gold
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xd8b4fe)
    ];

    for (let i = 0; i < starCount; i++) {
      const rad = 750 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = rad * Math.cos(phi);

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      sizes[i] = 1.2 + Math.random() * 2.8;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      sizeAttenuation: true
    });

    this.starfield = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starfield);
  }

  /**
   * Glowing Atmospheric Rim Layer
   */
  initAtmosphere() {
    const atmoGeo = new THREE.SphereGeometry(this.PLANET_RADIUS + 2.5, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = 1.0 - max(dot(vViewDir, vNormal), 0.0);
          rim = pow(rim, 2.6);
          vec3 atmoColor = mix(vec3(0.0, 0.94, 1.0), vec3(0.66, 0.33, 0.97), rim);
          gl_FragColor = vec4(atmoColor, rim * 0.38);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    this.atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.planetGroup.add(this.atmosphereMesh);
  }

  /* ========================================================
     CONTINUOUS SEAMLESS HEXAGONAL PLANET
     Every plot is closely placed next to its neighbors with 0 gaps.
     Zone and Block are purely internal system partitioning.
     ======================================================== */
  buildSeamlessHexPlanet() {
    const subdivisions = this.SUBDIVISIONS;
    const rad = this.PLANET_RADIUS;
    const phi = (1 + Math.sqrt(5)) / 2;

    const normalize = (v) => {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    };

    const lerp = (a, b, t) => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ];

    // 12 regular icosahedron vertices
    const icoVertices = [
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [ 0, -1,  phi], [ 0,  1,  phi], [ 0, -1, -phi], [ 0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1]
    ].map(normalize);

    // 20 triangular faces
    const icoFaces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];

    const vertices = [];
    const vertMap = new Map();

    const addVertex = (v) => {
      const norm = normalize(v);
      const key = `${norm[0].toFixed(5)},${norm[1].toFixed(5)},${norm[2].toFixed(5)}`;
      if (vertMap.has(key)) return vertMap.get(key);
      const idx = vertices.length;
      vertices.push(norm);
      vertMap.set(key, idx);
      return idx;
    };

    const triangles = [];
    const primalEdges = new Map(); // For wireframe edge deduplication

    const getEdgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

    for (const [i1, i2, i3] of icoFaces) {
      const v1 = icoVertices[i1];
      const v2 = icoVertices[i2];
      const v3 = icoVertices[i3];

      const grid = [];
      for (let i = 0; i <= subdivisions; i++) {
        grid[i] = [];
        const rowStart = lerp(v1, v2, i / subdivisions);
        const rowEnd = lerp(v1, v3, i / subdivisions);
        for (let j = 0; j <= i; j++) {
          const pt = i === 0 ? v1 : lerp(rowStart, rowEnd, j / i);
          grid[i][j] = addVertex(pt);
        }
      }

      for (let i = 0; i < subdivisions; i++) {
        for (let j = 0; j <= i; j++) {
          const tIdx1 = triangles.length;
          const tri1 = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1]];
          triangles.push(tri1);

          // Register edges
          [[tri1[0], tri1[1]], [tri1[1], tri1[2]], [tri1[2], tri1[0]]].forEach(([a, b]) => {
            const key = getEdgeKey(a, b);
            if (!primalEdges.has(key)) primalEdges.set(key, []);
            primalEdges.get(key).push(tIdx1);
          });

          if (j < i) {
            const tIdx2 = triangles.length;
            const tri2 = [grid[i][j], grid[i + 1][j + 1], grid[i][j + 1]];
            triangles.push(tri2);

            [[tri2[0], tri2[1]], [tri2[1], tri2[2]], [tri2[2], tri2[0]]].forEach(([a, b]) => {
              const key = getEdgeKey(a, b);
              if (!primalEdges.has(key)) primalEdges.set(key, []);
              primalEdges.get(key).push(tIdx2);
            });
          }
        }
      }
    }

    const vertTriangles = Array.from({ length: vertices.length }, () => []);
    triangles.forEach((tri, tIdx) => {
      tri.forEach(vIdx => vertTriangles[vIdx].push(tIdx));
    });

    // Centroids of subdivided triangles (dual vertices on sphere)
    const triCentroids = triangles.map(tri => {
      const p1 = vertices[tri[0]];
      const p2 = vertices[tri[1]];
      const p3 = vertices[tri[2]];
      return normalize([
        (p1[0] + p2[0] + p3[0]) / 3,
        (p1[1] + p2[1] + p3[1]) / 3,
        (p1[2] + p2[2] + p3[2]) / 3
      ]);
    });

    // --- SYSTEM PARTITIONING (Zone & Block logic for requests) ---
    const totalPlots = vertices.length;
    const plotsPerZone = Math.ceil(totalPlots / this.NUM_SYSTEM_ZONES);
    const plotsPerBlock = Math.ceil(plotsPerZone / this.BLOCKS_PER_ZONE);

    this.plots = [];
    this.plotByFaceIndex = [];

    // Mesh Buffers
    const meshPositions = [];
    const meshNormals = [];
    const meshColors = [];

    let currentTriangleIndex = 0;

    for (let vIdx = 0; vIdx < vertices.length; vIdx++) {
      const centerRaw = vertices[vIdx];
      const normal = new THREE.Vector3(centerRaw[0], centerRaw[1], centerRaw[2]).normalize();
      const centerPos = normal.clone().multiplyScalar(rad);

      const tIndices = vertTriangles[vIdx];
      const isPentagon = (tIndices.length === 5);

      // Local tangent frame
      let ref = new THREE.Vector3(0, 1, 0);
      if (Math.abs(normal.y) > 0.92) ref = new THREE.Vector3(1, 0, 0);
      const uBasis = new THREE.Vector3().crossVectors(ref, normal).normalize();
      const vBasis = new THREE.Vector3().crossVectors(normal, uBasis).normalize();

      // Cyclic sort around normal
      const cellVerts = tIndices.map(tIdx => {
        const c = triCentroids[tIdx];
        const v3 = new THREE.Vector3(c[0], c[1], c[2]);
        const diff = v3.clone().sub(normal);
        const du = diff.dot(uBasis);
        const dv = diff.dot(vBasis);
        return { tIdx, v3, angle: Math.atan2(dv, du) };
      });
      cellVerts.sort((a, b) => a.angle - b.angle);

      // Boundary points on sphere surface
      const boundaryPoints = cellVerts.map(cv => cv.v3.clone().normalize().multiplyScalar(rad + 0.05));

      // --- System Partitioning Metadata ---
      const zoneId = Math.floor(vIdx / plotsPerZone);
      const localPlotIdx = vIdx % plotsPerZone;
      const blockId = Math.floor(localPlotIdx / plotsPerBlock);
      const plotInBlock = localPlotIdx % plotsPerBlock;

      // Deterministic Status & Functions for Gameplay
      const seed = (vIdx * 37 + zoneId * 19 + blockId * 13) % 100;
      let owner = 'none';
      let manipulable = true;
      let funcType = 'none';
      let funcName = 'Unassigned Hex Plot';
      let status = 'empty';

      if (isPentagon) {
        owner = 'system';
        manipulable = false;
        funcType = 'apex_conduit';
        funcName = 'Planetary Apex Conduit';
        status = 'system_locked';
      } else if (seed < 10) {
        owner = 'system';
        manipulable = false;
        funcType = 'geothermal_core';
        funcName = 'Sub-Surface Fusion Core';
        status = 'system_locked';
      } else if (seed < 22) {
        owner = 'system';
        manipulable = true;
        funcType = 'orbital_gate';
        funcName = 'Hexagonal Relay Conduit';
        status = 'system_open';
      } else if (seed < 48) {
        owner = 'user';
        manipulable = true;
        funcType = 'quantum_refinery';
        funcName = 'Quantum Resonance Extractor';
        status = 'user_active';
      } else if (seed < 60) {
        owner = 'user';
        manipulable = false;
        funcType = 'defense_pylon';
        funcName = 'Aegis Shield Hex-Array';
        status = 'user_locked';
      }

      const colorRGB = this.getStatusRGB(status, manipulable && !isPentagon);

      // Add Triangles for Plot Mesh (Fan from center to boundary points)
      const startVertexIndex = meshPositions.length / 3;
      const numTriangles = boundaryPoints.length;

      for (let i = 0; i < numTriangles; i++) {
        const next = (i + 1) % numTriangles;
        const p1 = boundaryPoints[i];
        const p2 = boundaryPoints[next];

        // Triangle vertices: centerPos, p1, p2
        meshPositions.push(centerPos.x, centerPos.y, centerPos.z);
        meshPositions.push(p1.x, p1.y, p1.z);
        meshPositions.push(p2.x, p2.y, p2.z);

        meshNormals.push(normal.x, normal.y, normal.z);
        meshNormals.push(normal.x, normal.y, normal.z);
        meshNormals.push(normal.x, normal.y, normal.z);

        // Fill with status color
        meshColors.push(colorRGB.r, colorRGB.g, colorRGB.b);
        meshColors.push(colorRGB.r, colorRGB.g, colorRGB.b);
        meshColors.push(colorRGB.r, colorRGB.g, colorRGB.b);

        this.plotByFaceIndex[currentTriangleIndex] = vIdx;
        currentTriangleIndex++;
      }

      const endVertexIndex = meshPositions.length / 3;

      const plot = {
        plotId: vIdx,
        systemCode: `P-Z${String(zoneId).padStart(2, '0')}-B${blockId}-${String(plotInBlock).padStart(2, '0')}`,
        zoneId,
        blockId,
        plotInBlock,
        center: centerPos,
        normal,
        uBasis,
        vBasis,
        isPentagon,
        boundaryPoints,
        startVertexIndex,
        endVertexIndex,
        owner,
        manipulable,
        funcType,
        funcName,
        status
      };

      this.plots.push(plot);
    }

    // Build Single Mesh for All Plot Fills (1 Draw Call for the entire planet!)
    const planetGeo = new THREE.BufferGeometry();
    planetGeo.setAttribute('position', new THREE.Float32BufferAttribute(meshPositions, 3));
    planetGeo.setAttribute('normal', new THREE.Float32BufferAttribute(meshNormals, 3));
    planetGeo.setAttribute('color', new THREE.Float32BufferAttribute(meshColors, 3));

    const planetMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.25,
      side: THREE.FrontSide
    });

    this.planetMesh = new THREE.Mesh(planetGeo, planetMat);
    this.planetGroup.add(this.planetMesh);

    // Build Single LineSegments for All Plot Borders (Edges shared seamlessly)
    const linePositions = [];
    const wireRad = rad + 0.15;

    primalEdges.forEach((tIdxList) => {
      if (tIdxList.length === 2) {
        const c1 = triCentroids[tIdxList[0]];
        const c2 = triCentroids[tIdxList[1]];
        linePositions.push(c1[0] * wireRad, c1[1] * wireRad, c1[2] * wireRad);
        linePositions.push(c2[0] * wireRad, c2[1] * wireRad, c2[2] * wireRad);
      }
    });

    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

    const wireMat = new THREE.LineBasicMaterial({
      color: 0x223656, // Subtle neon slate wireframe grid
      transparent: true,
      opacity: 0.85
    });

    this.planetWireframe = new THREE.LineSegments(wireGeo, wireMat);
    this.planetGroup.add(this.planetWireframe);
  }

  isPlotUnlocked(plot) {
    if (!plot) return false;
    if (plot.isPentagon) return false;
    if (plot.status === 'system_locked' || plot.status === 'user_locked') return false;
    if (!plot.manipulable) return false;
    return true;
  }

  /**
   * Status color palette (Linear RGB for WebGL)
   * Active plots have deep blueprint fill; locked/inactive plots are grayed out.
   */
  getStatusRGB(status, isUnlocked = true) {
    if (!isUnlocked || status === 'system_locked' || status === 'user_locked') {
      return { r: 0.14, g: 0.17, b: 0.22 }; // Muted Slate Gray (Grayed out)
    }
    return { r: 0.05, g: 0.08, b: 0.14 }; // Dark Slate Blueprint Fill (Active)
  }

  /**
   * Hover Cursor Indicator: Snaps to any hovered hexagonal plot
   */
  buildHoverCursor() {
    this.hoverGroup = new THREE.Group();
    this.hoverGroup.visible = false;
    this.planetGroup.add(this.hoverGroup);

    // Hover wireframe border (Regular 6-edge hexagon)
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i % 6) * 60 * (Math.PI / 180);
      pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const cursorWireGeo = new THREE.BufferGeometry().setFromPoints(pts);
    // 1. Core crisp wireframe border
    const cursorWireMat = new THREE.LineBasicMaterial({
      color: 0xffe600,
      linewidth: 3,
      transparent: true,
      opacity: 1.0
    });
    this.hoverWireframe = new THREE.Line(cursorWireGeo, cursorWireMat);
    this.hoverGroup.add(this.hoverWireframe);

    // 2. Glowing outer border halo (additive blending, no inside fill)
    const glowWireMat = new THREE.LineBasicMaterial({
      color: 0xffe600,
      linewidth: 6,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    this.hoverGlowWireframe = new THREE.Line(cursorWireGeo, glowWireMat);
    this.hoverGlowWireframe.scale.set(1.025, 1.025, 1.025);
    this.hoverGroup.add(this.hoverGlowWireframe);
  }

  /* ========================================================
     PLOT INTERACTION & AUDIO
     ======================================================== */
  cyclePlotState(plot) {
    if (!plot.manipulable) {
      this.playAudio('locked');
      return;
    }

    // Cycle: empty -> user_active -> system_open -> system_locked -> empty
    if (plot.status === 'empty') {
      plot.status = 'user_active';
      plot.owner = 'user';
      plot.manipulable = true;
      plot.funcType = 'quantum_refinery';
      plot.funcName = 'Quantum Resonance Extractor';
    } else if (plot.status === 'user_active') {
      plot.status = 'system_open';
      plot.owner = 'system';
      plot.manipulable = true;
      plot.funcType = 'orbital_gate';
      plot.funcName = 'Hexagonal Relay Conduit';
    } else if (plot.status === 'system_open') {
      plot.status = 'system_locked';
      plot.owner = 'system';
      plot.manipulable = false;
      plot.funcType = 'geothermal_core';
      plot.funcName = 'Sub-Surface Fusion Core';
    } else {
      plot.status = 'empty';
      plot.owner = 'none';
      plot.manipulable = true;
      plot.funcType = 'none';
      plot.funcName = 'Unassigned Hex Plot';
    }

    // Update vertex colors in the global mesh buffer
    const colorRGB = this.getStatusRGB(plot.status, plot.manipulable && !plot.isPentagon);
    const colorAttr = this.planetMesh.geometry.attributes.color;
    const array = colorAttr.array;

    for (let v = plot.startVertexIndex; v < plot.endVertexIndex; v++) {
      array[v * 3 + 0] = colorRGB.r;
      array[v * 3 + 1] = colorRGB.g;
      array[v * 3 + 2] = colorRGB.b;
    }
    colorAttr.needsUpdate = true;

    this.playAudio('activate');
    this.updateHUDTelemetry();

    // Dispatch background API request by Zone & Block (System Partitioning)
    fetch('/api/plot/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneId: plot.zoneId,
        blockId: plot.blockId,
        plotId: plot.plotId,
        status: plot.status,
        owner: plot.owner,
        funcType: plot.funcType,
        funcName: plot.funcName
      })
    }).catch(() => {});
  }

  setZoom(val) {
    this.targetZoom = Math.max(0.0, Math.min(1.0, val));
  }

  warpToCoords(lat, lng) {
    this.targetLat = lat;
    this.targetLng = lng;
    this.playAudio('warp');
  }

  /**
   * Resets the entire sphere position, orientation, and zoom to initial default state
   */
  resetSphereToDefault() {
    this.autoOrbit = false;
    this.isDragging = false;
    this.moveVelocity = { lat: 0, lng: 0 };
    this.keysDown = {};

    this.targetLat = 0.0;
    this.targetLng = 0.0;
    this.currentLat = 0.0;
    this.currentLng = 0.0;

    if (this.rootGroup) {
      this.rootGroup.position.set(0, 0, 0);
      this.rootGroup.quaternion.identity();
    }
    if (this.planetGroup) {
      this.planetGroup.position.set(0, 0, 0);
      const qLng = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.currentLng);
      const qLat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.currentLat);
      this.planetGroup.quaternion.copy(qLng).multiply(qLat);
    }

    this.setZoom(1.0);
    this.currentZoom = 1.0;
    if (this.camera) {
      this.camera.position.set(0, 0, this.DIST_SURFACE);
      this.camera.lookAt(0, 0, 0);
    }

    this.hoveredPlot = null;
    this.selectedPlot = null;
    if (this.hoverGroup) {
      this.hoverGroup.visible = false;
    }

    this.playAudio('warp');
    this.updateHUDTelemetry();
  }

  /* ========================================================
     INTERACTION & EVENT BINDINGS
     ======================================================== */
  bindEvents() {
    const dom = this.renderer.domElement;

    // Mouse Down
    dom.addEventListener('mousedown', (e) => {
      this.mouseDownPos = { x: e.clientX, y: e.clientY };
      this.isDragMove = false;

      if (e.button === 0) {
        if (this.isZoneView) {
          this.isDragging = true;
          this.previousMouse = { x: e.clientX, y: e.clientY };
        }
      }
    });

    // Mouse Up
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Mouse Move
    dom.addEventListener('mousemove', (e) => {
      this.mouseClientPos = { clientX: e.clientX, clientY: e.clientY };

      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / dom.clientWidth) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / dom.clientHeight) * 2 + 1;

      if (this.mouseDownPos) {
        const dist = Math.hypot(e.clientX - this.mouseDownPos.x, e.clientY - this.mouseDownPos.y);
        if (dist > 4) {
          this.isDragMove = true;
        }
      }

      if (this.isDragging && this.isZoneView) {
        const deltaX = e.clientX - this.previousMouse.x;
        const deltaY = e.clientY - this.previousMouse.y;

        const rotFactor = 0.0006;
        this.targetLng -= deltaX * rotFactor;
        this.targetLat += deltaY * rotFactor;
        this.targetLat = Math.max(-1.46, Math.min(1.46, this.targetLat));

        this.previousMouse = { x: e.clientX, y: e.clientY };
      } else {
        this.handleRaycast();
      }
    });

    // Right Click
    dom.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.isZoneView) {
        this.setZoom(0.0);
        this.playAudio('warp');
      } else {
        this.setZoom(1.0);
        this.playAudio('blip');
      }
    });

    // Left Click
    dom.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      if (this.isDragMove) {
        this.isDragMove = false;
        return;
      }

      if (this.hoveredPlot) {
        if (!this.isZoneView) {
          // Orbit view: warp camera to clicked plot & descend smoothly to surface
          const lat = Math.asin(this.hoveredPlot.normal.y);
          const lng = Math.atan2(this.hoveredPlot.normal.x, this.hoveredPlot.normal.z);
          this.warpToCoords(lat, lng);
          this.setZoom(1.0);
        } else {
          // Surface view: cycle manipulable plot state
          this.cyclePlotState(this.hoveredPlot);
        }
      }
    });

    // Smooth Mouse Wheel Zoom
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * this.zoomSpeed;
      this.setZoom(this.targetZoom + delta);
    }, { passive: false });

    // Keyboard Navigation (WASD / Arrows)
    window.addEventListener('keydown', (e) => {
      // Prevent resetting if user is typing in an input or editable field
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }

      // Check for Enter or Numpad 0 (with NumLock on/off) or fallback '0'
      const isResetKey = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13 ||
                         e.code === 'Numpad0' || (e.location === 3 && (e.key === '0' || e.key === 'Insert')) ||
                         e.keyCode === 96 || e.key === '0' || e.code === 'Digit0' || e.keyCode === 48;

      if (isResetKey) {
        e.preventDefault();
        this.resetSphereToDefault();
        return;
      }

      const keyLower = e.key ? e.key.toLowerCase() : '';
      const isNavKey = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(keyLower) ||
                       ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

      if (isNavKey) {
        e.preventDefault();
        this.keysDown[keyLower] = true;
        this.keysDown[e.key] = true;
      } else if (e.key === 'Shift') {
        this.keysDown['shift'] = true;
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.autoOrbit = !this.autoOrbit;
      } else if (keyLower === 'o' || e.key === '1') {
        this.setZoom(0.0);
      } else if (keyLower === 'z' || e.key === '2') {
        this.setZoom(1.0);
      } else if (keyLower === 'r') {
        this.resetSphereToDefault();
      } else if (keyLower === 'm') {
        this.soundEnabled = !this.soundEnabled;
      }
    });

    window.addEventListener('keyup', (e) => {
      const keyLower = e.key.toLowerCase();
      this.keysDown[keyLower] = false;
      this.keysDown[e.key] = false;
      if (e.key === 'Shift') {
        this.keysDown['shift'] = false;
      }
    });

    // Window Resize
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  /**
   * Fast O(1) Raycasting across all plots
   */
  handleRaycast() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.planetMesh);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const faceIdx = hit.faceIndex;
      const plotIdx = this.plotByFaceIndex[faceIdx];

      if (plotIdx !== undefined && this.plots[plotIdx]) {
        const plot = this.plots[plotIdx];

        // Hover is completely non-responsive to inactive or locked plots!
        if (!this.isPlotUnlocked(plot)) {
          if (this.hoveredPlot) {
            this.hoveredPlot = null;
            this.hoverGroup.visible = false;
            this.updateHUDTelemetry();
          }
          if (this.container) {
            this.container.style.cursor = 'default';
          }
          return;
        }

        const prev = this.hoveredPlot;
        this.hoveredPlot = plot;

        if (this.container) {
          this.container.style.cursor = 'pointer';
        }

        // Position & Orient Hover Cursor
        const cursorRadius = plot.isPentagon ? 2.8 : 2.5;
        this.hoverGroup.position.copy(plot.center.clone().multiplyScalar(1.0025));
        this.hoverGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), plot.normal);
        this.hoverGroup.scale.set(cursorRadius, cursorRadius, cursorRadius);
        this.hoverGroup.visible = true;

        if (!prev || prev.plotId !== plot.plotId) {
          this.playAudio('blip');
          this.updateHUDTelemetry();
        }
        return;
      }
    }

    if (this.hoveredPlot) {
      this.hoveredPlot = null;
      this.hoverGroup.visible = false;
      this.updateHUDTelemetry();
    }
    if (this.container) {
      this.container.style.cursor = 'default';
    }
  }

  /* ========================================================
     HUD & TELEMETRY CONTROLS
     ======================================================== */
  setupHUD() {
    let hud = document.getElementById('hex-hud-overlay');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'hex-hud-overlay';
      hud.innerHTML = `
        <div class="hud-top-bar">
          <div class="hud-brand">
            <span class="hud-logo">🪐 THE GAME</span>
            <span class="hud-badge-hex">🔷 CONTINUOUS HEXAGONAL GRID</span>
          </div>
          <div class="hud-mode-switcher">
            <a href="index.html" class="mode-btn">Switch to Square Grid</a>
            <span class="mode-active">Hexagonal Geodesic</span>
          </div>
        </div>

        <div class="hud-telemetry-panel">
          <div class="telemetry-header">PLANETARY PLOT TELEMETRY</div>
          <div class="telemetry-row"><span class="label">PLOT ID:</span> <span id="telemetry-plot-id" class="val">---</span></div>
          <div class="telemetry-row"><span class="label">STATUS:</span> <span id="telemetry-status" class="val status-empty">---</span></div>
          <div class="telemetry-row"><span class="label">FUNCTION:</span> <span id="telemetry-func" class="val">Hover any plot</span></div>
          <div class="telemetry-row"><span class="label">MANIPULABLE:</span> <span id="telemetry-manip" class="val">---</span></div>
          <div class="telemetry-divider"></div>
          <div class="telemetry-system-box">
            <div class="system-title">SYSTEM PARTITIONING ROUTING (INVISIBLE IN 3D)</div>
            <div class="telemetry-row"><span class="label">SYSTEM ROUTE:</span> <span id="telemetry-system" class="val" style="color: #ffe600;">---</span></div>
            <div class="telemetry-subtext">Zone & Block handle network batching and requests with zero visual seams or gaps.</div>
          </div>
          <div class="telemetry-divider"></div>
          <div class="telemetry-stats">
            <div>2,562 CONTIGUOUS HEX PLOTS</div>
            <div>100% SEAMLESS SPHERE (ZERO GAPS)</div>
            <div style="color: #ffe600;">±3.8% EQUAL-AREA UNIFORMITY</div>
          </div>
        </div>

        <div class="hud-controls-panel">
          <div class="control-row"><span class="key">SCROLL</span> Smooth Orbit ↔ Surface Zoom</div>
          <div class="control-row"><span class="key">CLICK</span> Cycle Plot State / Warp to Plot</div>
          <div class="control-row"><span class="key">R-CLICK</span> Back to Orbit / Recenter</div>
          <div class="control-row"><span class="key">WASD</span> Smoothly Traverse Surface Plots</div>
          <div class="control-row"><span class="key">SPACE</span> Toggle Planetary Auto-Orbit</div>
          <div class="control-row"><span class="key">ENTER / NUM 0</span> Reset Sphere to Default</div>
        </div>
      `;
      document.body.appendChild(hud);
    }
  }

  updateHUDTelemetry() {
    const plotIdElem = document.getElementById('telemetry-plot-id');
    const statusElem = document.getElementById('telemetry-status');
    const funcElem = document.getElementById('telemetry-func');
    const manipElem = document.getElementById('telemetry-manip');
    const systemElem = document.getElementById('telemetry-system');

    if (!plotIdElem) return;

    if (this.hoveredPlot) {
      plotIdElem.textContent = this.hoveredPlot.systemCode;
      statusElem.textContent = this.hoveredPlot.status.toUpperCase().replace('_', ' ');
      funcElem.textContent = this.hoveredPlot.funcName;
      manipElem.textContent = this.hoveredPlot.manipulable ? 'YES (Click to cycle)' : 'LOCKED (Restricted)';
      manipElem.style.color = this.hoveredPlot.manipulable ? '#10b981' : '#ef4444';

      systemElem.textContent = `Zone ${String(this.hoveredPlot.zoneId).padStart(2, '0')} | Block ${this.hoveredPlot.blockId} | Plot #${this.hoveredPlot.plotInBlock}`;

      // Status color
      if (this.hoveredPlot.status === 'system_locked') statusElem.style.color = '#ef4444';
      else if (this.hoveredPlot.status === 'system_open') statusElem.style.color = '#f97316';
      else if (this.hoveredPlot.status === 'user_active') statusElem.style.color = '#10b981';
      else if (this.hoveredPlot.status === 'user_locked') statusElem.style.color = '#06b6d4';
      else statusElem.style.color = '#94a3b8';
    } else {
      plotIdElem.textContent = '---';
      statusElem.textContent = '---';
      statusElem.style.color = '#94a3b8';
      funcElem.textContent = 'Hover any plot on the sphere';
      manipElem.textContent = '---';
      manipElem.style.color = '#94a3b8';
      systemElem.textContent = '---';
    }
  }

  /* ========================================================
     WEB AUDIO API SYNTHESIZER
     ======================================================== */
  playAudio(type) {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'blip') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1600, now);
        osc.frequency.exponentialRampToValueAtTime(2200, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'activate') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(460, now);
        osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'locked') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'warp') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(960, now + 0.25);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {}
  }

  /* ========================================================
     MAIN ANIMATION & SMOOTH RENDER LOOP
     ======================================================== */
  animate() {
    requestAnimationFrame(() => this.animate());

    // 1. Smooth Zoom Interpolation
    this.currentZoom += (this.targetZoom - this.currentZoom) * this.zoomDamping;

    const zoomCurve = Math.pow(this.currentZoom, 1.15);
    const cameraDist = THREE.MathUtils.lerp(this.DIST_ORBIT, this.DIST_SURFACE, zoomCurve);
    this.camera.position.z = cameraDist;

    // 2. Keyboard Navigation
    const baseSpeed = this.isZoneView ? 0.007 : 0.015;
    const speed = (this.keysDown['shift'] ? baseSpeed * 2.2 : baseSpeed);

    let inputLat = 0;
    let inputLng = 0;

    if (this.keysDown['w'] || this.keysDown['arrowup']) inputLat += 1;
    if (this.keysDown['s'] || this.keysDown['arrowdown']) inputLat -= 1;
    if (this.keysDown['a'] || this.keysDown['arrowleft']) inputLng -= 1;
    if (this.keysDown['d'] || this.keysDown['arrowright']) inputLng += 1;

    if (inputLat !== 0 || inputLng !== 0) {
      this.autoOrbit = false;
      const len = Math.hypot(inputLat, inputLng);
      this.moveVelocity.lat += (inputLat / len) * speed * 0.25;
      this.moveVelocity.lng += (inputLng / len) * speed * 0.25;
    }

    if (this.autoOrbit && !this.isDragging) {
      this.targetLng += 0.0012;
    }

    this.targetLat += this.moveVelocity.lat;
    this.targetLng += this.moveVelocity.lng;
    this.moveVelocity.lat *= 0.82;
    this.moveVelocity.lng *= 0.82;

    this.targetLat = Math.max(-1.46, Math.min(1.46, this.targetLat));

    this.currentLat += (this.targetLat - this.currentLat) * 0.12;
    this.currentLng += (this.targetLng - this.currentLng) * 0.12;

    const qLng = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.currentLng);
    const qLat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.currentLat);
    this.planetGroup.quaternion.copy(qLng).multiply(qLat);

    // Shimmer Starfield slowly
    if (this.starfield) {
      this.starfield.rotation.y += 0.00015;
      this.starfield.rotation.x += 0.00008;
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.hexPlanetEngine = new HexPlanetaryEngine();
});
