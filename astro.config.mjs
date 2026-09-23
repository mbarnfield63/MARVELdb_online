import { defineConfig } from 'astro/config';

// Pure static output (map #9, ticket #11): all data is fetched from the
// db_MARVEL API at build time; file links point straight at the API.
// BASE_PATH is set by the Pages workflow ('/<repo>' on a project site).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  // Keep source line breaks as spaces: the default compression drops the break
  // before a line-leading link, gluing it to the previous word.
  compressHTML: false,
});
