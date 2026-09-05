# Awadhi (awa) native bring-up — 🔷 single-source (Saksena)

Awadhi / अवधी — Eastern Hindi (Indo-Aryan), ~38M speakers, the language of Tulsidas's *Rāmcaritmānas* and
Jayasi's *Padmāvat*. Devanagari. **🔷 single-source** — the divergences and their anchoring gold both come from
ONE documented grammar, Baburam Saksena's *Evolution of Awadhi* (1937).

> **Reclassified ⛔ → 🔷 (Run 3, 2026-07-19).** Runs 1–2 below call this a "⛔ cannot-verify stub". That was a
> mis-application of the taxonomy: **🔷 means *single-source*, not single-source *plus* independent verification.**
> awa has a single source (Saksena), and Saksena is a real Awadhi-specific grammar with IPA — not a circular
> Hindi clone — so grading against it measures something. The absence of an *independent* second referee keeps awa
> *single-source*, but that is exactly what 🔷 is; it does not drop it to ⛔. (bho made the same ⛔→🔷 move earlier.)
> The ⛔ framing in the Run 1–2 text below is left as written for the record; the current verdict is 🔷.

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

## Verdict (Runs 1–2) — ⛔ Cannot-verify [SUPERSEDED by Run 3 → 🔷; see the banner at the top]

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

## Run 3 — reclassified ⛔ → 🔷 (2026-07-19)

**Trigger (user):** *"🔷 is single-source, not single-source plus independently verified."*

This corrected a definitional error that ran through Runs 1–2 (and through my Run 2 note "verdict stays ⛔"). I
had been treating 🔷 as requiring an *independent* referee on top of a source, and so parked awa at ⛔ on the
grounds that the only conceivable machine referee (epitran) is a circular Hindi clone. But 🔷 asks only for a
**single documented source**, and awa has one: Saksena's *Evolution of Awadhi* — a genuine Awadhi-specific
descriptive grammar with IPA charts and transcribed forms, **not** a Hindi clone. Grading the engine's documented
divergences against Saksena therefore measures something real; it is single-source, so **🔷**, not ⛔.

This is the same ⛔→🔷 move `bho` already made (its grammar-mined gold). The distinction with `mai` also collapses
to a within-🔷 evidence-quality difference: mai's single source happens to be an *independent* human referee
(wikipron 167), awa's is a grammar — both 🔷.

**Surfaces flipped:** `awadhi.jsonc` provenance, `awadhi.ts` header, `test/awadhi.test.ts` header,
`tools/referee-eval/langs/awa.jsonc` (header + secondaryGap; `referees` stays `[]` — still no *machine* referee),
`docs/language-maturity.md` (awa row + two stale ⛔ cross-references in the scope note and the mai row), and the
catalogue (`gen-seed.py` awa|🔷, regenerated `catalogue.tsv` + `languages.db`).

**Not changed:** the engine and gold are byte-identical — this is a *classification* correction, not a
phonology change. No test values moved; Hindi/Bhojpuri unaffected.

**Follow-up (unchanged from Run 2):** the anchor is still a hand-adjudicated Saksena gold, not a *mined*
single-source grade. Building a Saksena referee (the bho pattern) would upgrade the anchor from hand-gold to a
measurement — blocked on the corrupt OCR IPA (needs visual reading of the § example forms + the appendix
specimen texts). Whispered final vowels (§113–119) remain deferred.

## Run 4 — visual page reading to attempt a Saksena-mined gold (2026-07-19)

**Goal:** upgrade awa's anchor from a hand-gold to a *mined* single-source grade (the bho pattern), by visually
reading the PDF (the PaddleOCR IPA is corrupt).

**Key structural finding (blocks the literal bho pattern):** *Saksena's book contains no Devanagari.* The entire
linguistic content is in Saksena's own roman/IPA transcription (the only Devanagari in the 620-page OCR is the
library bookplate). The bho gold was mined as Devanagari→IPA *pairs* straight from a grammar that printed both;
Saksena prints only the IPA. So there is nothing to mine into a Devanagari→IPA gold directly — any such gold
needs the Devanagari supplied from a *second* source.

**Sources read:**
- §12 consonant chart (p.24), §9/§90–100 vowel charts (p.25) — clean, already used in Run 2.
- Modern Awadhi specimen "gulgulāwālī kathā" (Texts No. I, **Lakhimpuri** — the module's exact basis), with a
  full English translation. This is the ideal *content* (real connected Lakhimpuri), but its IPA is the
  worst-OCR'd part of the book (Greek + LaTeX fragments); only scattered words survive (razjaz 'king', razniz
  'queen', mAːtariː 'mother', dijaː 'daughter-in-law', tarwariː 'sword'). Word-by-word alignment needs slow
  visual reading of the raw pages.

**The unlock (user):** the *Awadhi dictionary* (अवधी शब्द-कोश, ~/Books/dli.language.0102.pdf) supplies the missing
Devanagari side — a large, independent corpus of real Awadhi **headwords in Devanagari**. Tie-back design:
propose a Devanagari spelling from a Saksena IPA form, then *confirm it exists as a dictionary headword* → a
(Devanagari, IPA) pair where the Devanagari is independently attested (not reverse-engineered by us) and the IPA
is Saksena's. Non-circular by construction; the dictionary lookup also filters transliteration errors. It still
catches engine-vs-Saksena divergences (the point), because our engine is compared to Saksena's IPA, not to the
Devanagari we fed it.

**Blocker:** the tie-back needs a **Devanagari OCR of the dictionary**, and this environment has none — tesseract
ships only `eng` data, and paddleocr is not installed. The dictionary is a clean print scan (unlike Saksena's
corrupt IPA), so Devanagari OCR would work well *if* the tooling were available (the user's PaddleOCR workflow,
which produced the Saksena .md, is the natural route). Decision surfaced to the user: PaddleOCR the dictionary to
unlock a scalable tie-back gold, vs. hand-build a smaller (dozens-of-words) gold from the legible Saksena forms +
manual dictionary confirmation.

## Run 5 — dictionary tie-back proven; Devanagari OCR works (2026-07-19)

**User steer:** *"the Devanagari headword corpus from the dictionary might give us something to tie the IPA back
to."* This is the unlock — it supplies the independent **Devanagari** side that Saksena lacks.

**Tooling cleared:** fetched tesseract `hin` (tessdata_best) — Devanagari OCR of the dictionary (अवधी शब्द-कोश,
a clean print scan) works well. One page (p.40) yielded 51 clean headwords (a few conjunct/nukta slips:
खइँतड़→खदट्ूँतड़). Extraction = the Devanagari run before each `– (POS)` marker, both columns.

**Pipeline proven end-to-end** on that 51-word sample:
- OCR → headword extraction → `phonemizeWord`: **51/51 phonemize, 0 failures** (real Awadhi vocab, not Hindi
  cognates — a first).
- Divergence rules fire on real words: **16** intervocalic flaps ड→ɽ, **9** व→w, **6** श/ष→s. (ऐ/औ→ʌi/ʌu: 0 on
  this page.) So the Awadhi rules are exercised by genuine vocabulary, not just the test set.

**Two distinct products this enables:**
1. *Coverage* (dictionary alone, LOCAL): run the engine over the whole headword corpus → does it parse real
   Awadhi without dropping graphemes / leaking Latin. A robustness metric, not correctness.
2. *Correctness gold* (dictionary × Saksena): (Devanagari from dict, IPA from Saksena) pairs — non-circular,
   because neither side is derived from the other.

**LICENSING CONSTRAINT (user's standing rule: committed referee/training data must be permissive).** The
dictionary is a University of Lucknow publication (not permissive); Saksena (1937) is not cleanly public-domain
either (author d. 1971 → India life+60). So the **bulk** headword corpus and any 1000+-row mine **cannot be
committed** — that would be a data dump of copyrighted works. The dictionary is therefore used **locally only**
(coverage measurement + confirming that a Devanagari spelling is a real attested Awadhi word). The *committable*
artifact stays a **modest hand-adjudicated gold of individual word→IPA facts** (dozens, with attribution) — the
same kind of artifact test/awadhi.test.ts already holds, just larger and dictionary-confirmed. That caps the
"mined grade" at a bounded hand-built gold, not a bho-scale mine — but it still upgrades the anchor from ~10 to
~several-dozen dictionary-confirmed, Saksena-sourced pairs plus a local coverage %.

## Run 6 — modern-text corpus via the corpus engine (2026-07-19)

**User steer:** *"Can we tokenize some modern Awadhi, like news articles or something?"* — the dictionary is
*ठेठ देशज* (rare native words) and omits common vocabulary, and it's rights-restricted. A modern, **permissive**
corpus fixes both. **User steer 2:** *"we have tools for this action in portable-espeak — for building
wordlists."* → use the existing corpus engine, not an ad-hoc scraper.

My first instinct (live MediaWiki `allpages` + `extracts` API) hit exactly the failure its docstring warns about:
alphabetical `allpages` front-loads number/stub pages, and the extracts API returned mostly empty bodies. The
committed engine `portable-espeak/tools/corpus/build.ts` streams the **Wikipedia dump** instead — clean, fast,
rate-limit-free. Ran (Awadhi is Devanagari, so gate on that; no data/awa/meta.json needed):

    npx tsx tools/corpus/build.ts --lang awa --wiki awa --alphabet Devanagari --sources dump --out awa-wiki-words.txt

→ **6,800 awawiki pages → 525,563 gated tokens → 48,558 frequency-ranked types.** Top words are the real modern
Awadhi function words the dictionary lacks (के, से, है, में, अउर 'and', होय 'is', अऊर). CC-BY-SA → permissive.

**Coverage** (vernacula awa engine over the corpus): **48,554/48,558 = 99.99%** phonemize; **top-1000 most-frequent
= 100%**; the 4 empties are rare Sanskrit signs (ऽ ॠ ऌ ॡ). Divergences fire heavily on real text: श/ष→s 14923,
व→w 8022, ऐ/औ→ʌi/ʌu 2698, ड/ढ→ɽ 1898, nasal 7674. (Dictionary corpus corroborates: 6570/6575 = 100%.)

## Run 7 — the measured single-source grade (2026-07-19)

Built the referee `tools/referee-eval/referees/awa.saksena.tsv`: **33 (Devanagari, IPA) pairs**, IPA hand-read
from Saksena's §41-52/§90-136 origin-of-sounds forms (the PaddleOCR IPA is corrupt), Devanagari supplied from his
English glosses — **non-circular** (neither side derived from the other). The user's dictionary tie-back was the
key idea; in practice the dictionary is used LOCALLY to *confirm* a spelling is a real attested Awadhi word (the
Saksena↔dictionary intersection is small because the two cover different vocabulary strata).

Wired into the referee harness (`langs/awa.jsonc` folds, `eval.ts`, floor 0.9): **93.9% folded (31/33).** Folds
are notation-only (ʌ→ə, ɪ→i, ʊ→u, ɾ→r trill~tap, ɦ→h, ɡ→g; length/dental/nasal/tie auto-stripped). The 2
residuals (पसार pəsaːr~pasaːr, अपन əpən~apʌn) are Saksena's variable short-[a] vs our ə — notation, not error.
**कैथा→kʌitʰaː independently validates ऐ→ʌi**; जेठ/आज/राजा/साँझ/टाँग/काँटा/खेत/तेल confirm the shared core and the
व→w / श→s / flap fixes on forms the module was not built from.

**Net:** awa is now a *measured* 🔷 (93.9%) with real-corpus coverage (99.99%), up from a ~10-word hand-gold.
Licensing: the Saksena referee is a compiled fact-set (his transcriptions + standard Devanagari) — a new work;
the awawiki corpus is CC-BY-SA (regeneratable, not committed); the Awadhi Shabd-Kosh stays LOCAL (spelling
confirmation only). Verdict unchanged (🔷) — the tier is right; this makes the evidence a measurement.
