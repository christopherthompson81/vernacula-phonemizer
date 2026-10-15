# Rust port: Occitan (oc)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_ast_port_investigation.md.

Occitan (Languedocien) is a rule engine with no lexicon and no neural entry: a longest-first digraph + grapheme scan
over the NFC lowercase (code units) with the ⟨qu gu⟩, ⟨c g⟩, ⟨u⟩-offglide and ⟨i⟩-glide rules, then intervocalic
⟨s⟩ voicing, the velar nasal, the dropped final n/r, final ⟨a⟩ → [ɔ] and final devoicing (`occitan.ts`, its own
manifest slice and a manifest symbol tier); numbers (`numbers.ts`, its own manifest slice); a normalizer for
grouping, the dot decimal, era markers, clocks, minus, degrees (not inside an `in-4°` book format) and ranges.

## Run 1 — 2026-10-15 02:54 (the import closure)

**Command.** Read occitan.ts, numbers.ts, normalize.ts and their imports; `west/pins.mts`.

**Raw finding.**
- Core imports: `clauses`, `hostWord`, `loadManifest`, `ipa` (`IPA_VOWEL`), `normalizeSymbols`, `numbers`
  (`digitIndex`), `boundaries`, `provenance` — all ported. No other language's module, no neural or `ROMAN_POLICIES`
  entry. FLEURS `oc_fr`.
- `finalDevoice` tests `last.ph in DEVOICE`, which also answers for an `Object.prototype` name; the phones it sees
  are manifest values, none of which is one, so the Rust's closed match is equivalent.
- Pins: test/occitan.test.ts 45 calls / 45 expects, 0 failures.

**Implication.** Port numbers → normalize → occitan.

## Run 2 — 2026-10-15 02:57 (first build, the golden gate; escapes)

**Raw finding.** The grouping class `[    ]` (both uses) was written with literal characters;
restored. Audit: 13 raw patterns, 2 not verbatim (the two era `format!` templates, checked by hand); 1 plain pattern
verbatim. `oc: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-15 02:59 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `oc-normalize`, `oc-g2p`, `FLEURS_DIR` `oc: "oc_fr"`, one `fn-diff` arm;
`west/e2e.sh … oc …`. Inputs: the golden (100 texts), FLEURS oc_fr columns 3 and 4 (3,919 texts), probes/oc.txt (12
lines), 82 synthetic rows (grouping, the dot decimal, era spellings and neighbours, the clock over 7 × 5, minus forms,
degrees incl. `in-4°`, `in-12° C`, `fin-4°`, ranges). `oc-g2p`: `phonemizeWord` and `nat` over every letter run,
every 1–3 letter string of 40 letters, every 4-letter string over `aeiouòqgcsnrdbtz`, corners (decomposed à/ç);
`numberToWords` over 0…20,000, magnitudes, raw strings.

**Raw finding.**
```
oc-normalize: 12339 identical, 0 DIFFER   (golden 300 / fleurs 11757 / probe 36 / synthetic 246)
oc-g2p: 314896 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 4031 identical, 0 DIFFER each
```
Texts the normalizer changes: golden 5/100, FLEURS 152/3,919, probes 6/12, synthetic 59/82.

**JS semantics reproduced on purpose.** `VOWEL_PH.has([...ph][0])` / `[...next][0]` test the first or last CODE
POINT of a phone; `w[i - 1] ?? ""` at the word start; an `sVar` only on a ⟨s⟩ that came from the grapheme table (a
digraph ⟨ss⟩ never voices).

**Guard check.** ⟨s⟩ treated as voiced before a following [s] in the voicing test: `oc-g2p: 314854 identical, 42
DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-15 03:00 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/occitan/normalize.ts FN=normalizeOccitan npx tsx west/t.mts oc …`.

**Raw finding (TS output, verbatim).** `a 9:00 oras` → `a 9 00 oras` → *ɔ nɔw zɛɾu uɾas*: the clock rule is `$1 $2`,
so a time on the hour reads "zero" — the shape found in an and ast (rust_an_port_investigation.md Run 4). Not
reported: `1.000 estatjants` → *un virgula zèro zèro zèro* is the file's own measured choice (the comment says no dot
in this corpus ever groups).

**Implication.** Reported with the an/ast finding; the Rust reproduces it.

## Run 5 — 2026-10-15 03:01 (TS suite pins, gates)

**Raw finding.** occitan.rs pins all 45 calls; `cargo test occitan`: 1 passed. `parity` (all): every language
byte-identical but mag and tt at their known 199/200; `oc: 200/200`. clippy: only `module_inception`. No
port-pending rows.

## Run 6 — 2026-10-15 03:20 (the gates, rebased onto main after #1579 and the second Turkic group #1580)

**Commands.** `git rebase origin/main` (conflicts in registry.rs, dump.mts and languages/mod.rs only, rebuilt per
commit by `west/resolve.py` from upstream plus this language's own block; dump.mts parse-checked with esbuild after
each), `cargo fmt`; then `west/gates.sh` on the combined tree: `cargo fmt --check`, `parity` (all), `cargo test
--release`, `regex-diff`, `cargo clippy --workspace --release`, every west per-module dump re-dumped and replayed, and
`LANGS=cy,ga,gd,eu,sq,ast,an,oc` `phonemize-sync` / `phonemize-best` / `phonemize-trace` / `trace`.

**Raw finding.**
```
fmt: clean
parity: all 81 language lines byte-identical except mag 199/200 and tt 199/200 (both known port-pending Arabic rows)
cargo test: 275 passed, 0 failed (+1 doc test)
regex-diff: 146326 probe results identical, 0 DIFFER, 0 patterns refused
clippy: in the new files only module_inception (the fn-diff main.rs:651 warning predates)
cy-normalize 21609 / cy-g2p 359050 / ga-normalize 20977 / ga-g2p 511130 / gd-normalize 7554 / gd-g2p 331028 /
eu-normalize 2528 / eu-g2p 142643 / sq-normalize 1838 / sq-g2p 215786 / ast-normalize 11817 / ast-g2p 295456 /
an-normalize 1041 / an-g2p 295860 / oc-normalize 12339 / oc-g2p 314896: all identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 16653 identical, 0 DIFFER each
```
