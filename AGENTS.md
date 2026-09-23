# SFTL public frontend

This is the PUBLIC website repository for Stories From The Lens, deployed by
GitHub Pages to https://storiesfromthelens.com. A push may publish the site.

Routes: `/` (public website), `/client/` (selection), `/client/finals/` (delivery),
`/client/admin/` (owner dashboard). Static HTML/CSS/JavaScript; no build step.

Never commit real gallery codes, client/photographer/owner tokens, service keys,
private manifests or original/client photographs. The embedded Supabase anon key
is public by design; role/token validation belongs on the backend. Use synthetic
fixture data in tests. Do not place private operational records in this repo.

Preserve existing client links, feedback and the distinction between client,
photographer and owner access. Client selections use stars (4+ means edit), with
the threshold visible, and comparison up to four photos in a 2×2 grid at four.
Keep the monochrome brand and portal accent `#C13A2E`.

For JavaScript behavior changes run the relevant `node --test tests/*.test.cjs`
checks; browser-check affected UI and narrow screens. No extra tests are needed
for instruction-only edits. Verify deployed files after an authorized release.

When working from the private Photography Website workspace, also follow its
root `AGENTS.md`, state record and relevant runbooks. That workspace owns backend
migrations, private release evidence and the project-specific approval policy.
When this repo is opened alone, do not assume the private workspace exists or
that this file grants permission for a deployment; use the user's task scope.
