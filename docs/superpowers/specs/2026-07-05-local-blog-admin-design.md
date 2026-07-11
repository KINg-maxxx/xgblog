# Local Blog Admin Design

## Goal

Add a local-only visual admin page for creating, editing, previewing, saving, and deleting Markdown blog posts.

## Design

- `npm run admin` starts a Node stdlib HTTP server on `127.0.0.1:5180`.
- The server only reads and writes `content/posts/*.md`.
- The admin page lists posts, edits frontmatter fields, edits Markdown body, previews Markdown, saves changes, and deletes posts after confirmation.
- The public site remains static and continues to load posts at build time through Vite.
- The admin page can publish after saving by asking the local server to run the existing static build and upload `dist` to the Cloudflare Pages project `xgblog`.

## Safety

- Listen on localhost only.
- Reject paths outside `content/posts`.
- Refuse empty titles and dates.
- Overwrite only the selected post or a generated slug from the form.
- Keep Cloudflare credentials on the local machine; the browser only calls the localhost admin server.

## Out of Scope

- Login.
- Database.
- Rich text editor.
