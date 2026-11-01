// Regression: a TV remote must be able to change HTML select settings.
// GPL-3.0-or-later. Uses local fixtures only.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_BIN || undefined,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<div id="app"><button id="before">Before</button>' +
      '<select id="language"><option value="eng">English</option><option value="spa">Spanish</option><option value="hye">Armenian</option></select>' +
      '<button id="after">After</button></div>');
    await page.addStyleTag({content: fs.readFileSync(path.join(__dirname, '../src/host.css'), 'utf8')});
    await page.evaluate(() => {
      window.WebOSPlayer = class { active() { return null; } };
      window.StreamGlassShell = {start: async () => {}};
      window.changes = 0;
      document.querySelector('select').addEventListener('change', () => window.changes++);
    });
    await page.addScriptTag({content: fs.readFileSync(path.join(__dirname, '../src/host.js'), 'utf8')});
    await page.locator('#language').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#language').inputValue(), 'spa');
    assert.equal(await page.evaluate(() => window.changes), 1);
    assert.equal(await page.locator('.sg-host-modal').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'language');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'Unidentified', keyCode: 461, bubbles: true, cancelable: true})));
    assert.equal(await page.locator('#language').inputValue(), 'spa', 'Back cancels without changing the option');
    assert.equal(await page.locator('.sg-host-modal').count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({passed: true, remoteSelect: true, lgBackCancels: true, focusRestored: true}));
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode = 1;});
