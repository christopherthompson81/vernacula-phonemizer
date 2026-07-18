# Egyptian Arabic (arz) bring-up investigation

First Arabic VARIETY (after MSA `ar`). Design: shared Arabic engine (scanner + diacritizer + numbers) + per-variety
DATA (consonant/vowel maps, phonological rules), registered under its own ISO code `arz` (NOT a runtime variety
flag — the registry/referee/eval/maturity all key on flat codes; precedent: hi/gu/ur share one abugida engine under
distinct codes). Referee: wikipron arz_arab_broad (HUMAN, 800 entries, fully-voweled DIALECTAL IPA — INDEPENDENT).

## Run 1 — 2026-07-17 — baseline: current MSA engine vs the Egyptian referee

The MSA engine (neural diacritizer → MSA g2p) scores **28.6%** folded (590 words) against the Egyptian referee.
The residual is exactly the Egyptian character, in three tiers:

- **DETERMINISTIC consonant shifts** (the signature, easy win): ق→[ʔ] (بقى baq→baʔ, ×18), ج→[ɡ] (×16). Also ث→t,
  ذ→z/d, ظ→zˤ/dˤ (classic Egyptian mergers).
- **DIPHTHONG monophthongization** (rule-ish): MSA [aj]→[eː] (ألفين alfajn→alfen, ×11), [aw]→[oː] (أوضة awdˤ→odˤ, ×5).
- **SHORT-VOWEL restructuring** (the hard tail, like Urdu): ∅→a / a→∅ / i↔a / u↔i (Egyptian syllable structure +
  imāla a→æ + mid-vowel raising differ from MSA). The MSA diacritizer restores MSA vowels — wrong for Egyptian — so
  this tail needs a wikipron-arz-mined VOWEL LEXICON (the Urdu/id pattern), with MSA-restore+transform as OOV fallback.

Plan: Phase 1 = Egyptian consonant g2p + diphthong monophthongization (deterministic → big jump). Phase 2 = the
dialect vowel lexicon. Consonants first — they are what make it *sound* Egyptian and are unambiguous.

## Run 2 — 2026-07-17 — Phase 1: Egyptian consonant + diphthong g2p

Built the variety architecture: shared Arabic engine + `egyptian.jsonc` (ordered IPA shifts) + `createArabic(variety)`
+ registered `arz` (distinct ISO code, NOT a runtime flag). Shifts: ج→ɡ, ق→ʔ, ث→t, ذ→d (also ظ ðˤ→dˤ), ay→eː, aw→oː.

**Result: 28.6% (MSA baseline) → 37.3% folded** vs the Egyptian referee (+8.7pp). The consonant/diphthong shifts
land exactly. The residual is now the predicted VOWEL tail:
- short-vowel QUALITY (i↔a, u↔o, u↔i) — MSA diacritizer restores MSA vowels, not Egyptian;
- word-initial ʔ over-generation (ʔabril vs abril);
- imāla (aː→æ in some contexts);
- loan ج=ʒ (French loans keep [ʒ]; our blanket ج→ɡ is wrong for those — a lexical tail).

Phase 1 = the architecture + the deterministic consonants (what makes it SOUND Egyptian). Phase 2 = a
wikipron-arz-mined VOWEL LEXICON (the Urdu/id pattern) to close the short-vowel restructuring. 🟡 (Phase-1).

## Run 3 — 2026-07-17 — Phase 2 (vowels) is DATA-BLOCKED, not algorithm-blocked

Phase 2 was meant to close the short-vowel restructuring with a dialect vowel lexicon. It has no tractable lever:

- **Vowel RULES are all net-negative** (tested vs the arz referee, fixed−broken): imāla aː→æ **−55**, short a→æ
  **−157**, i→e **−32**, u→o **−12**, word-initial ʔ-drop **−7**. The Egyptian vowel changes (imāla, short-vowel
  quality, epenthesis) are LEXICALLY/context conditioned, not derivable by a blanket rule — the tl/ur pattern.
- **A lexicon has no independent source.** The ONLY machine-readable Egyptian IPA is wikipron arz — and the full
  scrape is the SAME 590 words that ARE the eval referee. Mining a lexicon from it is circular (and 590 words is
  negligible coverage of 118M-speaker text). kaikki arz is sparse; there is no free Egyptian pronunciation corpus.
- The gap is also partly **restoration**: the shared MSA diacritizer under-vowels dialectal words (∅→V) and restores
  MSA (not Egyptian) qualities (i↔a, u↔o). An Egyptian diacritizer would need Egyptian diacritized training data,
  which likewise does not exist.

**Conclusion:** Egyptian **consonants** (the audible dialect character — ج→ɡ, ق→ʔ, ث→t) are done and verified
(37.3% vs an independent referee, up from 28.6% MSA-baseline). The **vowels** are a documented ceiling with current
data — recoverable in principle (a dialect diacritizer/lexicon *would* work), but no independent Egyptian corpus
exists to build or measure one. arz = consonant-correct / vowel-MSA-biased. 🟡 (a real path — more Egyptian data —
that is simply unavailable, like Urdu's restoration wall). Phase 1 was the tractable deliverable.

## Phase 2 — 2026-07-18 — the Egyptian short-vowel LEXICON (kaikki)

Found the Egyptian vowel data after all, in kaikki's **Egyptian Arabic** Wiktionary extract: 1183 entries, **876
with IPA** carrying the correct Egyptian vowels + reflexes (أنا /a.na/, مصر /masˤr/, قط /ʔʊtˤtˤ/). Built
`egyptian-lexicon.tsv` (**554 words**, word→canonical Egyptian IPA): cleaned the IPA (strip slashes/dots),
collapsed geminates to ⟨Cː⟩, normalized narrow→broad (æ/ɪ/ʊ→a/i/u — the notation half of the residual), and
placed a Cairene stress mark before the stressed vowel. Validated **~88–92% against the wikipron-arz referee**
(the residual is notation: initial-ʔ + remaining narrow marks). Wired into `phonemizeArabic` (egyptian variety):
the tokenizer strips harakat to recover the bare key and substitutes the lexicon IPA before the g2p — works
per-word in sentences too (أنا من مصر → ana min masˤr).

**Non-circular split:** kaikki and the wikipron-arz referee share the Wiktionary tradition (95% agree on the 563
shared words), so the eval scores the RULE path (`lexicon:false`, 37.3% unchanged); the lexicon is a SHIPPED
refinement. It fixes the common-word core (مصر, أنا, ازاى, تلفزيون…) where the MSA diacritizer gave MSA vowels;
the OOV Egyptian tail remains → still 🟡. This is Phase 2a (a curated common-word lexicon), not a full solution.

**Farasa (evaluated, rejected on licensing).** QCRI's Farasa has a multi-variety neural diacritizer (the 2019
"Four Varieties" system) that could diacritize large Egyptian text at scale → a Phase-2b silver corpus. But: (a)
the dialect diacritizer is **not** in the downloadable JAR (MSA-only there; farasapy exposes only `diacritize()`),
it's an API/demo; and (b) the Farasa license is **"research purpose only; non-research use → contact QCRI"** —
more restrictive than CC BY-NC, so it fails this repo's permissive-data policy and would taint the training
provenance. Rejected for the pipeline unless QCRI grants explicit permission. The same group's ACL-2024 paper
("Beyond Orthography") also warns text-based dialect diacritizers are unreliable vs speech — they went acoustic.
kaikki (CC BY-SA) is the clean source; a larger permissive Egyptian corpus remains the real Phase-2b lever.

## Phase 3 — 2026-07-18 — the Egyptian NEURAL diacritizer (calima-egy teacher → silver → student)

Found the scale lever after all — CAMeL Tools `calima-egy` (GPL) diacritizes Egyptian at scale, and per ADR-0014
a model trained on its *outputs* is clean (facts-not-expression; GPL doesn't propagate to a silver-trained
student — the same teacher→student pattern the MSA diacritizer used with the Apache CATT teacher). Pipeline (RTX
3090, camel-tools venv, /mnt/data/arz-diac): extract **Masri Wikipedia** (CC-BY-SA, 350k sentences) + the **MIT
dialect-corpus** Egyptian subset (90k) → `calima_egy_silver.py` (calima-egy analyzer + MIT BERT disambiguator →
diacritized silver, **6 parallel GPU workers**, 99% util) → OOV-filter + 90/5/5 split (222,888 train) →
`train_bilstm_sent.py --pausal 1` (silver-only, same arch/alphabet as MSA) → int8 ONNX (15 MB). **TEST DER
1.63% / WER 4.70%** — better than the MSA student (2.17%). Wired variety-aware (`createArabicDiacritizer(variety)`
loads diacritizer-egy for egyptian, MSA fallback).

Result: the diacritizer restores Egyptian vowels + reflexes on running text (قلب→ʔalb, رحت→ruħt, النهاردة→
nahaːrda, مدرسة→madrasa). **NON-CIRCULAR**: the referee is wikipron, the teacher is calima-egy — different
traditions — so the rules-only **37.3→39.5%** lift is independently anchored. The referee undercounts the model's
true quality (1.63% DER) because it is ISOLATED citation words while the model trained on running text and hedges
on isolated forms (مصر→miṣr, hamza-less انا→naː); the shipped path's kaikki lexicon supplements exactly those
isolated common words. This is the MSA pattern (neural running-text model + a citation-form lexicon supplement),
now for Egyptian, from fully permissive corpus + a GPL-offline teacher.

**Farasa vs calima-egy (why calima-egy won):** both are Arabic dialect diacritizers, but Farasa's is
research-license-only (fails the permissive-data policy even for offline silver) and API/JAR-MSA-only; calima-egy
is GPL (not non-commercial), usable offline for silver under ADR-0014, with a clean permissive corpus.
