# Hello world: a Kinwall plugin starter

A starting point for building a **Kinwall activity**: a small web page that shows up under **Activities** on a family's Kinwall, such as a reading game, a math quiz or a drawing prompt. This one greets whoever is playing and counts their taps. Each person's count is saved separately, plus one for the whole family.

To make your own, use this repo as a template, rename it `kinwall-plugin-<your-idea>`, and change the files below.

## What's here

| File | What it is |
|---|---|
| `kinwall-plugin.json` | The manifest: id, name, version and how it's listed. [Reference below](#the-manifest). |
| `index.html`, `app.js`, `style.css` | The plugin itself. Replace these with yours. |
| `kinwall.js` | The SDK: the only way a plugin talks to Kinwall. Keep it, and don't edit it. |
| `dev/index.html` | A preview page that stands in for Kinwall, so you can build without running it. |
| `scripts/package.sh` | Builds `kinwall-plugin.zip`, the package Kinwall installs. |
| `.github/workflows/release.yml` | Builds the package and attaches it to each GitHub release. |
| `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` | Instructions for AI coding assistants. See [Building with an AI assistant](#building-with-an-ai-assistant). |

## Quick start

1. **Preview it.** From this folder:
   ```sh
   python3 -m http.server 8000
   ```
   Open http://localhost:8000/dev/. Pick who's playing, switch light and dark, and watch the messages in the log.
2. **Make it yours.** Set a new `id`, `name` and `description` in `kinwall-plugin.json`, then edit `index.html`, `app.js` and `style.css`.
3. **Package it.**
   ```sh
   scripts/package.sh
   ```
   To try the package in a Kinwall, go to **Activities → Get more activities → Upload a kinwall-plugin.zip**. Only admins can install.
4. **Publish it.**
   1. Push to GitHub and add the `kinwall-plugin` topic to the repo.
   2. Bump `version` in the manifest.
   3. Publish a release tagged `v<version>`. The workflow attaches `kinwall-plugin.zip` to it.
   4. On a self-hosted Kinwall, families can install it by pasting the repo's link into **Get more activities**.
5. **Get it reviewed.** Reviewed plugins are listed for every family, and they're the only ones kinwall.family can install. [Open an issue](https://github.com/JohnDuprey/kinwall/issues) with your repo's link. Each new version is reviewed too before families get it. See [Building activity plugins](https://github.com/JohnDuprey/kinwall/blob/main/docs/contributing/plugins.md).

Kinwall only installs the **built package attached to the latest release**, never your source files. If your plugin has a build step (TypeScript, a bundler), run it in the workflow and package the output folder: `scripts/package.sh dist`.

## The SDK (`kinwall.js`)

```js
const ctx = await Kinwall.ready()
// ctx.member: { id, name, avatar, color } of whoever is playing, or null ("Just playing")
// ctx.theme: { bg, card, text, dim, accent, accentInk, border, font, dark }
// ctx.textScale: 's' | 'm' | 'l' | 'xl'; ctx.reducedMotion: boolean; ctx.locale: e.g. 'en-US'

const mine = await Kinwall.load()                    // this person's saved data, as { key: value }
const ours = await Kinwall.load({ shared: true })    // the whole family's
await Kinwall.save('progress', { level: 2 })         // any JSON value; per person
await Kinwall.save('highScore', 900, { shared: true })
await Kinwall.save('progress', null)                 // null deletes it
Kinwall.close()                                      // back to Activities
```

The theme is also set as CSS variables on `<html>` (`--kw-bg`, `--kw-card`, `--kw-text`, `--kw-dim`, `--kw-accent`, `--kw-accent-ink` (text on the accent color), `--kw-border`, `--kw-font`), with `data-theme="light"` or `"dark"`. Use them, and your plugin will match every family's colors.

## The manifest

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | 2-40 lowercase letters, digits and dashes. **Never change it**: it's how updates and saved data find your plugin. |
| `name` | Yes | Up to 40 characters, shown on the Activities card. |
| `version` | Yes | Bump it for every release. The release tag must be `v<version>`. |
| `description` | | Up to 300 characters. |
| `entry` | | The page to open. Default `index.html`. |
| `emoji`, `color` | | The card's icon and color (`#RRGGBB`). |
| `categories` | | Up to 8, e.g. `["Learn to read"]`, `["Math"]`, `["Games"]`. |
| `ages` | | `{ "min": 4, "max": 7 }`; `max` is optional. |
| `author`, `homepage` | | Shown to the family admin. |

## Limits

A plugin runs in a **sandboxed frame with its own strict security policy**, on a screen that children use. That's what lets families install it safely. It also means some ordinary web code won't work:

**Blocked:**
- **No network at all.** `fetch`, `XMLHttpRequest`, WebSockets and `EventSource` are blocked, even for your own files. Put data such as word lists and levels in a `.js` file, not a `.json` you fetch.
- **Nothing from other sites.** Scripts, styles, images, fonts and audio load only from your own package, plus `data:` and `blob:` URLs. That rules out CDNs, Google Fonts, analytics and ads, so bundle what you need.
- **Classic scripts only.** `<script type="module">` and `import()` don't work in the sandbox. Use plain `<script src>`, or bundle to a single classic script (an IIFE).
- **No web workers.**
- **No browser storage.** `localStorage`, `sessionStorage`, IndexedDB and cookies are unavailable, so use `Kinwall.save`.
- **No dialogs, forms, pop-ups or navigation.** `alert()`, `confirm()` and `prompt()` do nothing, and form submission and new windows are blocked. **One page:** if the plugin's page loads another page (a link, `location`, even a reload of its own), Kinwall stops the plugin. Switch screens with JavaScript instead.
- **No device access.** Camera, microphone, location, fullscreen and pointer lock aren't available.

**Needs a tap first:**
- **Sound and speech.** Browsers only play audio or `speechSynthesis` after someone taps inside your page, so start with a **Start** button.

**What you can see:**
- **Only who's playing, the theme, text size, motion preference and locale.** No calendar, chores, lists or photos.

**Size:**
- **The package:** 5 MB as a zip. Unpacked: 10 MB, 200 files, 2 MB per file.
- **Per family:** 20 plugins, 50 MB of plugin files in all.
- **File types served:** `html js mjs css json txt svg png jpg jpeg gif webp mp3 ogg wav m4a woff woff2`. Anything else, such as READMEs or source maps, is skipped.

**Saved data:**
- **Size:** 100 values per person (and for the family), 16 KB of JSON each, and 1 MB for everyone together.
- **Rate:** up to 30 saves in 10 seconds. Save when something changes, not on a timer.
- **Kept across updates.**
- **Deleted when the family removes the plugin.**

**Devices:** the plugin runs on phones, tablets and wall screens, including older iPads. Plain JavaScript without the very newest syntax is safest; a bundler can transpile it.

## Designing for a family wall

- **Big targets.** At least 44 px, and bigger for small kids. The wall is touched, not clicked.
- **Short and readable.** Big text, few words, and speech or pictures for kids who can't read yet.
- **Match the family.** Use the `--kw-*` colors, and check both light and dark in the preview.
- **Respect reduced motion.** If `ctx.reducedMotion` is true, skip shaking and flying animations.
- **Save often.** People walk away mid-game, so save progress as it happens.
- **Kind by default.** Encourage, don't punish, with no timers that stress and no streak-shaming. Nothing to buy, no ads, no links out.

## Building with an AI assistant

`AGENTS.md` has everything an assistant needs: the rules above, the SDK, the file layout and how to test.

- **Claude Code** reads `CLAUDE.md`, which points to `AGENTS.md`.
- **GitHub Copilot** reads `.github/copilot-instructions.md`. Its coding agent also reads `AGENTS.md`.
- **Codex and other agents** read `AGENTS.md`.
- **ChatGPT, Claude.ai or another chat assistant:** paste in `AGENTS.md`, `kinwall.js` and your current files, then describe what you want. For example:

  > Using the Kinwall plugin rules in AGENTS.md, turn this hello-world plugin into a counting game for ages 3-5: show 1-10 animals, the child taps the matching number, with spoken praise and progress saved per child. Give me complete index.html, app.js, style.css and kinwall-plugin.json.

Whatever writes the code, test it in `dev/`, then as a package in a real Kinwall, before you publish.

## License

MIT, so you can do anything with this starter. Your plugin can use any license you like, because plugins are separate programs that talk to Kinwall only through messages.
