// node --test   (no dependencies)
const test = require('node:test')
const assert = require('node:assert/strict')
const W = require('../words.js')
const B = require('../banks.js')

// A repeatable "random", so a failure can be replayed.
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

test('parseWords: lines or commas, trimmed, no repeats', () => {
  assert.deepEqual(W.parseWords(' friend\nbecause, said ;Friend\n\n  could  '), ['friend', 'because', 'said', 'could'])
  assert.deepEqual(W.parseWords('1, 2, , !'), [])
  assert.equal(W.parseWords(Array.from({ length: 80 }, (_, i) => 'w' + 'a'.repeat(i % 20) + String.fromCharCode(97 + (i % 26)) + i).join('\n')).length, W.MAX_WORDS)
})

test('mergeWords keeps streaks and sentences of words still on the list', () => {
  const old = [{ w: 'friend', s: 'My friend is nice.', r: 2 }, { w: 'gone', s: '', r: 1 }]
  assert.deepEqual(W.mergeWords(['Friend', 'new'], old), [{ w: 'Friend', s: 'My friend is nice.', r: 2 }, { w: 'new', s: '', r: 0 }])
  assert.equal(W.mergeWords(['friend'], old, ['Changed.'])[0].s, 'Changed.')
})

test('distractors: never the word, no duplicates, three for ordinary words', () => {
  const rand = seeded(7)
  for (const word of ['friend', 'because', 'little', 'believe', 'cake', 'night', 'Wednesday', 'cat', 'knee']) {
    for (let k = 0; k < 20; k++) {
      const d = W.distractors(word, 3, rand)
      assert.equal(d.length, 3, `${word}: ${d}`)
      assert.ok(!d.some(x => x.toLowerCase() === word.toLowerCase()), `${word} offered itself`)
      assert.equal(new Set(d.map(x => x.toLowerCase())).size, d.length, `${word}: duplicate ${d}`)
    }
  }
})

test('distractors skip words that sound the same', () => {
  for (let k = 0; k < 50; k++) assert.ok(!W.distractors('meet', 3, Math.random, B.soundsLike('meet')).includes('meat'))
  for (let k = 0; k < 50; k++) assert.ok(!W.distractors('week', 3, Math.random, B.soundsLike('week')).includes('weak'))
})

test('blanks: hides some letters, never all, prefers vowels and tricky parts', () => {
  assert.deepEqual(W.blanks('a'), [])
  const rand = seeded(3)
  for (const word of ['cat', 'friend', 'little', 'knife', 'Wednesday', 'it\'s']) {
    const b = W.blanks(word, rand)
    assert.ok(b.length >= 1 && b.length < [...word].filter(c => /\p{L}/u.test(c)).length, `${word}: ${b}`)
    assert.ok(b.every(i => /\p{L}/u.test(word[i])), `${word}: blanked a non-letter`)
  }
  // "believe": the ie and the vowels are where the trouble is.
  const hits = { vowel: 0, other: 0 }
  for (let k = 0; k < 50; k++) for (const i of W.blanks('believe', rand)) hits['aeiou'.includes('believe'[i]) ? 'vowel' : 'other']++
  assert.ok(hits.vowel > hits.other * 3, JSON.stringify(hits))
})

test('diff marks the letters that differ', () => {
  const show = d => d.map(x => (x.ok ? x.ch : `[${x.ch}]`)).join('')
  let d = W.diff('freind', 'friend')
  assert.equal(show(d.attempt).replace(/[[\]]/g, '').length, 6)
  assert.equal(d.word.filter(x => !x.ok).length, 1)
  d = W.diff('becuz', 'because')
  assert.equal(show(d.word), 'bec[a]u[s][e]')
  assert.equal(show(d.attempt), 'becu[z]')
  d = W.diff('Friend', 'friend')
  assert.ok(d.word.every(x => x.ok) && d.attempt.every(x => x.ok))
  d = W.diff('', 'cat')
  assert.ok(d.word.every(x => !x.ok) && d.attempt.length === 0)
})

test('record and mastered: three right in a row', () => {
  let r = 0
  r = W.record(r, true); r = W.record(r, true)
  assert.ok(!W.mastered(r))
  r = W.record(r, true)
  assert.ok(W.mastered(r))
  assert.equal(W.record(r, false), 0)
})

test('pickSession: about ten, least practiced first, and rotates through a big bank', () => {
  const list = Array.from({ length: 6 }, (_, i) => ({ w: 'w' + i, r: 0 }))
  assert.equal(W.pickSession(list).length, 6)
  const bank = Array.from({ length: 150 }, (_, i) => ({ w: 'w' + i, r: 0, t: 0 }))
  const seen = new Set()
  for (let n = 1; n <= 15; n++) {
    const pick = W.pickSession(bank)
    assert.equal(pick.length, 10)
    assert.equal(new Set(pick).size, 10)
    for (const i of pick) { seen.add(i); bank[i].t = n; bank[i].r = W.record(bank[i].r, true) }
  }
  assert.equal(seen.size, 150, 'every word came up once in 15 sessions')
  // Missed words come back, but at most half the session.
  for (const w of bank.slice(0, 30)) { w.r = 0; w.t = 16 }
  const next = W.pickSession(bank)
  assert.equal(next.filter(i => i < 30).length, 5)
})

test('questionType gives new words the easier kinds', () => {
  const rand = seeded(5)
  for (let k = 0; k < 30; k++) assert.ok(['pick', 'fill'].includes(W.questionType({ w: 'friend', r: 0 }, rand)))
  for (let k = 0; k < 30; k++) assert.notEqual(W.questionType({ w: 'friend', r: 3 }, rand), 'pick')
})

test('word banks: 1st to 5th grade, 150+ words each, no repeats anywhere', () => {
  assert.deepEqual(B.BANKS.map(b => b.grade), [1, 2, 3, 4, 5])
  const all = B.all()
  for (const b of B.BANKS) {
    const n = all.filter(x => x.grade === b.grade).length
    assert.ok(n >= 150, `${b.name} has ${n} words`)
  }
  const seen = new Map()
  for (const { w, grade, pattern } of all) {
    assert.match(w, /^[A-Za-z']+$/, `${grade}/${pattern}: "${w}"`)
    const k = w.toLowerCase()
    assert.ok(!seen.has(k), `"${w}" is in ${seen.get(k)} and ${grade}/${pattern}`)
    seen.set(k, `${grade}/${pattern}`)
  }
})

test('every bank word gets two or more good choices, and its sound-alikes are never offered', () => {
  const rand = seeded(11)
  for (const { w } of B.all()) {
    const avoid = B.soundsLike(w)
    const d = W.distractors(w, 3, rand, avoid)
    assert.ok(d.length >= 2, `${w}: ${d}`)
    assert.ok(!d.some(x => x.toLowerCase() === w.toLowerCase() || avoid.includes(x.toLowerCase())), `${w}: ${d}`)
    assert.equal(new Set(d.map(x => x.toLowerCase())).size, d.length)
  }
})

test('words that sound like another bank word have a sentence that uses them', () => {
  const bank = new Set(B.all().map(x => x.w.toLowerCase()))
  for (const group of B.HOMOPHONES) {
    for (const w of group.filter(x => bank.has(x))) {
      const s = B.SENTENCES[w]
      assert.ok(s, `"${w}" needs a sentence`)
      assert.ok(s.toLowerCase().includes(w), `"${w}": ${s}`)
    }
  }
})
