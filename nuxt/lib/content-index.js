/**
 * Build-time index of the `content/` tree.
 *
 * `@nuxt/content` v1 cannot be queried from a nuxt.config.js hook: its
 * Database holds a file watcher open, so `generate` never exits.
 *
 * Only the frontmatter is parsed. The fields returned (route, title,
 * description) are what sitemap.xml and llms.txt consume.
 */

const fs = require('fs')
const path = require('path')

const { normalisePath, titleFromPath } = require('./site')

/** A leading `---` fence, which is the only place frontmatter is frontmatter. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** `key: value` on one line. The value keeps any colons after the first. */
const FIELD = /^([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*)$/

/**
 * Split a document into its frontmatter fields and its body.
 *
 * Hand-rolled rather than a YAML dependency, because `content/` uses only
 * single-line scalars: title, weight and description. Anything else is ignored,
 * and the document falls back to a route-derived title.
 *
 * @param {string} raw - The complete file contents.
 * @returns {{data: object, content: string}} Fields and the remaining body.
 */
const parseFrontmatter = (raw) => {
  const text = String(raw || '')
  const fence = FRONTMATTER.exec(text)
  if (!fence) return { data: {}, content: text }

  const data = {}
  fence[1].split(/\r?\n/).forEach((line) => {
    const field = FIELD.exec(line)
    if (!field) return

    const value = field[2].trim()
    const quoted = /^(['"])([\s\S]*)\1$/.exec(value)

    if (quoted) data[field[1]] = quoted[2]
    else if (/^-?\d+(?:\.\d+)?$/.test(value)) data[field[1]] = Number(value)
    else data[field[1]] = value
  })

  return { data, content: text.slice(fence[0].length) }
}

/** Index files, whose route is their containing directory rather than the file. */
const INDEX_NAMES = ['README', 'index']

/**
 * Route path for a content file, mirroring how pages/*_/_.vue resolve slugs.
 *
 * `content/guide/README.md` serves `/guide`, not `/guide/README`, and the API
 * section uses `index.md` for the same purpose. Both collapse to the parent
 * directory so the sitemap lists the URL a visitor actually lands on.
 *
 * @param {string} relative - Path relative to the content root, e.g. `guide/theming.md`.
 * @returns {string} The route path.
 */
const routeFor = (relative) => {
  const withoutExtension = relative.replace(/\.md$/i, '')
  const segments = withoutExtension.split(path.sep).filter(Boolean)
  const last = segments[segments.length - 1]
  if (INDEX_NAMES.includes(last)) segments.pop()
  return normalisePath('/' + segments.join('/'))
}

/** Lines that describe nothing on their own and are skipped when excerpting. */
const isSkippableLine = (line) => (
  line === ''
  || line.startsWith('#') // heading
  || line.startsWith('![') // standalone image
  || line.startsWith('|') // table row
  || line.startsWith('```') // fence
  || line.startsWith('<') // raw html / component
  || /^[-*_]{3,}$/.test(line) // rule
  // List items, matching utils/content.js documentDescription.
  || /^([-*+]|\d+\.)\s/.test(line)
  // A note to a maintainer, not a summary.
  || /^(TODO|FIXME|NOTE|XXX)\b[:\s]/i.test(line)
)

/**
 * A one-line summary of a document, for `<meta name="description">` and for the
 * llms.txt entry.
 *
 * Almost nothing in `content/` sets a frontmatter description, so the first
 * line of prose stands in.
 *
 * @param {string} body - Markdown body, frontmatter already stripped.
 * @returns {string} A plain-text summary, or an empty string.
 */
const excerpt = (body) => {
  const lines = String(body || '')
    .split('\n')
    .map((raw) => raw.replace(/^>\s?/, '').trim())

  // Generated pages (content/api is jsdoc2md output) open with markup rather
  // than prose, and excerpting those yields fragments. Say nothing instead.
  const firstMeaningful = lines.find((line) => line !== '' && !line.startsWith('#'))
  if (!firstMeaningful || firstMeaningful.startsWith('<')) return ''

  const line = lines.find((candidate) => !isSkippableLine(candidate))
  if (!line) return ''

  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links keep their text
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Every `.md` file under a directory, depth first.
 *
 * @param {string} dir - Directory to walk.
 * @param {string} root - The content root, for relative paths.
 * @returns {string[]} Paths relative to `root`.
 */
const walk = (dir, root) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.reduce((found, entry) => {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) return found.concat(walk(absolute, root))
    if (!/\.md$/i.test(entry.name)) return found
    return found.concat(path.relative(root, absolute))
  }, [])
}

/**
 * Read the content tree.
 *
 * @param {string} contentDir - Absolute path to the content root.
 * @returns {Array<object>} Documents as { route, title, description, section }.
 */
const readContent = (contentDir) => {
  if (!fs.existsSync(contentDir)) return []

  return walk(contentDir, contentDir)
    .map((relative) => {
      const absolute = path.join(contentDir, relative)
      const raw = fs.readFileSync(absolute, 'utf8')
      const { data, content } = parseFrontmatter(raw)
      const route = routeFor(relative)

      return {
        route,
        title: data.title || titleFromPath(route),
        description: data.description || excerpt(content),
        weight: typeof data.weight === 'number' ? data.weight : 0,
        section: route.split('/').filter(Boolean)[0] || null,
      }
    })
    .sort((a, b) => a.route.localeCompare(b.route))
}

module.exports = { readContent, routeFor, excerpt, parseFrontmatter }
