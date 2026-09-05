# Wiring up the FLEURS corpus root — investigation log

Prompted by a residual query against `tools/language-catalogue/languages.db`:

```sql
SELECT * FROM languages
WHERE normalization IS NULL AND decision = 'implemented'
ORDER BY coalesce(l1_speakers,0) + coalesce(l2_speakers,0) DESC;
```

Sixteen rows. Three (`ltg`, `nci`, `chr`) had mined artifacts and went to parallel agents. The question this
log answers is what to do about the other thirteen, and the answer changed twice as it was measured.

## Run 1 — 2026-08-16 — the first answer was wrong because the column was wrong

The residual query returns a `fleurs` column, documented in `tools/language-catalogue/README.md` as
"1 = in the **FLEURS-102** speech benchmark". Reading it at face value gave a tidy plan: five of the
thirteen (`umb`, `luo`, `kam`, `kea`, `naq`) were flagged `1`, so a single download would unblock ~15.3M
speakers' worth of languages.

⚠ **The column overcounts, and arithmetic proves it before any lookup does**: `SELECT count(*) … WHERE
fleurs=1` returns **113**, and FLEURS-102 has **102** languages. At least eleven had to be wrong.

Listing the actual repo contents settled it:

```
python3 -c "from huggingface_hub import HfApi; ..."   # data/<config>/ over google/fleurs
→ 102 configs
```

Eleven flagged codes have no config: `ab crh eu hyw kaa ltg naq pap pbt pt-BR rup`.

**Implication, and it is the one that mattered**: `naq`, `ltg` and `rup` are three of the thirteen rows the
plan was built on, and FLEURS does not contain any of them. Nama has no route at all; Latgalian and
Aromanian were always wiki jobs.

## Run 2 — 2026-08-16 — ⚠ THE GENERATOR IS CORRECT AND THE ARTIFACT DRIFTED

The obvious next move is to "fix the roster". Reading it first shows there is nothing wrong with it.
`gen-seed.py` carries the FLEURS-102 set mapped to repo codes by the benchmark's ACTUAL recorded variety,
with the mappings written down in a comment above the block (`ar_eg → arz`, `es_419 → es-419`,
`ms_my → zsm`, `fil_ph → tl`, `ny_mw → nya`, `nb_no → nb`, `hy_am → hy`, `nso_za → nso`).

Applying those mappings to the 102 real configs and diffing against the hand-typed block:

```
hand-typed FLEURS set: 102   real configs: 102   resolved codes: 102
in the hand-typed set but no config resolves to it:   (none)
a real config resolves to it but not in the hand-typed set:   (none)
```

**A perfect match.** The generator has been right all along; `catalogue.tsv` — which `build.py`'s docstring
names as the source of truth — carries eleven rows the generator would never have produced. Someone edited
the TSV directly, or rows were added later without regenerating.

⚠ **And four of my eleven "false positives" were not false at all.** `arz`, `nya`, `tl` and `zsm` ARE in the
roster, under exactly the documented variety mappings; the first check compared against raw config
basenames and missed them. Reading the generator before "fixing" it is what caught that.

**Corrected verdict:** nine rows are factually wrong (`ab crh eu hyw kaa ltg naq pap rup` — FLEURS contains
none of these under any code), and two are DUPLICATE REPRESENTATION rather than error: `pbt` shares
`ps_af` with `ps`, and `pt-BR` shares `pt_br` with `pt`. Which row should own a shared config is a
modelling question, not a fact, so those two are left alone and named.

## Run 3 — 2026-08-16 — the corpus was on disk the whole time

`$FLEURS` was unset, which is why every recent round wrote `--corpus mined:<lang>`; a `hy` investigation doc
from an earlier round records `FLEURS=unset` in as many words. The root is
`/mnt/data/omnivoice_ipa/corpus`:

```
fleurs_transcripts/data/   66 languages × {train,dev,test}.tsv    179M
audio_cache/data/                                                 132G
tokens/                    codes_<lang>.npz                       317M
```

`export FLEURS=…/fleurs_transcripts/data` and `corpus-diff.ts` lists all 66 immediately — no code change.

⚠ **The sanity check is the interesting part.** Serbian has both rulers:

```
--corpus sr_rs       1923 utterances   DROP=0  (and every other class 0)
--corpus mined:sr     101 utterances   DROP=0
```

Both clean, so the path resolves and the two agree. But they are COMPLEMENTARY, NOT RANKED: FLEURS is
read-aloud news prose and therefore the language's real distribution, while the mined artifact is selected
ADVERSARIALLY for symbol density (its own header says so). 1,923 ordinary sentences and 101 hard ones
answer different questions, and a round should read both where both exist.

## Run 4 — 2026-08-16 — fetching the five that were missing

FLEURS-102 minus the 66 on disk leaves 36, and five of them are the ones this investigation is about:
`umb_ao`, `luo_ke`, `kam_ke`, `kea_cv` and `bs_ba`. `tools/corpus/fetch-fleurs-audio.py` already names the
repo (`google/fleurs`) and the layout (`data/<lang>/…`), so transcripts are the same `hf_hub_download` call
with a different path — megabytes, not the 132G the audio would cost.

```
umb_ao    2111 rows        luo_ke    2742 rows        kam_ke    4505 rows
kea_cv    3945 rows        bs_ba     4416 rows
```

Emitting a baseline through the current engine for each — the first time any of them has been measured
against a real corpus:

| lang | utterances | DROP | other classes |
|---|---|---|---|
| umb | 1,493 | 8 | 0 |
| luo | 1,660 | 11 | 0 |
| kam | 1,992 | 11 | 0 |
| kea | 1,931 | 19 | 0 |
| bs | 1,976 | 10 | 0 |

⚠ **The counts are small, and that is a property of the corpus rather than of the languages.** FLEURS is
read-aloud news: a Wikipedia dump carries populations, areas, coordinates and citations, and FLEURS carries
sentences a person can read in fifteen seconds. Recent wiki-sourced rounds opened at DROP 63–130. Anyone
planning these five should expect a thinner symbol surface and should NOT read "8 drops" as "nearly done" —
DROP counts symbol-drop classes only, and says nothing about a grouping comma being read as a pause.

⚠ **Bosnian is the pick of the five** for a reason unrelated to its corpus: `bosnian.ts` already borrows
Serbian's `phonemizeWord` while having no normalizer of its own, and BOTH siblings — `serbian` and
`croatian` — ship a `normalize.ts`. That is trap 55 with two hypotheses instead of one, and now with two
rulers (`bs_ba` at 1,976 utterances, plus 98,636 wiki articles available for mining as a cross-check).

## Run 5 — 2026-08-16 — ⚠ A PHANTOM TEST FAILURE FROM THE AGENT WORKTREES

Verifying the catalogue change, `npx vitest run` reported three failures — all from
`.claude/worktrees/agent-…/test/languageCatalogue.test.ts`, all "the derived `normalization` column is
stale". True of a worktree holding a half-finished layer; false of this checkout.

Vitest's default `include` is `**/*.{test,spec}…` with only `node_modules` and `dist` excluded, so any
worktree parked inside the checkout gets collected too — and parallel agents are isolated by putting
worktrees exactly there. ⚠ **This is not a slow build, it is a wrong answer**, and it names a real file and
a real assertion, which is the kind a reader believes.

All 248 test files live under `test/` and none lives anywhere else (checked with `find`, not assumed), so
`vitest.config.ts` now pins `include: ["test/**/*.test.ts"]`. The agents' own runs were never affected —
their worktrees do not contain `.claude/` — so this is a hazard for the PARENT of a fan-out only.

## What changed

- `tools/language-catalogue/catalogue.tsv` — nine `fleurs` values corrected to `0`.
- `tools/language-catalogue/build.py` — cross-checks the column against `gen-seed.py`'s roster on every
  build and warns on drift, with the two duplicate pairs NAMED rather than inferred from a prefix (a prefix
  heuristic tolerates `pt-BR` and still flags `pbt`, which shares `ps_af` with `ps` and has no shared
  prefix). Verified by deliberately re-flagging `eu` and confirming the warning fires.
- `vitest.config.ts` — new, scoping the suite to `test/`.
- `/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/{umb_ao,luo_ke,kam_ke,kea_cv,bs_ba}` — fetched.
  Outside the repo, so nothing is committed for it; this log is the record that it exists.

## Backlog

- **`pbt` and `pt-BR`** still carry `fleurs=1` alongside `ps` and `pt`. Deliberate: both name a real config,
  and choosing an owner is a modelling decision. The build warns if either loses its twin.
- **The 36 FLEURS languages still not downloaded** — 31 beyond the five fetched here. Cheap to add when a
  round needs one.
- **The audio tier.** `audio_cache` holds 132G for the 66 downloaded languages. The playbook documents audio
  as the FOURTH sourcing tier, for the case where a written SIGN's word is absent from every text haystack
  BY CONSTRUCTION — which is exactly what stopped Crimean Tatar's plus and Hawaiian's minus in the last two
  rounds. Neither language is in FLEURS, so it would not have helped those two; but for any of the 66 it is
  reachable and has never been used.
- **No route at all:** `quc` (1.1M), `naq`, `nog`, `kl` (wiki closed, reports zero articles), `mto`, `smj`,
  `grc` (Wikisource, not Wikipedia). Treating these means sourcing words from a dictionary instead of a
  corpus, which is the one thing the method exists to prevent.
