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

## Run 3 — where the trace did NOT reach, and closing it

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

## Gates

    goldens        0 rows changed fleet-wide — `phonemize()` is untouched
    parity fleet   136 languages, 26,827 rows, 0 differ
    TS suite       5,709 passed (10 new)   ·   dotnet test 2,719 passed
    tsc + package fence clean

## Run 4 — the three directives from review

### Every engine is traced now, not 178 of 185

The four that bypass `assembleClauses` were the primary consumers, and an untraced engine is exactly the
"absence that reads like a clean result" this API exists to expose. Two hook shapes, because one does not fit:

  * **streaming** (`beginToken`/`endToken`) — `assembleClauses` and the code-point scanners;
  * **direct** (`noteToken(span, surface, emitted)`) — for a pipeline that only knows a reading after
    rendering the whole stream. `english.ts` runs a POS tagger across the utterance before resolving;
    `french.ts` needs liaison to look one word ahead. Neither ever has a token "open" while its reading is
    produced.

⚠ Three engine-specific traps, each found by the span assertion rather than by reading:

  * **burmese** passed no base offset to `emitUnclaimed`, so spans were relative to the GAP. Caught as
    `my: span 1,3 is not "US"`.
  * **mandarin** scans CODE POINTS. A code-point index is not a string offset once a supplementary character
    appears, and Han has plenty — an offset table maps one to the other.
  * **french** records at FLUSH, not at push: `accentFinal` MUTATES the group in place before it is joined, so
    a reading captured at push is not the reading that ships.

And a guard the failures taught: `beginToken` now requires that an engine has DECLARED itself, or one driving
`clauseSink` without `enterEngine` produces tokens against an empty `normalized` — `traced: false` beside a
populated token list. The coverage test is pinned at **zero untraced**, not at a list of known bypasses.

### Rewrites are events, so `emitted` and `ipa` can differ with a stated cause

`TraceToken.emitted` is what a token CONTRIBUTED; several engines then rewrite the ASSEMBLED string (527 of
7,352 golden rows). Spanish spirantizes across word boundaries — `gato` emits *ɡˈato*, the sentence reads
*ɣˈato*. Without an event the consumer sees a discrepancy with no cause attached, which is the same
invisible-transformation problem one layer up.

⚠ **Normalization is covered for all 180 engines at once, without touching any of them.** Each module calls
its own `normalize*()` inline, so instrumenting them one at a time would be 180 edits and would still miss
the registry's pre-passes. But the caller's string and the string the tokenizer sees are both known at
`enterEngine`, and their difference IS the normalization — including the reordering that makes a span
un-mappable back to the input. Naming the rewrite is stage 1's contribution to stage 2, not a substitute.

### The C# port landed with it

Dual maintenance from the start rather than a `PAIRED-FIX PENDING` marker. `Core/Trace.cs` mirrors the TS
recorder ([ThreadStatic], like `Foreign`'s host stack), and the same four engines report explicitly.
`Phonemizer.PhonemizeTrace` is the entry. Verified engine-by-engine against the TS output, not just compiled.

    parity fleet   136 languages, 26,827 rows, 0 differ — Phonemize is untouched
    goldens        0 rows changed
    TS 5,713 passed   ·   dotnet test 2,739 passed (20 new)   ·   tsc + fence clean

## Run 5 — "doesn't that mean the post-assembly passes also need to push an event?"

Yes. And the number I had reported was both stale and wrong, in opposite directions.

**Stale**, because 527/7,352 predated hooking the hand-rolled engines: those languages counted as unaccounted
only because they produced NO tokens. Re-measured with all 185 traced it rose to **1,205 (16.4%)**.

⚠ **And then most of THAT was a bug in the checker, not the engine.** An `emitted` entry can itself be
multi-word — a numeral expansion is emitted as ONE string — and I was comparing token entries against
space-split output words. Comparing joined strings instead:

    1,205 (16.4%)  →  180 (2.45%), 7 languages

The remaining 180 were seven genuine post-assembly passes, each now reporting:

| language | pass | what it does |
|---|---|---|
| `ca`, `gl` | `spirantize-across-words` | `bˈin` → `βˈin` |
| `as` | `collapse-geminates` | `pɹɔttekɔtote` → `pɹɔtːekɔtote` |
| `awa` | `awadhi-flap` | `bˈəɖaː` → `bˈəɽaː` |
| `ne` | `nepali-inherent-vowel` | `sʈjanpʰˈoɾɖə` → `sʈjanpʰˈoɾɖʌ` |
| `fr-CA` | `accent:fr-CA` | `a` → `ɑ` |
| `es-419` | `accent:es-419` | `infoɾmaθjˈon` → `infoɾmasjˈon` |

⚠ **The two accent variants are the interesting ones.** They are whole-string deltas over the BASE engine's
output, so a trace token records the Castilian reading while the utterance ships the American one. Nothing
about that is visible from the token record alone — the same shape as the nativiser, one layer along.

    unaccounted: 0 of 7,352 rows, 0 languages   (TS)      0 of 816 sampled rows   (C#)

### The durable part is the invariant, not the seven fixes

Hand-hunting post-passes does not scale and would miss the next one. **`tokens + declared rewrites must
account for the output` is now a test**, pinned at zero, verified to FAIL when a single `noteRewrite` call is
removed (`ca:` rows appear immediately). A post-assembly pass added without an event is now a failing test
rather than a silent discrepancy — which is #1131's lesson applied to the trace itself.

Gates: parity 136 languages / 26,827 rows / 0 differ · goldens 0 rows changed · TS 5,714 passed ·
dotnet test 2,739 passed · tsc + fence clean.
