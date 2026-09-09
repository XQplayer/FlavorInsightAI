import assert from 'node:assert/strict'
import test from 'node:test'

import { formatSentenceCaseEnglishName } from './compoundNameFormat.js'

test('formats a chemical English name with only its first letter capitalized', () => {
  assert.equal(formatSentenceCaseEnglishName('ETHYL HEPTANOATE'), 'Ethyl heptanoate')
  assert.equal(formatSentenceCaseEnglishName('ethyl acetate'), 'Ethyl acetate')
})
