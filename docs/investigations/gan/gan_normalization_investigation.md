# Gan (gan) text-normalization investigation

Worktree `norm/gan`. Method: `docs/normalization_playbook.md`.

## Run 1 — 2026-08-11 (baselines, before any edit)

**Question:** what is the pre-change state of every gate?

Commands and raw findings:

```
$ npx tsx tools/normalization/corpus-diff.ts emit --lang gan --corpus mined:gan --out …/gan.before
emitted 368 utterances

$ npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/gan.jsonc --lang gan
scanned 379 lines
DROP percent       ×27
DROP math-sign     ×16
DROP exponent      ×10
DROP degree        ×9
DROP ampersand     ×7
DROP minus         ×5
DROP currency      ×1
MARKUP math-sign   ×1
DROP iteration     ×1
LEAK RAWMARK       ×1   (Hebrew יהו in a name-affix article)
FOREIGN math-sign  ×4 / ampersand ×3 / degree ×3

$ npx tsx tools/referee-eval/eval.ts gan
⚠ secondary-source gap: no independent referee exists for Nanchang Gan (wikipron has no gan, epitran
ships no Gan; the only machine-readable Nanchang IPA IS our source, so a referee would be circular).
→ NO NUMBER TO COMPARE. The referee gate for this language is a stated gap, not a score.

$ npx tsx tools/normalization/review.ts --lang gan
[FAIL] normalizer  src/languages/gan/normalize.ts missing   (1 failing)

$ npx tsx tools/normalization/sources.ts --lang gan
[NONE] letter-names (espeak does not ship gan) · [NONE] decimal-point · [NONE] scale-names
[chk?] percent / currency / minus / plus / equals / times / ampersand / exponent
espeak: NOT SHIPPED · referee: none · corpus: 379 lines
```

**Artifact state:** `tools/corpus/mined/gan.jsonc` already exists and is TRACKED — dump-sourced
(gan.wikipedia pages-articles, paragraphs), 3020 segments, `covered 29/35`. So step 0b is already done and
`sample` IS the real distribution (the artifact's own header says so). Corpus counts it records:

```
year 1102 · digit-run 1119 · decimals 207 · signs 153 · percent 104 · initialism 99 · latin-in-native 939
grouped 89 · version-dot 88 · letter-name 83 · clock 58 · ranges 58 · quote-letter 51 · exponent 24
abbrev 17 · degrees 15 · ampersand 15 · dotted 12 · fractions 11 · signed-number 9 · arithmetic 9
roman 6 · rate 5 · sports-time 3 · units 2 · currency 1 · scaled-currency 1 · iteration 1 · zero-width 1
era-marker 0 · ordinal-latin 0 · ordinal-native 0 · ordinal-range 0 · calendar 0 · ordinal-caps 0
```

**Implication:** gan is the first *dump-backed* lect after hak in this Sinitic sub-sweep (cjy/hsn had only
incubator text). The big classes are year (1102), decimals (207), percent (104), grouped (89), ranges (58).
Next step: tabulate those in the corpus text itself, and run the Tier-1 dict-speaks gate on every candidate
word before writing a single rule — in a Han-dict engine an uncovered character VANISHES silently.

## Run 2 — 2026-08-11 (Tier 1: the dict-speaks gate)

**Question:** which candidate words does the shipped Nanchang dict actually SPEAK? In a Han-dict engine
(`sinitic/hanDictIpa.ts`) an uncovered character is skipped SILENTLY, so an unsourced word does not
mispronounce — it vanishes. Every word a rule can emit must clear this first.

Command: `phonemizeWord(w)` for each candidate (scratch probe).

```
SPEAKS  百分之(3) 分之(2) 點(1) 点(1) 到(1) 至(1) 同(1) 同到(2) 跟(1) 和(1) 公里(2) 公尺(2) 米(1) 公斤(2)
        平方(2) 立方(2) 華氏(2) 元(1) 塊(1) 第(1) 負(1) 除(1) 千米(2) 毫米(2) 平方公里(4) 立方米(3)
        美元(2) 美金(2) 港元(2) 人民幣(3) 零一二三四五六七八九十(1 each) 萬 億 千 百
SILENT  度 · 溫度 · 兩 · 两 · 正 · 加 · 減 · 乘 · 噸 · 赫茲
HALF    攝氏/摄氏 → sz̩˩˩ (1 of 2, drops 攝) · 等於/等于 → tɛn˨˩˧ (drops 於) · 小於 · 大於 · 世紀 · 角度
        公頃 · 厘米 · 伏特 · 攝氏度 → 1 of 3 · 正負 → 1 of 2
```

**Implication.** Four refusals decided on FACT, not taste, exactly as cjy and hsn recorded them:
degrees (度 silent, 攝氏 half, 攝氏度 1-of-3), the `2+classifier → 兩` rule (silent), the relational signs
(等於 half), and +/×/− arithmetic (加 減 乘 all silent). ⟨負⟩ is the one sign word that DOES speak.

Also recorded, out of scope for this layer but real: **⟨度⟩ occurs ×82 in the excerpted corpus and is silent
in the dict** — including inside 溫度. That is a dict gap, not a normalization one.

## Run 3 — 2026-08-11 (Tier 2: what the corpus writes, and what the engine does with it)

Command: greps over the 379 artifact lines (hard 179 + sample 200), plus `getPhonemizer("gan").text()` probes.

Engine-before readings of the attested shapes — this is the defect list:

```
1,000人      → it̚˥ , lin˧˥ n̠ʲin˧˥       grouping comma is a CLAUSE PAUSE and the value is destroyed
2009年       → ɵ˩˩ t͡ɕʰiɛn˦˨ lin˧˥ …      二千零九年, a CARDINAL where Sinitic reads digit-by-digit
1996-2007年  → …一千九百九十六 二千零七年   the dash VANISHES; one span, two different readings
3.14         → san˦˨ . sɨt̚˨ sz̩˧˥        decimal point is a PAUSE and .14 reads as the cardinal 十四
22/7         → ɵ˩˩ sɨt̚˨ ɵ˩˩ t͡ɕʰit̚˥     slash dropped — "twenty-two seven"
88%          → pat̚˥ sɨt̚˨ pat̚˥          % silent
50 km        → ŋ̍˨˩˧ sɨt̚˨ ˈʊkm           the raw km cluster in the IPA
20°C         → ɵ˩˩ sɨt̚˨ sˈiː             ° dropped, ⟨C⟩ read as an ENGLISH LETTER NAME
```

**THE CONJUNCTION — and 和 is a trap here.** Counts over the artifact text:

```
同到 ×59   every instance coordinating (水星同到地球, 手銬、腳鐐同到鎖鏈, 兩隻鄉同到一隻大型水庫管理局)
同得 ×32   also all coordinating (長三角同得珠三角, 香水同得別嗰滴子奢侈產品)
跟   ×42   (bare 30) coordinating (綿水跟湘水, 豐城跟南昌, 部分領土跟周邊國家)
和   ×49   BUT ×20 of those are 共和國 "Republic" — a bound compound, not a conjunction; several of the
           rest sit in the corpus's Standard-Mandarin paragraphs (`北接万载、上高和湖南省浏阳市`)
```

Playbook trap 2/37 in one line: the count that looked competitive is mostly a different morpheme.
**gan takes 同到.** That makes five distinct answers across five lects — wuu 搭, nan 佮, hak 摎, cjy 和,
hsn 跟, gan 同到 — which is the argument for the connective never being shared code.

**THE DECIMAL POINT — gan is the FIRST Sinitic lect in this sweep whose corpus attests it.** cjy, hsn, wuu,
nan and jv all shipped their separator word with only the NOUN sense attested and said so. gan's ⟨點⟩ ×13
splits: 熔點 特點 景點 重點 終結點 觀點 (noun ×6), 十七點 / 七點五十五分 (clock ×2) — and
**`有三點八億` , "3.8 hundred-million", the separator itself, spelled out in running Gan prose.** That closes
the open question those five headers all flagged.

**THE NEGATIVE SIGN — also attested, which is rare.** ⟨負⟩ speaks and its two corpus instances are the
mathematical sense in gan's own integer article: `佢個哩嗰負值(-1、-2、-3...)` and `向數線嗰正負兩頭延伸`
— the word beside the glyphs it names. The `-` instances themselves: 6 are real negatives
(` -4.6`, `到-2.0`, `, -1`, `(-1`, `、-2`, `、-3`, ` −15`) and the rest are ISBNs, page ranges (`634–642`),
date ranges (`1887年10月31號-1975年4月5號`), coordinate ranges (`113°54′-114°37′`) and route numbers.

**THE SUPERSCRIPT — gan is the SIXTH Sinitic corpus to produce the romanization hazard**, and
`test/accepted-silent.test.ts` named gan in advance. Of the superscript runs here, the large majority are
NANCHANG TONE NUMBERS in the wiki's own pronunciation glosses — `（南昌話：/ŋa²¹³ ɕi³⁵ ŋa…/）`,
`/tʰi¹¹ tɕʰiu²⁴/`, `[kɔŋ⁴⁴ tsʰik⁵…]` — against ~5 real exponents (`10⁻¹⁹`, `c²`, `10⁻²⁷`, `cm³`, `10¹⁹`).
A bare-exponent reading would turn this engine's own phonology glosses into arithmetic. Declined; the
squared/cubed UNIT is still read because it needs a unit noun and cannot match a bare tone number.

**Other measurements that decided a refusal:**

* `立方` ×0 in the corpus while `平方` ×29 (all in 平方公里). Cubed declined on exactly the evidence that
  declares squared — the hak precedent.
* The CLOCK: `\d{1,2}:\d{2}` ×3, and all three are `ISO 8601:2000` / `ISO/IEC 14882:1998` / `:2003` —
  standard numbers, not times. A colon rule would claim only what it must not. (Trap 21: a filled cell is a
  lead; the artifact's `clock: 58` is the cell's `[:.]` alternative, i.e. decimals.)
* CURRENCY: `$` ×3, all in ONE article — the UK box office of a British film (`$116,089,678`, `$0.27億`,
  `$0.15億`), where the currency is genuinely ambiguous. The only money word the corpus attests is 美金 ×1
  (`罰吥500喇美金`), which names US dollars specifically. Declaring it would read a British gross in US
  dollars: confidently wrong beating merely silent. Declined; ⟨元⟩ ×77 speaks and is attested
  (`起步2元6公里`) but is the WORD, not a reading for the sign.
* LATIN INITIALISMS: gan's dict has **0 Latin keys**, espeak ships no gan, `sources.ts` says
  `[NONE] letter-names`. Structurally blocked, the hak answer.
* ARITHMETIC / RELATIONAL: 加 減 乘 all SILENT, 等於 HALF. And the 16 `math-sign` drops are set-theory
  (`0=0/1`, `2'=0' ' '={0,1,2}`) and a LaTeX body (`e\,^{i \pi} + 1 = 0\;`).

**Implication:** write the pipeline in the cjy/hsn/hak order, adding a guarded minus rule (gan is the only
one of the six with an attested sign word), then read the corpus diff — especially for the `\d{4}年` cases
that are DURATIONS rather than years, which is the defect hsn's diff caught.

## Run 4 — 2026-08-11 (first pipeline, and the corpus diff)

Wrote `src/languages/gan/normalize.ts` in the cjy/hsn/hak shape (de-group → years → fraction → shared tier
→ decimals → minus → ranges) and wired it in `gan.ts` as a WRAPPER around the shared Han-dict engine, for
the reason cjy records: `sinitic/hanDictIpa.ts` serves gan, hak, cjy and hsn, so a hook inside it would
apply one lect's rules to the others.

```
$ npx tsx tools/normalization/corpus-diff.ts emit … && compare
changed 189/368 (51.4%)
  before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 1, DROP: 76, THROW: 0 }
  after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 1, DROP: 43, THROW: 0 }
```

Then read every changed utterance as TEXT rather than IPA (a scratch script diffing `normalizeGan(t)`
against `t`), because a Han IPA diff is unreadable at 80 columns. Four things came out of that read:

1. **`\d{4}年` IS NOT ALWAYS A YEAR.** `約西元前5000年到3000年前` is "5,000 to 3,000 years AGO" and
   `（4000年到5000年前）` the same — QUANTITIES, which want the cardinal 五千, not 五零零零. hsn met this and
   protects every `\d{4}年前`. **That rule is wrong for gan**, because this corpus also writes
   `5條綫路在2014年前得批准` — "approved BEFORE 2014", a real year. What separates them is not the 前: it is
   that a duration is one END OF A SPAN whose other end also carries 年. Keyed the protection on the PAIR
   `\d{4}年 到|至|dash \d{4}年前`. Result: 2 durations protected, 1 lone year still spelled, 0 other matches.
   ⚠ LIMIT RECORDED: a LONE duration (hsn's `2400年前`) would still be spelled here. It is ×0 in this
   corpus, and nothing in the surface form separates it from `2014年前`.
2. **DE-GROUPING EXPOSED A CORE DEFECT.** `9,460,730,472,580,800 米` (a light-year in metres) used to read
   as six comma-separated fragments; de-grouped, it reads as **nothing at all**. Bisected:
   `9007199254740991` reads, `9007199254740992` is the empty string — the shared number path is silent above
   `Number.MAX_SAFE_INTEGER`. ×1 here; the only other ≥16-digit run in the corpus is a 59-digit π expansion,
   silent before and after. NOT FIXED — it is `src/core`, it affects all 191 languages, and a local cap on
   de-grouping would hide it. Reported to the orchestrator instead.
3. **`3%-4%` → `百分之 3-百分之 4`.** Step 4 claims each `%`, which puts Han on both sides of the dash, so
   step 7 can no longer see two digits. Re-ordering does not help (the `%` sits between the digit and the
   dash either way). ×1. Counted and declined.
4. **`‰` ×1 was dropped, and its word IS attested.** `人口自然增長率 9.8‰` — and the corpus writes
   `千分之35(3.5%)` and `千分之31至38之間`, i.e. ⟨千分之⟩ prefixing a number, twice, in its own article on
   the oceans. The shared tier has no per-mille slot, so a one-line LOCAL rule (architecture, trap 47.4),
   placed before the decimal rule for the adjacency reason.

Also confirmed from the read, with no change needed: ISBNs untouched (`ISBN 1-55849-175-9`, ×6), the
Latin-run range guard holding (`GB/T 7408-2005`), `1700喇年` left as a quantity (the magnitude breaks the
adjacency), `5.1.2600` and `0.77777...` refused by the dotted-designation and 3-digit-cap guards, and the
em-dash/space-padded date spans reading correctly (`（1858年—1937年）` → 一八五八年到一九三七年).

## Run 5 — 2026-08-11 (the span dump, and two more repairs)

Dumped every DROPPABLE match the scan fires on, with 14 characters of context, so the accepted lists could
be built from evidence rather than from the scan's one-line examples. Two of the surviving drops turned out
to be repairable rather than acceptable:

* **`面積係750萬 km²` — the km² was DROPPED ENTIRELY**, exponent and unit noun both. Chinese writes its
  magnitude BETWEEN the number and the unit, which breaks the adjacency the tier matches on. Declaring
  `magnitudes: ["萬","億","万","亿"]` closes it. Verified inert elsewhere: `第750萬名` and `收入750億元`
  unchanged, and the field's other consumer (the currency path) is not in play because no currency was
  declared at that point. This is the only genuine `km²` in the corpus — every other superscript is a tone
  number.
* **`ª` (U+00AA) was the artifact's ONE RAWMARK LEAK**, reaching the IPA inside `（Yəšaʻªyāhû）`, a
  transliterated Hebrew name. U+00AA is the superscript letter a, so folding it to `a` is its reading
  (trap 36's move — fold the compatibility character, never blanket NFKC). Safe LOCALLY and only locally:
  `º` is in the RAWMARK class because Italian writes `dell'11º` as an ordinal, and Gan writes neither as one
  (`º` ×0, `ª` ×1, ordinals are 第N). `core/unicode.ts` folds neither; widening the shared list is a fleet
  change with its own measurement.

The rest is the family's usual residue, and the dump is what makes each refusal checkable:

```
math-sign  the Gan verb-complement GRAMMAR SCHEMA “動詞+得+補語+賓語” ×10 in one paragraph · C++ ×4 ·
           set-theory (`2'=0' ' '={0,1,2}={0,{0}}`) · balanced chemical equations · LaTeX bodies ·
           `36.1±2.6ka` (a dating tolerance) · `名 + 爺名 + 姓` · `沃虎+585` · EasyTimeline `PlotArea = left:10`
degree     coordinates, compass bearings (`係N90°E或者S90°E`), and an article ABOUT the sign
           (`符號係「°」`, `一份就係1度（1°）`) — plus ONE real temperature, `熔點380℃`
minus      4 coordinate spans + the `3%-4%` above. Every REAL negative is now read.
exponent   `10⁻¹⁹`, `10⁻²⁷`, `/c²`, `cm³` (mantissa notation and an undeclared one-letter unit) — and the
           tone numbers: `/ŋa²¹³ ɕi³⁵ ŋa²¹³ t͡siiu⁴²/`, `/tʰi¹¹ tɕʰiu²⁴/`, `[kɔŋ⁴⁴ tsʰik⁵ min³⁵]`
```

## Run 6 — 2026-08-11 (attest.ts, and a refusal that reversed)

`sources.ts` said `[NONE] letter-names` (espeak ships no Gan), `[NONE] decimal-point`, `[NONE] scale-names`
— so the wiki is the only second tier this language has. Probed it.

```
$ npx tsx tools/normalization/attest.ts --lang gan --words 同到,點,負,百分之,千分之,分之,到,平方,公里
  all attested*  (⚠ unspaced script — trap 19: the count is a SUBSTRING count and the EXAMPLES are the
                  whole of the evidence, so they were read)
  同到 32/20 articles, coordinating in every example — 美國英語同到英國英語 · 火車、汽車、人力車同到畜力車
  分之     `完隻條式讀出做「 b 分之 a 」` — the wiki spelling out the fraction construction itself
$ npx tsx tools/normalization/attest.ts --lang gan --words 立方,立方公里,美元,美金
  立方     3/3   `鄱陽湖嗰面積係3210平方公里，含水量係25.2立方公里`  — square and cube, one sentence
  美元     5/4   `註冊資金有11095萬美元，總投資近3億美元` · `身價達38.5億美元`  — monetary amounts
  美金    12/9   `美金（United States dollar），又叫美圓、美元，符號USD或者US$`
```

**TWO REFUSALS REVERSED, both recorded as reversals rather than quietly changed.**

* **CUBED.** ⟨立方⟩ is ×0 in the artifact, which is exactly the evidence hak used to decline its cognate.
  The wiki writes it ×3 in the volume slot, once onto this layer's own unit noun. Declared, and labelled at
  the declaration as robustness on the weaker tier — 0 corpus lines change.
* **THE DOLLAR.** On corpus evidence alone this was a guess of the Fula `tere` kind: 4 `$` in ONE article
  (a film's box office, labelled UK takings) and one 美金 in a fine. The wiki closes it three ways — 美元
  ×5 in real monetary amounts, the wiki's own gloss of the SYMBOL (`符號USD或者US$`), and the corpus's own
  `$363,889,678`, which is that film's WORLDWIDE gross and therefore USD by convention whatever the
  article's "UK" label says. Declared `$: ["美元"]`, matching wuu and yue. **The `ACCEPTED_SILENT` currency
  entry that had already been written for gan was then DELETED**, per that table's own rule that an entry
  which can no longer fire is worse than no entry.

Final corpus diff and scan:

```
changed 191/368 (51.9%)
  before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 1, DROP: 76, THROW: 0 }
  after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 40, THROW: 0 }

$ mine.ts scan → no defects
   (ACCEPTED math-sign ×21 · degree ×9 · exponent ×9 · minus ×3 · iteration ×1 · ACCEPTED-CLASS degree ×3)
$ review.ts --lang gan → checklist clean (10/10)
$ sources.ts --lang gan → percent-word ok · currency-word ok · ampersand-word ok · exponent-word ok
   ⚠ `minus-word` still reports `chk?` and that is a TOOL limitation, not a gap: gan's minus rule is LOCAL
   rather than a tier declaration, and the check reads tier declarations. review.ts's sign probe shows it
   reading (`-5` → fu˩˩ ŋ̍˨˩˧).
$ npx vitest run → 234 files, 3416 passed, 5 skipped
$ npx tsc --noEmit → clean
$ referee-eval gan → unchanged: there IS no referee (see Run 1). No number moved because none exists.
```

Read all 191 changed utterances at text level. The one judgement call left standing is the ampersand: of
the `&` that survive the registry's markup strip, ONE is Han-flanked (`咸摩斯密史&實第線`) and about eleven
are inside Latin runs (`Dolce & Gabbana`, `Tiffany & Co.`, `R&B`, `rock & roll`), which now read with a Gan
syllable inside an English name. Not declaring it merges `R&B` into one token — playbook trap 18's exact
hazard — and the tier cannot condition on the surrounding script without a core change. Declared, with the
ratio recorded in the file rather than hidden.
