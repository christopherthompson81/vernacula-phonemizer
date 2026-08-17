# NOTICE

`vernacula-phonemizer` is licensed **MIT** (see [`LICENSE`](LICENSE)). The engine, the per-language rule
modules and `.jsonc` manifests, the hand-authored tables, the in-repo gold referees, and the tools
are the project's own work.

It also ships and distributes **data derived from third-party sources**, each of which keeps its own
parent license. Those files are fenced per file; this NOTICE is the attribution roll-up. The
authoritative per-artifact map — which file, which upstream, which license — is
[`LICENSES/PROVENANCE.md`](LICENSES/PROVENANCE.md), and the reasoning behind the facts-based
determinations is [`LICENSES/licencing_posture.md`](LICENSES/licencing_posture.md). Section numbers
below refer to that map. The full text of every license named here is in
[`LICENSES/`](LICENSES/).

Good-Faith Notice: If you are a rights holder and believe that your content has been included in the
data and wish to request its exclusion, please contact me. Reasonable efforts will be made to review
and address such requests.

---

## Attributions required by name

Two upstreams require specific, named acknowledgement. These are obligations, not courtesies.

**Electronic Dictionary Research and Development Group (EDRDG) — JMdict / KANJIDIC**

> This package uses the JMdict/EDICT and KANJIDIC dictionary files. These files are the property of
> the Electronic Dictionary Research and Development Group, and are used in conformance with the
> Group's licence.

Affects `src/languages/japanese/readings.tsv`, `fallback.tsv`, `adverbs.txt`. JMdict/KANJIDIC are
© EDRDG, CC-BY-SA 4.0. <https://www.edrdg.org/edrdg/licence.html>

**Sindhi Open Lexicon — Amar Fayaz Buriro (امر فياض ٻرڙو)**

The Sindhi Open Lexicon is the work of **Amar Fayaz Buriro**, published via SindhiLanguage.org.
Named attribution is mandatory under the dataset's own terms — a bespoke, permissive license, not
CC-BY: `LICENSES/LicenseRef-SindhiOpenLexicon.txt`. Affects the Devanagari tier of
`src/languages/sindhi/sindhi-lexicon.tsv` and the training data behind
`src/languages/sindhi/sd-g2p-tagger.int8.onnx`.

---

## Public domain and CC0 (§1)

Used without obligation beyond the credit given here.

- **The CMU Pronouncing Dictionary (CMUdict)** — Carnegie Mellon University. Behind
  `english/g2p-dict.tsv`, `accent-lexicon.tsv`, `g2p-common.txt`, and the English G2P models.
- **Peter Norvig, `count_1w`** (<https://norvig.com/ngrams/>), from the Google Web Trillion Word
  Corpus — the frequency ranking in `english/g2p-common.txt`. Membership only; no counts reproduced.
- **NST pronunciation lexica** — Nasjonalbiblioteket / Språkbanken, CC0. Danish (`sbr-26`), Norwegian
  (`no.leksikon`), Swedish. Behind `danish/da-lexicon.tsv`, `norwegian/nb-lexicon.tsv`,
  `swedish/accent-stress.tsv` and their taggers.
- **HomoRich** — MahtaFetrat, CC0. Behind `persian/fa-tagger.int8.onnx`, `fa-pin-vowels.tsv`.
- **Nakdimon** — Elazar Gershuni (`elazarg/nakdimon`), MIT; the pre-modern public-domain subset of
  the `hebrew_diacritized` collection. Behind `hebrew/he-tagger.int8.onnx`.
- **Lexibank / ASJP** — CC0. Swadesh referees for `mto`, `nog`, `smj`.
- **PyThaiNLP** — CC0. Part of `thai/seg-words.txt`.
- **iTaigi 華台對照典** — CC0. One component of `minnan/dict.tsv`.
- **Ferdowsi, *Shahnameh*** — public domain (d. 1020). Text component of
  `persian/fa-context-restorer.*.onnx`.

## Permissive, attribution required (§2)

- **pypinyin** — MIT. `mandarin/chars.tsv`, `phrases.tsv`.
- **rime-cantonese**, via **pycantonese** — CC-BY 4.0. `cantonese/dict.tsv`.
- **Google `language-resources/bn`** (<https://github.com/google/language-resources>) — CC-BY 4.0.
  `bengali/bengali-lexicon.tsv`, `bn-g2p-tagger.int8.onnx`.
- **Google `language-resources/km`** (<https://github.com/google/language-resources>) — CC-BY 4.0,
  "Copyright 2018 Google Inc." `khmer/km-lexicon-dict.tsv` (the second lexicon tier) and
  `tools/referee-eval/referees/km.google-lexicon.tsv` (the secondary referee), both converted to this
  project's IPA; the readings are Google's.
- **Google FLEURS** (<https://huggingface.co/datasets/google/fleurs>) — CC-BY 4.0. Transcript-derived
  word frequencies in `tools/referee-eval/freq/pa.txt`; audio used measurement-only (never shipped).
- **Phonikud** and **ReNikud** — thewh1teagle, CC-BY 4.0. Builders behind `hebrew/he-lexicon.tsv`.
- **ICU `thaidict`** — Unicode, Inc., Unicode-DFS-2016. Part of `thai/seg-words.txt`.
  Text: `LICENSES/Unicode-DFS-2016.txt`.
- **CATT — Character-based Arabic Tashkeel Transformer** — AbjadAI, Apache-2.0
  (arXiv:2407.03236). Offline teacher for `arabic/diacritizer.onnx`.
- **OpenCC** — Apache-2.0. `TSCharacters` / `STCharacters` tables, used for the
  traditional↔simplified folding in every Chinese dictionary.
- **OpenJTalk / naist-jdic** — modified BSD. `tools/eval/ja_pitch_reference.tsv`, the Japanese
  counter gold, and one voter in `japanese/pitch-accent.tsv`.
- **GE2PE** and the Persian homograph sets — Sharif SLPL, MIT. Persian referees (tools only).
- **JIPA** — Zhang (2024), "Central Tibetan (Lhasa)", *J. Int. Phonetic Assoc.* 54:788–810,
  CC-BY 4.0 (open access). The `bo` referee, tools only.
- **lexibank-lsi** — Grierson, *Linguistic Survey of India*, CC-BY 4.0. The `sd` referee, tools only.
- **Misnadin & Kirby** (2020), "Madurese", *J. Int. Phonetic Assoc.* 50:109–126,
  doi:10.1017/S0025100318000257. The `mad` referee — 35 hand-read word→IPA facts.
- **Tatoeba** — CC BY 2.0 FR. Japanese evaluation sentences, tools only. The FR port has no
  plain-text form; referenced by URI as CC permits:
  <https://creativecommons.org/licenses/by/2.0/fr/legalcode>
- **arabic-dialect-corpus** — dataflare, MIT. Egyptian subset used in `arabic/diacritizer-egy.onnx`
  training.

## Share-alike — CC-BY-SA 3.0 / 4.0 (§3)

These files are **redistributable only under CC-BY-SA**, and are fenced as such inside the MIT repo.

- **Wiktionary**, via **wikipron**, **kaikki.org**, and the MediaWiki API — CC-BY-SA 3.0/4.0.
  The single largest upstream: the shipped lexica and stress/tone/quality tables listed in §3, and
  the 188 Wiktionary-family referee sets in the evaluation harness.
  <https://en.wiktionary.org>
- **Wikipedia** dumps — CC-BY-SA. Training text for `arabic/diacritizer.onnx` (arwiki) and
  `arabic/diacritizer-egy.onnx` (arzwiki); the stem union in `afrikaans/af-stems.txt` (afwiki); the
  mined attestation corpora under `tools/corpus/`.
- **kanjium** — CC-BY-SA. The consensus voter in `japanese/pitch-accent.tsv`.
- **JMdict / KANJIDIC** — © EDRDG, CC-BY-SA 4.0. See the named attribution above.
- **Lexique 3.83** — Boris New & Christophe Pallier, CC-BY-SA 4.0, via openlexicon.
  `french/lexicon.tsv` and `french/fr-g2p-tagger.int8.onnx`. <http://www.lexique.org>
- **RCRL Afrikaans Pronunciation Dictionary v1.4.1** — © 2010 Centre for Text Technology (CTexT),
  North-West University, South Africa; redistributed via `ttslab/za_lex` `data/afr`, © 2016 The
  Department of Arts and Culture, Government of the Republic of South Africa (Multilingual Speech
  Technologies, NWU). **CC BY-SA 2.5 South Africa** <http://creativecommons.org/licenses/by/2.5/za/>.
  Also the training input (with NCHLT above) for the shipped model weights
  `src/languages/afrikaans/af-g2p-tagger.int8.onnx`, which are declared CC-BY-SA-inheriting.
  Two artifacts: the SHIPPED pronunciation lexicon `src/languages/afrikaans/af-rcrl-lexicon.tsv`
  (25,112 entries) and the `af` secondary eval referee
  `tools/referee-eval/referees/af.rcrl-apd.tsv`. Each carries a PROVENANCE sidecar.
- **NCHLT-inlang Pronunciation Dictionaries** — Department of Arts and Culture (DAC), CSIR and
  North-West University, South Africa. **CC BY 3.0** <http://creativecommons.org/licenses/by/3.0/>.
  Afrikaans set cited as W. D. Basson & M. H. Davel, *Category-Based Phoneme-to-Grapheme
  Transliteration*, Interspeech 2013. Tools-only training data for `af-g2p-tagger.int8.onnx`
  (`tools/afrikaans/nchlt_afr.dict`).
- **ChhoeTaigi 台華線頂對照典** — CC-BY-SA 4.0. `minnan/dict.tsv`, `dict-chars.tsv`.
- **CC-CEDICT** — CC-BY-SA. Cross-check only, tools.
- **Universal Dependencies English-EWT** — CC-BY-SA 4.0. Training data for
  `english/pos-model.json`.
- **hermitdave FrequencyWords** — CC-BY-SA, derived from the **OpenSubtitles 2018** corpus
  (<https://opus.nlpl.eu/OpenSubtitles>). Used as a **filter** over the CC0 NST lexica, where the
  shipped intersections retain only NST content and the external ranking is FrequencyWords' sole
  contribution there, and as one input tier to `afrikaans/af-stems.txt`, which does inherit CC-BY-SA.
  ⚠ The ranking IS reproduced verbatim in the tools-only frequency lists
  `tools/referee-eval/freq/nb.txt`, `freq/af.txt` and `freq/ur.txt` (word+count pairs, attributed in
  each file header and in `freq/README.md`). This entry previously said it was not reproduced
  anywhere; that stopped being true when nb.txt landed, and this list must be extended whenever a
  new `freq/<lang>.txt` lands — af.txt and ur.txt each had to be added after the fact.
  Ranking data only — no pronunciation content.
- **Tajik Shahnameh corpus** — CC-BY-SA. Tajik component of `persian/fa-context-restorer.*.onnx`.

Model weights that reproduce licensed pronunciation data are declared CC-BY-SA-inheriting and fenced
with the data: `perso-arabic/riderDiacritizer.onnx`, `persian/fa-vowel-restorer.*.onnx`,
`persian/fa-context-restorer.*.onnx` (Tajik component), `french/fr-g2p-tagger.int8.onnx`.

## Copyleft — GPL-fenced (§4)

- **rime-wugniu** — GPL-3.0. `wu/dict.tsv` (101k entries) is a derived work and is distributed under
  a **per-file GPL-3.0 fence**; the TSV is its own source, satisfying the source condition. The
  engine that reads it at runtime is not thereby GPL.
  <https://github.com/rime/rime-wugniu>
- **espeak-ng** (`dictsource/ps_list`, credited in its own header to **Hanif Rahman**, updated April
  2025) — GPL-3.0. `pashto/lexicon.tsv` (14,021 rows) is a derived work and is distributed under a
  **per-file GPL-3.0 fence**; the engine that reads it at runtime is not thereby GPL. ⚠ What derives
  from it is the SHORT-VOWEL PLACEMENT only — espeak's phoneme strings are never copied; each is fed
  to a g2p-inversion search that stores the diacritized *spelling* whose reading our own engine
  reproduces, so the consonants are ours. espeak-ng is otherwise consulted-not-shipped throughout
  this repo (§5); Pashto is the single exception.
  <https://github.com/espeak-ng/espeak-ng>
- **Tashkeela** — GPL-2.0. `arabic/diacritization.tsv` is a mechanical frequency aggregation over
  the Tashkeela corpus, whose underlying classical texts are public domain. It ships under the
  facts-not-expression posture stated in `LICENSES/licencing_posture.md`: the artifact reproduces
  no selection or arrangement from the corpus, only the dominant vocalization of each wordform.
  Tashkeela is credited here regardless of that determination.
  <https://sourceforge.net/projects/tashkeela/>
- **CAMeL Tools / `calima-egy`** — the morphology database is GPL-2.0 (NYU Abu Dhabi; Habash et al.).
  Used **offline only**, as a silver-labelling teacher for `arabic/diacritizer-egy.onnx`. Not
  shipped, not linked, and nothing distributed derives from it.

## Referee and verification sources (§5)

Consulted as witnesses and measuring instruments rather than copied. Credited because the work
depended on them.

- **espeak-ng 1.52** — GPL-3.0. The long-running fallback witness for numeral spellings, letter
  names, and symbol words that no in-repo referee carried, read from `dictsource/` as plain files;
  and the coverage baseline in the language catalogue. Its negative evidence — recording that a
  language ships no voice at all — closed as many sourcing questions as its positive entries.
  It is also the **instrument** behind `catalan/mid-vowels.tsv` and `bl-gl-geminate.tsv`: run over an
  externally-chosen frequency wordlist, one abstract feature per word retained (§5.1).
  <https://github.com/espeak-ng/espeak-ng>
- **epitran** — MIT (David R. Mortensen et al., CMU). The independent programmatic second opinion
  across 32 languages, and row-level corroboration for `mandarin/syllable-ipa.tsv`.
  <https://github.com/dmort27/epitran>
- **wikipron** — CUNY (Kyle Gorman et al.). The scrape through which most Wiktionary human
  transcriptions reached this project. <https://github.com/CUNY-CL/wikipron>
- **kaikki.org** — Tatu Ylonen. Machine-readable Wiktionary extracts.

## Published scholarship

Languages without a machine referee are anchored on published descriptive phonology, hand-read and
cited per file. With thanks to:

Allen, *Vox Latina* (Classical Latin) · Cox, *Kirundi & Kinyarwanda Comparative Grammar* · Crawford
(Bhojpuri) · Dickins (Sudanese Arabic) · Elert and Engstrand (Swedish) · Emenanjo 1978 and Green &
Igwe 1963 (Igbo) · Grierson, *Linguistic Survey of India* · Hayes and Pandey (syllable weight) ·
Jahani & Korn 2009, Korn 2005 (Balochi) · Kristoffersen, *The Phonology of Norwegian* · Meeuwis 2020,
*A Grammatical Overview of Lingála* · Montgomery-Anderson, *Cherokee: A Reference Grammar of
Oklahoma* · Ohala 1983 (Indic schwa deletion) · Ó Siadhail (Irish) · Saksena, *The Evolution of
Awadhi* · Svantesson et al. 2005, *The Phonology of Mongolian* · Toulmin 2006 (KRNB / Rangpuri) ·
Tucker 1994 (Dholuo) · Wilde (Rangpuri) · Ylikoski (Lule Sámi).

---

*This file is generated from `LICENSES/PROVENANCE.md` by hand and must be updated with it. Any new
data file or model lands with a `*.PROVENANCE.md` sidecar or a header naming source and license, a
row in the provenance map, and — where attribution is owed — an entry here.*
