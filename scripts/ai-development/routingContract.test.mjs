import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = relative => readFileSync(path.join(root, relative), 'utf8')
const routing = read('docs/ai-development/SKILL_ROUTING.md')

test('one canonical route table names all six domains and four impact levels', () => {
  const domains = ['Frontend / UI / GSAP', 'Scientific data processing', 'Database / API', 'AI model development', 'Software fault diagnosis', 'Deployment / CI']
  for (const [index, name] of domains.entries()) {
    assert.equal(routing.split(`**${index + 1}. ${name}:**`).length - 1, 1, name)
  }
  for (const level of ['L1 light', 'L2 standard', 'L3 complex', 'L4 high risk']) {
    assert.equal(routing.split(`**${level}**`).length - 1, 1, level)
  }
  assert.match(read('AGENTS.md'), /docs\/ai-development\/SKILL_ROUTING\.md/)
  assert.match(read('docs/ai-development/UNIFIED_SKILL_ROUTING.md'), /canonical.*SKILL_ROUTING\.md/i)
  assert.match(routing, /Superpowers as the sole primary process/)
})

test('project scientific skill references resolve to named files and fallback retains gates', () => {
  for (const name of ['flavor-gcms-processing', 'flavor-statistical-analysis', 'flavor-ml-validation', 'flavor-scientific-visualization', 'flavor-data-integrity']) {
    const content = read(`.agents/skills/${name}/SKILL.md`)
    assert.match(content, new RegExp(`^---\\r?\\nname: ${name}\\r?\\n`))
    assert.ok(routing.includes(`\`${name}\``), name)
  }
  assert.match(routing, /A missing Skill does not remove its acceptance gate/)
  assert.match(routing, /not proof of a platform-level automatic dispatcher/)
})
