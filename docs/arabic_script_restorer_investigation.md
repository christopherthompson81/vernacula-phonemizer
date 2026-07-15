# Shared Arabic-script vowel restorer — feasibility & data sizing

A single language-conditioned model to restore the short vowels the Perso-Arabic **abjad** omits, shared across all
Arabic-script abjad languages, so the low-resource ones ride on the high-resource anchors. Target = IPA vowels (not
orthographic harakat), because that unifies with the rest of the pipeline AND matches the one uniform, permissively
licensed, multilingual source we have: **wikipron** Arabic-script sections.

## Run 1 — 2026-07-15 — wikipron Arabic-script inventory + row counts

Command: GitHub contents API for `CUNY-CL/wikipron/data/scrape/tsv`, filtered to `*_arab_*.tsv`; then a per-file
line count of the `broad` transcriptions (raw.githubusercontent). Question: which Arabic-script languages have
IPA-aligned data, how much, and what does that imply for a joint training set.

### The 33 Arabic-script files → classified by the membership rule (abjad depth, not "uses Arabic letters")

| Role | Lang (ISO 639-3) | broad rows | Notes |
|---|---|---:|---|
| **Anchor** | `ara` Arabic (macro) | 17,563 | The transfer donor. |
| **Anchor** | `fas` Persian | 10,312 | *Leaky* abjad (writes long vowels; omits a/e/o + ezafe). |
| **Anchor** | `urd` Urdu | 7,709 | Full abjad; the bridge to the Indo-Aryan riders. |
| Anchor bolster | `ajp acw ary arz afb apc ayl acm` (8 Arabic dialects) | ~10,445 | All abjad; make the anchor robust to colloquial/dialectal spelling. |
| **Rider** (covered) | `pus` Pashto | 1,414 | |
| **Rider** (covered) | `pan` Punjabi Shahmukhi | 1,360 | The `pan_arab` we just wired for PR #185. |
| **Rider** (Tier 2) | `ckb` Sorani Kurdish | 981 | Near-alphabetic → little to restore, but shares encoder + loans. |
| **Rider** (Tier 2) | `kas` Kashmiri | 751 | More-vocalized Nastaliq → partial. |
| **Rider** (Tier 1) | `snd` Sindhi | 362 | Implosives ɓ ɗ ʄ ɠ; strong Urdu/Punjabi transfer. |
| **Rider** (Tier 1) | `skr` Saraiki | 349 | Shahmukhi-family; near-continuous with Punjabi/Sindhi. |
| Rider (surprise) | `gwc` Kalami/Gawri | 208 | Dardic Indo-Aryan (Pakistan) — an unpredicted live abjad. |
| Rider (dead) | `ota` Ottoman Turkish | 209 | A true *historical* abjad — unlike modern vocalized Turkic. Low value. |
| ambiguous | `msa` (Malay Jawi?) narrow-only | 106 | Negligible; verify identity before use. |
| **EXCLUDE** | `uig` Uyghur | 2,674 | Fully **vocalized alphabet** — nothing to restore. *Bigger than most riders, yet excluded: proves the criterion is orthographic depth, not data volume.* |

### Totals (excluding the vocalized Uyghur)
- Arabic family (anchors + 8 dialects): **~46,010**
- Indo-Aryan / Iranian riders (`pus pan ckb kas snd skr gwc`): **~5,425**
- Ottoman (optional): 209
- **Joint trainable pool ≈ 51.7k word→IPA pairs** (per-character supervision is larger).

## Findings / implications for the next step

1. **The thesis is confirmed by the numbers.** The two highest-leverage Tier-1 predictions (Sindhi 362, Saraiki
   349) are the *smallest* files — they cannot train a standalone model. Joined to ~46k Arabic + ~8k Urdu (with
   which Saraiki/Sindhi share almost everything), they ride. This is the whole argument for a shared model in one
   data point.
2. **The exclusion rule survives contact with the data.** Uyghur has 2,674 rows — more than Pashto, Punjabi,
   Sorani, or Kashmiri — and is still the one to drop, because its orthography writes every vowel. Membership =
   *"abjad that omits short vowels,"* not *"uses Arabic letters,"* and not *"has data."*
3. **wikipron gives IPA, not harakat** → reinforces the **IPA-target** framing (skeleton→phoneme). Use `broad`
   (more consistent than `narrow` across languages) as the shared target. (NB: Tashkeela is NOT a licensing blocker
   for the Arabic anchor — its bulk is ancient/classical public-domain text from the Shamela library; the GPLv2 tag
   is on the packaging, not the vocalized content. The real Tashkeela caveat is classical-vs-MSA **domain skew**,
   not licence — see the `arabic_diacritization` note.)
4. **Data gaps in the predicted set:** Balochi (`bal`) and South Azerbaijani (`azb`) — both strong Tier-1 abjad
   candidates — have **no wikipron**. They would need pronunciation lexicons elsewhere, or be deferred. Honest flag.
5. **The Arabic-dialect wall (~10k across 8 dialects) is a free robustness bonus** for the anchor, and helps riders
   that borrow colloquial-Arabic vocabulary.

## Run 2 — 2026-07-15 — build the silver training set

`tools/arabic-restorer/build_silver.py` (+ PROVENANCE.md, cache/ gitignored). Fetches the `broad` scrape for each
of the 19 abjad-beneficiary languages, strips orthographic diacritics to the undiacritized SKELETON (the model's
runtime input), pairs it with the vowel-bearing IPA, dedups → `silver.tsv` (`skeleton⇥lang⇥ipa`, ~1.5 MB).

**50,799 unique rows** — anchors 35,303 (`ara fas urd`) · Arabic dialects 10,304 · riders 5,192
(`pus pan ckb kas snd skr gwc ota`). Verified: **0 residual harakat** in skeletons, IPA retains vowels, the
Extended-A/Supplement rider LETTERS (ݨ, ࣇ) survive the strip (82 rows).

Cleaning finding: dropped **single-codepoint skeletons** (845 across the set; 115 in Sindhi alone) — these are the
languages' **alphabets** entered as headwords (ب → "be"), whose "pronunciation" is the letter NAME, i.e. noise. A
restorer has nothing to restore on a lone letter, so the drop is free. NB this is why the honest rider counts are
small (Sindhi 247, Saraiki 346 REAL multi-letter words) — a standalone model on 247 words is hopeless, which is
exactly the argument for training them inside the shared pool.

Silver, not gold: these are Wiktionary transcriptions (CC-BY-SA) with per-editor convention drift — training data,
not an eval reference. Curate a held-out per-language eval slice separately; don't trust these labels as truth.

### Recommended proof-of-concept
Char-level, language-tagged encoder (BiLSTM+CRF or small Transformer), IPA-vowel target, trained on the ~51.7k
joint pool with the riders **upsampled 5–10×** so the anchor shapes the shared representation without swamping
them. Skip `uig` + modern Turkic. If it shows transfer (riders' held-out IPA accuracy rises vs a rider-only
baseline), THEN scale the Arabic anchor with Tashkeela (ancient PD text — free to use; mind the classical-vs-MSA
domain skew) / Quran, and add fa/ur pronunciation lexicons (Tihudict, CLE). Sindhi + Saraiki are the highest-leverage new bring-ups: big populations, near-zero
standalone data, near-perfect transfer from the Urdu/Punjabi already in the repo.
