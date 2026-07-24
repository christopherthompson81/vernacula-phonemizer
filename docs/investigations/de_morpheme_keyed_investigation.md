# German morpheme-keyed corrections — investigation

Can German's whole-word-keyed correction dicts (stress/length/quality/consonant/er.tsv) be re-keyed at the MORPHEME
level so they compose across compounds (the af/nl shared-engine design), without regressing German's referee score?
Goal: a "less ugly", data-efficient design that also generalizes to OOV compounds.

## Run 1 — 2026-07-24 — baseline + coverage reality check

Baseline: German folded **78.2%** on kaikki-deu (4744 words), 76.7% wikipron (from the floor comment).

Decompose coverage on the referee (`/tmp/de_stats.mts`):
```
total=4744  multi-morpheme=3265 (69%)  compound-in-stress-dict=3235 (99% of compounds)  all-morphemes-covered=386
```

**KEY FINDING — the referee cannot measure the morpheme form's benefit.** The whole-word correction dicts were BUILT
from the same kaikki corpus the referee draws from, so 99% of compound referee words are already in the whole-word
stress dict with EXACT whole-word ordinals. On the referee, whole-word lookup is the ceiling; morpheme-composition can
only match or slightly UNDERperform it (boundary ordinal mismatches). The morpheme form's actual value is OOV
generalization — a novel compound NOT in kaikki, where the current code falls back to raw g2p (all corrections lost)
whereas morpheme-keying would still correct each known morpheme. The in-corpus referee has ~0 such words.

→ Next: a HOLDOUT test. For compound referee words that ARE in the whole-word dict, ablate that whole-word entry
(simulate OOV) and compare, on the folded metric: (a) current fallback = compose morphemes with NO corrections, vs
(b) morpheme-keyed = compose morphemes each with its OWN dict entry + local ordinals, vs (c) whole-word = the exact
in-corpus ceiling. If (b) ≫ (a), the morpheme form generalizes better; the referee number just won't show it.

## Run 2 — 2026-07-24 — holdout experiment (tools/de-morpheme-holdout.mts)

Held out the whole-word dict entry for the 1163 in-corpus COMPOUNDS (≥2 stems, whole word known in stress.tsv) and
phonemized three ways:

```
in-corpus compounds (held out): 1163
  (c) whole-word ceiling:  974 (83.7%)   ← today, when the compound IS in kaikki
  (a) OOV fallback (today): 797 (68.5%)   ← today, for a NOVEL compound (all corrections lost → raw g2p)
  (b) morpheme-keyed:       886 (76.2%)   ← compose each morpheme with its OWN dict entry + local ordinals
  b beats a: 97   a beats b: 8   net (b−a): +89   (12:1 win ratio)
```

**RESULT — the morpheme form works.** Morpheme-keying recovers **+7.7pp** (68.5→76.2), ~half the 15.2pp gap between
the OOV fallback and the whole-word ceiling, at a 12:1 win:loss ratio. This is the OOV-generalization the in-corpus
referee couldn't show: for a compound NOT in kaikki, the current code loses ALL corrections, whereas morpheme-keying
still corrects each known morpheme (Kanzler, Haus, freundlich… are standalone kaikki entries).

**Design conclusion — HYBRID, not replacement.** Morpheme-keyed ALONE (76.2%) is worse than whole-word (83.7%) on
known compounds, so a full replacement would regress the 78.2% referee. The right design keeps the whole-word dict as
the exact override for KNOWN words and swaps the compound FALLBACK from "no corrections" to "morpheme-keyed". Purely
additive: in-corpus compounds stay on the whole-word ceiling (referee unchanged ≈78.2% — only the ~30 referee
compounds absent from the whole-word dict can move), and OOV compounds gain ~+7.7pp. The same dict files serve both
roles (looked up by whole word, then by morpheme) — no re-derivation needed.

→ Next: implement the hybrid (whole-word override → morpheme-keyed compound fallback) behind the existing compose
path, guard-test German's current output stays byte-identical on in-dict words, and ship the OOV lift.

## Run 3 — 2026-07-24 — hybrid SHIPPED (whole-word override → recursive morpheme-keyed fallback)

Implemented the hybrid in german.ts `phonemizeWord`: a compound with ANY whole-word correction (in-kaikki) takes its
exact whole-word entry (unchanged); an OOV compound — absent from every dict — routes to `composeMorphemeKeyed`.

First cut applied the correction stages manually per morpheme (matching Run 2's experiment) → 76.2%, but it MISSED the
`ver-`/`ge-` prefix reduction that the standalone-word path adds (Musikverein → …feːʁaɪ̯n instead of …fɛʁaɪ̯n).
Switched `composeMorphemeKeyed` to **recurse via phonemizeWord per stem** — each morpheme gets the FULL pipeline (its
own whole-word dict entry when known + prefix reduction + element-initial rules), then the per-morpheme stress marks
collapse to one primary at the stress part.

Re-ran the holdout against the SHIPPED function:
```
in-corpus compounds (held out): 1163
  (c) whole-word ceiling: 974 (83.7%)
  (a) OOV fallback (today): 797 (68.5%)
  (b) morpheme-keyed:       945 (81.3%)   ← recursive; was 76.2% manual
  b beats a: 161   a beats b: 13   net (b−a): +148   (12.4:1)
```

**Recursion recovers +12.8pp of the 15.2pp OOV gap — 84% of the lost ground, within 2.4pp of the exact whole-word
entry** — and it's cleaner (no duplicated apply pipeline). Verified: German goldens 39/39 byte-identical, referee
UNCHANGED at 78.2% (in-corpus compounds all take the whole-word path). OOV examples: Musikverein → muzˈiːkfɛʁaɪ̯n
(musik's loan corrections s→z + short u + iː; verein's ver-→fɛʁ), Naturschutzgebiet → natˈuːɐ̯ʃʊt͡sɡəbiːt (gebiet's
ge-→ɡə). The design is exactly the af/nl shared-engine idea (compose corrections per morpheme) applied as a FALLBACK
so it's purely additive. Guard test pins the OOV outputs; existing goldens + the 78.2% referee pin byte-identity.
