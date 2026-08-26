# `pfs.tsv` provenance — Pha̍k-fa-sṳ → Meixian IPA (hak)

Pha̍k-fa-sṳ (the missionary romanization of Hakka) → Meixian Sinological-IPA, **3,536 keys**: 1,279
single-syllable keys + 2,257 multi-syllable WORD keys. Read by `pfs.ts`, which is the Latin arm of the `hak`
engine.

## Why this file exists

**hak.wikipedia is not written in Han.** Measured over the uniform-stride sample tier of
`tools/corpus/mined/hak.jsonc` — so this is that wiki's real distribution — **93.5% of the characters are
Latin**. Before this file, `registry.ts` routed every Latin run to the English phonemizer, so the language's
own encyclopedia read as English:

```
Pak-khô-chhiòn-sû he tui Ngìn-lui …  →  pʰˈæk khˈoᶷ kʃˈʌn sˈuː hˈiː t͡ʃˈʌwɪ nd͡ʒˈɪn lˈuːɪ …
```

## Source, and why it could be derived rather than hand-authored

The same **kaikki.org** extract of Wiktionary Chinese (`kaikki-Chinese.jsonl`, 1.18 GB) that `dict.tsv` comes
from carries, for **6,269 headwords, BOTH** a Pha̍k-fa-sṳ spelling and a Meixian Sinological-IPA reading.
That is a parallel corpus of exactly the two things a romanization front end needs. **4,754 of them align
syllable for syllable**, and the alignment has a free third opinion: a Han headword is one character per
syllable, so PFS-hyphens, IPA-spaces and headword-length must all agree. 5 rows where kaikki's two fields
disagree are rejected by that test.

```
npx tsx tools/gen/build-hak-pfs.mts --kaikki <kaikki-Chinese.jsonl> --report --validate
```

⚠ **The source is NOT committed** (1.18 GB). The invocation above is the record; the builder is deterministic
(ties in the majority vote break on the string).

## It is a dialect translation, deliberately

Wiktionary tags the PFS spelling **Sixian** (the Taiwan standard); this engine is **Meixian**. Pairing them
maps the SPELLING onto THIS ENGINE'S dialect rather than importing a second phonology — 西 is `sî`, Sixian
/si²⁴/, Meixian /ɕi⁴⁴/, and this table emits the Meixian form. One language, one phonology. The alternative
(PFS → Sixian IPA) would have made `hak` emit two dialects depending on which script a sentence happened to
be in, which is the defect rather than the fix.

Regional sub-variants (`Miaoli`, `Neipu`, `Zhudong`, `Hailu`) are excluded: they are a narrower accent than
the plain entry, and mixing them would pair one town's spelling with another town's phonology.

## Format

`<pfs-key>\t<syllable …>`, identical to `dict.tsv`, so the **same** `readingToIpa` renders both paths and
there is one tone-rendering code path in the language rather than two.

- **Word keys** (`hak-kâ`) keep the `underlying⁻surface` **sandhi arrow**. They exist for that reason alone:
  the Han path gets word-internal sandhi from multi-character dict entries, and without word keys the
  romanized path would silently lose it. `Hak-kâ-ngìn` and 客家人 now produce byte-identical IPA,
  `hak̚˩ ka˧˥ ŋin˩˩`, sandhi included.
- **Syllable keys** collapse the arrow to the underlying tone — a syllable read alone is a citation form.
  Collapsing also removes most apparent ambiguity: 498 of 1,279 syllables look ambiguous raw, 324 do
  collapsed, and the majority reading covers 90.6% of attestations.

## The tone system is derived, not assumed

Cross-tabulating the PFS diacritic (plus whether the syllable ends in a stop coda) against the paired Meixian
tone over every aligned syllable reproduces the six-tone system, which is the check that the pairing is sound
at all. Token-weighted over the aligned pairs:

| PFS | coda | Meixian | category | purity |
|---|---|---|---|---|
| â (circumflex) | open | ⁴⁴ | 陰平 | 1679/1742 = 96.4% |
| a (unmarked) | open | ⁵³ | 去聲 | 1534/1613 = 95.1% |
| à (grave) | open | ¹¹ | 陽平 | 1385/1418 = 97.7% |
| á (acute) | open | ³¹ | 上聲 | 1066/1119 = 95.3% |
| a (unmarked) | -p -t -k | ¹ | 陰入 | 688/711 = 96.8% |
| a̍ (vertical line) | -p -t -k | ⁵ | 陽入 | 376/391 = 96.2% |

⚠ ⟨ṳ⟩ is **U+0324 COMBINING DIAERESIS BELOW — a VOWEL letter, not a tone mark.** It co-occurs with all six,
and its sub-rows reproduce the same table; that is how it was confirmed rather than assumed.

## Accuracy, including the parts that are not good

**Corpus coverage** — over the 244,332 Latin word tokens of the hak.wikipedia dump:

| | tokens | share |
|---|---|---|
| read as Hakka | 218,370 | **89.4%** |
|  …every syllable attested in this table | 206,544 | 84.5% |
|  …needed the compositional fallback | 11,826 | 4.8% |
| routed to the foreign reader | 25,962 | 10.6% |

The 10.6% is what it should be: `Nobel`, `Castilla`, `León`, `Aragon`, `iPhone`, `Olympic`, `Zaragoza`,
`Ireland`, quoted English (`of`, `and`, `new`) and stray single letters.

**The compositional fallback is 81.7% exact**, measured held-out (`--validate` removes each attested syllable
from the table, composes it against the remaining 1,278, and compares against its own reading). Roughly one
composed syllable in five is wrong. It ships anyway, and the arithmetic is the argument: composition covers
4.8% of Latin word tokens, so it leaves ~0.9% of them imperfect against 100% of them wrong without it.

⚠ **Two flattering versions of that measurement were rejected.** Scoring the fallback on the syllables kaikki
happens to LACK gives **8.9%** — those are the rare words where the Han dict most often carries a different
sense, so the comparison is not measuring composition. An early ad-hoc probe that skipped the reader's own
≤2-letter refusal gave **83.9%**. Only the held-out run through the shipped code is the number.

**Cross-path agreement** — the Han path and the PFS path are separate artifacts and separate code, so where
a word exists in both they can be compared. Over the 17,740 Han↔PFS pairs kaikki supplies:

- 81.9% produce identical IPA, restricted to rows where the Han path did not silently drop a character
  (its own 7.9% coverage gap; those rows compare a 3-syllable reading against a 2-syllable one and can never
  agree).
- 71.0% unrestricted.
- The residual is dominated by **homographs** — a Han character with several readings, where the two paths
  independently pick different senses (車 is `chhâ` "vehicle" and `kî` "chariot/chess piece") — and by
  sandhi present on one side only. It is not a measure of the front end alone and is recorded as such.

## The majority vote is onset-aware

A plain majority left **30 of the 1,279 syllable rows carrying an IPA that contradicted their own PFS
onset** — `khin → in⁵³` with the /kʰ/ simply gone, `hô → keu⁵³`, `liá → t͡se³¹`. Those come from headwords
whose two kaikki fields describe different senses, and a plain vote cannot see it. The builder now prefers
the most-attested reading that AGREES with the onset the spelling declares, falling back to the plain
majority when none agrees.

⚠ **It falls back rather than drops, because some contradictions are real Hakka.** ⟨n⟩~⟨l⟩ genuinely
alternate in this language (`nang → laŋ`, `nân → lan`) and ⟨chh⟩ before a front vowel surfaces as /ɕ/ in
Meixian (`chhià → ɕia`). Filtering every disagreement would have deleted those. 24 rows remain, each a
single-attestation row where no candidate agrees; they are left as the data has them.

## Known limits

- **No cross-word sandhi.** Word-internal sandhi comes from the word keys; a sandhi domain spanning two
  orthographic words is not modelled — and is not modelled on the Han path either, so the two agree.
- **No disambiguation by sense.** An ambiguous syllable takes its more attested reading.
- **⟨ts⟩/⟨tsh⟩ are folded to ⟨ch⟩/⟨chh⟩** — part of the wiki spells the affricates that way (5,230 syllable
  tokens) and folding gains 1.2 points. ⟨j⟩ is deliberately NOT folded: the same test gained 0.1, and the
  instances are `jawa`, `john`, `james`, `azerbaijan` — foreign names, not a variant spelling.

## License

Wiktionary content is CC-BY-SA 3.0; the kaikki extract is a mechanical redistribution of it. This derived
table is distributed on the same terms as `dict.tsv`, which shares its source.
