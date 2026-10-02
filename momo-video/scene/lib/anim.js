// Small deterministic animation helpers. Every value is a pure function of time,
// so any frame can be rendered on its own, in any order.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** Progress 0..1 of t through [a, b], eased. */
export const span = (t, a, b, ease = smooth) => ease(clamp((t - a) / (b - a)));

/**
 * Keyframe track: keys = [[time, value], ...]; value may be number or array.
 * Holds the first/last value outside the range; eases between keys.
 */
export function track(keys, ease = easeInOut) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const k = ease((t - t0) / (t1 - t0));
        return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], k)) : lerp(v0, v1, k);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** Seeded PRNG (mulberry32) so set dressing is identical on every render. */
export function rng(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Natural-looking blink: returns eyelid openness 0..1. */
export function blink(t, offset = 0) {
  const period = 3.7;
  const p = ((t + offset) % period + period) % period;
  const d = 0.14;
  return p < d ? Math.abs(Math.cos((p / d) * Math.PI)) : 1;
}
