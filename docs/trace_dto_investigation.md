# #1150 stage 1 — a derived trace, and what it cost to find out where it does not reach

## Run 1 — 2026-08-28 — build it at the seam that already computes the answer

`phonemize(text, lang) → string` discards how the string was produced. #1150 stage 1: an additive
`phonemizeTrace` carrying, per token, its span, its surface, what the NATIVISER rewrote it to, and what it
emitted — with `ipa` byte-identical to `phonemize()`.

**Why it is small.** `assembleClauses` already computed the answer and threw it away:

    const at = m.index ?? cursor;
    handle(m, sink);
    cursor = at + m[0].length;

A token's span is that arithmetic kept. Its readings are whatever the handler emits between `beginToken` and
`endToken`. **No language module changed** — 159 of 180 dirs route through this one function.

**The one piece not derivable from the seam** is `nativised`: `nat()` is called inside the handler, so the
seam sees only the IPA. Rather than thread a trace object through 159 modules × 2 engines, `makeNativiser`
reports to an ambient recorder. ⚠ That is safe **for a reason specific to this code, not a general one**:
`Phonemizer.text()` is SYNCHRONOUS, so nothing can interleave between `beginToken` and `endToken`. Making
`text()` async would invalidate it, and the recorder says so.

## Run 2 — three things the build got wrong, each found by measuring rather than reasoning

### ⚠ Recursion: an embedded run is read by ANOTHER engine

`emitUnclaimed` hands a foreign run to a different language's engine, which runs its own `assembleClauses`.
Without a depth guard the inner engine would overwrite the outer engine's `normalized` and append its tokens.
Guarded, and pinned: `Это Windows компьютер` in `ru` yields exactly three tokens, with `Windows` read by the
English engine.

### ⚠ An unclaimed run was emitting IPA belonging to NO token

First cut recorded only the tokenizer's own matches, so `Windows` above contributed `wˈɪndoᶷz` to the output
and appeared nowhere in the trace. A trace that cannot account for part of its own output is worse than none.
`emitUnclaimed` now opens a token, which required threading the gap's base offset so the span is absolute.

### ⚠ And `emitUnclaimed` has TWO callers meaning different things — caught by the span test

`hmong.ts` calls it from INSIDE its handler, for a run its own tokenizer already claimed, passing the token's
own text. Spans were then relative to a different string:

    hmn: span 0,6 is not "Dundee"        hmn: spans out of order at 0,6

The readings there belong to the token already open. `beginToken` is now re-entrant — outermost wins, inner
nests. **This was found by an assertion, not by reading**, which is the argument for having written the span
invariant as a test rather than a comment.

## Run 3 — where the trace does NOT reach, stated in the API

Checked across every golden language rather than assumed:

    traced: 178   untraced: 7   → cmn en en-GB en-IN fr fr-CA my

Those hand-roll their own tokenizer loop (english's two-phase tagger, french's liaison lookahead, mandarin's
code-point scan, burmese's) and never reach the seam, so they emit **no tokens at all**.

⚠ **Returning an empty list silently would be the exact defect this API exists to expose** — an absence that
reads like a clean result, which is how #1131 and #1140 hid. So `PhonemeTrace.traced` says so, and the test
pins the untraced set EXACTLY: an engine that stops routing through the seam fails rather than quietly
producing an empty trace.

### And a second limit, found by an accounting check

Over 7,352 golden rows the trace's `ipa` matched `phonemize()` **0 mismatches** — but the tokens' readings did
not always reassemble into it (527 rows). The cause is real and not a bug in the trace: some engines run a
whole-string pass AFTER the clause assembler. Spanish spirantizes across word boundaries, so `gato` **emits**
*ɡˈato* and the sentence **reads** *ɣˈato*; Assamese collapses `dʱdʱ` → `dʱː`. The field is therefore named
`emitted`, not `ipa`, and documented as the token's contribution rather than its surviving output.

## Deliberately not done

  * **Stage 2 (normalizer provenance)** — spans index `normalized`, and `normalized` is returned so they mean
    something. Mapping back to the caller's string is not an offset problem: normalization REORDERS
    (`Obugazi: 1 244.7 km²` → *Obugazi: kiromita eza kyebiriga 1244 7*, the unit's reading ahead of the figure
    it followed). Pretending otherwise would be worse than declining.
  * **Stage 3 (per-phoneme spans).**
  * **The C# port.** ⚠ `Phonemize` is byte-identical either way, so the parity gate is unaffected — but the
    seam instrumentation now exists in `clauses.ts` and not `Clauses.cs`, and a porter must not discover that
    by surprise. Both C# sites carry a `PAIRED-FIX PENDING (#1150)` marker naming the issue, per PORTING.md's
    own convention, to be DELETED when the port lands. The reasoning for TS-first is that stage 1 exists to
    prove the API shape, and porting an unproven shape doubles the cost of changing it.

## Gates

    goldens        0 rows changed fleet-wide — `phonemize()` is untouched
    parity fleet   136 languages, 26,827 rows, 0 differ
    TS suite       5,709 passed (10 new)   ·   dotnet test 2,719 passed
    tsc + package fence clean
