# Indonesian (id) native bring-up — investigation log

Bahasa Indonesia — a shallow, near-phonemic Latin orthography → rule-based transliterator
(indonesian.jsonc + indonesian.ts). Referees: wikipron ind_latn broad (human, 18590 words) +
a 25-word adjudicated common-word gold.

## Run 1 — 2026-07-15 — first-pass rule-based G2P → 🟡 (folded 94.9%, gold 100%)

Built the module: digraphs (ng→ŋ, ny→ɲ, sy→ʃ, kh→x, gh→ɣ) then single letters (c→t͡ʃ, j→d͡ʒ, y→j, …),
⟨e⟩→schwa [ə] by DEFAULT (the pepet), falling diphthongs ai/au/oi (word-final), syllable-final ⟨k⟩→glottal
stop [ʔ] (tidak→tidaʔ), penultimate stress that shifts off a schwa nucleus, regular compositional numbers
(belas/puluh/ratus/ribu/juta + se- prefix), and all-caps acronym letter-spelling (BBM→bebeem).

TWO axes turned out to be genuinely unrecoverable and were folded (empirically, on the referee):
- **Closed-syllable lax allophony** (i→ɪ, u→ʊ, o→ɔ): I first implemented it, but the referee marks it
  ERRATICALLY (bordil→bordɪl yet bandit→bandit, alun→alun, kecil→kətʃil TENSE). It net-HURT (the common-word
  gold dropped: air→aɪr, cinta→t͡ʃɪnta all wrong). REMOVED the laxing — emit clean tense vowels (canonical
  consistency), and fold the tense/lax axis in the eval. Gold 85%→100%; folded backbone unchanged 94.9%.
- **The ⟨e⟩ = /ə/ vs /e/~/ɛ/ orthographic ambiguity**: ⟨e⟩ writes both the pepet /ə/ (native) and /e/~/ɛ/
  (loanwords) with NO orthographic distinction — the choice is lexical/etymological, unrecoverable from
  spelling (like Urdu's short vowels). Folding it took the non-acronym backbone 79.8%→96.9%.

Fold-impact ladder (non-acronym distinct words): baseline (lax, no vowel fold) 51.7% → fold lax allophony
79.8% → + fold ⟨e⟩ ə~e~ɛ 96.9%. Acronyms are only 3% of the corpus (letter-spelling handles them).

RESULT: wikipron folded backbone **94.9%**, adjudicated common-word gold **100%**. Status **🟡** — the derivable
core is excellent and the common-word OUTPUT is exact; the one real output-error class is loanword ⟨e⟩ (abses→
absɛs, agresi→aɡrɛsi) where our native ə-default is wrong. A pronunciation lexicon (kaikki ind) would close it,
exactly as Lexique does for French — the documented lexical tail. Suite 32/32; typecheck clean.
