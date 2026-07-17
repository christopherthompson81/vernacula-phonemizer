# Urdu (ur) convergence investigation

Urdu = Hindi phonology in the Perso-Arabic ABJAD. The script omits short vowels (ə/ɪ/ʊ) and does not
distinguish the majhūl long vowels (ی = [iː]~[eː], و = [uː]~[oː]) — so a large part of the pronunciation is
UNDERDETERMINED by the spelling. Short-vowel restoration ships (coverage lexicon mined from wikipron+kaikki +
neural diacritizer). Referee: wikipron urd_arab broad (HUMAN, fully-voweled).

## Run 1 — 2026-07-16 — eval circularity + honest skeleton

The eval imported `phonemizeWord` (SHIPPED — restores short vowels from a lexicon MINED FROM WIKIPRON) → circular
vs the wikipron referee. Reported 67.4% folded, but inflated: covered words echo wikipron. `phonemizeWordCore`
(g2p skeleton + default-ə + Ohala deletion + weight stress, LEXICON-FREE) is the honest non-circular signal.

Switched the eval to `phonemizeWordCore`. Honest non-circular numbers (7,709 wikipron words, folded):

- shipped phonemizeWord (CIRCULAR, lexicon echoes wikipron): 67.4%
- core skeleton, existing folds only: **44.6%** (the honest floor)
- + MAJHŪL long-vowel quality fold (و=uː~oː, ی=iː~eː — abjad writes one letter for both; +12pp, every flipped word verified genuine ی/و): 56.8%
- a ـیہ ending rule (ی+ہ → [jɑ]) was tried (+87/−6) but **REVERTED — adversarial review caught it corrupts common
  words**: the ـیہ ending is itself AMBIGUOUS — feminine -iyya (حاشیہ→[jɑ]) vs masculine Arabic -īh (فقیہ faqīh,
  تنبیہ→[iːh]), identical spelling, no orthographic signal. The "+87/−6" hid a common-word regression (faqīh→fəqjɑ)
  — the same corrupt-common-words trap as the Tagalog VV lexicon. It is under-determined → a restoration/lexicon
  matter (the skeleton keeps the default [iːɦ]; the shipped lexicon+neural resolve it per-word). Final: **56.8%**.

The number DROPPED from the circular 67.4% — that is the honesty correction (removing the wikipron-mined lexicon),
partly offset by the justified majhūl fold.

### Residual composition (consonant+long-vowel backbone, short vowels folded)

Folding short-vowel PRESENCE too (the abjad omits short vowels entirely) puts the consonant+long-vowel backbone at
**76.5%**, and the remaining residual is real backbone divergence, tested as candidate rules (fixed−broken):

- **ain ع → [ʔ] vs silent/vowel** (~340): net only **+35** (fixed 308, broke 273) — genuinely VARIABLE in the referee, not a clean rule. Left.
- **consonantal و/ی → [ʋ]/[j]** in vowel-adjacent positions (~350): position-dependent, partly ambiguous (اوتار avtār [ʋ] vs اور [oː]). Partial.
- **ـیہ → [jɑ]** (+87/−6): looked clean but the ending is AMBIGUOUS (feminine [jɑ] vs masculine [iːh], no signal) — reverted (corrupts common faqīh-type loans). Under-determined → restoration.
- initial glide (^Vː→glide): +27 but و-initial is ambiguous ([oː] اور vs [ʋ] اوتار) — deferred.

### Status question (open)

Urdu is the Arabic parallel: an abjad where short vowels + majhūl long vowels are UNDERDETERMINED by the script, and
restoration ships (coverage lexicon + neural). Arabic is ✅ on exactly this logic ("the diacritizer ships → the
bare-text pipeline IS the product; the low % is referee-limitation"). BUT Urdu differs: (a) its backbone still has
real rule-work (و/ی consonant, ain); (b) the restoration accuracy is NOT independently measured here (the coverage
lexicon is wikipron-mined → circular, and the neural's Urdu DER is unquantified). So Urdu is NOT cleanly ✅ yet, and
NOT 🟢-capped either (restoration via a neural model IS a generative path, unlike tl's final-ʔ). Kept 🟡 pending
(a) backbone و/ی+ain cleanup and (b) an independent restoration-accuracy measurement.

## Run 2 — 2026-07-16 — independent restoration-accuracy measurement (resolves the status)

To settle ✅ (Arabic precedent) vs 🟡 vs 🟢, measured the SHORT-VOWEL RESTORATION on a NON-CIRCULAR split: wikipron
words whose skeleton is NOT in the coverage lexicon (OOV → the neural does the work), scored WITHOUT folding short
vowels (so restoration must actually get them right), majhūl folded (under-determined even for a restorer).

- **Coverage lexicon:** 2,089 / 7,709 wikipron types (27%; "66% of production TOKENS" per the bring-up doc). These
  are CIRCULAR vs wikipron (the lexicon is mined from it) — reliable-by-construction, not a generalization signal.
- **OOV (n=700 sample):** default-ə baseline **48.9%** exact vs neural restoration **48.7%** — **~0 lift (−0.1pp).**
  Without the majhūl fold it was −2.4pp.

The neural IS active and doing meaningful work (4/8 spot-checked words changed; the changes are reasonable schwa
REPOSITIONING — احترام baseline əɦət̪ɾɑːm → neural əɦt̪əɾɑːm, matching the referee's ɦtəɾ; انجماد ənəd͡ʒmɑːd̪ →
ənd͡ʒəmɑːd̪). But across the OOV set it helps as often as it hurts vs wikipron-broad → no net agreement gain.

**This is confounded, and that IS the finding:** the neural was trained on a mined distribution whose short-vowel/
schwa convention differs from wikipron-broad's, so exact-match vs wikipron penalizes both the baseline and the
neural and can't credit the neural's real repositioning. The bring-up doc's "+18.6 held-out" is on the neural's OWN
distribution; this is the independent one. **Net: the restoration layer is NOT independently verifiable here** —
covered words are circular, OOV words are convention-mismatched. (Echoes the fa/ps lesson: the neural was
net-negative/neutral there too; the DATA/lexicon layer was the real win.)

### Status resolution → 🟡 (with evidence)

- **Not ✅:** Arabic's ✅ rests on a diacritizer that demonstrably generalizes (~2% DER, verified on a matching
  prose referee). Urdu's restoration shows ~0 verifiable OOV lift against the only independent referee we have, so
  the "bare-text pipeline IS the product" claim can't be substantiated the way Arabic's can.
- **Not 🟢 (capped):** short vowels ARE recoverable in principle (Arabic proves the abjad short-vowel signal is
  ~98% learnable) — so a better diacritizer / a matching-convention referee is a REAL path, not a wall. The info is
  partly in the input; we just can't verify or fully exploit it yet.
- **🟡:** the verifiable consonant+long-vowel backbone is 56.8%; the coverage lexicon is reliable on attested words;
  the restoration-generalization + an independent diacritized-Urdu referee (Arabic-style prose test in a matching
  convention) is the outstanding work. That's a genuine path → 🟡, not a ceiling.
