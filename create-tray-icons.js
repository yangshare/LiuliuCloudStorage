const fs = require('fs');
const path = require('path');

// 创建简单的 PNG 图标
function createIcon(color, filename) {
  const size = 32;
  const png = Buffer.alloc(size * size * 4);

  // 创建圆形图标
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= size / 2 - 2) {
        const offset = (y * size + x) * 4;
        png[offset] = color.r;     // R
        png[offset + 1] = color.g; // G
        png[offset + 2] = color.b; // B
        png[offset + 3] = 255;     // A
      }
    }
  }

  // 简单的 PNG 格式（使用 BMP 格式更简单）
  const bmpHeader = Buffer.alloc(54);
  bmpHeader.write('BM', 0);
  bmpHeader.writeUInt32LE(54 + size * size * 4, 2);
  bmpHeader.writeUInt32LE(54, 10);
  bmpHeader.writeUInt32LE(40, 14);
  bmpHeader.writeInt32LE(size, 18);
  bmpHeader.writeInt32LE(size, 22);
  bmpHeader.writeUInt16LE(1, 26);
  bmpHeader.writeUInt16LE(32, 28);

  const iconPath = path.join(__dirname, 'src', 'assets', 'icons', filename);
  fs.writeFileSync(iconPath, Buffer.concat([bmpHeader, png]));
  console.log(`创建图标: ${iconPath}`);
}

// 创建空闲状态图标（蓝色）
createIcon({ r: 66, g: 133, b: 244 }, 'tray-idle.png');

// 创建传输中状态图标（橙色）
createIcon({ r: 255, g: 165, b: 0 }, 'tray-active.png');

console.log('托盘图标创建完成！');
