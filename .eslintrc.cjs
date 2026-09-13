// Root tooling only: scripts/, tests/ and the config files. nuxt/ brings its
// own lint setup with the frontend, and drupal/ is PHP.
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  extends: ['eslint:recommended', 'prettier'],
  ignorePatterns: ['nuxt/', 'drupal/', '.npm/', '.vale/', '.docs-ir/', '.docs-source/', 'reports/'],
  overrides: [
    {
      // package.json declares no type, so a .js or .cjs file here is CommonJS.
      files: ['**/*.js', '**/*.cjs'],
      parserOptions: { sourceType: 'script' },
    },
  ],
}
