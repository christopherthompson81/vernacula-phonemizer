# en: SI pressure units (#1503)

## Run 1 — 2026-10-12 (where pascals go, and whether folding is safe)

**Question.** `2 GPa` read *ɡpˈæ* and `101.3 kPa` *kpˈæ*. Is there a unit table to extend? Do the corpora
use a bare `GPa` or a `GPA` after a number? Which spellings of the words read well?

**Command.**
- `grep` for pascal / MHz / km in `src/languages/english` and `src/core`.
- An unbounded `grep -rIhoP '\b\d[\d.,]*\s?(?:[GMkh]Pa)\b'` over `tools/corpus` and the corpus root, plus
  bare `[GMkh]Pa` and `\d…\s?GPA` over the en artifacts and FLEURS en_us.
- `phonemize` on candidate words in en and en-GB.

**Raw finding.**
- **The table.** English's `UNITS` table (`normalize.ts`) is number-gated, and it case-folds any key of two
  or more letters through `UNITS_FOLDED`. That fold is the hazard here. It would read `3.8 GPA` (a grade
  point average) as gigapascals and `2 PA` (CREDENTIAL_CODE's credential) as pascals. And `mPa` is a
  millipascal against `MPa`'s megapascal.
- **Corpora.** Every prefixed pascal found follows a number, and all are in other languages' corpora:
  `200 MPa` ×3, `16 kPa` ×2, `48 GPa`, `360 GPa`, `1013 hPa`, `101.365kPa`, and a few more. The English
  artifacts and FLEURS en_us have none, no bare `GPa`, and no `GPA` after a number anywhere. So the
  bare-`GPa` question has no data to decide it, and a bare `GPa` is left as it was.
- **Readings.** `pascal` is in the dictionary (`P AE0 S K AE1 L` → *pæskˈæɫ*). The single-word prefixed
  forms read with the stress on *pas*: gigapascals ɡˌɪɡəpʰˈæskəɫz, hectopascals hˌɛktəpʰˈæskəɫz. Spaced
  forms lose letters (`hecto pascals` → *hˈɛkt pæskˈæɫz*). So the words are single, as the hertz row
  already is.
- **Fix.** Add `Pa hPa kPa MPa GPa mPa` to UNITS. `CASE_EXACT` (Pa, hPa, kPa, GPa) deletes their folded
  slots. `mpa` needs no entry, because `foldedIndex` already drops a slot whose declared keys disagree
  (MPa/mPa). `mPa` is declared, as the ohm block declares `mΩ`, so `5 mPa` can't be claimed as `MPa` and
  left raw. With a key that doesn't resolve, the unit callback returns the text unchanged, so `2 PA` and
  `3.8 GPA` read exactly as before.
- **Probe after the fix.**
  - `2 GPa` → *gigapascals*, `1 GPa` → *gigapascal*, `101.3 kPa` → *kilopascals*, `1013 hPa` →
    *hectopascals*.
  - `5 mPa` → *millipascals*, `2 million Pa` → *pascals*.
  - `a 3.8 GPA`, `2 PA students`, `5 pa` and `5 gpa` are unchanged.
- **Tests.** TS `test/english-1503-pascals.test.ts`, C# `English1503PascalsTests` and Rust
  `pascals_are_read_case_exactly` are relational.
  - With the table reverted, TS fails 18 of 24; the 6 that pass are the near-miss pins.
  - With only the CASE_EXACT deletion removed, TS and C# each fail 5 of 24 (`3.8 GPA` → gigapascals), and
    Rust fails. So the guard is load-bearing.
- **Corpus impact.** The en/en-GB/en-IN phonemize-sync dump (12,491 rows) moves 0 rows from this fix,
  matching the zero occurrences above. Rust replays it identically. The goldens are fresh, and the regex
  corpus is unchanged.

**Implication.** Closes #1503. A bare `GPa`/`GPA` stays unclaimed until a corpus shows one.
