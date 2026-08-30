# Ewe (ee) — C# port investigation

Chronological log of the runs behind the ee port.

## Run 1 — 2026-08-29 ~17:00 — scope

    wc -l src/languages/ewe/*.ts data/languages/ewe/ewe.jsonc
        104 ewe.ts · 373 normalize.ts · 76 numbers.ts · 32 ewe.jsonc

The weight is where it usually is by now: **the normalizer is three and a half times the engine.** The
g2p is a near-phonemic longest-match scan with three context rules (⟨r⟩, ⟨w⟩, the tilde) and everything
else is table; the number composer is small but *morphologically* opaque enough that no data-only
composer could express it (the wui-/bla- prefixes); `normalize.ts` is eleven ordered steps with a corpus
count and a refusal behind each one.

    Registry.cs already routes `case "ee": return Create("ewe")` — only the factory was missing.
    csharp/goldens/ee.tsv (200 rows) exists, so the gate applies from the first run.

⚠ **THE HAZARD LIST, WRITTEN BEFORE ANY CODE.** Each of these is a place where the C# spelling of a JS
idiom silently means something else:

  * `isVowelSeg` NFDs *inside* the test, so a precomposed ⟨ã⟩ still counts as a vowel. Testing the NFC
    form would make every nasal vowel a consonant and flip both allophony rules.
  * the ⟨w⟩ rule reads `chars[i+1]?.normalize("NFD")[0]` — a **UTF-16 code unit**, not a code point. For
    an astral character that is a lone high surrogate, which matches no rounded vowel. `Js.CodePoints(…)[0]`
    would be the *wrong* port here: it would hand back the whole astral character.
  * the marked-base branch is deliberately NOT restricted to vowels (the TS says so at length), so a
    marked CONSONANT reads its base letter; only the tilde carries the vowel test.
  * `TOKEN` admits U+0300–U+036F, and the whole reason the input is NFD at that point is to put a mark in
    that range where a precomposed vowel was.
  * `numberToWords(n, raw)` reads the RAW TOKEN in its ≥10⁹ arm. A port that re-stringified the double
    would read a different figure above 2^53.
  * eleven ordered normalizer steps, five of which the TS annotates with the coupling that fixes the
    order (units before decimals, percent before ranges, currency before decimals, dots after units,
    entities before the ampersand).

## Run 2 — 2026-08-29 ~17:10 — build + parity: 200/200 on the first run

    dotnet build -c Release csharp/Vernacula.Phonemizer      clean
    dotnet run -c Release --project csharp/tools/parity -- ee    ee  OK  200 rows

## Run 3 — 2026-08-29 ~17:15 — the mined corpus, under the corrected harness

The reference is built the way `tools/gen_parity_goldens.mts` builds a golden — ONE process,
`clearForeignOov()` once for the language, rows in order, through `phonemizeAsync` — which is the
correction the `bpy` port paid for. Sharding is invalid here and so is clearing per row.

    tools/corpus/mined/ee.jsonc → 396 unique texts
    ee  OK  396 rows      0 differ

## Run 4 — 2026-08-29 ~17:20 — a 9,707-row generated haystack

Built to hit every branch named in run 1's hazard list rather than to be large:

  * **the two allophony rules in every context that exists** — `r` and `w` between each pair drawn from
    the whole letter inventory plus the five digraphs plus the word edge (33 × 33 × 2 shapes), which is
    the exhaustive form of the rule rather than a sample of it;
  * the tilde on every letter, combining and precomposed, before and after a vowel;
  * 1,800 random Ewe-alphabet words weighted toward digraphs, capitals and marked letters;
  * **every numeral branch** — 0…219 solid, the magnitude corners (999/1000/1001/9999/10⁶/10⁹±1), 600
    random values below 10⁹, and the two unsafe-integer shapes;
  * **every normalizer step, on its own and in the shapes the TS names as refusals**: all ten currency
    keys × seven amounts × three spacings, nine unit keys (incl. `km2`/`km²`) × six operands, the bare-unit
    arm, percent single and span, ranges across all three dashes and all three guards (descending, both
    single-digit, scripture, ISBN), clause-final ranges, de-grouping in comma and space form, dotted
    abbreviations including `D.M.Ŋ.`, English ordinals, ampersands and entities (terminated and not), the
    four homoglyphs AND the lookalikes that must be left alone;
  * 3,400 mixed sentences of Ewe words + foreign Latin names + figures + signs + punctuation;
  * degenerate input: empty, bare apostrophes, a lone combining mark, and astral characters — including
    `w😀`, which is precisely the case where the UTF-16-unit reading in the ⟨w⟩ rule matters.

    ee  OK  9707 rows      0 differ

## Run 5 — 2026-08-29 ~17:25 — the expectations, re-run against the TypeScript

Every hard-coded value in `EweTests.cs` — 70 of them, including the two magnitude-ceiling rows the TS
suite does not carry — was fed back through `phonemizeWord` / `text()` / `normalizeEwe` / `numberToWords`
in the TypeScript engine itself, rather than trusted because the C# agreed with it.

    ALL 70 TEST EXPECTATIONS AGREE WITH THE TS ENGINE
    dotnet test --filter Ewe    80/80

⚠ **THE TWO ADDED ROWS ARE THE MAGNITUDE CEILING, which the TS suite does not pin.** There is no attested
Ewe numeral above `miliɔn`, so ≥10⁹ reads digit-by-digit — and the digit arm takes the raw token.
`9007199254740993` is 2^53+1: the double rounds it to …992, so a composer reading the *number* would read
a figure the text does not contain. Both engines read the token's own digits, and now something says so.

## Run 6 — 2026-08-29 ~17:30 — the full gates

    dotnet test (full suite)      3,542 pass, 0 fail   (80 Ewe + 1 manifest mapping)
    parity, fleet                 150 languages byte-identical, 29,505 rows, 0 differ, 0 BLOCKED
    provenance ee                 6,887/6,887 tokens mapped (100%)
    ipaspans ee                   6,110/6,110 tokens with a span, 0 wrong
    poison ee                     0 sites
    regex-diff                    124,812 probes identical, 0 differ, 0 refused
    typescript                    test/ewe.test.ts 18/18, unchanged

`ee` is the 150th byte-identical language.

## Read for correctness — recorded, not fixed

- **The raw-invisible spellings were escaped on the way across**, which is issue #1175's shape appearing
  again rather than a defect: the TS writes U+0342, U+0303, the zero-width class and the U+0300–U+036F
  token range as literal characters, and this port writes them as `\u….` escapes so the patterns stay
  greppable. The behaviour is identical; only the source is readable.
- **`NOT_MAGNITUDE`, `NLB` and `NUM` are hoisted to compiled statics** rather than rebuilt per call as the
  TS builds them inside its unit loop. `JsRegex.Compile` caches by (pattern, flags) so this changes no
  behaviour, only allocation.
- **The nested rewrites inside a callback use `JsRe.Replace`, not `Rewriter.Rewrite`** — de-grouping and
  the percent comparison both strip separators from a MATCHED substring, which is not the pipeline string.
  Calling the seam there would poison the provenance mapping; the `--poison` gate is what confirms it.

## Run 7 — 2026-08-29 ~18:00 — review of #1177: the mechanical diffs first

Reading is not the instrument. Both pattern sets were dumped and compared as data:

  * **every `JsRe` the port compiles**, by reflection over the two classes' static fields, resolved to the
    characters .NET will actually see (the `\u….` escapes expanded);
  * **every RegExp the TypeScript uses**, the dynamic ones by hooking the constructor around a
    `normalizeEwe` call and the literals by scanning the source.

        37 C# patterns; 0 not present verbatim in the TS pattern set
        TS port patterns with no C# counterpart: (none)

Then the hand-copied tables — `ONES`, `STEM`, the six magnitude words, `PERCENT`, `TO`, `UNITS`,
`CURRENCY`, and the three character classes the scan tests against — dumped by codepoint on both sides.
All identical, including the two that matter most: `etɔ̃` / `atɔ̃` are U+0254 U+0303 (⟨ɔ⟩ has no
precomposed nasal form), and the ⟨w⟩ rule's rounded set is exactly `ouɔ`.

That closes the pattern- and table-copying class of defect, which is where the `ab`, `rup` and `bal`
findings lived.

## Run 8 — 2026-08-29 ~18:10 — the cardinal, walked rather than sampled

The composer's whole reachable space below the million boundary is a million values, which is small
enough to enumerate. Dumped from the TS and compared row by row:

    every n in 0…999,999, plus the million decade structure (999 multipliers × 8 remainders)
    THE CARDINAL MATCHES THE TS ON ALL 1007992 VALUES

## Run 9 — 2026-08-29 ~18:15 — a 1,032-row probe for what the differential could not reach

  * **the JS/.NET lowercase divergence set** (İ, final sigma, ẞ, the digraph titlecase letters, Kelvin,
    Angstrom, astral) through `PhonemizeWord`. `TOKEN` admits none of them so `text()` cannot deliver one,
    but the word entry point is public and `Js.ToLowerCase` is where the two runtimes disagree;
  * **NFC-instability at step 1**, in both encodings, adjacent to every numeric rule — see run 10;
  * **the ⟨w⟩ rule's UTF-16-unit read**, against every neighbour class: precomposed, decomposed, astral,
    a bare combining mark, and each rounded/unrounded vowel both ways;
  * **the marked-consonant branch** — `Podobský`, `Française`, and 24 more marked letters whose base Ewe
    reads;
  * **every table value as a left neighbour of ⟨r⟩ and ⟨w⟩**, because `isVowelSeg` is asked about the
    SEGMENT and the interesting inputs are the multi-character ones (ɡ͡b, k͡p, t͡s, d͡z);
  * the bare-unit arm, the tokenizer's apostrophe and combining-range edges, and the corpus shapes the
    TS header names as refusals.

    ee  OK  1032 rows   0 differ

## Run 10 — 2026-08-29 ~18:20 — THE FINDING, and it is in BOTH engines

Running the seam gates over the differential rows rather than only the 200-row golden:

    --provenance ee   55609/56747 (98.0%)   1138 tokens lost over 10979 rows
    --poison ee       desync at Normalize.cs:190 — tracked=tsŊũd  s=tsŊũd

Two strings identical to the eye and different by codepoint: the tracked one is `u`+U+0303 and the live
one is precomposed ⟨ũ⟩. **Step 1's trailing re-NFC was a bare `String.Normalize` on the pipeline string**,
and it CHANGES THE LENGTH — `a` + U+0303 becomes a one-character ⟨ã⟩ — so the provenance map desynced and
every later step reported against a string the tracker had never seen.

⚠ **AND THE FIRST QUESTION WAS WHETHER THE TYPESCRIPT DOES IT TOO, because a faithful port of a defect is
not a port defect.** It does — same site, same rows:

    TS, before:  ee_mined  396 rows · provenance available 391, WITHHELD 5 · poison 13
                 ee_gen   9707 rows · available 9678, WITHHELD 29 · poison 50
                 ee_rev   1032 rows · available 914, WITHHELD 118 · poison 130

⚠ **AND IT REACHES THE SHIPPED CORPUS: 5 of the 396 mined ee.wikipedia rows lost their mapping ENTIRELY,
and they are precisely the U+0342 rows the fold exists to repair.** The fold fixes the reading and
destroys the trace on the same rows, which is the worst possible pairing — the layer that repairs a
silent defect is the one that makes the repair untraceable.

Fixed in both engines, one line each: `renormalize(…, "NFC")` / `Renormalize(…, FormC)`. That helper
exists for exactly this.

⚠ **AND A SECOND, DIFFERENT CLASS FELL OUT OF THE SAME RUN.** With the desync gone the TS still poisoned
— `s="25"`, `s="5 748 769"` — which is not the pipeline string at all but a MATCHED SUBSTRING. Three TS
sites call `rewrite` on a matched group: the space-de-grouping callback and both percent operands. The
C# port already used `JsRe.Replace` at all three, which is why its SUBSTRING section came back empty from
the first run; the TypeScript had the defect the C# seam's own header warns about. Fixed there too.

    TS, after:   all three sets — provenance available 100%, WITHHELD 0, poison 0
    and the OUTPUT of all 11,135 rows is byte-identical to the pre-fix references

## Run 11 — 2026-08-29 ~18:30 — the gates, re-run after the fix

    C# differentials              mined 396 · generated 9,707 · review 1,032 — all 0 differ
    provenance ee (11,135 rows)   56,747/56,747 (100.0%)   was 55,609/56,747
    ipaspans ee                   51,183/51,183, 0 wrong
    poison ee                     0 sites (SUBSTRING 0, desync 0)
    dotnet test                   3,542 pass
    parity, fleet                 150 languages, 29,505 rows, 0 differ, 0 BLOCKED
    vitest (FULL suite)           289 files, 5,736 tests pass
