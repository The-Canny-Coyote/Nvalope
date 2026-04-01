import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const SRC_SVG = path.join(PUBLIC_DIR, "favicon.svg");
const OUT_DIR = path.join(PUBLIC_DIR, "icons");

const SIZES = [64, 96, 128, 144, 152, 192, 256, 384, 512];

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await fileExists(SRC_SVG))) {
    throw new Error(`Missing source icon: ${SRC_SVG}`);
  }
  await fs.mkdir(OUT_DIR, { recursive: true });

  const svg = await fs.readFile(SRC_SVG);
  for (const size of SIZES) {
    const outPath = path.join(OUT_DIR, `pwa-${size}x${size}.png`);
    await sharp(svg, { density: 512 })
      .resize(size, size, { fit: "contain" })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
  }

  const maskablePath = path.join(OUT_DIR, "pwa-maskable-512x512.png");
  await sharp(svg, { density: 512 })
    .resize(512, 512, { fit: "contain" })
    .extend({
      top: 64,
      bottom: 64,
      left: 64,
      right: 64,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(512, 512, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(maskablePath);

  console.log(`Generated icons in ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

