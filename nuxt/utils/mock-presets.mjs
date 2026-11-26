/**
 * The presets, by the name each one's package ends with.
 *
 * A module of its own, with the `.mjs` extension, so the build step
 * (scripts/mock-dump.mjs) can import it on Node 16, which reads a `.js` file
 * in this package as CommonJS. utils/mock-backend.js re-exports it.
 */
export const MOCK_PRESETS = ['umami', 'dashi', 'haven', 'mercury']
