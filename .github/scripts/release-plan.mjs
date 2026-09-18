import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REGISTRY = 'https://registry.npmjs.org';
const NPM_CACHE = join(process.cwd(), '.release', 'npm-cache');
const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

const stableParts = value => {
  if (!/^\d+\.\d+\.\d+$/.test(value || '')) {
    throw new Error(`Expected a stable semantic version, received: ${value}`);
  }
  return value.split('.').map(Number);
};

export const compareVersions = (left, right) => {
  const a = stableParts(left);
  const b = stableParts(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
};

export const bumpPatch = version => {
  const [major, minor, patch] = stableParts(version);
  return `${major}.${minor}.${patch + 1}`;
};

export function topologicalOrder(packages) {
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  const dependencies = new Map(
    packages.map(pkg => [pkg.name, new Set(pkg.internalDependencies.filter(name => byName.has(name)))]),
  );
  const dependents = new Map(packages.map(pkg => [pkg.name, new Set()]));
  for (const [name, names] of dependencies) {
    for (const dependency of names) dependents.get(dependency).add(name);
  }

  const ready = [...dependencies]
    .filter(([, names]) => names.size === 0)
    .map(([name]) => name)
    .sort();
  const ordered = [];
  while (ready.length) {
    const name = ready.shift();
    ordered.push(name);
    for (const dependent of [...dependents.get(name)].sort()) {
      dependencies.get(dependent).delete(name);
      if (dependencies.get(dependent).size === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }

  if (ordered.length !== packages.length) {
    const cyclic = [...dependencies]
      .filter(([, names]) => names.size > 0)
      .map(([name]) => name)
      .sort();
    throw new Error(`Workspace dependency cycle detected: ${cyclic.join(', ')}`);
  }
  return ordered;
}

export function expandChangedPackages(packages, directlyChanged) {
  const selected = new Set(directlyChanged);
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  for (const name of topologicalOrder(packages)) {
    const pkg = byName.get(name);
    if (pkg.internalDependencies.some(dependency => selected.has(dependency))) selected.add(name);
  }
  return selected;
}

export function chooseVersion(localVersion, latestVersion, occupiedVersions = []) {
  stableParts(localVersion);
  let candidate = latestVersion
    ? compareVersions(localVersion, latestVersion) > 0
      ? localVersion
      : bumpPatch(latestVersion)
    : localVersion;
  const occupied = new Set(occupiedVersions);
  while (occupied.has(candidate)) candidate = bumpPatch(candidate);
  return candidate;
}

export function createReleasePlan(packages, registryByName, directlyChanged, tagOnly = []) {
  const selected = expandChangedPackages(packages, directlyChanged);
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  const order = topologicalOrder(packages);
  const items = [];
  for (const name of order) {
    if (!selected.has(name)) continue;
    const pkg = byName.get(name);
    const registry = registryByName.get(name) || { exists: false, versions: [] };
    items.push({
      mode: 'publish',
      name,
      path: pkg.path,
      version: chooseVersion(pkg.version, registry.latestVersion, registry.versions),
      expectedLatest: registry.latestVersion || null,
      expectedLatestHead: registry.latestHead || null,
      reason: directlyChanged.has(name) ? 'source changed' : 'workspace dependency changed',
    });
  }
  for (const name of order) {
    if (!tagOnly.includes(name) || selected.has(name)) continue;
    const pkg = byName.get(name);
    const registry = registryByName.get(name);
    items.push({
      mode: 'tag',
      name,
      path: pkg.path,
      version: pkg.version,
      expectedLatest: registry.latestVersion,
      expectedLatestHead: registry.latestHead,
      reason: 'recover missing release tag',
    });
  }
  return items;
}

function loadPackages() {
  const directories = readdirSync('packages', { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join('packages', entry.name))
    .sort();
  const manifests = directories.map(path => ({
    path,
    manifest: JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')),
  }));
  const workspaceNames = new Set(manifests.map(({ manifest }) => manifest.name));
  return manifests.map(({ path, manifest }) => ({
    name: manifest.name,
    version: manifest.version,
    path,
    internalDependencies: DEPENDENCY_FIELDS.flatMap(field =>
      Object.keys(manifest[field] || {}).filter(name => workspaceNames.has(name)),
    ),
  }));
}

function npmView(name) {
  mkdirSync(NPM_CACHE, { recursive: true });
  const result = spawnSync(
    'npm',
    ['view', name, 'version', 'gitHead', 'versions', '--json', '--prefer-online', `--registry=${REGISTRY}`, `--cache=${NPM_CACHE}`],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    if (/E404|404 Not Found/.test(result.stderr)) {
      return { exists: false, latestVersion: null, latestHead: null, versions: [] };
    }
    throw new Error(`Could not read npm metadata for ${name}: ${result.stderr.trim()}`);
  }
  const value = JSON.parse(result.stdout);
  return {
    exists: true,
    latestVersion: value.version,
    latestHead: value.gitHead || null,
    versions: Array.isArray(value.versions) ? value.versions : [value.versions].filter(Boolean),
  };
}

function isAncestor(commit, head) {
  if (!commit) return false;
  return spawnSync('git', ['merge-base', '--is-ancestor', commit, head], { stdio: 'ignore' }).status === 0;
}

function releaseTagCommit(name) {
  const output = execFileSync(
    'git',
    ['tag', '--merged', 'HEAD', '--list', `${name}@*`, '--sort=-version:refname'],
    { encoding: 'utf8' },
  ).trim();
  const tag = output.split('\n').find(Boolean);
  if (!tag) return null;
  return execFileSync('git', ['rev-list', '-n', '1', tag], { encoding: 'utf8' }).trim();
}

function pathChanged(baseline, head, path) {
  if (!baseline) return true;
  const result = spawnSync('git', ['diff', '--quiet', baseline, head, '--', path]);
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(`Could not compare ${path} with release baseline ${baseline}`);
}

function writeOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  for (const [key, value] of Object.entries(values)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

async function main() {
  const shouldWrite = process.argv.includes('--write');
  const packages = loadPackages();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const registryByName = new Map();
  const directlyChanged = new Set();
  const tagOnly = [];

  for (const pkg of packages) {
    const registry = npmView(pkg.name);
    registryByName.set(pkg.name, registry);
    const tagCommit = releaseTagCommit(pkg.name);

    if (
      !tagCommit &&
      registry.exists &&
      registry.latestVersion === pkg.version &&
      registry.latestHead === head
    ) {
      tagOnly.push(pkg.name);
      continue;
    }

    let baseline = tagCommit;
    if (!baseline && registry.exists) {
      if (!registry.latestHead || !isAncestor(registry.latestHead, head)) {
        throw new Error(
          `${pkg.name}: npm latest has no source commit contained in main; refusing to replace a manual release.`,
        );
      }
      baseline = registry.latestHead;
    }
    if (!registry.exists || pathChanged(baseline, head, pkg.path)) directlyChanged.add(pkg.name);
  }

  const items = createReleasePlan(packages, registryByName, directlyChanged, tagOnly);
  const versions = Object.fromEntries(packages.map(pkg => [pkg.name, pkg.version]));
  for (const item of items) {
    if (item.mode === 'publish') versions[item.name] = item.version;
  }

  if (shouldWrite) {
    for (const item of items) {
      if (item.mode !== 'publish') continue;
      const packagePath = join(item.path, 'package.json');
      const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
      manifest.version = item.version;
      writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }

  mkdirSync('.release', { recursive: true });
  writeFileSync(
    '.release/plan.json',
    `${JSON.stringify({ head, items, versions }, null, 2)}\n`,
  );
  const versioned = items.some(item => item.mode === 'publish');
  writeOutputs({ work: items.length > 0, versioned, count: items.length });

  if (!items.length) {
    console.log('No changed packages require publication.');
    return;
  }
  console.log('Release order:');
  for (const item of items) console.log(`- ${item.name}@${item.version} (${item.reason})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
