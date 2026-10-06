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
//
// Speech: use the page's own speechSynthesis when it has one (more control over voices); Android's
// WebView has none, so there use Kinwall.speak when ctx.canSpeak is true.
//
// The theme is also applied as CSS variables on <html>: --kw-bg, --kw-card, --kw-text, --kw-dim,
// --kw-accent, --kw-accent-ink (text on the accent color), --kw-border, --kw-font, plus
// data-theme="light" / "dark".
;(function () {
  let seq = 0
  const pending = new Map()
  let gotContext
  const context = new Promise(resolve => { gotContext = resolve })

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
    close() { send({ type: 'close' }) },
  }
})()
