# `fr-g2p-tagger.int8.onnx` — provenance

**What it is.** A per-grapheme BiLSTM tagger that maps an OOV French word to IPA. It is the neural OOV tier
for French. `fr-g2p-tagger.meta.json` holds its maps and the consonant-consistency mask.

**Training data.** **Lexique 3.83** (lexique.org; Boris New & Christophe Pallier), via openlexicon,
**CC BY-SA 4.0**. The licence was verified on 2026-07-29 against lexique.org's statement and openlexicon's
bundled `LICENSE-CC-BY-SA4.0.txt`. The input is `lexicon.tsv`, about 125k word→IPA forms, the same table the
sync engine ships. Graphemes are aligned to IPA chunks by hard EM
(`tools/norwegian/nb_tagger_parallel.py`, `SEP=""`).

**Licence.** The weights reproduce licensed pronunciation data, so they are declared CC-BY-SA-inheriting and
fenced like the data (`LICENSES/PROVENANCE.md` §3).

**Regenerate.** `FR_PRODUCTION=1 .venv/bin/python -u tools/french/fr_g2p_bilstm.py`, then quantize to int8.

Build notes and measurements: `docs/investigations/fr/fr-g2p-tagger_build_notes_investigation.md`.
