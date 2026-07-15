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
