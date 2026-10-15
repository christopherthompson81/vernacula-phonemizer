# Rust port: Albanian (sq)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_cy_port_investigation.md.

Albanian is a rule engine with no lexicon and no neural entry: a longest-first digraph + grapheme scan over the NFC
lowercase (code units), penultimate stress placed before the penult's maximal onset by a sonority walk
(`albanian.ts`, which declares its own manifest slice), numbers through `makeNumberToWords` (fused hundreds, the `e`
connector), and a normalizer that owns the shared symbol tier (`normalize.ts`: km exponents, grouping, ranges, per
mille, degrees, signs, `presja` decimals).

## Run 1 — 2026-10-15 02:27 (the import closure)

**Command.** Read albanian.ts, numbers.ts, normalize.ts and their imports; `west/pins.mts`; `west/symdata.mts`.

**Raw finding.**
- Core imports: `clauses`, `latinPhones`, `hostWord` (`LATIN_RUN`, `makeNativiser`), `loadManifest`, `ipa`
  (`IPA_VOWEL`), `normalizeSymbols`, `provenance` — all ported. No neural or `ROMAN_POLICIES` entry. ⚠ FLEURS has no
  Albanian: the golden, the synthetic dump rows and `probes/sq.txt` are the whole haystack.
- The tier's `countForm` is a local `(n) => n === 1 ? 0 : 1` (the default selector's arithmetic, a separate
  function): set on the deserialized `SymbolData` (fn-diff's `symbols` replay maps `custom:albanian` to the default).
- `DEGREE_SIGN`'s callback reads `full.slice(offset + whole.length)`: the Rust takes the rest from `m.end()` of the
  string being rewritten.
- Pins: test/albanian.test.ts 20,046 calls / 20,067 expects, 0 failures; `west/trim_loop.py` drops the 0…20,000
  property loop (19,980 rows), leaving 66.

**Implication.** Port numbers → normalize → albanian.

## Run 2 — 2026-10-15 02:28 (first build, the golden gate; escapes)

**Raw finding.** The grouping class `[.,    ]` (both uses) was written with literal characters;
restored. Audit: 18 raw patterns, 2 not verbatim (the symbol JSON and the TOKEN `format!` template, checked by hand);
2 plain patterns verbatim. `sq: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-15 02:30 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `sq-normalize`, `sq-g2p`, one `fn-diff` arm; `west/e2e.sh … sq …`.
- `sq-normalize`: `normalizeAlbanian` and `createAlbanian().text` over the golden, 14 probe lines and 705 synthetic
  rows (km exponents and their neighbours, grouping with every separator, ranges, per mille, 9 figures × 23
  units/currencies/signs × 3 placements, degrees with each scale / a following scale name / a following word, every
  sign in and out of its guards, decimals with leading zeros). The first dump had only 84 synthetic rows; the
  figure × unit grid was added after it and replayed again.
- `sq-g2p`: `phonemizeWord` and `nat` over every letter run, every 1–3 letter string of 29 letters, every 4-letter
  string over `aeiëoushdtlmnrjz`, corners; `numberToWords` over 0…20,000, magnitudes, raw strings.

**Raw finding.**
```
sq-normalize: 1838 identical, 0 DIFFER   (golden 400 / probe 28 / synthetic 1410)
sq-g2p: 215786 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 214 identical, 0 DIFFER each
```
Texts the normalizer changes: golden 49/200, probes 10/14, synthetic 546/705.

**JS semantics reproduced on purpose.** `VOWEL.has(seg)` is membership of a whole segment in a set of single
characters (a two-character phone is never a vowel); the scan reads `w[i]` (one code unit) and the result is
NFC-normalized again after the stress mark is spliced in.

**Guard check.** The sonority walk's ⟨t d⟩ + ⟨l ɫ⟩ exception removed: `sq-g2p: 215432 identical, 354 DIFFER`.
Restored: 0 DIFFER.

## Run 4 — 2026-10-15 02:31 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/albanian/normalize.ts FN=normalizeAlbanian npx tsx west/t.mts sq …`.

**Raw finding (TS output, verbatim):**
1. **A three-digit comma decimal is read as thousands.** `numri pi është 3,141 afërsisht` → normalized `3141` →
   *ˈtɾɛ ˈmijə ˈɛ ˈɲəcind ˈɛ ˈdyzɛt ˈɛ ˈɲə*; `rritja 2,125 për qind` → `2125`. GROUP_SEPARATED takes `,` as a group
   separator before DECIMAL can read it as `presja`, in a language whose own decimal word the file reads off a comma.
   The same shape as the gd finding with a dot.

**Implication.** Reported; the Rust reproduces it.

## Run 5 — 2026-10-15 02:31 (TS suite pins, gates)

**Raw finding.** albanian.rs pins 66 calls (27 `phonemize`, 15 `phonemizeWord`, 24 `numberToWords`); `cargo test
albanian`: 1 passed. `parity` (all): every language byte-identical but mag and tt at their known 199/200;
`sq: 200/200`. clippy: only `module_inception` in the new files. No port-pending rows.
