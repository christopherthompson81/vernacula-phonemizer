# Aragonese (an) native bring-up investigation

Target: **Aragonese** (aragonés) — Ibero-Romance (Pyrenean), ~25k speakers (Aragon / NE Spain), Latin.
Canonical IPA, espeak-independent. Close to Spanish/Catalan/Occitan; the fleet has a rich Romance set
(es ✅, ca ✅, gl 🔷, oc 🔷, ast 🔷, rup 🔷) — Asturian/Galician are the "reuse the Spanish engine shape +
deltas" template.

## Run 1 — referee landscape (2026-07-28)

- **wikipron arg_latn_broad**: 1320 pairs (space-segmented, broad/phonemic) → PRIMARY. Proper-noun + common
  vocabulary; seseo/distinción both attested (Francia→fɾansja ~ fɾanθja), and word-final ⟨-r⟩ appears BOTH
  dropped and kept (abanzar→abansa ~ abansaɾ) → a dialect-variable axis.
- **kaikki Aragonese**: exists (same Wiktionary source).
- 🔷 single-source family (wikipron; kaikki same source).

## Run 2 — the phonology (read off the broad referee)

A Spanish-shaped shallow g2p (the Asturian/Galician pattern) with the Aragonese hallmarks:
- ★ **⟨ch⟩→[t͡ʃ]** — very common (Aragonese writes ⟨ch⟩ where Spanish has [x]: Chesús→t͡ʃesus, chuego→t͡ʃweɡo).
- ★ **⟨ny⟩→[ɲ]** — the Catalan-style digraph (Espanya→espaɲa); ⟨ñ⟩ also → [ɲ].
- ★ **⟨x⟩→[ʃ]** (baxo→baʃo), **⟨ll⟩→[ʎ]** (fillo→fiʎo), **⟨v⟩→[b]** (betacism, Navarra→nabara).
- ★ **DISTINCIÓN** (standard Aragonese, per the Academia): ⟨z⟩ / ⟨c⟩ before e/i → [θ] (seseo [s] is the marked Benasquese/Ribagorçan minority → folded); ⟨j⟩ / ⟨g⟩ before e/i → [x].
- ★ **word-final ⟨-r⟩ APOCOPE** (the documented Aragonese trait, shared with Catalan/Occitan): cantar→[kanˈta],
  muller→[muˈʎe], banyar→[baˈɲa]. The referee attests BOTH forms (dialect-variable).
- single ⟨r⟩→[ɾ] tap vs ⟨rr⟩/word-initial → [r] trill; rising glides ⟨i⟩→[j]/⟨u⟩→[w]; ⟨qu gu⟩→[k ɡ]/[kw ɡw];
  5 vowels a e i o u (no reduction); NO spirantization in the broad (b/d/g stay stops, folded).

## Run 3 — build + tune (2026-07-28)

Self-contained manifest-driven scan (aragonese.ts + .jsonc), adapting the Asturian engine.
- **v1** (Spanish-shaped scan + ch/ny/x/seseo + final-r drop): 76.2% folded / 96.2% symbol. The dominant
  residual is the **final-r dual-form artifact** — the referee has BOTH the dropped and the spelling form for
  each infinitive, so whichever we emit we match one variant and miss the other (an inherent ceiling on the
  folded %, ~150 forced misses). Dropping is the phonetically-accurate default (documented apocope) and scores
  identically to keeping (v1 76.2 drop ≈ 76.1 keep).

**Final: 76.2% folded / 96.2% symbol** on wikipron arg_latn_broad (1320). ★ The **96.2% SYMBOL accuracy is the
honest headline** — the folded number is deflated by (a) the final-r dual forms (unavoidable, both attested),
(b) the seseo/distinción split (folded), and (c) the spirantization allophony (folded). Common words verified
exact (Chesús→t͡ʃesus, Espanya→espaɲa, tierra→tjera, Aragón→aɾaɡon). Folds: seseo s~θ, spirantization
β/ð/ɣ~b/d/ɡ, the rhotic tap/trill r~ɾ, the offglide mark. 🔷 single-source family but a shallow orthography.
Deferred: stress, numbers, the ⟨tz⟩/learned-⟨cc⟩ minority, a narrow/spirantization pass.

## Run 4 — 2-agent review (2026-07-28)

**Phonology reviewer — strong sign-off** (vs Nagore + the Academia de l'Aragonés orthography): ⟨ch⟩→[t͡ʃ],
⟨ny⟩/⟨ñ⟩→[ɲ] (grafía 2010 + grafía de Uesca), ⟨x⟩→[ʃ], ⟨v⟩→[b], ⟨ll⟩→[ʎ], ⟨qu gu gü⟩, glides, ⟨j⟩/g+e,i→[x]
(loan jota — no native [x]), and the F-preservation / -it- clusters / diphthongization all CONFIRMED (muito→
mwito verified against the referee). ★ ONE VALUE FLIPPED: **DISTINCIÓN [θ]** is the standard/literary default
(the referee has 169 θ tokens; seseo [s] is the marked Benasquese/Ribagorçan minority) — changed z/c+e,i→[θ]
(was [s]) and kept the θ→s fold (score unchanged). No missing hallmark.

**Code/wiring reviewer — CLEAN, no bugs, no dishonest folds.** Traced the digraph ordering (ny/ll/ch/tz/rr —
no mis-fire), the qu/gu cluster (guerra→ɡera, aguar→aɡwa, güe keeps [w] — all referee-corroborated), the
glide/⟨y⟩ split (riu→rju, rey→rei — corroborated), and — the headline concern — the **final-⟨r⟩ apocope does
NOT over-apply**: the referee attests the DROPPED form after all five vowels for infinitives AND nouns/
monosyllables (flor→flo, color→kolo, sur→su, haber→abe), only 1/493 lacks a dropped variant, and it correctly
never fires on ⟨rr⟩ (trill [r]) or word-initial ⟨r⟩. So **keeping the drop is empirically right** (this
resolved the one open judgment call — the apocope is categorical, not a 50/50 stylistic axis). Folds all
honest (θ~s both attested; the r→ɾ trill/tap fold is byte-identical to the established Asturian precedent —
collapses the pero/perro pair symmetrically for scoring only). Wiring/counts/columns all correct.

**Final: 76.2% folded / 96.2% symbol. 🔷 single-source family, shallow orthography. Floor 0.72.** Full suite
green, typecheck clean. Deferred: stress, numbers, the ⟨tz⟩/learned-⟨cc⟩ minority, a spirantization pass.
