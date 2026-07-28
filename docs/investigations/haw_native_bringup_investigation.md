# Hawaiian (haw) native bring-up investigation

Target: **Hawaiian** (ʻŌlelo Hawaiʻi) — Austronesian (Eastern Polynesian, sibling of Māori), ~24k speakers
(Hawaiʻi), Latin script (the modern orthography with the ʻokina + kahakō). Canonical IPA, espeak-independent.
ONE OF THE SIMPLEST phonologies in the world — the Māori situation.

## Run 1 — referee landscape (2026-07-28): WELL-RESOURCED

- **wikipron haw_latn_broad**: 2152 pairs — a large HUMAN referee for a trivially-phonemic orthography → PRIMARY.
- **wikipron haw_latn_narrow**: 1975 pairs.
- **kaikki Hawaiian**: exists (same Wiktionary source).

## Run 2 — the phonology (read off the broad referee)

Hawaiian has the SMALLEST phoneme inventory of any language (8 consonants + 5 vowels):
- **5 vowels /a e i o u/** + the MACRON (kahakō) = LENGTH (ā→[aː], …).
- **8 consonants**: ⟨p k m n l h w⟩ + the **ʻokina ⟨ʻ⟩ → [ʔ]** (glottal stop — a full consonant: Alapaʻi→alapaʔi).
- **⟨w⟩ → [w]** (the positional [w]/[v] split — [v] after i/e — is not modelled; the broad referee writes [w]
  throughout, so its IPA column has NO [v]).
- ★ **LOAN-LETTER ADAPTATION**: Hawaiian has no ⟨b c d f g j q r s t v x y z⟩, so loanwords adapt each to the
  nearest Hawaiian phoneme: **t→k** (Aigupita→aikupika), **s→k** (…desa→…keka), **r→l** (Doreka→koleka),
  **b→p** (Betelehema→pekelehema), **d→k** (Dāvida→kaːwika), **g→k** (Gaza→kaka), **v→w**, f→p, and c/j/q/x/z→k.
- **Diphthong OFFGLIDES**: a falling diphthong marks its 2nd vowel non-syllabic [i̯ u̯ o̯ e̯] (alawai→alawai̯,
  anawaena→anawae̯na) — a narrow detail; we emit plain vowels and fold the U+032F mark.
- **Stress** (penultimate, mora-based, unmarked) is not emitted (the Māori treatment).

## Run 3 — build + tune (2026-07-28)

Self-contained Māori-clone single-grapheme scan (hawaiian.ts + .jsonc). **v1: 98.9% folded / 99.8% symbol** on
the FIRST pass — near-ceiling, as expected for a trivially-phonemic orthography (the Māori 99.8% situation).
Fold: the diphthong OFFGLIDE mark (U+032F). (The ⟨w⟩→[w]/[v] positional split is not modelled — the broad
referee writes [w] throughout, so no v→w fold is needed.)

**Final: 98.9% folded / 99.8% symbol** on wikipron haw_latn_broad (2152). ★ The ONLY residual class is the
**alphabet LETTER-NAME rows** — the referee has single-letter entries giving the Hawaiian letter NAMES (H→[heː]
"hē", K→[keː] "kē", L→[laː] "lā", …), not the phonemes; our engine reads the phoneme ([h], [k], [l]) → a
standard unmodelable referee-noise class (the Irish/Kyrgyz letter-name situation), ~12 rows. Everything else
matches. Verified on common words (Hawaiʻi→hawaiʔi, kāne→kaːne, ʻāina→ʔaːina, Kalaniʻōpuʻu→kalaniʔoːpuʔu,
Aigupita→aikupika). 🔷 single-source family (wikipron; kaikki Hawaiian same source) but a trivially-transparent
orthography → near-ceiling. Among the cleanest bring-ups in the fleet. Deferred: stress (penultimate,
mora-based, unwritten), numbers, the ⟨w⟩→[v] positional realisation (i/e context).

## Run 4 — 2-agent review (2026-07-28)

**Phonology reviewer — full sign-off, no wrong values, no missing feature** (vs Elbert & Pukui). Confirmed the
5-vowel+macron system, the 8-consonant+ʻokina inventory (Hawaiian lost PPn *ŋ→n, *t→k, *k→ʔ — no other
consonants), and — grounded directly in the referee — EVERY loan mapping: t→k, r→l, b→p, d→k, g→k, v→w, and
★ **s→[k] NOT [h]** (Kolosa→koloka, Hasegawa→hakekawa), ★ **j→[k]** (English ⟨j⟩=/dʒ/→[k]: Keaka=Jack; the
i-forms like Iesū come from Greek *iota* /j/ = the glide, correctly the y→i case), **y→[i]** (no /j/ phoneme),
**f→[p]**, c/q/x→k. The ⟨w⟩→[w] default + folding the offglide are the right scope calls. The whole residual
is the alphabet LETTER-NAME rows + one un-nativized name (Roselani).

**Code/wiring reviewer — CLEAN, no bugs, no dishonest folds.** Verified the NFC-before-scan ordering (NFD
kāne→kaːne — the fix), all 6 ʻokina variants consistent between TOKEN and the map, the offglide fold honest.
★ ONE NIT APPLIED: the **v→w fold was INERT** — the referee IPA column has ZERO [v] (my "334:1" had counted
the WORD column, e.g. Dāvida), and the engine never emits [v] either → the fold was a no-op with an inaccurate
rationale. DROPPED the fold and corrected the wording (across haw.jsonc / floor / catalogue / maturity /
investigation). Score unchanged (98.9% / 99.8%). ★ ALSO FIXED (pre-review): the TOKEN regex now includes the
combining-diacritics range so a DECOMPOSED (NFD) macron vowel stays in one token (kāne→kaːne, was "ka ne").

**Final: 98.9% folded / 99.8% symbol. 🔷 single-source family, trivially-transparent orthography — among the
cleanest in the fleet. Floor 0.95.** Full suite green, typecheck clean. Deferred: stress, numbers, the
⟨w⟩→[v] positional realisation.
