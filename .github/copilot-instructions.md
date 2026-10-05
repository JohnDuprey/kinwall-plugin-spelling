# Copilot instructions

This repo is a Kinwall plugin: a small web page that runs in a strict sandbox under Activities on a family wall calendar, mostly for children. The full rules, SDK and checklist are in `AGENTS.md`. The rules that matter most:

- **No network:** no `fetch`, XHR or WebSocket, even for the plugin's own files. Put data in `.js` files.
- **Nothing remote:** no CDNs, remote fonts, analytics or ads. Everything ships in the package.
- **Classic scripts only:** `<script src>`, never `type="module"` or `import()`. No web workers.
- **No browser storage:** use `Kinwall.load()` / `Kinwall.save()`, not localStorage, IndexedDB or cookies.
- **No page-leaving UI:** no `alert`, `confirm` or `prompt`, no form submits, no pop-ups, no links out.
- **Sound starts from a tap:** begin with a Start button.
- **`kinwall.js`:** keep it unchanged and load it first.
- **Manifest:** keep the `id` in `kinwall-plugin.json`, and bump `version` for each release.
- **Kid-friendly screens:** big touch targets, the `--kw-*` theme colors, and respect `ctx.reducedMotion`.
