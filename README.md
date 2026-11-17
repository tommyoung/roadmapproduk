# BINUS commercialization roadmap 2027-2030

Interactive roadmap for 16 BINUS research products (EN/ID, three scenarios, editable timeline, revenue, funding and priority scores). Static site, no build step.

## Structure

```
index.html            page shell
assets/app.<hash>.css styles
assets/app.<hash>.js  application code
assets/data.<hash>.js all roadmap content (both languages)
assets/fonts/         Plus Jakarta Sans (OFL licence)
favicon.svg
robots.txt            blocks search engines
vercel.json           headers and caching
```

Asset file names contain a content hash, so browsers cache them for a year and still pick up every new version. `index.html` is never cached.

## Deploy on Vercel

1. Replace the contents of the repository root with these files (delete the old single-file `index.html` first).
2. Commit and push. Vercel redeploys automatically.
3. If you set the project up from scratch: Add New > Project > import the repo > Framework Preset **Other** > leave Build Command and Output Directory empty > Deploy.

## Notes

- Edits made in the app (timeline, revenue, funding, scores, hidden products, links) are saved in each visitor's own browser. Use Settings > Export / Import to pass a set of edits to someone else.
- Deep links work: `/#/products/<slug>/<tab>`, for example `/#/products/pediderm/revenue`.
- The site sends `noindex` headers and `robots.txt` blocks crawlers, but anyone with the URL can open it. Turn on Deployment Protection in the Vercel project settings if access should be limited.
- To update content, edit the source files and rebuild; do not edit the hashed files by hand.
