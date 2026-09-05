# Luo / Dholuo (luo) — text-normalization investigation

Western Nilotic, Kenya + Tanzania, ~4.2M speakers. The engine (`src/languages/luo/`) already existed —
greedy g2p + a bespoke decimal number composer — with **no `normalize.ts`**. This log is the round that
added one.

⚠ **THE CORPUS IS FLEURS AND THERE IS NO MINED ARTIFACT.** `mine.ts scan` is unavailable and
`review.ts --lang luo` reports `artifact tracked … missing` by construction. Every count below was taken by
hand over the deduplicated column 3 of
`/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/luo_ke/{train,dev,test}.tsv` — **2,742 rows →
1,660 unique cased utterances** (FLEURS repeats each sentence per speaker).

---

## Run 1 — 2026-08-16 — baseline: DROP=11, every leak class 0, and the referee is a 17-word set

```
npx tsx tools/normalization/corpus-diff.ts emit --lang luo --corpus luo_ke --out /tmp/luo-base.json
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/luo-base.json --after /tmp/luo-base.json
npx tsx tools/referee-eval/eval.ts luo
```

**Question.** What does the layer inherit?

**Raw finding.**

```
emitted 1660 utterances
DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · ZERO-WIDTH 0 · RAW-CAPS 0 · DROP 11 · THROW 0
referee: raw exact 1/17 (5.9%) · folded backbone 17/17 (100.0%) · symbol accuracy 100.0%
```

**Implication.** DROP=11 against the 63–130 that recent wiki-sourced rounds opened at, and that is a fact
about FLEURS (read-aloud news, numerically sparse), **not** about how finished the language is. DROP counts
symbol-drop classes only; it is blind to a grouping comma read as a sentence break, which Run 3 shows is by
far the largest defect here. The referee is a 17-word en.wiktionary set with no second source, so
`referee-eval` can only be a non-regression gate.

---

## Run 2 — 2026-08-16 — the corpus's whole non-alphanumeric inventory, and what each mark is

**Question.** Which marks occur at all, and what is each one doing? (Print every instance with context
before writing any rule — trap 62.)

**Raw finding.** Whole-corpus character census over the 1,660 unique utterances:

```
,  2120   .  1855   '  1250   -  285   ( 133   ) 132   “ 118   ” 117   :  35   ;  28
’   10    ? 10     ‘  7     á 5   ! 5   $ 4   / 4   ¥ 3   ó 3   ° 2   ] 2   [ 2   + 2   % 2
ü 1   Ü 1   ú 1   õ 1   Õ 1   ñ 1   İ 1   £ 1   — 1   – 1   ~ 1   _ 1   & 1
```

**`= < > × ÷ ± ² ³` are ×0 — every one of them, read individually.** So five of the eight signs the brief
asks about simply do not occur, and the two that do (`+ %`) occur twice each.

Class by class, every instance read:

| class | count | what it is |
|---|---:|---|
| `,` between digits | 35 | **grouping**, three digits every time (`9,000`, `100,000`, `6,387`, `5,000,000`) |
| `.` between digits | 21 | **decimal** (`1.5`, `12.8`, `4.2`, `14.7`) + `802.11` ×5 + two sports-time tails |
| `:` | 35 | 21 are ordinary rhetorical colons; **14 sit between digits** — see Run 4 |
| `-` between digits | 17 | ranges, year spans, scores, one season — **never a minus** |
| ` - ` (spaced) | 19 | 18 are PARENTHETICAL CLAUSE DASHES; 1 is a year range `(1418 - 1450)` |
| `—` U+2014 | 1 | a parenthetical dash (`nochakore chon — pichni mag jokier`) |
| `–` U+2013 | 1 | a NAME joiner (`White Sea–Baltic Canal`) — not a range |
| `%` | 2 | `oriwo 3% mar pinyno`, `Nadal ne oyudo point 88% e tugo` |
| `$` | 4 | see Run 5 |
| `¥` | 3 | `nengo mar kind ¥2,500 kod ¥130,000 … ¥7,000` |
| `£` | 1 | `nengo molandi mar tara £27` |
| `°` | 2 | `+30°C` and `35° Ugwe` (35° West) |
| `+` | 2 | `+30°C` and `(UTC+1)` |
| `&` | 1 | `ute nindo mag B&Bs` |
| `~` | 1 | `Franc mar Kongo ~500` (approximation) |
| `/` | 4 | `oro/chieng'` — a word-pair separator, never a fraction or a rate |
| era | 3 | `BCE` ×2, `KK` ×1 (`higni mag 5000 KK!`) |
| dotted abbrev | 2 lines | `Jr.` ×2, `N. Wayne Hale` ×1 — no multi-dot abbreviation at all |

**Implication.** The three-digit test is decisive and unanimous: **the comma groups, the dot decimates,
and neither ever does the other job.** No European convention appears anywhere. Also note what is NOT
here — no `²`, no `³`, no `×`, no `=`, no `<`, no `>`, no `÷`, no `±`, and **no minus**.

⚠ **The confusable hunt came back EMPTY, which is itself the finding.** Three recent rounds each found a
confusable in the degree slot. Here both degree signs are `°` U+00B0 (`0x30 0xb0 0x43 0x2e` for `+30°C`)
and the scale letter is ASCII `C` U+0043 — no `º` U+00BA, no `˚` U+02DA, no `℃`, no Cyrillic `С`. **The one
confusable-shaped thing in the corpus is a UNIT, not a degree:** the gigahertz is written `Ghz`
(`22.4Ghz`, `5.0Ghz`) — capital G, *lowercase* H — so a rule keyed on the SI `GHz` matches neither.

---

## Run 3 — 2026-08-16 — probe the engine: the grouping comma is a SENTENCE BREAK and BCE is a WORD

```
npx tsx <scratch>/luo/probe1.mts     # 44 attested strings through phonemize(…, "luo")
```

**Question.** What does the engine actually produce on the shapes Run 2 found?

**Raw finding** (excerpts, verbatim):

```
"nengo mar kind ¥2,500 kod ¥130,000"
   → neᵑɡo maɾ kiⁿd aɾijo , mja abit͡ʃ kod mja at͡ʃjel ɡi pjeɾo adek , nono
      … "two , five hundred" and "one hundred thirty , ZERO" — a clause break inside every grouped number

"kilomita 12.8 kata mail 8"
   → kilomita apaɾ ɡaɾijo . aboɾo kata mail aboɾo        ← a FULL STOP inside the number

"liet medorega nyaka rang'iny moloyo +30°C."
   → ljet medoɾeɡa ɲaka ɾaŋiɲ molojo pjeɾo adek t͡ʃ .    ← ° and + gone; the SCALE LETTER C
                                                            read through the Dholuo ⟨c⟩ → t͡ʃ rule

"senchari mar 10 BCE, kendo"      → sent͡ʃaɾi maɾ apaɾ bt͡ʃe , keⁿdo      ← BCE is a pronounceable WORD
"e saa 9:30 okinyi"               → e saa ot͡ʃiko , pjeɾo adek okiɲi     ← a pause inside the clock
"jolweny dhod Qing (1644-1912)"   → … ɡaŋwen elfu at͡ʃjel …              ← two years fused, no boundary
"(0230 UTC)"                      → … utt͡ʃ                              ← UTC read as the word *utch*
"gi 802.11a, 802.11b"             → mja aboɾo ɡaɾijo . apaɾ ɡat͡ʃjel a  ← a full stop inside a designation
"nochakore chon — pichni"         → not͡ʃakoɾe t͡ʃon pit͡ʃni              ← the em-dash pause VANISHES
"Kido mar 35mm … 36mm e lach"     → … mm … mm …                          ← a bare nasal cluster in the IPA
"mar 35 mm negative (3136 mm2"    → … mm aɾijo                           ← trap 53, pre-existing
```

**Implication.** The defect ranking is not the DROP ranking at all:

1. **35 grouped numbers each read as two numbers with a clause pause, and a `,000` tail as *nono* (zero).**
   Invisible to DROP. Biggest class in the corpus.
2. **21 decimals read with a full stop mid-number.**
3. 14 colon figures, 17 ranges, 19 spaced dashes — pauses in the wrong place or missing.
4. `BCE` → *bt͡ʃe*, `UTC` → *utt͡ʃ*, `°C`'s `C` → *t͡ʃ*: trap 56, defects that produce a READING.

---

## Run 4 — 2026-08-16 — the colon is a clock ELEVEN times out of fourteen, and the writer supplies `saa`

```
python3 ctx.py '\d{1,2}:\d{1,2}[\d.,:]*'
```

**Question.** How many of the 35 colons are actually clocks? (Recent rounds found *none*.)

**Raw finding.** 14 colon-flanked figures; 21 colons are ordinary rhetorical colons.

```
saa 8:30 odhiambo · saa 8:46 · saa 11:35 otieno · Kar saa 11:20 · Kar saa 11:29 · Kar saa 1:15
saa 11:00 otieno · kar saa 9:30 okinyi (0230 UTC) · saa 10:08 otieno       ← 9 clocks, each after `saa`
E kind seche mag 10:00-11:00 otieno MDT                                    ← a clock RANGE
e saa 4:41.30,2:11.60 minutes mos · gi dakika 1:09.02 mos                   ← 2 SPORTS TIMES
moyudo 2:2 (digri man piny, clas mar ariyo)                                ← NOT a clock at all
```

**Implication.** Eleven clocks — the highest-yield colon class this sweep has seen in a while — and every
one of them is introduced by the writer's own `saa` ("hour"), so **the colon has only to be spent; no word
is emitted.** The fleet's standard guard `([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])` takes all eleven and
declines all three non-clocks for three independent reasons: `2:2` fails `[0-5]\d`, and both sports times
fail the trailing `(?![\d:.,])` on their `.`.

⚠ **AND `2:2` PAID FOR ITSELF TWICE.** Its gloss is `digri man piny, clas mar ariyo` — a British
*lower second-class* degree. So the corpus's ONLY instance of `digri` is the ACADEMIC degree, which is
exactly the `ki digirii ×4` trap the playbook names. That single line is what refuses the temperature word.

⚠ **NO CLOCK CONVERSION IS ATTEMPTED.** Dholuo, like Swahili, has a six-hour-offset traditional clock. The
corpus writes European digits and nothing in it says whether the reader converted. Spending the colon
leaves that question untouched; emitting an hour word would not.

---

## Run 5 — 2026-08-16 — the contact-language question, answered: **0 of 13 Swahili forms, and the loans are ENGLISH-shaped**

**Question.** Dholuo is in daily contact with English and Swahili, and `sw` is already treated. Does the
Swahili layer transfer? (Trap 55: the neighbour is a hypothesis.)

**Raw finding.** Every measure/quantity noun in the corpus, counted whole-word, case-folded:

```
ATTESTED IN luo_ke                      SWAHILI'S OWN FORM, IN luo_ke
  saa       ×58   (shared)                maili      ×0        ← luo writes  mail ×16 / mails ×7
  tara      ×23   million (NATIVE)        pauni      ×0        ← luo writes  paund ×5
  kilomita  ×23   (shared)                aunsi      ×0        ← luo writes  ounce ×1
  senchari  ×22   century                 galoni     ×0        ← luo writes  galons ×1
  gana      ×17   thousand (NATIVE)       mraba      ×0        ← luo writes  squeya ×1
  mail      ×16 / mails ×7                asilimia   ×0        ← luo writes  NOTHING (see Run 6)
  mita      ×13   (shared)                milioni    ×0        ← luo writes  milion ×2
  dakika    ×13   (shared)                bilioni    ×0        ← luo writes  bilion ×3
  dola      ×6                            karne      ×0
  paund     ×5                            elfu       ×0        ← and see the backlog
  bilion    ×3 · milion ×2                hadi       ×0        ← luo writes  nyaka (Run 7)
  yuro      ×1 · squeya ×1 · ounce ×1      kwa       ×0        ← luo writes  kuom / e
  galons    ×1 · nukta ×1                  sifuri    ×0
```

**Implication — and this is the round's headline.** **Thirteen of the fourteen Swahili words the `sw` layer
either emits or is built on score ZERO in the Luo corpus.** The Swahili layer's `hadi` (range), `asilimia`
(percent), `mraba` (square), `nyuzi joto` / `Selsiasi` (degrees) and `plas` / `hasi` (signs) would every
one of them have been a confidently wrong reading here. A layer ported from the neighbour would have shipped
six wrong words.

**And the shape of the divergence is the useful part.** Where Swahili and Dholuo agree the word is a
long-settled Swahili-mediated loan (`saa`, `dakika`, `kilomita`, `mita`); **where they differ, Dholuo takes
the ENGLISH word directly** — `mail`, `paund`, `ounce`, `galons`, `squeya`, `senchari`, `milion`, `bilion`.
The clincher is `mails 3,980`: an ENGLISH plural `-s` on a borrowed noun, which no Swahili noun class does.

**The one exception is `nukta`,** which is in both — and it is the one Swahili word this layer emits
(Run 6). So the sibling was right 1 time in 14, which is precisely why copying it is dangerous.

⚠ **AND THE MEASURE NOUN PRECEDES ITS NUMERAL, ALWAYS.** `kilomita 1,600 (mail 1,000)`, `mita 40`,
`dola bilion $2.3`, `paund 17`, `saa 9:30`, `dakika 1:09.02`, `galons tara 23`, `higni tara ariyo` (=
"years million two", 2 million years). This is trap 47 reason 2 — the shared tier can only POSTPOSE unless
told otherwise — and it is why the currency rule below is local.

---

## Run 6 — 2026-08-16 — sourcing: espeak ships no Luo, and **there is no Dholuo Wikipedia**

```
ESPEAK_NG=/home/chris/Programming/espeak-ng npx tsx tools/normalization/sources.ts --lang luo
npx tsx tools/normalization/attest.ts --lang luo --words nukta,nyaka,dola,paund,…
```

**Question.** What sources exist for the words this layer would need?

**Raw finding.**

```
[NONE] letter-names     espeak does not ship this language at all
[NONE] decimal-point    no _dpt, no _., no manifest word
[NONE] scale-names      ° occurs, neither scale name in corpus/referee/espeak
                        — degree-adjacent corpus tokens: Ugwe×2 ugwe×2      (that is WEST, not a scale)
[part] era-phrase       a Christ-stem exists somewhere — CHECK it is a bare noun
[chk?] percent / currency / unit / minus / ampersand

$ npx tsx tools/normalization/attest.ts --lang luo --words …
  luo.wikipedia.org does not respond as a wiki — a negative from here is NOT evidence.
```

`luo.wikipedia.org` does not exist. The project is at Incubator (`Wp/luo`), and a **control probe** on the
commonest words in the language shows how small it is:

```
piny  10 articles    dhano 4    higa 5    nyaka 3        ← the control
dola   0             nukta 0    pasent 0  asilimia 0   digri 0     ← every candidate
```

**Implication.** ⚠ **This is trap 51 with the floor removed entirely.** The wiki route is not thin here, it
is *absent*: a language whose commonest noun returns ten pages cannot refute anything, so every one of
those zeros is UNKNOWN, not negative. Luo's whole haystack is **the FLEURS corpus + a 17-word referee + the
engine's own number data.** Nothing else. That is the constraint every refusal below is priced against.

**What that leaves sourceable, from the corpus alone, sense read:**

- **`nukta` — the decimal point. ×1, and the corpus GLOSSES ITS OWN NOTATION** (trap 45's shape):
  `En grub chula 15 moriedo, chiegni kilomita squeya tara ariyo NUKTA ariyo ei nam.` — "about 2**.**2
  million square kilometres". There is no second reading of *tara ariyo nukta ariyo*. One instance is thin
  and is the only instance available; it is shipped with the count stated. The same sentence supplies
  `squeya` (the square word) and confirms the noun-first order.
- **`nyaka` — the range joiner. ×6 between numerals**, in both directions: `1977 nyaka 1981`,
  `jii 10 nyaka 15`, `mails 100 nyaka 200`, `mita ma dirom 100 nyaka 250 (fut 328 nyaka fut 820)`,
  `3 nyaka 5 kuom nyithindo`, and — decisively for the scores — `okang' achiel mar locho, 21 nyaka 20`.
- **`dola` ×6 and `paund` ×2** in the monetary sense (`dola bilion $2.3`, `omenda mag dola tara pieche`;
  `Paund mar Britain`, `paund achiel mar Britain (GBP)`). ⚠ `paund` is ALSO the weight ×3
  (`ratil maromo paund 17`) — harmless, because the `£` sign is what selects the sense.

**What is NOT sourceable, with the price of each refusal:**

| class | count | why refused | what the refusal costs |
|---|---:|---|---|
| percent | 2 | no word in corpus/referee/espeak, no wiki to ask | `3%` reads *adek* — the sign silent |
| `¥` | 3 | no yen word in any source | three amounts read as bare numbers |
| degrees | 2 | `digri` ×1 is the ACADEMIC degree (Run 4); no Celsius/Fahrenheit name | `+30°C` keeps its *t͡ʃ* |
| `+` | 2 | one is redundant with `moloyo` ("more than"); UTC+1 unattested (trap 48) | lossless / one offset |
| minus | 0 | **the corpus contains no negative number at all** — all 17 hyphens are spans/scores | nothing |
| `&` | 1 | `kod` is "and" but `B kod Bs` is not how anyone reads an English business abbreviation | one initialism |
| era | 3 | `Kristo` ×5 is `Jo-Kristo` / `kwom Kristo`, never an era phrase | `BCE` stays *bt͡ʃe* |
| initialisms | — | espeak ships no Luo → **no letter-name table exists** → `core/initialisms.ts` is a no-op | `UTC` stays *utt͡ʃ* |
| units | 8 | no Luo word for `mm` or `Ghz`; every measure noun the language DOES use is already a word | raw `mm` |

⚠ **The percent refusal has a named candidate, deliberately not shipped.** `kuom mia achiel` — "out of one
hundred" — is composable entirely from attested pieces (the Fula `e teemedere` move): `kuom` is the
partitive in this corpus's own numeric ratio, `ondik nyinge e thuolo mar 190 kuom ji 400` ("190 out of 400
people"), and `mia achiel` is 100 in the engine's own `numbers.ts`. It is left in the backlog rather than
shipped, because two instances do not buy a phrase no Dholuo speaker has been observed writing, and because
there is no wiki to check it against.

---

## Run 7 — 2026-08-16 — the currency tier DOUBLES the word on 3 of 4 instances, so there is no tier

```
npx tsx <scratch>/luo/probe2.mts     # three makeSymbolNormalizer configurations, same six strings
```

**Question.** Can `makeSymbolNormalizer` express the currency? (`currencyPrefix` exists and Run 5 says the
noun precedes.)

**Raw finding.**

```
currencyPrefix:true            "mwandu ma dirom dola bilion DOLA 2.3."
currencyPrefix + magnitudes    "(dola bilion DOLA 14.7 mag Amerka)"
default (postposed)            "kum mar fwai maromo dola 1000 DOLA kuom keth ka keth."
                               "nengo molandi mar tara paund 27."      ← the one instance it gets right
                               "nengo mar kind ¥2,500 kod ¥130,000"    ← ¥ undeclared, correctly untouched
```

**Implication.** Dholuo writes **currency-noun · magnitude · sign · figure** — `dola bilion $2.3` — so the
noun the sign would emit is already there, two tokens to the LEFT with a magnitude word in between. The
tier's "already said it" suppression is adjacency-based and cannot see across `bilion`, so it says *dola*
twice in every configuration. This is trap 12 (a redundant symbol is a permissible drop) meeting a word
order the tier cannot inspect.

**Measured over all four `$` and the one `£`:**

| instance | currency word already present? | verdict |
|---|---|---|
| `mwandu ma dirom dola bilion $2.3` | `dola` ×1 | drop the sign |
| `(dola bilion $14.7 mag Amerka)` | `dola` ×1 | drop the sign |
| `dola $1000 kuom keth ka keth` | `dola` ×1 | drop the sign |
| `AUD$45 milion` | the ISO code `AUD` | drop the sign (trap 12's ISO clause) |
| `tara £27` | **none** | **read it** |

So `$` needs no reading in this corpus at all, `£` needs exactly one, and the rule that expresses both is a
left-context redundancy guard — which is why **this layer declares NO shared tier**. The other three arms
are empty for independent reasons: percent has no word, `units` has no abbreviation the language reads
(every measure noun is already a word and PRECEDES its numeral), and the exponent arm cannot fire because
`mm2`'s head noun `mm` has no word either (trap 53 — refuse the whole match, never half of it).

---

## Run 8 — 2026-08-16 — writing the rules, and the two orderings that are not optional

**Question.** What sequence, and what breaks if it changes?

**Raw finding / implication** — the couplings, each stated at its step in `normalize.ts`:

1. **De-grouping runs first**, or the grouping comma is clause punctuation and the tail is a separate
   number. Matched as ONE whole number (trap 63) with the trailing guard rejecting a DIGIT and nothing else
   (trap 58) — `pipni 55,000.` is clause-final and must still de-group. Max group depth in this corpus is
   `5,000,000` (two joins), so the four-group failure trap 63 describes cannot arise here; the whole-number
   idiom is used anyway.
2. **The version-designation dot is spent BEFORE the decimal rule** (trap 39 — a guard's evidence has a
   lifetime). `802.11a/b/g/n` ×5: a single trailing LETTER after the fraction is what identifies a
   designation, and `22.4Ghz` / `5.0Ghz` are excluded by that same test because their unit is three letters.
   The designation dot is spent silently (no word, no pause), which is what stops *802 nukta 1 1 a*.
3. **Ranges run BEFORE the clock**, or `10:00-11:00` has already lost its colons and the range rule reads
   `00-11`. The clock-range arm is written explicitly and claims `10:00-11:00` as a whole.
4. **The clause-dash rule runs LAST**, after the range rule has claimed `(1418 - 1450)`; otherwise a spaced
   year range becomes a pause. And it must NOT require a non-digit on both sides, or `kuonde 26 - mang'eny`
   loses its pause.
5. **The currency rule runs before de-grouping is irrelevant but before the decimal rule is not** — it needs
   `$2.3` intact to see a figure after the sign.

---

## Run 9 — 2026-08-16 — read all 86 changed utterances; ONE introduced defect, and the classes that are ×0

```
npx tsx tools/normalization/corpus-diff.ts emit --lang luo --corpus luo_ke --out /tmp/luo-after.json
python3 mydiff.py            # line-for-line, all 86, not the tool's first-12 truncation
python3 spc.py               # the residual class census
```

**Question.** Does the diff contain anything the probes could not show? (Trap 3, and the tool prints only
the first twelve, truncated to the terminal width — so it was re-diffed by hand.)

**Raw finding.** 86 of 1,660 utterances changed. Eighty-five are de-grouping, decimals, clocks, ranges or a
restored clause pause, and every one is an improvement. **One was a defect this layer INTRODUCED:**

```
SRC  Russia ne ochngo ndege mar II-76s bang' masirano.
 -   … ndege mar ariyo piero abiriyo gauchiel s bang' masirano
 +   … ndege mar ariyo NYAKA piero abiriyo gauchiel s bang' masirano
```

That is the Ilyushin **Il-76**, mistyped with two capital I's — and `registry.ts` resolves Roman numerals to
digits BEFORE `text()` runs for every language outside `ROMAN_NATIVE`, so by the time the range rule sees it
the string is `2-76s`. Trap 56 exactly: a designation given a reading. The fix is a trailing
`(?![\p{L}\p{M}])`, and it is free — **all 17 genuine ranges in this corpus are followed by a space, a
comma, a bracket or a full stop, and not one by a letter.** Re-emitted: 86 changed, DROP 11 → 7.

**And the residual class census, so the absences are on the record rather than merely unmentioned:**

```
space-grouped numbers   0      confusable degree sign (º ˚ ℃ ℉)   0
dotted/slashed dates    0      multi-dot runs (IP addresses)      0
fractions (N/M)         0      Latin ordinals (1st, 2nd …)        0
comma + 1–2 digits      1      — and it is inside the sports time 4:41.30,2:11.60
```

**Implication.** No space-grouping pass is needed (`review.ts` prints `5 000` → *abich nono* and that is a
probe, not a corpus shape); no date rule; no fraction rule. And the `1.234` probe reading as a DECIMAL is
correct for this language: measured, the dot never groups here.

---

## Gates

| gate | before | after |
|---|---|---|
| `corpus-diff` DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW | 0 / 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 / 0 |
| `corpus-diff` DROP | 11 | **7** |
| utterances changed | — | 86 / 1660 (5.2%), all 86 read by hand |
| `review.ts --lang luo` | n/a | `sign classes` **PASS** (none dropped) · `sourcing` **PASS** (all 2 high-traffic words attested) · `clause-final` **PASS** · `spelling → g2p` PASS · `tests` PASS. `artifact tracked` FAIL is expected and structural — Luo has no mined artifact |
| `referee-eval luo` | 1/17 raw, 17/17 folded, 100.0% symbol accuracy | identical — 1/17 raw, 17/17 folded, 100.0% |
| `npx vitest run` | — | 4,644 passed / 1 failed — `test/languageCatalogue.test.ts`, by **exactly one cell** (expected; regenerated centrally) |
| `npx tsc --noEmit` | — | clean |

**The four DROPs that closed** are `currency` 5 → 1: three `$` became REDUNDANT notes (the corpus's own
`dola` is in the reading) and the `£` is now read as `paund`. **The seven that remain are exactly the seven
refused classes**, each registered with its argument: `currency` ×1 (the `¥` line), `percent` ×2,
`math-sign` ×2 (the two `+`), `degree` ×2, `ampersand` ×1.

**One defect was INTRODUCED and caught by reading the diff, not by any counter.** The first draft's range
rule read `Russia ne ochngo ndege mar II-76s bang' masirano` as *ariyo NYAKA piero abiriyo gauchiel s* — the
Ilyushin Il-76, mistyped with two capital I's, which `registry.ts` had already turned into `2-76s` by
resolving the "Roman numeral". A trailing `(?![\p{L}\p{M}])` closes it for free: **all 17 genuine ranges in
this corpus are followed by a space, a comma, a bracket or a full stop, and not one by a letter.**

**One spurious pause is knowingly shipped, with the count.** The spaced-dash rule gains 18 real clause
pauses and creates 1 wrong one: `Lweny Mokuongo mar Sino - Japan` is a NAME written with a spaced hyphen and
now takes a comma. A "capital on both sides" guard was tested and rejected — it would also decline
`Ting'o ne ji ma moko - Kik iwe bagni lal`, a genuine clause dash whose right side is capitalised. One for
one, so the simple rule stands and the cost is recorded rather than hidden.

---

## Backlog surfaced, not fixed

1. ⚠ **`numbers.ts` composes 1000 as `elfu`, and `elfu` is ×0 in the corpus.** The corpus writes `gana`
   ×17 — including `gana achiel` explicitly for "one thousand" (`ohinga … kod higni gana achiel no`,
   `Matin ne kese gana achiel ne osefweny kuom dhano`) — and `alufu achiel` ×1
   (`Kwom higni maloyo alufu achiel din mar Jokristo`). `numbers.ts` documents the choice as MODERN
   (`elfu` via Swahili/Arabic) over TRADITIONAL (`gana`/`tara`), which is a defensible position, but the
   corpus contradicts it in both slots: it also writes `tara` ×23 for the million against `milion` ×2 and
   `bilion` ×3. Every number ≥ 1000 in this language currently reads with a word the corpus never uses.
   That is a `numbers.ts` question with its own referee and its own corpus diff, not a normalization one.
2. **`BCE` reads as the pronounceable non-word *bt͡ʃe*** ×2 and `KK` ×1 is unread. Needs a sourced Dholuo
   era phrase; `Kristo` ×5 in this corpus is only ever `Jo-Kristo` / `kwom Kristo`.
3. **`UTC` reads as *utt͡ʃ*** and every other initialism likewise, because espeak ships no Luo and there is
   no letter-name table anywhere — `core/initialisms.ts` is structurally a no-op for this language.
4. **`°C`'s scale letter reads as *t͡ʃ*** through the Dholuo ⟨c⟩ → t͡ʃ grapheme rule (trap 56, pre-existing).
   Blocked on a degree word; `digri` ×1 is the academic degree.
5. **The percent sign, with `kuom mia achiel` named as the composable candidate** (Run 6).
6. **`mm` ×6 and `Ghz` ×2 reach the IPA as bare consonant clusters**, and `3136 mm2` reads "…mm two"
   (trap 53). Blocked on unit words; note that `Ghz` is spelled with a lowercase H, so an SI-keyed rule
   would miss it.
7. **The two sports times** `4:41.30,2:11.60` and `1:09.02` keep a clause pause at their colon. The
   `sports-time` cell has no reading in any language here and no Dholuo source names a pace.
8. **`4.2-3.9` is the one range whose operands are decimals**; it is claimed, but the ascending test that
   guards the season `1995-96` had to be replaced by a digit-count test to let it through — recorded in
   case a later corpus has a truncated decimal endpoint.
