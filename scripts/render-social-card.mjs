import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { chromium } from '@playwright/test';

/** Render one code-native brand preview. The committed PNG needs no runtime renderer. */
export async function renderSocialCard({ baseUrl, outputPath, executablePath } = {}) {
  let publicUrl;
  try {
    publicUrl = new URL(baseUrl);
    if (publicUrl.protocol !== 'https:' || publicUrl.search || publicUrl.hash || publicUrl.username || publicUrl.password) throw new Error();
  } catch { throw new Error('Social card requires a clean HTTPS public URL'); }
  const template = await readFile(new URL('./social-card.html', import.meta.url), 'utf8');
  const logo = await readFile(new URL('../assets/csp-logo-2026.png', import.meta.url));
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    await page.setContent(template, { waitUntil: 'networkidle' });
    await page.evaluate(async ({ logo, address }) => {
      const image = document.querySelector('#logo');
      image.src = logo;
      document.querySelector('#address').textContent = address;
      await image.decode();
      const faces = await document.fonts.load('700 76px "Open Sans"');
      await document.fonts.ready;
      if (!faces.length || !document.fonts.check('700 76px "Open Sans"')) throw new Error('Open Sans did not load');
    }, { logo: `data:image/png;base64,${logo.toString('base64')}`, address: `${publicUrl.host}${publicUrl.pathname === '/' ? '' : publicUrl.pathname}` });
    await mkdir(dirname(resolve(outputPath)), { recursive: true });
    await page.screenshot({ path: outputPath, type: 'png' });
    return outputPath;
  } finally { await browser.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sandbox = { window: {} };
  runInNewContext(await readFile(new URL('../src/supabase-config.js', import.meta.url), 'utf8'), sandbox, { timeout: 1000 });
  await renderSocialCard({
    baseUrl: sandbox.window.CHARTERSCHOOLDLE_SUPABASE.publicUrl,
    outputPath: fileURLToPath(new URL('../assets/social-card.png', import.meta.url)),
    executablePath: process.env.CHARTERSCHOODLE_CHROMIUM_PATH,
  });
  console.log('Rendered assets/social-card.png (1200×630)');
}
