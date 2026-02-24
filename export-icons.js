const fs = require('fs');
const path = require('path');

const dir = __dirname;
const svgPath = path.join(dir, 'instagram.svg');
const sizes = [16, 48, 128];

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('Instale as dependências primeiro: npm install');
    process.exit(1);
  }

  const svg = fs.readFileSync(svgPath);
  for (const size of sizes) {
    const outPath = path.join(dir, `icon_${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(outPath);
    console.log('Gerado:', outPath);
  }
  console.log('Pronto. icon_16.png, icon_48.png e icon_128.png atualizados a partir de instagram.svg');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
