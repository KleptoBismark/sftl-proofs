# SFTL — Stories From The Lens

Photography website and client platform, served as static HTML/CSS/JavaScript
by GitHub Pages at https://storiesfromthelens.com. No build step is required.

- `/` — public portfolio, services and contact information.
- `/client/` — gallery-code entry and client selection using star ratings.
- `/client/finals/` — finished-photo viewing and downloads.
- `/client/admin/` — owner dashboard: album creation, selection-preview uploads,
  finished-photo uploads, stages, review progress and client invitations.
- `/assets/brand/` — brand marks, lockups and favicons.

Supabase stores album metadata and photographs. Server-side checks distinguish
client, photographer and owner credentials. Existing token links stay valid
through selection and delivery; links arriving at the site root are forwarded
to the client portal.

Selection originals remain on the owner's device: only generated previews and
thumbnails upload. Finished-photo uploads require explicitly chosen edited JPEG
exports. Upload batches are verified before publication and can be recovered
after interruption. Copying an invitation does not send a client message.

No private credentials belong in this public repository. The embedded Supabase
anon key is public by design; it does not grant owner access. Backend source,
private records and operational runbooks are maintained in the separate private
workspace. See `AGENTS.md` for repository instructions.

Run JavaScript unit checks with `node --test tests/*.test.cjs`. Broader browser
and backend checks live in the private workspace. A push to the deployed branch
can publish the website; verify the resulting Pages deployment.
