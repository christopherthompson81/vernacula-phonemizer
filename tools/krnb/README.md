# KRNB (Kamta / Rajbanshi / Rangpuri / Northern Deshi Bangla) — data foundation

Data-prep for the KRNB dialect-continuum bring-up (Eastern Indo-Aryan; `rkt` Rangpuri, `rjs` Rajbanshi, + Kamta /
Northern Deshi Bangla).

## Referees (`referees/*.tsv`)

Per-lect **Devanagari → IPA** wordlists, one file per Toulmin survey point. Extracted from **Toulmin (2006),
*Reconstructing linguistic history in a dialect continuum: The KRNB subgroup of Indo-Aryan* (ANU PhD, open-access),
Appendix A "Comparative KRNB wordlists"** — the comparative reconstruction lists proto-Kamta headwords with per-lect
reflexes in both IPA and Devanagari. This is an INDEPENDENT scholarly source (Toulmin's fieldwork + Turner's CDIAL),
so the (Devanagari→IPA) pairs are a non-circular g2p referee — NOT a Bengali/Assamese clone.

| tag | survey point | region | named lect | pairs |
|---|---|---|---|---|
| KS | Kishanganj | Bihar | Rajbanshi (W) | 352 |
| RL | Rangeli | Nepal (Morang) | Rajbanshi | 247 |
| SH | Shalkumar | Cooch Behar (WB) | Kamta | 298 |
| BH | Tufanganj | Cooch Behar (WB) | Kamta | 363 |
| TH | Thakurgaon | NW Bangladesh | Rangpuri | 335 |
| RP | Rangpur | Bangladesh | **Rangpuri** | 370 |
| MH | Mahayespur | (NE) | N. Deshi Bangla | 286 |
| BN | Bongaigaon | Assam | NDB / Goalpariya | 298 |

~2,500 clean pairs across 8 points (the 4 named lects each pool ~2). Corroboration for Rajbanshi: Wilde (2008),
*A Sketch of the Phonology and Grammar of Rājbanshi* (Helsinki, open-access) — full phonology + Appendix-2 lexicon.

## Extractor (`extract.ts`)

`pdftotext -layout` of Toulmin Appendix A → per-cell parse (the appendix is TWO-COLUMN; plain linearization merges
left+right entries and shreds the pairing) + rejoin space-separated combining diacritics (pdftotext splits dental
`t̪`→`t ̪`, nasal `ã`→`a ˜`) + strip trailing superscript ref-markers, then a strict clean filter (≥2 aksharas, all
valid-IPA). Run on the layout-text of Appendix A (`pdftotext -layout 10appendixA.pdf appA_layout.txt`). A
coordinate-based variant (`pdftotext -bbox`) can recover more (each Devanagari word is an intact box) — TODO: per-page
single-vs-two-column detection.

## Engine plan (next phase)

Reuse `makeNativeHindi` (the shared Devanagari abugida engine, the Marathi/Nepali pattern) + a KRNB manifest. KRNB
deltas from Hindi, read off the referees: **deaspiration** (ठ→ʈ, थ→t̪, ध→d̪, घ→ɡ …), dental त/द→t̪/d̪, retroflex
ट/ड→ʈ/ɖ, श/ष→ʃ, **no phonemic vowel length** (आ→a, ई→i …), inherent vowel ~[ɔ] (Eastern-Indic). Build the KRNB **core**
+ per-named-lect `dialect` deltas (the pt-BR pattern), validate each against its referee here; Rangpuri (`rkt`/RP)
first as the template. Tone is prosodic (Wilde) → not lexical → deferred/none.
