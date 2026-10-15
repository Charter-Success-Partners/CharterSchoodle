import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { stageSite } from '../../scripts/stage-site.mjs';

const required = ['.nojekyll', 'index.html', 'style.css', 'favicon.png',
  'src/app.js', 'src/game.js', 'src/storage.js', 'src/dialog.js', 'src/auth.js', 'src/leaderboard.js', 'src/supabase-config.js',
  'src/vendor/supabase.js', 'src/vendor/LICENSE.supabase', 'src/vendor/supabase-manifest.json',
  'assets/csp-logo-2026.png', 'assets/social-card.png', 'data/schools.json', 'data/puzzles.json'].sort();
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'charterschoodle-stage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of required) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), file === 'src/supabase-config.js'
      ? 'window.CHARTERSCHOOLDLE_SUPABASE={publicUrl:"https://example.test/"};' : `fixture:${file}`);
  }
  return { root, outputDir: join(root, '_site') };
}
async function filesAt(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const file = join(prefix, entry.name);
    files.push(...(entry.isDirectory() ? await filesAt(root, file) : [file]));
  }
  return files.sort();
}
test('stage_contains_required_public_files', async t => {
  const options = await fixture(t);
  assert.deepEqual(await stageSite(options), required);
  assert.deepEqual(await filesAt(options.outputDir), required);
  assert.equal(await readFile(join(options.outputDir, 'src/app.js'), 'utf8'), 'fixture:src/app.js');
});
test('stage_excludes_private_and_research_artifacts', async t => {
  const options = await fixture(t);
  for (const file of ['README.md', 'original logo.png', 'docs/private.sql', 'tests/private.js', 'data/puzzle-source.json', 'data/research.json', 'src/decoy.js', 'src/vendor/decoy.js', 'assets/capture.png', '.git/config', 'node_modules/decoy.js', '_site/stale-secret.txt']) {
    await mkdir(dirname(join(options.root, file)), { recursive: true });
    await writeFile(join(options.root, file), 'must never publish');
  }
  await stageSite(options);
  assert.deepEqual(await filesAt(options.outputDir), required);
});
test('stage_fails_for_missing_required_asset', async t => {
  const options = await fixture(t);
  await rm(join(options.root, 'assets/social-card.png'));
  await assert.rejects(stageSite(options), /Missing required public asset: assets\/social-card.png/);
});
test('stage_accepts_only_cname_matching_configured_domain', async t => {
  const options = await fixture(t);
  await writeFile(join(options.root, 'CNAME'), 'example.test\n');
  assert.deepEqual(await stageSite(options), [...required, 'CNAME'].sort());
  await writeFile(join(options.root, 'CNAME'), 'wrong.test\n');
  await assert.rejects(stageSite(options), /CNAME does not match configured public URL/);
});
test('stage_rejects_unsafe_output_without_deleting_sources', async t => {
  const options = await fixture(t);
  await assert.rejects(stageSite({ ...options, outputDir: options.root }), /output directory/);
  assert.equal(await readFile(join(options.root, 'index.html'), 'utf8'), 'fixture:index.html');
});
test('stage_rejects_protected_and_unapproved_output_directories_without_removing_contents', async t => {
  for (const directory of ['.git', 'docs', 'src', 'data', 'assets', 'build']) {
    await t.test(directory, async t => {
      const options = await fixture(t);
      const outputDir = join(options.root, directory);
      await mkdir(outputDir, { recursive: true });
      const protectedFile = join(outputDir, 'keep.txt');
      await writeFile(protectedFile, 'protected content');
      await assert.rejects(stageSite({ ...options, outputDir }), /output directory/);
      assert.equal(await readFile(protectedFile, 'utf8'), 'protected content');
      assert.equal(await readFile(join(options.root, 'index.html'), 'utf8'), 'fixture:index.html');
    });
  }
});
test('stage_rejects_intermediate_symlink_output_without_removing_target_contents', async t => {
  const options = await fixture(t);
  const protectedRoot = await mkdtemp(join(tmpdir(), 'charterschoodle-protected-'));
  t.after(() => rm(protectedRoot, { recursive: true, force: true }));
  await mkdir(join(protectedRoot, '_site'));
  const protectedFile = join(protectedRoot, '_site', 'keep.txt');
  await writeFile(protectedFile, 'protected content');
  await symlink(protectedRoot, join(options.root, 'linked'), 'dir');
  await assert.rejects(stageSite({ ...options, outputDir: join(options.root, 'linked', '_site') }), /output directory/);
  assert.equal(await readFile(protectedFile, 'utf8'), 'protected content');
});
test('stage_rejects_symlink_at_designated_output_without_removing_link_or_target', async t => {
  const options = await fixture(t);
  const protectedDir = join(options.root, 'docs');
  await mkdir(protectedDir);
  const protectedFile = join(protectedDir, 'keep.txt');
  await writeFile(protectedFile, 'protected content');
  await symlink(protectedDir, options.outputDir, 'dir');
  await assert.rejects(stageSite(options), /output directory/);
  assert.equal(await readFile(protectedFile, 'utf8'), 'protected content');
  assert.equal(await readFile(join(options.outputDir, 'keep.txt'), 'utf8'), 'protected content');
});
const workflow = async file => parse(await readFile(new URL(`../../.github/workflows/${file}`, import.meta.url), 'utf8'));
test('only_one_pages_workflow_exists', async () => {
  const directory = new URL('../../.github/workflows/', import.meta.url);
  const deployers = [];
  for (const file of await readdir(directory)) {
    const value = await workflow(file);
    if (Object.values(value.jobs).some(job => job.steps?.some(step => step.uses?.startsWith('actions/deploy-pages@')))) deployers.push(file);
  }
  assert.deepEqual(deployers, ['deploy-pages.yml']);
  const deploy = await workflow('deploy-pages.yml');
  assert.deepEqual(deploy.on.push.branches, ['main']);
  assert.ok(deploy.on.workflow_dispatch !== undefined);
  assert.equal(deploy.on.workflow_call.inputs.ref.type, 'string');
  assert.equal(deploy.concurrency.group, 'github-pages');
  assert.equal(deploy.concurrency['cancel-in-progress'], false);
  const steps = deploy.jobs.build.steps;
  assert.equal(steps.find(step => step.uses?.startsWith('actions/checkout@')).with.ref, '${{ inputs.ref || github.sha }}');
  assert.ok(Number(steps.find(step => step.uses?.startsWith('actions/setup-node@')).with['node-version']) >= 22);
  const commands = steps.flatMap(step => step.run?.split('\n') || []).map(command => command.trim());
  for (const command of ['npm ci', 'npm run vendor:check', 'npm test', 'npm run stage']) assert.ok(commands.includes(command), `Missing validation: ${command}`);
  assert.equal(steps.find(step => step.uses?.startsWith('actions/upload-pages-artifact@')).with.path, '_site');
});
test('refresh_calls_reusable_deploy_with_commit_sha', async () => {
  const refresh = await workflow('refresh-puzzles.yml');
  assert.equal(refresh.jobs.refresh.permissions?.contents, 'write');
  assert.equal(refresh.jobs.refresh.permissions.pages, undefined);
  assert.equal(refresh.jobs.deploy.uses, './.github/workflows/deploy-pages.yml');
  assert.equal(refresh.jobs.deploy.needs, 'refresh');
  assert.equal(refresh.jobs.deploy.if, "needs.refresh.outputs.changed == 'true'");
  assert.equal(refresh.jobs.deploy.with.ref, '${{ needs.refresh.outputs.sha }}');
  assert.equal(refresh.jobs.deploy.permissions.pages, 'write');
  assert.equal(refresh.jobs.deploy.permissions['id-token'], 'write');
  assert.equal(refresh.jobs.deploy.permissions.contents, 'read');
  assert.equal(refresh.jobs.refresh.outputs.sha, '${{ steps.commit.outputs.sha }}');
  assert.equal(refresh.jobs.refresh.outputs.changed, '${{ steps.commit.outputs.changed }}');
  const script = refresh.jobs.refresh.steps.find(step => step.id === 'commit').run;
  assert.ok(script.indexOf('git push') < script.indexOf('git rev-parse HEAD'));
  assert.match(script, /changed=true.*GITHUB_OUTPUT/);
  assert.match(script, /sha=.*git rev-parse HEAD.*GITHUB_OUTPUT/);
  assert.notEqual(refresh.concurrency?.group, 'github-pages');
  assert.notEqual(refresh.jobs.deploy.concurrency?.group, 'github-pages');
});

test('social_card_rejects_callback_or_credential_urls_before_rendering', async () => {
  const { renderSocialCard } = await import('../../scripts/render-social-card.mjs');
  for (const baseUrl of ['https://example.test/?code=private', 'https://example.test/#access_token=private', 'https://user:pass@example.test/', 'http://example.test/']) {
    await assert.rejects(renderSocialCard({ baseUrl, outputPath: '/tmp/unused-social.png' }), /public URL/);
  }
});
