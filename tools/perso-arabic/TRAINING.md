# Shared harakat restorer — training & eval harness

Fine-tune the existing Arabic diacritizer (`src/languages/arabic/diacritizer.onnx`) into a **multilingual** harakat
restorer for the Perso-Arabic abjad languages. This doc is the recipe; the actual run is an **offline GPU job** (as
for the Arabic model — staged outside CI, per `src/languages/arabic/diacritizer.PROVENANCE.md`).

## Inputs (all committed under `tools/perso-arabic/`)
| file | role |
|---|---|
| `multilingual_charvocab.json` | char vocab (98) preserving the Arabic indices 0–38 + 19 harakat labels |
| `train.tsv` / `eval.tsv` | `skeleton⇥lang⇥vocalized`, deterministic 90/10 split (`build_training_manifest.py`) |
| `silver.normalized.tsv` | the end-to-end IPA eval reference (wikipron, notation-harmonized) |
| `harakat.{pa,ur,ps,fa}.silver.tsv` | the mined rider labels (already merged into the manifest) |

Regenerate the manifest: `python3 build_training_manifest.py` (idempotent; bump `AR_REPLAY` for a more
Arabic-weighted fine-tune).

## Label derivation
Per character of `skeleton`, read the harakat that follows it in `vocalized` and map to the 19-label scheme in
`multilingual_charvocab.json["labels"]` (`a`=fatḥa, `i`=kasra, `u`=ḍamma, `o`=sukūn, `^`=shadda, `~X`=shadda+X,
`F/N/K`=tanwīn, `_`=none). This is the same alignment the Arabic model uses; the label set is unchanged because the
diacritics are shared across every Perso-Arabic orthography.

## Model & fine-tune recipe
Same architecture as the Arabic model: char-level **BiLSTM** (emb 128, hidden 512, 3 layers), per-position softmax
over the 19 labels. Two changes:
1. **Expand the embedding** 39→98 rows using `multilingual_charvocab.json` — rows 0–38 are copied from the Arabic
   checkpoint (identical indices by construction), rows 39+ are new (random init). Warm-start everything else.
2. **Language conditioning:** a small learned **language embedding** indexed by the `lang` column, added to each
   position's char embedding (do NOT fold languages into the char vocab). Single-language per example, so the tag
   is constant across the sequence.

Fine-tune on `train.tsv`, **riders upsampled ~5–10×** relative to Arabic (they are ~40% of rows but the point of
the run; Arabic is present as replay to prevent forgetting). Adam, early-stop on the eval-split label accuracy.

## Evaluation — two axes
1. **Direct harakat accuracy (DER)** on `eval.tsv`: predicted vs mined harakat, per language. Fast inner-loop metric.
2. **End-to-end IPA** — the real target: for each `silver.normalized.tsv` row, `skeleton →[model] harakat →[the
   language's deterministic g2p] IPA`, folded and compared to the reference IPA (reuse `makeFold` from
   `tools/referee-eval`). This is what `invert_harakat.ts` inverts, so it measures whether the model recovers the
   vocalizations the g2p needs. Report per language; riders are the ones to watch (transfer vs the anchor).

Success = riders' end-to-end IPA beats the default-schwa baseline (pa 23.3% today) AND beats a rider-only model
(i.e. the anchor transfer is real).

## Export
`export_onnx.py` → int8 `quantize_dynamic`, mirroring the Arabic pipeline. Commit `*.meta.json` (char/label/lang
maps) beside the gitignored `.onnx`.

## Actual run (2026-07-15, RTX 3090)
```
$ARDIAC_PY train_multilingual_harakat.py --epochs 25 --upsample 4
$ARDIAC_PY predict_harakat.py --in eval.tsv --out /tmp/pred.tsv
npx tsx eval_endtoend.ts /tmp/pred.tsv
```
Warm-started `bilstm_pausal.pt` (26 lstm/fc tensors + 39 embedding rows copied; 5 lang tokens appended), 15.3 M
params, best at epoch 1. Held-out harakat DER: ur 2.4% / fa 2.6% / ps 4.0% / pa 7.2%. **End-to-end IPA (model vs
bare-skeleton baseline): 68.7% → 86.5%, +17.8** (fa +25.2, ps +9.3, ur +4.5, pa +2.7). Checkpoint in `$ARDIAC`
(gitignored); `multilingual_diacritizer.meta.json` committed. See docs Run 9.
