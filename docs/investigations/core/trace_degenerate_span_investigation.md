# core/trace: a whole-input InputSpan on mixed-script text

Reported by a downstream consumer measuring highlight granularity: on mixed-script Japanese, every
token reports the **whole input** as its `inputSpan`. 14 of 123 `ja` golden rows, every one of them
mixed-script.

    PDFファイルを開いてください。
       ピーディーエフ   inputSpan -> PDFファイルを開いてください
       ファイルを       inputSpan -> PDFファイルを開いてください
       開いてください    inputSpan -> PDFファイルを開いてください

## Run 1 — 2026-09-22 — the consumer's diagnosis was the right shape and the wrong layer

Their read was that the `PDF` → `ピーディーエフ` expansion cannot map expanded kana back to sub-spans,
so the engine attributes the whole input rather than withholding. The first half is the right
instinct; the mechanism is one layer up and not about the expansion at all.

Dumping the per-character mapping after each stage in isolation showed it **correct** throughout:

    after normalize   ピ[0,3) ー[0,3) デ[0,3) ィ[0,3) … フ[3,4) ァ[4,5) イ[5,6) …
    after segment     unchanged, still fine-grained

So the collapse happens on the real engine path and not in `normalizeJapanese` or `segmentText`.
Instrumenting `rewrite` to report any match of 8+ characters named it in one run:

    WIDE 15ch  \p{L}+  on "PDFファイルを開いてください"
      at normalizeRomans (src/core/roman.ts:207)
      at romanPass (src/registry.ts:344)

⚠ **`normalizeRomans` RUNS OVER EVERY LANGUAGE, AND ITS EVALUATOR RETURNS MOST TOKENS UNCHANGED.** It
rewrites with `\p{L}+` and hands the token straight back whenever `romanToInt` says it is not a
numeral. In a **non-spacing script there are no word breaks for `\p{L}+` to stop at**, so the match is
the whole clause — and `rewrite` stamped the match's span across every character of the replacement
even though the replacement was *the match itself*.

⚠ **AND THE FAST PATH IS WHY PURE-KANA ROWS LOOKED FINE.** `if (!/[ivxlcdmIVXLCDM]/u.test(text))
return text;` — a sentence with no Latin letters never reaches the rewrite. The defect was invisible in
exactly the rows anyone would reach for first when testing Japanese, and present in exactly the rows
with a Latin letter in them. That is the consumer's "14 of 14 mixed-script" with no residue.

## The fix

A replacement identical to the match carries the original per-character mapping through.

⚠ **ONLY IDENTITY IS SAFE.** An equal-length but different replacement has no guaranteed character
correspondence, so the carry-through is gated on `piece === m[0]` rather than on length.

    ja golden rows where two tokens share a span:   14  →  3
    fleet-wide (35,021 rows with 2+ spanned tokens): 4,639 → 4,262

⚠ **THE FLEET NUMBER IS NOT A DEFECT COUNT AND MUST NOT BE READ AS ONE.** Two tokens sharing a span is
often *correct* — a numeral expansion legitimately produces several tokens from one source span. The
377 rows this removes are the ones where the sharing was an artefact; the remaining 4,262 are a mix
this run did not separate. The `ja` residue of 3 is numeral/unit coarseness (`83 m` → a token spanning
`83 m` and another spanning `83 mです`), which is overlap rather than collapse and is a different,
smaller thing.

## ⚠ WHY IT SURVIVED, WHICH IS THE PART WORTH KEEPING

`inputSpan`'s contract is *"absent means NOT KNOWN, never identical"*, and a consumer degrades
correctly on absent — the reporting consumer falls back to whitespace segmentation and looks merely
coarse. **A whole-input span is a known-LOOKING answer to an unknown question.** It passes every check
a consumer can apply from outside: the count matches, the spans are in range, they tile.

Their own alignment gate declined the measured tier when group count ≠ map count — and here the counts
**agreed**, every entry pointing at the same span. ⚠ **Being degenerate is invisible to a count check
in exactly the way being one-out is**, which is the same lesson as
`docs/investigations/core/trace_cold_init_investigation.md` and the `prove the correspondence, or
decline it` pattern: the check has to be on the thing that would differ, not on a count of it.

And #1419 stands: parity compares IPA strings, neither port's readings changed, and no gate here could
have caught this either.

## Run 2 — 2026-09-22 — review round: I introduced a port divergence fixing a port-invisible bug

### ⚠ THE CARRY WENT INTO C#'s `Renormalize` AND NOT INTO TYPESCRIPT'S

Applying `StampOrCarry` at every `Stamp` call site included `Renormalize`, whose TypeScript twin was
untouched. Verified empirically on `가Xé` under NFD — a jamo run NFD leaves unchanged beside an `é`
that decomposes, so the whole-string no-op short-circuit does not fire:

    TS  [0,2],[0,2],[2,3],[3,4],[3,4]
    C#  [0,1],[1,2],[2,3],[3,4],[3,4]

⚠ **AND THE C# SIDE WAS THE WRONG ONE, NOT MERELY THE DIFFERENT ONE.** The identity carry is right for a
REGEX MATCH, whose characters are independent. A **canonical block is a unit by construction** — base
plus combining marks, or a surrogate pair — so carrying per code UNIT inside one hands out `[i,i+1)` for
**half an astral code point**, which this module's own comments name as a defect class twice. Reverted
to `Stamp`, with the reason on the line.

**Nothing would have caught it**: parity compares IPA strings, and no reading changed. Exactly the gap
#1419 is about, hit while fixing a bug that came through the same gap.

### And the same class was still live one primitive over

`rebuilt` / `Rebuilt` collapses a `Piece` onto its whole span even when the piece's text equals its
source slice — **the common case for a segmenter that only INSERTS separators** (ja's bunsetsu spaces,
km's U+200B). Symmetric across both ports, so not a parity bug, but the same known-looking answer. Given
the identical proof, it is fixed here rather than noted:

    fleet rows where two tokens share a span:  4,639 → 4,262 (rewrite) → 4,217 (rebuilt)

ja is unchanged at 3 — its residue is overlap, not collapse.

### ⚠ AND THE TEST ASSERTED AN INVARIANT THIS VERY DOCUMENT CALLS FALSE

It required **every token span to be distinct**, two paragraphs below the note that two tokens sharing a
span is often *correct* and that 4,217 golden rows do it legitimately. It held for this one string and
would have mis-fired as a "regression" the moment that string gained a number. Retargeted to the
property actually at stake: **no token spans the whole input.**

⚠ **THE CONSUMER HAD WRITTEN THE SAME MISTAKE INTO THEIR OWN RECOMMENDATION** — their investigation doc
advised declining the measured tier whenever two spans coincide — and withdrew it when given these
numbers. They had not implemented it, so the code was right and the prose was wrong, **which is the more
dangerous way round: the prose reads more confident than the diff.**
