# Serbian (sr) native bring-up

Serbian / српски — South Slavic, ~12M speakers, DUAL SCRIPT (Cyrillic азбука + Gaj's Latin abeceda). A cleanroom
fully-phonemic g2p, espeak-independent.

## Data availability (checked up front)

- **wikipron hbs_latn broad** — 26,486 human words (PRIMARY; Serbo-Croatian covers Serbian/Croatian/Bosnian, which
  share the phoneme inventory — the ekavian/ijekavian difference is spelling-level, so the g2p reads whatever
  spelling each entry carries).
- **wikipron hbs_cyrl broad** — 24,349 (the same language in Cyrillic; our g2p handles both scripts).
- **epitran srp-Latn** — programmatic (SECONDARY, INDEPENDENT). Two genuinely independent referees.

## The rule core — "write as you speak"

Serbian orthography is the poster child for phonemic spelling (Vuk Karadžić's *piši kao što govoriš*): **one
grapheme = one phoneme, no vowel reduction** (unlike Russian). So the g2p is a one-letter lookup + three Latin
digraphs, with BOTH scripts in a single table (a word is one script; the maps don't collide):

- **⟨в/v⟩ → [ʋ]** (labiodental approximant, not [v]).
- The alveolo-palatal affricates **⟨ђ⟩→[d͡ʑ]** and **⟨ћ⟩→[t͡ɕ]**, vs the postalveolar **⟨џ/dž⟩→[d͡ʒ]** /
  **⟨ч/č⟩→[t͡ʃ]** — the four-affricate contrast Serbian is known for.
- **⟨љ/lj⟩→[ʎ]**, **⟨њ/nj⟩→[ɲ]** (palatals), **⟨х/h⟩→[x]**, **⟨ц/c⟩→[t͡s]**, **⟨ш/š⟩→[ʃ]**, **⟨ж/ž⟩→[ʒ]**.
- The Latin digraphs ⟨dž lj nj⟩ (+ ⟨dj⟩ as an ASCII fallback for đ) are matched before the single letters.
- Syllabic **⟨r⟩** (prst→[pr̩st]) — we emit a plain [r]; the referee's syllabic mark is folded by the backbone.

## The deferred layer — pitch accent

Serbian has a lexical **pitch accent** (a 4-way rising/falling × short/long system) plus phonemic vowel length.
Both are **unwritten** in normal text and **DEFERRED** — we emit no accent/tone/length mark. The wikipron referee
*does* mark them (â ǎ ê ô …), but the eval backbone strips the combining accent + length marks, so our
accent-free output matches.

## Run — vs the two referees

**97.9% vs wikipron / 99.2% vs epitran** — essentially a perfect phonemic g2p, both independent referees agreeing.
The only phoneme-level fold is ⟨v⟩ [v]~[ʋ] (the referee is inconsistent: voda→ʋoda but vuk→vuk) and ⟨h⟩ [x]~[ɦ]
(epitran voices it intervocalically). The tiny residual is: standalone **accent-letter headwords** (ȑ ȁ ȅ … — the
accented vowel letters as dictionary lemmas, which our letter map returns empty for), a few **foreign names**
(Abidjan where ⟨dj⟩=d͡ʒ not our đ; Džeko→[dʐ]), and outright referee errors (Frajtović mis-transcribed).

## Verdict — ✅ Reliable

A textbook phonemic orthography, verified near-perfectly against two independent referees in both scripts. Numbers
(hundreds dvesta/trista, the Slavic count agreement on hiljadu/hiljade/hiljada) are done. **Outstanding:** the
lexical pitch accent + length (unwritten — a lexicon/accent-dictionary would be needed, deferred, like the tonal
languages) and the ⟨dj⟩-in-foreign-names ambiguity (a diffuse tail).
