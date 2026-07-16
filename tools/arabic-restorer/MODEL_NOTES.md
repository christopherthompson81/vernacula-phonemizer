# Harakat restorer — model & training notes (durable)

Everything needed to understand, reproduce, or extend the neural short-vowel (harakat) restorer, so it doesn't have
to be rediscovered by probing. Two models exist: the **Arabic** diacritizer (shipped) and the **multilingual**
extension (this line of work). Both are char-level BiLSTMs with the same 19-label harakat scheme.

## Environment (the GPU box — NOT this repo, NOT CI)
- **Training venv:** `/mnt/data/ar-diac-venv/bin/python` (torch 2.6.0+cu124, CUDA on an RTX 3090). A second venv
  `/mnt/data/ar-diac/venv` (torch 2.5.1) also works. The user's `~/.local` torch is broken — don't use it.
- **Staging dir:** `/mnt/data/ar-diac/` — corpora (arwiki dump, ara_news), all `.pt` checkpoints, exported `.onnx`.
  Big files live here and are **gitignored**; only the `*.meta.json` maps + the TSV data + the scripts are committed.
- **The Arabic training scripts live in the SIBLING repo:** `~/Programming/espeak-ng-portable/tools/diacritization/`
  (`train_bilstm_sent.py`, `catt_silver.py`, `export_onnx.py`, …). The multilingual scripts live here in
  `tools/arabic-restorer/`.

## The Arabic base model (`src/languages/arabic/diacritizer.onnx`, gitignored)
- **Architecture:** char-level **BiLSTM**, emb 128, hidden 512, 3 layers, bidirectional, per-position softmax over
  19 labels. ~15.3 M params. int8 `quantize_dynamic` ONNX (~15 MB).
- **Vocab:** 39 chars (`<pad>`=0, `<unk>`=1, `<sp>`=2, then 36 Arabic letters), 19 labels. In `diacritizer.meta.json`.
- **Provenance (permissive):** teacher = **CATT** (Char-based Arabic Tashkeel Transformer, Apache-2.0) → silver-
  labels **Arabic Wikipedia** (CC-BY-SA); trained silver-only. No Tashkeela/Leipzig in the model. See
  `src/languages/arabic/diacritizer.PROVENANCE.md`. (`diacritization.tsv` is a separate 259k Tashkeela-derived
  lexicon used by `restore.ts` as a fallback — Tashkeela is ANCIENT public-domain text, not a licence blocker.)
- **Checkpoints on /mnt/data** (all emb 39×128, fc 19×1024, 3-layer LSTM): `bilstm_pausal.pt` is the one whose
  char+label maps **exactly match** the committed `diacritizer.meta.json` → **use it for warm-start**. The
  `bilstm_silveronly*.pt` have a different char ordering (labels still match).

## The 19-label harakat scheme (shared by both models)
Per BASE letter, read the diacritics that follow it: `a`=fatḥa, `u`=ḍamma, `i`=kasra, `o`=sukūn, `F/N/K`=tanwīn,
`^`=shadda-alone, `~X`=shadda+X, `0`=no vowel-diacritic, `_`=`<sp>`. Order (index): `_ 0 a u i o F N K ^ ~0 ~a ~u
~i ~o ~F ~N ~K ~^`. The alphabet is **fixed** (not data-built) so all models stay warm-start compatible, and it's
the same across every Perso-Arabic language because the diacritics are shared — that's why one scheme serves all.
**Pausal:** the models drop the word-final case-ending (iʿrāb) vowel — TTS reads pausally and the riders have no
iʿrāb anyway. `align()`/`pausalize()` in `train_multilingual_harakat.py`.

## The multilingual extension (this repo, `tools/arabic-restorer/`)
A **fine-tune** of the Arabic model, not a retrain. Char vocab expands 39→99 (`multilingual_charvocab.json`) with
the **Arabic indices 0–38 preserved**, so the trained Arabic embedding rows transfer and the rider letters append.
Language conditioning = a per-word `<lang:xx>` token prepended to the char sequence (no architecture change).

### Data pipeline (each step = one committed script + artifact)
1. `build_silver.py` → `silver.tsv` — wikipron Arabic-script scrapes (CC-BY-SA), diacritics stripped to the
   undiacritized SKELETON, paired with IPA. The end-to-end **eval reference**.
2. `normalize_ipa.py` → `silver.normalized.tsv` + `inventory.txt` — harmonize IPA notation (keep contrasts, strip
   tone/notation) so the eval scores phonology.
3. `invert_harakat.ts` → `harakat.{pa,ur,ps,fa}.silver.tsv` — **g2p-inversion**: for each (skeleton, IPA), search
   the harakat vocalization whose deterministic g2p output reproduces the IPA (fold-matched). SILVER rider labels
   where no diacritized corpus exists. Yields: fa 67.6%, ps 44.1%, ur 41.3%, pa 23.3% (10,929 pairs).
4. `crossscript_pa.ts` → `harakat.pa.crossscript.tsv` — **cross-script GOLD** (see below). Currently OPT-IN.
5. `build_charvocab.py` → `multilingual_charvocab.json` — union of every letter across ALL skeleton sources
   (silver + harakat shards) with the Arabic char map, Arabic indices preserved. 99 chars, 19 labels.
6. `build_training_manifest.py` → `train.tsv` / `eval.tsv` — rider labels + a hash-selected 15k Arabic REPLAY
   sample (pausalized), deterministic 90/10 per-language split. `--crossscript` opt-in flag.

### Train / evaluate
```
/mnt/data/ar-diac-venv/bin/python train_multilingual_harakat.py --epochs 25 --upsample 4
/mnt/data/ar-diac-venv/bin/python predict_harakat.py --in eval.tsv --out /tmp/pred.tsv
npx tsx eval_endtoend.ts /tmp/pred.tsv
```
- **Warm-start:** copy the 26 vocab-independent lstm/fc tensors directly; copy embedding rows by CHAR IDENTITY
  (Arabic rows transfer, rider/lang rows random-init). New lang embedding init random.
- **Upsample riders ~4×** (Arabic replay stays 1×). Best usually at epoch 1–2, early-stops fast.
- **Two metrics:** held-out harakat DER (inner loop); the real one is **end-to-end IPA** — predicted harakat →
  deterministic g2p → IPA vs the wikipron reference, MODEL vs bare-skeleton BASELINE.
- **Result (silver-only):** end-to-end **+18.4** (fa +26.4, ps +8.0, ur +5.4; pa ≈0, noisy on n=37). Held-out DER
  ur 2.1% / fa 2.5% / ps 3.3% / pa 8.6%. Checkpoint `/mnt/data/ar-diac/bilstm_multilingual.pt` (gitignored);
  `multilingual_diacritizer.meta.json` committed.

## Cross-script GOLD (`crossscript_pa.ts`) — the mechanism, and why it's opt-in
Several abjad languages have a **voweled sister-script** (Punjabi↔Gurmukhi, Urdu↔Hindi-Devanagari,
Sindhi↔Devanagari, Persian↔Tajik-Cyrillic). The sister writes the vowels the abjad drops. Method: voweled word →
(voweled g2p) → correct IPA → transliterate to the abjad skeleton → keep only pairs whose abjad form phonemizes to
the SAME IPA (a hard gate) → GOLD harakat. Punjabi (both scripts are the same `pa` module): **916 gold pairs @
70.1%** vs 294 silver @ 23.3%. Pashto is the exception — no voweled sister-script → stays on inversion/self-training.

**KNOWN ISSUE (why opt-in):** naive combination with the silver REGRESSED Punjabi (−12.5, DER 7→17%). The two
sources disagree on the **default-schwa label**: g2p-inversion has no bare option so it writes explicit *fatḥa* for
ə; the sister-script transliteration leaves inherent ə *bare* = label `0`. Contradictory supervision for the same
sound. **FIX before enabling:** harmonize the convention — give `invert_harakat.ts` a bare/`0` option and PREFER it
for default-ə, so both sources label an unwritten schwa `0` (matching real undiacritized text, where the reader/g2p
supplies the default). Then `--crossscript` should help, not hurt. Also relevant: `damma+waw وُ → uː` (a real g2p
fix the sister-script surfaced, already in `shahmukhi.ts`).

## Extending to a new language
1. Build its deterministic g2p (front-end) as usual.
2. Mine silver: export a bare `phonemizeWord`, add it to `invert_harakat.ts` LANGS, run — needs a referee IPA set
   (wikipron) to invert against.
3. If it has a voweled sister-script with a g2p, add a `crossscript_<lang>.ts` (transliterate + verify) for GOLD.
4. Rebuild vocab + manifest, re-fine-tune, eval end-to-end. Retrain is short (~20 s on the 3090).
