# Sundanese (su) native bring-up

Sundanese / Basa Sunda — Austronesian, ~32M speakers in West Java, modern Latin orthography. The fourth
Austronesian language (with Indonesian, Javanese, Tagalog), and built on the same shallow-Latin pattern: a flat
left-to-right scan, since the orthography is near-phonemic.

## Data availability (checked up front)

- **wikipron sun** — none (0 lines).
- **epitran** — no Sundanese.
- **kaikki su** — 465 human IPA entries. The **only** referee; independent of the engine (Wiktionary), so it's a
  genuine single-referee measurement (like hi/si/ta/ko), not a circular one.

## The Sundanese profile (from kaikki)

- **A seven-vowel system.** The signature is the central vowel **⟨eu⟩→[ɨ]** (ieu→iɨ, eusi→ɨsi, seukeut→sɨkɨt;
  kaikki also writes [ɤ], folded), alongside **⟨e⟩→[ə]** (schwa: kecap→kət͡ʃap) and **⟨é⟩→[e]** (ngéwé→ŋewe).
  ⟨o⟩/⟨u⟩/⟨i⟩ lax in closed syllables (tolong→tɔlɔŋ, sarung→sarʊŋ — folded).
- **Consonants:** c→[t͡ʃ], j→[d͡ʒ], the digraphs ng→[ŋ]/ny→[ɲ], y→[j]; ⟨r⟩ is a tap/trill [r]~[ɾ].
- **Glottal stop.** A word-initial vowel takes [ʔ] (awi→ʔawi, indung→ʔinduŋ) and a same-vowel hiatus inserts one
  (naam→naʔam). We emit these by rule; kaikki marks them **erratically** (naam yes but waas no, awi yes but ieu
  no), so it can't adjudicate the glottal — stripped for comparison.
- Penultimate stress; Austronesian decimal numbers (units + -belas/-puluh/ratus/rebu, sa- for a leading 1).

## Run — first compile

**84.3% → 86.5%** vs kaikki. The base scan (digraphs, vowels, consonants, word-initial + hiatus glottal, penult
stress) → 84.3%; then folding the glottal fully (kaikki-inconsistent) → 86.2%, and the r~ɾ tap notation → 86.5%.
A brief detour: outputting the tap as [ɾ] *dropped* the score to 63.7% because kaikki writes plain [r] for the
majority of words — reverted to [r] + a fold.

## Verdict — ✅ Referee-limited (single independent referee)

**86.5% folded vs kaikki su (465, the only referee)** — a shallow, highly rule-derivable Latin g2p, same shape as
the other Austronesian ✅s. **Fold-depth note:** the glottal-strip fold is load-bearing (~12pp — without it ~75%),
because kaikki marks the glottal so erratically that it's the largest single disagreement class; the fold is
*bidirectional* (we both over-fire — waas→waʔas vs kaikki waas — and miss — bao→bao vs kaikki baoʔ), so it
neutralises referee inconsistency rather than hiding a one-sided segmental error. The residual is diffuse: **Aksara Sunda script entries** (~7 — kaikki includes native-
script single letters ᮊ→ka; we have a Latin-only front-end), the loanword ⟨e⟩=[e]-not-[ə] tail (profesor), a few
inconsistent hiatus glides (siam→sijam), and final-obstruent devoicing in Arabic loans (sujud). Deferred: an
Aksara Sunda front-end (the Javanese Aksara-Jawa pattern), and the loan-⟨e⟩ quality (unrecoverable from spelling,
as in Indonesian).
