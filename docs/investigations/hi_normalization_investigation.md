# Hindi (hi) text normalization — investigation log (#586 loop-back)

Third of the three loop-back targets (en in #609, cmn in #610). Not a first pass: hi was the fourth language
ever treated under #562 and the first outside the Latin script.

Corpus: FLEURS `hi_in`, 1,702 utterances / 2,120 raw. Artifact `tools/corpus/mined/hi.jsonc` (88 lines).
Worked on `main`; a shared normalizer and a shared defect table are both touched, so a language-only worktree
did not fit.

**The structural fact that shaped everything below:** `makeHindiNormalizer` is a FACTORY consumed through
`makeNativeHindi`, and it lands on eight languages — hi, awa, bho, mai, mag, hne, bgc, rkt. Marathi, Nepali
and Gujarati each supply their own normalizer through `overrides.normalize`, so they are NOT affected. Two of
the eight (hne, bgc) are explicitly labelled cannot-verify stubs served by the Hindi engine as an
approximation. Any word added here is added to all eight, which is the existing design — धन already reaches
them the same way.

---

## Run 1 — 2026-08-03 — the widened gate, and a plus that was already right

```
npx tsx tools/normalization/review.ts --lang hi
  → [FAIL] sign classes  DROPPED: minus plus-minus ampersand equals less-than greater-than times divide
  → [FAIL] artifact scan  DROP minus ×2
  minus         -5       DROPPED  pˈaː̃t͡ʃ
  plus          +5                d̪ʱˈən pˈaː̃t͡ʃ        ← already reads धन
  exponent      5 km²             pˈaː̃t͡ʃ ˈʊkm         ← NOT flagged, and wrong
```

Three of those eight classes — `±`, `>`, `÷` — were invisible before #610 widened `signCases`.

**Finding.** `+5` already reads धन, so the plus was done in the #562 pass. And `5 km²` reads *pˈaː̃t͡ʃ ˈʊkm* —
`km` reaching the IPA as a Latin fragment, worse than the raw text — while the gate prints no DROPPED marker,
because deleting the `²` changes the output. Same merge-shaped blindness as the ampersand in #610, different
class.

---

## Run 2 — 2026-08-03 — the artifact's two "dropped" minuses are both false positives

```
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/hi.jsonc --lang hi
  → DROP minus ×2
```

Read them:

```
फ़ॉर्मूला-1 चैंपियनशिप          Formula-1 — a designation
मानव रहित लूनर ऑर्बिट चंद्रयान -1   Chandrayaan-1 — a spacecraft, hyphen SPACE-SEPARATED
```

**Neither is a negative.** And `फ़ॉर्मूला-1` reveals a gate defect: `DROPPABLE`'s minus pattern is
`(?<![\p{L}\p{Nd}])`, and the character before that hyphen is ा (U+093E, `Mn`) — a **matra**. A Devanagari
word usually ends in a matra rather than a bare consonant, so the guard passes and the class is blind across
every abugida in the fleet.

**Implication.** Fix the guard before writing any rule, because the same omission would be in my rule.

---

## Run 3 — 2026-08-03 — the corpus, counted properly

**Question.** How many real negatives does hi actually have?

```
hyphen preceded by a DIGIT (a range: 25-30, 1000-1300, 100-200, 120-160)   22
hyphen preceded by a SPACE                                                  1   → चंद्रयान -1
hyphen at string start or after an opening bracket                          0
hyphen preceded by a letter or matra                                        (फ़ॉर्मूला-1)
REAL NEGATIVE NUMBERS                                                       0
```

**Then I read step 7 of the layer and found the same measurement already there,** from the #562 pass:

> the MINUS rule used in the other languages is deliberately NOT applied here, on the corpus evidence: the
> only hyphen-before-digit in the whole corpus is `चंद्रयान -1`, a spacecraft NAME … Devanagari text also uses
> a spaced hyphen in compounds (आस-पास), so a minus rule here has false positives and, measurably, no true
> ones.

**Finding.** The deferral was not an oversight; it was measured, and my independent count reproduces it
exactly. The gate is asking for something the corpus says is wrong — **for the rule shape the gate assumes.**

**Implication.** Do not "fix the FAIL". Either leave it, or find a rule shape the objection does not reach.

---

## Run 4 — 2026-08-03 — what escapes the objection is right context

The refusal's evidence is all about what precedes the sign. Every counter-example is a DESIGNATION, and a
designation never has a degree word after it. So:

```
arm 1   sign opens the string or a bracket        `-5`, `(-3)`     — 0 corpus counter-examples
arm 2   sign followed by a degree/percent word    `-5 °C`          — 0 corpus counter-examples
```

And arm 2 is the case worth having, because **the corpus writes its positive twin**:

```
गर्मियों के महीनों में + 30° C से अधिक तापमान रहना …    "temperatures above +30 °C in the summer months"
```

A signed temperature is therefore an attested shape in this corpus, and it is exactly the shape where
dropping the sign INVERTS the meaning. `चंद्रयान -1`, `फ़ॉर्मूला-1`, `25-30` and `आस-पास` are outside both arms.

That sentence also corpus-attests **से अधिक** for `>`, in slot.

---

## Run 5 — 2026-08-03 — sourcing, and the Fula trap sprung again

espeak `hi_list` has no math-sign entry at all. Corpus gave two in slot:

```
वर्ग    「यह पार्क 19,500 वर्ग किलोमीटर में फैला है」        square kilometres — ² as a PREFIX
बराबर   「इस अभिमुखता अनुपात के लगभग बराबर」                 "approximately equal to this aspect ratio"
और      36×, the ordinary conjunction
```

`धन` — the word the repo has been SHIPPING for `+` since #562 — has **zero** real corpus hits (धकेल,
धन्यवाद are the matches). So the shipped word was unsourced.

Wikipedia, via `attest.ts` (Devanagari is spaced, so the token test applies here and all ten words attested):

**ऋण's own attestation is the LOAN sense** — 「अनर्जक ऋण (non-performing loan या NPL) वह ऋण है」. That is the
Fula/`paun`/`amaphuzu` trap exactly: the word is real, common, and the wrong sense. माइनस, the loan word
broadcasters use, also failed to attest in slot.

What settled it was a different article, `पूर्णांक` (integer):

> ऋणात्मक पूर्णांक = जिन संख्याओं के आगे **ऋणात्मक चिह्न** लगा हो उन्हें ऋणात्मक पूर्णांक कहते हैं जैसे **-१, -२**
> ("negative integers = numbers with a negative SIGN in front of them, e.g. -१, -२")

with 「धनात्मक चिह्न」 as its counterpart. Wikipedia glossing `-१` itself — and it retroactively sources the
धन that had been shipped on nothing.

And `अंकगणित` (arithmetic) names the operations and ties each to its sign:

> अंकगणित की मुख्य चार मूल प्रक्रियाएँ होती हैं जोड़ घटाना **गुणा भाग** … **गुणा** को x चिह्न से प्रदर्शित
> किया जाता है। उदाहरणः 2 x 4 = 8 … **भाग** को / चिह्न से प्रदर्शित किया जाता है

**A distinction that mattered:** जोड़/घटाना are the OPERATION NAMES (addition, subtraction), not what a reader
says between operands. धन/ऋण are the SIGN words. For `-5` the sign word is wanted, and it is also the one that
pairs with the धन already in the file. `/` is not routed to भाग here — step 8 already reads it as the fraction
बटा.

---

## Run 6 — 2026-08-03 — the comparatives reorder

**Finding.** Hindi states a comparison POSTPOSITIONALLY: the standard comes first and से कम / से अधिक follows
it. So `A < B` is "A, B से कम", **not** "A से कम B". The corpus shows the shape twice — 「+ 30° C से अधिक
तापमान」 and 「800,000 से ज़्यादा सैनिकों」 ("more than 800,000 soldiers").

Emitting the western operand order would have been fluent nonsense — grammatical Hindi words in an order that
states the comparison backwards. This is the one rule here that is not a substitution.

```
5 < 6  →  pˈaː̃t͡ʃ t͡ʃʰˈəɦ sˈeː kˈəm      पाँच छह से कम
6 > 5  →  t͡ʃʰˈəɦ pˈaː̃t͡ʃ sˈeː ˈəd̪ʱɪk    छह पाँच से अधिक
```

---

## Run 7 — 2026-08-03 — the guard fix, measured over every artifact

Adding `\p{M}` to `DROPPABLE`'s minus guard is a fleet change, so it was measured over all 37 mined artifacts:

```
artifact   candidate matches: old → new
bn           2 → 1        my          13 → 9
hi           2 → 1        or           1 → 0
kn           4 → 3        pa           1 → 0
ta           2 → 1        te           2 → 0
                                       8 artifacts affected
```

Reported DROPs, before → after: **bn, or, te and pa lose the class entirely** (pure noise), hi goes 2 → 1,
ta 2 → 1. What survives is genuinely ambiguous and correctly left to a human:

```
hi   चंद्रयान -1        space-separated designation
ta   சந்திரயான் -1      THE SAME FLEURS SENTENCE, in Tamil
kn   26 -00            a score
```

The hi/ta pair is the "seven utterances, all the same sentence" pattern again: one FLEURS source sentence
generating the identical false positive in every language it was translated into.

---

## Run 8 — 2026-08-03 — the eight shared languages

Probed all eight consumers of the factory. Words read correctly through each language's own g2p (`ɾˈɪɳ`,
`rˈin`, `ɾˈin`; `bəɾˈaːbəɾ`, `bˈəɾɑbəɾ`, `bˈɔɾabɔɾ`), designations and ranges untouched in every one.

One unrelated pre-existing quirk noticed and left alone: rkt reads `25-30` as *pˈãs bˈis t̪ˈis* — verified
identical in the baseline tree, so it is rkt's numeral composition, not this change.

---

## Gates

```
tsc                 0 errors
vitest              201 files, 2810 tests passing (+3)
review.ts --lang hi    all 13 sign classes read, none dropped
mine.ts scan           DROP minus ×1 — `चंद्रयान -1`, correctly silent (see Run 7)
referee-eval hi        3936/5063 (77.7%), symbol accuracy 95.4% — UNCHANGED vs a detached-HEAD worktree
corpus-diff            1/1702 changed (0.1%), DROP 2 → 1
```

**And the change is annotation-only.** The one differing row is the `फ़ॉर्मूला-1` sentence, whose IPA is
byte-identical; what changed is that the guard fix stopped appending `⟪DROP:minus⟫` to it.

## What the corpus did NOT say, stated plainly

Counted over `hi_in`:

```
=  0     <  0     >  0     ×  0     ÷  0     ±  0     &  0     ²  0     ³  0
+  4 (already handled)      °  2 (already handled)
```

**None of the new sign classes occurs in the corpus at all.** So in hi, unlike cmn, the language rules change
no corpus reading; the only corpus-visible improvement is the tooling fix in Run 7. The rules close gate
classes and fix plausible input — `5 km²` was reading as *ˈʊkm*, and a dropped minus on a temperature inverts
it — but the honest characterisation is robustness, not measured-defect repair, and the same distinction #610
drew for the core `magAlt` change.

That is worth recording as a limit of the method: FLEURS is read speech transcribed from encyclopedic prose,
and it systematically under-represents the arithmetic, financial and meteorological notation that real input
carries. A corpus-count of zero is evidence about the corpus, not about the language.

## What this run says about #586

hi is the case where **the gate was wrong and the layer was right** — and where the layer had written down
why, in enough detail that I could re-measure it in one command. The deferral held on its own terms; what
broke it was not better evidence but a narrower rule shape. Trap 16 says check whether the seam exists before
deferring; this is its complement: **check whether the rule shape is the only one available before accepting
someone's refusal — including your own.**

Two of the three loop-back languages ended by fixing the tooling (cmn: `attest.ts`, `review.ts`, `sources.ts`,
core `magAlt`; hi: `defects.ts`), and en found nothing at all, which is what made it worth running.
