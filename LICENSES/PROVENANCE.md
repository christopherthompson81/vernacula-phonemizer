# Data provenance & licensing map

The central mapping of every data artifact in this repo to its upstream source and **parent
license**, grouped by license family. Per-file detail lives in the `*.PROVENANCE.md` sidecars and
data-file headers; this document is the index and the licensing structure.

**Posture doc:** `LICENSES/licencing_posture.md` — the project is an original work; own work is
MIT; third-party-derived data keeps its parent license, declared per file; mechanical fact tables
and (where applicable) model weights follow the facts-not-expression line (*Feist*;
*CCH Canadian* 2004 SCC 13) under the conditions stated there.

**Shipped vs tools-only:** "shipped" = under `src/`, loaded by the runtime. "tools-only" = under
`tools/` (referees, collectors, experiments); excluded from any npm package but still distributed
by the git repo itself, so the repo-level license must account for them.

---

## Current state

The repo is structured as **MIT for the code and own-work data, with fenced data files that carry
their parent licenses** (CC-BY-SA, CC-BY, CC0, and two GPL-lineage files), declared per file in
this map. The repo license (`LICENSE`, MIT), the attribution roll-up (`NOTICE.md`) and the license
texts (`LICENSES/`) are in place; what remains in §6 is the per-file declaration layer and
the packaging fence.

---

## 1. MIT-safe — public domain, CC0, and facts-determination artifacts

No obligations beyond courtesy credit (rolled into NOTICE).

| Artifact (shipped unless noted) | Upstream / basis | Status |
|---|---|---|
| `english/g2p-dict.tsv`, `accent-lexicon.tsv`, `en-g2p-tagger.int8.onnx`, `g2p-model.json` | CMUdict | Public domain |
| `english/g2p-common.txt` | CMUdict ∩ Norvig count_1w frequency ranking | PD + facts (header) |
| `danish/da-lexicon.tsv`, `da-g2p-tagger.int8.onnx` | NST Danish (Språkbanken sbr-26) | CC0 |
| `norwegian/nb-lexicon.tsv`, `nb-g2p-tagger.onnx` | NST Norwegian (Nasjonalbiblioteket) | CC0 |
| `swedish/accent-stress.tsv` | NST Swedish (abstract accent/stress features only) | CC0 |
| `persian/fa-tagger.int8.onnx`, `fa-pin-vowels.tsv` | HomoRich (MahtaFetrat, HF) | CC0 |
| `hebrew/he-tagger.int8.onnx` (majority tier) | Nakdimon pre-modern PD subset | PD (modern/wiki slice → §3) |
| `vietnamese/rhymes.tsv` | exhaustive closed-class rhyme inventory | Facts |
| `mandarin/syllable-ipa.tsv` | exhaustive pinyin-syllable inventory; row-level corroboration vs epitran (MIT) | Facts |
| `catalan/mid-vowels.tsv`, `bl-gl-geminate.tsv` | per-word Central-Catalan dictionary facts (DCVB-verifiable); one feature per word, measured with espeak-ng 1.52 over an external wordlist (§5.1) | Facts |
| `irish/lexicon.tsv` | mechanically-generated pronunciation facts over an external frequency wordlist | Facts |
| `amharic/fidel.tsv`, `tigrinya/fidel.tsv` | hand-authored Ge'ez syllabary tables | Own work |
| `french/supplement.tsv` | 3 cleanroom pronunciations for words Lexique lacks (celsius, confer, kilowatt), authored here; deliberately NOT merged into `french/lexicon.tsv`, which is CC-BY-SA (§3) — keeping them separate keeps them MIT-safe and keeps Lexique re-importable | Own work |
| tools: ASJP/Lexibank Swadesh referees (`mto`, `nog`, `smj`) | Lexibank | CC0 |
| tools: the 11 `gold-adjudicated`/`gold-freq` referees, `fa-abjad-ipa-gold.tsv`, KRNB tables | in-repo human adjudication / facts hand-read from open-access scholarship | Own work |
| `persian/fa-context-restorer.*.onnx` (text component) | Ferdowsi Shahnameh | PD (Tajik edition → §3) |

## 2. Permissive with attribution — data keeps its license; NOTICE entry required

| Artifact | Upstream | License | Obligation |
|---|---|---|---|
| `mandarin/chars.tsv`, `phrases.tsv` | pypinyin | MIT | attribution |
| `cantonese/dict.tsv` | rime-cantonese (via pycantonese) | CC-BY 4.0 | attribution |
| `bengali/bn-g2p-tagger.int8.onnx`, `bengali-lexicon.tsv` | Google language-resources/bn | CC-BY 4.0 | attribution |
| `sindhi/` lexicon Devanagari tier, `sd-g2p-tagger.int8.onnx` training data | Sindhi Open Lexicon (SindhiLanguage.org) | bespoke, permissive; **not CC-BY** (§2b) | **named attribution: Amar Fayaz Buriro (امر فياض ٻرڙو) — mandatory** |
| `hebrew/he-lexicon.tsv` builders | Phonikud + ReNikud (thewh1teagle) | CC-BY 4.0 | attribution |
| `thai/seg-words.txt` | ICU thaidict + PyThaiNLP | Unicode-DFS-2016 + CC0 | notice |
| `arabic/diacritizer.onnx` teacher | CATT (AbjadAI) | Apache-2.0 | notice |
| Chinese dict trad/simp folding (all) | OpenCC tables | Apache-2.0 | notice |
| `balochi/balochi-lexicon.tsv` | Korn 2005, Jahani & Korn 2009 (scholarly facts, hand-read) | facts | citations in header |
| tools: `ja_pitch_reference.tsv`, ja counter gold | OpenJTalk / naist-jdic | modified BSD | notice |
| tools: GE2PE referee (fa) | Sharif SLPL | MIT | attribution |
| tools: JIPA referee (`bo`), Grierson LSI (`sd`) | JIPA (Zhang 2024, open access) / lexibank-lsi | CC-BY 4.0 | attribution |
| tools: `mad.jipa-misnadin-kirby-2020.tsv` | JIPA "Madurese" (Misnadin & Kirby, doi:10.1017/S0025100318000257) | article under Cambridge terms; 35 hand-read word→IPA facts (§2b) | citation in header |
| tools: Tatoeba jpn sentences (eval) | Tatoeba | CC-BY 2.0 FR | attribution |

### 2b. Two §2 rows corrected

Both were carried as unversioned "CC-BY" until an audit on 2026-08-06:

1. **Sindhi Open Lexicon** — a bespoke license, not CC-BY. Text:
   `LICENSES/LicenseRef-SindhiOpenLexicon.txt` (no SPDX identifier exists, hence `LicenseRef-`).
   Broad, permissive, and attribution-mandatory; the named attribution to **Amar Fayaz Buriro** is in
   NOTICE. If a downstream consumer needs a standard-licensed path, the Sindhi tier can be rebuilt
   from kaikki/Wiktionary (CC-BY-SA, §3) at ~1/10 the scale.
2. **The two JIPA Illustrations differ.** Zhang 2024 (`bo`) is CC-BY-4.0; Misnadin & Kirby (`mad`,
   doi:10.1017/S0025100318000257) is under Cambridge subscription terms. Nothing verbatim is taken
   from either — the referees are per-word IPA facts, cited in their file headers, the same basis as
   Korn 2005 / Jahani & Korn 2009 for `balochi/`.

The other two resolved cleanly: Phonikud and ReNikud are **CC-BY-4.0**, lexibank-lsi is
**CC-BY-4.0**. `LICENSES/README.md` records how each was determined.

## 3. Share-alike (CC-BY-SA 3.0/4.0) — fenced under parent license

The largest stratum. Redistributable only under CC-BY-SA; fenced per file inside the MIT repo.

**Shipped lexica/tables (Wiktionary via wikipron or kaikki unless noted):**
`russian/stress.tsv` + `hard-e.tsv`; `german/{stress,length,quality,consonant,er,lexicon}.tsv`;
`gan|hakka|jin|xiang/dict.tsv`; `minnan/dict.tsv` + `dict-chars.tsv` (ChhoeTaigi 台華線頂對照典
CC-BY-SA 4.0 + iTaigi CC0 + kaikki Hokkien chars; sidecar); `thai/dictionary.tsv`;
`burmese/{dictionary.tsv,seg-words.txt,voicing-lexicon.tsv}`; `khmer/km-lexicon.tsv`;
`sindhi/sindhi-lexicon.tsv` (kaikki tier); `arabic/egyptian-lexicon.tsv`;
`urdu/{lexicon.tsv,lexicon-ipa.tsv}`; `persian/lexicon.tsv`; `pashto/lexicon.tsv`;
`punjabi/{lexicon.tsv,crossscript.tsv}`; `indonesian/indonesian-e-lexicon.tsv`;
`romanian/romanian-stress.tsv`; `welsh/lexicon.tsv`; `czech/loanwords.tsv`; `hausa/tone.tsv`;
`zulu/tone.tsv`; `akan/akan-tone.tsv`; `zhuang/sawndip-readings.tsv`;
`tagalog/stress-lexicon.tsv` + `final-glottal.txt`; `javanese/javanese-lexicon.tsv`;
`gujarati/gujarati-lexicon.tsv`; `greek/greek-synizesis.tsv`; `english-gb/en-gb-*.tsv`;
`portuguese-br/pt-br-openclose.tsv`; `portuguese/lexicon.tsv`; `korean/tensification.tsv`;
`ilocano/ilo-lexicon.tsv`; `turkish/stress.tsv` (kaikki non-final-stress mine + adjudicated
entries, per header); `afrikaans/af-stems.txt` (afwiki + OpenSubtitles + kaikki union; sidecar);
`french/lexicon.tsv` (Lexique 3.83, CC BY-SA 4.0, per header).

**Shipped Japanese data:** `japanese/pitch-accent.tsv` (kanjium CC-BY-SA voter, with BSD OpenJTalk
+ UniDic voters); `japanese/readings.tsv`, `fallback.tsv`, `adverbs.txt` (JMdict/KANJIDIC © EDRDG,
CC-BY-SA 4.0 — EDRDG requires **specific named attribution** in NOTICE).

**Shipped model weights declared CC-BY-SA-inheriting** (they reproduce licensed pronunciation
data): `languages/perso-arabic/riderDiacritizer.onnx`; `persian/fa-vowel-restorer.*.onnx`;
`persian/fa-context-restorer.*.onnx` (Tajik component); `french/fr-g2p-tagger.int8.onnx`
(Lexique). These cannot ship in an MIT-only package; they are fenced like the data.

**Models with share-alike training inputs under the training-as-use posture:**
`arabic/diacritizer.onnx` (arwiki silver), `arabic/diacritizer-egy.onnx` (arzwiki silver + MIT
dialect corpus), `hebrew/he-tagger.int8.onnx` (small modern/wiki slice), `english/pos-model.json`
(UD-EWT CC-BY-SA 4.0; sidecar). Flagged individually in NOTICE with their training-data statements.

**tools-only:** the 246-referee eval set — 120 wikipron + 53 kaikki + 15 wiktionary-API + the
CC-CEDICT check (all CC-BY-SA); 32 epitran outputs (epitran code MIT; wordlists often kaikki);
hermitdave FrequencyWords lists (CC-BY-SA), used as **filters** for the CC0 NST lexica — the
shipped intersections keep only NST content; the external ranking is the sole FrequencyWords
contribution and is not reproduced (stated in NOTICE). `fa.synth-agreement.tsv` is EVAL-ONLY
(one voter, FarsDat, has unrecorded terms — noted in `synth_referee.py`; no shipped content
derives from it and it is not wired into referee-eval).

## 4. Copyleft — fenced under GPL

Shipped files only. GPL-licensed sources that were *consulted* without shipping anything — espeak-ng
1.52, calima-egy — are in §5 and item 3 below.

1. **`arabic/diacritization.tsv`** — upstream compilation (Tashkeela) is tagged GPL-2.0; the
   underlying classical texts are PD. Shipped under the facts posture (mechanical
   frequency table; no selection/arrangement reproduced), Tashkeela credited in NOTICE with the
   posture statement. Fallback if the posture is ever revisited: regenerate from PD vocalized
   sources directly.
2. **`wu/dict.tsv`** (101k entries) — derived from rime-wugniu (GPL-3.0); distributed under a
   per-file **GPL-3.0 fence** (the TSV is its own source, satisfying the source condition). The
   engine reading it at runtime is not thereby GPL. Alternatives if a GPL data file becomes
   unwanted: rebuild from kaikki Wu readings (CC-BY-SA, gan/hakka/jin/xiang pattern, coverage
   drops to ~10–20k), or ask Wugniu for a permissive grant of the dictionary data.
3. **calima-egy (GPL-2.0)** — offline teacher for diacritizer-egy only; **not shipped**. Stated
   in NOTICE; nothing distributed derives from it.

## 5. Referee and verification sources — consulted, not shipped

Sources that shaped **what** the repo ships without contributing distributable expression **to** it.
They were read as *witnesses* — does this word exist, how is it spelled, what does an independent
transcription say — and the artifact was then authored, adjudicated or measured here. They are listed
because the determination that nothing distributable derives from them is part of this map, and
because credit is owed either way. Only the Catalan pair below leaves an artifact in `src/`, and that
one is a *measurement* taken with a tool rather than data copied from it (§5.1); everything else in
this section informed a decision and left no bytes.

| Source | License | Role |
|---|---|---|
| **espeak-ng 1.52** — `dictsource/<lang>_list`, `<lang>_extra` | GPL-3.0 | word-hole witness, coverage baseline, and the instrument behind one measured fact-table (§5.1) |
| **Wiktionary** — via wikipron, kaikki, and the MediaWiki API | CC-BY-SA 3.0/4.0 | the primary referee family: the 188 human sets in the §3 eval stratum, and the measured floor behind every language in `docs/language-maturity.md` |
| **epitran** | MIT (code); the wordlists it was run over are often kaikki | the independent *programmatic* second opinion — 32 outputs, used as a deliberately fallible corroborator, never as a target |

### 5.1 espeak-ng 1.52

The long-running fallback for the sourcing problem the normalization work kept hitting: a numeral
spelling, a letter name, or a symbol word that no in-repo referee carries. The dictsource tier is read
**as plain files** — `tools/normalization/sources.ts` reads `$ESPEAK_NG/dictsource/` directly and the
playbook's standing rule is never to invoke the binary — so nothing links against it. (The one
exception is the Catalan build below, which ran `espeak-ng -q --ipa` as a separate offline step; still
no linkage, but worth stating rather than implying a blanket rule.) Four distinct contributions:

1. **The sourcing haystack.** `sources.ts` mechanises espeak's dictsource as one tier — ranked
   *below* the FLEURS corpus and the referees — for letter-name blocks, the decimal separator
   (`_dpt` vs the punctuation mark `_.`), symbol words, and whether an ordinal/fraction series
   exists to compose from. The same tier is named in `attest.ts`, `concept.ts`, `review.ts` and the
   60 `tools/corpus/attest/*.jsonc` headers.
2. **Word holes closed.** Where a language's corpus and referees were both silent, espeak was often
   the single witness that settled a spelling — letter names for the initialism pass, currency and
   unit words, `%`, `×`, `÷`, `<`, `>`, `&`, and the vulgar fractions.
3. **Negative evidence, which mattered as much.** "espeak ships no Zulu and no Xhosa at all" is what
   *closes* a sourcing question rather than leaving it open; several deliberate no-word-emitted
   decisions rest on the haystack being provably empty, and espeak is one of the tiers that makes
   that provable.
4. **Coverage baseline.** The `espeak` column in `tools/language-catalogue/catalogue.tsv` (1 = a
   voice exists, 0 = none) is one of the inputs to picking the next language.

**It is a witness, never an oracle**, and that was measured rather than assumed: espeak is phonetic
and cannot hand over orthography, so every spelling derived from it was round-tripped through this
repo's own g2p and matched against an independent referee where one existed. The Punjabi 61–99 run
built exactly that pipeline for the 39 numerals its referee lacked, then validated it against the 36
the referee *does* carry — **8 of 36 (22%) were espeak being wrong about the word**, and the 39 were
not shipped on that basis. The method and the measurement are in
`docs/normalization_playbook.md` §5c. What ships is the adjudicated word — a linguistic fact. No
dictsource rules, phoneme tables, or arrangement are reproduced.

#### The Catalan tables

`catalan/mid-vowels.tsv` and `bl-gl-geminate.tsv` (§1) are the only shipped files espeak touched, built
by `tools/gen/build-ca-midvowels.mts` / `build-ca-geminate.mts`. How, because the mechanics are the
provenance:

- **The word list is external** — a 50k frequency wordlist, charset-filtered. espeak contributed no
  words and chose no row of either table.
- **espeak was the instrument** — run over that list as a measuring device: word in, IPA out.
- **One bit per word survives.** `build-ca-midvowels.mts` reads the single character after the stress
  mark and flags `e`/`o`; `build-ca-geminate.mts` is one regex reduced to a boolean. Neither retains an
  IPA string.
- **Only deviations are stored** — the engine defaults to open (ɛ/ɔ), so the tables are the complement
  of the rule, not a lexicon.

No espeak source, rules, dictionary or arrangement is present in `word<TAB>e`, and any correct source
would produce the same table: the mid-vowel height of *dona* vs *dóna* is a Central Catalan dictionary
fact (DCVB/GDLC-verifiable). Shipped under the facts posture; espeak-ng credited in NOTICE.

What does depend on espeak is its *mistakes* — a wrong 1.52 reading is a wrong bit. That is a quality
dependency, falsifiable row by row against DCVB/GDLC, which is also the regeneration path if the table
is ever re-sourced without espeak.

⚠ **Open item:** the 50k Catalan frequency wordlist is the only other upstream touching these tables
and its provenance is not pinned down here (it lives outside this repo). If it is a Wikipedia-dump
ranking or a hermitdave FrequencyWords list it is CC-BY-SA, and the *selection* needs §3 treatment even
though the per-word values do not.

`irish/lexicon.tsv` and the Welsh bootstrap are **not** espeak 1.52 derivatives despite the surface
similarity — both come from the author's own repaired engines.

### 5.2 Wiktionary and epitran

Both already appear in this map as *shipped* data where their content is redistributed —
Wiktionary-derived lexica are the §3 share-alike stratum, and the eval referee sets are fenced there
too. They are repeated here for the role that fencing doesn't capture: they are the reason any
quality claim in this repo is falsifiable. wikipron and kaikki supply the human transcriptions each
engine is scored against; epitran supplies a *mechanically independent* second opinion whose
disagreements are treated as candidates to adjudicate, not as bugs. A language with neither is
recorded as `🔷 single-source` or `⛔ cannot-verify` in `docs/language-maturity.md` rather than
quietly reported as fine — an evidence verdict those two sources define the boundary of.
Attribution is owed under CC-BY-SA regardless of whether a given use shipped bytes.

## 6. License architecture (to implement at publication)

1. **Repo license: MIT** — ✅ `LICENSE` at the repo root, and `license: "MIT"` in package.json.
   Covers all code, jsonc manifests, hand-authored tables, in-repo gold referees, and the §1
   artifacts; the default for everything not fenced.
2. **License texts** — ✅ `LICENSES/`, SPDX-named verbatim copies of all ten licenses this
   repo is obligated under, with their sourcing recorded in that folder's README. **Still to do:** the
   per-file declarations that key off them — REUSE convention (SPDX headers or a `.reuse/dep5`
   manifest) mapping every §2/§3/§4 artifact to its license. Fences are directories where possible
   (`tools/referee-eval/referees/` is one line). The texts are already at the top-level `LICENSES/`
   path REUSE expects — but that directory also holds `PROVENANCE.md`, `licencing_posture.md` and
   `README.md`, which `reuse lint` would flag as non-license files. Move those out if REUSE
   compliance is ever wanted; nothing else depends on their location.
3. **NOTICE** — ✅ `NOTICE.md`. Attribution roll-up: CMUdict, NST/Språkbanken, HomoRich, Google
   language-resources, rime-cantonese, rime-wugniu, pypinyin, OpenCC, OpenJTalk/naist-jdic,
   kanjium, EDRDG (their required wording), Wiktionary/wikipron/kaikki, ChhoeTaigi (台華線頂對照典
   / iTaigi), Lexique (New & Pallier), Tashkeela (+posture statement), CATT, Phonikud/ReNikud,
   Nakdimon, Sharif GE2PE, Lexibank/ASJP, **Amar Fayaz Buriro / SindhiLanguage.org** (named,
   mandatory), Toulmin/Wilde/Saksena/Grierson citations, and the §5 referee sources —
   **espeak-ng** (+posture statement, per §5.1) and **epitran**.
4. **Package fencing** — ✅ `package.json` `files: ["src", "LICENSES", "NOTICE.md"]`, so the package
   ships `src/` plus the licensing files and nothing else: 2193 files / 253 MB → 884 / 148 MB, with
   `docs/`, `tools/` and `test/` all at zero. The published set now equals the tracked set exactly.
   Note a `files` allowlist **overrides `.gitignore`**, so each gitignored `src/` intermediate is
   restated as a `!` negation; `test/packaging.test.ts` keeps the two lists in step.
   **Still to do:** a `--permissive` build profile excluding §3/§4-fenced data files (engines fall
   back to rules/taggers), mechanically derivable from this map if a fully-MIT distributable is ever
   wanted.

---
*Maintenance rules: any new data file or model lands with a `*.PROVENANCE.md` or a header naming
source + license, plus a row here. This map describes the CURRENT state only — resolved questions
are removed, not narrated; history lives in git.*
