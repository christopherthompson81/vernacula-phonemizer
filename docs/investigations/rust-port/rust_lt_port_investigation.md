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
