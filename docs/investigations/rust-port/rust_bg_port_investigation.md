# Rust port: Bulgarian (bg)

Part of #1463, the Slavic group (cs, sk, be, bg, mk). Method as in rust_cs_port_investigation.md.

Bulgarian is a grapheme scan (palatalisation only before ь я ю, the three ⟨л⟩ environments) plus ordered consonant
post-rules (n→ŋ, final devoicing, regressive voicing with transparent /v/, the -стк- elision, stop-geminate
collapse, sibilant assimilation); a numberToText compositor with `и` before the final component and masculine
1/2 before милион/милиард; and a normalizer. No initialism pass, no symbol tier, no Roman policy, no neural
entry, no manifest.ts (bulgarian.ts declares its interfaces and loads the JSONC).

## Run 1 — 2026-10-11 06:12 (import closure, routing)

**Command.** Read bulgarian.ts, normalize.ts and their imports; `grep -n bg src/registry.ts src/neuralRegistry.ts
src/core/scripts.ts`; the golden script scan (cs log, Run 1).

**Raw finding.**
- Imports: core `clauses`, `loadManifest`, `ipa` (IPA_VOWEL), `provenance`. All ported; no new core module.
- registry.ts: `case "bg"` only; bg is a `CYRILLIC_HOSTS` member, no `HOST_OVERRIDES` entry.
- ⚠ The TOKEN is `[а-яёА-ЯЁ']`, so ѝ (U+045D, the Bulgarian pronoun *her*) and ѐ (U+0450) are NOT claimed: each
  is an unclaimed Cyrillic run, routed by scripts.ts to `ru` (no override), which reads them as nothing. The bg
  golden carries ѝ in 6 rows, so the golden itself depends on that route.
- bg golden: 200 rows, 105 distinct texts; Cyrillic 11,596 letters, Latin 23 (English reader).

## Run 2 — 2026-10-11 06:15 (first build, golden)

**Command.** `cargo build --release -p parity && ./target/release/parity bg`.

**Raw finding.** `bg: 200/200 identical, 0 differ` on the first build (including the 6 ѝ rows, so the ru route
and ru's empty reading of ѝ are reproduced).

## Run 3 — 2026-10-11 06:17 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `bg-normalize` and `bg-g2p` (`bg: "bg_bg"` in `FLEURS_DIR`), one `fn-diff` arm,
over the golden, FLEURS bg_bg columns 3 and 4, and the new synthetic `probes/bg.txt`. `bg-normalize` adds 372
synthetic rows (27 unit/sign shapes × 3 number forms × 3 placements, the clock grid, signs in 5 contexts);
`bg-g2p` runs `phonemizeWord` over every Cyrillic run, every 1–3 letter string of 37 letters (incl. ѝ, the
apostrophe and U+0301), every 4-letter string over `лняюьстзкгвдшчбп`, and `createBulgarian().text(n)` over
0…20,000 and big shapes (the number path, which is module-private). End to end `LANGS=bg` sync / best / trace.

**Raw finding.** First build, every one (re-run with the Run 5 probe lines):
```
bg-normalize: 4389 identical, 0 DIFFER  (golden 105 / fleurs 3888 / probe 24 / synthetic 372)
bg-g2p: 152024 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace: 4017 identical, 0 DIFFER
```

**JS semantics reproduced on purpose.** `base(t)` removes only the FIRST ʲ (`String.replace` with a string);
`isCons` reads the base's first code UNIT and treats an empty base as a consonant (`VOWELS.has(undefined)`);
the sibilant rule writes a bare `ʃ` (dropping a ʲ); the stress marks and the apostrophe are stripped before
the scan; a non-safe number is read code point by code point through the same composer.

**Guard check.** т-elision disabled → `bg-g2p: 151764 identical, 260 DIFFER`, `phonemize-sync: 4010 identical, 7
DIFFER`; restored, 0.

## Run 4 — 2026-10-11 06:19 (per-arm reach)

**Command.** `FLEURS_ROOT=… npx tsx .probe/cov/run.mts bg bg_bg bulgarian normalizeBulgarian`.

**Raw finding.** (distinct texts golden 105 / FLEURS 1990 / probe 22; golden/FLEURS/probe by line)
```
98 year 4/119/2   103 пр.н.е. 0/8/1   104 сл.н.е. 0/0/1   108 км/ч 0/10/1   109 /час 0/1/1   112 м/с 0/1/1
116 km/h 0/0/1    117 m/s 0/0/1      124 grouping 3/19/1  130 decimal 3/15/1   135 clock 0/15/1   140 № 0/1/1
143 % 1/8/1       146 ℃ 0/0/1  147 °C 0/1/1  148 °F 0/0/1  149 ° 0/1/1   153 squared 0/3/1  159 units 1/21/1
162 range 0/14/1  167–168 currency 0/0/1   172 signed 0/2/2   177 infix + 0/0/1   178 relational loop 0/0/1
181 & 0/0/1       184 space collapse 0/0/1
```
(The relational loop is one call site for nine patterns, so the hook cannot split it; the probe line carries
every one of the nine.)
Every arm is reached; the relational signs, `℃`, `°F`, `сл.н.е.` and the Latin rates only by the probes.

## Run 5 — 2026-10-11 06:20 (reading for correctness: TS findings, reported not fixed)

**Command.** `L=bg npx tsx .probe/cs/t.mts <texts>`, `N=bulgarian …`; FLEURS counts by `grep -cP` over the 1,990
distinct column-3 texts.

**Raw finding (TS output, verbatim):**
1. **ѝ is dropped.** `и ѝ каза` → `i kaza`; `вѝ` → `f`. The TOKEN class `[а-яёА-ЯЁ']` omits ѝ (U+045D) and ѐ
   (U+0450), so they route to the Russian reader, which reads nothing. ѝ is the ordinary clitic *her*: 7 of 1,990
   FLEURS texts (8 tokens), and 6 golden rows already record the dropped reading.
2. **`млн.` is not expanded.** `1,5 млн. души` → `… pɛt mɫn .` (the cluster, and the dot as a sentence end). FLEURS:
   1 text.
3. **The ordinal suffix is read as a bare syllable.** `1-ви клас` → `ɛdnɔ vi`. FLEURS: 14 texts with `N-ви/-ри/-ти/
   -ия/-та/-то`.
4. **The year abbreviation eats a sentence end.** `през 2020 г. Тогава` → `… ɡɔdina tɔɡava` (no pause). FLEURS: 9
   texts with `N г. <Capital>`.
5. **`ч.` after a clock is the bare letter.** `в 12:05 ч.` → `… pɛt t͡ʃ .`
- Every table the manifest declares is read.

**Implication.** Reported in the PR; one probe line per finding appended to probes/bg.txt.

## Run 6 — 2026-10-11 06:22 (tests and gates)

**Changes.** bulgarian.rs gains a test module: test/bulgarian.test.ts's 8 `phonemizeWord`, 16 `normalizeBulgarian`,
13 `.text(…)` `toBe` and 6 `.text(…)` `toContain` pins (all 43 of its assertions), extracted MECHANICALLY by
`.probe/pins.mjs` (extended for `.text(…).toContain`), plus a routing test (`и ѝ каза` → `i kaza` in a bg host;
`reader_for("ѝ", "bg")` is `ru`). Pin guard: final devoicing disabled → FAILED on `град`; restored, passes.

**Raw finding.** parity: all 24 `200/200 identical, 0 differ`. `cargo test --release --workspace`: 139 + 1 passed.
regex-diff `144898 … 0 DIFFER, 0 patterns refused`. fmt clean; clippy adds only `module_inception` on
`bulgarian::bulgarian`. No TS regex added.

## Run 7 — 2026-10-11 17:20 (fixing the Run 5 findings TS-first, #1535)

**Command.** As the cs log, Run 7 (FLEURS bg_bg, 1,990 texts), plus the year scan below.

**Raw finding.**
1. ѝ (fixed): ѐ ѝ Ѐ Ѝ in the TOKEN, `"ѐ": "ɛ", "ѝ": "i"` in `letters`, both in `frontVowelLetters`. `и ѝ каза` → `i i
   kaza`. Golden bg: **6 rows move** (2 texts × 3), each only gaining the `i` of ѝ. FLEURS: all 7 ѝ texts change.
2. `млн.`/`млрд.` (fixed): manifest `magnitudeAbbrev`; an integer is multiplied out so the composer agrees it
   (`340 млн.` → `триста и четирийсет милиона`, `1 млн.` → `един милион`), a decimal keeps its digits + plural. FLEURS: 1.
3. Ordinal suffix (fixed): manifest `ordinals` (last cardinal word → masculine ordinal, plus the six endings); the form
   ending with the written suffix is chosen, none → as written. FLEURS: 30 texts change through `phonemize`
   (`1-ви януари`, `18-ти век`, `4-о, 5-о и 6-о място`, `37-ата`, `190-то`, …). **Dead end found:** the 11 SPACED
   texts (`15 - ти век`) change under `normalizeBulgarian` but not through `phonemize`: `core/unicode.ts`
   `foldSpacedDash` turns ` - ` before a letter into `, ` upstream (`15, ти век`), and claiming `N, ти` would misread
   the pronoun *ти*. Left. `-те` (`50-те години`, the definite CARDINAL) is left as written: out of scope, and the
   definite plural `-ите` is kept out of the endings so it cannot be claimed as an ordinal.
4. Year before a capital (declined, measured):
- **Year before a capital: measured, declined.** `tools`-free scan of every `N г. <Capital>` in FLEURS be_by, bg_bg
  and mk_mk (words since the sentence start printed per hit, each read by hand): 20 hits, **12 mid-sentence** (the
  year phrase opens its sentence before the subject: `У 1970 г. Рэйманд …`, `През 1956 г. Слания …`, `Все пак през
  991 г. Етелред …`, `След унгарското Гран При през 2009 г. Пике младши беше уволнен`), **8 sentence ends** (be 5,
  bg 2, mk 1). Keeping the dot before any capital (the ru/uk choice) reads 12 wrong to fix 8, so the year rule is
  unchanged. A words-since-sentence-start threshold of ≤5 separates all 20, but with a one-word margin, tuned on the
  same 20 rows: dead end, not shipped. The era markers follow a year and share the decision.
5. `ч.` after a clock (fixed): `часа` (manifest `hourAbbrev`), dot kept only at the utterance end (`12:00 ч. GMT` is
   mid-sentence), a glued letter spaced off. FLEURS: 4 texts.
- FLEURS bg_bg: normalize 41, phonemize 37 of 1,990 change, every one one of the above.
- Revert proof: HEAD normalize.ts fails the three normalizer tests; HEAD bulgarian.ts fails ѝ and the ordinal test.
