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

## Run 3 — 2026-07-16 — restoration path: matching-convention referee CORRECTS Run 2

Run 2 concluded "restoration ~0 lift, not independently verifiable." That was too pessimistic — the confound was
real and it's fixable. Found the matching-convention independent gold already in-repo: **`silver.hindiurdu.tsv`**
(8,593 Urdu spellings + gold IPA derived from voweled Hindi Devanagari via our own hi g2p, harmonized to our
convention, and explicitly kept OUT of the neural training manifest). Same IPA convention as our output → no
schwa-convention mismatch, and independent of the neural.

**Neural vs this gold (n=700, majhūl folded as Urdu-script-unrecoverable, short vowels COUNT):**
- exact: baseline 45.7% → **neural 47.9% (+2.1pp)**
- mean edit distance: 0.996 → **0.889 (−0.11)**
- neural changed 125/700, **68 closer vs 25 farther**

So the neural DOES modestly generalize — the ~0 lift vs wikipron in Run 2 was substantially the train/referee
convention mismatch, not neural failure. But the lift is MODEST (far from Arabic's ~98% DER): Urdu short-vowel
restoration via this shared multilingual BiLSTM is real but weak, and the reliable restoration is still
lexicon-dominant (the neural adds a small OOV boost).

**Existing infra:** `tools/perso-arabic/eval_combined.ts` (coverage + neural-only + combined, type-level on
wikipron; lexicon-hit is circular by construction) and `eval_endtoend.ts` (held-out generalization on
`eval_set.tsv`) already do this — but via the Python `predict_harakat.py` pipeline + the `.pt` model (not in this
checkout), which is why the doc's "+18.6 held-out" couldn't be reproduced here with the shipped ONNX neural.

### Does RUNNING TEXT help (as it did for Arabic)? — No, and for two verified reasons

Arabic's big win was the PROSE test: its diacritizer is a SENTENCE-level context model, so isolated citation
lemmas are OOD and running text is where it shines. Tested whether the same applies to Urdu:

1. **Architecture — the rider model is WORD-LEVEL.** `riderDiacritizer.diacritize()` matches each word run and
   calls the BiLSTM on THAT word's characters + a language token only — no cross-word input (riderDiacritizer.ts:99-109).
   Verified empirically: phonemizeRiderNeural on a 4-word sentence produces BYTE-IDENTICAL per-word output to the
   isolated words (4/4). So running text cannot help it — the isolated-word measurements above ARE the right metric.
2. **Linguistics — Urdu short-vowel ambiguity is LEXICAL, not syntactic.** کتاب is [kɪt̪ɑːb] in any sentence; the
   vowels are a property of the WORD. Arabic's context-dependence is the iʕrab CASE system (endings that genuinely
   need the sentence). Urdu has only a thin slice of contextual ambiguity (izafat -e-, a few homographs), so even a
   sentence-level rewrite would gain far less than Arabic — most of the signal is already inside the word.

So the "running text" lever that unlocked Arabic does not exist for Urdu: the model can't use context, and the
ambiguity mostly isn't contextual anyway.

### Status → 🟡 (refined, corrects #248)

Restoration IS independently verifiable (against the Hindi-Devanagari gold / eval_endtoend) — #248's "unverifiable"
was wrong. The neural modestly generalizes (+2.1pp), so it is NOT 🟢-capped (a real path exists and is partly
realized). It is NOT ✅ either (modest lift, lexicon-dominant, ~48% on the independent gold — short-vowel
restoration is genuinely hard here). The remaining levers are HEAVYWEIGHT and word-level (running text won't help):
(a) a better/retrained WORD-level diacritizer (Python ML; fa/ps show it's hard), (b) expanded lexicon coverage
(needs the uncommitted kaikki/Hindi dumps). A real path, but an unwalked, effortful one. 🟡.

## Run 4 — 2026-07-16 — the AUTHORITATIVE held-out eval (the training harness)

Found and ran the training/eval harness (/mnt/data/ar-diac, ar-diac-venv). The project's OWN held-out metric is
`predict_harakat.py` (the fp32 bilstm_multilingual.pt) → `eval_endtoend.ts` (predicted harakat → g2p vs wikipron,
model vs bare-skeleton baseline, on the held-out `eval_set.tsv`). Ran it:

```
lang    n    baseline  model    lift
ur     592    78.2%    75.3%    -2.9
fa     872    73.4%    68.8%    -4.6
pa     123    48.8%    42.3%    -6.5
ps     112    63.4%    57.1%    -6.3
```

**The neural is NET-NEGATIVE on held-out for EVERY rider language.** This DIRECTLY contradicts the bring-up doc's
"+18.6 held-out" claim (which must have been an older model or the "invertible IPA" subset metric — not
reproducible with the shipped bilstm_multilingual.pt on the standard end-to-end eval).

**Reconciliation with Run 3's +2.1:** eval_endtoend folds through the ur CONFIG fold, which folds short-vowel
QUALITY (ɪ/ʊ→ə). So it credits the model ONLY for schwa POSITION, not quality — and the model's net position effect
is NEGATIVE (it moves schwas to wrong places more than right). Run 3's Hindi-gold KEPT short-vowel quality → +2.1
(the model does get some qualities right). So the model's true effect is **fold-dependent and marginal**: a small
quality gain, outweighed by position errors under the backbone view. Not a reliable win either way.

### Definitive resolution of the restoration path

1. **Running text won't help** — the rider model is WORD-LEVEL by training (per-word char sequences + a language
   token; train_multilingual_harakat.py) and by inference (riderDiacritizer splits per word; sentence vs isolated =
   byte-identical, 4/4). Arabic's prose win came from a SENTENCE-level model (bilstm_sent.pt / ar_diac.onnx); the
   riders are a different, word-level model. And Urdu's ambiguity is mostly LEXICAL (کتاب is always kitāb), not the
   syntactic iʕrab case system that makes Arabic context-dependent.
2. **The neural doesn't generalize** — net-NEGATIVE held-out (−2.9 ur), marginal-positive only if you credit
   short-vowel quality. The reliable restoration is the LEXICON (exact for covered words); the neural is a liability
   on OOV (correctly, the DEFAULT shipped phonemizeWord is lexicon-only — the neural is opt-in via phonemizeRiderNeural).
3. **Path forward** (all heavyweight, none a running-text quick win): a SENTENCE-level model would gain little
   (lexical ambiguity); a better WORD-level model is the fa/ps ML grind; expanded lexicon coverage (data mining)
   is the surest but needs the uncommitted dumps.

STATUS 🟡 confirmed, now fully evidenced. The restoration is lexicon-bound; the neural adds no reliable value; and
the Arabic "running text" lever does not transfer (wrong model class + wrong ambiguity type).
