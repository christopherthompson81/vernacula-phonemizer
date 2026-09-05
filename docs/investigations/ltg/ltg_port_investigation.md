# Latgalian (ltg) — C# port investigation

## Run 1 — 2026-08-30 18:40 — scope

    wc -l src/languages/latgalian/*.ts
        129 latgalian.ts · 407 normalize.ts · 116 numbers.ts   (652 total)

Three modules plus `data/languages/latgalian/latgalian.jsonc`. No lexicon, no neural tier.

The engine is a greedy scan plus **four ordered passes**, and the passes are the whole port:

  · **PALATALIZATION** — the whole ONSET softens before a front vowel ⟨i ī e ē⟩ (`bazneica` → bazʲnʲæit͡sa),
    with **/r/ OPAQUE IN BOTH DIRECTIONS**: a consonant before ⟨r⟩ stays hard, an ⟨r⟩ inside a cluster stays
    hard, and an ⟨r⟩ blocks the leftward spread — but a SIMPLE ⟨r⟩ onset still softens.
  · **the ⟨v⟩ coda rule** — [w] only BEFORE A CONSONANT; it stays [v] before a vowel and word-finally, where
    the voicing pass then devoices it (`div` → dʲif, not dʲiw).
  · **t-EPENTHESIS** — a word-final ⟨s⟩/⟨š⟩ after a nasal surfaces as the affricate.
  · **VOICING assimilation**, regressive within obstruent clusters, plus word-final devoicing.

`numbers.ts` is the East-Baltic counted-noun concord with the **FEMININE ⟨tyukstūša⟩** — unlike Latvian's
masculine *tūkstotis*, so the thousands multiplier takes a separate feminine unit series while symts /
miļjons / miļjards take the masculine one. `normalize.ts` is eleven ordered steps.

⚠ **NO FLEURS FOR ltg.** The corpus is the mined + attest artifacts. `Registry.cs:721` already routed
`case "ltg"`; `Bootstrap.cs` was the only wiring missing.

## Run 2 — 2026-08-30 18:50 — first build + parity

    dotnet run --project csharp/tools/parity -- ltg     ltg  OK  200 rows

200/200 byte-identical on the first parity run. Three decisions made against the TypeScript:

- **`Js.Normalize` from the start** — the raw word is NFC'd before the scan, which is #1199's shape.
- **The digraph table is an ORDERED LIST OF PAIRS, not a map**, and the TS matches it CHARACTER BY
  CHARACTER (`c === k[0] && s[i+1] === k[1]`), not by substring, with `.find()` taking the first hit. A
  `Dictionary` would have lost the order.
- ⚠ **`ReadDigits` ITERATES CHARS, DELIBERATELY.** The TS spells it `digits.split("")`, and
  `String.prototype.split("")` splits by UTF-16 CODE UNIT. This is the afrikaans/georgian case from #1193,
  not the six that were corrected TO code points: spreading here would be a NEW divergence.

## Run 3 — 2026-08-30 18:55 — the mechanical diffs

    TS literals: 22 (20 distinct)   C#: 22
    in TS, not in C#:  0
    in C#, not in TS:  2   →  /^\s*["»)']?\s*$/u  and  /^\s+\p{Lu}/u

Both are in the TypeScript at `normalize.ts:294` and `:316`, inside the era/others callbacks, where the
scanner's regex-vs-division heuristic cannot see them (the preceding token is `return` / `||`). Confirmed
by grep.

⚠ **AND "0 TS-ONLY" DOES NOT COVER THE DYNAMICS**, which a literal scanner never saw. The 8 TS `new RegExp`
patterns were dumped by a constructor hook and checked against the C#'s 28 compiled patterns:

    TS dynamics NOT present in the C#:  1  →  (\p{Nd})\s*(×|x)\s*(?=\p{Nd})

…which belongs to the SHARED TIER (`core/normalizeSymbols.ts:1145`), not to Latgalian, so its absence is
correct. Verified rather than waved through.

Tables, compared mechanically: UNITS 10 · UNITS_F 10 · TEENS 10 · TENS 10 · the four magnitude `Forms` ·
the 5 unit nouns · the 9 declined magnitudes · percent · currency · the squared word — all identical.
⚠ The extractor had to anchor on the right separator: the TS writes `magnitudes: [...]` and the C#
`Magnitudes = [...]`, and anchoring on the wrong one finds a later `[` and reports a false empty list.

## Run 4 — 2026-08-30 19:00 — the differentials and the walks

    corpus (629 lines: 412 mined + 217 attest)              norm 0 · text 0
    fuzz + generated haystack (716 lines)                    norm 0 · text 0
    numbers (0…200,000 exhaustive + the magnitude decades
             + a stride to 10¹² + the refusal arms; 326,325)  0 differ

The g2p ENUMERATED:

    full 39-character alphabet, 1–3 letters                60,879 words   0 differ
    19 class representatives, 4 letters                   130,321 words   0 differ
    astral + both surrogate halves × the letters, 1–3      14,424 words   0 differ

The 4-letter representatives are chosen for the passes rather than for the alphabet: the digraph
constituents, the front vowels, **/r/** (the opacity, in both positions), the nasals with ⟨s⟩/⟨š⟩ (the
t-epenthesis) and a voiced/voiceless obstruent pair (the assimilation).

## Run 5 — 2026-08-30 19:02 — ⚠ **MY OWN TRANSPORT WAS DEGRADING EVERY ASTRAL PROBE**

The code-unit transport these harnesses use was built with `[ord(c) for c in s]`. **A Python `str` holds
CODE POINTS**, so a literal `😀` is ONE element `0x1F600` — and the drivers rebuild with `(char)x`, which
TRUNCATES it to U+F600, a private-use character. Every surrogate-HALF probe was fine (Python stores those
as separate elements); every astral-PAIR probe was silently degraded, and both engines then agreed on the
wrong input.

Fixed to a real UTF-16 encode (`encode("utf-16-le", errors="surrogatepass")`) and re-run. The corrected
control is what makes the `ReadDigits` decision visible at all:

    readDigits("1😀2")  →  "vīns \ud83d \ude00 divi"     on BOTH engines

— the astral character split into two lone surrogates, because `.split("")` is code units. If the port had
"fixed" that to `Js.CodePoints`, this row would now differ.

## Run 6 — 2026-08-30 19:05 — the seam gates on a real corpus

A 62,131-row reference generated from the TypeScript over the corpus + walk + fuzz, swapped in for
`csharp/goldens/ltg.tsv`, both engines' gates run, golden restored:

    parity ltg                 62,131 rows OK, 0 differ
    parity --poison ltg        0 sites      provenance 79,991/79,991   IpaSpan 76,920/76,920
    provenance-poison.mts      0 sites      --full coverage: 79,991/79,991 and 76,920/76,920
    seam-parity.mts            ltg absent from the disagreement table (23 unported, down from 24)

The token counts match EXACTLY across the two engines.

    leak sweep   corpus 0/629 · fuzz 0/716, on BOTH engines

## Run 7 — 2026-08-30 19:10 — the tests, and two rows that could not carry their own data

`LatgalianTests` takes its 51 expectations MECHANICALLY from `test/latgalian.test.ts` rather than by hand.
Three hand-written extras failed, and all three were my authoring, not the port:

- **`PhonemizeWord("a\ud83db")` is `"ap"`, not `"ab"`** — the stranded half is dropped and word-final
  DEVOICING then turns the /b/ into [p]. Taken from the TS after the first draft guessed.
- ⚠ **`InlineData` CANNOT CARRY A LONE SURROGATE.** xUnit serializes theory arguments, and a lone half does
  not survive the round trip — it comes back as U+FFFD, so the row silently stops testing what it says.
  (A well-formed PAIR survives; only the halves do not.) Same family as the duplicate-ID collapse: a row
  that cannot carry its own data still reports green. Both surrogate pins are now `[Fact]`s that build
  their strings in the body.

## Run 8 — 2026-08-30 19:15 — the gates

    dotnet test (full suite)          4,779 pass, 0 fail
    parity (ALL goldens)              167 languages, 32,539 rows, 0 differ

---

# PR review (#1207)

The port pass measured the arms in ISOLATION. This pass measures the things that isolation cannot reach.

## Run 9 — 2026-08-30 19:30 — the `\b` prohibition, checked rather than trusted

The TS header opens with ⚠ **NEVER `\b`** — Latgalian carries ⟨ā ē ī ō ū y č š ž ģ ķ ļ ņ⟩, which `\b`
treats as word boundaries. Grepped both engines:

    C#:  0 occurrences
    TS:  1 occurrence — inside the comment that forbids it

The boundary guards are `Boundaries.NOT_LETTER_BEFORE/AFTER` on both sides.

## Run 10 — 2026-08-30 19:35 — **the interaction corpus, which is what the captured subject needed**

The era and "and others" callbacks read the text AFTER the match to decide whether the final dot is a
sentence end. In the TS that text is `full` — the subject `String.replace` hands the callback. In the C#
it is a captured variable, snapshotted before each `Rewrite`. Those agree **only if the snapshot is the
same string the matcher is running over**, and a single-shape probe cannot tell: the mistake only shows
once an EARLIER arm has already changed the text's length before the current one runs.

So: every ordered PAIR of 22 arm shapes, plus 4,000 TRIPLES in a sentence frame, plus the dot-decision
tails:

    4,510 interaction lines   norm 0 differ · text 0 differ

## Run 11 — 2026-08-30 19:40 — the three behaviours the TS header singles out

    312 focused probes   norm 0 differ · text 0 differ

and the readings themselves, which are the point:

    "21 %"        →  21 procents          ← singular after a count ending in …1
    "11 %"        →  11 procenti          ← …but not …11
    "21,5 %"      →  21 5 procenti        ← ⚠ A FRACTION NEVER TAKES THE SINGULAR, and it is arithmetic
                                            rather than a rule: `n % 10` of 21.5 is 1.5, not 1. That is a
                                            DOUBLE modulo in both engines, which is why it is probed.
    "2 km²"       →  2 kvadratkilometri   ← ⚠ `compound`: one word. `after` would emit *kilometri kvadrat*
                                            and `before` *kvadrat kilometri*, neither of which is a word.
    "450,295 km²" →  450295 kvadratkilometri   ← de-grouping ahead of the tier, as step 4 requires

The `/iu` TOKEN fold was probed in WORD position too (`ſ`→s, U+212A→k against `cylvāks`, `Latgola`,
`absurds`, `sovs` and the upper-case forms): 0 differ.

## Run 12 — 2026-08-30 19:45 — the gates, unchanged

No code moved during the review, so the port's gates stand:

    dotnet test (full suite)          4,779 pass, 0 fail
    parity (ALL goldens)              167 languages, 32,539 rows, 0 differ
    parity --unported                 23 (down from 24)
