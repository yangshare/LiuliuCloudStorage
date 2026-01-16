const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildDir = path.join(__dirname, '..', 'build');
const svgPath = path.join(buildDir, 'icon.svg');

console.log('正在生成应用图标...');

// 检查是否安装了 sharp
try {
  require.resolve('sharp');
} catch (e) {
  console.log('未找到 sharp 包，正在安装...');
  execSync('npm install --save-dev sharp', { stdio: 'inherit' });
}

const sharp = require('sharp');

async function generateIcons() {
  // 生成不同尺寸的PNG图标
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

  console.log('生成PNG图标...');
  for (const size of sizes) {
    const outputPath = path.join(buildDir, `icon_${size}x${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  ✓ ${size}x${size} PNG`);
  }

  // 生成主图标文件
  await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(path.join(buildDir, 'icon.png'));
  console.log('  ✓ icon.png (512x512)');

  // 对于ICO文件，我们需要使用外部工具或库
  // 这里我们创建一个256x256的PNG作为Windows图标
  await sharp(svgPath)
    .resize(256, 256)
    .png()
    .toFile(path.join(buildDir, 'icon-256.png'));

  console.log('\n图标生成完成！');
  console.log('\n注意：');
  console.log('- 已生成 icon.png (512x512) 用于 Linux');
  console.log('- 已生成多个尺寸的PNG文件');
  console.log('- 对于 Windows .ico 文件，请使用在线工具转换 icon-256.png');
  console.log('  推荐工具: https://convertio.co/zh/png-ico/');
  console.log('- 对于 macOS .icns 文件，请使用 iconutil 或在线工具');
}

generateIcons().catch(err => {
  console.error('生成图标时出错:', err);
  process.exit(1);
});
