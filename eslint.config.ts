import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
  {
    // Generated, vendored by a build step, or written by the CMS. `scripts/keyer.ts` is
    // shared verbatim with gosscounselling.co.uk and is linted there.
    ignores: [
      'build/',
      '.svelte-kit/',
      'node_modules/',
      'static/',
      'src/content/',
      'scripts/keyer.ts'
    ]
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      // TypeScript resolves identifiers itself; the core rule only produces false reports on types.
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      // Every `{@html}` here renders first-party content baked in at build time: CMS
      // markdown through `$lib/markdown` (which states the trust boundary) and the
      // JSON-LD the site builds itself. Nothing a visitor typed reaches one.
      'svelte/no-at-html-tags': 'off',
      // The site is served from the root with no `paths.base`, and every internal
      // href is built by `$lib/content` for the page's locale.
      'svelte/no-navigation-without-resolve': 'off',
      // Lists are prerendered from content and never reordered in the browser.
      'svelte/require-each-key': 'off'
    }
  },
  {
    // The WebGL stage owns its canvas and keeps plain Maps in the render loop on
    // purpose: nothing in them is reactive state, and a proxy there costs frames.
    files: ['src/lib/components/Stage.svelte'],
    rules: {
      'svelte/no-dom-manipulating': 'off',
      'svelte/prefer-svelte-reactivity': 'off'
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig
      }
    }
  }
);
