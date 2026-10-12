# Rust port: Macedonian (mk)

Part of #1463, the Slavic group (cs, sk, be, bg, mk). Method as in rust_cs_port_investigation.md. This log also
records the group's final cross-language check (Run 6).

Macedonian is a grapheme scan (dark-l in code, every other letter from the table), syllabic ⟨р⟩, the South-Slavic
consonant post-rules and fixed ANTEPENULT stress; a numbers module (cardinal with `и`, feminine две before
илјади, digit fallback from 10⁹; the masculine-indefinite ordinal) shared by the engine and the normalizer; a
dense normalizer (period/space de-grouping, era, year, abbreviations, version dots, ranges, the clock, the
ordinal SUFFIX with gender and definiteness, century, dates, regnal, rates, degrees, signs, fractions, lone
letters); the initialism pass and the symbol tier. It shares nothing with Bulgarian in the TS (each declares its
own `NumbersDef` and post-rules), so nothing is reused. No neural entry, no Roman policy.

## Run 1 — 2026-10-11 06:25 (import closure, routing)

**Command.** Read macedonian.ts, numbers.ts, normalize.ts and imports; `grep -n mk src/registry.ts
src/neuralRegistry.ts src/core/scripts.ts`.

**Raw finding.**
- Imports: core `clauses`, `loadManifest`, `normalizeSymbols`, `ipa`, `initialisms`, `provenance`. All ported.
- registry.ts: `case "mk"`; mk is in `VULGAR_FOLD_OPT_OUT` (registry.rs carries it) and `CYRILLIC_HOSTS`; no
  `HOST_OVERRIDES` entry. The TOKEN `[а-шА-ШѓѕјљњќџЃЅЈЉЊЌЏѐѝЀЍ]` leaves out щ ъ ы ь э ю я ё (and й is inside the
  range but in no letter table), so those letters form unclaimed Cyrillic runs routed to `ru`.
- Three TS modules each load macedonian.jsonc with the fields they read; the Rust has one struct (their union)
  in macedonian.rs.
- mk golden: 200 rows, 133 distinct texts; Cyrillic 14,576 letters, Latin 60.

## Run 2 — 2026-10-11 06:30 (first build, golden)

**Raw finding.** One compiler error (a coda array sized 63 that holds 61). Then `mk: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-11 06:33 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `mk-normalize`, `mk-g2p`, `mk-numbers` (`mk: "mk_mk"` in `FLEURS_DIR`), one
`fn-diff` arm, over the golden, FLEURS mk_mk columns 3 and 4 and the new synthetic `probes/mk.txt`.
`mk-normalize`: each stage (normalize, initialisms, the recorded symbol tier), plus synthetic rows (23 numbers × 15
suffixes × 3 shapes, centuries, dates, regnal shapes, the clock grid with and without `ч.`, 32 fractions);
`mk-g2p` over every Cyrillic run, every 1–3 letter string of 39 letters (incl. й ю я ы щ), every 4-letter string
over `лрнкгвдзсшчтаеиј`; `mk-numbers`: `numberToText` and `mkOrdinal` over 0…20,000, big shapes, non-integers, and
raw strings through the 10⁹ fallback. End to end `LANGS=mk` sync / best / trace; `SYMBOLS_LANGS=mk symbols`.

**Raw finding.** First build, every one (re-run with the Run 5 probe lines):
```
mk-normalize: 28939 identical, 0 DIFFER  (golden 399 / fleurs 10803 / probe 72 / synthetic 4284 / words 13381)
mk-g2p: 134484 identical, 0 DIFFER
mk-numbers: 50156 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace: 3758 identical, 0 DIFFER
symbols: 6806 identical, 0 DIFFER  (probe 3072 / macedonian 3734)
```

**JS semantics reproduced on purpose.** `isVowel` needs the WHOLE token to be one vowel character (so `r̩` is a
nucleus only by its own test, and a multi-character phone never is); the clock's optional `ч` group is tested for
participation; `numberToText` refuses a non-integer; the digit fallback keeps only code points in "0"…"9".

**Guard check.** Two mutations, then restored: stress on the penult instead of the antepenult → `mk-g2p: 122574
identical, 11910 DIFFER`; the `ч` test inverted → `mk-normalize: 28715 identical, 224 DIFFER` (golden 2, FLEURS
20, probe 2, synthetic 200). Restored: 0 DIFFER.

## Run 4 — 2026-10-11 06:35 (per-arm reach)

**Command.** `FLEURS_ROOT=… npx tsx .probe/cov/run.mts mk mk_mk macedonian normalizeMacedonian`.

**Raw finding.** (distinct texts golden 133 / FLEURS 1857 / probe 22; golden/FLEURS/probe by line) 51 rewrite sites;
every one is reached by at least one source. The golden reaches 9 (155 period group 4, 169 `г.` 2, 198 clock 2,
217 suffix 3, 273 date 2, 309 км² 1, 360 initial 1, 361 lone capital 2); FLEURS reaches 39; the probes reach the
rest alone: 212 `pm`, 293 regnal, 313/316/317 degree shapes, 322 minus, 327 ±, 329–333 the signs, 347 ¼.

## Run 5 — 2026-10-11 06:37 (reading for correctness: TS findings, reported not fixed)

**Command.** `L=mk npx tsx .probe/cs/t.mts <texts>`, `N=macedonian …`.

**Raw finding (TS output, verbatim):**
1. **A Russian-spelled name is split and loses letters.** `Юрий Гагарин` → `ju rˈi ɡˈaɡarin`: Ю is outside the
   TOKEN and goes to the Russian reader as its own word, й is inside the class but in no letter table and is
   dropped. (Routing as the TS has it; the TOKEN and the letter table disagree about й.)
2. **The year and `итн.` eat a sentence end before a capital.** `во 1990 г. Потоа` → `… ɡˈɔdina pˈɔtɔa`; `итн.
   Потоа` → `… nˈatamu pˈɔtɔa` (no pause). Same class as cs/sk/be/bg.
3. **A fraction with a numerator other than 1 drops its slash.** `2/3 од нив` → `dvˈa trˈi …`. Same as cs.
4. **The regnal rule reads any capitalised word before `N.` as a name.** `Македонија 2.` → *Македонија втора*.
   The guards (2–39, punctuation after) do not tell a name from a country. Same class as cs finding 2.
- Every table the manifest declares is read.

**Implication.** Reported in the PR; one probe line per finding appended to probes/mk.txt.

## Run 6 — 2026-10-11 06:41 (tests, every gate, and the group's cross-language check)

**Changes.** macedonian.rs gains a test module: test/macedonian.test.ts's 14 `phonemizeWord`, 27
`normalizeMacedonian`, 6 `createMacedonian().text` and 37 registry-path pins (`ph(…)` = `getPhonemizer("mk")
.text(…).trim()`, plus one `.text` in a getPhonemizer block) — all 84 of its assertions — extracted MECHANICALLY by
`.probe/pins.mjs` (extended with `PH_FN` for the local helper, and a multi-line `toBe(`), plus a routing test
(`Юрий` → `ju rˈi`; `reader_for("Ю", "mk")` is `ru`). Pin guard: penult stress → FAILED on `џамија`; restored.

**Cross-language check.** Does registering the five Slavic engines move any earlier language? `LANGS=en,en-GB,ja,
it,es,pt,pt-BR,hi,cmn,fr,el,ko,th,ru,de,pl,tr,nl,uk,sv … dump.mts phonemize-sync` (their goldens, FLEURS and
probes; 90 MB, deleted after) replayed on the final tree: `77341 identical, 1 DIFFER` — the one row is the Lao run
inside a Thai probe (`ไทยລາວไทย`, lo not ported) that the uk log (Run 6) already records with and without uk. As
expected: a Cyrillic run inside any other host still goes to ru, and nothing routes a Latin run to cs or sk.

**Raw finding (final tree).** parity: all 25 (en … sv, cs, sk, be, bg, mk) `200/200 identical, 0 differ`.
`cargo test --release --workspace`: 141 + 1 passed. regex-diff `144898 probe results identical, 0 DIFFER, 0
patterns refused`. `cargo fmt --check` clean. clippy: in the new files, only the five `module_inception` warnings
(every clippy span was grepped for the five directories). No TS regex was added or changed, so `tools/extract_regexes.mts` was not
needed.

## Run 7 — 2026-10-11 17:20 (fixing the Run 5 findings TS-first, #1535)

**Command.** As the cs log, Run 7 (FLEURS mk_mk, 1,857 texts).

**Raw finding.**
1. Russian-spelled names (fixed): TOKEN class `[а-яА-ЯёЁ…]`, and manifest `russianLetters` folds ё й щ ъ ы ь э ю я to
   the Macedonian spelling before the scan. `Юрий Гагарин` → `jˈurij ɡˈaɡarin` (= `Јуриј`). 0 FLEURS texts carry
   these letters.
2. `итн.` before a capital (fixed): the dot is kept. The year (declined, measured):
- **Year before a capital: measured, declined.** `tools`-free scan of every `N г. <Capital>` in FLEURS be_by, bg_bg
  and mk_mk (words since the sentence start printed per hit, each read by hand): 20 hits, **12 mid-sentence** (the
  year phrase opens its sentence before the subject: `У 1970 г. Рэйманд …`, `През 1956 г. Слания …`, `Все пак през
  991 г. Етелред …`, `След унгарското Гран При през 2009 г. Пике младши беше уволнен`), **8 sentence ends** (be 5,
  bg 2, mk 1). Keeping the dot before any capital (the ru/uk choice) reads 12 wrong to fix 8, so the year rule is
  unchanged. A words-since-sentence-start threshold of ≤5 separates all 20, but with a one-word margin, tuned on the
  same 20 rows: dead end, not shipped. The era markers follow a year and share the decision.
3. Fraction (fixed): every numerator, `FRACTION_NOUN` [sg, pl] by mkCountForm's rule, feminine numeral: `две третини`,
   `дваесет и една половина`, `единаесет третини`.
4. Regnal (partly fixed, as cs): the name may not open the sentence. `Македонија 2.` stays; all three FLEURS regnal
   readings are mid-sentence and unchanged. test/macedonian.test.ts's two utterance-initial pins (`Лиалофи III`,
   `Луј XVI`) were given a preceding word. Declined: a capitalised non-name mid-sentence.
- FLEURS mk_mk: 0 changes; golden mk: 0 rows. Revert proof: HEAD normalize.ts fails 3 tests, HEAD macedonian.ts 1.
