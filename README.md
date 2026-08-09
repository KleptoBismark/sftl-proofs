# SFTL — Stories From The Lens

Website for Stories From The Lens photography, served via GitHub Pages.

- `/` — public site (portfolio, about, services; content in progress)
- `/client/` — client portal: proofing gallery. Images, ratings and comments
  live in Supabase, gated by per-gallery access tokens passed as
  `?t=<token>` in the URL. Token links that hit the site root are forwarded
  to `/client/` automatically.
- `/assets/brand/` — brand marks, lockups, favicons (outlined-path SVGs).

No secrets live in this repo — the embedded Supabase anon key is public by
design and all data access is token-checked server-side.
