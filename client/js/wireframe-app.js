/**
 * The Game - Clean Planetary Grid Wireframe
 * Focused on 1 central Block (10x10 Plots), with partially neighbouring blocks visible.
 */
document.addEventListener('DOMContentLoaded', () => {
  const viewport = document.getElementById('viewport');
  const world = document.getElementById('world');
  const zoneGrid = document.getElementById('zone-grid');
  const tooltip = document.getElementById('plot-tooltip');

  // World transform state
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // Initialize
  init();

  async function init() {
    buildZoneGrid();
    setupTransformAndFraming();
    setupInteraction();
  }

  /**
   * Build 3x3 Blocks of Zone, each having 10x10 Plots
   */
  function buildZoneGrid() {
    zoneGrid.innerHTML = '';

    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const isCenter = (br === 1 && bc === 1);
        const blockEl = createBlockElement(br, bc, isCenter);
        zoneGrid.appendChild(blockEl);
      }
    }
  }

  function createBlockElement(bRow, bCol, isCenter) {
    const block = document.createElement('div');
    block.className = `block-container ${isCenter ? 'center-block' : 'neighbor-block'}`;
    block.id = `block-${bRow}-${bCol}`;

    // Tag
    const tag = document.createElement('div');
    tag.className = 'block-header-tag';
    tag.textContent = isCenter ? `★ BLOCK [${bRow},${bCol}] (PRIMARY)` : `BLOCK [${bRow},${bCol}]`;
    block.appendChild(tag);

    // Matrix Wrapper
    const matrixWrap = document.createElement('div');
    matrixWrap.className = 'block-matrix-wrap';

    // Column Headers (0..9)
    const colCoords = document.createElement('div');
    colCoords.className = 'col-coords';
    for (let c = 0; c < 10; c++) {
      const colNum = document.createElement('div');
      colNum.className = 'col-num';
      colNum.textContent = c;
      colCoords.appendChild(colNum);
    }
    matrixWrap.appendChild(colCoords);

    // Main row: Row numbers + Plot grid
    const mainRow = document.createElement('div');
    mainRow.className = 'matrix-main-row';

    // Row numbers (0..9)
    const rowCoords = document.createElement('div');
    rowCoords.className = 'row-coords';
    for (let r = 0; r < 10; r++) {
      const rowNum = document.createElement('div');
      rowNum.className = 'row-num';
      rowNum.textContent = r;
      rowCoords.appendChild(rowNum);
    }
    mainRow.appendChild(rowCoords);

    // 10x10 Plot Grid
    const plotGrid = document.createElement('div');
    plotGrid.className = 'plot-grid';

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const plotData = generatePlotData(bRow, bCol, r, c);
        const cell = createPlotCell(plotData);
        plotGrid.appendChild(cell);
      }
    }

    mainRow.appendChild(plotGrid);
    matrixWrap.appendChild(mainRow);
    block.appendChild(matrixWrap);

    return block;
  }

  /**
   * Deterministic plot data with varied states for wireframe
   */
  function generatePlotData(bRow, bCol, r, c) {
    const seed = (bRow * 31 + bCol * 17 + r * 10 + c) % 100;
    let owner = 'none';
    let manipulable = true;
    let funcType = 'none';
    let funcName = 'Empty Plot';
    let status = 'empty';

    if (seed < 14) {
      // System Locked
      owner = 'system';
      manipulable = false;
      funcType = 'geothermal_core';
      funcName = 'Geothermal Core';
      status = 'system_locked';
    } else if (seed < 28) {
      // System Open (Manipulable)
      owner = 'system';
      manipulable = true;
      funcType = 'orbital_gate';
      funcName = 'Orbital Relay Gate';
      status = 'system_open';
    } else if (seed < 52) {
      // User Active (Manipulable)
      owner = 'user';
      manipulable = true;
      funcType = 'quantum_refinery';
      funcName = 'Quantum Refinery';
      status = 'user_active';
    } else if (seed < 64) {
      // User Locked
      owner = 'user';
      manipulable = false;
      funcType = 'defense_turret';
      funcName = 'Aegis Defense Pylon';
      status = 'user_locked';
    } else {
      // Empty
      owner = 'none';
      manipulable = true;
      funcType = 'none';
      funcName = 'Empty Plot';
      status = 'empty';
    }

    return { bRow, bCol, r, c, owner, manipulable, funcType, funcName, status };
  }

  function createPlotCell(plot) {
    const cell = document.createElement('div');
    cell.className = `plot-cell ${getPlotClass(plot.status)}`;
    cell.dataset.status = plot.status;
    cell.dataset.r = plot.r;
    cell.dataset.c = plot.c;
    cell.dataset.bRow = plot.bRow;
    cell.dataset.bCol = plot.bCol;
    cell.dataset.funcName = plot.funcName;
    cell.dataset.manipulable = plot.manipulable;

    let icon = '·';
    if (plot.status === 'system_locked') icon = '🔒';
    else if (plot.status === 'system_open') icon = '⚙️';
    else if (plot.status === 'user_active') icon = '⚡';
    else if (plot.status === 'user_locked') icon = '🛡️';

    cell.innerHTML = `
      <span class="plot-icon">${icon}</span>
      <span class="plot-sub">${plot.r},${plot.c}</span>
    `;

    // Tooltip hover
    cell.addEventListener('mouseenter', (e) => {
      showTooltip(e, plot);
    });

    cell.addEventListener('mousemove', (e) => {
      moveTooltip(e);
    });

    cell.addEventListener('mouseleave', () => {
      hideTooltip();
    });

    // Click to cycle function/state for live wireframe manipulation
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      cyclePlotState(cell, plot);
    });

    return cell;
  }

  function getPlotClass(status) {
    switch (status) {
      case 'system_locked': return 'sys-locked';
      case 'system_open': return 'sys-open';
      case 'user_active': return 'usr-active';
      case 'user_locked': return 'usr-locked';
      default: return 'empty';
    }
  }

  function cyclePlotState(cell, plot) {
    // Cycle: empty -> user_active -> system_open -> system_locked -> empty
    if (plot.status === 'empty') {
      plot.status = 'user_active';
      plot.owner = 'user';
      plot.manipulable = true;
      plot.funcName = 'Quantum Extractor';
    } else if (plot.status === 'user_active') {
      plot.status = 'system_open';
      plot.owner = 'system';
      plot.manipulable = true;
      plot.funcName = 'Orbital Gate';
    } else if (plot.status === 'system_open') {
      plot.status = 'system_locked';
      plot.owner = 'system';
      plot.manipulable = false;
      plot.funcName = 'Protected Core';
    } else {
      plot.status = 'empty';
      plot.owner = 'none';
      plot.manipulable = true;
      plot.funcName = 'Empty Plot';
    }

    cell.className = `plot-cell ${getPlotClass(plot.status)}`;
    let icon = '·';
    if (plot.status === 'system_locked') icon = '🔒';
    else if (plot.status === 'system_open') icon = '⚙️';
    else if (plot.status === 'user_active') icon = '⚡';
    else if (plot.status === 'user_locked') icon = '🛡️';

    cell.querySelector('.plot-icon').textContent = icon;
    showTooltip({ clientX: tooltip.dataset.x, clientY: tooltip.dataset.y }, plot);
  }

  function showTooltip(e, plot) {
    tooltip.dataset.x = e.clientX;
    tooltip.dataset.y = e.clientY;
    const manipText = plot.manipulable ? '✅ Manipulable' : '🔒 Locked (System)';
    tooltip.innerHTML = `
      <strong>Plot [${plot.r}, ${plot.c}]</strong> in Block [${plot.bRow}, ${plot.bCol}]<br>
      Function: <em>${plot.funcName}</em> (${plot.status.replace('_', ' ').toUpperCase()})<br>
      Status: ${manipText}
    `;
    tooltip.style.display = 'block';
    moveTooltip(e);
  }

  function moveTooltip(e) {
    tooltip.style.left = `${e.clientX + 14}px`;
    tooltip.style.top = `${e.clientY + 14}px`;
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  /**
   * Screen initiates zoomed in to 1 block (center block),
   * with partially neighbouring blocks visible.
   */
  function setupTransformAndFraming() {
    const centerBlock = document.getElementById('block-1-1');
    if (!centerBlock) return;

    // Viewport dimensions
    const vWidth = viewport.clientWidth;
    const vHeight = viewport.clientHeight;

    // Center block dimensions
    const blockWidth = centerBlock.offsetWidth || 520;
    const blockHeight = centerBlock.offsetHeight || 520;

    // Target: Center block should occupy ~68% of the viewport height,
    // leaving ~32% of viewport height (16% top, 16% bottom) to show neighbor blocks!
    const targetBlockHeightOnScreen = vHeight * 0.68;
    scale = targetBlockHeightOnScreen / blockHeight;

    // Keep scale within sensible bounds
    scale = Math.max(0.6, Math.min(scale, 1.8));

    // Centered at origin (0, 0) since world is flex-centered on Block [1,1]
    translateX = 0;
    translateY = 0;

    applyTransform();
  }

  function applyTransform() {
    world.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  /**
   * Pan (drag) & Zoom (wheel) interactions
   */
  function setupInteraction() {
    // Window Resize -> Refit
    window.addEventListener('resize', () => {
      setupTransformAndFraming();
    });

    // Mouse Drag to Pan
    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Wheel Zoom
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      scale = Math.max(0.3, Math.min(scale * zoomFactor, 3.0));
      applyTransform();
    }, { passive: false });

    // Double click to reset to initial center framing
    viewport.addEventListener('dblclick', () => {
      setupTransformAndFraming();
    });
  }
});
