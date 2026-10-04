/* Run with the local Next.js preview already running. Tests the real R3F/WebGL canvas. */
const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = join(tmpdir(), 'neural-brain-review');
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      sessionStorage.setItem('sitov-intro-seen', '1');
      localStorage.setItem('theme', 'light');
      window.brainFrames = [];
      const arrays = WebGL2RenderingContext.prototype.drawArrays;
      const elements = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        if (args[0] === this.LINES && this.canvas.closest('[data-neural-brain-scene]')) {
          const program = this.getParameter(this.CURRENT_PROGRAM);
          window.brainFrames.push({ time: this.getUniform(program, this.getUniformLocation(program, 'uTime')), comets: 0 });
        }
        return arrays.apply(this, args);
      };
      WebGL2RenderingContext.prototype.drawElements = function (...args) {
        if (this.canvas.closest('[data-neural-brain-scene]')) {
          const program = this.getParameter(this.CURRENT_PROGRAM);
          // The cortical mesh is deliberately not counted as an impulse.
          if (this.getUniformLocation(program, 'uProgress') !== null) {
            const frame = window.brainFrames.at(-1);
            if (frame) frame.comets++;
          }
        }
        return elements.apply(this, args);
      };
    });
    await page.goto(`${process.env.BRAIN_PREVIEW_URL || 'http://localhost:3000'}/de`, { waitUntil: 'networkidle' });
    const panel = page.locator('[data-neural-brain-panel]');
    await panel.locator('canvas').waitFor();
    await page.waitForFunction(() => window.brainFrames.at(-1)?.time > 1);
    await panel.screenshot({ path: join(output, 'anatomy-light.png') });
    await page.waitForFunction(() => window.brainFrames.at(-1)?.comets > 0);
    await page.waitForTimeout(650);
    await panel.screenshot({ path: join(output, 'anatomy-light-pulse.png') });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(300);
    await panel.screenshot({ path: join(output, 'anatomy-dark.png') });
    await page.waitForFunction(() => window.brainFrames.at(-1)?.time > 6);
    const frames = await page.evaluate(() => window.brainFrames);
    const maximum = Math.max(...frames.map(frame => frame.comets));
    assert.ok(maximum > 3 && maximum <= 9, `Desktop keeps a bounded stream of ribbons (${maximum})`);
    const variations = new Set(frames.map(frame => frame.comets));
    assert.ok(variations.size > 3, 'Independent ribbon clocks create varied activity');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    const offscreen = await page.evaluate(() => window.brainFrames.length);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.brainFrames.length), offscreen, 'Offscreen rendering pauses');
    await panel.scrollIntoViewIfNeeded();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(400);
    const staticFrame = await panel.locator('canvas').screenshot();
    const reduced = await page.evaluate(() => window.brainFrames.length);
    assert.equal(await page.evaluate(() => window.brainFrames.at(-1).comets), 3, 'Reduced-motion scene retains three composed still connections');
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => window.brainFrames.length), reduced, 'Reduced motion uses a still frame');
    assert.ok(staticFrame.equals(await panel.locator('canvas').screenshot()), 'Reduced-motion pixels do not drift');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => window.brainFrames.length) > reduced, 'Theme changes repaint a static canvas');
    await panel.screenshot({ path: join(output, 'anatomy-reduced.png') });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await panel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No mobile overflow');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme);
        await page.waitForTimeout(180);
        await panel.screenshot({ path: join(output, `anatomy-mobile-${width}-${theme}.png`) });
      }
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const mobileStart = await page.evaluate(() => window.brainFrames.length);
    await page.waitForTimeout(2900);
    const mobileFrames = await page.evaluate(start => window.brainFrames.slice(start), mobileStart);
    const mobileMaximum = Math.max(...mobileFrames.map(frame => frame.comets));
    assert.ok(mobileMaximum > 0 && mobileMaximum <= 6, `Smartphones cap simultaneous ribbons at six (${mobileMaximum})`);
    await panel.screenshot({ path: join(output, 'anatomy-mobile-motion.png') });
    await panel.locator('canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => !document.querySelector('[data-neural-brain-panel] canvas'));
    assert.equal(await panel.locator('[data-sitov-brain-fallback]').count(), 1, 'Graceful anatomy SVG remains after context loss');
    await panel.screenshot({ path: join(output, 'anatomy-fallback.png') });
    assert.deepEqual(errors, []);
    const result = { maximum, mobileMaximum, independentActivity: true, reducedMotion: true, offscreenPause: true, mobileWidths: [390, 320], lightDark: true, contextLossFallback: true, errors, output };
    writeFileSync(join(output, 'anatomy-validation.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
