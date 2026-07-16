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

## Run 3 — 2026-07-15 — normalize the IPA target inventory

`tools/arabic-restorer/normalize_ipa.py` → `silver.normalized.tsv` + `inventory.txt`. The raw wikipron IPA had
**411 distinct phone tokens** over 297k occurrences — a long tail of per-editor notation drift. Harmonized to a
single canonical alphabet the same way the referee-eval folds work: **strip notation, never a real contrast.**

- **KEPT (phonemic):** Arabic emphatics ˤ (`tˤ` alone is 2,308 occurrences), aspiration ʰ/ʱ, dental ̪, the retroflex
  series ʈ ɖ ɳ ɽ ɭ ʂ, implosives ɓ ɗ ʄ ɠ ᶑ, nasal vowels ̃ (õː etc.), labialization ʷ, palatalization ʲ, tie bars.
- **STRIPPED (notation):** Chao tone letters, epenthetic ᵊ, ultrashort breve ̆, tone accents ́ ̀ ̂ ̌, half-long ˑ,
  non-syllabic ̯, unreleased ̚, voiceless ̥/̊, lowering ̞, centralized, syllabic, macron, rhotic hook, liaison ‿ ~.
  Glyph folds ä→a (via stripped diaeresis), ɒ→ɑ, ɫ→l; tie U+035C→U+0361. Tokens reducing to modifiers-only (a
  stripped tone+length token → bare ː) are dropped.

Result: **411 → 252 canonical symbols**, 50,799 rows retained, 411 tone-only tokens dropped. 43 of the 252 are
singletons — all genuine rare phones (ʈʲ, β, ɬ, the implosive ᶑ), NOT noise, so kept (folding them would destroy
contrast). Verified same-row: 7,958 emphatic/dental/aspirate rows preserved every such feature; the only changes on
those rows were tone-accent stripping (ə́→ə). **Tone is dropped deliberately** — not recoverable from the abjad
(the restorer's premise) and marked erratically.

## Run 4 — 2026-07-15 — TARGET DECISION: harakat, not skeleton→IPA (the wikipron set is the EVAL, not training)

Course-correction. Runs 2–3 built + normalized a skeleton→**IPA** set — but the whole architecture is: one shared
model restores **harakat** → each language's EXISTING deterministic g2p (`urdu/g2p.ts`, `shahmukhi.ts`,
`pashto.ts`, …) turns the vocalized text into IPA. Building an IPA target had quietly drifted to making the model
*replace* the g2p (relearn every retroflex/emphatic/aspirate the engine already nails) instead of *feeding* it —
which is exactly the hopeless regime for a 247-word rider. Decided (owner-confirmed): **target = harakat.**

Consequences:
- **`silver.tsv` / `silver.normalized.tsv` are re-cast as the end-to-end EVAL reference**, not the training target:
  score skeleton →[model] harakat →[deterministic g2p] IPA against these normalized IPA pairs, per language. Run 3's
  notation-harmonization is exactly right *for that eval* (compare phonology, not editor notation). Nothing wasted.
- **Training data is a separate build:** diacritized text → `(skeleton, lang, vocalized)` pairs (self-supervised:
  strip harakat for the input, keep the vocalized form as target). Abundant for the Arabic anchor (Tashkeela —
  ancient PD, now unblocked — + Quran), thinner for Persian/Urdu, ~nil for the riders (which lean on cross-lingual
  transfer via shared script + Perso-Arabic loan vocabulary + the language tag). See Run 5.

Why harakat wins: the model's output space shrinks to ~a handful of diacritics per character (data-efficient,
transfers on the loan stratum), and the deterministic g2p — already correct for consonants, retroflexes, emphatics,
gemination, nasalization — supplies everything except the one thing that's genuinely unwritten and ambiguous.

## Run 5 — 2026-07-15 — the anchor model already exists; build the multilingual char vocab

Discovery: the repo ALREADY ships a harakat restorer for Arabic — `src/languages/arabic/diacritizer.onnx`, a
char-level **BiLSTM** (emb 128, hidden 512, 3 layers, ~15.3 M params, int8), permissively sourced (CATT Apache-2.0
teacher → arwiki CC-BY-SA silver, no Tashkeela/Leipzig in the model), with a **19-label pausal harakat scheme**
(`diacritizer.meta.json`) and a 259k Tashkeela-derived restoration lexicon (`diacritization.tsv`). So the harakat
target, the label scheme, AND the anchor training pipeline are already settled. The multilingual restorer is a
GENERALIZATION of this, not a greenfield build.

What generalizing needs, and the data reality:
1. **Char vocabulary** spanning every rider letter — BUILT this run (`build_charvocab.py` → `multilingual_charvocab.json`).
   Unions all 95 skeleton letters across the 19 languages with the Arabic model's char map, **preserving the Arabic
   indices 0–38** (so the trained Arabic embedding rows stay valid; new letters append at 39+). Vocab **39 → 98**;
   the 19 harakat LABELS are unchanged (fatḥa/kasra/ḍamma/sukūn/shadda/tanwīn are shared across all Perso-Arabic).
   The additions sort cleanly: high-frequency shared Persian/Urdu forms (ی ک ہ گ پ ھ چ ں) + rider-specific tails
   (Sindhi implosives ٻ ڄ ڏ ڳ +23 letters; Pashto ښ ګ ړ ږ +19; Kashmiri +18; Saraiki +17; Kalami +16).
2. **Harakat training labels per language.** Anchor (Arabic) is DONE (arwiki+CATT silver + the lexicon). Persian/Urdu
   have some diacritized text (sparse). The riders have **≈no diacritized corpus** → they cannot be supervised
   directly. Strategy: train the BiLSTM on the anchor(s) with the expanded vocab + a **language tag**, and let the
   riders ride on **cross-lingual transfer** (shared script + Perso-Arabic loan vocabulary + tag) — strong on the
   loan stratum, honest-weak on native roots. **Evaluate** riders end-to-end on the wikipron reference (Runs 2–3):
   skeleton →[model] harakat →[deterministic g2p] IPA vs the normalized IPA. Optional booster: **g2p-inversion** —
   for a language with a deterministic g2p (ur/ps/pa/fa/ar), search the harakat vocalization of each wikipron
   skeleton whose g2p output matches the reference IPA, yielding a few-shot silver harakat set (and an eval gold).
   That's the next run.

Silver-data prep status: eval reference ✅ (Runs 2–3, #187) · multilingual char vocab ✅ (this run) · anchor harakat
✅ (pre-existing) · Persian/Urdu diacritized text + rider g2p-inversion → next.

## Run 6 — 2026-07-15 — g2p-inversion silver-labeler (rider harakat from wikipron)

`invert_harakat.ts` — mines harakat labels for a rider with a deterministic g2p but no diacritized corpus. For each
wikipron `(skeleton, IPA)` pair it searches the harakat vocalization (fatḥa/kasra/ḍamma/sukūn per ambiguous
consonant slot, ≤7 slots → ≤4⁷ candidates) whose full phonemizer output reproduces the reference IPA under the
referee-eval fold. Gemination is fold-neutralized so shadda isn't searched; the fold preserves vowel QUALITY, so a
match pins the actual short vowel.

Proven on **Punjabi Shahmukhi**: **294 / 1,260 (23.3%)** words labeled, high-precision — e.g. اسر→اسُرَ recovers the
damma /ʊ/ (`ˈəsʊɾ`, matching ref `ə s ʊ ɾ`), اصفہان→اصْفَہانَ finds a sukūn on the ص cluster. These are exactly the
native short vowels default-schwa misses — training data that did not exist for this language. Runs in ~2 s.

The 76.7% miss is **not** a labeler flaw: it's dominated by long-vowel ambiguity the g2p doesn't resolve (و→oː only,
never uː; ی→iː only, never eː) plus genuine g2p divergences / wikipron quirks. A future boost: also search the
long-vowel realizations (needs the scanner to accept per-position vowel overrides). The method generalizes to any
rider with an exported bare `phonemizeWord` (ur/ps/fa/ar) — across the riders it yields a few thousand native silver
harakat pairs for few-shot, on top of the anchor-transfer baseline.

Silver-data prep status: eval reference ✅ · multilingual char vocab ✅ · anchor harakat ✅ (pre-existing) · rider
g2p-inversion ✅ (pa proven; ur/ps/fa next) · Persian/Urdu diacritized text → optional.

### Superseded — the earlier IPA-target proof-of-concept sketch (kept for the record)
Char-level, language-tagged encoder (BiLSTM+CRF or small Transformer), IPA-vowel target, trained on the ~51.7k
joint pool with the riders **upsampled 5–10×** so the anchor shapes the shared representation without swamping
them. Skip `uig` + modern Turkic. If it shows transfer (riders' held-out IPA accuracy rises vs a rider-only
baseline), THEN scale the Arabic anchor with Tashkeela (ancient PD text — free to use; mind the classical-vs-MSA
domain skew) / Quran, and add fa/ur pronunciation lexicons (Tihudict, CLE). Sindhi + Saraiki are the highest-leverage new bring-ups: big populations, near-zero
standalone data, near-perfect transfer from the Urdu/Punjabi already in the repo.
