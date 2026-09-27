#!/usr/bin/env node
/**
 * Render the Open Graph cards from a clean Node process.
 *
 * The generate:done hook runs inside Nuxt 2's process, where the `esm`
 * config loader has patched the module system; satori and resvg crash the
 * process when required through it. Spawned bare, they work, so the hook
 * calls this script instead of the library directly.
 *
 * Usage: node scripts/og-render.js <contentDir> <fontsDir> <outDir> [corpus.json]
 *
 * The corpus file, when given, is the merged corpus the production server
 * already built: the authored pages from Drupal plus the generated
 * reference pages. Without it the content tree is read directly, which is
 * what the static `generate` path does.
 */

const fs = require('fs')
const { readContent } = require('../lib/content-index')
const { renderOgImages } = require('../lib/og-images')

const [contentDir, fontsDir, outDir, corpusFile] = process.argv.slice(2)

const docs =
  corpusFile && fs.existsSync(corpusFile)
    ? JSON.parse(fs.readFileSync(corpusFile, 'utf8'))
    : readContent(contentDir)

renderOgImages(docs, { fontsDir, outDir })
  .then((written) => {
    process.stdout.write(String(written))
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
