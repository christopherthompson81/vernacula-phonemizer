> **Brought forward 2026-07-29 from espeak-ng-portable** (`docs/adr/0014-licensing-gplv3.md`),
> where it was accepted 2026-06-09. It is reproduced verbatim below because this repo's
> `*.PROVENANCE.md` files cite "ADR-0014" for its **facts-not-expression analysis** (the Tashkeela
> lexicon and neural-diacritizer sections), which applies here unchanged.
>
> **Applicability note for vernacula-phonemizer:** the DECISION section (license the project
> GPL-3.0-or-later) applies to espeak-ng-portable only — that project is an espeak-ng derivative;
> this one is not (it was started precisely to be free of espeak-ng's code, carrying forward only
> linguistic facts; see docs/PROVENANCE.md §4.3 for the per-artifact owner determinations). What
> this repo inherits is the ANALYSIS: the *CCH Canadian* facts/expression reasoning for mechanical
> fact tables and trained model weights, with the same caveats (owner posture, not legal advice,
> jurisdiction-dependent, revisitable).

# ADR-0014: Licence the project GPL-3.0-or-later (espeak-ng derivative)

- **Status**: Accepted — 2026-06-09 (owner decision, project unpublished)
- **Deciders**: project author
- **Supersedes**: the repo's prior MIT labelling
- **Relates to**: [ADR-0001](0001-normalized-json-intermediate-format.md) (data
  provenance/format); the Arabic licensing gate in
  `docs/archive/arabic_diacritization_plan.md` §4.

## Context

The repository was labelled **MIT** (© 2026 Chris Thompson), but the project is a
**derivative work of eSpeak NG**, which is **GPL-3.0-or-later** ("either version 3
… or (at your option) any later version"):

- `data/<lang>/*.json` is produced by transforming eSpeak NG's `dictsource/`,
  `phsource/`, and `src/libespeak-ng/tr_languages.c` into JSON. The letter-to-sound
  **rules** and the **selection/arrangement** of the dictionaries are eSpeak NG's
  copyrightable expression; the JSON is a derivative of it. (Bare pronunciation
  facts may be uncopyrightable, but the rules + arrangement are not — so the data
  as a whole is a derivative.)
- The runtime engine (`src/`, `csharp/`) reimplements eSpeak NG's algorithms,
  referencing its source closely.

The MIT label was therefore inconsistent: GPL-derived material cannot be
relicensed MIT. The README pointed at "ADR-0001 for the data-provenance argument,"
but ADR-0001 is about the data *format*, not a legal argument — the choice had
never actually been examined.

Two further data dependencies:
- **EDRDG JMdict/KANJIDIC2** (`data/ja` readings) — **CC BY-SA 4.0**, which is
  one-way compatible *into* GPL-3.0-or-later (so GPLv3 also fixes the prior MIT
  inconsistency for this data; MIT had under-licensed it).
- **Tashkeela** (`data/ar/diacritization.tsv`) — the source corpus is **GPL-2.0**
  (v2 *only*; confirmed via SourceForge classifier and the Hugging Face `gpl-2.0`
  SPDX id, neither using the "or-later" variant). GPLv2-only is *incompatible*
  with GPLv3 — so if the lexicon were a GPL-2.0-bound work it could not ship in a
  GPLv3 project.

## Decision

1. **Licence the whole project `GPL-3.0-or-later`** (LICENSE = GPLv3 text;
   `package.json` `"license": "GPL-3.0-or-later"`; README updated; a `NOTICE`
   crediting eSpeak NG + the data sources). No dual MIT-code posture — the engine
   is a close port of GPL code and ships with GPL-derived data, so the whole work
   is GPL.
2. **EDRDG data** rides along under GPL-3.0-or-later via CC BY-SA 4.0's one-way
   compatibility, with attribution preserved (`docs/THIRD-PARTY-LICENSES.md`).
3. **The Tashkeela-provenance Arabic lexicon is treated as an unoriginal
   compilation of facts, not a GPL-2.0-bound work** — so the GPLv2-only / GPLv3
   incompatibility does not arise. Tashkeela is credited for provenance.

### Why the Tashkeela lexicon is not GPL-bound

`data/ar/diacritization.tsv` is a flat, type-level table of
`undiacritized → most-frequent-pausal-vocalization` (~93k entries), produced by a
purely mechanical frequency count (most-frequent reading, fixed floor ≥20, fixed
MSA weight). It contains no sentences and none of the corpus's selection or
arrangement. Each entry is a **linguistic fact** (the dominant vocalization of a
wordform), and a mechanical compilation of facts is **unoriginal** — under the
Canadian originality standard (*CCH Canadian Ltd. v. Law Society of Upper Canada*,
2004 SCC 13: "skill and judgment … not so trivial that it could be characterized
as a purely mechanical exercise") it carries no copyright of its own and does not
reproduce Tashkeela's protected expression. The GPL is a copyright licence; with
nothing copyrightable copied, its conditions do not attach. Canada (the owner's
jurisdiction) has **no** EU-style sui generis database right, so the substantial-
extraction risk that exists under EU law does not apply here.

### Why the neural diacritizer (`data/ar/diacritizer.onnx`) is not corpus-bound

Added 2026-07-05 (issue #675). The shipped diacritizer is the learned weights of a
BiLSTM distilled offline over silver-labelled modern Arabic. It carries the lexicon's
rationale **one abstraction level further**, more cleanly:

- The artifact contains **no verbatim text** — no sentence, wordform, or frequency
  count from any source survives; only a statistical model of Arabic orthography. A
  corpus's sole protectable element is its **selection and arrangement** of sentences
  (its skill-and-judgment / editorial originality per *CCH Canadian*); training
  **dissolves that completely** — which sentences were chosen, and in what order, leaves
  no trace in the weights. What remains is orthographic regularity: **linguistic facts**.
- The corpus text was **non-expressive, functional scaffolding**: its content was
  immaterial to the purpose (any orthographically-sound modern Arabic yields an
  equivalent model). No protected expression is reproduced, so — as with the lexicon —
  a copyright licence has nothing to attach to.
- **Training inputs & their terms.** Teacher: **CATT** (Apache-2.0, permissive
  regardless). Warm-start init: the Tashkeela-provenance model (covered above). Silver
  sentences: **Leipzig `ara_news_2020`**, distributed under **CC BY-NC 4.0**. The NC
  term is a *usage* condition layered on the copyright licence; on the facts/expression
  analysis it does not reach a model of the orthographic facts (Creative Commons' own
  position is that CC conditions bind only uses that implicate the licensed copyright).
  Canada has no EU-style sui generis database right, so no separate extraction exposure.
- **Belt-and-suspenders**, if the posture is ever revisited: the pipeline is
  corpus-agnostic — regenerate the silver from a permissive source (Arabic Wikipedia
  CC-BY-SA, OSCAR) to moot the Leipzig term entirely (see `diacritizer.PROVENANCE.md`).

Same owner-decision caveat as the lexicon: reasoned posture, not legal advice,
jurisdiction-dependent, surrounding law unsettled (esp. model-training fair dealing / TDM).

## Consequences

- **+** Honest, compliant posture matching eSpeak NG; clears the long-standing
  GPL-vs-MIT tension and the EDRDG under-licensing in one move.
- **+** Arabic short-vowel restoration is unblocked: the lexicon is shippable
  under the facts/provenance posture without inheriting GPLv2-only.
- **−** The engine can no longer be reused under a permissive licence. Acceptable:
  it is a derivative of GPL code, so MIT was never actually available.

## Scope / non-goals & caveats

- This is a **good-faith owner determination at the unpublished stage**, not legal
  advice. It is revisitable. The facts-not-copyrightable reasoning for the
  Tashkeela lexicon is jurisdiction-dependent (sound in CA/US; the EU sui generis
  database right is a separate exposure that was considered out of scope for the
  owner's jurisdiction).
- Low-risk fallbacks for Arabic remain available if the posture is ever revisited:
  rebuild the lexicon from a CC-BY/permissive vocalized source, or defer the
  feature.
- Source-file GPL headers are **not** added per-file; the repository-root `LICENSE`
  + `NOTICE` govern the whole tree (including `csharp/`).
