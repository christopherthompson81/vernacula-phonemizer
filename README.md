# vernacula-phonemizer

A **canonical-IPA** phonemizer for **65 languages** — native, cleanroom, and self-contained.
One output mode: consistent canonical IPA, tuned for speech-synthesis / TTS training. No
dual rendering, no runtime fallback — every language resolves to the same notation.

Every language is a cleanroom G2P built from the Unicode chart + published phonology (or,
where the orthography is irregular or non-phonemic, a derived lexicon or dictionary).
Correctness is **measured, not asserted**: each language is validated against *independent*
referees — human transcriptions (wikipron, kaikki) and independent G2Ps (epitran) — folding
away only notation and allophony, never a real phonemic contrast.

```ts
import { phonemize } from "vernacula-phonemizer";

phonemize("I read a book", "en"); // aᶦ ɹˈɛd ə bˈʊk
phonemize("भारत", "hi");          // bʱˈaːɾət̪
phonemize("বাংলাদেশ", "bn");      // baŋlad̪eʃ
phonemize("世界", "cmn");         // ʂʐ̩˥˩ t͡ɕiɛ˥˩
phonemize("Türkçe", "tr");        // tˈyɾct͡ʃe
phonemize("Україна", "uk");       // ukrajina
```

## Languages

65 languages spanning Afroasiatic (Semitic, Cushitic, Chadic), Austroasiatic, Austronesian,
Celtic, Dravidian, Germanic, Indo-Aryan, Iranian, Japonic, Koreanic, Niger-Congo, Romance,
Sinitic, Slavic, Tai-Kadai, Tibeto-Burman, Turkic and an English-lexified creole —
across Latin, Cyrillic, Devanagari, Gurmukhi, Gujarati, Bengali, Odia, Tamil, Telugu,
Kannada, Malayalam, Sinhala, Perso-Arabic (incl. Sindhi and Shahmukhi), Geʽez, Myanmar,
Han, Kana/Kanji, Hangul, Thai and Javanese (Aksara Jawa) scripts.

Per-language reliability — *is the output trustworthy, and what (if anything) is
outstanding?* — lives in [`docs/language-maturity.md`](docs/language-maturity.md).

| Family / area | Languages |
|---|---|
| Afroasiatic | Amharic `am`, Arabic `ar` (+ Egyptian `arz`, Levantine `apc`, Sudanese `apd`), Hausa `ha`, Oromo `om` |
| Austroasiatic | Vietnamese `vi` (tonal) |
| Austronesian | Indonesian `id`, Javanese `jv`, Sundanese `su`, Tagalog `tl` |
| Celtic | Irish `ga`, Welsh `cy` |
| Creole (English-lexified) | Nigerian Pidgin `pcm` |
| Dravidian | Kannada `kn`, Malayalam `ml`, Tamil `ta`, Telugu `te` |
| Germanic | English `en`, German `de`, Swedish `sv` (tonal accent) |
| Indo-Aryan | Awadhi `awa`, Bengali `bn`, Bhojpuri `bho`, Gujarati `gu`, Hindi `hi`, Maithili `mai`, Marathi `mr`, Nepali `ne`, Odia `or`, Punjabi `pa` (tonal; Gurmukhi + Shahmukhi), Sindhi `sd`, Sinhala `si`, Urdu `ur` |
| Iranian | Pashto `ps`, Persian `fa` |
| Japonic | Japanese `ja` |
| Koreanic | Korean `ko` |
| Niger-Congo | Fula `ff`, Igbo `ig` (tonal), Swahili `sw`, Yoruba `yo` (tonal), Zulu `zu` |
| Romance | Catalan `ca`, French `fr`, Italian `it`, Portuguese `pt`, Spanish `es` |
| Sinitic | Cantonese `yue`, Hakka `hak`, Jin `cjy`, Mandarin `cmn`, Min Nan `nan`, Wu `wuu`, Xiang `hsn` — all tonal |
| Slavic | Czech `cs`, Polish `pl`, Russian `ru`, Ukrainian `uk` |
| Tai-Kadai | Thai `th` (tonal) |
| Tibeto-Burman | Burmese `my` (tonal) |
| Turkic | Kazakh `kk`, Turkish `tr`, Uzbek `uz` |

## How it works

Five G2P paradigms, chosen per language by how its orthography relates to its phonology:

- **Rule-based transliteration** — for shallow orthographies (Turkish, Spanish, Czech,
  Polish, Ukrainian, Swahili, Uzbek, …): letter/context → IPA, plus the language's real
  phonology (vowel harmony, palatalization, nasal assimilation, devoicing, quantity-sensitive
  stress). Uzbek is the Turkic outlier that *lost* vowel harmony; Ukrainian, unlike Russian,
  has no vowel reduction, so it needs no stress dictionary.
- **Abugida engine** — a single generic Brahmic interpreter (`core/abugida.ts`) driven by a
  self-describing JSONC table, shared across the Indic and Dravidian scripts (Hindi, Bengali,
  Odia, Telugu, Kannada, Malayalam, Tamil, Sinhala, …). It handles the inherent vowel, matras,
  virama/conjuncts, anusvara and nukta; each language layers on its own inherent-vowel
  deletion (or, for the Dravidian family, *no* deletion), gemination, and script specifics
  (Malayalam's samvritokaram, Odia's retroflex flap, …). Devanagari relatives (Gujarati,
  Marathi, Bhojpuri, Awadhi, Maithili) reuse the Hindi orchestration on top.
- **Dictionary front-end** — where the script doesn't encode the reading. The seven Sinitic
  languages map Han → reading → IPA: Mandarin/Cantonese via pinyin/Jyutping dictionaries, Wu
  and Min Nan via a romanization layer, and Jin/Hakka/Xiang via a shared engine
  (`sinitic/hanDictIpa.ts`) over Wiktionary Sinological-IPA dictionaries with tone-sandhi.
  Japanese resolves kanji readings and pitch accent the same way.
- **Abjad + vowel restoration** — for Arabic and the Perso-Arabic abjads (Urdu, Persian,
  Pashto, Sindhi), where short vowels are usually unwritten. Arabic ships a neural diacritizer
  that restores them; the others recover the consonant + long-vowel skeleton and restore short
  vowels from a coverage lexicon (+ a shared neural tier).
- **Lexicon + statistical OOV** — where the orthography is irregular. English is a
  CMUdict-derived lexicon + a cleanroom joint n-gram OOV model + a POS perceptron for
  heteronyms; French is a Lexique-derived lexicon over a *loi-de-position* rule engine;
  Nigerian Pidgin (an English-lexified creole) nativises known English words and reads the
  substrate loans phonemically.

These sit on a small **shared core**: the abugida engine, quantity-sensitive weight stress,
Ohala schwa/inherent-vowel deletion, pluggable number compositors (Indic, Turkic, Slavic,
Western), clause assembly, and the canonical-IPA notation primitives. A per-language `*.jsonc`
manifest holds the hand-authored data so the code stays a thin, portable interpreter.

## Correctness is measured, not asserted

The distinctive part of this project is the **referee-eval** harness
([`tools/referee-eval`](tools/referee-eval)). Every language is validated against *independent*
sources — there is no single canonical engine to defer to:

- We compare the **segmental backbone** of our output to one or more referees, **folding away**
  only the layers where we are legitimately *richer* (tone contours, length, aspiration) or
  where the difference is a documented **allophone** or notation convention. Every fold is
  justified in the per-language config — never a real phonemic contrast.
- What **remains** after folding is the real signal — a candidate to adjudicate against
  published phonology, not an automatic bug. Referees are fallible, so a divergence is trusted
  only when ≥2 independent sources corroborate it.
- The referee **percentage is not a maturity score** — it is confounded by referee noise and
  fold ceilings. English scores 36% against a referee that is mostly transcription noise;
  Turkish 94% once its vowel allophony is folded and *two* referees agree. Where a referee is
  too noisy (Bengali) or absent (the Sinitic dialect stubs, Nigerian Pidgin), a small
  hand-**adjudicated gold** is the clean quality anchor. The honest read of "is this reliable /
  what's left?" lives in [`docs/language-maturity.md`](docs/language-maturity.md), and each
  bring-up keeps a chronological log in [`docs/investigations/`](docs/investigations).

## Canonical IPA conventions

One consistent convention across all languages, tuned for TTS/synthesis training: stress
**before** the nucleus (`ˈ`), aspiration `kʰ/pʰ/t̪ʰ`, breathy voice `ʱ`, dental `t̪ d̪` vs
retroflex `ʈ ɖ ɳ`, dark-l `ɫ`, tap `ɾ` vs trill `r`, affricate tie-bars `t͡ʃ d͡ʒ`, Chao tone
letters `˥˩`, offglide superscripts `aᶦ aᶷ`, and geminates as length `ː`. English adds GenAm
flapping `t̬` and the weak vowel `ᵻ`. The notation primitives (`src/core/unicode.ts`,
`src/core/phonology.jsonc`) are the source of truth.

## Usage

```ts
import { phonemize, getPhonemizer } from "vernacula-phonemizer";

phonemize("नमस्ते", "hi");              // one-shot: text → IPA
const ur = getPhonemizer("ur");         // reusable per-language instance
ur.text("میرا نام");
```

`phonemize(text, lang)` tokenises words, numbers (native number compositors) and clause
punctuation, routes embedded Latin runs through the English phonemizer, and returns canonical
IPA.

## Repository layout

```
src/languages/<lang>/   per-language module + *.jsonc manifest
src/core/               shared engine (abugida, Sinitic dict, stress, schwa, numbers, notation)
tools/referee-eval/     independent-referee validation harness + referees/
docs/                   language-maturity.md
docs/investigations/    per-language bring-up logs
test/                   golden IPA tests
```
