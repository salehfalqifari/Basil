# Super Basil: Daily Quest

A daily Mawhiba (MMCAT) practice tool for Basil — 30-45 fresh questions a day across all 4 real MMCAT domains, with spaced review of anything he gets wrong, a day-streak counter, and a Trophy goal (full mastery of the 440-question bank + 80%+ overall accuracy by **December 16, 2026**).

## How it works

- **Question bank**: `data.js` — 440 original items (110 per domain): linguistic reasoning & reading comprehension, math & spatial reasoning, science & mechanical reasoning, creativity & mental flexibility.
- **Engine**: `app.js` — daily set generation (never identical to the previous day), spaced re-scheduling for wrong answers, mastery/accuracy tracking, streak counter, Trophy logic.
- **UI**: `ui.js` + `index.html` — dashboard, daily quiz screen, results screen, export/import backup.

## Hosting

This is a fully static site (plain HTML/CSS/JS, no build step, no backend) — it's meant to be served via GitHub Pages so Basil has one link he can bookmark and open on any device. Progress is saved automatically in the browser's local storage **on whichever device/browser he uses it in** — it does not sync across devices on its own. Use the **Export/Import Backup** buttons on the dashboard to move progress between devices or keep a safety-net copy.

## Local preview

Any static file server works, e.g.:

```
python3 -m http.server 8080
```

then open `http://localhost:8080/index.html`.

## Updating the question bank later

Regenerate `data.js` from the 4 domain source files (kept separately during the build) using the merge script's stratified-shuffle approach, so correct-answer positions stay evenly distributed — never hand-edit `data.js` directly for large changes.
