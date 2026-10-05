# CASA Première documentation

Three documents, all kept as Markdown in `docs/`. One source, three readings: this site, the app's own
`/docs` route, and GitHub. Nothing is hand-copied between them, so an edit cannot land in one place and
miss the others.

| Document | What it holds |
|---|---|
| [Project documentation](PROJECT-DOCUMENTATION.md) | The canonical reference: architecture and routes, local development, the production build, environment variables, deployment, cross-site links, the contact form, appointment booking, the quick-view drawer, the database, image storage and authentication — then the migration runbook (Sections 1–19). |
| [The CMS document](cms.md) | The admin CMS end to end: what it does, the decisions behind it, the schema and the API, the user flow, authentication, deployment, and the build history one phase at a time (Sections 1–24). |
| [CMS runbook](cms-runbook.md) | Moving Turso and R2 to new accounts on its own, with the exact expected output at each step and the rollback. |

## Which one do I want?

- **Setting the project up, or looking for a route, an environment variable or a deployment rule.**
  Start with the [project documentation](PROJECT-DOCUMENTATION.md).
- **Working on the admin CMS.** Read the [CMS document](cms.md): Sections 1–16 describe the CMS as it is
  today, and Sections 17–24 are the history of how it was built, one phase per section.
- **Moving the database or the image bucket to new accounts.** The [CMS runbook](cms-runbook.md) is
  that operation on its own; the project documentation repeats it as Section 17.

## How to read them

Section numbers are stable. Code comments and other documents cite them directly (`docs/cms.md` Section 22.1),
so a section is never renumbered — a superseded one is retired in place instead. The CMS document's
`D#` decision ids work the same way.

## Where these pages come from

`docs/` is the only copy. The app renders it at `/docs` (`npm run dev`, then
<http://localhost:3000/docs>), and MkDocs publishes the same files to GitHub Pages through
`mkdocs.yml` and `.github/workflows/docs.yml`.

To preview the published site locally:

```bash
pip install mkdocs-material
mkdocs serve            # http://127.0.0.1:8000
```
