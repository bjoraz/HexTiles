import {
  X_BASIS_Q,
  X_BASIS_R,
  Y_BASIS_Q,
  Y_BASIS_R
} from "./config.js";

export function keyOf(q, r) {
  return `${q},${r}`;
}

export function positiveMod(n, m) {
  return ((n % m) + m) % m;
}

export function axialToPixel(q, r) {
  return {
    x: X_BASIS_Q * q + X_BASIS_R * r,
    y: Y_BASIS_Q * q + Y_BASIS_R * r
  };
}

export function determinant(a, b) {
  return a.dq * b.dr - a.dr * b.dq;
}