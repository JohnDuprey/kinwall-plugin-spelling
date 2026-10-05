// Hello world: shows who's playing, counts their taps (saved for that person), and keeps a family
// total (shared by everyone). Everything Kinwall-specific goes through kinwall.js.
const el = id => document.getElementById(id)
let mine = 0 // this person's taps
let family = 0 // everyone's taps

function render() {
  el('count').textContent = mine === 0 ? 'No taps yet.' : `You've tapped ${mine} time${mine === 1 ? '' : 's'}.`
  el('family').textContent = `The whole family: ${family}`
}

Kinwall.ready().then(async ctx => {
  // ctx.member is whoever Kinwall asked "Who's playing?" about, or null ("Just playing").
  el('hello').textContent = ctx.member ? `Hello, ${ctx.member.name}! ${ctx.member.avatar || ''}` : 'Hello!'
  el('who').textContent = ctx.member ? 'Your taps are saved just for you.' : 'Nobody picked, so taps are saved for "Just playing".'
  const saved = await Kinwall.load() // this person's data: { key: value }
  const shared = await Kinwall.load({ shared: true }) // the whole family's
  mine = saved.taps ?? 0
  family = shared.taps ?? 0
  render()
})

el('tap').onclick = async () => {
  mine++
  family++
  render()
  // Save after updating the screen, so it feels instant. Saving can fail (offline); keep going.
  await Promise.all([Kinwall.save('taps', mine), Kinwall.save('taps', family, { shared: true })]).catch(() => {})
}

el('reset').onclick = async () => {
  mine = 0
  render()
  await Kinwall.save('taps', null).catch(() => {}) // null deletes a saved value
}
