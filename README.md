# ✉ Snail Mailkeeper

An offline webapp for the handmade-letter revival: keep track of real-world mail and pen pals — who you write, when your last letter went out, ideas for someday, prompts you haven't answered yet, birthdays worth a card, and a small stamp jar. All data stays in your browser's local storage. No accounts, no servers, no tracking, no guilt.

Built with warm, low-pressure reminders in mind: everything can be snoozed, nothing counts streaks, and there are no red badges or shame-y wording. Designed to be kind to low-energy days — a postcard saying "hi" counts as much as a twelve-page letter.

A project by **Asdale Dynamics, LLC** (Dylan Asdale) — plain-English, local-first tools that respect your attention. See dylanasdale.github.io for more.

## Highlights

- **Pen pals** — name, handle, optional birthday (MM-DD), optional address that stays *hidden until you show it*, and a per-pal privacy note (e.g. "PO box only", "uses a pen name").
- **Letters log** — record sent/received letters with dates and optional notes. The most recent letter per pal is remembered quietly.
- **Gentle reminders** — soft, snooze-able notes only:
  - "It's been N days since you mailed X — whenever feels right is right." (after your chosen gap, default 30 days, per pal)
  - A first-letter nudge only 14+ days after a pal was *added*, phrased "no rush — a postcard is a perfectly good start."
  - Birthday cards: gentle heads-up within 21 days of a pal's birthday, suppressed once you mark the card sent for the year (a "birthday stamp" badge appears on their card).
  - Occasions you add yourself (dates you pick).
  - "Your stamp jar is running low (N left)" when under 5 stamps — no deadline attached.
  - **Snooze one pal or everything for a while.** Snoozed is snoozed. No re-nagging.
- **Ideas journal** — park half-thoughts for someday; mark them used when a letter finally carries them out.
- **Prompts I haven't answered** — questions from friends you don't want to lose; mark them answered in your own time (they drop to the bottom, un-heroic).
- **Stamp jar** — track real stamps you have with +/− buttons.
- **Your data, your device** — one-click JSON export, restore from an export, or erase everything. Nothing leaves the machine.

## Run it

No build step, no dependencies, no accounts.

```bash
# Option A: just open it
open index.html            # macOS
xdg-open index.html        # Linux
# or double-click index.html on Windows

# Option B: serve it (recommended if your browser blocks file:// storage)
python3 -m http.server 8000
# then visit http://localhost:8000
```

Data is saved automatically to this browser's local storage on every change. Use **Export everything as JSON** before switching browsers/devices (or to back up).

## Tests

Lightweight DOM + logic tests, with zero dependencies:

```bash
npm test        # or: node tests/run-tests.js
```

- `core.js` — pure logic (dates, reminders, validation, snoozes, state serialization).
- `ui.js` — render functions that accept any document, so they run against a tiny DOM shim (`tests/dom-shim.js`) in Node. The shim first **escapes** text when serializing, so injection bugs genuinely show up in tests.
- In the browser, everything renders with the real DOM using the same functions.

## Project layout

```
index.html          the app (single page, tab-free, printable )
styles.css          warm, calm, low-stimulation styling
core.js             pure logic — browser + Node
ui.js               render functions — browser + Node shim
app.js              event wiring + local storage (browser only)
tests/dom-shim.js   ~100-line DOM shim used by the tests
tests/run-tests.js  41 tests, plain pass/fail output
```

## Privacy & accessibility notes

- Pen pal addresses are hidden by default and only shown for the session you click "Show address" — the data never moves, but *you* decide what you see at a glance (coffee-shop prying is a real thing).
- Privacy notes live with each pal for whatever you want to remember — supported names, PO boxes, "don't share this address".
- No accounts, no analytics, no network calls at all after the page loads.
- Calm palette, no animations, respects `prefers-reduced-motion`.
- (This app is a personal organizer — it is not an AI tool, and it never sends your data anywhere.)

## Known gaps

See [STATUS.md](STATUS.md) for what's built, verification results, and honest limitations.

## License

MIT — Copyright (c) 2026 Asdale Dynamics, LLC. See [LICENSE](LICENSE).
