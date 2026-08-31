# Maltese (mt) — C# port investigation

## Run 1 — 2026-08-31 16:10 — scope

    wc -l src/languages/maltese/*.ts
        149 maltese.ts · 876 normalize.ts · 178 numbers.ts   (1,203 total)

Three modules plus `data/languages/maltese/maltese.jsonc`. Golden 200 rows, mined + attest artifacts, and
FLEURS `mt_mt` all present. `Registry.cs:563` already routed `case "mt"`.

Maltese is **the only Semitic language written in the Latin alphabet**, and that is not a curiosity here —
it is what makes every rule in the layer unusual:

  · **THE HYPHEN IS THE DEFINITE ARTICLE.** `il-`/`l-` and its assimilated allomorphs bind to the following
    word with a hyphen, and every preposition fuses with it too — 3,322 hyphens in 449 retained segments. A
    hyphen here is almost never a range or a minus, which is why the minus rule is anchored on BOTH sides
    and why there is **no range rule at all**.
  · **COUNT AGREEMENT IS SEMITIC**: plural after 2–10, singular from 11 up, and a decimal takes the plural.
    It governs every unit, currency and measure word the layer emits.
  · **THE NUMERALS ARE A CONSTITUENT LIST, not a per-magnitude recursion.** Units-first inside 21–99
    (`ħamsa u erbgħin`), DUAL forms for exactly 2× a magnitude (`mitejn`, `elfejn`), and `u` attaching only
    to the FINAL constituent.
  · The g2p is a greedy scan whose difficulty is entirely **silent letters**: ⟨għ⟩ and ⟨h⟩ are silent except
    word-finally, where both surface as [ħ], and the vowel pair they leave behind then collapses.

## Run 2 — 2026-08-31 16:50 — first build + parity

Two compile-time slips, both caught by the build and neither reaching a test: `Js.ToUpperCase` does not
exist (the fleet idiom is `ToUpperInvariant`, and here the capture is `([CF])` under `i`, so it is
equivalent BY CONSTRUCTION — noted at the site), and a leftover unused local function from an earlier draft.

    dotnet run -c Release --project csharp/tools/parity -- mt
        1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first parity run.

## Run 3 — 2026-08-31 17:10 — the differentials

    corpus: FLEURS mt_mt + mined + attest + golden      2,734 texts   0 differ (norm and text)
    exhaustive g2p                                    655,293 words   0 differ
    interaction corpus + numbers                       22,283 rows    0 differ (norm and text)
    astral / lone-surrogate fuzz                       36,591 rows    0 differ (norm, word, text)
    five digit families × 11 operand frames               115 rows    0 differ

The g2p walk was built for the silent-letter rules specifically: all 1–3-letter words over the 34-character
orthography (including ⟨'⟩ and the graves), all 4-letter over the 27 that carry a rule, then **⟨għ⟩ and ⟨ie⟩
in every slot against every letter and against each other**, ⟨h⟩ word-final versus medial in every frame,
adjacent identical vowels (the collapse), every consonant doubled word-finally and medially (degemination),
the three geminate affricates, and ⟨n⟩ before each labial.

The interaction corpus covers all eight ordered steps and their two stated couplings, plus the number
composer exhaustively 0–20,000 and at every magnitude seam through 10¹².

## Run 4 — 2026-08-31 17:40 — the pattern and alternation diffs

Dynamic dump on both sides (TS through a `RegExp`-constructor hook, C# by reflection over static fields and
delegate closure state, flags compared as a SET since JS normalises `.flags`): **TS 33 distinct, 0 TS-only.**

`UNIT_ALT` is length-sorted in both engines — the same shape that had to be settled in the Kyrgyz and Luo
reviews — so both were dumped and compared: **identical, 7 keys, same order.**

⚠ The first comparison said they differed, 7 keys against 6, and that was **my extractor's bug**: it read the
TS keys with `[^":\s]+`, which cannot match `"sq mi"` because the key contains a space. Reading the
alternation out of the DUMPED PATTERNS instead — where it appears verbatim inside the rate and `-il` rules —
is what made the comparison trustworthy.

**Culture and ordering sweep:** two hits, both accounted for — the `ToUpperInvariant` above, and the
`OrderByDescending` just verified. Nothing else.

## Run 5 — 2026-08-31 18:00 — seam gates over a large reference

Golden-swap: a **680,412-row** reference from the corpus, the interaction corpus and the walks. ⚠ The swap,
each gate and the restore were run as SEPARATE commands this time — the lt and mk runs both timed out
mid-chain with the golden still in place.

    parity        680,412 rows byte-identical, 0 differ
    provenance    tokens 774,595/774,595 (100.0%)
    ipaspans      765,645/765,645 (100.0%), 0 spans that do not cover what was emitted
    poison        0 sites
    TS twins      774,595/774,595 and 765,645/765,645, 0 bad spans, 0 poison

**Output leak sweep over the 680,412 readings:** zero stringified `undefined`/`null`/`NaN`, zero double
spaces, zero digits surviving into a reading. Thirty inputs give an empty reading and all thirty are words
built only from ⟨h⟩, ⟨għ⟩ and ⟨'⟩ — the silent letters plus the apostrophe, which correctly denote nothing
when no word-final position makes them [ħ].

## Run 6 — 2026-08-31 18:20 — suite and mapping

`MalteseTests.cs` ports the TS suite: **161 tests, all passing on the first run**, every value taken verbatim
from the TypeScript rather than reasoned — which is the lesson the mk and smj ports each paid for once.

⚠ **THE RATE RESIDUAL IS PINNED AS IT READS.** An unlisted denominator (`5 km/j`) falls through to the tier,
which matches the head unit and strands the rest. That cannot be closed from this layer — the tier's unit
match ends in a guard a `/` passes — so the TS pins it deliberately, and the C# pins it identically: the day
that guard lands in `Core/NormalizeSymbols.cs`, both assertions fail and say so.

## The faithfulness decisions, and why

  · **`Scan` and `ReadDigits` iterate CODE POINTS** (`[...word.toLowerCase()]`, `[...digits]`).
  · **`NumeralValue` is the tier's own expression, character for character** — copied rather than
    paraphrased, because `NumValue` is not exported and a docstring saying "must agree" is not a mechanism.
    A three-digit block after the separator is GROUPING to both, so `1.234 °C`, `1.234 m` and `1.234 m/s`
    all take the singular; before it was copied, the same numeral took opposite agreement in two rules of
    the same file.
  · **The decimal step runs LAST, after the shared tier**, which is the inverse of the fleet's usual
    arrangement and buys three things: a currency magnitude keeps its hop (`$88.08 biljun`), the tier gets
    the TRUE quantity for agreement, and the tier's version guard stays armed so `802.11m` is refused.
  · **`MagnitudeCount = 11`** — a magnitude governs the singular exactly as a numeral above ten does, so the
    fact lives in one place rather than being restated as a separate form.
  · **`ToUpperInvariant` is equivalent BY CONSTRUCTION** at its one site: the capture is `([CF])` under `i`.

## Run 7 — 2026-08-31 19:00 — review of #1224

⚠ **THE CLOCK-TAIL APOSTROPHE CLASS HAS A DUPLICATED MEMBER.** `ta['’’]` looks like three alternatives and
is two: U+0027 and U+2019 **twice** — 2 distinct code points in 3 slots. The minus rule's opener set in the
same file *does* carry U+2018 separately, so the third slot was most likely meant to be it.

Measured before deciding anything, over the 2,734-text corpus:

    `ta` + U+0027 (')   1362      before a day-part (filg/wara/bil):  24
    `ta` + U+2019 (’)   1023                                          10
    `ta` + U+2018 (‘)      0                                           0
    `ta` + U+02BC (ʼ)      2   (`taʼ kelliema`)                        0

So the duplicate **costs nothing**: the character it was probably meant to be does not occur in this corpus
at all, and neither U+2018 nor U+02BC ever precedes a day-part. Mirrored faithfully rather than "fixed" —
changing the reference engine for zero measured benefit is the move this repo's discipline exists to
prevent. Recorded here so the next reader does not mistake it for a live gap.

⚠ **AND THE INSTRUMENT I REACHED FOR FIRST WAS UNSOUND.** For a diacritic-heavy orthography the valuable
check is a literal-by-literal diff between the engines — a mistyped ⟨ħ⟩ for ⟨h⟩ is exactly the typo that
survives a human read. The first version parsed quoted literals out of both files and reported three
Maltese words present in the C# and absent from the TS: `fis-siegħa`, `fis-sekonda`, `siegħa`. All three
were **artifacts**. Naive quote pairing desynchronises on a `"` inside a regex character class or a template
literal, so an earlier unbalanced quote swallowed the span; a direct substring check showed the strings
byte-identical in both files, same U+0127.

Replaced with **containment**, which avoids quote pairing entirely — every Maltese-shaped literal the C#
emits must appear somewhere in the TS sources:

    67 Maltese-shaped literals in the C# · 8 carrying a diacritic · 0 not found in the TS
    instrument sanity — a planted `fis-siegha` (ħ→h) IS flagged: true

The sanity probe is the part that makes the zero mean anything, and it is the same lesson the Macedonian
homoglyph scan and the Luo `"null"` false positive each taught: an instrument that cannot fail proves
nothing.

## Outstanding

Nothing found in this port remains unfixed, and nothing new was filed. The rate residual is the TS's own
recorded limitation, identical in both engines and pinned in both suites.
