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
