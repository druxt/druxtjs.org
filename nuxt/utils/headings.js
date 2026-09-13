import GithubSlugger from 'github-slugger'

/**
 * A heading's anchor id, from github-slugger: the algorithm Drupal's table of
 * contents and the markdown pipeline both use, so the ids match.
 *
 * @param {string} text - The heading's text.
 * @returns {string} The id.
 */
export const headingId = (text) => GithubSlugger.slug(text)
