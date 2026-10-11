# Rust port: Hiligaynon (`hil`)

Branch `worktree-agent-a5a40cba5874eaeda`, after ceb. Part of #1463. The group's import closure is
rust_id_port_investigation.md Run 1: hil imports nothing from another language (hiligaynon.ts and numbers.ts are
near-copies of Cebuano's, but separate TS modules, so they are separate Rust files, not a shared one). Every core
module it needs is ported. No neural entry, no Roman policy.

## Run 1 — 2026-10-11 06:10 (the port and the golden gate)

**Command.** Ported `languages/hiligaynon/{numbers,normalize,hiligaynon}.rs` (hiligaynon.ts declares and loads its
manifest itself, so `HiligaynonDef` lives in hiligaynon.rs; numbers.ts loads its own `{ numbers }` type). The
symbol tier's literal in normalize.ts was printed as JSON by `.probe/symjson.mts` (evaluated from source) and
embedded. One `build` arm, `hil` in `LANGUAGES`. `cd rust && cargo run --release -p parity -- hil` and `--sync hil`.

**Raw finding.** `hil: 112/112 identical, 0 differ`, both modes, first build. ⚠ The golden has 112 rows, not 200,
and FLEURS has NO Hiligaynon (`ls …/fleurs_transcripts/data` shows no hil directory). So the golden plus synthetic
text is the whole haystack.

**Implication.** The normalizer needs generated inputs, not just a probe list.

## Run 2 — 2026-10-11 06:14 (differentials, with generated shapes standing in for a corpus)

**Commands.** `npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/hil/<name>.jsonl`, replayed by fn-diff;
`LANGS=hil`, `SYMBOLS_LANGS=hil`. Inputs: the golden (112), new synthetic `probes/hil.txt` (15 lines, each
normalize.ts step with its neighbour, the trigraphs gui/gue/qui/que, loan j/f, foreign accents, numbers to 10⁹),
and for `hil-normalize` ALSO 2,110 GENERATED lines: the `alas` clock over hours 0–25 × six minute shapes × seven
prefixes (incl. `salas`, a double space, no prefix); ranges over 7 × 5 endpoint shapes × 5 separators × 5 prefixes
(incl. a written `halin sa`/`hasta`, a letter, `ika-`); decimals with 1–3 fraction digits and a trailing dot,
comma or letter; grouped numbers incl. malformed groups; each abbreviation in three cases and near-misses; `ika-Nng`
variants; `sg` beside every guard character.
- `hil-g2p`: `phonemizeWord` and the nativiser over every letter run (as written, lower, UPPER), every 1–3 letter
  string over a–z, ñ, apostrophes and hyphens, and edge strings incl. the trigraphs at a word edge.
- `hil-numbers`: as ceb-numbers.

**Raw finding.**
```
hil-normalize:  2237 identical, 0 DIFFER   (golden 112, probe 15, generated 2110)
hil-g2p:        65134 identical, 0 DIFFER
hil-numbers:    22073 identical, 0 DIFFER
phonemize-sync: 127 identical, 0 DIFFER
phonemize-best: 127 identical, 0 DIFFER
trace:          127 identical, 0 DIFFER
symbols:        3184 identical, 0 DIFFER   (probe 3072, hiligaynon 112)
```
**Sensitivity**, reverted after and re-replayed green: the trigraph advance made `3 + 99` → `hil-g2p: 38 DIFFER`; the
`sg` → `sang` word misspelt → `hil-normalize: 4 DIFFER`. The end-to-end dumps are only 127 texts each: that is
the honest size of hil's text haystack, and the per-module dumps are where the coverage is.

## Run 3 — 2026-10-11 06:17 (reading for correctness: TS findings; the suite; gates)

**Command.** `npx tsx .probe/hil/findings.mts`; `node .probe/pins.mjs test/hiligaynon.test.ts`.

**Raw finding (TS defects, reproduced by Rust, not fixed).**
1. **A trigraph hides its vowel from stress** (hiligaynon.ts). `gui gue qui que` map to ONE unit (`ɡi`, `ɡe`, `ki`,
   `ke`) whose first character is a consonant, and `stressed` finds nuclei by a unit's FIRST character, so the vowel
   inside a trigraph is never a nucleus: `queso` → *kesˈo* (stress on the final syllable), `Miguel` → *mˈiɡel*;
   `guitara` → *ɡitˈaɾa* is right only because the penult happens to be outside the trigraph. The same blindness
   skips the hiatus glottal after one (`prev[0]` is the consonant).
2. **A decimal with three or more fraction digits is a pause plus a cardinal** (step 4, `\.(\d{1,2})`), as in ceb:
   `3.141 ka metro` → *tˈatlo . ʔˈisa kˈa ɡˈatos …*. The test file's own `17.865 ka pumuluyo` pin records that this
   shape is a dot-GROUPED number in one source, which is why the cap exists; a genuine three-digit decimal then has
   no reading.
3. `$5` → *lˈima*: the tier declares only `₱`, so a dollar amount loses its currency silently; `-5` likewise loses
   its sign. Both are outside the corpus-attested set the header limits itself to; recorded, not new.

test/hiligaynon.test.ts gives 9 `phonemizeWord`, 11 numeric `say`, 21 text `say`, 2 contains, 5 not-contains and 1
relational pin, plus the `toHaveLength(10)` fallback written as a count. The file has TWO helpers named `say` (one
on numbers, one on strings), so the extracted rows were split by type rather than kept as one list. Guard proved:
`sg` → `sang` misspelt → `the_ts_suite_pins_hold ... FAILED`; restored → ok.

**Gates on the final tree.**
```
parity (all 25 codes in LANGUAGES): every row identical (hil 112/112, the rest 200/200)
cargo test --workspace --release: 136 passed + 1 doc-test crate, 0 failed
regex-diff:     144898 probe results identical, 0 DIFFER, 0 patterns refused
cargo fmt --check: clean
cargo clippy: only module_inception on hiligaynon/mod.rs in the new files
```
No TS regex was added or changed. Large dumps deleted.

**Implication.** Done on this machine, with the coverage caveat of Run 1: no corpus exists for hil.

## Run 4 — 2026-10-11 16:45 (#1534: fixing the Run 3 findings, TS first)

**Command.** `npx tsx .probe/1534/q.mts hil …`; `npx tsx tools/gen_parity_goldens.mts id ms tl ceb hil ilo` and a
diff against the saved goldens.

**Question.** Can three-digit decimals be read without eating the one period-thousands number the corpus has, and
what moves when a trigraph's vowel becomes visible?

**Raw finding.**
1. **Decimals: partly fixed.** The corpus is not on this machine, so the header's measurement stands: 398 one-digit
   and 1,244 two-digit fractional parts, and exactly one three-digit (`17.865 ka pumuluyo`, a German town's
   period-thousands population). The shape `[1-9]\d{0,2}\.\d{3}` is therefore genuinely ambiguous here, and it stays
   refused, `3.141` included. Everything a thousands group cannot be is now a decimal: four or more fraction
   digits (`3.1416`), a `0` integer (`0.625`) and a four-plus-digit integer (`1234.567`, also after de-grouping
   `1,234.567`). Each read *… . <cardinal>* before. Pattern:
   `(\d)\.(\d{1,2}|\d{4,}|(?<=(?<![\d.])(?:0|\d{4,})\.)\d{3})(?![\d.,])`.
2. **Trigraphs.** `gui gue qui que` are pushed as two units (consonant, vowel) when the data's IPA ends in a vowel,
   so stress and the hiatus test see the vowel. `queso` *kesˈo* → *kˈeso* (= `keso`); `quinse` = `kinse`.
   `Miguel` stays *mˈiɡel*: the vowel is now a nucleus, but the penult default lands on ⟨i⟩ exactly as it does for
   `Migel`, so the issue's "Míguel" is the default stress, not this defect (lexical, declined).
   Golden rows moved, all from this: `Quezon` *kesˈon* → *kˈeson*, `Antique` *ʔˈantike* → *ʔantˈike* (the province
   is an-TÍ-ke), `Ambaguio` *ʔambˈaɡio* → *ʔambaɡˈiʔo* (the hiatus glottal after the trigraph vowel, plus the
   penult), `guin` *ɡin* → *ɡˈin* (a monosyllable now has a nucleus), `Balaguer` *bˈalaɡeɾ* → *balˈaɡeɾ*. 5 of 112.

**Implication.** Mirror into C# and Rust. The hil golden is regenerated with these 5 rows.
