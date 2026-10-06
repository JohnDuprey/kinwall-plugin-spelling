// node --test   "Apply the rule": the suffix rules, categories, the base-word bank and sessions.
const test = require('node:test')
const assert = require('node:assert/strict')
const R = require('../rules.js')
const W = require('../words.js')

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

// [base, suffix, word, rule]
const CASES = `
hop ing hopping double | swim ing swimming double | quit ing quitting double | drip ing dripping double
shop ing shopping double | run ing running double | yap ing yapping double | quiz ing quizzing double
hope ing hoping drop-e | give ing giving drop-e | dance ing dancing drop-e | ride ing riding drop-e
smile ing smiling drop-e | giggle ing giggling drop-e | use ing using drop-e
see ing seeing just-add | dye ing dyeing just-add | toe ing toeing just-add | agree ing agreeing just-add
jump ing jumping just-add | wink ing winking just-add | sleep ing sleeping just-add | rain ing raining just-add
cry ing crying just-add | play ing playing just-add | snow ing snowing just-add | fix ing fixing just-add
visit ing visiting just-add | open ing opening just-add | dress ing dressing just-add | buy ing buying just-add
lie ing lying ie-y | tie ing tying ie-y
hop ed hopped double | plan ed planned double | bake ed baked drop-e | free ed freed drop-e
cry ed cried y-to-i | carry ed carried y-to-i | play ed played just-add | jump ed jumped just-add | fix ed fixed just-add
big er bigger double | hot est hottest double | nice er nicer drop-e | late est latest drop-e
happy er happier y-to-i | easy est easiest y-to-i | gray er grayer just-add | tall est tallest just-add | slow er slower just-add
cat s cats just-add | hope s hopes just-add | toy s toys just-add | box s boxes es | wish s wishes es
bench s benches es | bus s buses es | quiz s quizes es | baby s babies y-to-i | fly s flies y-to-i | day s days just-add
`.trim().split(/\s*[|\n]\s*/).map(c => c.split(' '))

test('form: adds each suffix by its rule', () => {
  for (const [base, suffix, word, rule] of CASES) {
    if (word === 'quizes') continue // quiz + es doubles the z: a known exception, not in the bank
    assert.deepEqual(R.form(base, suffix), { word, rule }, `${base} + ${suffix}`)
  }
})

test('doubles: one syllable, short vowel, one last consonant, never w x y', () => {
  for (const w of ['hop', 'swim', 'quit', 'stop', 'big', 'yap']) assert.ok(R.doubles(w), w)
  for (const w of ['snow', 'fix', 'play', 'jump', 'rain', 'visit', 'open', 'begin', 'see', 'up']) assert.ok(!R.doubles(w), w)
})

test('analyze: finds the base and rule of a list word', () => {
  for (const [base, suffix, word, rule] of CASES) {
    if (['quizes', 'quizzing', 'buses', 'freed', 'toeing', 'dyeing'].includes(word)) continue // read another way (like buzz), fine
    assert.deepEqual(R.analyze(word), { base, suffix, rule }, word)
  }
  assert.equal(R.analyze('Swimming').base, 'swim')
  for (const w of ['friend', 'the', 'said', 'bring', 'string', 'thing', "don't", '']) assert.equal(R.analyze(w), null, w)
})

test('analyze prefers the category rule when a word reads two ways', () => {
  assert.equal(R.analyze('jumping').rule, 'just-add')
  assert.equal(R.analyze('jumping', 'drop-e').base, 'jumpe')
})

test('textRule and textSuffix read a teacher\'s headings', () => {
  assert.equal(R.textRule('Double the consonant'), 'double')
  assert.equal(R.textRule('Single-syllable words with a short vowel: double the last consonant, then add -ing.'), 'double')
  assert.equal(R.textRule('Drop the e, then add -ing'), 'drop-e')
  assert.equal(R.textRule('Just add -ing'), 'just-add')
  assert.equal(R.textRule('Change the y to i and add -ed'), 'y-to-i')
  assert.equal(R.textRule('Add -es'), 'es')
  assert.equal(R.textRule('Short a'), null)
  assert.equal(R.textSuffix('Drop the e, then add -ing'), 'ing')
  assert.equal(R.textSuffix('Add -es'), 's')
  assert.equal(R.textSuffix('Double the consonant'), null)
})

test('categoryRule: from the name and rule text, else most of the words', () => {
  const june = [
    [{ name: 'Double the consonant', rule: 'Single-syllable words with a short vowel: double the last consonant, then add -ing.' }, ['swimming', 'quitting', 'dripping', 'shopping'], 'ing-double'],
    [{ name: 'Drop the e, then add -ing' }, ['giving', 'hoping', 'dancing'], 'ing-drop-e'],
    [{ name: 'Just add -ing' }, ['jumping', 'winking', 'sleeping'], 'ing-just-add'],
  ]
  for (const [cat, words, id] of june) assert.equal(R.categoryRule(cat, words), id, cat.name)
  // No helpful name: the words decide.
  assert.equal(R.categoryRule({ name: 'Group 1' }, ['hopped', 'planned', 'clapped', 'jumped']), 'ed-double')
  assert.equal(R.categoryRule({ name: 'Group 2' }, ['babies', 'cities', 'boxes']), 's-y-to-i')
  assert.equal(R.categoryRule({ name: 'Group 3' }, ['happier', 'funnier', 'tallest']), 'er-y-to-i')
  // Not a suffix rule, or not enough words agree: no Apply questions.
  assert.equal(R.categoryRule({ name: 'Short a' }, ['cat', 'map', 'hat']), null)
  assert.equal(R.categoryRule({ name: 'Double letters' }, ['little', 'rabbit', 'happy']), null)
  assert.equal(R.categoryRule({ name: 'Mixed' }, ['hopping', 'friend', 'said', 'because']), null)
  assert.equal(R.categoryRule({ name: 'Lie and tie' }, ['lying', 'tying']), null) // no bank for ie → y
})

test('tagList: every category gets its rule id, worked out again each time', () => {
  const list = { id: 'x', words: [{ w: 'hopping', c: 0 }, { w: 'giving', c: 1 }, { w: 'cat', c: 2 }], categories: [{ name: 'Double the consonant' }, { name: 'Drop the e, then add -ing', ruleId: 'stale' }, { name: 'Short a', ruleId: 'ing-double' }] }
  const tagged = R.tagList(list)
  assert.deepEqual(tagged.categories.map(c => c.ruleId), ['ing-double', 'ing-drop-e', undefined])
  assert.deepEqual(R.tagList(tagged), tagged)
  const plain = { id: 'y', words: [{ w: 'friend' }] }
  assert.equal(R.tagList(plain), plain)
})

test('the bank: every base takes its rule, no repeats, and analyze reads each word back', () => {
  for (const [suffix, rules] of Object.entries(R.BANK)) {
    for (const [rule, bases] of Object.entries(rules)) {
      assert.equal(new Set(bases).size, bases.length, `${suffix} ${rule}: a repeat`)
      for (const b of bases) {
        assert.equal(R.form(b, suffix).rule, rule, `${b} + ${suffix}`)
        const back = R.analyze(R.add(b, suffix), rule)
        assert.ok(back && back.base === b && back.rule === rule, `${R.add(b, suffix)} reads back as ${JSON.stringify(back)}`)
      }
    }
  }
  for (const rule of ['double', 'drop-e', 'just-add']) assert.ok(R.BANK.ing[rule].length >= 40, `ing ${rule}: ${R.BANK.ing[rule].length}`)
  // Hand-checked spellings, so the engine isn't only checked against itself.
  const spot = { hopping: ['hop', 'ing'], making: ['make', 'ing'], flying: ['fly', 'ing'], chatted: ['chat', 'ed'], danced: ['dance', 'ed'], worried: ['worry', 'ed'], studied: ['study', 'ed'], saddest: ['sad', 'est'], simpler: ['simple', 'er'], funniest: ['funny', 'est'], peaches: ['peach', 's'], cherries: ['cherry', 's'], shoes: ['shoe', 's'], freezing: ['freeze', 'ing'], buying: ['buy', 'ing'] }
  for (const [word, [base, suffix]] of Object.entries(spot)) assert.equal(R.add(base, suffix), word)
})

test('explain: a kind, specific rule card', () => {
  assert.equal(R.explain('hop', 'ing'), 'hop has one short vowel and ends in one consonant: double the p, then add -ing → hopping')
  assert.equal(R.explain('make', 'ing'), 'make ends in e: drop the e, then add -ing → making')
  assert.equal(R.explain('jump', 'ing'), 'jump ends in two consonants. Nothing changes: just add -ing → jumping')
  assert.equal(R.explain('cry', 'ing'), 'cry ends in y: keep the y before -ing. Nothing changes: just add -ing → crying')
  assert.equal(R.explain('sleep', 'ing'), 'sleep has two vowels together. Nothing changes: just add -ing → sleeping')
  assert.equal(R.explain('baby', 's'), 'baby ends in a consonant and y: change the y to i, then add -es → babies')
  assert.equal(R.explain('peach', 's'), 'peach ends in ch: add -es → peaches')
  for (const id of ['ing-double', 'ing-drop-e', 'ing-just-add', 'ed-y-to-i', 's-es']) assert.ok(R.describe(id).length > 10, id)
})

test('pickApply: new words only, shared between rules, never the list\'s own', () => {
  const exclude = new Set(['swim', 'swimming', 'hop', 'hope', 'hoping'])
  const got = R.pickApply(['ing-double', 'ing-drop-e', 'ing-just-add'], {}, exclude, 5, seeded(3))
  assert.equal(got.length, 5)
  const per = id => got.filter(g => g.id === id).length
  assert.deepEqual(['ing-double', 'ing-drop-e', 'ing-just-add'].map(per).sort(), [1, 2, 2])
  for (const g of got) {
    assert.ok(!exclude.has(g.base), g.base)
    assert.equal(g.w, R.add(g.base, 'ing'))
    assert.equal(g.suffix, 'ing')
  }
  assert.deepEqual(R.pickApply([], {}, exclude, 5), [])
})

test('pickApply rotates: words never asked come before ones already right', () => {
  const bank = R.BANK.ing.double
  const w = Object.fromEntries(bank.slice(0, 40).map(b => [b, [1, 3]]))
  const got = R.pickApply(['ing-double'], { 'ing-double': { n: 3, w } }, new Set(), 5, seeded(9))
  for (const g of got) assert.ok(bank.slice(40).includes(g.base), `${g.base} was already right`)
  // Missed last time: back soon.
  const missed = R.pickApply(['ing-double'], { 'ing-double': { n: 3, w: { ...w, hop: [0, 3] } } }, new Set(), 5, seeded(9))
  assert.ok(missed.some(g => g.base === 'hop'))
})

test('listSession: about half list words, half new words for the rules', () => {
  const words = ['swimming', 'quitting', 'dripping', 'shopping', 'giving', 'hoping', 'dancing', 'jumping', 'winking', 'sleeping'].map(w => ({ w, r: 0 }))
  const ids = ['ing-double', 'ing-drop-e', 'ing-just-add']
  const exclude = R.listBases({ words })
  const got = R.listSession(words, ids, {}, exclude, 10, seeded(5))
  assert.equal(got.length, 10)
  assert.equal(got.filter(g => g.id).length, 5)
  assert.equal(got.filter(g => words.includes(g)).length, 5)
  for (const g of got.filter(g => g.id)) assert.ok(!exclude.has(g.base) && !words.some(x => x.w === g.w), g.w)
  // A short category: all its words, plus the new ones.
  const cat = words.slice(0, 4)
  const short = R.listSession(cat, ['ing-double'], {}, exclude, 10, seeded(5))
  assert.equal(short.filter(g => cat.includes(g)).length, 4)
  assert.equal(short.filter(g => g.id === 'ing-double').length, 5)
  // No rules: just the list's words, as before.
  assert.equal(R.listSession(words, [], {}, exclude, 10, seeded(5)).length, 10)
})

test('progress: right the first time counts, the rule is learned after five words', () => {
  assert.equal(R.rightCount(undefined), 0)
  const p = { n: 4, w: { hop: [1, 1], run: [2, 2], sit: [0, 3], stop: [1, 4] } }
  assert.equal(R.rightCount(p), 3)
  assert.ok(!R.learned(p))
  p.w.plan = [1, 4]; p.w.clap = [1, 4]
  assert.equal(R.rightCount(p), 5)
  assert.ok(R.learned(p))
  assert.deepEqual(R.progressFrom({ 'rule-ing-double': { n: 2, w: { hop: [1, 2] } }, 'list-x': { words: [] }, 'rule-bad': null }), { 'ing-double': { n: 2, w: { hop: [1, 2] } } })
})

test('a rule value stays small: the whole bank asked fits 16 KB', () => {
  for (const [suffix, rules] of Object.entries(R.BANK)) for (const [rule, bases] of Object.entries(rules)) {
    const value = { n: 999, w: Object.fromEntries(bases.map(b => [b, [9, 999]])) }
    assert.ok(JSON.stringify(value).length < 2000, `${suffix}-${rule}`)
  }
  assert.ok(W.SESSION === 10)
})

test('prompt: what Kinwall says and shows', () => {
  assert.equal(R.prompt('hop', 'ing'), 'hop. Add ing.')
  assert.equal(R.prompt('jump', 'ed'), 'jump. Add e d.')
  assert.equal(R.shown('s'), 's / es')
})
