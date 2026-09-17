import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

writeFileSync(
  join(root, 'src/version.ts'),
  `/** Auto-synced from package.json — do not edit; run \`npm run build\`. */
export function getProductFormSdkVersion(): string {
  return '${version}';
}

/** @deprecated Prefer getProductFormSdkVersion(); kept for gate/export compatibility. */
export const SDK_VERSION = getProductFormSdkVersion();
`,
);
