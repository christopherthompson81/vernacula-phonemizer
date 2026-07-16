# `riderDiacritizer.onnx` provenance

The neural GENERALIZATION tier for the Perso-Arabic riders (Urdu, Persian, Pashto, Punjabi-Shahmukhi) — a shared
multilingual BiLSTM that restores short-vowel harakat on a bare skeleton, under the exact-match coverage lexicon
(`src/languages/<lang>/lexicon.tsv`). Loaded by `riderDiacritizer.ts` via ONNX Runtime as an async pre-pass. See
`docs/arabic_script_restorer_investigation.md`.

## Model
Char-level BiLSTM (emb 128, hidden 512×2, 3 layers, 15.3M params), per-word: a language TOKEN is prepended to the
skeleton char sequence and the net emits one harakat label per position (19-label pausal scheme). **Warm-started**
from the Arabic diacritizer checkpoint (`bilstm_pausal.pt`; the Arabic rows of the char/label maps are preserved by
index) and fine-tuned on the mined rider labels. Trained on the GPU box:
`tools/arabic-restorer/train_multilingual_harakat.py`.

## Training data — MINED silver, permissively sourced
The riders have no diacritized corpus, so harakat labels are MINED by g2p-inversion (`invert_harakat.ts`): for each
`(skeleton, reference-IPA)` wikipron/kaikki pair, search the harakat vocalization whose deterministic g2p output
reproduces the reference IPA under the referee-eval fold. Reference IPA is from **wikipron** + **kaikki**
(Wiktionary, **CC-BY-SA 4.0**); the model is a derived work and inherits **CC-BY-SA 4.0**. The Arabic warm-start is
a permissive CATT-teacher → Arabic-Wikipedia silver model (see `src/languages/arabic/diacritizer.PROVENANCE.md`).

## Build
`tools/arabic-restorer/export_onnx.py` — loads `/mnt/data/ar-diac/bilstm_multilingual.pt`, exports fp32 ONNX,
verifies argmax parity vs PyTorch (must be exact), int8 dynamic-quantizes (≈4× smaller → 15.3 MB, on par with the
Arabic model; 98.9% word-level argmax agreement with fp32 on the held-out set), and writes this file +
`riderDiacritizer.meta.json` (char/label/lang-token maps). The fp32↔int8 gap is ≈1% of words.

## Sidecar
`riderDiacritizer.meta.json` — `{chars, labels, lang_tokens}`. Committed (small). The `.onnx` ships in-repo (as the
Arabic model does); absent → the pre-pass is a no-op and callers get the lexicon+default path.

## Measured
End-to-end IPA on the held-out INVERTIBLE split (predicted harakat → g2p → IPA vs wikipron reference), neural vs the
bare default-schwa baseline: **+23.5 overall** (fa +29.0, ur +18.6, ps +4.1, pa +4.5). Under the shipped precedence
(lexicon → neural → default) the exact lexicon wins any word it covers; the neural handles the OOV tail.

## 2026-07-16 — fa silver regenerated FULL-DIACRITIZATION (model retrain pending)
`tools/arabic-restorer/harakat.fa.silver.tsv` was re-mined with `FA_FULL_FOLD` (two-pass: full-diacritization —
a/e/o kept distinct, classical→Iranian i→e/u→o, final-ه a→e — then loose fallback). Diacritization density
31%→48% (the old labels were short-vowel-blind: mined under the referee-eval fold that collapses a~e~o~i~u, so
کتاب was labeled bare → the model learned to under-vocalize). **The committed `.onnx` PREDATES this** and still
under-vocalizes; a retrain (`train_multilingual_harakat.py`) + re-export picks up the fixed labels. The coverage
LEXICON (`src/languages/persian/lexicon.tsv`) was already regenerated from the same mine and ships now. ur/ps/pa
still use the short-vowel-blind loose fold — their own FULL_FOLD dialect maps are a follow-up.
