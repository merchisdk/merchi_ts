import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chooseVersion,
  createReleasePlan,
  expandChangedPackages,
  topologicalOrder,
} from './release-plan.mjs';

const packages = [
  { name: 'cart', version: '1.0.0', path: 'packages/cart', internalDependencies: ['form', 'sdk'] },
  { name: 'editor', version: '1.0.0', path: 'packages/editor', internalDependencies: [] },
  { name: 'form', version: '1.2.0', path: 'packages/form', internalDependencies: ['sdk'] },
  { name: 'sdk', version: '2.0.0', path: 'packages/sdk', internalDependencies: [] },
];

test('orders dependencies before their consumers', () => {
  assert.deepEqual(topologicalOrder(packages), ['editor', 'sdk', 'form', 'cart']);
});

test('rejects workspace dependency cycles', () => {
  const cyclic = [
    { name: 'a', internalDependencies: ['b'] },
    { name: 'b', internalDependencies: ['a'] },
  ];
  assert.throws(() => topologicalOrder(cyclic), /cycle/);
});

test('cascades a changed dependency to all consumers', () => {
  assert.deepEqual(
    [...expandChangedPackages(packages, new Set(['sdk']))].sort(),
    ['cart', 'form', 'sdk'],
  );
});

test('does not release unrelated packages', () => {
  assert.deepEqual([...expandChangedPackages(packages, new Set(['editor']))], ['editor']);
});

test('chooses a free stable version without rolling the registry back', () => {
  assert.equal(chooseVersion('1.3.0', '1.4.0', ['1.4.0', '1.4.1']), '1.4.2');
});

test('release plan is topological and explains dependency propagation', () => {
  const registry = new Map(packages.map(pkg => [pkg.name, {
    exists: true,
    latestVersion: pkg.version,
    versions: [pkg.version],
  }]));
  const items = createReleasePlan(packages, registry, new Set(['sdk']));
  assert.deepEqual(items.map(item => item.name), ['sdk', 'form', 'cart']);
  assert.equal(items[0].reason, 'source changed');
  assert.equal(items[1].reason, 'workspace dependency changed');
});
