# Training corpora — how to fetch them, and how to rebuild every model from them

**None of these corpora are committed.** They are 280 MB+ raw, and two of the fleet's data sources are
NON-COMMERCIALLY licensed (see the licence-motivated exclusions in `.gitignore`), so a blanket "commit the
training data" would push encumbered material into a public repo. This file is the substitute: exact URLs,
checksums, licences, and the command sequence that turns each download into the committed artifact.

⚠ **Why this file exists.** On 2026-08-19 the packing bug (investigation Runs 41–45) had to be rolled out to
every BiLSTM in the fleet, and **four models could not be retrained because nobody could find their training
data** — nb, da, he and fa were left carrying a known defect purely for want of a download URL. Every source
below was recovered in under an hour once someone went looking. The cost was not the fetching; it was not
having written this down.

`bash tools/fetch_corpora.sh <lang…>` automates the fetch + checksum for everything here.

---

## nb — Norwegian Bokmål g2p tagger (`nb-g2p-tagger.onnx`)

| | |
|---|---|
| source | NST *Nasjonalbibliotekets uttaleleksikon*, National Library of Norway / Språkbanken |
| url | `https://www.nb.no/sbfil/leksikalske_databaser/leksikon/no.leksikon.tar.gz` |
| sha256 | `cef2a5f9690d058331f0f814f175109887bcdc7415e802e1523043b9c36e455b` |
| size | 24 MB → 163 MB extracted; the file wanted is `nor030224NST.pron` (ISO-8859-1, CRLF, `;`-separated) |
| licence | **CC0** |
| also needs | OpenSubtitles frequency list, `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/no/no_50k.txt` (CC BY-SA) |

```sh
python3 tools/norwegian/build_nb_data.py --pron <nor030224NST.pron> --freq <no_50k.txt>
NB_LEX=/tmp/nb_train.tsv .venv/bin/python -u tools/norwegian/train_nb_bilstm.py
```

⚠ `src/languages/norwegian/nb-lexicon.tsv` is the ~38k SHIPPING subset, **not** the ~814k training dump.
Training on it produces a smaller, different model — do not substitute it.

## da — Danish g2p tagger (`da-g2p-tagger.int8.onnx`)

| | |
|---|---|
| source | NST Danish lexicon (`sbr-26`), same publisher |
| url | `https://www.nb.no/sbfil/leksikalske_databaser/leksikon/da_leksikon.tar.gz` |
| sha256 | `c54a27fa45ea0773bc05ecdfd362044f59e7a9538d142e71b245b81e1bd40102` |
| size | 5.7 MB → 34 MB; the file wanted is `dan030224NST.pron` |
| licence | **CC0** |
| also needs | `…/content/2018/da/da_50k.txt` (CC BY-SA) |

```sh
python3 tools/danish/build_da_nst.py --pron <dan030224NST.pron> --freq <da_50k.txt> --train-out /tmp/da_train.tsv
DA_PRODUCTION=1 DA_LEX=/tmp/da_train.tsv .venv/bin/python -u tools/danish/da_bilstm.py
```

⚠ Same trap as nb: `da-lexicon.tsv` is the top-50k shipping tier, not the ~199k training set.

## he — Hebrew niqqud tagger (`he-tagger.int8.onnx`)

| | |
|---|---|
| source | Nakdimon `hebrew_diacritized`, `https://github.com/elazarg/hebrew_diacritized` |
| pinned | commit `1211c8f3edafd601922d4be473f678ff79c5a12c` (verified 2026-08-19) |
| size | 84 MB |
| licence | **MIT** — ⚠ but the builder uses the PERMISSIVE SUBSET ONLY (public-domain pre-modern + permissively-licensed modern). See `he-tagger.PROVENANCE.md`; do not widen it without re-reading that policy. |

```sh
git clone https://github.com/elazarg/hebrew_diacritized /tmp/hebrew_diacritized
npx tsx tools/hebrew/build_tagger_data.ts /tmp/hebrew_diacritized /tmp/he_tagger_train.tsv
.venv/bin/python tools/hebrew/train_he_tagger.py /tmp/he_tagger_train.tsv src/languages/hebrew
.venv/bin/python tools/hebrew/export_he_tagger_onnx.py src/languages/hebrew
```

## fa — Persian tagger + restorers (`fa-tagger`, `fa-vowel-restorer`, `fa-context-restorer`)

| | |
|---|---|
| source | HomoRich, `https://huggingface.co/datasets/MahtaFetrat/HomoRich-G2P-Persian` |
| size | ~528k rows |
| licence | **CC0** |

```sh
huggingface-cli download MahtaFetrat/HomoRich-G2P-Persian --repo-type dataset --local-dir /tmp/homorich
.venv/bin/python tools/persian/build_homorich_ipa.py /tmp/homorich/<file>.parquet tools/persian/homorich_ipa_clean.tsv
.venv/bin/python tools/persian/train_tagger.py tools/persian      # → fa_tagger.pt
.venv/bin/python tools/persian/export_tagger_onnx.py tools/persian src/languages/persian
```

⚠ `train_tagger.py` also wants `test_heldout.tsv` in the same directory — a 1,500-sentence slice held out by
the skeleton leakage guard. Regenerate it with the same split before claiming a comparable number.

## km — Khmer segmenter (`km-segmenter.int8.onnx`)

| | |
|---|---|
| source | `km.wikipedia.org` dump (180,782 paragraphs) |
| url | `https://dumps.wikimedia.org/kmwiki/latest/kmwiki-latest-pages-articles.xml.bz2` (~33 MB) |
| licence | **CC BY-SA 4.0** |

```sh
python3 tools/normalization/wikidump-to-text.py <kmwiki-latest-pages-articles.xml.bz2> /tmp/km-paragraphs.txt
.venv/bin/python tools/khmer/build_km_segmenter_data.py /tmp/km-paragraphs.txt /tmp/km_seg.tsv
.venv/bin/python tools/khmer/train_km_segmenter.py /tmp/km_seg.tsv src/languages/khmer
.venv/bin/python tools/khmer/export_km_segmenter_onnx.py src/languages/khmer
```

⚠ A *latest* dump is not the one the committed model saw, so a rebuild is a NEW model on NEWER data, not a
reproduction. Say so in any before/after.

## rider — Perso-Arabic harakat diacritizer (`riderDiacritizer.onnx`, serves ur + pnb)

Training data **is** committed: `tools/perso-arabic/train.tsv` (26,631) + `eval.tsv` (3,239). It needs the
Arabic base checkpoint to warm-start from, which is not:

```sh
ARDIAC=/mnt/data/ar-diac .venv/bin/python -u tools/perso-arabic/train_multilingual_harakat.py \
    --warm $ARDIAC/bilstm_pausal.pt --ckpt /tmp/rider.pt
RIDER_CKPT=/tmp/rider.pt .venv/bin/python tools/perso-arabic/export_onnx.py
# re-score any saved checkpoint without retraining:
.venv/bin/python tools/perso-arabic/train_multilingual_harakat.py --warm … --eval-ckpt /tmp/rider.pt
```

## ar / arz — the two Arabic diacritizers (`diacritizer.onnx`, `diacritizer-egy.onnx`)

⚠ **AFFECTED BY THE PACKING BUG, AND THE TRAINER IS IN ANOTHER REPO.**
`~/Programming/espeak-ng-portable/tools/diacritization/train_bilstm_sent.py` — bidirectional LSTM over a
`pad_sequence` collate with `def forward(s, x)` and no packing, the same shape as everything in Run 41.
⚠ Its `collate` **already returns `torch.tensor([len(x) for x in xs])`** — the lengths are computed and then
never passed. This is almost certainly the ancestor the rider was copied from, which is how the family
inherited the defect; the fix is one line in `forward` plus using the third tuple element.

| | |
|---|---|
| MSA data | `/mnt/data/ar-diac/` — `silver.txt` 320k, `train.txt` 310k, `val.txt` 5k; warm-start checkpoints `bilstm_*.pt`; `arwiki.xml.bz2` |
| Egyptian data | `/mnt/data/arz-diac/` — `corpus_arz_350k.txt`, `arzwiki.xml.bz2`, `export_egy*.py` |
| driver | `/mnt/data/ar-diac/train.sh` (splits silver → train/val/test, trains, exports) |

⚠ **The rider warm-starts from the Arabic base** (`bilstm_pausal.pt`), so retraining the base means
re-warm-starting the rider on top of it — do them in that order or the comparison is meaningless. Not done
here: the trainer belongs to a different repository, which is a decision to take deliberately rather than as
a side effect of a phonemizer PR.

## Not to be committed, and why

`.gitignore` excludes some corpora for **licence**, not size: the Urdu HF/Dakshina silver data and the Khmer
aakanee cross-check dictionary are CC BY-NC-SA. They stay out of the repo regardless of how convenient a
rebuild would be. When adding a source here, record the licence before the URL.
