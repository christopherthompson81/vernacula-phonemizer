# Xiang Chinese (hsn) text-normalization investigation

## Run 0 — 2026-08-11 — there is no corpus, and getting one was most of the work

`review.ts --lang hsn` → `[FAIL] normalizer … missing`, and no artifact either. **There is no
hsn.wikipedia** (404 on the dump path; gan, hak, wuu and cdo have one, cjy and hsn do not), no FLEURS, and
`sources.ts` reports **no referee at all** — the engine's own header records that it has a single
authoritative source and no independent check.

The only Xiang text that exists is the Wikimedia Incubator's `Wp/hsn`. Getting it took two wrong turns
worth recording, because both failed *silently*:

- **`prop=extracts` caps `exlimit` at 1 for a FULL extract.** Batching 20 titles returns the FIRST one's
  text and nothing for the other 19. Measured: 153 pages came back as **5 paragraphs**. The playbook
  records the same cap for `fetch --fill` (trap 30).
- **Then one-request-per-page with 8 workers got 429-rate-limited on 145 of 153 pages** — and the fetcher
  wrote those out as EMPTY. A throttled fetch recorded as "this page has no prose" is the worst shape a
  corpus bug can take, because the artifact then looks complete. `mine.ts` states the rule the code broke:
  *a rate limit is a "wait", never an answer about a wiki.*

**The dump was the right instrument all along.** Incubator is an ordinary Wikimedia wiki — it holds every
incubating project in ONE dump, namespaced by title (`Wp/hsn/長沙`). Added `--title-prefix` to
`wikidump-to-text.py`; the 191 MB `incubatorwiki` dump then yields Xiang like any other language.
⚠ **That also makes `cjy` regenerable** — its committed artifact records an Incubator source whose prose
file was never committed, so it could not be rebuilt (trap 32).

```
Wp/hsn → 153 pages → 30,640 characters, of which 20,906 are Han
tools/corpus/mined/hsn.jsonc: 42 hard + 40 sample, covered 16/35 cells
```

The 19 empty cells cannot be filled. `fetch --fill` needs a wiki; there is none. This is the whole of
written Xiang.

## Run 1 — 2026-08-11 — the defect list, and the dict as the hard gate

```
DROP percent ×10 · DROP math-sign ×3 · DROP degree ×1
```

Probed: `10%` → `sz̩˨˦` (the sign silent), `542.85億元` → a clause PAUSE where the decimal point was,
`5.9742×10²⁴` → both the sign and the exponent gone, `111°53'` → degree and primes gone.

⚠ **espeak checked with `$ESPEAK_NG` SET this time** — the Pashto lesson. It ships `cmn` and `yue`; there
is genuinely no Xiang.

**The dict decides what can be said at all**, and that is a harder gate than the corpus. `hanDictIpa.ts`
segments by greedy longest match and skips an uncovered character SILENTLY, so an unsourced word does not
mispronounce — it vanishes:

```
SPEAKS   百分之 · 分之 · 點 · 到 · 跟 · 和 · 公里 · 公斤 · 公尺 · 平方 · 立方 · 元 · 第 …
SILENT   度 · 正 · 減 · 乘
HALF     攝氏 → sz̩˦˥ (1 of 2, drops 攝) · 等於 → tən˦˩ (drops 於)
```

That settles four refusals on fact: no degree word (⟨度⟩ silent — a `°C` rule would delete the word as well
as the sign), no times (⟨乘⟩ silent), no equals (⟨等於⟩ half), and the fraction/decimal words are available.

## Run 2 — 2026-08-11 — the corpus's own choices, and the family prediction coming true

| | count | |
|---|---:|---|
| `\d{4}年` | **116** | the biggest class by far |
| 跟 | **136** | coordinating — `皇冠假日跟喜來登`, `法語、德語跟西班牙語`, `台灣跟福建` |
| 和 | 63 | also present, half as common |
| 到 | 65 | "up to", the range connective |
| `%` | 12 | |
| `\d.\d` | 29 | |
| grouped `,` | 7 | |
| 百分之 | **0** | ⚠ |
| 點 | 11 | ⚠ never a decimal separator |

⚠ **跟 BEATS 和, WHICH IS THE MIRROR IMAGE OF JIN.** cjy chose 和 on its own corpus (和 ×16 against 跟 ×5);
Xiang is 跟 ×136 against 和 ×63. Two lects, two corpora, opposite answers — which is exactly why the
connective is per-language data and not shared code.

⚠ **THE SUPERSCRIPT PREDICTION CAME TRUE.** `test/accepted-silent.test.ts` said of the
romanization-tone-number hazard: *"Expect it in gan/hak/hsn too."* Of this corpus's 24 superscript runs
**23 are tone numbers** from the 湘語羅馬字 tables the incubator carries — `/ʃɘ̃⁴⁵/`, `/ye²⁴/`, `/mɔ⁴²/`,
`/tɕiɑʌ⁴⁵/`, `/n̩⁴²/` — and **exactly one** is an exponent (`5.9742×10²⁴公斤`). hsn is the FIFTH Sinitic
corpus to produce this from a fifth independent source, after wuu (own phonology), nan (jyutping quoted in
a Hong Kong article), cjy (own romanization) and hak (glossing other varieties). A squared/cubed UNIT is
still read, because it composes onto a unit noun and cannot match a bare tone number.

⚠ **點 IS NEVER A SEPARATOR HERE** — its 11 instances are 一點一線 (a slogan), 特點, 有點噶子, 試點, 點子.
Same trap as wuu's 点, jv's `koma`, nan's `tiám`, cjy's 點. Shipped anyway for the same reason: a written
corpus is the weakest evidence about how a SYMBOL is spoken, and the alternative is 29 decimals reading as
a clause pause. ⚠ **百分之 is weaker still at ×0** — the pan-Sinitic form, it speaks in the dict, and 12 `%`
currently say nothing. Shipped as a family inference and labelled as one.

## Run 3 — 2026-08-11 — gates, and the one defect the corpus diff caught

```
tsc --noEmit        clean
vitest              233 files, 3338 tests
corpus-diff         changed 32/72 (44.4%) · DROP 11 → 3 · DIGIT/SLOT-GAP/RAWMARK/THROW 0
mine.ts scan        no defects
review.ts --lang hsn  checklist clean
```

⚠ **THE DIFF FOUND ONE FALSE POSITIVE AND IT WAS A GOOD ONE.** `2400年前亇春秋戰國` — "2400 years AGO, in
the Spring and Autumn period" — came out as 二四零零年前, the year 2400 read digit by digit. `N年前` is a
QUANTITY, not a year. The `多` forms were already safe (`7000多年前`, `2000多年前` — the 多 breaks the
adjacency `spellYears` needs); the bare form was not.

**Fixed locally rather than in `core/sinitic.ts`, on a measurement**: `\d{4}年前` is ×1 here and **×0 in
every other Sinitic corpus** (cjy, hak, nan, wuu, yue, cmn), so a shared change would be carried by six
languages to fix one instance in a seventh.

**Not fixed, and stated rather than left to be rediscovered:** the shared tier spaces its insertions
(`百分之 12`, `50 平方公里`). cjy emits the identical space, so it is pre-existing family-wide behaviour and
not this language's to change — and it is harmless, because a Han engine tokenizes by script run and never
sees the space as a boundary.

**Residual:** `math-sign ×3` and `degree ×1`, both argued refusals in `defects.ts` — the math-signs are one
scientific-notation instance plus wiki heading `===`, the degrees one sentence's coordinate bounding box.
