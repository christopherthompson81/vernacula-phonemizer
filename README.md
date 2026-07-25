# vernacula-phonemizer

A **canonical-IPA** phonemizer for **132 languages** — native, cleanroom, and self-contained.
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

132 languages spanning Afroasiatic (Semitic, Cushitic, Chadic), Armenian, Austroasiatic,
Austronesian, Celtic, Dravidian, Germanic, Hellenic, Indo-Aryan, Iranian, Japonic, Kartvelian, Koreanic,
Mongolic, Niger-Congo (Bantu, Kwa, Mande, Gur, Atlantic), Nilotic, Romance, Sinitic, Slavic, Tai-Kadai,
Tibeto-Burman, Turkic, Uralic and an English-lexified creole — across Latin, Greek, Cyrillic,
Armenian, Hebrew, Devanagari, Khmer, Gurmukhi, Gujarati, Bengali, Odia, Tamil,
Telugu, Kannada, Malayalam, Sinhala, Perso-Arabic (incl. Sindhi and Shahmukhi), Geʽez, Myanmar,
Han, Kana/Kanji, Hangul, Thai and Javanese (Aksara Jawa) scripts.

Per-language reliability — *is the output trustworthy, and what (if anything) is
outstanding?* — lives in [`docs/language-maturity.md`](docs/language-maturity.md).

| Family / area | Languages |
|---|---|
| Afroasiatic | Amharic `am`, Tigrinya `ti`, Arabic `ar` (MSA) + Egyptian `arz`, N. Levantine `apc`, S. Levantine `ajp`, Iraqi `acm`, Gulf `afb`, Hijazi `acw`, Sudanese `apd`, Moroccan `ary`, Libyan `ayl`, Hausa `ha`, Hebrew `he`, Oromo `om`, Somali `so` |
| Armenian | Armenian `hy` (Eastern; its own Indo-European branch) |
| Austroasiatic | Khmer `km`, Vietnamese `vi` (tonal) |
| Austronesian | Cebuano `ceb`, Hiligaynon `hil`, Ilocano `ilo`, Indonesian `id` (+ Standard Malay `zsm`), Javanese `jv`, Madurese `mad`, Malagasy `mg`, Sundanese `su`, Tagalog `tl` |
| Celtic | Irish `ga`, Welsh `cy` |
| Creole (English-lexified) | Nigerian Pidgin `pcm` |
| Dravidian | Kannada `kn`, Malayalam `ml`, Tamil `ta`, Telugu `te` |
| Germanic | Afrikaans `af`, Danish `da`, Dutch `nl`, English `en` (+ `en-GB` accent variant), German `de`, Swedish `sv` (tonal accent) |
| Hellenic | Greek `el` |
| Indo-Aryan | Assamese `as`, Awadhi `awa`, Bengali `bn`, Bhojpuri `bho`, Chhattisgarhi `hne`, Gujarati `gu`, Haryanvi `bgc`, Hindi `hi`, Magahi `mag`, Maithili `mai`, Marathi `mr`, Nepali `ne`, Odia `or`, Punjabi `pa` (tonal; Gurmukhi) + Western Punjabi `pnb` (Shahmukhi), Saraiki `skr`, Sindhi `sd`, Sinhala `si`, Sylheti `syl`, Urdu `ur` |
| Iranian | Balochi `bal`, Central Kurdish `ckb` (Sorani), Kurmanji `kmr` (N. Kurdish), Pashto `ps`, Persian `fa`, Tajik `tg` |
| Japonic | Japanese `ja` |
| Kartvelian | Georgian `ka` (its own family; Mkhedruli script, three-way ejective/aspirated/voiced stops) |
| Koreanic | Korean `ko` |
| Mongolic | Mongolian `mn` (Khalkha) |
| Niger-Congo | Akan `ak` (tonal, Kwa), Bambara `bm` (Mande), Chichewa `nya`, Fula `ff` (Atlantic), Igbo `ig` (tonal), Kamba `kam`, Kikuyu `ki`, Kinyarwanda `rw`, Kirundi `rn`, Lingala `ln` (tonal), Luganda `lg`, Mossi `mos` (Gur), Sepedi `nso`, Sesotho `st`, Setswana `tn`, Shona `sn`, Swahili `sw`, Umbundu `umb`, Wolof `wo` (Atlantic), Xhosa `xh`, Yoruba `yo` (tonal), Zulu `zu` |
| Nilotic | Luo `luo` (Dholuo; Western Nilotic — the dental/alveolar contrast, prenasalised stops; ±ATR + tone unwritten) |
| Romance | Catalan `ca`, French `fr`, Italian `it`, Portuguese `pt` (+ `pt-BR`), Romanian `ro`, Spanish `es` (+ `es-419` Latin-American) |
| Sinitic | Cantonese `yue`, Gan `gan`, Hakka `hak`, Jin `cjy`, Mandarin `cmn`, Min Nan `nan`, Wu `wuu`, Xiang `hsn` — all tonal |
| Slavic | Belarusian `be`, Bulgarian `bg`, Croatian `hr`, Czech `cs`, Polish `pl`, Russian `ru`, Serbian `sr` (Cyrillic + Latin), Slovak `sk`, Ukrainian `uk` |
| Tai-Kadai | Lao `lo` (tonal), Thai `th` (tonal), Zhuang `za` (tonal) |
| Tibeto-Burman | Burmese `my` (tonal) |
| Turkic | Azerbaijani `az`, Kazakh `kk`, Kyrgyz `ky`, Turkish `tr`, Uyghur `ug` (Arabic script), Uzbek `uz` |
| Uralic | Finnish `fi`, Hungarian `hu` |

**Accent variants** ride on a parent language's engine + a documented phoneme delta (not counted above):
`en-GB` = the GenAm English engine + a Received-Pronunciation lexical-set transform (non-rhoticity, BATH,
CLOTH, yod-retention, GOAT/NURSE/centring vowels), applied as an output post-process; `pt-BR` = the European
Portuguese engine parameterized for Brazilian realization (position-split reduction, /t d/→t͡ʃ/d͡ʒ before [i],
coda-l→[w], coda-s→[s]) — a deeper delta that lives inside the engine, since EP vowel reduction can't be undone
downstream. Legitimate because each uses the parent's community-adopted orthography and a referee-verifiable
delta; the pattern extends to en-IN.

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
Ohala schwa/inherent-vowel deletion, pluggable number compositors (Indic, Turkic, and a shared
Western/Slavic composer), clause assembly, and the canonical-IPA notation primitives. A per-language `*.jsonc`
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
