# Basque (eu) native bring-up investigation

Target: **Basque** (euskara) — a **language ISOLATE** (no living relatives, no established family),
spoken in the Basque Country (Spain/France), ~750k speakers. Latin script, highly phonemic
orthography. Canonical IPA, espeak-independent.

## Run 1 — referee landscape (2026-07-27)

- **wikipron `eus_latn_broad`**: 20,114 pairs, HUMAN, space-segmented. → PRIMARY.
- **wikipron `eus_latn_narrow`**: 20,079 pairs, HUMAN — but VERY fine (intervocalic spirantization
  b→β̞ d→ð̞ g→ɣ̞, dental d̪ n̪, nasalized vowels ẽ õ). → SECONDARY (measures sub-phonemic allophony
  a canonical engine doesn't emit; scores ~48% for that reason, not a deficiency).
- **epitran `eus-Latn`**: the module exists but its datafile is ABSENT in this install → unusable.
- kaikki Basque: 53 MB (not needed given the 20k wikipron).

🔷 single-source-FAMILY (broad + narrow both wikipron). Large + HUMAN.

## Run 2 — the phonology

★★ **THE HALLMARK — the THREE-WAY SIBILANT / affricate system** (laminal vs apical vs postalveolar):
- fricatives ⟨z⟩→[s̻] (laminal), ⟨s⟩→[s̺] (apical), ⟨x⟩→[ʃ]
- affricates ⟨tz⟩→[t͡s̻], ⟨ts⟩→[t͡s̺], ⟨tx⟩→[t͡ʃ]
Minimal pairs: zu 'you'→[s̻u] vs su 'fire'→[s̺u]; atzo→[at͡s̻o] vs hots→[ot͡s̺].
★ **⟨r⟩** — TAP [ɾ] between vowels, TRILL [r] word-finally / before a consonant / doubled ⟨rr⟩
(udare→[udaɾe], hartu→[hartu], agirre→[aɡire]). ★ **palatals** ⟨tt⟩→[c], ⟨dd⟩→[ɟ], ⟨ll⟩→[ʎ], ⟨ñ⟩→[ɲ].
★ **⟨j⟩→[x]** (southern/Gipuzkoan standard). ★ **⟨g⟩→[ɡ]** always (no soft g). ⟨h⟩→[h] (see below).
Diphthong offglides ⟨i u⟩→[i̯ u̯] written as plain vowels (the non-syllabic mark folds).

★ **THE DIALECT-VARIABLE LETTERS.** ★ **METRIC NOTE (review-corrected):** the referee records each
dialectal variant of a word on a SEPARATE ROW (hasi→[as̺i] and hasi→[has̺i] are two independent rows),
and this eval scores every row independently — it does NOT merge/OR variants across a headword (that
Galician-style merge was deliberately NOT applied here). So **84.8% is a STRICT per-pronunciation
number**, not a lenient best-of: a dialect-variable letter wins only its matching-variant rows (a
true best-per-headword reading, ~1.67 prons/word, would score materially higher). The choices below
are therefore genuine trades, not free:
- **z/s laminal↔apical** is NEUTRALISED in the west — the referee lists BOTH s̺ and s̻ for ⟨z⟩
  (zu→s̺u AND s̻u). The eval BACKBONE strips the apical/laminal diacritics (U+033A/033B) anyway → s̺
  and s̻ both fold to [s] in comparison, so the score can't measure this contrast (and the referee
  couldn't validate it). We EMIT the standard three-way for canonical output; disclosed as folded.
- **⟨j⟩** has 4 referee variants [x j ɟ d͡ʒ] — dialectal; we emit [x] (the southern standard). Nearly a
  wash by row count (~65 x-rows ≈ 64 j-rows), so the choice barely moves the score.
- **⟨h⟩** silent (south) ~ [h] (north) — the referee lists both on separate rows; EMITTING [h] scored
  higher (measured over all 20,115 rows: [h] 84.84% vs drop-h 84.19%, +131 rows) and is faithful to
  the spelling, so ⟨h⟩→[h].

## Run 3 — build + tune

Self-contained greedy digraph+letter scan (basque.ts). First pass (h dropped) **84.2% folded /
98.0% symbol**; switched ⟨h⟩→[h] → **84.8% / 98.0%**. NO folds needed (the sibilant diacritics fold
in the backbone). Residual = loanword letters (Cancer→soft-c [kanser]; Abkhazia ⟨kh⟩→[x]) + the
BASQUE ALPHABET LETTER-NAMES (single-letter citations B→[be], C→[s̻e], H→[at͡ʃe] — irregular, ~27
words) + the ⟨h⟩/⟨j⟩ dialect variants (a wash). None are engine bugs.

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — 1 real bug:** the recurring NFC trap. `phonemizeWord`/`text()` didn't
NFC-normalize, so NFD input dropped ⟨ñ⟩/⟨ç⟩ and shattered the word (ñaño[NFD]→"nano" / "n an o").
FIX: NFC-normalize in both (mirroring chuvash.ts). All other wiring/parsing correct (digraph loop,
r tap/trill on raw graphemes, TOKEN, ⟨tt⟩ vs t+t).

**Phonology reviewer — engine SOUND, no bugs**, but caught a **metric-framing error in my docs**
(now corrected above): I had claimed "the eval credits the best-matching variant per word." FALSE —
the wikipron file stores one pronunciation per ROW (hasi→[as̺i] and [has̺i] are two rows) and this
eval scores each row independently; it does NOT OR across a headword (that Galician-style merge was
not applied). So 84.8% is a *stricter* per-pronunciation metric — the engine is actually better than
the number under a per-headword reading. Corrected the wording in eu.jsonc, this doc, the floor
comment, and language-maturity.md. The reviewer also empirically CONFIRMED the deferrals: (a) ⟨h⟩→[h]
84.84% vs drop-h 84.19% (keep h — right); (b) i-palatalization ⟨il in⟩→[iʎ iɲ] nets −14 rows
intervocalic / −2880 blanket AND is non-canonical for Standard Batua → correctly omitted; (c) soft-c
only 8 rows (+0.04pp) → correctly deferred; (d) the sibilant DIRECTION (z=laminal, s=apical) is right;
(e) plain ⟨n⟩ (no ŋ assimilation) correct for the broad target.

**Final: 84.8% folded / 98.0% symbol** (broad primary). Floor 0.82. Goldens (4 tests incl. the zu/su
minimal pair), the 150-test referee floor, and typecheck all green.

## Run 5 — deferred follow-up: NUMBERS + resolving the other two (2026-07-27)

**Numbers DONE — the Basque VIGESIMAL (base-20) system.** 0-19 listed; the tens are scores of
20 (20 hogei, 40 berrogei=2×20, 60 hirurogei=3×20, 80 laurogei=4×20) with the ⟨-ta⟩ connective
for a remainder (30=hogeita hamar); hundreds prefix the system (ehun, berrehun…) + the free
⟨eta⟩ connective (once, before the final sub-100 group), then ⟨mila⟩/⟨milioi⟩. 20→hogei,
40→berroɡei (⟨rr⟩→[r] trill), 60→hiɾuɾoɡei (single ⟨r⟩→[ɾ] tap), 234→berehun eta hoɡeita hamalau,
2025→bi mila eta hoɡeita bos̺t. The composition isn't referee-validated (no composed numbers in
the wikipron dump) but every COMPONENT word is (bat→bat, hiru→hiɾu, hogei→hoɡei̯…). Goldens added.

**i-palatalization + letter-names — evaluated and REJECTED (not genuine deferrals).** Re-measured
first-hand: intervocalic ⟨il in⟩→[iʎ iɲ] nets **−14 rows (17065→17051)** — the referee lists BOTH
forms per word and the non-palatalized is the majority, and it's non-canonical for Standard Batua.
The alphabet letter-names (B→[be], ~27 citation rows) are citation artifacts with no real-text value
and a single-letter→name rule would misfire on real one-letter tokens. Both correctly NOT implemented.
