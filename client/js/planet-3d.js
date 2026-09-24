/**
 * Planet 3D Wireframe Sphere Component
 * Renders a spherical planet with hundreds of zone nodes.
 */
class Planet3DViewer {
  constructor(containerId, onSelectZone) {
    this.container = document.getElementById(containerId);
    this.onSelectZone = onSelectZone;
    this.zonesData = [];
    this.markers = [];
    this.selectedZoneId = null;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    
    this.init();
  }

  init() {
    if (!window.THREE) {
      console.warn("Three.js not loaded, skipping 3D planet");
      return;
    }

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 520;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.z = 240;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Planet Root Group
    this.planetGroup = new THREE.Group();
    this.scene.add(this.planetGroup);

    // 1. Core Sphere (Dark Blueprint)
    const coreGeo = new THREE.SphereGeometry(78, 36, 36);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x070c1e,
      wireframe: false,
      transparent: true,
      opacity: 0.85
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.planetGroup.add(this.coreMesh);

    // 2. Wireframe Cage (Planetary Geodesic / Latitude-Longitude Grid)
    const wireGeo = new THREE.SphereGeometry(80, 24, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.28
    });
    this.wireMesh = new THREE.Mesh(wireGeo, wireMat);
    this.planetGroup.add(this.wireMesh);

    // 3. Atmosphere Glow Ring
    const atmoGeo = new THREE.SphereGeometry(82, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });
    this.atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.planetGroup.add(this.atmoMesh);

    // Raycaster for clicking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.bindEvents();
    this.animate();
  }

  setZones(zones) {
    this.zonesData = zones;
    this.clearMarkers();

    // Distribute zones evenly across the sphere using Fibonacci Sphere distribution
    const radius = 81.5;
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    zones.forEach((zone, i) => {
      const y = 1 - (i / (zones.length - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Create Zone Marker Mesh (Small Hexagon/Plane/Diamond)
      const markerGeo = new THREE.BoxGeometry(3.5, 3.5, 1.2);
      const markerMat = new THREE.MeshBasicMaterial({
        color: zone.controlledBy === 'System-Core' ? 0xef4444 : (zone.controlledBy === 'Syndicate' ? 0xf59e0b : 0xa855f7),
        transparent: true,
        opacity: 0.85
      });

      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(x * radius, y * radius, z * radius);
      marker.lookAt(0, 0, 0); // Face center of sphere
      marker.userData = { zoneId: zone.id, zone };

      this.planetGroup.add(marker);
      this.markers.push(marker);
    });
  }

  clearMarkers() {
    this.markers.forEach(m => this.planetGroup.remove(m));
    this.markers = [];
  }

  highlightZone(zoneId) {
    this.selectedZoneId = zoneId;
    this.markers.forEach(m => {
      if (m.userData.zoneId === zoneId) {
        m.material.color.setHex(0x00f0ff);
        m.scale.set(2.2, 2.2, 2.2);
      } else {
        const zone = m.userData.zone;
        m.material.color.setHex(
          zone.controlledBy === 'System-Core' ? 0xef4444 : (zone.controlledBy === 'Syndicate' ? 0xf59e0b : 0xa855f7)
        );
        m.scale.set(1, 1, 1);
      }
    });
  }

  bindEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    dom.addEventListener('mousemove', (e) => {
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      if (this.isDragging) {
        this.planetGroup.rotation.y += deltaX * 0.006;
        this.planetGroup.rotation.x += deltaY * 0.006;
      }

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('click', (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / dom.clientWidth) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / dom.clientHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.markers);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData && hit.userData.zoneId !== undefined) {
          this.highlightZone(hit.userData.zoneId);
          if (this.onSelectZone) this.onSelectZone(hit.userData.zoneId);
        }
      }
    });

    window.addEventListener('resize', () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.isDragging) {
      this.planetGroup.rotation.y += 0.0018; // gentle rotation
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.Planet3DViewer = Planet3DViewer;
