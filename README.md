# SFTL Proofs — Stories From The Lens

Client proofing gallery. Static frontend (this repo, served via GitHub Pages);
images, ratings and comments live in Supabase, gated by per-gallery access
tokens passed as `?t=<token>` in the URL.

No secrets live in this repo — the embedded Supabase anon key is public by
design and all data access is token-checked server-side.
