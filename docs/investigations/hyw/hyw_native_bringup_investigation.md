# Western Armenian (hyw) native bring-up investigation

Target: **Western Armenian** (արեւմտահայերէն), the Istanbul/diaspora standard of Armenian —
Indo-European (its own branch), Armenian alphabet. A SIBLING of the fleet's Eastern Armenian
(hy). Canonical IPA, espeak-independent. The distinguishing feature is the **Western consonant
shift**, so the bring-up is mostly a consonant-table swap on the existing Armenian engine.

## Run 1 — referee landscape (2026-07-27)

- **wikipron `hye_armn_w_broad`**: 17,211 pairs, HUMAN, space-segmented phonemes. **Aspiration
  NOT transcribed** (broad). → PRIMARY.
- **wikipron `hye_armn_w_narrow`**: 17,584 pairs, HUMAN. **Marks aspiration** (pʰ tʰ kʰ) **+ stress**
  (acute). → SECONDARY (corroborates the shift's aspiration).
- **epitran**: no hye map.
- kaikki: no "Western Armenian" extract.

🔷 single-source-FAMILY (broad + narrow both wikipron/Wiktionary, correlated) — but a LARGE (17k),
HUMAN referee, and the two transcription depths corroborate each other on the shift.

## Run 2 — the phonology, and the shared-engine refactor

★★ **THE WESTERN CONSONANT SHIFT** (confirmed on real words in both depths). The classical
three-way stop/affricate system collapses to a TWO-way (voiced vs voiceless-aspirated) one:
- classical VOICED ⟨բ դ գ ձ ջ⟩ → **[pʰ tʰ kʰ t͡sʰ t͡ʃʰ]** (devoiced): բարի→pʰɑɾí, դուռ→tʰuɾ, գործ→kʰoɾd͡z
- classical ASPIRATE ⟨փ թ ք ց չ⟩ → **[pʰ tʰ kʰ t͡sʰ t͡ʃʰ]** (unchanged) — MERGES with the above:
  փակ→pʰɑɡ, թութ→tʰutʰ, քար→kʰɑɾ
- classical VOICELESS ⟨պ տ կ ծ ճ⟩ → **[b d ɡ d͡z d͡ʒ]** (voiced): պատ→bɑd, տուն→dun, կով→ɡov, ծառ→d͡zɑɾ
★ **RHOTIC NEUTRALISATION**: Eastern's tap ⟨ր⟩→[ɾ] vs trill ⟨ռ⟩→[r] both become a single tap [ɾ]
(only 1 trill in all 17k). ★ **FRONT-ROUNDED digraphs**: ⟨յու⟩/⟨իւ⟩→[ʏ] (1294×, loan-heavy —
Turkish/French names + the classical ⟨իւ⟩ spelling), ⟨յո⟩→[œ] (rare).

**Architecture (altitude):** the Eastern engine (armenian.ts) was already a manifest-driven
grapheme scan; everything except the consonant table + digraphs is identical for Western. So
instead of copy-pasting, refactored armenian.ts to export **`makeArmenianEngine(def)`** — Eastern
loads armenian.jsonc, Western (westarmenian.ts) loads westarmenian.jsonc. One copy of the scan +
epenthesis + numbers logic; two dialect manifests. Eastern output is byte-identical after the
refactor (goldens 5/5).

## Run 3 — tuning (all shared, so hy benefited too)

First pass **85.8% folded / 97.8% symbol**. Two shared fixes:
1. **No-vowel citation schwa** — a lone consonant letter cited by name takes [ə]: ⟨Բ⟩→[pʰə]
   (Western) / [bə] (Eastern). The referee (both dialects) spells letter-names this way; the engine
   emitted a bare consonant. +0.3pp hyw, and it FIXED the same class in Eastern (81.1→81.4%).
2. **C+glide onset** — ⟨Cյ⟩ is a licit onset (գյափիկ→kʰjɑpʰiɡ), so no epenthetic schwa before /j/.
   +0.1pp hyw, +1.1pp Eastern (81.4→82.5%).
→ **86.2% folded / 97.8% symbol** (broad primary). Eastern rose to **82.5%** — a bonus from the
shared refactor, no regression.

★ **A trap I checked and did NOT fall into:** the NARROW referee keeps the s-clusters VOICELESS
(Ասպետ→ɑsped, Աշտարակ→ɑʃtɑɾɑɡ), which looked like a missing "s blocks the voicing shift" rule. But
the BROAD PRIMARY VOICES them (Ասպետ→ɑsbed, Աշտարակ→ɑʃdɑɾɑɡ) — matching my current output. Adding
the block would have BROKEN the primary. The two depths genuinely disagree here; I follow broad.

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — CLEAN, no bugs.** Confirmed the `makeArmenianEngine` refactor is
behavior-preserving for Eastern (goldens 5/5); the digraph loop, the manifest-derived ONSET_STOP,
the no-vowel citation rule, and all wiring are correct. Noted (already recorded) that the C+glide
onset exception `b === "j"` intentionally changes Eastern C+glide words (գյուղ→ɡjuʁ, +1.1pp).

**Phonology reviewer — the shift is fully correct** (all three columns + affricates the right way
round + rhotic neutralisation + the aspiration fold honest), but caught ONE systematic defect: the
**⟨յու⟩/⟨յո⟩ digraphs OVER-APPLY**. The front-rounded value is licit only AFTER A CONSONANT; word-
initially and after a vowel ⟨յ⟩ is the glide /j/, so the sequences are [ju]/[jo]. Casualties were
common native words: յոթ 'seven'→œt (should be jotʰ), յուղ 'oil'→ʏʁ (should be juʁ), յոգա 'yoga',
-այություն (V+յու→ʏ instead of ju). FIX: added a `postConsonantDigraphs` mechanism (a digraph that
applies only when the previous emitted phoneme is a consonant) → ⟨յու⟩→[ʏ] is now post-consonant
only; ⟨յո⟩ dropped from the digraph table entirely (it falls out as ⟨յ⟩→j + ⟨ո⟩→o = [jo]; the rare
[œ] is Turkish-loan surnames, lexical). This fixed 'seven'/'oil'/'yoga' and rose the score
**86.2 → 86.8% folded**, C+⟨յու⟩→ʏ preserved (Հարություն→hɑɾutʰʏn). Minor items noted-not-fixed
(low count, documented): ⟨էօ⟩→[œ] in ~4 French/Turkish loans, regressive obstruent devoicing
(անզգայ…→…skɑ…), the narrow-only -իա→[jɑ] glide.

**Final: 86.8% folded / 97.8% symbol** (broad primary), Eastern 82.5% (bonus). Floor 0.83. Goldens
(12 assertions across both dialects), the 149-test referee floor, and typecheck all green.
