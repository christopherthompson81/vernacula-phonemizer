# Bare superscript exponents — the undeclared fallback (#1041)

Issue #1041 diagnosed the defect and reverted the obvious fix. This log is the second pass: what the fix
actually has to decline, and the measurements that decided each boundary.

## Run 1 — 2026-08-26 08:00

**Question.** Reproduce the reported regression before writing anything.

```
$ npx tsx .probe/p.mts rn "93 personnes/km²" "10⁶"
rn  93 personnes/km²  ->  … kuɾi kiɾometeɾo kwadaɾato     (square kilometre — correct today)
rn  10⁶               ->  it͡ʃumi                          (ten — the exponent is gone)
```

Then, with a blanket `else` emitting spaced digits:

```
rn  93 personnes/km²  ->  … kuɾi kiɾometeɾo kabiɾi        (kilometre TWO — the regression, reproduced)
```

**Finding.** The collision is NOT with the shared unit path, which is what the issue assumed. rn's `km²`
is read by **kirundi/normalize.ts step 8**, which runs *after* the shared tier — so the fallback starves a
per-language rule, not a shared one. That matters: it means the guard cannot be "does the shared tier own
this", because a language's own layer may own it and be invisible from here.

## Run 2 — 2026-08-26 08:05

**Question.** What is the narrowest axis that keeps every existing refusal intact?

Restricted the fallback to **digit bases** (`10⁶` yes, `km²`/`mc²` no). Rundi restored.

Read the seven Sinitic `NO BARE EXPONENT` refusals and `so`'s, to check the axis against their evidence:

| corpus | why it declined | reaches the fallback? |
|---|---|---|
| wuu, nan, cjy, hak, hsn, gan, cdo | superscripts are ROMANIZATION TONE NUMBERS (`/ʃɘ̃⁴⁵/`, `hoeng¹ gong²`) | no — letter base |
| so | superscripts are units ×130, plus isotopes/designations | no — letter base |
| so (the prize it counted) | "26 digit-base powers" | **yes** |
| wo | `1,602 · 10⁻¹⁹` ×3, no sign word | no — negative |

**Finding.** Every refusal in the fleet declined on the letter/negative axis, and every one names the
digit-base power as the thing it was giving up. The narrowing is not a compromise; it is the exact
complement of what those eight corpora measured.

## Run 3 — 2026-08-26 08:08

**Question.** The Korean golden moved. Why, when `km²` has a letter base?

`3,850 km²이고` → `kʰiɭɭomitʰɘ ˈiɡo` instead of `kʰiɭɭomitʰɘiɡo`. The **`BARE_EXPONENT_GLUED` pre-pass**
fired (it is base-agnostic), split the token, and the ² was then dropped anyway — a golden row moved for a
reading nothing emitted. Fixed by adding the boundary in the callback instead of reusing that pass, so only
a base the fallback actually rewrites is spaced off. ko restored.

## Run 4 — 2026-08-26 08:10 — the superscript zero

**Question.** rw's `4⁰ Ihame` became *kane zeɾu* (four zero). Is a lone `⁰` ever a power?

```
$ grep -ohP ".{12}⁰.{6}" -r tools/corpus/mined csharp/goldens
```

| shape | what it is |
|---|---|
| `6⁰03 '`, `79⁰ 51"`, `133 ⁰C`, `27⁰c`, `360⁰` (si) | DEGREE sign |
| `110⁰04¹05¹`, `46⁰37¹55¹` (mn) | coordinates — ⁰ ¹ ¹ spending for ° ′ ″ |
| `4⁰ Ihame` (rw) | a numbered list item |
| `10¹⁰`, `10¹⁰⁰`, `10⁵⁰`, `10³⁰`, `10¹⁹` | real powers — all MULTI-digit |

**Finding.** Not one lone `⁰` or `¹` in the artifacts is an exponent, and none could be: x⁰ and x¹ are
identities nobody writes. Corroborated independently — `sinhala/normalize.ts:219` already lists U+2070 in
its own degree class, measured from its own corpus. So a lone `⁰`/`¹` is declined, in the fallback AND in
the declared branch (where `360⁰` read *three hundred sixty to the power of zero*), AND in English's local
copy of the rule. Multi-digit runs starting with either are untouched.

## Run 5 — 2026-08-26 08:14 — the unit on the WRONG side

**Question.** ab's goldens moved: `3540² км`, `5,23² км`, `0,5 ² км` gained a numeral.

The mark is written BEFORE the unit noun. The unit path matches `км²`; this is the mirror image, and its
digit base makes it look bare. Reading it out gives *three thousand five hundred forty TWO kilometres*.

First attempt: a `unitFollows` guard in the exponent branch. It fixed ab and **failed on sw**:

```
sw  3540² km  ->  … aɾoɓaˈini ᵐbˈili kilomˈita     (still "TWO")
```

**Finding.** `bareUnit` had already rewritten sw's `km` into the WORD before the exponent rule ran, so no
guard at that point can see a unit there. Moving the exponent block earlier fixed sw and broke `10⁶ km`
(the unit then leaked raw as `kˈm̩`), because `bareUnit` skips a numeral-adjacent token.

**Resolution.** The decision moved to the TOP of the normalizer, as an explicit deletion: a lone ²/³ on a
digit base with a unit key after it is the unit's power, and the language cannot say it, so the mark goes.
Deleting is byte-identical to declining — and strictly better, because the mark was BREAKING the number↔unit
adjacency. Three Abkhaz golden rows went from a raw `kʼm` in the phoneme stream to *kʼilometʼra*.

⚠ Restricted to `²`/`³`. A unit is squared or cubed and nothing else, so a larger power beside a unit is the
NUMBER's magnitude: `10⁶ km` must stay a million kilometres, and does.

## Run 6 — 2026-08-26 08:19 — the partial declaration

```
gl  20²  ->  bˈinte ao kaðɾˈaðo     (declared)
gl  10⁶  ->  dˈeθ                    (eaten — `power` is not declared)
```

**Finding.** `tpl === undefined` returned the whole match, i.e. fell back to the DROP rather than to the
digits. A language that can say "ao cadrado" was still losing every other magnitude. Both partial-declaration
exits (`power` missing, `negative` missing) now fall through to the digit fallback. gl and be recovered.

## Result

| | before | after |
|---|---|---|
| codes reading `10⁶` as *ten* | 169 / 193 | 37 / 193 |
| golden rows moved | — | 9, in 5 languages (ab ×3, gan, hsn, hyw ×2, la ×2) |

Every moved row is a pure recovery: the deleted exponent digit appears, or a raw `kʼm` becomes its word.

⚠ **The parity gate proves nothing about this change.** All but the ab rows are in languages with no C#
engine (gan, hsn, hyw, la are `not ported`), so the gate would stay green with the C# half missing entirely.
`csharp/…Tests/BareExponentFallbackTests.cs` exists for that reason.

## Residual — deliberately not fixed here

The 37 codes still reading `10⁶` as *ten* are the ones whose engines **do not use the shared symbol tier at
all** (verified by hand for ro, is, ka, he, lt, lg, luo, ug, syl, ak: zero `makeSymbolNormalizer` call sites;
ug's only mention is a comment explaining why it declines the tier). Each carries its own local unit table,
so each needs its own rule. That is a per-language job, not a shared-tier one.

Also noted and NOT actioned: English reads `133 ⁰C` as *…three C* — its degree class is `[°º]` and does not
carry U+2070 the way Sinhala's does. Sinhala measured that from its own corpus; en has no such measurement
here, so guessing it in would be unsourced.

## Run 7 — 2026-08-26 09:05 — the residual 37, measured before touching any of them

**Question.** Can the 37 codes still dropping `10⁶` be fixed as a sweep?

**No shared seam exists.** `foldPass` is the only fleet-wide text hook and it runs BEFORE each engine's
normalize — a fallback there would steal `km²` from every language's unit rule, which is the ordering the
whole design avoids. There is no post-normalize hook, so a sweep means 37 local edits.

**And the evidence does not support 30 of them.** Counted digit-base bare superscripts in each artifact:

| code | × | what it actually is |
|---|---|---|
| ps | 8 | genuine scientific notation |
| he | 11 | all squares — see below |
| ka | 1 | genuine (`10¹² მ²`) |
| ki | 2 | one genuine (`10¹⁰⁰`), one dubious (`kilomita 700².`) |
| mn | 8 | **coordinates** — `110⁰04¹05¹¹` spends ⁰ ¹ ¹¹ for ° ′ ″ |
| nci | 14 | **a nuclide table** — `0,708 ¹⁸⁰Hf`, `2,137 ⁶³Cu` |
| ln | 2 | **bibliography edition markers** — `Kinsásá, 2007³` |
| the other 30 | 0 | nothing to repair |

The last three are false positives, and two of them are shapes the #1044 rules do NOT cover — a doubled `¹¹`
prime and a space-separated superscript glued to the following word. Neither is reachable (both corpora are
off the tier), so they are filed as **#1045** with the falsification set: declining `¹¹` outright would break
genuine `10¹⁰`/`10¹⁰⁰`/`10¹¹` powers in ps, hyw, lv, sq, tt, ki and lo.

## Run 8 — 2026-08-26 09:15 — ps and he

The fallback was hoisted out of the tier closure into an exported `spacedBareExponent`, so an engine off the
tier gets the same four declines rather than a second implementation.

**ps** — measured before/after over the whole artifact, through the real pipeline:

```
5 of 9 superscript-bearing rows change, every one a pure insertion of the lost magnitude
   2×10³⁰            lˈəs            →  lˈəs d̪ˈerəʃ
   3 x 10²⁶          lˈəs            →  lˈəs ʃəpˈəʐ ˈojʃət̪
   10¹¹–10¹²         lˈəs lˈəs       →  lˈəs iwˈoləs lˈəs d̪ˈoləs
   7.2 x 10¹³        lˈəs            →  lˈəs d̪jˈɑrləs
   4×10¹³            lˈəs            →  lˈəs d̪jˈɑrləs
```

`km²` is untouched — it still reads as the unit noun with the power dropped, which is a missing WORD ps has
no source for, not a deleted digit. The header refusal stands and now says which half it covers.

**he — 0 of 6 rows change, and the zero is the point.** Its own ×3-attested `בריבוע` rule already claims
every superscript the artifact carries (`8² = 64`, `2030 = 27² + 26² + 25²`, `טכניון 10²`). ⚠ An earlier
count said 11; that was raw pattern matching that did not run he's own rule first. The call is kept as
ROBUSTNESS for the cube and generic power `בריבוע` cannot name — `10⁶` did read as bare *ʔeseʁ* — and the
measured zero is recorded in the file rather than left to look like a repair.

⚠ **No golden row moves in either language**, so the parity gate is again blind to the whole change; the
tests are the only witness.

---

# The undeclared-power fallback speaks an ASCII exponent (#1145)

Same branch, one character further on. Surfaced while fixing rn's #1135, filed rather than patched from
there because it is the TIER's and reaches every language that declares one power and not the other.

## Run 1 — 2026-08-28 10:25 — what the fallback's own argument does and does not cover

The branch's note is sound as far as it goes:

> ⚠ NO MEASURE WORD DECLARED — emit the UNIT and hand the exponent back rather than abandoning the match.
> Returning `whole` loses the QUANTITY too … Re-emitting the exponent keeps the unit's reading and leaves
> `²` where the leak gate can see it, turning an invisible missing reading into a visible missing WORD.

⚠ **IT HOLDS ONLY FOR A CHARACTER THE READER CANNOT SAY.** `²`/`³` reach the tokenizer and are dropped, so
they are visible to the leak gate and silent in the phoneme stream — exactly as promised. But the unit
alternation also admits the ASCII spelling (`(?<=[a-zA-Z])[23]`), and a bare digit is claimed by the NUMBER
path and SPOKEN. So the fallback did the opposite of what it says on the ASCII half:

    rn   517 km3   →  ibiɾometeɾo **ɡatatu** amad͡ʒana atanu na it͡ʃumi na indwi
                      "kilometre THREE, five hundred and seventeen"
    rn   517 km³   →  ibiɾometeɾo amad͡ʒana atanu na it͡ʃumi na indwi          ← what it should read

A missing word is a lossy reading; an **invented quantity** is a false one, and the sentence still scans, so
no leak gate fires and no referee names it.

**Who is exposed.** 13 layers declare `squared` and not `cubed` today — abkhaz, bosnian, hakka, hiligaynon,
khmer, kirundi, latgalian, minnan, santali, sesotho, wolof, wu, yoruba — and any future layer that declares
one power and not the other joins them silently.

**The fix.** Normalise the handed-back exponent to the SUPERSCRIPT however it was written. That keeps both
properties the note argues for — visible to the gate, silent to the reader — and removes the spoken digit.
Both branches of the return (the `unitPrefix` one and the default) get it, because #1060 already established
that this fallback must honour `unitPrefix` like every sibling.

## Run 2 — 2026-08-28 10:30 — the blast radius, and why the test carries it alone

    tools/gen_parity_goldens.mts (ALL 169)   **0 rows moved**

⚠ **NO GOLDEN ANYWHERE CARRIES THE SHAPE**, which is what "latent" means here and why the fix cannot be
gated by the corpus. A unit written with an ASCII exponent, in a language that declares the OTHER power, is
absent from all 169 golden files. The new core test in `test/normalize-multilang.test.ts` is the only thing
that measures it, and it pins all four cells — declared/undeclared × superscript/ASCII — plus the
`unitPrefix` branch, because that is where #1060's doubled failure lived.

⚠ **AND A TS↔C# DIFFERENTIAL CANNOT GATE IT EITHER**, which is the recurring lesson of this pair of issues:
both engines were wrong together, so a differential comparing them passes. The measurement that finds this
class is reading the output against the PREVIOUS output.
