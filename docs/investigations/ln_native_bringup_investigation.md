# Lingala (ln) native bring-up

Lingala / Lingála (ln) — a Bantu (C30B) lingua franca of the Congo basin (DRC + Republic of the Congo, ~20M native
+ ~20-25M L2). Joins the fleet's Bantu cohort (Chichewa, Shona, Swahili, Zulu, Xhosa, Kinyarwanda, Setswana).

**Scope gates:** Latin orthography (community-adopted) + a small human referee — **kaikki Lingala** (~55 usable
pronunciation entries, with tone + prenasalisation + syllable dots) → **🔷 single-source** (the ceb/su/mad pattern).
No wikipron ln; epitran ships no Lingala.

**Sources.** Authored from **Meeuwis (2020) "A Grammatical Overview of Lingála" (Revised & Extended Edition)** — the
user supplied both the 1998 (1st) and 2020 editions; the 2020 one materially corrected the phonology (see below), so
it is the authority. It describes the prestige **Kinshasa** variety.

**What makes it interesting:** it is the **FIRST Bantu in the fleet where TONE is WRITTEN** — Lingala marks High
tone with the acute accent (mabelé, mbɔ́tɛ), so tone is DERIVABLE (the Yoruba pattern), unlike Chichewa/Shona/Zulu
where it's unwritten and deferred. Because kaikki carries tone, tone here is directly **MEASURED, not folded**.

## Run 1 — build (Meeuwis 2020)
A greedy longest-match g2p (Chichewa pattern) + accent-based per-nucleus tone (Yoruba pattern). Phonology per
Meeuwis §2:
- **Consonants (13 phonemes):** b d f g k l m n p s t v z + semi-vowels w, y(=j). **No native /r/ or /h/** (loan
  graphemes). PRENASALISED obstruents are SINGLE onset units — ⟨mb nd ng nz⟩ → ᵐb ⁿd ᵑɡ ⁿz (homorganic ᵐ/ⁿ/ᵑ);
  ⟨ny⟩ → ɲ. (Kinshasa word-initial voiceless prenasals surface WITHOUT the nasal — but the orthography already
  encodes this, so the g2p just renders what's written.)
- **Vowels:** 7 graphemes a e ɛ i o ɔ u rendered as written. **The 2020 edition's key correction:** Kinshasa
  Lingála is phonemically **5-vowel** (ɛ/ɔ merged into e/o), so ⟨e⟩=/e/~/ɛ/ in casual spelling is an unrecoverable
  gap — but ɛ/ɔ are rendered where the (careful/northwestern) orthography writes them (as kaikki does).
- **No diphthongs (§2.1.5):** vowel sequences are HIATUS — each vowel is a separate tone-bearing nucleus
  (mái = ma.i), not a diphthong (correcting the 1998 edition's "diphthong" framing). The g2p treats each vowel as
  a nucleus → this falls out for free. **No vowel harmony** (§2.1.4, absent in Kinshasa), no length, no phonemic
  nasalisation (§2.1.3) — none modelled.
- **Tone (§2.4):** two tones H/L (+ rising/falling contours). Marked only in careful writing: acute → H (˥),
  háček → rising (˩˥), circumflex → falling (˥˩), unmarked → L (˩). Applied per nucleus. Casual (toneless) input
  defaults to L.
- **Numbers (§3.6):** cardinal = the connective ya + the ordinal; compounds joined by na (zómi na mǒkó = 11, túkú
  míbalé = 20, kámá = 100, kóto = 1000).

**Result: 97.1% folded (33/34) vs kaikki** — with **tone MEASURED, not folded** (it matches). The single miss is an
isolated letter-cluster entry (mb: our ᵐb vs kaikki ⁿb). Folds are pure notation: strip kaikki's syllable dots +
metrical ˈ, and ᵑɡ~ⁿɡ (kaikki writes ⁿ for the velar prenasal). Two bugs fixed at author time: the eval referee's
syllable dots (the whole 17.6%→97.1% jump), and a tokenizer bug — precomposed accented vowels (NFC á) split the
word token, dropping the vowel; fixed by NFD-ing the input before tokenising. Gold: test/lingala.test.ts (5 groups
incl. the tonal minimal pair moto/motó). **🔷 single-source.** Outstanding: the ⟨e⟩=/e/~/ɛ/ casual-spelling gap
(inherent to the 5-vowel Kinshasa orthography) + toneless-input default-L (no lexicon; the common casual case).
