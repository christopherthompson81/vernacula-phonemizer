# Small backlog — three independent items

Three items that share nothing but their size: an Assamese unit-word gap, a fleet-wide version-vs-measurement
guard, and four `[??]` sister standards in `sources.ts`. One section each, chronological within the section.

---

## Item 1 — `as` (Assamese) declares no unit word

### Run 1 — 2026-08-13 07:10

**Command** `npx tsx tools/normalization/sources.ts --lang as`

**Question** What does the fleet's only `NONE` actually say, and what does the corpus write?

**Raw finding**

```
[NONE] unit-word  the layer declares NO unit word — every abbreviation reaches the phoneme sink verbatim
                  (after a number in the corpus: mm×3)
```

The three `mm` are one artifact sentence in the `units` cell: `৩৫mm ফৰ্মেটটো … ২৪mm ৰ দ্বাৰা … ৩৬mm হয়৷` —
photographic film formats, in Bengali-Assamese digits, unit glued to the number.

**Implication** The class applies. Before sourcing anything, check what the engine already does with it —
the `NONE` is a statement about the *Assamese directory*, and Assamese does not own its whole layer.

### Run 2 — 2026-08-13 07:15

**Command** a scratch probe calling `createAssamese().text(...)` on `৩৫mm`, `5 cm`, `10 km`, `50 km/h`, and
on each unit noun in both the Bengali and the Assamese spelling.

**Question** Does `mm` actually reach the phoneme sink raw, as the verdict says?

**Raw finding** No — it never did.

```
৩৫mm  → pãs tɹix milimitaɹ        10 km → dɔɦ kilomitaɹ       5 kg → pãs kiloɡɹam
5 cm  → pãs xentimitaɹ            50 km/h → … pɹɔti ɡʱɔnta
```

The Assamese engine reuses `makeNativeBengali`, whose symbol tier declares `units` in **bengali.ts** with
**Bengali words**. `sources.ts` reads only `src/languages/assamese/`, so it could not see them. Comparing the
two spellings through the Assamese g2p:

| symbol | tier's Bengali word | Assamese word | Bengali reads | Assamese reads |
|---|---|---|---|---|
| mm | মিলিমিটার | মিলিমিটাৰ | `milimitaɹ` | `milimitaɹ` |
| km | কিলোমিটার | কিলোমিটাৰ | `kilomitaɹ` | `kilomitaɹ` |
| m, g, kg | … | … | identical | identical |
| **cm** | **সেন্টিমিটার** | **চেণ্টিমিটাৰ** | **`xentimitaɹ`** | **`sentimitaɹ`** |

**Implication** Two findings, and the second is the real one:

1. The `NONE` was a **false absence at the reading level** — the words were there, in another language's
   vocabulary. That is worth reporting as such rather than quietly "fixing".
2. `cm` is **not** cosmetic. র and ৰ both read [ɹ], so six of the seven spellings are invisible to the
   phonology — but Bengali's স meets the Assamese **sibilant merger** (স → [x], the signature of the
   language) and `5 cm` read *xentimitaɹ*, a word of no language. One declared word, one wrong phoneme.

So the unit words are **language data, not engine data**, and a reusing language must be able to bring its own.

### Run 3 — 2026-08-13 07:25

**Command**
`npx tsx tools/normalization/attest.ts --lang as --words মিলিমিটাৰ,চেণ্টিমিটাৰ,ছেণ্টিমিটাৰ,কিলোমিটাৰ,মিটাৰ,কিলোগ্ৰাম,গ্ৰাম,ঘণ্টা`
(default `--limit`; cache written to `tools/corpus/attest/as.jsonc`)

**Question** Is each Assamese unit noun attested, **in the unit sense**?

**Raw finding** All eight `attested`, 0 substring-only. Senses read from the examples, not from the counts:

| word | tokens/articles | sense read in the examples |
|---|---|---|
| মিটাৰ | 114 / 16 | its own SI article — "আন্তৰ্জাতিক বানান metre" |
| মিলিমিটাৰ | 71 / 16 | `২৫.৪ মিলিমিটাৰ` (inch conversion) |
| ছেণ্টিমিটাৰ | 71 / 20 | `৬০ ছেণ্টিমিটাৰ বৰষুণ` (rainfall) |
| কিলোগ্ৰাম | 64 / 13 | "কিলোগ্ৰাম … হৈছে ভৰৰ একক" — the unit of mass |
| **গ্ৰাম** | 80 / 20 | ⚠ top hits are the **proper name** (Hans Christian Gram, Gram stain). Unit sense read separately in the density article: "১ ঘন চেণ্টিমিটাৰ পানীৰ ভৰ ১ গ্ৰাম" |
| চেণ্টিমিটাৰ | 54 / 20 | `১ গ্ৰাম/ঘন চেণ্টিমিটাৰ`, `১০ চেণ্টিমিটাৰ` |
| কিলোমিটাৰ | 49 / 11 | `৮ কিলোমিটাৰ উত্তৰে` |
| ঘণ্টা | 54 / 14 | the hour (`নীলা ঘণ্টা … ৭:৫৯ বজাৰ পৰা`); corpus has the rate sense, `ঘণ্টাত প্ৰায় 17,500 মাইল বেগেৰে` |

Corpus (`tools/corpus/mined/as.jsonc`) independently: মিটাৰ ×7, কিলোমিটাৰ ×2, মিলিমিটাৰ ×1
(`5 মিলিমিটাৰ (1/5 ইঞ্চি)`), কিমি ×1, ঘণ্টা ×1. গ্ৰাম also in both referees (kaikki, wikipron).

**Negative results worth keeping**

- `চেণ্টিমিটাৰ` and `ছেণ্টিমিটাৰ` are **both** well attested. চ and ছ are both [s] here, so the two READ
  identically — the choice is orthographic only and neither is a defect.
- `টন` "tonne" ×4 in the corpus is **not** the unit: every hit is inside another word (ৱাছিংটন).
- `গ্ৰাম` is exactly the trap the Fula `tere` note warns about — a healthy count attesting the wrong sense.
  It survives on a read sentence, not on its 80 hits.
- **Preposed vs postposed**: every instance in both tiers is postposed — `5 মিলিমিটাৰ`, `৪৮৯২ মিটাৰ`,
  `19,500 বৰ্গ কিলোমিটাৰ`, `৮ কিলোমিটাৰ উত্তৰে`. No prefix order anywhere, so the tier's default stands and
  `unitPrefix` is not set.
- `km/h` is **composed**, and marked as such in the manifest: প্ৰতি "per" is corpus-attested (`প্ৰতি অপৰাধত`)
  and ঘণ্টা is attested, but the phrase occurs in no source searched. It is the same composition the tier
  already shipped from Bengali; only the spelling changes.

**Implication** Declare all seven in `assamese.jsonc`, postposed, with the per-word sourcing in the file.

### Run 4 — 2026-08-13 07:35

**Command** after adding `"unitWords"` to `assamese.jsonc` and `def.unitWords ?? {…}` to bengali.ts:
`npx tsx tools/normalization/sources.ts --lang as`

**Question** Does the tool now read the declaration?

**Raw finding** Still `[NONE]`. Instrumenting `localUnitTable` showed the regex matching all five multi-letter
keys and the function then returning `[]`. The filter is the culprit:

```
if (!/\p{L}{2}/u.test(m[3]!)) continue;
```

`\p{L}{2}` means two **adjacent** letters, and **an abugida never has two adjacent letters**: `কিলোমিটাৰ` is
ক ি ল ো ম ি ট া ৰ — nine code points, five combining matras (`\p{M}`). The test is false for every word in
the script. Same expression in `wordLike` and in `pairTails`.

**Implication** A real `sources.ts` bug, and the reason this language could not be sourced at all: the tool
read the table, filtered it word by word to nothing, and printed "declares NO unit word" at a manifest naming
all seven. Devanagari, Gujarati, Kannada, Khmer and Thai are the same shape; Burmese passed only by accident,
on the bare letter pair inside `ဂရမ်`. Fixed as one shared `TWO_LETTERS = /(?:\p{L}\p{M}*){2}/u`.

⚠ **Not fixed, same family, recorded here**: `tierWords`'s emission probe uses `\p{L}{3,}` inside a
`.replace()` replacement string and is blind in the same way. It is a different class (percent/currency), the
file's own header already records `as`/`th`/`fa` as reporting negative there, and widening it moves cells this
item did not measure. Left alone deliberately.

### Run 5 — 2026-08-13 07:45 — gates

| gate | before | after |
|---|---|---|
| `sources.ts --all` | `as … unit-word NONE`, `unit-word 1 as` in the blocked tally | `as … unit-word ok`, `unit-word 0`. ⚠ "**exactly one cell moved**" was the reading of this run and it was **WRONG** — the baseline was emitted from a dirty tree. See Run 6: the honest count is two cells, `as` and `bn`. |
| `sources.ts --lang as` | `[NONE] the layer declares NO unit word` | `[ ok ] 5 unit word(s) in a unit table the layer owns, all attested: কিলোমিটাৰ চেণ্টিমিটাৰ মিলিমিটাৰ কিলোগ্ৰাম কিলোমিটাৰ প্ৰতি ঘণ্টা` (the one-letter keys `m`/`g` are outside the probe's key set by design) |
| `review.ts --lang as` | 1 FAILING (`sign classes: DROPPED plus-minus`), `[??] sourcing অস্ট্রেলিয়ান` | **byte-identical** |
| `mine.ts scan --in tools/corpus/mined/as.jsonc --lang as` | `no defects`, `REDUNDANT currency ×2` | **byte-identical** |
| `corpus-diff.ts emit`/`compare` (`mined:as`, baseline from a pristine detached worktree at `ec1f48d`) | — | `changed 0/97 (0.0%)`, all defect counts 0 before and after |
| `npx tsc --noEmit` | clean | clean |

`corpus-diff` changing **nothing** is the expected result and is the honest measure of the change: the
corpus contains no `cm`, and the other six spellings read identically. The fix is provable only on a synthetic
`5 cm`, which is now a golden.

**Golden changed** — one, reported and justified:

`test/normalization-sources.test.ts` → `as: a written layer with no unit word anywhere — the state ig was in`
asserted `unitWords(context("as")).verdict === "none"`. Its stated premise — "Assamese … reads none of them" —
was **false** (Run 2): the readings came from the Bengali tier all along. The test now asserts `have` plus the
presence of চেণ্টিমিটাৰ, and its comment keeps the wrong premise and why it was wrong. Two tests added:
an abugida-word regression test beside it, and an Assamese golden pinning `5 cm → pãs sentimitaɹ` (with
`৩৫mm`, `10 km`, `5 kg`, `50 km/h` unchanged, which is what says nothing else moved).

### Run 6 — 2026-08-13 08:00 — ⚠ THE RUN 5 BASELINE WAS DIRTY, and the real fleet effect is two cells

**Command** the same `--all` comparison, but with the baseline emitted from a **freshly created** detached
worktree at `ec1f48d` instead of from a copy of HEAD's `sources.ts` run **inside the modified tree**.

**Question** Why does `--all` say `bn`'s unit-word is `??` while `--lang bn` in the same checkout says `ok`?

**Raw finding** It does not. The baseline was contaminated: HEAD's `sources.ts`, executed in a working tree
that already carried the *new* `bengali.ts`, read the new file. Two real facts fell out of chasing it:

1. `units: def.unitWords ?? { … }` **broke the tool's reading of bn**. `sources.ts` reads a tier's `units`
   value as a literal or through ONE named identifier, and `def.unitWords ?? {inline}` is neither, so bn went
   from seven readable words to `[??] the words are computed, not written`. Fixed by naming the default:
   `units: def.unitWords ?? BENGALI_UNITS`.
2. With that fixed, **bn moves `ok` → `part`**, and this is the abugida fix showing its real fleet effect:
   bn declares seven unit words and `\p{L}{2}` had been hiding six of them, leaving `1 unit word(s), all
   attested` — a green line computed from one seventh of the declaration. It now reads 4/7, with
   সেন্টিমিটার / মিলিমিটার / কিলোগ্রাম genuinely absent from bn's evidence, which is the `partial` the class's
   own header calls the expected state for three quarters of the fleet.

The same fix widens the WORD COUNTS (never the verdicts) for every other abugida/abjad layer, all in the
"more of the declaration is now visible" direction: ar and its eight varieties 6 → 7 words (`مِتْر`, whose
harakat are `\p{M}`), ta 4 → 6, si 6 → 7, and hi/gu/mr/ne/te/km/my re-counted identically.

**Implication** The honest fleet claim for item 1 is **two cells**, not one: `as` NONE → ok, and `bn` ok →
part. Both are the same finding — a word test that could not see an abugida — and neither is a regression.

**Negative result worth keeping**: an hour went into a phantom "order-dependent verdict in `--all`" that was
purely an artefact of emitting a baseline from a dirty tree. A baseline is a *checkout*, not a file copy; the
`corpus-diff.ts` header says exactly this and it was still got wrong here.

**Out of scope, noticed, not touched**: `normalize.ts` maps `AUD` → `অস্ট্রেলিয়ান`, a Bengali spelling, and
`review.ts` already reports it `[??] in NO source`; and the shared tier's `exponentWords.squared` is Bengali
`বর্গ` where the Assamese corpus writes `বৰ্গ` ×7 — both read `bɔɹɡo`, so it is orthography with no phonetic
consequence, unlike `cm`.

---

## Item 3 — the four `[??]` sister standards

### Run 1 — 2026-08-13 07:55

**Command** `grep -rn "SISTER_STANDARDS\|sistersOf" tools/ src/` and
`npx tsx tools/normalization/sources.ts --lang {apd,zsm,pbt,bgc}`

**Question** Where does the map live, and what exactly are the four codes?

**Raw finding** **The "CLI runs on import" hazard was already solved before this item existed.**
`SISTER_STANDARDS` and `sistersOf` live in `tools/normalization/defects.ts`, which is a pure module — no
top-level statement, no `process.argv`, no `import.meta.main` — and `review.ts` and `candidates.ts` both
import it from there (`review.ts:451` records the removal of the second copy). So there is nothing to extract:
`sources.ts` simply was not importing it. One added import, no change to `review.ts` at all.

The four codes, from `src/registry.ts`:

| code | served by | own corpus / referee / espeak |
|---|---|---|
| `apd` Sudanese Arabic | `createArabic("sudanese")` — `arabic/` | none / none / none |
| `zsm` Malaysian Malay | `createMalay` — `malay/`, the same call as `ms` | none / none / none |
| `pbt` Southern Pashto | `createPashto` — `pashto/`, the same call as `ps` | none / none / none |
| `bgc` Haryanvi | `createHindi` — `hindi/`, an explicitly labelled approximation | none / none / none |

**Implication** `sistersOf` alone answers only `zsm` (`id`/`ms` are in the map). The other three are not
sister *standards* — Sudanese Arabic is not a standardisation of MSA and Haryanvi is not Hindi — and adding
them to `SISTER_STANDARDS` would tell `review.ts` that Hindi's corpus attests Haryanvi vocabulary, which is
false. But the relation that actually matters here is narrower and already recorded in the registry: **these
codes have no layer of their own**, so the unit words being judged are the SHARED LAYER's declaration, read a
second time under a second code.

### Run 2 — 2026-08-13 08:10

**Command** `sources.ts --lang {apd,zsm,pbt,bgc}` against the owning language's own row, after adding
`evidenceKin(code)` = `sistersOf(code)` ∪ every code the registry serves off the same layer directory.

**Question** Does judging the declaration on the shared layer's evidence give the right answer?

**Raw finding** It reproduces the owner's row exactly, which is the check that the relation is the right one:

| code | borrowed | owner | owner's own row |
|---|---|---|---|
| apd | 0/7 | ar | 0/7 |
| pbt | 4/5 (`کیلوګرامه` short) | ps | 4/5, same word |
| bgc | 6/8 (`सेंटीमीटर मिलीमीटर` short) | hi | 6/8, same words |
| zsm | 1/4 | ms 0/4 | `id` is a sister of both and attests *kilometer* — the extra hit is correct |

`evidenceKin` is **derived, not hand-kept**: a second table of "these codes are related" is a table that
drifts from `SISTER_STANDARDS`, which is the hazard that file's own header states. The registry already
knows. `SISTER_STANDARDS` is still imported and is not redundant with the directory rule — `nb`/`nn` and
`hr`/`sr`/`bs` are separate directories.

**The verdict choice, and the alternative that was rejected.** The first implementation let borrowed evidence
**attest but never refute**: `have` when every word was found, `unknown` otherwise, on the grounds that
"absent from the Hindi corpus" says nothing about Haryanvi. It was rejected after measuring: none of the four
reaches "every word found" (their owners are all `partial`), so the asymmetry left all four at `[??]` with a
better message and no better answer — and `[??]`'s printed meaning, "the tool could not READ the evidence",
had become false. The shipped behaviour reports `partial` like the owner, and the detail states what the
shortfall is about: **the shared layer's declaration, not this code's own usage**. That is the same relation
`review.ts` has always assumed for a sister standard, and `partial` is documented in this very class as a
prompt to read, not a defect.

### Run 3 — 2026-08-13 08:20 — gates

| gate | before (`ec1f48d`) | after |
|---|---|---|
| `sources.ts --all` | `apd zsm pbt bgc` all `??`; tally `[??] unit-word 4 apd zsm pbt bgc` | all four `part`; **the `[??] unit-word` line is gone (0)**. Combined with item 1 the whole-fleet diff over 189 languages is six lines: those four, plus `as` NONE → ok and `bn` ok → part (Run 6 above), plus the two tallies |
| `review.ts --lang` on `as bn hi id ms ps` | — | **byte-identical for all six**. `review.ts` is untouched: the map it uses was already in `defects.ts`, so nothing about the CLI changed |
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | — | full suite green (see the report); three tests added for the shared-layer branch, one of them pinning that the borrowed ratio equals the owner's |

---

## Item 2 — `NOT_VERSION` cannot see a SPACED version suffix

The guard in `src/core/normalizeSymbols.ts` rejects a one-letter unit key GLUED to a dotted number
(`802.11g`), and `802.11 g` — the same designation with a space — still reads as *grams*. The obvious
widening is to reject the spaced form too. This item is the measurement of what that would cost.

### Run 1 — 2026-08-13 08:30

**Command** a scan over all **161** mined artifacts (`tools/corpus/mined/*.jsonc`, `hard` + `sample`) for
`(?<![\p{L}\p{M}\p{Nd}.,])\p{Nd}[\p{Nd}.,]*[.,]\p{Nd}+\s?[a-zA-Z](?![\p{L}\p{M}\p{Nd}])` — a dotted number
followed by exactly one letter, glued or spaced.

**Question** How many instances of the shape are there at all, and how do they split?

**Raw finding** **1,015 instances: 498 glued, 517 spaced.** The letter is overwhelmingly not a unit at all
(`m` 350, `n` 168, `a` 105, `b` 58 …) — most are footnote markers, initials and designations. `802` prefixes
237 of them, and **231 of those 237 are glued**.

**Implication** The shape is far more common than the unit reading, so counting the shape answers nothing.
The question has to be asked of the ENGINE: which instances read as a unit *today*.

### Run 2 — 2026-08-13 08:45

**Command** the same scan, but phonemizing each hit with its own language: an instance "reads as a unit" when
`say("NN.NN X")` is longer than `say("NN.NN")` and no longer contains `say("X")` — i.e. the letter was
REPLACED by a word rather than read as a letter name or a foreign token.

**Question** Of the 517 SPACED instances, how many are genuine measurements the tier reads today, and how
many are version designations?

**Raw finding**

| | count | what they are |
|---|---|---|
| spaced, reads as a unit today | **18** | **every one a genuine measurement** — `4.892 m` (da), `1,854 m` (en), `0.5 g` (my, a drug dose), `3,776 m` (nan), `90.20 K` (si), `299,792.458 m/s` (ary), `25,000 m²` (pcm) … |
| spaced version designations | **6** | all six are the literal IEEE `802.11`/`802,11` + a/b/g/n — el ×1, hr ×1, mr ×4 |
| of those 6, mis-read as a unit today | **0** | none of el, hr, mr declares `n`/`a`/`b`/`g` as a one-letter unit, so the corpus's own spaced versions are inert |

**Implication** ⚠ **The widening is a pure measured loss.** It would delete 18 real measurements across 11
languages and fix **zero** corpus instances — the only demonstrated mis-reads of the spaced form are the
synthetic `de "802.11 g"` → *ɡʁam* and `en "802.11 g"` → *ɡɹˈæmz* from the mis-reading run, both confirmed
here. `802.11 g` and `12.5 g` are the same shape, and the corpus contains both senses of it.

### Run 3 — 2026-08-13 08:55 — the discriminators the item suggested

**Question** Is a NARROWER rule separable — two or more dot-groups (`802.11.3`), or a digit-shape bound?

**Raw finding**

- **Two or more dot-groups: a dead end.** Every instance in the corpus is a thousands-grouped number
  (`1.000.000 y`, `171.700.000 d`, `24.000.000 y`) or a DATE (`28.10.1994 v`, `30.01.91y`, `12.5.89 m`).
  Zero are versions. A rule keyed on it would catch no version and would newly reject dates and money.
- **Digit shape** (`≥3 integer digits and exactly 2 fraction digits`, the shape of `802.11`) happens to spare
  all 18 spaced measurements here — but only by accident of this corpus: `150.25 m` and `220.50 g` are the
  same shape as `802.11 g` and are perfectly ordinary measurements. `pcm 8,848.86 m` (Everest) already sits
  one thousands-comma away from being caught. Separating them needs the DESIGNATION, not the shape.
- What IS separable is the literal `802.11`, at 6/6 versions and 0/517 false positives — but that is a
  known-designation list, not a guard, and a list with one member is not a fleet-wide rule. `as`'s
  `normalize.ts` already carries exactly this locally, bounded to its own four corpus instances.

**Decision: the guard is NOT widened, and the measurement is the deliverable.** No change to
`src/core/normalizeSymbols.ts`.

### Run 4 — 2026-08-13 09:05 — ⚠ and the guard that IS there costs more than it saves

**Command** the same engine-driven scan over the **498 GLUED** instances, asking a sharper question: does the
unit read when the string is SPACED and *not* when it is GLUED? That difference is the guard acting, and
nothing else.

**Question** What is the existing `NOT_VERSION` guard actually buying?

**Raw finding** **30 instances are suppressed by the guard. 4 are versions. 26 are genuine measurements.**

| | count | languages |
|---|---|---|
| versions correctly suppressed | 4 | `802.11g` — bn, cmn, de, el |
| measurements wrongly suppressed | **26** | ary ×14 (`28.000m²`, `76.000m²` — airport terminal areas), awa ×2, lo ×3, my ×2, nan ×1, pcm ×3, pnb ×1 |

And the suppressed reading is not merely silent — it is a mis-read in the raw-Latin class:

```
ary  28.000m²  → … sˤifr sˤifr sˤifr ˈɛm skwˈɛɹd      ary  28.000 m²  → … mˈitr murˈabːaʕ
en   12.5g     → twˈɛɫv pʰɔᶦnt fˈaᶦv d͡ʒˈiː             en   12.5 g     → … ɡɹˈæmz
```

The guard hands the letter to the foreign path, which reads it as an ENGLISH LETTER NAME inside Moroccan
Arabic prose.

**Implication, and why it is still not changed in this commit.** The measured trade of the existing guard is
**26 genuine measurements deleted to catch 4 designations**, and the narrowing that fixes it is provable
against this corpus by construction — anchor the guard on `802.11` instead of on `\d+[.,]\d+[a-zA-Z]` and all
30 come out right. It is deliberately NOT done here, for one reason the corpus cannot settle: in English
news style `$1.5m` is *1.5 million*, and the glued guard is incidentally what stops that reading from
becoming *1.5 metres*. That is a different question, in a different class (magnitude vs unit), with a
different blast radius — 26 corpus lines across 7 languages would change reading — and folding it into a
"widen the version guard" item is exactly the unmeasured fleet-wide change this item exists to refuse.

**Recommended follow-up, with its numbers already measured**: narrow `NOT_VERSION` to the designation, and
settle the `$1.5m` magnitude question first, in its own investigation.
