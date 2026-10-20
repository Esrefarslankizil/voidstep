import * as THREE from 'three';

/**
 * Referans görseldeki "EDGE" tarzı parlak neon ızgara hücre dokusu oluşturur.
 *
 * Her hücre:
 * - Koyu obsidyen / füme zemin (ortada ince gradyan)
 * - Parlak neon çerçeve (yuvarlatılmış iç köşeler)
 * - 4 köşede parlak kesişim parlaması (noktalar/haçlar birleşince parlar)
 */
export function createEdgeTileTexture(neonColor: string, innerColor: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 1. Zemin (Derin karanlık merkez + kenarlara doğru hafif ışıma)
  ctx.fillStyle = innerColor;
  ctx.fillRect(0, 0, size, size);

  const radial = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.7);
  radial.addColorStop(0, '#000000');
  radial.addColorStop(0.7, innerColor);
  radial.addColorStop(1, '#000000');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);

  // 2. Yumuşak dış neon glow (kenar ışıması)
  ctx.save();
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 14;
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 18;
  ctx.strokeRect(6, 6, size - 12, size - 12);
  ctx.restore();

  // 3. Keskin ana neon çerçeve
  ctx.save();
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.restore();

  // 4. İç ince parlak çizgi (hafif beyazımsı neon vurgusu)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, size - 14, size - 14);
  ctx.restore();

  // 5. Köşe kesişim noktaları (Referans resimdeki 4'lü birleşim parlaması)
  // Fayanslar yan yana geldiğinde bu 4 köşe birleşip parlak bir neon nokta oluşturur
  const corners = [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ];

  for (const [cx, cy] of corners) {
    const dotGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
    dotGlow.addColorStop(0, '#ffffff');
    dotGlow.addColorStop(0.3, neonColor);
    dotGlow.addColorStop(0.7, neonColor + '66');
    dotGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = dotGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Uzay boşluğu için hafif nebulalar / kozmik toz bulutu dokusu
 */
export function createNebulaTexture(color: string): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.35)'));
  grad.addColorStop(0.8, color.replace(/[\d.]+\)$/, '0.08)'));
  grad.addColorStop(1, 'transparent');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
