# Egyptian Arabic diacritizer model (diacritizer-egy.onnx) — provenance

The Egyptian neural diacritizer restores EGYPTIAN short vowels on bare Arabic as the async pre-pass for
`variety:"egyptian"` (arz) — where the shared MSA diacritizer restores the *wrong* (MSA) vowels (مصر MSA miṣr →
Egyptian maṣr, قلب qalb → ʔalb). Same architecture, alphabet, and inference code as the MSA model
(`diacritizer.ts`); a different `.onnx`.

## What it is

A sentence-level BiLSTM (emb 128, hidden 512, 3 layers, ~15.3 M params), int8-quantized ONNX (~15 MB),
char-level, the same 19-label pausal alphabet as the MSA model. Trained `--pausal 1` (pausal Egyptian, matching
our pausal-TTS target). **TEST DER 1.63% / WER 4.70%** vs the held-out teacher silver (better than the MSA
student's 2.17% DER). ONNX-vs-PyTorch argmax parity 100%.

## Provenance — teacher→student distillation (the MSA pattern, ADR-0014)

- **Teacher:** CAMeL Tools `calima-egy-r13` Egyptian morphological analyzer + `disambig-bert-unfactored-egy`
  (MIT) in-context disambiguator (NYU Abu Dhabi / Habash). The morphology DB is **GPL-2.0** and was used
  **OFFLINE ONLY** to silver-label training text — it is NOT shipped and NOT in the training pipeline of the
  distributed model.
- **Training text (silver corpus, both PERMISSIVE):**
  - **Masri (Egyptian) Wikipedia** (`arzwiki-latest-pages-articles`, **CC BY-SA 4.0**) — 350 k sentences.
  - **arabic-dialect-corpus** (dataflare, **MIT**) — the Egyptian (Masri) subset, ~90 k sentences.
  - Combined, calima-egy-silver-labelled, OOV-filtered (drop sentences <70% diacritized → non-Egyptian/loan
    contamination), deduped → **222,888 train / 12,383 val / 12,383 test**. Trained silver-only, no warm-start.
- **No Wiktionary in the model** — the kaikki lexicon is a separate shipped supplement (egyptian-lexicon.tsv),
  not part of this model's training.

## Licence posture (per ADR-0014, project author's reasoned posture, not legal advice)

A model trained on silver retains none of the teacher's or corpus's selection/arrangement — only the
orthographic regularities of Egyptian Arabic, which are facts (Feist). GPL is a copyright license on the teacher
DATABASE; training a distinct model on its outputs is a use, not a distribution of a derivative, and the student
weights are not the teacher's protected expression. The chosen corpus is permissive by its own terms (CC-BY-SA
Wikipedia, MIT dialect corpus). The GPL teacher is offline-only and unshipped. See the arz Phase-2 discussion in
docs/investigations/arz_egyptian_bringup_investigation.md.

## Regenerate

Offline GPU pipeline (RTX 3090, staged on `/mnt/data/arz-diac`, camel-tools venv): extract Masri Wikipedia +
the MIT dialect Egyptian subset → `calima_egy_silver.py` (calima-egy + BERT disambig → silver, 6 parallel GPU
workers) → `filter_split.py` (OOV-filter, 90/5/5) → `train_bilstm_sent.py --pausal 1` (silver-only) →
`export_egy2.py` (legacy ONNX export + int8 `quantize_dynamic`). `diacritizer-egy.meta.json` (char/label maps)
is committed beside the model.
