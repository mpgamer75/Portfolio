/**
 * Builds the textures of the Skills star system (public/images/space/) from
 * the generated source images. Not part of the app build: run it by hand when
 * a source changes.
 *
 *   node scripts/build-space-textures.mjs <source-dir>
 *
 * Sources (PNG): terran, clouds, ice, gas, forge (3840x1920 equirectangular
 * maps, each written as a 2048-wide base map and a "-4k" one), moon (2048x1024), and the cut-out sprites ship_courier,
 * ship_freighter, ship_explorer (1536x1024), station, satellite (1024x1024).
 *
 * What the shaders rely on (components/three/bodyLayer.ts):
 *   - every map wraps left to right and converges to one colour at each pole
 *   - the maps are plain opaque RGB: land, molten rock and fracture lines are
 *     recognised from the colour in the shader (a mask in the alpha channel
 *     cost more bytes than the picture itself)
 *   - craft.webp is one 2048x1024 atlas, see CRAFT_CELLS
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node scripts/build-space-textures.mjs <source-dir>');
  process.exit(1);
}
const OUT = path.resolve('public/images/space');

const smooth = (t) => t * t * (3 - 2 * t);

/** Raw RGB of a source image. */
async function loadRgb(name) {
  const { data, info } = await sharp(path.join(SRC, `${name}.png`))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/**
 * Makes a map wrap: the last `band` columns are cross-faded over the first
 * ones and cut off, so the new right edge runs straight into the new left edge.
 */
function wrapSeam({ data, w, h }, share = 0.045) {
  const band = Math.round(w * share);
  const nw = w - band;
  const out = Buffer.alloc(nw * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < nw; x++) {
      const o = (y * nw + x) * 3;
      const a = (y * w + x) * 3;
      if (x < band) {
        const k = smooth(x / band);
        const b = (y * w + (nw + x)) * 3;
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(data[b + c] * (1 - k) + data[a + c] * k);
      } else {
        out[o] = data[a];
        out[o + 1] = data[a + 1];
        out[o + 2] = data[a + 2];
      }
    }
  }
  return { data: out, w: nw, h };
}

/** Pulls the rows next to each pole towards their mean, so a pole is one colour. */
function settlePoles({ data, w, h }, share = 0.035) {
  const rows = Math.round(h * share);
  for (let r = 0; r < rows; r++) {
    const k = smooth(1 - r / rows);
    for (const y of [r, h - 1 - r]) {
      const mean = [0, 0, 0];
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 3;
        mean[0] += data[o];
        mean[1] += data[o + 1];
        mean[2] += data[o + 2];
      }
      for (let c = 0; c < 3; c++) mean[c] /= w;
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 3;
        for (let c = 0; c < 3; c++) data[o + c] = Math.round(data[o + c] * (1 - k) + mean[c] * k);
      }
    }
  }
}

async function writeMap(name, rgb, width, quality) {
  const height = width / 2;
  const file = path.join(OUT, `${name}.webp`);
  const info = await sharp(rgb.data, { raw: { width: rgb.w, height: rgb.h, channels: 3 } })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toFile(file);
  console.log(`${name}.webp  ${width}x${height}  ${(info.size / 1024).toFixed(0)} KB`);
}

/** Atlas cells in px: x, y, w, h. Mirrored by CRAFT_RECTS in bodyLayer.ts. */
const CRAFT_CELLS = {
  ship_courier: [0, 0, 1024, 512],
  ship_freighter: [1024, 0, 1024, 512],
  ship_explorer: [0, 512, 1024, 512],
  station: [1024, 512, 512, 512],
  satellite: [1536, 512, 512, 512],
};
const CELL_PAD = 24;

async function buildCraftAtlas() {
  const layers = [];
  for (const [name, [x, y, w, h]] of Object.entries(CRAFT_CELLS)) {
    const trimmed = await sharp(path.join(SRC, `${name}.png`)).trim({ threshold: 6 }).toBuffer();
    const fitted = await sharp(trimmed)
      .resize(w - CELL_PAD * 2, h - CELL_PAD * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    layers.push({ input: fitted, left: x + CELL_PAD, top: y + CELL_PAD });
    // Where the engines sit: opaque runs along the rear (left) edge of the cell.
    if (name.startsWith('ship_')) {
      const { data, info } = await sharp(fitted).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      const from = Math.round(info.width * 0.02);
      const to = Math.round(info.width * 0.07);
      const runs = [];
      let start = -1;
      for (let row = 0; row < info.height; row++) {
        let on = false;
        for (let col = from; col < to; col++) on = on || data[row * info.width + col] > 128;
        if (on && start < 0) start = row;
        if (!on && start >= 0) {
          runs.push([(start / info.height).toFixed(3), (row / info.height).toFixed(3)]);
          start = -1;
        }
      }
      console.log(`${name} engine runs (share of cell height):`, JSON.stringify(runs));
    }
  }
  const info = await sharp({ create: { width: 2048, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .webp({ quality: 88, alphaQuality: 92, effort: 6 })
    .toFile(path.join(OUT, 'craft.webp'));
  console.log(`craft.webp  2048x1024  ${(info.size / 1024).toFixed(0)} KB`);
}

await mkdir(OUT, { recursive: true });

for (const kind of ['terran', 'ice', 'gas', 'forge']) {
  const rgb = wrapSeam(await loadRgb(kind), kind === 'terran' ? 0.02 : 0.045);
  settlePoles(rgb);
  // The base map is what the overview shows; the 4K one is fetched when a
  // planet is opened. The ice map is all fine grain, so it gets a lower quality.
  await writeMap(kind, rgb, 2048, kind === 'ice' ? 66 : 74);
  await writeMap(`${kind}-4k`, rgb, 3840, kind === 'ice' ? 66 : 78);
}
{
  const rgb = wrapSeam(await loadRgb('clouds'));
  settlePoles(rgb);
  await writeMap('clouds', rgb, 2048, 70);
}
{
  const rgb = wrapSeam(await loadRgb('moon'));
  settlePoles(rgb);
  await writeMap('moon', rgb, 1536, 72);
}
await buildCraftAtlas();
