# Lule Sami (smj) native bring-up investigation

Target: **Lule Sami** (julevsámegiella), Uralic (Saami branch), ~700–2000 speakers (Norway/Sweden), Latin
orthography (the 1983 standard). Canonical IPA, espeak-independent. Reference: **Ylikoski, "Lule Saami"** (a
published reference chapter — the bho/Crawford grammar-mined mold).

## Run 1 — referee landscape (2026-07-28)

REFEREE-POOR (the Nogai/Totontepec tier), but NOT infeasible:
- **wikipron**: none (smj_latn_broad 404). **kaikki Lule Sami**: 970 entries but **ZERO IPA** (bare forms +
  glosses only). **Wiktionary "Lule Sami terms with IPA"**: 0 members. So NO machine IPA referee.
- **ASJP `LULE_SAAMI` + `LULE_SAAMI_2`** (Lexibank, CC0, Wichmann) — ~99 coarse Swadesh forms with segmented
  IPA. INDEPENDENT. → joined with kaikki (gloss→standard-orthography) = **51 raw pairs** (the Nogai method).
  ASJP is COARSE (no length, folds vowel quality to ɐ/e/o, simplifies geminates, marks palatalisation ʲ) →
  an INVENTORY/segmental check, not a quality signal. Curated to drop gloss-collision noise.
- Reference grammar (Ylikoski) — the g2p phonology anchor; itself gives /IPA/ for many example words.

★★ ASJP CORROBORATES the key grammar mappings: pena=[penɐ] (bena 'dog', **⟨b⟩→[p]**!), kuoktɐ (guokta,
**⟨g⟩→[k]**, **⟨uo⟩→[uo]**), tolo (dållå, **⟨d⟩→[t]**, **⟨å⟩→[o]**), tʃʲoɐrve (tjoarvve, **⟨tj⟩→[t͡ʃ]**,
**⟨oa⟩→[oɑ]**), pieʎe (biellje, ⟨lj⟩ realized [ʎ] — Ylikoski analyses it /lj/, no phonemic /ʎ/), ɲune (njunnje,
**⟨nj⟩→[ɲ]**), ulmuʃ (**⟨sj⟩→[ʃ]**).

## Run 2 — the phonology (Ylikoski §9.2)

★ **VOWELS** /i u e o ɑ/ + /ɑː/; length mostly UNWRITTEN (only ⟨a⟩ /ɑ/ vs ⟨á⟩ /ɑː/ distinguished; /o/-/oː/,
/e/-/eː/ etc. not). ⟨å⟩→/o/, ⟨á⟩→/ɑː/, ⟨a⟩→/ɑ/, ⟨æ⟩(No)/⟨ä⟩(Sw)→/æ/, loan ⟨y u ø/ö⟩. **DIPHTHONGS** ⟨ie uo
oa⟩ (2nd-syllable ⟨uo⟩→⟨o⟩, ⟨ie⟩→⟨e⟩ in the reduced spelling).
★★ **THE ORTHOGRAPHY TRAP** (North-Saami-style): word-initial ⟨b d g⟩ = **VOICELESS UNASPIRATED [p t k]** (NOT
voiced) — bena=/peːnə/, dálla=/tɑːlːɑ/, giella=/kiellɑ/ — the traditional phonology (younger speakers voice
them; new loans have true /b d g/). ⟨p t k⟩ = the marginal ASPIRATED [pʰ tʰ kʰ] (loans). We emit the VOICELESS
[p t k] baseline (ASJP-confirmed) + [pʰ tʰ kʰ] for ⟨p t k⟩ (fold ʰ).
★ **CONSONANTS**: ⟨s⟩→s, ⟨sj⟩→ʃ, ⟨tj⟩→t͡ʃ, ⟨ts⟩→t͡s, ⟨dtj⟩→d͡ʒ, ⟨dts⟩→d͡z (voiced affricates geminate-only),
⟨nj⟩→ɲ, ⟨ŋ⟩→ŋ, ⟨lj⟩→ʎ, ⟨v⟩→v, ⟨j⟩→j, ⟨r⟩→r, ⟨l⟩→l, ⟨f⟩→f, ⟨h⟩→h, ⟨m n⟩. Pre-stop ⟨h⟩ (⟨hk hp ht⟩) = the
gradation/pre-aspiration marker (phonetic [ʰ]; ASJP omits it → fold). Doubled consonant → geminate [Cː].
★ **PROSODY**: primary stress on the FIRST syllable (fixed).

★★ **THE DEFERRED MORPHOPHONOLOGY** (the honest residual — Lule Sami is morphophonologically COMPLEX, §9.2.5):
3-grade CONSONANT GRADATION (partly written via C-doubling), EPENTHETIC short vowels in Grade-III heterorganic
clusters (barggo=/parˀkuo/[parᵊkuo]), partial LABIAL HARMONY (2nd-syllable ɑ→o after 1st-syll o), 2nd-syllable
VOWEL LENGTHENING, and pervasive UNWRITTEN length. These need morphology + are NOT recoverable from a segmental
scan → the disclosed deferred layer. The engine does a TRANSPARENT SEGMENTAL scan; the coarse ASJP referee
(length-folding, geminate-simplifying) is well-matched to that scope.

## Run 3 — architecture + measurement

Engine (smj.ts): a self-contained grapheme scan (digraphs longest-first) → the grammar's grapheme→IPA. Referee:
the curated ASJP×kaikki join (independent, coarse — inventory-level).

First pass: 60.5% folded / 83.5% symbol. Tuning (all principled folds, not curve-fitting):
- **VOICING**: ASJP's LULE_SAAMI_2 doculect transcribes ⟨b d g⟩ as voiced [b d ɡ]; the grammar analyses them as
  VOICELESS [p t k] (§9.2.2, the younger-speaker/loan voicing is the non-traditional variant). Fold voiced→
  voiceless (b→p, g→k, d→t with a negative lookahead protecting the affricates d͡ʒ/d͡z). ★ BUG: the first g→k
  fold used script ⟨ɡ⟩ (U+0261) but ASJP uses regular ⟨g⟩ (U+0067) → never fired; fixed.
- **GEMINATION**: ASJP transcribes geminates inconsistently (nissun kept, tike/kuole simplified); we emit [Cː]
  (backbone strips ː → single) → collapse the referee's kept doubles to single. + the LULE_SAAMI_2 doubled-
  stressed-vowel convention (vuuoppto) → collapse VV→V.
- **pre-stop h** (⟨hk hp ht⟩ gradation/pre-aspiration): ASJP omits it (giehta→kietɐ) → fold h before a stop.

Final: **62.8% folded / 89.9% symbol** — SYMBOL is the honest headline. The remaining ~16 folded misses are
almost ALL the LULE_SAAMI_2 doculect's **un-orthographic LABIAL HARMONY** (harvve→horvva, siejbbe→siajbba —
2nd/1st-syllable a→o that is NOT cued by the spelling) + ASJP's coarse diphthong transcription (oa~uo) — i.e.
the DEFERRED morphophonology the referee happens to transcribe, not a segment-mapping bug. The engine is
faithful to the orthography. Goldens (test/lulesami.test.ts) pin the voiceless ⟨b d g⟩→[p t k] trap (bena→
ˈpena, giella→ˈkielːa, guokta→ˈkuokʰtʰa), the digraphs/diphthongs/geminates (tjoarvve→ˈt͡ʃoarvːe, njunnje→ˈɲuɲːe,
biellje→ˈpieʎːe), and the ⟨á⟩ length contrast.

**Final: 🔷 authored from Ylikoski, the fleet's FIRST SAAMI language. Referee-limited (43 coarse ASJP words,
inventory-level).** The segmental orthography→IPA is grammar-grounded + ASJP-confirmed on the key mappings; the
complex morphophonology (gradation/epenthesis/labial harmony/2nd-syllable lengthening/unwritten length) is the
disclosed deferred residual. Deferred: that morphophonology, the loan aspirated/voiced-stop + retroflex series,
numbers, a non-coarse referee.

## Run 4 — two-agent review (2026-07-28)

**Code/wiring reviewer — CLEAN.** Verified the MULTI longest-first ordering (no half-consumption), the scan
loop, the affricate-protection lookahead `d(?![ʒz])` (load-bearing on the backbone tie-strip running first —
d͡ʒ→dʒ then the lookahead declines), and re-confirmed the g→k codepoint fix (referee uses regular U+0067). Two
findings (both APPLIED): (1) loan letters c/q/w/x/z were silently DROPPED (TOKEN admits [a-z] but they were
unmapped) → added as Scandinavian loan-letter adaptations (c/q→k, w→v, x→ks, z→s; taxi→ˈtʰɑksi); (2) a redundant
ɐ in the vowel-collapse fold class → removed (now ɑ).

**Phonology reviewer (with grammar access) — SOUND, no gross error; ENDORSED the voiceless [p t k] hallmark**
as "the right canonical call" (§9.2.2). Found ONE substantive segment bug + inventory refinements (all APPLIED):
- ★ **Aspiration OVER-APPLIED**: ⟨p t k⟩→[pʰ tʰ kʰ] was blanket, but the aspirated series is WORD-INITIAL
  (loan) ONLY (§9.2.2); medially/in clusters ⟨p t k⟩ are PLAIN (Table 9.5: bargo=[parkuo]). **Gated aspiration
  to word-initial → the golden guokta is now ˈkuoktɑ (not kuokʰtʰa).** Geminates ⟨pp tt kk⟩→[pː tː kː] plain.
- **⟨ddj⟩ was missing** from MULTI (mis-parsed as dd+j=[tːj]) → added ⟨ddj⟩→[ɟː] (the geminate-only palatal
  stop, §9.2.2).
- **Low vowel /ɑ/**: the grammar's phoneme is unambiguously /ɑ ɑː/ (Table 9.1) → ⟨a⟩→ɑ, ⟨á⟩→ɑː, ⟨oa⟩→oɑ (was
  a/aː/oa); the ɐ→ɑ, ə→ɑ folds updated to match.
- **⟨lj⟩→ʎ re-labelled**: Ylikoski has NO phonemic /ʎ/ (Table 9.4) — ⟨lj⟩ is analysed /lj/; [ʎ] is the ASJP
  REALIZATION (which we emit, ASJP-corroborated). Disclosed as such (not claimed a grammar mapping).
Also noted (deferred, disclosed): non-initial ⟨o⟩/⟨e⟩ are the orthographically-reduced diphthongs /uo ie/
(emitted as monophthongs — a small orthography-cued loss); the retroflex ⟨rn rd rt rl⟩ loan series (default
clusters — right, since retroflex is loan-only and lexically contrastive). Score unchanged (62.8%/89.9%) — the
fixes were canonical-fidelity improvements that fold cleanly, not referee-chasing.
