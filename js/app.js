import {
  SVG_NS,
  ANIMATION_MS,
  ANIMATION_ZOOM_LIMIT,
  MAX_ANIMATED_TILES,
  R,
  HEX_W,
  HEX_H,
  X_BASIS_Q,
  X_BASIS_R,
  Y_BASIS_R,
  MIN_ZOOM,
  MAX_ZOOM,
  hexPoints
} from "./config.js";

import { els } from "./dom.js";

import {
  tiles,
  tileByKey,
  tileState,
  camera,
  unitCell,
  renderState,
  pointerState
} from "./state.js";

import {
  keyOf,
  positiveMod,
  axialToPixel,
  determinant
} from "./geometry.js";

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }

  return el;
}

function initDefs() {
  els.clipPolygon.setAttribute("points", hexPoints);

  els.shadowFilter.setAttribute("x", -R - 20);
  els.shadowFilter.setAttribute("y", -R - 20);
  els.shadowFilter.setAttribute("width", HEX_W + 40);
  els.shadowFilter.setAttribute("height", HEX_H + 40);
}

function screenToWorld(clientX, clientY) {
  const rect = els.board.getBoundingClientRect();

  return {
    x: (clientX - rect.left - camera.tx) / camera.scale,
    y: (clientY - rect.top - camera.ty) / camera.scale
  };
}

function worldViewport() {
  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(window.innerWidth, window.innerHeight);

  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    maxX: Math.max(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxY: Math.max(topLeft.y, bottomRight.y)
  };
}

function applyCameraTransform() {
  els.worldLayer.setAttribute(
    "transform",
    `translate(${camera.tx}, ${camera.ty}) scale(${camera.scale})`
  );
}

function requestCameraFrame() {
  if (renderState.cameraFrameScheduled) return;

  renderState.cameraFrameScheduled = true;

  requestAnimationFrame(() => {
    renderState.cameraFrameScheduled = false;
    applyCameraTransform();
    renderVisibleBoardIfNeeded();
  });
}

function getOrCreateTileState(q, r) {
  const key = keyOf(q, r);

  if (!tileState.has(key)) {
    const orientation = Math.floor(Math.random() * 6);

    tileState.set(key, {
      orientation,
      angle: orientation * 60,
      solution: 0,
      animating: false
    });
  }

  return tileState.get(key);
}

function setStoredState(tile) {
  const state = getOrCreateTileState(tile.q, tile.r);

  state.orientation = Number(tile.dataset.orientation);
  state.angle = Number(tile.dataset.angle);
  state.solution = Number(tile.dataset.solution);
  state.animating = tile.dataset.animating === "true";
}

function clearVisibleTiles() {
  els.tileLayer.innerHTML = "";
  els.overlayLayer.innerHTML = "";
  tiles.length = 0;
  tileByKey.clear();
}

function createTile(q, r, cx, cy) {
  const state = getOrCreateTileState(q, r);

  const tile = svgEl("g", {
    class: "tile",
    transform: `translate(${cx}, ${cy})`,
    "data-key": keyOf(q, r)
  });

  const inner = svgEl("g");

  tile.q = q;
  tile.r = r;
  tile.cx = cx;
  tile.cy = cy;

  tile.dataset.orientation = state.orientation;
  tile.dataset.solution = state.solution;
  tile.dataset.angle = state.angle;
  tile.dataset.animating = "false";
  tile.inner = inner;

  const hex = svgEl("polygon", {
    class: "hex",
    points: hexPoints
  });

  const patternGroup = svgEl("g", {
    "clip-path": "url(#hexClip)"
  });

  const path1 = svgEl("path", {
    class: "pattern",
    d: "M -24.25 -42 C -15 -25, -15 25, -24.25 42"
  });

  const path2 = svgEl("path", {
    class: "pattern",
    d: "M -48.5 0 C -28 0, 8 -13, 24.25 -42"
  });

  const path3 = svgEl("path", {
    class: "pattern",
    d: "M 48.5 0 C 28 0, 15 25, 24.25 42"
  });

  patternGroup.append(path1, path2, path3);
  inner.append(hex, patternGroup);
  tile.appendChild(inner);

  setTileRotation(tile, Number(tile.dataset.angle));

  els.tileLayer.appendChild(tile);
  tiles.push(tile);
  tileByKey.set(keyOf(q, r), tile);
}

function setTileRotation(tile, angle) {
  tile.inner.setAttribute("transform", `rotate(${angle})`);
}

function updateTileRotation(tile) {
  setTileRotation(tile, Number(tile.dataset.angle));
  setStoredState(tile);
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateTileRotation(tile, fromAngle, toAngle, duration = ANIMATION_MS) {
  if (tile.dataset.animating === "true") return;

  tile.dataset.animating = "true";
  setStoredState(tile);

  const startTime = performance.now();

  function frame(now) {
    const rawT = (now - startTime) / duration;
    const t = Math.min(rawT, 1);
    const eased = easeInOutCubic(t);
    const currentAngle = fromAngle + (toAngle - fromAngle) * eased;

    setTileRotation(tile, currentAngle);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      setTileRotation(tile, toAngle);

      if (toAngle === 360) {
        tile.dataset.angle = 0;
        setTileRotation(tile, 0);
      }

      tile.dataset.animating = "false";
      setStoredState(tile);
    }
  }

  requestAnimationFrame(frame);
}

function animateTileClassRotation(items, duration = ANIMATION_MS) {
  if (items.length === 0) return;

  if (items.some(item => item.tile.dataset.animating === "true")) {
    return;
  }

  for (const item of items) {
    item.tile.dataset.animating = "true";
    setStoredState(item.tile);
  }

  const startTime = performance.now();

  function frame(now) {
    const rawT = (now - startTime) / duration;
    const t = Math.min(rawT, 1);
    const eased = easeInOutCubic(t);

    for (const item of items) {
      const currentAngle =
        item.fromAngle + (item.toAngle - item.fromAngle) * eased;

      setTileRotation(item.tile, currentAngle);
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      for (const item of items) {
        const tile = item.tile;

        setTileRotation(tile, item.toAngle);

        if (item.toAngle === 360) {
          tile.dataset.angle = 0;
          setTileRotation(tile, 0);
        }

        tile.dataset.animating = "false";
        setStoredState(tile);
      }
    }
  }

  requestAnimationFrame(frame);
}

function setTileOrientation(tile, orientation, animated = false) {
  orientation = positiveMod(orientation, 6);

  const currentAngle = Number(tile.dataset.angle);
  const targetAngle = orientation === 0 && currentAngle === 300
    ? 360
    : orientation * 60;

  tile.dataset.orientation = orientation;
  tile.dataset.angle = targetAngle;

  setStoredState(tile);

  if (animated) {
    animateTileRotation(tile, currentAngle, targetAngle, ANIMATION_MS);
  } else {
    if (targetAngle === 360) {
      tile.dataset.angle = 0;
      setTileRotation(tile, 0);
    } else {
      setTileRotation(tile, targetAngle);
    }

    tile.dataset.animating = "false";
    setStoredState(tile);
  }
}

function rotateTileClockwise(tile) {
  if (tile.dataset.animating === "true") return;

  const currentOrientation = Number(tile.dataset.orientation);
  const nextOrientation = (currentOrientation + 1) % 6;
  const fromAngle = Number(tile.dataset.angle);

  let toAngle;

  tile.dataset.orientation = nextOrientation;

  if (currentOrientation === 5) {
    toAngle = 360;
    tile.dataset.angle = 360;
  } else {
    toAngle = nextOrientation * 60;
    tile.dataset.angle = toAngle;
  }

  setStoredState(tile);
  animateTileRotation(tile, fromAngle, toAngle, ANIMATION_MS);
}

function handleTileClick(tile) {
  if (unitCell.mode === "choosing-a") {
    chooseUnitCellA(tile);
    return;
  }

  if (unitCell.mode === "choosing-b") {
    chooseUnitCellB(tile);
    return;
  }

  if (unitCell.mode === "active") {
    rotatePeriodicClassOf(tile);
    return;
  }

  rotateTileClockwise(tile);
}

function findVisibleCenterTile() {
  const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);

  let closest = null;
  let bestDistance = Infinity;

  for (const tile of tiles) {
    const dx = tile.cx - center.x;
    const dy = tile.cy - center.y;
    const distance = dx * dx + dy * dy;

    if (distance < bestDistance) {
      bestDistance = distance;
      closest = tile;
    }
  }

  return closest;
}

function startUnitCellDefinition() {
  clearOverlay();

  unitCell.origin = findVisibleCenterTile();
  unitCell.a = null;
  unitCell.b = null;
  unitCell.det = null;
  unitCell.periodicClasses = [];

  unitCell.mode = "choosing-a";

  els.unitCellButton.textContent = "Reset unit cell";
  els.unitCellButton.classList.add("active");

  highlightTile(unitCell.origin);

  els.hint.textContent = "Unit cell: click a tile to define the a vector.";
}

function resetUnitCell() {
  unitCell.mode = "off";
  unitCell.origin = null;
  unitCell.a = null;
  unitCell.b = null;
  unitCell.det = null;
  unitCell.periodicClasses = [];

  els.unitCellButton.textContent = "Define unit cell";
  els.unitCellButton.classList.remove("active");

  clearOverlay();

  els.hint.innerHTML = "Click a tile to rotate.<br>Drag to pan.<br>Scroll or pinch to zoom.";
}

function chooseUnitCellA(tile) {
  if (!unitCell.origin || tile === unitCell.origin) {
    els.hint.textContent = "Choose a different tile for the a vector.";
    return;
  }

  unitCell.a = {
    dq: tile.q - unitCell.origin.q,
    dr: tile.r - unitCell.origin.r,
    q: tile.q,
    r: tile.r
  };

  clearOverlay();
  highlightTile(unitCell.origin);
  highlightTile(tile);

  unitCell.mode = "choosing-b";
  els.hint.textContent = "Now click a second tile to define the b vector.";
}

function chooseUnitCellB(tile) {
  if (!unitCell.origin || tile === unitCell.origin) {
    els.hint.textContent = "Choose a different tile for the b vector.";
    return;
  }

  const candidateB = {
    dq: tile.q - unitCell.origin.q,
    dr: tile.r - unitCell.origin.r,
    q: tile.q,
    r: tile.r
  };

  const det = determinant(unitCell.a, candidateB);

  if (det === 0) {
    els.hint.textContent = "Those vectors are collinear. Choose a different second tile.";
    return;
  }

  unitCell.b = candidateB;
  unitCell.det = Math.abs(det);

  finishUnitCellDefinition();
}

function areEquivalentByUnitCell(tile1, tile2) {
  const dq = tile2.q - tile1.q;
  const dr = tile2.r - tile1.r;

  const aQ = unitCell.a.dq;
  const aR = unitCell.a.dr;
  const bQ = unitCell.b.dq;
  const bR = unitCell.b.dr;

  const det = aQ * bR - aR * bQ;

  if (det === 0) return false;

  const mNumerator = dq * bR - dr * bQ;
  const nNumerator = aQ * dr - aR * dq;

  return mNumerator % det === 0 && nNumerator % det === 0;
}

function getEquivalenceClass(tile) {
  return tiles.filter(other => areEquivalentByUnitCell(tile, other));
}

function enforceUnitCellOrientations() {
  const handled = new Set();
  unitCell.periodicClasses = [];

  for (const representative of tiles) {
    if (handled.has(representative)) continue;

    const cls = getEquivalenceClass(representative);
    const orientation = Number(representative.dataset.orientation);

    for (const tile of cls) {
      setTileOrientation(tile, orientation, false);
      handled.add(tile);
    }

    unitCell.periodicClasses.push(cls);
  }
}

function rotatePeriodicClassOf(tile) {
  const cls = getEquivalenceClass(tile);

  if (cls.length === 0) {
    rotateTileClockwise(tile);
    return;
  }

  const currentOrientation = Number(tile.dataset.orientation);
  const nextOrientation = (currentOrientation + 1) % 6;

  const animationAllowedByZoom = camera.scale >= ANIMATION_ZOOM_LIMIT;

  if (!animationAllowedByZoom || cls.length > MAX_ANIMATED_TILES) {
    for (const t of cls) {
      setTileOrientation(t, nextOrientation, false);
    }
    return;
  }

  const items = [];

  for (const t of cls) {
    if (t.dataset.animating === "true") {
      return;
    }

    const currentAngle = Number(t.dataset.angle);

    const targetAngle =
      nextOrientation === 0 && currentAngle === 300
        ? 360
        : nextOrientation * 60;

    t.dataset.orientation = nextOrientation;
    t.dataset.angle = targetAngle;
    setStoredState(t);

    items.push({
      tile: t,
      fromAngle: currentAngle,
      toAngle: targetAngle
    });
  }

  animateTileClassRotation(items, ANIMATION_MS);
}

function finishUnitCellDefinition() {
  unitCell.mode = "active";

  enforceUnitCellOrientations();
  showUnitCellOverlay();

  els.hint.textContent =
    `Unit cell active: ${unitCell.det} orientation class${unitCell.det === 1 ? "" : "es"}. Click a tile to rotate its whole periodic class.`;

  clearTimeout(renderState.overlayHideTimeout);
  renderState.overlayHideTimeout = window.setTimeout(() => {
    clearOverlay();
  }, 1500);
}

function clearOverlay() {
  els.overlayLayer.innerHTML = "";
}

function highlightTile(tileOrPoint) {
  if (!tileOrPoint) return;

  const p = axialToPixel(tileOrPoint.q, tileOrPoint.r);

  const g = svgEl("g", {
    transform: `translate(${p.x}, ${p.y})`
  });

  const outline = svgEl("polygon", {
    class: "highlight-hex",
    points: hexPoints
  });

  g.appendChild(outline);
  els.overlayLayer.appendChild(g);
}

function showUnitCellOverlay() {
  clearOverlay();

  const o = unitCell.origin;
  const a = unitCell.a;
  const b = unitCell.b;

  const p0 = axialToPixel(o.q, o.r);
  const p1 = axialToPixel(o.q + a.dq, o.r + a.dr);
  const p2 = axialToPixel(o.q + a.dq + b.dq, o.r + a.dr + b.dr);
  const p3 = axialToPixel(o.q + b.dq, o.r + b.dr);

  const parallelogram = svgEl("polygon", {
    class: "unit-cell-parallelogram",
    points: `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`
  });

  els.overlayLayer.appendChild(parallelogram);

  highlightTile(o);
  highlightTile({ q: o.q + a.dq, r: o.r + a.dr });
  highlightTile({ q: o.q + b.dq, r: o.r + b.dr });
}

function viewportNeedsRerender(bounds, viewport) {
  if (!bounds) return true;

  const bufferX = (bounds.maxX - bounds.minX) * 0.18;
  const bufferY = (bounds.maxY - bounds.minY) * 0.18;

  return (
    viewport.minX < bounds.minX + bufferX ||
    viewport.maxX > bounds.maxX - bufferX ||
    viewport.minY < bounds.minY + bufferY ||
    viewport.maxY > bounds.maxY - bufferY
  );
}

function renderVisibleBoardIfNeeded(force = false) {
  const viewport = worldViewport();

  if (!force && !viewportNeedsRerender(renderState.renderedBounds, viewport)) {
    return;
  }

  scheduleRender(viewport);
}

function scheduleRender(viewport = worldViewport()) {
  if (renderState.renderScheduled) return;

  renderState.renderScheduled = true;

  requestAnimationFrame(() => {
    renderState.renderScheduled = false;
    renderVisibleBoard(viewport);
  });
}

function renderVisibleBoard(viewport = worldViewport()) {
  clearVisibleTiles();

  const visibleWidth = viewport.maxX - viewport.minX;
  const visibleHeight = viewport.maxY - viewport.minY;

  const margin = Math.max(R * 8, visibleWidth * 0.35, visibleHeight * 0.35);

  const minX = viewport.minX - margin;
  const maxX = viewport.maxX + margin;
  const minY = viewport.minY - margin;
  const maxY = viewport.maxY + margin;

  renderState.renderedBounds = { minX, maxX, minY, maxY };

  const rMin = Math.floor(minY / Y_BASIS_R) - 3;
  const rMax = Math.ceil(maxY / Y_BASIS_R) + 3;

  for (let r = rMin; r <= rMax; r++) {
    const qMin = Math.floor((minX - X_BASIS_R * r) / X_BASIS_Q) - 3;
    const qMax = Math.ceil((maxX - X_BASIS_R * r) / X_BASIS_Q) + 3;

    for (let q = qMin; q <= qMax; q++) {
      const p = axialToPixel(q, r);

      if (
        p.x > minX &&
        p.x < maxX &&
        p.y > minY &&
        p.y < maxY
      ) {
        createTile(q, r, p.x, p.y);
      }
    }
  }

  if (unitCell.mode === "choosing-a" && unitCell.origin) {
    highlightTile(unitCell.origin);
  }

  if (unitCell.mode === "choosing-b" && unitCell.origin && unitCell.a) {
    highlightTile(unitCell.origin);
    highlightTile({
      q: unitCell.origin.q + unitCell.a.dq,
      r: unitCell.origin.r + unitCell.a.dr
    });
  }
}

function shuffleBoard() {
  if (unitCell.mode === "active") {
    const handled = new Set();

    for (const tile of tiles) {
      if (handled.has(tile)) continue;

      const cls = getEquivalenceClass(tile);
      const orientation = Math.floor(Math.random() * 6);

      for (const t of cls) {
        setTileOrientation(t, orientation, false);
        handled.add(t);
      }
    }

    return;
  }

  for (const tile of tiles) {
    const orientation = Math.floor(Math.random() * 6);
    setTileOrientation(tile, orientation, false);
  }
}

function solveBoard() {
  if (unitCell.mode === "active") {
    const handled = new Set();

    for (const tile of tiles) {
      if (handled.has(tile)) continue;

      const cls = getEquivalenceClass(tile);
      const solution = Number(tile.dataset.solution);

      for (const t of cls) {
        setTileOrientation(t, solution, false);
        handled.add(t);
      }
    }

    return;
  }

  for (const tile of tiles) {
    const solution = Number(tile.dataset.solution);
    setTileOrientation(tile, solution, false);
  }
}

function getTileFromEventTarget(target) {
  const el = target.closest ? target.closest(".tile") : null;

  if (!el || !els.board.contains(el)) return null;

  return tileByKey.get(el.dataset.key) || null;
}

function initPointerEvents() {
  els.board.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;

    pointerState.active = true;
    pointerState.pointerId = event.pointerId;
    pointerState.startX = event.clientX;
    pointerState.startY = event.clientY;
    pointerState.startTx = camera.tx;
    pointerState.startTy = camera.ty;
    pointerState.dragged = false;
    pointerState.downTile = getTileFromEventTarget(event.target);

    els.board.setPointerCapture(event.pointerId);
    els.board.classList.add("dragging");
  });

  els.board.addEventListener("pointermove", event => {
    if (!pointerState.active || event.pointerId !== pointerState.pointerId) return;

    const dx = event.clientX - pointerState.startX;
    const dy = event.clientY - pointerState.startY;

    if (Math.hypot(dx, dy) > 4) {
      pointerState.dragged = true;
    }

    if (pointerState.dragged) {
      camera.tx = pointerState.startTx + dx;
      camera.ty = pointerState.startTy + dy;
      requestCameraFrame();
    }
  });

  els.board.addEventListener("pointerup", event => {
    if (!pointerState.active || event.pointerId !== pointerState.pointerId) return;

    els.board.releasePointerCapture(event.pointerId);
    els.board.classList.remove("dragging");

    if (!pointerState.dragged && pointerState.downTile) {
      handleTileClick(pointerState.downTile);
    }

    pointerState.active = false;
    pointerState.pointerId = null;
    pointerState.downTile = null;
  });

  els.board.addEventListener("pointercancel", event => {
    if (event.pointerId === pointerState.pointerId) {
      pointerState.active = false;
      pointerState.pointerId = null;
      pointerState.downTile = null;
      els.board.classList.remove("dragging");
    }
  });
}

function initWheelZoom() {
  els.board.addEventListener("wheel", event => {
    event.preventDefault();

    const previousScale = camera.scale;

    const rect = els.board.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    const worldBefore = {
      x: (sx - camera.tx) / camera.scale,
      y: (sy - camera.ty) / camera.scale
    };

    const zoomFactor = Math.exp(-event.deltaY * 0.0012);
    const newScale = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, camera.scale * zoomFactor)
    );

    camera.scale = newScale;
    camera.tx = sx - worldBefore.x * camera.scale;
    camera.ty = sy - worldBefore.y * camera.scale;

    requestCameraFrame();

    const crossedBackIntoAnimationRange =
      previousScale < ANIMATION_ZOOM_LIMIT &&
      camera.scale >= ANIMATION_ZOOM_LIMIT;

    if (crossedBackIntoAnimationRange) {
      renderVisibleBoardIfNeeded(true);
    }
  }, { passive: false });
}

function initButtons() {
  els.shuffleButton.addEventListener("click", shuffleBoard);
  els.solveButton.addEventListener("click", solveBoard);

  els.unitCellButton.addEventListener("click", () => {
    if (unitCell.mode === "off") {
      startUnitCellDefinition();
    } else {
      resetUnitCell();
    }
  });
}

function initResize() {
  window.addEventListener("resize", () => {
    requestCameraFrame();
    renderVisibleBoardIfNeeded(true);
  });
}

function init() {
  initDefs();
  initButtons();
  initPointerEvents();
  initWheelZoom();
  initResize();

  applyCameraTransform();
  renderVisibleBoardIfNeeded(true);
}

init();