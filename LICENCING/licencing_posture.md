# Licensing posture — original engine, facts-based data, fenced third-party licenses

- **Status**: Accepted — 2026-07-29 (owner decision, pre-publication)
- **Deciders**: project author
- **Relates to**: `LICENCING/PROVENANCE.md` (the per-artifact license map this posture governs)

## Context

vernacula-phonemizer is an **original work**. It is a new engine, new per-language architectures,
and a canonical-IPA focus. External data carried into this project are **linguistic facts only**
— a word's pronunciation, a syllable inventory, a stress position. The per-artifact determinations
are recorded in `LICENCING/PROVENANCE.md` §4.3.

The repository does, however, ship **data derived from many third-party sources** (Wiktionary/
wikipron/kaikki, NST, CMUdict, Lexique, ChhoeTaigi, rime projects, and others) and **model
weights trained on such data**. Their parent licenses vary from CC0 to CC-BY-SA to GPL. A single
blanket license is therefore impossible; the project needs (a) a stated goal, (b) a principled
line for when a data artifact carries an upstream license and when it does not, and (c) a
structure that keeps the two apart.

## Licensing Posture

1. **The project's own work is licensed MIT** (goal state at publication): the engine, the
   per-language rule modules and jsonc manifests, hand-authored tables, in-repo gold referees,
   and tools.
2. **Mechanical fact tables are treated as unoriginal compilations of linguistic facts** and do
   not inherit an upstream license (the facts posture, below).
3. **Third-party-derived data keeps its parent license, declared per file** — the fences in
   `LICENCING/PROVENANCE.md` (CC-BY-SA for the Wiktionary family, CC-BY/CC0/BSD with attribution in
   NOTICE, GPL-3.0 for the rime-wugniu-derived Wu dictionary, etc.). A data file's license
   never leaks onto the engine that merely reads it at runtime. This is strictly for cases where
   there is information beyond linguistic fact.
4. **Trained model weights follow the same analysis one level up**: where the training data's
   protectable element (selection/arrangement of text) leaves no trace in the weights, the
   weights are not a derivative of it. Where a model effectively *reproduces* a licensed
   pronunciation table (a G2P tagger trained on and regenerating a CC-BY-SA lexicon's entries),
   the project conservatively declares the weights to inherit that license — see the per-model
   `*.PROVENANCE.md` files for which side of the line each model falls on.

## The facts posture

A pronunciation is a **linguistic fact**: that Irish *bó* is /bˠoː/, that Turkish *şimdi*
stresses its first syllable, that Vietnamese has exactly these rhymes. Facts are not
copyrightable (*Feist Publications v. Rural Telephone*, 499 U.S. 340 (1991)); what a dictionary
or corpus can protect is its original **selection and arrangement**, and only where that
selection reflects more than "a purely mechanical exercise" (*CCH Canadian Ltd. v. Law Society
of Upper Canada*, 2004 SCC 13 — the Canadian originality standard; Canada, the owner's
jurisdiction, has no EU-style sui generis database right).

Accordingly, a data artifact in this repo does **not** inherit an upstream license when ALL of:

- each entry states a linguistic fact (word → pronunciation/stress/feature; syllable → IPA);
- the artifact was produced **mechanically** (frequency counting, rule-engine output, feature
  extraction) rather than by copying the source's editorial selection;
- the **selection** of entries is the project's own (an external frequency corpus, an exhaustive
  closed-class enumeration — where a complete system can only be enumerated one way, merger
  leaves nothing protectable) — not the upstream's curated entry list;
- none of the source's protected **expression** (rules, prose, arrangement, transcription-
  convention system as a whole) is reproduced.

Where any of these fails — e.g. a curated dialect dictionary whose entry selection *is* the
upstream's editorial work — the artifact keeps the upstream license and lives in a fence.

## Consequences

- **+** The engine and everything original publishes MIT; the least-encumbered outcome
  available without discarding real data.
- **+** One documented line, applied per artifact in `LICENSING/PROVENANCE.md`, instead of ad-hoc
  calls scattered through the tree.
- **−** The repo is not single-license; packaging must respect the fences (a `--permissive`
  build profile can exclude fenced data mechanically, per the map).
