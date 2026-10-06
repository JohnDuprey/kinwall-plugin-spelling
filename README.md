# Spelling practice

A spelling game for [Kinwall](https://github.com/JohnDuprey/kinwall), for ages 6 to 11. Kids practice this week's spelling list, or 1st to 5th grade words, and earn stars as words stick. Kinwall says each word out loud and never shows it, just like a spelling test.

- **Three kinds of questions, mixed:** **Type it** (spell the whole word), **Pick it** (choose the right spelling from look-alike misspellings) and **Fill in the missing letters** (the tricky parts are blanked). New words start with picking and filling in; practiced words get typed.
- **Hear it again:** a 🔊 button repeats the word, and **Use it in a sentence** reads the sentence when there is one. Words that sound like another word (their, there) come with a sentence, said right after the word.
- **Kind corrections:** a missed **Type it** shows what the child wrote over the right spelling, with the differences marked, then they type it the right way to go on. Missed words come back later in the same session. No timers, no losing.
- **Stars:** a word is ⭐ mastered after it's spelled right the first time 3 times in a row, across sessions. A session is 10 words (or the whole list, if it's shorter), with a friendly summary at the end.

## Word lists

A grown-up adds each kid's lists: the words (typed or pasted, one per line or with commas), an optional sentence for each word, an optional name and test date. Words can also be picked from the grade banks. The newest list comes first on the kid's screen; old lists can be archived or deleted. Lists are saved for that kid.

**Who can edit lists:** on a parent's phone or computer, **Edit lists** shows on the home screen. Open Spelling practice there, pick the kid as who's playing, and add their words. Wall screens and kids' own devices don't show it. On an older Kinwall that doesn't say whether it's a parent's device, a **Grown-ups: hold to edit lists** button opens it after a two-second hold: it keeps casual taps out; it isn't a lock.

## Grade banks

Over 750 built-in words, about 150 for each grade from 1st to 5th, grouped by spelling pattern: short and long vowels, blends and digraphs, silent e, vowel teams, r-controlled vowels, double letters, -ed and -ing, plurals, prefixes and suffixes, sound-alikes, tricky words and more. Kids can practice a whole grade (a mix of everything) or one pattern, with no setup. Each session draws the words practiced least and longest ago, plus a few recently missed, so a kid works through the whole bank over time instead of seeing the same few. The lists were written for this plugin from common words and patterns.

## Points for practice

A plugin can't give points itself, but Kinwall can: **make it a chore** to give points for practice. Add a chore like "10 min of Spelling practice" (pick Spelling practice as the chore's activity). Kinwall times it, counting only while the game is on screen and the child is answering, and ticks the chore off when the time is reached.

## Speech

Every question is spoken, so Spelling practice needs a voice. It uses the device's own speech when the browser has it, and otherwise asks Kinwall to speak (the Kinwall Android app speaks with Android's text-to-speech). Where neither works, it says "This device can't say the words out loud" instead of showing the words, which would give the answers away.

## Install

In Kinwall, go to **Activities → Get more activities**. Spelling practice is listed under **Reviewed by Kinwall** once it's been reviewed.

## Develop

This plugin is built from [kinwall-plugin-hello-world](https://github.com/JohnDuprey/kinwall-plugin-hello-world); its README covers the SDK, the limits and how publishing works. `AGENTS.md` has the same rules for AI coding assistants.

- **Preview:** `python3 -m http.server 8000`, then open http://localhost:8000/dev/. The **Device** menu switches between a parent's device, a wall or kid's device, and an older Kinwall.
- **Test:** `node --test` runs the tests for the word logic in `words.js` (misspellings, blanks, the letter diff, stars and session picking) and the banks in `banks.js`.
- **Package:** `scripts/package.sh` builds `kinwall-plugin.zip`.
- **Release:** bump `version` in `kinwall-plugin.json` and publish a release tagged `v<version>`. The workflow attaches the package.

### Saved data

Everything is saved for whoever is playing, one value per list so each stays well under 16 KB:

| Key | Value |
|---|---|
| `list-<id>` | `{ id, title, test, archived, created, n, words: [{ w, s, r, t }] }`: up to 60 words, each with its sentence, streak (`r`) and the session it was last asked in (`t`) |
| `bank-<grade>` | `{ n, w: { word: [r, t] } }`: progress in that grade's bank, for words asked so far |
| `prefs` | `{ grade }`: the grade picked last |

Each answer saves its list or bank, which also tells Kinwall the child is still practicing.

## License

MIT
