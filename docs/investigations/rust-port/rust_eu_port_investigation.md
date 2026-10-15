# Rust port: Basque (eu)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_cy_port_investigation.md.

Basque is a rule engine with no lexicon and no neural entry: a greedy digraph + letter scan over NFC code points with
the ⟨r⟩ tap/trill split, and the vigesimal cardinals (`basque.ts`, which declares its own manifest slice). The
normalizer (`normalize.ts`) owns the shared symbol tier (prefix percent, `countForm: () => 0`) and reads a number or
a unit glued to a case ending (`5eko`, `km/h-ko`, `km²-ko`, `1,5ean`) as one inflected word.

## Run 1 — 2026-10-15 02:12 (the import closure)

**Command.** Read basque.ts, normalize.ts and their imports; `west/pins.mts`; `west/symdata.mts`.

**Raw finding.**
- Core imports: `clauses`, `hostWord` (`LATIN_RUN`, `makeNativiser`), `loadManifest`, `normalizeSymbols`,
  `provenance` (`rewrite`, `renormalize`) — all ported. basque.ts and normalize.ts import each other
  (`cardinalWords` / `normalizeBasque`), which is harmless in Rust. No neural or `ROMAN_POLICIES` entry. ⚠ FLEURS has
  no Basque: the golden (200 rows), the synthetic dump rows and `probes/eu.txt` are the whole haystack.
- The tier's `countForm` is a function (`() => 0`), so the JSON literal carries everything but it; the Rust sets it
  on the deserialized `SymbolData` (fn-diff's `symbols` dump already maps `custom:basque` to the same twin).
- Pins: test/basque.test.ts 84 calls / 84 expects, 0 failures.

**Implication.** Port basque (manifest slice, scan, cardinals, text) and normalize, one file each.

## Run 2 — 2026-10-15 02:16 (first build, the golden gate; escapes)

**Raw finding.** The editing tool had written `º` (the rewrite's pattern) as a literal `º`, and every
` `/` `/` ` of the grouping and degree classes as literal characters; restored with `perl -CSD`. The
degree sign `°` itself is literal in the TS and stays literal. Audit: 12 raw patterns, 2 not verbatim — the symbol
JSON and the TOKEN `format!` template; the rate, unit and number-ending templates checked by hand against the TS
template strings; 4 plain patterns verbatim. `eu: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-15 02:20 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `eu-normalize`, `eu-g2p`, one `fn-diff` arm; `west/e2e.sh … eu …`.
- `eu-normalize`: `normalizeBasque` and `createBasque().text` over the golden, 13 probe lines and 1,051 synthetic
  rows (grouping with every separator, degrees incl. `º` and NBSP, each unit × rate denominator × 14 endings, each
  unit × exponent/hyphen × 14 endings, the tier's arms, minus forms, 16 numbers × 14 endings × hyphen, comma
  fractions × endings).
- `eu-g2p`: `phonemizeWord` and `nat` over every letter run, every 1–3 letter string of 29 letters, every 4-letter
  string over `aeiourtzsxdlh`, corners (decomposed ñ/ç, `İ`, `ſ`, lone surrogates); `cardinalWords` over 0…20,000
  and magnitudes to 10¹² − 1.

**Raw finding.** First build, every one:
```
eu-normalize: 2528 identical, 0 DIFFER   (golden 400 / probe 26 / synthetic 2102)
eu-g2p: 142643 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 213 identical, 0 DIFFER each
```
Texts the normalizer changes: golden 79/200, probes 9/13, synthetic 747/1,051.

**JS semantics reproduced on purpose.** The scan walks CODE POINTS of the NFC lowercase while each digraph key is
compared by its first two code UNITS; the out-of-range number reads each digit; the pipeline string is
`renormalize`d to NFC before the normalizer (on the provenance seam).

**Guard checks.** The tap condition's "next is a vowel" narrowed to `i + 2 < len`: `eu-g2p: 142142 identical, 501
DIFFER`; restored, 0. A NEGATIVE result worth keeping: `countForm` changed from `() => 0` to `() => 1` moves
nothing (`eu-normalize: 2528 identical, 0 DIFFER`) — every Basque form list has one element, so the selector is not
observable from the text; it is reproduced anyway.

## Run 4 — 2026-10-15 02:24 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/basque/normalize.ts FN=normalizeBasque npx tsx west/t.mts eu …`.

**Raw finding (TS output, verbatim):**
1. **A bare degree, and the `º` step's own output, are dropped.** `1º` → normalized `1°` → *bat*; the degree rule
   needs a following C/F and nothing reads a bare `°`, so step 1's `º → °` produces a sign no later step speaks.
2. **A dot decimal becomes a sentence break.** `Bilbo 2.5 km-ra dago.` → *bi . bos̺t kilometroɾa*; `1.5 milioi` →
   *bat . bos̺t milioi*. Basque writes a decimal comma, but the dot form reaches the TOKEN's `.` as clause punctuation
   mid-number.
3. **A consonant-final number declines the hyphenated ending.** `5-eko` → unchanged → *bos̺t eko* (two words), by
   the explicit `hyphen !== "" && !/[aeiou]$/` guard — recorded as a question, not a verdict: the guard is
   deliberate, but its fall-through reads the case ending as a separate word.

**Implication.** Reported; the Rust reproduces all three.

## Run 5 — 2026-10-15 02:26 (TS suite pins, gates)

**Raw finding.** basque.rs pins all 84 calls (12 `phonemize`, 15 `phonemizeWord`, 34 `normalizeBasque`, 23
`createBasque().text`); `cargo test basque`: 1 passed. `parity` (all): every language byte-identical but mag and
tt at their known 199/200; `eu: 200/200`. clippy: only `module_inception` in the new files (an unused
`PERCENT` constant removed: the JSON literal carries it). No port-pending rows.
