# `pashto/lexicon.tsv` — provenance

**What it is.** 14,021 `skeleton ⇥ vocalized` rows, one per key: the shipped Pashto short-vowel restoration
lexicon. Built by `tools/perso-arabic/invert_harakat.ts --lexicon ps` and then
`tools/perso-arabic/export_lexicons.sh`. It can be rebuilt from the repo plus an espeak-ng checkout, with no
network access.

**Sources.**

| source of the skeleton | licence | rows reachable |
|---|---|---:|
| **espeak-ng `dictsource/ps_list`** | **GPL-3.0** | 13,522 |
| wikipron `pus` + kaikki `pus` | CC BY-SA | 1,026 |
| ps.wiktionary (`tools/perso-arabic/silver.pswikt-ps.tsv`, built by `tools/pashto/build_pswiktionary_silver.py`) | CC BY-SA | 548 |
| reachable only from espeak-ng | — | **13,372** |

`ps_list` is credited in its own header to **Hanif Rahman** (updated April 2025) and is distributed with
espeak-ng under GPL-3.0. The phoneme table `phsource/ph_pashto`, used by
`tools/pashto/build_espeak_silver.py` for the mnemonic→IPA map, comes from the same source. Both are
credited in NOTICE.

**What was taken.** Only the **short-vowel placement**. No espeak phoneme string is stored. Each reference
pronunciation was fed to `invert_harakat.ts`, which searches for a harakat vocalization of the skeleton
whose output from this repo's own g2p reproduces the reference under `PS_FULL_FOLD`. The stored value is that
vocalization, a diacritized spelling, so the consonants are this engine's.

**Licence.** The file is fenced under **GPL-3.0** inside the MIT repo, the same treatment as `wu/dict.tsv`
(`LICENSES/PROVENANCE.md` §4 item 3). The engine that reads it at runtime is not thereby GPL. The facts
posture does not apply here: 95.4% of rows are reachable only from the GPL source, so the file substantially
re-derives that compilation's headword selection.

**If the GPL fence becomes unwanted:**
1. Rebuild from the CC BY-SA sources only, by dropping the espeak tranche from `invert_harakat.ts`'s `ps`
   block. About 360 rows remain.
2. Ask the author of `ps_list` for a permissive grant.

Build notes, yield and measurements: `docs/investigations/ps/pashto-lexicon_build_notes_investigation.md`.
