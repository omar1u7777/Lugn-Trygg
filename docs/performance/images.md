# Frontend Image Performance Guidelines

Day 3 focuses on squeezing as much CLS and bandwidth savings as possible out of every media surface. This document summarizes the non‑negotiable requirements for any new illustration, avatar or marketing asset that lands in the React app.

## Goals
- Keep Lighthouse performance scores above 90 on Dashboard/Wellness/Journal routes.
- Reduce average image payload size by aggressively using Cloudinary + next‑gen formats.
- Ensure predictable layout shifts by defining explicit dimensions and aspect ratios.

## Requirements Checklist
1. **Use `OptimizedImage`**
   - Never render raw `<img>` tags inside `src/` without a prior review.
   - `OptimizedImage` automatically wires up lazy loading, responsive `srcset`, network-awareness and Cloudinary transforms.
2. **Source of truth = Cloudinary Public ID**
   - Prefer referencing assets via public IDs (e.g. `branding/world-class-dashboard-hero-v1`).
   - Keep IDs in `env.ts` helpers (`getDashboardHeroImageId`, `getWellnessHeroImageId`, `getJournalHeroImageId`, …) so we can rotate artwork without code changes.
3. **Provide `sizes` + intrinsic dimensions**
   - Always pass `width`, `height`, and an explicit `sizes` string that matches the layout breakpoints of the component.
   - Aim for `aspect-[ratio]` utility classes or inline `style={{ aspectRatio: '4 / 3' }}` when the container must reserve space.
4. **Placeholders & fallbacks**
   - Use `placeholder="blur"` with either the provided blurDataURL or the default blur SVG.
   - Pass `fallbackSrc` that points to a CDN-safe illustration in case Cloudinary fails.
5. **Accessibility**
   - Provide meaningful `alt` text describing the scene or purpose. Use `aria-hidden` only when the graphic is purely decorative and redundant with on-screen copy.
6. **Lazy loading strategy**
   - Let `OptimizedImage` handle `loading="lazy"` for non-critical imagery.
   - For above-the-fold hero artwork, set `priority` to `true` to hint preloading.
7. **CI compression**
   - Run `npm run images:compress` (or `node scripts/compress-images.mjs --dry-run`) before committing anything under `public/images/`.
   - The script resizes anything wider than 1920px, rewrites the source file, and emits `.webp` + `.avif` siblings so we keep bundle size predictable.

## Developer Workflow
1. **Add Asset to Cloudinary** – Upload to the `branding/` folder and note the resulting public ID.
2. **Expose ID via env helper** – Update `src/config/env.ts` (add getter if needed) and seed `.env` variables for dev/preview environments.
3. **Render via `OptimizedImage`** – Import the helper + component inside the React feature. Provide width/height/sizes per the component layout.
4. **Run compression** – Execute `npm run images:compress` to optimize any new static assets before committing.
5. **Verify breakpoints** – Run `npm run dev`, open the route on mobile + desktop widths, and check the network tab for AVIF/WebP requests.
6. **Document** – If it is a new pattern, update this file or drop a note in `CHANGELOG.md` under Day 3.

## Compression Utility Cheat Sheet

```bash
# Optimize all PNG/JPG assets in public/images (overwrites originals)
npm run images:compress

# Preview the savings without writing to disk
node scripts/compress-images.mjs --dry-run

# Point to a different folder or tweak parameters
node scripts/compress-images.mjs --dir=public/avatars --max-width=1440 --quality=78
```

- The script skips non PNG/JPG/JPEG files automatically.
- When run without flags it generates `.webp` and `.avif` siblings next to each optimized file for downstream use.
- Add the `--dry-run` flag in CI or during PR reviews to verify that assets are already compressed.

## Example Usage
```tsx
import OptimizedImage from '@/components/ui/OptimizedImage';
import { getWellnessHeroImageId } from '@/config/env';

const HERO_ID = getWellnessHeroImageId();
const HERO_SIZES = '(min-width: 1280px) 560px, (min-width: 768px) 50vw, 90vw';

<OptimizedImage
  src={HERO_ID}
  alt="Illustration av andningsövningar"
  width={560}
  height={420}
  sizes={HERO_SIZES}
  placeholder="blur"
  fallbackSrc="https://res.cloudinary.com/dxmijbysc/image/upload/c_scale,w_auto,dpr_auto,q_auto,f_auto/hero-bild_pfcdsx.jpg"
  className="w-full h-auto"
/>
```

## Audit Process
- Run `npm run lint` and ensure there are no lint warnings about unused imports when swapping hero assets.
- Use Chrome DevTools → Lighthouse → Performance; attach screenshots to the PR description after each major hero swap.
- Flag any new `<img>` tag in code reviews immediately and request refactor to `OptimizedImage`.
