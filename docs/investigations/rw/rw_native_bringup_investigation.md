# Kinyarwanda (rw) native bring-up

Bantu (Guthrie JD61, Rwanda-Rundi), the Latin orthography. Cleanroom canonical-IPA
rule g2p, espeak-independent. Referee: **epitran kin-Latn only** (programmatic,
INDEPENDENT) → 🔷 single-source — and, unusually, a referee that is WRONG on the
language's signature features, so the headline is deliberately referee-deflated.

## Run 0 — 2026-07-17 — data check (and a licensing correction)

- **wikipron**: no Kinyarwanda.
- **kaikki**: no Kinyarwanda extract.
- **epitran `kin-Latn`**: works, but a probe against the grammar shows it
  mis-renders the whole PALATAL/affricate system: ⟨sh⟩→[xj] (grammar [ʃ]),
  ⟨cy⟩→[kj] ([c]), ⟨c⟩→[c] ([t͡ʃ]), ⟨j⟩→[ɟ] ([ʒ]), ⟨shy⟩→[xjj] ([ç]). Its emitted
  char inventory has no ʃ ʒ t͡ʃ ç at all.

**Wordlist / licensing.** The first wordlist came from the Leipzig Corpora
Collection — which is **CC BY-NC**, so it must NOT seed a committed referee in a
freely-usable repo. Discarded it. Rebuilt from the **CC0 Common Voice** Kinyarwanda
sentence corpus (`common-voice/common-voice` GitHub, `server/data/rw`, gate-free;
the HF Common Voice datasets were deprecated to Mozilla Data Collective in Oct 2025
and carry no phonemes anyway). Tokenised → 1600 frequency words; epitran generated
the IPA.

The grammar (Wikipedia Kinyarwanda phonology) gives the correct mappings: c→t͡ʃ,
j→ʒ, sh→ʃ, cy→c, jy→ɟ, shy→ç, by→bɟ, ry→ɾɟ, my→mɲ, py→pc, ny→ɲ; ng→ŋ (a plain
velar nasal); ⟨r⟩→ɾ; phonemic vowel length (double vowels); tone unwritten.

## Run 1 — 2026-07-17 — build + honest raw measurement: 80.4%

A pure greedy longest-match scan (Shona pattern; Kinyarwanda is open-CV). Measured
against epitran with **NO palatal folds**: **1287/1600 = 80.4%**.

Crucially, inspecting the residuals: **every single divergence is a palatal-grapheme
word** (cy/by/ry/my/c/sh/j/shy), and it is always epitran's grammar-wrong rendering
vs ours grammar-correct (cyane→ours [cane] vs epitran [kjane]; ishuri→[iʃuɾi] vs
[ixjuɾi]; jenoside→[ʒenoside] vs [ɟenoside]). Filtering the residuals for any
NON-palatal disagreement returns **zero**. So:

- On everything epitran can verify (the non-palatal bulk — vowels, plain C,
  prenasals ⟨mb nd nz…⟩, ⟨ng⟩→ŋ, labialisation ⟨Cw⟩, length), ours agrees ~100%.
- The ~20% gap is entirely epitran's palatal errors, where ours follows the grammar.

## Decision — report the deflated raw number, do NOT fold the palatals

The palatal disagreements are all systematic and foldable (epitran writes each
palatal grapheme a consistent wrong way), and folding them would push the headline
to ~99%. But that would INFLATE the number by asserting our (grammar-correct)
palatal values against a referee that can't corroborate them — dishonest. Instead,
per the project's "honesty over inflated numbers" principle, the headline is the
**raw 80.4%** (referee-deflated, like en's 36% and fa's 42.9%), with the story
disclosed: epitran corroborates the bulk; the palatal series rests on the grammar.
Floor 0.78. → 🔷 single-source.

Verified signatures (spot-check, all grammar-correct): cyane→[cane], byinshi→[bɟinʃi],
shyira→[çiɾa], jenoside→[ʒenoside], ijambo→[iʒambo], umuryango→[umuɾɟaŋo],
ishuri→[iʃuɾi], ngwino→[ŋwino], ubwenge→[ubweŋe], rwanda→[ɾwanda].

## Run 2 — 2026-07-17 — literary/phonetics corroboration (it PASSED)

Because epitran is wrong on exactly the signatures, I sought an INDEPENDENT
human reference that could FAIL the build (the Chhattisgarhi lesson). Wiktionary
has no Kinyarwanda IPA. But a phonetics study — **"An articulatory view of
Kinyarwanda coronal harmony"** (PMC2796083, a real instrumental study, independent
of both epitran and the Wikipedia phonology) — gives attested IPA:

- ⟨sh⟩ = [ʂ]~[ʃ] (a postalveolar/retroflex fricative), ⟨c⟩ = [t͡ʃ], ⟨j⟩ = [ʒ].

This **independently confirms OURS and refutes epitran** (which gives ⟨sh⟩→[xj],
⟨c⟩→[c], ⟨j⟩→[ɟ]) on precisely the palatals that drive the 20% referee gap. Our
engine reproduces the paper's example words (tones deferred; the paper's narrow
retroflex [ʂ] is our broad [ʃ]): gushaka→ours [ɡuʃaka] vs paper [ɡuʂaka];
shashe→[ʃaʃe] vs [ʂaʂe]; ziga→[ziɡa] vs [ziga]. It could have contradicted us
(e.g. if the paper had backed epitran's [xj]); it did not. So the palatal series
is no longer only grammar-asserted — it has independent phonetics backing, which
retroactively justifies NOT folding the palatals to epitran.

**One documented nuance:** the paper lists ⟨cy⟩ = [ç] (palatal fricative), whereas
the Wikipedia phonology gives ⟨cy⟩ = [c] (palatal stop) with ⟨shy⟩ = [ç]. We keep
**⟨cy⟩→[c]** — the Wikipedia system is internally consistent (cy=[c]/jy=[ɟ] palatal
stops vs shy=[ç] the fricative), and making cy=[ç] would merge it with ⟨shy⟩. The
[ç] alternative is noted but not adopted.

## Run 3 — 2026-07-17 — palatal REVISION from a comparative grammar (80.4→87.9%)

Revisiting the sourcing (does an equivalent to the Madurese JIPA text exist?)
surfaced the **Cox "Kirundi & Kinyarwanda Comparative Grammar"** — an independent
reference with an explicit phonemic consonant table (Table 25). It **overturned the
Wikipedia-based palatal analysis** we shipped:
- It CONFIRMS the plain series ⟨c⟩=[t͡ʃ], ⟨j⟩=[ʒ], ⟨sh⟩=[ʃ] (with the coronal paper) —
  refuting epitran there.
- But it analyses ⟨cy⟩=**[kʲ]** ("palatalised variant of /k/"), ⟨jy⟩=**[ɡʲ]**,
  ⟨shy⟩=**[ʃʲ]**, and the ⟨Cy⟩ class as **palatalised consonants** [Cʲ] — NOT the
  palatal segments [c ɟ ç bɟ ɾɟ] we took from Wikipedia (a single source). The
  grammar AND epitran (cy→kj, jy→ɡj) both back palatalisation.

**This corrected an error in Run 1's own writeup:** epitran is NOT "wrong on all
palatals." It is wrong on ⟨sh c j⟩ but *right* on ⟨cy jy⟩ (the palatalised velars).

We adopted the grammar's Table 25 palatalisation analysis uniformly (cy→kʲ, jy→ɡʲ,
shy→ʃʲ, by→bʲ, ry→ɾʲ, my→mʲ; ny→ɲ kept as the phonemic palatal nasal). Effects:
- Measured epitran agreement **80.4 → 87.9%** — cy/jy/by/ry/my now reconcile (folded
  ʲ~j, the grammar's secondary-articulation vs epitran's full glide).
- The residual collapses to exactly ⟨sh c j⟩ — where the Cox grammar AND the coronal
  paper confirm ours and epitran is wrong. Clean, honest.
- The palatal VALUES now rest on the **Cox grammar** (an independent human source),
  not Wikipedia alone — the 🔷 is properly earned, not papered over.

The literature genuinely CONTESTS Kinyarwanda palatalisation (Table 25's [Cʲ] vs
Kimenyi's feature-agreement C+y→Cʒy/Cʃy/Cɲy — which actually supports the old
⟨my⟩=[mɲ] — vs Wikipedia's palatal segments). We follow the Cox grammar's own
phonemic table (coherent, single-analysis, independently authored). The [mɲ]/[ç]
alternatives are noted, not adopted.

## Deferred

- **Tone** (H/L, phonemic but unwritten — the standard orthography marks none).
- ~~The noun-class **number concord** (20 = makumi *abiri*; our composer uses the
  bare unit).~~ **RESOLVED** — see
  `docs/investigations/numbers/niger_congo_number_compositor_investigation.md` Run 2: each magnitude now
  carries its own multiplier series (mirongo i-, magana a-, ibihumbi bi-, 20 =
  makumyabiri), sourced from languagesandnumbers/Omniglot/mofeko + Harvard ELIAS.
  What remains simplified: thousand-multipliers ≥ 10 fall back to the citation
  series, and the `na` connector is not elided before a vowel (icumi na umunani,
  not icumi n'umunani). Numbers are still unmeasured (the referee is word-only).
- ⟨sh c j⟩ remain epitran disagreements (epitran wrong; ours grammar+phonetics
  corroborated) — an inherent ceiling on the epitran number, not a defect.
- **Homorganic nasal assimilation before palatals** (njye→[ɲɟe] not [nɟe],
  nshya→[ɲça]): a real but narrow Bantu allophonic process, left unmodelled — it is
  unverifiable against epitran, and the clean greedy g2p is kept rather than adding
  a place-assimilation rule with no referee to catch a mistake. Noted by the PR
  review as a conscious convention match, not a bug.
