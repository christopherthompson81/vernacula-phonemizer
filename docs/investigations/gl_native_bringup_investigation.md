# Galician (galego, gl) bring-up — Romance (Ibero-Romance), ~2.4M

Galician, the co-official language of Galicia (NW Spain), sister of Portuguese, Ibero-Romance. Latin script, shallow
near-phonemic orthography. Referee: **wikipron `glg_latn_broad`** (human, CUNY-CL/wikipron, 10,237 words) — LARGE.

## Run 1 — 2026-07-25 — Spanish-shaped rule engine + Galician deltas

**Structure reused from Spanish** (`src/languages/spanish/`): a shallow left-to-right g2p scan (consonant digraphs +
context-sensitive single consonants), a vowel-run nucleus/glide classifier, spirantization (b/d/ɡ → β/ð/ɣ), and
rule-based stress (written accent wins; else penult if the word ends vowel/n/s, else final). Galician's stress rules
and spirantization are the same Ibero-Romance system, so this transfers directly.

**Galician-specific deltas — all derived empirically from the referee (grep-confirmed, not guessed):**
- **⟨x⟩ → ʃ** — THE Galician signature. `peixe`→pejʃe, `xente`→ʃente, `caixa`→kajʃa, `baixo`→bajʃo. Spanish's ks/s
  mapping is replaced wholesale. (Anxeriz→a n ʃ e ɾ i θ, Bruxas→b ɾ u ʃ a s.)
- **⟨g⟩ before e/i → ɡ (NOT x)** — Galician has no Castilian jota. `xigante`→ʃiɡante (referee ɡ / gheada-ħ). ⟨g⟩ is
  always the velar stop (spirantized ɣ intervocalically), regardless of the following vowel.
- **⟨nh⟩ → ŋ** — the velar-nasal digraph. `unha`→uŋa, `algunha`→alɡuŋa, `cunha`→kuŋa.
- **Nasal velarization**: coda/word-final ⟨n⟩ → ŋ (`Alén`→alɛŋ, `Benxamín`→benʃamiŋ, `cen`→sɛŋ) and ⟨n⟩ before a
  velar → ŋ (`cinco`→siŋko). Pervasive: 1078/10237 referee prons end in ŋ.
- **⟨j⟩ → ʃ** — same fate as ⟨x⟩ (loan/older spelling; native Galician writes ⟨x⟩).
- **7-vowel system** /a e ɛ i o ɔ u/ — the open-mids ɛ/ɔ are LEXICAL and unmarked in the orthography (Grixó→ɡɾiʃɔ,
  xénero→ʃɛneɾo, but xente→ʃente): unrecoverable from spelling → we emit the close-mid e/o default and FOLD ɛ→e,
  ɔ→o against the referee (same treatment Lithuanian/Catalan give stress/lexically-conditioned vowel quality). A
  mid-vowel lexicon (à la Catalan `mid-vowels.tsv`) is the honest future fix; deferred.

**Folds (referee-eval `gl.jsonc`):** ɛ→e, ɔ→o (unmarked open-mids); β→b, ð→d, ɣ→ɡ (spirantization allophony, referee
inconsistent in broad); ħ→ɡ (gheada — the dialectal ⟨g⟩→[ħ], we emit standard ɡ); s↔θ NOT folded (we emit the
standard RAG distinción θ for ⟨z⟩/⟨c+e,i⟩; seseo variants in the referee are a dialect we don't target); ᶦ→j, ᶷ→w
(our non-syllabic offglides vs the referee's plain glides: cousa→kowsa, peixe→pejʃe); r→ɾ (trill/tap, referee
inconsistent). The BACKBONE already strips the raising diacritic ̝ on final unstressed e̝/o̝/a̝ (weak reduction).

## Run 1 results — 2026-07-25

`npx tsx tools/referee-eval/eval.ts gl`:
- **Raw** 0% (expected — we emit close-mid e/o + stress marks + offglide notation the broad referee doesn't).
- **First pass (raw dump, one pron per line): 78.8% folded / 96.4% symbol.** The residual was dominated by the
  seseo θ/s and gheada ħ/ɡ and yeísmo ʎ/ɟ DIALECT variants, which the raw wikipron dump lists as SEPARATE lines
  per headword (10,237 lines / 8,091 unique headwords) — so a standard-RAG output loses on every seseo `s`-line even
  though the `θ`-line for the same word is also present.
- **Merged variants → 89.9% folded / 98.2% symbol.** The eval credits a word if ANY tab-separated variant matches
  (its documented multi-pron support, the same mechanism kaikki variant-referees use); merging duplicate headwords
  into tab-separated rows (1,957 words gained a 2nd variant) stops the dialect variation we don't target from
  double-counting as failing words. **HONEST CAVEAT (corrected in review — the first draft overclaimed here):** this
  is NOT the same treatment as the sibling `es`/`ca` referees. Those are ONE canonical pron per word (the model must
  hit that single answer); the merge instead accepts a MENU of attested variants and passes on any. Because both
  poles of each dialect axis (seseo s / distinción θ, gheada ħ / plain ɡ, yeísmo ɟ / ʎ) are present as alternates,
  **the merge EFFECTIVELY FOLDS those axes** — our standard-RAG choice is an attested pole so it always matches, but
  the referee therefore cannot *validate* the choice. So 89.9%→(later 91.8%) is "matches ≥1 attested Galician
  pronunciation", a MORE LENIENT metric than es 92.5% and not directly comparable. What the merge does NOT fold —
  the consonant skeleton (x/j→ʃ, nh→ŋ, nasal velarization, ch/ll/ñ), the vowels, the glides, segment count — is the
  genuine signal, cross-checked by the 98%+ symbol accuracy.
- **+ unstressed-⟨a⟩ [ɐ]→a fold → 90.9% folded / 98.4% symbol** (final answer). The [ɐ] is weak unstressed-/a/
  reduction, allophonic + referee-inconsistent (118/8,091 lines), the same class as the raising ̝ the BACKBONE
  already strips.

**Residual (honest tail, `symbol accuracy` 98.4% confirms it is pervasive single-symbol variation, not structure):**
- **Hiatus vs diphthong** — ⟨i⟩/⟨u⟩ + vowel after a consonant: the referee often keeps a full-vowel hiatus where
  our Spanish-inherited glide classifier glides (Brión→bɾjoŋ vs referee bɾioŋ, Bieito→bjeᶦto vs biejto). This is
  stress/lexeme-conditioned (the preterite -íu is stressed on i) — not spelling-predictable; a special rule would
  regress as much as it fixes. Left as tail.
- **⟨ll⟩ yeísmo [ɟ]** — the referee has both ʎ (300 lines, standard/plurality) and ɟ (158, yeísmo). We emit the
  standard ʎ; ɟ-only words (Carballo) miss. Correct standard choice.
- **Compound-teen numeral stress** — "dezaseis" (16) gets the regular penult stress where [deθaˈsejs] is idiomatic
  final-stress. One numeral word, no numeric referee → documented, not special-cased.

**Status: 🔷 (single-source, LARGE referee).** wikipron glg_latn_broad (8,091 headwords) is the only committed
referee; no kaikki glg dump / epitran glg exists. The grapheme inventory + the x/j→ʃ + nasal-velarization rules are
standard RAG/Wikipedia Galician phonology, attested across thousands of aligned tokens. **Deferred:** the ɛ/ɔ
mid-vowel lexicon (the honest fix for the folded open-mid axis, à la Catalan `mid-vowels.tsv`); a second referee.

## Run 2 — 2026-07-25 — review (8 angles) → 3 real bugs fixed, framing corrected → 91.8% / 98.6%

The multi-angle code review found **three genuine correctness bugs** (all referee-confirmed) plus the framing
overclaim above. Fixes:
1. **-ns plural cluster not velarized (HIGH).** `velarizeNasal` only fired word-finally or before a velar, so the
   ubiquitous -óns/-áns plural (cans→kaŋs, millóns→miʎoŋs, cancións→kanθjoŋs — 1078 referee prons end in ŋ) stayed
   [ns]. Fixed: velarize ⟨n⟩ before a word-final ⟨s⟩ (+ final ⟨m⟩→ŋ, the same neutralization on rare -m latinisms).
   My own test gold `3000000→…miʎˈons` had locked the bug — corrected to `miʎˈoŋs`.
2. **Accented-weak-vowel hiatus (HIGH).** `muíño`→mwiɲo (u wrongly a glide) vs referee `muiɲo` (hiatus mu.í.ño); same
   for ruído, viúva, xuíz. Fixed in `classifyRun`: an unaccented weak vowel BEFORE an accented weak (í/ú) is its own
   nucleus. A FOLLOWING weak vowel (saíu→sa.í.u) stays a falling-diphthong offglide — only the left neighbour is
   promoted. **Bug in the fix, caught immediately:** `WEAK_ACC.includes("")` is `true`, so the first draft promoted
   EVERY word-final weak vowel (peixe→peˈiʃe, score crashed 90.9→81.2%) — guarded the word-end "" and it recovered.
3. **⟨x⟩ before a consonant → [ks] (MEDIUM).** texto→teʃto vs referee `teksto`. Native ⟨x⟩=ʃ is always prevocalic, so
   before a consonant ⟨x⟩ is the Latinate [ks] (texto, sexto, extra). The prevocalic [ks] cultismos (exacto, óxido —
   ⟨x⟩ before a vowel) stay lexical/unpredictable → left ʃ, a documented gap.

Also from review: **final falling-diphthong stress** (cantou is oxytone [kanˈtow], not penult — the offglide is not a
syllabic vowel: `stressedNucleus` now tests the last SEGMENT's nucleus flag, stress-folded in the eval so no score
change but correct output); the **number range** extended past the 10⁹ cliff (2 000 000 000→"dous mil millóns", +a
billón=10¹² long-scale tier — was degrading to spelled-out digits); pruned the dead ⟨ï⟩ (0 referee occurrences,
non-standard RAG). Net: **91.8% folded / 98.6% symbol** (bugs 1–3 were referee-positive, +0.9pp over Run 1's 90.9%).

**Framing corrected (the review's most important find):** the Run-1 doc claimed the variant merge "matches how es/ca
are one-canonical-pron" and that θ is "compared directly / real signal" — both FALSE and self-contradictory (see the
corrected caveat in Run 1 above and the header of `tools/referee-eval/langs/gl.jsonc`). The merge effectively FOLDS
the seseo/gheada/yeísmo dialect axes; 91.8% is "matches ≥1 attested pronunciation", more lenient than es's
single-canonical 92.5% and not directly comparable. This is the same "framing overclaim" class flagged in the Czech
convergence — the number is fine, the description was not. Not fixed (documented, deferred): cross-word
spirantization (a boca→a βoka needs phrase context — a limitation shared with the es/ca engines); the ɛ/ɔ mid-vowel
lexicon; the prevocalic-⟨x⟩ cultismos; the compound-teen numeral stress.
