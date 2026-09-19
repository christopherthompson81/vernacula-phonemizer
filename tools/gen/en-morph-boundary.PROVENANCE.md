# `en-morph-boundary.tsv` — provenance

**What it is.** For 13,325 English dictionary words, where the word's morpheme boundaries fall — as
PHONE indices into its `g2p-dict.tsv` row — and what KIND each boundary is: `compound`, `prefix`,
`suffix` or `confix`. The index is the position of the first phone *after* the boundary.

**Source.** English Wiktionary via [kaikki.org](https://kaikki.org/dictionary/English/) (wiktextract),
**CC BY-SA 4.0 / GFDL**. Only the etymology-template arguments are read — the morpheme split and its
kind. No definitions, no pronunciations, nothing that could make this circular with a referee.
Regenerate with `npx tsx tools/gen/build-en-morph-boundary.mts --kaikki
/path/to/kaikki.org-dictionary-English.jsonl --write` — the `--kaikki` flag matches the sibling kaikki
builders. The dump is 3.0 GB and is **not** in the repo.

**Why it exists.** Three separate investigations in this codebase stopped at the same missing thing, in
almost the same words. `englishArpabet.ts` on compound stress: *"the real discriminator is PREFIXED
versus COMPOUND, which needs a morphological inventory this module does not have."* `KNOWN_GAPS` on the
compound-seam geminates. Run 27 of the English audit on velar assimilation. It is one resource.

**⚠ The KIND is the point, and it is not recoverable from spelling.** The same operation —
concatenate two morphemes — has different phonological consequences per process:

| | geminate collapse | velar assimilation | compound stress |
|---|---|---|---|
| compound `pan·cake` | blocked | blocked | fore-stress |
| prefix `pan-chromatic` | blocked | **not** blocked | stem keeps primary |
| confix `Anglo·phile` | blocked | **not** blocked | stem keeps primary |
| suffix `thin·ness` | blocked | n/a | stem keeps primary |

`pan·cake` against `pan-chromatic` is the pair that defeated three home-grown discriminators: a
spelling splitter, dictionary-membership splitting, and a morpheme list mined out of referee labels.
Measured on the referee-labelled velar sites, `compound` is 12 for 12 with no false positives, and not
one of the 17 known assimilating words is a compound. **A consumer decides which kinds it respects;
this file does not decide for it.**

**Precision.** Two independent gates, both of which must pass, and together they reject 45% of the
stated splits:

| | |
|---|---|
| English entries whose headword our dictionary carries | 88,631 |
| a stated morpheme split | 24,368 |
| rejected — cleaned parts do not concatenate to the headword | 6,905 |
| rejected — first element not in our dictionary | 1,175 |
| rejected — its phones are not a prefix of the word's | 2,963 |
| **rows** | **13,325** |

The concatenation gate drops etymologies with an elided linking vowel; the phone-alignment gate drops
splits our dictionary disagrees with. Both are deliberately conservative — a wrong boundary is silent
at the point of use, so recall is the cheaper thing to lose. Measured by hand on the geminate evidence
set, alignment held for 102 of 109 checkable rows before recursion; the 7 failures were two-step
derivations (`guile·less·ly`), which the builder now recurses one level to recover.

**Known limits.** Wiktionary templates ordinary lexis well and proper nouns badly: `vanguard`,
`leningrad` and `cancan` are referee-confirmed compound seams with no template at all — `vanguard`
because it is from *avant-garde* and genuinely is not `van`+`guard`, which is a fact worth having.
Consumers must treat absence as *no information*, never as *no boundary*.

Runs 32–35 of `docs/investigations/en/en_moby_source_audit_investigation.md`.
