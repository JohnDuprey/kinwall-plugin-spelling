// kinwall.js: the whole plugin SDK. Copy it into your plugin and include it before your own script.
//
// A plugin runs in a sandboxed frame inside Kinwall's Activities: it has no network and can't see
// Kinwall's data. It talks to Kinwall only through these calls:
//
//   const ctx = await Kinwall.ready()   // { member, parent, canSpeak, theme, textScale, reducedMotion, locale }
//                                        // member: { id, name, avatar, color } or null (nobody picked)
//                                        // parent: true on a parent's device, false on wall screens and
//                                        //   kids' devices, undefined on older Kinwall
//                                        // canSpeak: Kinwall.speak works here (undefined on older Kinwall)
//   const saved = await Kinwall.load()   // everything this plugin saved for the current person, { key: value }
//   await Kinwall.save('progress', { level: 2 })   // per person; { shared: true } for the whole family
//   await Kinwall.speak('friend', { rate: 0.8, lang: 'en-US' })   // Kinwall says it; resolves when done
//   Kinwall.stopSpeaking()
//   Kinwall.close()                      // back to the Activities page
//   const todo = await Kinwall.actions() // requests other apps sent for this person (your manifest's
//                                        //   "actions"), oldest first: [{ id, action, input, createdAt }];
//                                        //   { shared: true } for the family's; [] on older Kinwall
//   await Kinwall.done(todo[0].id)       // applied (or dropped): Kinwall deletes it
//   Kinwall.onActions(() => { ... })     // something changed while open: call actions() again
//
// Actions come from outside the plugin: check each input yourself, and apply it so that doing it
// twice changes nothing more (if done() fails, it comes back next time).
//
// Speech: use the page's own speechSynthesis when it has one (more control over voices); Android's
// WebView has none, so there use Kinwall.speak when ctx.canSpeak is true.
//
// Play time: a family can make a chore of your activity ("10 min of Spelling"). Kinwall counts it in
// 15-second steps, each only with play in it, so this file passes on real taps and key presses in
// your page: just "something happened" ({ type: 'active' }), at most once every 3 seconds, never
// what or where. Saves and Kinwall.speak() count too.
//
// No zooming: pinch zoom is stopped here for Safari, which ignores user-scalable=no; keep
// "maximum-scale=1, user-scalable=no" in your viewport and touch-action: pan-x pan-y on <html>.
//
// The theme is also applied as CSS variables on <html>: --kw-bg, --kw-card, --kw-text, --kw-dim,
// --kw-accent, --kw-accent-ink (text on the accent color), --kw-border, --kw-font, plus
// data-theme="light" / "dark".
;(function () {
  let seq = 0
  const pending = new Map()
  let gotContext
  const context = new Promise(resolve => { gotContext = resolve })
  const onActions = []

  window.addEventListener('message', e => {
    if (e.source !== window.parent) return
    const m = e.data
    if (!m || m.kinwall !== 1) return
    if (m.type === 'context') {
      const root = document.documentElement
      // accentInk -> --kw-accent-ink
      for (const [k, v] of Object.entries(m.context.theme)) if (typeof v === 'string') root.style.setProperty(`--kw-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`, v)
      root.dataset.theme = m.context.theme.dark ? 'dark' : 'light'
      gotContext(m.context)
      return
    }
    if (m.type === 'actions') { onActions.forEach(f => { try { f() } catch (err) { console.error(err) } }); return }
    const p = pending.get(m.re)
    if (!p) return
    pending.delete(m.re)
    if (m.ok) p.resolve(m.value)
    else p.reject(new Error(m.error || 'Kinwall said no'))
  })

  const send = msg => window.parent.postMessage({ kinwall: 1, ...msg }, '*') // the parent checks it's really this frame
  const call = (type, payload) => new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    send({ id, type, ...payload })
  })

  // Real taps and keys only (isTrusted), one message per 3 s: one that comes too soon is sent when
  // the 3 s are up, so a tap is never lost, only late.
  let lastActive = 0
  let queued = false
  const active = e => {
    if (!e.isTrusted || queued) return
    const wait = lastActive + 3000 - Date.now()
    const go = () => { queued = false; lastActive = Date.now(); send({ type: 'active' }) }
    if (wait <= 0) go()
    else { queued = true; setTimeout(go, wait) }
  }
  window.addEventListener('pointerdown', active, true)
  window.addEventListener('keydown', active, true)
  document.addEventListener('gesturestart', e => e.preventDefault()) // Safari's pinch zoom

  window.Kinwall = {
    ready() { send({ type: 'ready' }); return context },
    load(opts) { return call('load', { shared: !!(opts && opts.shared) }) },
    save(key, value, opts) { return call('save', { key, value, shared: !!(opts && opts.shared) }) },
    // Never rejects: resolves when it's said, stopped or failed, or after a while if Kinwall doesn't
    // answer (an older Kinwall ignores it). Text is cut at 500 characters.
    speak(text, opts) {
      const words = String(text).slice(0, 500)
      return new Promise(resolve => {
        const t = setTimeout(resolve, 3000 + words.length * 150)
        call('speak', { text: words, rate: (opts && opts.rate) || 1, lang: (opts && opts.lang) || 'en-US' }).then(() => {}, () => {}).then(() => { clearTimeout(t); resolve() })
      })
    },
    stopSpeaking() { send({ type: 'stopSpeaking' }) },
    // Never rejects: [] when there's nothing, when offline (they wait for next time), or after a few
    // seconds on an older Kinwall that doesn't answer.
    actions(opts) {
      return new Promise(resolve => {
        const t = setTimeout(() => resolve([]), 5000)
        call('actions', { shared: !!(opts && opts.shared) }).then(list => (Array.isArray(list) ? list : []), () => []).then(list => { clearTimeout(t); resolve(list) })
      })
    },
    done(id) { return call('done', { item: String(id) }) },
    onActions(callback) { if (typeof callback === 'function') onActions.push(callback) },
    close() { send({ type: 'close' }) },
  }
})()
