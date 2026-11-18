# BINUS commercialization roadmap 2027-2030

Interactive roadmap for 19 BINUS research products by the Technology Transfer unit of BINUS RTT: EN/ID, three scenarios, TKT path per phase, go-to-market strategy, editable timeline, revenue, funding, objective priority rubric, add or remove products, and a method page. Static site, no build step, no API key.

This is a working draft. Each plan is to be finalized with its research team and their participation in PPHK.

## Structure

```
index.html            page shell
assets/app.<hash>.css styles
assets/app.<hash>.js  application code, product generator and method page
assets/data.<hash>.js roadmap content, facts and scoring rubric (both languages)
assets/fonts/         Plus Jakarta Sans (OFL licence)
favicon.svg
robots.txt            blocks search engines
vercel.json           headers and caching
```

Asset file names contain a content hash, so browsers cache them for a year and still pick up every new version. `index.html` is never cached.

## Deploy on Vercel

1. Delete the old `assets` folder in the repo, then copy these files into the repository root.
2. Commit and push. Vercel redeploys automatically.
3. New project from scratch: Add New > Project > import the repo > Framework Preset **Other** > leave Build Command and Output Directory empty > Deploy.

## Notes

- Edits are saved in each visitor's own browser. Use Settings > Export / Import to pass them to someone else.
- This version resets earlier saved priority scores and weights, because scores now come from recorded facts. Timeline, revenue, funding, links and added products are kept.
- Deep links work: `/#/products/<slug>/<tab>`, for example `/#/products/autoclave/gtm`.
- The method behind every number, including the scoring rubric, is on the "Method and sources" page.
- The site sends `noindex` headers and `robots.txt` blocks crawlers, but anyone with the URL can open it. Turn on Deployment Protection in the Vercel project settings if access should be limited.
