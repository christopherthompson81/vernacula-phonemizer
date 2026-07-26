# Min Dong (Eastern Min, cdo) native bring-up — investigation

Eastern Min / Fuzhounese (Fuzhou dialect), Sinitic, ~9M speakers — the only absent major Sinitic branch in the
fleet. The user asked to bring it up; the feasibility gate + the honest-scope choice were the first task.

## Run 1 — 2026-07-26 — feasibility + scope

- **Q:** Is there a referee, and can a *non-circular* g2p be built?
- **Probes:**
  - wikipron: `cdo_hani_fuzhou_broad.tsv` exists (**9099 entries**, Han→IPA; 4611 single-char citation + 4488
    multi-char sandhi). The obvious codes (`cdo_latn_broad`) 404 — Min varieties are scraped under
    `<code>_hani_<city>_broad` (cf. the `nan` sibling's `nan_hani_hokkien_broad`).
  - kaikki: no `Eastern Min` / `Min Dong` per-language extract (404). The data lives inside the **1.18 GB Chinese
    dump** (`sounds` array: `{zh_pron, tags:[Min-Dong,Fuzhou,Foochow-Romanized]}` = the BUC spelling +
    `{ipa, tags:[Min-Dong,Sinological-IPA]}` = the IPA). Example 犬 → BUC `kēng` / IPA `kʰɛiŋ³³`.
  - epitran: no `cdo-Latn` map (the `nan` converter came from epitran's `nan-Latn-tl` spec; cdo has none).
- **The circularity fork:** the `nan` template is Han→romanization dict (independent MOE source) + romanization→IPA
  converter, validated on wikipron. For cdo there is **no independent machine-readable Han→reading dictionary** — the
  only comprehensive source is Wiktionary, which is what wikipron scraped. So a **Han-input** phonemizer would be
  circular (dict = referee source). Worse, the wikipron IPA is almost certainly **rule-generated** by Wiktionary's
  `Module:cdo-pron` (9099 entries carry perfect sandhi arrows `⁻` and systematic `l̃`/`nˡ` initial-assimilation — not
  hand-transcription), so even a converter validated against it is **reference-implementation parity**, not
  independent human attestation.
- **Decision (user):** build the clean non-circular *engine* — a **Bàng-uâ-cê (BUC / Foochow Romanized) → IPA
  converter** (BUC is phonemic and documented; the analog of `nan`'s direct-Tâi-lô path). Validate against BUC↔IPA
  pairs extracted from the 1.2 GB kaikki dump. **Phase 1 = segmental + citation tone**; defer the Han front-end (no
  independent dict), tone sandhi (連讀變調), initial assimilation (聲母類化 l→l̃, etc.), and rime alternation (韻變,
  the 松/緊 tight/loose split). Label **🔷 reference-implementation parity** (not independent human verification).
- **BUC signature (missionary convention):** the plain stop letters are ASPIRATED — ⟨p t k⟩ = [pʰ tʰ kʰ], ⟨b d g⟩ =
  [p t k]; ⟨c⟩ = [tsʰ], ⟨z⟩ = [ts]; tone marked by a vowel diacritic (macron etc.). Maps derived empirically from the
  extracted BUC↔IPA pairs (reference-parity), cross-checked against the documented Foochow-Romanized tables.

## Run 2 — engine build + result

Extracted **10543 Min-Dong pairs** (5320 single-syllable citation) by streaming the 1.18 GB kaikki Chinese dump
once (`{Foochow-Romanized zh_pron} ↔ {Sinological-IPA ipa}`). After cleaning Wiktionary annotation leakage
(`^(→…)`, slashes) → **1514 clean single-syllable BUC↔IPA pairs** = the referee.

**Maps derived empirically** (reference-parity) by aligning BUC onsets/rimes to IPA:
- **Initials (14 + zero)** — the missionary convention, unambiguous in the data: `b→p p→pʰ`, `d→t t→tʰ`,
  `g→k k→kʰ`, `c→t͡s ch→t͡sʰ`, `s→s h→h m→m n→n l→l ng→ŋ`, zero→∅. (The referee writes the l/n initial narrowly
  as `l̃`/`nˡ`; we emit plain `[l]`/`[n]` and fold — `l̃`'s tilde is backbone-stripped, `nˡ`'s superscript-l folded.)
- **Rimes (68)** → each mapped to its most-common (citation) IPA. Fuzhou's **韻變 (rime alternation)** is visible as
  two IPA variants per rime, tone-conditioned: `ang→aŋ~ɑŋ`, `o̤→o~ɔ`, `ie→ie~iɛ`. Per the Phase-1 scope we emit the
  citation and fold `ɑ→a`, `ɔ→o`, `ɛ→e`.
- **Tones**: the 5 BUC diacritics → the 7 Fuzhou categories (macron→上聲33, grave→陽平53, circumflex→陽去242,
  acute→陰去213/陰入24-checked, breve→陰平55/陽入5-checked; the checked bump on a ʔ-final rime is a code rule).
  Tones are Chao letters in our output, stripped by the backbone on both sides (segmental validation).

**Result: 95.4% folded / 98.5% symbol** vs the 1514-pair referee. The residual (~4.6%) is the **deferred 韻變 tail** —
rimes whose tone-conditioned realization differs from the citation my map picked (`iong→uoŋ~yoŋ`, `oi→ui~øy`,
`eu→ɛu~iɛu`, `a̤→ɛ~ɑ` which folds to `e`≠`a`). Modelling it is the Phase-2 rime-alternation subsystem.

**Honest label: 🔷 reference-implementation parity.** The referee is `Module:cdo-pron` rule OUTPUT, not human
transcription, so 95.4% means "our spec-derived BUC→IPA converter reproduces Wiktionary's converter", not
independent verification. This sits near the ⛔ boundary — disclosed on every surface. **Deferred:** the Han
front-end (no independent Han→reading dict — Wiktionary is circular), tone sandhi (連讀變調), initial assimilation
(聲母類化), and the 韻變 rime alternation.

## Run 3 — review fix

Correctness review caught one real, user-facing bug (invisible to the eval + tests): the `text()` tokenizer's
literal char class enumerated the *precomposed* toned vowels but missed **ṳ (U+1E73)** — which has an NFC single
codepoint — and was normalization-form-dependent. On NFC production input, every ṳ syllable was truncated
(`gṳ̆`→`"g˥˥"`, `dṳ̆ng`→`"t˥˥ ŋ̍˥˥"`), breaking the **entire [y]/[øy] series** (89/1515 rows). The eval + unit tests
route through `phonemizeWord`, which `.normalize("NFD")`s, so it was masked. **Fix:** NFD-normalize the input in
`text()` and match base-letter + combining-marks (`[a-zŋ][…̀-ͯ…]*`) instead of precomposed literals →
robust to both NFC and NFD. Added a `text()`-path ṳ regression test. Everything else — converter logic, the 95.4%
number, the folds, the 🔷 reference-parity honesty framing — the review confirmed sound.
