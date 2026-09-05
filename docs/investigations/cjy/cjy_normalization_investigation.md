# cjy (Jin Chinese, Taiyuan) — text normalization

Giving `cjy` the normalization treatment per `docs/normalization_playbook.md`. The fifth Sinitic language
treated (after cmn, yue, wuu, nan) — and the first with **no corpus at all**.

---

## Run 1 — 2026-08-09 22:55 — there is no Jin corpus, and the artifact proves it

`tools/corpus/mined/cjy.jsonc` did not exist, so step 0b was the first job. It could not be done the usual
way:

- **`cjy.wikipedia.org` does not resolve.** There is no Jin Wikipedia. (gan, hak and cdo have one, which is
  why they have artifacts; cjy and hsn do not.)
- **No FLEURS.**
- **The Wikimedia Incubator has `Wp/cjy`** — 159 pages, and that is the whole of it: 15,088 characters of
  raw wikitext, **3,060 of them Han**, most of the rest CSS and markup from the main page. After stripping,
  8,634 characters of which 2,724 are Han. One real article (汾陽市, 744 chars).

Mined anyway, because a thin artifact that is honest beats none — and its own output is the finding:

```
covered 7/35 cells
EMPTY: degrees fractions units ranges currency percent grouped ampersand exponent arithmetic … (28 of them)
```

⚠ The playbook says *an empty cell is not evidence, it is a query to run or a tool bug*. Here it is neither:
**the query has been run and the text does not exist.** So this layer cannot be sized by frequency, and the
corpus diff cannot carry its usual weight. Every rule below rests on the two tiers that DO exist, and the
file header says so.

### Tier 1 — the shipped dict, which is a HARD, CHECKABLE gate

`src/languages/jin/dict.tsv` is 6,467 Wiktionary/kaikki entries tagged `["Jin","Taiyuan","Sinological-IPA"]`.
The shared engine (`sinitic/hanDictIpa.ts`) segments by greedy longest match and **skips an uncovered
character silently**. So "does this word speak in Jin?" is a question with a yes/no answer, and it is the
gate every emitted word had to pass:

```
SPEAKS   百分之 · 分之 · 点/點 · 到 · 和 · 跟 · 公里 · 公尺 · 公斤 · 米 · 平方 · 立方 · 元 · 块 · 个/箇 · 零 · 秒
SILENT   度 · 摄氏/攝氏 · 两/兩 · 正 · 减
HALF     等于 → təŋ˥˧ — ONE syllable: 于 is silent, so it would say "děng" and drop "yú"
```

That decides four refusals on fact rather than taste: **no degree rule** (度 is silent, so `20°C` would
lose the word as well as the sign), **no 两 classifier rule**, **no relational signs**, and nothing that
leans on 摄氏.

### Tier 2 — the incubator text, thin but the language's own

| word | count | what it shows |
|---|---|---|
| **和** | 16 | coordinating, in `吳語、粵語和閩南語` — the ampersand slot |
| 跟 | 5 | the colloquial alternative; 和 is 3× commoner here |
| **到** | 5 | `到了1996年`, `到2007年` — "up to", the range slot |
| 公里 | 2 | |
| **箇** | 15 | ⚠ Jin writes its classifier **箇**, not 个 (×4) — a genuinely Jin-specific orthographic fact |

## ⚠ Run 1b — the probe that mattered more than the layer: 8–26% of running Han text is SILENT

The engine skips uncovered characters, so a sparse dict does not mis-read — it says **nothing**, and no leak
class can see a character that left no trace. Measured over real running Han text, both scripts:

```
                        SIMPLIFIED (cmn corpus)   TRADITIONAL (yue corpus)
cjy                            13.6%                    16.2%
gan                            22.2%                    25.8%
hsn                            14.4%                    16.3%
hak                             7.6%                    10.1%
wuu · cmn                       0.0–0.1%                 0.0%
yue                            20.3%                     0.0%   ← script confound, not sparsity
```

⚠ **The yue row is the reason this needed both columns.** Its 20.3% on simplified text drops to 0.0% on
traditional: rime-cantonese is a traditional dict, so simplified input fails silently. That is a real
defect too, but a different one — and reading only the first column would have filed it under the same
heading as cjy's, which is genuine sparsity in *both* scripts.

⚠ **And an earlier version of this probe reported 99.9% silent for every one of them, including wuu**, whose
layer I had just shipped and knew to work. `chars.tsv` is sorted by CODEPOINT, so `slice(0, 3000)` sampled
CJK Extension A (㐀 㐁 㐄 㐅) rather than common characters. An absurd number announcing itself is the lucky
case; the confound above is the one that would have shipped.

**Not fixed here** — it is a data-coverage problem in four engines, not a normalization one, and it wants
its own sourcing decision (widen the kaikki extraction, or fall back across Sinitic varieties, or accept and
document). Recorded with the counts so it is re-runnable in one command.

---

## Run 2 — 2026-08-09 23:00 — the layer, and what the dict check decided

`src/languages/jin/normalize.ts`, wrapped around the shared engine in `jin.ts` rather than wired inside it —
`sinitic/hanDictIpa.ts` also serves gan, hak and hsn, none of which has a layer yet, so a hook there would
either apply Jin's rules to them or need a per-language branch in shared code.

### What was broken

```
1,000    →  iəʔ˨ , liŋ˩˩          the grouping comma as a clause pause — the VALUE gone
1996年   →  一千九百九十六年        the cardinal, where Sinitic reads a year digit by digit
3.5      →  sæ̃˩˩ . vu˥˧          decimal point raw
50%      →  vu˥˧ səʔ˥˦            sign dropped
1/5 · 2-3 · A&B · km²             all dropped
```

### ⚠ The dict check decided the refusals, and it is a stronger reason than a corpus count

Because the engine **skips an uncovered character silently**, "does this word speak?" has a yes/no answer,
and a rule built on a silent word would DELETE it rather than mispronounce it — strictly worse than leaving
the sign unread, since a raw sign at least survives as a RAWMARK the scan can see.

```
SPEAKS   百分之 分之 點 到 和 公里 公尺 公斤 平方 立方 零一二三…
SILENT   度 · 摄氏/攝氏 · 两/兩 · 正 · 减
HALF     等于 → təŋ˥˧, ONE syllable: 于 is silent
```

So: **no degree rule** (度 silent — this is the only Sinitic layer without one), **no 两 classifier rule**
(cmn and yue both carry one), **no relational signs** (等于 would say half a word), **no currency** (⟨元⟩
speaks but is never money in the available text — 維基元, 元好問, 柳宗元).

⚠ **`plus` is refused as a PAIR with `minus`**, which is a shape worth naming: ⟨加⟩ speaks and ⟨减⟩ is
SILENT, so the layer could read an addition and not a subtraction. Reading one of a pair is a worse state
than reading neither.

### Two ordering bugs the probes caught, both already known to this sweep

- **`1996-2007年` mixed the cardinal and the digit reading.** Only the RIGHT endpoint is followed by 年, and
  the range rule in step 6 could never repair it because by then the right endpoint is Han and no longer
  adjacent to the dash. A year-range arm now runs first — the same fix cmn, yue and wuu each needed.
- **`ISO 8859-1` was read as "8859 到 1".** The guard was a one-character lookbehind, and the identifier puts
  a SPACE between its letters and the digits, so the guard saw the space. Now checked over the preceding
  characters. With no corpus to count false-positive shapes, this guard is deliberately tighter than the
  corpus-backed layers'.

### ⚠ A superscript here is a ROMANIZATION TONE NUMBER — the third Sinitic corpus, the third source

The incubator writes Jin romanized with tone digits: `Hai²-di²-lau¹ si³ Zung¹-gueh⁴ dieh⁴ hue²-gue¹-tsi²
ing²-seh⁵ gung¹-si¹`. wuu produced the same hazard from Chao tone letters in its own phonology sections and
nan from jyutping quoted in a Hong Kong article. **Expect it in gan, hak and hsn.**

### Gates, with their power stated honestly

```
corpus diff (mined:cjy)   6/36 utterances changed · DROP 7 both sides · DIGIT/RAWMARK 0
                          ⚠ 36 utterances is not a gate. It cannot move a count, and did not.
scan · review.ts          checklist CLEAN (after the ACCEPTED_SIGN_SILENCE and CITED_WORDS entries)
suite                     3,280 tests · tsc clean
referee                   NONE — cjy is 🔷 single-source (Wiktionary), so nothing cross-checks this
```

**This is the weakest-evidenced layer in the sweep and the file says so at the top.** What carries it is that
the emitted words are not dialect vocabulary choices — 百分之, 分之, 點, 公里, 平方 are the pan-Sinitic written
forms, corpus-verified in the cmn, yue and wuu layers, and every one was checked to SPEAK in the Jin dict.
The two genuinely dialectal choices were NOT inferred: 和 (×16, coordinating) and 到 (×5, "up to") come from
the incubator text itself.

---

## Run 3 — 2026-08-09 23:07 — PR review (#792)

With no corpus, the adversarial probe IS the review — there is no diff that could catch a misfire here.
Ran 24 constructed shapes. **Two defects, both shapes this sweep has met before.**

### ⚠ `2020/2021` → `2021分之2020` — a slashed year pair read as a fraction, for the third time

Javanese guarded exactly this (`taun 1985/1986`) and Min Nan's whole fraction rule was **removed** when its
only digit/digit slash turned out to be `Fahrenheit 9/11`. cjy has no corpus to count either shape in, so
the guard is carried on those two languages' evidence and says so: four digits on both sides is a year pair,
not a fraction.

**Three languages, three corpora, one shape.** Worth treating as a known hazard for any future `a/b` rule
rather than rediscovering a fourth time.

### `1996年-2007年` lost its connective — and the fix had to move

Both endpoints already take the digit reading (each is followed by its own 年), so nothing was misread; the
DASH vanished, leaving one date abutting another. wuu needed the identical third arm.

⚠ **The first attempt did nothing**, because I placed it after the single-year rule — by then both endpoints
are Han and a digit pattern can never see them. Moved above it. That ordering trap is the same one the
year-RANGE arm exists for, one step further on.

### Probed clean

`ISO 8859-1` · `COVID-19` · `10.1016/j.x` · `p.12-15` · `1.2.3` · `x=y` · `20°C` · `第2个` · `1,8638.36`
(the Chinese four-digit grouping, correctly untouched) — all unchanged. `第2-3章` → 第2到3章 ·
`5~6` → 5到6 · `1996–2007年` (en dash) → 一九九六到二零零七年 · `公元前221年` keeps its cardinal, which is the
fleet's position on 3-digit years.

### Gates after the review fixes

```
review.ts --lang cjy   checklist CLEAN
suite                  3,280 tests · tsc clean
corpus diff            6/36 changed, DROP 7 both sides — ⚠ 36 utterances is not a gate and did not move
```
