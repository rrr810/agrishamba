# assets/

```
assets/
├── images/   product & editorial photography (hot-linked stock in the demo build)
├── icons/    emoji + inline SVG are used today; drop an icon sprite here later
└── logos/    sokoshamba-logo.svg  (brand mark used in docs and share images)
```

## Current approach

- **Logo / favicon** — an inline SVG data-URI favicon is embedded in every page (`<link rel="icon" …>`), and
  `logos/sokoshamba-logo.svg` is the full lockup for documents, emails and social images.
- **Product photography** — the demo dataset (`data/demo-data.js`) hot-links Pexels stock photos.
  Every `<img>` is covered by a global error handler in `js/ui.js` that swaps in a generated, category-coloured
  SVG placeholder, so the UI never shows a broken image even offline.
- **Icons** — emoji are used deliberately: zero requests, universally rendered, and they read well on low-end
  Android devices common among Kenyan smallholders.

## When you connect Supabase

Upload real product and avatar images to the `product-images` and `avatars` storage buckets and store only the
returned public URL in the database. Serve resized variants (Supabase image transformations or a CDN) and keep
`loading="lazy"` + `decoding="async"` on non-critical images, as the current markup already does.
