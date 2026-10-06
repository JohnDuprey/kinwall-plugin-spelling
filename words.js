// Spelling practice: the word logic. Pure functions only (no DOM, no saving), so test/words.test.js
// can run them under node.
//
// A list is { id, title, test: 'YYYY-MM-DD' | '', archived, created, words: [{ w, s, r }] }: the word,
// an optional sentence, and its streak (right the first time, this many times in a row, across
// sessions). A word is mastered once its streak reaches MASTERED.
;(function (root) {
  const MASTERED = 3
  const MAX_WORDS = 60
  const MAX_WORD = 30
  const SESSION = 10
  const VOWELS = 'aeiou'

  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()
  const isVowel = c => VOWELS.includes(c.toLowerCase())
  const letter = c => /\p{L}/u.test(c)

  /** Words typed or pasted: one per line or comma separated. Trimmed, de-duplicated, capped. */
  function parseWords(text) {
    const out = []
    for (const raw of String(text).split(/[\n,;]+/)) {
      const w = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_WORD)
      if (w && /\p{L}/u.test(w) && !out.some(o => same(o, w))) out.push(w)
    }
    return out.slice(0, MAX_WORDS)
  }

  /** New words for a list, keeping the streak and sentence of words that were already on it. */
  function mergeWords(names, old, sentences) {
    return names.map((w, i) => {
      const was = old.find(o => same(o.w, w))
      const s = (sentences && sentences[i] != null ? sentences[i] : was ? was.s : '') || ''
      return { w, s: s.trim().slice(0, 200), r: was ? was.r : 0 }
    })
  }

  // Misspellings a kid might really write. Each rule returns candidate strings for one word.
  const RULES = [
    // swap two neighboring letters, never the first one: "freind"
    w => [...w].slice(0, -1).map((_, i) => i > 0 && w[i] !== w[i + 1] && letter(w[i]) && letter(w[i + 1]) ? w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2) : null),
    // undouble a double letter: "litle"; double a single consonant: "tabble"
    w => [...w].map((c, i) => {
      if (i > 0 && c === w[i - 1]) return w.slice(0, i) + w.slice(i + 1)
      if (i > 0 && i < w.length - 1 && letter(c) && !isVowel(c) && c !== w[i + 1] && c !== w[i - 1]) return w.slice(0, i) + c + w.slice(i)
      return null
    }),
    // drop a letter (never the first): "frend"
    w => (w.length > 3 ? [...w].map((c, i) => i > 0 && letter(c) ? w.slice(0, i) + w.slice(i + 1) : null) : []),
    // a different vowel: "frind", "becuase"
    w => [...w].flatMap((c, i) => isVowel(c) ? ({ a: 'eu', e: 'ia', i: 'ey', o: 'ua', u: 'oa' })[c.toLowerCase()].split('').map(v => w.slice(0, i) + v + w.slice(i + 1)) : []),
    // ie <-> ei
    w => [w.replace(/ie/i, 'ei'), w.replace(/ei/i, 'ie')],
    // a silent e: dropped or added
    w => (/[^aeiou]e$/i.test(w) && w.length > 3 ? [w.slice(0, -1)] : /[^aeiouy]$/i.test(w) && w.length > 2 ? [w + 'e'] : []),
    // sounds-alike spellings
    w => [['ck', 'k'], ['ph', 'f'], ['c', 'k'], ['k', 'c'], ['s', 'c'], ['tion', 'shun'], ['ight', 'ite'], ['ou', 'ow'], ['ay', 'ai'], ['ai', 'ay'], ['ee', 'ea'], ['ea', 'ee'], ['oa', 'o'], ['y', 'ey'], ['er', 'ur'], ['ir', 'er'], ['wh', 'w']]
      .map(([a, b]) => (w.toLowerCase().includes(a) ? w.slice(0, w.toLowerCase().indexOf(a)) + b + w.slice(w.toLowerCase().indexOf(a) + a.length) : null)),
  ]

  /** Up to `n` plausible misspellings of `word`: never the word itself (or a word in `avoid`, like
   *  one that sounds the same), no duplicates. */
  function distractors(word, n = 3, rand = Math.random, avoid = []) {
    const seen = new Set([word.toLowerCase(), ...avoid.map(a => a.toLowerCase())])
    const byRule = RULES.map(rule => rule(word).filter(c => {
      if (!c || !/\p{L}/u.test(c) || seen.has(c.toLowerCase())) return false
      seen.add(c.toLowerCase())
      return true
    }))
    // One from each kind of mistake first, so the choices don't all look alike.
    const out = []
    for (const pool of shuffle(byRule, rand)) if (pool.length && out.length < n) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
    const rest = shuffle(byRule.flat(), rand)
    while (out.length < n && rest.length) out.push(rest.pop())
    return out
  }

  /** Which letters to hide for "fill in the missing letters": the tricky parts first, then vowels. */
  function blanks(word, rand = Math.random) {
    const w = word.toLowerCase()
    const spots = [...w].map((c, i) => i).filter(i => letter(w[i]))
    if (spots.length < 2) return []
    const score = new Map(spots.map(i => [i, rand()])) // random tie-breaks
    const bump = (i, by) => { if (score.has(i)) score.set(i, score.get(i) + by) }
    for (const i of spots) {
      if (isVowel(w[i])) bump(i, 2)
      if (w[i] === w[i + 1] || w[i] === w[i - 1]) bump(i, 3) // double letters
    }
    for (const re of [/ie|ei/g, /ck|ph|gh|wh|kn|wr|mb/g, /tion|sion|ough|augh|ight/g, /[^aeiou]e$/g]) {
      let m
      while ((m = re.exec(w))) for (let i = m.index; i < m.index + m[0].length; i++) bump(i, w[i] === 'e' && re.source.endsWith('$') ? 3 : 2.5)
    }
    const count = Math.max(1, Math.min(Math.round(spots.length / 3), spots.length - 1, 4))
    return spots.sort((a, b) => score.get(b) - score.get(a)).slice(0, count).sort((a, b) => a - b)
  }

  /** Letter-level difference between what was typed and the word, for showing the fix.
   *  Each letter of each says whether it's in their longest shared run (ok) or not. */
  function diff(attempt, word) {
    const a = [...attempt.trim()], b = [...word]
    const eq = (x, y) => x.toLowerCase() === y.toLowerCase()
    const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = eq(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    const A = a.map(ch => ({ ch, ok: false })), B = b.map(ch => ({ ch, ok: false }))
    let i = 0, j = 0
    while (i < a.length && j < b.length) {
      if (eq(a[i], b[j])) { A[i++].ok = true; B[j++].ok = true }
      else if (L[i + 1][j] >= L[i][j + 1]) i++
      else j++
    }
    return { attempt: A, word: B }
  }

  /** A word's streak after an answer: right the first time adds one, a miss starts over. */
  const record = (r, right) => (right ? Math.min((r || 0) + 1, 9) : 0)
  const mastered = r => (r || 0) >= MASTERED

  /** About SESSION words for one session (or all of them if there are fewer), as indexes into `words`
   *  ({ r: streak, t: the session it was last asked in, 0 = never }). Up to half are words missed
   *  last time; the rest rotate through the others, least practiced and longest ago first, so a big
   *  word bank doesn't keep asking the same few. */
  function pickSession(words, size = SESSION, rand = Math.random) {
    const order = shuffle(words.map((_, i) => i), rand) // random among equals
    const r = i => Math.min(words[i].r || 0, MASTERED)
    const t = i => words[i].t || 0
    const wasMissed = i => t(i) && !words[i].r
    const missed = order.filter(wasMissed).sort((x, y) => t(y) - t(x))
    const rest = order.filter(i => !wasMissed(i)).sort((x, y) => r(x) - r(y) || t(x) - t(y))
    const half = missed.slice(0, Math.floor(size / 2))
    // Short of other words (a short list): more of the missed ones fill the session.
    return shuffle([...half, ...rest, ...missed.slice(half.length)].slice(0, Math.min(size, words.length)), rand)
  }

  /** Which kind of question: newer words get the easier ones, practiced words get typed. */
  function questionType(word, rand = Math.random, avoid = []) {
    const r = word.r || 0
    const kinds = r === 0 ? ['pick', 'fill'] : r === 1 ? ['fill', 'type', 'pick'] : ['type', 'type', 'fill']
    let kind = kinds[Math.floor(rand() * kinds.length)]
    if (kind === 'fill' && blanks(word.w, rand).length === 0) kind = 'pick'
    if (kind === 'pick' && distractors(word.w, 3, rand, avoid).length < 2) kind = 'type'
    return kind
  }

  function shuffle(list, rand = Math.random) {
    const a = [...list]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
    return a
  }

  /** Lists newest first, archived ones last. */
  const sortLists = lists => [...lists].sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || b.created - a.created)

  // ---------- Levels ----------
  // Progress is a map per level, { word: [r, t] }, saved as level-<L>. Earlier versions saved it per
  // grade as bank-<g> { n, w: { word: [r, t] } }; those are still read, and a level's own value wins.
  const UNLOCK = 0.8 // a level opens the next once this share of its words is mastered

  /** Level progress from saved data: { 1: { word: [r, t] }, … }. `levels` is Banks.LEVELS. */
  function levelProgress(saved, levels) {
    const prog = {}
    for (const l of levels) prog[l.level] = { ...((saved[`level-${l.level}`] || {}).w || {}) }
    const where = new Map(levels.flatMap(l => l.words.map(w => [w, l.level])))
    for (const [key, value] of Object.entries(saved)) {
      if (!/^bank-\d+$/.test(key) || !value || !value.w) continue
      for (const [w, rt] of Object.entries(value.w)) {
        const L = where.get(w)
        if (L && !(w in prog[L]) && Array.isArray(rt)) prog[L][w] = rt
      }
    }
    return prog
  }

  /** How much of a level is mastered, 0 to 1. */
  const share = (words, map) => (words.length ? words.filter(w => mastered((map[w] || [])[0])).length / words.length : 0)
  const passed = (words, map) => share(words, map) >= UNLOCK

  /** Levels open on a first visit: Level 1, plus each level after one already passed (older progress). */
  function earnedOpen(levels, prog) {
    let open = 1
    while (open < levels.length && passed(levels[open - 1].words, prog[open])) open++
    return open
  }

  /** Grown-up settings, checked: open 1..count but never below the level the kid is working on. */
  function cleanSettings(v, count, fallbackOpen = 1) {
    const int = (x, d) => (Number.isInteger(x) ? x : d)
    const cur = Math.min(Math.max(int(v && v.cur, 1), 1), count)
    const open = Math.min(Math.max(int(v && v.open, fallbackOpen), cur, 1), count)
    return { open, cur, mix: !!(v && v.mix), n: Math.max(int(v && v.n, 0), 0) }
  }

  /** After a session in level L: the new "open up to", and whether it just opened the next one. */
  function afterSession(settings, L, words, map, count) {
    if (L === settings.open && L < count && passed(words, map)) return { open: L + 1, opened: true }
    return { open: settings.open, opened: false }
  }

  /** `n` review words from earlier levels: missed ones first, then the longest since practiced. */
  function pickReview(words, n, rand = Math.random) {
    const order = shuffle(words.map((_, i) => i), rand)
    const t = i => words[i].t || 0
    const missed = i => t(i) && !words[i].r
    order.sort((x, y) => (missed(y) ? 1 : 0) - (missed(x) ? 1 : 0) || t(x) - t(y))
    return order.slice(0, Math.min(n, words.length))
  }

  /** A level session: about SESSION words from `main`; with `review` words (earlier levels), about
   *  REVIEW of them come from there. Returns the chosen items, shuffled. */
  const REVIEW = 0.3
  function levelSession(main, review = [], size = SESSION, rand = Math.random) {
    const total = Math.min(size, main.length + review.length)
    const fromReview = review.length ? Math.min(review.length, Math.round(total * REVIEW)) : 0
    const fromMain = Math.min(main.length, total - fromReview)
    const picked = [...pickSession(main, fromMain, rand).map(i => main[i]), ...pickReview(review, total - fromMain, rand).map(i => review[i])]
    return shuffle(picked, rand)
  }

  const api = { UNLOCK, REVIEW, levelProgress, share, passed, earnedOpen, cleanSettings, afterSession, pickReview, levelSession, MASTERED, MAX_WORDS, SESSION, same, parseWords, mergeWords, distractors, blanks, diff, record, mastered, pickSession, questionType, shuffle, sortLists }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.Words = api
})(this)
