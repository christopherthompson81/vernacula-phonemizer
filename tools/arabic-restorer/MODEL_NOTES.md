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
   where no diacritized corpus exists. Per-slot options: a short-vowel slot tries `{BARE, fatḥa, kasra, ḍamma,
   sukūn}` with **BARE (no diacritic = default-ə, label "0") preferred** (harmonizes with the cross-script
   convention); a consonant before **و** is a **long-vowel slot** trying `{bare → oː, ḍamma+waw → uː}`. Yields:
   Also: a consonant before a **ی/و GLIDE** (‑iyā/‑uwā — followed by another vowel letter) is a short slot too
   (آبادیات → ɑbɑd·ə·jɑt). And an explicitly-written fatḥa is now PROTECTED from medial schwa-deletion (`g2p.ts`
   marks it, `urdu.ts` strips the mark) so deletion elides only the *unwritten* default schwa — needed, or the ‑iyā
   epenthetic ə sits in a deletion context and vanishes. Also `damma+waw وُ → uː` in BOTH g2ps (`urdu/g2p.ts`,
   `shahmukhi.ts`; Persian already defaulted و→uː) — medial و could only surface as oː, so no vocalization reached
   the ‑ū words. Plus a **degemination fold** added to ur/fa/ps referee configs (`(.)\1→$1`, as pa already had):
   our g2p writes gemination as length (Cː, stripped by the backbone) but the referee DOUBLES it (CC) — a notation
   mismatch, not a harakat problem, so shadda is NOT searched; folding it neutralizes it and the geminate words
   label via the default. And **یَ (ya+fatḥa) → eː** in `urdu/g2p.ts` (bare ی = iː) — same ADAPTED-WORD trick as
   damma+waw→uː: the output is a diacritized word in OUR convention, so we encode a distinction standard harakat
   lacks and the model LEARNS it (NOT a lexical dead-end — the model is the lexicon). Yields: fa 73.7%, **ur 69.7%**,
   ps 44.9%, pa 37.2% (**13,908 pairs**).
4. `crossscript_pa.ts` → `harakat.pa.crossscript.tsv` — **cross-script GOLD** (see below). Currently OPT-IN.
5. `build_charvocab.py` → `multilingual_charvocab.json` — union of every letter across ALL skeleton sources
   (silver + harakat shards) with the Arabic char map, Arabic indices preserved. 99 chars, 19 labels.
6. `build_training_manifest.py` → `train.tsv` / `eval.tsv` — rider labels + a hash-selected 15k Arabic REPLAY
   sample (pausalized), deterministic 90/10 per-language split. `--crossscript` opt-in flag.

### Train / evaluate
```
/mnt/data/ar-diac-venv/bin/python train_multilingual_harakat.py --epochs 25 --upsample 4
/mnt/data/ar-diac-venv/bin/python predict_harakat.py --out /tmp/pred.tsv   # defaults --in eval_set.tsv
npx tsx eval_endtoend.ts /tmp/pred.tsv
```
- **Warm-start:** copy the 26 vocab-independent lstm/fc tensors directly; copy embedding rows by CHAR IDENTITY
  (Arabic rows transfer, rider/lang rows random-init). New lang embedding init random.
- **SIZE-AWARE upsampling** (`--balance 4000`): each rider → ~4k examples (ps 9×, pa 12×, ur/fa 1×), Arabic
  replay 1×. Uniform upsampling let the data-rich ur/fa dominate and REGRESSED Pashto via cross-lingual
  interference (−3.6); size-aware weighting recovered it (−1.8) with no ur/fa loss. Best at epoch 1–2.
- **Two metrics:** in-domain harakat DER (`eval.tsv`, inner-loop early-stop); the REPORTING metric is **end-to-end
  IPA on the STABLE `eval_set.tsv`** — predicted harakat → deterministic g2p → IPA vs the wikipron reference, MODEL
  vs bare-skeleton BASELINE. `eval_set.tsv` is a fixed 10% slice of the WIKIPRON reference (not the silver labels),
  excluded from training, so it does NOT move when the inversion changes → version comparisons are exact. It covers
  ALL held-out words incl. the ~half the g2p can't reproduce → honest full-coverage denominator (lower absolutes).
- **Result (silver-only, stable eval, n=1699):** end-to-end **45.0% → 61.0% (+16.0)**. Per language: **fa +21.3**
  (46→67%), **ur +13.9** (50→64% — incl. the یَ→eː win), **pa +2.4**, **ps +0.9** (now positive!). The ADAPTED-WORD
  encodings (damma+waw→uː, ya+fatḥa→eː) closed most of what had looked like the "lexical" tail — the model learns
  them from the mined labels, so the harakat scheme itself is the lexicon-generalizer. Baseline 45.0% is the
  g2p-COVERAGE floor (the words no harakat can reach — genuinely lexical residue for an optional per-word lexicon). Checkpoint `/mnt/data/ar-diac/bilstm_multilingual.pt`
  (gitignored); `multilingual_diacritizer.meta.json` committed. (An earlier "+18" was a DIFFERENT, moving eval over
  only the invertible subset — not comparable; use the stable `eval_set.tsv` numbers.)

## Cross-script GOLD (`crossscript_pa.ts`) — the mechanism, and why it's opt-in
Several abjad languages have a **voweled sister-script** (Punjabi↔Gurmukhi, Urdu↔Hindi-Devanagari,
Sindhi↔Devanagari, Persian↔Tajik-Cyrillic). The sister writes the vowels the abjad drops. Method: voweled word →
(voweled g2p) → correct IPA → transliterate to the abjad skeleton → keep only pairs whose abjad form phonemizes to
the SAME IPA (a hard gate) → GOLD harakat. Punjabi (both scripts are the same `pa` module): **916 gold pairs @
70.1%** vs 294 silver @ 23.3%. Pashto is the exception — no voweled sister-script → stays on inversion/self-training.

**STATUS (still opt-in).** The default-schwa convention clash is FIXED (`invert_harakat.ts` now prefers a bare/`0`
option for default-ə, matching the transliteration). That removed the catastrophic conflict — pa held-out DER
17%→~12%. But `--crossscript` still isn't a clear end-to-end WIN, and the deeper reason is a **distribution shift**:
the Gurmukhi→Shahmukhi transliteration produces *synthetic* orthography (phonetically transliterated skeletons),
which drifts from how real Shahmukhi words are actually spelled — so the model over-fits transliteration artifacts
and doesn't gain on the real (wikipron) test words. The vowel CONTENT is gold; the SPELLING is not. To make it a
net win: transliterate to *real* Shahmukhi orthography (needs a Gurmukhi↔Shahmukhi orthographic map / parallel
corpus, not a phonetic transliteration), or evaluate/train on the sister-script distribution directly. Also note
the `damma+waw وُ → uː` g2p fix the sister-script surfaced (in `shahmukhi.ts`).

**Eval (pinned).** The reporting eval is now the STABLE `eval_set.tsv` — a fixed 10% slice of the WIKIPRON reference
(not the silver labels), excluded from training, so it doesn't move when the inversion changes. `build_training_
manifest.py` writes it and drops those skeletons from train/in-domain-eval. This is what made pa/ps legible: they're
~neutral (not the old ±4-word swing). Use it (not the old moving split) for every version comparison from here.

## Extending to a new language
1. Build its deterministic g2p (front-end) as usual.
2. Mine silver: export a bare `phonemizeWord`, add it to `invert_harakat.ts` LANGS, run — needs a referee IPA set
   (wikipron) to invert against.
3. If it has a voweled sister-script with a g2p, add a `crossscript_<lang>.ts` (transliterate + verify) for GOLD.
4. Rebuild vocab + manifest, re-fine-tune, eval end-to-end. Retrain is short (~20 s on the 3090).
