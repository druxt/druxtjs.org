import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// The form's source order is its Tab order, so it is asserted on the source.
const form = readFileSync(new URL('../nuxt/components/app/SignInForm.vue', import.meta.url), 'utf8')
const at = (text) => {
  const index = form.indexOf(text)
  assert.notEqual(index, -1, `${text} is in the form`)
  return index
}

describe('the sign-in form', () => {
  it('puts the password field before the forgot-password link, so Tab reaches the field first', () => {
    assert.ok(at('id="sign-in-pass"') < at('Forgot password?'))
    assert.ok(at('Forgot password?') < at('id="sign-in-error"'))
  })

  it('orders the error after the field it describes', () => {
    assert.match(form, /id="sign-in-error" class="sign-in-error order-4 w-full"/)
  })
})
