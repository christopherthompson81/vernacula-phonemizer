# Kalaallisut / Greenlandic (kl) native bring-up investigation

Target: **Kalaallisut** (West Greenlandic, kalaallisut) — Eskimo-Aleut (Inuit branch), ~56k speakers
(Greenland), Latin script (the 1973 phonemic orthography). Canonical IPA, espeak-independent. **The fleet's
FIRST Eskimo-Aleut family** (typological milestone; new README family row).

## Run 1 — referee landscape (2026-07-27): WELL-RESOURCED

- **wikipron kal_latn_broad**: 1581 pairs (space-segmented, PHONEMIC — the 1973 orthography level) → PRIMARY.
- **wikipron kal_latn_narrow**: 1462 pairs — shows the PHONETIC detail (regressive assimilation rp→pp,
  uvular vowel-lowering i→[ɜ]/u→[ɔ]/a→[ɑ], ll→[ɬ]).
- **kaikki Greenlandic**: exists (200) → possible secondary.

## Run 2 — the phonology (read off the broad referee)

The 1973 orthography is HIGHLY PHONEMIC → the broad transcription is nearly 1:1:
- **Vowels /a i u/** (3-vowel system, the Inuit hallmark): a→[a], i→[i], u→[u]. ★ **⟨e⟩→[i], ⟨o⟩→[u]** — ⟨e o⟩
  are NOT phonemes, they are the LOWERED allophones of /i u/ that the orthography writes before a uvular (q, r);
  the broad referee normalizes them back to /i u/ (aaneq→aaniq, aalavoq→aalavuq, aavooq→aavuuq). Doubled vowel
  → LENGTH (aa→[aː], ii→[iː], uu→[uː], ee→[iː], oo→[uː]).
- **Consonants**: p t k q (★ the UVULAR stop /q/ is a hallmark), v s j l m n f, **⟨g⟩→[ɣ]** (voiced velar
  FRICATIVE — the continuant parallel to the stop ⟨k⟩, as ⟨r⟩→[ʁ] is to ⟨q⟩; broad referee coarsens to [ɡ]),
  **⟨r⟩→[ʁ]** (uvular
  fricative — the broad referee writes it coarsely as [r]), **⟨ng⟩→[ŋ]**, **⟨nng⟩→[ŋː]**. A doubled consonant →
  LENGTH (aallaat→[aːlːaːt], aappaa→[aːpːaː]); ⟨ts⟩ stays [ts].
- **NO stress marked** (Greenlandic prosody is weight-based + unmarked in the referee).
- The PHONETIC layer (narrow) — regressive consonant ASSIMILATION (the famous Inuit sandhi: rp→[pp], tk→[kk])
  and uvular vowel-lowering ([ɜ ɔ ɑ], ll→[ɬ]) — is DEFERRED (we target the broad/phonemic level; the
  assimilation is largely already spelled out in the modern orthography).

## Run 3 — build + tune (2026-07-27)

Self-contained near-1:1 scan (kalaallisut.ts): three-vowel /a i u/ (⟨e o⟩→[i u]), ng/nng, doubled letter →
length, uvular ⟨q⟩/⟨r⟩→[q ʁ].
- **v1**: 30.4% folded / 86.9% symbol — the folded % was suppressed by the **backbone-strips-ː bug** (the
  Faroese lesson): the eval BACKBONE strips our [Vː]/[Cː] length BEFORE the config folds, but a geminate fold
  that mapped the referee's doubled letters → length re-added ː only on the referee side (qimmeq: mine `qimiq`
  vs ref `qimːiq`). FIX = collapse the referee's doubling to a SINGLE segment → **92.6% / 98.1%**.
- **v2** (loan ⟨b d⟩→[p t] — Greenlandic has no voiced stops: Biina→piːna, Bolatta→pulatːa): **94.8% folded /
  98.5% symbol**.

**Final: 94.8% folded / 98.5% symbol** on wikipron kal_latn_broad (1581) — a CLEAN, high-scoring bring-up (the
1973 phonemic orthography makes it Finnish/Māori-tier, and the single-dialect referee gives a tight
measurement — unlike the multi-dialect Celtic ones). Folds: length notation (VV→V, CC→C to match the
backbone-stripped output), ʁ~r (the coarse broad-referee rhotic). The ~6% residual is entirely the deferred
NARROW phonetic layer that leaked into a few "broad" entries — uvular vowel-lowering (o→[ɔ], e→[ɜ]),
regressive consonant assimilation (anarnaq→[anɑnnɑq]), and ll→[ɬ] (alleroq→[aɬɬɜʁɔq]). 🔷 single-source family
(wikipron; kaikki Greenlandic same source) but a transparent orthography → low referee-error risk.

## Run 4 — 2-agent review (2026-07-27)

**Phonology reviewer — core CONFIRMED** (vs Fortescue *West Greenlandic*): the three-vowel /a i u/ with
⟨e⟩→[i]/⟨o⟩→[u] (the right broad/phonemic target — the narrow referee is where the lowered [ɛ~ɜ]/[ɔ] surface),
⟨q⟩→[q]/⟨r⟩→[ʁ], ng/nng/gemination/⟨ts⟩→[ts], loan ⟨b d⟩→[p t], and no-stress all CONFIRMED. ★ ONE WRONG VALUE
FIXED: **⟨g⟩→[ɣ]** (voiced velar FRICATIVE), not the stop [ɡ] — it is the continuant parallel to the stop ⟨k⟩
exactly as ⟨r⟩→[ʁ] is to ⟨q⟩ (the series v s g r = [v s ɣ ʁ]); the engine already emitted the fricative for
⟨r⟩ but inconsistently a stop for ⟨g⟩. The narrow referee corroborates (isigak→isiɣak, aqagu→aqaɣu); the broad
majority coarsens [ɣ]→[ɡ] (the SAME coarsening as [ʁ]→[r]). Fixed: g→[ɣ] + a ɣ→ɡ fold (mirroring ʁ→r) + ɣ in
the geminate class; golden isigak→isiɣak added. DEFERRED-CONFIRMED: ⟨ll⟩→[ɬː] is the most defensible narrow
rule (fully predictable, phonemically salient) but the broad referee writes [lː] → keep deferred for the broad
target; the regressive assimilation + uvular-lowering are correctly narrow-only.

**Code/wiring reviewer — CLEAN, no engine bugs.** Verified the nng>ng longest-match, the doubled-consonant
branch, the fold mechanism (backbone strips ː before config folds — Faroese-identical, honest; ʁ→r masks no
contrast — the engine emits only [ʁ]). ★ ONE FOLD FIX: the geminate class OMITTED ⟨r⟩ — the referee writes a
long uvular as doubled [rr] (7 entries: nirrivik, irrurpaa…), which our [ʁː]→[ʁ]→[r] must meet as a single
[r]; added ⟨r⟩ to the class (+7 words → 94.8%). ★ LATENT (loan-only, 0 referee words) FIXED: the doubled-vowel
merge keyed on same-IPA (VOWEL[c]===VOWEL[nx]) so a heterographic ⟨ei⟩/⟨ou⟩ (both /i u/) wrongly merged to a
long vowel — changed to same-GRAPHEME (c===nx). Referee join clean (1581 rows); wiring/counts/the NEW
Eskimo-Aleut family entry all correct.

**Final: 94.8% folded / 98.5% symbol. 🔷 single-source family, transparent orthography. Floor 0.90.** Full
suite green, typecheck clean. Deferred: the phonetic assimilation + uvular-lowering + ⟨ll⟩→[ɬː] NARROW layer,
numbers.
