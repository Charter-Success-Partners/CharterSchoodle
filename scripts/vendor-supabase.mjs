import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = '2.118.0';
const packageName = '@supabase/supabase-js';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

try {
  const mode = process.argv[2];
  if (!['--sync', '--check'].includes(mode) || process.argv.length !== 3) throw new Error('Usage: vendor-supabase.mjs --sync|--check');
  const [pkg, lock, installed] = await Promise.all([
    readJson('package.json'), readJson('package-lock.json'), readJson(`node_modules/${packageName}/package.json`),
  ]);
  const locked = lock.packages?.[`node_modules/${packageName}`];
  if (pkg.dependencies?.[packageName] !== version || lock.packages?.['']?.dependencies?.[packageName] !== version || installed.version !== version || locked?.version !== version || !locked.integrity || !locked.resolved) {
    throw new Error(`Expected exact locked and installed ${packageName}@${version}`);
  }
  const files = [
    { source: `node_modules/${packageName}/dist/umd/supabase.js`, target: 'src/vendor/supabase.js' },
    { source: `node_modules/${packageName}/LICENSE`, target: 'src/vendor/LICENSE.supabase' },
  ];
  const artifacts = await Promise.all(files.map(async (file) => ({ ...file, bytes: await readFile(path.join(root, file.source)) })));
  const manifest = {
    package: packageName, version, source: locked.resolved, integrity: locked.integrity,
    artifacts: artifacts.map(({ source, target, bytes }) => ({ source: source.replace('node_modules/', ''), file: target, sha256: hash(bytes) })),
  };
  const manifestPath = path.join(root, 'src/vendor/supabase-manifest.json');
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  if (mode === '--sync') {
    await mkdir(path.dirname(manifestPath), { recursive: true });
    for (const { target, bytes } of artifacts) await writeFile(path.join(root, target), bytes);
    await writeFile(manifestPath, manifestBytes);
    console.log(`Vendored official ${packageName}@${version}: bundle and license copied byte-for-byte.`);
  } else {
    for (const { target, bytes } of artifacts) {
      if (!bytes.equals(await readFile(path.join(root, target)))) throw new Error(`Vendor mismatch: ${target}; run npm run vendor:sync`);
    }
    if (!manifestBytes.equals(await readFile(manifestPath))) throw new Error('Vendor provenance manifest mismatch; run npm run vendor:sync');
    console.log(`Verified official ${packageName}@${version}: bundle, license, and SHA-256 provenance are byte-identical.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
