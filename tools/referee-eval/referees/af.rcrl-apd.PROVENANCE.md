# af.rcrl-apd.tsv — provenance

**Artifact:** `tools/referee-eval/referees/af.rcrl-apd.tsv` — 27,428 Afrikaans word→IPA pairs, the
**secondary** referee for `af`. Tools-only (an eval referee); nothing in `src/` reads it.

## Why it exists

Afrikaans was **single-source** until this file: the primary is the en.wiktionary Afrikaans IPA
category, and `secondaryGap` named *wikipron afr_latn* as the candidate second referee for three PRs.
It is not one — `afr_latn_broad.tsv` is ~2.1k rows of **the same en.wiktionary scrape**, matching the
primary entry for entry (`AWB` aːviəbiə, `Amerika` aˈmɪərəka, `André` ˈandrəi, `Afrikaander`,
`Barnard`, `Aarde`). Importing it would have corroborated nothing. This dictionary has **no
Wiktionary lineage at all**.

## Source

1. **RCRL Afrikaans Pronunciation Dictionary v1.4.1** — © 2010 **Centre for Text Technology (CTexT),
   North-West University, South Africa**. Originally published at
   `https://sourceforge.net/projects/rcrl/files/AfrPronDict/v1.4.1/`. A speech-technology pronunciation
   dictionary (SAMPA), independent of Wiktionary.
2. Redistributed, syllabified and phone-mapped by **`ttslab/za_lex`** `data/afr/` — Multilingual Speech
   Technologies, North-West University; © 2016 **The Department of Arts and Culture, Government of the
   Republic of South Africa**. Academic citations requested by that repo: van Niekerk, *Syllabification
   for Afrikaans speech synthesis* (PRASA 2016) and the 2017 PRASA follow-up.

**Licence: Creative Commons Attribution-Share Alike 2.5 South Africa** (`CC BY-SA 2.5 ZA`,
http://creativecommons.org/licenses/by/2.5/za/). Share-alike, **not** NonCommercial — so unlike the
Leipzig list `af-stems.txt` had to be rebuilt away from (LICENSES/PROVENANCE.md §4.4), this fences in
the **§3 share-alike stratum**, the same one that already carries French's Lexique 3.83 and the
Wiktionary-derived referee sets. Derived work inherits CC-BY-SA.

## How it was built

`tools/referee-eval/build-af-rcrl.ts` (network; re-runnable). From `data/afr/pronundict.txt`, whose
space-separated format is `WORD POS STRESS SYLLABLE-LENGTHS PHONE…`:

```
aaklige None 100 132 AA k l q x q     ->     aaklige   ˈɑː.klə.xə
```

- **Phones** are mapped to IPA by the dictionary's **own** `phonememap.ipa-hts.tsv` — the publisher's
  mapping, not ours. `pronundict.txt` is space-separated, so this is a token lookup with no
  longest-match ambiguity. **0 phones failed to map** across all 27,428 rows.
- **`ˈ`, `ˌ` and syllable dots are reconstructed** from the STRESS field (one digit per syllable over
  the alphabet **0/1/2** — 1 primary, 2 secondary) and the SYLLABLE-LENGTHS field (phone count per
  syllable). Those two were verified to agree with each other and with the phone count on **all 27,428
  rows** before being trusted, and the builder counts each rejection reason separately so this claim is
  supported by its own output rather than asserted: **0 orthography, 0 structure, 0 unmapped phone**.
  ⚠ Secondary stress is preserved rather than flattened to `""` — it is inert for today's eval (the
  backbone strips ˈ and ˌ alike), but the stress fields are the named next lever.
- Words are filtered to Afrikaans orthography (letters + ê ô û î ë ï é è á à ó ú ü **ö ä ò** ç,
  apostrophe, hyphen), and **all 27,428 rows pass**. ⚠ ⟨ö⟩/⟨ä⟩ were missing from the first draft of that
  class, which silently dropped the entire DIAERESIS class — koördinasie, koördinate, koördineer,
  koördinering, koöperasies, koöperatief, koöpteer, geöriënteerde, kobraägtig, zebraägtig — i.e.
  precisely the rows that exercise a letter the engine explicitly models (`diacriticVowels` ⟨ö⟩→[ø]).
- The dictionary lists **one pronunciation per headword** (verified: 0 headwords carry two distinct
  phone strings), so every row is a single-variant row.

## Convention deltas from our engine, and how they are handled

The phone inventory is close to ours already — this dictionary shares the Standard-Afrikaans analysis
the manifest is built on (centering diphthongs ⟨ee⟩ = iə and ⟨oo⟩ = uə, ⟨y⟩ = əi, ⟨ui⟩ = œy, ⟨eu⟩ = øː,
⟨h⟩ = ɦ, long ɑː). Differences:

| | |
|---|---|
| ⟨g⟩ written `x`, we write `χ` | the existing global `x→χ` fold |
| `æ` for ⟨e⟩ before /r l/ | the existing global `æ→ɛ` fold |
| ⟨ou⟩/⟨au⟩ written `əu`, we write `œu` | a **per-referee** fold (`əu→œu`). ⚠ NOT a disagreement about the language: each source is internally UNANIMOUS — en.wiktionary 34:0 for [œu], RCRL 325:0 for [əu] — so it is two consistent notations for one diphthong |

## What it settled immediately

The point of an independent source is adjudicating what one referee cannot. On import:

| question | en.wiktionary | RCRL | outcome |
|---|---|---|---|
| morpheme-initial ⟨Cw⟩ onset | 10:9 **coin flip** | **260:1 for [w]** | the engine rule rejected in Run 4 as "referee inconsistency" was RIGHT; `wGlideAfter` now emits the glide |
| ⟨-ig⟩ suffix vowel | ə 47:6 | ə 474:7 | corroborates [əχ] |
| word-initial ⟨v⟩ | f 184:13 | f 2363:69 | corroborates [f]; the f→v misses really are noise |
| word-final ⟨d⟩ devoicing | t 154:3 | t 1608:7 | corroborates |

It also independently confirmed every rule of #772 — `advies` atfis, `sending` sɛndəŋ, `landdros`
landrɔs, `wildtuin` vəltœyn, `bestanddeel` bəstandiəl, `handdoek` ɦanduk — and confirmed the four words
the reverted `shortHeads` experiment would have broken (`regter`, `sitting`, `bossie`, `mantel` are all
unsplit here).
