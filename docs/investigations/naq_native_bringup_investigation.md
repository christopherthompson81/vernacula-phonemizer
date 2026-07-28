# Nama / Khoekhoe (naq) native bring-up investigation

Target: **Nama** (Khoekhoe / Damara / Khoekhoegowab) — a KHOE-KWADI language of Namibia/South
Africa/Botswana, ~250k speakers, the largest Khoisan-area language. The Khoekhoegowab Latin
orthography uses the Unicode CLICK letters. Canonical IPA, espeak-independent. **The fleet's FIRST
CLICK language** — a major typological first.

## Run 1 — referee landscape (2026-07-27)

- **wikipron / kaikki / epitran**: none for naq.
- **English Wiktionary category** "Khoekhoe terms with IPA pronunciation": **46 members** (the language
  is under "Khoekhoe" on Wiktionary, code `naq`). Scraped via the MediaWiki API.

🔷 **THIN + largely REFERENCE-PARITY.** The 46 entries are DOMINATED by the click-letter DEFINITIONS
(ǀ, ǀG, ǀh, ǀKh, ǀN, ǀg, ǀn × 4 click types ≈ 40) — i.e. the orthography→IPA spec itself — plus ~6 real
words (ǀgama, ǀgomab, ǀgomas, ǀhao, ǁaub, ǂkhoab, ǃkhās, kharob, taras). So matching the definitions is
near-circular (the cdo/bo situation); the real words are the independent check.

## Run 2 — the click system (from the 46 entries)

★★ **THE CLICKS — 4 places × 5 accompaniments** (the referee lays the whole system out):
- places: ⟨ǀ⟩ dental · ⟨ǁ⟩ lateral · ⟨ǂ⟩ palatal · ⟨ǃ⟩ alveolar
- accompaniments (uniform across all four places):
  - BARE ⟨ǀ⟩ → [ᵑ̊ǀˀ] (the glottalised nasal click)
  - ⟨ǀg⟩ → [ᵏǀ] (tenuis, voiceless unaspirated)
  - ⟨ǀkh⟩ → [ᵏǀʰ] (aspirated)
  - ⟨ǀh⟩ → [ᵑ̊ǀʰ] (aspirated / voiceless nasal)
  - ⟨ǀn⟩ → [ᵑǀ] (voiced nasal)
★ Non-click: ⟨kh⟩→[kʰ], ⟨g⟩ (not after a click)→[x], ⟨w⟩→[w]; the WORD-FINAL gender suffix ⟨-b⟩ devoices
to [p] (ǀgomab→[ǀómàp], kharob→[kʰarop]), ⟨-s⟩ stays; macron ⟨ā ē…⟩ = long vowel [aː] (ǃkhās→[kǃʰaːs]).
Nama's lexical TONE (H/L, marked with acute/grave in the narrow referee — tàra̋-s) is NOT written in the
orthography → not emitted (it folds).

## Run 3 — build + validate

Self-contained click-aware scan (nama.ts). **82.6% folded / 94.4% symbol (38/46)**. The click-letter
definitions all match (ǀ→ᵑ̊ǀˀ, ǀg→ᵏǀ, ǀkh→ᵏǀʰ, ǀh→ᵑ̊ǀʰ, ǀn→ᵑǀ). ★ The residuals are the REAL WORDS, where
the Wiktionary transcriptions SIMPLIFY the click onset INCONSISTENTLY — they drop the ᵏ (tenuis) /
ᵑ̊ (nasal) markers for ǀg/ǀh/bare (ǀgama→ǀámà, ǀhao→ǀʰàő, ǁaub→ǁˀàùp) but keep an ascii [k] for the
aspirated ǂkh/ǃkh (ǂkhoab→kǂʰoap). Our OUTPUT keeps the full, consistent, standard-phonology forms
(ᵏǀ, ᵑ̊ǀʰ…) — arguably more precise than the referee's word simplifications — so those 6-7 words are
honest residuals, NOT modelled toward the referee's inconsistency. Fold: the referee's morpheme hyphen.

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — click-scan CORRECT, wiring complete.** Traced the novel click `i`-advance
arithmetic (bare fallback, `i+=2` then `i++` for the 3-char ⟨ǀkh⟩, case-insensitive ⟨ǀKh⟩), the
Unicode click letters (U+01C0–01C3, distinct from ASCII |/!), final-⟨b⟩ index, NFC — all correct.
One latent hazard: the `chars`/`lower` dual arrays could DESYNC if an expanding-lowercase char (İ→i̇,
ß→ss) appeared (unreachable from Nama, but a real bug). FIXED: lowercase PER-INDEX via a helper, no
second array.

**Phonology reviewer — the CLICK SYSTEM is fully CORRECT** (the hallmark). Verified all 5 accompaniments
against Hagman (1977) + the referee definitions, including the two subtle traps: **bare ⟨ǀ⟩ = the
glottalized nasal click [ᵑ̊ǀˀ]** (not a plain click), and **⟨ǀh⟩ = a NASAL click [ᵑ̊ǀʰ]** (not the oral
aspirated ⟨ǀkh⟩ [ᵏǀʰ]) — the engine keeps them distinct. 5 accompaniments = the full Khoekhoe count (no
missing voiced/ejective series); ⟨g⟩→[x] correct; final ⟨-b⟩→[p] correct; tone-folding the right call.
ONE substantive bug: **nasalized (circumflex) vowels ⟨â ê î ô û⟩ were DROPPED** (not in LETTER → the
nucleus vanished) — nasal vowels are phonemic (ǂgâ 'enter', ǀî). FIXED: ⟨â…û⟩→[ã ẽ ĩ õ ũ]. Also added
DOUBLED-vowel length (aa→[aː], the standard Khoekhoegowab length convention vs the referee's macron).
Both referee-invisible (the referee has no circumflex/doubled entries) → the % is unchanged but real
Khoekhoegowab text is now correct. Confirmed the referee is ~40 click-letter DEFINITIONS
(reference-parity) + ~7 real words, and our fuller output is MORE precise than the referee's inconsistent
word-simplifications.

**Final: 82.6% folded / 94.4% symbol (38/46)** — largely reference-parity on the click spec, with the
click accompaniment system independently confirmed correct by the phonology review. Floor 0.78. Goldens
(4 tests incl. the nasal-vowel path), the 153-test referee floor, and typecheck all green.
