import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // SPA-fallback shell. /publish (and any future client-only
      // route that opts out of prerender) is served via this file
      // — nginx's try_files falls through to /200.html for paths
      // that didn't prerender. The prerendered routes still get
      // their own .html files; the fallback only kicks in for
      // non-prerendered paths.
      fallback: '200.html',
      // Allow non-prerenderable routes (currently just /publish,
      // which reads localStorage + hits the GitHub API at
      // runtime). Without `strict: false`, adapter-static
      // refuses to build when any route has prerender = false.
      strict: false
    }),
    prerender: {
      entries: ['*', '/da/']
    }
  }
};

export default config;
