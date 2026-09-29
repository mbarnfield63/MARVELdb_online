// Pure reductions from raw API rows to small figure datasets. The pages embed
// these, never the raw rows, so a 50,000-transition run still ships as a few
// kilobytes of SVG.

const CM1_PER = { 'cm-1': 1, MHz: 1 / 29979.2458, GHz: 1 / 29.9792458, kHz: 1 / 29979245.8 };

// Measured value in its source's unit -> wavenumber in cm-1 (null if the unit is unknown).
export function toWavenumber(value, unit = 'cm-1') {
  const k = CM1_PER[unit];
  return k == null ? null : Math.abs(value) * k;
}

// Log-spaced spectral-coverage histogram, 0.01 to 100,000 cm-1.
export const COVERAGE = { lo: -2, hi: 5, bins: 70 };

// Spectral regions for axis annotation, in log10(cm-1).
export const REGIONS = [
  ['Microwave', -2, 0.5],
  ['Far-IR', 0.5, 2.6],
  ['Infrared', 2.6, 4.1],
  ['Vis', 4.1, 4.4],
  ['UV', 4.4, 5],
];

// transitions: [{obs_freq, removed, source_tag}], unitOf: tag -> unit.
// Negative obs_freq is MARVEL's "excluded" convention, counted as removed.
export function coverageBins(transitions, unitOf = {}) {
  const { lo, hi, bins } = COVERAGE;
  const kept = new Array(bins).fill(0);
  const removed = new Array(bins).fill(0);
  for (const t of transitions) {
    const nu = toWavenumber(t.obs_freq, unitOf[t.source_tag]);
    if (!nu) continue;
    const i = Math.floor(((Math.log10(nu) - lo) / (hi - lo)) * bins);
    if (i < 0 || i >= bins) continue;
    (t.removed || t.obs_freq < 0 ? removed : kept)[i]++;
  }
  return { kept, removed };
}

// Groups of [J, E] pairs -> deduplicated points on a w x h grid, one series
// per group, in the order given. Past maxCats groups the rest fold into
// "Other", the biggest kept first so the fewest points go grey.
// Axes run 0 to the first "nice" tick at or past the data maximum.
export function groupPoints(groups, { w = 480, h = 300, maxCats = 5, catKey = null } = {}) {
  groups = groups.map((g) => ({ ...g, jE: g.jE.filter(([j]) => Number.isFinite(j)) })).filter((g) => g.jE.length);
  if (!groups.length) return null;
  const fold = groups.length > maxCats;
  const keep = new Set([...groups].sort((a, b) => b.jE.length - a.jE.length).slice(0, fold ? maxCats : groups.length));
  const named = groups.filter((g) => keep.has(g));
  const cats = [...named.map((g) => g.label), ...(fold ? ['Other'] : [])];
  const all = groups.flatMap((g) => g.jE);
  const jMax = Math.max(...all.map(([j]) => j), 1);
  const eMax = Math.max(...all.map(([, e]) => e), 1);
  const xTicks = niceTicks(jMax);
  const yTicks = niceTicks(eMax);
  const jTop = xTicks.at(-1);
  const eTop = yTicks.at(-1);
  const seen = new Set();
  const points = [];
  const counts = new Array(cats.length).fill(0);
  for (const g of groups) {
    const c = keep.has(g) ? named.indexOf(g) : cats.length - 1;
    for (const [j, e] of g.jE) {
      counts[c]++;
      const x = Math.round((j / jTop) * w);
      const y = Math.round((e / eTop) * h);
      const key = `${x},${y},${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push([x, y, c]);
    }
  }
  return {
    w, h, jMax, eMax, jTop, eTop, xTicks, yTicks, catKey,
    cats: cats.map((label, i) => ({ label, n: counts[i], other: fold && i === cats.length - 1 })),
    points,
  };
}

// A run's levels as [J, E, electronic state] (J parsed, NaN when missing;
// state null when the run has no state quantum number).
export const levelJE = (levels) => levels.map((l) => [parseFloat(l.quantum_numbers.J), l.energy, stateOf(l.quantum_numbers)]);

// Electronic state from a level's quantum numbers: "state", or the part of a
// "vibronic" label before its parity/Omega suffix ("A2Pi_f3/2" -> "A2Pi").
export const stateOf = (qn) => qn.state ?? qn.vibronic?.split('_')[0] ?? null;

// "X2Sig+" -> "X²Σ⁺"; anything unrecognised comes back unchanged.
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
const TERM = { Sig: 'Σ', Sigma: 'Σ', Pi: 'Π', Delta: 'Δ', Del: 'Δ', Phi: 'Φ', Gamma: 'Γ' };
export function stateLabel(s) {
  const m = /^([A-Za-z]'*)(\d+)(Sigma|Sig|Pi|Delta|Del|Phi|Gamma)([+-]?)(.*)$/.exec(s ?? '');
  if (!m) return s ?? 'unassigned';
  const [, letter, mult, term, sign, rest] = m;
  return letter + [...mult].map((d) => SUP[d]).join('') + TERM[term] + (sign ? SUP[sign] : '') + rest;
}

// About n evenly spaced round ticks (1, 2 or 5 x 10^k apart) from 0 to at
// least max.
export function niceTicks(max, n = 4) {
  const raw = Math.max(max, 1) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const k = Math.ceil(Math.max(max, 1) / step - 1e-9);
  return Array.from({ length: k + 1 }, (_, i) => +(i * step).toPrecision(12));
}

// Energy-level histogram on a linear axis, lo to hi cm-1.
export function levelBins(energies, { lo = 0, hi, bins }) {
  const kept = new Array(bins).fill(0);
  for (const e of energies) {
    const i = Math.min(bins - 1, Math.floor(((e - lo) / (hi - lo)) * bins));
    if (i >= 0) kept[i]++;
  }
  return { kept };
}
