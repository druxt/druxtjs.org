// Points git at the committed hooks. npm runs `prepare` in a checkout only.
import { execFileSync } from 'node:child_process'

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' })
} catch {
  // Not a git checkout, so there are no commits to check.
  process.exit(0)
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' })
  console.log('Git hooks enabled from .githooks/')
} catch (error) {
  console.warn(`Could not enable git hooks: ${error.message}`)
  console.warn('Run `npm run hooks:install` by hand if you intend to commit.')
}
