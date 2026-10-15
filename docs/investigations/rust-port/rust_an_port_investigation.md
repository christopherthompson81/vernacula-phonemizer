# Rust port: Aragonese (an)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_ast_port_investigation.md.

Aragonese is a rule engine with no lexicon and no neural entry, shaped like Asturian but its own modules: a
longest-first digraph + grapheme scan over the NFC lowercase (code units) with the ⟨qu gu gü⟩, distinción ⟨c⟩,
jota ⟨g⟩, glide and ⟨y⟩ rules, the dropped word-final ⟨-r⟩ after a vowel, and nasal place assimilation
(`aragonese.ts`, its own manifest slice and an object-literal symbol tier); numbers (`numbers.ts`, its own manifest
slice); a normalizer for grouping, the dot decimal, era markers, numero/lumero, hab./ and m.a., clocks, minus,
degrees (with the Aragonese compass letters) and ranges.

## Run 1 — 2026-10-15 02:44 (the import closure)

**Command.** Read aragonese.ts, numbers.ts, normalize.ts and their imports; `west/pins.mts`; `west/symdata.mts`.

**Raw finding.**
- Core imports: `clauses`, `latinPhones`, `hostWord`, `loadManifest`, `ipa` (`IPA_VOWEL`), `normalizeSymbols`,
  `numbers` (`digitIndex`), `boundaries`, `provenance` — all ported. No other language's module (it does not import
  asturian/), no neural or `ROMAN_POLICIES` entry. ⚠ FLEURS has no Aragonese: the golden, the synthetic dump rows and
  `probes/an.txt` are the whole haystack.
- Pins: test/aragonese.test.ts 56 calls / 56 expects, 0 failures (3 through `getPhonemizer("an").text`).

**Implication.** Port numbers → normalize → aragonese.

## Run 2 — 2026-10-15 02:46 (first build, the golden gate; escapes)

**Raw finding.** The grouping class `[    ]` (both uses) was written with literal characters again;
restored. Audit: 25 raw patterns, 3 not verbatim (the symbol JSON and the TOKEN and degree-tail `format!` templates,
checked by hand; `DEGREE_TAIL`'s two concatenated halves are verbatim); 1 plain pattern verbatim.
`an: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-15 02:49 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `an-normalize`, `an-g2p`, one `fn-diff` arm; `west/e2e.sh … an …`. Inputs: the
golden (200 texts), probes/an.txt (14 lines), 133 synthetic rows (grouping, era markers × 6 tails, numero/lumero/
hab./m.a. and their neighbours, the clock over 7 × 5, minus forms incl. `-5:30`, degrees with every compass letter
and tail, ranges). `an-g2p`: `phonemizeWord` and `nat` over every letter run, every 1–3 letter string of 36 letters,
every 4-letter string over `aeiouüqgcynrlbpmt`, corners; `numberToWords` over 0…20,000, magnitudes, raw strings.

**Raw finding.**
```
an-normalize: 1041 identical, 0 DIFFER   (golden 600 / probe 42 / synthetic 399)
an-g2p: 295860 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 214 identical, 0 DIFFER each
```
Texts the normalizer changes: golden 33/200, probes 8/14, synthetic 97/133.

**JS semantics reproduced on purpose.** As Asturian (`G[c] ?? …` keeps the empty ⟨h⟩, `ONES[digitIndex(d)] ?? d`,
the era callbacks' `full.slice(offset + m0.length)`); the final-⟨r⟩ test is `IPA_VOWEL.has` over a whole segment.

**Guard check.** The final-⟨r⟩ drop disabled: `an-g2p: 293193 identical, 2667 DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-15 02:51 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/aragonese/normalize.ts FN=normalizeAragonese npx tsx west/t.mts an …`.

**Raw finding (TS output, verbatim):**
1. **The minus rule's clock exclusion is dead.** `ye -5:30` → normalized `ye menos 5 30`. The minus rule guards with
   `(\d(?!\d*:))`, but the clock rule runs one step EARLIER and has already turned `5:30` into `5 30`, so the
   lookahead never sees a colon.
2. **A clock on the hour reads "zero".** `a l'hora 12:30 - 13:00` → `12 30, 13 00` → *… tɾet͡se θeɾo*: the clock rule
   is `$1 $2` and the tokenizer then reads `00` as `zero`. Asturian has the same shape (`a les 9:00 hores` → *nwebe
   θeɾo oɾes*; `9:05` → *nwebe θinko*, the zero of the minutes dropped).
3. **`W` is not a compass point here.** `Teneba 20° W` → unchanged → *binte w*: the degree word is dropped because
   the tail licenses only `[NSEU]` (ueste), so the common international `W` loses the degree.

**Implication.** Reported; the Rust reproduces all three.

## Run 5 — 2026-10-15 02:52 (TS suite pins, gates)

**Raw finding.** aragonese.rs pins all 56 calls; `cargo test aragonese`: 1 passed. `parity` (all): every language
byte-identical but mag and tt at their known 199/200; `an: 200/200`. clippy: only `module_inception`. No
port-pending rows.
