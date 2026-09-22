# Son of Kings

Storefront for the Bullion Crest Tracksuit — a static site with no build step,
no dependencies, and no third-party requests at runtime.

## Run it

Open `index.html`, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deploy

Any static host works — GitHub Pages, Netlify, Vercel, S3, plain nginx.
Push this repository and point the host at the root; `.nojekyll` keeps
GitHub Pages from reprocessing `assets/`.

Before going live, replace `https://sonofkings.com/` in `index.html`
(`<link rel="canonical">`), `robots.txt`, and `sitemap.xml` with the real domain.

## Layout

```
index.html              the store
404.html                not-found page
site.webmanifest        installable-app metadata
robots.txt sitemap.xml  crawl hints
assets/css/site.css     stylesheet (mobile-first: 700 / 900 / 1000 breakpoints)
assets/js/site.js       bag, size picker, gallery, drawers
assets/fonts/           Cinzel + Jost, self-hosted woff2
assets/img/             crest, favicons, Open Graph card
```

## Editing

Everything you would normally change lives in the `SITE` block at the top of
`assets/js/site.js`:

- `email` / `phone` / `phoneLabel` — where "join the list" and checkout go.
- `product` — name, price, sizes, per-size cap. Price also appears as text in
  `index.html` (hero button, detail block, buy bar) and in the JSON-LD.
- `photos` — supply real product shots and they replace the composed plates:

  ```js
  photos: {
    front:   'assets/img/front.jpg',
    back:    'assets/img/back.jpg',
    detail:  'assets/img/detail.jpg',
    edition: 'assets/img/edition.jpg'
  }
  ```

  Shoot them 4:5; the thumbnails crop square from the same files.

## Checkout

There is no payment processor wired up. "Proceed to checkout" opens a
pre-filled order email to `SITE.email` with the bag contents, sizes, and
subtotal. To take card payments, replace the `#checkout` handler in
`assets/js/site.js` with a call to Stripe Checkout (or similar) and keep the
bag object as the line-item source.

## Notes

- Bag contents persist in `localStorage` under `sok.bag.v1`, and the loader
  discards anything that is not a size the shop actually sells.
- The crest is the only raster asset: a 960px palette PNG at 113 KB.
- Honours `prefers-reduced-motion`; drawers trap focus and close on Escape.
