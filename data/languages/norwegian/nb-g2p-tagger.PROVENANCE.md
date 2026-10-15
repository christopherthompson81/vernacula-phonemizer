# `nb-g2p-tagger` — provenance (Norwegian Bokmål)

**What it is.** A word-level structural tagger (letter BiLSTM) that maps an OOV Bokmål word to IPA, stress
mark included. The runtime loads `nb-g2p-tagger.int8.onnx`. `nb-g2p-tagger.meta.json` holds its maps and the
consonant-consistency mask.

**Training data.** **Nasjonalbibliotekets uttaleleksikon (NST)**, the Norwegian National Library's
pronunciation lexicon (`no.leksikon.tar.gz`, Språkbanken), **CC0**.
- NST-SAMPA is converted to this repo's IPA by `tools/norwegian/`. Lexical tone is dropped, and the shortest
  variant is kept per word. That gives 631,021 training pairs.
- The same source, filtered by an OpenSubtitles `no` frequency list, is the shipped `nb-lexicon.tsv`.

**Licence.** CC0 (`LICENSES/PROVENANCE.md` §1).

**Regenerate.** Fetch the NST tarball and frequency list per `tools/CORPORA.md`, then:

```bash
python3 tools/norwegian/build_nb_data.py \
  --pron "nor030224NST.pron" --freq no_50k.txt --train-out /tmp/nb_train_stress.tsv
NB_LEX=/tmp/nb_train_stress.tsv NB_KEEP_STRESS=1 NB_SUBSAMPLE=0 \
  .venv/bin/python -u tools/norwegian/train_nb_bilstm.py
```

Then quantize the fp32 export to int8.

Build notes and measurements: `docs/investigations/nb/nb-g2p-tagger_build_notes_investigation.md`.
