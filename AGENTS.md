# Instructions for AI coding assistants

This repo is a **Kinwall plugin**: a small web page shown full screen under **Activities** on a family's Kinwall wall calendar, used mostly by children on touch screens. Read `README.md` and the hello-world starter README it links to for the full picture; this file is the working checklist.

## Hard rules (the sandbox enforces these; code that breaks them silently fails)

1. **No network.** Never use `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `navigator.sendBeacon`, not even for the plugin's own files. Put data in `.js` files, like `const LEVELS = [...]`.
2. **Everything is local.** No CDNs, remote fonts, analytics, ads or external images. Bundle what you need into the package. `data:` and `blob:` URLs are fine for images, media and fonts.
3. **Classic scripts only.** Use `<script src="...">`, never `type="module"` or dynamic `import()`. If you use a bundler, output one classic IIFE script. No web workers.
4. **No browser storage.** Use `Kinwall.load()` and `Kinwall.save()`, never `localStorage`, `sessionStorage`, IndexedDB or cookies.
5. **One page, no dialogs.** No `alert`, `confirm`, `prompt`, forms that submit, `window.open`, links, `location` changes or reloads: Kinwall stops a plugin whose frame loads a second page. Switch screens in JavaScript and show messages in the page itself.
6. **Sound needs a tap.** Audio and `speechSynthesis` only work after a tap inside the page, so begin with a **Start** button. When speaking, cancel any current speech, wait about 150 ms, then speak, and keep a reference to the utterance.
7. **Keep `kinwall.js` as is,** and load it before the plugin's own script.
8. **Keep the `id` in `kinwall-plugin.json` unchanged.** Bump `version` for every release.

## The SDK

```js
const ctx = await Kinwall.ready()          // { member: {id,name,avatar,color}|null, parent, canSpeak, theme, textScale, reducedMotion, locale }
const mine = await Kinwall.load()          // this person's { key: value }
const ours = await Kinwall.load({ shared: true })
await Kinwall.save(key, jsonValue)          // per person; { shared: true } for the family; null deletes
await Kinwall.speak(text, { rate, lang })   // Kinwall says it; resolves when done, never rejects
Kinwall.stopSpeaking()
Kinwall.close()                             // back to Activities
const todo = await Kinwall.actions()         // waiting requests from other apps: [{ id, action, input, createdAt }]; { shared: true } for the family's
await Kinwall.done(id)                       // applied or dropped: Kinwall deletes it
Kinwall.onActions(callback)                  // something changed while open: call actions() again
```

- **Parents:** `ctx.parent` is true on a parent's device, false on wall screens and kids' devices, and undefined on older Kinwall. Show grown-up settings only when it's true (or behind a simple gate when it's undefined).
- **Speech:** use the page's own `speechSynthesis` when it exists; otherwise use `Kinwall.speak` when `ctx.canSpeak` (Android's WebView has no `speechSynthesis`); otherwise say the activity needs a device that can talk.
- **Limits:** keys are 1-64 characters, values are JSON up to 16 KB, at most 100 keys per person, 1 MB for the whole family, and 30 saves in 10 seconds.
- **Failures:** saving can fail when offline. Catch the error and keep going.
- **Actions:** `addList` and `archiveList` (declared in `kinwall-plugin.json`) go through `Words.applyAction`: validate every input, keep applying idempotent (merge, never blindly append), and call `done(id)` after saving, also for input that's dropped.
- **Colors:** style with the `--kw-bg`, `--kw-card`, `--kw-text`, `--kw-dim`, `--kw-accent`, `--kw-accent-ink` (text on the accent color), `--kw-border` and `--kw-font` CSS variables. Kinwall sets them to the family's theme, and `[data-theme="dark"]` is set in dark mode.

## Design

- **Big touch targets.** At least 44 px, around 88 px for main actions, with large text and few words.
- **Speech or pictures for pre-readers.**
- **Encouraging.** Vary the praise, never shame, no stressful timers, nothing to buy, no links out.
- **Reduced motion.** When `ctx.reducedMotion` is true, skip animations. Keep a visible focus outline.
- **Save progress as it happens,** and restore it on `ready()`.
- **No zooming.** Keep `maximum-scale=1, user-scalable=no` in the viewport and `touch-action: pan-x pan-y` on `html, body`; follow `ctx.textScale` for text size.
- **Cooldowns.** 🔊 and "Use it in a sentence" rest until the speech ends + `REPLAY_REST` (1.5 s); after a miss, `missed()` rests Check, choices and keys for `MISS_REST` (1.6 s). Resting = `.resting` + `aria-disabled` (focus stays); every handler checks `resting()`.
- **Fit any screen** from a 393 px phone to a wall display, and keep contrast readable in both themes.

## Files and workflow

- **Plugin files:** `index.html`, `banks.js` (the word banks and the ten levels built from them), `words.js` (the pure word logic, list categories and the `addList`/`archiveList` actions, tested by `node --test`), `rules.js` ("Apply the rule": the suffix rules, a category's rule, the new base words per rule and mixing them into sessions, also tested by `node --test`), `game.js`, `style.css`. The manifest is `kinwall-plugin.json`. The hello-world starter's README documents each file.
- **Preview:** run `python3 -m http.server 8000` and open `http://localhost:8000/dev/`. It stands in for Kinwall: it has a member picker and a theme switch, saves to its own storage, and logs every message.
- **Package:** `scripts/package.sh` builds `kinwall-plugin.zip`. The limits are 5 MB zipped, and 10 MB, 200 files and 2 MB per file unpacked. Only `html js mjs css json txt svg png jpg jpeg gif webp mp3 ogg wav m4a woff woff2` files are served.
- **Release:** publish a GitHub release tagged `v<version>`. `.github/workflows/release.yml` attaches the zip.

## Before you say it's done

- **Preview:** it works in `dev/` for a picked person and for "Just playing", in light and dark.
- **Rules:** no network calls, module scripts or browser storage (search the code for `fetch`, `import(`, `localStorage`, `type="module"`).
- **Sound:** it starts from a tap if it uses sound or speech.
- **Save and restore:** saved progress comes back after reloading the plugin.
- **Manifest:** the version is bumped and the `id` is unchanged.
