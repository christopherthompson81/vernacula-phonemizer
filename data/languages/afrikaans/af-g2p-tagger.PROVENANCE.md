# `af-g2p-tagger.int8.onnx` — provenance

**What it is.** A per-grapheme BiLSTM tagger that maps an OOV Afrikaans word to IPA. It is the neural OOV tier
for Afrikaans. `af-g2p-tagger.meta.json` holds its maps and the consonant-consistency mask.

**Training data.** `tools/afrikaans/af-g2p-data.tsv`, 32,544 vetted pairs built by
`tools/afrikaans/build_af_g2p_data.ts` from the two open Afrikaans pronunciation dictionaries:

| source | entries | licence | pairs contributed |
|---|---|---|---|
| RCRL Afrikaans Pronunciation Dictionary v1.4.1 (CTexT/NWU, via ttslab/za_lex) | 27,428 | CC BY-SA 2.5 ZA | 27,385 |
| NCHLT-inlang Afrikaans (DAC / CSIR / NWU, via SADiLaR) | 15,094 | CC BY 3.0 | 5,159 |

- Every pair is vetted against this engine's rule output.
- For the long vowels neither source can write (ɛː œː yː …), the rule output is substituted. The file's
  `gold` column marks those rows `rule`. See `tools/afrikaans/nchlt_afr.PROVENANCE.md` for the NCHLT
  source.

**Licence.** The weights reproduce licensed pronunciation data, so they are declared CC-BY-SA-inheriting and
fenced like the data. RCRL's share-alike term governs the combination, and NCHLT's CC BY 3.0 is
attribution-only and compatible (`LICENSES/PROVENANCE.md` §3). Attribution for both is in NOTICE.

**Regenerate.** `tools/afrikaans/train_af_bilstm.py` with `hid=256`, `batch=256`, 40 epochs, 8 EM alignment
iterations, `SEP=""` and seed 0. Export at opset 17, then `quantize_dynamic` to QUInt8.

Build notes and measurements: `docs/investigations/af/af-g2p-tagger_build_notes_investigation.md`.
