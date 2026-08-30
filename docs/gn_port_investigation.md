# Guaraní (gn) — C# port investigation

Chronological log of the runs behind the gn port.

## Run 1 — 2026-08-29 21:20 — scope

    wc -l src/languages/guarani/*.ts csharp/goldens/gn.tsv
        176 guarani.ts · 11 manifest.ts · 395 normalize.ts · 113 numbers.ts · 200 gn.tsv (rows)

The smallest shape the port has met recently: the engine is a longest-match scan plus one
context rule (the ⟨g⟩/⟨gu⟩/⟨g̃⟩ branches), stress is computed, not scanned, and the number
composer is a transparent multiplicative system. The weight is the normalizer — eleven
ordered steps, a shared-tier call in the middle, and a refusal behind most of the words.

    Registry.cs already routes `case "gn": return Create("guarani")` — only the factory was missing.
    csharp/goldens/gn.tsv (200 rows) exists, so the gate applies from the first run.

⚠ **THE HAZARD LIST, WRITTEN BEFORE ANY CODE.** Each of these is a place where the C# spelling of a JS
idiom silently means something else:

  * `VOWEL` is a `Set` of SEGMENTS, not characters: `ɨ̃` is ⟨ɨ⟩+U+0303, two code points, and the class
    only works because the engine compares whole segments. A port that splits it into `IPA_VOWEL` +
    `TILDE` would stop recognising the nasal ⟨y⟩.
  * the ⟨g̃⟩ branch claims BEFORE the plain ⟨gu⟩ test and before the digraph loop — `hag̃ua` and
    `og̃uahẽ` mis-read as [ɰ̃u] if the order slips.
  * the scan indexes by UTF-16 code unit in the TS. The token class is Latin + `’` + U+0303, all BMP, so
    code-point iteration is equivalent here — but it is equivalent by the ALPHABET, not by accident: an
    astral letter reaching the scan would make the two differ.
  * `numberToWords(Number(m[2]), m[2])` only for ≤9 digits; longer tokens go to `readDigits(raw)` —
    the raw token, because above 2^53 the double has already lost its low digits.
  * the ordinal step converts its operand to WORDS inside the rule (trap 14): the callback, not a
    substitution string, is what the port needs.
  * `rewrite` in every step is the PROVENANCE seam on the pipeline string; the two callbacks that rewrite
    a MATCHED SUBSTRING (`m.replaceAll`, `m.replace(re)`) must stay off it on `JsRegex.Replace`.
  * eleven ordered steps with three explicit couplings: de-grouping (6) before the tier (8) and before
    everything numeric; the tier (8) above the decimal fold (9) so `NOT_VERSION` keeps its dot; the
    degree-for-ordinal fold (3) before the deletion (4) that eats the leftovers.

## Run 2 — 2026-08-29 21:35 — build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer.Tests      clean (1 pre-existing warning)
    dotnet test --filter FullyQualifiedName~Guarani     45/45 pass
    dotnet run --project csharp/tools/parity -- gn     gn  OK  200 rows

No correction needed between the port and the gate. The two seam-adjacent callbacks (the de-grouping
replacements) sat off the seam on `JsRegex.Replace` from the first draft, and the poison audit agrees:

    dotnet run --project csharp/tools/parity -- --poison   distinct poison sites: 0 (SUBSTRING 0, desync 0)

`tools/seam-parity.mts` reports the gn rewrite sites in agreement: TS 14, C# 14, gap 0.

## Run 3 — 2026-08-29 21:40 — the mined corpus, the 117 rows the golden does not carry

The gn golden is the MINED tier (no FLEURS exists for gn), so the corpus is the weight. The golden
keeps 200 of the artifact's rows; the full build (`sample` + `hard`, filtered and deduped exactly as
`tools/gen_parity_goldens.mts` builds them, one process, `clearForeignOov()` once, rows in order,
through `phonemizeAsync`) yields 317. The reference was generated with `.probe/gn/run-ts.mts`, the
golden swapped in place for the run and restored after:

    317 mined rows, 317 rendered
    gn  OK  317 rows   0 differ

So the differential is 517 comparisons (200 golden + 317 mined, the overlap counted twice) with
0 differ. No BLOCKED rows: the foreign runs in the mined text reach the English reader, which is
ported, and nothing reaches an unported engine.

## Run 4 — 2026-08-29 21:50 — the mechanical pattern and table audits

`patterns.mts` extracts every regex source from both sides, resolves the C# string escapes (verbatim,
ordinary and the one interpolated TOKEN), and compares:

    18 TS patterns · 18 verbatim · 0 equivalent · 0 mismatch

The TOKEN's spliced hole is `hostWordRun(["Latin"], "'’")` on both sides — the ported shared function
with the same arguments — and the static parts around it are byte-identical. `seam-parity.mts` agrees
(14/14 rewrite sites, gap 0). The hand-written tables were diffed the same way: the symbol-tier words
(`dólar`, `kilómetro`, `centímetro`, `milímetro`, `kilogramo`, `cuadrado`, `cúbico`, `por ciento`,
`sua`) and the number words (`UNITS` 0–10, `COMBINING` 1–9, the four scale consts) are identical in
content to the TS.

## Run 5 — 2026-08-29 21:55 — the full gates

    dotnet test (full suite)      3,717 pass · 0 fail   (45 of them gn: 38 engine, 6+7 cardinals, 1 manifest-mapping)
    dotnet run --project csharp/tools/parity            153 languages byte-identical · 30,105 rows · 0 differ
    --provenance gn   tokens 4520/4520 (100.0%) mapped, nothing lost
    --ipaspans gn     tokens 3758/3758 (100.0%), 0 wrong spans
    npx vitest run test/guarani.test.ts                 23/23 (TS side untouched, still green)

No correction was needed at any point in the port: the first build compiled, the first gate was
200/200, and the widened corpus stayed at 0 differ. The hazard list in run 1 is what kept it that way —
each of those seven items is a place where a plausible C# spelling would have compiled and passed a
naive test while diverging from the TS.

## Review of #1182 — THE FINDING: `readDigits` invented a zero

### The mechanical sweep first

    30 C# patterns dumped by reflection; 0 not present verbatim in the TS set
    52 TS patterns; every one with no C# counterpart is shared-tier
    NATIVE_CLASS       identical codepoint for codepoint, including the trailing U+0303
    TOKEN              identical construction and flags (`giu`)
    seam class-B sweep every `Rewrite` in the new C# takes the PIPELINE STRING — the gl defect is absent

The composer was then walked rather than sampled — every n in 0…999,999 plus the 10⁶/10⁹ decade
structure: **1,017,989 rows, all matching the TypeScript.**

### …and the composer's SIBLING is where the defect was

`readDigits` is the ≥10⁹ / unsafe-integer fallback, and it is one line in each engine:

    TS   [...digits].map((d) => UNITS[Number(d)] ?? d).join(" ")
    C#   Js.CodePoints(digits).Select(d => UNITS[(int)Js.Number(d)])
                                                    ↑ the `?? d` is gone

⚠ **AND `(int)NaN` IS 0 IN C#**, so every character that is not a digit came back as `UNITS[0]` —
`mba'eve`, **the word for ZERO**. That is not a different reading of the character; it is a quantity
invented out of a character that carries none.

⚠ **REACHABLE THROUGH THE PUBLIC API, NOT ONLY IN THEORY.** `numberToWords(n)` with no `raw` reads
`String(n)`, and for n ≥ 10²¹ that is EXPONENT form:

    numberToWords(1e21)   TS  peteĩ e + mokõi peteĩ
                          C#  peteĩ mba'eve mba'eve mokõi peteĩ
    numberToWords(NaN)    TS  N a N              C#  mba'eve mba'eve mba'eve
    readDigits("٣")       TS  ٣                  C#  mba'eve
    readDigits("a")       TS  a                  C#  mba'eve

Six of nine probes differed. Fixed by replicating JS's array indexing exactly — a non-integral, negative
or out-of-range index yields `undefined`, and the `??` passes the character through — and pinned in ten
rows, every one re-run against the TypeScript engine.

### ⚠ AND FIXING IT SURFACED A SECOND, SEPARATE DIVERGENCE — IN SHARED CORE

The obvious repair routes through `Js.Number`, and that made the whitespace arm wrong:

    input   JS Number()   Js.Number()
    ""          0            NaN
    " "         0            NaN
    "\t"        0            NaN

JS `ToNumber` trims first and maps the empty result to +0, so a SPACE indexes `UNITS[0]` and reads as
*mba'eve* in the TypeScript. Surprising, but it is what both engines have to do — and the pre-existing C#
got that one case right BY ACCIDENT, because `(int)NaN` is also 0.

`Js.Number` has **714 call sites across 258 files**, so it is not something to move from inside a port
review. This file spells out the two lines of JS semantics it actually needs, in a local helper that
points at the issue; the Core divergence is filed as **#1183** with the patch and with two further
unverified `Number()` behaviours (`0x10`, `Infinity`) named for whoever takes it.

### The rest

    mined + attest             648 rows    0 differ
    generated haystack      15,593 rows    0 differ
    review probe               624 rows    0 differ
    73 test expectations re-run against the TypeScript (54 inline, 19 by hand)
    provenance gn (16,865 rows)  52,609/52,609 (100.0%)
    ipaspans gn                  47,155/47,155, 0 wrong
    poison gn                    0 sites (SUBSTRING 0, desync 0)
    dotnet test                  3,844 pass
    parity, fleet                154 languages, 30,305 rows, 0 differ, 0 BLOCKED
    regex-diff                   124,812 probes identical, 0 differ
    typescript                   test/guarani.test.ts 23/23, unchanged

The haystack drives **the four-way approximant paradigm exhaustively** — ⟨g̃⟩ / ⟨g̃u⟩ / ⟨g⟩ / ⟨gu⟩ before
every vowel and every consonant, at word start, after a vowel and after a consonant, which is the
paradigm this port exists to complete — plus the digraphs against their own longest-match ambiguity
(n+d vs nd), all 1- and 2-grapheme words, the stress rule where acute and nasal compete, the puso in all
five glyphs, and every normalizer step including the `ha` that is an ordinal rather than a hectare.

⚠ **AND ASTRAL LATIN, WHICH IS THE ONE PLACE THE TWO SCANS COULD PART.** The TS indexes UTF-16 CODE UNITS
and the C# indexes CODE POINTS; `\p{Script=Latin}` reaches Latin Extended-F/G, which are astral, and the
tokenizer was confirmed to hand them to the scan (`a𐞀gua` is one token). Both engines read `aˈwa` — the
divergence is inert because no BMP table key can match a surrogate half — so the C#'s comment claiming
equivalence is now measured rather than asserted.
