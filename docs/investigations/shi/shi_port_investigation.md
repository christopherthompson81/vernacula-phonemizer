# Tashelhit (shi) — C# port investigation

Chronological log of the shi port. ⚠ **THIS PORT WAS TAKEN TO CLOSE #1196**, not to add a language: `shi`
is the fleet's Tifinagh routing target, so while it was unported EVERY C# language silently dropped a
Tifinagh run where the TypeScript read it.

## Run 1 — 2026-08-30 14:35 — scope

    wc -l src/languages/tashelhit/*.ts
        118 tashelhit.ts · 187 numbers.ts · 437 normalize.ts   (742 total)

Three modules plus `data/languages/tashelhit/tashelhit.jsonc`. No lexicon.

⚠ **TWO SCRIPTS, ONE LANGUAGE, TWO GRAPHEME TABLES.** The engine consumes both the Berber Latin alphabet
and Neo-Tifinagh (Morocco's constitutionally-official IRCAM script), auto-detecting **per word** by
codepoint. Both are phonemic alphabets for the same phonology, so they yield identical IPA. Beyond the
table the g2p has two rules: LABIALISATION (C + ⟨ʷ⟩, or Tifinagh ⵯ Tamatart) and GEMINATION (a doubled
consonant → a long [Cː], phonemic in Berber).

`numbers.ts` is Moroccan Arabic loan numerals with **native Berber kept for 1–3** — a deliberate, sourced
choice, with duals at 200/2000 and count-triggered plural agreement. `normalize.ts` is six ordered steps.

⚠ **NO FLEURS.** The corpus is `tools/corpus/mined/shi.jsonc` (a shi.wikipedia dump) plus
`tools/corpus/attest/shi.jsonc`. The 200-row golden holds **200 distinct** texts, which is the best ratio
of any language reviewed in this run.

`Registry.cs:639` already routed `case "shi"`; `Bootstrap.cs` was the only wiring missing.

## Run 2 — 2026-08-30 14:45 — first build + parity

    dotnet run --project csharp/tools/parity -- shi     shi  OK  200 rows

200/200 byte-identical on the first parity run. Decisions worth recording:

- **`Js.Normalize`, not `string.Normalize`, from the start** — the raw word is normalized to NFC before the
  Latin scan, and that is #1199's exact shape. Written correctly rather than found later.
- **`Js.CodePoints` throughout the scan** — the TS spreads with `[...word]` and iterates `for (const ch of
  w)`, both code points.
- The `IsVowel` helper is spelled out rather than written as a character test, because JS
  `"aiuəo".includes("")` is TRUE and an empty base can reach it if a grapheme ever maps to "".

## Run 3 — 2026-08-30 14:50 — the mechanical pattern diff, and the scanner needing a fix first

Source-scanned literals plus a RegExp-constructor hook on the TS side; reflection and a rebuild on the C#
side.

    TS literals: 17 (16 distinct)   C#: 17 (17 distinct)

The first diff reported 3 TS-only and 4 C#-only patterns. **None were real** — they are the same classes
spelled differently, the TS typing the zero-width and Arabic-Indic characters literally and the C#
escaping them. Normalizing `\uXXXX` to the character before comparing:

    in TS, not in C#:  0
    in C#, not in TS:  1   →  /^[  ]*(?:$|\p{Lu})/u

and that one IS in the TypeScript, at `normalize.ts:326`, inside the dotted-run callback — the scanner's
regex-vs-division heuristic refuses a `/` whose preceding non-space character is alphanumeric (here the
`n` of `return`). Confirmed by grep.

**The 12 DYNAMIC patterns** (4 era bodies × the at-end / inline / dotless forms) were dumped from both
engines and match, including the ordering: all four `expandDotted` passes run before all four dotless ones.

## Run 4 — 2026-08-30 14:55 — the mechanical table diff

    UNITS 11 · TEENS 9 · TENS 8 · SHORT 8 · ERA rows 8 · magnitude constants 10 · NATIVE_CLASS
                                                                          — all identical

⚠ The extractor needed anchoring on the `=`, not on the declaration: `string[] UNITS` and `readonly
[string, string]` both contain a `[` that belongs to the TYPE, and anchoring earlier silently grabs that
empty pair and reports a false mismatch.

The `SYMBOLS` block resists a static compare (the TS writes its keys unquoted), so it is covered by the
corpus and haystack differentials instead, which are strictly stronger.

## Run 5 — 2026-08-30 15:00 — the differentials

One process per side, `clearForeignOov()` once, rows in order, code-unit transport.

    corpus (789 lines: 433 mined + 218 attest + 138 probes)     norm 0 · text 0
    generated haystack (815 lines, each arm × its neighbours)   norm 0 · text 0
    numbers (0…200,000 exhaustive + boundaries + stride to 10¹²
             + the fallback arms incl. an astral raw; 326,330)   0 differ
    readDigits on its own (8 hostile raws)                       0 differ

**The g2p ENUMERATED — over BOTH tables, which is what this engine's shape demands:**

    Latin inventory (41 chars incl. ⟨ʷ⟩), 3 letters        68,921 words   0 differ
    the WHOLE Tifinagh block U+2D30–2D6F (64), 3 letters  262,144 words   0 differ
    MIXED SCRIPT, 9 representatives, 4 letters               6,561 words   0 differ
                                                    (337,626 total after dedup)

⚠ The mixed-script walk exists because `tif` is a `some` test: **one** Tifinagh character switches the
WHOLE word to the other table, and no single-script walk can reach that branch.

## Run 6 — 2026-08-30 15:05 — **#1196, verified rather than asserted**

    112 cross-language Tifinagh probes (14 languages × 8 texts)   0 differ
    PORT PENDING requested:  (none)

    "an ⵡ lá"   ga  ˈan̪ˠ w l̪ˠˈɑː     gl  ˈaŋ w lˈa      ee  an w la
                en  æn w lˈɑː          is  ˈan w lˈau

Before this port the C# dropped the `w` in every one of those (measured during the #1195 review, which is
what filed the issue). Pinned in `TashelhitTests` for five languages that have nothing to do with Berber,
because the parity gate cannot see this class: no golden row in any language carries a Tifinagh character.

## Run 7 — 2026-08-30 15:10 — the adversarial fuzz and the seam gates

    hostile fuzz (736 lines)   norm: 0 differ    text: 0 differ

⚠ **ZERO, INCLUDING THE SURROGATE PROBES** — the first port in this run where the astral fuzz found
nothing, because `Js.Normalize` was used from the start and `Rewriter.Renormalize` had already been fixed
(#1200/#1201).

A 1,584-row reference generated from the TypeScript over the corpus + haystack, swapped in for
`csharp/goldens/shi.tsv`, both engines' gates run, golden restored:

    parity shi                 1,584 rows OK, 0 differ
    parity --poison shi        0 sites      provenance 29,973/29,973   IpaSpan 26,869/26,869
    provenance-poison.mts      0 sites      --full coverage: 29,973/29,973 and 26,869/26,869
    seam-parity.mts            shi absent from the disagreement table (27 unported, down from 28)

The token counts match EXACTLY across the two engines.

    leak sweep   corpus 0/789 · haystack 0/815, on BOTH engines

⚠ The leak class here is DIGITS AND UNREAD SYMBOLS ONLY. ASCII letters are not a leak in shi — `d t b k m
n s z r l w j a i u q f h g` are all phonemic in its IPA.

## Run 8 — 2026-08-30 15:15 — the gates

    dotnet test (full suite)          4,584 pass, 0 fail   (49 Tashelhit rows + 1 manifest mapping)
    parity (ALL goldens)              163 languages, 31,764 rows, 0 differ
    npx vitest run (full suite)       290 files, 5,740 pass, 0 fail   (TypeScript untouched)
