// A signed distance field of the brain's silhouette: the smoke leaves from this outline.
function dt1(f, n, d, v, z) {                 // one-dimensional squared distance transform (Felzenszwalb and Huttenlocher)
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s; for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
}

export function distanceTo(mask, w, h, want) {  // distance from every texel to the nearest texel where mask == want
  const m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1), g = new Float64Array(w * h), out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = mask[y * w + x] === want ? 0 : 1e12; dt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; dt1(f, w, d, v, z); for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]); }
  return out;
}

export function signedDistance(mask, w, h) {   // texels outside the outline (positive) or inside it (negative)
  const out = distanceTo(mask, w, h, 1), inn = distanceTo(mask, w, h, 0);
  for (let i = 0; i < out.length; i++) out[i] -= inn[i];
  return out;
}
