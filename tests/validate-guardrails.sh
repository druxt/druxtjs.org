#!/usr/bin/env bash
# Guards scripts/validate-content.mjs in both directions: a content set that
# matches its source passes, and every kind of shortfall fails naming what
# is short. A gate that only ever fails is as useless as one that only ever
# passes, so the passing case comes first.
#
# The fixture is a two-page corpus written by this test: a source checkout,
# its IR, its baseline and the Tome export a correct import would produce.
# Needs node, git and bash. No Drupal.

set -uo pipefail

cd "$(dirname "$0")/.."

readonly REPO_ROOT="$PWD"
readonly VALIDATE="$REPO_ROOT/scripts/validate-content.mjs"

pass=0
fail=0

ok() {
  printf '[ OK ] %s\n' "$1"
  pass=$((pass + 1))
}

no() {
  printf '[FAIL] %s\n' "$1"
  fail=$((fail + 1))
}

crashed() {
  printf '%s' "$1" | grep -qE 'Error:|at .*\.mjs:[0-9]+|command not found'
}

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

# Writes a complete, consistent fixture and prints its directory.
fixture() {
  local dir="$scratch/fixture-$RANDOM"
  mkdir -p "$dir"
  node - "$dir" <<'EOF'
const { mkdirSync, writeFileSync } = require('node:fs')
const path = require('node:path')

const root = process.argv[2]
const write = (file, data) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n')
}

const CONTENT = 'docs/nuxt/content'
const uuid = (n) => `00000000-0000-5000-8000-${String(n).padStart(12, '0')}`
const ref = (type, id) => [{ target_type: type, target_uuid: id }]
const val = (v) => [{ value: v }]

// The source checkout: two pages in two sections.
write(`source/${CONTENT}/how-to/proxy.md`, [
  '---',
  'title: Proxy',
  "description: 'It''s a proxy'",
  'weight: 3',
  '---',
  '',
  'Proxy requests through Nuxt.',
  '',
  '```js',
  'export default { proxy: true }',
  '```',
  '',
  '::alert{type="prerequisite"}',
  'A running backend.',
  '::',
  '',
  '![A diagram](/images/proxy.png)',
  '',
  '```mermaid',
  'graph LR; A-->B',
  '```',
  '',
].join('\n'))
write(`source/${CONTENT}/tutorials/README.md`, [
  '---',
  'title: Tutorials',
  'description: Start here',
  '---',
  '',
  'Learn by doing.',
  '',
  '```sh',
  'npm install',
  '```',
  '',
  '::alert{type="output"}',
  'Installed.',
  '::',
  '',
].join('\n'))

// The IR the builder would produce for those two pages.
const proxyBlocks = [
  { type: 'text', markdown: 'Proxy requests through Nuxt.' },
  { type: 'code', language: 'js', code: 'export default { proxy: true }' },
  { type: 'callout', callout: 'prerequisite', markdown: 'A running backend.' },
  { type: 'image', src: '/images/proxy.png', alt: 'A diagram' },
  { type: 'diagram', syntax: 'mermaid', source: 'graph LR; A-->B' },
]
const tutorialsBlocks = [
  { type: 'text', markdown: 'Learn by doing.' },
  { type: 'code', language: 'sh', code: 'npm install' },
  { type: 'callout', callout: 'output', markdown: 'Installed.' },
]
write('ir/how-to__proxy.json', { source: `${CONTENT}/how-to/proxy.md`, section: 'how-to', isLanding: false, title: 'Proxy', blocks: proxyBlocks })
write('ir/tutorials__index.json', { source: `${CONTENT}/tutorials/README.md`, section: 'tutorials', isLanding: true, title: 'Tutorials', blocks: tutorialsBlocks })

write('baseline.json', {
  totals: { pages: 2, sections: 2, distinctImages: 1 },
  bySection: { 'how-to': 1, tutorials: 1 },
  blockKinds: { paragraph: 2, code: 2, callout: 1, output: 1, image: 1, diagram: 1 },
  fenceLanguages: { js: 1, sh: 1, mermaid: 1 },
  pages: [
    { file: `${CONTENT}/how-to/proxy.md`, section: 'how-to', isLanding: false },
    { file: `${CONTENT}/tutorials/README.md`, section: 'tutorials', isLanding: true },
  ],
})

// The Tome export a correct import produces from that IR.
const entities = {}
const term = (n, name, slug) => {
  entities[`taxonomy_term.${uuid(n)}`] = {
    uuid: val(uuid(n)),
    vid: [{ target_id: 'documentation_section', target_type: 'taxonomy_vocabulary' }],
    name: val(name),
    description: [{ value: slug, format: 'plain_text' }],
  }
  return uuid(n)
}
const paragraph = (n, bundle, fields) => {
  entities[`paragraph.${uuid(n)}`] = { uuid: val(uuid(n)), type: [{ target_id: bundle, target_type: 'paragraphs_type' }], ...fields }
  return uuid(n)
}
const howTo = term(1, 'How-to guides', 'how-to')
const tutorials = term(2, 'Tutorials', 'tutorials')

entities[`file.${uuid(90)}`] = { uuid: val(uuid(90)), uri: val('public://proxy.png'), filename: val('proxy.png') }
entities[`media.${uuid(91)}`] = {
  uuid: val(uuid(91)),
  bundle: [{ target_id: 'image', target_type: 'media_type' }],
  field_media_image: [{ alt: 'A diagram', target_type: 'file', target_uuid: uuid(90) }],
}
write('files/public/proxy.png', 'not really a png')

const proxyParagraphs = [
  paragraph(10, 'docs_text', { field_text: [{ value: 'Proxy requests through Nuxt.', format: 'markdown' }] }),
  paragraph(11, 'docs_code', { field_language: val('js'), field_code: val('export default { proxy: true }') }),
  paragraph(12, 'docs_callout', { field_callout_type: val('prerequisite'), field_callout: [{ value: 'A running backend.', format: 'markdown' }] }),
  paragraph(13, 'docs_image', { field_media: ref('media', uuid(91)) }),
  paragraph(14, 'docs_diagram', { field_syntax: val('mermaid'), field_diagram: val('graph LR; A-->B') }),
]
const tutorialsParagraphs = [
  paragraph(20, 'docs_text', { field_text: [{ value: 'Learn by doing.', format: 'markdown' }] }),
  paragraph(21, 'docs_code', { field_language: val('sh'), field_code: val('npm install') }),
  paragraph(22, 'docs_callout', { field_callout_type: val('output'), field_callout: [{ value: 'Installed.', format: 'markdown' }] }),
]
entities[`node.${uuid(30)}`] = {
  uuid: val(uuid(30)),
  type: [{ target_id: 'doc_page', target_type: 'node_type' }],
  title: val('Proxy'),
  field_description: val("It's a proxy"),
  field_weight: val(3),
  field_is_landing: val(false),
  field_source_path: val(`${CONTENT}/how-to/proxy.md`),
  field_section: ref('taxonomy_term', howTo),
  field_content: proxyParagraphs.map((id) => ({ target_type: 'paragraph', target_uuid: id })),
}
entities[`node.${uuid(31)}`] = {
  uuid: val(uuid(31)),
  type: [{ target_id: 'doc_page', target_type: 'node_type' }],
  title: val('Tutorials'),
  field_description: val('Start here'),
  field_is_landing: val(true),
  field_source_path: val(`${CONTENT}/tutorials/README.md`),
  field_section: ref('taxonomy_term', tutorials),
  field_content: tutorialsParagraphs.map((id) => ({ target_type: 'paragraph', target_uuid: id })),
}

const index = {}
for (const [key, entity] of Object.entries(entities)) {
  write(`content/${key}.json`, entity)
  index[key] = []
}
write('content/meta/index.json', index)
EOF
  git -C "$dir/source" init -q
  git -C "$dir/source" add -A
  git -C "$dir/source" -c user.name=test -c user.email=test@example.com commit -q -m fixture
  # The baseline records the commit it measured, which only exists now.
  node -e '
const fs = require("fs"); const f = process.argv[1]
const baseline = JSON.parse(fs.readFileSync(f)); baseline.ref = process.argv[2]
fs.writeFileSync(f, JSON.stringify(baseline, null, 2) + "\n")' "$dir/baseline.json" "$(git -C "$dir/source" rev-parse HEAD)"
  printf '%s' "$dir"
}

# The corpus half of the gate: the three checks that compare the IR against
# the checkout and the baseline, with no entity data involved. Run on their
# own before an import, so they can catch a build that produced fewer
# documents than the corpus has pages.
run_corpus() {
  local dir="$1"
  timeout 60 node "$VALIDATE" --corpus --root "$dir" --ir ir --source source --baseline baseline.json 2>&1
}

run_validate() {
  local dir="$1"
  timeout 60 node "$VALIDATE" --root "$dir" --content content --files files --ir ir --source source --baseline baseline.json 2>&1
}

assert_pass() {
  local label="$1" output="$2" status="$3"
  if crashed "$output"; then
    no "$label: crashed; this run proves nothing either way"
    printf '%s\n' "$output" | sed 's/^/       /'
  elif printf '%s' "$output" | grep -q '^\[FAIL\]'; then
    no "$label: a check failed on a matching content set"
    printf '%s\n' "$output" | grep '^\[FAIL\]' | sed 's/^/       /'
  elif [ "$status" -ne 0 ]; then
    no "$label: no check failed but exited $status"
  elif printf '%s' "$output" | grep -qE '^[1-9][0-9]* of [1-9][0-9]* checks passed'; then
    ok "$label: every check passed, exited 0"
  else
    no "$label: exited 0 without reporting a check count"
    printf '%s\n' "$output" | sed 's/^/       /'
  fi
}

assert_fail() {
  local label="$1" output="$2" status="$3" expected="$4"
  if crashed "$output"; then
    no "$label: crashed rather than failing; this run proves nothing either way"
    printf '%s\n' "$output" | sed 's/^/       /'
  elif ! printf '%s' "$output" | grep -q -- "$expected"; then
    no "$label: did not report the shortfall"
    printf '%s\n' "$output" | sed 's/^/       /'
  elif [ "$status" -eq 0 ]; then
    no "$label: reported the shortfall but exited 0"
  else
    ok "$label: failed, named the shortfall, exited non-zero"
  fi
}

# --------------------------------------------------------------------------
# A content set that matches its source passes.
# --------------------------------------------------------------------------

dir="$(fixture)"
output="$(run_validate "$dir")"
assert_pass "complete content set" "$output" $?

# --------------------------------------------------------------------------
# Nothing exported fails on the page count, not for want of errors.
# --------------------------------------------------------------------------

dir="$(fixture)"
rm -rf "$dir/content" "$dir/files"
mkdir -p "$dir/content"
output="$(run_validate "$dir")"
assert_fail "empty content set" "$output" $? "pages.count: expected 2 pages, found 0"

dir="$(fixture)"
rm "$dir"/content/node.*000000000031.json
output="$(run_validate "$dir")"
assert_fail "one page short" "$output" $? "pages.count: expected 2 pages, found 1"
if printf '%s' "$output" | grep -q "missing: docs/nuxt/content/tutorials/README.md"; then
  ok "the missing page is named"
else
  no "the missing page is not named"
fi

# --------------------------------------------------------------------------
# The baseline has to have been measured at the commit being checked.
# --------------------------------------------------------------------------

dir="$(fixture)"
sed -i 's/"ref": "\([0-9a-f]\{8\}\)[0-9a-f]*"/"ref": "\1000000000000000000000000000000000000"/' "$dir/baseline.json"
output="$(run_validate "$dir")"
assert_fail "baseline measured at another commit" "$output" $? '\[FAIL\] corpus.ref: baseline measured at'

# --------------------------------------------------------------------------
# What Tome installs is the index, so it has to match the files.
# --------------------------------------------------------------------------

dir="$(fixture)"
node -e '
const fs = require("fs"); const f = process.argv[1]
const index = JSON.parse(fs.readFileSync(f)); index["taxonomy_term.deadbeef-0000-4000-8000-000000000000"] = []
fs.writeFileSync(f, JSON.stringify(index))' "$dir/content/meta/index.json"
output="$(run_validate "$dir")"
assert_fail "index entry without a file" "$output" $? "indexed, no file: taxonomy_term.deadbeef"

# --------------------------------------------------------------------------
# Values are compared, not just counted.
# --------------------------------------------------------------------------

dir="$(fixture)"
sed -i 's/export default { proxy: true }/export default { proxy: true } /' "$dir"/content/paragraph.*000000000011.json
output="$(run_validate "$dir")"
assert_fail "one byte changed in a code block" "$output" $? "how-to/proxy.md block 2 (code): code differs"

dir="$(fixture)"
sed -i 's/"Proxy"/"Proxies"/' "$dir"/content/node.*000000000030.json
output="$(run_validate "$dir")"
assert_fail "title differs from the frontmatter" "$output" $? 'how-to/proxy.md: title "Proxies" != "Proxy"'

dir="$(fixture)"
sed -i 's/"prerequisite"/"output"/' "$dir"/content/paragraph.*000000000012.json
output="$(run_validate "$dir")"
assert_fail "callout of the wrong type" "$output" $? "how-to/proxy.md block 3 (callout): callout differs"

dir="$(fixture)"
sed -i 's/"A diagram"/"A picture"/' "$dir"/content/media.*000000000091.json
output="$(run_validate "$dir")"
assert_fail "image alt text differs" "$output" $? 'alt "A picture" != "A diagram"'

dir="$(fixture)"
rm "$dir/files/public/proxy.png"
output="$(run_validate "$dir")"
assert_fail "image file missing from the files directory" "$output" $? "proxy.png not in"

dir="$(fixture)"
node -e '
const fs = require("fs"); const f = process.argv[1]
const node = JSON.parse(fs.readFileSync(f)); node.field_is_landing = [{ value: false }]
fs.writeFileSync(f, JSON.stringify(node))' "$dir"/content/node.*000000000031.json
output="$(run_validate "$dir")"
assert_fail "landing page not flagged" "$output" $? "tutorials/README.md: is a landing page"

# --------------------------------------------------------------------------
# The corpus checks, which run before anything is imported. The import
# asserts its page count against the IR document count, and both come from
# the same build, so these are what notices a build that lost a page.
# --------------------------------------------------------------------------

dir="$(fixture)"
output="$(run_corpus "$dir")"
assert_pass "corpus matches the checkout" "$output" $?

dir="$(fixture)"
rm "$dir"/ir/*.json
output="$(run_corpus "$dir")"
assert_fail "corpus with no documents" "$output" $? "0 IR documents for 2 tracked pages"

dir="$(fixture)"
rm "$(ls "$dir"/ir/*.json | head -1)"
output="$(run_corpus "$dir")"
assert_fail "corpus one document short" "$output" $? "1 IR documents for 2 tracked pages"

# The corpus checks must not need the content directory, or they cannot run
# before the import.
dir="$(fixture)"
rm -rf "$dir/content" "$dir/files"
output="$(run_corpus "$dir")"
assert_pass "corpus checks without a content directory" "$output" $?

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
