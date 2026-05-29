export const tiles = [];
export const tileByKey = new Map();
export const tileState = new Map();

export const camera = {
  tx: window.innerWidth / 2,
  ty: window.innerHeight / 2,
  scale: 1
};

export const unitCell = {
  mode: "off",
  origin: null,
  a: null,
  b: null,
  det: null,
  periodicClasses: []
};

export const renderState = {
  renderScheduled: false,
  cameraFrameScheduled: false,
  overlayHideTimeout: null,
  renderedBounds: null
};

export const pointerState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startTx: 0,
  startTy: 0,
  dragged: false,
  downTile: null
};