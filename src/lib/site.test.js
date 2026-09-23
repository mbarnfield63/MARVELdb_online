// Run: npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { atomCount, groupOf, sortRuns, runLabel, latexToHtml, formatAuthors, shortCite, compactCite } from './site.js';

test('grouping by atom count, charge ignored', () => {
  assert.deepEqual(['CO', 'CO2', 'H2O', 'HOCl', 'HCO+', 'H3+', 'C2H2', 'CH4'].map(atomCount), [2, 3, 3, 3, 3, 3, 4, 5]);
  assert.equal(groupOf('CN'), 'Diatomics');
  assert.equal(groupOf('H3+'), 'Triatomics');
  assert.equal(groupOf('CH4'), 'Polyatomics');
});

test('runs: highest version first, newest first, latest per version', () => {
  const runs = sortRuns([
    { id: 1, version: '4.1', loaded_at: '2026-01-01', publication: 'A' },
    { id: 2, version: 'unknown', loaded_at: '2026-09-01', publication: 'B' },
    { id: 3, version: '5.0', loaded_at: '2026-02-01', publication: 'C' },
    { id: 4, version: '4.1', loaded_at: '2026-03-01', publication: 'A' },
  ]);
  assert.deepEqual(runs.map((r) => [r.id, r.latest]), [[3, true], [4, true], [1, false], [2, true]]);
  assert.equal(runLabel(runs[1]), 'MARVEL 4.1 — A (latest)');
  assert.equal(runLabel(runs[2]), 'MARVEL 4.1 — A (loaded 2026-01-01)');
  assert.equal(runLabel(runs[3]), 'MARVEL (version unknown) — B (latest)');
});

test('BibTeX LaTeX to HTML', () => {
  assert.equal(latexToHtml('spectra of {}^{13}C^{16}O_2'), 'spectra of <sup>13</sup>C<sup>16</sup>O<sub>2</sub>');
  assert.equal(latexToHtml('{Experimental levels of $^{12}$C$^{14}$N}'), 'Experimental levels of <sup>12</sup>C<sup>14</sup>N');
  assert.equal(formatAuthors("Cs{\\'a}sz{\\'a}r, Attila G. and Syme, Anna-Maree"), 'A. G. Császár, A.-M. Syme');
  assert.equal(compactCite({ authors: 'Syme, Anna-Maree and McKemmish, L. K.', journal: 'MNRAS', year: 2020 }), 'A.-M. Syme, et al., MNRAS, 2020');
  assert.equal(compactCite({ authors: 'Watson, J. K. G.', journal: 'JMS', year: 2004 }), 'J. K. G. Watson, JMS, 2004');
  assert.equal(shortCite({ authors: 'Syme, A. and McKemmish, L. K.', year: 2020 }), 'Syme &amp; McKemmish (2020)');
});
