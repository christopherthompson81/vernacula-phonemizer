# Persian / Farsi (fa) native bring-up — investigation log

Persian is a Perso-Arabic ABJAD (like Urdu): LONG vowels are written (ا/آ→aː, و→uː, ی→iː) but SHORT vowels
(a/e/o) are usually OMITTED and must be restored — the deferred subsystem (🟠). Persian phonology (NOT Hindi):
no retroflexes, no aspirates. Referee: wikipron fas_arab broad (human, 10312, fully-voweled) + an 18-word gold.

## Run 1 — 2026-07-15 — abjad G2P (Urdu-modeled) → 🟠 (folded 42.9%, gold 88.9%)

Built the module modeled on Urdu's abjad g2p, with Persian phonemes: consonants (ق→q, no retroflex/aspirate, the
4 Persian letters پ چ ژ گ), long vowels aː/uː/iː, word-initial glottal stop ʔ (آب→ʔaːb — Persian adds it, Urdu
doesn't), the خوا→[xʷaː] labialization (خواب→xʷaːb; خوب→xuːb where و is the vowel), word-final ه→[e]
(خانه→xaːne), shadda gemination, Persian-final stress, default short vowel [a] + Ohala medial deletion.

FINAL CLUSTERS: unlike Urdu (which RETAINS the word-final schwa), Persian ALLOWS final consonant clusters
(مرد→mard, دوست→duːst) — so a default [a] before a final coda run is deleted (guarded to NOT eat the [a] of a
long [aː], a bug caught early: کتاب→katːb → fixed to kataːb).

FOLDS (all unrecoverable from the undiacritized script): short-vowel QUALITY a~e~o (fold) + the classical short
i/u the referee writes vs our default a (preFold i/u→a, guarded by ¬ː so long iː/uː survive) + the long-vowel
ambiguity و=[uː]~[oː] and ی=[iː]~[eː] (preFold oː→uː, eː→iː). Ladder: 19.7% (skeleton) → 26.2% (final-cluster fix)
→ 37.6% (short i/u fold) → **42.9%** (long-vowel fold) — exactly Urdu's abjad ceiling.

RESULT: wikipron folded 42.9% (measures the derivable consonant + long-vowel backbone), adjudicated common-word
gold 88.9% (folded). Status 🟠 — the skeleton is right; short-vowel PLACEMENT + quality, unwritten Arabic-loanword
gemination (اتحاد→ittihaːd), and the ع realization are the deferred restoration subsystem. Suite 37/37; typecheck clean.

NEXT (deferred): short-vowel restoration — a diacritized-Persian lexicon or a neural diacritizer would lift fa the
way the ONNX diacritizer lifted ar; the ezâfe linker (-e) is a separate syntactic layer.

## Run (2026-07-16) — REVIEW: restoration under-diacritized; root cause = folded silver; FULL-diacritization fix

Reviewed the shipped restoration. Findings (all measured):
- The neural diacritizer LOADS and runs, but changes only **10.7%** of words and its changes are often wrong
  (دنیا→danejaː). The coverage lexicon was PARTIAL (کتاب not in it → kataːb; many entries only a sukun). Net: the
  Iranian gold UNFOLDED was **13/18**, and کتاب/دنیا/ستاره all fell to the default [a]. The maturity doc's
  "+29 held-out / wins any covered word" OVERSTATED the shipped reality.

ROOT CAUSE — the silver labels were mined SHORT-VOWEL-BLIND. `invert_harakat.ts` searched the vocalization whose
g2p matches the reference **under the referee-eval fold**, and Persian's fold COLLAPSES short-vowel quality
(a~e~o~i~u→a). So for کتاب, bare→kataːb and the target kitaːb are fold-equal → the miner picks BARE → کتاب is
literally labeled bare. 69% of fa training words carried no vowel mark; the model faithfully learned to
under-vocalize. **This is a DATA-pipeline bug, not a model-architecture problem** — a Persian-specific BiLSTM on
the same labels would reproduce it (and the shared model under-vocalizes Urdu *more* than Persian: 3 marks/10 vs
7/10, so multilingual dilution is not the cause).

FIX — mine with FULL DIACRITIZATION. A new `FA_FULL_FOLD` keeps a/e/o DISTINCT and DIALECT-NORMALIZES the
classical/Dari wikipron references to Iranian: the standard historical short shift **classical i→e, u→o** (which
the g2p reproduces via kasra→e / damma→o) + the long merge eː→iː/oː→uː + a word-final ه [a]→[e] normalization
(خانه xaːna→xaːne). Mined TWO-PASS (full fold first; loose fold as fallback) so no coverage is lost.

RESULT: fa silver diacritization **31%→48% voweled** (3073 kasra + 1134 damma marks now ENCODE the short vowels).
The regenerated COVERAGE LEXICON (ships immediately, no retrain) grew 3040→4128 rows and fixes the common tail:
کتاب→ketaːb, دنیا→donjaː, ستاره→setaːɾe — Iranian gold UNFOLDED **13/18 → 16/18**, with the folded skeleton eval
preserved (72.0%→71.3%). Suite 371/371. The 2 residual gold misses are a gold convention (آسمان ʔ-initial) and a
multi-variant edge (گل [gil]/[gul]→gel vs Iranian gol).

RETRAIN (the user's GPU step): the new `harakat.fa.silver.tsv` is the training data — retrain the BiLSTM
(`train_multilingual_harakat.py`) + re-export the ONNX so the NEURAL tier (uncovered words) also stops
under-vocalizing. ur/ps/pa need their own dialect maps (analogous FULL_FOLD) — a follow-up.

## Run (2026-07-16) — can the retrained neural be BAKED into the sync lexicon? NO (net-negative, don't retry)

Goal: get the retrained neural's benefit into the SYNC `phonemizeWord` path (which can't run async ONNX) by
pre-computing its vocalizations offline over a Persian frequency vocab (behnam/persian-words-frequency, 406k,
CC-BY-SA) and adding the confident ones to the coverage lexicon.

MEASURED (held-out eval_set, 1082 words with a reference, dialect-normalized whole-word match):
- **DEFAULT (bare→[a]): 37.6%** vs **NEURAL vocalization: 40.2%** — the neural is only **+2.6pp** better than just
  guessing [a].
- Of words the neural VOCALIZES (adds a short vowel), only **~22–25% are correct**, and **confidence does NOT
  separate right from wrong** (0.99+ conf gives 25%, same as 0%). It makes CONFIDENT errors, especially
  OVER-vocalizing the many Arabic-loan/'a'-vowel words the default already nails (احمر→ahmeɾ [should ahmar],
  ابتدا→abtadaː [should ebtedaː], ابرش→abreʃ). Some "errors" are actually the neural being right in Iranian vs a
  classical reference (آبرو→âberu, آسمانی→âsemâni), but enough are real that the NET is barely above default.

CONCLUSION: **do NOT bake the neural into the authoritative sync lexicon.** For a +2.6pp net it would FREEZE wrong
pronunciations for common words (احمر→ahmeɾ) that the default gets right, and confidence can't filter them. The
neural stays the async generalization tier (`phonemizeRiderNeural`), where it's a slight, opt-in improvement over
default — not a reliable production restorer. The OOV short-vowel tail is bounded by IRANIAN reference data (same
wall as Bengali/Amharic): the corroborated coverage lexicon is reliable but limited to the reference vocab, and
the neural is not accurate enough to extend it unsupervised. Persian stays a strong 🟡.
