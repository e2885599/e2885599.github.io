// 驗收 B demo：headless Chrome 真實渲染
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const SD = 'C:/Users/66889/AppData/Local/hermes/skills/software-development/ego-browser-sim';
const page = 'file:///D:/OODAV-MIRROR/02-STUDIO/studio-site/Drafts/procedural-walk/procedural_walk_b.html?probe=1';
globalThis.__egofn = null;
// 直接用 playwright-core 驅動（繞過 cli.mjs heredoc 轉義風險）
const { chromium } = require(path.join(SD, 'node_modules/playwright-core'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const errors = [];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--no-sandbox','--ignore-gpu-blocklist','--enable-unsafe-webgpu','--use-gl=swiftshader'] });
  const ctx = await browser.newContext();
  const tab = await ctx.newPage();
  tab.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  tab.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  await tab.goto(page, { waitUntil: 'load', timeout: 30000 });
  await tab.waitForTimeout(800);
  const y1 = await tab.evaluate(() => window.__demo ? window.__demo.getFootY() : null);
  await tab.waitForTimeout(900);
  const y2 = await tab.evaluate(() => window.__demo ? window.__demo.getFootY() : null);
  // 截圖作為渲染證據（headless WebGL preserveDrawingBuffer 預設 false，drawImage 不可靠，故以檔案為準）
  const shotPath = path.join(SD, '.state', 'b_verify.png');
  await tab.screenshot({ path: shotPath });
  const shotSize = fs.statSync(shotPath).size;
  await browser.close();
  const moved = (y1 && y2) ? y1.some((v,i)=>Math.abs(v - y2[i]) > 0.01) : false;
  console.log('CONSOLE_ERRORS=' + JSON.stringify(errors));
  console.log('FOOT_Y_T1=' + JSON.stringify(y1));
  console.log('FOOT_Y_T2=' + JSON.stringify(y2));
  console.log('FEET_MOVED=' + moved);
  console.log('SHOT_BYTES=' + shotSize);
  console.log('VERDICT=' + ((errors.length===0 && moved && shotSize > 5000) ? 'PASS' : 'FAIL'));
})().catch(e => { console.log('RUN_ERR=' + e.message); process.exit(1); });
