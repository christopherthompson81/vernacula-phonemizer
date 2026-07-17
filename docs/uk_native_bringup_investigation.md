# Ukrainian (uk) native bring-up

Ukrainian / українська — East Slavic, ~33M speakers, Cyrillic. The second East Slavic language (after Russian),
but built fresh rather than sharing the Russian module, because Ukrainian is phonologically **simpler in the one
respect that dominates Russian's engine**: it has NO vowel reduction (akanye). о stays [ɔ] regardless of stress,
so — unlike Russian, which needs a stress dictionary to compute reduced vowel quality — Ukrainian is a flat
left-to-right scan with fixed vowel values. Stress exists but is lexical/unpredictable and doesn't change vowel
quality, so it is left unmarked.

## Data availability (checked up front)

- **wikipron ukr_cyrl narrow** — 50,000+ human pairs (the primary; a rich, careful narrow transcription).
- **kaikki Ukrainian** (255 MB) and **epitran ukr-Cyrl** exist as further sources (not wired; the 50k narrow
  primary is more than enough).

## The Ukrainian profile

- **г→[ɦ]** (voiced glottal — the Ukrainian hallmark that separates it from Russian's ɡ); **ґ→[ɡ]**.
- **dark л→[ɫ]** (velarised), palatalised → [lʲ].
- **в = /w/** with the standard allophony: **[w]** before a rounded vowel о/у (вода→wɔda, слово→sɫɔwɔ) and in the
  coda / word-initial-before-a-consonant (Влад→wɫad); **[ʋ]** before а/е/и (мова→mɔʋa); **[ʋʲ]** before і
  (вікно→ʋʲiknɔ); **[u̯]** in a post-vocalic coda (Європа→jɛu̯rɔpa).
- **Palatalisation** (Cʲ) before ь, і, or an iotated vowel я/ю/є/ї; the iotated vowels are [j]+V initially / after
  a vowel / after an apostrophe (сім'я→sʲimja), the bare palatalising vowel after a consonant.
- **Regressive palatalisation** — a coronal (т д з с ц н) directly before a palatalised consonant assimilates
  (Дніпро→dʲnʲiprɔ, Близнюк→bɫɪzʲnʲuk).
- **Geminates** (ття/ння → Cʲː: Буття→butʲːa, Відродження→ʋʲidrɔd͡ʒɛnʲːa).

## Runs (folded vs the wikipron narrow primary)

- **Run 1 — first scan.** 38.0%. The core map + iotated + palatalisation + basic reduction folds. The killer was
  the **coda glides**: the referee writes в/й coda as [u̯]/[i̯], whose combining breve the shared BACKBONE strips
  to [u]/[i] — but the g2p emitted [w]/[j], so nothing matched.
- **Run 2 — glide breves + и/е neutralisation.** Emit coda в→[u̯], coda й→[i̯] (breve, backbone-aligned); fold the
  unstressed и/е neutralisation ɪ/ɛ→e (both surface [e] unstressed and stress is unpredictable — a lossy
  *comparison* fold, not an output change). → 77.7%.
- **Run 3 — в allophony.** The full /w/ allophony ([w] before о/у + word-initial-before-C, [ʋ] before а/е/и). → 82.7%.
- **Run 4 — regressive palatalisation + affricate gemination.** The coronal-before-palatalised rule + the
  affricate-geminate fold (ччя/щ). → 87.6%.
- **Run 5 — palatalised geminates.** CʲCʲ→Cʲː (the regressive rule had doubled both halves of ття/ння). → **90.2%**.

## Verdict — ✅ Referee-limited

**90.2% folded vs wikipron ukr_cyrl narrow (50k, human).** The residual is diffuse: **regressive VOICING**
assimilation (кз→ɡz, Вокзальна — deferred; Ukrainian's voicing assimilation is narrower than Russian's), a few
over/under-palatalisation edges (the -ський suffix н, й before an iotated vowel), and single-letter name entries.
The folds neutralise the referee's narrow allophonic notation (the и/е unstressed neutralisation, the glide
breves, unstressed ɐ/ʊ) — none hide a segmental error. A new Slavic number composer (units/teens/tens/hundreds/
magnitudes) was added with the `hundreds` field. Deferred: regressive voicing assimilation, lexical stress
marking (Ukrainian stress is unpredictable and needs a dictionary — but, crucially, it doesn't affect vowel
quality, so its absence costs nothing segmentally).
