# Rust port: Bavarian (bar)

Part of #1463, the "germanic" group (da, nb, af, lb, bar). Method as in rust_da_port_investigation.md.

Bavarian is a rule engine with no lexicon and no neural entry: a greedy longest-match grapheme scan over UTF-16 code
units (falling and closing diphthongs, digraphs), then nine token passes (the ich/ach split, silent post-vocalic ⟨h⟩,
initial ⟨st sp⟩, geminate collapse, ⟨gn⟩ coalescence, ⟨k⟩ lenition, the velar nasal, r-vocalization, final ⟨-a⟩
reduction). A normalizer whose every word is sourced from bar.wikipedia (and whose refusals — the decimal comma,
`=`/`<`/`>`, initialisms — are deliberate), the shared symbol tier as its last step, and numbers through the shared
units-first compositor (`danish/unitsFirstNumbers.ts`, reused). **FLEURS has no Bavarian**: the golden (200 rows) and
the synthetic probes are the whole text input, so the synthetic families below carry the arms.

## Run 1 — 2026-10-15 02:50 (the import closure)

**Command.** Read bavarian.ts, normalize.ts, numbers.ts, manifest.ts and their imports.

**Raw finding.**
- Core imports: `clauses`, `latinPhones`, `hostWord`, `loadManifest`, `ipa`, `normalizeSymbols`, `provenance` — all
  ported; `unitsFirstNumbers` reused from danish/. No new core module.
- manifest.ts loads `BarDef` (digraphs, graphemes, clause punctuation, ordinal stems); numbers.ts declares its own
  `numbers` slice, mirrored as such.
- ⚠ Step 1's pattern is `/&nbsp;|&#160;| /gu` whose third alternative is a **literal U+00A0** in the TS source
  (`python3` over the line: `['0xa0']`), not an escape — so the Rust keeps the literal there, written byte-level
  (`perl -CSD`) after the file, and the `\u00a0\u202f\u2009` of step 6b stay escapes. A one-line comment marks it.
- No neural entry, no `ROMAN_POLICIES` entry, no FLEURS directory. Symbol literal recorded:
  `{"percent":["Prozent"],"currency":{"€":["Eiro"],"US$":["Dollar"],"$":["Dollar"],"£":["Pfund"]},"units":{"km":["Kilometa"],"m":["Meta"],"cm":["Zantimeta"]},"exponentWords":{"squared":["Quadrat"],"cubed":["Kubik"],"position":"compound"},"magnitudes":["Millionan","Millionen","Milliona","Million","Mijona","Milliardn","Milliarde"]}`.
- Pins: test/bavarian.test.ts 98 calls / 99 expects, 0 failures.

## Run 2 — 2026-10-15 03:00 (first build, the golden gate)

**Command.** `cd rust && cargo build --release -p parity && ./target/release/parity bar`.

**Raw finding.** `bar: 200/200 identical, 0 differ` on the first build.

## Run 3 — 2026-10-15 03:05 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `bar-normalize`, `bar-g2p` (no `FLEURS_DIR` entry: there is none), one `fn-diff`
arm; `.probe/G/e2e.sh <wt> bar bar bar-normalize bar-g2p phonemize-sync phonemize-best phonemize-trace trace`.
Inputs: the golden and the new synthetic `probes/bar.txt` (13 lines).
- `bar-normalize`: `normalizeBavarian` and `createBavarian().text` over every text plus 984 synthetic rows — the three
  `&nbsp;` spellings (and two that must not match), `z. B.` variants, ordinals 0…40 × 12 frames (head nouns, a
  licenser + capital, an article under a governing preposition, `um de`, `ISBN`, sentence-final), each abbreviation ×
  3 casings × 5 tails, the clock over a 7 × 5 × 7 hour / minute / tail grid (ranges, ratios, a third field), both
  groupings and every separator, degrees, signs in and out of the degree slot, fractions over 0…12 / 0…9, ranges
  ascending / descending / chained.
- `bar-g2p`: `phonemizeWord` and `nat` over every letter run, every 1–3 letter string of 34 letters, every 4-letter
  string over `aeiouårhcgnksdtp`, corners; `numberToWords` over 0…20,000, magnitudes and raw strings.

**Raw finding.** First build, every one:
```
bar-normalize: 2394 identical, 0 DIFFER   (golden 200 / probe 13 / synthetic 984 texts × 2 ops)
bar-g2p: 246392 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 213 identical, 0 DIFFER each
```

**JS semantics reproduced on purpose.**
- the ordinal callback's one-word shift (a single captured left word moves into the `prev` slot);
- `ORDINAL[Number(digits)]` keys by `String(n)`, so `01.` finds the stem of `1`; `DENOM[Number(b)]` likewise;
- `vocalizeR` computes the first-vowel index ONCE, before it rewrites any token, and compares `i - 1` with it
  (`-1` when there is none);
- the scan walks code units, `coreChars` code points.

**Guard check.** The unstressed-⟨-er⟩ test forced true: `bar-g2p: 246041 identical, 351 DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-15 03:10 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/bavarian/normalize.ts FN=normalizeBavarian npx tsx .probe/G/t.mts bar <texts>`.

**Raw finding (TS output, verbatim):**
1. (minor) **`reduceFinalA` reduces a final ⟨a⟩ after a SILENT ⟨h⟩**: `Aha` → *ɑɐ*, `Oha` → *oɐ*. Its docstring says
   "only a single final ⟨a⟩ after a consonant"; the check is `!endsWithVowel(prev.ph)`, and `silentH` has already
   emptied the ⟨h⟩ token, so an empty phone passes as a consonant.

Everything else read against its docstring held (the clock range's `bis`, the degree-slot sign lookahead across a
joiner, the declined `2005. ISBN`, the ascending-range test that keeps ISBN chains out).

**Implication.** Reported; Rust reproduces it.

## Run 5 — 2026-10-15 03:15 (TS suite pins, gates)

**Raw finding.** bavarian.rs pins all 98 calls; `cargo test bavarian`: 2 passed. Audit: 23 raw patterns, 6 not
verbatim — the symbol JSON and five `format!` templates over `CLOCK` / `NUM` / `JOINER`, checked by hand against the
TS template literals. `parity` (all): every language byte-identical but mag 199/200; `bar: 200/200`. clippy: only
`module_inception`. No port-pending rows.

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

## Run 7 — 2026-10-15 18:33 (#1578: fixing Run 4's finding 1)

**Question.** Should `reduceFinalA` follow its docstring (a consonant before the ⟨a⟩) when `silentH` has
emptied the token before it?

**Raw finding.** The only words this reaches are ⟨V-h-a⟩ finals, and the attested ones are the interjections
`Aha` and `Oha`, whose final vowel is the stressed one. A reduced *ɐ* there is wrong whatever else is. The
rule now looks back past emptied tokens: `Aha` → *ɑɑ*, `Oha` → *oɑ*; `Bana` and `Oida` still reduce.
(`silentH` also silencing the ⟨h⟩ of `Aha` is a separate question, not taken up.) Golden: 0 bar rows stale.

**Implication.** Closed in TS, C# and Rust.
