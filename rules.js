// Spelling practice: "Apply the rule". A school list often groups words by a suffix rule ("Double the
// consonant", "Drop the e, then add -ing", "Just add -ing"), and the test gives new words to apply the
// rules to. This file is the pure part: the suffix rules, detecting a list word's base and rule, a
// category's rule, built-in base words per rule, and picking them for a session. No DOM, no saving,
// so test/rules.test.js runs it under node.
//
// Suffixes: 'ing', 'ed', 'er', 'est' and 's' (which is -es after s, x, z, ch, sh). Rules:
//   double    one syllable, one short vowel, one last consonant (not w, x, y): hop → hopping
//   drop-e    a final e goes before a vowel suffix: hope → hoping, bake → baked, nice → nicer
//   y-to-i    consonant + y: cry → cried, happy → happier, baby → babies (but crying)
//   ie-y      ie becomes y before -ing: lie → lying
//   es        s, x, z, ch, sh: box → boxes
//   just-add  nothing changes: jump → jumping, play → played, see → seeing, cry → crying
// Not handled (on purpose): doubling a stressed last syllable (begin → beginning), -c → -ck
// (picnicking), irregular forms (ran, said). Base words that need them stay out of BANK.
;(function (root) {
  const W = typeof module !== 'undefined' && module.exports ? require('./words.js') : root.Words
  const SUFFIXES = ['ing', 'ed', 'er', 'est', 's']
  const LEARNED = 5 // different new words right the first time: the rule is learned

  const syllables = w => (w.replace(/^y/, 'j').replace(/qu/g, 'qw').match(/[aeiouy]+/g) || []).length
  /** One syllable ending consonant, single vowel, consonant (not w, x, y; not c or h): double it. */
  const doubles = w => syllables(w) === 1 && /[^aeiou][aeiou][bdfgklmnprstvz]$/.test(w.replace(/^y/, 'j').replace(/qu/g, 'qw'))

  /** The base with a suffix added: { word, rule }. */
  function form(base, suffix) {
    const b = base.toLowerCase()
    if (suffix === 's') {
      if (/(s|x|z|ch|sh)$/.test(b)) return { word: b + 'es', rule: 'es' }
      if (/[^aeiou]y$/.test(b)) return { word: b.slice(0, -1) + 'ies', rule: 'y-to-i' }
      return { word: b + 's', rule: 'just-add' }
    }
    if (suffix === 'ing' && /ie$/.test(b)) return { word: b.slice(0, -2) + 'ying', rule: 'ie-y' }
    if (/e$/.test(b)) {
      if (suffix !== 'ing') return { word: b + suffix.slice(1), rule: 'drop-e' }
      if (/[eyo]e$/.test(b)) return { word: b + suffix, rule: 'just-add' } // seeing, dyeing, toeing
      return { word: b.slice(0, -1) + suffix, rule: 'drop-e' }
    }
    if (/[^aeiou]y$/.test(b) && suffix !== 'ing') return { word: b.slice(0, -1) + 'i' + suffix, rule: 'y-to-i' }
    if (doubles(b)) return { word: b + b.slice(-1) + suffix, rule: 'double' }
    return { word: b + suffix, rule: 'just-add' }
  }
  const add = (base, suffix) => form(base, suffix).word

  /** A list word's base, suffix and rule (swimming → swim, ing, double), or null. Without a
   *  dictionary some words read two ways (jumping: jump or "jumpe"), so the likeliest base wins;
   *  `prefer` (a category's rule) wins ties with it. */
  function analyze(word, prefer) {
    const w = String(word).trim().toLowerCase()
    if (!/^[a-z]+$/.test(w)) return null
    const found = []
    for (const suffix of SUFFIXES) {
      if (!w.endsWith(suffix)) continue
      const st = w.slice(0, -suffix.length)
      const bases = suffix === 's' ? [st, w.slice(0, -2), w.slice(0, -3) + 'y'] : [st, st + 'e', st.slice(0, -1), st.slice(0, -1) + 'y', st.slice(0, -1) + 'ie']
      for (const base of new Set(bases)) {
        if (base.length < 3 || !/[aeiouy]/.test(base.replace(/e$/, ''))) continue
        const f = form(base, suffix)
        if (f.word === w) found.push({ base, suffix, rule: f.rule })
      }
    }
    const rank = x => {
      if (prefer && x.rule === prefer) return 0
      if (x.rule === 'double') return /[slfz]$/.test(x.base) ? 5 : 1 // dress, fill, puff, buzz end that way already
      if (x.rule === 'es') return /(x|ch|sh|ss|zz)$/.test(x.base) ? 1 : 4 // horses: horse, not "hors"
      if (x.rule === 'drop-e') return /([^s]s|[^z]z|v|c|u|dg|[bcdfgkpstz]l)$/.test(x.base.slice(0, -1)) ? 2 : 4 // dancing, using, giving, giggling
      if (x.rule === 'ie-y') return 4 // crying: cry, not "crie"; lying has no other reading
      return x.rule === 'just-add' ? 3 : 1
    }
    return found.sort((a, b) => rank(a) - rank(b))[0] || null
  }

  // ---------- Categories ----------
  /** The rule a heading or a teacher's rule text names, if any. */
  function textRule(text) {
    const t = text.toLowerCase()
    if (/doubl/.test(t)) return 'double'
    if (/change (the )?y|\by\b[^.]*\bto i\b|\by\b\s*(→|->)\s*i\b/.test(t)) return 'y-to-i'
    if (/drop|silent e|take off the e|lose the e/.test(t)) return 'drop-e'
    if (/(^|[\s(])-es\b|add es\b/.test(t)) return 'es'
    if (/just add|simply add|nothing changes|no change/.test(t)) return 'just-add'
    return null
  }
  const textSuffix = text => {
    const m = /(?:^|[\s(])-\s?(ing|ed|er|est|es|s)\b|\badd (ing|ed|er|est|es)\b/i.exec(text)
    const s = m && (m[1] || m[2]).toLowerCase()
    return s === 'es' ? 's' : s
  }
  const most = list => {
    const n = new Map()
    for (const x of list) n.set(x, (n.get(x) || 0) + 1)
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0]
  }

  /** A category's rule as 'suffix-rule' ('ing-double'), from its name and rule text, else from most
   *  of its words; null when it isn't a suffix rule this game has new words for. */
  function categoryRule(cat, words) {
    const text = `${cat.name || ''}. ${cat.rule || ''}`
    const hint = textRule(text)
    const found = words.map(w => analyze(w, hint)).filter(Boolean)
    const half = n => n * 2 > words.length
    const [suf, sufN] = most(found.map(f => f.suffix))
    const suffix = textSuffix(text) || (half(sufN) ? suf : null)
    const [rule, ruleN] = most(found.filter(f => f.suffix === suffix).map(f => f.rule))
    const id = hint || (half(ruleN) ? rule : null)
    return suffix && id && BANK[suffix] && BANK[suffix][id] ? `${suffix}-${id}` : null
  }
  /** The list with each category's rule (ruleId) worked out again; computed, never typed in. */
  function tagList(list) {
    if (!list.categories || !list.categories.length) return list
    const categories = list.categories.map((c, i) => {
      const { ruleId, ...rest } = c
      const id = categoryRule(c, list.words.filter(w => w.c === i).map(w => w.w))
      return id ? { ...rest, ruleId: id } : rest
    })
    return { ...list, categories }
  }
  const parseId = id => { const i = id.indexOf('-'); return { suffix: id.slice(0, i), rule: id.slice(i + 1) } }
  /** The list's words and their bases: never given as new words. */
  const listBases = list => new Set(list.words.flatMap(w => [w.w.toLowerCase(), (analyze(w.w) || {}).base]).filter(Boolean))

  // ---------- Explaining ----------
  const ending = (suffix, rule) => (suffix === 's' ? (rule === 'es' || rule === 'y-to-i' ? '-es' : '-s') : '-' + suffix)
  /** Why this base takes its ending: the rule card shown after a miss. */
  function explain(base, suffix) {
    const b = base.toLowerCase()
    const { word, rule } = form(b, suffix)
    const end = ending(suffix, rule)
    if (rule === 'double') return `${b} has one short vowel and ends in one consonant: double the ${b.slice(-1)}, then add ${end} → ${word}`
    if (rule === 'drop-e') return `${b} ends in e: drop the e, then add ${end} → ${word}`
    if (rule === 'y-to-i') return `${b} ends in a consonant and y: change the y to i, then add ${end} → ${word}`
    if (rule === 'ie-y') return `${b} ends in ie: change it to y, then add -ing → ${word}`
    if (rule === 'es') return `${b} ends in ${/(ch|sh)$/.test(b) ? b.slice(-2) : b.slice(-1)}: add -es → ${word}`
    const why = suffix === 's' ? '' :
      suffix === 'ing' && /[^aeiou]y$/.test(b) ? `${b} ends in y: keep the y before -ing. ` :
      /[eyo]e$/.test(b) ? `${b} ends in ${b.slice(-2)}: keep both letters. ` :
      /[wxy]$/.test(b) ? `${b} ends in ${b.slice(-1)}, which never doubles. ` :
      syllables(b) > 1 ? '' :
      /[aeiou]{2}[^aeiou]+$/.test(b) ? `${b} has two vowels together. ` :
      /[^aeiou]{2}$/.test(b) ? `${b} ends in two consonants. ` : ''
    return `${why}Nothing changes: just add ${end} → ${word}`
  }
  /** A rule in a few words, for a category with no rule text of its own. */
  function describe(id) {
    const { suffix, rule } = parseId(id)
    const end = ending(suffix, rule)
    return {
      double: `One syllable, one short vowel, one last consonant: double it, then add ${end}.`,
      'drop-e': `Words that end in e: drop the e, then add ${end}.`,
      'y-to-i': `Words that end in a consonant and y: change the y to i, then add ${end}.`,
      es: 'Words that end in s, x, z, ch or sh: add -es.',
      'just-add': `Nothing changes: just add ${end}.`,
    }[rule]
  }

  // ---------- New words to apply a rule to ----------
  // Common words a kid knows, written for this plugin; every one takes its rule (test/rules.test.js).
  const split = s => s.split(' ')
  const ADJ = {
    double: split('big hot sad wet thin flat dim fit mad red'),
    'drop-e': split('nice safe wide late cute large wise close brave fine pale rare ripe tame white loose strange simple gentle'),
    'just-add': split('tall small fast cold long short soft loud dark warm quick slow deep kind high low clean neat smart fresh bright quiet'),
    'y-to-i': split('happy funny silly easy busy early heavy lucky sunny windy rainy messy noisy cozy tiny shiny sleepy dirty fluffy bumpy'),
  }
  const BANK = {
    ing: {
      double: split('hop run sit stop plan clap drop grab hug nap pat rub skip slip step tap trap trip wag beg chop jog mop nod pin plug scrub slam snap spot tag tug zip chat grin hum pet dig get cut hit win spin sip dip bat shut wrap drum'),
      'drop-e': split('make ride smile bake hope bike hike skate wave close race chase share care joke poke shine slide trade bounce wipe wake write bite drive dive hide shake come take live move use love tune vote score taste save rake glide tape name graze sneeze freeze giggle tickle wiggle bubble'),
      'just-add': split('read play jump look sing ring help walk talk fish wish rest sleep eat feel fly cry try draw snow buy fix mix pack kick lick rock push pull fill spill yell melt paint rain cook build stand spend ask open visit climb think drink float clean hold swing bring'),
    },
    ed: {
      double: split('hop stop plan clap drop grab hug nap pat rub skip slip step tap trap trip wag beg chop jog mop nod pin plug scrub slam snap spot tag tug zip chat hum pet drip flap shop rip dip sip wrap grin tip'),
      'drop-e': split('bake hope smile like dance wave skate close race chase share care joke poke trade bounce wipe hike tape name save taste live move use love vote score glide sneeze giggle tickle wiggle cuddle'),
      'just-add': split('jump play look help walk talk fish wish rest pack kick lick rock push pull fill spill yell melt paint rain cook ask open visit climb float clean stay spray'),
      'y-to-i': split('cry try dry fry spy carry hurry worry copy study marry bury empty reply apply'),
    },
    er: ADJ,
    est: ADJ,
    s: {
      'just-add': split('cat dog hat book tree bike cake game frog star bird hand shoe car pen cup map ship kite bell'),
      es: split('box fox bus glass kiss dress wish dish brush bench lunch peach beach watch match class inch patch couch wax'),
      'y-to-i': split('baby city puppy story penny party berry cherry lady family pony bunny daisy fly spy candy jelly hobby'),
    },
  }
  const bankFor = id => { const { suffix, rule } = parseId(id); return (BANK[suffix] && BANK[suffix][rule]) || [] }

  /** Progress per rule, saved as rule-<id>: { n: sessions, w: { base: [r, t] } }. */
  const progressFrom = saved => Object.fromEntries(Object.entries(saved).filter(([k, v]) => /^rule-/.test(k) && v && v.w).map(([k, v]) => [k.slice(5), { n: v.n || 0, w: { ...v.w } }]))
  /** Different new words right the first time (last time they were asked). */
  const rightCount = p => Object.values((p && p.w) || {}).filter(rt => rt[0] > 0).length
  const learned = p => rightCount(p) >= LEARNED

  /** `n` new words for these rules ('ing-double', …), shared out between them: never-asked words
   *  first, then missed ones, then the least practiced, so a kid works through each bank over time.
   *  Words in `exclude` (the list's own) are skipped. Returns [{ w, base, suffix, rule, id, r, t }]. */
  function pickApply(ids, progress, exclude, n, rand = Math.random) {
    ids = [...new Set(ids)]
    if (!ids.length || n <= 0) return []
    const quota = new Map(W.shuffle(ids, rand).map((id, k) => [id, Math.floor(n / ids.length) + (k < n % ids.length ? 1 : 0)]))
    return ids.flatMap(id => {
      const { suffix } = parseId(id)
      const p = (progress[id] && progress[id].w) || {}
      const items = bankFor(id).filter(b => !exclude.has(b) && !exclude.has(add(b, suffix))).map(base => {
        const [r, t] = p[base] || [0, 0]
        return { w: add(base, suffix), base, suffix, rule: parseId(id).rule, id, r, t }
      })
      return W.pickSession(items, quota.get(id), rand).map(i => items[i])
    })
  }

  /** A session for a list (or one category of it): `words` are its words in play, `ids` the rules
   *  of the categories in play. About half are the list's words and half new words for its rules
   *  (none: all list words, as before). Returns the items, shuffled. */
  function listSession(words, ids, progress, exclude, size = W.SESSION, rand = Math.random) {
    const applyN = ids.length ? Math.floor(size / 2) : 0
    const mine = W.pickSession(words, Math.min(words.length, size - applyN), rand).map(i => words[i])
    return W.shuffle([...mine, ...pickApply(ids, progress, exclude, applyN, rand)], rand)
  }

  /** What Kinwall says for a new word: "hop. Add ing." */
  const spoken = { ing: 'ing', ed: 'e d', er: 'e r', est: 'e s t', s: 's or e s' }
  const prompt = (base, suffix) => `${base}. Add ${spoken[suffix]}.`
  const shown = suffix => (suffix === 's' ? 's / es' : suffix)

  const api = { SUFFIXES, LEARNED, BANK, form, add, doubles, analyze, textRule, textSuffix, categoryRule, tagList, parseId, listBases, explain, describe, bankFor, progressFrom, rightCount, learned, pickApply, listSession, prompt, shown }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.Rules = api
})(this)
