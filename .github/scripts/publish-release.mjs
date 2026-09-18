import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REGISTRY = 'https://registry.npmjs.org';
const NPM_CACHE = join(process.cwd(), '.release', 'npm-cache');
const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies'];
const VERIFICATION_ATTEMPTS = 61;
const VERIFICATION_INTERVAL_MS = 5000;

export function materializeWorkspaceDependencies(manifest, versions) {
  const materialized = structuredClone(manifest);
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, specifier] of Object.entries(materialized[field] || {})) {
      if (typeof specifier !== 'string' || !specifier.startsWith('workspace:')) continue;
      if (!versions[name]) throw new Error(`Missing workspace version for ${name}`);
      const range = specifier.slice('workspace:'.length);
      if (range === '^') materialized[field][name] = `^${versions[name]}`;
      else if (range === '~') materialized[field][name] = `~${versions[name]}`;
      else if (range === '' || range === '*') materialized[field][name] = versions[name];
      else materialized[field][name] = range;
    }
  }
  return materialized;
}

export async function publishRelease(item, head, io) {
  const existing = await io.exactOrNull();
  if (existing) {
    if (existing.version === item.version && existing.gitHead === head) {
      return { published: false, recovered: true };
    }
    throw new Error(`${item.name}@${item.version} is already owned by another source commit.`);
  }

  const current = await io.latestOrNull();
  const actualLatest = current?.version || null;
  const actualLatestHead = current?.gitHead || null;
  if (actualLatest !== item.expectedLatest || actualLatestHead !== item.expectedLatestHead) {
    throw new Error(`${item.name}: npm latest changed after release planning; retry on the next run.`);
  }

  const status = io.publish();
  let actual;
  for (let attempt = 0; attempt < VERIFICATION_ATTEMPTS; attempt++) {
    try {
      actual = await io.exact();
      break;
    } catch (error) {
      if (attempt === VERIFICATION_ATTEMPTS - 1) {
        throw new Error(
          `Could not verify ${item.name}@${item.version} after publication (exit ${status}); next run will reconcile it.`,
          { cause: error },
        );
      }
      await io.wait(VERIFICATION_INTERVAL_MS);
    }
  }
  if (actual.version !== item.version) throw new Error('Registry returned an unexpected version.');
  if (actual.gitHead && actual.gitHead !== head) {
    throw new Error(`${item.name}@${item.version} was published from another source commit.`);
  }
  if (status !== 0 && actual.gitHead !== head) {
    throw new Error(`npm publish failed for ${item.name}@${item.version} with exit ${status}.`);
  }
  return { published: status === 0, recovered: status !== 0 };
}

function npmView(specifier) {
  mkdirSync(NPM_CACHE, { recursive: true });
  const result = spawnSync(
    'npm',
    ['view', specifier, 'version', 'gitHead', '--json', '--prefer-online', `--registry=${REGISTRY}`, `--cache=${NPM_CACHE}`],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    if (/E404|404 Not Found/.test(result.stderr)) return null;
    throw new Error(`Could not read npm metadata for ${specifier}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

function validatePackage(item, versions) {
  const packagePath = join(item.path, 'package.json');
  const original = readFileSync(packagePath, 'utf8');
  const manifest = materializeWorkspaceDependencies(JSON.parse(original), versions);
  manifest.version = item.version;
  if (JSON.stringify(manifest).includes('workspace:')) {
    throw new Error(`${item.name}: package manifest still contains workspace dependency ranges.`);
  }
  writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  try {
    const result = spawnSync(
      'npm',
      ['pack', '--dry-run', '--ignore-scripts', '--json', `--cache=${NPM_CACHE}`],
      { cwd: item.path, encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    const [archive] = JSON.parse(result.stdout);
    const files = new Set(archive.files.map(file => file.path));
    for (const key of ['main', 'module', 'types']) {
      const entry = manifest[key]?.replace(/^\.\//, '');
      if (entry && !files.has(entry)) throw new Error(`${item.name}: missing packaged ${key}: ${entry}`);
    }
  } finally {
    writeFileSync(packagePath, original);
  }
}

function publishPackage(item, versions) {
  const packagePath = join(item.path, 'package.json');
  const original = readFileSync(packagePath, 'utf8');
  const manifest = materializeWorkspaceDependencies(JSON.parse(original), versions);
  manifest.version = item.version;
  writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  try {
    return spawnSync(
      'npm',
      ['publish', '--access', 'public', '--tag', 'latest', `--registry=${REGISTRY}`, `--cache=${NPM_CACHE}`],
      { cwd: item.path, stdio: 'inherit' },
    ).status;
  } finally {
    writeFileSync(packagePath, original);
  }
}

function recordTag(item, head) {
  const tag = `${item.name}@${item.version}`;
  const remote = execFileSync(
    'git',
    ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`],
    { encoding: 'utf8' },
  ).trim();
  if (remote) {
    const existing = remote.split(/\s+/)[0];
    if (existing !== head) throw new Error(`${tag} already points to ${existing}; refusing to replace it.`);
    console.log(`${tag}: release tag already present.`);
    return;
  }
  const local = spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { encoding: 'utf8' });
  if (local.status === 0 && local.stdout.trim() !== head) {
    throw new Error(`${tag} exists locally at another commit; refusing to replace it.`);
  }
  if (local.status !== 0) execFileSync('git', ['tag', tag, head]);
  execFileSync('git', ['push', 'origin', `refs/tags/${tag}`], { stdio: 'inherit' });
}

async function main() {
  const plan = JSON.parse(readFileSync('.release/plan.json', 'utf8'));
  const verifyOnly = process.argv.includes('--verify-only');
  for (const item of plan.items.filter(item => item.mode === 'publish')) {
    validatePackage(item, plan.versions);
    console.log(`${item.name}@${item.version}: package contents verified.`);
  }
  if (verifyOnly) return;

  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  for (const item of plan.items) {
    if (item.mode === 'tag') {
      const exact = npmView(`${item.name}@${item.version}`);
      if (!exact || exact.gitHead !== head) {
        throw new Error(`${item.name}@${item.version}: cannot recover tag without matching npm gitHead.`);
      }
      recordTag(item, head);
      continue;
    }

    const result = await publishRelease(item, head, {
      exactOrNull: async () => npmView(`${item.name}@${item.version}`),
      latestOrNull: async () => npmView(`${item.name}@latest`),
      publish: () => publishPackage(item, plan.versions),
      exact: async () => {
        const value = npmView(`${item.name}@${item.version}`);
        if (!value) throw new Error('Registry version is not visible yet.');
        return value;
      },
      wait: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    });
    console.log(`${item.name}@${item.version}: ${result.recovered ? 'reconciled' : 'published'}.`);
    recordTag(item, head);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
