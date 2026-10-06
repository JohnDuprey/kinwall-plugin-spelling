// Spelling practice: Kinwall says a word (never shows it) and the child spells it: typing it, picking
// the right spelling, or filling in missing letters. Words come from lists a parent sets up for this
// kid, or from the built-in grade banks (banks.js). Word logic lives in words.js.
//
// Saved for whoever is playing:
//   list-<id>  { id, title, test, archived, created, n, words: [{ w, s, r, t }] }  one per list
//   bank-<g>   { n, w: { word: [r, t] } }  progress in grade g's bank (only words already asked)
//   prefs      { grade }
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
let banks = {} // grade -> { n, w }
let prefs = { grade: 2 }
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
const SCREENS = ['home', 'nospeech', 'grade', 'play', 'done', 'edit', 'editlist']
const BACK = { grade: 'home', play: 'home', done: 'home', edit: 'home', editlist: 'edit' }
let screen = 'home'
function show(name) {
  screen = name
  for (const s of SCREENS) el(s).hidden = s !== name
  el('back').hidden = !BACK[name]
  el('count').textContent = ''
  el('grownups').hidden = !['home', 'nospeech'].includes(name) || ctx.parent === false
  if (name !== 'play') { turn++; if (speech) speech.cancel(); else if (ctx.canSpeak) Kinwall.stopSpeaking() }
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
    card.querySelector('.list-head').append(button('go', 'Practice', () => startSession({ kind: 'list', list: l })))
    if (k === 0) { // the newest list: each word and how close it is to mastered
      const chips = document.createElement('div')
      chips.className = 'word-chips'
      for (const w of l.words) chips.insertAdjacentHTML('beforeend', `<span class="chip${Words.mastered(w.r) ? ' strong' : ''}">${esc(w.w)} <span class="marks" aria-label="${Math.min(w.r || 0, 3)} of 3">${stars(w.r)}</span></span>`)
      card.append(chips)
    }
    box.append(card)
  }
  if (!mine.length) box.innerHTML = `<p class="dim">${ctx.parent === false ? 'No spelling list yet. A grown-up can add one from their phone.' : 'No spelling list yet. Practice a grade below, or a grown-up can add this week\'s words.'}</p>`
  const grades = el('grades')
  grades.textContent = ''
  for (const b of Banks.BANKS) grades.append(button('grade-btn' + (b.grade === prefs.grade ? ' last' : ''), `${b.name.replace(' grade', '')}<small>grade</small>`, () => openGrade(b.grade)))
}

// ---------- Grade banks ----------
const bankOf = g => (banks[g] = banks[g] || { n: 0, w: {} })
/** A bank's words as practice items, with this kid's progress. */
function bankItems(g, pattern) {
  const p = bankOf(g)
  return Banks.BANKS.find(b => b.grade === g).patterns
    .filter(([name]) => !pattern || name === pattern)
    .flatMap(([, words]) => words.split(' ').map(w => {
      const [r, t] = p.w[w] || [0, 0]
      return { w, s: Banks.SENTENCES[w.toLowerCase()] || '', r, t }
    }))
}

function openGrade(g) {
  if (prefs.grade !== g) { prefs = { ...prefs, grade: g }; keep('prefs', prefs) }
  const bank = Banks.BANKS.find(b => b.grade === g)
  el('grade-title').textContent = bank.name
  const box = el('patterns')
  box.textContent = ''
  const count = items => `${items.filter(w => Words.mastered(w.r)).length} of ${items.length} ⭐`
  const all = bankItems(g)
  box.append(button('pattern all', `<span>Mix of everything</span><small>${count(all)}</small>`, () => startSession({ kind: 'bank', grade: g })))
  for (const [name] of bank.patterns) {
    const items = bankItems(g, name)
    box.append(button('pattern', `<span>${esc(name)}</span><small>${count(items)}</small>`, () => startSession({ kind: 'bank', grade: g, pattern: name })))
  }
  show('grade')
}

// ---------- A session ----------
let S = null // { source, items, queue, pos, n, right, firstTries, newStars, entry, tries }

function startSession(source) {
  const items = source.kind === 'list' ? source.list.words : bankItems(source.grade, source.pattern)
  if (!items.length) return
  const holder = source.kind === 'list' ? source.list : bankOf(source.grade)
  holder.n = (holder.n || 0) + 1
  const queue = Words.pickSession(items).map(i => ({ i, kind: Words.questionType(items[i], Math.random, Banks.soundsLike(items[i].w)) }))
  S = { source, items, queue, pos: 0, n: holder.n, right: 0, asked: 0, newStars: [], again: [] }
  if (speech) pickVoice() // voices can arrive late; pick again now they're surely loaded
  show('play')
  ask()
}

/** Saves this kid's progress after an answer: that also tells Kinwall they're still practicing. */
function persist() {
  const src = S.source
  if (src.kind === 'list') return keep(`list-${src.list.id}`, src.list)
  const p = bankOf(src.grade)
  for (const w of S.items) if (w.t) p.w[w.w] = [w.r, w.t]
  return keep(`bank-${src.grade}`, p)
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
  sayWord()
}

/** The word; then its sentence too when it sounds like another word (their, there). */
async function sayWord() {
  const word = S.word
  await say(word.w, { word: true })
  if (word.s && Banks.soundsLike(word.w).length && S.word === word && screen === 'play') { await sleep(300); if (S.word === word) say(word.s) }
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
  show('done')
  say(`Nice practicing${name}!`)
}
el('again').onclick = () => startSession(S.source)
el('done-home').onclick = home

// ---------- For parents: lists ----------
function renderEdit() {
  el('edit-title').textContent = ctx.member ? `${ctx.member.name}'s spelling lists` : 'Spelling lists'
  const box = el('edit-lists')
  box.textContent = ''
  const sorted = Words.sortLists(lists)
  if (!sorted.length) box.innerHTML = '<p class="dim">No lists yet. Add this week\'s words, or pick some from a grade.</p>'
  for (const l of sorted) {
    box.append(button('edit-row' + (l.archived ? ' archived' : ''), `<span>${esc(listName(l))}</span><small>${l.words.length} words${l.archived ? ' · archived' : ''}</small>`, () => openList(l)))
  }
}
el('new-list').onclick = () => openList(null)

let editing = null // the list being edited, or a new one
let sentences = {} // word (lowercase) -> sentence typed so far
function openList(l) {
  editing = l
  el('editlist-title').textContent = l ? 'Edit list' : 'New list'
  el('f-title').value = l?.title || ''
  el('f-test').value = l?.test || ''
  el('f-words').value = l ? l.words.map(w => w.w).join('\n') : ''
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

function renderSentences() {
  const words = Words.parseWords(el('f-words').value)
  el('f-sentences-box').hidden = !words.length
  const box = el('f-sentences')
  box.textContent = ''
  for (const w of words) {
    const k = w.toLowerCase()
    if (sentences[k] === undefined && Banks.SENTENCES[k]) sentences[k] = Banks.SENTENCES[k]
    const label = document.createElement('label')
    label.innerHTML = `<span>${esc(w)}</span>`
    const input = document.createElement('input')
    Object.assign(input, { type: 'text', maxLength: 200, value: sentences[k] || '', placeholder: `A sentence with "${w}"` })
    input.oninput = () => { sentences[k] = input.value }
    label.append(input)
    box.append(label)
  }
}
el('f-words').oninput = () => { clearTimeout(el('f-words').t); el('f-words').t = setTimeout(renderSentences, 400) }

function renderBankPick() {
  const g = el('f-grade')
  if (!g.options.length) {
    g.innerHTML = Banks.BANKS.map(b => `<option value="${b.grade}">${b.name}</option>`).join('')
    g.value = prefs.grade
  }
  const bank = Banks.BANKS.find(b => b.grade === Number(g.value))
  const p = el('f-pattern')
  const keepPattern = p.value
  p.innerHTML = bank.patterns.map(([name]) => `<option>${esc(name)}</option>`).join('')
  if (bank.patterns.some(([name]) => name === keepPattern)) p.value = keepPattern
  const have = Words.parseWords(el('f-words').value).map(w => w.toLowerCase())
  const box = el('f-bank-words')
  box.textContent = ''
  for (const w of bank.patterns.find(([name]) => name === p.value)[1].split(' ')) {
    const on = have.includes(w.toLowerCase())
    const b = button('chip pickable' + (on ? ' strong' : ''), (on ? '✓ ' : '＋ ') + esc(w), () => {
      const list = Words.parseWords(el('f-words').value)
      const next = on ? list.filter(x => !Words.same(x, w)) : [...list, w]
      el('f-words').value = next.join('\n')
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
  const names = Words.parseWords(el('f-words').value)
  if (!names.length) { el('f-error').textContent = 'Add at least one word.'; return el('f-words').focus() }
  const l = editing || { id: Date.now().toString(36), created: Date.now(), archived: false, n: 0, words: [] }
  if (!editing && lists.length >= 90) { el('f-error').textContent = 'That\'s a lot of lists! Delete an old one first.'; return }
  const next = { ...l, title: el('f-title').value.trim().slice(0, 40), test: el('f-test').value || '', words: Words.mergeWords(names, l.words, names.map(w => sentences[w.toLowerCase()] || '')) }
  // keep each word's last-asked session too
  next.words.forEach(w => { const was = l.words.find(o => Words.same(o.w, w.w)); if (was?.t) w.t = was.t })
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
  for (const [k, v] of Object.entries(saved)) if (/^bank-\d$/.test(k) && v && v.w) banks[k.slice(5)] = v
  if (saved.prefs) prefs = { ...prefs, ...saved.prefs }
  home()
})
