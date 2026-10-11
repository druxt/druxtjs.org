/**
 * How a revision says it was written with AI.
 *
 * CommonJS so the tests and the review page can both require it.
 */

/**
 * The revision log an AI-assisted writer sets on each page revision it
 * saves over JSON:API. The workspace review reads it to tell a change written
 * with AI from one a person made, whichever account saved it.
 */
const AI_REVISION_LOG = 'Written with AI authoring'

/**
 * Whether a revision log marks the revision as written with AI.
 *
 * @param {string} [log] - The revision log.
 * @returns {boolean} True when the log starts with the marker.
 */
const isAiRevision = (log) => String(log || '').startsWith(AI_REVISION_LOG)

module.exports = { AI_REVISION_LOG, isAiRevision }
