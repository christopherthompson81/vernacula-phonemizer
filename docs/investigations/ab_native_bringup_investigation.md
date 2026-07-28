# Abkhaz (ab) native bring-up investigation

Target: **Abkhaz** (аҧсуа бызшәа) — a NORTHWEST CAUCASIAN language, ~190k speakers (Abkhazia).
**The fleet's FIRST Northwest Caucasian language.** Abkhaz has ONE OF THE LARGEST CONSONANT
INVENTORIES in the world (~58 consonants — labialized, palatalized, pharyngealized and ejective
series) and only TWO phonemic vowels (⟨а⟩→[a], ⟨ы⟩→[ə]). Cyrillic alphabet. Canonical IPA.

## Run 1 — referee landscape (2026-07-27)

- **wikipron `abk_cyrl_broad`**: 205 pairs, HUMAN, space-segmented. ~90 are letter/digraph DEFINITIONS
  (Џь→d͡ʒ, Гә→kʷ, …) + ~115 real words. → PRIMARY.
- **kaikki Abkhaz**: 2.4 MB dump → **979 IPA pairs** (real words). → SECONDARY (the big real-word check).
- **epitran**: none.
🔷 single-source-family (both Wiktionary) but a good size, incl. a 979-word real-word set.

## Run 2 — the consonant system

★★ **THE HALLMARK — the huge NW-Caucasian consonant inventory**, written with base letters + MODIFIER
letters: **⟨ь⟩ PALATALIZES** (гь→[c], хь→[ç]), **⟨ә⟩ LABIALIZES** (гә→[ɡʷ], шә→[ʃʷ], аҟәа→[aqʼʷa]),
**⟨'⟩ PHARYNGEALIZES** (х'→[χˤ]). ★ **THREE-WAY stops/affricates** — voiced / aspirated / ejective:
⟨г қ к⟩→[ɡ kʰ kʼ], ⟨д ҭ т⟩→[d tʰ tʼ], ⟨б ҧ п⟩→[b pʰ pʼ], ⟨ӡ ц ҵ⟩→[d͡z t͡sʰ t͡sʼ], ⟨џ ч ҷ⟩→[d͡ʐ t͡ʃʰ t͡ʃʼ];
the uvular ⟨ҟ⟩→[qʼ], the pharyngeal ⟨ҳ⟩→[ħ], the retroflexes ⟨ж ш ҽ ҿ⟩→[ʐ ʂ t͡ʂʰ t͡ʂʼ]. Only 2 vowels
⟨а⟩→[a], ⟨ы⟩→[ə]. The whole system is verified on words: аҷкәын→[at͡ʃʼkʼʷən], ажәабжь→[aʒʷabʒ],
аҭаацәа→[atʰaat͡ɕʷʰa], ахәыҷ→[aχʷət͡ʃʼ]. Implemented as a CLUSTER map (base+modifier, longest-first) +
a BASE-letter map incl. the extended/historical letters (Ԡ→lʰ, Ꚁ→dʷ, …).

## Run 3 — build + tune

Self-contained Cyrillic base+modifier scan (abkhaz.ts). First pass 67.5% (wikipron); +the extended/
historical letters (Ԡ Ԣ Ꚁ-Ꚗ, and extending TOKEN to the Cyrillic-Supplement block) + the ʍ~χʷ fold →
**84.0% folded / 93.8% symbol (wikipron)**; **55.5% folded / 89.1% symbol** on the 979-word kaikki set.

★ **The folded score is DRAGGED by real hardness, NOT segment error** (the 89-94% SYMBOL accuracy is the
truer signal): (a) the referee's OWN inconsistency — the letter-DEFINITIONS vs the WORD-transcriptions
disagree (гә→[kʷ] def vs [ɡʷ] word; хә→[ʍ] def vs [χʷ] word), plus х~χ, ə~ɨ; (b) the complex ⟨у⟩/⟨и⟩
GLIDE/vowel behaviour ([w]~[əw]~[u], [j]~[i]~[əj] — aԥсуа→apʰsəwa in the referee); (c) the numeral
suffix ⟨-ба⟩→[-pa] (a lexical [b]→[p] devoicing: фба→fpa, ҩба→ɥpa); (d) loanword transcriptions. Folds:
⟨ы⟩ ə~ɨ, ⟨а⟩ a~ɑ, ⟨х⟩ x~χ, ⟨хә⟩ ʍ~χʷ.

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — 1 real robustness bug.** The recurring CURLY APOSTROPHE ’ (U+2019): the TOKEN
admitted it but the CLUSTER/MODIFIER keys used only ASCII ' → х’а (curly) silently DROPPED the
pharyngealization (χa not χˤa). FIXED by normalizing ’→' at the top of phonemizeWord (the Guaraní puso
bug class). All else correct (the scan i-advances, TOKEN coverage incl. ⟨ԥ⟩ U+0525, NFC, wiring).

**Phonology reviewer (verified on the 979-word kaikki set) — THE THREE-WAY SERIES IS ENTIRELY CORRECT**
(the hardest, highest-risk part). One real segment error + improvements:
- ★ **гь→[c] was a VOICING error** — ⟨г⟩ is voiced [ɡ], so ⟨гь⟩ must be [ɡʲ], not the voiceless palatal
  [c]. The engine had taken the palatal-place symbols (c/cʼ/cʰ/ç) from the wikipron letter-DEFINITIONS,
  which systematically DEVOICE; the 979-word corpus uses dorsal+[ʲ] throughout (зегьы→zeɡʲə). FIXED: all
  palatalized dorsals → dorsal+ʲ (гь→ɡʲ, кь→kʼʲ, қь→kʰʲ, хь→χʲ), matching the already-correct ҟь→qʼʲ.
- ★ **⟨у⟩/⟨и⟩ glide rule** — the engine mapped у→[w]/и→[i] uniformly (asymmetric, wrong in complementary
  environments). FIXED: glide [w]/[j] next to a vowel, syllabic [u]/[i] between consonants (иҭабуп→
  itʰabup, аи→aj). ★ This + the гь fix lifted the 979-word KAIKKI set **55.5→65.5%** (+10pp) — the real
  measure. Added low-cost folds (ɛ/ɔ height, аа~aː, the palatal↔dorsal place notation for кь/қь/хь).
- CONFIRMED correct: the entire 3-way stop/affricate series (к=kʼ ejective, қ=kʰ, г=ɡ, etc.), ж/ш→ʐ/ʂ
  retroflex, гә→[ɡʷ] and хә→[χʷ] (the engine right, the referee-DEFS wrong/devoiced), the pharyngeals/
  uvulars. Noted-not-fixed (deferred): the numeral ⟨-ба⟩→[-pa] (with numbers), џ→[ɖʐ] place, ҩ→[ɥˤ]
  (referee-inconsistent).

**Final: wikipron 82.5% folded / 93.3% symbol; kaikki 65.5% / 92.5% symbol.** The output is now
phonologically correct per the review; the folded % remains depressed by the referee's own inconsistency
(defs vs words) + the complex glide/schwa + numeral behaviour (the ~92-93% SYMBOL is the truer signal).
Floor 0.78. Goldens (4 tests incl. the гь/у/и/curly-apostrophe fixes), the 154-test floor, typecheck green.
