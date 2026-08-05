# Mandarin (cmn) text normalization — investigation log (#586 loop-back)

Not a first pass. Mandarin was normalized under #562 and its layer was, by design, one line long — the audit
then found that Mandarin already had more of this tier than any language audited, and that the real defects
were in the engine rather than the layer. This log covers the **#586 loop-back**, whose premise is that the
tooling has improved since and the already-swept languages should be re-measured against the better gates.

Corpus: FLEURS `cmn_hans_cn`, 1,999 utterances. Mined artifact `tools/corpus/mined/cmn.jsonc` (85 lines).
Worked on `main` directly (a tools change was part of the work, so a language-only worktree did not fit).

---

## Run 1 — 2026-08-03 — what the improved gates say about a language already swept

**Question.** #586's claim is that languages passed under weaker gates have defects those gates could not
see. Does cmn, one of the earliest and most complete layers, actually exhibit any?

```
npx tsx tools/normalization/review.ts --lang cmn
  → [FAIL] sign classes   DROPPED: minus plus equals less-than times
  → [FAIL] artifact scan  DROP math-sign ×1
       e.g. 抗议活动于当地时间 11:00 (UTC+1) 左右在白厅 (Whitehall) 开始…
  → [ ok ] tests          (the broadened tests-check now finds them; it reported a false FAIL before)
```

Direct probe of the worst case:

```
"-5 度"  →  wu˨˩˦ tu˥˩          五度 — POSITIVE five degrees
"-5"     →  wu˨˩˦               五
"+5"     →  wu˨˩˦               五
"x = y"  →  ˈɛks wˈaᶦ
"5³"     →  wu˨˩˦
```

**Finding.** Yes. Seven sign classes dropped, and the minus one **inverts a temperature** — a
below-freezing reading delivered as above-freezing. That is the strongest single answer #586 has got: the
language with the most complete layer in the fleet was silently mis-signing every negative.

**Implication for the next step.** Every one of these needs a Mandarin WORD, and I do not get to supply
those from memory. Source them first.

---

## Run 2 — 2026-08-03 — sourcing, and a tool that could not answer for this script

**Question.** What are the attested Mandarin readings for `= < > × ÷ + ± -` and the exponents?

espeak first: `dictsource/cmn_list` carries `_dpt` (点, the decimal point) and **no math sign at all**. Its
Latin letter block is entirely commented out (`//a ei51`), which is a second finding —
`sources.ts` reports `letter-names espeak 3836 letters — WIREABLE` for cmn, and those 3,836 "letters" are
**Han headwords** matching its single-`\p{L}` pattern, not letter names. A logographic false positive; noted
for #586, not fixed here.

Corpus next, which had two real hits:

```
乘以  「29¾ 英寸乘以 24½ 英寸」     — "29¾ inches BY 24½ inches"
平方  「公园占地 19500 平方公里」  ·  「783,562 平方公里（300,948 平方英里）」
加    5 hits, ALL false — 加征 (impose tariffs), 参加, 加坡 (Singapore)
```

Then `attest.ts` against Wikipedia — which **refused to run**, correctly:

```
npx tsx tools/normalization/attest.ts --lang cmn --words …
  → cmn.wikipedia.org does not respond as a wiki — a negative from here is NOT evidence.
    Pass --wiki <code> if this language's wiki is filed under a different code.
```

Good affordance; the wiki is `zh`. With `--wiki zh` it ran, and produced this:

```
word     token  arts  substr-only  verdict
等于       0      0     1            substring-only
小于       0      0     1            substring-only
乘以       0      0     1            substring-only
摄氏度      0      0     1            substring-only     ← SHIPPED since #562
大于       1      1     0            attested
```

**Finding — the tool is unusable for an unspaced script, and says the opposite.** `tokens()` splits on
non-letters, which for Chinese prose yields ONE token per sentence, so `toks.has(word)` is false for every
real Chinese word. Every verdict is `substring-only` by construction — including 摄氏度, which this repo has
shipped as the Celsius word for months. The one `attested` verdict, 大于, hit only because a LaTeX dump had
put spaces around it: the boundary test was measuring the markup, not the language. And `examples: []` for
substring-only meant the sole evidence a spaceless language can offer was collected, discarded, and reported
as a negative.

The function's own comment claimed it "works for a spaceless orthography's words too."

**Implication.** Fix the tool before trusting any negative from it. `UNSPACED` (Han, kana, Thai, Lao, Khmer,
Myanmar, Tibetan, Javanese — deliberately not Hangul, which spaces its eojeol) keyed off the **probed word**
rather than the wiki, so a Latin loan probed on zh still gets the boundary test. For an unspaced word the
substring match is the hit, the verdict is written `attested*`, and examples are kept — because the precision
that makes `Yen` fail inside `Libyen` is simply unavailable here, so reading the quotes is not advisory, it
is the entire finding.

---

## Run 3 — 2026-08-03 — the same probe, after the fix

**Question.** With the boundary test disabled where no boundary exists, what is actually attested?

Every word landed **in its own notation slot**, which is more than existence:

```
=  等于   「任何数字与1相乘皆等于其本身」 · 「一加一不等於二」
<  小于   「呼吸频率（RR）小于每分钟30次」
>  大于   「a > b ，即 a 大于 b」                    ← the article glosses the notation itself
×  乘以   「0乘以任何实数都等于0（0×10=0）」          ← × and = in one sentence
÷  除以   「總人口數除以總面積」
±  正负   「直流正负800千伏」                        ← a ±800 kV rating
-  负     「0非正非负」 · 「0的负数次方」
-  零下   「经过零下40度高寒地带」                    ← a −40° zone
²  平方   「1公顷 = 0.01平方公里」 · 「平方厘米」
³  立方   「25,500億立方公尺」
```

**The plus needed a second round, and the first answer was wrong.** A wiki gloss of `1+0=1` reads
「任何实数**加上**0等于其本身」, so 加上 was the obvious pick. Probing it directly killed it: 加上's own
attestations are the **conjunction** sense —「加上海外市場後」, "plus the overseas market, …" — while the
disambiguation page for `1+1` reads 「1+1是一個數學算式 … 1+1或**一加一**也可能指」 and 「一加一不等於二」.
Wikipedia glossing the notation `1+1` as 一加一 settles the operator as **加**.

That is the Fula lesson in a new costume: the first source was real, the sense was wrong, and only a
targeted probe of the *candidate* rather than the *slot* caught it.

**Implication.** All twelve readings are sourced. Write the rules.

---

## Run 4 — 2026-08-03 — the seam already existed for the exponent

Before writing an exponent rule (trap 16 (before declaring a class out of scope) — check whether the seam exists before deferring to it):
`makeSymbolNormalizer` already has `exponentWords` with a three-valued `position`, and its own comment names
**Japanese 平方キロメートル** as the `compound` case. Chinese is the same shape. So the unit exponent is one
declared line in `mandarin.ts`, not a rule:

```ts
exponentWords: { squared: ["平方"], cubed: ["立方"], position: "compound" },
```

`before` would have emitted "平方 公里", splitting one Han run into two.

---

## Run 5 — 2026-08-03 — two defects in my own first draft

**Question.** Do the rules read correctly across the probe set?

```
"5²"        →  wu˨˩˦ tɤ liɑŋ˨˩˦ t͡sʰɹ̩˥˩ fɑŋ˥˥    五的两次方
"1350 亿 m³" →  … ji˥˩ ˈɛm                        the unit read as English "em"
"5 万 km²"   →  wu˨˩˦ wɑn˥˩ ˈʊkm                  km as an English word
```

**Finding 1.** Emitting the bare exponent as a DIGIT (`的2次方`) walked straight into the engine's own 两
rule: 五的**两**次方. 两 is the counting-two used before a measure word, never the two of a power (二次方).
Fixed by spelling the word — `的平方` / `的立方` — which puts the reading beyond reach of any numeral rule
and reuses a word already attested for this language.

**Finding 2.** A magnitude between the number and the unit broke the tier's adjacency, and the unit then fell
through to an English reading — output *worse* than the raw text. cmn declared no `magnitudes`. Chinese groups
by myriads, so: `magnitudes: ["万", "亿", "兆"]`. The artifact writes the magnitude against a currency NOUN
(13 万日元, 40 万例) rather than a Latin unit, so this guards a plausible input, not a sampled one — stated as
such in the code. Still unfixed and recorded: the **unspaced** form `1350亿m³`, because `magAlt` requires
`\s+` before the magnitude. Core, and not exercised by the corpus.

---

## Run 6 — 2026-08-03 — the corpus overruled my guard

**Question.** What does the full corpus diff say?

```
changed 4/1999 (0.2%)   DROP 2 → 1
  SRC 伊尔-76 自 20 世纪 70 年代以来…
   -  ji˥˥ ər˨˩˦ t͡ɕʰi˥˥ ʂʐ̩˧˥ lioᵘ˥˩ …
   +  ji˥˥ ər˨˩˦ fu˥˩ t͡ɕʰi˥˥ ʂʐ̩˧˥ lioᵘ˥˩ …      伊尔负76
```

**Finding — a regression I introduced, caught by the gate.** Chinese has no spaces, so I had reasoned that
the character before a negative is normally Han and relaxed the fleet's `(?<![\p{L}\p{Nd}])` guard to exclude
only digits and Latin letters. The corpus writes the aircraft as **伊尔-76** — Il-76 with the *name*
transliterated and the designation left in digits — twice. My guard read it as 伊尔负76, "Il negative 76".

The Han-adjacent negative (气温-5度) was my invention. 伊尔-76 is attested. **The attested case wins.**

**What survives is a discrimination on RIGHT context, not left.** The temperature rule can keep the loose
guard because a degree word follows it, and 伊尔-76 has none. So `BELOW_ZERO` reads Han-adjacent, the general
negative takes the fleet's strict guard, and the cost is a bare unspaced `气温-5` with no degree word.

---

## Run 7 — 2026-08-03 — the last drop, and a gate that could not see it

With the guard fixed: `changed 2/1999`, **DROP 2 → 1**. The survivor:

```
⟪DROP:ampersand⟫   在高端市场上，一众 B&B 公司主要在两个方面展开竞争
                    → … bˈiː bˈiː …          "B B"
```

**Finding — `review.ts` reported this class CLEAN.** Its probe was `A&B`; deleting the `&` yields `AB`, ONE
token, read differently from `A B`, so the differential test concluded the symbol contributed. Meanwhile
`corpus-diff.ts` — which could only see the class at all because `defects.ts` unified the three drifted
tables — flagged the real sentence.

This is the trap `defects.ts` documents for the minus ("probe forms never merge two digits"), present in the
review gate's own probe. Worse, **the file's header already described this exact defect**, from the Czech run:
"removing `&` changed the tokenization (`BB` is one initialism, `B B` is two letters) … that is why the sign
probes PRINT their readings." It was written as a limitation and stood as one for thirty-seven languages, when
the fix is to space the probe: `A & B` deletes to `A  B`, which reads as `A B`.

Fixed, and while there, the probe list was aligned with `DROPPABLE` — it had drifted, missing `÷ > ±`, the
exponent and the currency sign outright. `iteration` is deliberately excluded and now says so in-file: it is
script-specific, so a language that does not use the mark would report it dropped.

**The cmn ampersand itself.** Between LATIN letters it becomes ` and `, staying inside the run the engine
already delegates to English — `B&B`, `AT&T`, `R&D` are English terms and reading half of one in Mandarin
would be a code-switch mid-word. Elsewhere it becomes 和. No corpus sentence exercises that second arm; it
guards against silence and is marked as such.

---

## Run 8 — 2026-08-03 — the widened gate against the languages already swept

**Question.** The gate just got five new classes and one un-blinded one. Does it find anything in the two
other loop-back targets?

```
en  → all 13 classes read, none dropped
hi  → DROPPED: minus plus-minus ampersand equals less-than greater-than times divide
      exponent  5 km²  →  pˈaː̃t͡ʃ ˈʊkm        ← not flagged, and still wrong
```

**Finding.** English is clean, which is the validation the widened gate needed — the new classes are not
generating noise. Hindi has **eight** dropped classes, three of them (`± > ÷`) invisible before this run, plus
`5 km²` reading as *five ukm*: `km` is undeclared in hi's units, so it falls through, and because deleting `²`
changes the output the marker stays silent. Same shape as cmn's magnitude defect, different cause.

hi is the next language in this loop and is not touched here.

---

## Gates, final

```
tsc                 0 errors
vitest              201 files, 2807 tests passing (+4 new cmn tests)
review.ts --lang cmn   checklist clean; all 13 sign classes read
mine.ts scan           no defects
referee-eval cmn       359/424 (84.7%), symbol accuracy 94.9%
                       UNCHANGED — measured against a detached HEAD worktree, not assumed
corpus-diff            3/1999 changed (0.2%), every change read in full
                       DROP 2 → 0 · DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · THROW 0
```

The three changes, all improvements:

1. `3136 mm2 对 864` — read as *m 两*, "3136 metres two" (`mm` collapsed to `m`, `2` became 两). Now
   平方毫米, "3136 square millimetres". **This defect no gate had named**; it surfaced only because declaring
   `exponentWords` changed the sentence. It was never a DROP — the `2` produced output, just the wrong one.
2. `11:00 (UTC+1)` — the `+` now reads 加.
3. `一众 B&B 公司` — the `&` now reads "and".

## Run 9 — 2026-08-03 — the core `\s+`, measured instead of corpus-diffed 84 times

**Question.** `magAlt` requires whitespace before the magnitude, so `1350亿m³` fails. Fixing it is a core
change affecting the 42 language dirs that declare `magnitudes`. What is the blast radius?

Running corpus-diff for 42 languages before and after is ~40 minutes of emits. But `\s*` is a strict superset
of `\s+`, so the ONLY new matches are where a magnitude **touches** a digit — which is a grep, not an eval:

```
for each language declaring magnitudes: grep its FLEURS corpus for /\d(magnitude)/
  → cmn  cmn_hans_cn   3   e.g. 7亿
  → kn   kn_in         4   e.g. 7ದಶಲಕ್ಷ
  → all 64 other corpora: zero
```

Then reading the seven hits:

```
cmn 「年营业额 100 亿欧元（147亿美元）」     — 美元 is a currency WORD, not a sign
kn  「ಜನಸಂಖ್ಯೆಯು ಸರಿಸುಮಾರು 3.7ದಶಲಕ್ಷ,」   — followed by a comma
```

**Finding.** In all seven the magnitude is followed by a currency word or a comma — never a sign or a unit —
so the tier has nothing to place and **the fix changes no corpus reading anywhere**. Confirmed by running the
two corpora that could possibly have been affected: `cmn 0/1999`, `kn 0/1811`.

So the change ships as **robustness for plausible input, not a measured-defect repair**, and says so in the
code. That distinction is the whole point of the measurement: without it I would have written a comment
claiming a fix for defects that do not exist in any corpus.

(kn carries 6 pre-existing DROPs, unrelated and untouched — a finding for the sweep.)

---

## Run 10 — 2026-08-03 — the letter-name false positive, and the two more behind it

**Question.** `sources.ts` reports `letter-names espeak 3836 — WIREABLE` for cmn. Why?

**Finding 1.** `\p{L}` matches 亿 as readily as `b`, and cmn_list is 3,899 lines of **Han headwords**. Excluded
by SCRIPT rather than by count, because a large count can be legitimate — Ethiopic has ~350 fidel and
Amharic's seam is keyed on them — and because Devanagari and Arabic letters are `\p{Lo}` like Han, so the
general-category route fails too.

**Finding 2 — the plausible-looking number.** Excluding Han alone left cmn reporting exactly **37**, which
looks like a real alphabet and is the entire **bopomofo** block. Bopomofo *is* an alphabet; it is also a
phonetic annotation system, and nobody spells an acronym in ㄅㄆㄇ. Chinese initialisms are spelled with LATIN
letter names. A source can be real, and an alphabet, and still not answer the question being asked.

**Finding 3 — the actual state is more useful than "absent".** cmn_list carries all 26 Latin letter names
**commented out**, with espeak's reason written above them ("This will make letter within English sentense
translated not correctly"). That is not an absence, it is a scoped objection to espeak's own sentence routing,
and it is the most actionable thing the report could say. Added as a `partial` verdict.

**Finding 4 — my own fix invented a fourth false positive, caught the same way.** Counting *any* commented
single-character entry made Burmese report 44 — which are commented-out WORD entries for single-character
particles (`//က $nounf`, `//က kə3`; က is a postposition as well as a letter). An abugida's single characters
are words too, exactly like Han. The discriminator is script: a run of LATIN letters inside a Chinese, Burmese
or Thai dictionary cannot be word entries, and it is the case that matters anyway.

**Fleet delta**, measured against the baseline worktree — three verdicts, all corrections:

```
cmn  ok   → part    26 Latin letter names, COMMENTED OUT
ko   part → NONE    Hangul syllable headwords were being counted
yue  ok   → NONE    Han headwords were being counted
     letter-names blocked: 94 → 96
```

The docs headline "letter names absent for 94 of 187" was therefore **understating** the gap by two, and
naming cmn and yue as sourced when neither is.

---

## Run 11 — 2026-08-03 — the hybrid fill, and the core defect FLEURS could never show

**Question.** cmn's artifact was FLEURS-only at **17/29 cells**, with `currency`, `signed-number`, `exponent`,
`arithmetic` and `ampersand` all EMPTY — the very rules Run 3 added. What does filling them say?

```
fetch --wiki zh --fill currency,exponent,arithmetic,ampersand,dotted,era-marker,ordinal-latin,iteration
  currency 11528 hits · arithmetic 129801 · ampersand 194608 · dotted 69591 · era-marker 2389
  ordinal-latin 47640 · exponent 1191 · iteration 175      → 160 passages
fetch --wiki zh --fill signed-number                        → 20 passages
```

`--fill negative` reported **`unknown cell: negative`** — the cell was renamed `signed-number` since cmn was
mined, which is its own finding: the artifact's `counts` block is keyed on names that no longer exist.

Merged with FLEURS: **17/29 → 32/35 covered.** Then the scan:

```
DROP currency ×2   索科羅縣的住戶收入中位數為$23,439，而家庭收入中位數則為$29,544。
DROP degree   ×1   2℃之间，总体分布趋势为…
DROP iteration ×2  …คนอ้วน ๆ（khon uan uan…       ← THAI, quoted in a Chinese article ABOUT Thai
REDUNDANT currency ×3   …判罰$40,000美元的罰款…      ← correctly downgraded, sign + word both present
```

**THE BOUNDARY GUARDS ASSUME SPACES BETWEEN WORDS.** Probing the two real ones:

```
38℃。      → 摄氏度 ✓        38℃很热     → ℃ DROPPED
$500。     → 美元 ✓          為$500，    → $ DROPPED
50 km²。   → 平方公里 ✓       50 km²的面积 → ² DROPPED
20 °C。    → 摄氏度 ✓        20°C很热    → reads the C as English *sˈiː*
```

The tier guards currency keys and unit abbreviations with `(?<![\p{L}\p{M}])…(?![\p{L}\p{M}])`, so that a
short key cannot bite into a word (Ukrainian `41 м'яч`, Dutch `Il-76s`). In Chinese there are no spaces, so a
unit or sign is **normally** flanked by Han — and the guard rejects the ordinary case. Only the
punctuation-adjacent instances ever worked, which is precisely why FLEURS could not show it: the cmn corpus
writes its units as words (平方公里) and its few signs sit next to punctuation. **The FLEURS corpus diff for
this change is 0/1999.**

Fixed with `unspacedScript: true` in `SymbolData` — opt-in, because the guard is load-bearing where words ARE
spaced. It narrows "any letter" to "a Latin letter", since a Han or kana neighbour is already a boundary by
script change. Extended to **ja**, which had the identical readings (`20℃は暑い`, `50 km²の`); **yue** and **th**
show them too but declare only `percent` through the tier, so theirs is a missing declaration, not a guard.

---

## Run 12 — 2026-08-03 — the flag exposed a second, older defect

`unspacedScript` on ja changed 15 corpus utterances. Fourteen were raw-Latin leaks becoming words
(`ˈʊkm` → キロメートル, `ˈɛm` → メートル, a bare `m` → ミリメートル). **One was a regression:**

```
802.11gとの互換性    "gee" → "GRAMS"
```

The one-letter unit key `g` matching a version suffix. And the bare `802.11g` was **already** reading as グラム
before the flag — so this is an older, wider defect that the flag merely widened. Measured over all 66 corpora,
because the Wi-Fi article was translated into nearly every one:

```
dotted VERSION glued to one letter (802.11n/a/b/g)   444
a DECIMAL glued to a one-letter unit                   4   (4.892m ×3, 3.50m ×1 — and those are period
                                                            THOUSANDS separators, not decimals)
```

So a `NOT_VERSION` guard now rejects a number-with-a-dot glued to exactly ONE trailing letter. **Both a
lookbehind and a lookahead are needed**: rejected at `802`, the engine simply retried from the fractional part
and matched `11g` alone. It is deliberately narrow — `12.5km` (two-letter key), `12.5 g` (not glued) and
`1,000 km` all still read; the measured cost is those 4 instances.

It fixes `802.11g` in **ten languages** that were reading "grams": ar bn cmn el es fr id ja pt ur. Seven now
read the letter name; es, pt and id emit a bare `ɡ` because they have no letter-name table — the
`letter-names` gap this loop-back already counted at 96 of 187. Both beat *confidently wrong*.

This is why `version-dot` is an inventory cell: it had no protection in core at all.

---

## What this run says about #586

**Most of the findings are in the tooling and core, not the language.** `attest.ts` structurally unable to
answer for a quarter of the world's scripts; `review.ts` blind to the ampersand while its own header described
the blindness; `sources.ts` counting Han headwords, then bopomofo, then Burmese particles as letter names; core
`magAlt` assuming every orthography spaces its magnitudes. The language fix itself — twelve sign readings — was
the smaller half of the work.

That is the case for having picked en, cmn and hi: they are the highest-traffic languages, and they are also
the ones whose scripts and corpora stress the tooling in different directions. en validates (clean on all 13
widened classes — a widened gate that finds nothing in the reference language is one you can trust); cmn breaks
every assumption that a word has boundaries and a magnitude has a space; hi is next.

Three habits earned their keep, all of them cheap:

1. **Measure the blast radius with the cheapest instrument that settles it.** Run 9's grep replaced 84 corpus
   emits and gave a *stronger* answer — provable zero on 64 corpora, not "no diff observed".
2. **Distrust a plausible number as much as an absurd one.** 3,836 letters is obviously wrong; 37 is not, and
   both were the same defect.
3. **Re-run the fleet after fixing a gate.** Runs 8 and 10 each found something the single-language run could
   not, and Run 10's own fix introduced a defect that only the fleet re-run caught.

The recurring one, restated: a gate finding is a diagnosis, not a prescription. Run 6 is the case where the
gate contradicted my reasoning and the gate was right; Run 10 finding 4 is the case where my fix to a gate was
itself wrong in the way the gate had been.
