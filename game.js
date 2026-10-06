// Spelling practice: Kinwall says a word (never shows it) and the child spells it: typing it, picking
// the right spelling, or filling in missing letters. Words come from lists a parent sets up for this
// kid, or from ten levels built from the word banks (banks.js). Word logic lives in words.js.
//
// Saved for whoever is playing:
//   list-<id>  { id, title, test, archived, created, n, words: [{ w, s, r, t, c }], categories? }  one
//              per list; c: the word's category, an index into categories [{ name, rule? }]
//   level-<L>  { w: { word: [r, t] } }  progress in level L (only words already asked)
//   levels     { open, cur, mix, n }  levels open, the one practiced last, "mix in earlier levels",
//              and the level-session counter (t below)
//   bank-<g>   older versions' progress per grade: still read (words.js levelProgress), never written
// r: right the first time this many times in a row; t: the session (n) it was last asked in.
const el = id => document.getElementById(id)
// Speech: this page's own speechSynthesis when it has one (it lets us pick the voice); else Kinwall
// speaks for us (Android's WebView has none) when ctx.canSpeak; else nothing, and the words can't be
// practiced here, because showing them would give the answers away.
const speech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? window.speechSynthesis : null
let canTalk = !!speech
const PRAISE = ['Yes!', 'Great spelling!', 'You got it!', 'Nice work!', 'Awesome!', "That's right!", 'Super!', 'Well done!', 'Way to go!']
const LIMIT = 15500 // bytes per saved value (Kinwall allows 16 KB)

let ctx = { member: null, locale: 'en-US' }
let lists = [] // this kid's lists
const LV = Banks.LEVELS
let prog = {} // level -> { word: [r, t] }
let lv = Words.cleanSettings(undefined, LV.length) // { open, cur, mix, n }
let lastPraise = ''

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Speech, as in Sight words. The browser's voices vary a lot, so pick the clearest English one on
// the device, and work around the ways Web Speech glitches: speaking right after cancel() garbles
// the start, Chrome can drop onend for an utterance it garbage-collects, and some voices never
// fire onend at all.
const RATE = { word: 0.75, talk: 0.9 }
// macOS novelty and "Eloquence" voices: fun, but not clear enough for spelling.
const UNCLEAR = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Rocko|Shelley|Flo\b|Eddy|Reed|Sandy/i
const CLEAR = /Samantha|Ava|Allison|Susan|Zoe|Alex|Karen|Daniel|Serena|Moira|Tessa|Aria|Jenny|Guy|Libby|Natural/i
let voice = null
function pickVoice() {
  const english = speech.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang) && !UNCLEAR.test(v.name))
  const score = v => (v.localService ? 4 : 0) + (/en[-_]US/i.test(v.lang) ? 2 : 0) + (CLEAR.test(v.name) ? 3 : 0) + (v.default ? 1 : 0)
  voice = english.sort((a, b) => score(b) - score(a))[0] ?? null
}
if (speech) { pickVoice(); speech.addEventListener?.('voiceschanged', pickVoice) }

let speaking = null // the current utterance, referenced so it isn't garbage-collected mid-sentence
let turn = 0

/** Speaks; resolves once it's finished (or after a fallback). `word`: one spelling word, said slowly and clearly. */
async function say(text, { word = false } = {}) {
  if (!speech) {
    if (!ctx.canSpeak) return
    turn++
    return Kinwall.speak(word ? `${text}.` : text, { rate: word ? RATE.word : RATE.talk, lang: 'en-US' })
  }
  const mine = ++turn
  if (speech.speaking || speech.pending) {
    speech.cancel()
    await sleep(150) // speaking straight after cancel() clips or garbles the start
    if (mine !== turn) return // something newer asked to speak meanwhile
  }
  speech.resume() // Chrome sometimes leaves the queue paused
  await new Promise(resolve => {
    const spoken = word ? `${text}.` : text // the period gives a word a clean ending
    const u = new SpeechSynthesisUtterance(spoken)
    if (voice) { u.voice = voice; u.lang = voice.lang } else u.lang = 'en-US'
    u.rate = word ? RATE.word : RATE.talk
    u.pitch = 1
    const done = () => { clearTimeout(fallback); if (speaking === u) speaking = null; resolve() }
    const fallback = setTimeout(done, 1500 + spoken.length * 120) // slower speech takes longer
    u.onend = done
    u.onerror = done
    speaking = u
    speech.speak(u)
  })
}

/** A different phrase from the one said last time. */
function pickFrom(list) {
  const options = list.filter(p => p !== lastPraise)
  lastPraise = options[Math.floor(Math.random() * options.length)]
  return lastPraise
}

// ---------- Screens ----------
const SCREENS = ['home', 'nospeech', 'level', 'play', 'done', 'edit', 'editlist']
const BACK = { level: 'home', play: 'home', done: 'home', edit: 'home', editlist: 'edit' }
let screen = 'home'
function show(name) {
  screen = name
  for (const s of SCREENS) el(s).hidden = s !== name
  el('back').hidden = !BACK[name]
  el('count').textContent = ''
  el('grownups').hidden = !['home', 'nospeech'].includes(name) || ctx.parent === false
  if (name !== 'play') { turn++; if (speech) speech.cancel(); else if (ctx.canSpeak) Kinwall.stopSpeaking() }
  fitRoom()
  window.scrollTo(0, 0)
}
el('back').onclick = () => {
  const to = BACK[screen]
  if (to === 'home') home()
  else if (to === 'edit') openEdit()
  else show(to)
}
const home = () => { if (canTalk) { renderHome(); show('home') } else show('nospeech') }

// ---------- Saving ----------
function save(key, value) {
  const text = JSON.stringify(value)
  if (text && text.length > LIMIT) return Promise.reject(new Error('too big'))
  return Kinwall.save(key, value)
}
const keep = (key, value) => save(key, value).catch(() => { /* offline: keep playing, it saves next time */ })

const activeLists = () => Words.sortLists(lists).filter(l => !l.archived)
const listName = l => l.title || (l.test ? `Test ${dateText(l.test)}` : `List from ${dateText(new Date(l.created).toISOString().slice(0, 10))}`)
function dateText(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  try { return new Date(y, m - 1, d).toLocaleDateString(ctx.locale || 'en-US', { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return ymd }
}
const stars = r => '★'.repeat(Math.min(r || 0, Words.MASTERED)) + '☆'.repeat(Words.MASTERED - Math.min(r || 0, Words.MASTERED))

function button(cls, html, onclick) {
  const b = document.createElement('button')
  b.className = cls
  b.innerHTML = html
  b.onclick = onclick
  return b
}
/** "-ful, -less": a line never breaks inside "-less" (it broke after the hyphen, leaving "-" alone). */
const noBreakAtHyphens = s => s.split(/(\s+)/).map(t => t.includes('-') ? `<span class="nb">${esc(t)}</span>` : esc(t)).join('')
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// ---------- Home ----------
function renderHome() {
  const box = el('my-lists')
  box.textContent = ''
  const mine = activeLists()
  for (const [k, l] of mine.entries()) {
    const done = l.words.filter(w => Words.mastered(w.r)).length
    const card = document.createElement('div')
    card.className = 'list-card' + (k === 0 ? ' first' : '')
    card.innerHTML = `<div class="list-head"><div><div class="list-name">${esc(listName(l))}</div>
      <div class="dim">${l.words.length} word${l.words.length === 1 ? '' : 's'} · ${done} ⭐${l.test && l.title ? ` · test ${esc(dateText(l.test))}` : ''}</div></div></div>`
    card.querySelector('.list-head').append(button('go', 'Practice', () => (l.categories?.length ? openListPage(l) : startSession({ kind: 'list', list: l }))))
    if (k === 0) { // the newest list: each word and how close it is to mastered
      const chips = document.createElement('div')
      chips.className = 'word-chips'
      for (const w of l.words) chips.insertAdjacentHTML('beforeend', `<span class="chip${Words.mastered(w.r) ? ' strong' : ''}">${esc(w.w)} <span class="marks" aria-label="${Math.min(w.r || 0, 3)} of 3">${stars(w.r)}</span></span>`)
      card.append(chips)
    }
    box.append(card)
  }
  if (!mine.length) box.innerHTML = `<p class="dim">${ctx.parent === false ? 'No spelling list yet. A grown-up can add one from their phone.' : 'No spelling list yet. Practice a level below, or a grown-up can add this week\'s words.'}</p>`
  renderLevels()
}

// ---------- Levels ----------
const pctOf = L => Math.round(Words.share(LV[L - 1].words, prog[L]) * 100)
const toOpen = L => Math.ceil(LV[L - 1].words.length * Words.UNLOCK) // mastered words that open the next level
const openNote = () => lv.open < LV.length ? `Get ⭐ on ${toOpen(lv.open)} of Level ${lv.open}'s ${LV[lv.open - 1].words.length} words to open Level ${lv.open + 1}.` : 'Every level is open!'
function renderLevels() {
  const box = el('levels')
  box.textContent = ''
  for (const l of LV) {
    const open = l.level <= lv.open
    const pct = pctOf(l.level)
    const b = button('level-btn' + (open ? '' : ' locked') + (l.level === lv.cur ? ' last' : ''),
      `<small>Level</small><span class="num">${l.level}</span>` +
      (open ? `<span class="bar" aria-hidden="true"><span style="width:${pct}%"></span></span>` : '<span class="lock" aria-hidden="true">🔒</span>'),
      () => { if (open) openLevel(l.level); else el('levels-note').textContent = `Level ${l.level} is locked. ${openNote()}` })
    b.setAttribute('aria-label', open ? `Level ${l.level}: ${pct}% of its words have stars` : `Level ${l.level}, locked`)
    if (!open) b.setAttribute('aria-disabled', 'true')
    box.append(b)
  }
  el('levels-note').textContent = openNote()
}

/** A level's words as practice items, with this kid's progress (`lv`: which level each is from). */
function levelItems(L, pattern) {
  const map = prog[L] || (prog[L] = {})
  return LV[L - 1].patterns
    .filter(([name]) => !pattern || name === pattern)
    .flatMap(([, words]) => words.split(' ').map(w => {
      const [r, t] = map[w] || [0, 0]
      return { w, s: Banks.SENTENCES[w.toLowerCase()] || '', r, t, lv: L }
    }))
}

function openLevel(L) {
  const level = LV[L - 1]
  el('level-title').textContent = `Level ${L}`
  const all = levelItems(L)
  const done = all.filter(w => Words.mastered(w.r)).length
  el('level-fill').style.width = `${pctOf(L)}%`
  el('level-sub').textContent = `${done} of ${all.length} words have ⭐` +
    (L === lv.open && L < LV.length ? ` · ${toOpen(L)} open Level ${L + 1}` : '')
  const box = el('patterns')
  box.textContent = ''
  const count = items => `${items.filter(w => Words.mastered(w.r)).length} of ${items.length} ⭐`
  box.append(button('pattern all', `<span>Mix of everything</span><small>${count(all)}</small>`, () => startSession({ kind: 'level', level: L })))
  for (const [name] of level.patterns) {
    const items = levelItems(L, name)
    box.append(button('pattern', `<span>${noBreakAtHyphens(name)}</span><small>${count(items)}</small>`, () => startSession({ kind: 'level', level: L, pattern: name })))
  }
  show('level')
}

// ---------- A list with categories ----------
// Like a level: "Mix of everything", then a button per category (the headings on the teacher's sheet).
const catWords = (l, cat) => (cat === undefined ? l.words : l.words.filter(w => (Number.isInteger(w.c) && w.c < l.categories.length ? w.c : -1) === cat))
function openListPage(l) {
  el('level-title').textContent = listName(l)
  const done = l.words.filter(w => Words.mastered(w.r)).length
  el('level-fill').style.width = `${l.words.length ? Math.round((done / l.words.length) * 100) : 0}%`
  el('level-sub').textContent = `${done} of ${l.words.length} words have ⭐` + (l.test ? ` · test ${dateText(l.test)}` : '')
  const box = el('patterns')
  box.textContent = ''
  const count = items => `${items.filter(w => Words.mastered(w.r)).length} of ${items.length} ⭐`
  box.append(button('pattern all', `<span>Mix of everything</span><small>${count(l.words)}</small>`, () => startSession({ kind: 'list', list: l })))
  const groups = [...l.categories.map((c, i) => [c, i]), [{ name: 'Other words' }, -1]]
  for (const [c, i] of groups) {
    const items = catWords(l, i)
    if (!items.length) continue
    const b = button('pattern', `<span>${noBreakAtHyphens(c.name)}</span>${c.rule ? `<small class="rule">${esc(c.rule)}</small>` : ''}<small>${count(items)}</small>`, () => startSession({ kind: 'list', list: l, cat: i }))
    box.append(b)
  }
  show('level')
}

// ---------- A session ----------
let S = null // { source, items, queue, pos, n, right, firstTries, newStars, entry, tries }

function startSession(source) {
  let items, picked, n
  if (source.kind === 'list') {
    items = source.cat === undefined ? source.list.words : catWords(source.list, source.cat)
    picked = Words.pickSession(items)
    n = source.list.n = (source.list.n || 0) + 1
  } else {
    const L = source.level
    // "Mix in earlier levels" (a grown-up's setting): the level's mix also reviews the open levels before it.
    const review = lv.mix && !source.pattern ? LV.slice(0, L - 1).flatMap(l => levelItems(l.level)) : []
    items = Words.levelSession(levelItems(L, source.pattern), review)
    picked = items.map((_, i) => i)
    lv = { ...lv, cur: L, n: lv.n + 1 }
    n = lv.n
    keep('levels', lv)
  }
  if (!items.length) return
  const queue = picked.map(i => ({ i, kind: Words.questionType(items[i], Math.random, Banks.soundsLike(items[i].w)) }))
  S = { source, items, queue, pos: 0, n, right: 0, asked: 0, newStars: [], again: [] }
  if (speech) pickVoice() // voices can arrive late; pick again now they're surely loaded
  show('play')
  ask()
}

/** Saves this kid's progress after an answer: that also tells Kinwall they're still practicing. */
function persist() {
  const src = S.source
  if (src.kind === 'list') return keep(`list-${src.list.id}`, src.list)
  const w = S.word // one value per level, so a save stays small
  prog[w.lv][w.w] = [w.r, w.t]
  return keep(`level-${w.lv}`, { w: prog[w.lv] })
}

function ask() {
  if (S.pos >= S.queue.length) return finish()
  const entry = S.queue[S.pos]
  const word = S.items[entry.i]
  S.entry = entry
  S.tries = 0
  S.word = word
  if (!entry.retry) word.t = S.n
  el('count').textContent = `${Math.min(S.asked + 1, S.queue.filter(q => !q.retry).length)} of ${S.queue.filter(q => !q.retry).length}`
  for (const id of ['q-type', 'q-pick', 'q-fill', 'q-fix']) el(id).hidden = true
  el('feedback').textContent = ''
  el('feedback').className = 'feedback'
  el('next').hidden = true
  el('sentence').hidden = !word.s
  if (entry.kind === 'type') {
    el('ask').textContent = entry.retry ? "Let's try this one again. Spell the word you hear." : 'Spell the word you hear'
    el('q-type').hidden = false
    const input = el('spell')
    input.value = ''
    input.disabled = false
    input.focus()
  } else if (entry.kind === 'pick') {
    el('ask').textContent = 'Which spelling is right?'
    const box = el('q-pick')
    box.hidden = false
    box.textContent = ''
    const options = Words.shuffle([word.w, ...Words.distractors(word.w, 3, Math.random, Banks.soundsLike(word.w))])
    for (const o of options) {
      const b = button('choice', esc(o), () => pick(b, o))
      b.lang = 'en'
      box.append(b)
    }
  } else {
    el('ask').textContent = 'Fill in the missing letters'
    el('q-fill').hidden = false
    renderTiles(word.w, Words.blanks(word.w))
  }
  syncKeyboard()
  sayWord()
}

/** Says the word. A word that sounds like another (their, there) only points at its sentence button,
 * which the kid taps when they want it. */
function sayWord() {
  const word = S.word
  el('sentence').classList.toggle('nudge', !!word.s && Banks.soundsLike(word.w).length > 0)
  return say(word.w, { word: true })
}
el('say').onclick = () => say(S.word.w, { word: true })
el('sentence').onclick = () => say(S.word.s)

/** The first try at each question counts toward the word's stars; a miss brings the word back later. */
function scored(right) {
  if (S.tries++ > 0 || S.entry.retry) { persist(); return }
  const w = S.word
  const was = Words.mastered(w.r)
  w.r = Words.record(w.r, right)
  S.asked++
  if (right) S.right++
  if (right && !was && Words.mastered(w.r)) S.newStars.push(w.w)
  if (!right) {
    if (!S.again.includes(w.w)) S.again.push(w.w)
    S.queue.splice(Math.min(S.pos + 3, S.queue.length), 0, { i: S.entry.i, kind: 'type', retry: true })
  }
  persist()
}

async function correct() {
  scored(true)
  el('feedback').textContent = '✓ ' + pickFrom(PRAISE)
  el('feedback').className = 'feedback good'
  const done = S.entry
  await Promise.all([say(lastPraise), sleep(1100)])
  if (S && S.entry === done && screen === 'play') { S.pos++; ask() }
}


// The game's keyboard (touch screens). Typing goes to the focused answer box; inputmode="none" keeps the
// system keyboard, and its word suggestions, closed.
const touch = matchMedia('(pointer: coarse)').matches
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
let typingIn = null // the answer box the keys type into
document.addEventListener('focusin', e => { if (e.target.matches?.('.spell, input.tile')) typingIn = e.target })
function noSystemKeyboard(input) { if (touch) input.setAttribute('inputmode', 'none') }
noSystemKeyboard(el('spell')); noSystemKeyboard(el('fix-spell'))

function press(key) {
  const input = typingIn
  if (!input || input.disabled) return
  if (key === 'enter') return input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  if (key === 'back') {
    if (!input.value) return input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    input.value = input.value.slice(0, -1)
  } else input.value = input.maxLength === 1 ? key : input.value + key
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Shows the keys while a typed answer is asked for; extra keys for a word's apostrophe or hyphen. */
function syncKeyboard() {
  const box = el('kbd')
  box.hidden = !touch || !['q-type', 'q-fill', 'q-fix'].some(id => !el(id).hidden)
  if (box.hidden) return fitRoom()
  const extra = [...new Set((S?.word?.w || '').toLowerCase().replace(/[a-z]/g, ''))].join('')
  const rows = [ROWS[0], ROWS[1], ROWS[2] + extra]
  box.innerHTML = rows.map((r, i) => `<div class="kbd-row">${i === 2 ? '<button class="key wide" data-k="back" aria-label="Delete">⌫</button>' : ''}${[...r].map(c => `<button class="key" data-k="${esc(c)}">${esc(c)}</button>`).join('')}${i === 2 ? '<button class="key wide go-key" data-k="enter">Check</button>' : ''}</div>`).join('')
  fitRoom()
}
/** How much room is left above the keys: "short" and "tiny" layouts (style.css) shrink the question to fit. */
function fitRoom() {
  const keys = el('kbd').hidden ? 0 : el('kbd').offsetHeight
  document.querySelector('main').style.paddingBottom = keys ? `${keys + 8}px` : ''
  const room = innerHeight - keys
  document.documentElement.dataset.room = room < 300 ? 'short tiny' : room < 460 ? 'short' : ''
}
addEventListener('resize', fitRoom)
fitRoom()
// pointerdown, not click: the answer box keeps its focus (and caret) while a key is pressed.
el('kbd').addEventListener('pointerdown', e => { const k = e.target.closest('.key'); if (!k) return; e.preventDefault(); press(k.dataset.k) })
el('kbd').addEventListener('click', e => { if (e.detail === 0) { const k = e.target.closest('.key'); if (k) press(k.dataset.k) } }) // keyboard/switch access

// Type it
function checkTyped() {
  const input = el('spell')
  const typed = input.value.trim()
  if (!typed) return input.focus()
  if (Words.same(typed, S.word.w)) { input.disabled = true; return correct() }
  scored(false)
  // Show their try over the word, letter by letter, then have them type it right.
  const d = Words.diff(typed, S.word.w)
  const paint = (box, letters, cls) => { box.innerHTML = letters.map(x => `<span class="${x.ok ? '' : cls}">${esc(x.ch)}</span>`).join('') }
  paint(el('fix-try'), d.attempt, 'miss')
  paint(el('fix-word'), d.word, 'fixed')
  el('ask').textContent = 'Almost! Here is how it\'s spelled.'
  el('q-type').hidden = true
  el('q-fix').hidden = false
  syncKeyboard()
  const fix = el('fix-spell')
  fix.value = ''
  fix.focus()
  say(S.word.w, { word: true })
}
function checkFix() {
  const fix = el('fix-spell')
  if (Words.same(fix.value, S.word.w)) {
    el('feedback').textContent = '✓ That\'s it! It will come back later for another try.'
    el('feedback').className = 'feedback good'
    persist()
    const done = S.entry
    say('That\'s it!').then(() => sleep(600)).then(() => { if (S && S.entry === done && screen === 'play') { S.pos++; ask() } })
  } else {
    el('feedback').textContent = 'Not quite. Look at the word above and try again.'
    el('feedback').className = 'feedback'
    fix.focus()
  }
}
el('spell-go').onclick = checkTyped
el('spell').onkeydown = e => { if (e.key === 'Enter') checkTyped() }
el('fix-go').onclick = checkFix
el('fix-spell').onkeydown = e => { if (e.key === 'Enter') checkFix() }

// Pick it
function pick(b, option) {
  if (b.classList.contains('right')) return
  if (Words.same(option, S.word.w)) {
    b.classList.add('right')
    for (const other of el('q-pick').children) other.disabled = true
    return correct()
  }
  scored(false)
  b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong')
  b.disabled = true
  el('feedback').textContent = 'Not that one. Listen again and try another.'
  say(S.word.w, { word: true })
}

// Fill in the missing letters
function renderTiles(word, hidden) {
  const box = el('tiles')
  box.textContent = ''
  ;[...word].forEach((ch, i) => {
    if (!hidden.includes(i)) { box.insertAdjacentHTML('beforeend', `<span class="tile">${esc(ch)}</span>`); return }
    const input = document.createElement('input')
    Object.assign(input, { className: 'tile blank', maxLength: 1, autocomplete: 'off', spellcheck: false })
    input.setAttribute('autocorrect', 'off')
    input.setAttribute('autocapitalize', 'off')
    noSystemKeyboard(input)
    input.setAttribute('aria-label', `Missing letter ${hidden.indexOf(i) + 1} of ${hidden.length}`)
    input.dataset.i = i
    input.oninput = () => {
      input.value = input.value.slice(-1)
      input.classList.remove('miss')
      const blanks = [...box.querySelectorAll('input')]
      const next = blanks.slice(blanks.indexOf(input) + 1).find(x => !x.value)
      if (input.value && next) next.focus()
    }
    input.onkeydown = e => {
      if (e.key === 'Enter') checkFill()
      if (e.key === 'Backspace' && !input.value) { const blanks = [...box.querySelectorAll('input')]; blanks[blanks.indexOf(input) - 1]?.focus() }
    }
    box.append(input)
  })
  box.querySelector('input')?.focus()
}
function checkFill() {
  const blanks = [...el('tiles').querySelectorAll('input')]
  const empty = blanks.find(x => !x.value)
  if (empty) return empty.focus()
  const wrong = blanks.filter(x => x.value.toLowerCase() !== S.word.w[x.dataset.i].toLowerCase())
  if (!wrong.length) { blanks.forEach(x => { x.disabled = true; x.classList.add('ok') }); return correct() }
  scored(false)
  if (S.tries >= 2) { // shown, not tested: fill it in and move on
    blanks.forEach(x => { x.value = S.word.w[x.dataset.i]; x.disabled = true; x.classList.toggle('shown', wrong.includes(x)) })
    el('feedback').textContent = 'Here it is. This word will come back later.'
    el('next').hidden = false
    el('next').focus()
    return say(S.word.w, { word: true })
  }
  wrong.forEach(x => { x.value = ''; x.classList.add('miss') })
  wrong[0].focus()
  el('feedback').textContent = 'Some letters need another look. Try again.'
  say(S.word.w, { word: true })
}
el('fill-go').onclick = checkFill
el('next').onclick = () => { S.pos++; ask() }

// The end
function finish() {
  const name = ctx.member ? `, ${ctx.member.name}` : ''
  el('done-title').textContent = `Nice practicing${name}!`
  el('done-text').textContent = `You spelled ${S.asked} word${S.asked === 1 ? '' : 's'}, and got ${S.right} right the first time.` +
    (S.newStars.length ? ` New ⭐ word${S.newStars.length === 1 ? '' : 's'}:` : S.again.length ? ' Words to keep practicing:' : '')
  const box = el('done-words')
  box.innerHTML = (S.newStars.length ? S.newStars : S.again).map(w => `<span class="chip${S.newStars.length ? ' strong' : ''}">${esc(w)}</span>`).join('')
  // Enough of this level has stars: the next one opens.
  const L = S.source.kind === 'level' ? S.source.level : 0
  const after = L ? Words.afterSession(lv, L, LV[L - 1].words, prog[L], LV.length) : { opened: false }
  el('unlocked').hidden = !after.opened
  if (after.opened) {
    lv = { ...lv, open: after.open }
    keep('levels', lv)
    el('unlocked-title').textContent = `Level ${after.open} is open!`
    el('unlocked-go').textContent = `Try Level ${after.open}`
    el('unlocked-go').onclick = () => openLevel(after.open)
  }
  show('done')
  say(after.opened ? `Nice practicing${name}! Level ${after.open} is open!` : `Nice practicing${name}!`)
}
el('again').onclick = () => startSession(S.source)
el('done-home').onclick = home

// ---------- For parents: lists ----------
function renderEdit() {
  el('edit-title').textContent = ctx.member ? `Spelling for ${ctx.member.name}` : 'Spelling'
  renderLevelSettings()
  const box = el('edit-lists')
  box.textContent = ''
  const sorted = Words.sortLists(lists)
  if (!sorted.length) box.innerHTML = '<p class="dim">No lists yet. Add this week\'s words, or pick some from a grade.</p>'
  for (const l of sorted) {
    box.append(button('edit-row' + (l.archived ? ' archived' : ''), `<span>${esc(listName(l))}</span><small>${l.words.length} words${l.archived ? ' · archived' : ''}</small>`, () => openList(l)))
  }
}
el('new-list').onclick = () => openList(null)

// Grown-ups choose which levels are open, with the grade each is about (kids never see grades).
const gradeName = g => Banks.BANKS.find(b => b.grade === g).name
function renderLevelSettings() {
  const sel = el('f-open')
  sel.innerHTML = LV.map(l => `<option value="${l.level}"${l.level < lv.cur ? ' disabled' : ''}>Level ${l.level} (about ${gradeName(l.grade)})</option>`).join('')
  sel.value = lv.open
  el('f-mix').checked = lv.mix
  const who = ctx.member ? ctx.member.name : 'This player'
  el('f-open-hint').textContent = `Levels 1–2 ≈ 1st grade, 3–4 ≈ 2nd, 5–6 ≈ 3rd, 7–8 ≈ 4th, 9–10 ≈ 5th. ${who} is on Level ${lv.cur}, so it stays open. ` +
    `A level also opens the next one by itself once ${Math.round(Words.UNLOCK * 100)}% of its words have ⭐.`
}
el('f-open').onchange = () => { lv = Words.cleanSettings({ ...lv, open: Number(el('f-open').value) }, LV.length); keep('levels', lv); renderLevelSettings() }
el('f-mix').onchange = () => { lv = { ...lv, mix: el('f-mix').checked }; keep('levels', lv) }

let editing = null // the list being edited, or a new one
let sentences = {} // word (lowercase) -> sentence typed so far
function openList(l) {
  editing = l
  el('editlist-title').textContent = l ? 'Edit list' : 'New list'
  el('f-title').value = l?.title || ''
  el('f-test').value = l?.test || ''
  el('f-words').value = l ? Words.listText(l) : ''
  sentences = Object.fromEntries((l?.words || []).map(w => [w.w.toLowerCase(), w.s]))
  el('f-error').textContent = ''
  el('f-archive').hidden = !l
  el('f-archive').textContent = l?.archived ? 'Bring back' : 'Archive'
  el('f-delete').hidden = !l
  el('f-delete').textContent = 'Delete'
  el('from-bank').open = !l
  renderSentences()
  renderBankPick()
  show('editlist')
}

// The words box's text: words, and category headings (Words.parseListText).
const typed = () => Words.parseListText(el('f-words').value)
function renderSentences() {
  const parsed = typed()
  el('f-sentences-box').hidden = !parsed.words.length
  const box = el('f-sentences')
  box.textContent = ''
  for (const entry of parsed.words) {
    const w = entry.w
    const k = w.toLowerCase()
    if (sentences[k] === undefined && Banks.SENTENCES[k]) sentences[k] = Banks.SENTENCES[k]
    const label = document.createElement('label')
    label.innerHTML = `<span>${esc(w)}</span>`
    const input = document.createElement('input')
    Object.assign(input, { type: 'text', maxLength: 200, value: sentences[k] || '', placeholder: `A sentence with "${w}"` })
    input.oninput = () => { sentences[k] = input.value }
    label.append(input)
    if (parsed.categories.length) { // move the word to another category: rewrites the words box
      const sel = document.createElement('select')
      sel.setAttribute('aria-label', `Category for ${w}`)
      sel.innerHTML = '<option value="">No category</option>' + parsed.categories.map((c, i) => `<option value="${i}">${esc(c.name)}</option>`).join('')
      sel.value = entry.c === undefined ? '' : String(entry.c)
      sel.onchange = () => {
        const words = parsed.words.map(e => (e === entry ? (sel.value === '' ? { w: e.w } : { w: e.w, c: Number(sel.value) }) : e))
        // Keep every category, even one this empties, until the list is saved.
        el('f-words').value = Words.listText({ words, categories: parsed.categories }) + parsed.categories.filter((c, i) => !words.some(e => e.c === i)).map(c => `\n\n${c.name}:`).join('')
        renderSentences()
      }
      label.append(sel)
    }
    box.append(label)
  }
}
el('f-words').oninput = () => { clearTimeout(el('f-words').t); el('f-words').t = setTimeout(renderSentences, 400) }

function renderBankPick() {
  const g = el('f-grade')
  if (!g.options.length) {
    g.innerHTML = Banks.BANKS.map(b => `<option value="${b.grade}">${b.name}</option>`).join('')
    g.value = LV[lv.cur - 1].grade
  }
  const bank = Banks.BANKS.find(b => b.grade === Number(g.value))
  const p = el('f-pattern')
  const keepPattern = p.value
  p.innerHTML = bank.patterns.map(([name]) => `<option>${esc(name)}</option>`).join('')
  if (bank.patterns.some(([name]) => name === keepPattern)) p.value = keepPattern
  const have = typed().words.map(e => e.w.toLowerCase())
  const box = el('f-bank-words')
  box.textContent = ''
  for (const w of bank.patterns.find(([name]) => name === p.value)[1].split(' ')) {
    const on = have.includes(w.toLowerCase())
    const b = button('chip pickable' + (on ? ' strong' : ''), (on ? '✓ ' : '＋ ') + esc(w), () => {
      // Added at the end (in the last category, if any); removed from wherever it is.
      const text = el('f-words').value
      el('f-words').value = on
        ? text.split('\n').map(line => (/^#+\s|:\s*$/.test(line.trim()) ? line : line.split(/[,;]/).filter(x => !Words.same(x, w)).join(','))).join('\n')
        : `${text.replace(/\s*$/, '')}\n${w}`.replace(/^\n/, '')
      renderSentences()
      renderBankPick()
    })
    b.setAttribute('aria-pressed', on)
    box.append(b)
  }
}
el('f-grade').onchange = () => { el('f-pattern').value = ''; renderBankPick() }
el('f-pattern').onchange = renderBankPick

el('f-save').onclick = async () => {
  const parsed = typed()
  if (!parsed.words.length) { el('f-error').textContent = 'Add at least one word.'; return el('f-words').focus() }
  const l = editing || { id: Date.now().toString(36), created: Date.now(), archived: false, n: 0, words: [] }
  if (!editing && lists.length >= 90) { el('f-error').textContent = 'That\'s a lot of lists! Delete an old one first.'; return }
  // Categories keep the rule text they came with (from an app that sent the list), matched by name.
  const categories = parsed.categories.map(c => ({ ...(l.categories || []).find(o => Words.same(o.name, c.name)), name: c.name }))
  const next = { ...l, title: el('f-title').value.trim().slice(0, 40), test: el('f-test').value || '', words: Words.buildWords(parsed.words, l.words, w => sentences[w.toLowerCase()] || '') }
  if (categories.length) next.categories = categories
  else delete next.categories
  el('f-save').disabled = true
  try {
    await save(`list-${next.id}`, next)
    lists = [...lists.filter(x => x.id !== next.id), next]
    renderEdit()
    show('edit')
  } catch (e) {
    el('f-error').textContent = e.message === 'too big' ? 'This list is too long to save. Try fewer words or shorter sentences.' : 'Couldn\'t save just now. Check the connection and try again.'
  } finally { el('f-save').disabled = false }
}
el('f-archive').onclick = async () => {
  const next = { ...editing, archived: !editing.archived }
  try { await save(`list-${next.id}`, next); lists = lists.map(x => (x.id === next.id ? next : x)); renderEdit(); show('edit') } catch { el('f-error').textContent = 'Couldn\'t save just now. Try again.' }
}
el('f-delete').onclick = async () => {
  const b = el('f-delete')
  if (b.textContent === 'Delete') { b.textContent = 'Tap again to delete'; return } // an in-page confirm (no dialogs in a plugin)
  try { await Kinwall.save(`list-${editing.id}`, null); lists = lists.filter(x => x.id !== editing.id); renderEdit(); show('edit') } catch { el('f-error').textContent = 'Couldn\'t delete just now. Try again.' }
}

// Who may edit: Kinwall says whether this is a parent's device (ctx.parent). Older Kinwall doesn't
// say, so then it's behind a two-second hold: it keeps casual taps out; it isn't a lock.
const openEdit = () => { renderEdit(); show('edit') }
el('edit-lists-btn').onclick = openEdit
;(function hold() {
  const b = el('hold-btn')
  let timer = null
  const start = e => { if (timer) return; e.preventDefault?.(); b.classList.add('holding'); timer = setTimeout(() => { stop(); openEdit() }, 2000) }
  const stop = () => { clearTimeout(timer); timer = null; b.classList.remove('holding') }
  b.addEventListener('pointerdown', start)
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop)
  b.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start(e) })
  b.addEventListener('keyup', stop)
  b.addEventListener('contextmenu', e => e.preventDefault()) // a long press isn't a right-click
})()

// ---------- Start ----------
Kinwall.ready().then(async c => {
  ctx = c
  canTalk = !!speech || ctx.canSpeak === true
  el('who').textContent = ctx.member ? `${ctx.member.avatar || ''} ${ctx.member.name}` : ''
  if (ctx.reducedMotion) document.documentElement.dataset.reducedMotion = ''
  document.documentElement.dataset.textScale = ctx.textScale || 'm'
  el('edit-lists-btn').hidden = ctx.parent !== true
  el('hold-btn').hidden = ctx.parent !== undefined
  const saved = await Kinwall.load().catch(() => ({}))
  lists = Object.entries(saved).filter(([k, v]) => k.startsWith('list-') && v && Array.isArray(v.words)).map(([, v]) => v)
  // Levels, from level-<L> values and older bank-<grade> ones: stars already earned count, and a kid
  // who already passed levels starts with them open.
  prog = Words.levelProgress(saved, LV)
  lv = Words.cleanSettings(saved.levels, LV.length, Words.earnedOpen(LV, prog))
  if (!saved.levels) lv.n = Math.max(0, ...Object.entries(saved).filter(([k, v]) => /^bank-\d+$/.test(k) && v).map(([, v]) => v.n || 0))
  home()
  applyActions()
  Kinwall.onActions(applyActions)
})

// ---------- Actions ----------
// Lists other apps sent through Kinwall for this kid (an assistant: "add Maya's words for Friday"),
// declared in kinwall-plugin.json. Words.applyAction checks the input and merges, so one that
// arrives twice changes nothing more; it's marked done once saved, or dropped if it can't be used.
let applying = false
async function applyActions() {
  if (applying) return
  applying = true
  try {
    for (const a of await Kinwall.actions()) {
      try {
        for (const l of Words.applyAction(lists, a)) {
          await save(`list-${l.id}`, l)
          lists = [...lists.filter(x => x.id !== l.id), l]
        }
        await Kinwall.done(a.id)
      } catch (e) {
        if (e.message === 'too big') await Kinwall.done(a.id).catch(() => {}) // can never fit: drop it
        // otherwise offline: it's still waiting next time
      }
    }
    if (screen === 'home') renderHome()
    else if (screen === 'edit') renderEdit()
  } finally { applying = false }
}
