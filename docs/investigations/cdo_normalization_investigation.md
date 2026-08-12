# cdo (Min Dong / Eastern Min, Fuzhou) — text normalization investigation

Working log for the `norm/cdo` layer. Chronological, one entry per run. Negative results are kept
deliberately: they are the part that stops the next reader repeating the attempt.

cdo is the **last untreated Sinitic lect**. Six siblings are done (`cmn yue wuu nan cjy hak hsn gan`) and
`src/core/sinitic.ts` exists to share what they rediscovered. The premise going in was that cdo would be a
seventh instance of that pattern. **It is not, and that is the headline of this whole investigation** — see
Run 2.

---

## Run 1 — 2026-08-12 15:05

**Commands**

```
npx tsx tools/referee-eval/eval.ts cdo
npx tsx tools/normalization/corpus-diff.ts emit --lang cdo --corpus mined:cdo --out <baseline>
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/cdo.jsonc --lang cdo
npx tsx tools/normalization/sources.ts --lang cdo
npx tsx tools/normalization/review.ts --lang cdo
```

**Question.** What is the baseline, before anything is touched?

**Raw findings**

```
referee   kaikki Chinese dump, Min-Dong Romanized↔Sinological-IPA (1514 words)
          raw exact 0/1514 (0.0%) · folded backbone 1513/1514 (99.9%) · symbol accuracy 100.0%
          residual: 1× ŋɛiʔ ≠ ŋɛiʔek  (ngek)
corpus-diff  emitted 393 utterances
scan      DROP percent ×28 · DROP math-sign ×16 · DROP exponent ×13 · DROP degree ×9
          DROP ampersand ×5 · MARKUP math-sign ×4 · DROP minus ×3 · MARKUP minus ×2
sources   [NONE] scale-names · [chk?] percent-word · [NONE] fraction-series
          [chk?] minus/equals/times/ampersand/plus/exponent-word · espeak NOT SHIPPED
review    [FAIL] normalizer src/languages/mindong/normalize.ts missing
```

**Implication.** The referee is a *single* rule-generated source (Wiktionary `Module:cdo-pron`) over
single-syllable citation forms, so it is a regression tripwire rather than a meter for a text layer — a
normalization rule cannot move a single-syllable word list. It is recorded anyway because the brief asks for
before/after and a regression there would mean something had gone badly wrong in the converter.
espeak ships no Min Dong, so the sourcing haystack is corpus + artifact + referee + the wiki. Everything else
is a defect list to measure.

---

## Run 2 — 2026-08-12 15:20 — ⚠ THE FINDING THAT REDIRECTS THE WHOLE LAYER

**Command.** Read `src/languages/mindong/mindong.ts`, `test/mindong.test.ts`, and the artifact text.

**Question.** cdo is Sinitic; how much of `core/sinitic.ts` applies?

**Raw finding.** **The cdo engine has no Han front-end at all.** Its module header says so:

> DEFERRED: the Han front-end (no independent Han→reading dictionary exists — the only source is Wiktionary,
> which is also the referee's source, so it would be circular)

It is a **Bàng-uâ-cê → IPA converter**: BUC is a hyphenated, *space-separated Latin* missionary orthography,
and the number compositor emits BUC words rather than routing through a Han reading dict. The corpus agrees —
`cdo.wikipedia` is written overwhelmingly in BUC (`latin-in-native` 8527 in the artifact's whole-corpus
counts), with a minority of pure-Han paragraphs that the engine drops wholesale.

**Implications, and there are four, each of which inverts a sibling's answer:**

1. **Every word this layer emits must be BUC, never Han.** `spellYears(s, {rangeWord: "到"})` would put a Han
   character into a string whose engine cannot read one. The shared rules in `core/sinitic.ts` are still
   usable — *because every word in them is a parameter*, exactly as its header promises — but the parameters
   are BUC and the year-suffix anchor is the BUC word `nièng`, not `年`.
2. **`unspacedScript` MUST NOT be set.** Six siblings set it (trap 27: a Han neighbour is a token boundary by
   script change, so the tier's letter guard rejects the ordinary case). In cdo a sign's neighbour is a *Latin
   letter*, so the ordinary guard is the correct one and the flag would DISARM it. Verified in Run 6.
3. **Trap 19 does not apply either.** BUC has word boundaries, so `attest.ts` gives real `attested`
   verdicts rather than `attested*`. This is the one Sinitic corpus where a token count means what it says.
4. **The digit-by-digit year convention has to be re-sourced, not inherited.** `2009年` → 二零零九年 is a fact
   about Han orthography. Whether a Fuzhou reader says the four digits of `1749 nièng` one at a time is a
   separate question — see Run 5.

---

## Run 3 — 2026-08-12 15:25 — what the engine actually does to the corpus's shapes

**Command.** A probe script running every attested surface form through `createMinDong().text()`.

**Raw findings** (the corpus's own strings on the left):

```
"1,000"                → ɛiʔ˨˦ , liŋ˥˧                     grouping comma = clause pause, VALUE DESTROYED
"99.68%"               → kau sɛiʔ kau . løyʔ sɛiʔ paiʔ      % DROPPED; the point is a PAUSE; ".68" read as a cardinal
"19.6℃"                → sɛiʔ˨˦ kau˧˧ . løyʔ˥              ℃ DROPPED ENTIRELY — unit as well as sign
"20 °C"                → nɛi˨˦˨ sɛiʔ˨˦ c˥˥                 the scale letter read as a RAW LATIN LETTER
"118°08"               → suoʔ paiʔ suoʔ sɛiʔ paiʔ paiʔ      ° DROPPED
"2,133 km²"            → nɛi , suoʔ paiʔ saŋ sɛiʔ saŋ km˥˥  ⚠ RAW `km` IN THE IPA — and ² dropped
"1400-2000 mm"         → … mm˥˥                             RAW `mm`
"4cm - 40cm"           → … cm˥˥ … cm˥˥                      RAW `cm`
"…×10 −31 kg"          → … kg˥˥                             RAW `kg`
"1/4"                  → ɛiʔ˨˦ sɛi˨˩˧                       slash dropped, "one four"
"100 - 700 km"         → suoʔ paiʔ t͡sʰɛiʔ paiʔ km˥˥         range dash silent
"-15 dô"               → sɛiʔ˨˦ ŋou˨˦˨ tou˨˦˨               MINUS DROPPED — the sign that INVERTS
"1749 nièng"           → siŏh-chiĕng chék-báik sé-sék gāu   the CARDINAL, for a year
"A & B"                → a˥˥ b˥˥                            & dropped
```

**Implication.** The raw `km`/`mm`/`cm`/`kg` leak is the most serious and is *invisible to every gate in the
tree*: `DIGIT` sees digits, `RAWMARK` sees punctuation, and a Latin-letter run in a Latin-script language
looks exactly like a word — this is playbook trap 6's shape arriving from the other direction (it is not a
spelling the layer emitted, it is a spelling the converter failed to consume and passed through). It is why
`units` had to be declared here rather than deferred.

Note what `bucToIpa` does with `km`: `baseToIpa` finds no rime, returns the raw base, and the tone letters are
appended anyway — hence `km˥˥`. Silence would have been better; the leak is worse than a drop.

---

## Run 4 — 2026-08-12 15:35 — sourcing, and the corpus turns out to be unusually generous

**Commands.** Whole-word counts over the artifact text (`count.ts` boundary lookarounds, not `\b`), then
`cdo.wikipedia` CirrusSearch `insource:` probes, then `attest.ts`.

**Question.** Which words can be sourced, and in which SENSE?

**Raw findings — from the corpus itself, in the slot:**

| word | gloss | corpus evidence |
|---|---|---|
| `nièng` 年 | year | ×165 whole-word; `1749 nièng`, `1911 nièng 11 nguŏk 8 hô̤` |
| `gáu` 到 | to (range) | ×96; `dăk gáu 35 dô` · `10 gáu 16 dô cĭ-găng` · `3,500 gáu 9,500 nièng` · `1 nguŏk gáu 9 nguŏk` |
| `dô` 度 | degree | `26 dô 05 miēu (26°05')` — **the corpus glosses the sign itself**; and `ŭng-dô sê 23~27 dô`, `dăk gáu -15 dô`, `11~19 dô`, `16~19 dô` — temperatures in words |
| `bìng-huŏng` 平方 | squared | `1,300 bìng-huŏng-mī`, `27.5 bìng-huong gung-lī`; ×9 as `bìng-huŏng gŭng-lī` on the wiki |
| `lĭk-huŏng` 立方 | cubic | `1,980 lĭk-huŏng-mī/miēu` — in the volume slot |
| `gŭng-lī` 公里 | km | ×6 corpus, ×47 wiki |
| `hò̤-mī` 毫米 | mm | ×3 corpus, ×8 wiki |
| `lī-mī` 厘米 | cm | ×1 corpus, ×2 wiki |
| `mī` 米 | metre | ×51 |
| `diēng` 點 | point | ×2 — `gău-chă diēng` (intersection point, NOUN) and `màng-buŏ 8 diēng` (o'clock) |

**⚠ The single best find, and it settles two symbols at once.** `cdo.wikipedia`'s `Bìng-tàng` article spells a
whole coordinate out in BUC:

> Bìng-tàng găh báe̤k-ūi **25 dô 16 hŭng gáu 25 dô 44 hŭng**, dĕ̤ng-gĭng **119 dô 32 hŭng gáu 120 dô 10 hŭng**
> cĭ găng

That is `25°16′ to 25°44′, 119°32′ to 120°10′` written as words, by a cdo writer, in a cdo article. It gives
`°` = `dô`, `′` = `hŭng` (分), and `gáu` as the connective **between two coordinates** — the exact slot.

**⚠ And it CORRECTS the corpus.** The artifact's `Dài-gĕ̤ng` article writes `26 dô 05 miēu (26°05')` — using
`miēu` (秒, *second*) for the arc-MINUTE. Two cdo articles, two words, and they disagree; `hŭng` 分 is the
right one for `′` and `miēu` 秒 for `″`. Taking the first citation at face value would have shipped
"26 degrees 05 **seconds**". Attestation is necessary, never sufficient — and here a second attestation is
what caught it.

**Raw findings — wiki articles that gloss the ABBREVIATION, which is stronger than a slot hit:**

```
Hò̤-mī   "'''Hò̤-mī''' (毫米) sê siŏh cṳ̄ng dòng-dô dăng-ôi, gé có̤ mm."   ← "written as mm"
Gŭng-lī  "'''Gŭng-lī''' (公里) sê hèng-liòng dòng-dô gì guók-cié dăng-ôi. Siŏh gŭng-lī dēng kó̤ siŏh-chiĕng mī."
```

**Negative results, all recorded so nobody repeats them:**

- **`百分之` / any BUC percent word: ×0 everywhere.** `insource:/hŭng-cĭ/` 0, `/báh-hŭng/` 0, `/báh-hŭng-cĭ/` 0,
  `/báik-hŭng/` 0, `/báh-hŭng-bī/` 0. `insource:/百分/` returns exactly one hit and it is **quoted PRC labour
  law in Mandarin** (`支付無低過工資其百分一百五其工資報酬`) inside the `996工作制` article — trap 34, a
  contaminating passage in another language, in the one place a naive grep would have taken it as evidence.
- **`攝氏` (Celsius) has no Eastern Min reading on Wiktionary at all** — the entry lists Mandarin, Cantonese,
  Taishanese and Hokkien (`Liap-sī`) and omits Eastern Min. `sources.ts` independently reports
  `[NONE] scale-names`.
- **`分之` DOES occur on cdo.wikipedia ×2 — but in HAN**, in `艦隊收藏` (四分之一) and `分點` (七分之一), i.e. in
  articles the engine cannot read anyway. It attests the *construction* for the language; it does not give a
  BUC spelling.

**Implication.** Units, degrees, the range word and the year anchor are all sourced from cdo's own writing.
Percent, the fraction word and Celsius are not, and Run 7 decides each on its own evidence rather than as a
block.

---

## Run 5 — 2026-08-12 15:45 — does cdo read a year digit by digit?

**Question.** `2009年` → 二零零九年 is pan-Chinese. Is it pan-*Sinitic*, or is it a fact about Han text?

**Raw finding.** The cdo corpus writes every year in ASCII digits and never spells one, so the corpus cannot
answer. Probes for a spelled-out year on the wiki return nothing. What the corpus DOES show is that the
Han-script minority paragraphs of the same wiki write `1973年`, `1992年`, `945 年` — the same digits — so the
two scripts are not in contrast either.

**Implication. The year rule is DECLINED for cdo, and this is the largest single refusal in the layer**
(`year` is the biggest cell in the corpus at 2421). The reasoning, stated so it can be re-run:

- the reading `1749` → *ék chék sé gāu* would be an **inference from Han orthography transplanted into a Latin
  one**, and the six sibling layers each flagged the same inference as unverified even where the *script* was
  the same;
- the current reading (`siŏh-chiĕng chék-báik sé-sék gāu`, the cardinal) is not a defect the way a dropped
  sign is — it is a *different but pronounceable* reading of the same number, where digit-by-digit would be a
  confident claim about the language;
- and cdo's own corpus supplies the counter-pressure: `chiĕu-guó 2200 nièng` ("more than 2200 YEARS"),
  `7,000 nièng sèng`, `15,000 nièng ī-sèng`, `3,500 gáu 9,500 nièng`, `4,000 siông nièng` are **durations**,
  which want the cardinal. gan and hsn each had to build a duration guard to protect exactly these; adopting
  the year rule here would mean adopting that guard too, on top of an unsourced reading.

Counted in the artifact text: `\d{4}\s*nièng` ×119, of which the visible durations are ~6. So the rule would
be right about a large majority and unsourced about all of them. Left alone. **A well-written refusal is a
re-runnable measurement** (trap 24) — one grep re-opens this if a Fuzhou reading source ever appears.

---

## Run 6 — 2026-08-12 15:20 — `unspacedScript`, tested rather than inherited

**Question.** Six siblings set `unspacedScript: true` (trap 27). Should cdo?

**Raw finding.** No, and the counter-example is in cdo's own corpus. The flag narrows the tier's
letter-boundary guard from "any letter" to "a Latin letter", because in Han a sign's neighbour is a Han
character and the unmodified guard rejects the ordinary case. In BUC the neighbour **is** a Latin letter, and
the guard is doing exactly its intended job:

```
9.15 mī   the bare `m` unit key must NOT match — and it does not, because `ī` is a letter
1400 mm   `mm` must match — and it does, because `.` is not
```

`mī` (米, metre) is the corpus's ordinary word for a distance and occurs ×51; declaring the one-letter key
`m` (needed for `600 m²` and `1,980 m³/s`) is only safe *because* the guard is intact. Setting the flag would
have read fifty-one metre-words as measurements.

**Implication.** Trap 27's rule is "opt-in DATA, not global relaxation", and cdo is the case that shows why
the opt-in is per-language rather than per-family.

---

## Run 7 — 2026-08-12 15:35 — the one-letter key, measured before declaring

**Command.** Counts over the artifact text for the traps 28/46 hazards.

**Raw finding.**

```
digit-adjacent `m`                    ×3   `600 m²`, `600m²`, `1,980 m³/s` — all genuine metres
three-part dotted version (802.11n)   ×0   the guard NOT_VERSION exists to protect has nothing to protect
digit-adjacent `g` / `ha` / `t`       ×1   and it is `ʔai33 t̠ʲam11`, an IPA gloss — not declared
magnitude word touching a unit/sign   ×0   so `magnitudes` is not declared either
`‰`                                   ×0
`°F` / `℉`                            ×0
`\d{1,2}:\d{2}`                       ×4   ALL Bible verses (22:37-40, 20:2-17, 5:6-21, 2:1-4)
```

**Implication.** `m` is declared; `g`, `t`, `ha`, `magnitudes` and a clock rule are not. The `clock: 38` in
the artifact header is the cell's `[:.]` alternative — decimals — which is trap 21 exactly: a filled cell is
a lead, not a finding.

---

## Run 8 — 2026-08-12 15:40 — the range guard, where gan's cannot be copied

**Question.** gan/cjy/hsn reject a range preceded by a Latin run within 12 characters. Does that transfer?

**Raw finding. No — it would refuse every range cdo has**, because BUC prose *is* Latin, so every number in
the language is preceded by Latin. Measured instead: the digit-both-sides guard alone gives **23 matches over
the artifact text, 22 of them genuine** (`4-6`, `7-8`, `7-10 °C`, `1400-2000 mm`, `1200~2100 hò̤-mī`,
`100 - 700 km`, `94–98%`, `2,000-3,000`, `(1894 - 1895 nièng)`, `(916-1125 nièng)`, `23~27 dô`, …).

- the chained-dash rejection already handles the ISBNs (`ISBN 3-88053-113-7`, `ISBN 7-04-004058-1`);
- adding `:` to the lookbehind handles the four Bible verses;
- the single residual false positive is **`ISO 639-3`**, so the one extra guard is an ALL-CAPS acronym
  immediately before the number. Nothing in BUC ends in a capital, so it cannot bite a real range.

**Implication.** A guard is a measurement, not an inheritance. Recorded in `normalize.ts` step 8 at length,
because the next reader's instinct will be to copy gan's.

---

## Run 9 — 2026-08-12 15:50 — `attest.ts`, and what it says about BUC

**Command.** `attest.ts --lang cdo --words báh-hŭng-cĭ,hŭng-cĭ,diēng,dô,hŭng,miēu,gáu,gŭng-lī,hò̤-mī,lī-mī,gŭng-gĭng,bìng-huŏng,lĭk-huŏng,gâe̤ng,hô,nièng`
(one all-or-nothing run, default `--limit`).

**⚠ It took four attempts.** The first three died on `429 Too Many Requests` from `cdo.wikipedia.org` — the
tool's pooled 8-concurrent full-extract fetch (trap 30's fix) is more than this small wiki will serve, while
serial CirrusSearch calls a second apart were fine throughout. Nothing was written on the failures, so the
carry-forward hazard never arose; the fourth run succeeded and wrote all 16 findings.
**⚠ And a single-word re-run afterwards hit the known carry-forward bug and correctly REFUSED to write**
("15 existing finding(s) could not be parsed … Writing now would delete them"). One run per language, as the
brief says.

**Raw finding.**

```
word          token  arts  substr-only  verdict
báh-hŭng-cĭ   0      0     0            absent
hŭng-cĭ       0      0     0            absent
diēng         42     20    0            attested
dô            36     20    0            attested
hŭng          62     20    0            attested
miēu          21     12    0            attested
gáu           151    20    0            attested
gŭng-lī       25     14    0            attested
hò̤-mī        9      4     0            attested
lī-mī         0      0     0            absent
gŭng-gĭng     0      0     0            absent
bìng-huŏng    14     8     0            attested
lĭk-huŏng     0      0     0            absent
gâe̤ng        31     20    0            attested
hô            49     20    0            attested
nièng         81     20    0            attested
```

**⚠ `substr-only` IS ZERO ON ALL SIXTEEN, which is the direct measurement of Run 2's claim.** Trap 19 says a
word-boundary test is meaningless in a spaceless script and that cmn's thirteen probes came back thirteen
identical `substring-only` verdicts — "a gate that returns the same answer for every input is not a strict
gate, it is a broken one". Here the same gate discriminates: 11 attested, 5 absent, 0 substring-only. **cdo
is the one Sinitic language for which `attest.ts` works as designed.**

**⚠ THREE `absent` VERDICTS ARE WRONG, AND THE TOOL IS NOT AT FAULT — THE QUERY IS.** `lī-mī`, `gŭng-gĭng`
and `lĭk-huŏng` all score 0 here and all three are on the wiki:

```
insource:/lī-mī/      2   `siáng kuăng ng-sāi chiĕu guó 12 lī-mī`  ·  `téng gūi lī-mī dòng gì ciēng`
insource:/gŭng-gĭng/  1   `siŏh nĭk diŏh siăh 15 gáu 20 gŭng-gĭng gì dé̤ṳk`  (a panda's daily bamboo)
insource:/lĭk-huŏng/  8   `bìng-gĭng làu-liông sê 1,980 lĭk-huŏng-mī/miēu`, `gāng-dăng lĭk-huŏng gĭng-gák`
```

A hyphenated BUC compound is split by CirrusSearch's own tokenizer, so a plain word query under-finds it
while an `insource:` regex over the wikitext does not. **This is trap 19's mirror image**: the word-boundary
problem does not disappear in a Latin orthography, it moves from the *verdict* into the *query*. A rare
hyphenated compound can therefore come back `absent` from this tool and still be real — so the three units
are declared on the `insource:` evidence, cited in the layer, and this paragraph is the record of why the
cache disagrees.

**Senses read, since attestation is necessary and never sufficient:**

- `dô` — the wiki's examples are dominated by `gĭng-dô` / `ūi-dô` (longitude/latitude), which is the degree
  sense, alongside the unrelated `Éng-dô` (India). Combined with the corpus's own `26 dô 05 miēu (26°05')`
  and `ŭng-dô sê 23~27 dô`, the slot is closed.
- `miēu` — `"Miēu, iâ hô̤ lā̤ miēu-cṳ̆ng, sê siŏh ciáh sì-găng dăng-ôi"`, the wiki's own definition of the
  SECOND as a unit. Plus `1/299792458 miēu` and the rate denominator `m·s−2`.
- `hò̤-mī`, `gŭng-lī` — both have a **definition article** that names the abbreviation (`gé có̤ mm`).
- ⚠ **`hô` (負) is `attested` and the verdict is worthless**: all 49 hits are other morphemes — 戶 in the
  radical article 戶部 and in the constellation 獵戶座, 父 in 父部. This is the `amaphuzu` shape, and it is
  what decides the minus refusal.

---

## Run 10 — 2026-08-12 15:55 — the gates

**Before / after**, every gate the brief names:

| gate | before | after |
|---|---|---|
| `referee-eval.ts cdo` | folded 1513/1514 (99.9%), symbol acc. 100.0%, 1 residual (`ngek`) | **identical** — no regression |
| `corpus-diff` DROP | 70 | **30** (100/393 utterances changed; DIGIT/SLOT-GAP/RAWMARK/THROW all 0→0) |
| `mine.ts scan` | DROP percent ×28 · math-sign ×16 · exponent ×13 · degree ×9 · ampersand ×5 · minus ×3 | **no defects — every finding is a note** (percent 0, degree 0, exponent 13→1 unaccepted→0) |
| `review.ts --lang cdo` | `[FAIL] normalizer missing` | **one FAIL: `sign classes DROPPED: minus`** — the sourced refusal, deliberately red (trap 24) |
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | 3742 passed | 3742+25 passed, 0 failed |
| `languageCatalogue.test.ts` | stale by 1 cell after the change | regenerated, passes |

**⚠ ONE FALSE POSITIVE INTRODUCED IN A GATE I DID NOT CHANGE, reported not patched.** `sources.ts --lang cdo`
now says `[ ok ] scale-names Celsius Fahrenheit` where it previously said `[NONE] … the letter gets dropped`.
Nothing was sourced: the check is reading the `celsius:` and `fahrenheit:` KEYS of this layer's
`readDegrees({…})` call as if they were scale NAMES. cdo has no scale name in any source — both arms emit the
bare degree word `dô` — so this is the "reading CODE is not reading DATA" class that file's own header
records, in a new shape (a function's option keys rather than a tier declaration). Left for a tool change,
since `sources.ts` is shared.

**Sample-tier changes read, all 100.** Nothing surprising; two worth naming:

- `19世紀…超過1/4其領土` and `…原來其1/10都無夠` — pure-HAN paragraphs, where the digits already read through
  cdo's own number path (the Han runs are routed elsewhere by the gap pass) and the fraction word is now
  inserted between them. Consistent with what was already happening to the digits; not a new seam.
- `(thế kỷ 20-21)` — a Vietnamese caption inside a file description gets `20 gáu 21`. It IS a range; the
  connective is simply in the wrong language, which is true of every number in that line already.

**What did not change and is recorded as such:** `5720 nè̤ng/km` still leaks a raw `km`, because the unit is
not digit-adjacent (it is a rate denominator written in words, `rate: 3` in the artifact, and no rate
ABBREVIATION exists to compose). `1/299792458` keeps its silent slash — the shared fraction rule caps each
side at 4 digits, which is the guard that keeps DOIs and year pairs out. Both are one instance each.

---

## Run 11 — 2026-08-12 16:00 — what was reused from `core/sinitic.ts`, and what was not

| shared rule | cdo | why |
|---|---|---|
| `degroupThousands` | **reused** | pure ASCII, no words at all; ×62 and the single most destructive defect |
| `readDecimals` | **reused**, with a BUC digit table | see below |
| `reorderFraction` | **reused**, word ` hŭng-cĭ ` | its two guards (year pair, Latin letter before the numerator) are worth more here than in any Han corpus, because this corpus IS Latin |
| `readDegrees` | **reused**, both arms → `dô` | carries the `\s*` fix (yue's bug), the `\p{sc=Latn}` guard, and the optional decimal part four Han layers shipped without — and `19.6℃`/`28.5℃` is cdo's ordinary form |
| `spellYears` | **declined** | Run 5 |
| `HAN_DIGITS` / `spellHanDigits` | **parameterised away** | see below |

**The one adaptation, and it is the interesting one.** `spellHanDigits` joins its digit table with `""`,
which is correct in a script with no word boundaries and produces one unreadable fused syllable in BUC. cdo
passes `[" 0", " 1", … " 9"]` — a space plus the ASCII digit — so the fractional part comes out as separate
tokens the engine's own number path reads one at a time (`6 8` → *løyʔ˥ paiʔ˨˦*). No orthography is authored
in this layer at all, which is the playbook's preferred shape, and a lone digit cannot reach any multi-digit
branch of the compositor (trap 20). The shared rule's dotted-designation and 3-digit guards stay live.

**Kept local, and each names its reason under trap 47:**

1. **The coordinate rule** (`D°M′S″`) — architecture: the tier has no degree slot at all, and the shape must
   be claimed *whole* because ASCII `'` is an ordinary apostrophe in this corpus's Latin quotations
   (`Philosopher's Stone`, `d'Ancona`, `L'insoutenable`). Anchoring on the `°` removes the ambiguity.
2. **The percent range** — architecture: after the tier has claimed each `%` there is no longer a pair of
   numbers for any rule to see. Five instances, one line (trap 17).
3. **The range rule** — the connective is a WORD, and this family has now produced seven answers for it
   (wuu 搭, nan 佮, hak 摎, cjy 和, hsn 跟, gan 同到, cdo gáu). Its guard is additionally cdo-specific, Run 8.

**Nothing in `src/core` was edited.**

---

## Run 12 — 2026-08-12 17:05 — 百, and the reading the layer already disagreed with

**Question.** Run 7's leg (4) for `báh-hŭng-cĭ` recorded a disagreement and deliberately did not act on it:
the normalization layer reads 百 as ⟨báh⟩ while `mindong.ts`'s number compositor reads it as ⟨báik⟩, from the
Wikivoyage phrasebook. Is the vernacular/literary split conditioned by context (in which case the compositor
may be right in the numeral slot), or is the number simply `báh`?

**Search 1 — the dictionary.** en.wiktionary 百, Eastern Min (Fuzhou):

```
báh / báik — báh: vernacular ("hundred");  báik: literary ("numerous")
```

The gloss does the work: the COUNTING sense is assigned to the vernacular form, and the literary form is
glossed with a different sense ("numerous"), not with a different register of the same sense. Min Nan's entry
has the same shape (pah vernacular / pek literary), so this is the ordinary Min文白 split, not a cdo quirk.

**Search 2 — cdo.wikipedia's own BUC prose, `insource:` counts through the Cirrus API.** A phrasebook is a
tertiary source; the corpus this engine is measured against is not.

```
siŏh-báh  10     siŏh-báik  2
lâng-báh   2     lâng-báik  0
săng-báh   2     săng-báik  2   ← both FALSE, see below
báh-uâng  36     báik-uâng  1   ← the one hit is 八萬, see below
ngô-báh    2
báh       136 (whole-corpus)
```

**Raw findings, read rather than counted.**

- **The number articles are decisive and they are the wiki's own answer to exactly this question.** Article
  `100` reads, in full: `'''100''' ({{Siăng|Cdo-fzho 100 (siŏh-báh).ogg|siŏh báh|help=no}}, siŏh báik) sê
  [[99]] gâe̤ng [[101]] cĭ găng gì [[cê̤ṳ-iòng-só]].` — ⟨siŏh báh⟩ first, carrying the **recorded audio
  file**, with ⟨siŏh báik⟩ as a parenthesised alternate. Article `200`: `lâng-báh`, with audio, and **no
  variant at all**. Article `300`: `săng-báh`, with audio. Three articles, three multipliers, one form.
- **`săng-báik` ×2 is a mirage** — `«Gĭ-dók-săng Báik-ciók»` (*Le Comte de Monte-Cristo*, a title) and
  `Dŭng-săng báik-diōng`. Neither is 三百. Trap: the hyphen crosses a word boundary the search cannot see.
- **`báik-uâng` ×1 is a hit for 八, not 百** — `găk Ĭng-guók ô báik-uâng séng-dù, găk [[Mī-guók]] ô lĕ̤k-uâng
  séng-dù` = 8万 / 6万 believers, contrasted in one sentence. So the corpus has **zero** real `báik` +
  magnitude hits.
- **`siŏh-báik` ×2 are real but are running prose, not the numeral article** — `Gĭng-guó céng-hū siŏh báik
  nièng gì ák-cié` (一百年 of suppression). So `báik` is not impossible in the numeral slot; it is a minority
  free variant, ×2 against ×14 for `báh` in the same slot.
- **`báh-uâng` ×36 is the compound the compositor emits for 10⁶** — `gê̤ṳng-cūng ô siŏh-báh-uâng
  Ā-mī-nì-ā-nè̤ng` ("a total of one million Armenians"), and 35 more in GDP/population infoboxes.

**Implication — the split is NOT context-conditioned in any way this compositor can see.** There is no rule
to encode: the vernacular form is the number at every multiplier the corpus writes, and the two live `báik`
hits are free variation in prose. So `BUC_SMALL[2]` becomes `"báh"`. **八 keeps `báik`** — which means the
comment claiming 八/百 are homophones was documenting the defect, and is now removed. And this closes the
internal disagreement: before this run, one engine read 百 two different ways depending on whether the
normalization layer or the number compositor reached it.

**⚠ FOUR SHIPPED GOLDENS MOVED, and each is the same one-syllable substitution `paiʔ˨˦ → pɑʔ˨˦`:**

| `test/mindong.test.ts` | before | after |
|---|---|---|
| `100` | `suoʔ˥ paiʔ˨˦` | `suoʔ˥ pɑʔ˨˦` |
| `12345` | `… saŋ˥˥ paiʔ˨˦ …` | `… saŋ˥˥ pɑʔ˨˦ …` |
| `1000000` | `suoʔ˥ paiʔ˨˦ uɑŋ˨˦˨` | `suoʔ˥ pɑʔ˨˦ uɑŋ˨˦˨` — the corpus's own `báh-uâng` |
| `1400 mm` · `600 m²` · `100 - 700 km` · `1749` | `… paiʔ˨˦ …` | `… pɑʔ˨˦ …` |

They are not incidental damage: they are the assertion of the fix, and the golden `1000000` now matches a
string cdo.wikipedia writes 36 times. `84 km²` and `94–98%` keep their `paiʔ˨˦` — that is 八, untouched.

**`referee-eval.ts cdo` — before 1513/1514 folded (99.9%), 100.0% symbol; after 1513/1514 (99.9%), 100.0%.
Measured both ways** (the table was toggled back to `báik`, re-run, and restored) rather than assumed.

**⚠ AND THE REASON IT CANNOT MOVE IS ITSELF THE FINDING, recorded against the brief's expectation that a
number-word change *can* move this meter.** `tools/referee-eval/eval.ts` binds cdo to `phonemizeWord` — a
SINGLE BUC SYLLABLE → IPA — over a ~1500-syllable citation list from the kaikki Chinese dump. It never calls
`numberToBucWords` and the word list contains no digits. So cdo's referee is structurally blind to the number
compositor: it can confirm that both `báh` and `báik` are converted correctly, and it can never say which one
the number is. The evidence for this change had to be, and is, entirely corpus- and dictionary-side.

**Not changed, reported instead.** `tools/normalization/defects.ts:174` carries the leg-(4) note that says
"mindong.ts's number compositor reads 百 as ⟨báik⟩ … Changing the compositor rewrites every number cdo speaks
and a shipped golden — its own measurement". That measurement has now been made and the note is stale, but
`tools/normalization/` is owned by concurrent work in this batch and was not touched.
