// Run: npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { toWavenumber, coverageBins, groupPoints, COVERAGE } from './figures.js';

test('units convert to cm-1, sign dropped', () => {
  assert.equal(toWavenumber(-2.5), 2.5);
  assert.ok(Math.abs(toWavenumber(115271.204, 'MHz') - 3.845033) < 1e-5);
  assert.equal(toWavenumber(1, 'furlongs'), null);
});

test('coverage bins MHz lines with their cm-1 twins, negatives count as removed', () => {
  const units = { A: 'MHz', B: 'cm-1' };
  const { kept, removed } = coverageBins([
    { obs_freq: 115271.204, source_tag: 'A' },
    { obs_freq: 3.845, source_tag: 'B' },
    { obs_freq: -3.845, source_tag: 'B' },
  ], units);
  const i = kept.findIndex((k) => k);
  assert.equal(kept[i], 2);
  assert.equal(removed[i], 1);
  assert.equal(kept.length, COVERAGE.bins);
});

test('group points: one series per group, smallest folded into Other, dedup on the grid', () => {
  const g = (label, n) => ({ label, jE: Array.from({ length: n }, (_, i) => [i, i * 10]) });
  const fig = groupPoints([g('A', 3), g('B', 1), g('C', 4), g('D', 5), g('E', 6), g('F', 7)], { w: 100, h: 100 });
  assert.deepEqual(fig.cats.map((c) => c.label), ['A', 'C', 'D', 'E', 'F', 'Other']);
  assert.equal(fig.cats[5].n, 1);
  assert.equal(groupPoints([{ label: 'x', jE: [[NaN, 1]] }]), null);
  const dup = groupPoints([{ label: 'x', jE: [[1, 1], [1, 1.0000001]] }], { w: 10, h: 10 });
  assert.equal(dup.points.length, 1);
});
