# Balochi (bal) native bring-up — Southern Balochi, Arabic script

Balochi / بلوچی (bal) — Northwestern Iranian, ~9M speakers (Balochistan across Pakistan, Iran, Afghanistan, + the
Gulf and Turkmenistan). Target: **Southern Balochi** (the Jahani & Korn reference variety), in the **Balochi Arabic
alphabet** (the default script the Baloch use).

## Gate — no machine referee, not aliasable

- **No referee:** nothing on wikipron (`bal`/`bcc`/`bgn`/`bgp`, Arab or Latn), no kaikki page for Balochi or any
  variety, no epitran `bal-Arab`/`bcc-Arab` map.
- **Not aliasable:** Balochi is a distinct NW Iranian language with **retroflex consonants (ʈ ɖ ɽ)** that the fleet's
  Iranian modules (fa/ps/ckb) lack — routing it to any of them would be wrong.
- **ISO macrolanguage:** Southern (bcc), Western/Rakhshani (bgn), Eastern (bgp). We target **Southern** (the best-
  described SWBal. reference; Eastern is the divergent one with aspiration + fricativisation).
- **But well-documented** → authorable the Madurese/Sudanese way, from **Jahani & Korn (2009), "Balochi", in *The
  Iranian Languages*** (CC-unclear, cited not copied): Table 11.1 (Pakistan alphabet), Table 11.6 (SWBal.
  consonants), Table 11.2 (ComBal. vowels).

## The inventory (Southern Balochi, from Jahani & Korn)

- **Consonants:** p b, **t̪ d̪** (dental) vs **ʈ ɖ** (retroflex), t͡ʃ d͡ʒ, k ɡ; s z ʃ ʒ, peripheral f x ɣ, h; m n; r,
  **ɽ** (retroflex tap); l; w j. **No native /q/** (ق→k). Southern Balochi is **unaspirated** (aspiration is an
  Eastern feature). The retroflexes (Indic contact) are the signature that distinguishes Balochi in the fleet.
- **Vowels:** short /a i u/ (unwritten), long /aː iː uː/, mid-long /eː oː/ (no short counterpart), + diphthongs aj/aw.

## The g2p and the honest ceiling

A left-to-right greedy Arabic scan (the ckb pattern): consonant lookup from Table 11.1, the و/ی matres lectionis
(glide [w]/[j] next to a vowel, else the long vowel), ا→[aː], ʿayn/hamza dropped, ں→nasalisation.

**The script is DEFECTIVE for vowels** — a textbook "variant without sufficient vowel-encoding":
1. the **short vowels /a i u/ are UNWRITTEN** (full abjad — گریب *garīb* → ɡriːb, the short a is gone), and
2. **⟨و⟩ conflates /uː/ and /oː/**, **⟨ی⟩ conflates /iː/ and /eː/** (خاموش *xāmōš* → xaːm**uː**ʃ, not xaːm**oː**ʃ).

So the g2p recovers the **consonant backbone + long-vowel positions** but not the short vowels or the o/u–e/i
quality (defaulted و→uː, ی→iː). This is inherent to Arabic-script Balochi, not a fixable engine gap — it is the
honest ⛔ ceiling. (A Roman-Balochi front-end would recover all vowels, but Roman Balochi is a minority orthography
that would not phonemise the script most Balochi text is actually written in.)

## Result & verdict: ⛔ cannot-verify

No independent referee exists, so the check is a **hand-gold on the sourced inventory** (`test/balochi.test.ts`, 10
words): each Arabic-script word's consonant + long-vowel backbone matches the Jahani & Korn value — verifying the
Table 11.1 mapping, the dental/retroflex contrast (ڈاکٹر→ɖaːkʈr, کتاب→kt̪aːb), and the affricates. **10/10.** But the
word-level Arabic spellings are author-supplied (no independent corpus), and the vowel encoding is defective →
**⛔** (fills the retroflex-Iranian census gap; the consonant inventory is sourced and falsifiable, the vowels are
script-limited). Numbers deferred. If a Balochi pronunciation corpus/wikipron ever appears, re-grade.

## Run 2 — cross-script lexical composition (⛔ → 🔷)

The user supplied two more sources, which resolve the referee problem: **ASJP Southern-Balochi (bcc)** (Lexibank,
CC0, an INDEPENDENT ~40-word Swadesh list by a different transcriber) and **Korn (2005a), *Towards a Historical
Grammar of Balochi*** (a rich romanised lexicon). Neither pairs Arabic-script with IPA — but together they fix the
right problem.

**The composition.** Balochi is written in BOTH the Arabic abjad and a phonemic Roman orthography. So:
- a **Roman-script g2p** (`phonemizeRoman`) reads the phonemic Roman orthography → full IPA directly (macron→long
  vowel, háček→postalveolar, dot-below→retroflex; balōč→baloːt͡ʃ, gwāt→ɡwaːt̪);
- a **cross-script lexicon** (`balochi-lexicon.tsv`, 399 words (55 curated core + 344 auto-mined from Korn's Etymological Index) compiled from Korn + J&K + ASJP, keyed by BOTH
  the Arabic and the Roman spelling → full-voweled IPA) lets the **Arabic** path recover the vowels the abjad loses:
  خاموش → xaːm**oː**ʃ (skeleton was xaːmuːʃ), گریب → ɡ**a**riːb (skeleton ɡriːb), روچ → roːt͡ʃ (skeleton ruːt͡ʃ).
- OOV Arabic still falls back to the defective skeleton (بلوچستان → bluːt͡ʃst̪aːn) — the honest tail.

**Independent verification.** The Roman g2p was measured against the ASJP transcriptions (a *different* transcriber →
genuinely independent) on the overlapping core vocabulary: **~97% (29-30/30)** folded (coarse — ASJP has no vowel
length or dental/retroflex). This corroborates the phoneme inventory that was previously only author-supplied.

**Verdict upgraded to 🔷.** Balochi now has an independent (if coarse) referee + a multi-source lexicon + a phonemic
Roman path that recovers the full vowel system. The Arabic-OOV skeleton remains ⛔-grade (defective abjad), but
lexicon-covered words and all Roman input are full-voweled and cross-checked. The lexicon is a seed to grow from
Korn's fuller vocabulary (its retroflex marks are lost in the PDF extraction — expand carefully).

## Run 3 — grow the lexicon from Korn's Etymological Index (55 → 399)

Bulk-mined **344 additional Balochi headwords** from Korn's Etymological Index (PDF pp. 348–419): each entry is a
headword immediately followed by its `"gloss"` (cognates end in `-`), so `(headword → gloss)` extracts cleanly.
Headwords convert deterministically to IPA (macron→long, háček→postalveolar; ǰ extracts as *i+caron* → fixed to
d͡ʒ), and a **reverse-transliteration generates the Arabic key** (native-letter defaults; short vowels omitted;
au/ai→aw/aj). The Roman g2p re-verified against ASJP holds (13/13 on the re-checked overlap).

**The retroflex limitation, handled honestly.** The PDF text layer loses the retroflex dot-below entirely (no
extractor recovers it — pdftotext/mutool/pdfminer/tesseract/PaddleOCR all fail or are inconsistent; see the
diagnosis above). Retroflex Balochi words are Indic/European loanwords, which are RARE in an index of *inherited*
Iranian vocabulary — only **4 of 356** mined words were flagged retroflex by PaddleOCR. Those 4 were image-verified
against the rendered pages: **kabāṭ "cupboard"** (Europ. loanword, p. 394) is genuinely retroflex → fixed to
kabaːʈ / کباٹ; the other three were OCR noise → dropped rather than shipped dental-wrong. The curated core + J&K
already carry the main retroflex vocabulary (ḍākṭar, ṭikaṭṭ) correctly.

**Caveat on the Arabic keys:** the reverse-transliteration is exact for native words but approximate for loanwords
(it can't predict the etymological letters ص/ض/ط/ظ/ذ/ث/ع). A wrong Arabic key is harmless — that word simply falls
back to the skeleton g2p for Arabic input — while the Roman key + IPA remain correct. Lexicon now **399 entries**.
