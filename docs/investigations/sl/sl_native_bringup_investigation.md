# Slovenian (slovenščina, sl) bring-up — South Slavic, ~2.5M

Slovenian, South Slavic (~2.5M), the westernmost South Slavic standard. Latin (Gaj-based, 25 letters: a–z minus q/w/x/y,
plus č š ž). NOT part of the Serbo-Croatian shared engine — Slovene has its own phonology (l-vocalization, schwa,
pitch accent, no ć/đ/lj-nj palatal phonemes). Referee: **wikipron `slv_latn_broad`** (human, CUNY-CL/wikipron, 5,177
unique headwords) — the "broad" set is actually heavily suprasegmental (pitch + length + open/close quality).

## Run 1 — 2026-07-25 14:00 — Slovak-shaped rule engine + Slovene vocalization rules

**Structure reused from Slovak** (`src/languages/slovak/g2p.ts`): the scan → syllabic → voicing pipeline (regressive
voicing assimilation + word-final devoicing are the shared West/South-Slavic machinery). Slovene DROPS Slovak's
palatalization (no ɟ/c/ɲ/ʎ) and vowel-length letters (Slovene writes none).

**The Slovene-specific phonology, all derived empirically from the referee (grep-confirmed):**
- **⟨l⟩-vocalization**: coda / word-final ⟨l⟩ → [w] (referee ʋ~u̯): bel→bɛʋ, sol→soʋ, Volk→ʋɔʋk, jabolko→jabɔʋkɔ.
  ⟨l⟩ before a vowel stays [l] (šola→ʃɔla). Lexical exceptions exist (learned words keep [l]) → residual.
- **⟨lj⟩ / ⟨nj⟩**: [lj]/[nj] before a vowel (polje→pɔljɛ, banja→banja); the j DROPS in coda/final (kralj→kral,
  konj→kɔn). Not palatal phonemes (unlike Serbo-Croatian ʎ/ɲ).
- **⟨v⟩ → [ʋ]** everywhere (voda→ʋɔda, avto→aʋtɔ, siv→siʋ); the coda [w]/[u̯] realization is narrow → folded.
- **Syllabic ⟨r⟩ → [ər]** (schwa before r) when it has no vowel neighbour: prst→pərst, vrt→ʋərt, smrt→smərt.
- **Final devoicing + regressive voicing assimilation**: grad→ɡrat, rob→rop, nož→nɔʃ; glasba→ɡlazba (s→z before b),
  Afganistan→aʋɡanistan (f→ʋ before ɡ). ⟨v⟩ is inert (sonorant-like, never [f], never triggers).
- Consonants: ⟨c⟩→t͡s, ⟨č⟩→t͡ʃ, ⟨š⟩→ʃ, ⟨ž⟩→ʒ, ⟨dž⟩→d͡ʒ, ⟨j⟩→j, ⟨h⟩→x; foreign ⟨x⟩→ks.

**The vowel axis is FOLDED (Slovene orthography underspecifies it — the sv lesson: prosody is the hard part):**
- **Quality is stress-conditioned**: STRESSED mids are close+long [eː oː] (devet→dɛʋeːt, milijon→milijoːn), UNSTRESSED
  are open+short [ɛ ɔ]. Stress is FREE/lexical (unmarked). → we emit the open ɛ/ɔ default and FOLD e→ɛ, o→ɔ, ː away
  (the same treatment Galician gives ɛ/ɔ, sr/hr/sv give pitch+length).
- **Schwa [ə] is morphological** (sedem→seːdəm, dober→dɔbər, Albanec→albaːnəts) and NOT spelling-predictable (the same
  ⟨e⟩ letter is [e]/[ɛ]/[ə] by stress+morphology: devet's final ⟨e⟩ is stressed [eː], dober's is [ə]) → we emit ɛ and
  FOLD ə→ɛ (only the syllabic-r schwa is rule-emitted). A schwa/stress lexicon is the honest fix (deferred).
- **PITCH ACCENT** (tonemic àáâ + ɛ̀/ɔ́ etc.): unwritten → the combining tone diacritics are BACKBONE-stripped; we
  emit none (as in Serbian/Croatian).

So the measured signal is the CONSONANT skeleton + the vocalization rules (l→ʋ, lj/nj, syllabic-r) + voicing, NOT the
vowel quality/length/pitch (all folded — Slovene spelling doesn't encode them). Numbers use the Germanic-style
**unit-in-ten inversion** (21 = enaindvajset "one-and-twenty"); no numeric referee exists → standard forms.

## Run 1 results — 2026-07-25 14:20

`npx tsx tools/referee-eval/eval.ts sl`: **94.1% folded / 98.7% symbol accuracy** (5,177 headwords). Raw exact 1.4%
(expected — we emit the open ɛ/ɔ default + no stress/length/pitch the referee carries). The residual is dominated by
(a) **letter-name/glyph junk headwords** (D→"dè", B→"bè", DŽ→"dʒè", plus non-Slovene single glyphs Ä/À/Ì) and
(b) **foreign-name source pronunciations** (Dublin→dablin, Greif→ɡrajf, København, Sydney→sidni) — referee noise, not
engine defects; real-word accuracy is higher (symbol 98.7% confirms it).

**l-vocalization — MEASURED and DEFERRED (the key decision).** The first draft applied a blanket coda-⟨l⟩→ʋ rule
(bel→bɛʋ, Volk→ʋɔʋk) and scored **92.2%**. But the review-of-mismatches showed it OVER-applies: most coda-l words in
this (Wiktionary, name-heavy) referee KEEP [l] because they are loans/proper nouns (Balkan→balkan, Belgija→bɛlɡija,
Ahil→axil, Aristotel→aristɔtɛl). Slovene l→[w] is LEXICAL (native words vocalize; loans keep [l]) — not
spelling-predictable. Measured directly: the referee has **~233 kept-[l] vs ~101 vocalized** coda-l words, and
disabling the rule scored **94.2%** (+2.0pp). Per the rule-then-lexicon discipline (a rule-unpredictable feature
belongs in a lexicon, not a blanket rule), ⟨l⟩=[l] is the default and the native vocalization is DEFERRED to a future
lexicon. (This is a dictionary-vs-running-text tension: the very common -l past participles DO vocalize (bil→biw,
delal→delaw) but are under-represented in a name-heavy dictionary — the nb frequency-weighting lesson.)

**Then, review-of-mismatches → 3 clearly-correct minimal fixes** (referee-flat but linguistically right, net ~94.1%):
⟨w⟩→ʋ (loans: Wikipedija→ʋikipɛdija), ⟨h⟩=[x] is voicing-NEUTRAL so it doesn't devoice a preceding obstruent
(Abhazija→abxazija, not apxazija), and syllabic ⟨l⟩→əl (Vltava→ʋəltaʋa) — the last guarded so it does NOT fire on the
⟨lj⟩-split l (a bug that briefly made Ljubljana→əljubəljana; a liquid before the glide j is an onset, not syllabic).
A blanket **degemination** pass was TRIED and DROPPED (net-neutral + it wrongly collapses the ~9 morpheme-boundary
geminates Slovene keeps: od+d…; loan degemination like Valletta is a foreign-name edge only).

**Status: 🔷 (single-source, name-heavy referee).** wikipron slv_latn_broad is the only committed referee; no kaikki
slv / epitran slv exists. **Deferred:** the l-vocalization lexicon; a stress/schwa lexicon (Slovene stress is free +
unwritten → we emit none, and the morphological schwa is folded); the pitch accent (tonemic, unwritten); a 2nd referee.

## Run 2 — 2026-07-25 19:30 — review (8 angles) → fixes → 96.5% / 99.4%

The multi-angle review confirmed the core machinery is correct (voicing/devoicing, the ⟨h⟩=[x]-voicing-neutral claim
verified: vzhod→ʋzxɔt keeps the voiced z; lj/nj coda-j-drop; syllabic-r; v→ʋ inertness) and found real fixes:
- **Silent grapheme drops (HIGH):** the tokenizer admitted ⟨ć đ⟩ but the scan had no mapping → they vanished
  (Đorđe→ɔrɔ). Added ⟨ć⟩→t͡ʃ, ⟨đ⟩→d͡ʒ (Serbo-Croatian loans/names), ⟨q⟩→k, ⟨y⟩→i (Sydney→sidni).
- **Number digit-gate off-by-one (HIGH):** `text()` routed 12-digit inputs to digit-by-digit, but the compositor
  composes <10¹² (12 digits) — so 100000000000 read "ena nič nič…" instead of "sto milijard". Gate ≤11 → ≤15.
- **Numeral gender agreement (MEDIUM):** Slovene 2–4 agree with the magnitude noun's gender — milijon is masculine
  (2 dva / 3 trije / 4 štirje milijoni), milijarda feminine (2 **dve** milijardi). The first cut used the invariant
  citation forms (dva milijardi, tri milijoni) → fixed with a per-magnitude gendered count table (compound counts
  like 22 keep the plain dvaindvajset). No numeric referee → standard forms.
- **syllabic-⟨l⟩ removed (cleanup):** the Slovak engine's syllabic-l was an unvalidated carryover — Slovene has no
  productive syllabic /l/, it only touched the one loanword Vltava, and it str/anded a true syllabic-r in an r+l
  cluster (čmrlj→t͡ʃmrəl instead of t͡ʃmərl). Restricted to ⟨r⟩ only; čmrlj→t͡ʃmərl now correct.

**Referee merge + provenance (altitude):** the raw dump listed each pronunciation variant on its own line (5,955
rows / 5,177 headwords), so it was scored over 5,955 rows while labeled "5,177 headwords", and the eval's
credit-any-attested-variant mechanism never fired. Merged the variants per-headword into tab-separated alternates
(the sibling sr format) + added the CC-BY-SA provenance header the sibling referees carry. **This is honest here (vs
the Galician dialect-merge, which folded real seseo/gheada/yeísmo contrasts):** the sl variants differ ONLY on the
suprasegmental axes ALREADY folded (length/pitch/quality/schwa), so the merge dedupes double-counted rows + credits
letter-name junk variants — it does NOT fold a new segmental contrast. Net of the fixes + merge: **96.5% folded /
99.4% symbol** over 5,177 headwords (the symbol accuracy is on the folded consonant backbone — it does not vouch for
the folded vowel axis).
