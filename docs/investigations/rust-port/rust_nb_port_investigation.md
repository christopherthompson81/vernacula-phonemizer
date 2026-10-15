# Rust port: Norwegian Bokmål (nb)

Part of #1463, the "germanic" group (da, nb, af, lb, bar). Method as in rust_da_port_investigation.md.

Norwegian is lexicon-first like Danish: the NST lexicon (`nb-lexicon.tsv`, folded through the nativiser), then — on
the best path only — a per-grapheme BiLSTM tagger, then a left-to-right rule g2p over UTF-16 code units
(complementary length on the first syllable, front-vowel softening, digraphs, silent digraphs, retroflex r + coronal,
silent final ⟨d⟩, geminates, -sjon) with first-syllable stress. A normalizer (space and comma grouping, the decimal
comma, dates, ordinals, …), the shared symbol tier, and numbers through core `renderNumber` / `westernNumberWords`
(`spellDigits` above 2⁵³).

## Run 1 — 2026-10-15 00:40 (the import closure)

**Question.** What does `src/languages/norwegian/` need that the Rust core lacks?

**Command.** Read norwegian.ts, normalize.ts, manifest.ts, norwegianTagger.ts, norwegianNeural.ts and their imports.

**Raw finding.**
- Core imports: `clauses`, `hostWord` (`makeNativiser`), `numbers` (`renderNumber`, `spellDigits`,
  `westernNumberWords`), `loadTsv`, `loadManifest`, `normalizeSymbols`, `provenance`, `foreign`, `structuralTagger`
  (`oneStress` added with da) — all ported. No new core module.
- Neural entry `phonemizeNbNeural`; no `ROMAN_POLICIES` entry; FLEURS `nb_no`.
- Symbol literal (recorded): `{"multiply":{"times":"ganger"},"ampersand":"og","percent":["prosent"],"units":{"km":["kilometer"],"m":["meter"],"mm":["millimeter"]},"unitPer":"i","rateDenominators":{"t":"timen","h":"timen","s":"sekundet"}}`.
- Pins: test/norwegian.test.ts 76 calls / 76 expects, test/nbNeural.test.ts 8 calls / 16 expects, 0 failures.

**Implication.** Port manifest → normalize → norwegian → norwegian_tagger → norwegian_neural.

## Run 2 — 2026-10-15 00:50 (first build, the golden gate)

**Command.** `cd rust && cargo build --release -p parity && ./target/release/parity nb`.

**Raw finding.** `nb: 200/200 identical, 0 differ` on the first build. The tagger graph loads in the pure-Rust runtime.

## Run 3 — 2026-10-15 00:55 (per-module differentials, then end to end; an escape rewritten by the editor)

**Commands.** New `dump.mts` entries `nb-normalize`, `nb-g2p`, `nb-tagger`, `FLEURS_DIR` entry `nb: "nb_no"`, one
`fn-diff` arm; `.probe/G/e2e.sh <wt> nb nb nb-normalize nb-g2p nb-tagger phonemize-sync phonemize-best
phonemize-trace trace`. Inputs: the golden (104 texts), FLEURS nb_no columns 3 and 4 (3,615 texts), the new synthetic
`probes/nb.txt` (21 lines).
- `nb-normalize`: `normalizeNorwegian` and `createNorwegian().text` over every text plus 400 synthetic rows (every
  grouping separator incl. NBSP / NNBSP / thin space, comma grouping vs decimals, colon clocks, each abbreviation × 3
  casings × 4 tails, degrees, squared units, dates valid / out of range / zero, ordinals 0…40 and padded, ranges,
  every currency sign, signs, relational signs) and `text()` over 0…20,000, magnitudes and 2⁵³ neighbours (the
  number path, which is not exported).
- `nb-g2p`: `phonemizeWordRules`, `phonemizeWord`, `nat` over every letter run, every 1–3 letter string of 39
  letters, every 4-letter string over `aeiosktgjrnldhxv`, digraph × prefix grids, corners (lone surrogates, two
  identical astral letters, `''`, `--`); `phonemizeWord` over every lexicon key.
- `nb-tagger`: `tag` over every pre-pass word (raw, as the pre-pass offers it) and every nativised token, every 25th
  lexicon key, corners; `oneStress` with the nb vowel class.

**Raw finding.**
```
nb-normalize: 28716 identical, 0 DIFFER   (golden 208 / fleurs 7230 / probe 42 / synthetic 800 / number 20436)
nb-g2p: 438024 identical, 0 DIFFER
nb-tagger: 13075 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 3740 identical, 0 DIFFER each
phonemize-trace: 3739 identical, 1 DIFFER  — the first text's first token: TS `nativised: "marta"`, the lazy
                 lexicon's fold notes landing on the open token (da Run 3; `.probe/G/trace-first.mts nb` shows
                 run 1 "marta", run 2 undefined). TS defect, not reproduced.
```
⚠ **The regex audit then failed one pattern**: step 1's `[ \u00a0\u202f\u2009]` was in normalize.rs as FOUR LITERAL
CHARACTERS, although the file was written with the escapes — the editing tool rewrote them (and `cargo fmt` then
joined the shortened line). The match is identical, which is why the differential above was green. Restored with
`perl -CSD` (byte level); the same fold in the dump.mts synthetic row restored too. Re-replayed: `nb-normalize: 28716
identical, 0 DIFFER`; the audit: 38 raw patterns, 3 not verbatim (two `format!` templates and the symbol JSON, checked
by hand).

**JS semantics reproduced on purpose.**
- the scan walks code UNITS; `DIG[three]` at the word end sees a TWO-unit slice, so a final two-letter digraph is
  claimed whole as one segment; a doubled unknown unit (`''`, a doubled high surrogate) is pushed raw.
- `(beforeR && LBR[c]) || LONG[c]`: an empty before-r entry falls through.

**Guard check.** The geminate's raw-unit push removed: `nb-g2p: 437870 identical, 154 DIFFER`. The short `three`
slice refused (`three.len() == 3`): `nb-g2p: 438024 identical, 0 DIFFER` — invisible in the IPA, as in sv: the only
values a short slice can claim (`ŋ`, `ŋn`, `kː`, `ʃ`, `ç`, `ʋ`) join to the same string and none carries a vowel for
the stress search. Kept as the TS has it.

## Run 4 — 2026-10-15 01:05 (reading for correctness: TS findings, reported not fixed)

**Commands.** `.probe/G/nb-check.mts` (number words against the lexicon; what the pre-pass offers per token);
`.probe/G/best.mts nb <texts>`; `.probe/G/t.mts` with `N=languages/norwegian/normalize.ts`.

**Raw finding (TS output, verbatim):**
1. **The neural pre-pass keys a different spelling from the one text() asks for** — the drift danishNeural.ts records
   and fixed for Danish, still open here. The pre-pass matches a hand-listed class and keys the raw match;
   `text()` asks `oovOverride` for `nat(whole Latin token)`:
   `São` → asks `Sao`, offered `["S","o"]`; `Dvořák` → asks `Dvorak`, offered `["Dvo","k"]`; `O'Shannessy` → asks
   `O'Shannessy`, offered `["O","Shannessy"]`; `Chişinău` → offered `["Chi","in","u"]`. So `Han bor i Dvořák.`
   best *ˈdʋuːɾɑk* (the RULE reading) while `Dvorak` best → *ˈdʋoːˌɾɑk* (the tagger).
2. **The comment "Number words … are all in the lexicon" is false for 8 of 42**: `tohundre … nihundre` are absent,
   and `number()` passes `phonemizeWord` with no override, so `200` reads *ˈtuːhʉndɾə* (rule) on every path while the
   word `tohundre` best → *tuːˈhʊndɾə*.
3. **A zero-padded ordinal is not claimed**: `Den 07. mai.` → *ˈdɛn ˈʃʉː . ˈmɑɪ .* (cardinal + sentence break);
   step 11 indexes `ORDINALS[n]` with the raw digits (the date and range arms canonicalise).
4. The lazy-lexicon trace note (Run 3).

**Implication.** Reported; the Rust reproduces 1–3 byte for byte.

## Run 5 — 2026-10-15 01:10 (TS suite pins, gates)

**Raw finding.** norwegian.rs pins every call of test/norwegian.test.ts and test/nbNeural.test.ts (84);
`cargo test norwegian`: 3 passed. `parity` (all): every language byte-identical but mag 199/200; `nb: 200/200`.
clippy: only `module_inception` in the new files. No port-pending rows.

## Run 6 — 2026-10-15 03:40 (the gates, rebased onto main after the Turkic group landed)

**Commands.** `git rebase origin/main` (conflicts in registry.rs and dump.mts only, rebuilt by
`.probe/G/resolve.py` from upstream plus this language's own block; dump.mts parse-checked with esbuild); then on the
combined tree: `cargo fmt --check`; `cargo run --release -p parity` (all); `cargo test --release`;
`cargo run --release -p regex-diff`; `cargo clippy --workspace --release`; every germanic per-module dump and
`LANGS=da,nb,af,lb,bar` `phonemize-sync` / `phonemize-best` / `phonemize-trace` / `trace`, re-dumped and replayed.

**Raw finding.**
```
fmt: clean
parity: all 67 language lines byte-identical except mag 199/200 and tt 199/200 (both known port-pending Arabic rows)
cargo test: 260 passed, 0 failed (+1 doc test)
regex-diff: 146326 probe results identical, 0 DIFFER, 0 patterns refused
clippy: in the new files only module_inception (registry.rs collapsible_if and structural_tagger.rs type_complexity predate)
phonemize-sync / phonemize-best / trace: 14128 identical, 0 DIFFER; phonemize-trace 14126 / 2 DIFFER — the first da
  and the first nb text (`nativised: "joao"` / `"marta"`), the lazy-lexicon trace note of da Run 3, not reproduced
```
