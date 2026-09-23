# The trace does not say WHICH TIER resolved a token (#1453)

`PhonemeTrace.tokens[]` carries `span`, `inputSpan`, `surface`, `nativised`, `emitted` and `ipaSpan` —
**where** a reading came from in the text and **where** it landed in the IPA. It did not carry **how**
the word was resolved, and that is the first question a wrong reading actually raises.

## Run 1 — 2026-09-23 — the motivating case, and what it cost to answer without the field

```
"the τ value"    normalized "the tau value"   ->  ðə tʰˈɔː vˈæɫjuː
"the tau value"  normalized "the tau value"   ->  ðə tʰˈaᶷ vˈæɫjuː
```

Byte-identical normalized text, verified by hex dump. Working out why took **four separate probes** — a
hex dump, an order-dependence test, a sync-vs-async comparison, and reading the neural entry point — to
reach the answer that one went to the tagger and the other to the n-gram (#1452). A `source` field
answers it in one call.

## Run 2 — ⚠ THE VALUE THE FIELD WAS ADDED FOR WAS UNREACHABLE

`phonemizeTrace` calls the SYNC `phonemize`, which never consults the OOV tagger. So `tagger` was a
declared union member **nothing could produce through the public API** — and it is precisely the value
#1452 needs. Shipping the field sync-only would have been a slot that cannot be reached, which this
repo has been burned by before (`pos-slot-may-be-unreachable`).

`phonemizeTraceAsync` closes it:

```
the tau value   normalized "the tau value"   tau=tagger   ðə tʰˈaᶷ vˈæɫjuː
the τ value     normalized "the tau value"   tau=g2p      ðə tʰˈɔː vˈæɫjuː
```

### ⚠ WHICH FORCED A SECOND FIX, BECAUSE trace.ts SAYS SO IN ITS OWN HEADER

> *"The recorder is safe here for a reason specific to this code, not a general one: `Phonemizer.text()`
> is SYNCHRONOUS, so between `beginToken()` and `endToken()` nothing else can run. It is not safe to make
> `text()` async without revisiting this."*

An async trace holds an ambient recording across an `await`. `startTrace` used to overwrite
unconditionally, so two overlapping calls would have **clobbered each other and returned a trace
stitched from both** — a corrupted result that looks entirely valid. It now THROWS on re-entry. The
hazard is CONCURRENCY rather than async as such, and failing loudly is the only honest answer when the
corrupt output is indistinguishable from a good one.

## Run 3 — ⚠ THE ISSUE ASSUMED trace-parity ALREADY GATED THE TRACE SURFACE. IT DID NOT.

The issue says the field "crosses the port boundary and is gated by `npm run check:trace-parity`". The
gate compares a dump, and **the dump carried only `span:inputSpan:ipaSpan`** — so a new field on the
public trace surface would have been in **no gate at all**. That is exactly how #1408's null `InputSpan`
escaped, which is the defect trace-parity was built for.

Both dumpers now emit `span:inputSpan:ipaSpan:source`. ⚠ **And the gate is not vacuous** — measured over
the 36,495-row corpus:

```
lexicon    13,434
g2p           111
heteronym      96
(empty)   899,440    ← the 188 other languages, which report nothing: `absent` is the common case
189 languages, 36495 rows compared — traces identical across ports
```

⚠ `foreign` and `passthrough` occur in the API but not in this corpus, and `tagger` cannot: the dump
uses the SYNC path in both ports, and the C# port has no async trace entry at all. So the cross-port gate
covers three of the six tiers, and the TS suite covers the rest. Written down rather than left to be
discovered as a hole.

## What the field does NOT claim

⚠ **`absent` means "not reported", never "unknown tier"** — the same rule `inputSpan` and `ipaSpan`
already carry. 188 engines report nothing here.

⚠ **AND IT IS ABSENT WHEN ONE TOKEN'S READINGS DISAGREE.** A numeral becomes many words and a token
accumulates several readings; where they do not all come from the same tier, reporting the first would be
a confident wrong answer to a question with no single answer. The flag is sticky, so a later reading
matching the first does not un-poison it.
