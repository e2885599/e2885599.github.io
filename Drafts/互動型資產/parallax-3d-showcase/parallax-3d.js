/*
 * parallax-3d.js — OODAV LAB 視差滾動＋3D 實體模板動畫（草稿區互動資產）
 * 對齊：game-asset-provisioning 免費 .glb 模板 + studio-site 主題色(cyan×violet×amber)
 * 設計原則：資產自有（glb 來自本地 game-asset-provisioning，可 Merkle 對帳）、降級不崩。
 *
 * ROLE 框架：
 *  R(角色)= OODAV 主動資運工程師，產出「屬於工作室自己」的視差互動頁
 *  O(目標)= 多層視差滾動 + 調用 .glb 實體模板自動旋轉/漂浮 + 主題色動畫 + 自動演出短片模式
 *  L(限制)= 不依賴外部 SaaS；WebGL 不可用時靜態降級；glb 載失不阻斷整頁
 *  E(範例)= 見 parallax-3d-showcase.html 的 data-model 宣告與 ?auto=1 模式
 */

const OODAV = {
  bg: 0x060912,
  cyan: 0x36e0d4,
  violet: 0x8b6cff,
  amber: 0xffb347,
};

// 展品清單：調用 game-asset-provisioning 的 15 類免費模板（各取代表性輕量檔）
const EXHIBITS = [
  { file: 'models/RiggedFigure.glb', label: 'humanoid · 人形', x: -4.2 },
  { file: 'models/Fox.glb',          label: 'creature · 生物', x: -1.4 },
  { file: 'models/Duck.glb',         label: 'prop · 道具',    x:  1.4 },
  { file: 'models/CesiumMilkTruck.glb', label: 'vehicle · 載具', x: 4.2 },
];

const canvas = document.getElementById('stage3d');
const statusEl = document.getElementById('stageStatus');
let THREE = null, GLTFLoader = null;   // 由 main() 動態 import 注入（繞開 importmap 靜態作用域問題）
let renderer, scene, camera, clock;
let exhibits = [];          // {root, baseY, spin}
let parallaxLayers = [];    // DOM 層做 CSS 視差
let autoMode = new URLSearchParams(location.search).get('auto') === '1';
let raf = null;

function failSafe(msg) {
  // 降級：隱藏 canvas，顯示靜態主題色漸層 + 文案，不拋未捕獲錯誤。
  // 注意：視差滾動與 reveal 屬純 DOM/CSS，不依賴 WebGL，故仍正常運作；
  // 此處僅處置 3D 層與自動演出按鈕。
  if (statusEl) {
    statusEl.textContent = '⚠ ' + msg + ' — 已降級為靜態主題色展示';
    statusEl.classList.add('warn');
  }
  if (canvas) canvas.style.display = 'none';
  document.body.classList.add('degraded');
  // 降級時禁用自動演出按鈕（無 3D 可演出），避免誘導無效點擊
  const autoBtn = document.getElementById('toggleAuto');
  if (autoBtn) { autoBtn.disabled = true; autoBtn.style.opacity = '.45'; autoBtn.textContent = '⚠ 3D 不可用（離線）'; }
  console.warn('[parallax-3d] degraded:', msg);
}

function initThree() {
  if (!window.WebGLRenderingContext) { failSafe('此瀏覽器不支援 WebGL'); return false; }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene();
    scene.background = new THREE.Color(OODAV.bg);
    scene.fog = new THREE.Fog(OODAV.bg, 9, 22);

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.2, 9);

    // 主題色雙向光
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(OODAV.cyan, 1.1);
    key.position.set(-4, 5, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(OODAV.violet, 0.9);
    fill.position.set(5, -2, 3); scene.add(fill);
    const rim = new THREE.PointLight(OODAV.amber, 0.6, 30);
    rim.position.set(0, 3, -4); scene.add(rim);

    clock = new THREE.Clock();
    resizeRenderer();   // camera 已建好，安全調用
    return true;
  } catch (e) {
    failSafe('Three.js 初始化失敗：' + e.message);
    return false;
  }
}

function resizeRenderer() {
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const h = canvas.clientHeight || 420;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function loadExhibits(loader) {
  let pending = EXHIBITS.length;
  EXHIBITS.forEach((spec) => {
    loader.load(
      spec.file,
      (gltf) => {
        const root = gltf.scene;
        root.position.x = spec.x;
        // 歸一化縮放與置中
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const s = 2.2 / maxDim;
        root.scale.setScalar(s);
        root.position.y = -center.y * s;          // 貼地
        root.position.x = spec.x;
        scene.add(root);
        const baseY = root.position.y;
        exhibits.push({ root, baseY, spin: 0.2 + Math.random() * 0.2 });
        if (statusEl && --pending === 0) {
          statusEl.textContent = '✓ 已載入 ' + EXHIBITS.length + ' 個實體模板（資產自有 · 可對帳）';
          statusEl.classList.remove('warn');
        }
      },
      undefined,
      (err) => {
        console.warn('載入失敗', spec.file, err);
        if (statusEl && --pending === 0) {
          statusEl.textContent = '⚠ 部分 .glb 載入失敗，其餘正常演出';
        }
      }
    );
  });
}

function onScroll() {
  const y = window.scrollY || window.pageYOffset;
  // 多層視差：背景極光最慢、光暈中速、3D 展品最快（depth parallax）
  const aurora = document.getElementById('auroraLayer');
  const glow = document.getElementById('glowLayer');
  if (aurora) aurora.style.transform = `translate3d(0, ${y * 0.15}px, 0)`;
  if (glow)   glow.style.transform   = `translate3d(0, ${y * 0.32}px, 0)`;
  if (camera) camera.position.y = 1.2 + y * 0.0018;   // 3D 層微推進
}

// 進場揭示（沿用 studio 的 .reveal 概念，自帶 IntersectionObserver）
function setupReveal() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.18 });
  els.forEach((el) => io.observe(el));
}

function animate() {
  raf = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  // 展品自轉 + 漂浮
  exhibits.forEach((ex, i) => {
    ex.root.rotation.y += ex.spin * 0.016;
    ex.root.position.y = ex.baseY + Math.sin(t * 1.1 + i) * 0.12;
  });
  // 自動演出模式：相機繞場緩慢推進（類短片）
  if (autoMode) {
    const r = 9 + Math.sin(t * 0.12) * 1.5;
    camera.position.x = Math.sin(t * 0.18) * 3.2;
    camera.position.z = r;
    camera.lookAt(0, 0.4, 0);
  }
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function bindUI() {
  const autoBtn = document.getElementById('toggleAuto');
  if (autoBtn) {
    autoBtn.addEventListener('click', () => {
      autoMode = !autoMode;
      autoBtn.textContent = autoMode ? '■ 停止自動演出' : '▶ 自動演出（短片模式）';
      autoBtn.classList.toggle('on', autoMode);
    });
  }
}

async function main() {
  // ── 與 WebGL 無關的基礎互動，必須先行註冊（即便 THREE 降級也要運作）──
  setupReveal();
  bindUI();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { if (renderer) resizeRenderer(); });
  onScroll();   // 首幀視差定位

  // ── 3D 層：動態 import 注入 THREE/GLTFLoader（診斷證實本地 vendor 動態 import 100% 成功）──
  try {
    THREE = await import('three');
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch (e) {
    failSafe('Three.js 模組載入失敗：' + e.message);
    return;   // 視差/揭示已生效，3D 降級
  }
  if (!initThree()) return;
  const loader = new GLTFLoader();
  loadExhibits(loader);
  animate();
}

// 入口防護：THREE 未載入（CDN 失敗）時降級。
// 關鍵：視差與 reveal 不依賴 THREE，故仍於 DOMContentLoaded 執行 main()，
// 由 main() 內部 failSafe 處置 3D 層，而非在此直接 return 跳過整頁互動。
window.addEventListener('DOMContentLoaded', main);
