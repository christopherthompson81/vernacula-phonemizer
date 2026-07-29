# Data provenance & licensing map

The central mapping of every data artifact in this repo to its upstream source and **parent
license**, grouped by license family. Per-file detail lives in the `*.PROVENANCE.md` sidecars and
data-file headers; this document is the index and the licensing structure.

**Posture doc:** `docs/adr/0001-data-licensing-facts-posture.md` — the project is an original
work (not an espeak derivative); own work is MIT; third-party-derived data keeps its parent
license, declared per file; mechanical fact tables and (where applicable) model weights follow
the facts-not-expression line (*Feist*; *CCH Canadian* 2004 SCC 13) under the conditions stated
there. Older provenance files' "ADR-0014" citations resolve to ADR-0001.

**Shipped vs tools-only:** "shipped" = under `src/`, loaded by the runtime. "tools-only" = under
`tools/` (referees, collectors, experiments); excluded from any npm package but still distributed
by the git repo itself, so the repo-level license must account for them.

---

## Current state

The repo is structured as **MIT for the code and own-work data, with fenced data files that carry
their parent licenses** (CC-BY-SA, CC-BY, CC0, and two GPL-lineage files), declared per file in
this map. Remaining pre-publication work is §5 — the license-file architecture itself.

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
| `vietnamese/rhymes.tsv` | exhaustive closed-class rhyme inventory | Facts (ADR-0001) |
| `mandarin/syllable-ipa.tsv` | exhaustive pinyin-syllable inventory; row-level corroboration vs epitran (MIT) | Facts (ADR-0001) |
| `catalan/mid-vowels.tsv`, `bl-gl-geminate.tsv` | per-word Central-Catalan dictionary facts (DCVB-verifiable; own word selection) | Facts (ADR-0001; sidecar) |
| `irish/lexicon.tsv` | mechanically-generated pronunciation facts over an external frequency wordlist (owner determination in header: not an espeak-1.52 derivative) | Facts (ADR-0001) |
| `amharic/fidel.tsv`, `tigrinya/fidel.tsv` | hand-authored Ge'ez syllabary tables | Own work |
| tools: ASJP/Lexibank Swadesh referees (`mto`, `nog`, `smj`) | Lexibank | CC0 |
| tools: the 11 `gold-adjudicated`/`gold-freq` referees, `fa-abjad-ipa-gold.tsv`, KRNB tables | in-repo human adjudication / facts hand-read from open-access scholarship | Own work |
| `persian/fa-context-restorer.*.onnx` (text component) | Ferdowsi Shahnameh | PD (Tajik edition → §3) |

## 2. Permissive with attribution — data keeps its license; NOTICE entry required

| Artifact | Upstream | License | Obligation |
|---|---|---|---|
| `mandarin/chars.tsv`, `phrases.tsv` | pypinyin | MIT | attribution |
| `cantonese/dict.tsv` | rime-cantonese (via pycantonese) | CC-BY 4.0 | attribution |
| `bengali/bn-g2p-tagger.int8.onnx`, `bengali-lexicon.tsv` | Google language-resources/bn | CC-BY 4.0 | attribution |
| `sindhi/` lexicon Devanagari tier, `sd-g2p-tagger.int8.onnx` training data | Sindhi Open Lexicon (SindhiLanguage.org) | CC-BY | **named attribution: Amar Fayaz Buriro (امر فياض ٻرڙو) — mandatory** |
| `hebrew/he-lexicon.tsv` builders | Phonikud + ReNikud (thewh1teagle) | CC-BY | attribution |
| `thai/seg-words.txt` | ICU thaidict + PyThaiNLP | Unicode-DFS-2016 + CC0 | notice |
| `arabic/diacritizer.onnx` teacher | CATT (AbjadAI) | Apache-2.0 | notice |
| Chinese dict trad/simp folding (all) | OpenCC tables | Apache-2.0 | notice |
| `balochi/balochi-lexicon.tsv` | Korn 2005, Jahani & Korn 2009 (scholarly facts, hand-read) | facts | citations in header |
| tools: `ja_pitch_reference.tsv`, ja counter gold | OpenJTalk / naist-jdic | modified BSD | notice |
| tools: GE2PE referee (fa) | Sharif SLPL | MIT | attribution |
| tools: JIPA referees (`bo`, `mad`), Grierson LSI (`sd`) | JIPA / lexibank-lsi | CC-BY | attribution |
| tools: Tatoeba jpn sentences (eval) | Tatoeba | CC-BY 2.0 FR | attribution |

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

**Models with share-alike training inputs under the training-as-use posture (ADR-0001):**
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

1. **`arabic/diacritization.tsv`** — upstream compilation (Tashkeela) is tagged GPL-2.0; the
   underlying classical texts are PD. Shipped under the ADR-0001 facts posture (mechanical
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

## 5. License architecture (to implement at publication)

1. **Repo license: MIT** — covers all code, jsonc manifests, hand-authored tables, in-repo gold
   referees, and the §1 artifacts; the default for everything not fenced.
2. **`LICENSES/` + per-file declarations** — REUSE convention (SPDX headers or a `.reuse/dep5`
   manifest) mapping every §2/§3/§4 artifact to its license, keyed off this document. Fences are
   directories where possible (`tools/referee-eval/referees/` is one line).
3. **NOTICE** — attribution roll-up: CMUdict, NST/Språkbanken, HomoRich, Google
   language-resources, rime-cantonese, rime-wugniu, pypinyin, OpenCC, OpenJTalk/naist-jdic,
   kanjium, EDRDG (their required wording), Wiktionary/wikipron/kaikki, ChhoeTaigi (台華線頂對照典
   / iTaigi), Lexique (New & Pallier), Tashkeela (+posture statement), CATT, Phonikud/ReNikud,
   Nakdimon, Sharif GE2PE, Lexibank/ASJP, **Amar Fayaz Buriro / SindhiLanguage.org** (named,
   mandatory), Toulmin/Wilde/Saksena/Grierson citations.
4. **Package fencing** — the npm/dist package ships `src/` only; a `--permissive` build profile
   that excludes §3/§4-fenced data files (engines fall back to rules/taggers) is mechanically
   derivable from this map if a fully-MIT distributable is ever wanted.

---
*Maintenance rules: any new data file or model lands with a `*.PROVENANCE.md` or a header naming
source + license, plus a row here. This map describes the CURRENT state only — resolved questions
are removed, not narrated; history lives in git and the investigation docs.*
