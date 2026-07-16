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

## Run 2 — 2026-07-16 — cross-source consensus ⟨e⟩ lexicon (closes the loanword tail for known words)

The Run-1 lexical tail was loanword ⟨e⟩ (native ə-default wrong where the word is taling /e/~/ɛ/). Followed the
Gujarati/Javanese pattern: pin the taling quality ONLY where two independent human referees agree.

**Reliability first (the Javanese lesson).** Single-source wikipron ⟨e⟩ is NOISY: of the 312 ⟨e⟩ words with ≥2
wikipron prons, only 29% agree on the ⟨e⟩ sequence — contributors default pepet vs mark taling inconsistently.
So a single-referee ⟨e⟩ mine would be unreliable. But that 29% is a biased sample (only contested words carry
variants). Pulled a SECOND independent source — **kaikki ind** (20,098 Latin words with IPA) — and measured
cross-source agreement: of 8,261 ⟨e⟩ words present in both, **98% agree** on the ⟨e⟩ pepet/taling signature.
The taling is well-agreed ACROSS sources; only the within-source variant words are noisy. Cross-source consensus
is the clean, non-circular signal (exactly the Gujarati wikipron∩kaikki move).

**The lexicon** (`indonesian-e-lexicon.tsv`, 2,742 entries): for each ⟨e⟩ word where both sources share a single
⟨e⟩ signature that DIFFERS from our all-pepet default, pin it. Construction is alignment-exact — in Indonesian ə
comes ONLY from ⟨e⟩, so our output's ə-slots map 1:1 to the ⟨e⟩ positions (alignment mismatch: 0/8261). Each
ə-slot is replaced by the consensus vowel; e vs ɛ is preserved where the sources also agree exactly, else the
taling mid /e/. Non-⟨e⟩ segments + stress remain OUR rule output. 236 words abstained (sources disagree —
homographs/variants); 5,283 skipped as all-pepet (our default already right).

**Wiring** (Javanese pattern): `phonemizeWordRules` = the honest rule engine (pepet default); shipped
`phonemizeWord` = lexicon override → rules. The eval imports `phonemizeWordRules` (non-circular) and folds ⟨e⟩
anyway, so the folded backbone is UNCHANGED at 94.9% — this is a pure SHIPPED-quality gain (absen→ˈabsen,
ablepsia→ablɛpsˈia, abonemen→abonəmˈɛn), invisible to the folded metric by construction. Numbers bypass the
lexicon (their ⟨e⟩ is pepet). Suite 33/33; typecheck clean.

STATUS stays **🟡** (not ✅). The tail is CLOSED for the ~2,742 consensus-attested taling words, but the ⟨e⟩
pepet/taling choice remains genuinely lexical for OOV loanwords (still ə-default) and there is a homograph
ceiling (a word with both a pepet and a taling sense — abstained, not pinned). Same shape as Javanese: a
whole-word lexicon resolves known words but can't derive OOV taling or disambiguate homograph senses without
POS/context. The derivable core + common-word output remain excellent (gold 100%).
