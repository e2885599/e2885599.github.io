// glTF 載入封裝（three/addons GLTFLoader）
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _loader = new GLTFLoader();

export function loadGltf(url) {
  return new Promise((resolve, reject) => {
    _loader.load(url, (gltf) => resolve(gltf), undefined, (err) => reject(err));
  });
}
