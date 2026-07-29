# Data provenance & licensing map

The central mapping of every data artifact in this repo to its upstream source and **parent
license**, grouped by license family — the pre-publication audit. Compiled 2026-07-29 from the 22
per-file `*.PROVENANCE.md` files, data-file headers, `tools/` collector scripts, and the per-language
bringup investigation docs. Per-file provenance stays where it is; this document is the index and
the licensing verdict.

**Posture doc:** `docs/adr/0001-data-licensing-facts-posture.md` — this repo's NATIVE licensing
ADR (2026-07-29): the project is an original work (not an espeak derivative); own work MIT;
third-party data fenced per this map; the facts-not-expression line (*Feist*; *CCH Canadian*
2004 SCC 13) stated with its conditions. Older provenance files' "ADR-0014" citations refer to
the espeak-ng-portable ADR where the analysis was first developed; they resolve to ADR-0001 here.

**Shipped vs tools-only:** "shipped" = under `src/`, loaded by the runtime. "tools-only" = under
`tools/` (referees, collectors, experiments); excluded from any npm package but still distributed
by the git repo itself, so the repo-level license must account for them.

---

## Verdict summary

A single blanket MIT license is **not** available for the repo as it stands. What *is* available:

> **MIT for the code and the hand-authored data, with fenced data directories that carry their
> parent licenses (CC-BY-SA, CC-BY, CC0), declared per file in this map** — after resolving the
> blocker list in §5. The blockers are few and all actionable: one CC-BY-NC input (replace), one
> unlicensed upstream (relicense-or-replace), two license-unverified upstreams (verify), a handful
> of espeak-lineage tables (own-authoring decision), and two unknown-origin files (identify or
> regenerate).

The bulk of the repo is genuinely clean: the engine code, the per-language rule tables and jsonc
manifests (hand-authored linguistic facts), and several flagship models (Persian tagger: CC0
training data; English tagger: public-domain CMUdict; Danish/Norwegian: CC0 NST) are MIT-safe
today.

---

## 1. Public domain / CC0 — MIT-safe, no obligations

| Artifact (shipped unless noted) | Upstream | License |
|---|---|---|
| `english/g2p-dict.tsv`, `accent-lexicon.tsv`, `en-g2p-tagger.int8.onnx`, `g2p-model.json` | CMUdict | Public domain |
| `danish/da-lexicon.tsv`, `da-g2p-tagger.int8.onnx` | NST Danish (Språkbanken sbr-26) | CC0 (freq-filter caveat → §3 note a) |
| `norwegian/nb-lexicon.tsv`, `nb-g2p-tagger.onnx` | NST Norwegian (Nasjonalbiblioteket) | CC0 (same caveat) |
| `swedish/accent-stress.tsv` | NST Swedish (abstract accent/stress features only) | CC0 |
| `persian/fa-tagger.int8.onnx`, `fa-pin-vowels.tsv` | HomoRich (MahtaFetrat, HF) | CC0 |
| `persian/fa-context-restorer.*.onnx` (partial) | Ferdowsi Shahnameh text | PD (Tajik edition → §3; Ganjoor terms → §5.7) |
| `hebrew/he-tagger.int8.onnx` (majority) | Nakdimon pre-modern PD subset (Bialik, Tchernichovsky) | PD (modern/wiki slice → §3) |
| tools: ASJP/Lexibank Swadesh referees (`mto`, `nog`, `smj`) | Lexibank | CC0 |
| `arabic/diacritization.tsv` underlying texts | classical vocalized works via Tashkeela | PD **as text**; compilation tag → §4.1 |

## 2. Permissive with attribution — MIT-compatible; needs a NOTICE entry, data keeps its license

| Artifact | Upstream | License | Obligation |
|---|---|---|---|
| `mandarin/chars.tsv`, `phrases.tsv` | pypinyin | MIT | attribution |
| `cantonese/dict.tsv` | rime-cantonese (via pycantonese) | CC-BY 4.0 | attribution |
| `bengali/bn-g2p-tagger.int8.onnx`, `bengali-lexicon.tsv` | Google language-resources/bn | CC-BY 4.0 | attribution |
| `sindhi/` lexicon Devanagari tier, `sd-g2p-tagger.int8.onnx` training data | **Sindhi Open Lexicon** (SindhiLanguage.org) | CC-BY | **named attribution: Amar Fayaz Buriro (امر فياض ٻرڙو) — mandatory, already committed to** |
| `hebrew/he-lexicon.tsv` builders | Phonikud + ReNikud (thewh1teagle) | CC-BY | attribution |
| `thai/seg-words.txt` | ICU thaidict + PyThaiNLP | Unicode-DFS-2016 + CC0 | notice |
| `arabic/diacritizer.onnx` teacher | CATT (AbjadAI) | Apache-2.0 | notice |
| Chinese dict trad/simp folding (all) | OpenCC tables | Apache-2.0 | notice |
| tools: `ja_pitch_reference.tsv`, ja counter gold | OpenJTalk / naist-jdic | modified BSD | notice |
| tools: GE2PE referee (fa) | Sharif SLPL | MIT | attribution |
| tools: JIPA referees (`bo`, `mad`), Grierson LSI (`sd`) | JIPA / lexibank-lsi | CC-BY | attribution |
| tools: Tatoeba jpn sentences (eval) | Tatoeba | CC-BY 2.0 FR | attribution |
| `balochi/balochi-lexicon.tsv` | Korn 2005, Jahani & Korn 2009 (scholarly facts, hand-read) | facts | cite sources (done in header) |

## 3. Share-alike (CC-BY-SA 3.0/4.0, Wiktionary family) — cannot be relicensed; fence under parent license

The largest stratum. Every artifact here is redistributable **only under CC-BY-SA**; in an MIT-code
repo they live in declared-license fences. None of this blocks publication — it blocks *blanket*
MIT.

**Shipped lexica/tables (Wiktionary via wikipron or kaikki):**
`russian/stress.tsv` + `hard-e.tsv`; `german/{stress,length,quality,consonant,er,lexicon}.tsv`;
`gan|hakka|jin|xiang/dict.tsv`; `thai/dictionary.tsv`; `burmese/{dictionary.tsv,seg-words.txt,voicing-lexicon.tsv}`;
`khmer/km-lexicon.tsv`; `sindhi/sindhi-lexicon.tsv` (kaikki tier); `arabic/egyptian-lexicon.tsv`;
`urdu/{lexicon.tsv,lexicon-ipa.tsv}`; `persian/lexicon.tsv`; `pashto/lexicon.tsv`; `punjabi/{lexicon.tsv,crossscript.tsv}`;
`indonesian/indonesian-e-lexicon.tsv`; `romanian/romanian-stress.tsv`; `welsh/lexicon.tsv`;
`czech/loanwords.tsv`; `hausa/tone.tsv`; `zulu/tone.tsv`; `akan/akan-tone.tsv`;
`zhuang/sawndip-readings.tsv`; `tagalog/stress-lexicon.tsv` + `final-glottal.txt`;
`javanese/javanese-lexicon.tsv`; `gujarati/gujarati-lexicon.tsv`; `greek/greek-synizesis.tsv`
(consensus of the two Wiktionary referees); `english-gb/en-gb-*.tsv` (mined from the wikipron UK
referee); `portuguese-br/pt-br-openclose.tsv`; `portuguese/lexicon.tsv`; `korean/tensification.tsv`;
`ilocano/ilo-lexicon.tsv`.

**Shipped Japanese data:** `japanese/pitch-accent.tsv` (kanjium CC-BY-SA voter, with BSD OpenJTalk
+ UniDic voters); `japanese/readings.tsv`, `fallback.tsv`, `adverbs.txt` (JMdict/KANJIDIC © EDRDG,
CC-BY-SA 4.0 — EDRDG requires **specific named attribution**, add to NOTICE).

**Shipped model weights that the repo itself declares CC-BY-SA-inheriting:**
`core/riderDiacritizer.onnx` (explicit "inherits CC-BY-SA 4.0"); `persian/fa-vowel-restorer.*.onnx`;
`persian/fa-context-restorer.*.onnx` (Tajik CC-BY-SA component); `french/lexicon.tsv` +
`french/fr-g2p-tagger.int8.onnx` (Lexique 3.83, CC BY-SA 4.0 verified — §5.2). These **cannot ship
in an MIT-only package**; they stay fenced like the data.

**Models with share-alike training inputs but a stated training-as-use posture (ADR-0001):**
`arabic/diacritizer.onnx` (arwiki CC-BY-SA silver), `arabic/diacritizer-egy.onnx` (arzwiki
CC-BY-SA silver + MIT dialect corpus), `hebrew/he-tagger.int8.onnx` (small CC-BY-SA modern/wiki
slice), `english/pos-model.json` (**UD-EWT CC-BY-SA 4.0 — currently unrecorded in the repo; record
it, and decide posture or retrain**). The posture is a reasoned position, not settled law — keep
these individually flagged in NOTICE with their training-data statement.

**tools-only (never in a package, still in the git repo):** the 246-referee eval set —
120 wikipron + 53 kaikki + 15 wiktionary-API + `cmn` CC-CEDICT check (all CC-BY-SA);
32 epitran outputs (epitran code MIT; wordlists often kaikki); hermitdave FrequencyWords
lists (CC-BY-SA) used as **filters** for the CC0 NST lexica — (note a) the shipped intersection
keeps only NST content ordered by an external ranking; the rank itself is the only FrequencyWords
contribution and is not reproduced. State this in NOTICE rather than silently assuming it.

**In-repo original referees (MIT-able, they're our own work):** the 11 `gold-adjudicated`/
`gold-freq` files, `fa-abjad-ipa-gold.tsv`, KRNB extraction tables (facts hand-read from
open-access Toulmin 2006 / Wilde 2008 — cite), `awa.saksena.tsv` + `bho.grammar-mined.tsv`
(facts from published grammars — complete the citations, §5.8).

## 4. Copyleft & problem cases

1. **Tashkeela → `arabic/diacritization.tsv` (shipped).** Compilation tagged **GPL-2.0**;
   underlying classical texts PD. Shipped under the ADR-0001 facts-not-expression posture, by
   explicit maintainer direction, Tashkeela credited. This is the only GPL-tagged upstream whose
   derivative ships. Keep the posture statement verbatim in NOTICE; it is the repo's highest-risk
   single call and should be re-affirmed (or the file regenerated from PD sources directly) before
   publication.
2. **calima-egy (GPL-2.0)** — offline teacher for diacritizer-egy only; **not shipped**. Document
   as such in NOTICE; no further action.
3. **espeak-ng lineage (GPL-3.0)** — two distinct cases:
   - *espeak-ng 1.52 proper* (not ours): `catalan/mid-vowels.tsv` + `bl-gl-geminate.tsv` are
     distilled from its output over a 50k wordlist, keeping only an abstract open/close flag. The
     "convention-independent abstract feature" defence is plausible but untested; the tables are
     also small and *replaceable* — the DCVB/GDLC open-mid facts could be re-mined from the kaikki
     Catalan dump (→ CC-BY-SA fence) or hand-adjudicated (→ MIT). **Recommend replacement over
     defence.**
   - *espeak-ng-portable* (our sibling repo, GPL-3.0-or-later as an espeak-ng derivative).
     **Checked 2026-07-29: its `authoring/` dirs for espeak-supported languages are PATCHED espeak
     dictsource files (authoring/ga/ga_rules carries espeak's "Ronan McGuirk 2013" header), not
     cleanroom** — so nothing in the flagged set is unpublished own-authoring. Classification of
     the output-level fact tables (none reproduces espeak's rules):
     - `turkish/stress.tsv` — **RESOLVED 2026-07-29**: espeak-seeded list replaced by a kaikki
       Turkish mine (2,103 non-final-stress lemmas, CC-BY-SA) + 8 adjudicated entries (PR #574).
     - `vietnamese/rhymes.tsv` (375) — **owner determination 2026-07-29: linguistic fact**
       (exhaustive closed-class inventory of Vietnamese rhymes; merger — one way to enumerate a
       complete system). Keep; MIT-safe under the ADR-0001 posture.
     - `catalan/mid-vowels.tsv` + `bl-gl-geminate.tsv` (10.4k) — **owner determination
       2026-07-29: linguistic fact** (per-word mid-vowel quality / geminate class — dictionary
       facts of Central Catalan, DCVB-verifiable; word selection is the external frequency
       corpus, not espeak's). Keep; ADR-0001 posture.
     - `mandarin/syllable-ipa.tsv` (424) — **kept after re-derivation test 2026-07-29**: the
       full table was compared row-by-row against epitran cmn-Latn (MIT; the committed
       `cmn.epitran-cmn-Latn.tsv` referee, same 424-syllable inventory). ~95% of rows are
       convention-isomorphic (ɑ/a, superscript offglides vs i̯/u̯, ə/ɤ); residuals are standard
       alternative ANALYSES (apical ɹ̩/z̩, er = ər/ɻ̩, labial+o = o/u̯ɔ, -iong = yŋ/i̯ʊŋ) plus
       four outright epitran defects we do NOT share (bong→pu̯ɔnk, hng→xnk, fou→fu̯ɔu).
       Re-deriving would change conventions the corpus depends on and import those bugs — so the
       table stays, with epitran as row-level independent corroboration of the closed-class
       facts posture.
     - `irish/lexicon.tsv` (7,572) — **owner determination 2026-07-29: NOT an espeak-1.52
       derivative.** espeak 1.52's `ga` was broken before the espeak-ng-portable work; the
       engine that generated this lexicon is substantially the owner's own (unpublished) repair
       work, and the per-word entries are mechanically-generated pronunciation facts over an
       external frequency wordlist (Tashkeela-shaped ADR-0001 posture besides). Keep.
     - ja/thai/wu conduit data: parent licenses govern (kanjium/OpenJTalk/UniDic, ICU/PyThaiNLP,
       rime-wugniu) — already classified above.
4. **Leipzig Corpora → `afrikaans/af-stems.txt`** — **RESOLVED 2026-07-29.** The Leipzig-derived
   list (CC-BY-NC) was replaced by a 53,344-word union rebuilt from afwiki (freq ≥ 25) +
   hermitdave OpenSubtitles + kaikki headwords — all CC-BY-SA (→ §3 fence). Referee eval
   unchanged (74.7% folded backbone); see `src/languages/afrikaans/af-stems.PROVENANCE.md`.
5. **rime-wugniu → `wu/dict.tsv` (101k entries)** — **RECLASSIFIED 2026-07-29**: the "no license"
   note was an authoring-era miss; github.com/rime/rime-wugniu has been **GPL-3.0 since 2012**.
   So there IS a grant, under copyleft: the derived `dict.tsv` is distributed under GPL-3.0
   (per-file fence; the TSV is its own source). The engine reading it stays MIT — runtime data
   consumption is not linking. Options if a GPL data file is unwanted in the shipped set:
   rebuild from kaikki Wu readings (CC-BY-SA fence, gan/hakka/jin/xiang pattern, coverage drops
   101k → ~10-20k), or ask Wugniu for a permissive grant of the dictionary data (now a friendly
   relicensing ask). Alongside Tashkeela (§4.1) this is one of two GPL-lineage data files.
6. **MOE Taiwan dictionaries → `minnan/dict.tsv`, `dict-chars.tsv`** — **RESOLVED 2026-07-29:
   fully rebuilt from clean sources** (台華線頂對照典 CC BY-SA 4.0 + iTaigi CC0 + kaikki Hokkien
   chars CC BY-SA; `tools/gen/build-nan-chhoetaigi.mts`). Referee eval improved to 95.3% folded
   (from 90.7%), 4.2× word coverage; circularity caveat for the kaikki char tier stated in
   `src/languages/minnan/dict.PROVENANCE.md`. Original verification record follows.
   Verified against ChhoeTaigi's license table; all three prior components were encumbered:
   教育部台語辭典 = **CC BY-ND 3.0 TW** (NoDerivatives — our transformed extractions are
   derivatives, so redistribution is prohibited, and this is a deliberate MOE choice, not an
   oversight); 甘字典 (1913) and 台日大辭典 台譯版 = **CC BY-NC-SA 3.0 TW** (NonCommercial).
   The 1913/1932 originals are PD by age, but ChhoeTaigi's claims attach to the digitization +
   romanization conversion actually used. **Escape hatch, same database:** rebuild both files
   from ChhoeTaigi's clean components — 台華線頂對照典 (91,339 entries, **CC BY-SA 4.0**) +
   iTaigi 華台對照典 (19,046, **CC0**) + optionally 台灣白話基礎語句 (5,429, CC BY-SA 4.0) —
   dropping MOE/Kam/Taijit entirely; wikipron referee stays non-circular. Gate the rebuild on
   the nan referee eval (single-char coverage is the risk: dict-chars.tsv currently lifts it
   58.3%→~96%).

## 5. Unknown / unresolved — identify, verify, or regenerate

1. `english/g2p-common.txt` — frequency-ordered common-word list, no header, no doc statement.
   Trivially regenerable from CMUdict ∩ any PD frequency ranking; do that and header it.
2. **Lexique 3.83** (`french/lexicon.tsv`, fr tagger training) — **VERIFIED 2026-07-29:
   CC BY-SA 4.0.** Two corroborating sources: lexique.org states "licence Creative Commons
   Attribution – Partage dans les mêmes conditions 4.0" (for the current Lexique 4.00), and
   the openlexicon `Lexique383` distribution bundles `LICENSE-CC-BY-SA4.0.txt` for the 3.83
   vintage specifically. Not a blocker — moves to the §3 share-alike fence; attribution
   (New & Pallier, Lexique) added to the NOTICE list. `french/lexicon.tsv` header and
   `fr-g2p-tagger.PROVENANCE.md` updated. The tagger, which reproduces Lexique pronunciations,
   is classified with the CC-BY-SA-inheriting models in §3 (same reasoning as riderDiacritizer).
3. `english/pos-model.json` — UD-EWT (CC-BY-SA 4.0) unrecorded; record + posture or retrain (§3).
4. **FarsDat** (synth referee voter, tools-only) — no acquisition path or license on record.
   Document or drop the synth referee.
5. `hebrew/he-lexicon.tsv` — which frequency list fed Phase A? Name it + license in the header.
6. `tools/referee-eval/freq/nb.txt`, arabic-restorer `coverage_eval.py` OpenSubtitles list —
   add source+license notes (hermitdave CC-BY-SA presumed).
7. **Ganjoor** (Shahnameh digitization, tools-only) — text PD; digitization terms unstated. Note it.
8. `awa.saksena.tsv` / `bho.grammar-mined.tsv` — complete the citations (edition, pages).
9. `amharic/fidel.tsv`, `tigrinya/fidel.tsv` — hand-authored syllabary facts; add "authored
   in-repo" headers so they stop looking like unknowns.
10. Doc/reality fix: `arabic/diacritizer.PROVENANCE.md` says the .onnx is gitignored; it is
    tracked. Correct the doc.

## 6. Recommended license architecture

1. **Repo license: MIT** for all code, jsonc manifests, hand-authored rule tables, in-repo gold
   referees, and CC0/PD-derived data — the default that covers everything not listed otherwise.
2. **`LICENSES/` + per-file declarations**: adopt the REUSE convention (SPDX headers or a
   `.reuse/dep5`-style manifest) mapping every §3 artifact to CC-BY-SA-4.0/3.0, every §2 artifact
   to its permissive license, keyed off this document. The fences are directories where possible
   (`tools/referee-eval/referees/` is one line).
3. **NOTICE file**: attribution roll-up — CMUdict, NST/Språkbanken, HomoRich, Google
   language-resources, rime-cantonese, pypinyin, OpenCC, OpenJTalk/naist-jdic, kanjium, EDRDG
   (their required wording), Wiktionary/wikipron/kaikki, Tashkeela (+posture), CATT, Phonikud/
   ReNikud, Nakdimon, Sharif GE2PE, Lexibank/ASJP, **Amar Fayaz Buriro / SindhiLanguage.org**
   (named, mandatory), Toulmin/Wilde/Saksena/Grierson citations.
4. **Package fencing**: the npm/dist package ships `src/` only; if a fully-MIT distributable is
   ever wanted, a `--permissive` build profile that excludes §3-fenced data files (engines fall
   back to rules/taggers) is mechanically derivable from this map.
5. ~~Copy ADR-0014 into this repo~~ — superseded: the posture is stated natively as ADR-0001
   (this repo is not an espeak derivative; importing the GPL-decision ADR misdescribed it).

---
*Maintenance rule: any new data file or model lands with either a `*.PROVENANCE.md` or a header
naming source + license, and a row in this map. The referee-eval configs already carry per-referee
`source` fields — keep that pattern.*
