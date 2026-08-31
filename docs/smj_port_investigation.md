# Lule Sami (smj) — C# port investigation

## Run 1 — 2026-08-31 04:10 — scope, and the constraint that shapes the whole task

    wc -l src/languages/lulesami/*.ts
        72 lulesami.ts · 28 normalize.ts · 121 numbers.ts   (221 total)

Three modules plus `data/languages/lulesami/lulesami.jsonc`. No g2p module — the scan is inline in
`lulesami.ts`. `Registry.cs:593` already routed `case "smj"`; `Bootstrap.cs` was the only wiring missing.

⚠ **smj HAS NO GOLDEN, AND CANNOT GET ONE FROM THE SANCTIONED TOOL.** `tools/gen_parity_goldens.mts` draws
text from three tiers — the FLEURS ledger, `tools/corpus/mined/<code>.jsonc`, then the module's own lexicon
headwords — and smj has **none of the three**: no FLEURS split, no mined artifact, no attest artifact, no
lexicon TSV. Confirmed directly:

    dotnet run -c Release --project csharp/tools/parity -- smj
        0 languages byte-identical, 0 differ (0 rows ok, 0 differ)

The generator's own header states the consequence: *"A language with no golden cannot be ported at all,
because there is nothing to be byte-identical to."* So the standing fleet parity run covers this language
with **zero rows**, and the differential below is not a supplement to the golden — it is the entire evidence
that the port is correct. Three other codes are in the same position (`mto naq nog`).

The engine itself is small and transparent: a longest-match grapheme scan over an ORDERED multigraph list,
the word-initial ⟨p t k⟩ aspiration rule, and fixed first-syllable stress. ⚠ The hallmark is the
North-Saami-style orthography trap — word-initial ⟨b d g⟩ are VOICELESS [p t k], not voiced — which is data
in the letters table and looks like a bug until you read the manifest header.

## Run 2 — 2026-08-31 04:30 — build, and what the differential has to cover

Since there is no golden, the differential was built to be near-total rather than representative.

**Exhaustive g2p walk.** All 1-, 2- and 3-letter words over the entire orthography (33 letters), all 4-letter
words over the 26 that participate in a multigraph or a rule, and then **every multigraph in every slot** —
each of the 30 alone, before/after/between every representative letter, doubled, and against every other
multigraph:

    496,560 words   0 differ

**Numbers, exhaustive over the whole solid-word range.** This is the intricate part — four stem alternations
(`lågev` free / `-låhke` ×10 with no unit / `-låk-` ×10 before a unit / the teen `lågenan-` which FLIPS to
unit + `lågenan` as a magnitude multiplier) plus two hundred stems (`tjuohte` free, `tjuode` as a multiplier).
Every integer 0–999,999 was composed on both engines, plus every 10⁶/10⁹/10¹² seam, 60,000 random values in
10⁶–10¹², 8,000 above the fallback threshold, and every non-finite input:

    1,068,051 rows   0 differ

**The rest.** A text corpus built from the suite's real words and the shapes `separatorHygiene` claims and
declines (1,388 rows, norm + text); the digit-by-digit fallback including astral pairs and lone surrogates
(15 rows); six digit families across nine operand frames (119 rows, the `\d` vs `\p{Nd}` hazard); and
astral/lone-surrogate fuzz over a pool mixing the orthography, digits, punctuation, a combining mark, ZWJ,
BOM, soft hyphen, an astral emoji and unpaired surrogates (37,431 rows, norm + word + text). **All 0 differ.**

## Run 3 — 2026-08-31 05:00 — seam gates on a TEMPORARY golden

The seam gates are golden-driven, so a 578,042-row reference was generated from the corpus above, written to
`csharp/goldens/smj.tsv`, every gate run on both engines, **and the file then removed**.

    parity        578,042 rows byte-identical, 0 differ
    provenance    tokens 581,232/581,232 (100.0%)
    ipaspans      tokens with IpaSpan 579,755/579,755 (100.0%), 0 spans that do not cover what was emitted
    poison        0 distinct sites (SUBSTRING 0, desync 0)

TS twins agree exactly: 581,232/581,232, 579,755/579,755, 0 bad spans, 0 poison sites.

⚠ **THE TEMPORARY GOLDEN WAS NOT KEPT, AND THAT WAS A DECISION.** Keeping it would gate smj forever, which is
tempting. Against: every other golden is 200 rows of REAL text produced by the sanctioned generator, and this
one is 578,042 rows of walk output that the generator cannot reproduce — an unreproducible artifact three
orders of magnitude larger than the convention, which would also make the fleet parity run enormous. A
200-row trim would be smaller but no more reproducible. Closing this properly needs an smj **text source**
(a `tools/corpus/mined/smj.jsonc`, or a lexicon), which is a corpus task and not a port task.

## Run 4 — 2026-08-31 05:20 — output leak sweep

Over the 578,042 readings: zero stringified `undefined`/`null`/`NaN`, zero double spaces, zero digits
surviving into a reading, and — checked because this engine emits stress on every word — **zero words with a
missing or doubled stress mark**. Fourteen inputs give an empty reading and all fourteen are mathematical
bold digits, which fall outside both the Latin token run and `\d`; TS-identical, and not a class that occurs
in text.

## Run 5 — 2026-08-31 05:40 — the separator finding

⚠ **`core/separatorHygiene.ts` CLAIMS THE DOT AND COMMA AND NOT THE SPACE**, and for a Nordic-orthography
language the space is the one that matters.

    "1.234.567"  -> "1234567"        claimed
    "1,234,567"  -> "1234567"        claimed
    "1 000"      -> "1 000"          untouched  →  ˈɑktɑ ˈnolːɑ        "one zero"
    "1 000 000"  -> "1 000 000"      untouched  →  ˈɑktɑ ˈnolːɑ ˈnolːɑ "one zero zero"

That is a silent 1000× error, and it is the exact class the pass exists to close — its header's motivating
case is Cherokee's `17,000` reading as *seventeen, ZERO*. The header carries an explicit "what it
deliberately does not do" section with four argued refusals (the single grouped run, the hyphen, the colon,
the signs) and **the space is in neither that list nor the implemented rules**, so it reads as an oversight
rather than a decision.

The ambiguity argument that forces the single-group refusal does not transfer: `1.234` is ambiguous because a
dot is a decimal separator somewhere, and **a space is never one anywhere**. The fleet also already has the
measurement for the shape — Lithuanian's de-grouping rule records 24 space-group sites, all 24 genuine, zero
false positives.

Both engines are byte-identical, so it is a shared-tier gap and not a port defect. Filed as **#1212**, not
fixed: `separatorHygiene` is shared by eight languages and a change moves every one of their readings and
goldens, which needs measuring per language — and three of the eight have no corpus to measure with, which is
why they call this pass in the first place.

## Run 6 — 2026-08-31 06:00 — suite, mapping and sweep

⚠ **THE xUnit SUITE CARRIES MORE THAN THE TS SUITE'S ASSERTIONS, DELIBERATELY.** With no golden, this file is
the port's only standing regression gate, so two things an ordinary golden would pin implicitly are pinned
explicitly instead: the **multigraph longest-match order** (15 rows, each failing if its trigraph is shadowed
by the digraph it begins with) and the **four number stem alternations** with their attested corpus forms.
The aspiration rule gets its own rows — word-initial only, bare ⟨p t k⟩ only, never on the ⟨b d g⟩ that
surface as the same phones. **83 tests pass.**

⚠ Three expected values in the first draft were written from reasoning rather than measured, and all three
were wrong; they were replaced with the engine's own output. Recorded because it is the same lesson as the
Latgalian pin: an assertion nobody measured is a guess wearing a test's clothing.

Leak sweep: exactly four paths touched — the new `Languages/LuleSami/`, the new test file, the `Bootstrap.cs`
registration and the mapping-test entry. Nothing smj-specific reached the shared tier, and no golden was
added or left behind.

## The faithfulness decisions, and why

  · **The scan indexes CODE UNITS** (`t[i]`, `t.startsWith(k, i)`), so an astral character arrives as two
    surrogate halves and each is offered to the tables separately.
  · **`ReadDigits` iterates CODE POINTS** — the TS spells it `[...digits]`, which keeps an astral pair
    TOGETHER. ⚠ That is the OPPOSITE of the Latvian and Lithuanian `split("")` sites in this same series, and
    the difference is the TS's, not a choice made here. Pinned with an emoji that must come back as one token.
  · **`Js.Normalize`, not `string.Normalize`** — this is a raw-word entry point and .NET throws on an
    unpaired surrogate where JS is indifferent (#1199).
  · **The multigraph list is ordered data and FIRST match wins**, mirroring the TS's `MULTI.find`. A
    dictionary would lose the order, so the manifest's list-of-pairs shape is mirrored as one.
  · **`IsSafeInteger` is a local helper**, following the existing fleet idiom (Sepedi spells it identically,
    noting there is no BCL equivalent) rather than adding to the shared tier.

## Run 7 — 2026-08-31 06:40 — review of #1213

**Culture and ordering.** One hit in the whole port — `t.AsSpan(i).StartsWith(pair[0], StringComparison.Ordinal)`,
which is the explicit-ordinal spelling of the TS's `t.startsWith(k, i)`. No `ToLower`/`ToUpper`, no culture
compare, no number formatting, no order-dependent dictionary, no build warnings. The only lowercase in the
port is `Js.ToLowerCase`, which is the JS-faithful one.

⚠ **THE SIGN IS DROPPED BUT ITS LETTERS ARE READ.** The layer's header says the untouched classes — degrees,
units, "every abbreviation" — stay "visible to the leak gates". Measured, that is true of the SIGNS and false
of the LETTERS beside them:

    "20 °"  -> ˈkuoktɑlohke          the sign IS dropped, as advertised
    "10 %"  -> ˈlokev                    "
    "20°C"  -> ˈkuoktɑlohke ˈk       ⟨C⟩ is a real Lule Sami grapheme reading [k]
    "5 kg"  -> ˈvihtːɑ ˈkʰk          a stressed nonsense word
    "12 m"  -> ˈlokenɑnkuoktɑ ˈm
    "nr. 5" -> ˈnr . ˈvihtːɑ         …plus a spurious SENTENCE BREAK

Nothing is dropped and nothing raw survives, so there is no DROP and no RAW-LATIN residue — the output is
well-formed IPA that happens to mean something else. Trap 56, and the same defect Lithuanian's layer exists to
close (`17 °C` → *septyniolika t͡s*), reached here by a language with no corpus to close it with.

The reading itself is unfixable without evidence and that is honestly stated everywhere else; what is wrong is
the **visibility claim**, which a future porter would rely on. ⚠ And the gate behaviour itself could NOT be
verified — the header cites `mine.ts scan`, which is not in this repository, so what is recorded above is what
the engine emits, not what some scanner elsewhere does or does not catch. Filed as **#1214** with that caveat
stated, and pinned in the suite.

## Outstanding

Nothing found in this port remains unfixed. Three things stand, none a port defect:

  · **#1212**, the space thousands separator, pinned as it reads in the suite;
  · **#1214**, the sign's letters read as native phonemes, likewise pinned;
  · **smj still has no golden**, so the standing fleet parity run covers it with zero rows. The evidence that
    the port is correct is the differential in Runs 2–3, not the gate. Closing it needs an smj text source.

## Run 8 — 2026-08-31 09:30 — closing #1212 (shared tier)

`separatorHygiene` now claims the SPACE group as rule 0, above everything, iterated to a fixed point.

    "1 000"          ->  "1000"          "21 2001"  ->  "21 2001"   (4 digits: declined)
    "1 000 000"      ->  "1000000"       "0 000"    ->  "0 000"     (standalone 0: declined)
    "12 345 678"     ->  "12345678"      "1 00"     ->  "1 00"
    "1 385 000 000"  ->  "1385000000"    "1.234"    ->  "1.234"     (still ambiguous, still refused)

⚠ **ONE GROUP IS ENOUGH HERE AND TWO ARE REQUIRED FOR THE DOT/COMMA, AND THAT ASYMMETRY IS THE ARGUMENT.**
The dot rule needs two because `1.234` is genuinely ambiguous between grouping and a three-place decimal. A
space is never a decimal separator in any convention, so that ambiguity does not arise — and the shape is
Lithuanian's own, measured there at 24 sites, all genuine, zero false positives. Both of Lithuanian's guards
came across with it, and each declines something real: the right edge takes exactly three digits (which is
what keeps `21 2001`, a date, whole) and the left edge rejects a standalone `0`.

**Scope, measured before the edit.** Seven languages call this pass — grc, kl, quc, smj, naq, nog, mto — and
only three of them have a golden. **Zero space-grouped figures occur in any of them**, so the change moves no
existing reference at all: `quc` 175/175, `grc` 200/200, `kl` 200/200 unchanged, fleet 169/169 byte-identical.
The four ported consumers (smj, kl, grc, quc) agreed with the TS on a 108-row shape differential; naq, nog
and mto are `port pending` in C#, so only the TS side exists and nothing can diverge.

⚠ **THE smj PINS DID THEIR JOB.** `LuleSamiTests` recorded `1 000` → *akta nålla* and `1 000 000` → *akta
nålla nålla* as the defect, deliberately, so that a fix would have to change them. It did: they now read
*tuvsán* and *millijåvnnå*.

⚠ **AND THE FULL TS SUITE CAUGHT A CONVENTION I BROKE.** `test/invisible-characters.test.ts` requires an
invisible character to be written as an escape AND NAMED on its line or the one above — and it strips block
comments first, so the naming has to be a TRAILING `//`, which is why Lithuanian's identical constant
carries `// space, NBSP, NNBSP, thin space` on the line rather than in the doc comment above it. Fixed in
both engines.

## Run 9 — 2026-08-31 20:10 — closing #1214, on the measurement rather than on the rule

The claim half was corrected for smj in #1220. The READING half was left open, and the question it turns on
is how often the shape occurs. Measured across **all seven languages that call `separatorHygiene`** and every
text any of them has — the grc/kl/quc goldens plus every mined and attest artifact:

    lang    texts   °+scale   bare °   unit-after-digit   abbrev dot   %   currency
    grc       200         0        0                  0            2   3          0
    kl        200         0        0                  0            0   0          0
    quc       175         0        0                  0            0   0          0
    smj / naq / nog / mto — no text at all
    TOTAL                 0        0                  0            2   3          0

**The defect class has ZERO instances.** `°C` never occurs; neither does a bare `°`, a unit letter after a
digit, or a currency sign. grc's five hits are a `%` (a SIGN, dropped, which is the documented behaviour and
not this defect) and a Latin car model inside `Audi TT.` — neither is the sign-plus-bound-letter shape.

⚠ **AND THE ×0 PARTLY REFLECTS THE ABSENCE OF A CORPUS, WHICH IS SAID HERE RATHER THAN GLOSSED.** Four of the
seven have no text whatsoever; the other three have only a 175–200-row golden. This is not the same kind of
zero as Latvian's `§` ×0 over 2,703 real lines.

So why close it rather than write the rule? Because unlike #1212 — where the fix was to SPEND A SEPARATOR,
emitted no word, and had Lithuanian's 24/24 measurement behind the shape — this one has no move that is
clearly better:

  · emitting a degree word needs vocabulary these languages by definition do not have;
  · dropping the bound letter replaces an audible-but-wrong reading with a SILENT one, and the repo's own
    doctrine prefers refusing whole and leaving VISIBLE — a deletion is not visible either.

Two arguable options, zero measured instances, and a shared-tier change across eight languages. That is the
shape this repo's discipline exists to decline.

**What was done instead, and it is the whole of what the issue asked for at minimum.** The false claim was
not only smj's: all six other `separatorHygiene` callers carried the IDENTICAL sentence, byte for byte
(`md5 761bb526df38` over the same span in every one). Corrected in all six TypeScript headers plus the one
C# header that carried it (`AncientGreek/Normalize.cs`); `kl` and `quc` phrase their C# headers differently
and never made the claim.

⚠ Still true, and repeated so nobody acts on this without checking: **the gate behaviour itself could not be
verified.** The headers cite `mine.ts scan`, which is not in this repository, so what is recorded is what the
engine emits — not what some scanner elsewhere does or does not catch.
