# es-419 (Latin-American Spanish) accent-variant bring-up

**Goal:** the THIRD accent variant — "neutral"/pan-American Latin-American Spanish over the Castilian `es`
engine. Motivated by the OmniVoice FLEURS corpus, which labels its Spanish audio as `es_419` (not `es_ES`), so
the Castilian engine's /θ/ and /ʎ/ are *wrong* for what the model consumes.

## The delta (Castilian → Latin-American)

The `es` engine is Castilian: it emits /θ/ (cielo→θjelo, cerveza→θeɾβeθa) and /ʎ/ (calle→kaʎe, pollo→poʎo).
Latin-American Spanish differs by two **categorical, pan-regional mergers**, both context-free surface
substitutions with **no information loss** — so es-419 is a post-process (like en-GB), not an engine fork:

- **SESEO**: /θ/ → /s/. Latin America has no dental fricative at all — ⟨c⟩ before e/i and ⟨z⟩ are [s]
  (cielo→sjelo, zapato→sapato, cerveza→seɾβesa, gracias→ɡɾasjas, corazón→koɾason).
- **YEÍSMO**: /ʎ/ → /ʝ/, merging ⟨ll⟩ into the ⟨y⟩ phoneme (calle→kaʝe, llave→ʝabe, pollo→poʝo, caballo→kabaʝo,
  ella→eʝa).

`toLatinAmerican(s) = s.replace(/θ/g,"s").replace(/ʎ/g,"ʝ")`, applied to the word and to the whole `text()`
output (context-free → no word boundaries needed, simpler than en-GB/pt-BR).

**Deliberately NOT applied** — regional, not part of the neutral/media standard, and the referee keeps the
conservative form: coda-/s/-aspiration (Caribbean/coastal; Mexican/Andean keep [s]: gracias→ɡɾasjas), word-final
/n/→[ŋ], and voseo. The neutral standard is seseo + yeísmo only.

## Run 1 — 2026-07-18

92.6% vs wikipron spa_latn_la broad (130,389 merged variants) — **matching the ✅ es parent (92.5%)**. The delta
validated exactly on the referee's diagnostic words (cielo→sjelo, calle→kaʝe, caballo→kabaʝo, ciudad→siwdad/
sjudad). The entire residual is **inherited from the shared es engine**: coda-obstruent voicing (coctel→our
koktel vs referee koɡtel; practica→pɾaɡtika; adoptara→adobtaɾa; acción→aɡsjon) — a general-Spanish allophony
(coda stops voice/lenite before another consonant) that the es engine doesn't model, and the reason es itself is
92.5% not higher. There is NO es-419-specific gap.

## Status

✅ VERIFIED from the start. Floor 0.90. Same residual profile as its ✅ es parent (the delta is exact; the miss
is shared allophony), gold 100%. Third accent variant (en-GB post-process, pt-BR parameterized-engine, es-419
post-process). **Deferred (shared es, not es-419-specific):** ⟨x⟩=[x] in Nahuatl-origin names (México→[ˈmexiko],
Oaxaca) — the es engine gives [ks] in both dialects. Next accent target: en-IN.
