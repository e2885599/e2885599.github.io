// 彈道（純函數，可單測）：拋物線實彈落點與飛行時間
// 慣例：y 為上，重力 g 向下（正數）

export function projectileLanding(origin, dir, speed, gravity = 9.8, groundY = 0) {
  if (!Array.isArray(origin) || origin.length !== 3) throw new RangeError('origin 須為 [x,y,z]');
  if (!Array.isArray(dir) || dir.length !== 3) throw new RangeError('dir 須為 [x,y,z]');
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len === 0) throw new RangeError('dir 不可為零向量');
  const u = dir.map((v) => v / len);
  const vx = u[0] * speed, vy = u[1] * speed, vz = u[2] * speed;
  // 落地時間：origin.y + vy*t - 0.5*g*t^2 = groundY
  // 移項：0.5*g*t^2 - vy*t - (origin.y - groundY) = 0
  const a = 0.5 * gravity, b = -vy, c = -(origin[1] - groundY);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null; // 永不落地（朝上且地面在下方時仍會落，除非 vy>0 且 c<0... 實務總有解）
  const t = (-b + Math.sqrt(disc)) / (2 * a); // 取較晚正根
  if (t <= 0) return null;
  return {
    t,
    point: [origin[0] + vx * t, groundY, origin[2] + vz * t],
    apex: origin[1] + (vy * vy) / (2 * gravity)
  };
}

// 水平射程（dir 水平時的近似）
export function horizontalRange(speed, angleDeg, gravity = 9.8) {
  const a = angleDeg * Math.PI / 180;
  if (a <= 0 || a >= 90) throw new RangeError('仰角須在 (0,90)');
  return (speed * speed * Math.sin(2 * a)) / gravity;
}
