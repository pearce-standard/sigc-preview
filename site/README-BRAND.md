# SIGC full-site preview (Brand) — Nov 10, 2026

Static pages in `site/`, sharing the approved homepage header, nav, footer, colors and mobile Book bar. Every page has `noindex,nofollow` and the "Site preview · Not live" notice. Nothing here touches the live site, DNS, YGB, TrackMan or Square.

Pages: index, bookings (Book info + rates), memberships, bays, leagues, events, coaching, gift-card, about, contact (with FAQ).
Book a Bay engine page: `public/book.html` (Ops's test page restyled; same `/api/members`, `/api/availability`, `/api/quote`, `/api/book` calls and request body).

## Linking / hosting
- Site pages link to the engine page as `../public/book.html`; the engine page links back with `../site/*.html`.
- Both work when the **repo root** is served statically with `/api/*` going to the engine (that's how QA ran locally).
- With `npm start` alone, the Node server only serves `public/` at `/`, so `site/` isn't reachable there. Ops: either mount `site/` at `/site/` and `public/` at `/public/`, or serve the repo root and proxy `/api`.
- `book.html` inlines its CSS and a resized copy of the real primary logo so it renders even when only `public/` is served.

## Generator
Source: `/workspace/sigc/website-v2/sitegen/` on the box (`build.py site public`). Edit `pages.py` / `site.css`, not the HTML.

## Real vs sample
- Sample: league standings table (labeled), engine availability/test members/payments (labeled sandbox).
- Everything else comes from the live site (read Nov 10, 2026) or Eric's locks. See the report for unverified items.
