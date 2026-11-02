/**
 * Render one Open Graph PNG per content page.
 *
 * Runs from the generate:done hook, next to sitemap.xml and llms.txt, against
 * the same readContent() index the pages were generated from. Satori and resvg
 * are devDependencies; nothing here ships to the browser.
 */

const fs = require('fs')
const path = require('path')
const { ogCard, ogSiteCard } = require('./og-card')
const { pageFromDoc, ogImageFile } = require('./og-pages')

/**
 * Render every card.
 *
 * @param {Array<object>} docs - readContent() documents.
 * @param {object} options - Paths.
 * @param {string} options.fontsDir - Directory holding the four vendored .ttf files.
 * @param {string} options.outDir - Directory to write PNGs into.
 * @returns {Promise<number>} How many cards were written.
 */
/**
 * The documents to draw cards for. Cards are drawn only at startup, so a page
 * published later would have none until the next restart. The MCP page's card
 * doesn't depend on its content, so it's always drawn.
 *
 * @param {Array<object>} docs - The corpus.
 * @returns {Array<object>} The corpus, with the MCP page's entry if it has none.
 */
const cardDocs = (docs) =>
  docs.some((doc) => doc.route === '/mcp') ? docs : [...docs, { route: '/mcp', title: 'MCP server', section: 'mcp' }]

const renderOgImages = async (docs, { fontsDir, outDir }) => {
  const satori = require('satori').default || require('satori')
  const { Resvg } = require('@resvg/resvg-js')

  const font = (file) => fs.readFileSync(path.join(fontsDir, file))
  const fonts = [
    { name: 'Source Sans 3', data: font('SourceSans3-Regular.ttf'), weight: 400, style: 'normal' },
    { name: 'Source Sans 3', data: font('SourceSans3-SemiBold.ttf'), weight: 600, style: 'normal' },
    { name: 'Source Sans 3', data: font('SourceSans3-Bold.ttf'), weight: 700, style: 'normal' },
    { name: 'IBM Plex Mono', data: font('IBMPlexMono-Regular.ttf'), weight: 400, style: 'normal' },
    { name: 'IBM Plex Mono', data: font('IBMPlexMono-Medium.ttf'), weight: 500, style: 'normal' },
    { name: 'IBM Plex Mono', data: font('IBMPlexMono-SemiBold.ttf'), weight: 600, style: 'normal' },
  ]

  let written = 0

  const siteSvg = await satori(ogSiteCard(), { width: 1200, height: 630, fonts })
  await fs.promises.mkdir(outDir, { recursive: true })
  await fs.promises.writeFile(
    path.join(outDir, 'site.png'),
    new Resvg(siteSvg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
  )
  written++

  for (const doc of cardDocs(docs)) {
    const file = path.join(outDir, ogImageFile(doc.route))
    await fs.promises.mkdir(path.dirname(file), { recursive: true })

    const svg = await satori(ogCard(pageFromDoc(doc)), { width: 1200, height: 630, fonts })
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
    await fs.promises.writeFile(file, png)
    written++
  }

  return written
}

module.exports = { cardDocs, renderOgImages, pageFromDoc, ogImageFile }
