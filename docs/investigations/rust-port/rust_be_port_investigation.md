# Rust port: Belarusian (be)

Part of #1463, the Slavic group (cs, sk, be, bg, mk). Method as in rust_cs_port_investigation.md and
rust_uk_port_investigation.md (the closest sibling: Belarusian imports Ukrainian's numbers.ts).

Belarusian is a flat left-to-right letter scan (palatalisation before ь/і/iotated vowels, the iotated glide,
⟨ў⟩, the дз/дж affricates), voicing assimilation with final devoicing (unlike Ukrainian), regressive
palatalisation and geminates; numbers through the East-Slavic agreeing compositor (`eastSlavicNumberWords`,
shared with uk); a normalizer, an initialism pass and a symbol tier; and a Roman policy (neuter century
ordinal). No neural entry, no manifest.ts (belarusian.ts declares `BelarusianDef` and loads the JSONC itself).

## Run 1 — 2026-10-11 05:55 (the import closure, Cyrillic host routing)

**Question.** What does `src/languages/belarusian/` need, what does it share, and how does a foreign run route?

**Command.** Read belarusian.ts, normalize.ts, romanOrdinals.ts and their imports; `grep -n be src/registry.ts
src/neuralRegistry.ts src/core/scripts.ts`; read `rust/…/core/scripts.rs`.

**Raw finding.**
- Imports: core `clauses`, `numbers` (renderNumber, spellDigits), `loadManifest`, `normalizeSymbols`
  (makeSymbolNormalizer, slavicCountForm), `initialisms`, `boundaries` (NOT_LETTER_BEFORE), `provenance`,
  `roman` (type), and `../ukrainian/numbers.ts` (`eastSlavicNumberWords`, `EastSlavicNumbers`). All ported;
  the Rust reuses `languages::ukrainian::numbers::east_slavic_number_words` and its `EastSlavicNumbers` type,
  as the TS does. No new core module.
- registry.ts: `ROMAN_POLICIES.be = romanBe` → one `roman_policy` arm.
- scripts.ts: `be` is in `CYRILLIC_HOSTS` (the confusable-fold tie-break) but has NO `HOST_OVERRIDES` entry
  (only uk and sr do), so a Cyrillic run the be TOKEN does not claim (outside U+0400–U+04FF) goes to `ru`, which
  is ported. scripts.rs carries the same tables. The be TOKEN claims the whole Cyrillic block itself.
- be golden: 200 rows, 119 distinct texts; letters Cyrillic (14,225) and Latin (17, read by the English reader).

**Implication.** Port normalize → romanOrdinals → belarusian; the DEF manifest struct lives in belarusian.rs
(mirroring the TS), and normalize/roman read it from there.

## Run 2 — 2026-10-11 05:58 (first build, golden)

**Command.** `cargo build --release -p parity && ./target/release/parity be`.

**Raw finding.** First build failed twice on the compiler only (`gen` is reserved in edition 2024, as the uk port
found; a 36-slot array that holds 34 codas). Then `be: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-11 06:00 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `be-normalize`, `be-g2p`, `be-numbers`, `be-roman` (`be: "be_by"` in
`FLEURS_DIR`), each replayed by an `fn-diff` arm, over the golden, FLEURS be_by (columns 3 and 4) and the new
synthetic `probes/be.txt`. `be-normalize`: each stage (normalize, initialisms, the recorded symbol tier) per
text plus synthetic rows (40 numbers × 35 written suffixes, the clock grid, 132 fractions, 15 abbreviations × 6
followers, two of them fold-widened `ᲃт`/`ᲁол`); `be-g2p` over every Cyrillic run, every 1–3 letter string of
41 letters, every 4-letter string over `дзжьіяеўйлсцнтв'`; `be-numbers`: `renderNumber` with the be table over
0…20,000 and big shapes, and the Roman ordinal; `be-roman`: `normalizeRomans` with romanBe. End to end
`LANGS=be` sync / best / trace; `SYMBOLS_LANGS=be symbols`.

**Raw finding.** First build, every one (re-run with the Run 5 probe lines):
```
be-normalize: 32242 identical, 0 DIFFER  (golden 357 / fleurs 10986 / probe 96 / synthetic 5130 / words 15673)
be-g2p: 141525 identical, 0 DIFFER
be-numbers: 26170 identical, 0 DIFFER
be-roman: 3813 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace: 3813 identical, 0 DIFFER
symbols: 6849 identical, 0 DIFFER  (probe 3072 / belarusian 3777)
```
The end-to-end probes include a Greek run (→ el), a Latin run (→ en) and `ԑ` (U+0511, outside the TOKEN's block →
ru): all three match, so the Cyrillic-in-host routing is the TS's.

**JS semantics reproduced on purpose.** The dotted-abbreviation miss stringifies `undefined` (finding 1); the
scan walks code points; `ў` looks at the previous LETTER (not the previous phone); a soft sign palatalises the
previous phone only when it is non-empty and not already soft; `n.replace(",", ".")` replaces the first comma.

**Guard check.** Two mutations, then restored: the miss returning `""` instead of `undefined` →
`be-normalize: 32228 identical, 14 DIFFER` (probe 2, synthetic 12; golden and FLEURS 0); post-vocalic ⟨ў⟩
always `w` → `be-g2p: 136744 identical, 4781 DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-11 06:02 (per-arm reach)

**Command.** `FLEURS_ROOT=… npx tsx .probe/cov/run.mts be be_by belarusian normalizeBelarusian`.

**Raw finding.** (distinct texts golden 119 / FLEURS 1882 / probe 32; golden/FLEURS/probe, by normalize.ts line)
```
283 group 3/18/2   284 space 0/10/1   297 multi-dot 0/8/2   303 № 0/0/1   313 km/h 0/5/1   314 г. 4/47/3
315 гг. 0/4/1      324 magnitudes 0/0/1   329 abbrev cont 0/3/3   331 abbrev mark 0/0/2   333 abbrev end 0/1/2
347 suffix 0/20/2  365 м/с 0/1/1   367 м 1/2/1   376 °C 0/1/1   377 °F 0/0/1   378 ° 0/1/1   385 timestamp 0/0/1
386 clock 1/13/1   396 minus 0/0/2   400 ± 0/0/1   401 + 0/1/2   408–412 relational 0/0/1 each
421 fraction 0/2/1 443 range 0/12/5   451 dot decimal 0/2/1   456 space collapse 0/0/1
```
The first fraction probe line reached the rule 0 times: every fraction in it was followed by a comma, and the
rule's trailing guard refuses `,` and `.` (finding 2). A space-separated line was added (1 hit).

## Run 5 — 2026-10-11 06:04 (reading for correctness: TS findings, reported not fixed)

**Command.** `L=be npx tsx .probe/cs/t.mts <texts>` (phonemize) and `N=belarusian …` (normalizeBelarusian).

**Raw finding (TS output, verbatim):**
1. **The #1122 miss guard is missing from all three dotted-abbreviation rules.** `гэта ᲃт. слова` →
   `гэта undefined слова`, phonemized `ɣɛta ˌʌndɪfˈaᶦnd sɫova` (the ENGLISH word "undefined", via the Latin reader).
   U+1C83 (wide es) folds onto с under `iu`, so `ст` matches, and `DOTTED_ABBREV[…]!` misses. Same for `ᲁол.`
   (U+1C81 → д). 0 FLEURS hits; synthetic only. uk has the same class in one of its three arms (uk log, Run 5).
2. **A fraction before a comma or a full stop is not read as a fraction.** `1/2.` and `5/8.` → *pʲat͡sʲ vosʲem*
   (the slash dropped, two bare numbers); the trailing guard `(?![\d/\p{L}.,])` refuses ANY following `.`/`,`, not
   only a decimal continuation. (pl and uk have the same guard shape.)
3. **A sentence end after an abbreviation is lost before a capital.** `Гл. Потым` → `глядзі Потым`; `у 438 г. н.э.
   Потым` → `… нашай эры Потым` (step 1 keeps the dot only at the utterance end); `у 1990 г. Потым` → `1990 года
   Потым` (step 3 always eats the dot, on the header's claim that a year is always followed by more sentence).
   Slovak's keepFinal handles exactly this (`^\s+\p{Lu}`); be does not.
- Every table the manifest declares is read (checked field by field: the DEF fields in belarusian.ts, `numbers`
  in normalize.ts and romanOrdinals.ts).

**Implication.** Reported in the PR; one probe line per finding appended to probes/be.txt (Run 3's numbers include
them). No port-pending rows.

## Run 6 — 2026-10-11 06:08 (tests and gates)

**Changes.** belarusian.rs gains a test module: test/belarusian.test.ts's 17 `phonemizeWord`, 42
`normalizeBelarusian`, 29 `createBelarusian().text` and 3 `phonemize(…, "be").trim()` pins, extracted MECHANICALLY by
`.probe/pins.mjs` (extended for the trimmed `phonemize` form), plus a routing test: `ꙗблоко` in a be host reads
`bɫoko` (the TS value: ꙗ is outside the TOKEN's block and goes to ru, which reads it as nothing) and
`reader_for("ԑ", "be")` is `ru`. Pin guard: post-vocalic ⟨ў⟩ forced to `w` → FAILED on `воўк`; restored, passes.

**Raw finding.** parity: all 23 `200/200 identical, 0 differ`. `cargo test --release --workspace`: 137 + 1 passed.
regex-diff `144898 … 0 DIFFER, 0 patterns refused`. fmt clean; clippy adds only `module_inception` on
`belarusian::belarusian`. No TS regex added.

## Run 7 — 2026-10-11 17:20 (fixing the Run 5 findings TS-first, #1535)

**Command.** As the cs log, Run 7 (FLEURS be_by, 1,882 texts), plus the year scan below.

**Raw finding.**
1. #1122 guard (fixed) on all three dotted arms: `гэта ᲃт. слова` is left as written (no `undefined`).
2. Fraction before `.`/`,` (fixed): trailing guard `(?![\d/\p{L}]|[.,]\d)`: `1/2.` → `адна другая.`; `29/30.10.1937`
   still refused.
3. Sentence end before a capital (partly fixed): `і г.д.` (step 1, a per-entry `closes` flag) and `інш` (step 4,
   `CLOSING_ABBREV`) keep the dot before a capital. Declined: `Гл.` (precedes its object: `гл. Малюнак`), and the year:
- **Year before a capital: measured, declined.** `tools`-free scan of every `N г. <Capital>` in FLEURS be_by, bg_bg
  and mk_mk (words since the sentence start printed per hit, each read by hand): 20 hits, **12 mid-sentence** (the
  year phrase opens its sentence before the subject: `У 1970 г. Рэйманд …`, `През 1956 г. Слания …`, `Все пак през
  991 г. Етелред …`, `След унгарското Гран При през 2009 г. Пике младши беше уволнен`), **8 sentence ends** (be 5,
  bg 2, mk 1). Keeping the dot before any capital (the ru/uk choice) reads 12 wrong to fix 8, so the year rule is
  unchanged. A words-since-sentence-start threshold of ≤5 separates all 20, but with a one-word margin, tuned on the
  same 20 rows: dead end, not shipped. The era markers follow a year and share the decision.
- FLEURS be_by: 0 changes; golden be: 0 rows. Revert proof: all 3 Belarusian tests fail with HEAD normalize.ts.
