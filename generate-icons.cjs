const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPng(width, height, drawFn) {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const idx = y * rowSize + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(raw);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    table[i] = c;
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', idatData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

// Neon Küp VOIDSTEP İkonu
function drawCubeIcon(x, y, w, h) {
  // Arka plan: Koyu lacivert #0a0a2e
  let r = 10, g = 10, b = 46, a = 255;
  
  const cx = w / 2, cy = h / 2;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  const cubeSize = w * 0.28;
  const border = w * 0.04;

  if (dx < cubeSize && dy < cubeSize) {
    const isEdge = dx > cubeSize - border || dy > cubeSize - border;
    if (isEdge) {
      // Parlak Cyan (#00f0ff)
      r = 0; g = 240; b = 255;
    } else {
      // İç koyu obsidyen (#040915)
      r = 4; g = 9; b = 21;
    }
  } else {
    // Yumuşak radial neon parlama
    const dist = Math.hypot(dx, dy);
    if (dist < cubeSize + border * 3) {
      const glow = 1 - (dist - cubeSize) / (border * 3);
      if (glow > 0) {
        r = Math.min(255, Math.floor(r + 0 * glow));
        g = Math.min(255, Math.floor(g + 160 * glow));
        b = Math.min(255, Math.floor(b + 255 * glow));
      }
    }
  }

  return [r, g, b, a];
}

const dir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'icon-192.png'), createPng(192, 192, drawCubeIcon));
fs.writeFileSync(path.join(dir, 'icon-512.png'), createPng(512, 512, drawCubeIcon));
console.log('Icons generated successfully in public/icons!');
