// node --test: the actions other apps send through Kinwall (addList, archiveList), and the
// categories a list can have.
const test = require('node:test')
const assert = require('node:assert/strict')
const W = require('../words.js')

const add = input => ({ id: 'a1', action: 'addList', input })
const NOW = Date.UTC(2026, 9, 6)

test('addList: a new list in the saved format, with a test date', () => {
  const [l] = W.applyAction([], add({ title: ' Adding -ing ', words: ['swimming', 'Swimming', 'giving', '', 42], testDate: '2026-10-09', sentences: { giving: 'Thanks for giving.' } }), NOW)
  assert.equal(l.title, 'Adding -ing')
  assert.equal(l.test, '2026-10-09')
  assert.equal(l.archived, false)
  assert.equal(l.created, NOW)
  assert.equal(l.n, 0)
  assert.match(l.id, /^[a-z0-9]+$/)
  assert.deepEqual(l.words, [{ w: 'swimming', s: '', r: 0 }, { w: 'giving', s: 'Thanks for giving.', r: 0 }])
  assert.equal(l.categories, undefined)
})

test('addList: categories from the sheet headings, each word in one, with rule text', () => {
  const [l] = W.applyAction([], add({
    title: 'Adding -ing',
    categories: [
      { name: 'Double the consonant', words: ['swimming', 'quitting'], rule: 'Short vowel, one consonant: double it.' },
      { name: 'Drop the e, then add -ing', words: ['giving', 'hoping'] },
      { name: 'Empty', words: [] },
      { name: '', words: ['lost'] },
    ],
    words: ['jumping', 'swimming'], // already in a category: stays there
  }), NOW)
  assert.deepEqual(l.categories, [{ name: 'Double the consonant', rule: 'Short vowel, one consonant: double it.' }, { name: 'Drop the e, then add -ing' }])
  assert.deepEqual(l.words.map(w => [w.w, w.c]), [['swimming', 0], ['quitting', 0], ['giving', 1], ['hoping', 1], ['jumping', undefined]])
})

test('addList: merges into the unarchived list with the same title, keeping stars; twice changes nothing', () => {
  const old = { id: 'x', title: 'Adding -ing', test: '', archived: false, created: 1, n: 4, words: [{ w: 'swimming', s: 'I like swimming.', r: 2, t: 3 }] }
  const archived = { ...old, id: 'y', archived: true, words: [] }
  const action = add({ title: 'adding -ING', categories: [{ name: 'Double the consonant', words: ['Swimming', 'quitting'] }], words: ['jumping'], testDate: '2026-10-09' })
  const [l] = W.applyAction([archived, old], action, NOW)
  assert.equal(l.id, 'x')
  assert.equal(l.title, 'adding -ING')
  assert.equal(l.n, 4)
  assert.equal(l.test, '2026-10-09')
  assert.deepEqual(l.words, [{ w: 'swimming', s: 'I like swimming.', r: 2, t: 3, c: 0 }, { w: 'quitting', s: '', r: 0, c: 0 }, { w: 'jumping', s: '', r: 0 }])
  assert.deepEqual(W.applyAction([archived, l], action, NOW), [], 'applying it again changes nothing')
  // Only an archived list with that title: a new one.
  assert.notEqual(W.applyAction([archived], action, NOW)[0].id, 'y')
})

test('addList: unusable input is dropped, and the caps hold', () => {
  for (const input of [{}, { title: 'x' }, { title: '  ', words: ['a'] }, { title: 'x', words: 'swimming' }, { title: 'x', words: [1, null] }, { title: 'x', categories: 'no' }]) {
    assert.deepEqual(W.applyAction([], add(input), NOW), [], JSON.stringify(input))
  }
  assert.deepEqual(W.applyAction([], { action: 'deleteAll', input: { title: 'x', words: ['a'] } }), [])
  assert.deepEqual(W.applyAction([], null), [])
  const [l] = W.applyAction([], add({ title: 'y'.repeat(50), words: Array.from({ length: 80 }, (_, i) => 'w' + String.fromCharCode(97 + (i % 26)) + i), testDate: '2026-02-30' }), NOW)
  assert.equal(l.title.length, 40)
  assert.equal(l.words.length, W.MAX_WORDS)
  assert.equal(l.test, '')
  const [many] = W.applyAction([], add({ title: 'z', categories: Array.from({ length: 12 }, (_, i) => ({ name: `Cat ${i}`, words: [`word${String.fromCharCode(97 + i)}`] })) }), NOW)
  assert.equal(many.categories.length, W.MAX_CATS)
  assert.equal(many.words.length, W.MAX_CATS)
  const full = Array.from({ length: 90 }, (_, i) => ({ id: String(i), title: `L${i}`, archived: true, words: [] }))
  assert.deepEqual(W.applyAction(full, add({ title: 'new', words: ['a'] }), NOW), [])
})

test('archiveList: archives every unarchived list with that title, once', () => {
  const lists = [{ id: 'a', title: 'Week 5', archived: false, words: [] }, { id: 'b', title: 'week 5', archived: false, words: [] }, { id: 'c', title: 'Week 6', archived: false, words: [] }]
  const out = W.applyAction(lists, { action: 'archiveList', input: { title: 'WEEK 5' } })
  assert.deepEqual(out.map(l => [l.id, l.archived]), [['a', true], ['b', true]])
  assert.deepEqual(W.applyAction(out, { action: 'archiveList', input: { title: 'Week 5' } }), [])
})

test('the editor text: headings start categories, and it reads back the same', () => {
  const parsed = W.parseListText('friend, said\n\nDouble the consonant:\nswimming\nquitting\n## Drop the e, then add -ing\ngiving\nEmpty:\n')
  assert.deepEqual(parsed.categories, [{ name: 'Double the consonant' }, { name: 'Drop the e, then add -ing' }])
  assert.deepEqual(parsed.words, [{ w: 'friend' }, { w: 'said' }, { w: 'swimming', c: 0 }, { w: 'quitting', c: 0 }, { w: 'giving', c: 1 }])
  const text = W.listText(parsed)
  assert.equal(text, 'friend\nsaid\n\nDouble the consonant:\nswimming\nquitting\n\nDrop the e, then add -ing:\ngiving')
  assert.deepEqual(W.parseListText(text), parsed)
  // Old lists (no categories) are plain words.
  assert.equal(W.listText({ words: [{ w: 'a' }, { w: 'b', c: 3 }] }), 'a\nb')
})

test('buildWords keeps stars and last session, takes new sentences and categories', () => {
  const old = [{ w: 'friend', s: 'My friend.', r: 2, t: 5 }]
  assert.deepEqual(W.buildWords([{ w: 'Friend', c: 1 }, { w: 'new' }], old), [{ w: 'Friend', s: 'My friend.', r: 2, t: 5, c: 1 }, { w: 'new', s: '', r: 0 }])
  assert.equal(W.buildWords([{ w: 'friend' }], old, () => '')[0].s, '')
})
