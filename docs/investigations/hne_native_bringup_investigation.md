# Chhattisgarhi (hne) native bring-up — ⛔ cannot-verify

Chhattisgarhi / छत्तीसगढ़ी — Eastern Indo-Aryan (Eastern-Hindi group), ~16M speakers (Chhattisgarh), Devanagari.
A ⛔ **cannot-verify** stub on the shared Hindi engine — the Awadhi/Bhojpuri pattern.

## The referee check (done FIRST — the decisive step)

The roadmap flagged Chhattisgarhi as a "⛔ clone risk", so the first task was to determine whether an *independent*
referee exists. It does not:

- **wikipron hne_deva** — 404 (broad and narrow).
- **kaikki Chhattisgarhi** — 404 (no dictionary extract).
- **epitran** — has **no hne-Deva mapping at all** (`DatafileError`), so not even a circular Hindi clone to
  (mis)measure against.

So there is **no substantial independent attestation**, and Chhattisgarhi is segmentally a Hindi-belt near-clone —
the definition of ⛔ (vs 🔷, which requires a substantial independent source, as Maithili's 167-word wikipron).

## Why it's genuinely unverifiable (not just "no referee yet")

Chhattisgarhi is distinguished from Hindi **mostly GRAMMATICALLY** — case markers (-ला, -के), verb agreement,
pronouns — **not segmentally**. Its phoneme inventory is essentially Hindi's. So even if a Hindi-clone referee
existed (as epitran bho-Deva is for Bhojpuri), an engine and that referee would agree trivially on the shared bulk,
measuring nothing. The only non-circular axis is the handful of features where Chhattisgarhi ≠ Hindi.

## What's built (and honestly, how thin it is)

The Hindi Devanagari engine (`makeNativeHindi`) + a Chhattisgarhi data file implementing the DOCUMENTED
Eastern-Hindi divergences it **shares with Awadhi/Bhojpuri** (Grierson LSI VI-ii; the Eastern-Hindi phonologies are
near-identical):

- **श/ष → [s]** (no /ʃ/): शहर→[səɦəɾ], देश→[d̪eːs].
- **ऐ/औ kept as the diphthongs [ai]/[au]** (Hindi monophthongised to ɛː/ɔː): बैल→[bail], कौन→[kaun].
- **no Hindi əɦə-lowering** (शहर→[səɦəɾ], not the Hindi [ʃɛɦɛɾ]).

**Honest limitation:** these are the SAME divergences as Awadhi and Bhojpuri — no Chhattisgarhi-*only* segmental
feature is confidently attested beyond them. So segmentally this stub is ~Awadhi/Bhojpuri, and its real
distinctiveness (grammar) is out of scope for a phonemizer. It exists for population coverage, not because it adds
a segmentally-novel phonology.

## Verdict — ⛔ Cannot-verify

No independent referee; the shared bulk is asserted (by attestation, Grierson) and only the distinctive features
are gold-checked (`test/chhattisgarhi.test.ts`) — the axis where a Hindi clone is demonstrably wrong. **Outstanding
(unverifiable):** everything but the distinctive-feature gold is asserted; a real Chhattisgarhi pronunciation
corpus would be needed to lift this past ⛔.
