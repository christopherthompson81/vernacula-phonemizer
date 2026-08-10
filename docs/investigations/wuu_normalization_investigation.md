# wuu (Wu Chinese / Shanghainese) — text normalization

Giving `wuu` the normalization treatment: a `src/languages/wu/normalize.ts` pre-tokenizer pass, per
`docs/normalization_playbook.md`. Wu is the third Sinitic language treated (after cmn and yue), so the
*procedure* is settled and the question is which of the Sinitic rule shapes Wu's own corpus and lexicon
support, and where Wu differs.

**Evidence base, stated up front because it bounds every count below.** wuu has no FLEURS corpus. The
corpus of record is `tools/corpus/mined/wuu.jsonc` — dump-sourced (wuu.wikipedia pages-articles,
52,005 paragraph segments), so its whole-corpus `counts` block is a real rate, but only 237 excerpts of
text are retained in the artifact and **the dump itself is no longer on disk**. So: cell counts are
corpus-wide and trustworthy; per-WORD counts are over the 237 excerpts and are leads only. The second
source is `tools/normalization/attest.ts` against wuu.wikipedia — a weaker tier, and in a spaceless script
it can only ever return `attested*` (playbook trap 19), so **the prose it prints is the evidence, not the
verdict**.

---

## Run 1 — 2026-08-09 19:36 — where the engine stands before any rule

`npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/wuu.jsonc --lang wuu`

```
DROP percent       ×38     DROP math-sign ×16    DROP exponent  ×11
DROP iteration     ×10     DROP degree    ×8     DROP minus     ×5
DROP currency      ×4      DROP ampersand ×1     LEAK DIGIT     ×23
MARKUP math-sign   ×2      MARKUP exponent ×1    REDUNDANT currency ×2
```

Then probed the attested surface forms through `phonemize(…, "wuu")`. The defect list is what the engine
*produces*, not what I assumed:

| form | current reading | what is wrong |
|---|---|---|
| `50%` | ŋ̍˨ səʔ˦ | sign silently dropped — reads "fifty" |
| `50％` | ŋ̍˨ səʔ˦ | full-width ％ likewise — because no symbol tier was wired at all, not because the tier cannot read it. `normalizeSymbols.ts` accepts `[%٪％]`; the yue header still says otherwise and predates that fix, so no local ％ fold is needed here |
| `1‰` | iʔ˥ | per-mille dropped — reads "one" |
| `1,000人` | iʔ˥ **,** lɪɲ˩˧ zəɲ˩˧ | grouping comma is a RAWMARK **and the value is destroyed**: the tokenizer splits `\d+`, so 1,000 → 一 + 零 |
| `2009年` | ɲi˨ t͡sʰi˦ lɪɲ˩˧ t͡ɕjɤ˧˦ ɲi˩˧ | cardinal 二千零九年; a year is read digit-by-digit |
| `1990年代` | 一千九百九十年代 | same, and `年代` is the decade word |
| `3.5米` | sɛ˥˧ **.** ŋ̍˩˧ mi˩˧ | decimal point raw |
| `11:30` | zəʔ˨ iʔ˦ sɛ˥ səʔ˧˩ | colon dropped, no 点/分 |
| `1/5` | iʔ˥ ŋ̍˩˧ | reads "one five"; Chinese is 五分之一 |
| `20°C` | əl˥ səʔ˧˩ **sˈiː** | ° dropped and the scale letter read as an ENGLISH letter name |
| `121°09′30″` | 一百二十一〇九三十 | coordinate marks all dropped |
| `5³` | ŋ̍˩˧ | exponent dropped entirely |
| `70人/km²` | t͡sʰiʔ˥ səʔ˧˩ zəɲ˩˧ **ˈʊkm** | rate slash dropped, `km²` read as English |
| `2-3公里` | ɲi˩˧ sɛ˥˧ koŋ˥ li˧˩ | range dash dropped |
| `0-14岁` | 零十四岁 | same |
| `$500`, `£187,500` | currency dropped | |
| `A&B` | ˈə bˈiː | ampersand dropped |
| `5+3`, `5=3` | ŋ̍˩˧ sɛ˥˧ | operators dropped |
| `佐々木` | t͡su˧˦ moʔ˩˨ | the iteration mark 々 dropped — a whole syllable lost |

`&nbsp;` is NOT in this list: `src/core/markup.ts` decodes entities at the registry dispatch point, so it
already arrives as a space. That matters because the artifact's `ampersand: 277` is dominated by `&nbsp;`
— the cell count overstates the real ampersand traffic by an order of magnitude, and reading the instances
is what showed it (playbook: a count is a lead).

**Corpus-wide cell counts, which is what sizes the rules:** year 25,376 · digit-run 25,580 ·
decimals 5,336 · latin-in-native 23,821 · initialism 3,430 · version-dot 2,870 · grouped 2,577 ·
clock 1,688 · letter-name 1,677 · signs 1,069 · ranges 1,001 · percent 680 · roman 633 · abbrev 502 ·
rate 388 · degrees 241 · units 241 · exponent 202 · fractions 128 · arithmetic 110 · signed-number 91 ·
ordinal-latin 77 · zero-width 51 · iteration 11 · currency 6 · sports-time 3.

So the layer's mass is: **years, decimals, grouping, percent, ranges** — in that order. Everything else is
a tail.

### Sourcing every word before writing a rule

The rule vocabulary has to come from somewhere. Two hard constraints particular to this language:

1. **A word must be in `src/languages/wu/dict.tsv`** or the Han→Wugniu front end cannot read it — an
   unlisted character is *skipped*, silently. This is a stronger gate than most languages have, and it is
   checkable: `grep -P "^<word>\t"`.
2. **A word must be Wu's, not Mandarin's.** The dict will happily read any Han string; that it produces
   IPA says nothing about whether Shanghainese says it.

| word | in dict.tsv | corpus / wiki evidence | verdict |
|---|---|---|---|
| 百分之 percent | `paq5 fen9 tsy3` | wiki: 百分之七十八 / 百分之六十 / 平均盐度百分之3.5 | ✓ percent word |
| 千分之 per-mille | (composes 千 + 分之) | corpus **defines it**: “像1‰，即代表千分之一” ×2 | ✓ and the citation is definitional |
| 分之 fraction | `ven2 tsy4` | corpus ×7: 四分之一, 十分之一, 三分之二, 2/3 → … | ✓ fraction word |
| 点 decimal point | `ti0` | corpus's 33 hits are ALL the noun (高点, 特点, 观点) | ⚠ see below |
| 到 range | `tau0` | corpus: 南北宽13**到**18公里; 5.5**到**9.5公斤 | ✓ range connective |
| 至 range | `tsy0` | corpus: 121°09′30〃**至**121°54′00〃 (coords), 8°30′**至**23°22′ | ✓ |
| 搭 and | `taq7` | corpus ×176 — the Wu conjunction (搭仔, 搭…) | ✓ ampersand word |
| 两 two-before-classifier | `lian6` | corpus: 两个大都市, 两国, 两轮车, 两座, 两只岛 | ✓ |
| 摄氏度 Celsius | `seq5 zy9 du3` | wiki: 平均温度为**17摄氏度**, 1月份平均温度**5.0摄氏度** | ✓ **and POSTPOSED** |
| 华氏 Fahrenheit | 华+氏 | wiki: 每等分为**华氏1度**, **华氏零度** | ✓ **and PREPOSED** |
| 度 degree | `du6` | with the two above; corpus's bare 度 hits are 深度/密度/速度 | ✓ in the scale forms |
| 公里 km | `kon5 li3` | corpus ×54 | ✓ |
| 平方公里 km² | `bin2 faon4 kon4 li4` | corpus ×37 | ✓ |
| 公斤 kg | `kon5 cin3` | wiki: **單位符号kg**, 重5.5到9.5公斤, 900公斤以上 | ✓ (and the article states the kg↔公斤 equation) |
| 美元 USD | `mhe5 gnioe3` | corpus ×6 (250亿美元) | ✓ |
| 英镑 GBP | `in5 paon3` | corpus: 三十六万七千五百**英镑** (£367,500 GBP) | ✓ |
| 等于 = | `ten5 yu3` | corpus ×1: 搿个数值**等于**是—— $1,125,4… | ✓ (thin, but the sense is exact) |
| 小于 < | `siau5 yu3` | corpus ×1 | ✓ |
| 加 + | `ka1` | corpus's 47 hits are ALL bound (外加, 加勒比, 新加坡, 加工, 增加, 加拿大); wiki adds only 汤加, 毕加索 | ✗ **declined — see Run 2** |
| 乘 × | `zen6` | corpus's 2 hits are 乘坐 "to ride" | ✗ declined, same reason |

**⚠ 点 as the decimal point is the one word I am shipping on a non-corpus argument**, and the playbook
names this exact trap (Igbo's `ǹtụ̀kpọ`): *a written corpus is the weakest evidence there is about how a
SYMBOL is spoken* — writers type `3.5`, they never spell out how they would say it, so the decimal word
scores zero in every corpus and is still universal. It is in the dict, it is the reading cmn and yue both
ship, and the corpus's 5,336 decimals otherwise leak a raw `.` into the phoneme stream. Recorded here as
a stated assumption rather than an attestation.

**Two Wu-specific findings that a copy of the Cantonese layer would have got wrong:**

- **The conjunction is 搭, not 和.** 搭 ×176 vs 和 ×40 in the excerpts, and 和 in Wu prose is mostly the
  bound morpheme (共和国, 和暖). yue ships 和; wuu must not.
- **The temperature words sit on OPPOSITE SIDES of the number.** Celsius is postposed (`17摄氏度`) and
  Fahrenheit preposed (`华氏1度`), both straight from wiki prose. Cantonese ships 攝氏N度 for both. This is
  not a symmetry I would have guessed, and it is the reason for probing the two words separately.

**Next:** decide the ranges rule (the corpus's dashes are years, ages, temperatures and percentages —
Cantonese declined bare numeric ranges over the sports-score ambiguity, and I need to check whether wuu's
corpus has that ambiguity), then write the layer.

---

## Run 2 — 2026-08-09 19:45 — the layer, and what the corpus said about each refusal

Wrote `src/languages/wu/normalize.ts` (13 ordered steps), wired it into `wu.ts`'s `text()` **after** the
whole-string-Wugniu fast path — a romanized reading is `[a-z]+[0-9]` runs and the number rules would
otherwise be free to claim its TONE DIGITS.

### The refusals, each with the number that forced it

The point of this section is that three of these looked like easy wins until they were counted.

- **The clock.** `clock: 1688` in the artifact made this look like the third-biggest class in the language.
  It is not: the cell's regex is `\p{Nd}{1,2}[:.]\p{Nd}{2}` — the `[:.]` alternative — so that count is
  overwhelmingly **decimals**, which its own hard-set examples confirm (`99.37%`, `59.55千米`, `813.69`).
  Every real `H:MM` in the retained text is a sports time or a UTC timestamp with a **third field**:
  `13:15.10`, `13:02.80`, `2:08:44`, `2:00:25`, `17:47:23`, `08:08:50` — 6 of 6. Meanwhile Chinese writes
  the time of day as 19时35分 and the corpus does exactly that (`2006年8月21号19时35分`), which the dict
  already reads. A colon rule here would claim only the shapes it must not. **Declined**, and the decimal
  rule's lookbehind was widened to `(?<![\d.:])` so it does not half-claim `13:15.10` either.
- **The relational signs.** 等于 and 小于 are in the dict *and* corpus-attested in sense, so this looked
  free. Then: of 20 `=` in the retained text, one is digit-flanked (`195 kg ÷ 3 = 65 kg`) and the rest are
  **wiki section headings** (`== 参考文献 ==`) and LaTeX formula bodies. Reading the sign would say
  *等于等于 参考文献 等于等于* aloud on every article. `<` and `>` occur **zero** times. The word was
  sourced and the sign was not what the count implied.
- **`+` and `×`.** 22 `+`, one digit-flanked (a programming tutorial computing `3+2`); one `×`, and it is
  scientific notation (`5.97×10²⁴千克`). Independently, neither word has an attested operator sense —
  all 47 corpus hits of 加 are bound (外加, 加勒比, 新加坡, 加工, 增加, 加拿大) and both 乘 hits are 乘坐.
- **Bare numeric ranges.** Cantonese declined these over sports scores. wuu's corpus has no scores but has
  three other things a bare `N-M` rule would wreck: **bus route lists** (`公交车8 - 31 - 32 - 46 - 49D -
  55 - 63`), **model numbers** (`747-400`, `Qwen2.5-72B`) and a **tone notation** (`223-33`). So the rule
  is claimed only with a unit, scale or magnitude on the right — which covers every genuine instance
  (`3-5月`, `2-8°C`, `31-32‰`, `15-25公里`, `50-100公里`, `3.5—4.5米`, `10～13吨`, `6-13世纪`, `0-14 岁`,
  `7%-10%`) and none of the three.
- **The rate slash in general.** Only the population-density shape is claimed, because only it has an
  attested reading: the corpus writes the same fact in words as `人口密度是每平方公里813.69` — the
  per-phrase FIRST, then the number. The shared tier cannot express that ordering, so it is local.

### Three things measurement changed after the first draft

1. **`7%-10%` did not fire.** The left `%` sits between the number and the dash, so `\d+\s*-` never
   reached it. The sign is now captured and re-emitted (playbook trap 10), which is what lets the percent
   tier read *both* halves: 百分之7到百分之10.
2. **`1969年～1976年` lost its connective.** 年 sits *between* the number and the dash, so neither the
   year-range rule nor the quantity-range rule could see it; each endpoint got its digit reading and the
   range silently vanished. Third arm added.
3. **The backslash rate variant is unreachable, and claiming it would have been dead code that reads as
   coverage.** The corpus contains `70人\km²`, so the first draft matched `[/\\]`. But `core/markup.ts`
   strips a backslash followed by letters as a LaTeX control sequence, so that string arrives at this layer
   as `70人 ²` — the unit is already gone. Verified directly (`stripMarkup("70人\km² 488/km²")` →
   `"70人 ² 488/km²"`). The alternative was removed and the residue recorded as one `MARKUP exponent` line.

### `1,400－1,500万元` — the guard that a year-range rule needs and Cantonese does not have

De-grouping turns this into two 4-digit numbers with a dash, which is exactly the year-range shape. It is a
**quantity** (capital of 14–15 million yuan), and the digit-by-digit reading 一四零零到一五零零万元 would
be confidently wrong. The year-range rule now refuses when a magnitude or currency word follows, and step 6
claims it with the cardinal instead. This instance is the whole reason the guard exists.

## Run 3 — 2026-08-09 19:52 — gates, and two defects that were not in this layer

```
npx tsx tools/normalization/corpus-diff.ts compare --before … --after … --corpus mined:wuu
  changed 259/436 (59.4%)
  before  { DIGIT: 23, SLOT-GAP: 0, RAWMARK: 0, DROP: 89, THROW: 0 }
  after   { DIGIT:  0, SLOT-GAP: 0, RAWMARK: 0, DROP: 28, THROW: 0 }
```

`npx vitest run` 3,237 pass · `npx tsc --noEmit` clean · `review.ts --lang wuu` checklist clean.
There is no referee gate: wuu has none, and the maturity row says why (the whole modern Wu ecosystem
derives from the one Wugniu tradition, so any automated referee is circular).

### The DIGIT leaks were never a normalization defect

23 utterances carried an ASCII digit into the phoneme stream **before and after** the layer, so the layer
was not the cause and would not have been the fix. Chasing them found the real one: `syllableToIpa`'s
"leave the romanization visible" fallback, firing on dict readings whose rime no table matched.

Measured over all **224,129** syllable tokens in `dict.tsv`: **328 unmapped, in 31 distinct forms**, and
they were three families, not noise —

| family | tokens | what it actually is |
|---|---|---|
| `kn-` (kni, kniau, knian, knieu) | 253 | ⟨kn⟩ is to ⟨gn⟩ ɲ what ⟨mh nh lh ngh⟩ are to ⟨m n l ng⟩ — **the one missing member of the glottalized series**. 仰光 read *knian5 kuaon3* |
| bare `mh` / `nh` | 44 | a glottalized nasal used **syllabically**: the initial matched and left an EMPTY rime. 姆妈 — [ʔm̩ma], one of the most ordinary words in the language — was half ASCII |
| `nka6`, `nk6`, `jiaen6` | 5 | genuinely unresolved; 5 tokens in 224,129, left alone |

Two lines of manifest/table (`"kn": "ʔɲ"`, and `mh/nh/ngh` in `SYLLABIC`) take it from 328 to 5, and the
corpus diff's DIGIT class from 23 to 0. Fixed where it lives, per playbook step 3 — writing a normalization
rule on top of it would have hidden it.

**仰光 → ʔɲjɛ̃˥ kwɑ̃˧˩ · 姆妈 → ʔm̩˥˧ ʔma˥˧**, both pinned in `test/wu-normalize.test.ts`.

### The scan residue, all of it argued rather than silenced wholesale

`ACCEPTED_SIGN_SILENCE.wuu` takes the eight sign classes above with their counts. `ACCEPTED_SILENT.wuu`
takes four instance classes, and one of them is a hazard specific to the Sinitic dirs:

- **A superscript in a Wu article is often a CHAO TONE NUMBER, not a power.** The language's own phonology
  is written with them and wuu.wikipedia does it constantly: `khan³⁵-ban⁵⁵-kae³¹`, `[ʑin²²ø⁵⁵tɕʰy²¹]`,
  `di⁶ jieu⁶`, `doŋ²²³`. Silence is the *correct* reading; a rule that voiced them would read a
  pronunciation gloss as arithmetic. Instance-listed rather than class-silenced so a `km²` regression stays
  visible — `km²` **is** read.
- The residual minus instances are all **negative exponents in SI units** written with a spaced ASCII
  minus (`kg·m·s −2`, `g·mol −1`, `g·cm −3`) plus one line of Japanese mathematics copy (`m = −1`). None is
  arithmetic. They are instance-listed because `acceptedSignClass` tests a sign regex against a *single
  character* and the minus pattern is contextual (`(?=\p{Nd})`), so a class-level refusal can never match
  it — the same limitation `tl`'s entry already records.

### Left undone, with the numbers so the next reader can re-check in one command

- **Embedded Latin** — `latin-in-native: 23821`, `initialism: 3430`, `letter-name: 1677`. The largest
  untreated class in the language by an order of magnitude, and the same call cmn and yue made:
  `core/initialisms.ts` needs a letter-name table `dict.tsv` does not carry (no A/B/C entries to
  back-derive from). This is the one place where a real gap remains rather than an argued refusal.
- **`m³` and `公分³`** — one instance each. The metre is deliberately undeclared (米 is one character and
  inseparable from 米勒 "Miller" in an unspaced script, the yue reasoning), and a superscript on a *Han*
  unit is outside what the shared tier can key on.
- **`GDP％`** — a statistics-table column heading where the sign follows an initialism with no number in
  reach. The tier is right to require one.
- **The 万/萬 reading split.** Noticed in passing and NOT touched: `dict.tsv` gives 一万 as `iq5 moq3` but
  the standalone traditional 萬 as `ve6`, and `integerToHan` emits the traditional 萬/億, so every large
  cardinal takes the `ve` reading while the dict's own compounds take `moq`. That is a back-end question
  about the dict, not about this layer, and it wants its own measurement.

---

## Run 4 — 2026-08-09 20:30 — the initialism refusal was wrong, and the reason it was wrong is instructive

Run 3 left embedded Latin on the English phonemizer "as cmn and yue both decided", with the reason that
`core/initialisms.ts` needs a letter-name table `dict.tsv` cannot supply. Challenged on it, and the
challenge was right. Three things I had got wrong:

1. **The seam already exists and I said it did not.** This is playbook trap 16 verbatim — *before declaring
   a class out of scope, check whether the seam already exists*. `core/initialisms.ts` takes exactly
   `letterName: (letter) => orthographic form`, and **ja is the worked example of the shape**: letter →
   katakana → g2p. Nothing needed building.
2. **My dict claim was understated rather than wrong.** yue's dict carries 13 Latin letters; wuu's carries
   **zero**. So wuu is worse off than the language I cited as precedent, not better.
3. **The defect is PHONOLOGY, not letter identity** — which is what makes it fixable. `中国GDP总量` read
   *t͡soŋ˥ koʔ˧˩ **ɡˈiːdˈiːpʰˈiː** t͡soŋ˥ ljɛ̃˧˩*: English [iː], English stress marks, and **no tone at
   all**, inside a tonal utterance.

### What a Wu speaker actually says, and the source for it

espeak-ng's `cmn_list` carries a block headed **"Latin letters with Chinese accent"**: `a ei51 · b pi51 ·
c sei55 · d ti51 · w ta35pliou · x ai35ks`. Those are the **English letter names in local phonology with
local tones** — the names are English-derived across Sinitic; only the phonology is native. So the fix is
ORTHOGRAPHIC: spell the name in Han, let the dict read it. (espeak has that block **commented out**, with
its reason in the file: *"This will make letter within English sentence translated not correctly. i.e. 'ma
is a horse'. 'a' will be translated as ei51."* That kills a blanket letter rule, not an all-caps-scoped
one — and it is why the guards below are what they are.)

**The one corpus-attested spelling anchors the method.** wuu.wikipedia writes
`X射线（英语：X-ray），又被称为爱克斯射线、艾克斯射线`. espeak's `x ai35ks` decomposes to ai-ke-si —
艾克斯, exactly. ⚠ And the count was a lead, not the finding: 艾克斯 returns 6 hits and **4 are the French
place name Aix** (艾克斯莱班, 普罗旺斯地区艾克斯, 艾克斯岛). One instance is the letter, and it is the one
that matters.

### ⚠ The spellings are chosen by the WU reading, not inherited from Mandarin

This is the part a copied table would have got wrong, and it is the same lesson as 搭-not-和 one level
deeper. **Wu kept the Middle Chinese voiced series; Mandarin lost it**, so the standard Chinese letter
transliteration systematically misreads here:

| letter | Mandarin convention | its Wu reading | shipped | why |
|---|---|---|---|---|
| B | 比 | [pi] | **皮** [bi] | Wu HAS /b/ — 皮 is Mandarin's *P* and Wu's *B* |
| P | 皮 | [bi] | **披** [pʰi] | so P needs the aspirate |
| D / T | 迪 / 提 | [diʔ] / [di] | **地** [di] / **梯** [tʰi] | same contrast; 迪 also adds a checked coda |
| E | 伊 | [ji] | **衣** [i] | 伊 adds a glide the letter name has not got |
| R | 阿儿 | [a **ɲi**] | **阿尔** [a **əl**] | 儿 has NO rhotic reading in Wu; 尔 is [əl] |
| V, Z | 维, 兹 | approximated | **维** [vi], **兹** [zɿ] | Wu says these outright |

**J is the one the language simply cannot say.** "Jay" wants [d͡ʑɛ]; a search of every single-character
dict entry returns **zero** readings of d͡ʑa/d͡ʑɛ/d͡ʑo — Wu's palatals do not combine with a low vowel. So
杰 [d͡ʑiʔ] keeps the consonant and the phonotactics take the vowel. That is nativization doing its job,
not a table defect.

### Three guards, each drawn from a count rather than a feeling

- **Length 2–4.** All-caps runs in the artifact: **110 tokens at 2–4 letters, every one an initialism**
  (GDP PHP SNCF UTC ISBN TVB LG GPU DVD CD NGO…), against **4 tokens at 5+**, three of which are all-caps
  ENGLISH WORDS or names (PROJECT, LAWSON, LOUBAT) that must stay on the English reader. The corpus drew
  the line; I did not pick it. Honest cost at the boundary: NASA, TURE, DASH, COOH get spelled out — which
  is `core/initialisms.ts`'s own stated bargain.
- **`[IVX]{2,3}` excluded.** `core/roman.ts` runs in the registry *wrapping* `engine.text()`, so it has
  already claimed every numeral it will; what reaches this layer is what it declined (`第II次`,
  `世界大战II`). Of the 65 distinct all-caps runs, **7 parse as Roman numerals — II III CD DC ML MV XL —
  and only the first two are numerals.** A blanket "is it a valid numeral" test would have lost all five
  initialisms to protect two; `[IVX]{2,3}` protects both and costs none.
- **A lone letter only when it touches Han.** `X光`, `地铁B线`, `A股`, `T恤` are letter-read; a bare single
  letter in Latin context is a math variable or a chemical symbol. Measured: the artifact has **6**
  Han-adjacent single uppercase letters and **all 6 are letter-reads** (`P.C.亚历山大`, `里昂地铁B线`,
  `里昂地铁A线`, `C++原始码`, `ADS-B应答器`, `日本7&I控股公司`), while every math/chemistry single letter in
  it (`f(x)`, `C 9 H 8 O 4`, `m = 2`) is Latin-flanked and untouched.

### ⚠ The letters must be SPACE-SEPARATED, and that is load-bearing

`hanRun` segments by **greedy longest match**, so a letter-name string run together can be swallowed as a
real word and take that word's sandhi melody. Found by a failing test: `GDP` → 其地披 fused across the
D–P boundary. Measured over all **676 letter pairs, 10 spellings contain a dict word spanning the letter
boundary** — 西欧 (CO, "Western Europe"), 地区 (DQ, "region"), 地衣 (DE, "lichen"), 娃娃 (YY, "doll"),
开恩 (KN), 区区 (QQ), 地皮 (DB), 西区 (CQ), 披衣 (PE), 开开 (KK). A space makes each letter its own Han
token, which also gives it the **citation** tone — right for a spelled letter, since each is its own
prosodic word rather than a syllable inside one.

### A pre-existing leak found on the way

`MP3` phonemized to the **string `MP3`**. The whole-string Wugniu fast path was `/^[a-z]+[0-9]…$/i` — the
`i` flag — so any all-caps letters-plus-digit token matched it, was handed to `wugniuToIpa`, found no rime,
and was returned verbatim by the "leave the romanization visible" fallback. Wugniu is written lowercase;
an all-caps alphanumeric run is a designation. Flag dropped, `zaon2 he4` still reads zɑ̃˨ hɛ˦.

`MP3`'s letters still route to English, deliberately: an uppercase run glued to a digit is an alphanumeric
CODE, which is the position `core/roman.ts` and `core/initialisms.ts` both already take
(`\p{Lu}+(?=\d)` is a code, not an acronym). Following the fleet beats diverging locally.

### Gates

Corpus diff unchanged on the leak classes — DROP 89→28, DIGIT 23→0, RAWMARK/SLOT-GAP/THROW 0 — with
**80 more utterances changed** by the letter rule (259 → 294 of 436). Reading them: `地铁B线` bˈiː → bi˩˧ ·
`IIT` ˈiːʲᵻt → a a tʰi · `GCE` d͡ʒˈiː sˈiː ˈiː → d͡ʑi si i · `ABO` **ˈɑːboᶷ** (read as a WORD) → ɛ bi ɤ ·
`ISBN` ˌaᶦˌɛsbiːʲˈɛn → a ɛ sɿ bi əɲ · `SNCF` → ɛ sɿ əɲ si ɛ fu · and the corpus's own `X光` →
ŋɛ˩˧ kʰəʔ˥ sɿ˧˩ kwɛ̃˥˧, the attested spelling landing on the attested instance.
3,240 tests pass · `tsc` clean · `review.ts --lang wuu` checklist clean.

**Still on the English reader, and correctly**: foreign proper names (Perl, Debian, Grenelle, Rasmus) and
quoted English (`East China Sea`) — ~88% of the artifact's 883 Latin runs. They are not Wu words in the
first place.

**Open, and now the only real gap left**: cmn and yue ship the identical defect and have better dicts to
fix it with (rime-cantonese carries 13 letters). This wants to be the same change in both, which is a
separate measurement per language and not something to fold into a wuu commit.
