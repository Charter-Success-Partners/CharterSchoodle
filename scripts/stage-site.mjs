import { copyFile, lstat, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const publicFiles = [
  'index.html', 'style.css', 'favicon.png', '.nojekyll',
  'src/app.js', 'src/game.js', 'src/storage.js', 'src/dialog.js', 'src/auth.js', 'src/onboarding.js', 'src/leaderboard.js', 'src/supabase-config.js',
  'src/vendor/supabase.js', 'src/vendor/LICENSE.supabase', 'src/vendor/supabase-manifest.json',
  'assets/csp-logo-2026.png', 'assets/social-card.png', 'data/schools.json', 'data/puzzles.json',
];

/** Copy only the reviewed runtime assets; validate everything before clearing prior output. */
export async function stageSite({ root = '.', outputDir = '_site' } = {}) {
  root = resolve(root);
  outputDir = resolve(outputDir);
  // Only this designated build directory is disposable; never accept arbitrary
  // repository directories, even when they do not contain a runtime asset.
  if (outputDir !== resolve(root, '_site')) {
    throw new Error('Site output directory must be the designated <root>/_site directory');
  }
  // Work from the physical root, so ancestor symlinks cannot redirect cleanup.
  root = await realpath(root);
  outputDir = resolve(root, '_site');
  const files = [...publicFiles];
  for (const file of files) {
    const info = await lstat(resolve(root, file)).catch(error => {
      if (error.code === 'ENOENT') throw new Error(`Missing required public asset: ${file}`);
      throw error;
    });
    if (!info.isFile()) throw new Error(`Required public asset must be a regular file: ${file}`);
  }
  const cname = await readFile(resolve(root, 'CNAME'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (cname !== null) {
    const sandbox = { window: {} };
    runInNewContext(await readFile(resolve(root, 'src/supabase-config.js'), 'utf8'), sandbox, { timeout: 1000 });
    const configured = new URL(sandbox.window.CHARTERSCHOOLDLE_SUPABASE?.publicUrl);
    if (cname.trim() !== configured.hostname || configured.pathname !== '/') {
      throw new Error('CNAME does not match configured public URL');
    }
    // This checks intended-domain configuration only. Live DNS is a rollout check.
    files.push('CNAME');
  }
  const outputInfo = await lstat(outputDir).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (outputInfo && (!outputInfo.isDirectory() || outputInfo.isSymbolicLink())) {
    throw new Error('Site output directory must be a real directory, not a symlink or file');
  }
  const physicalParent = await realpath(dirname(outputDir));
  const physicalOutput = outputInfo ? await realpath(outputDir) : resolve(physicalParent, '_site');
  if (physicalParent !== root || physicalOutput !== outputDir) {
    throw new Error('Site output directory must remain inside the resolved project root');
  }
  await rm(outputDir, { recursive: true, force: true });
  for (const file of files) {
    const destination = resolve(outputDir, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(root, file), destination);
  }
  return files.sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const file of await stageSite({ root: process.cwd(), outputDir: resolve('_site') })) console.log(file);
}
