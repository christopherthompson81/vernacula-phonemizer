# sl / sr / hr / bs stress — looking for a source before calling the deferral justified

The stress audit that produced #828 (`af`), #829 (`is`) and #830 (`lb`) closed with the claim that the
four South Slavic engines were a *justified* deferral: pitch-accent languages, lexical placement, **no
stress-marked source committed**. The second half was true. The conclusion drawn from it was not
checked, and this is that check.

## Run 1 — 2026-08-17 — which committed sources carry stress at all

Question: across the whole referee corpus, which families preserve stress?

    for f in tools/referee-eval/referees/*.tsv; grep -c 'ˈ'

48 of the committed referees carry stress marks, and the split is by **source family**, not by
language:

| family | stress |
|---|---|
| **kaikki** (Wiktionary extract) | preserved — `bg` 46559/47616, `nl` 42891/46519, `el` 19538/19721, `ru` 4489/4540 |
| **wikipron** (broad *and* narrow) | stripped — `hu.wikipron-hun-narrow` 1/64286, every broad file 0 |

Every referee committed for these four languages is wikipron: `sl.wikipron-slv-broad`,
`sr.wikipron-hbs-latn`, `sr.epitran-srp-latn`; `hr` and `bs` have none at all.

⚠ **AND `sr.wikipron-hbs-latn` MARKS THE ACCENT AFTER ALL** — as `â ǎ ê ô` on its own vowels, 26126 of 26486
rows, which its committed header states outright. It does not use `ˈ`, so the same wrong instrument missed it.
The claim "no stress-marked source committed" was therefore wrong about the working tree too, not only about
Wiktionary. `tools/serbian/eval_stress_placement.mts` now reads those marks. So "no stress-marked
source is committed" was a statement about **which extraction we happened to commit**, not about what
Wiktionary holds. The kaikki family is already the repo's answer to this exact problem in 30+ other
languages.

## Run 2 — 2026-08-17 — do the dumps exist?

    curl -sI https://kaikki.org/dictionary/<Language>/kaikki.org-dictionary-<Language>.jsonl

| language | result |
|---|---|
| Slovene | **200**, 27.9 MB |
| Serbo-Croatian | 404 on the hyphenated name; **200** on `kaikki.org-dictionary-SerboCroatian.jsonl`, 277 MB |
| Croatian / Serbian / Bosnian | 404 — Wiktionary unifies them under Serbo-Croatian |

The unification is a **feature here, not a limitation**: one dump serves three engines.

## Run 3 — 2026-08-17 — the thing that made the earlier audit blind

First measurement of the downloaded dumps looked like a negative result:

    Slovene:        5795 entries with IPA, 82 carry ˈ/ˌ  (1.4%)
    Serbo-Croatian: 53071 entries with IPA, 731 carry ˈ/ˌ (1.4%)

**That number is an artefact of the instrument, not a property of the data.** South Slavic prosody is
not written with `ˈ`. It is written as a **tone/accent diacritic on the vowel**, and the marked vowel
*is* the stressed one:

    Slovene          /ràːʋən/   /planéːt/   /anɡɔ̀ːla/     acute = high, grave = low
    Serbo-Croatian   /ǎbdaːl/   /abdǒːmen/  /ôːn/          caron = rising, circumflex = falling

Re-measuring for combining U+0300/0301/030C/030F/0302/0311 over NFD:

| | headwords with IPA | carrying an accent |
|---|---|---|
| Slovene | 5499 | **5380 (97.8%)** |
| Serbo-Croatian | 50692 | **49585 (97.8%)** |

The mark distribution is the tone system itself, not noise: sh is caron 36473 / circumflex 15658 —
the rising/falling contrast — and sl is acute 3204 / grave 2772.

⚠ **The methodological lesson.** The audit's search instrument was `grep -c 'ˈ'`, which is correct for
Germanic and wrong for South Slavic. It would have returned zero forever, and "the grep found nothing"
had been quietly promoted to "the data does not exist." A source-availability claim needs a search
matched to how the source writes the thing.

## Run 4 — 2026-08-17 — is it usable? Convention, script, coverage

**Convention.** Converting to the repo's convention (`ˈ` before the nucleus) is deterministic and
about fifteen lines — the diacritic already sits on the nucleus, so it is a move, not an inference.
Verified over the full dumps: 51862/53071 sh and 5579/5795 sl convert; the rest have no accent.

    abdomen   /abdǒːmen/   -> abdˈoːmen   [rising]
    plural    /plǔraːl/    -> plˈuraːl    [rising]
    Argentina /arɡɛntìːna/ -> arɡɛntˈiːna [low]
    Pakistan  /pâkistan/   -> pˈakistan   [falling]

The tone survives as a label, so this is a source for the **four-way pitch accent**, not merely for
position — which is what `serbian.ts` names as deferred.

**Script.** The sh dump is 28190 Latin + 24875 Cyrillic headwords. The Serbian engine is dual-script
and needs both; Croatian and Bosnian are Latin-only. One dump covers all three.

**Coverage of running text** — the number that decides whether this is worth building.

⚠ **THE TABLE BELOW IS WRONG AND IS KEPT FOR THE RECORD.** FLEURS TSVs have seven columns and column 5 is
CHARACTER-SEPARATED (`i m a m o | j e d n o g o…`); reading the whole file with a word regex made every
individual letter a token, and single letters (`i a u o e`) are all in the lexicon as one-letter words. The
real figures, measured from column 3 only, are **43.7% / 43.2% / 44.1%** for sr/hr/bs — see
`docs/investigations/normalization/south_slavic_stress_investigation.md` Run 4. The conclusion survives (43% still exceeds the 37.2% that
justified #828) but the margin is much smaller than claimed here.

| corpus | tokens | lemma-tier coverage | + inflected forms |
|---|---|---|---|
| `sr_rs` | 562 633 | **83.3%** | 90.0% |
| `hr_hr` | 677 093 | **84.2%** | 90.7% |
| `bs_ba` | 645 975 | **84.2%** | 90.7% |
| `sl_si` | 526 169 | **56.8%** | — |

For scale, the Afrikaans change already shipped in #828 was built on an RCRL lexicon of 25 550
stressed words covering **37.2%** of af_za tokens, and reached ≈84.5% effective accuracy on running
text. Serbo-Croatian offers 49 585 accented lemmas at **more than double** that coverage, and Slovene
at 1.5×.

## Verdict — the deferral is NOT justified for sr / hr / bs, and only partly for sl

A large, human, CC-BY-SA (the licence already accepted for 30+ committed referees), stress- **and**
tone-marked source exists for all four, in the exact family the repo's pipeline already handles. The
correct statement is that no one had gone looking, not that nothing was there.

Ranking the four by what the data supports:

1. **`sr`/`hr`/`bs`** — 49 585 accented lemmas, 83–84% token coverage, both scripts, four-way tone
   recoverable. Strictly better-founded than the Afrikaans change already merged.
2. **`sl`** — 5 380 accented lemmas, 56.8% token coverage. Still ahead of `af`, but thinner, and the
   dump is name-heavy (1088 of 5795 entries are proper nouns), which is the same complaint
   `sl.jsonc`'s `secondaryGap` already makes about the wikipron referee.

## The real remaining work, stated honestly

The lexicon tier is easy and large. What is **not** solved by finding a source:

- **OOV is most of the vocabulary.** Type coverage is 17–18% (sl 8%); the 83% token figure is carried
  by frequent words. South Slavic stress is *mobile and paradigmatic* — it moves within a lemma's own
  declension — so the Afrikaans trick of deriving a prefix/suffix rule will not transfer nearly as
  well. This is the genuine difficulty, and it was always the difficulty; "no source" was never it.
- **Inflected forms mostly lack the accent.** Of 454 732 distinct forms in the sh dump, 152 636 carry
  an accented spelling (`àbdāl`, `а̀бда̄л`) and 303 134 are bare declension-table entries. The extra
  6–7pp of token coverage in the table above therefore arrives *without* stress unless the paradigm's
  accent pattern is modelled.
- **Clitics.** High-frequency function words dominate the covered tokens, and Serbo-Croatian clitics
  are prosodically unstressed in running speech while the dictionary gives them citation accents.
  Emitting a mark on every one would be wrong in a way the lexicon cannot tell us about.
- **The sh dump is unified.** Ekavian/Ijekavian and the sr/hr/bs lexical splits are not separated in
  it; a per-variety engine consuming it needs to decide what to do about that.

## Files

Dumps fetched to `/mnt/data/kaikki-Slovene.jsonl` and `/mnt/data/kaikki-SerboCroatian.jsonl`
(alongside the existing `kaikki-Chinese/Thai/Sindhi/Zhuang` dumps this repo's build tools already
read from there). Not committed — 277 MB — and the URLs above reproduce them.
