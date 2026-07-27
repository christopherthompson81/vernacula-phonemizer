# Hmong (hmn) native bring-up — investigation

Hmong-Mien, tonal, ~8M (SW China / Vietnam / Laos / Thailand / large US-French-Australian diaspora). The `hmn`
macrolanguage's RPA-standard variety is **White Hmong / Hmoob Dawb (Hmong Daw, `mww`)** — that's the target.

## Run 1 — 2026-07-26 — feasibility

- wikipron `mww_latn_broad` exists (492 rows / 489 headwords — thin but real, RPA→IPA). No kaikki White Hmong / no
  epitran mww.
- **Orthography is the easy case:** the **Romanized Popular Alphabet (RPA)** is a community-standard, deterministic,
  *phonemic* Latin orthography (Barney–Smalley 1953; the diaspora writes in it). Crucially, White Hmong has **no coda
  consonants**, so a word-final consonant letter is *always* a TONE marker — segmentation (onset + rime + tone) is
  unambiguous. Tractable, like the Sinitic romanization converters (`nan`/`cdo`).

## Run 2 — deriving the maps

Aligned the referee (single-syllable, ~473 clean pairs) by splitting each IPA at its first vowel (onset | rime):
- **Tone** = the RPA final letter, perfectly deterministic: `b`→˥ (55), `v`→˧˦ (24), *none*→˧ (33), `j`→˥˧ (52),
  `s`→˩ (low), `m`→˩̰ (creaky low), `g`→˧˩̤ (breathy). (`d`→˩˧ low-rising, rare, from the RPA spec.)
- **Onsets (50)** — the rich Hmong system, read straight off the referee: prenasalised (`np`→ᵐb, `nts`→ᶯd͡ʐ,
  `ntxh`→ⁿt͡sʰ), voiceless sonorants (`hm`→m̥, `hn`→n̥, `hl`→l̥, `hny`→ɲ̊), retroflex (`r`→ʈ, `ts`→t͡ʂ), uvular (`q`),
  palatal (`c`, `ny`→ɲ), plain/aspirated pairs. Zero onset → glottal [ʔ].
- **Palatalisation:** only `tx`→[t͡ɕ] and `x`→[ɕ] before /i/ (default `tx`→t͡s, `x`→s) — like the `nan` sibilant rule.
- **Rimes (13):** a e i o(→ɒ) u w(→ɨ); nasal `ee`→ẽ, `oo`→ɒ̃; diphthongs `ai`→ai̯, `au`→au̯, `aw`→aɨ̯, `ia`→iə̯,
  `ua`→uə̯.

## Run 3 — result + the honesty check

**100% on the referee (455/455 raw exact)** — but that number is **circular**: the maps were derived *from* this same
referee, and RPA is deterministic, so 100% just says "the converter reproduces its source." The honest test of whether
the *compositional* maps generalise (vs memorise words) is a held-out cross-validation:

> **5-fold held-out segmental CV = 94.1%** (428/455).

A word-lookup would score ~0 held-out; 94.1% shows the onset/rime/tone maps genuinely generalise to unseen RPA
syllables (the misses are rare onsets/rimes underrepresented in a training fold). Reliability ultimately rests on
**RPA's determinism** — the maps *are* the documented RPA→IPA tables, which Wiktionary's referee also follows (so
100% agreement is reference-parity-flavoured). **🔷 single-source (thin, ~455).** The eval folds tones (Chao letters,
backbone-stripped both sides) + nasalisation + the glottal onset; it validates the segmental backbone.

**Deferred:** the Green Hmong / Mong Njua (`hnj`) variety (a servable sibling — different sibilants/laterals), tone
sandhi, and the polysyllabic loan proper-nouns (written space-separated in real text; the referee's spaceless forms
are excluded from the single-syllable eval).

## Run 4 — review fixes (coverage + honesty)

Review caught a real coverage-and-honesty hole: the onset map held only the ~50 onsets *attested in the 455-word
referee*, so ~11 standard White Hmong onsets were **missing** and common words fell through as raw RPA — notably
`nrhiav` "to search" (one of the commonest Hmong verbs) → `"nrhiav"`, plus `rho`/`nphoo`/`mlom`/`dlub`/`nchuav`.
Crucially, **neither the 100% nor the 94.1% held-out CV can detect this** — both derive from the same referee, i.e.
the same onset inventory — so the earlier "the caveat is validation breadth, not converter reliability" phrasing was
wrong-way-round: reliability *was* affected.

**Fixes:** (1) spec-filled the 11 missing onsets from the documented RPA tables (series-consistent: `nrh`→ᶯʈʰ,
`rh`→ʈʰ, `nph`→ᵐpʰ, `nqh`→ᶰqʰ, `nch`→ᶮcʰ, `ml`→mˡ, `hml`→m̥ˡ, `dl`→tˡ, `dlh`→tˡʰ, `ndl`→ⁿdˡ, `ndlh`→ⁿtˡʰ) → 61 onsets,
`nrhiav`→ᶯʈʰiə̯˧˦; the referee eval is unchanged (these onsets aren't in it). (2) Reframed every disclosure to name
the **unseen-onset → raw-passthrough** failure mode + flag the 11 spec-filled onsets as referee-unattested. (3)
Committed the held-out CV script (`hmn-heldout-cv.ts`) so the 94.1% is reproducible, not just asserted.

The residual honest caveat: an onset genuinely outside the (now spec-complete) map still passes through raw — but
the standard RPA onset inventory is now covered, so this only bites on non-standard/foreign spellings.
