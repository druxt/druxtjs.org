import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { accountOf, hueOf, initials, roleLabel, signInError } = (
  await import('../nuxt/lib/account.js')
).default

describe('initials', () => {
  it('takes the first and last words', () => {
    assert.equal(initials('Stuart Clark'), 'SC')
    assert.equal(initials('Ada King Lovelace'), 'AL')
  })

  it('splits usernames on dots, dashes and underscores', () => {
    assert.equal(initials('stuart-clark'), 'SC')
    assert.equal(initials('demo_editor'), 'DE')
  })

  it('is one letter for one word, and ? for nothing', () => {
    assert.equal(initials('Madonna'), 'M')
    assert.equal(initials(''), '?')
    assert.equal(initials(undefined), '?')
  })
})

describe('hueOf', () => {
  it('keeps a user on one of three hues', () => {
    assert.deepEqual(['1', '2', '3', 4].map(hueOf), [1, 2, 0, 1])
  })

  it('falls back to the first for a missing id', () => {
    assert.equal(hueOf(undefined), 0)
    assert.equal(hueOf('abc'), 0)
  })
})

describe('roleLabel', () => {
  it('names the most privileged role', () => {
    assert.equal(roleLabel(['contributor', 'editor']), 'Editor')
    assert.equal(roleLabel(['administrator', 'editor']), 'Admin')
    assert.equal(roleLabel(['contributor']), 'Contributor')
  })

  it('names nothing for no role worth naming', () => {
    assert.equal(roleLabel([]), null)
    assert.equal(roleLabel(['authenticated']), null)
    assert.equal(roleLabel(undefined), null)
  })
})

describe('accountOf', () => {
  it('reads the userinfo claims', () => {
    assert.deepEqual(
      accountOf({
        sub: '3',
        name: 'demo-editor',
        preferred_username: 'demo-editor',
        email: 'demo-editor@example.com',
        picture: 'http://127.0.0.1:8921/sites/default/files/styles/thumbnail/p.png?itok=x',
        roles: ['editor'],
      }),
      {
        id: '3',
        name: 'demo-editor',
        username: 'demo-editor',
        email: 'demo-editor@example.com',
        picture: '/sites/default/files/styles/thumbnail/p.png?itok=x',
        initials: 'DE',
        hue: 0,
        role: 'Editor',
      }
    )
  })

  it('stands up without claims', () => {
    const account = accountOf(undefined)
    assert.equal(account.name, 'Signed in')
    assert.equal(account.picture, null)
    assert.equal(account.email, null)
    assert.equal(account.id, null)
  })
})

describe('signInError', () => {
  it('never says which half of the credentials was wrong', () => {
    const message = signInError(400, 'Sorry, unrecognized username or password.')
    assert.equal(message, "That username and password don't match an account.")
    assert.doesNotMatch(message, /username is|password is/i)
  })

  it('names flood control and blocked accounts', () => {
    assert.match(
      signInError(
        403,
        'There have been more than 5 failed login attempts for this account. It is temporarily blocked.'
      ),
      /Too many/
    )
    assert.match(
      signInError(403, 'The user has not been activated or is blocked.'),
      /can't sign in/
    )
  })

  it('treats a missing or server answer as unreachable', () => {
    assert.match(signInError(undefined), /couldn't be reached/)
    assert.match(signInError(502, 'Bad gateway'), /couldn't be reached/)
  })
})
