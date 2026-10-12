# Rust port: Lithuanian (lt)

`lithuanian/{manifest,g2p,numbers,normalize,lithuanian}.ts`. The g2p tokenizes into digraph-first letter units
(with the shared `latinPhone` fallback for letters outside the tables), palatalizes before front vowels / ⟨i⟩ /
⟨j⟩ / ⟨ie⟩ with a leftward spread (not onto ⟨k g⟩), drops the softening ⟨i⟩ before a back vowel and fronts
⟨a ą⟩ after it, then n → ŋ before a velar and regressive voicing. No stress. numbers.ts is the Baltic three-way
concord (`agree`, shared with normalize.ts); normalize.ts reads every counted quantity itself (it cannot use the
shared symbol tier: every noun takes the three-way split) and runs `renormalize(…, "NFC")` first. No neural
entry, no Roman policy. Core imports: `clauses`, `hostWord`, `latinPhones`, `numbers` (`digitIndex`),
`boundaries`, `initialisms`, `provenance` (`rewrite`, `renormalize`), `loadManifest`: all ported, so NO core
module is added.

## Run 1 — 2026-10-11 11:10 (port, golden)

**Question.** With the five modules ported and `lt` registered, what does the golden say?

**Command.** `cd rust && cargo build --release && ./target/release/parity lt`.

**Raw finding.** One compile error: `gen` (the agreement's genitive-plural field) is a reserved keyword in
edition 2024; renamed `gen_pl` with `#[serde(rename = "gen")]`. Then `lt: 200/200 identical, 0 differ`.

**Implication.** Differentials next.

## Run 2 — 2026-10-11 11:25 (per-module differentials, pins, gates)

**Question.** Do the normalizer, the initialism pass, the g2p, the nativiser and the compositor match beyond the
golden?

**Command.** New dump entries `lt-normalize`, `lt-g2p`, `lt-numbers` replayed by one `fn-diff` arm, and
`LANGS=lt phonemize-sync` / `phonemize-best` / `trace`; `FLEURS_ROOT=<external-drive>/…`; new synthetic
`probes/lt.txt` (24 lines). Synthetic rows: 19 numbers (with a decimal and a space-grouped one) × 38 unit,
currency, magnitude and date suffixes; the three currency signs both sides of a number with a magnitude and a
spelled noun after; 5 range pairs × 6 correlatives × 6 followers; 22 abbreviations × 4 followers; every hour in
three marked-clock spellings. `isUnreadableLithuanian` is not exported, so the initialism pass is run over every
word (as written and uppercased) instead.

**Raw finding.** First build, every replay clean:
```
lt-normalize:   47888 identical, 0 DIFFER  (golden 327 / fleurs 11547 / probe 72 / synthetic 3876 / words 32066)
lt-g2p:         94242 identical, 0 DIFFER
lt-numbers:     27075 identical, 0 DIFFER
phonemize-sync:  3982 identical, 0 DIFFER
phonemize-best:  3982 identical, 0 DIFFER
trace:           3982 identical, 0 DIFFER
pins: test/lithuanian.test.ts 117 extracted, 70 skipped (helper-built and computed expectations)
cargo test --release --workspace: 139 + 1 passed; parity all 25 languages 200/200
clippy: only module_inception in the new files
```

**JS semantics reproduced on purpose.** `two in CDI` / `c in V` are `in` tests (prototype chain included) over
one- and two-unit keys, which no `Object.prototype` name is. `BACK.has(nx[0])` tests a CODE UNIT against a set
of code points (every back vowel is BMP). `readDigits` and the decimal-comma arm split by UTF-16 unit.

## Run 3 — 2026-10-11 11:35 (TS findings from reading; reported, not fixed)

**Command.** `npx tsx .probe/lt/check.mts <text>` (normalizeLithuanian in the TS); synthetic inputs.

**Raw finding (TS output, verbatim):**
1. **A sentence-final metre value is read as YEARS and loses the sentence end.** `Bokšto aukštis siekia 50 m.`
   → `… siekia penkiasdešimt metų ` (years, and the period consumed). The one-letter `m` unit arm declines a
   following `.` (`(?![/.])`), so every `N m.` reaches the year rule. That rule also ignores the count for a
   short number: `… plotis 3 m.` → `trys metų` (*trys metai* / *trys metrai*).
2. **`km/h` is not read at all**: `Jis bėgo 5 km/h greičiu.` is unchanged (the unit arm's `(?!/)` declines it
   and no rate rule exists), so the IPA spells *k m h*.
3. **A marked clock is half read**: `Sausio 5 d. 10:30 val.` → `Sausio penkios dieną 10 trisdešimt valandų`. The
   clock step rewrites `10:30 val.` to `10 30 val.`, and the hours-quantity rule then counts only the MINUTES as
   hours. The date reads a cardinal (`penkios dieną`) where an ordinal (*penktą dieną*) is wanted.
4. A score after a verb outside the SCORE list reads as a descending range: `Laimėjo 3–2.` → `Laimėjo nuo 3 iki
   2.` (`Rezultatas buvo 3–2.` is kept). Minor.

Every manifest field is read; nothing routes to an unported engine (no port-pending row).

**Implication.** Reported in the PR; Rust reproduces the TS.

## Run 4 — 2026-10-11 17:10 (#1532: Run 3's findings, measured on FLEURS before fixing)

**Question.** Which of Run 3's four findings does the corpus support, and how?

**Command.** greps over the unique FLEURS lt_lt texts (column 3): `[0-9]+ m\.( \S+)?`, the `km/h` shapes, `per
valand`, `\S+ \S+ dieną`, and `laimėj` within 50 characters before a digit pair.

**Raw finding.**
- `N m.`: every 1–3-digit operand is a year or an age (`20–30 m. amžiaus`, `400 m. po Kristaus`, `53 m.
  Cuomo`, `991 m. Etelredui`); the one metre is FOUR digits (`4892 m. Vinsono kalnas`). So reading a small
  `50 m.` as metres has no support; the year reading stays. The lost full stop is real: 12 utterances end in
  `NNNN m.` and none kept its stop.
- `N m. <Capital>` is mostly NOT a sentence end: `2009 m. Vengrijos`, `4892 m. Vinsono`, `2007 m. Taipėjaus`,
  `1947 m. Pakistano`. A capital therefore cannot restore the stop; only the end of the utterance can.
- `km/h` ×7, `km/val.` ×3, `km / h` ×1. The idiom is spelled out 4× (`105 mylias per valandą`, `3 000 mylių per
  valandą`), which sources `per valandą`.
- Days: `dieną` after a digit ×1 (`sausio 25 dieną`), ordinal forms ×1 (`per pirmą dieną`, `1-ą mėnesio
  dieną`). Not enough to source the feminine accusative ordinal series 1–31, which the header records as
  measured and refused. Declined.
- `laimėj` before a digit pair: 0. Adding it to `SCORE` refuses nothing in the corpus.

**Implication.** Fix the stop (end of utterance only), `km/h`, the marked clock and the score verb; decline the
metre reading and the ordinal dates.

## Run 5 — 2026-10-11 17:25 (#1532: the fixes, FLEURS before/after)

**Command.** The same before/after normalizer diff over all 1,966 FLEURS lt_lt texts.

**Raw finding.** 33 lines change:
- 12: a sentence-final `NNNN m.` keeps its stop (`… nacionalizuotas du tūkstančiai aštuoni metais.`), all 12
  the corpus has.
- 12: the marked clock reads its minutes (`11:20 val.` → *vienuolika valandų dvidešimt minučių*; `12.00 val`
  → *dvylika valandų*; `9:30 val.` → *devynios valandos trisdešimt minučių*). Before, the minutes were counted
  as hours (`9 trisdešimt valandų`).
- 9: `km/h` / `km/val.` read (`160 km/h greičio` → *šimtas šešiasdešimt kilometrų per valandą greičio*).
- Inside one of the 12 sentence-final lines: `(1894–1895 m.)` after `pralaimėjimo`. The first cut of the score fix refused the temporal span
  `Laimėjo 1990–1995 metais` (synthetic probe) as a score, so the score test now yields to the temporal test.
  That also un-refuses this corpus line, which had been refused by `pralaimėj`: `(1894–tūkstantis … metais)` →
  `(1894 iki tūkstantis … metais)`, the bare-span reading every other temporal span gets.

## Run 6 — 2026-10-11 18:10 (#1532: goldens, C# and Rust mirrored)

**Command.** `npx tsx tools/gen_parity_goldens.mts … lt`, diff against the pre-fix copy; the existing pins
in test/lithuanian.test.ts, LithuanianTests.cs and lithuanian.rs; `lt-normalize` replay.

**Raw finding.** 6 golden rows move, all explained: 3 copies of the `11:20 val.` text and the `11.29 val.` text
(the clock now reads its minutes), and 2 copies of `… surengtos 1964 m.` (the final stop kept). Six existing
pins held the old readings and were updated with the reason: `1802 m.`/`83,4 m.` (the stop), `19:11 val.`,
`apie 19:11 val.`, `8:00 - 19:00 val.`, `11:00 val.`, `12.00 val` (the clock), `515,3 km/val.` (now a declared
rate; `515,3 km/min.` is the refused-rate pin that stays). `perHour` joins Rust's validated word keys.
`lt-normalize`: 47914 identical, 0 DIFFER; parity lt 200/200.
