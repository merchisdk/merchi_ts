const COMPONENTS = new Set([
  '@merchi/sdk', '@merchi/cart', '@merchi/checkout', '@merchi/invoice',
  '@merchi/product-form', '@merchi/error-catch', '@merchi/product-form-sdk',
  '@merchi/product-editor', '@merchi/image-editor',
]);
const RELEASE_VERSION = /^\d+\.\d+\.\d+$/;

export function releaseNotice(item, head, notes = {}) {
  if (!COMPONENTS.has(item.name)) return null;
  if (!/^[a-f0-9]{40}$/.test(head) || !RELEASE_VERSION.test(item.version)) {
    throw new Error('A verified source commit and exact package version are required.');
  }
  const fixedIssues = notes[item.name]?.fixed_issues ?? [];
  if (!Array.isArray(fixedIssues) || fixedIssues.some(n => !Number.isInteger(n) || n < 1)) {
    throw new Error('Fixed issues must be explicitly recorded positive issue numbers.');
  }
  const coordinated = notes.coordinated_packages;
  if (coordinated !== undefined && (
    !coordinated || Array.isArray(coordinated) || typeof coordinated !== 'object' ||
    Object.keys(coordinated).length < 2 ||
    Object.entries(coordinated).some(([name, version]) =>
      !COMPONENTS.has(name) || typeof version !== 'string' || !RELEASE_VERSION.test(version))
  )) {
    throw new Error('Coordinated packages require two or more known packages at exact release versions.');
  }
  return {
    upstream: 'merchisdk/merchi_ts', component: item.name, version: item.version,
    kind: 'npm', commit_sha: head,
    availability_url: `https://www.npmjs.com/package/${item.name}/v/${item.version}`,
    summary: `Published ${item.name}@${item.version}. Package contents, registry availability and its source tag have been verified by the release pipeline.`,
    migration: `Inspect the repository lockfile and applicability, update ${item.name} to ${item.version} when appropriate, preserve site customizations, and create a tested upgrade PR.`,
    verification: 'Verify the exact installed version and deployed commit, run repository checks and relevant cart/checkout flows, then record adoption through System Agent. An upstream release alone does not resolve a downstream incident.',
    affected_versions: [], fixed_issues: [...new Set(fixedIssues)].sort((a, b) => a - b),
    ...(coordinated?.[item.name] === item.version ? { coordinated_packages: coordinated } : {}),
  };
}
