## Summary
- 

## Testing
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] Other (add below)

## Image Performance Checklist (Day 3)
Refer to [`docs/performance/images.md`](../docs/performance/images.md). Mark each box or write `N/A`.
- [ ] All new or updated illustrations use `OptimizedImage` (no raw `<img>` tags).
- [ ] Cloudinary public IDs live in `src/config/env.ts` helpers and `.env` values were updated.
- [ ] `width`, `height`, `sizes`, and `placeholder` props are set to prevent CLS.
- [ ] `fallbackSrc` (and `priority` when needed) is configured for hero-level assets.
- [ ] Documentation/notes were updated if the pattern changed (e.g. this PR edits the guidelines).
