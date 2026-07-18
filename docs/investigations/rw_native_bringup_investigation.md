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

## Deferred

- **Tone** (H/L, phonemic but unwritten — the standard orthography marks none).
- The noun-class **number concord** (20 = makumi *abiri*; our composer uses the
  bare unit). Numbers are unmeasured (the referee is word-only).
- A non-palatal-blind referee would be needed to lift this beyond 🔷 / to verify
  the palatal series independently — none exists (no wikipron/kaikki Kinyarwanda).
