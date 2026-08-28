# #1141 — which path does the referee eval measure, and does it matter?

## Run 1 — 2026-08-28 — the premise, tested rather than executed

#1141 (which I filed, out of #1131) says `tools/referee-eval/eval.ts` scores `phonemizeWord` while the product
is `phonemize`, so "the instrument and the product are different engines". Its suggested shape was: report
both, measure the delta fleet-wide **before** changing any published number, then decide.

Measuring first is what saved this from being wrong.

**The delta.** Every refereed language's primary list, stride-sampled, run through both paths:

    languages compared: 170
    rows: 35,057   DIFFER: 2,337 (6.67%)
    languages with ANY divergence: 53

So it is neither a handful nor the whole fleet. But the raw number is not actionable, so decompose it:

    routing          209   8.9%
    prosody          459  19.6%
    normalization     25   1.1%
    other          1,644  70.3%

  * **prosody** — `text()` places stress the bare g2p does not: `antoine` → `ɑ̃twan` vs `ɑ̃twˈan`.
  * **routing** — the referee list is written in a script the product RE-HOMES. `cmn`'s list is **pinyin**, so
    `phonemize(pinyin, "cmn")` hands the Latin run to the ENGLISH engine and reads `a` as *ˈə*. 127 of cmn's
    212 divergences are this. ⚠ The comparison is meaningless there; the engine is not wrong.
  * **normalization** — citation-form artifacts: `69'er` → *nioɡtʁes ɛɐ*, exactly as #1141 predicted.
  * **other** — and this is where the premise breaks.

## ⚠ Run 2 — the premise is substantially WRONG, and the code says so in prose

The "other" bucket is dominated by `da ur sd nb fa bn en ps arz km af pa` — overwhelmingly the languages with
a lexicon or a neural path. Checking the imports rather than assuming:

    import { phonemizeWordRules as nb } from ".../norwegian.ts";
    import { phonemizeWordRules as da } from ".../danish.ts";
    import { phonemizeWordRules as bn } from ".../bengali.ts";

**Seventeen languages deliberately score a RULES-ONLY engine**, and four modules say why in prose:

  * `danish.ts:49` — "Exposed to the referee eval so the measurement is NON-CIRCULAR (not the lexicon)"
  * `norwegian.ts:137` — "NST is independent of Wiktionary (the referee) → non-circular"
  * `afrikaans.ts:409` — "The RULE ENGINE ALONE — no proper-noun lexicon. This is the non-circular signal the
    referee eval scores"
  * `bengali.ts:34` — "never in the rule engine — which is what keeps the referee signal non-circular"

**Pointing those at `phonemize` would score a lexicon against the corpus that lexicon was mined from.** That
is not a fix, it is manufacturing a higher number by making the measurement circular. And the divergence is
visibly the *product being better*: `af` `Francois` → rules `frˈankuəs`, product `frˈanswa`; `Lesotho` →
`lˈiəsɔtɦu` vs `lˈəsutu`. The eval is scoring the harder path on purpose.

⚠ So #1141's framing — "the instrument and the product are different engines", implying a bug — is wrong for
most of what it measured. Recorded plainly because I filed it.

## Run 3 — the defect that IS real, and how small it is

Whatever path is scored, the eval calls a **word** function, so `normalize` and `makeNativiser` never run.
That is path-independent and it is exactly how #1131 hid: the nativiser is `text()`-only, so a nativiser
defect was invisible to the referee no matter how good the referee or how well chosen the path.

Sized it — referee words that the language's own nativiser rewrites:

    languages with a NATIVE_CLASS and a referee list: 80   (3 classes would not compile from source text)
    referee words: 809,312   the nativiser REWRITES: 452 (0.06%)
    languages with any blind-spot word: 26

    sl   39/5177   København → Kobenhavn      cy  65/14376  Wcráin → Wcrain
    gl   34/8091   aberraçom → aberracom      sr  70/26486  akăl → akal

⚠ And most of those 452 are the nativiser **doing its job** — foreign names in a referee list. The blind spot
is real, tiny, and mostly benign; it is not a reason to repoint anything.

## What actually landed

Not a repointing. The number was never wrong — it was **unlabelled**, and nothing said when the shipped path
disagreed:

1. `PATH_OF` / `pathOf` — which path each entry measures, **derived from this file's own imports** rather than
   hand-kept, per the argument `tools/registry-map.ts` makes about the registry. ⚠ An alias only labels a
   language if it is itself a `PHON` key: `ckbRules` is not, and that is load-bearing — `ckb`'s entry is a
   composite (bizroke lexicon → ONNX tagger → rules fallback), so it must not be labelled rules-only.
2. `scored path:` and `product delta:` lines in the report, so a percentage can never again be ambiguous about
   which engine produced it, and a non-zero delta is visible at the moment someone reads the score.
3. `PHON` exported, with the whole finding above written at its declaration.

⚠ **The delta is CLI-only** — an explicit `withDelta` parameter, defaulting off. Charging the floor test for
it took `referee-eval.test.ts` from **54s to 121s** across its cases — which is how a diagnostic becomes
something people switch off. With it truly off the gate now runs in **30.7s**, below the 54s baseline.

⚠ **This did not need #1150.** The stream DTO would give exact attribution of *why* two paths differ, and the
four-way decomposition above was reached with cheap heuristics instead. Filing the delta as evidence for
#1150 is right; blocking #1141 on it would not have been.

## Run 4 — review findings, fixed inline

Eight, and four of them said the labelling — the entire point of the change — was wrong.

  * ⚠ **THREE ENTRIES WERE LABELLED WITH THE WRONG ENGINE.** Keying only on the symbol `phonemizeWordRules`
    missed `ur` and `ps` (they expose their lexicon-free skeleton as `phonemizeWordCore`) and `arz` (a
    hand-written `ar(w, "egyptian", {lexicon:false})` wrapper with no symbol at all). All three are called
    RULE-ONLY / NON-CIRCULAR in this file's own prose, and all three reported "the bare word g2p" — asserting
    the wrong engine on the very field added to stop that. Now derives from BOTH lexicon-free symbols, with a
    small hand-kept `PATH_OVERRIDE` for the two wrappers.
  * ⚠ **AND A HAND-KEPT MAP ROTS, so it is now guarded by the file's own prose.** A new test extracts every
    language named in a `RULE-ONLY … for <lang>` / `NON-CIRCULAR for <lang>` marker and asserts it is labelled
    `rules`. That test fails on the pre-fix code, which is the only reason to trust it.
  * ⚠ **`text` was a lie for `en`/`hi`.** Those entries call `createEnglish().text(w)` directly, bypassing the
    registry wrapper (`romanPass`/`foldPass`/`withHost`) and, for `en`, the neural OOV path. Measured:
    `PHON.en("blorptastic")` → *blˈɝpteᶦstˌɪ* vs `phonemizeAsync` → *blɔːɹptˈæstɪk*. The report said "the
    shipped path" and then printed a large delta AGAINST the shipped path. Renamed `engine-text`, described as
    what it is.
  * ⚠ **THE TWO DELTA MESSAGES WERE SEMANTICALLY SWAPPED.** `differ === 0` printed "the scored path and the
    shipped path agree here" — reassurance emitted at exactly the point where nothing about the nativiser was
    exercised — while `differ > 0` claimed the product-only steps were "unmeasured" when they had just visibly
    fired. Both rewritten: zero now says it is *not* evidence the steps ran, non-zero points at the four
    ordinary causes before anyone calls it a bug.
  * **`catch { continue }` inflated the denominator.** A row the shipped path refuses stayed in `sampled` but
    never in `differ`, so a language that mostly throws could print `0/300 … agree here` off zero successful
    comparisons. Now counts `compared`, not sampled.
  * **The claim "CLI runs only" was false.** The floor test calls `evaluate(lang, true)` with the default
    `sampleCap = 0`, so `nb`/`af`/`ur` were paying for it inside the gate. Replaced the inference with an
    explicit `withDelta` parameter — ⚠ placed LAST, because inserting it before `sampleCap` silently
    reinterpreted `evaluate(lang, true, 3000)` as `withDelta=3000, sampleCap=0`: a signature change that
    type-checks and quietly measures something else.
  * **The delta re-invoked the engine.** It called `phon(w)` a second time for every sampled row, doubling
    model calls for `ar` (ONNX), `ckb` (tagger) and `en` (beam search). Folded into the main loop, reusing the
    reading already computed.
  * **`PATH_OF` failed closed.** It reads its own source and matches TYPE ANNOTATIONS, so under any transform
    that strips them the map would silently become `{}` and every language would report "the bare word g2p" —
    a wrong answer that looks like a right one. It now throws at module load instead.
