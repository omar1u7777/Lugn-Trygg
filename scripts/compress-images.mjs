#!/usr/bin/env node
/**
 * Image compression pipeline for Day 3 performance work.
 *
 * Usage:
 *   node scripts/compress-images.mjs [--dir=public/images] [--max-width=1920] [--quality=82] [--dry-run]
 *
 * - Re-compresses PNG/JPG/JPEG assets in the target directory.
 * - Resizes images that exceed the configured max width (without enlarging smaller assets).
 * - Writes optimized originals and emits .webp / .avif siblings for use in Cloudinary fallbacks.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
const DEFAULT_DIR = 'public/images';
const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_QUALITY = 82;

const parsedArgs = process.argv.slice(2).reduce((acc, arg) => {
  if (!arg.startsWith('--')) {
    return acc;
  }
  const [flag, rawValue] = arg.replace(/^--/, '').split('=');
  acc[flag] = rawValue ?? true;
  return acc;
}, {});

const options = {
  dir: path.resolve(process.cwd(), parsedArgs.dir || DEFAULT_DIR),
  maxWidth: Number(parsedArgs['max-width'] ?? DEFAULT_MAX_WIDTH),
  quality: Number(parsedArgs.quality ?? DEFAULT_QUALITY),
  dryRun: Boolean(parsedArgs['dry-run'])
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
};

const walkDir = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkDir(fullPath);
    }
    return fullPath;
  }));
  return files.flat();
};

const filterSupportedFiles = (files) =>
  files.filter((file) => SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase()));

const ensureDirExists = async (dir) => {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
};

const relative = (target) => path.relative(process.cwd(), target);

const log = (message) => console.log(`🖼️  ${message}`);

const optimizeImage = async (filePath) => {
  const inputBuffer = await fs.readFile(filePath);
  const relPath = relative(filePath);

  const metadata = await sharp(inputBuffer).metadata();
  const resizeWidth = metadata.width && metadata.width > options.maxWidth
    ? options.maxWidth
    : undefined;

  const basePipeline = sharp(inputBuffer).rotate();
  if (resizeWidth) {
    basePipeline.resize({ width: resizeWidth, withoutEnlargement: true });
  }

  const targetFormat = metadata.format === 'png' ? 'png' : 'jpeg';
  const formatOptions = targetFormat === 'png'
    ? { compressionLevel: 9, adaptiveFiltering: true }
    : { quality: options.quality, progressive: true, mozjpeg: true };

  const optimizedBuffer = await basePipeline
    .clone()
    .toFormat(targetFormat, formatOptions)
    .toBuffer();

  let bytesSaved = inputBuffer.length - optimizedBuffer.length;
  const needsWrite = bytesSaved > 0;

  if (needsWrite) {
    if (!options.dryRun) {
      await fs.writeFile(filePath, optimizedBuffer);
      log(`${relPath} optimized (${formatBytes(bytesSaved)} saved)`);
    } else {
      log(`[DRY-RUN] ${relPath} would save ${formatBytes(bytesSaved)}`);
    }
  } else {
    log(`${relPath} already optimized`);
    bytesSaved = 0;
  }

  if (!options.dryRun) {
    const variantPromises = ['webp', 'avif'].map(async (variantFormat) => {
      const variantBuffer = await basePipeline
        .clone()
        .toFormat(variantFormat, {
          quality: variantFormat === 'avif' ? Math.min(options.quality + 5, 90) : options.quality,
        })
        .toBuffer();

      const variantPath = filePath.replace(/\.(png|jpg|jpeg)$/i, `.${variantFormat}`);
      await fs.writeFile(variantPath, variantBuffer);
      return variantPath;
    });

    await Promise.all(variantPromises);
  }

  return { bytesSaved, needsWrite };
};

const main = async () => {
  if (!(await ensureDirExists(options.dir))) {
    console.error(`❌ Directory not found: ${relative(options.dir)}`);
    process.exit(1);
  }

  log(`Scanning ${relative(options.dir)} ...`);
  const allFiles = await walkDir(options.dir);
  const candidates = filterSupportedFiles(allFiles);

  if (candidates.length === 0) {
    log('No PNG/JPG assets detected. Nothing to do.');
    return;
  }

  let totalBytesSaved = 0;
  let filesNeedingCompression = 0;
  for (const file of candidates) {
    try {
      const { bytesSaved, needsWrite } = await optimizeImage(file);
      totalBytesSaved += bytesSaved;
      if (needsWrite) {
        filesNeedingCompression += 1;
      }
    } catch (error) {
      console.error(`❌ Failed to optimize ${relative(file)}:`, error.message);
    }
  }

  const summary = options.dryRun ? 'Dry run complete.' : 'Compression complete.';
  log(`${summary} ${candidates.length} file(s) processed. Savings: ${formatBytes(totalBytesSaved)}.`);

  if (options.dryRun && filesNeedingCompression > 0) {
    console.error(`❌ Image compression check failed: ${filesNeedingCompression} file(s) would be rewritten. Run "npm run images:compress" locally before pushing.`);
    process.exit(2);
  }
};

main().catch((error) => {
  console.error('❌ Unexpected error while compressing images:', error);
  process.exit(1);
});
