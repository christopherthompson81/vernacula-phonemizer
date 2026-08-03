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

## Run 9 — 2026-08-03 — an empty cell is a query to run, not a fact

**The stopping point above was wrong.** I had written "a corpus-count of zero is evidence about the corpus,
not about the language" and left it there — while `mine.ts`'s own header says, in capitals:

> ⚠ AN EMPTY CELL IS NOT EVIDENCE. It is a query to run or a tool bug.

`fetch --fill` exists for exactly this, and `nb.jsonc` is the precedent hybrid. So: run the query.

```
npx tsx tools/normalization/mine.ts fetch --wiki hi --out hi_fill.txt \
    --fill exponent,arithmetic,ampersand,rate,era-marker,roman,dotted,ordinal-latin,calendar --digits ०-९

  exponent            5 hits on the wiki → pulled 5 articles
  arithmetic        158 hits → 20 articles      ampersand    23650 hits → 20 articles
  roman           11994 hits → 20 articles      dotted        6790 hits → 20 articles
  era-marker          3 hits → 3 articles       ordinal-latin   10 hits → 10 articles
  rate                0 hits — genuinely absent from this wiki
  calendar: lexical cell needs --terms
wrote 98 passages
```

Then merged rather than replaced — `--in fleurs:hi_in,hi_fill.txt` — because the FLEURS half is the text the
engine was built and evaluated against:

```
covered 18/29  →  29/35        (the cell inventory itself grew to 35 since hi was first mined)
newly populated: exponent · arithmetic · ampersand · signed-number 2→26 · roman · dotted · ordinal-latin
still EMPTY: era-marker ordinal-native ordinal-range iteration calendar ordinal-caps
```

`rate` reported **0 hits — genuinely absent from this wiki**, which is the answer I had been assuming for
everything without asking.

---

## Run 10 — 2026-08-03 — the hybrid scan found four classes FLEURS could not

```
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/hi.jsonc --lang hi
  DROP minus     ×4
  LEAK RAWMARK   ×2   मुरादाबाद ज़िला २८°२१´ से २८°१६´ … ७८°४´ से ७९º पूर्वी देशांतर
  DROP exponent  ×2   … अधिकतम १९६३ ३०८०००० km ² (७६२ मिलियन एकड़) तक …
  DROP currency  ×1   ६०° के चाप पर … २०¢ या १०¢ तक बने होते हैं
```

**COORDINATES, absent from FLEURS entirely, leaked three marks in two sentences.** `´` (U+00B4) and `'` as the
minutes mark, and **`º` — U+00BA MASCULINE ORDINAL INDICATOR** standing in for the degree sign, which is the
same substitution the Italian run found in `dell'11º`. Fixed: a coordinate rule ahead of the degree rules
(which would otherwise eat the `°` and strand the minutes), and `[°º]` in every arm. The minutes mark is
claimed ONLY after a degree, because a bare `'` is an apostrophe elsewhere.

```
२८°२१´      → əʈʈʰaːˈiːs ɖˈɪɡɾiː ɪkːˈiːs mˈɪnəʈ
३०º ०५'     → t̪ˈiːs ɖˈɪɡɾiː pˈaː̃t͡ʃ mˈɪnəʈ
२८°२१´३०″   → … ɪkːˈiːs mˈɪnəʈ t̪ˈiːs seːkˈə̃ɳɖ
```

**`km ²` — the exponent SET OFF BY A SPACE.** A core fix: `\s?` before the exponent, placed OUTSIDE the
capture group so the positional callback is unaffected. It is self-limiting there — on the ASCII branch the
lookbehind `(?<=[a-zA-Z])` then sees the space and fails, so `km 2` (a kilometre, then two) is still not an
exponent while `km ²` is. Verified both ways, and in cmn too. Zero occurrences in all 66 FLEURS corpora;
Italian corpus-diff 0/1978.

**A REAL NEGATIVE, in a domain FLEURS does not have:**

```
ट्राइटन की सतह पर औसत तापमान -२३५.२° सेंटीग्रेड है।     Triton's surface temperature, −235.2 °C
  → … t̪aːpmˈaːn ɾˈɪɳ d̪ˈoː sˈɔː pɛː̃n̪t̪ˈiːs d̪əʃˈəmləʋ d̪ˈoː ɖˈɪɡɾiː …
```

Arm 2 of the minus rule was built for exactly this shape on the strength of its positive twin, and here is the
negative itself. Devanagari digits and all — they are folded to ASCII before this layer runs, so the rule sees
them.

---

## Run 11 — 2026-08-03 — the fill also refuted one of my own rules, and carried garbage

**A FALSE POSITIVE OF MINE, caught by real text.** Arm 2's lookahead was `°|डिग्री|%|प्रतिशत`. The fill
contains a census figure:

```
कोच (३१,३८१ -९८.५३% हिंदू)      "Koch (31,381 – 98.53% Hindu)"
  → … ɪkjˈaːsiː ɾˈɪɳ əʈʈʰˈaːnʋeː … pɾˈət̪ɪʃət̪ …     "31,381 MINUS 98.53 percent Hindu"
```

The dash is a SEPARATOR introducing the percentage. Its spaced twin `साक्षरता - ६१%` escaped only by accident
(the digits are not adjacent). A negative percentage is plausible but unattested here; a dash-introduced one is
attested twice — so the percent arm is removed and the rule is degrees-only.

**A REAL NEGATIVE I AM DELIBERATELY NOT CLAIMING.** The fill also has Mars's apparent magnitude:

```
… ५५,७५८ कि॰मी॰ (०.३७२७१९ ख॰इ॰), -२.८८ परिमाण, २७ अगस्त …      magnitude −2.88
```

That is a true negative and the rule leaves it, because its shape — sign, number, noun — is the same as an
attested SEPARATOR: `समुद्र तल से ऊँचाई -१७१ मीटर` ("elevation – 171 m"; no Indian district is 171 m below sea
level). Nothing local distinguishes them, so claiming one claims the other. It stays a reported DROP.

**AND THE FILLED CELL CONTAINED MOJIBAKE.** The `¢` and the remaining `²` both come from one article, on the
SEXTANT:

```
सेक्सटैंट से १२०° तक का कोण …            degrees written correctly
… २०¢ या १०¢ तक बने होते हैं              on a 60° arc, subdivisions to 20¢ or 10¢
बर्नियर से २०² या १०² तक पढ़ने की सुविधा   a vernier reading to 20² or 10²
```

The article writes `°` correctly, so `¢` and `²` here are corruption of the arc-minute `′` and arc-second `″` —
an imported/OCR'd technical text (it also spells निर्देश as "निर्दश"). So `¢` is **not** currency and `²` is
**not** an exponent, and neither gets a rule. Both stay as reported drops with the reason recorded.

That is the counterpart to the tool's own warning: an empty cell is not evidence, and **a filled cell is not
evidence either until it is read.** FLEURS is transcribed speech and is clean by construction; a Wikipedia fill
carries whatever the wiki carries, mojibake included. The fill is the right instrument and its output is a
lead, not a finding — the same relationship `attest.ts` has to its own hits.

---

## What FLEURS alone did NOT say, and what the fill answered

Counted over `hi_in` alone:

```
=  0     <  0     >  0     ×  0     ÷  0     ±  0     &  0     ²  0     ³  0
+  4 (already handled)      °  2 (already handled)
```

FLEURS is transcribed read speech and systematically under-represents arithmetic, coordinate and
meteorological notation. **But a zero here was a query to run, not a conclusion** — and running it (Runs 9–11)
turned four of those zeros into real attested text, which then found two defects I had not written rules for
(the coordinate leaks, `km ²`), one real negative that vindicated a rule (Triton), one real negative the rule
correctly declines (Mars's magnitude), one FALSE POSITIVE in a rule I had already committed (the percent arm),
and one article of mojibake to refuse. None of that was reachable from FLEURS.

## What this run says about #586

hi is the case where **the gate was wrong and the layer was right** — and where the layer had written down
why, in enough detail that I could re-measure it in one command. The deferral held on its own terms; what
broke it was not better evidence but a narrower rule shape. Trap 16 says check whether the seam exists before
deferring; this is its complement: **check whether the rule shape is the only one available before accepting
someone's refusal — including your own.**

Two of the three loop-back languages ended by fixing the tooling (cmn: `attest.ts`, `review.ts`, `sources.ts`,
core `magAlt`; hi: `defects.ts`), and en found nothing at all, which is what made it worth running.
