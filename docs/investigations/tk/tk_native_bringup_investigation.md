# Turkmen (tk) native bring-up investigation

Target: **Standard Turkmen** (Türkmençe), Latin script (post-1990s, 30 letters),
canonical IPA, espeak-independent. Turkic (Oghuz) — Turkmenistan, ~5-7M.

## Run 1 — referee landscape

- **wikipron `tuk_latn_broad`**: 452 lines (HUMAN, space-separated). Shows the FULL
  Turkmen phonology: the interdentals ⟨s⟩→[θ] ⟨z⟩→[ð] (Türkmenistan→…iθtɑːn,
  Gazak→ɣɑðɑk), spirantization ⟨g⟩→[ɣ]/[ʁ] ⟨h⟩→[x]/[χ], ⟨w⟩→[β], and PHONEMIC
  vowel LENGTH (UNWRITTEN — aː from ⟨a⟩).
- **kaikki Turkmen**: 2038 entries, 1024 IPA (HUMAN). Confirms the interdentals
  (s→/θ/, z→/ð/ CONSISTENT: surat→θuːrɑt, zat→ðɑːt, göz→ɡœð, sözlük→θøðlyk) +
  length + stress. Some loans keep [s] (hasap→xɑsɑːp).
- **epitran `tuk-Latn`**: WORKS, INDEPENDENT — but NAIVE on the interdentals
  (keeps s→s, z→z) and w→β; confirms the letter map (ä→æ, ň→ŋ, ý→j, ž→ʒ, y→ɯ,
  ö→ø, ü→y, ç→t͡ʃ, j→d͡ʒ, ş→ʃ).

Verdict: the Wiktionary referees (wikipron+kaikki, CORRELATED) both attest the
INTERDENTAL hallmark; epitran is the naive INDEPENDENT cross-check (we CORRECT it
on s→θ/z→ð, the Shona pattern). 🔷 — kaikki human primary + epitran independent 2nd.

**The Turkmen story (measured rules):**
- ⟨s⟩→[θ], ⟨z⟩→[ð] — the interdental hallmark (native; some loans keep [s]).
- 9 vowels a e ä→æ i o ö→ø u ü→y y→ɯ + UNWRITTEN phonemic length (fold).
- ⟨ç⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨ž⟩→ʒ, ⟨ş⟩→ʃ, ⟨ň⟩→ŋ, ⟨ý⟩→j, ⟨w⟩→[β]/[w].
- spirantization ⟨g⟩→[ɣ]/[ʁ], ⟨h⟩→[x]/[χ] (measure the conditioning).

## Run 2 — engine + tuning

Engine: direct grapheme scan (no digraphs) + final stress + the interdentals
⟨s⟩→θ, ⟨z⟩→ð. First pass 40.8% (kaikki) — dragged by ⟨a⟩. Tuning:
- **⟨a⟩→[ɑ]** (the BACK low vowel; every ⟨a⟩) — biggest single fix (+37pp). Emit ɑ,
  fold epitran's [a].
- Folds for the ALLOPHONY (not modelled — allophonic, referee-inconsistent): the
  ⟨g⟩ spirantization/backing **[ɣ ʁ ɢ]→ɡ** (Gazak→ɣɑðɑk, aga→ɑʁɑ — /ɡ/ has no
  fricative-vs-stop contrast), ⟨h⟩ **h~x~χ**, ⟨w⟩ **β~w**, dark-l **ɫ~l**, **ʊ~u**,
  **r~ɾ** (epitran uses [r]).
- **UNWRITTEN phonemic LENGTH** (aː from ⟨a⟩) — Turkmen contrasts vowel length but
  the orthography omits it → unrecoverable → not emitted, folded (BACKBONE strips ː).

**Result:** kaikki (HUMAN, 530) **80.4% folded / 94.9% symbol**; wikipron (HUMAN,
424, the richest) **91.5% / 97.9%**; epitran (INDEPENDENT) **77.0% / 95.1%**. The
epitran gap is the INTERDENTALS — it keeps s/z where we (correctly, per both human
referees) emit θ/ð; we do NOT fold θ→s (that would hide the hallmark), so epitran
stays ~77% (the Shona "we correct epitran" pattern). Residual (kaikki) = unwritten
length + loan sibilants (some loans keep [s]) + proper-noun oddities. 🔷 kaikki
human primary + wikipron (correlated) + epitran (independent, naive-corrected).
Deferred: unwritten length (needs a lexicon), numbers, fine g-spirantization.
