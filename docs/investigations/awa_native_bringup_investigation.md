# Awadhi (awa) native bring-up — a sourced ⛔ stub

Awadhi / अवधी — Eastern Hindi (Indo-Aryan), ~38M speakers, the language of Tulsidas's *Rāmcaritmānas* and
Jayasi's *Padmāvat*. Devanagari. This is a deliberate **⛔ cannot-verify stub** (user steer: "even ⛔ can be
worth stubbing out") — built to *cover* a large population, not to claim a measured convergence.

## Why ⛔, and why it's still worth doing

Awadhi is in the same epistemic situation as Bhojpuri (`bho`): **no independent referee exists.** wikipron `awa`
is empty (0 lines), there is no kaikki Awadhi extract (404), and epitran ships no Awadhi — and an epitran clone
would emit the Hindi values anyway, so it couldn't verify anything. Per Saksena (quoting Bloch), the
Eastern-Indo-Aryan phonologies are *"perceptibly identical"* and the lects are distinguished chiefly by
**grammar**, which a phonemizer does not touch. So a Hindi-derived engine and any Hindi-clone check agree
trivially — nothing is measured. → ⛔.

What makes this **better than a blind clone** (the mistake the `bho` note warns against) is the *anchor*: the
divergences are taken from an authoritative descriptive grammar, not defaulted from Hindi.

## Sources (checked + fetched)

- **Baburam Saksena, *Evolution of Awadhi (a Branch of Hindi)*** (1937) — the definitive descriptive/historical
  grammar. Fetched the archive.org OCR (`in.ernet.dli.2015.238311`, 933 KB text). Chapter I ("Individual Sounds")
  gives the full segmental inventory and the modern-Awadhi phonetic descriptions (based on the **Lakhimpuri**
  dialect). This is the primary anchor.
- **Grierson, *Linguistic Survey of India* Vol. IX.i** and the literary corpus (*Rāmcaritmānas*, *Padmāvat*) —
  noted as further references; not needed once Saksena's phonology chapter was in hand.

## Documented divergences implemented

1. **Sibilant merger श/ष → [s]** (Saksena §87: *"the dental sibilant is the only one in Awadhi… ś and ṣ of
   foreign words are always represented by s"*). शहर → sˈəɦəɾ, देश → d̪ˈeːs. (Data file; same merger Bhojpuri has.)
2. **Intervocalic flap ड/ढ → [ɽ]/[ɽʱ]** except after a nasal (Saksena: *"intervocally ḍ and ḍh are found only
   after a nasal… otherwise they become ṛ and ṛh"*). Implemented in `awadhi.ts` as a post-process on the engine
   output: अडा → ˈəɽaː, सडक → sˈəɽək (vs Hindi ɖ); post-nasal अंडा → ˈə̃ɳɖaː and word-initial डर → ɖˈəɾ correctly
   keep [ɖ] (the flap's lookbehind requires a vowel, so a nasal or word start blocks it).

Everything else runs on the shared Hindi engine (`makeNativeHindi`: schwa deletion, weight stress, numbers) —
which, per Saksena/Bloch, is correct **by attestation**, not by defaulting.

## Deferred (documented by Saksena but uncertain from the OCR)

- **Whispered (voiceless) final vowels** — Saksena describes final short vowels as whispered and elided in
  connected speech; the precise realization/conditioning is not reliably extractable from the rough OCR.
- **ऐ/औ** SHIP as the eastern diphthongs [ai]/[au] (diverging from Hindi's ɛː/ɔː, following Bhojpuri) — this is
  asserted in the gold, not deferred; only the exact *quality* is provisional (Saksena's vowel chart is too
  garbled in OCR to confirm a monophthong reading). **Short e/o quality** remains genuinely deferred.

## Verdict — ⛔ Cannot-verify (a sourced stub)

A Devanagari phonemizer for ~38M speakers, anchored on Saksena (1937), grading the two documented divergences on
a hand-adjudicated gold (`test/awadhi.test.ts`). Correctness on the Hindi-shared bulk is **asserted from the
grammar, not measured** — there is no independent referee and (per Saksena/Bloch) there is no phonological axis
on which one could exist for this lect. The gap is recorded in the referee-eval config (`referees: []` +
`secondaryGap`). Contrast Maithili, which *does* have 167 human wikipron transcriptions and so clears the ⛔ bar.

## Run 2 — full inventory audit against Saksena's charts (2026-07-19)

**Question:** the original bring-up worked from a rough OCR of Saksena and had to defer several vowel/consonant
decisions as "provisional". With the *chart pages themselves* now read directly (rendered from the PDF at
`~/Books/2015.238311.Evolution-Of.pdf`, §12 consonants p.24 + §9/§90–100 vowels p.25), does the module's
encoding still hold?

**Findings (module vs Saksena §12/§9):**

- ✅ **Confirmed correct:** single sibilant श/ष/स→[s] (§12/§87); intervocalic ड/ढ→ɽ/ɽʱ (§12 "Flapped");
  nasal vowels as separate phonemes (§122); dental/retroflex + palatal-affricate system (§12).
- ⚠ **Real drift, fixed:** `व` was [ʋ] (inherited Hindi labiodental). Saksena §12 lists the bilabial semivowel
  as **[w]** — the same eastern reflex we set for Bhojpuri. Changed व→w.
- 🔀 **"Provisional" flag resolved and upgraded:** ऐ/औ shipped as [ai]/[au] with a caveat that the OCR couldn't
  confirm the quality. **§2395** settles it: *"Lakhimpuri ʌi, ʌu … are represented in the Eastern dialects by
  ʌe, ʌo respectively."* The Lakhimpuri basis therefore genuinely keeps the diphthong (it must NOT be flattened
  to the Bhojpuri monophthong ɛ/ɔ — that is the *Eastern* reflex). Refined the onset a→**ʌ** (central, per
  §2395): ऐ→ʌi, औ→ʌu; dropped "provisional". Added ʌ to the flap's vowel class in `awadhi.ts`.
- 📐 **Documented, not encoded (fine phonetic detail):** the OIA-a reflex / inherent short vowel is [ʌ]
  (half-open central, §95/§103), not [ə]; but the engine keeps literal `ə` because schwa-deletion keys on it
  (adopting ʌ breaks deletion — same tradeoff that kept Bhojpuri on ə). And Saksena classes र as a trill [r]
  (§12 "Rolled") where we keep the Hindi tap [ɾ] (free variation). Both noted in the provenance.
- 🕳 **Still deferred (larger follow-up):** whispered/voiceless final vowels (§113–119) — a real Awadhi trait
  needing a new final-devoicing rule, not just a data flag.

**Result:** the audit confirmed the module is largely Saksena-faithful; one sourced fix (व→w), one provenance
upgrade (ऐ/औ→ʌi/ʌu, confirmed for Lakhimpuri), two documentable phonetic notes. Hindi + Bhojpuri tests
unaffected (the change is awa-local); awa gold updated. Verdict stays **⛔ cannot-verify** — no independent
referee exists; this tightens the *sourcing*, not the *verification*.
