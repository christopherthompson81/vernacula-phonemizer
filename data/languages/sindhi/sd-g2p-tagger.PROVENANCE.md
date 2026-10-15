# `sd-g2p-tagger.int8.onnx` — provenance

**What it is.** A per-letter structural tagger (BiLSTM) that restores the unwritten short vowels of Sindhi
Perso-Arabic script on OOV words. `sd-g2p-tagger.meta.json` holds its maps and the consonant-consistency mask.

**Training data.** 9,274 vocalized Sindhi words. The vowels come from the Devanagari spelling of the same
word, kept only where its consonant skeleton matches what this repo's Perso-Arabic rules produce. Slots with
Devanagari's inherent vowel are masked out of training.
- **Sindhi Open Lexicon Master Dataset**, published at SindhiLanguage.org, prepared and curated by **Amar
  Fayaz Buriro (امر فياض ٻرڙو)**. A bespoke permissive licence, `LICENSES/LicenseRef-SindhiOpenLexicon.txt`.
  **Named attribution is mandatory** and is in NOTICE.
- **kaikki** Sindhi (Wiktionary), CC BY-SA 4.0.

See `tools/sindhi/PROVENANCE.md` and `LICENSES/PROVENANCE.md` §2 and §2b.

**Regenerate.** `tools/sindhi/export_sd_tagger_onnx.py` trains (40 epochs), exports fp32 ONNX, checks argmax
parity against PyTorch, quantizes to int8, and writes the meta file. Run it under a torch ≤ 2.6 venv.

Build notes and measurements: `docs/investigations/sd/sd-g2p-tagger_build_notes_investigation.md`.
