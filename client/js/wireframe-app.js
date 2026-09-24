/**
 * The Game - Planetary Grid Architecture Engine
 * Unified 3D Spherical Working Ground with Seamless Smooth Zoom
 * 
 * Hierarchy: Planet (Sphere) > Zone (3x3 Blocks) > Block (10x10 Plots) > Plot (Atomic Unit)
 * 120 Contiguous Zones covering 100% of the planetary globe (10 Latitude Rows x 12 Longitude Columns)
 */

class PlanetaryGameEngine {
  constructor() {
    this.container = document.getElementById('canvas-container');
    
    // Core Constants
    this.PLANET_RADIUS = 100.0;
    this.TOTAL_ZONES = 120;
    this.NUM_LAT_ROWS = 10;
    this.NUM_LNG_COLS = 12;
    
    // Camera Distance Range
    this.DIST_ORBIT = 290.0;     // Full planet in cosmic void
    this.DIST_SURFACE = 114.7;   // Focused on primary block with neighbor blocks partially visible
    
    // Zoom state (0.0 = Orbit Void, 1.0 = Surface Block View)
    this.targetZoom = 1.0;
    this.currentZoom = 1.0;
    this.zoomSpeed = 0.0015;
    this.zoomDamping = 0.085;
    
    // Navigation / Dragging state
    this.isDragging = false;
    this.isDragMove = false;
    this.mouseDownPos = { x: 0, y: 0 };
    this.previousMouse = { x: 0, y: 0 };
    this.mouseClientPos = { clientX: 0, clientY: 0 };
    this.lastHoveredZoneMesh = null;
    this.hoveredZoneId = null;
    this.autoOrbit = false;
    this.soundEnabled = true;

    // Spherical Navigation Coordinates (Latitude & Longitude in radians)
    // Starting focused near equator (Zone 66)
    this.currentLat = 0.157;
    this.currentLng = 0.261;
    this.targetLat = 0.157;
    this.targetLng = 0.261;
    this.moveVelocity = { lat: 0, lng: 0 };
    this.keysDown = {};
    
    // Initial Unlocked Zone and Block configuration
    this.initialZoneId = 66; // Initial active sector
    this.initialBlockCoord = { r: 1, c: 1 }; // [1,1] is the ONLY unlocked initial block
    this.activeZoneId = 66; // Centered equatorial sector
    this.activeBlockCoord = { r: 1, c: 1 }; // [1,1] is primary center block
    this.hoveredPlot = null;
    this.selectedPlot = null;

    // Core Accent (Yellow)
    this.CORE_ACCENT = 0xffe600;
    this.CORE_ACCENT_STR = '#ffe600';

    // Plot Visuals
    this.PLOT_FILL_COLOR = '#0c1424';      // Active unlocked plot fill (deep blueprint navy)
    this.PLOT_BORDER_COLOR = '#203047';    // Active unlocked plot border

    // Grayed out Plot Visuals (For inactive / locked zones & blocks)
    this.PLOT_GRAYED_FILL = '#232a36';     // Inactive / locked plot fill (muted slate gray)
    this.PLOT_GRAYED_BORDER = '#3e4756';   // Inactive / locked plot border

    this.PLOT_HOVER_BORDER = '#ffe600';    // Glowing hover border
    
    // Audio Synth
    this.audioCtx = null;
    
    // Data stores
    this.zonesData = [];
    this.blocksData = {}; // Cache for active zone blocks
    
    // Three.js instances
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-1000, -1000);
    
    // 3D Groups
    this.rootGroup = null;
    this.planetGroup = null;
    this.atmosphereMesh = null;
    this.zoneMarkersGroup = null;
    this.activeZoneGroup = null;
    this.starfield = null;
    
    // Zone & Block meshes
    this.zoneSurfaceMeshes = [];
    this.blockMeshes = [];
    this.blockCanvases = {};
    this.blockTextures = {};
    
    this.init();
  }

  isZoneLocked(zoneId) {
    return Number(zoneId) !== this.initialZoneId;
  }

  isBlockLocked(zoneId, bRow, bCol) {
    if (this.isZoneLocked(zoneId)) return true;
    return !(Number(bRow) === this.initialBlockCoord.r && Number(bCol) === this.initialBlockCoord.c);
  }

  get isZoneView() {
    return this.currentZoom >= 0.45;
  }

  async init() {
    this.initThree();
    this.initCosmicVoid();
    this.initPlanetSphere();
    this.initZonesData();
    this.buildActiveZoneSurface(true);
    this.setupHUD();
    this.bindEvents();
    this.animate();
    
    // Try fetching live zones and block data from server
    this.fetchServerData();
  }

  /* ========================================================
     THREE.JS SETUP & COSMIC SCENE
     ======================================================== */
  initThree() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050814); // Dark Cosmic Void

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 3500);
    this.camera.position.set(0, 0, this.DIST_SURFACE);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // Root Group
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.planetGroup = new THREE.Group();
    this.rootGroup.add(this.planetGroup);

    // Lighting
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.75);
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
      const r = 500 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      sizes[i] = Math.random() * 2.5 + 0.8;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });

    this.starfield = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starfield);
  }

  /**
   * Planet Core Sphere + Geodesic Wireframe + Atmospheric Rim Glow
   */
  initPlanetSphere() {
    // 1. Dark Planetary Core
    const coreGeo = new THREE.SphereGeometry(this.PLANET_RADIUS - 0.2, 64, 48);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x070c1e,
      roughness: 0.85,
      metalness: 0.15
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.planetGroup.add(this.coreMesh);

    // 2. Yellow Geodesic Wireframe Grid (Planetary Matrix)
    const wireGeo = new THREE.SphereGeometry(this.PLANET_RADIUS + 0.05, 36, 24);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffe600,
      wireframe: true,
      transparent: true,
      opacity: 0.14
    });
    this.wireMesh = new THREE.Mesh(wireGeo, wireMat);
    this.planetGroup.add(this.wireMesh);

    // 3. Glowing Atmospheric Rim Layer (Golden Cyber Glow)
    const atmoGeo = new THREE.SphereGeometry(this.PLANET_RADIUS + 2.8, 48, 48);
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
          rim = pow(rim, 2.8);
          vec3 atmoColor = mix(vec3(1.0, 0.90, 0.0), vec3(0.98, 0.65, 0.12), rim);
          gl_FragColor = vec4(atmoColor, rim * 0.45);
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
     ZONE DISTRIBUTION & FULL PLANETARY COVERAGE
     100% spherical surface is tessellated with 120 contiguous zones
     ======================================================== */
  initZonesData() {
    this.zonesData = [];
    this.zoneSurfaceMeshes = [];
    this.zoneMarkersGroup = new THREE.Group();
    this.planetGroup.add(this.zoneMarkersGroup);

    const dLat = Math.PI / this.NUM_LAT_ROWS;
    const dLng = (2 * Math.PI) / this.NUM_LNG_COLS;

    for (let r = 0; r < this.NUM_LAT_ROWS; r++) {
      const latMin = -Math.PI / 2 + r * dLat;
      const latMax = -Math.PI / 2 + (r + 1) * dLat;
      const latMid = (latMin + latMax) / 2;

      for (let c = 0; c < this.NUM_LNG_COLS; c++) {
        const id = r * this.NUM_LNG_COLS + c;
        const lngMin = -Math.PI + c * dLng;
        const lngMax = -Math.PI + (c + 1) * dLng;
        const lngMid = (lngMin + lngMax) / 2;

        // Normal at center of zone
        const nx = Math.cos(latMid) * Math.sin(lngMid);
        const ny = Math.sin(latMid);
        const nz = Math.cos(latMid) * Math.cos(lngMid);
        const normal = new THREE.Vector3(nx, ny, nz).normalize();

        // East tangent vector (increasing longitude)
        const uBasis = new THREE.Vector3(Math.cos(lngMid), 0, -Math.sin(lngMid)).normalize();
        // North tangent vector (increasing latitude)
        const vBasis = new THREE.Vector3().crossVectors(normal, uBasis).normalize();

        const isLocked = this.isZoneLocked(id);
        const controlledBy = isLocked ? "Locked-Sector" : "Active-Frontier";
        const colorHex = isLocked ? 0x243246 : 0xffe600;

        const zone = {
          id,
          code: `Z-${String(id).padStart(3, '0')}`,
          name: isLocked ? `Locked-Sector-${String.fromCharCode(65 + (id % 26))}${Math.floor(id / 26) + 1}` : `Sector-Alpha (Prime)`,
          isLocked,
          row: r,
          col: c,
          latMin,
          latMax,
          latMid,
          lngMin,
          lngMax,
          lngMid,
          normal,
          uBasis,
          vBasis,
          controlledBy,
          colorHex,
          coords: {
            lat: (latMid * (180 / Math.PI)).toFixed(1),
            lng: (lngMid * (180 / Math.PI)).toFixed(1)
          }
        };

        this.zonesData.push(zone);

        // 1. Zone Surface Quad Patch (tessellating the globe)
        const surfaceMesh = this.createZoneSurfaceMesh(zone);
        this.zoneMarkersGroup.add(surfaceMesh);
        this.zoneSurfaceMeshes.push(surfaceMesh);

        // 2. Zone Boundary Frame on Sphere Surface (Neon glow lines)
        const boundaryLine = this.createZoneBoundaryLine(zone);
        this.zoneMarkersGroup.add(boundaryLine);

      }
    }
  }

  /**
   * Retrieves or generates a cached canvas texture for a zone
   * Repeating 3x3 blocks and 10x10 plots across the sphere
   */
  getZoneTexture(zone) {
    if (!this.zoneTextureCache) {
      this.zoneTextureCache = {};
    }
    const isLocked = this.isZoneLocked(zone.id);
    const cacheKey = isLocked ? 'locked_zone_texture' : 'unlocked_zone_texture';

    if (!this.zoneTextureCache[cacheKey]) {
      this.zoneTextureCache[cacheKey] = this.generateZoneTexture(isLocked);
    }
    return this.zoneTextureCache[cacheKey];
  }

  /**
   * Generates a 1024x1024 canvas texture showing 3x3 blocks and 10x10 plots
   * All plots have the EXACT SAME uniform color.
   * Locked zones have faded, dimmed graphics.
   */
  generateZoneTexture(isLocked) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 1. Zone Background Fill
    ctx.fillStyle = isLocked ? '#040711' : '#070f20';
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. Zone Outer Border (Faded for locked zones, bright neon yellow for unlocked zone)
    ctx.strokeStyle = isLocked ? 'rgba(36, 50, 70, 0.45)' : '#ffe600';
    ctx.lineWidth = isLocked ? 4 : 8;
    ctx.strokeRect(4, 4, 1016, 1016);

    // 3. 3x3 Blocks with 10x10 Plots per Block
    const outerPad = 14;
    const blockGap = 10;
    const blockSize = 324;

    for (let br = 0; br < 3; br++) {
      const by = outerPad + br * (blockSize + blockGap);
      for (let bc = 0; bc < 3; bc++) {
        const bx = outerPad + bc * (blockSize + blockGap);
        const isCenter = (br === 1 && bc === 1);
        const isBlockLocked = isLocked || !isCenter;

        // Block background
        ctx.fillStyle = isBlockLocked ? '#141820' : '#09152b';
        ctx.fillRect(bx, by, blockSize, blockSize);

        // Block border (Core yellow for unlocked center block, muted gray for locked blocks)
        ctx.strokeStyle = isBlockLocked ? 'rgba(71, 85, 105, 0.4)' : '#ffe600';
        ctx.lineWidth = isBlockLocked ? 2 : 4;
        ctx.strokeRect(bx, by, blockSize, blockSize);

        // 10x10 Plots inside Block - Active plots are blueprint navy, locked plots are grayed out
        const plotPad = 8;
        const plotArea = blockSize - plotPad * 2;
        const cellStep = plotArea / 10;
        const cellGap = 1.5;
        const cellW = cellStep - cellGap * 2;
        const cellH = cellStep - cellGap * 2;

        for (let pr = 0; pr < 10; pr++) {
          for (let pc = 0; pc < 10; pc++) {
            const px = bx + plotPad + pc * cellStep + cellGap;
            const py = by + plotPad + pr * cellStep + cellGap;

            // Plot fill (Grayed out for locked/inactive, blueprint navy for unlocked)
            ctx.fillStyle = isBlockLocked ? this.PLOT_GRAYED_FILL : this.PLOT_FILL_COLOR;
            ctx.fillRect(px, py, cellW, cellH);

            // Plot border (Muted gray for locked/inactive, cyber navy for unlocked)
            ctx.strokeStyle = isBlockLocked ? this.PLOT_GRAYED_BORDER : this.PLOT_BORDER_COLOR;
            ctx.lineWidth = 1;
            ctx.strokeRect(px, py, cellW, cellH);
          }
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    return texture;
  }

  /**
   * Curved spherical surface patch for each zone repeating 3x3 blocks and 10x10 plots
   */
  createZoneSurfaceMesh(zone) {
    const segsLng = 8;
    const segsLat = 8;
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const rad = this.PLANET_RADIUS + 0.25;

    for (let j = 0; j <= segsLat; j++) {
      const v = j / segsLat;
      const lat = zone.latMin + v * (zone.latMax - zone.latMin);
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      for (let i = 0; i <= segsLng; i++) {
        const u = i / segsLng;
        const lng = zone.lngMin + u * (zone.lngMax - zone.lngMin);
        const cosLng = Math.cos(lng);
        const sinLng = Math.sin(lng);

        const x = rad * cosLat * sinLng;
        const y = rad * sinLat;
        const z = rad * cosLat * cosLng;

        positions.push(x, y, z);
        normals.push(cosLat * sinLng, sinLat, cosLat * cosLng);
        uvs.push(u, v);
      }
    }

    const rowSize = segsLng + 1;
    for (let j = 0; j < segsLat; j++) {
      for (let i = 0; i < segsLng; i++) {
        const a = j * rowSize + i;
        const b = (j + 1) * rowSize + i;
        const c = (j + 1) * rowSize + (i + 1);
        const d = j * rowSize + (i + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    const isLocked = this.isZoneLocked(zone.id);
    const mat = new THREE.MeshStandardMaterial({
      map: this.getZoneTexture(zone),
      roughness: isLocked ? 0.95 : 0.45,
      metalness: isLocked ? 0.05 : 0.25,
      color: isLocked ? new THREE.Color(0x3e495a) : new THREE.Color(0xffffff),
      transparent: isLocked,
      opacity: isLocked ? 0.42 : 1.0,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { zoneId: zone.id, zone, isZoneSurface: true };
    return mesh;
  }

  /**
   * Curved neon boundary frame along the 4 borders of the zone
   */
  createZoneBoundaryLine(zone) {
    const points = [];
    const segs = 6;
    const rad = this.PLANET_RADIUS + 0.35;

    // Edge 1: South (latMin, lng from lngMin to lngMax)
    for (let s = 0; s <= segs; s++) {
      const lng = zone.lngMin + (s / segs) * (zone.lngMax - zone.lngMin);
      const lat = zone.latMin;
      points.push(new THREE.Vector3(
        rad * Math.cos(lat) * Math.sin(lng),
        rad * Math.sin(lat),
        rad * Math.cos(lat) * Math.cos(lng)
      ));
    }
    // Edge 2: East (lngMax, lat from latMin to latMax)
    for (let s = 1; s <= segs; s++) {
      const lat = zone.latMin + (s / segs) * (zone.latMax - zone.latMin);
      const lng = zone.lngMax;
      points.push(new THREE.Vector3(
        rad * Math.cos(lat) * Math.sin(lng),
        rad * Math.sin(lat),
        rad * Math.cos(lat) * Math.cos(lng)
      ));
    }
    // Edge 3: North (latMax, lng from lngMax down to lngMin)
    for (let s = 1; s <= segs; s++) {
      const lng = zone.lngMax - (s / segs) * (zone.lngMax - zone.lngMin);
      const lat = zone.latMax;
      points.push(new THREE.Vector3(
        rad * Math.cos(lat) * Math.sin(lng),
        rad * Math.sin(lat),
        rad * Math.cos(lat) * Math.cos(lng)
      ));
    }
    // Edge 4: West (lngMin, lat from latMax down to latMin)
    for (let s = 1; s <= segs; s++) {
      const lat = zone.latMax - (s / segs) * (zone.latMax - zone.latMin);
      const lng = zone.lngMin;
      points.push(new THREE.Vector3(
        rad * Math.cos(lat) * Math.sin(lng),
        rad * Math.sin(lat),
        rad * Math.cos(lat) * Math.cos(lng)
      ));
    }

    const isLocked = this.isZoneLocked(zone.id);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: isLocked ? 0x223348 : 0xffe600,
      transparent: true,
      opacity: isLocked ? 0.18 : 0.95,
      linewidth: isLocked ? 1 : 3
    });

    const line = new THREE.Line(geo, mat);
    line.userData = { zoneId: zone.id };
    return line;
  }

  /**
   * Zone Center Beacon disabled to keep sphere pure geometric wireframe without text
   */
  createZoneBeacon(zone) {
    return null;
  }

  /* ========================================================
     THE ACTIVE WORKING GROUND (3x3 BLOCKS & 100 PLOTS)
     Spherical Curvature Distortion Engine for Surface Mode
     ======================================================== */
  buildActiveZoneSurface(realign = true) {
    if (this.activeZoneGroup) {
      this.activeZoneGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      this.planetGroup.remove(this.activeZoneGroup);
    }

    this.activeZoneGroup = new THREE.Group();
    this.planetGroup.add(this.activeZoneGroup);
    this.blockMeshes = [];

    const zone = this.zonesData[this.activeZoneId];
    if (!zone) return;

    // A zone contains 3x3 blocks:
    // bRow = 0 (North), 1 (Center), 2 (South)
    // bCol = 0 (West),  1 (Center), 2 (East)
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const isCenter = (br === 1 && bc === 1);
        const blockMesh = this.createCurvedBlockMesh(zone, br, bc, isCenter);
        this.activeZoneGroup.add(blockMesh);
        this.blockMeshes.push(blockMesh);

        // 3D Amber Wireframe Border line along the 4 curved edges
        const borderLine = this.createBlockBorderLine(zone, br, bc, isCenter);
        this.activeZoneGroup.add(borderLine);

      }
    }

    if (realign) {
      this.alignCameraToZone(zone);
    }
  }

  /**
   * Creates a 3D curved block mesh matching the zone's spherical sector
   */
  createCurvedBlockMesh(zone, bRow, bCol, isCenter) {
    const subdivisions = 8;
    const geo = new THREE.PlaneGeometry(1, 1, subdivisions, subdivisions);

    const dLat = (zone.latMax - zone.latMin) / 3;
    const dLng = (zone.lngMax - zone.lngMin) / 3;

    // bRow = 0 (North), 1 (Center), 2 (South)
    const bLatMin = zone.latMin + (2 - bRow) * dLat;
    const bLatMax = zone.latMin + (3 - bRow) * dLat;
    // bCol = 0 (West), 1 (Center), 2 (East)
    const bLngMin = zone.lngMin + bCol * dLng;
    const bLngMax = zone.lngMin + (bCol + 1) * dLng;

    const rad = this.PLANET_RADIUS + 0.45;
    const posAttr = geo.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      const px = posAttr.getX(i);
      const py = posAttr.getY(i);

      // u: 0..1 (West to East), v: 0..1 (South to North)
      const u = px + 0.5;
      const v = py + 0.5;

      const lat = bLatMin + v * (bLatMax - bLatMin);
      const lng = bLngMin + u * (bLngMax - bLngMin);

      const x = rad * Math.cos(lat) * Math.sin(lng);
      const y = rad * Math.sin(lat);
      const z = rad * Math.cos(lat) * Math.cos(lng);

      posAttr.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();

    // High-resolution Canvas Texture for 10x10 plots and coordinate numbers
    const blockKey = `${zone.id}_${bRow}_${bCol}`;
    let canvas = this.blockCanvases[blockKey];
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      this.blockCanvases[blockKey] = canvas;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    this.blockTextures[blockKey] = texture;

    // Draw plots onto canvas
    this.renderBlockCanvas(zone.id, bRow, bCol, isCenter);

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = {
      zoneId: zone.id,
      bRow,
      bCol,
      isCenter,
      blockKey,
      bLatMin,
      bLatMax,
      bLngMin,
      bLngMax
    };

    return mesh;
  }

  /**
   * 3D Curved Core Yellow Wireframe Border for Block
   */
  createBlockBorderLine(zone, bRow, bCol, isCenter) {
    const dLat = (zone.latMax - zone.latMin) / 3;
    const dLng = (zone.lngMax - zone.lngMin) / 3;

    const bLatMin = zone.latMin + (2 - bRow) * dLat;
    const bLatMax = zone.latMin + (3 - bRow) * dLat;
    const bLngMin = zone.lngMin + bCol * dLng;
    const bLngMax = zone.lngMin + (bCol + 1) * dLng;

    const points = [];
    const segs = 6;
    const rad = this.PLANET_RADIUS + 0.65;

    // South edge
    for (let s = 0; s <= segs; s++) {
      const lng = bLngMin + (s / segs) * (bLngMax - bLngMin);
      const lat = bLatMin;
      points.push(new THREE.Vector3(
        rad * Math.cos(lat) * Math.sin(lng),
        rad * Math.sin(lat),
        rad * Math.cos(lat) * Math.cos(lng)
      ));
    }
    // East edge
    for (let s = 1; s <= segs; s++) {
      const lat = bLatMin + (s / segs) * (bLatMax - bLatMin);
      const lng = bLngMax;
      points.push(new THREE.Vector3(
        rad * Math.cos(lat) * Math.sin(lng),
        rad * Math.sin(lat),
        rad * Math.cos(lat) * Math.cos(lng)
      ));
    }
    // North edge
    for (let s = 1; s <= segs; s++) {
      const lng = bLngMax - (s / segs) * (bLngMax - bLngMin);
      const lat = bLatMax;
      points.push(new THREE.Vector3(
        rad * Math.cos(lat) * Math.sin(lng),
        rad * Math.sin(lat),
        rad * Math.cos(lat) * Math.cos(lng)
      ));
    }
    // West edge
    for (let s = 1; s <= segs; s++) {
      const lat = bLatMax - (s / segs) * (bLatMax - bLatMin);
      const lng = bLngMin;
      points.push(new THREE.Vector3(
        rad * Math.cos(lat) * Math.sin(lng),
        rad * Math.sin(lat),
        rad * Math.cos(lat) * Math.cos(lng)
      ));
    }

    const isLocked = this.isBlockLocked(zone.id, bRow, bCol);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: isLocked ? 0x334155 : 0xffe600,
      linewidth: isLocked ? 1 : 3,
      transparent: true,
      opacity: isLocked ? 0.35 : 0.95
    });

    return new THREE.Line(geo, mat);
  }

  /**
   * 3D Block Header Tag (Text Sprite floating above block top)
   */
  createBlockHeaderTag(zone, bRow, bCol, isCenter) {
    return null;
  }

  /* ========================================================
     CANVAS RENDERER FOR 10x10 PLOTS WITHIN BLOCK
     ======================================================== */
  renderBlockCanvas(zoneId, bRow, bCol, isCenter) {
    const blockKey = `${zoneId}_${bRow}_${bCol}`;
    const canvas = this.blockCanvases[blockKey];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const isLocked = this.isBlockLocked(zoneId, bRow, bCol);

    // Background: Dark slate-gray for locked blocks, dark navy for unlocked block
    ctx.fillStyle = isLocked ? '#141820' : '#09152b';
    ctx.fillRect(0, 0, width, height);

    // Outer Border: Core Yellow for unlocked initial block, muted gray for locked blocks
    if (!isLocked) {
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, width - 10, height - 10);
    } else {
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 6;
      ctx.strokeRect(5, 5, width - 10, height - 10);
    }

    // Symmetrical Plot Matrix Margins
    const margin = 16;
    const gridW = width - margin * 2;
    const gridH = height - margin * 2;

    const cellSizeX = gridW / 10;
    const cellSizeY = gridH / 10;
    const gap = 3;

    // Get or initialize block data
    let block = this.blocksData[blockKey];
    if (!block) {
      block = this.generateDeterministicBlock(zoneId, bRow, bCol);
      this.blocksData[blockKey] = block;
    }

    // Render 10x10 Plots - Active plots are blueprint navy, locked blocks are grayed out
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const plot = block.plots[r][c];
        const px = margin + c * cellSizeX + gap;
        const py = margin + r * cellSizeY + gap;
        const pw = cellSizeX - gap * 2;
        const ph = cellSizeY - gap * 2;

        const isHovered = !isLocked && this.hoveredPlot &&
          this.hoveredPlot.zoneId === zoneId &&
          this.hoveredPlot.bRow === bRow &&
          this.hoveredPlot.bCol === bCol &&
          this.hoveredPlot.r === r &&
          this.hoveredPlot.c === c;

        this.drawPlotCell(ctx, px, py, pw, ph, plot, isHovered, isLocked);
      }
    }

    // Locked Block Overlay & Emblem (Crisp, sleek center badge that keeps grayed-out plots visible)
    if (isLocked) {
      const cx = width / 2;
      const cy = height / 2;

      ctx.save();
      // Lock emblem background badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.65)';
      ctx.lineWidth = 2.5;
      const bw = 200;
      const bh = 95;
      const radius = 10;

      // Rounded rectangle badge
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2 + radius, cy - bh / 2);
      ctx.lineTo(cx + bw / 2 - radius, cy - bh / 2);
      ctx.quadraticCurveTo(cx + bw / 2, cy - bh / 2, cx + bw / 2, cy - bh / 2 + radius);
      ctx.lineTo(cx + bw / 2, cy + bh / 2 - radius);
      ctx.quadraticCurveTo(cx + bw / 2, cy + bh / 2, cx + bw / 2 - radius, cy + bh / 2);
      ctx.lineTo(cx - bw / 2 + radius, cy + bh / 2);
      ctx.quadraticCurveTo(cx - bw / 2, cy + bh / 2, cx - bw / 2, cy + bh / 2 - radius);
      ctx.lineTo(cx - bw / 2, cy - bh / 2 + radius);
      ctx.quadraticCurveTo(cx - bw / 2, cy - bh / 2, cx - bw / 2 + radius, cy - bh / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Padlock icon
      const lockY = cy - 12;
      // Shackle
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, lockY - 12, 11, Math.PI, 0);
      ctx.stroke();
      // Body
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 16, lockY - 12, 32, 24);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 16, lockY - 12, 32, 24);
      // Keyhole
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cx, lockY - 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // "LOCKED" label
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOCKED', cx, cy + 28);

      ctx.restore();
    }

    if (this.blockTextures[blockKey]) {
      this.blockTextures[blockKey].needsUpdate = true;
    }
  }

  /**
   * Draws a single plot cell with custom fill, borders, and hover state
   * Active unlocked plots have blueprint navy color; locked/inactive plots are grayed out.
   */
  drawPlotCell(ctx, x, y, w, h, plot, isHovered, isBlockLocked) {
    ctx.save();

    // Plot color: grayed out for locked/inactive blocks, blueprint navy for active unlocked block
    const fillColor = isBlockLocked ? this.PLOT_GRAYED_FILL : this.PLOT_FILL_COLOR;
    const borderColor = isBlockLocked ? this.PLOT_GRAYED_BORDER : this.PLOT_BORDER_COLOR;

    // Fill
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);

    // Border (Only active unlocked plots can hover / glow)
    if (isHovered && !isBlockLocked) {
      ctx.save();
      // Outer ambient neon glow
      ctx.strokeStyle = this.PLOT_HOVER_BORDER;
      ctx.shadowColor = this.PLOT_HOVER_BORDER;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(x, y, w, h);

      // Core intense glow
      ctx.shadowBlur = 5;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    } else {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    ctx.restore();
  }

  /**
   * Deterministic plot generator fallback for offline / wireframe mode
   * Uniform plot state across all plots.
   */
  generateDeterministicBlock(zoneId, bRow, bCol) {
    const isLocked = this.isBlockLocked(zoneId, bRow, bCol);
    const plots = [];
    for (let r = 0; r < 10; r++) {
      const row = [];
      for (let c = 0; c < 10; c++) {
        row.push({
          id: `P-Z${zoneId}-B${bRow}${bCol}-R${r}C${c}`,
          zoneId,
          bRow,
          bCol,
          r,
          c,
          owner: isLocked ? 'locked' : 'user',
          manipulable: !isLocked,
          funcType: 'none',
          funcName: isLocked ? 'Locked Plot' : 'Plot',
          status: isLocked ? 'locked' : 'empty',
          powerLevel: 0
        });
      }
      plots.push(row);
    }

    return {
      zoneId,
      bRow,
      bCol,
      isLocked,
      plots
    };
  }

  /* ========================================================
     CAMERA, ZOOM & NAVIGATION MECHANICS
     ======================================================== */
  alignCameraToZone(zone) {
    this.targetLat = zone.latMid;
    this.targetLng = zone.lngMid;
    this.currentLat = zone.latMid;
    this.currentLng = zone.lngMid;

    const qLng = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.currentLng);
    const qLat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.currentLat);
    this.planetGroup.quaternion.copy(qLng).multiply(qLat);

    this.updateHUDTelemetry();
  }

  /**
   * Sets target zoom smoothly
   * 0.0 = Orbit Void, 1.0 = Surface Block View
   */
  setZoom(val) {
    this.targetZoom = Math.max(0.0, Math.min(1.0, val));
    const slider = document.getElementById('zoom-slider');
    if (slider) slider.value = Math.round(this.targetZoom * 1000);
  }

  warpToZone(zoneId, realign = true) {
    this.activeZoneId = zoneId;
    this.buildActiveZoneSurface(realign);

    const zone = this.zonesData[zoneId];
    if (zone && realign) {
      this.alignCameraToZone(zone);
    }
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

    if (this.rootGroup) {
      this.rootGroup.position.set(0, 0, 0);
      this.rootGroup.quaternion.identity();
    }
    if (this.planetGroup) {
      this.planetGroup.position.set(0, 0, 0);
    }

    const defaultZone = this.zonesData && this.zonesData[this.initialZoneId];
    if (defaultZone) {
      this.warpToZone(this.initialZoneId, true);
    } else {
      this.targetLat = 0.157;
      this.targetLng = 0.261;
      this.currentLat = 0.157;
      this.currentLng = 0.261;
      if (this.planetGroup) {
        const qLng = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.currentLng);
        const qLat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.currentLat);
        this.planetGroup.quaternion.copy(qLng).multiply(qLat);
      }
      this.playAudio('warp');
    }

    this.activeBlockCoord = { r: 1, c: 1 };
    this.setZoom(1.0);
    this.currentZoom = 1.0;
    if (this.camera) {
      this.camera.position.set(0, 0, this.DIST_SURFACE);
      this.camera.lookAt(0, 0, 0);
    }

    this.hoveredPlot = null;
    this.selectedPlot = null;
    this.hoveredZoneId = null;
    if (this.lastHoveredZoneMesh) {
      if (this.lastHoveredZoneMesh.material && this.lastHoveredZoneMesh.material.emissive) {
        this.lastHoveredZoneMesh.material.emissive.setHex(0x000000);
        this.lastHoveredZoneMesh.material.emissiveIntensity = 0.0;
      }
      this.lastHoveredZoneMesh = null;
    }

    this.updateHUDTelemetry();
  }

  /**
   * Looks up the zone ID covering a given latitude and longitude on the planet
   */
  getZoneAtCoords(lat, lng) {
    if (!this.zonesData || this.zonesData.length === 0) return null;

    const clampedLat = Math.max(-Math.PI / 2 + 0.0001, Math.min(Math.PI / 2 - 0.0001, lat));
    const r = Math.min(this.NUM_LAT_ROWS - 1, Math.max(0, Math.floor(((clampedLat + Math.PI / 2) / Math.PI) * this.NUM_LAT_ROWS)));

    let normLng = ((lng + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const c = Math.min(this.NUM_LNG_COLS - 1, Math.max(0, Math.floor(((normLng + Math.PI) / (2 * Math.PI)) * this.NUM_LNG_COLS)));

    const zoneId = r * this.NUM_LNG_COLS + c;
    return this.zonesData[zoneId] || null;
  }

  updateHUDActiveZone(zone) {
    // HUD text disabled
  }

  /**
   * Cycles plot state on click
   */
  cyclePlotState(plot) {
    if (this.isBlockLocked(plot.zoneId, plot.bRow, plot.bCol) || !plot.manipulable) {
      this.playAudio('locked');
      return;
    }

    // Cycle: empty -> user_active -> system_open -> empty
    if (plot.status === 'empty') {
      plot.status = 'user_active';
      plot.owner = 'user';
      plot.manipulable = true;
      plot.funcType = 'quantum_extractor';
      plot.funcName = 'Quantum Extractor';
    } else if (plot.status === 'user_active') {
      plot.status = 'system_open';
      plot.owner = 'system';
      plot.manipulable = true;
      plot.funcType = 'relay_gate';
      plot.funcName = 'Orbital Gate Node';
    } else if (plot.status === 'system_open') {
      plot.status = 'system_locked';
      plot.owner = 'system';
      plot.manipulable = false;
      plot.funcType = 'core_pylon';
      plot.funcName = 'Fortified Core';
    } else {
      plot.status = 'empty';
      plot.owner = 'none';
      plot.manipulable = true;
      plot.funcType = 'none';
      plot.funcName = 'Empty Plot';
    }

    // Redraw block canvas
    const isCenter = (plot.bRow === 1 && plot.bCol === 1);
    this.renderBlockCanvas(plot.zoneId, plot.bRow, plot.bCol, isCenter);
    this.playAudio('activate');

    // Update tooltip
    this.showPlotTooltip(this.mouseClientPos, plot);

    // Sync with backend API if online
    fetch('/api/plot/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneId: plot.zoneId,
        bRow: plot.bRow,
        bCol: plot.bCol,
        row: plot.r,
        col: plot.c,
        owner: plot.owner,
        manipulable: plot.manipulable,
        funcType: plot.funcType,
        funcName: plot.funcName
      })
    }).catch(() => {});
  }

  /* ========================================================
     INTERACTION & EVENT BINDINGS
     Mouse controls:
     - Scroll Wheel: Zoom in / Zoom out only
     - Mouse Drag: Minimal dragging, ONLY enabled when in Zone View
     - Left Click: Cycle plot in zone view, or enter zone in orbit view
     - Right Click: Back to orbit view from zone view, or recenter
     Keyboard controls:
     - A, S, W, D & Left, Down, Up, Right Arrows to navigate across planet
     ======================================================== */
  bindEvents() {
    const dom = this.renderer.domElement;

    // Mouse Down
    dom.addEventListener('mousedown', (e) => {
      this.mouseDownPos = { x: e.clientX, y: e.clientY };
      this.isDragMove = false;

      if (e.button === 0) { // Left click
        // Planet dragging is ONLY allowed in Zone View, completely disabled in Orbit View
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

    // Mouse Move (Raycasting & Minimal Zone Dragging)
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

      // Dragging of the planet is MINIMAL and ONLY draggable when in zone view
      if (this.isDragging && this.isZoneView) {
        const deltaX = e.clientX - this.previousMouse.x;
        const deltaY = e.clientY - this.previousMouse.y;

        // Subtle, minimal rotation factor for fine surface inspection
        const rotFactor = 0.0006;
        this.targetLng -= deltaX * rotFactor;
        this.targetLat += deltaY * rotFactor;
        this.targetLat = Math.max(-1.46, Math.min(1.46, this.targetLat));

        this.previousMouse = { x: e.clientX, y: e.clientY };
      } else {
        this.handleRaycast(e);
      }
    });

    // Right Click Action: Prevent default browser menu, zoom out to Orbit in zone view or recenter
    dom.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      if (this.isZoneView) {
        // Right click in zone view: smoothly back out to Orbit view
        this.setZoom(0.0);
        this.playAudio('warp');
      } else {
        // Right click in orbit view: recenter on the active zone
        const zone = this.zonesData[this.activeZoneId];
        if (zone) this.alignCameraToZone(zone);
        this.playAudio('blip');
      }
      this.hidePlotTooltip();
    });

    // Left Click (Plot cycle or Zone entry)
    dom.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      if (this.isDragMove) {
        this.isDragMove = false;
        return; // Drag gesture, ignore click
      }

      if (this.isZoneView && this.hoveredPlot) {
        this.cyclePlotState(this.hoveredPlot);
      } else if (!this.isZoneView && this.hoveredZoneId !== undefined && this.hoveredZoneId !== null) {
        this.warpToZone(this.hoveredZoneId, true);
        this.setZoom(1.0); // smooth descent to surface zone
      }
    });

    // Smooth Wheel Zoom (Mouse zoom in / zoom out)
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * this.zoomSpeed;
      this.setZoom(this.targetZoom + delta);
    }, { passive: false });

    // Keyboard Navigation: W, A, S, D and Arrow keys to move around planet
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

    // Double click to re-center
    dom.addEventListener('dblclick', () => {
      const zone = this.zonesData[this.activeZoneId];
      if (zone) this.alignCameraToZone(zone);
      this.setZoom(1.0);
    });
  }

  /**
   * Raycasts mouse coordinates to detect plot hover in zone view, or zone hover in orbit view
   */
  handleRaycast(e) {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Raycast on active block meshes (Zone / Surface Mode)
    if (this.isZoneView && this.blockMeshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(this.blockMeshes);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const { zoneId, bRow, bCol } = hit.object.userData;

        // If block is not active or unlocked: hover is COMPLETELY non-responsive!
        if (this.isBlockLocked(zoneId, bRow, bCol)) {
          if (this.hoveredPlot) {
            const prev = this.hoveredPlot;
            this.hoveredPlot = null;
            this.renderBlockCanvas(prev.zoneId, prev.bRow, prev.bCol, prev.bRow === 1 && prev.bCol === 1);
          }
          if (this.container) {
            this.container.style.cursor = 'default';
          }
          return;
        }

        const uv = hit.uv;

        // Map UV coordinates (0..1) to plot row and col (0..9)
        const canvas = this.blockCanvases[hit.object.userData.blockKey];
        if (canvas) {
          const margin = 16;
          const marginL = margin / canvas.width;
          const marginT = margin / canvas.height;
          const gridW = (canvas.width - margin * 2) / canvas.width;
          const gridH = (canvas.height - margin * 2) / canvas.height;

          // Three.js UV origin is bottom-left, canvas origin is top-left
          const uvX = uv.x;
          const uvY = 1.0 - uv.y;

          if (uvX >= marginL && uvX <= marginL + gridW && uvY >= marginT && uvY <= marginT + gridH) {
            const col = Math.floor(((uvX - marginL) / gridW) * 10);
            const row = Math.floor(((uvY - marginT) / gridH) * 10);
            const clampedCol = Math.max(0, Math.min(9, col));
            const clampedRow = Math.max(0, Math.min(9, row));

            const block = this.blocksData[`${zoneId}_${bRow}_${bCol}`];
            if (block && block.plots[clampedRow]) {
              const plot = block.plots[clampedRow][clampedCol];
              const prev = this.hoveredPlot;
              this.hoveredPlot = plot;

              if (this.container) {
                this.container.style.cursor = 'pointer';
              }

              // Redraw hovered block if plot changed
              if (!prev || prev.r !== clampedRow || prev.c !== clampedCol || prev.bRow !== bRow || prev.bCol !== bCol) {
                this.renderBlockCanvas(zoneId, bRow, bCol, bRow === 1 && bCol === 1);
                if (prev) {
                  this.renderBlockCanvas(prev.zoneId, prev.bRow, prev.bCol, prev.bRow === 1 && prev.bCol === 1);
                }
                this.playAudio('blip');
              }
              return;
            }
          }
        }
      }
    }

    // 2. Raycast on Zone Surface Meshes (Orbital Void Mode: Entire planet covered with zones)
    this.hoveredZoneId = null;
    if (!this.isZoneView && this.zoneSurfaceMeshes && this.zoneSurfaceMeshes.length > 0) {
      const zoneHits = this.raycaster.intersectObjects(this.zoneSurfaceMeshes);
      if (zoneHits.length > 0) {
        const hit = zoneHits[0];
        const zoneId = hit.object.userData.zoneId;
        if (zoneId !== undefined) {
          const isLocked = this.isZoneLocked(zoneId);
          // If zone is not active or unlocked: hover is COMPLETELY non-responsive!
          if (isLocked) {
            if (this.lastHoveredZoneMesh) {
              if (this.lastHoveredZoneMesh.material && this.lastHoveredZoneMesh.material.emissive) {
                this.lastHoveredZoneMesh.material.emissive.setHex(0x000000);
                this.lastHoveredZoneMesh.material.emissiveIntensity = 0.0;
              }
              this.lastHoveredZoneMesh = null;
            }
            if (this.container) {
              this.container.style.cursor = 'default';
            }
            return;
          }

          this.hoveredZoneId = zoneId;
          const zone = this.zonesData[zoneId];
          if (zone) {
            // Emissive glow highlight on the hovered active/unlocked zone
            if (this.lastHoveredZoneMesh && this.lastHoveredZoneMesh !== hit.object) {
              if (this.lastHoveredZoneMesh.material && this.lastHoveredZoneMesh.material.emissive) {
                this.lastHoveredZoneMesh.material.emissive.setHex(0x000000);
                this.lastHoveredZoneMesh.material.emissiveIntensity = 0.0;
              }
            }
            if (hit.object.material && hit.object.material.emissive) {
              hit.object.material.emissive.setHex(0xffe600);
              hit.object.material.emissiveIntensity = 0.55;
            }
            this.lastHoveredZoneMesh = hit.object;
            if (this.container) {
              this.container.style.cursor = 'pointer';
            }
            return;
          }
        }
      }
    }

    if (this.lastHoveredZoneMesh) {
      if (this.lastHoveredZoneMesh.material && this.lastHoveredZoneMesh.material.emissive) {
        this.lastHoveredZoneMesh.material.emissive.setHex(0x000000);
        this.lastHoveredZoneMesh.material.emissiveIntensity = 0.0;
      }
      this.lastHoveredZoneMesh = null;
    }

    // Clear hover if no hit
    if (this.hoveredPlot) {
      const prev = this.hoveredPlot;
      this.hoveredPlot = null;
      this.renderBlockCanvas(prev.zoneId, prev.bRow, prev.bCol, prev.bRow === 1 && prev.bCol === 1);
    }
    if (this.container) {
      this.container.style.cursor = 'default';
    }
  }

  showPlotTooltip(e, plot) {}

  showZoneTooltip(e, zone) {}

  hidePlotTooltip() {}

  /* ========================================================
     HUD & TELEMETRY CONTROLS
     ======================================================== */
  setupHUD() {}

  updateHUDTelemetry() {}

  updateTelemetryPlot(plot) {}

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
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'activate') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(840, now + 0.12);
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
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  /* ========================================================
     BACKEND DATA SYNC
     ======================================================== */
  async fetchServerData() {
    try {
      const res = await fetch('/api/zones');
      if (res.ok) {
        const liveZones = await res.json();
        liveZones.forEach(lz => {
          if (this.zonesData[lz.id]) {
            const isLocked = this.isZoneLocked(lz.id);
            this.zonesData[lz.id].name = lz.name;
            this.zonesData[lz.id].controlledBy = isLocked ? 'Locked-Sector' : 'Active-Frontier';
            this.zonesData[lz.id].colorHex = isLocked ? 0x243246 : 0xffe600;
            if (this.zoneSurfaceMeshes[lz.id]) {
              this.zoneSurfaceMeshes[lz.id].material.map = this.getZoneTexture(this.zonesData[lz.id]);
              this.zoneSurfaceMeshes[lz.id].material.needsUpdate = true;
            }
          }
        });
      }
    } catch (e) {
      // Running standalone / offline mode
    }
  }

  /* ========================================================
     MAIN ANIMATION & SMOOTH RENDER LOOP
     ======================================================== */
  animate() {
    requestAnimationFrame(() => this.animate());

    // 1. Smooth Zoom Interpolation
    this.currentZoom += (this.targetZoom - this.currentZoom) * this.zoomDamping;

    // Camera Distance: smooth non-linear curve from Orbit Void (290) to Surface Block (114.7)
    const zoomCurve = Math.pow(this.currentZoom, 1.15);
    const cameraDist = THREE.MathUtils.lerp(this.DIST_ORBIT, this.DIST_SURFACE, zoomCurve);
    this.camera.position.z = cameraDist;

    // Update canvas cursor based on Zone View mode
    if (this.container) {
      if (this.isZoneView) {
        this.container.classList.add('zone-view');
      } else {
        this.container.classList.remove('zone-view');
      }
    }

    // 2. Keyboard Navigation (A, S, W, D and Left, Down, Up, Right Arrow Keys)
    const baseSpeed = this.isZoneView ? 0.007 : 0.015;
    const speed = (this.keysDown['shift'] ? baseSpeed * 2.2 : baseSpeed);

    let inputLat = 0;
    let inputLng = 0;

    if (this.keysDown['w'] || this.keysDown['arrowup']) inputLat += 1;   // Move North
    if (this.keysDown['s'] || this.keysDown['arrowdown']) inputLat -= 1; // Move South
    if (this.keysDown['a'] || this.keysDown['arrowleft']) inputLng -= 1; // Move West
    if (this.keysDown['d'] || this.keysDown['arrowright']) inputLng += 1;// Move East

    if (inputLat !== 0 || inputLng !== 0) {
      this.autoOrbit = false;
      const len = Math.hypot(inputLat, inputLng);
      this.moveVelocity.lat += (inputLat / len) * speed * 0.25;
      this.moveVelocity.lng += (inputLng / len) * speed * 0.25;
    }

    // Auto-Orbit planetary rotation when enabled or in deep void idle
    if (this.autoOrbit && !this.isDragging) {
      this.targetLng += 0.0012;
    }

    // Apply movement velocity
    this.targetLat += this.moveVelocity.lat;
    this.targetLng += this.moveVelocity.lng;
    this.moveVelocity.lat *= 0.82;
    this.moveVelocity.lng *= 0.82;

    // Clamp latitude to avoid pole flipping
    this.targetLat = Math.max(-1.46, Math.min(1.46, this.targetLat));

    // Smooth spherical orientation interpolation
    this.currentLat += (this.targetLat - this.currentLat) * 0.12;
    this.currentLng += (this.targetLng - this.currentLng) * 0.12;

    const qLng = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.currentLng);
    const qLat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.currentLat);
    this.planetGroup.quaternion.copy(qLng).multiply(qLat);

    // Dynamic Zone Tracking under camera
    const zoneUnderCamera = this.getZoneAtCoords(this.currentLat, this.currentLng);
    if (zoneUnderCamera && zoneUnderCamera.id !== this.activeZoneId) {
      if (this.isZoneView) {
        // Seamlessly switch active zone blocks as user navigates across the planet surface
        this.warpToZone(zoneUnderCamera.id, false);
      } else {
        // In Orbit view, update HUD active zone indicator to current sector
        this.updateHUDActiveZone(zoneUnderCamera);
      }
    }

    // 3. Shimmer Starfield slowly
    if (this.starfield) {
      this.starfield.rotation.y += 0.00015;
      this.starfield.rotation.x += 0.00008;
    }

    // 4. Update HUD Telemetry
    this.updateHUDTelemetry();

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.planetEngine = new PlanetaryGameEngine();
});
