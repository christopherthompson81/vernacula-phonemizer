# vernacula-phonemizer

A **canonical-IPA** phonemizer for **186 languages** — native, cleanroom, and self-contained.
One output mode: consistent canonical IPA, tuned for speech-synthesis / TTS training. No
dual rendering, no runtime fallback — every language resolves to the same notation.

Every language is a cleanroom G2P built from the Unicode chart + published phonology (or,
where the orthography is irregular or non-phonemic, a derived lexicon or dictionary).
Correctness is **measured, not asserted**: each language is validated against *independent*
referees — human transcriptions (wikipron, kaikki) and independent G2Ps (epitran) — folding
away only notation and allophony, never a real phonemic contrast.

```ts
import { phonemizeAsync } from "vernacula-phonemizer";

// One line per script we ingest — real-world text (including UNDIACRITIZED abjads) → the same canonical IPA.
// phonemizeAsync is the unified best-output entry: it restores the abjads' unwritten vowels from BARE input
// (Hebrew עברית via the neural NAKDAN, Arabic العربية via the diacritizer) and uses each language's neural model
// where one exists (English's BiLSTM, the bn/da/nb/fr/sd taggers, the Persian restorers, the Perso-Arabic riders).
// Worst input, best output. A language written in two scripts yields ONE canonical IPA either way (Tashelhit in
// Latin/Tifinagh, Fula's Adlam, Bambara's N'Ko, Sundanese's Aksara Sunda, Zhuang's Sawndip).
await phonemizeAsync("I read a book", "en"); // Latin → aᶦ ɹˈɛd ə bˈʊk
await phonemizeAsync("Taclḥit", "shi"); // Berber Latin → taʃlħit
await phonemizeAsync("ⵜⴰⵛⵍⵃⵉⵜ", "shi"); // Tifinagh → taʃlħit
await phonemizeAsync("𞤆𞤵𞤤𞤢𞥄𞤪", "ff"); // Adlam → pˈulaːɾ
await phonemizeAsync("ߓߊߡߊߣߊ߲", "bm"); // N'Ko → bamanã
await phonemizeAsync("Ελληνικά", "el"); // Greek → elinika
await phonemizeAsync("Україна", "uk"); // Cyrillic → ukrajina
await phonemizeAsync("Հայերեն", "hy"); // Armenian → hɑjeɾen
await phonemizeAsync("ქართული", "ka"); // Georgian → kʰaɾtʰuli
await phonemizeAsync("עברית", "he"); // Hebrew → ʔivʁit
await phonemizeAsync("भारत", "hi"); // Devanagari → bʱˈaːɾət̪
await phonemizeAsync("ਪੰਜਾਬੀ", "pa"); // Gurmukhi → pˈə̃ɲd͡ʒaːbiː
await phonemizeAsync("ગુજરાતી", "gu"); // Gujarati → ɡˈud͡ʒɾat̪i
await phonemizeAsync("বাংলাদেশ", "bn"); // Bengali → baŋlad̪eʃ
await phonemizeAsync("ꠍꠤꠟꠐꠤ", "syl"); // Syloti Nagri → silʈi
await phonemizeAsync("ଓଡ଼ିଆ", "or"); // Odia → ˈoɽia
await phonemizeAsync("தமிழ்", "ta"); // Tamil → t̪ˈɐmɪɻ
await phonemizeAsync("తెలుగు", "te"); // Telugu → t̪ˈeluɡu
await phonemizeAsync("ಕನ್ನಡ", "kn"); // Kannada → kˈanːaɖa
await phonemizeAsync("മലയാളം", "ml"); // Malayalam → mˈalajaːɭam
await phonemizeAsync("සිංහල", "si"); // Sinhala → sˈiŋhələ
await phonemizeAsync("ᱥᱟᱱᱛᱟᱲᱤ", "sat"); // Ol Chiki → santaɽi
await phonemizeAsync("العربية", "ar"); // Arabic → alʕarabˈijːa
await phonemizeAsync("فارسی", "fa"); // Perso-Arabic → faːɾsˈiː
await phonemizeAsync("አማርኛ", "am"); // Geʽez → amaɾɲa
await phonemizeAsync("မြန်မာ", "my"); // Myanmar → mja˨ɴma˨
await phonemizeAsync("လိၵ်ႈတႆး", "shn"); // Shan → lik̚˧˧˨taj˥
await phonemizeAsync("ខ្មែរ", "km"); // Khmer → kʰmae
await phonemizeAsync("ภาษาไทย", "th"); // Thai → pʰˈaː˧saː˩˩˦tʰˌa˧j
await phonemizeAsync("世界", "cmn"); // Han → ʂʐ̩˥˩ t͡ɕiɛ˥˩
await phonemizeAsync("ひらがな", "ja"); // Hiragana → çiɾäɡäꜜnä
await phonemizeAsync("カタカナ", "ja"); // Katakana → kätäkänä
await phonemizeAsync("日本語", "ja"); // Kanji → niho̞ŋɡo̞
await phonemizeAsync("한국어", "ko"); // Hangul → hˈɐnɡuɡɘ
await phonemizeAsync("ꦗꦮ", "jv"); // Javanese → d͡ʒˈɔwɔ
await phonemizeAsync("ᮞᮥᮔ᮪ᮓ", "su"); // Aksara Sunda → sˈunda
await phonemizeAsync("བོད་སྐད", "bo"); // Tibetan → pʰøʔ˩kɛʔ˥
```

## Languages

186 languages spanning Albanian, Armenian, Austroasiatic,
Austronesian, Baltic, Basque (isolate), Berber, Celtic, Chadic, Cushitic, Dravidian, Eskimo-Aleut (Kalaallisut — the first Inuit language), Germanic, Hellenic, Hmong-Mien, Indo-Aryan, Iranian, Iroquoian (Cherokee — the first, in the Sequoyah syllabary), Italic, Japonic, Kartvelian, Khoe-Kwadi (Nama — the first CLICK language), Mixe-Zoquean (Totontepec Mixe — the first, Oaxaca), Koreanic,
Mayan, Mongolic, Niger-Congo (Bantu, Kwa, Mande, Gur, Atlantic), Nilotic, Northwest Caucasian (Abkhaz — huge consonant inventory), Quechuan, Romance, Semitic, Sinitic, Slavic, Tai-Kadai,
Tibeto-Burman, Tupian, Turkic, Uralic, Uto-Aztecan (Classical Nahuatl — the first, the Aztec language) and Portuguese- & English-lexified creoles — across Latin, Tifinagh, Adlam, N'Ko, Greek, Cyrillic,
Mongolian (Mongol bichig), Georgian (Mkhedruli), Armenian, Hebrew, Arabic and the extended Perso-Arabic (Persian,
Urdu/Shahmukhi, Sindhi), Geʽez, Devanagari, Bengali (+ Assamese Eastern-Nagari), Syloti Nagri, Gurmukhi, Gujarati,
Odia, Tamil, Telugu, Kannada, Malayalam, Sinhala, Myanmar, Khmer, Thai, Lao,
Han, Hiragana/Katakana/Kanji, Hangul, Javanese (Aksara Jawa), Aksara Sunda, Ol Chiki and Tibetan scripts.

Per-language reliability — *is the output trustworthy, and what (if anything) is
outstanding?* — lives in [`docs/language-maturity.md`](docs/language-maturity.md).

| Family / area | Languages |
|---|---|
| Albanian | Albanian `sq` (Shqip, Tosk-based standard; its own Indo-European branch — digraph-rich `dh th sh zh xh`, the palatals `gj q`, 7 vowels incl. `ë`→ə) |
| Armenian | Armenian `hy` (Eastern) and Western Armenian `hyw` (Istanbul/diaspora; the **consonant shift** — classical ⟨պ տ կ⟩→b d ɡ, classical ⟨բ դ գ⟩→pʰ tʰ kʰ), its own Indo-European branch |
| Austroasiatic | Khmer `km`, Vietnamese `vi` (tonal), Santali `sat` (Munda; Ol Chiki script, word-final checked stops) |
| Austronesian | Cebuano `ceb`, Hiligaynon `hil`, Ilocano `ilo`, Indonesian `id` (+ Standard Malay `zsm`), Javanese `jv`, Madurese `mad`, Malagasy `mg`, Sundanese `su` (Latin + Aksara Sunda), Tagalog `tl`, Māori `mi` (Polynesian), Hawaiian `haw` (Polynesian; the ʻokina glottal + macron length, one of the smallest phoneme inventories) |
| Baltic | Latvian `lv` (written palatals + fixed first-syllable stress), Latgalian `ltg` (E. Baltic; the ⟨i⟩/⟨y⟩ soft/hard palatalization, ⟨y⟩→ɨ), Lithuanian `lt` (palatalization + lexical pitch accent) |
| Berber (Amazigh) | Tashelhit `shi` (Shilha; Berber Latin + Tifinagh ⵜⵉⴼⵉⵏⴰⵖ) |
| Celtic | Irish `ga`, Scottish Gaelic `gd` (Goidelic; pre-aspiration + broad/slender), Welsh `cy` |
| Chadic | Hausa `ha` |
| Creole | Haitian Creole `ht` (French-lexified), Kabuverdianu `kea` (Portuguese-lexified), Nigerian Pidgin `pcm` (English-lexified), Papiamentu `pap` (Iberian-lexified, ABC islands; coda-n retention → word-final [ŋ]) |
| Cushitic | Oromo `om`, Somali `so` |
| Dravidian | Kannada `kn`, Malayalam `ml`, Tamil `ta`, Telugu `te` |
| Eskimo-Aleut | Kalaallisut `kl` (West Greenlandic; the fleet's first Inuit language — the three-vowel /a i u/ system, uvular `q`/`r`, `ng`→ŋ, gemination=length) |
| Germanic | Afrikaans `af`, Bavarian `bar`, Danish `da`, Dutch `nl`, English `en` (+ `en-GB`, `en-IN` accent variants), German `de`, Norwegian `nb` (Bokmål), Swedish `sv` (tonal accent), Luxembourgish `lb`, Icelandic `is`, Faroese `fo` (deep Insular orthography; length-conditioned vowel quality + skerping) |
| Hellenic | Greek `el` (Modern), Ancient Greek `grc` (reconstructed 5th-c. BCE Attic, Allen Vox Graeca; polytonic — aspirates θφχ→tʰpʰkʰ, ζ→zd, rough breathing→h, pitch accent) |
| Hmong-Mien | Hmong `hmn` (White Hmong / Hmoob Dawb, RPA; tonal) |
| Indo-Aryan | Assamese `as`, Awadhi `awa`, Bengali `bn`, Bhojpuri `bho`, Bishnupriya Manipuri `bpy`, Chhattisgarhi `hne`, Gujarati `gu`, Haryanvi `bgc`, Hindi `hi`, Magahi `mag`, Maithili `mai`, Marathi `mr`, Nepali `ne`, Odia `or`, Rangpuri `rkt` (KRNB), Punjabi `pa` (tonal; Gurmukhi) + Western Punjabi `pnb` (Shahmukhi), Saraiki `skr`, Sindhi `sd`, Sinhala `si`, Sylheti `syl`, Urdu `ur` |
| Iranian | Balochi `bal`, Central Kurdish `ckb` (Sorani), Kurmanji `kmr` (N. Kurdish), Pashto `ps`, Persian `fa`, Tajik `tg` |
| Iroquoian | Cherokee `chr` (ᏣᎳᎩ; the fleet's **first Iroquoian** — the Sequoyah **syllabary**, phonemically voiceless obstruents [k t t͡s t͡ɬ kʷ] with an aspiration-not-voicing contrast, ⟨v⟩→ə̃; tone/length/aspiration unwritten in the syllabary) |
| Isolate | Basque `eu` (euskara; the **three-way sibilant** contrast ⟨z s x⟩→s̻/s̺/ʃ, ⟨tz ts tx⟩→t͡s̻/t͡s̺/t͡ʃ — a language isolate with no living relatives) |
| Japonic | Japanese `ja` |
| Kartvelian | Georgian `ka` (its own family; Mkhedruli script, three-way ejective/aspirated/voiced stops) |
| Khoe-Kwadi | Nama `naq` (Khoekhoe/Khoekhoegowab; the fleet's **first click language** — 4 click types ⟨ǀ ǁ ǂ ǃ⟩ × accompaniments) |
| Koreanic | Korean `ko` |
| Mayan | K'iche' `quc` (Qatzijob'al; the ejective/glottalized series b'/k'/q'/tz'/ch' vs the aspirated plain stops, uvular q) |
| Mixe-Zoquean | Totontepec Mixe `mto` (ayöök; the fleet's **first Mixe-Zoquean** — authored from Crawford 1963; 9 vowels + length, post-nasal voicing p/t/ts/k→b/d/dz/ɡ, palatalized `cy`→t͡ʃ) |
| Mongolic | Mongolian `mn` (Khalkha) |
| Niger-Congo | Akan `ak` (tonal, Kwa), Bambara `bm` (Mande; Latin + N'Ko), Chichewa `nya`, Ewe `ee` (Gbe, Kwa; labial-velars, ƒ/ʋ bilabials, toneless), Fula `ff` (Atlantic; Latin + Adlam), Igbo `ig` (tonal), Kamba `kam`, Kikuyu `ki`, Kinyarwanda `rw`, Kirundi `rn`, Lingala `ln` (tonal), Luganda `lg`, Mossi `mos` (Gur), Sepedi `nso`, Sesotho `st`, Setswana `tn`, Shona `sn`, Swahili `sw`, Umbundu `umb`, Wolof `wo` (Atlantic), Xhosa `xh`, Yoruba `yo` (tonal), Zulu `zu` |
| Nilotic | Luo `luo` (Dholuo; Western Nilotic — the dental/alveolar contrast, prenasalised stops; ±ATR + tone unwritten) |
| Northwest Caucasian | Abkhaz `ab` (аҧсуа; the fleet's **first NW-Caucasian language** — one of the world's largest consonant inventories with ~58 consonants, only 2 vowels; ⟨ь⟩ palatalizes / ⟨ә⟩ labializes / ⟨'⟩ pharyngealizes) |
| Quechuan | Quechua `qu` (Southern Quechua / Runasimi; 3-vowel system, overt three-way stop series plain/aspirated/ejective, uvular `q`, penultimate stress) |
| Romance | Aragonese `an` (Pyrenean; ⟨ch⟩→t͡ʃ, ⟨ny⟩→ɲ, ⟨x⟩→ʃ, seseo, final-r apocope), Catalan `ca`, French `fr` (+ `fr-CA` Québécois), Galician `gl`, Italian `it`, Portuguese `pt` (+ `pt-BR`), Romanian `ro` + Aromanian `rup` (Balkan Romance; digraphs ts/dz/sh/nj/lj, dh/th interdentals, ã→ə), Spanish `es` (+ `es-419` Latin-American), Occitan `oc` (Languedocien), Asturian `ast` |
| Semitic | Amharic `am`, Tigrinya `ti`, Arabic `ar` (MSA) + Egyptian `arz`, N. Levantine `apc`, S. Levantine `ajp`, Iraqi `acm`, Gulf `afb`, Hijazi `acw`, Sudanese `apd`, Moroccan `ary`, Libyan `ayl`, Hebrew `he`, Maltese `mt` |
| Sinitic | Cantonese `yue`, Gan `gan`, Hakka `hak`, Jin `cjy`, Mandarin `cmn`, Min Dong `cdo` (Fuzhou, Bàng-uâ-cê input), Min Nan `nan`, Wu `wuu`, Xiang `hsn` — all tonal |
| Slavic | Belarusian `be`, Bosnian `bs`, Bulgarian `bg`, Croatian `hr`, Czech `cs`, Macedonian `mk`, Polish `pl`, Russian `ru`, Serbian `sr` (Cyrillic + Latin), Slovak `sk`, Slovenian `sl`, Ukrainian `uk` |
| Tai-Kadai | Lao `lo` (tonal), Shan `shn` (tonal), Thai `th` (tonal), Zhuang `za` (tonal) |
| Tibeto-Burman | Burmese `my` (tonal), Tibetan `bo` (Standard/Lhasa; Bodish — deep orthography, syllable-stack rule engine: tonogenesis, silent prefixes/superscripts, suffix umlaut/length/nasalization) |
| Tupian | Guaraní `gn` (Paraguayan / Avañe'ẽ; 12 vowels incl. 6 nasal, prenasalized `mb nd`, the glottal `'` puso, glide formation) |
| Turkic | Azerbaijani `az`, Kazakh `kk`, Kyrgyz `ky`, Turkish `tr`, Turkmen `tk` (Oghuz; the interdental `s`→θ / `z`→ð hallmark), Tatar `tt`, Bashkir `ba` (Kipchak, Cyrillic; harmony-backing к/г→q/ʁ), Crimean Tatar `crh` (Kipchak+Oghuz, Turkish-based Latin), Chuvash `chv` (Oghur — the **sole surviving Bulgaric** branch, the deepest split in Turkic, Cyrillic; allophonic intervocalic/post-nasal voicing + reduced-vowel `ӑ ӗ` stress), Karakalpak `kaa` (Kipchak, 2016 Latin; written uvulars q/x/ǵ + acute front vowels á ó ú), Nogai `nog` (Kipchak-Nogai, Cyrillic; written-uvular digraphs къ/гъ/нъ + front-vowel digraphs аь/оь/уь), Uyghur `ug` (Arabic script), Uzbek `uz` |
| Uralic | Estonian `et`, Finnish `fi`, Hungarian `hu`, Lule Sami `smj` (julevsámegiella; the fleet's **first Saami** — North-Saami-style voiceless ⟨b d g⟩→[p t k], diphthongs ie/uo/oa; authored from Ylikoski) |
| Uto-Aztecan | Classical Nahuatl `nci` (nāhuatlahtōlli, the Aztec language; the fleet's **first Uto-Aztecan** — the Spanish-orthography context rules ⟨c⟩→k/s, ⟨cu/uc⟩→kʷ, ⟨hu/uh⟩→w, saltillo ⟨h⟩→ʔ, ⟨tz tl ch⟩ affricates; authored from Andrews) |

**Accent variants** ride on a parent language's engine + a documented phoneme delta (not counted above):
`en-GB` = the GenAm English engine + a Received-Pronunciation lexical-set transform (non-rhoticity, BATH,
CLOTH, yod-retention, GOAT/NURSE/centring vowels), applied as an output post-process; `pt-BR` = the European
Portuguese engine parameterized for Brazilian realization (position-split reduction, /t d/→t͡ʃ/d͡ʒ before [i],
coda-l→[w], coda-s→[s]) — a deeper delta that lives inside the engine, since EP vowel reduction can't be undone
downstream. Legitimate because each uses the parent's community-adopted orthography and a referee-verifiable
delta; the same pattern covers `en-IN` (General Indian English) and `fr-CA` (Québécois French).

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
  (Malayalam's samvritokaram, Odia's retroflex flap, …). The Devanagari languages (Marathi,
  Bhojpuri, Awadhi, Maithili, …) and Gujarati reuse the Hindi orchestration on top.
- **Dictionary front-end** — where the script doesn't encode the reading. The nine Sinitic
  languages map Han → reading → IPA: Mandarin/Cantonese via pinyin/Jyutping dictionaries, Wu
  and Min Nan via a romanization layer (Wugniu, Tâi-lô), and Gan/Hakka/Jin/Xiang via a shared
  engine (`sinitic/hanDictIpa.ts`) over Wiktionary Sinological-IPA dictionaries with tone-sandhi.
  Japanese resolves kanji readings and pitch accent the same way.
- **Abjad + vowel restoration** — for Arabic and the Perso-Arabic abjads (Urdu, Persian,
  Pashto, Sindhi), where short vowels are usually unwritten. Arabic ships a neural diacritizer
  that restores them; the others recover the consonant + long-vowel skeleton and restore short
  vowels from a coverage lexicon (+ a shared neural tier).
- **Lexicon + statistical OOV** — where the orthography is irregular. English is a
  CMUdict-derived lexicon + a POS perceptron for heteronyms, with the OOV tail read by a BiLSTM
  (or a cleanroom joint n-gram when the model is absent); French is a Lexique-derived lexicon
  over a *loi-de-position* rule engine; Nigerian Pidgin (an English-lexified creole) nativises
  known English words and reads the substrate loans phonemically.

Nine languages have an **optional neural tier** on top of their engine (`languages/<lang>/<lang>Neural.ts`,
dispatched by `neuralRegistry.ts`): a per-grapheme BiLSTM reading the OOV tail (English, Bengali,
Danish, Norwegian, French, Sindhi), a niqqud restorer for Hebrew, the Persian restorers, and one
multilingual harakat model shared by the Perso-Arabic riders (`languages/perso-arabic/`). Each is an
ONNX model behind an *optional* `onnxruntime-node`; when the runtime or the model is absent the path
degrades to the sync engine, so `phonemizeAsync` is always safe to call.

Before any of that runs, a **text-normalization layer** rewrites what isn't lexical into words the
engine can already pronounce, so no symbol reaches the phonemizer unspoken. Numbers go through
per-language compositors (50 languages); percent, currency and unit abbreviations become each
language's *own* words in the 25 languages wired so far (`40%` → "في المئة" / "yüzde kırk" /
"百分之四十", `$5 million` → "5 million dollars"), with count agreement where the language needs it
(the Slavic three-way, Welsh mutation, Irish counting-vs-attributive series). Dates, times, years
and roman numerals are English-only — their rules are language-specific by nature, and the rest of
the fleet is unwired.

These sit on a small **shared core**: the abugida engine, quantity-sensitive weight stress,
Ohala schwa/inherent-vowel deletion, pluggable number compositors (Indic, Turkic, and a shared
Western/Slavic composer), the symbol/unit normalizer, the shared structural-tagger runtime, clause
assembly, and the canonical-IPA notation primitives. A per-language `*.jsonc` manifest holds the
hand-authored data so the code stays a thin, portable interpreter.

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
  what's left?" lives in [`docs/language-maturity.md`](docs/language-maturity.md).

## Canonical IPA conventions

One consistent convention across all languages, tuned for TTS/synthesis training: stress
**before** the nucleus (`ˈ`), aspiration `kʰ/pʰ/t̪ʰ`, breathy voice `ʱ`, dental `t̪ d̪` vs
retroflex `ʈ ɖ ɳ`, dark-l `ɫ`, tap `ɾ` vs trill `r`, affricate tie-bars `t͡ʃ d͡ʒ`, Chao tone
letters `˥˩`, offglide superscripts `aᶦ aᶷ`, and geminates as length `ː`. English adds GenAm
flapping `t̬` and the weak vowel `ᵻ`. The notation primitives (`src/core/unicode.ts`,
`src/core/phonology.jsonc`) are the source of truth.

## Usage

```ts
import { phonemizeAsync, phonemize, getPhonemizer } from "vernacula-phonemizer";

await phonemizeAsync("نمسته", "ur"); // preferred: each language's best path
phonemize("नमस्ते", "hi"); // synchronous: rules + lexicons only
const ur = getPhonemizer("ur"); // reusable per-language instance
ur.text("میرا نام");
```

Both entries tokenise words, numbers (native number compositors) and clause punctuation, route
embedded Latin runs through the English phonemizer, and return canonical IPA.

**Which entry to use.** `phonemizeAsync` is the unified best-output path and what you want for
real text: it adds the neural tier where one exists and restores unwritten vowels in the abjads
from bare input. `phonemize` is synchronous and complete for every language, with two caveats —
the unpointed abjads (Arabic + dialects, Hebrew) expect *vocalized* input, and the nine
neural-tier languages fall back to their rule/lexicon path.

## Repository layout

```
src/index.ts            the public API (phonemize / phonemizeAsync)
src/registry.ts         sync dispatch — one explicit row per language
src/neuralRegistry.ts   async dispatch — the neural/restoration best paths
src/core/               shared engine (abugida, Sinitic dict, stress, schwa, numbers,
                        symbol normalizer, tagger runtime, notation) — code only
src/languages/<lang>/   per-language module + *.jsonc manifest + data + any model/tagger
                        + <lang>Neural.ts where a neural tier exists
src/languages/perso-arabic/  the harakat model shared by the ur/ps/pa riders

tools/gen/              generators that BUILD shipped data under src/languages/
tools/referee-eval/     the independent-referee harness + referees/ + regression floors
tools/eval/             one-off per-language validation vs an external source/benchmark
tools/<lang>/           that language's model train/export pipeline (mirrors src/languages/)
tools/corpus/           reusable wordlist/referee fetchers

docs/language-maturity.md    per-language reliability + what's outstanding
LICENSES/                   every data artifact → upstream source → parent license, and the posture
test/                        golden IPA tests
```

Nothing under `tools/` ships — `src/` is self-contained at runtime; `tools/` is the provenance
and reproducibility record plus the measurement harnesses ([`tools/README.md`](tools/README.md)).

## License & provenance

The engine and this project's own work are **MIT**. Third-party-derived data keeps its parent
license, declared per file — CC0/public-domain (CMUdict, the NST lexicons, HomoRich), permissive
with attribution (pypinyin, rime-cantonese, Google language-resources, the Sindhi Open Lexicon),
CC-BY-SA for the Wiktionary-family lexica, and two GPL-lineage data files. Every artifact is
mapped to its source and license in [`LICENSES/PROVENANCE.md`](LICENSES/PROVENANCE.md); the reasoning —
including when a mechanical table of linguistic facts does *not* inherit an upstream license — is
[`LICENSES/licencing_posture.md`](LICENSES/licencing_posture.md).
