# `da-g2p-tagger.int8.onnx` — provenance

**What it is.** A per-grapheme BiLSTM tagger that maps an OOV Danish word to IPA in the NST narrow
convention. It is the neural OOV tier for Danish. `da-g2p-tagger.meta.json` holds its maps and the
consonant-consistency mask.

**Training data.** The **NST Danish pronunciation lexicon** (`dan030224NST.pron`), Nasjonalbiblioteket /
Språkbanken (sbr-26), **CC0**.
- `tools/danish/build_da_nst.py` converts its X-SAMPA to IPA and writes two files: the tagger's full
  training set (about 199k words), and the shipped `da-lexicon.tsv`.
- The shipped lexicon is the training set intersected with the top 50k of hermitdave FrequencyWords
  OpenSubtitles-da (CC BY-SA). That list is used only as a filter, and the lexicon keeps only NST content.
- The tagger trains on the full NST set.

**Licence.** CC0 (`LICENSES/PROVENANCE.md` §1).

**Regenerate.**

```
python3 tools/danish/build_da_nst.py --pron <dan030224NST.pron> --freq <da_50k.txt>
DA_PRODUCTION=1 .venv/bin/python -u tools/danish/da_bilstm.py
```

Then quantize the fp32 export to int8: the runtime loads `da-g2p-tagger.int8.onnx`, and the trainer does
not write it.

Build notes and measurements: `docs/investigations/da/da-g2p-tagger_build_notes_investigation.md`.
