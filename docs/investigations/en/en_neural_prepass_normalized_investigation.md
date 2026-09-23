# en — the neural OOV pre-pass scans the RAW text (#1452)

`englishNeural.ts` built its tagger pre-pass by scanning the **caller's raw input**. A word the
NORMALIZER creates — `τ` → `tau`, `µin` → `microinch`, `5 Ω` → `ohms`, `ξ` → `zye` — was never in that
string, never tagged, and fell silently to the weaker n-gram path. Those are exactly the
normalizer-introduced words that are **also OOV**, i.e. the ones with no dictionary row to fall back on,
and the tagger roughly halves the OOV phone-error-rate (7.4% vs 18.2% PER).

## Run 1 — 2026-09-23 — the fix, and why it is not a one-line change

Scanning the normalized text means normalizing twice: once to scan, once inside `text()`. Both halves of
that are a problem.

⚠ **THE SECOND PASS POISONS THE TRACE.** `rewrite` refuses a string its mapping does not describe —
`if (tracked !== s) { poison(); … }` — and a scan pass starting over from the raw input is exactly that
shape. Poisoning withholds **every `inputSpan`**, so the cost of the fix would have been the trace.

⚠ **AND IT COSTS 62%.** Measured, median of 5 × 300 calls: **0.583 → 0.947 ms/call** on the neural path.

Both are answered by normalizing **once, in the caller, under the same recording**, and handing the
result to `text(…, preNormalized: true)`. The mapping stays correct because the single pass ran under
tracking, and nothing is done twice.

```
the τ value        normalized "the tau value"   ->  ðə tʰˈaᶷ vˈæɫjuː   (was tʰˈɔː)
a 5 µin finish     == a 5 microinches finish     ✓
set 5 Ω now        == set 5 ohms now             ✓
the ξ value        == the zye value              ✓
```

## Run 2 — ⚠ THE GOLDENS REFUSED MY FIRST GUARD, AND THEY WERE RIGHT

Scanning the normalized text surfaces letter runs the raw text never had: `2026-09-23` becomes
`september 23rd`, where a bare `[A-Za-z]+` matches the `rd` and hands the tagger a nonsense key. The
resolver never asks for it — the tokenizer reads `23rd` whole — so the entry is dead, and an ONNX call is
the most expensive thing in the loop (**0.682 vs 0.50 ms/call** for that one key).

My guard was a blanket **"not adjacent to a digit"**. `check:goldens` reported **6 stale rows across 5
languages**, and reading them showed the guard was excluding a large legitimate class — alphanumeric
tokens where the LETTERS are a real word the tagger reads well and the n-gram does not:

```
cjy  35px        pʰˈiːks      ->  pʰˌiːʲˈɛks
hak  zhi3        ʒˈiː         ->  ʒˈɪ
hsn  zhong1      ʒˈɔːŋ        ->  ʒˈɑːnd͡ʒ
hsn  guai2       ɡwˈaᶦ        ->  ɡˌɑːˈɪ
km   600Mbit     ˌɛmbˈɪt      ->  mbˈʌt
mag  densitymi2  dˌɛnsətʰˈiːmi -> dˌɛnsət̬imˈɪ
```

**Pinyin with a tone number, unit abbreviations, identifiers — every one a regression.** ⚠ That is
trading CORRECTNESS for one ONNX call, which is the wrong trade in the direction this repo has decided
repeatedly. The guard now names the four ordinal suffixes and nothing else.

⚠ **AND THE GOLDENS ARE THE ONLY THING THAT CAUGHT IT.** The targeted tests were green, the correctness
probe was green, and the perf number looked *better* with the bad guard in — the regression was visible
only in six rows of embedded English inside Chinese and Khmer text.

## Final state

```
plain prose (no expansion)      0.267 ms/call   (main: 0.269)
number-heavy (big expansion)    0.449 ms/call   (main: 0.448)
check:goldens                   189 languages, 36495 rows, 0 stale
```

No perf cost, no golden movement, and the four normalizer-introduced classes now reach the tagger.

⚠ **`check:goldens` REPORTING 0 STALE AT THE END DOES NOT MEAN THE FIX IS COVERED** — it means no golden
text contains a normalizer-introduced OOV word. The coverage is `test/en-neural-prepass.test.ts`, which
asserts the PREMISE (the two spellings normalize alike) before the conclusion, so the test cannot go
vacuous by the normalizer changing underneath it.
