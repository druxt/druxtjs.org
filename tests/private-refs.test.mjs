// Unit tests for the private-host lint.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPrivateRefs, gitEnv, trackedFiles } from '../scripts/lint-private-refs.mjs'

const hostsIn = (text) => findPrivateRefs(text).map((ref) => ref.host)

// The hosts below are private on purpose. The lint exempts this file by path.
describe('findPrivateRefs', () => {
  test('finds a private host by name', () => {
    assert.deepEqual(hostsIn('see http://gitlab.example.local/x'), ['gitlab.example.local'])
  })

  test('finds RFC1918 addresses', () => {
    assert.deepEqual(hostsIn('http://10.0.0.8/ http://192.168.1.1/'), ['10.0.0.8', '192.168.1.1'])
    assert.deepEqual(hostsIn('http://172.16.0.1/'), ['172.16.0.1'])
  })

  test('finds an RFC1918 address inside an IPv4-mapped IPv6 literal', () => {
    // Compressed or expanded, with the last 32 bits dotted or hexadecimal.
    assert.deepEqual(hostsIn('https://[::ffff:10.0.0.8]/x'), ['10.0.0.8'])
    assert.deepEqual(hostsIn('https://[::ffff:0a00:0008]/x'), ['10.0.0.8'])
    assert.deepEqual(hostsIn('https://[0:0:0:0:0:ffff:10.0.0.8]/x'), ['10.0.0.8'])
    assert.deepEqual(hostsIn('https://[0:0:0:0:0:ffff:0a00:0008]/x'), ['10.0.0.8'])
    assert.deepEqual(hostsIn('http://[::ffff:c0a8:0101]/'), ['192.168.1.1'])
  })

  test('finds a link-local IPv6 address', () => {
    assert.deepEqual(hostsIn('http://[fe80::1]/'), ['fe80::1'])
  })

  test('leaves public hosts alone', () => {
    assert.deepEqual(hostsIn('https://druxtjs.org/docs'), [])
    assert.deepEqual(hostsIn('http://[2001:db8::1]/'), [])
    assert.deepEqual(hostsIn('http://[::ffff:8.8.8.8]/'), [])
    assert.deepEqual(hostsIn('http://[::ffff:0808:0808]/'), [])
  })

  test('leaves the local development hosts alone', () => {
    assert.deepEqual(hostsIn('http://localhost:3000/ http://127.0.0.1:8888/'), [])
    assert.deepEqual(hostsIn('http://[::1]/ https://example.ddev.site/'), [])
  })

  test('reads the host, not the userinfo a git remote carries', () => {
    assert.deepEqual(hostsIn('https://oauth2:token@gitlab.example.local/a'), [
      'gitlab.example.local',
    ])
  })

  test('reads the host from an scp-style remote, whatever the user', () => {
    assert.deepEqual(hostsIn('deploy@gitlab.example.local:druxt/repo.git'), [
      'gitlab.example.local',
    ])
    assert.deepEqual(hostsIn('git@10.0.0.8:druxt/repo.git'), ['10.0.0.8'])
    // A prose email has no remote-path colon, so it is not a remote.
    assert.deepEqual(hostsIn('write to bob@example.com about it'), [])
  })
})

// The command itself, against a throwaway repository, in both directions.
describe('lint-private-refs.mjs', () => {
  const script = fileURLToPath(new URL('../scripts/lint-private-refs.mjs', import.meta.url))

  const run = (files) => {
    const root = mkdtempSync(path.join(tmpdir(), 'private-refs-'))
    try {
      execFileSync('git', ['init', '--quiet', root], { env: gitEnv() })
      for (const [name, text] of Object.entries(files)) {
        writeFileSync(path.join(root, name), text)
      }
      execFileSync('git', ['-C', root, 'add', '.'], { env: gitEnv() })
      try {
        return {
          code: 0,
          out: execFileSync(process.execPath, [script, root], {
            encoding: 'utf8',
            env: gitEnv(),
          }),
        }
      } catch (error) {
        return { code: error.status, out: `${error.stdout}${error.stderr}` }
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  test('fails and names the file and host for a private URL', () => {
    const { code, out } = run({ 'README.md': 'Clone https://gitlab.example.local/a.git\n' })
    assert.equal(code, 1)
    assert.match(out, /README\.md:1: gitlab\.example\.local/)
  })

  test('passes a repository with only public and local hosts', () => {
    const { code, out } = run({
      'README.md': 'See https://druxtjs.org and http://localhost:8888\n',
    })
    assert.equal(code, 0)
    assert.match(out, /No private hosts referenced by tracked files\./)
  })

  // npm run lint:private runs from the pre-commit hook, which exports GIT_DIR
  // at the repository being committed. Without the scrub, git reads that index
  // here and the lint reports on a repository it was never pointed at.
  test('trackedFiles reads the repository it was handed, not an ambient GIT_DIR', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'private-refs-'))
    const decoy = mkdtempSync(path.join(tmpdir(), 'private-refs-decoy-'))
    const before = process.env.GIT_DIR
    try {
      execFileSync('git', ['init', '--quiet', root], { env: gitEnv() })
      writeFileSync(path.join(root, 'README.md'), 'See https://druxtjs.org\n')
      execFileSync('git', ['-C', root, 'add', '.'], { env: gitEnv() })
      execFileSync('git', ['init', '--quiet', decoy], { env: gitEnv() })
      process.env.GIT_DIR = path.join(decoy, '.git')
      assert.deepEqual(trackedFiles(root), ['README.md'])
    } finally {
      if (before === undefined) {
        delete process.env.GIT_DIR
      } else {
        process.env.GIT_DIR = before
      }
      rmSync(root, { recursive: true, force: true })
      rmSync(decoy, { recursive: true, force: true })
    }
  })

  // The same trap one level up: the fixture is built with git, so an exported
  // GIT_DIR would send git init and git add to the repository being committed.
  test('builds its fixture in the temporary directory, not in an ambient GIT_DIR', () => {
    const decoy = mkdtempSync(path.join(tmpdir(), 'private-refs-decoy-'))
    const before = process.env.GIT_DIR
    try {
      execFileSync('git', ['init', '--quiet', decoy], { env: gitEnv() })
      process.env.GIT_DIR = path.join(decoy, '.git')
      const { code, out } = run({ 'README.md': 'Clone https://gitlab.example.local/a.git\n' })
      assert.equal(code, 1)
      assert.match(out, /README\.md:1: gitlab\.example\.local/)
      assert.deepEqual(trackedFiles(decoy), [])
    } finally {
      if (before === undefined) {
        delete process.env.GIT_DIR
      } else {
        process.env.GIT_DIR = before
      }
      rmSync(decoy, { recursive: true, force: true })
    }
  })
})
