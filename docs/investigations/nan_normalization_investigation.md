# nan (Min Nan / Taiwanese Hokkien) — text normalization

Giving `nan` the normalization treatment per `docs/normalization_playbook.md`. The fourth Sinitic language
treated (after cmn, yue, wuu) — and **structurally not like them at all**.

**Evidence base.** No FLEURS corpus. `tools/corpus/mined/nan.jsonc` is dump-sourced (nan.wikipedia
pages-articles); 248 excerpts / 65,438 characters retained. Second tier: `attest.ts` — with a caveat this
language forces, recorded below.

---

## Run 1 — 2026-08-09 22:05 — this is a LATIN-script problem

The first measurement reframes everything. nan.wikipedia is written in **POJ (Pe̍h-ōe-jī) romanization**,
not Han:

```
Han characters in the retained text:   268
Latin characters:                   38,490
```

`latin-in-native: 413971` is not embedded foreign text — it is the language. So the three Sinitic layers
already shipped are the wrong model, and Javanese is the closer one. Nothing here is copied from wuu/cmn/yue.

### The defects

| form | current reading | defect |
|---|---|---|
| `50%` | ɡɔ˨˩ t͡sap̚˥ | sign dropped |
| `10°C` | t͡sap̚˥ **c˥** | ° dropped and ⟨C⟩ read as a bare consonant |
| `1,000` | it̚˧˨ **,** liə̯ŋ˨˦ | the grouping comma as a clause pause |
| `3.5` | sã˥ **.** ɡɔ˧ | decimal point raw |
| `1/5` | it̚˧˨ ɡɔ˧ | "one five"; Min Nan says *gō͘ hun chi it* |
| `2-3`, `km²`, `A&B`, `$500` | all dropped | |
| `118°04'04"` | the marks all dropped | |

`tē-2-tōa` already reads correctly — the ordinal prefix 第 is written into the POJ (`tē-2-`), so it needs
no rule.

### ⚠ The hyphen is a WORD-INTERNAL syllable joiner, and that governs the whole layer

POJ writes a polysyllable with hyphens (`hái-chúi`, `pêng-hong kong-lí`, `ko͘-1-ê`), so a dash rule here is
far more dangerous than in any language treated so far. Counted over the retained text:

```
EN DASH   5 instances — 5/5 GENUINE RANGES
          384–22 nî · 1707–78 nî · 15–16 sè-kí · 1795–1929 · 1984–2003
TILDE     4 instances — 4/4 GENUINE RANGES
          25℃~30℃ · 3~4 km/biáu · 5~6km/biáu · 32~64 mg/kg
ASCII -   26 instances — mostly NOT ranges
          ISO 8859-1 … 8859-16 (a designation block, ~18 of the 26) · ISBN 957-2053-07-8
          · arithmetic 2^7-1=127 · citation pages 313-332
          · and POJ's own word-internal hyphens (ko͘-1-ê, --1-piàn, bó͘-1-ê)
```

So the en dash and the tilde are claimed and **the ASCII hyphen is declined**, on the count. This is the
opposite of the call Javanese made, and the corpus is why.

### Sourcing — all of it from the corpus's own prose

| slot | word | evidence | verdict |
|---|---|---|---|
| and | **kap** | ×114 (`peng kap hái-chúi`) — Min Nan's own word, not 和/搭 | ✓ |
| range | **kàu** | ×48 (`10°C kàu -2°C`, `lak kàu Liap-sī 0-tō͘`, `US$3 khí kàu $1`) | ✓ |
| Celsius | **Liap-sī** | ⚠ THE CORPUS DEFINES THE SCALE: `siat-tēng-chòe Liap-sī 0 tō͘ (0 °C)` and `Liap-sī 100 tō͘ (100 °C)` — and it is **PREPOSED** | ✓✓ |
| degree | **tō͘** | `lâm-hūi 65-tō͘`, `Liap-sī 0-tō͘ í-hā` — hyphen-attached | ✓ |
| fraction | **hun chi** | `Tē-kiû ê gō͘ hun chi it` (1/5), `7 hun chi 1`, `1-pah-bān-hun chi it` | ✓ |
| squared | **pêng-hong** | `7676 bān 2 chheng pêng-hong kong-lí`, ×5 — PREPOSED, spaced | ✓ |
| km · m · kg | kong-lí ×20 · kong-chhioh ×10 · kong-kin | `3627 kong-chhioh` (a depth) | ✓ |
| second | **biáu** | `3~4 km/biáu`, `5~6km/biáu` — the rate denominator | ✓ |
| currency | **kho͘** | `Ji̍t-phiò 91 kho͘ (¥91)`, `Bí-kim 1 kho͘ (US$1)` — the corpus glosses both | ✓ |

### ⚠ `attest.ts` CANNOT DO TOKEN ATTESTATION FOR POJ, and it reports the failure as absence

```
Liap-sī    0 token   10 substring   → "substring-only"
```

`Liap-sī` is unambiguously a real word — it is in the corpus four times defining the Celsius scale. But
`attest.ts` splits prose on non-letters to build its token set, and **a POJ word contains hyphens**, so the
full form can never appear as a token. This is trap 19 in a new guise: there the problem was a script with
no word boundaries, here it is an orthography whose words contain the character the tokenizer splits on.
The substring count is the evidence for this language, exactly as for Han/Thai/Khmer. Anything this tool
says about nan must be read that way, and its `absent` verdicts are only meaningful at 0 SUBSTRING.

### Two words shipped on inference, and one of them is much better founded than the other

- **The percent word `pah-hun-chi`** is unattested as a whole — but it is **compositional from parts this
  corpus attests in exactly this construction**. 百分之 is `pah` (hundred) + `hun chi`, and the corpus
  writes `1-pah-bān-hun chi it` — "one millionth" — which is the same construction with a magnitude
  prefix. So the pieces, the order and the pattern are all attested; only the assembled word is not.
- **The decimal word `tiám`** is the weaker one. It occurs ×12 and every instance is the NOUN "point"
  inside a compound (`te̍k-tiám` characteristic, `khí-tiám` starting point, `koan-tiám` viewpoint) — never
  a decimal separator. Same shape as jv's `koma` and wuu's 点, and shipped for the same reason: the corpus
  has 55 dot-decimals whose separator is otherwise read as a clause pause.

**Next:** write the layer, en-dash-and-tilde-only on ranges.

---

## Run 2 — 2026-08-09 22:20 — ⚠ the corpus is POJ, but the USERS write Han

Run 1 built the layer on the corpus's orthography and emitted POJ words. Challenged on it — *"users will
use Han script, as far as I know"* — and the challenge was right twice over. Testing against Han running
text found **two defects the POJ corpus could not have shown**, and one of them was silent.

### 1. The POJ spellings were LEAKING ASCII into the phoneme stream

The two highest-traffic words this layer emits do not survive the POJ→IPA converter:

```
1/5  →  ɡɔ˧ hun˥ chi˥        `hun chi`      — the 之 syllable falls through unmapped
50%  →  paʔ˥˩ hun˧ chi˥      `pah-hun-chi`  — the same syllable, in the percent word
```

`chi˥` is the literal string, not IPA. The Han forms read cleanly through the MOE dict — `分之` →
hun-t͡ɕi, `百分之` → paʔ-hun-t͡ɕi — and `攝氏` is a **dict word** whose reading is *Liap-sī*, the very
Celsius term this corpus defines. So the layer now **sources in POJ and emits in Han**.

Emitting Han costs the POJ corpus nothing: the tokenizer has its own Han group, so a Han word inside POJ
prose reads through the same front end. The pairing was verified word by word (到 = kàu, 點 = tiám,
箍 = kho͘, 每 = múi, 秒 = biáu/bió, 平方 = pêng-hong, 公里 = kong-lí) — and the corpus confirms the method
outright in one line: **`Kong-lí ta̍k tiám-cheng (公里逐點鐘)`**, glossing its own POJ against Han.

### 2. ⚠ `°C` in Han text — a guard that was correct for POJ and wrong for the language

```
溫度10°C到2°C  →  un-tō͘ t͡sap̚˥ **toc**˥ kau̯˨˩ …
```

The rule guarded with `(?![\p{L}])` — but **a Han character IS `\p{L}`**, so in Han text the guard failed,
the bare-degree rule fired instead, and the degree word fused onto the stranded ⟨C⟩ as one Latin token. In
POJ prose a space or punctuation always follows the scale letter, so **every gate was green**: the corpus
diff, the artifact scan and the review checklist all passed while this was live. Guard narrowed to
`\p{sc=Latn}`, and the bare-degree rule given the trailing space that the Javanese layer learned to need.

**The general lesson, which is the reason this run exists:** a corpus is evidence about the ORTHOGRAPHY IT
IS WRITTEN IN. nan.wikipedia's POJ is an editorial convention of that wiki, not a fact about what reaches
the phonemizer. Where a language has two scripts, the layer has to be probed in both.

### A regression the switch introduced, and the test that caught it

Emitting Han meant the decimal's fractional digits needed Han numerals: joined as ASCII they became one
digit run and the number path read the **cardinal** — `1.797` → *it tiám **chhit-pah káu-cha̍p chhit***,
"one point seven hundred ninety-seven". Fixed with a digit table, as the other Sinitic layers carry.

### Refusals, each with its count (unchanged from Run 1 unless noted)

- **The ASCII hyphen** — the largest and most orthography-specific: `ISO 8859-1 … 8859-16`, an ISBN,
  `2^7-1`, citation pages, and POJ's own word-internal joiner. The en dash (5/5) and tilde (4/4) ARE read.
- **`=`** — wiki section headings (`== Chām-gōa liân-kiat ==`) and EasyTimeline template code
  (`ScaleMajor = unit:year increment:20`). **`+`** — joins RUNNING MATES in an election table
  (`Tân Chúi-píⁿ(chóng-thóng)+Lū Siù-liân(hù-chóng-thóng)`), a list separator, not an operator.
- **¥ € £ ¢ ₫** — `$` and `US$` ARE read (箍 and 美金, both corpus-glossed: `Bí-kim 1 kho͘ (US$1)`), but
  ⟨箍⟩ is the unit word and no Min Nan NAME for the other currencies occurs anywhere in the corpus.
- **Foreign iteration marks** — Japanese 々/ゝ in quoted names and titles, Thai ๆ in a passage about Thai.
- ⚠ **A superscript in a nan article is often a ROMANIZATION TONE NUMBER**, not a power — here JYUTPING
  quoted in a Hong Kong article (`hoeng¹ gong² dak⁶ bit⁶ hang⁴ zing³ keoi¹`). The Wu layer records the same
  hazard from Chao tone letters; this is the second Sinitic corpus to produce it from a different source.

### One false positive fixed at its cause rather than silenced

`review.ts` flagged the literal `"Latin"` inside `text()` as an unphonemized word spelling (trap 6). It is a
SCRIPT NAME passed to `hostWordRun`, and the check cannot tell the two apart — but the TOKEN regex it sat in
is constant, so hoisting it out of `text()` fixes the report AND stops rebuilding a regex per call. It had
never been reported before because `review.ts` bails at "normalizer missing" before reaching that check.

### Gates

```
corpus diff (mined:nan)   DROP 91 → 41 · DIGIT 0 · SLOT-GAP 0 · RAWMARK 0 · THROW 0 · 102/447 changed
referee                   95.3% folded / 97.4% symbol — IDENTICAL before and after (measured in a worktree
                          at the parent commit, not assumed)
suite                     3,271 tests · tsc clean · review.ts --lang nan checklist CLEAN
```

⚠ Worth flagging separately, and NOT touched here: the maturity row quotes **90.7% folded** for nan while
the eval reports **95.3%**. The before/after are identical so this change is not the cause; the row looks
stale and wants its own check.

**Reading the changed lines**: `18,000 km` read *tsa̍p-pat , liâng km* — the value destroyed AND the unit
dropped — and now reads *tsi̍t-bān pat-tshian kong-lí*. Also `10,911 kong-chhioh`, `21 km²` →
*jī-tsa̍p-it pêng-hong kong-lí*, `3~4 km/biáu` → *sã kàu sì kong-lí múi bió*, `Firefox 1.5`/`3.0` → tiám.
