// Kinwall refuses a package whose manifest breaks its limits (server/src/routes/plugins.ts).
const test = require('node:test')
const assert = require('node:assert')
const m = require('../kinwall-plugin.json')
test('manifest fits Kinwall limits', () => {
  assert.ok(m.description.trim().length <= 300, `description is ${m.description.length} characters (max 300)`)
  for (const [name, a] of Object.entries(m.actions || {})) assert.ok(a.description.trim().length <= 300, `action ${name} description too long`)
})
