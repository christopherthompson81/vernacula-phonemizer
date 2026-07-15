# vernacula-phonemizer

A **canonical-IPA** phonemizer for **45 languages** — native, self-contained, and
espeak-independent. One output mode: consistent canonical IPA for speech-synthesis /
TTS training. No parity mode, no dual rendering, no runtime fallback.

Every language is a cleanroom G2P built from the Unicode chart + published phonology (or,
where the language is irregular, a derived lexicon). Correctness is measured against
**independent** referees — human transcriptions (wikipron) and other G2Ps (epitran,
kaikki) — never against espeak.

```ts
import { phonemize } from "vernacula-phonemizer";

phonemize("I read a book", "en"); // aᶦ ɹˈɛd ə bˈʊk
phonemize("भारत", "hi");          // bʱˈaːɾət̪
phonemize("বাংলাদেশ", "bn");      // baŋlad̪eʃ
phonemize("世界", "cmn");         // ʂʐ̩˥˩ t͡ɕiɛ˥˩
phonemize("Türkçe", "tr");        // tˈyɾct͡ʃe
```

## Languages

45 languages spanning Indo-Aryan, Dravidian, Romance, Germanic, Slavic, Celtic, Turkic,
Semitic, Sino-Tibetan, Japonic, Koreanic, Tai, Austroasiatic, Austronesian, Niger-Congo and an English-lexified creole — across
Latin, Cyrillic, Devanagari, Gujarati, Bengali, Kannada, Tamil, Sinhala, Arabic, Geʽez, Han, Kana, Hangul and Javanese (Aksara Jawa) scripts.

| Family / area | Languages |
|---|---|
| Austroasiatic | • Vietnamese `vi` (tonal) |
| Austronesian | • Indonesian `id` 🟡,<br>• Javanese `jv` 🟡,<br>• Tagalog `tl` 🟡 |
| Celtic | • Irish `ga`,<br>• Welsh `cy` |
| Creole (English-lexified) | • Nigerian Pidgin `pcm` 🟡 |
| Dravidian | • Kannada `kn`,<br>• Tamil `ta`,<br>• Telugu `te` |
| Germanic | • English `en`,<br>• German `de`,<br>• Swedish `sv` |
| Indo-Aryan | • Bengali `bn` 🟡,<br>• Bhojpuri `bho` ⛔,<br>• Gujarati `gu` 🟡,<br>• Hindi `hi`,<br>• Marathi `mr` 🟡,<br>• Punjabi `pa` 🟡 (tonal),<br>• Sinhala `si`,<br>• Urdu `ur` 🟠 |
| Japonic | • Japanese `ja` |
| Koreanic | • Korean `ko` |
| Niger-Congo | • Fula `ff`,<br>• Hausa `ha`,<br>• Swahili `sw`,<br>• Zulu `zu` |
| Romance | • Catalan `ca`,<br>• French `fr`,<br>• Italian `it`,<br>• Portuguese `pt`,<br>• Spanish `es` |
| Semitic / Iranian | • Amharic `am` 🟡,<br>• Arabic `ar`,<br>• Pashto `ps` 🟠,<br>• Persian `fa` 🟠 |
| Sinitic | • Mandarin `cmn` (tonal),<br>• Cantonese `yue` (tonal),<br>• Wu `wuu` 🟡 (tonal),<br>• Min Nan `nan` 🟡 (tonal) |
| Slavic | • Czech `cs`,<br>• Russian `ru` |
| Tai-Kadai | • Thai `th` (tonal) |
| Turkic | • Kazakh `kk`,<br>• Turkish `tr` |

**Maturity** (full detail in [`docs/language-maturity.md`](docs/language-maturity.md)):
✅ reliable / referee-limited (30) · 🟡 reliable + a documented lexical tail (11: Amharic, Bengali, Gujarati, Indonesian, Javanese, Min Nan,
Marathi, Punjabi, Tagalog, Nigerian Pidgin, Wu) · 🟠 scope-limited, one subsystem deferred (3: Urdu, Persian, Pashto) ·
🔵 in active development · ⛔ cannot-verify (1: Bhojpuri — no independent referee).

## How it works

Four G2P paradigms, chosen per language by how its orthography relates to its phonology:

- **Rule-based transliteration** — for shallow orthographies (Turkish, Spanish, Czech,
  Kazakh, …): letter/context → IPA, plus the language's real phonology (vowel harmony,
  palatalization, nasal assimilation, devoicing, quantity-sensitive stress).
- **Abugida engine** — a single generic Brahmic interpreter (`core/abugida.ts`) driven
  by a self-describing JSONC table, shared by Hindi, Bengali, Tamil, Sinhala. It handles
  the inherent vowel, matras, virama/conjuncts, anusvara and nukta; each language layers
  its own vowel harmony, inherent-vowel deletion and gemination on top.
- **Abjad + vowel restoration** — for Arabic and Urdu, where short vowels are usually
  unwritten. Arabic ships a neural diacritizer that restores them; Urdu currently derives
  the consonant + long-vowel skeleton (short-vowel restoration is the deferred subsystem).
- **Lexicon + statistical OOV** — where the orthography is irregular. English is a
  CMUdict-derived lexicon + a cleanroom joint n-gram OOV model + a POS perceptron for
  heteronyms; French is a Lexique-derived lexicon over a loi-de-position rule engine.
  Nigerian Pidgin (an English-lexified creole in its media orthography) is a lexicon of
  the irregular high-frequency words over a Naija-phonology rule g2p that nativises the rest.

These sit on a small **shared core**: the abugida engine, quantity-sensitive weight
stress, Ohala schwa/inherent-vowel deletion, an Indic number compositor, clause
assembly, and the canonical-IPA notation primitives. A per-language `*.jsonc` manifest
holds the hand-authored data so the code stays a thin, portable interpreter.

## Correctness is measured, not asserted

The distinctive part of this project is the **referee-eval** harness
([`tools/referee-eval`](tools/referee-eval)). Because there is no espeak to defer to,
every language is validated against *independent* sources:

- We compare the **segmental backbone** of our output to one or more referees, **folding
  away** only the layers where we are legitimately *richer* (tone contours, length,
  aspiration) or where the difference is a documented **allophone** or notation
  convention. Every fold is justified in `config.ts` — never a real phonemic contrast.
- What **remains** after folding is the real signal — a candidate to adjudicate against
  published phonology, not an automatic bug. Referees are fallible, so a divergence is
  trusted only when ≥2 independent sources corroborate it.
- The referee **percentage is not a maturity score** — it is confounded by referee noise
  and fold ceilings. English scores 36% against a referee that is mostly transcription
  noise; Turkish 94% once its vowel allophony is folded and *two* referees agree. Where a
  referee is too noisy (Bengali) we add a small hand-**adjudicated gold** as the clean
  quality signal. The honest read of "is this reliable / what's left?" lives in
  `docs/language-maturity.md`, and each bring-up keeps a chronological
  `docs/<lang>_*_investigation.md` log.

## Canonical IPA conventions

One consistent convention across all languages, tuned for TTS/synthesis training:
stress **before** the nucleus (`ˈ`), aspiration `kʰ/pʰ/t̪ʰ`, breathy voice `ʱ`, dental
`t̪ d̪` vs retroflex `ʈ ɖ ɳ`, dark-l `ɫ`, tap `ɾ` vs trill `r`, affricate tie-bars
`t͡ʃ d͡ʒ`, Chao tone letters `˥˩`, offglide superscripts `aᶦ aᶷ`, and geminates as
length `ː`. English adds GenAm flapping `t̬` and the weak vowel `ᵻ`. The notation
primitives (`src/core/unicode.ts`, `src/core/phonology.jsonc`) are the source of truth.

## Usage

```ts
import { phonemize, getPhonemizer } from "vernacula-phonemizer";

phonemize("नमस्ते", "hi");              // one-shot: text → IPA
const ur = getPhonemizer("ur");         // reusable per-language instance
ur.text("میرا نام");
```

`phonemize(text, lang)` tokenises words, numbers (native number compositors) and clause
punctuation, routes embedded Latin runs through the English phonemizer, and returns
canonical IPA.

## Repository layout

```
src/languages/<lang>/   per-language module + *.jsonc manifest
src/core/               shared engine (abugida, stress, schwa, numbers, notation)
tools/referee-eval/     independent-referee validation harness + referees/
docs/                   language-maturity.md + per-language bring-up investigation logs
test/                   golden IPA tests
```
