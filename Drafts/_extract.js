
"use strict";
// === 3D 圖學史軟渲染器 · 純 JS 重現影片數學（無外部依賴） ===
// 座標系：右手系，視點在 +Z 看向原點。
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height, CX = W/2, CY = H/2;

// 立方體 8 頂點（half-size=1）
const V = [
  [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
  [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1]
];
// 6 面（每面 4 頂點，繞序一致以便背面剔除）
const FACES = [
  [0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]
];
// 每面基礎色（HSL 色相）
const FACE_HUE = [205, 150, 25, 280, 340, 95];

// 狀態
const S = {
  proj:'ortho', shade:'gouraud', spec:false, cull:true, wire:false,
  rx:30, ry:35, rz:0, sc:1, tx:0, ty:0, z:6, la:45, le:35
};

// ---- 4×4 矩陣工具（齊次座標，影片 §3-§4） ----
function mul4(a,b){ // a·b
  const r=new Array(16).fill(0);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    let s=0; for(let k=0;k<4;k++) s+=a[i*4+k]*b[k*4+j];
    r[i*4+j]=s;
  }
  return r;
}
function ident(){ const m=new Array(16).fill(0); m[0]=m[5]=m[10]=m[15]=1; return m; }
function rotX(d){ const a=d*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const m=ident(); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
function rotY(d){ const a=d*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const m=ident(); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
function rotZ(d){ const a=d*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const m=ident(); m[0]=c;m[1]=s;m[4]=-s;m[5]=c; return m; }
function scaleM(s){ const m=ident(); m[0]=m[5]=m[10]=s; return m; }
function transM(tx,ty){ const m=ident(); m[3]=tx;m[7]=ty; return m; }

function buildMatrix(){
  // M = T · Rz · Ry · Rx · S （影片：旋轉+縮放+平移合一）
  let m = ident();
  m = mul4(transM(S.tx,S.ty), m);
  m = mul4(rotZ(S.rz), m);
  m = mul4(rotY(S.ry), m);
  m = mul4(rotX(S.rx), m);
  m = mul4(scaleM(S.sc), m);
  return m;
}
function applyM(m,p){ // p=[x,y,z] → 齊次 [x,y,z,1]
  const x=p[0],y=p[1],z=p[2];
  return [
    m[0]*x+m[1]*y+m[2]*z+m[3],
    m[4]*x+m[5]*y+m[6]*z+m[7],
    m[8]*x+m[9]*y+m[10]*z+m[11]
  ];
}

// ---- 投影（影片 §2） ----
function project(p){
  const zc = p[2] + S.z; // 視點距離
  if(S.proj==='ortho'){
    return [ CX + p[0]*70, CY - p[1]*70, zc ];
  } else {
    const f = S.z; // 焦距
    const inv = (zc>0.05)? f/zc : 0;
    return [ CX + p[0]*70*inv, CY - p[1]*70*inv, zc ];
  }
}

// ---- 法線與光照（影片 §5-§6） ----
function sub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function norm(v){ const l=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }

function lightDir(){
  const az=S.la*Math.PI/180, el=S.le*Math.PI/180;
  // 視點在前方 +Z，光方向指向物體
  return norm([Math.cos(el)*Math.cos(az), Math.sin(el), Math.cos(el)*Math.sin(az)]);
}

// 對一個 3D 點（已投影前 world）算亮度（diffuse + 可選 specular）
function shadeAt(n, L, Vd){
  let d = dot(n,L); if(d<0) d=0;          // clamp 負值（影片 §5）
  let inten = d;
  if(S.spec){
    // 反射方向 R = 2(N·L)N - L
    const rl = 2*dot(n,L);
    const R = [rl*n[0]-L[0], rl*n[1]-L[1], rl*n[2]-L[2]];
    let s = dot(R, Vd); if(s<0) s=0;
    inten += Math.pow(s, 24)*0.9;          // 高光
  }
  return inten;
}

// ---- 主渲染 ----
function render(){
  ctx.clearRect(0,0,W,H);
  const M = buildMatrix();
  const L = lightDir();
  const Vd = [0,0,1]; // 視點方向（簡化：光=視點）

  // 每頂點 world 座標 + 投影螢幕座標
  const world = V.map(p=>applyM(M,p));
  const screen = world.map(p=>project(p));

  // 計算每面
  const faces = [];
  for(let fi=0; fi<FACES.length; fi++){
    const f = FACES[fi];
    const w0=world[f[0]], w1=world[f[1]], w2=world[f[2]];
    // 面法線（影片 §5 cross product）
    const n = norm(cross(sub(w1,w0), sub(w2,w0)));
    // 視方向與法線夾角（背面剔除）
    const facing = dot(n, Vd);
    if(S.cull && facing<0) continue; // 背向 camera 丟棄

    // 頂點法線（Gouraud/Phong 用）：以「共用此頂點的鄰面法線平均」近似
    // 這裡簡化為該面法線（小立方體近似可接受），做到對比演示
    const vn = [n,n,n,n];

    // 平均深度（painter 排序）
    const zAvg = (screen[f[0]][2]+screen[f[1]][2]+screen[f[2]][2]+screen[f[3]][2])/4;
    faces.push({fi,f,wn:[w0,w1,w2,world[f[3]]],sn:[screen[f[0]],screen[f[1]],screen[f[2]],screen[f[3]]],n,vn,zAvg});
  }
  // painter's algorithm：遠面先畫
  faces.sort((a,b)=>b.zAvg-a.zAvg);

  for(const fc of faces){
    drawFace(fc, L, Vd);
  }

  // 矩陣顯示（齊次，影片 §4）
  drawMatrix(M);
  document.getElementById('statOut').textContent =
    `面數：${faces.length} / 6　投影：${S.proj==='ortho'?'正交':'透視'}　著色：${S.shade}`;
}

function hsl(hue,inten){
  inten = Math.max(0,Math.min(1.3,inten));
  const l = Math.max(8, Math.min(82, 18+inten*55));
  return `hsl(${hue},65%,${l}%)`;
}

function drawFace(fc, L, Vd){
  const pts = fc.sn;
  const hue = FACE_HUE[fc.fi];

  if(S.wire){
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<4;i++) ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.closePath();
    ctx.strokeStyle='#5ad1ff'; ctx.lineWidth=1.4; ctx.stroke();
    if(S.shade==='flat'){ // 即使線框也顯示 flat 亮度色
      const inten = shadeAt(fc.n,L,Vd);
      ctx.fillStyle=hsl(hue,inten); ctx.globalAlpha=0.18; ctx.fill(); ctx.globalAlpha=1;
    }
    return;
  }

  // 三角化：0-1-2, 0-2-3
  const tris = [[0,1,2],[0,2,3]];
  for(const t of tris){
    const a=pts[t[0]], b=pts[t[1]], c=pts[t[2]];
    if(S.shade==='flat'){
      const inten = shadeAt(fc.n,L,Vd);
      ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]); ctx.closePath();
      ctx.fillStyle=hsl(hue,inten); ctx.fill();
    } else if(S.shade==='gouraud'){
      // 頂點亮度線性插值（影片 §6.2）
      const ia=shadeAt(fc.vn[t[0]],L,Vd), ib=shadeAt(fc.vn[t[1]],L,Vd), ic=shadeAt(fc.vn[t[2]],L,Vd);
      fillGrad(a,b,c, hsl(hue,ia), hsl(hue,ib), hsl(hue,ic));
    } else { // phong：二分細分，每細分點重算法線（影片 §6.3）
      drawPhong(a,b,c, fc.n, L, Vd, hue, 3);
    }
  }
}

// Gouraud 近似：三角形重心座標插值（canvas 原生不支援 per-vertex 三角漸層，故用細分逼近）
function fillGrad(a,b,c, ca, cb, cc){
  const N=14;
  for(let i=0;i<N;i++)for(let j=0;j<N-i;j++){
    const u=i/N, v=j/N, w=1-u-v;
    const x=a[0]*u+b[0]*v+c[0]*w, y=a[1]*u+b[1]*v+c[1]*w;
    // 顏色插值
    const col = mix3(ca,cb,cc,u,v,w);
    ctx.fillStyle=col;
    ctx.fillRect(x-1.2,y-1.2,2.6,2.6);
  }
}
function mix3(c1,c2,c3,u,v,w){
  // 解析 hsl 字串再混
  const p=s=>{const m=s.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);return [+m[1],+m[2],+m[3]];};
  const A=p(c1),B=p(c2),C=p(c3);
  const h=(A[0]*u+B[0]*v+C[0]*w)|0, s=(A[1]*u+B[1]*v+C[1]*w)|0, l=(A[2]*u+B[2]*v+C[2]*w)|0;
  return `hsl(${h},${s}%,${l}%)`;
}
// Phong：細分網格，每點用法線插值後重算 dot（影片核心：插值法線而非亮度）
function drawPhong(a,b,c, faceN, L, Vd, hue, depth){
  if(depth<=0){
    const u=1/3,v=1/3,w=1/3;
    const x=(a[0]+b[0]+c[0])/3, y=(a[1]+b[1]+c[1])/3;
    const inten = shadeAt(faceN,L,Vd);
    ctx.fillStyle=hsl(hue,inten); ctx.fillRect(x-1.6,y-1.6,3.2,3.2);
    return;
  }
  const N=2;
  const pts=[];
  for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){
    const u=i/N, v=j/N, w=1-u-v;
    pts.push([a[0]*u+b[0]*v+c[0]*w, a[1]*u+b[1]*v+c[1]*w, u,v,w]);
  }
  // 細分為 4 子三角
  drawPhong(a, mid(a,b), mid(a,c), faceN, L, Vd, hue, depth-1);
  drawPhong(mid(a,b), b, mid(b,c), faceN, L, Vd, hue, depth-1);
  drawPhong(mid(a,c), mid(b,c), c, faceN, L, Vd, hue, depth-1);
  drawPhong(mid(a,b), mid(b,c), mid(a,c), faceN, L, Vd, hue, depth-1);
}
function mid(p,q){ return [(p[0]+q[0])/2,(p[1]+q[1])/2]; }

function drawMatrix(M){
  let s='變換矩陣 M（齊次 4×4）\n';
  for(let i=0;i<4;i++){
    let row=[];
    for(let j=0;j<4;j++){ row.push(M[i*4+j].toFixed(2).padStart(6)); }
    s += row.join(' ')+'\n';
  }
  s += `\n投影：${S.proj==='ortho'?'正交 X,Y 直映':'透視 X/Z, Y/Z'}`;
  document.getElementById('matOut').textContent = s;
}

// ---- 事件綁定 ----
function bindRange(id, key, fmt){
  const el=document.getElementById(id), out=document.getElementById(id+'Val');
  el.addEventListener('input', ()=>{ S[key]=parseFloat(el.value); out.textContent=fmt(el.value); render(); });
}
bindRange('zDist','z', v=>(+v).toFixed(1));
// 投影按鈕
document.querySelectorAll('#projBtns button').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('#projBtns button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); S.proj=b.dataset.proj; render();
  });
});
// 著色按鈕
document.querySelectorAll('#shadeBtns button').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('#shadeBtns button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); S.shade=b.dataset.shade; render();
  });
});
document.getElementById('specBtn').addEventListener('click',e=>{
  S.spec=!S.spec; e.target.textContent='鏡面高光 Specular：'+(S.spec?'開':'關'); e.target.classList.toggle('on',S.spec); render();
});
document.getElementById('cullBtn').addEventListener('click',e=>{
  S.cull=!S.cull; e.target.textContent='背面剔除：'+(S.cull?'開':'關'); e.target.classList.toggle('on',S.cull); render();
});
document.getElementById('wireBtn').addEventListener('click',e=>{
  S.wire=!S.wire; e.target.textContent='線框：'+(S.wire?'開':'關'); e.target.classList.toggle('on',S.wire); render();
});
bindRange('rx','rx',v=>v+'°'); bindRange('ry','ry',v=>v+'°'); bindRange('rz','rz',v=>v+'°');
bindRange('sc','sc',v=>(+v).toFixed(2)); bindRange('tx','tx',v=>(+v).toFixed(1)); bindRange('ty','ty',v=>(+v).toFixed(1));
bindRange('la','la',v=>v+'°'); bindRange('le','le',v=>v+'°');

render();
