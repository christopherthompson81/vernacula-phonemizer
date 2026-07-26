# KRNB (Rangpuri / Kamta / Rajbanshi / Northern Deshi Bangla) bring-up — Eastern Indo-Aryan dialect continuum

**Codes:** `rkt` Rangpuri, `rjs` Rajbanshi (Nepal); Kamta + Northern Deshi Bangla have no clean ISO. ~15M aggregate
(census-contested — merged with Bengali/Assamese). Proposed architecture: a **KRNB core + servable per-lect
deltas** (the pt-BR `dialect`-param pattern) — see [[accent_variant_architecture]].

## Run 1 — 2026-07-26 — data-anchor assessment (go/no-go)

**No machine referee** (probed): wikipron `rkt/rjs/kmt` = 0, kaikki Rangpuri/Rajbanshi/Kamtapuri/Goalpariya = 404,
epitran = none. So NOT a wikipron-style bring-up — the risk was the `bho` ⛔ cannot-verify trap.

**GREEN LIGHT — the data is much stronger than expected, from academic PDFs:**

### The linchpin — Toulmin (2006) Appendix A (ANU open repository)
"Comparative KRNB wordlists: Proto-Kamta and reflexes in eight descendent lects." **103pp, text-extractable IPA.**
- **1,005 proto-Kamta reconstructed headwords** (the shared CORE) + per-headword **CDIAL etymology + stratum class**
  (Tatsama / altered-Tatsama / Tadbhava / semi-Tatsama / Perso-Arabic).
- **Reflexes in 8 lects**, each as `TAG: <IPA> <Devanagari>;` — so BOTH the IPA *and* an orthographic (Devanagari)
  form are given → directly yields **(Devanagari → IPA)** g2p test pairs.
- **This is the core+delta decomposition, done by a linguist:** proto-Kamta = core, the 8 reflex columns = deltas.
  Non-circular (Toulmin's fieldwork + Turner's CDIAL, NOT a Bengali clone). The distinctive KRNB features Toulmin
  reconstructs (retroflex ɳ/ɭ vs dental, final *ɔ, etc.) are what keep the core provably-KRNB → 🔷 not ⛔.
- **The 8 lect TAGS decoded** (from Toulmin Appendix C, survey informants) → survey points → the 4 named lects
  (geographic grouping, ~2 points each — verify against Toulmin's genealogical subgrouping at build time):
  | tag | site | region | named lect |
  |---|---|---|---|
  | KS | Kishanganj | Bihar (W) | **Rajbanshi** (western) |
  | RL | Rangeli | Nepal, Morang | **Rajbanshi** |
  | SH | Shalkumar | Cooch Behar, WB | **Kamta** |
  | BH | Tufanganj | Cooch Behar, WB | **Kamta** ("Barman") |
  | TH | Thakurgaon | NW Bangladesh | **Rangpuri** |
  | RP | Rangpur | Bangladesh | **Rangpuri** ("Bahe Bangla") |
  | MH | Mahayespur | (NE) | **Northern Deshi Bangla** |
  | BN | Bongaigaon | Assam | **NDB / Goalpariya** |
  So the 4 named lects each merge ~2 survey-point referees (~600-1300 forms each if pooled). Downloaded Appendix C
  (survey sites) — `appC.pdf` in scratchpad.

### Corroboration
- **Wilde (2008)**, *A Sketch of the Phonology and Grammar of Rājbanshi* (Helsinki, full text): complete Nepal
  Rajbanshi phonology + **Appendix 2 lexicon** + text corpus. Pitch is **prosodic/intonational, not strong lexical
  tone** in his Jhāpā varieties — so tone is a lighter concern than first assumed (soften the tonogenesis claim).
- **SIL** *Sociolinguistic Survey of Rajbanshi & Tajpuriya* (Nepal): describes a 210-item wordlist × 6 survey points
  (Duhagadhi/Rajgadh/Gauriganj Jhāpā + Thurkiya/Mahadeva Morang), IPA. **NEGATIVE RESULT:** the raw wordlist ANNEX is
  NOT in the published PDF (100pp, ends at References p90) — PaddleOCR (run by the user) confirmed only the report body
  is present, no wordlist table. So SIL is a dead end for data; **Wilde's Appendix 2 lexicon replaces it** as the
  Nepal-Rajbanshi (rjs) corroboration (extractable from the Wilde text). PaddleOCR was correctly declined for Toulmin
  (clean text layer) — OCR only helps scanned docs, and here the scanned doc simply lacks the target data.

### Extraction (tools built, in scratchpad `/…/krnb/`)
`pdftotext -layout` is REQUIRED — the appendix is **two-column**; plain mode interleaves left+right entries (different
headwords) and shreds the pairing. Per-cell parse + **rejoin space-separated combining diacritics** (pdftotext splits
dental `t̪`→`t ̪`, nasal `ã`→`a ˜`) + strip trailing superscript ref-markers (`$ & + ` superscript letters). Yields:

| lect | raw pairs | strict-clean pairs |
|---|---|---|
| KS | 570 | 352 |  RL | 623 | 247 |  MH | 661 | 286 |  TH | 584 | 336 |
| SH | 556 | 299 |  **RP (Rangpuri)** | **687** | **374** |  BH | 680 | 365 |  BN | 486 | 300 |

≈**2,500 strict-clean (Deva→IPA) pairs across 8 lects** (≈4,600 raw) — a real medium referee per lect (cf. Awadhi 33,
Wolof 69). Sample RP: आगोन→agon, ओतटा→ɔt̪oʈa, आगोत→agot̪, आकाश→akaʃ, आठ→aʈ.

**Status ceiling:** 🔷 single-source-but-medium PER LECT (the `mk`/`lt` category), NOT thin/⛔. A genuine
referee-validated bring-up.

### Two gates before the engine build
1. **LICENSE/provenance of the Toulmin-derived referee** — the fleet ships only CC0/CC-BY/CC-BY-SA/PD data. The
   existing referees are wikipron (CC-BY-SA) / kaikki (Wiktionary). Toulmin's dissertation is *open-access* but not
   CC-licensed; extracted word→pronunciation FACTS are the same kind of derived data as the wikipron referees, but
   the compilation provenance differs → **user decision needed** before committing the referee TSVs / shipping.
2. **Scope + codes** — ship all 8 Toulmin lects, or collapse to the 4 named (Rangpuri/Kamta/Rajbanshi/NDB) with the
   rest `served_by`? Kamta + NDB have no clean ISO (pseudo-code or served-by). Decode the 8 TAGs first.

### Remaining engine-build plan (next phase)
- Read Toulmin ch.4 (proto-Kamta → NIA sound changes) → the KRNB **core** g2p (Eastern-Indic Devanagari scan with the
  KRNB-distinctive reflexes; abugida engine like `hi`/`bn` but KRNB values).
- Per-lect **`dialect` deltas**, each validated against its ~300 Toulmin forms; Rajbanshi cross-checked vs Wilde.
- Target **Devanagari** orthography (cleanest-extracting + Nepal-Rajbanshi/Kamtapuri-activist script); Bengali-Assamese
  script a deferred 2nd front-end.

## Run 2 — 2026-07-26 — Rangpuri (rkt) engine → 63.8% folded / 86.8% symbol

Built `rkt` (Rangpur point) as the template: reuse `makeNativeHindi` + a KRNB manifest (the Marathi/Nepali pattern).
KRNB deltas, read off the RP referee and MEASURED (15.7% → 48.6% → 55.1% → **63.8%** after the 2-agent review):

- **DEAFFRICATION** च/छ→[s], ज→[d͡z], झ→[d͡zʱ] (काचे→kase, गाजोर→gad͡zor — the Assamese-area feature);
- **ASPIRATION (the review's big correction — I first got this backwards):** VOICED aspirates are **RETAINED**
  (घ झ ढ ध भ → ɡʱ d͡zʱ ɖʱ d̪ʱ bʱ: घर→ɡʱɔr, धार→d̪ʱar, भात→bʱat̪) — NOT deaspirated. VOICELESS aspirates (ख ठ थ फ) are
  **POSITIONAL**: kept word-INITIALLY (ठीक→ʈʰik, खलान→kʰɔlan) but deaspirated elsewhere (आठ→aʈ, पाथर→pat̪or, हाथ→hat̪)
  — a postRule `(?<!^)(t̪|[kʈp])ʰ→$1` that strips voiceless `ʰ` off non-initial stops (leaving voiced `ʱ` intact);
- **inherent vowel [ɔ]** — kept `ə` in the manifest so the shared schwa-DELETION fires (आगोन→agon, final deleted;
  खलान→kʰɔlan, initial retained), then a finalRule `ə→ɔ`;
- **no phonemic vowel length** (आ→a, ई→i…), **व→[w]**, **ण→[n]**, ◌ॉ→[æ], श/ष→ʃ.

**Wins, in order:** fold the shared engine's weight-stress `ˈ` (KRNB stress is prosodic per Wilde) + `ɡ→g`/`ʣ→dz`/`ɦ→h`
(Toulmin's ASCII/ligature notation) → 48.6%; the ि-matra visual-reorder fix (िबष→बिष, +6.5pp) → 55.1%; the
**aspiration correction + ɦ→h** (2-agent review) → **63.8% folded / 86.8% symbol**.

**Residual — an HONEST mix** (the review corrected my first over-optimistic "it's all extraction noise" framing):
(a) genuine two-column-PDF **extraction noise** (trailing ref-marker vowels ɔmona/alo, misalignments aŋgul); (b) real
remaining **engine/fold divergences** — च→[s] vs the referee's occasional [ʃ] (आधाचेर→…ʃer), the vowel-quality
folds ɔ~o / æ~e (Eastern-Indic raising; a genuine but folded contrast — ~7pp of the lift, disclosed not hidden), and
the anusvara limitation (KRNB wants plain [ŋ]: आंटी→aŋʈi, but the Hindi engine does vowel-nasalization+homorganic and
the `effect` field isn't dispatched — ~5 words). The 86.8% symbol accuracy shows the segmental core is solid, but the
folded number is a *mix* of referee noise and these residual gaps, not pure noise. 🔷 single-source (Toulmin RP).

## Run 3 — 2026-07-26 — 2-agent review

The review caught a real correctness error and an overclaim: (1) **aspiration was backwards** — I had deaspirated the
VOICED aspirates (घ→ɡ etc.), but the referee retains them (घर→ɡʱɔr, 33/370 words carry ʱ) and instead deaspirates the
VOICELESS aspirates POSITIONALLY (initial kept, else stripped). Fixed (voiced retained + the non-initial-`ʰ` postRule);
**+8.7pp (55.1→63.8)**. (2) The "residual is all extraction noise / every clean spot-check matches" framing was an
**overclaim** — reframed above as an honest mix. Also fixed the ⟨ह⟩ ɦ→h fold and the stale "voiceless aspirates kept"
wording. Kamta/Rajbanshi/NDB (the other 3 lects) follow as `dialect` deltas off this core — referees staged in
`tools/krnb/referees/`.
