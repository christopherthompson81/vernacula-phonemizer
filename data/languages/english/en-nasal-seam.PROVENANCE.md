# `en-nasal-seam.tsv` — provenance

**What it is.** For 37 English dictionary words, which of their `N` phones before a `K`/`G` sits at a
COMPOUND SEAM and must therefore NOT assimilate to [ŋ]: `pan·cake`, `rain·coat`, `man·kind`, `turn·key`,
`Lenin·grad`, `sun·glass`. CMUdict already writes `N` at every one of them; the converter's velar
assimilation rule was overriding it.

**Source.** Three referees, none of them ours: Moby Pronunciator II (Grady Ward, public domain),
wikipron `eng_latn_us` broad, and wikipron UK — all human or hand-compiled. Only the VERDICT at the site
is taken (does the transcription write `n` or `ŋ` before the velar); no phoneme strings are copied, and
only for words our own dictionary already contains. Regenerate with `tools/gen/build-en-nasal-seam.mts`,
which is the whole extraction.

**The bar for a row.** The dictionary must say `N`, the converter must be about to say [ŋ] anyway (so a
word the transparent-prefix guard already protects earns no row), and EVERY referee covering the word
must write `n`. Two covering referees, or one plus a seam visible in the spelling — the word divides at
the boundary into a dictionary word plus a COMMON word of four letters or more. Inflections of a listed
stem are added automatically, because no suffix can move a seam.

**⚠ Why the en-GB referee is admissible here.** It is excluded from the rest of the English audit as a
different variety. It is admissible for this one fact because [ŋ] versus [n] is a CONSONANT: the RP
delta is non-rhoticity and the vowel set, and neither can reach this site. That is the only reason the
table has two-source backing rather than one.

**Why a table and not a rule.** Measured over 1,130 referee-labelled `N`/`NG`+velar sites:

| | |
|---|---|
| dictionary says `N`, referees say `n` (the dictionary is right) | **298** |
| dictionary says `N`, referees say `ŋ` (a CMUdict slip) | 33 |
| at two or more agreeing sources | 107 against 4 |

So the assimilation rule overrides a statement about nine times for every slip it repairs — but the
slips are real (`anglophile`, `ankh`, `gangrene`, `drinkable`, `lancaster`) and deleting the rule ships
20 labelled words wrong, so it stays and the seams are listed. Two discriminators were built and both
failed: a splitter (does the word divide into two dictionary words at the boundary?) is 31:2 on the
labelled seams but also claims `benghazi`, `hangul`, `pangloss`, `panchromatic`, `vainglorious`; a
morpheme list derived from the labelled data has `corn` 3, `green` 3, `pan` 3, `man` 2, `on` 2, `turn` 2
and then thirty morphemes with one attestation each — and `pan` alone reaches `pancreas`, `pangloss` and
`panchromatic`. The converter's own comment had guessed as much ("needs a morphological inventory this
module does not have"); this is the measurement behind the guess.

Run 27 of `docs/investigations/en/en_moby_source_audit_investigation.md`.
