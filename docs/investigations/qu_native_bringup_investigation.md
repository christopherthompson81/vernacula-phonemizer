# Quechua (qu) native bring-up investigation

Target: **Southern Quechua** (Runasimi / Qhichwa — Cusco-Collao + Ayacucho, the
standardised trilingual orthography), Latin script, canonical IPA,
espeak-independent. Quechuan family (its own; the fleet's first).

## Referee landscape (Run 1)

- **wikipron**: NONE. URL scheme verified against `mri_latn_broad` (200); the
  GitHub `data/scrape/tsv` listing has no `qu*` file. No Quechua in wikipron.
- **kaikki "Quechua"** (`qu`, English Wiktionary extract): 2802 entries, **415
  with IPA** (human). Phonemic `/../` + phonetic `[..]`; marks penultimate
  stress (ˈ) + syllable dots (.); writes /i u/ phonetically as **[ɪ ʊ]**; shows
  Cusco aspirate/ejective realisations as `[bracketed]` variants of plain
  spellings (⟨pampa⟩→[pʼampa]/[pʰampa]). A few English artefacts ("this"
  /ˈtʰɪs/). → **PRIMARY** (human, independent of espeak).
- **epitran `quy-Latn`** (Ayacucho): installed, programmatic. But it emits
  English-ish lax vowels (`runasimi`→`rʊnæsɪmɪ`, æ for /a/) — a fold-heavy,
  lower-trust **SECONDARY** (independent implementation, not human).

Decision: build the kaikki human set as primary; keep epitran as an independent
secondary cross-check. Two independent sources → not single-source.

Referee built: `tools/referee-eval/referees/qu.kaikki-quechua.tsv`, 171 headwords
(from 207 unique IPA rows; dropped affix/letter stubs, no-vowel fragments, and 3
loans whose IPA carried non-Quechua phones — baka←vaca, Buliwya←Bolivia,
insiklupidiya←encyclopedia).

## Run 2 — engine + first eval

Engine `src/languages/quechua/quechua.ts`: longest-match scan over the
tri/digraph table (⟨chh ch'⟩, then ⟨ch ph th kh qh sh ll⟩ + ⟨p' t' k' q'⟩) then
single graphemes; apostrophes (ʼ ' ') normalised to U+0027; regular penultimate
stress at the onset of the penult syllable.

First eval: **91.3% folded / 97.1% symbol**. Residual split into (a) principled
fixes and (b) noise. Applied: fold `r→ɾ` (referee writes the tap as r~ɾ), fold
`χ→q` (coda allophone of /q/: suqta→[suχta]), map `ş→ʃ` (spelling variant, was
silently dropped), map `c→k` (old/Spanish spellings — avoid the Māori
silent-drop trap). → **93.0% folded / 97.6% symbol**. The remaining 12 misses
are all genuine noise: loans (karru←car→[kaʐu]), pre-normalization spellings
(⟨c g z⟩ for k/q/ch/s: picga/songo), and Cusco lowered-spellings.

## Run 3 — epitran secondary cross-check + the uvular-lowering decision

`epitran quy-Latn` skeleton agreement (neutralising the aspiration/ejective
axis, ties, tap r~ɾ, q~χ, and lax/lowered vowels): **88.3%** on 163
standard-spelling words. The disagreements are (a) epitran limitations (it does
NOT apply sh→ʃ, leaves ⟨c g z⟩ unmapped, maps ⟨j⟩→glide not [h]) and (b) a
**uvular vowel-lowering allophone** (/i u/→[e o] next to ⟨q⟩: qillqa→qeʎqa).

**The two referees CONFLICT on lowering.** epitran *lowers* (i→e, u→o near q).
The kaikki primary *normalises to the phonemic /i u/* — it writes i/u even next
to q, and even *raises* lowered spellings (headword `enqa`→/ˈɪnqa/=inqa,
`soqso`→/suqsu/). Per the repo rule (corroborate ≥2 sources before trusting a
divergence; never reflex-fix toward one referee), and since the standard
trilingual orthography is deliberately 3-vowel, the decision is to **emit the
phonemic /a i u/** (matching the primary + the orthographic norm) and fold
epitran's lowering in the cross-check. The uvular-lowering *dialect* realisation
is deferred to a future `dialect` param, not guessed into the default.

## Outcome

**93.0% folded / 97.6% symbol** (primary, floor 0.88), **88.3%** epitran
skeleton agreement. Goldens in `test/quechua.test.ts` (aspirate/ejective series,
palatals, uvular, penult stress, monosyllables). 🔷 primary human + independent
epitran 2nd. Deferred: uvular-lowering dialect param, numbers.

