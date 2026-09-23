// Site constants and build-time helpers over the db_MARVEL public API.

export const API = (import.meta.env?.PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
// Internal link under the site's base path ('/' locally, '/<repo>' on GitHub Pages).
export const url = (path) => (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '') + path;

export const ISSUES_URL = 'https://github.com/mbarnfield63/MARVEL_db/issues';
export const CONTACT_EMAIL = 'marco.barnfield.24@ucl.ac.uk';
export const MARVEL_URL = 'https://furted.github.io/MARVEL/';

export async function get(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

// All molecules with their runs attached. Every page needs some of this.
export async function moleculesWithRuns() {
  const mols = await get('/molecules');
  return Promise.all(mols.map(async (m) => ({ ...m, runs: sortRuns(await get(`/molecules/${m.slug}/runs`)) })));
}

// Atom count from the formula, charge suffix ignored (ticket #15).
export function atomCount(formula) {
  const bare = formula.replace(/(\^\d*)?[+-]+$/, '');
  return [...bare.matchAll(/([A-Z][a-z]?)(\d*)/g)].reduce((n, [, , k]) => n + (k ? +k : 1), 0);
}

export const GROUPS = ['Diatomics', 'Triatomics', 'Polyatomics'];
export const groupOf = (formula) => GROUPS[Math.min(Math.max(atomCount(formula), 2), 4) - 2];

export const formulaSlug = (formula) =>
  formula.toLowerCase().replace(/\+/g, 'plus').replace(/-/g, 'minus');

// Highest version first, newest run first within a version; the first run
// of each version is marked latest. Unparseable versions ("unknown") sort last.
export function sortRuns(runs) {
  const v = (r) => (isNaN(parseFloat(r.version)) ? -1 : parseFloat(r.version));
  const sorted = [...runs].sort((a, b) => v(b) - v(a) || b.loaded_at.localeCompare(a.loaded_at));
  return sorted.map((r, i) => ({ ...r, latest: i === 0 || sorted[i - 1].version !== r.version }));
}

export function runLabel(r) {
  const version = isNaN(parseFloat(r.version)) ? 'MARVEL (version unknown)' : `MARVEL ${r.version}`;
  const name = r.publication ?? r.description ?? r.loaded_at.slice(0, 10);
  // Older coexisting runs often share a paper; the load date tells them apart.
  return `${version} — ${name}${r.latest ? ' (latest)' : ` (loaded ${r.loaded_at.slice(0, 10)})`}`;
}

export const FILE_ROLES = [
  ['output_levels', 'Levels'],
  ['input_transitions', 'Transitions'],
  ['segment', 'Segment'],
];

export function humanSize(bytes) {
  const units = ['B', 'kB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1000 && i < units.length - 1) (bytes /= 1000), i++;
  return `${i ? bytes.toFixed(1) : bytes} ${units[i]}`;
}

// --- BibTeX text to HTML ----------------------------------------------------

const ACCENTS = { "'": '́', '`': '̀', '"': '̈', '^': '̂', '~': '̃', v: '̌', c: '̧', H: '̋', u: '̆' };

// Enough LaTeX for titles and author names: accents, ^{}/_{} scripts, braces, $.
export function latexToHtml(s = '') {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\\([vcHu])\{(\w)\}|\\(['`"^~])\{?(\w)\}?/g, (_, a1, c1, a2, c2) =>
      ((c1 ?? c2) + ACCENTS[a1 ?? a2]).normalize('NFC'))
    .replace(/\^\{([^{}]*)\}|\^(\w)/g, (_, a, b) => `<sup>${a ?? b}</sup>`)
    .replace(/_\{([^{}]*)\}|_(\w)/g, (_, a, b) => `<sub>${a ?? b}</sub>`)
    .replace(/\\&amp;/g, '&amp;')
    .replace(/--/g, '–')
    .replace(/[{}$]/g, '');
}

// "Last, First Middle and ..." -> "F. M. Last, ..."
export function formatAuthors(authors = '') {
  return latexToHtml(authors).split(/\s+and\s+/).map((a) => {
    const [last, first = ''] = a.split(/,\s*/);
    const initials = first.split(/[\s.]+/).filter(Boolean).map((n) => n.split('-').map((p) => p[0] + '.').join('-'));
    return [...initials, last].join(' ');
  }).join(', ');
}

// Standard abbreviations; journals not listed show their full name.
const JOURNAL_ABBREV = {
  'Journal of Computational Chemistry': 'J. Comput. Chem.',
  'Journal of Molecular Spectroscopy': 'J. Mol. Spectrosc.',
  'Journal of Quantitative Spectroscopy and Radiative Transfer': 'J. Quant. Spectrosc. Radiat. Transf.',
  'Monthly Notices of the Royal Astronomical Society': 'Mon. Not. R. Astron. Soc.',
  'The Astrophysical Journal Supplement Series': 'Astrophys. J. Suppl. Ser.',
  'The Astrophysical Journal': 'Astrophys. J.',
  'The Journal of Chemical Physics': 'J. Chem. Phys.',
  'Physical Chemistry Chemical Physics': 'Phys. Chem. Chem. Phys.',
  'Molecular Physics': 'Mol. Phys.',
  'Scientific Data': 'Sci. Data',
};

// "S. Mahmoud, et al., Astrophys. J. Suppl. Ser., 2025" (references table)
export function compactCite(pub) {
  const names = formatAuthors(pub.authors).split(', ');
  const journal = JOURNAL_ABBREV[pub.journal] ?? pub.journal;
  return [names[0] + (names.length > 1 ? ', et al.' : ''), latexToHtml(journal), pub.year].join(', ');
}

// "Syme & McKemmish (2020)" / "Mahmoud et al. (2025)"
export function shortCite(pub) {
  const lasts = latexToHtml(pub.authors).split(/\s+and\s+/).map((a) => a.split(',')[0]);
  const who = lasts.length > 2 ? `${lasts[0]} et al.` : lasts.join(' &amp; ');
  return `${who} (${pub.year})`;
}
