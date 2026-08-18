// splat 風格場景層：載入點雲 JSON 以 WebGPU Points 渲染（確定性近似，非真3DGS優化）
// 真 3DGS 優化需 CUDA+gsplat（本機未裝）；此層提供「高斯潑濺視覺風格」背景
import * as THREE from 'three';

export async function loadSplatLayer(url, scene) {
  const res = await fetch(url);
  const data = await res.json();
  const n = data.n;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = data.points[i];
    positions[i * 3] = p[0]; positions[i * 3 + 1] = p[1]; positions[i * 3 + 2] = p[2];
    colors[i * 3] = p[3]; colors[i * 3 + 1] = p[4]; colors[i * 3 + 2] = p[5];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.85 });
  const points = new THREE.Points(geo, mat);
  points.name = 'splatLayer';
  points.renderOrder = -1;  // 背景層
  scene.add(points);
  return points;
}
