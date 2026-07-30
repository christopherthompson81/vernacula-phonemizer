# Latgalian (ltg) native bring-up investigation

Target: **Latgalian** (latgaļu volūda) — an EASTERN BALTIC language (~150k, Latgale in eastern
Latvia), a close sibling of Latvian (sometimes considered a Latvian dialect, but with its own
literary standard + ISO code). Latin script. Canonical IPA, espeak-independent. **The fleet's 3rd
Baltic language** (after Latvian lv, Lithuanian lt).

## Run 1 — referee landscape (2026-07-27)

- **wikipron `ltg_latn_narrow`**: 488 pairs, HUMAN, space-segmented — NARROW (marks pitch accent,
  full palatalization, diphthong glides, length). → PRIMARY.
- **kaikki Latgalian**: 2 MB dump → 516 IPA pairs (also narrow-ish). → SECONDARY.
- **epitran**: none.
Two corroborating HUMAN referees (both Wiktionary → 🔷 single-source-family, but two + large).

## Run 2 — the phonology

★★ **THE SIGNATURE — the ⟨i⟩/⟨y⟩ soft/hard split.** The front vowel letters ⟨i ī e ē⟩ PALATALIZE the
preceding consonant(s) (ci→[t͡sʲi], bet→[bʲæt], acis→[at͡sʲis]), but **⟨y⟩→[ɨ]** is a HARD central vowel
(Latvian has no [ɨ]) that does NOT palatalize (cylvāks→[t͡sɨlvaːks], byut→[bɨut]). ★ Palatalization is an
ONSET-CLUSTER rule — the whole onset before a front vowel softens (bazneica→[bazʲnʲæit͡sa]). ★ Vowels
⟨a e i o u y⟩→[a æ i ɔ u ɨ], macron = LONG (⟨ā ē ī ū ō ȳ⟩→[aː …]). Consonants: ⟨c č š ž⟩→[t͡s t͡ʃ ʃ ʒ],
⟨dz dž tz⟩→[d͡z d͡ʒ d͡z], the written palatals ⟨ļ ņ ģ ķ ř⟩→[lʲ nʲ ɡʲ kʲ rʲ], ⟨v⟩→[w] in a coda. Baltic
VOICING assimilation in obstruent clusters (Latgola→[ladɡɔla], absurds→[apsurt͡s]). ★ Latgalian's PITCH
ACCENT (level/falling/broken, marked in the narrow referee — à â ì) is NOT written → not emitted (it
folds; the backbone strips the combining marks).

## Run 3 — build + tune

Self-contained scan (latgalian.ts) → onset palatalization → regressive voicing assimilation. **65.6%
folded / 93.3% symbol (wikipron)** + **64.7% / 93.1% symbol (kaikki)**. ★ The high SYMBOL accuracy
(93%) is the truer signal — the segment inventory is right; the folded exact-match is dragged by the
narrow referee's detail. ★ CODA palatalization was TESTED and REVERTED: a blanket "coda after a front
vowel palatalizes" rule DROPPED the score 65.6→52.5% — the referee palatalizes codas SELECTIVELY /
lexically (acis→at͡sʲis keeps a HARD final -s, but ass→asʲsʲ and audzieknis→…nʲisʲ soften it), so
onset-only is the right approximation. Folds: ⟨e⟩ ɛ~æ (the referee writes both), vowel LENGTH ː (narrow
referee inconsistent + interacts with the pitch marks — strip to compare the segment skeleton).

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — CORRECT, no bugs.** The palatalization pass (forward-scan, no double-ʲ), the
voicing pass (sonorant exclusion, multi-char seg matching, final devoicing), the digraphs, NFC, and the
case-insensitive TOKEN all verified. Flagged the word-final ⟨v⟩→[w] (should devoice to [f]).

**Phonology reviewer (28 probe words, both referees) — all load-bearing decisions CONFIRMED correct**
(the ⟨i⟩/⟨y⟩ split + [ɨ], ⟨o⟩→[ɔ] not Latvian's [uɔ̯], ē→[æː], the written palatals as [Cʲ] not the
Latvian true-palatals, regressive voicing, diphthongs, tone deferral). THREE fixes applied (+12pp both
referees, 65.6→77.7% / 64.7→76.0%):
- ★ **(B) t-EPENTHESIS** (the biggest residual): a word-final ⟨s⟩/⟨š⟩ after /n ņ/ surfaces with an
  epenthetic [t] → [t͡s]/[t͡ʃ] (sens→sʲænt͡s, kaimiņš→kaimʲinʲt͡ʃ) — the huge -ons nominative + -eņš/-iņš
  diminutive class. Fires only after a nasal (NOT m l r p k: gols→ɡɔls stays).
- ★ **(A) /r/-cluster OPACITY** — an obstruent+⟨r⟩ cluster stays HARD (treis→trɛis, not tʲrʲæis), but a
  SIMPLE ⟨r⟩ onset still palatalizes (svareigs→sʋarʲæiks). Also DROPPED the unsupported bare-[j]
  palatalization trigger (cjoce→t͡sjɔt͡sʲæ, hard c).
- ★ **(C) word-final ⟨v⟩→[f]** (div→dʲif) — v→[w] only before a consonant now; word-final v devoices.
- CONFIRMED-deferred: CODA palatalization is genuinely lexical/morphophonemic (nest→nʲæsʲtʲ but
  desmit→dʲɛsʲmʲit keeps a hard -t; acis→…s hard vs lasis→…sʲ soft) → onset-only is right; the ⟨e⟩
  [æ]/[ɛ] split (folded); ⟨ģ ķ ř⟩ unverified (0 referee words). NOTE: no stress emitted (unlike lv) —
  Latgalian stress is mostly-initial-with-loan-exceptions, so emitting nothing is safer than wrong-initial.

**Final: wikipron 77.7% folded / 93.3% symbol; kaikki 76.0% / 93.1% symbol.** Floor 0.72. Goldens (4
tests incl. the epenthesis/r-cluster/final-v fixes), the 154-test floor, typecheck green.

## Run 5 — 2026-07-28 18:00 — cardinal number compositor (numbers were deferred)

Question: `phonemize("<int>", "ltg")` leaked the digits through. Probe: 110/110 DIGIT-LEAK.

**Pattern B**, data + logic both in `src/languages/latgalian/numbers.ts` — Latgalian has no `.jsonc` manifest
(the engine is a single .ts), so the numeral table is authored in the module, the Somali/Irish shape.

Sources: the Latgalian school grammar's numeral chapter, "SKAITĻA VĀRDS", Latgalīšu daslēdzis škola
(lynuojs.wordpress.com/gramatika/skaitla-vards/) — masculine series, teens, round tens, symts / tyukstūša /
miļjons / miļjards, **and the separate feminine series**; cross-checked against Omniglot "Numbers in Latgalian"
(which independently confirms "divdesmit vīns" 21, "div(i) symti" 200, "pīci symti pīcdesmit pīci" 555).

**Finding that changed the implementation:** unlike Latvian, whose *tūkstotis* is masculine, Latgalian
**tyukstūša is FEMININE** (grammar: a 4th-declension noun, example "sešys tyukstūšys"). A numeral agrees with its
counted noun, so the thousands multiplier had to be switched to the feminine unit series (sešys, not *seši;
21000 → divdesmit vīna tyukstūša) while symts/miļjons/miļjards, being masculine, keep the masculine one. Naively
copying the Latvian compositor would have emitted the wrong gender on every thousands group.

Contested / unattested, flagged in the module: **40 and 14** — the grammar gives četrudesmit / četrupadsmit (with
the genitive-plural stem četru-), Omniglot gives četrdesmit; ltg.wikipedia's corpus is too small to settle it
(1 hit for četrdesmit, 0 for četrudesmit). The prescriptive grammar is followed since it is internally consistent
across both the ten and the teen. **0** is in neither source; "nulle" is used (the Latvian form) and marked
UNATTESTED for Latgalian. CASE concord beyond the nominative is deferred, as in the Latvian engine.

Result: probe **CLEAN** across the required range. Tests in test/latgalian.test.ts.
