# Rust port: Asturian (ast)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_cy_port_investigation.md and
the Romance logs (rust_gl_port_investigation.md).

Asturian is a rule engine with no lexicon and no neural entry: a longest-first digraph + grapheme scan over the NFC
lowercase (code units) with the ⟨qu gu gü⟩, distinción ⟨c⟩, rising-glide and ⟨y⟩ context rules and nasal place
assimilation before a labial (`asturian.ts`, which declares its own manifest slice, symbol tier included); stress and
spirantization are deliberately folded (the file header says so). Numbers (`numbers.ts`, its own manifest slice) and
a normalizer for grouping, the dot decimal, era markers, dates, clocks, degrees, minus and ranges.

## Run 1 — 2026-10-15 02:34 (the import closure)

**Command.** Read asturian.ts, numbers.ts, normalize.ts and their imports; `west/pins.mts`.

**Raw finding.**
- Core imports: `clauses`, `latinPhones`, `hostWord`, `loadManifest`, `normalizeSymbols`, `numbers` (`digitIndex`),
  `boundaries`, `provenance` — all ported. No other language's module, no neural or `ROMAN_POLICIES` entry. FLEURS
  `ast_es`.
- The symbol tier is built from the manifest's `symbolTier` (field by field, as spanish.rs does); its
  `exponentWords.position` is optional in the TS interface, the only `#[serde(default)]` here.
- The TOKEN's extras are `'·` and `[.!?…,;:]` inside TS template literals, so the TS regex SOURCE holds the
  literal `·` / `…`; the Rust builds the same code points.
- Pins: test/asturian.test.ts 68 calls / 66 expects, 0 failures.

**Implication.** Port numbers → normalize → asturian.

## Run 2 — 2026-10-15 02:37 (first build, the golden gate; escapes)

**Raw finding.** The grouping class `[    ]` (both uses) was written with literal characters;
restored. Audit: 17 raw patterns, 1 not verbatim (the degree-tail `format!` template; the era, date and TOKEN
templates checked by hand against the TS template strings, `DEGREE_TAIL` itself verbatim); 1 plain pattern
verbatim. `ast: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-15 02:40 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `ast-normalize`, `ast-g2p`, `FLEURS_DIR` `ast: "ast_es"`, one `fn-diff` arm;
`west/e2e.sh … ast …`. Inputs: the golden (121 texts), FLEURS ast_es columns 3 and 4 (3,657 texts), probes/ast.txt
(14 lines), 147 synthetic rows (grouping, era markers × 6 tails, Roman months incl. XIII/IIII/VV, numeric months
0…13, the clock over 7 × 5, degrees with each tail, minus forms, ranges with their declining neighbours).
`ast-g2p`: `phonemizeWord` and `nat` over every letter run, every 1–3 letter string of 38 letters (incl. ḥ ḷ ·),
every 4-letter string over `aeiouüqgcynrlbpm`, corners (decomposed ḷḷ and ñ); `numberToWords` over 0…20,000,
magnitudes, raw strings.

**Raw finding.**
```
ast-normalize: 11817 identical, 0 DIFFER   (golden 363 / fleurs 10971 / probe 42 / synthetic 441)
ast-g2p: 295456 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3792 identical, 0 DIFFER each
```
Texts the normalizer changes: golden 5/121, FLEURS 260/3,657, probes 8/14, synthetic 113/147.

**JS semantics reproduced on purpose.** `G[c] ?? latinPhone(…)` keeps the manifest's empty ⟨h⟩ (`""` is not
nullish), which the `ph !== ""` test then drops; the out-of-range number passes a non-digit code point through as
itself (`ONES[digitIndex(d)] ?? d`); the era callbacks read `full.slice(offset + m0.length)`.

**Guard check.** The ⟨gü⟩ arm of the glide rule (`next === "ü" ||`) removed: `ast-g2p: 295296 identical, 160
DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-15 02:41 (reading for correctness)

**Command.** `WT=<wt> N=languages/asturian/normalize.ts FN=normalizeAsturian npx tsx west/t.mts ast …`.

**Raw finding.** Nothing reported. `3.141` → `3141` is the dot-thousands convention this layer follows (unlike gd/sq,
whose own decimal mark is the one being consumed); ranges read as a pause (`1990, 2000`) and the missing stress are
both documented choices in the file.

## Run 5 — 2026-10-15 02:42 (TS suite pins, gates)

**Raw finding.** asturian.rs pins all 68 calls; `cargo test asturian`: 1 passed. `parity` (all): every language
byte-identical but mag and tt at their known 199/200; `ast: 200/200`. clippy: only `module_inception`. No
port-pending rows.
