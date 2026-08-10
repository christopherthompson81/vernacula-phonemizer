# pashto/lexicon.tsv — provenance

**Artifact:** `src/languages/pashto/lexicon.tsv` — 10,698 `skeleton ⇥ vocalized` rows, the **shipped**
Pashto short-vowel restoration lexicon (the COVERAGE layer of the two-layer rider phonemizer). Built by
`tools/perso-arabic/invert_harakat.ts --lexicon ps` → `tools/perso-arabic/export_lexicons.sh`; re-runnable
from the repo plus an espeak-ng checkout, no network.

## Licence: GPL-3.0 (per-file fence)

**This file is fenced under GPL-3.0 inside the MIT repo**, the same treatment `wu/dict.tsv` gets — see
`LICENSES/PROVENANCE.md` §4. The engine reading it at runtime is **not** thereby GPL.

It is a **mixed-source** artifact and takes the most restrictive licence in the mix:

| source of the skeleton | licence | rows reachable |
|---|---|---:|
| **espeak-ng `dictsource/ps_list`** | **GPL-3.0** | 10,421 |
| wikipron `pus` + kaikki `pus` | CC-BY-SA | 1,110 |
| in both pools | — | 833 |
| **espeak-only** (would vanish without it) | — | **9,588** |

9,588 of 10,698 rows (89.6%) exist only because of the GPL source, so the facts posture is not available
here the way it is for `arabic/diacritization.tsv`: this is not a thin mechanical table that happens to
overlap an upstream compilation, it *is* substantially that compilation's headword selection, re-derived.

## What was taken from espeak, and what was not

⚠ **Only the SHORT-VOWEL PLACEMENT.** espeak's pronunciations were never copied. Each one was fed to
`invert_harakat.ts`, which **searches for a harakat vocalization of the Pashto skeleton whose output from
*our own g2p* reproduces the reference** under `PS_FULL_FOLD`. What is stored is that vocalization — a
diacritized spelling of the word — not espeak's phoneme string. Three consequences worth stating:

- **espeak's consonants are not imported.** Its dictionary disagrees with this engine's variety on ږ
  (`موږ` → ʁ where we read ʐ) and is internally mixed on ښ (across 82,583 entries: ʃ 54.7%, ʂ 29.6%,
  x 21.7%). None of that reaches the lexicon, because the consonants come from our g2p either way.
- **espeak's errors self-filter.** It under-vocalizes ~26% of the words it shares with the wikipron referee
  (it drops the epenthetic schwa our g2p models: `اتل` → `a:tl` against the referee's `a t ə l`). A row
  exists only where a vocalization *reproduced* the reference, so those simply yield nothing.
- **The yield is the accuracy measure.** 82,287 candidate rows → 19,400 labelled (23.6%) → 10,698 after
  dropping identity rows (a word our g2p already reads correctly needs no entry).

## Attribution

`ps_list` is credited in its own header to **Hanif Rahman** (updated April 2025), distributed with
**espeak-ng** under **GPL-3.0**. The phoneme table `phsource/ph_pashto`, which supplied the mnemonic→IPA map
used by `tools/pashto/build_espeak_silver.py`, is from the same source. Credited in NOTICE.

## What it buys, measured

| | |
|---|---|
| entries | 351 → **10,698** |
| running-text **token** coverage (13.4 M tokens, ps.wikipedia) | 2.80% → **5.78%** |
| referee (wikipron `pus`) | **unchanged**, 55.7% |

⚠ **The referee cannot see this and that is not a defect in it.** The previous 351 entries were mined *from*
wikipron, so they already covered the referee's words; the 10,347 new ones are words wikipron does not
contain. Running text is where they land. ⚠ And 5.78% is the honest figure, not the 37.2% of tokens espeak's
raw word list covers — the export drops identity rows, so 5.78% is the share of running tokens whose reading
the lexicon actually **changes**.

## Alternatives if the GPL fence becomes unwanted

1. **Rebuild from CC-BY-SA sources only** — drop the espeak tranche from `invert_harakat.ts`'s ps block.
   Coverage returns to ~1,110 reachable rows (~351 after identity-dropping), i.e. the pre-2026-08-10 state.
2. **Ask for a permissive grant** of `ps_list` from its author, as `wu/dict.tsv` records for Wugniu.
3. **Replace the source** — no larger machine-readable Pashto pronunciation set is known; wikipron (1,414)
   and kaikki (1,055) are the alternatives and are two orders of magnitude smaller. See
   `docs/investigations/ps_neural_restoration_investigation.md` Run 4.
