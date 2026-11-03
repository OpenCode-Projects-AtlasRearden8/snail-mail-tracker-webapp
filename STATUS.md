# STATUS.md — Snail Mailkeeper

Last updated: 2026-11-03

## What was built

An offline, single-page webapp for tracking real-world mail and pen pals — built for
the handmade-letter revival and for low-energy users (ADHD-friendly, gentle by design).

Features:

1. **Pen pals** — add/remove pals with name, handle, optional MM-DD birthday, optional
   address, per-pal privacy note, and a per-pal reminder gap (default 30 days, clamped
   7–365). Addresses are hidden until explicitly revealed each session.
2. **Letters log** — sent/received letters with dates and notes; newest first; last
   letter per pal is surfaced on their card.
3. **Gentle reminders** — follow-up gaps ("whenever feels right"), first-letter nudges
   (kind phrasing, "no rush"), birthday reminders within 21 days (suppressed once the
   card is marked sent for the year), self-added occasions within 21 days, low-stamp
   jar notices (< 5). Every reminder is snooze-able per pal; "snooze all" silences the
   whole panel. No streaks, no badges, no shaming wording.
4. **Birthday stamps** — marking a birthday card sent (as a letter flag or the
   dedicated button) adds the year to the pal's record and shows a small badge on
   their card, also suppressing the birthday reminder.
5. **Ideas journal** — park writing ideas for someday; mark used or delete.
6. **Unanswered prompts** — track questions from friends; mark answered later; show
   who asked.
7. **Occasions** — any dated occasion worth a card; listed with birthdays.
8. **Stamp jar** — count real stamps, +/− controls, floor at 0.
9. **Data controls** — automatic local storage persistence, JSON export download,
   restore from file (validated), and full erase with confirmation.
10. **Safety** — all user text is rendered via `textContent`/escaped paths; XSSI-style
    injection is covered by tests. Corrupt or wrong-shaped stored/imported JSON falls
    back to a fresh state instead of crashing.

## How to run it

```bash
python3 -m http.server 8000      # then open http://localhost:8000
# or simply open index.html directly (file://)
```

Run tests:

```bash
node tests/run-tests.js          # or: npm test
```

## Verification results

- `node tests/run-tests.js`: **41 tests, 41 passed, 0 failed.**
- `node --check` on every JS file: clean.
- Served locally with `python3 -m http.server` and fetched every file: all HTTP 200.
- During development the tests caught and fixed four real bugs:
  - `todayISO` rejected "YYYY-MM-DD" strings (crashed the reminder/snooze paths),
  - address visibility flag was per-object instead of per-pal (would leak hidden
    addresses on second render),
  - internal shim serialization name mismatch,
  - two incorrect test expectations (Feb 29 fallback year; snooze-clamp date math).

## Known gaps / honest limitations

- **Cordova-free, single browser profile:** data lives in the browser's local storage
  of the profile/device you use; clearing site data erases the journal. Export your
  JSON first.
- **No cross-tab sync:** two open tabs can overwrite each other's last write.
- **Birthday reminder window is fixed at 21 days** and first-letter nudge delay at 14
  days — not yet user-configurable.
- **Reminders are computed at load** — a long-open tab won't roll the date over until
  reloaded.
- **No search/filter** for the letters log; fine at pen-pal scale, maybe not at
  archivist scale.
- The holiday-card season ("all pals at once") is not special-cased.
- Tested in Node via a custom DOM shim plus real-browser script execution of the same
  functions; a full automated browser run (Playwright etc.) was out of scope to keep
  the project dependency-free.

## Credits

Snail Mailkeeper — Copyright (c) 2026 Asdale Dynamics, LLC. MIT licensed (see LICENSE).
