# MARVEL Database

Static website over [db_MARVEL](https://github.com/mbarnfield63/MARVEL_db):
a home page, a molecule browser, and a references list. Built with Astro.

There is no backend. Every page is generated at build time from the db_MARVEL
public API, and the file download links point straight at that API. Design
decisions: db_MARVEL map [#9](https://github.com/mbarnfield63/MARVEL_db/issues/9)
(tickets #15, #16, #17).

## Build

Needs a running db_MARVEL API (see that repo's README).

```sh
npm install
PUBLIC_API_URL=http://localhost:8000 npm run build   # writes dist/
npm run preview                                      # serve dist/ locally
npm test                                             # helper self-checks
```

`PUBLIC_API_URL` is used both to fetch data during the build and in the links
on the pages, so set it to the API's public address for a deployed build.
New data in the database needs a rebuild to appear.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` builds and deploys on every push to `main`, or
by hand from the Actions tab (do that after loading new data). One-time setup:

1. Settings > Pages > Source: **GitHub Actions**.
2. Settings > Secrets and variables > Actions > Variables: add
   `PUBLIC_API_URL` set to the API's public HTTPS address.

The workflow sets `BASE_PATH` to the Pages path (`/<repo>` on a project site),
and every internal link goes through `url()` in `src/lib/site.js`. Locally
`BASE_PATH` is unset and the site builds at `/`.

## Layout

- `src/lib/site.js`: API access, grouping, run ordering, citation formatting
- `src/layouts/Base.astro`: header, footer, styles
- `src/pages/`: `index`, `molecules/index`, `molecules/[formula]`, `references`
