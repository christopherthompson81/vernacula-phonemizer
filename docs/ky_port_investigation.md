# Kyrgyz (ky) — C# port investigation

Chronological log of the runs behind the ky port.

## Run 1 — 2026-08-30 ~19:30 — scope

    wc -l src/languages/kyrgyz/*.ts
          142 kyrgyz.ts · 29 manifest.ts · 745 normalize.ts   (916 total)

A standard Kipchak Turkic: a left-to-right letter scan (the tables live in `kyrgyz.jsonc`) with three
code rules — VELAR/UVULAR harmony (⟨к⟩→[q]/⟨г⟩→[ʁ] before a back vowel, [k]/[ɡ] before a front one), dark
⟨л⟩→[ɫ] by the same back-harmony, and LONG vowels (a doubled vowel is [Vː]) — plus the Turkic decimal
composer whose one judgment call is the hundred/thousand asymmetry (⟨жүз⟩ omits a leading 1, ⟨миң⟩ keeps
⟨бир⟩). `normalize.ts` is the largest piece and carries the language's defining rule: the HYPHENATED
ORDINAL (`1991-жылы`, 354 corpus hits) is the trap-14 shape in its measured Kyrgyz form — the digits are
converted to WORDS inside the rule, the ordinal suffix is applied to the last word there, and the head
noun is re-emitted verbatim so its own case suffix survives.

`Registry.cs` already routes `case "ky"` to `Create("kyrgyz")`, and `csharp/goldens/ky.tsv` (200 rows)
exists, so the parity gate applies from the first run. The structural model read was the sibling Kipchak
ports (**Karakalpak**, **Kazakh**) for the normalizer shape and the dotless-free casing.

⚠ **THE HAZARD LIST, WRITTEN BEFORE THE GATES.** The places where a C# spelling of a JS idiom silently
means something else for ky:

  * `Js.ToLowerCase`, not `ToLowerInvariant`/`toLocaleLowerCase` — the ordinal and every case-suffix
    derivation lowercase a stem before harmony; the 28 code points `ToLowerInvariant` misses (#1116) are
    live here because the stems are Cyrillic-with-modifiers.
  * `Js.Number` + the RAW TOKEN above 2^53 — `numberWords` refuses to compose a non-safe-integer, and the
    digit run is then read digit-at-a-time through `spellDigits` so it does not leak ASCII into the IPA
    (the probes pin `9007199254740991/…992/…993` and a 20-digit run).
  * `suffixKind` is an EXACT-MATCH table, longest form first — `-дай` must not be read as `-да`, `-дын`
    as `-ды`; and a noun that merely BEGINS with the letters (жылы, декабрь) is not a suffix.
  * ky is NOT `ROMAN_NATIVE`, so the Roman pass rewrites `XIX кылым` to `19 кылым` (with a SPACE) before
    `normalizeKyrgyz` — the spaced-century arm (step 6) consumes that output and has no native source, so
    it cannot false-positive on written Kyrgyz.
  * the `у` row of the harmony table is the ASYMMETRIC one: back /у/ is rounded in the HIGH series (→ у)
    but the LOW series rounds only after a MID round vowel, so `градус` takes `ка` (→ *градуска*), not
    `ко`. Getting it wrong is the difference between the corpus's own «11 градуска чейин» and *градуско*.
  * the percent word is `пайыз`, NOT `процент` (espeak's `ky_list` carries the loser, `pratsent`).

## Run 2 — 2026-08-30 ~19:40 — build, tests, first parity

    dotnet build csharp/Vernacula.Phonemizer          clean
    dotnet test --filter "FullyQualifiedName~Kyrgyz"  36/36
    dotnet run --project csharp/tools/parity -- ky    ky  OK  200 rows

200/200 byte-identical on the first parity run. `KyrgyzTests.cs` is the portable half of
`test/kyrgyz.test.ts`: the harmony table (all four rows including the asymmetric `у`), the long-vowel and
velar/dark-l scans, the ordinal composer (the `жүз`/`бир миң` asymmetry pinned), the normalizer's arms
(hyphenated ordinal, spaced century, glued and hyphenated case suffix, percent-with-suffix, the minus
with its degree guard, both degree encodings, the ⟨о⟩ stand-in, fraction/decimal/dot, the initialism
suffix), and the whole pipeline. Every expected value is the TypeScript engine's own output; the source
`test/kyrgyz.test.ts` passes in TS (13/13, re-run in run 8), which is the pin.

## Run 3 — 2026-08-30 ~19:45 — corpus provenance (measured, not assumed)

    ls /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/ | grep -i "^ky"   → ky_kg
    ky_kg/                                                                   dev.tsv test.tsv train.tsv

Unlike the Kipchak siblings (kaa, kk's mined-only path), **ky has a FLEURS split**, so the 200-row golden
is the standard FLEURS-sourced one and the corpus-wide differential is available in its usual form. The
differential corpus is the mined + attest artifacts:

    tools/corpus/mined/ky.jsonc    289,937 bytes   (233,521-paragraph wiki dump, 256 hard + 200 sample segments)
    tools/corpus/attest/ky.jsonc    85,785 bytes

## Run 4 — 2026-08-30 ~19:55 — the corpus differential, mined + attest

`.probe/ky/extract.mts` walks both jsonc files, whitespace-folds and dedups to **840 unique lines**
(1,124 raw) in `.probe/ky/corpus.txt`, then runs all four entry points — TS sync, TS async, C# sync, C#
async (the TS side through `.probe/ky/ts_{sync,async}.mts`, the C# side through `.probe/ky/Program.cs`,
one process per mode so the foreign-OOV memo is fresh for each):

    cross-engine, sync   (TS sync  vs C# sync):   0 of 840 differ
    cross-engine, async  (TS async vs C# async):  0 of 840
    ts sync == cs sync   byte-identical over all 840 (md5 match)
    ts async == cs async byte-identical over all 840 (md5 match)

⚠ **SYNC AND ASYNC DISAGREE WITH EACH OTHER ON 39 ROWS — IN BOTH ENGINES, ON THE SAME 39 ROWS.** This is
not a porting defect; it is the parity tool's documented warning in a Kyrgyz dress. ky is rule-based, but
its corpus is dense with embedded Latin-script English (agency names, chemical symbols, `Nokia`,
`international`, `AIEP`), and those runs go through the English foreign-fallback. In sync mode that
fallback is rule g2p; in async mode the ONNX neural tagger prewarms and reads them, so a word like
`Slavonic` is *slˈeᶦvnɪk* in sync and *sləvˈɑːnɪk* in async. The two engines diverge on exactly the same
row set (verified: the 39 sync≠async indices are identical across TS and C#), which is the signature of a
language-level behaviour rather than a porting gap. **The golden is async-mode, so async is the contract,
and it is byte-identical** — the sync column is reported for completeness, not gated.

## Run 5 — 2026-08-30 ~20:00 — off-golden probes, targeting the arm gaps

`.probe/ky/probes.txt` — **271 lines**, one per `normalize.ts` arm the corpus does not carry plus the
adversarial neighbour each arm must decline:

  * de-grouping on every separator: `67 848 156`, `199 951 км²`, the NBSP/NNBSP/thin-space twins, the
    leading-zero refusal `0 000`, the single-group refusals `1 23` / `45 67`
  * the comma's dual role and the 50/50 refusal: multi-group `2,774,460` claimed, the single 3-digit
    group `45,200 км²` / `$45,000` / `0,697` left with its pause
  * the era and the case-insensitive final-dot: `б.з.ч.`, `Б.З.Ч 276–194`, `б.з.ч. 4-к.`
  * the magnitude and hyphenated-head abbreviations: `1,5 млн`, `$3,745 трлн`, `1991-ж.`,
    `1928–1933-жж.`, `20-к.`, `83-б.`, `1991-ж. жарлыгы менен` (the genitive cost)
  * the ordinal in every form: `1991-жылы`, `9-Май`/`8-Март` (the capitalised head, trap 7),
    `10-12-кылымдагы` (the ordinal SPAN, both ends ordinalised), `1880-90-жылдардан`, the spaced century
    `19 кылым` (the Roman pass's output) and its refusals (`2012 жылдын`, `4 жылда`, `20 жылдык согуш`)
  * the case suffix glued and hyphenated: `150дөн`, `1000ге`, `25ге`, `1923гө`, `530дай`, `150-дөн`
  * the percent with its bound suffix: `80,0%ке`, `40%ына`, `25,0%ин`, `%тен`, and the refusal
    `басылмалардын үлүшү (%)` (a bare sign being NAMED)
  * the minus and its degree guard (trap 24): `-38°С`, `−10 °Cга`, `—5°Сден`, `-23...-29 °C`, against the
    ranges `6-16 °C`, `2750-3800 метр`, `20-26°Сге` that must stay cardinals
  * the degrees in both encodings: `26°Сге` (Cyrillic С), `+4 °Cдан` (Latin C), `30 °C-ДАН` (the
    UPPERCASE suffix the `i`-flag would corrupt), `990оС` (the ⟨о⟩ stand-in), `39°11′–43°16′` (the
    coordinate), `45°` bare
  * the colon and its refusals: `12:30`, `UTC+5:45`, `GMT−00:43:08`, `2:52:46`, `Матай 14:33`, `24:00`,
    `14882:2011`, `8:5`
  * the units and the suffixed-unit rule: `5 км`, `1090 км²`, `0.8 км²`, `650 км³`, `мкг/м3`,
    `1 л = 1дм3`, `чогонун калыңдыгы 2,8 мден 15 мге чейин` (the decimal operand, trap 52), `720 км²ден`
  * the equals, postposed, and its bibliographic refusals: `1 теңге = 100 тыйынга`, `lg(f2/f1)=1`,
    `2002. = Стр. 499`, `Модернизация и ремонт ПК = Upgrading and Repairing`
  * the numero sign, the fractions (with the `n<den≤12` guard and the `7/268`/`013/201`/`36/10`
    refusals), the decimal comma (`2,5`, `7,22 пайыз`), the digit-dot (`198.5 миң км²`, the date refusals
    `01.04.1776`, `24.09.1981`, the clock `12.00дө`)
  * the initialisms and their bound suffixes: `СССР`, `КМШ`, `ЮНЕСКОго`, `КПССтин`, `ГЭС`/`БУУ` (the
    phonotactic test's correct refusals)
  * the 2^53 boundary `9007199254740991/…992/…993`, the 20-digit `99999999999999999999`, the NFD
    `ка̃ла`, the version-string refusals `802.11n`/`802.11г`, the rate denominators `мкг/м3дан`/
    `1 км² жерге 22,3`, the Roman centuries `XIX кылым`/`VIII-VII кылым`

    271 probes × {sync, async}   0 differ, 0 throws

## Run 6 — 2026-08-30 ~20:05 — leak sweep

    C# outputs (sync + async, 840 corpus + 271 probes):  0 carry a raw ASCII digit or an unclaimed symbol
    TS outputs (same lines):                             0

No un-phonemized digit or sign leaks into either engine's phoneme stream over the combined set.

## Run 7 — 2026-08-30 ~20:15 — the pattern diff, static and dynamic

The static patterns are checked the fleet way — `csharp/tools/regex-diff` replays Node's recorded match
results for every pattern in `csharp/regex-corpus.jsonl` through the C# `JsRegex` and compares. The 27
ky records (26 from `normalize.ts` + the TOKEN from `kyrgyz.ts`):

    ky corpus replay     1,421 probe results identical, 0 DIFFER, 0 threw
    full corpus replay   124,812 probe results identical, 0 DIFFER, 0 threw   (all languages)
    0 patterns refused by JsRegex

The dynamic patterns (the 10 `new RegExp` constructions in `normalize.ts` — the two ordinal heads, the
case-suffix, the percent-suffix, the two minus arms, the two degree arms, the suffixed-unit, the
initialism-suffix) are built from template interpolation over shared constants, so a literal scanner
cannot see them. A one-off extractor (`/tmp/kycheck/patdiff2.py`) compiles BOTH engines' patterns through
their real constant definitions (`CYR`, `NOT_WORD`, `NOT_WORD_BEFORE`, `SUFFIX_RE`, `NO_SIGN_LEFT`,
`SUFFIX_ARM`, and the `UNIT_KEYS` join), resolves `\uXXXX` to the character, and compares (body, flags)
pairs:

    TS patterns: 46 (36 static, 10 dynamic)   C# patterns: 46
    in TS, not in C#: 0     in C#, not in TS: 0
    UNIT keys: TS 34, C# 34, symmetric diff none

The one spelling difference that normalises away: the FRACTION literal carries `\/` in the TS source
(an escaped slash, which is a plain `/` in both engines) against the C#'s bare `/`.

⚠ **`UNIT_KEYS` ORDER IS SEMANTICALLY IRRELEVANT HERE, AND THAT IS CHECKED RATHER THAN ASSUMED.** The TS
builds the alternation by a stable length-descending sort of the 34 unit keys; the C# does
`OrderByDescending(k => k.Length)` over a `Dictionary`, whose enumeration order is not guaranteed to
match. Ordered alternation would only diverge if a shorter key were a prefix of a longer one AND the
longer key's tail could itself open a valid case suffix — and over this key set no such pair exists
(the single-letter keys `м`/`л` have no longer-key tail that forms a suffix split), and ordered
alternation backtracks over every alternative in both engines. The 840-line differential and the
124,812 regex-diff results re-prove it empirically.

## Run 8 — 2026-08-30 ~20:20 — the numerals, walked rather than sampled

The composer's whole reachable space was enumerated instead of sampled:

    every n in 0…999,999 plus the million and billion decades     1,000,011 rows
    BOTH ENGINES MATCH ON ALL 1,000,011 ROWS

This is the arm that pins the `жүз`/`бир миң` asymmetry across the entire magnitude range — a sample
would have missed the thousand-boundary where `бир` reappears.

## Run 9 — 2026-08-30 ~20:25 — the seam gates

    dotnet run --project csharp/tools/parity -- --poison ky
        distinct poison sites: 0  (SUBSTRING 0, desync 0)

    dotnet run --project csharp/tools/parity -- --provenance ky   tokens 4048/4048 (100.0%) mapped
    dotnet run --project csharp/tools/parity -- --ipaspans ky     spans 3623/3623 (100.0%), 0 wrong

    npx tsx tools/seam-parity.mts
        kyrgyz   TS 33 · C# 33 · gap 0 · rawTS 2 · rawC# 2   (absent from the disagreement table)

The zero poison count is the one that matters for this port: every `rewrite(s, RE, rep)` in the TS
normalizer has a `Rewrite(s, RE, rep)` in the C# (33 = 33), and the de-grouping / escape helpers that
run off the seam (`JsRe.Replace` on the captured side) are the two raw replaces each engine carries
(`rawTS 2 · rawC# 2`) — the COMMA strip and the `Esc` unit-key escaper, mirrored one-for-one.

## Run 10 — 2026-08-30 ~20:30 — the full gates

    dotnet test (full suite)                 4,699 pass, 0 fail   (36 Kyrgyz + 1 manifest mapping)
    npx vitest run test/kyrgyz.test.ts       13/13   (TS side untouched, still green)
    parity, fleet                            166 languages byte-identical, 32,339 rows, 0 differ
                                               ky  OK  200 rows
    build                                    0 errors, 0 new warnings
    parity --unported                        193 codes · 169 ported · 24 UNPORTED — ky is gone from the list

TypeScript unchanged — this port is a C#-only mirror of an already-green TS engine, per the bidirectional
policy. The fleet count rose by one language (ky) and the unported list dropped by one; no other language
moved.

## Run 11 — 2026-08-31 ~03:15 — rebase onto current main

Main took five ports while this branch was in flight (ki #1206, ltg #1207, lv #1208, lt #1210, smj #1213).
The rebase had one conflict, in the expected place:

    Bootstrap.cs   the append-only registration list — five new RegisterSelf() lines on main,
                   Kyrgyz's on this branch, both at the same spot. Kept both; order is irrelevant
                   (each factory self-registers).

Nothing else touched shared core (`csharp/Vernacula.Phonemizer/Core`, the engine root, or `src/`), so the
ky-specific results are structurally unchanged and were re-run rather than re-derived to confirm:

    ky seam gates      poison 0 · provenance 4048/4048 (100%) · IpaSpan 3623/3623 (100%), 0 wrong
    vitest kyrgyz      13/13
    regex-diff ky      1,421 probe results identical, 0 DIFFER

Recounted on the new base:

    dotnet test (full suite)                 5,136 pass, 0 fail   (36 Kyrgyz + 1 manifest mapping)
    parity, fleet                            170 languages byte-identical, 33,139 rows, 0 differ
                                               ky  OK  200 rows   (smj has no golden, so +4 languages)
    parity --unported                        193 codes · 174 ported · 19 UNPORTED — ky is gone from the list

TypeScript unchanged.

## Read for correctness — recorded, not fixed

- **The 39-row sync/async divergence is the embedded-English prewarm, not a defect.** ky is rule-based;
  the divergence is entirely in the Latin-script runs its corpus embeds, which the async neural tagger
  reads and the sync rule g2p does not. The two engines diverge on the identical row set, and the golden
  (async-mode) is byte-identical. Recorded so a future reader does not "fix" the sync column into
  agreement and silently drop the neural reading.
- **The golden carries duplicate rows.** The mined source repeats whole paragraphs, and the generator
  renders the retained segments in order without dedup, so `csharp/goldens/ky.tsv` has repeated lines.
  That is consistent with every other FLEURS-sourced golden in the fleet and costs nothing: the gate is a
  parity pin, and a repeated row is checked twice, not skipped.
- **The percent word is `пайыз` and the corpus's `процент` ×14 are all the banking sense** (interest),
  which the shared symbol tier correctly does not claim — the same register trap 37 names, resolved the
  way the TS resolved it. Nothing to change in the C#.

## Run 12 — 2026-08-31 10:20 — independent review of #1215, on the rebased branch

Rebased onto a main that had moved five commits (the lv/lt/smj ports and four backlog fixes). The rebase
resolved, and re-running everything below was the point of the review rather than a formality.

**ONE DEFECT FOUND, AND TWO-THIRDS OF IT WAS MINE.** `Bootstrap.cs` registers into a 12-space block, and
three lines sat at 8: `Lithuanian` and `LuleSami`, which I mis-indented in the earlier merges, and `Kyrgyz`,
which the rebase then placed after them. Kyrgyz was also out of alphabetical order, sitting between LuleSami
and Tashelhit. All three re-indented; Kyrgyz moved up beside the other K's. Cosmetic, but a registration
list is exactly where a mis-indented line hides a missing one.

**THE GAPS IN THIS LOG, FILLED.** Runs 1–11 have no exhaustive g2p walk, no astral or lone-surrogate fuzz,
no digit-family probe and no culture sweep. Each was run:

    exhaustive g2p + harmony walk                              284,431 words   0 differ
      (all 1–3-letter words over the full 36-letter alphabet, all 4-letter over the 22 that
       participate in a rule, EVERY consonant between EVERY vowel pair in both directions — the
       harmony-governor test — plus doubled vowels and the velars in onset vs coda per vowel class)
    astral / lone-surrogate fuzz, norm + word + text            36,081 rows    0 differ
    six digit families × 15 operand frames (\d vs \p{Nd})       191 rows       0 differ
    the ORDINAL, exhaustive 0–10,000 plus every magnitude seam  10,071 rows    0 differ
    corpus differential (mined + attest + FLEURS + golden)       2,807 rows     0 differ (norm and text)

**THE `OrderByDescending`-OVER-A-`Dictionary` CLAIM, CHECKED RATHER THAN ACCEPTED.** Run 7 argues the unit-key
order is semantically irrelevant. That is an argument; the decidable question is whether the two engines build
the same alternation. Dumped both — the TS through a `RegExp`-constructor hook, the C# by reflecting
`UNIT_KEYS` — and they are **byte-identical, all 34 keys in the same order** (md5 `f9e7a4bf…` both sides).
LINQ's `OrderByDescending` is a documented STABLE sort and JS's `Array.sort` has been stable since ES2019, so
both are "stable by length descending over insertion order"; what was unproven was that `Dictionary`
enumeration equals insertion order, and for this build it demonstrably does. Empirically closed, not
argued closed.

**THE SEAM GATES WIDENED 87×.** The golden is 200 rows, so Run 9 saw 4,048 tokens. Golden-swapped a
287,421-row reference built from the corpus and the walks, ran every gate on both engines, restored:

    parity        287,421 rows byte-identical, 0 differ
    provenance    tokens 356,069/356,069 (100.0%)
    ipaspans      346,699/346,699 (100.0%), 0 spans that do not cover what was emitted
    poison        0 sites
    TS twins      4048/4048 and 3623/3623 on the shipped golden, 0 bad spans, 0 poison

**Output leak sweep over the 287,421 readings:** zero stringified `undefined`/`null`/`NaN`, zero double
spaces, zero digits and zero CYRILLIC surviving into a reading. Thirty inputs give an empty reading and all
thirty are words made only of ⟨ъ⟩ and ⟨ь⟩ — the silent hard and soft signs, which correctly denote no sound.

**Culture and ordering sweep:** the only hit is `VOWELS.IndexOf(w[^1])`, the `char` overload, which is
ordinal by definition. No `ToLower`/`ToUpper`, no culture compare, no number formatting.

`NormalizeKyrgyzInitialisms` is `private` in C# where the TS exports it — noted and left: neither suite
tests that seam directly, both reach it through the pipeline, and the differentials cover it.

**Fleet: 170 languages byte-identical, 33,139 rows, 5,158 C# tests; the TypeScript side is untouched by this
PR and its suites pass.** Nothing else found.
