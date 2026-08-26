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
