// Build-time view model. Every page calls loadSite() (and runFigure() for
// plots); both are memoised, so a build fetches each API resource once no
// matter how many pages use it.
import { get, sortRuns, groupOf, GROUPS, formulaSlug, shortCite, compactCite } from './site.js';
import { coverageBins, levelJE, groupPoints, COVERAGE } from './figures.js';

const once = (fn) => { let p; return () => (p ??= fn()); };
const sum = (xs, f) => xs.reduce((n, x) => n + (f(x) ?? 0), 0);

export const METHOD_PAPERS = [
  { text: 'T. Furtenbacher, A. G. Császár, J. Tennyson (2007). MARVEL: measured active rotational–vibrational energy levels. J. Mol. Spectrosc. 245, 115–125.', doi: '10.1016/j.jms.2007.07.005' },
  { text: 'T. Furtenbacher, A. G. Császár (2012). MARVEL: measured active rotational–vibrational energy levels. II. Algorithmic improvements. J. Quant. Spectrosc. Radiat. Transf. 113, 929–935.', doi: '10.1016/j.jqsrt.2012.01.005' },
  { text: 'R. Tóbiás, T. Furtenbacher, J. Tennyson, A. G. Császár (2019). Accurate empirical rovibrational energies and transitions of H₂¹⁶O. Phys. Chem. Chem. Phys. 21, 3473–3495.', doi: '10.1039/C8CP05169K' },
];

export const loadSite = once(async () => {
  const [molList, pubs, spec] = await Promise.all([get('/molecules'), get('/publications'), get('/openapi.json')]);
  const mols = await Promise.all(molList.map(async (m) => ({ ...m, runs: sortRuns(await get(`/molecules/${m.slug}/runs`)) })));
  const molBySlug = Object.fromEntries(mols.map((m) => [m.slug, m]));
  const pubByKey = Object.fromEntries(pubs.map((p) => [p.bibtex_key, p]));

  const runs = mols.flatMap((m) => m.runs.map((r) => ({ ...r, isotopologue: m.isotopologue, formula: m.formula, slug: m.slug })));
  const formulas = [...Map.groupBy(mols, (m) => m.formula)].map(([formula, isos]) => ({
    formula,
    slug: formulaSlug(formula),
    group: groupOf(formula),
    isos,
    nLevels: sum(isos, (m) => m.runs[0]?.n_levels),
    nTransitions: sum(isos, (m) => m.runs[0]?.n_transitions),
  }));
  const groups = GROUPS.map((name) => ({ name, formulas: formulas.filter((f) => f.group === name) })).filter((g) => g.formulas.length);

  // Publications with their isotopologue rows resolved, API order (newest first).
  const references = pubs.map((p) => ({
    ...p,
    short: shortCite(p),
    compact: compactCite(p),
    isos: p.isotopologues.map((s) => molBySlug[s]).filter(Boolean),
    formulas: [...new Set(p.isotopologues.map((s) => molBySlug[s]?.formula).filter(Boolean))],
  }));

  const stats = [
    { key: 'molecules', label: 'molecules', n: formulas.length },
    { key: 'isotopologues', label: 'isotopologues', n: mols.length },
    { key: 'runs', label: 'runs', n: runs.length },
    { key: 'levels', label: 'energy levels', n: sum(runs, (r) => r.n_levels) },
    { key: 'transitions', label: 'transitions', n: sum(runs, (r) => r.n_transitions) },
    { key: 'papers', label: 'papers', n: pubs.length },
  ];

  // Endpoint list from the API's own OpenAPI schema, so it cannot drift.
  const endpoints = Object.entries(spec.paths).map(([path, ops]) => ({
    path,
    summary: ops.get.summary,
    description: ops.get.description?.split('\n\n')[0].replace(/`/g, ''),
    params: (ops.get.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name),
  }));

  const lastLoaded = runs.map((r) => r.loaded_at).sort().at(-1)?.slice(0, 10);
  return { mols, molBySlug, runs, formulas, groups, pubs, pubByKey, references, stats, endpoints, lastLoaded };
});

// Real ids for the API page examples, so they work when pasted.
export const apiExample = once(async () => {
  const { mols } = await loadSite();
  const mol = mols.find((m) => m.runs.length);
  const run = mol.runs[0];
  const [level] = await get(`/runs/${run.id}/levels?limit=1`);
  const [qnName, qnValue] = Object.entries(level.quantum_numbers).at(-1);
  return { slug: mol.slug, runId: run.id, qnKey: level.qn_key, qnName, qnValue };
});

const unitOf = once(async () => Object.fromEntries((await get('/sources')).map((s) => [s.source_tag, s.unit])));

async function all(path) {
  const rows = [];
  for (let offset = 0; ; offset += 10000) {
    const page = await get(`${path}${path.includes('?') ? '&' : '?'}limit=10000&offset=${offset}`);
    rows.push(...page);
    if (page.length < 10000) return rows;
  }
}

// Plot data for one run: its levels as (J, E) pairs and a spectral-coverage
// histogram, plus source and removed-line counts.
const figures = new Map();
export function runFigure(runId) {
  if (!figures.has(runId)) figures.set(runId, (async () => {
    const [run, levels, transitions, units] = await Promise.all([
      get(`/runs/${runId}`), all(`/runs/${runId}/levels`), all(`/runs/${runId}/transitions`), unitOf(),
    ]);
    const coverage = coverageBins(transitions, units);
    return {
      jE: run.qn_names.includes('J') ? levelJE(levels) : [],
      coverage,
      nRemoved: coverage.removed.reduce((a, b) => a + b, 0),
      sources: new Set(transitions.map((t) => t.source_tag)).size,
    };
  })());
  return figures.get(runId);
}

// One coverage row per molecule: the isotopologue whose latest run with
// transitions comes from the newest paper (publication year, then load day);
// ties, e.g. several isotopologues from one paper, go to the most transitions.
export async function coverageByMolecule() {
  const { formulas, pubByKey } = await loadSite();
  const rows = await Promise.all(formulas.map(async (f) => {
    const cands = f.isos.map((m) => ({ mol: m, run: m.runs.find((r) => r.n_transitions) })).filter((c) => c.run);
    if (!cands.length) return null;
    const when = ({ run }) => [pubByKey[run.publication]?.year ?? 0, run.loaded_at.slice(0, 10)];
    cands.sort((a, b) => when(b)[0] - when(a)[0] || when(b)[1].localeCompare(when(a)[1]) || b.run.n_transitions - a.run.n_transitions);
    const { mol, run } = cands[0];
    return { formula: f, mol, run, coverage: (await runFigure(run.id)).coverage };
  }));
  return { rows: rows.filter(Boolean), ...COVERAGE };
}

// A molecule's level map with one series per isotopologue (latest run each),
// ordered as the page lists them. Null when no run has a J quantum number.
export async function formulaLevelMap(formula, opts = {}) {
  const groups = await Promise.all(formula.isos.filter((m) => m.runs.length).map(async (m) => ({
    label: m.isotopologue, jE: (await runFigure(m.runs[0].id)).jE,
  })));
  return groupPoints(groups, { w: 360, h: 220, catKey: 'isotopologue', ...opts });
}
