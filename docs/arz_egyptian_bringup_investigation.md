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
