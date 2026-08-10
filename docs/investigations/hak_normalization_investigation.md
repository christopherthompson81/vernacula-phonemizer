# hak (Hakka Chinese, Meixian) — normalization investigation

The sixth Sinitic normalization layer, and the first built ON `core/sinitic.ts` rather than extracted from
its own language. Following `docs/normalization_playbook.md`.

---

## Run 1 — 2026-08-09 — read the corpus artifact before writing anything

`tools/corpus/mined/hak.jsonc` already exists (dump-sourced, `hak.wikipedia.org pages-articles`, 9,578
paragraph segments, **29/35 cells covered** — the best-covered Sinitic artifact so far; cjy had 7/35).

Counts, the ones that matter:

```
digit-run 4166   year 4148   abbrev 3470   decimals 1960   grouped 1587   clock 794
latin-in-native 9140   initialism 360   letter-name 376   signs 241   percent 187
clock 794   ranges 80   version-dot 42   degrees 31   roman 31   units 20   fractions 21
currency 5   era-marker 0   ordinal-native 0   calendar 0   iteration 0
```

### ⚠ THE FIRST FINDING IS NOT A NORMALIZATION FINDING: THE CORPUS IS NOT IN HAN.

Measured over both tiers of the artifact:

| tier | segments | Han chars | Latin chars | Han-dominant segs | Latin-dominant segs |
|---|---|---|---|---|---|
| hard | 217 | 2,909 | 42,029 | 28 | **189** |
| sample | 200 | 1,939 | 26,173 | 13 | **187** |

The sample tier is the uniform stride, so this **is** the language's real distribution on that wiki:
**93.5% of the characters are Latin.** hak.wikipedia is written in **Pha̍k-fa-sṳ (PFS)**, the missionary
romanization — `Pak-khô-chhiòn-sû he tui Ngìn-lui ko-hi chit-lui ke chhiòn-phu chṳ-sṳt`.

And spot-reading the Han-dominant segments, several of them are not Hakka at all — the longest are quoted
**Chinese** passages (an MTR rolling-stock article, `此列車屬於中國大陸標準A型地鐵車輛…`). So the Han in the
hak corpus is not straightforwardly a Hakka sample either.

### The engine reads none of it.

`src/languages/hakka/hakka.ts` is the shared Han-dict engine (`sinitic/hanDictIpa.ts`); `registry.ts:571`
routes every Latin run to **English**. Probed:

```
"Pak-khô-chhiòn-sû he tui Ngìn-lui ko-hi chit-lui ke chhiòn-phu chṳ-sṳt."
   → pʰˈæk khˈoᶷ kʃˈʌn sˈuː hˈiː t͡ʃˈʌwɪ nd͡ʒˈɪn lˈuːɪ kʰˈoᶷ hˈaᶦ t͡ʃˈɪt lˈuːɪ kʰˈɛ kʃˈʌn fˈuː t͡ʃˈuː sˈaᶷt .
"Hak-kâ-ngìn"  → hˈæk kʰˈɑː nd͡ʒˈɪn        (English)
"客家人"        → hak̚˩ ka˧˥ ŋin˩˩           (correct)
```

So the language's own encyclopedia is currently read as English. That is an ENGINE gap (no PFS→IPA layer),
not a normalization gap — nan has exactly this shape and solved it by folding POJ→Tâi-lô inside its
romanization engine, but **hak has no romanization engine at all to fold into.** Recorded here, sized below,
and kept separate from the normalization layer.

### The normalization defects, probed on the shapes the artifact counts.

```
"1,000人"       → it̚˩ , laŋ˩˩ ŋin˩˩          grouping comma = clause pause AND the value is destroyed
"2009年"        → ŋi˥˧ t͡ɕʰiɛn˦˦ laŋ˩˩ kiu˧˩ ŋian˩˩    二千零九年 — the CARDINAL, not the digit-by-digit year
"1996-2007年"   → …it̚ tsʰiɛn kiu pak kiu səp liuk / ŋi tsʰiɛn laŋ tsʰit ŋian…   dash gone, both cardinals
"20°C"          → ŋi˥˧ səp̚˥ sˈiː             ° dropped, ⟨C⟩ read as an ENGLISH letter name
"50%"           → n̩˧˩ səp̚˥                  % dropped silently
"3.5%"          → sam˦˦ . n̩˧˩                decimal point = clause pause; % dropped
"12.5"          → səp̚˥ ŋi˥˧ . n̩˧˩            same
"1/5"           → it̚˩ n̩˧˩                    slash dropped, two bare cardinals
"GDP"           → ɡˈiːdˈiːpʰˈiː              English letter names, English phonology, no tone
"2005-ngièn"    → ŋi˥˧ t͡ɕʰiɛn˦˦ laŋ˩˩ n̩˧˩ nd͡ʒəˈiːn   cardinal year + the PFS morpheme read as English
```

Every one of these is a shape `core/sinitic.ts` already carries. This is the validation case the module was
extracted for: a language it was NOT extracted from.

**Next:** size the PFS gap (what fraction of corpus tokens are unreadable), then decide the layer's scope.

---

## Run 2 — 2026-08-09 — size the PFS gap, and decide the layer's scope

Regenerated the dump to count over the whole corpus rather than the artifact's two tiers:

```
python3 tools/normalization/wikidump-to-text.py hakwiki-latest-pages-articles.xml.bz2 hak_paras.txt
   → pages seen 18465, paragraphs written 8684
```

Shape counts over all 8,684 paragraphs:

| shape | count | note |
|---|---|---|
| `NNNN-ngièn` (PFS year) | **5,349** | **the largest shape in the language** — 12× the Han form |
| `NNNN年` (Han year) | 434 | |
| `NNNN ngièn` (spaced) | 169 | playbook trap 15 — the same bound morpheme, detached |
| grouped `1,000` | 2,211 | |
| decimals | 1,253 | |
| percent | 336 | |
| numeric dash ranges | 108 | |
| degrees (`°`/`℃`) | 87 | |
| fractions | 32 | |
| `\d{1,2}:\d{2}` | **38** | vs the artifact's `clock: 794` — trap 21, a filled cell is a lead |
| currency | 5 | |
| ampersand | 5 | all inside Latin proper names |

**Scope decision, and the reasoning, because this is the whole question for this language.** The PFS gap is
an ENGINE gap: `ngie̍t` (月, ×1,126 after digits) and `ngit` (日, ×965) are perfectly good Hakka *words*, and a
normalization layer's job is text that is not a word in any orthography. Fixing them means a PFS→IPA front
end, which is a bring-up, not this task.

**The one exception is forced rather than chosen.** A year is read digit by digit and a quantity is not, so
the rule must consume `ngièn` to know which reading applies — and trap 10 says a rule that consumes must put
back. The only form it can put back that SPEAKS is 年. So step 2 folds `NNNN-ngièn` → `NNNN年` and the shared
`spellYears` then covers both orthographies in one call.

**And the PFS corpus turned out to be an unusually GOOD sourcing tier**, which is the compensation for it
being unreadable. A Han corpus shows you the character; PFS shows you the spoken syllable, so every emitted
word could be checked against the dict reading AND the corpus's own romanization of it:

| word | dict reading | corpus writes | count |
|---|---|---|---|
| 摎 (and) | `lau⁴⁴` | `lâu` | 3,232 |
| 公里 (km) | `kʊŋ⁴⁴ li⁴⁴` | `kûng-lî` | 2,051 |
| 平方 (squared) | `pʰin¹¹ fɔŋ⁴⁴` | `phiàng-fông` | 1,850 |
| 分之 (fraction) | `pun⁴⁴ t͡sz̩⁴⁴` | `fûn-chṳ̂` | 39 |
| 美元 (USD) | `mi⁴⁴ ŋian¹¹` | `mî-ngièn` | 52 |
| 公尺 (metre) | `kʊŋ⁴⁴ t͡sʰak̚¹` | `kûng-chhak` | 26 |
| 度 (degree) | *absent* | `thu` | 15 |
| 零下 (below zero) | `laŋ¹¹ ha⁴⁴` | `làng-hâ` | 2 |
| 攝氏 (Celsius) | `ŋiap̚¹ sz̩⁵³` | `ngiap-shì` | 5 |
| 百分之 (percent) | `pak̚¹ pun⁴⁴ t͡sz̩⁴⁴` | `pak-fûn-chṳ̂` | 1 |

**The conjunction is 摎, not 和** — the sibling layers ship 和 (yue, cjy), 搭 (wuu) and 佮 (nan). And **the
range connective is 至, not the 到 all three Han-corpus siblings ship**: 至 ×19 against 到 ×4 in the Han
portion, with PFS `chṳ` ×19 tying `to` ×19 — a tie in romanization broken decisively by the Han.

### The one blocker: ⟨度⟩ is silent

Probed every word the layer would emit through `phonemizeWord`. All speak except ⟨度⟩, ⟨減⟩, ⟨於/于⟩, ⟨〇⟩.
The last three are declined (cjy made the same three refusals); ⟨度⟩ is the degree rule.

Searched the full 1.18 GB kaikki extract including non-primary readings: **度 has no Meixian Hakka reading at
all**, only *Sixian* (`thu`, `/tʰu⁵⁵/`) and *Hailu* (`/tʰu³³/`). Added as a derived entry, three ways:
(1) two Meixian multi-character entries in this very dict carry it — `印度 in⁵³⁻⁵⁵ tʰu⁵³`, `深度 … tʰu⁵³`;
(2) Sixian `/tʰu⁵⁵/` is 去聲 and the Meixian 去聲 contour is ˥˧, which is what (1) gives;
(3) the corpus writes `thu` 15 times as the unit and inside `Yin-thu`/`chhòng-thu`/`me̍t-thu`.

**And it is not a convenience.** 度 is the **second most frequent uncovered single character** in the Han
portion (137, behind only 於 ×414). Overall single-character silence over the Han portion: **7.9%** of tokens,
1,282 distinct characters. That gap is recorded, not fixed — the line is that a character this layer EMITS
gets sourced, and everything else is the engine's.

## Run 3 — 2026-08-09 — the layer, and two live bugs in `core/sinitic.ts`

Eleven ordered steps, five of them a single call into `core/sinitic.ts`. **Building on a module extracted
from other languages found two defects in it that its own five sources could not show:**

**1. `readDegrees` destroyed a decimal temperature in every PREPOSING language.** The pattern captured
`(\d+)`, which on `13.3 °C` matches only the `3`, so the scale word landed *inside* the number:

```
BEFORE yue "13.3°C"  → "13.攝氏3度"     ← the integer part orphaned in front of a raw stop
BEFORE nan "13.3°C"  → "13.攝氏3度"
AFTER  yue "13.3°C"  → "攝氏13點三度"
```

wuu was accidentally immune **because it POSTposes Celsius** — `13.3摄氏度` keeps the digits contiguous. That
is why four layers could carry this and no test see it: the defect is invisible from the one language that
happens to put the word on the other side. hak's corpus writes `13.3 °C` and `34.2 °C` and preposes.

While fixing it, found nan had **never been migrated** to the shared rule at all — it kept a local copy
carrying the same bug. Migrated; the two guards it had earned (`\p{sc=Latn}`, temperature-before-bare) are
already in the shared rule, so it was a straight substitution.

**2. `reorderFraction` read train-set numbers as fractions.** The lookbehind excluded digits and dots but not
letters, so hak.wikipedia's rolling-stock articles gave `A/C/B351/352` → *…352分之351*, "351 over 352".
Guard widened to `\p{sc=Latn}`; nothing legitimate is written with a fraction fused to a letter.

**Refactor gate: cmn, yue, wuu, nan and cjy all emit BYTE-IDENTICAL corpus output** after both changes — so
both defects were latent in those corpora and are carried by tests instead.

### Where the sibling guard was the WRONG one to copy

cjy's range guard refuses a range with a Latin run nearby. In a 93.5%-Latin corpus that refuses every range
there is. wuu's — claim the dash only where a unit, scale or magnitude follows — transfers, because it keys
on what makes a span a QUANTITY rather than on what script it is written in. Of the 108 numeric dashes it
admits the genuine ranges and refuses `ISO 639-1`, `A340-500`, `777-200ER`, `GE90-115B`, `C6554-07E`,
`GB50352—2005`, and — free, because nothing following them is a unit — the broadcast clocks `21:00 - 21:54`.

## Run 4 — 2026-08-09 — the gates

```
corpus-diff  changed 229/411 (55.7%)   DROP 64 → 28
artifact scan  no defects  (after declaring the accepted silences)
review.ts      checklist clean
vitest         233 files, 3302 tests
tsc --noEmit   clean
referee        none exists — single-source (no wikipron hak, no epitran Hakka); the anchor is the
               adjudicated gold in test/hakka.test.ts
```

Read a spread of 18 sampled changes by hand. Every one is an improvement, and the classes are:
grouped numbers now compose (`17,274 km²` was 十七 + [pause] + 二百七十四 + English "ukm"; now
一萬七千二百七十四平方公里), years read digit by digit in both orthographies, decimals take 點, coordinates
read 度/分/秒, temperatures take 攝氏…度. No regression seen.

**The residual DROPs, all declared with the instances read:**
- `exponent` — superscript **tone numbers in phonology glosses** (`Xu⁴nin²`, `No²san¹`, `ȵi²bin¹`). This is
  the **fourth Sinitic corpus** to produce that false positive from a **fourth different source**; wuu, nan
  and cjy each found their own route to it. `accepted-silent.test.ts` had literally predicted "expect it in
  gan/hak/hsn too" — confirmed on the next language tried. Plus `m/s²`, `万m³` and `ngìn/km²`, each declined
  for a stated reason.
- `minus` — a NARROWER refusal than it looks. A negative **is** read, but only before a degree sign, because
  the only negative-number word this corpus supplies is 零下 ("below zero"), which is temperature-specific.
  All 6 genuine negatives are temperatures and all 6 are read. What stays silent is a bare `-5`, which has no
  attested instance and no attested word — and the hyphen is the worst character in this orthography to guess
  with, since PFS joins every polysyllable with one.
- `math-sign` — LaTeX bodies and scientific notation whose superscript the dump stripped (`1.392×106` is 10⁶).

**A measured residue, recorded rather than guarded.** Of the 5,349 `NNNN-ngièn`, **5,344 are ≤2100 and 5 are
not** — `Sî-yèn-chhièn 5000 ngièn`, `8200-ngièn`, `8000-ngièn`, prehistoric spans Chinese reads as CARDINALS.
A `[12]\d{3}` guard would catch all five; deliberately not added, because `\d{4}年` in Han has the same 0.09%
exposure in yue, wuu and cjy, and forking the shared rule for one language trades a uniform 0.09% for four
different rules.

## Run 5 — 2026-08-09 — what is NOT fixed, and what should come next

**The PFS front end is the whole remaining story for this language.** 93.5% of hak.wikipedia is read as
English today, and this layer does not change that — it makes the digits, signs and dates inside that text
correct. Two consequences worth stating plainly:

1. **Latin initialisms were declined**, and this is the reason. wuu and jv both rewrite `GDP` to Han letter
   names because English letter names in English phonology inside a tonal utterance is nobody's reading. That
   argument does not transfer here: the sentence *around* the initialism is already English. Fixing three
   letters inside a paragraph of Anglicised Hakka is not a fix. The 360 initialisms and 376 letter-names are
   real and they are waiting on the front end.
2. **The corpus-diff gate is weaker for hak than for any sibling.** It compares before/after of the same
   engine, so it still detects regressions in what this layer changes — but most of each utterance is English
   on both sides, so "no regression" covers less ground than the same words do elsewhere.

**Recommended next, in order:**
- **A PFS → IPA front end for hak.** It is the single highest-value thing available for this language, and
  the pieces are unusually favourable: PFS is a systematic romanization, the dict supplies Meixian IPA to
  validate against, and the corpus is 8,684 paragraphs of it. nan is the worked precedent for a Sinitic
  language whose evidence and output are in different orthographies.
- **The 7.9% single-character dict silence** (1,282 characters, 於 ×414 the largest). Shared with gan and
  hsn; measured at 8–26% across those in an earlier run.
- **gan or hsn next for normalization** — hsn has no corpus at all (cjy's situation), gan does. Either would
  be the second language built on `core/sinitic.ts` rather than extracted from it, which is now a
  demonstrated way to find defects in it.
