const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const buildDir = path.join(__dirname, '..', 'build');
const svgPath = path.join(buildDir, 'icon.svg');
const icoPath = path.join(buildDir, 'icon.ico');

async function generateIco() {
  console.log('正在生成 Windows ICO 文件...');

  // 生成多个尺寸的PNG缓冲区用于ICO
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const buffer = await sharp(svgPath)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer });
  }

  // 创建ICO文件头
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0); // 保留字段
  iconDir.writeUInt16LE(1, 2); // 图像类型 (1 = ICO)
  iconDir.writeUInt16LE(sizes.length, 4); // 图像数量

  // 创建图像目录条目
  const iconDirEntries = [];
  let imageDataOffset = 6 + (sizes.length * 16); // 头部 + 所有目录条目

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // 宽度 (0 表示 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // 高度 (0 表示 256)
    entry.writeUInt8(0, 2); // 调色板颜色数 (0 = 不使用调色板)
    entry.writeUInt8(0, 3); // 保留字段
    entry.writeUInt16LE(1, 4); // 颜色平面数
    entry.writeUInt16LE(32, 6); // 每像素位数
    entry.writeUInt32LE(buffer.length, 8); // 图像数据大小
    entry.writeUInt32LE(imageDataOffset, 12); // 图像数据偏移

    iconDirEntries.push(entry);
    imageDataOffset += buffer.length;
  }

  // 组合所有部分
  const icoBuffer = Buffer.concat([
    iconDir,
    ...iconDirEntries,
    ...pngBuffers.map(p => p.buffer)
  ]);

  // 写入文件
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`✓ 已生成 icon.ico`);
  console.log(`  包含尺寸: ${sizes.join('x, ')}x`);
}

generateIco().catch(err => {
  console.error('生成ICO文件时出错:', err);
  process.exit(1);
});
