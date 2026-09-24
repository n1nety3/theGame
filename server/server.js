const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

// --- In-Memory Game World State (Planet -> Zone -> Block -> Plot) ---
const PLANET_ID = "PLANET-PRIME-01";
const TOTAL_ZONES = 120; // Hundreds of zones on the planet sphere

// Generate Zone catalog
const zones = {};
for (let i = 0; i < TOTAL_ZONES; i++) {
  const theta = (Math.PI * (i % 12)) / 12; // latitude approx
  const phi = (2 * Math.PI * Math.floor(i / 12)) / 10; // longitude approx
  zones[i] = {
    id: i,
    code: `Z-${String(i).padStart(3, '0')}`,
    name: `Sector-${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
    row: Math.floor(i / 12),
    col: i % 12,
    blocksCount: 9, // 3x3
    totalPlots: 900,
    activeFunctions: Math.floor(Math.random() * 80) + 10,
    controlledBy: i % 5 === 0 ? "System-Core" : (i % 7 === 0 ? "Syndicate" : "Open-Frontier"),
    coords: {
      lat: (theta * (180 / Math.PI) - 90).toFixed(2),
      lng: (phi * (180 / Math.PI) - 180).toFixed(2)
    }
  };
}

// Memory store for loaded/modified blocks (cached or generated on demand)
// Block ID format: zoneId_blockRow_blockCol (where blockRow: 0..2, blockCol: 0..2)
const blocksCache = {};

function getOrCreateBlock(zoneId, bRow, bCol) {
  const key = `${zoneId}_${bRow}_${bCol}`;
  if (blocksCache[key]) return blocksCache[key];

  // Generate 10x10 plots (100 plots)
  const plots = [];
  for (let r = 0; r < 10; r++) {
    const row = [];
    for (let c = 0; c < 10; c++) {
      // Logic:
      // Some plots are system defined & locked
      // Some are system defined & manipulable
      // Some are user defined & manipulable
      // Rest are empty
      const rand = (r * 10 + c + zoneId * 7 + bRow * 13 + bCol * 17) % 100;
      let owner = "system";
      let manipulable = false;
      let funcType = "none";
      let funcName = "Unassigned";
      let status = "empty";

      if (rand < 12) {
        // System locked function
        owner = "system";
        manipulable = false;
        funcType = "energy_node";
        funcName = "Geothermal Core";
        status = "system_locked";
      } else if (rand < 24) {
        // System defined, user manipulable
        owner = "system";
        manipulable = true;
        funcType = "relay_gate";
        funcName = "Orbital Relay Gate";
        status = "system_open";
      } else if (rand < 45) {
        // User defined & manipulable
        owner = "user";
        manipulable = true;
        funcType = "mineral_extractor";
        funcName = "Quantum Refinery";
        status = "user_active";
      } else if (rand < 55) {
        // User defined but locked / fortified
        owner = "user";
        manipulable = false;
        funcType = "defense_pylon";
        funcName = "Aegis Shield Pylon";
        status = "user_locked";
      } else {
        // Empty square
        owner = "none";
        manipulable = true;
        funcType = "none";
        funcName = "Empty Plot";
        status = "empty";
      }

      row.push({
        id: `P-Z${zoneId}-B${bRow}${bCol}-R${r}C${c}`,
        row: r,
        col: c,
        owner,
        manipulable,
        funcType,
        funcName,
        status,
        powerLevel: Math.floor(Math.random() * 100),
        lastModified: new Date().toISOString()
      });
    }
    plots.push(row);
  }

  blocksCache[key] = {
    zoneId: Number(zoneId),
    bRow: Number(bRow),
    bCol: Number(bCol),
    code: `BLK-[${bRow},${bCol}]`,
    plotsCount: 100,
    plots
  };
  return blocksCache[key];
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Endpoints ---
  if (pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      planet: {
        id: PLANET_ID,
        name: "Aegis Prime",
        type: "Spherical Terrestrial Cyber-World",
        totalZones: TOTAL_ZONES,
        zoneGrid: "3x3 Blocks per Zone (9 Blocks)",
        blockGrid: "10x10 Plots per Block (100 Plots)",
        plotsPerZone: 900,
        totalPlanetPlots: TOTAL_ZONES * 900
      }
    }));
    return;
  }

  if (pathname === '/api/zones') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Object.values(zones)));
    return;
  }

  const zoneMatch = pathname.match(/^\/api\/zone\/(\d+)$/);
  if (zoneMatch) {
    const zoneId = parseInt(zoneMatch[1], 10);
    if (!zones[zoneId]) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Zone not found" }));
      return;
    }
    // Return zone info with 3x3 block summary
    const blocksSummary = [];
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const blk = getOrCreateBlock(zoneId, br, bc);
        let lockedCount = 0;
        let activeCount = 0;
        let emptyCount = 0;
        blk.plots.flat().forEach(p => {
          if (p.status.includes('locked')) lockedCount++;
          else if (p.status.includes('active') || p.status.includes('open')) activeCount++;
          else emptyCount++;
        });

        blocksSummary.push({
          bRow: br,
          bCol: bc,
          code: `B-${br}${bc}`,
          lockedCount,
          activeCount,
          emptyCount
        });
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      zone: zones[zoneId],
      blocks: blocksSummary
    }));
    return;
  }

  const blockMatch = pathname.match(/^\/api\/block\/(\d+)\/(\d+)\/(\d+)$/);
  if (blockMatch) {
    const zoneId = parseInt(blockMatch[1], 10);
    const bRow = parseInt(blockMatch[2], 10);
    const bCol = parseInt(blockMatch[3], 10);
    if (bRow < 0 || bRow > 2 || bCol < 0 || bCol > 2) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Block coordinates must be between 0 and 2 (3x3 grid)" }));
      return;
    }
    const blockData = getOrCreateBlock(zoneId, bRow, bCol);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(blockData));
    return;
  }

  if (pathname === '/api/plot/update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { zoneId, bRow, bCol, row, col, manipulable, funcType, funcName, owner } = data;
        const block = getOrCreateBlock(zoneId, bRow, bCol);
        const plot = block.plots[row][col];

        // Check if user is trying to manipulate a non-manipulable plot without override
        if (!plot.manipulable && data.override !== true) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Plot is locked. Manipulation restricted." }));
          return;
        }

        if (manipulable !== undefined) plot.manipulable = Boolean(manipulable);
        if (funcType !== undefined) plot.funcType = funcType;
        if (funcName !== undefined) plot.funcName = funcName;
        if (owner !== undefined) plot.owner = owner;

        // Recalculate status
        if (plot.owner === 'system') {
          plot.status = plot.manipulable ? 'system_open' : 'system_locked';
        } else if (plot.owner === 'user') {
          plot.status = plot.manipulable ? 'user_active' : 'user_locked';
        } else {
          plot.status = plot.funcType === 'none' ? 'empty' : 'user_active';
        }
        plot.lastModified = new Date().toISOString();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, plot }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Invalid JSON payload" }));
      }
    });
    return;
  }

  // --- Static File Serving ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(CLIENT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + pathname);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Game Wireframe Server running on: http://localhost:${PORT}`);
  console.log(`🪐 Planetary Grid Model initialized:`);
  console.log(`   - Planet: ${TOTAL_ZONES} Zones`);
  console.log(`   - Zone: 3x3 Blocks (9 Blocks per Zone)`);
  console.log(`   - Block: 10x10 Plots (100 Plots per Block)`);
  console.log(`   - Total Plots: ${TOTAL_ZONES * 900}`);
  console.log(`=======================================================`);
});
