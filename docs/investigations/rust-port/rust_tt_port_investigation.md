# Rust port: Tatar (`tt`)

Branch `worktree-agent-af4c70c2a8782f57e`, on top of az, kk, ky, uz, tk. Part of #1463, the last of the Turkic
group. Method as in rust_az_port_investigation.md.

## Run 1 — 2026-10-14 23:33 (the import closure)

**Question.** What does `src/languages/tatar/` need, and what text is there?

**Command.** Read tatar.ts, normalize.ts, numbers.ts, romanOrdinals.ts and their imports.

**Raw finding.**
- Core imports: `clauses`, `loadManifest`, `ipa`, `normalizeSymbols`, `initialisms`, `boundaries`, `provenance`.
  All ported. No Turkish import, no neural entry; `ROMAN_POLICIES` names `tt: romanTt` (its ordinal is
  normalize.ts's `ordinalOf`).
- numbers.ts holds its tables in CODE (not in tatar.jsonc); ported as constant arrays and checked against the TS
  literals with `table_check.mjs` (UNITS, TEENS; TENS via `literal.mjs`). `LETTER_NAME` (37) and `CASE_SUFFIX`
  (46) likewise. ⚠ A slip of mine caught by that check: my first CASE_SUFFIX had two empty padding entries to
  reach a count I had miscounted (48); the check reported 46 entries and the padding came out.
- The symbol tier is `SYMBOL_DATA`, the recorded TS literal written into the file by script (not retyped).
- No FLEURS for tt; the golden (200 texts) and the probes plus generated shapes carry it, as for tk.

## Run 2 — 2026-10-14 23:36 (the golden gate: one port-pending row)

**Command.** `./target/release/parity tt`, `--sync tt`.

**Raw finding.** `tt: 199/200 identical, 1 differ`. The one row is the Egypt article's lead, which carries ARABIC
runs (`مصر`, `جمهورية مصر العربية`): the TS reads them through the `ar` engine (*msˤr*, *d͡ʒmhwrj msˤr ˈalʕrbj*),
and `ar` is not ported, so the Rust drops them and records `ar` in `port_pending()`. This is mag's known Arabic
row in another language: port-pending, not a tt defect. `--sync`: 198/200, the second being an English OOV
(*intercettazioni*) whose sync n-gram reading differs from the async BiLSTM reading the golden records.
Pinned by `an_arabic_run_is_pending_on_ar_until_it_is_ported` (flips when `ar` lands), as mag does.

## Run 3 — 2026-10-14 23:38 (differentials)

**Command.** `.probe/turkic/run.sh <worktree> tt tt-normalize tt-g2p tt-numbers tt-roman` (plus phonemize-sync,
phonemize-best, trace, symbols). tt-normalize also replays the engine's `text()` on every row.

**Raw finding.**
```
tt-normalize: 25634 identical, 0 DIFFER  (probe 75, synthetic 22320, words 2239; ops normalize, initialisms on
              raw and normalized, symbols, engine)
tt-g2p:       42577 identical, 0 DIFFER
tt-numbers:   58260 identical, 0 DIFFER
tt-roman:     355 identical, 0 DIFFER    (golden 200, probe 15, synthetic 140)
phonemize-sync: 214 identical, 1 DIFFER  (the Arabic row of Run 2)
phonemize-best: 214 identical, 1 DIFFER  (the same row)
trace:          214 identical, 1 DIFFER  (the same row; its `normalized` agrees, the token list differs by the
                                          dropped Arabic runs)
symbols:        3275 identical, 0 DIFFER  (tatar 200, arabic 3)
```
**Haystack.** normalize changed 24 of 200 golden rows, 8 of 15 probe, 2,864 of 4,464 synthetic (every ordinal /
case suffix × 30 numbers hyphenated, glued and spaced; era markers × seven contexts; the clock grid × seven
suffixes; degree shapes; signs; ranges).

**Is the replay sensitive?** а's harmony-neutral skip in `nearBack` disabled → `tt-g2p: 570 DIFFER`; the к → г
before the ordinal suffix disabled → `tt-numbers: 201 DIFFER`, `tt-normalize: 317 DIFFER`. ⚠ My revert of that
break (`sed 's/if false && //'`) deleted the `if` as well, the same slip as in the kk run; caught by grepping for
the restored lines, fixed, and every tt dump re-replayed identical before going on.

## Run 4 — 2026-10-14 23:41 (the TS suite as a Rust test)

**Command.** `node .probe/turkic/pins.mjs test/tatar.test.ts '<shapes>'`, with `tt` scoped by line (line 35:
`getPhonemizer("tt")`, line 62: `{ text: (s) => phonemize(s, "tt") }`).

**Raw finding.** 70 pins from 70 sites, 0 skipped. The test passes; with the к → г rule disabled it FAILS
(`ordinal(40)` *кырыкынчы* for *кырыгынчы*, `XL гасыр`). Regex audit 20/20 verbatim (after the NBSP rewrite);
the built patterns compared by hand, and the ′ in `[′']` checked as U+2032 by code point.

## Run 5 — 2026-10-14 23:43 (reading for correctness: TS findings)

**Command.** `npx tsx -e …` on synthetic inputs. Rust reproduces each; the inputs are in probes/tt.txt.

**Raw finding.**
1. **No scale above milliard**: 10¹² → *ˈmeŋ milliˈard*, while the symbol tier's own magnitude list has
   *триллион*.
2. **The hard sign is a glottal stop** (`ъ → ʔ`): `съезд` → *ˈsʔezd*. In a Russian loan ъ marks /j/ before the
   vowel (kk's g2p reads it that way, with a measured note); tatar.ts reads it as a hiatus. A difference between
   two engines' readings of the same letter, for the TS side to settle.

**Implication.** Reported in the PR, not fixed. Port-pending: 1 tt golden row on `ar`.

## Run 6 — 2026-10-14 23:58 (every gate, on the tree rebased onto origin/main 257ac271)

**Command.** `git rebase origin/main` (fi/et/hu/is/fo had merged meanwhile; the conflicts were the registry's
`LANGUAGES`/`build`/`roman_policy` lists and dump.mts's `FLEURS_DIR` and dump table. They were resolved as a union.
dump.mts's block-boundary conflict needed the shared `},` restored, and it was parse-checked with
`npx esbuild rust/tools/fn-diff/dump.mts`). Then `cargo run --release -p parity` (ALL languages),
`cargo test --workspace --release`, `cargo run --release -p regex-diff`, `cargo fmt --check`,
`cargo clippy --workspace --release`, and `.probe/turkic/all.sh` (every Turkic fn-diff dump regenerated from the
TS on this tree and replayed).

**Raw finding.**
- parity: every one of the 62 language lines is identical, except mag 199/200 (its known Arabic row) and tt
  199/200 (its Arabic row, port-pending on `ar`). hil 112/112 and ilo 94/94 are the sizes of their goldens.
- cargo test: 248 + 1 passed, 0 failed.
- regex-diff: 146,326 identical, 0 DIFFER, 0 refused.
- fmt: clean. clippy: the only new warnings are `module_inception` on the six new `mod.rs` files.
- tt: tt-normalize 25,634, tt-g2p 42,577, tt-numbers 58,260, tt-roman 355, symbols 3,275: 0 DIFFER; phonemize-sync / phonemize-best / trace 214 identical and 1 DIFFER each (the port-pending Arabic row); parity 199/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.

## Run 7 — 2026-10-15 19:20 (the findings fixed, TS-first, #1576)

**Question.** Is ъ → ʔ right, and do the other findings fix cleanly?

**Command.** Probe scripts under `.probe/` on synthetic inputs (`npx tsx .probe/tt.mts <lang> …`), then `npx vitest run`, `npx tsx tools/check-goldens.mts --write`, `dotnet run --project csharp/tools/parity`, `cargo run -p parity`, and each source file reverted alone against `test/turkic-defects-1576.test.ts`.

**Raw finding.**
1. ъ — sourced on en.wikipedia "Tatar alphabet": the hard sign IS the glottal stop natively (after a closed
   back-vowel syllable), гъ/къ mark the uvular, and Russian loans keep Russian pronunciation. So the defect is
   narrower than reported: ʔ stays (мәсъәлә), къ/гъ make the preceding consonant uvular and drop the sign
   (мәкъалә → mæqaˈlæ, мәгънә → mæʁˈnæ), and ъ before е/ё/ю/я is the /j/ separator (съезд → ˈsjezd, compound
   йөзъеллык → jøzjelˈlɨq).
2. Stress: the same medial-cluster defect as tk (китаплар → kitaˈplar); fixed the same way.
3. триллион added (the Wiktionary Tatar lemma, and the tier's own magnitude list).
- Goldens: 145 rows changed; 125 only in ˈ position, the other 20 the ъ readings (мәгълүмат, объект, аръягы,
  әгъза) and one long code number now read with триллион.

**Implication.** Done; mirrored (Rust parity 199/200, the existing port-pending Arabic row).
