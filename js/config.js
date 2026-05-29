export const SVG_NS = "http://www.w3.org/2000/svg";

export const ANIMATION_MS = 600;

/*
  Below this zoom level, unit-cell rotations become instant.
  This avoids jank when many tiles are visible.
*/
export const ANIMATION_ZOOM_LIMIT = 0.8;

/*
  Emergency cap. Kept very high, since the real cutoff is the zoom limit.
*/
export const MAX_ANIMATED_TILES = 100000;

export const R = 56;
export const SQRT3 = Math.sqrt(3);

export const HEX_W = SQRT3 * R;
export const HEX_H = 2 * R;

/*
  Axial lattice:
    x = HEX_W * q + HEX_W/2 * r
    y = 1.5 * R * r
*/
export const X_BASIS_Q = HEX_W;
export const X_BASIS_R = HEX_W / 2;
export const Y_BASIS_Q = 0;
export const Y_BASIS_R = 1.5 * R;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;

export const hexPoints = [
  [0, -R],
  [SQRT3 / 2 * R, -R / 2],
  [SQRT3 / 2 * R,  R / 2],
  [0,  R],
  [-SQRT3 / 2 * R,  R / 2],
  [-SQRT3 / 2 * R, -R / 2]
].map(p => p.join(",")).join(" ");