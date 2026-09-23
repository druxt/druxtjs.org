// normaliseDiff re-pairs a rebuilt draft (every paragraph recreated with a new
// uuid, so the diff reports whole removals and additions) into changed blocks a
// field wrapper can diff in place. The key property: a paired block is keyed on
// the added (rendered) uuid, because that is the paragraph on the working-copy
// page.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

// The package, which the repository installs from `nuxt/vendor` until it is
// published, so the tests read the same engine the frontend does.
const { normaliseDiff, wordDiff, groupRuns, condenseRuns, anchorUuid } = await import(
  '@druxt-contrib/diff'
)

/** A jsonapi_diff document: a node whose field_content children are listed. */
const doc = (children) => ({
  data: {
    id: 'node:10:20',
    type: 'jsonapi_diff--diff',
    attributes: { fields: {} },
    relationships: { children: { data: children.map((c) => ({ id: c.id, meta: c.meta })) } },
  },
  included: children.map((c) => ({
    id: c.id,
    type: 'jsonapi_diff--diff',
    attributes: { fields: c.fields || {} },
  })),
})

const removed = (uuid, delta, fields) => ({
  id: `${uuid}:${100 + delta}:`,
  meta: { field: 'field_content', left_delta: delta, right_delta: null, status: 'removed' },
  fields,
})
const added = (uuid, delta, fields) => ({
  id: `${uuid}::${200 + delta}`,
  meta: { field: 'field_content', left_delta: null, right_delta: delta, status: 'added' },
  fields,
})
const textField = (side, value) => ({
  field_text: {
    label: 'Text',
    status: side === 'left' ? 'removed' : 'added',
    left: side === 'left' ? value : '',
    right: side === 'right' ? value : '',
    ops: [],
  },
})

describe('normaliseDiff re-pairs a rebuilt draft', () => {
  test('an edited paragraph becomes one changed block keyed on the added uuid', () => {
    const result = normaliseDiff(
      doc([
        removed('old-0', 0, {}), // identical paragraph, no changed fields
        removed('old-1', 1, textField('left', 'the quick brown fox jumps over')),
        added('new-0', 0, {}),
        added('new-1', 1, textField('right', 'the quick red fox jumps over')),
      ])
    )

    assert.equal(result.rebuilt, false, 'a resolved pairing is not a rebuild')
    assert.equal(result.summary.changed, 1)
    assert.equal(result.summary.same, 1)
    assert.equal(result.summary.added, 0)
    assert.equal(result.summary.removed, 0)

    const changed = result.blocks.filter((b) => b.status === 'changed')
    assert.equal(changed.length, 1)
    assert.equal(
      changed[0].uuid,
      'new-1',
      'keyed on the rendered (added) uuid, not the removed one'
    )
    const field = changed[0].fields.find((f) => f.name === 'field_text')
    assert.equal(field.left, 'the quick brown fox jumps over')
    assert.equal(field.right, 'the quick red fox jumps over')
  })

  test('unrelated add and remove that do not read as the same block stay a rebuild', () => {
    const result = normaliseDiff(
      doc([
        removed('old-0', 0, textField('left', 'alpha beta gamma delta epsilon')),
        added('new-0', 0, textField('right', 'nothing at all resembling the other')),
      ])
    )
    assert.equal(result.rebuilt, true, 'dissimilar content is not paired')
    assert.equal(result.summary.changed, 0)
    assert.equal(result.summary.added, 1)
    assert.equal(result.summary.removed, 1)
  })

  test('a real removal with no added counterpart stays removed', () => {
    const result = normaliseDiff(
      doc([removed('old-0', 0, textField('left', 'a paragraph that was deleted from the draft'))])
    )
    assert.equal(result.summary.removed, 1)
    assert.equal(result.summary.changed, 0)
  })
})

describe('removed-block placement', () => {
  const survivorText = (side) =>
    textField(side, 'the config value is set in services.yml under cors')
  const changed = (side) =>
    textField(
      side,
      side === 'left' ? 'old wording of the paragraph here' : 'new wording of the paragraph here'
    )

  test('a deleted paragraph anchors after its surviving predecessor', () => {
    const result = normaliseDiff(
      doc([
        removed('old-0', 0, survivorText('left')),
        removed(
          'gone-1',
          1,
          textField('left', 'this whole paragraph is being deleted from the draft')
        ),
        removed('old-2', 2, changed('left')),
        added('new-0', 0, survivorText('right')),
        added('new-2', 2, changed('right')),
      ])
    )
    const gone = result.blocks.find((b) => b.status === 'removed')
    assert.ok(gone, 'the unpaired paragraph stays removed')
    assert.equal(
      gone.placeAfter,
      'new-0',
      'anchored after the surviving predecessor (rendered uuid)'
    )
    assert.equal(gone.placeBefore, undefined)
  })

  test('a paragraph deleted from the top anchors before its surviving successor', () => {
    const result = normaliseDiff(
      doc([
        removed(
          'gone-0',
          0,
          textField('left', 'a leading paragraph that the draft dropped entirely')
        ),
        removed('old-1', 1, survivorText('left')),
        added('new-1', 1, survivorText('right')),
      ])
    )
    const gone = result.blocks.find((b) => b.status === 'removed')
    assert.equal(gone.placeAfter, undefined)
    assert.equal(gone.placeBefore, 'new-1', 'anchored before the surviving successor')
  })
})

describe('groupRuns', () => {
  test('reorders a change region to all removals then all additions', () => {
    const grouped = groupRuns([
      { type: '-', text: 'enables ' },
      { type: '+', text: 'supplies ' },
      { type: '-', text: 'when ' },
      { type: '+', text: 'settings' },
    ])
    assert.deepEqual(grouped, [
      { type: '-', text: 'enables when ' },
      { type: '+', text: 'supplies settings' },
    ])
  })

  test('keeps common runs as boundaries between regions', () => {
    const grouped = groupRuns([
      { type: '=', text: 'the ' },
      { type: '-', text: 'old' },
      { type: '+', text: 'new' },
      { type: '=', text: ' word' },
    ])
    assert.deepEqual(
      grouped.map((r) => r.type),
      ['=', '-', '+', '=']
    )
  })
})

describe('condenseRuns', () => {
  test('trims a long trailing unchanged run to leading context with an ellipsis', () => {
    const tail =
      'a very long unchanged trailing paragraph that should be cut down to only its first words for the panel'
    const [change, same] = condenseRuns(
      [
        { type: '+', text: 'added' },
        { type: '=', text: tail },
      ],
      30
    )
    assert.equal(change.text, 'added', 'changes are never trimmed')
    assert.ok(same.text.endsWith('…'), 'trailing context ends with an ellipsis')
    assert.ok(same.text.length < tail.length)
  })

  test('leaves a wholly unchanged field alone', () => {
    const runs = [{ type: '=', text: 'nothing changed here at all in this field' }]
    assert.deepEqual(condenseRuns(runs, 10), runs)
  })
})

describe('wordDiff', () => {
  test('marks the substituted word and keeps the common ones', () => {
    const runs = wordDiff('the quick brown fox', 'the quick red fox')
    const removedRun = runs.find((r) => r.type === '-')
    const addedRun = runs.find((r) => r.type === '+')
    assert.match(removedRun.text, /brown/)
    assert.match(addedRun.text, /red/)
    assert.ok(runs.some((r) => r.type === '=' && /fox/.test(r.text)))
  })
})

// The page renders one side of the comparison. This site rebuilds its
// paragraphs on every import, so the two sides are different entities and only
// the rendered side's uuid is in the markup: the anchor has to follow it.
describe('the vendored engine names both sides of a block', () => {
  const positional = (leftUuid, rightUuid) => ({
    data: {
      id: 'node:28:27',
      type: 'jsonapi_diff--diff',
      attributes: { fields: {} },
      relationships: {
        children: {
          data: [
            {
              id: `${leftUuid}:79:431`,
              meta: {
                field: 'field_content',
                left_delta: 0,
                right_delta: 0,
                status: 'same',
                match: 'position',
              },
            },
          ],
        },
      },
    },
    included: [
      {
        id: `${leftUuid}:79:431`,
        type: 'jsonapi_diff--diff',
        attributes: {
          fields: {
            field_text: {
              label: 'Text',
              status: 'changed',
              left: 'the table and a closing section',
              right: 'the table',
              ops: [],
            },
          },
        },
        relationships: {
          left: { data: { type: 'paragraph--docs_text', id: leftUuid } },
          right: { data: { type: 'paragraph--docs_text', id: rightUuid } },
        },
      },
    ],
  })

  test('an old revision is anchored by the uuid the page rendered', () => {
    const [block] = normaliseDiff(positional('in-live', 'in-revision')).blocks
    assert.equal(block.status, 'changed')
    assert.equal(anchorUuid(block, 'right'), 'in-revision')
  })
})
