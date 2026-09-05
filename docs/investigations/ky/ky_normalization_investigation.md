# Kyrgyz (ky) normalization — investigation log

Chronological. Each run records the command, the question it was meant to answer, the RAW finding, and what
that implies for the next step. Negative results are kept deliberately.

Corpus artifact: `tools/corpus/mined/ky.jsonc` — ky.wikipedia dump, 233,521 paragraphs, 256 hard + 200 sample
segments retained. `FLEURS` is unset in this environment, so every corpus-scale gate runs on `mined:ky`.

## Run 1 — 2026-08-14 13:55 — baseline emitted BEFORE any edit

```
npx tsx tools/normalization/corpus-diff.ts emit --lang ky --corpus mined:ky --out /tmp/.../ky.before
  → emitted 455 utterances
```

Question: capture the pre-change reading of the whole artifact while the tree is still pristine (fan-out rule
2 — no `git stash`, ever). Done first, before reading anything.

## Run 2 — 2026-08-14 13:58 — what does the engine do today?

`src/languages/kyrgyz/kyrgyz.ts` has `TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.?!,;:…—])/gu` and nothing else: every Latin
run, every sign, and every non-clause mark is **silently dropped**, and a digit run is always a CARDINAL.

```
"1991-жылы"  → miŋ toʁuz d͡ʒyz toqson bir d͡ʒɯɫɯ      cardinal where the hyphen marks an ORDINAL
"19-кылымда" → on toʁuz qɯɫɯmdɑ                       "nineteen century-in"
"50%"        → elyː                                    % DROPPED
"2,5"        → eki , beʃ                               decimal comma read as a CLAUSE PAUSE
"1 000 000"  → bir nøl nøl                             a million reads "one zero zero"
"150дөн"     → d͡ʒyz elyː døn                          glued case suffix read as a bare non-word
"5 км"       → beʃ km                                  RAWMARK — raw Latin in the IPA
"20 °C"      → d͡ʒɯjɯrmɑ sˈiː                          °C → the ENGLISH letter name "see"
"-38°С"      → otuz seɡiz s                            Cyrillic С → bare [s]; the minus is gone
"12:30"      → on eki , otuz                           colon → a pause
"1/2"        → bir eki                                 "one two"
"$100"       → d͡ʒyz                                    $ dropped
"США"        → sʃɑ                                     initialism, no vowel (trap 1)
"802.11n"    → seɡiz d͡ʒyz eki . on bir ˈɛn             dotted version + English letter name
"3-4"        → yt͡ʃ tørt                                range with no joiner
```

Implication: ky has NO normalization layer at all and essentially every cell is defective. Prioritise by
corpus count.

## Run 3 — 2026-08-14 14:00 — TRAP 14/15: does Kyrgyz write the case suffix after the digits?

The task brief says the playbook PREDICTS this for the Turkic corpora and that it is therefore a hypothesis to
test, not a fact to assume. Extracted the artifact's retained text (256 hard + 200 sample) to plain files and
grepped for the MORPHEME, both glued and hyphenated (trap 15 — count both shapes).

```
grep -oE '[0-9]+-[а-яёңөүА-ЯЁҢӨҮ]+' all.txt | wc -l   → 354   (hyphenated)
grep -oE '[0-9]+[а-яёңөүА-ЯЁҢӨҮ]+'  all.txt | wc -l   →  44   (glued, no hyphen)
```

Per tier (the sample tier is the representative one — this artifact is dump-sourced, so its stride IS the
language's distribution):

| shape | hard (256) | **sample (200)** |
|---|---:|---:|
| `\d+-<Cyrillic>` | 243 | **101** |
| `\d+<Cyrillic>` glued | 27 | **10** |
| `\d,\d` decimal | 202 | 8 |
| `\d ?[-–] ?\d` range | 106 | 26 |
| `%` | 33 | 2 |
| `\d{1,2}:\d{2}` | 18 | **0** |
| Roman numeral | 30 | 2 |

RAW: **101 of 200 representative paragraphs contain a hyphen-suffixed numeral.** That is half the corpus.
Trap 14's prediction is CONFIRMED for Kyrgyz, and the dominant form is the HYPHENATED one, not the glued one
that Azerbaijani/Kazakh were measured on.

Sample-tier head-noun distribution after `\d+-`:

```
25 N-жылы   11 N-жыл   10 N-ж   9 N-жылдын   7 N-жылдан   4 N-январда   3 N-январына
3 N-жылдары  3 N-декабрь  2 N-октябрда  2 N-кылымдын  2 N-кылымдагы  1 N-кылымда
1 N-күнү  1 N-майда  1 N-июнда  1 N-жж  1 N-б  1 N-августта  …
```

So the shape is `digits + HYPHEN + noun`, and the noun is overwhelmingly **жыл** (year), a MONTH name, or
**кылым** (century). In Kyrgyz orthography that hyphen is the abbreviated ORDINAL suffix — `19-кылым` is "the
19th century", never "nineteen century". The engine reads all 101 as cardinals.

Glued shapes (44 total): `150дөн`, `1000ге`, `97ден`, `85тен`, `40тан`, `20дан`, `25ге`, `16дан`, `11де`,
`1923гө`, `3дан`, `59дан`, `21ден`, `65тен`, `80ден`, `530дай`. These are ablative/dative/locative case
suffixes glued straight onto the digits — the Azerbaijani shape exactly, and vowel harmony means the suffix's
FORM depends on the spoken numeral (`1000ге` is *миңге*, `150дөн` is *жүз элүүдөн*), which no downstream tier
can do because at that point there is no word.

Implication: the ordinal-hyphen rule is THE rule for this language, and the glued case suffix is second. Both
must convert the operand to WORDS inside the rule (trap 14's fix shape).

## Run 4 — 2026-08-14 14:02 — does the corpus attest the ordinal series?

```
grep -oE '[а-яёңөү]+(ынчы|инчи|унчу|үнчү|нчы|нчи|нчу|нчү)[а-яёңөү]*' all.txt
  → биринчи ×12, экинчи ×11, үчүнчү ×4, сегизинчи ×1, төртүнчүлүк ×1, экинчиси/экинчилери/…
```

Five distinct cardinals attested with their ordinal suffix, and they pin the harmony rule exactly:
бир→бир**инчи** (last vowel и), эки→эки**нчи** (vowel-final), үч→үч**үнчү** (ү), төрт→төрт**үнчү** (ө),
сегиз→сегиз**инчи** (и). Four-way harmony on the last vowel of the stem, with the linking vowel dropped after
a vowel-final stem. That is a COMPOSITION, not a table (trap 8/13: prefer composing from the morphology).

## Run 5 — 2026-08-14 14:05 — sourcing: what does this repo actually have for ky?

```
npx tsx tools/normalization/sources.ts --lang ky            → "espeak does not ship this language at all"
ESPEAK_NG=… npx tsx tools/normalization/sources.ts --lang ky → letter-names: espeak 36 letters — WIREABLE
```

RAW, and a finding about the instrument: `sources.ts` reported **NOT SHIPPED** only because `$ESPEAK_NG` was
unset in this shell. `<espeak-ng checkout>/dictsource/ky_list` exists and carries 187 lines. This
is trap 57's shape — an instrument failing toward a confident negative. Always set the env before believing
a `[NONE]`.

`ky_list` supplies, in ORTHOGRAPHY-recoverable form:

```
% pratsent      → процент          $ d'oLar   → доллар      = barab'ar → барабар
+ qoS'u:        → кошуу            № nom'er   → номер       × kObOjty: → көбөйтүү
_dpt _:jan'a_:  → жана  ⚠ "and"    _- sIzIqtS'a → сызыкча
км kiL,ometr → километр   см → сантиметр   кг → килограмм   мм → миллиметр   мл → миллилитр
36 letter names: а бе ве ге де е ё же зе и ий ка эл эм эн ың о ө пе эр эс те у ү эф ха це че ша ща ы э ю я
```

## Run 6 — 2026-08-14 14:08 — sense-read every candidate against ky's OWN corpus

Attestation is necessary, never sufficient — read the sense (the Fula/`amadola` rule).

```
пайыз   ×3   "20дан кем эмес адам иштеген уюм майыптарга 5 ПАЙЫЗДЫК квота"   digit-adjacent, = percent ✓
             "өзара пайыздуу жана пайызсыз болуп бөлүнөт"                     = interest (same lexeme)
процент ×0   — espeak's word is ABSENT from ky's own corpus
сом     ×9   "8591,6 млн сомду", "23 000 сомдон 28 000 сомго чейин"           the currency ✓
доллар  ×7   "$…" contexts + inflected forms                                   ✓
градус  ×2   "-3,5 градус", "11 градуска чейин"                               digit-adjacent ✓
бүтүн   ×3   "бир БҮТҮН илим" (one whole science), "бүтүн камтуусу"           ⚠ the ADJECTIVE, not a decimal
метр ×13, гектар ×7, литр ×2                                                   ✓
```

`бүтүн` is the trap-worth-recording one: it IS the Turkic decimal reading ("бир бүтүн беш ондон") and every
corpus instance is the plain adjective "whole". A count is a lead, never a finding. Corpus silence about how a
SYMBOL is spoken is the weakest evidence there is (the Igbo lesson), so this needs an independent probe
before it is either shipped or refused.

## Run 7 — 2026-08-14 14:15 — the decimal reading, and the probe that settled it

Corpus silence about `бүтүн` needed an independent check (Run 6). Ran the phrase probe:

```
npx tsx tools/normalization/attest.ts --lang ky --words "бүтүн ондон","ондон бир","бүтүн жүздөн","үтүр","ондук бөлчөк","жүздөн"
  бүтүн ондон    1  /1   attested        бүтүн жүздөн   0 /0   absent
  ондон бир     10  /10  attested        үтүр          12 /11  attested
  ондук бөлчөк   7  /5   attested        жүздөн        16 /15  attested
```

RAW — the single `бүтүн ондон` hit is a statement about how a decimal is READ, in an article on repeating
decimals:

> «Тиешелүү түрдө 2 бүтүн мезгилинде 71; **1 бүтүн ондон үч** мезгилинде 18 **деп окулат**.
> Мезгили үтүрдөн кийин башталса…»

*деп окулат* = "is read as", and `1 бүтүн ондон үч` glosses **1,3**. So the construction is
`<integer> бүтүн <denominator-ABLATIVE> <numerator>`, and both denominators are separately attested in that
exact slot: `ондон бир үлүш` (a one-tenth share, ×10/10) and, from the пайыз article, `сандын жүздөн бир
үлүшү`. Nothing is invented — the ablative comes from the same `suffix()` the ordinal rule uses.

Implication: the decimal is fully sourced, and the SAME construction is the fraction reading (`3/4` =
*төрттөн үч*), so one piece of machinery does both. Decimal-place distribution over the retained text:
**177 one-place, 23 two-place, 8 three-place**, so ондон + жүздөн covers 96% and the ambiguous three-digit
group can be refused separately.

## Run 8 — 2026-08-14 14:20 — the ordinal composition validated OUT OF SAMPLE

The harmony rule was fitted on the five ordinals the mined corpus attests. Probed the fifteen it PREDICTS:

```
онунчу ×17  жыйырманчы ×20  отузунчу ×16  кыркынчы ×8  элүүнчү ×12  алтымышынчы ×6  жетимишинчи ×4
сексенинчи ×3  токсонунчу ×2  жүзүнчү ×8  миңинчи ×16  алтынчы ×22  жетинчи ×25  бешинчи ×22  тогузунчу ×18
```

**20/20 attested.** Deliberately not the Odia calibration trap: the answers were NOT in the set the rule was
fitted on. Read the examples for sense — `алтынчы` is "Ишемби — аптанын алтынчы күнү" (Saturday is the sixth
day), not a goldsmith; `жетинчи` is "жылдын жетинчи айы" (the seventh month).

⚠ AND THE PROBE ANSWERED A QUESTION IT WAS NOT ASKED. `токсонунчу`'s second example is ky.wikipedia's
ORTHOGRAPHY article, §49, listing how numerals are written out:

> «айрым-айрым жазылат: он бир, жүз элүү эки, **бир миң тогуз жүз токсонунчу**, он беш, жыйырма үч, он эки,
> кырк бешинчи.»

Two facts in one sentence: the ordinal suffix goes on the LAST WORD only, and the thousand-multiplier `бир`
IS spelled while the hundred-multiplier is not (`жүз элүү эки`, not *бир жүз*). Corroborated independently by
the year articles — «1989 (бир миң тогуз жүз сексен тогузунчу) жыл», «1914 (бир миң тогуз жүз он төртүнчү)
жыл» — which ALSO settle that a bare year is read as an ORDINAL.

`kyrgyzNumberWords` omitted `бир` before миң, so every number ≥ 1000 in the language read one word short.
That is a defect in the ENGINE, not in this layer (playbook step 3), and it lives in Kyrgyz's own file, so it
was fixed there. `test/kyrgyz.test.ts` had been PINNING it (`expect(ky.text("1000")).toBe("miŋ")`) — trap 5,
corrected rather than preserved.

## Run 9 — 2026-08-14 14:40 — first corpus diff: 106 → 26 DROP, and three defects only the diff could see

```
npx tsx tools/normalization/corpus-diff.ts emit/compare --lang ky --corpus mined:ky
  changed 323/455 (71.0%)   DIGIT 0  SLOT-GAP 0  RAWMARK 0  ZERO-WIDTH 0  RAW-CAPS 0   DROP 106 → 26
```

Read all 323 changes. Three real defects, none of which any probe had surfaced:

1. **`1945 г.` read as *бир миң тогуз жүз кырк беш ГРАММ*.** The declared one-letter unit key `г` claimed a
   RUSSIAN year abbreviation. Measured: digit-adjacent `г` is three instances — `40 г.` (a mouse's weight, a
   real gram), `3,037 г/см3` (a rate the tier declines whole anyway) and this year. One real reading against
   one confidently-wrong quantity. **Withdrew `г`, and `т` with it** (digit-adjacent ×0, and `т. ж.` /
   `т. п-нан` / `2-том` are live dotted abbreviations in this corpus). Trap 46 exactly.
2. **`2,8 мден 15 мге чейин` — the first unit unclaimed.** The unit-plus-suffix rule's operand was `(\d+)`;
   the leading guard rejected the match at `2`, the engine restarted at `8`, and `(?<![\d.,])` then rejected
   THAT because a comma precedes. Trap 52 from the other side — anchor the whole operand, not one edge.
3. **`43°16′ жана` → *…он алты минутжана*.** The arc-minute rule's trailing `\s?` sat OUTSIDE the optional
   arc-second group, so it ate the following space and fused two words. Invisible to every leak class: two
   real words joined is not a leak, a raw mark or a drop.

## Run 10 — 2026-08-14 14:45 — trap 15, and the measurement forbids the rule

Trap 15 says grep for the MORPHEME, not the shape, and count the spaced form beside the glued one.

```
grep -oE '[0-9] (дан|ден|га|ге|да|де|дай|…)([^а-яёңөү]|$)' all.txt   → 6 hits
```

RAW: **five of the six are `га` and every one is the UNIT HECTARE** — `25060 га`, `6000 га`,
`1 476 121,6 га`, `2 780 453 га` — leaving exactly ONE genuine detached suffix, `2012 ден бери`.

So for Kyrgyz the spaced alternation is not merely narrower than the glued one (trap 9), it is a trap:
admitting `digits + space + short token` would break five hectares to fix one ablative, because `га` is
simultaneously a dative suffix and a unit abbreviation with nothing but the space between them. Oromo's
version of this went the other way and was right to; ky's count says the opposite. Declined, recorded.

## Run 11 — 2026-08-14 14:47 — the minus: a refusal re-measured, and it broke

The first pass refused the minus on the SHAPE — 285 dash-before-digit instances in 456 segments, and the
obvious ones are ranges (`2750-3800 метр`, `25-35 см`, `6-16 °C`). Trap 24 says to ask whether a NARROWER
rule is available before accepting a refusal, including your own. Tested one:

> a dash NOT preceded by a digit, `°`, a prime or a letter, whose number is followed by a DEGREE mark
> — plus a second arm for the first endpoint of an ellipsis span (`-5...-8 °C`)

```
armA 14   armB 4   →  18 hits, 0 FALSE POSITIVES over all 456 segments
```

Every hit a genuine negative temperature: `-38°С`, `−10 °Cга`, `-18°Сден`, `-3°Сге`, `-50°Сге`, `-1°Сден`,
`—5°Сден`, `—40°С`, `-23...-29 °C`, `-32...-36 °C`, `-52...-54 °C`. Every range rejected by the
digit-before test, every coordinate by the prime test. **The refusal was wrong and the corpus said so in one
grep.** Before the rule, `-38°С` read *отуз сегиз градус* — thirty-eight degrees ABOVE zero, i.e. the sign
silently INVERTED, which is exactly why the playbook says a plus and a minus never share an argument.

The word is ky.wikipedia's own and it NAMES the sign: «Минус (латынча minus – кем) – кемитүү амалын,
ошондой эле терс санды…» and «белгилер [+ (плюс), — (минус), . (чекит)]». espeak's `ky_list` carries no minus
word at all (its `_-` is `сызыкча`, the hyphen), so the wiki is the only source. The PLUS stays refused: all
20 instances are temperatures where the sign is redundant with the degree word, or UTC offsets.

⚠ The rule had to go ABOVE the degree step — both arms look ahead for `°`, and once the degree rule has
rewritten it to `градус` there is nothing to look at (trap 39, a guard's evidence has a lifetime).

## Run 12 — 2026-08-14 14:50 — a gate reporting nine grammatical tags as vocabulary

`review.ts --lang ky` printed:

```
[ ?? ] sourcing   abl — in NO source …, dat — in NO source …, loc — …, acc — …, gen — …, equ — …, poss — …
```

RAW: those are not words, they are this layer's own `Case` tags. `localDeclarations` hops from the percent
rule into every function it calls and treats each string literal it finds as a word to attest — so a
`type Case = "abl" | "dat" | …` with a switch on those literals produced nine false reports, and buried
пайыз / доллар / евро, the three words the line exists to check. Changed the union to numbers behind unquoted
object keys (invisible to that extractor) in MY file rather than touching the shared tool; the line now reads
`[ ok ] sourcing — all 3 high-traffic words attested`. Trap 57 from the other side: a gate that cries wolf is
a gate that gets switched off.

## Run 13 — 2026-08-14 14:53 — final gate sweep

```
npx vitest run                    245 files, 4227 passed, 5 skipped   (languageCatalogue regenerated)
npx tsc --noEmit                  clean
npm run check:package             ok — 983 files
npx tsx tools/referee-eval/eval.ts ky
    folded backbone 805/888 (90.7%)   symbol accuracy 98.2%   — BYTE-IDENTICAL to the pre-change run,
    which is the expected result: the referee is a WORD LIST with no digits, signs or abbreviations in it,
    so a normalization layer cannot move it. A moved referee here would have meant a g2p regression.
corpus-diff                       changed 323/455 (71.0%)
    DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 (all unchanged) · DROP 106 → 24
mine.ts scan                      DROP minus ×9 · degree ×1 · percent ×1 · exponent ×1
                                  ACCEPTED-CLASS math-sign ×15
review.ts                         1 FAILING — the artifact scan, deliberately (see below)
```

**What `review.ts` still reports red, and why it is correct to.** The artifact scan's `DROP minus ×9` is the
RANGE dashes, and the range joiner is refused: Kyrgyz's `чейин` is a POSTPOSITION demanding the ablative on
one operand and the dative on the other, and in three of the four corpus attestations that dative sits on the
FOLLOWING UNIT (`16дан 19 ммге чейин`), not on the number a rule would have. That is a real gap and it is
left visible rather than entered per-instance. The other three are read and are not defects: `degree ×1` is
`1 e°+` in a nuclear-reaction formula (a positron, not a temperature); `percent ×1` is a bare `(%)` used as a
column header, which the tier correctly declines because it is being NAMED, not read; `exponent ×1` is
`2 млн 724,9 мин км²`, where `мин` is a TYPO for `миң` and the magnitude hop therefore loses the unit's
number-adjacency — a genuine lost reading whose only "fix" would be putting a misspelling into the magnitude
list.
