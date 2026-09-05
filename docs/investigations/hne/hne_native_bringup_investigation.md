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

## Literary corroboration (not a referee, but better than blind)

Because there is no phonetic corpus, the build is **corroborated against a documentary source** — Hira Lal
Kavyopadhyaya's **"A Grammar of the Chhattisgarhi Dialect of Eastern Hindi" (1921, rev. Grierson, LSI)** — via its
documented phoneme inventory and the attested UDHR Article-1 sample transcription. This was NOT a rubber stamp: it
**confirmed one claim and refuted another**:

- ✅ **श/ष → [s]** — CONFIRMED: the grammar's fricative inventory is only /s/ and /h/ (no /ʃ/, no /ʂ/). This is
  Chhattisgarhi's **sole confident segmental divergence from Hindi**.
- ❌ **ऐ/औ → [ai]/[au]** — REFUTED. The initial build blindly copied Bhojpuri's diphthongs, but the grammar's
  vowel inventory lists the **monophthongs /ɛ/ /ɔ/ /eː/ /oː/** (no /ai/ /au/), and the attested sample confirms it:
  **गौरव → [ɡɔrəʋ]** (औ → [ɔ], not [au]). Corrected to ऐ→[ɛː], औ→[ɔː] — i.e. **the Hindi values**.
- The sample also confirms **व → [ʋ]** (ɡɔrəʋ, bʰaːʋ) — Hindi-identical, our engine already correct.

Running the corrected engine on the sample matches it segmentally (modulo the tap ɾ~r and length notation).

## What's built — and how thin it really is (post-correction)

The Hindi Devanagari engine (`makeNativeHindi`) + a Chhattisgarhi data file with the **one** corroborated
divergence: **श/ष → [s]** (no /ʃ/). Everything else — including ऐ/औ→[ɛː]/[ɔː] — is Hindi-identical. So segmentally,
corrected-Chhattisgarhi = **Hindi + श/ष→[s]**. Its real distinctiveness is grammatical (case, agreement), out of
scope for a phonemizer.

**One documented feature NOT modelled:** the attested sample shows Chhattisgarhi **retains schwa more than Hindi**
(लोगन→[loɡən], बरोबरी→[bərobəri], बेवहार→[beʋəhaːr] — where our Hindi engine over-deletes to [bəɾoːbɾiː] /
[beʋɦaːɾ]). Reduced schwa deletion is a real Chhattisgarhi divergence, but the single attested sample is not enough
to model it precisely (it is partial — माम-ला still deletes), so it is documented and deferred, not asserted.

## Verdict — ⛔ Cannot-verify (but corroborated, not blind)

No phonetic referee, so unverifiable in the measured sense; but the distinctive-feature gold is now **corroborated
against the 1921 grammar** — which caught and fixed a real error (the ai/au copy) rather than letting the engine
agree with itself. **Outstanding (unverifiable):** the reduced-schwa-deletion feature (documented, unmodelled); a
real Chhattisgarhi pronunciation corpus would be needed to lift this past ⛔.
