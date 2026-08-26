# pashto/lexicon.tsv — provenance

**Artifact:** `src/languages/pashto/lexicon.tsv` — 14,021 `skeleton ⇥ vocalized` rows, one per key, the **shipped**
Pashto short-vowel restoration lexicon (the COVERAGE layer of the two-layer rider phonemizer). Built by
`tools/perso-arabic/invert_harakat.ts --lexicon ps` → `tools/perso-arabic/export_lexicons.sh`; re-runnable
from the repo plus an espeak-ng checkout, no network.

## Licence: GPL-3.0 (per-file fence)

**This file is fenced under GPL-3.0 inside the MIT repo**, the same treatment `wu/dict.tsv` gets — see
`LICENSES/PROVENANCE.md` §4. The engine reading it at runtime is **not** thereby GPL.

It is a **mixed-source** artifact and takes the most restrictive licence in the mix:

| source of the skeleton | licence | rows reachable |
|---|---|---:|
| **espeak-ng `dictsource/ps_list`** | **GPL-3.0** | 13,522 |
| wikipron `pus` + kaikki `pus` | CC-BY-SA | 1,026 |
| **ps.wiktionary** (`silver.pswikt-ps.tsv`) | CC-BY-SA | 548 |
| in both pools | — | 150 |
| **espeak-only** (would vanish without it) | — | **13,372** |

13,372 of 14,021 rows (95.4%) exist only because of the GPL source, so the facts posture is not available
here the way it is for `arabic/diacritization.tsv`: this is not a thin mechanical table that happens to
overlap an upstream compilation, it *is* substantially that compilation's headword selection, re-derived.

## A third source, and the only pbt-majority one — ps.wiktionary

Added 2026-08-10 (investigation Run 13/14). `tools/perso-arabic/silver.pswikt-ps.tsv`, built by
`tools/pashto/build_pswiktionary_silver.py` from the ps.wiktionary dump; see its PROVENANCE neighbour.

It matters out of proportion to its 548 rows for two reasons. First, **it is the only Pashto source found
that is SOUTHERN** — ښ→ṣ̌/x̌ 74/75 = 99%, ږ→ẓ̌/ǧ 32/32 = 100%, with ZERO Northern readings, where wikipron
leans ~3:1 Northern and espeak is internally mixed — and it is independent of all three existing sources (427 of its rows are in none of them). Second,
**its `{{IPA}}` template is not IPA but a Latin transliteration**, which is the point: the diacritics mark
stress (87% of values) and length (49%), the two axes the abjad does not write.

⚠ **Its yield is the best of any tranche: 548 rows → 222 shipped (40.5%), against 16.9% corpus-wide**, and
169 of those are words no other source reaches. The same round-trip filter applies, so the dump's visible
corruption (a nine-headword block all carrying the value `bāz`) costs nothing.

⚠ **It is CC-BY-SA, not GPL**, so it counts on the CC side of the licence sentence above — which is why
`export_lexicons.sh` reads three CC pools, not two.

## What was taken from espeak, and what was not

⚠ **Only the SHORT-VOWEL PLACEMENT.** espeak's pronunciations were never copied. Each one was fed to
`invert_harakat.ts`, which **searches for a harakat vocalization of the Pashto skeleton whose output from
*our own g2p* reproduces the reference** under `PS_FULL_FOLD`. What is stored is that vocalization — a
diacritized spelling of the word — not espeak's phoneme string. Three consequences worth stating:

- **espeak's consonants are not imported, and the dialect filter is TOTAL — measured, not assumed.** Its
  dictionary disagrees with this engine's variety on ږ (`موږ` → ʁ where we read ʐ) and is internally mixed on
  ښ (across 82,583 entries: ʃ 54.7%, ʂ 29.6%, x 21.7%). None of it reaches the lexicon, because a row exists
  only where OUR g2p reproduces the reference, and `PS_FULL_FOLD` folds our ʂ→ʃ / ʐ→ʒ while leaving the
  Northern x / ɡ alone — so a Northern entry can never round-trip. Counted on unambiguous cases (ښ in a word
  with no خ; ږ in a word with no ګ/گ/ج/ځ):

  | espeak entries | | reached the lexicon |
  |---|---:|---:|
  | unambiguously **Northern** (x / ɡ) | 501 | **0 (0.0%)** |
  | unambiguously **Southern** (ʂ / ʐ) | 1,328 | 290 (21.8%) |

  So **the lexicon is already pbt-only on the isogloss by construction**, and splitting it by dialect would
  remove rows that do not exist. ⚠ The isogloss speaks only for the ~10% of words containing ښ/ږ, and espeak
  offers no dialect signal for the rest — but with the isogloss removed the Southern/Northern separation still
  holds 73.7% vs 23.1% on the tagged referees, so vowel contamination is bounded and small. n = 19 and 26,
  too small to claim purity. See investigation Run 12.
- **espeak's errors self-filter.** It under-vocalizes ~26% of the words it shares with the wikipron referee
  (it drops the epenthetic schwa our g2p models: `اتل` → `a:tl` against the referee's `a t ə l`). A row
  exists only where a vocalization *reproduced* the reference, so those simply yield nothing.
- **The yield is the accuracy measure.** 82,835 candidate rows → 22,018 labelled (**26.6%**) → 13,828 after
  dropping identity rows and deduplicating by key (a word our g2p already reads correctly needs no entry). ⚠ The yield ROSE from 23.6%
  on 2026-08-10 without a single new source row, because the g2p learned to spell things it previously could
  not: while the mater-lectionis rule was gated to word-final position a medial ⟨ـُو⟩ read as u·w·ə, so a
  medial /u/ had **no vocalization at all** and every espeak row wanting one simply failed to invert. The
  yield rate measures the g2p's expressive range as much as espeak's accuracy.

## Attribution

`ps_list` is credited in its own header to **Hanif Rahman** (updated April 2025), distributed with
**espeak-ng** under **GPL-3.0**. The phoneme table `phsource/ph_pashto`, which supplied the mnemonic→IPA map
used by `tools/pashto/build_espeak_silver.py`, is from the same source. Credited in NOTICE.

## What it buys, measured

| | |
|---|---|
| rows | 351 → 10,698 → 13,828 → **14,021** (one per key) |
| running-text **token** coverage (13.4 M tokens, ps.wikipedia) | 2.80% → 5.78% → *not re-measured* |
| referee (wikipron `pus`) | **unchanged**, 55.7% → 63.1% (see the caveat below) |

⚠ **The token-coverage row is STALE at 5.78% and is left labelled rather than updated.** It was measured
against a 13.4 M-token ps.wikipedia dump that is not in the repo and is no longer on this machine; the
lexicon has since grown 30%, so 5.78% is certainly an undercount, but an undercount by an unknown amount is
not a number to quote. Re-measuring needs the dump re-fetched.

⚠ **The referee cannot see the espeak tranche, and that is not a defect in it.** The 351 original entries
were mined *from* wikipron, so they already covered the referee's words; the espeak rows are words wikipron
does not contain. Running text is where they land. **Measured directly on 2026-08-10:** an espeak-only
lexicon (`invert_harakat.ts --lexicon ps --no-referee-silver`) supplies an entry for just 51 of the 1,281
pbt-referee words (4%) and moves that referee by −3 words against no lexicon at all. (154 referee words are in
espeak's pool at all; for ~103 of them our g2p already agrees, so the export emits no row.)

⚠⚠ **AND THE CONVERSE IS THE UNCOMFORTABLE HALF: the ps referee score is substantially CIRCULAR.** The same
fact that makes espeak invisible to the referee makes the wikipron/kaikki tranche far too visible — those
rows are mined *from* the referees and then graded *against* them. On `ps.wikipron-pbt.tsv`: shipped lexicon
69.6%, espeak-only lexicon 46.7%, no lexicon 46.9%. **The entire 22.7pp gap is the referee's own answers fed
back.**

⚠ **FIXED 2026-08-11 (Run 16): `eval.ts` now excludes referee-derived lexicon rows, and the reported ps score
is the non-circular one** — primary 42.5%, pbt 46.9%. The 63.1% / 69.6% figures survive only as what they
are, a statement about how much of the referee's vocabulary this lexicon COVERS. They are not engine quality
and must not be quoted as such. See `tools/referee-eval/langs/ps.jsonc` and
`docs/investigations/ps_neural_restoration_investigation.md` Run 11 — including why it was documented rather
than fixed in that run. ⚠ And 5.78% is the honest figure, not the 37.2% of tokens espeak's
raw word list covers — the export drops identity rows, so 5.78% is the share of running tokens whose reading
the lexicon actually **changes**.

## Alternatives if the GPL fence becomes unwanted

1. **Rebuild from CC-BY-SA sources only** — drop the espeak tranche from `invert_harakat.ts`'s ps block.
   Coverage returns to ~1,326 reachable rows (~360 after identity-dropping), i.e. the pre-2026-08-10 state.
   ⚠ Note that this is the *opposite* selection from `--no-referee-silver`, which keeps espeak and drops the
   CC-BY-SA sources; that flag is a measurement tool and must never produce a shipped lexicon.
2. **Ask for a permissive grant** of `ps_list` from its author, as `wu/dict.tsv` records for Wugniu.
3. **Replace the source** — no larger machine-readable Pashto pronunciation set is known; wikipron (1,414)
   and kaikki (1,055) are the alternatives and are two orders of magnitude smaller. See
   `docs/investigations/ps_neural_restoration_investigation.md` Run 4.
