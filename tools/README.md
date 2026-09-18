# tools/ — the offline workshop

Nothing here ships. `src/` + `data/` are self-contained at runtime; everything in this directory is the
provenance and reproducibility record for how `src/` got its data and models, plus the harnesses
that measure whether the engines are right.

Each tool is expected to state, in its header: what upstream source it reads (with a URL), that
source's license, and which committed artifact it produces. That contract is what
`LICENSES/PROVENANCE.md` indexes.

## Layout — four roles, one home each

| Directory | Role |
|---|---|
| `gen/` | **Build shipped data.** One-shot generators that read external corpora and emit committed files under `data/languages/<lang>/`. Naming: `build-<lang-code>-<what>.mts`. |
| `referee-eval/` | **The systematic eval harness.** Per-language configs (`langs/*.jsonc`) + independent referee transcriptions (`referees/*.tsv`) + `eval.ts`, with regression floors asserted in `referee-eval.test.ts`. |
| `eval/` | **One-off per-language validation.** Scripts that check one language against an external source or benchmark that the referee harness doesn't model (OpenJTalk, CC-CEDICT, g2pM, the Swedish/Japanese prosody golds, holdout experiments). Two of these — `ja-pitch-eval.mts`, `sv-accent-eval.mts` — are imported by tests, so they are live infrastructure, not scratch. |
| `corpus/` | **Reusable wordlist/referee fetchers** (batched + cached MediaWiki, etc.) that a new bring-up needs. |

## Per-language model pipelines

A language whose engine has a trained model gets a directory named **exactly like its
`data/languages/` counterpart**, holding the train/export pipeline for that model:

`bengali/` `danish/` `english/` `french/` `hebrew/` `norwegian/` `persian/` `perso-arabic/`
`sindhi/`

`perso-arabic/` is the multilingual Perso-Arabic harakat restorer shared by ur/ps/pa — it has no language
directory of its own, because the model is SHARED and ships as `data/core/riderDiacritizer.onnx`;
`persian/` is the fa tagger + vowel/context restorers.

## Other

- `krnb/` — extraction of a KRNB/Rangpuri referee set from open-access scholarship (its own
  `referees/`, consumed by `referee-eval/`).
- `language-catalogue/` — the language metadata catalogue (sqlite + TSV) used for planning
  coverage, not for phonemization.

## Environment

Nothing here hardcodes a machine layout — the tools read external data roots from the environment and
degrade to a clear failure if one is unset. None are needed to build, test, or use the phonemizer
itself; they matter only when regenerating a committed artifact.

| Variable | What it points at | Used by |
|---|---|---|
| `FLEURS` | the FLEURS transcript tree (`<corpus>/<split>.tsv`) | `normalization/` — mining, coverage, review |
| `DUMPS` | a directory of downloaded kaikki/wiktionary dumps and reference TSVs | `gen/`, `sindhi/`, `perso-arabic/` |
| `ESPEAK_NG` | an `espeak-ng` checkout, for its `dictsource/` tier. **Optional** — `normalization/espeak.ts` finds a sibling checkout (`../espeak-ng`), `~/espeak-ng` or the usual system prefixes on its own, and reports which. Set this only to override. | `normalization/sources.ts`, `normalization/review.ts` |
| `ESPEAK_PORTABLE` | the reference-engine checkout some one-off distillations were built against | `gen/build-{ca,ga,sv,cs,cy,th}-*` |
| `AUDIO_CACHE` | the FLEURS audio cache | `corpus/fetch-fleurs-audio.py` |
| `CMUDICT` | a CMUdict `cmudict.dict` file (public domain) | `english/en_g2p_ngram.ts` |
| `EN_FREQ` | an English frequency wordlist, one word per line | `english/en_g2p_ngram.ts` |
| `ARDIAC` / `ARDIAC_PY` | the Arabic-diacritizer staging dir and its torch+CUDA interpreter | `perso-arabic/`, `persian/` |
| `ARZDIAC` | the Egyptian-diacritizer staging dir | the `arz` pipeline |

## Conventions

- **Read from an external data root or the network, write into `data/`** — the source corpora are not
  committed (too large, and often not redistributable); the *derived* artifact is.
  ⚠ `data/`, NOT `src/`, SINCE #876, and this line said `src/` long after that stopped being true — which
  is how a trainer ends up writing a model where no engine reads it and reporting success. `test/
  tool-data-paths.test.ts` now fails on a tool that names a `src/languages/<lang>/<data file>` path or a
  `data/` directory that does not exist.
- **A tool that generates a committed file writes a provenance header into it**, naming the tool
  and the upstream license, so a data file is never orphaned from its origin.
- **Run from the repo root**: `npx tsx tools/gen/build-my-dict.ts`, `python3 tools/danish/build_da_nst.py`.
- Regenerating a committed artifact should be a no-op diff. If it is not, either the upstream
  changed or the engine did — investigate before committing the churn.
