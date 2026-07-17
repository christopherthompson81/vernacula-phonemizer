# Polish (pl) bring-up investigation

West Slavic, Latin script with diacritics. NOT a shallow mapping — real rule systems (palatalization, nasal
vowels, voicing assimilation). Modelled on the Czech engine (scan → rules → voicing). Two strong referees:
wikipron pol_latn broad (HUMAN, 129,736) PRIMARY + epitran pol-Latn on the same wordlist SECONDARY.

## Run 1 — 2026-07-17 — rule g2p vs two referees

Engine (g2p.ts): scan (digraphs ch/cz/sz/rz/dz/dź/dż + the ⟨i⟩ palatalizer) → nasal-vowel realization → voicing.

The **⟨i⟩ palatalizer** has three classes: coronal soft {c,s,z,n}(+dzi) + i → the SOFT series t͡ɕ/ɕ/ʑ/ɲ/d͡ʑ (i
silent before a vowel — siano→ɕanɔ; the [i] vowel before a cons/end — zima→ʑima); everything else + i + VOWEL → a
[j] glide (pies→pjɛs, kiedy→kjɛdɨ). Velars are NOT specially palatalized — the wikipron convention writes [kj]/[ɡi],
not epitran's [kʲ]/[ɡʲ] (removed that branch after the referee showed 89→ it).

**Nasal vowels ą/ę** → oral vowel + a homorganic nasal element by the FOLLOWING consonant's place: m (labial), n
(dental/alveolar/retroflex, incl. fricatives — wąs→vɔns, mąż→mɔnʂ), ŋ (velar, incl. x — wąchać→vɔŋx), ɲ (palatal
affricate), a [w̃] nasal glide before a palatal fricative (gęś→ɡɛw̃ɕ), pure vowel-nasalization before a sonorant;
**ą word-final → [ɔw̃]**, **ę word-final → [ɛ]** (denasalized).

**Voicing**: regressive assimilation + word-final devoicing; v (from w) and ⟨rz⟩ [ʐ] are TARGETS but do NOT trigger
(they devoice progressively after a voiceless obstruent — świat→ɕfjat, przez→pʂɛs) — the Czech ř/v pattern. ⟨rz⟩
carries a flag distinguishing it from ⟨ż⟩, which DOES trigger regressive voicing (także→taɡʐɛ).

**Progression: 56.3% → 89.4%** (velar-glide fix + ⟨y⟩ ɘ~ɨ fold) → **98.2% wikipron** (ą-final ɔw̃, homorganic nasal
before fricatives, n→ŋ before velars, au→aw, ŋ~n fold). epitran stays 84.5% — its ą-final [ɔ̃] and simpler
nasal-fricative convention diverge from wikipron's standard; wikipron (human) is the authority. Residual ≈ 1.8% is
loanword/proper-noun noise (dubbing, bravissimo, altocumulus, degeminated banner). **✅.** Numbers deferred.
