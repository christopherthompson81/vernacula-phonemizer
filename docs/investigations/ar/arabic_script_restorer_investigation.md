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

`tools/perso-arabic/build_silver.py` (+ PROVENANCE.md, cache/ gitignored). Fetches the `broad` scrape for each
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

`tools/perso-arabic/normalize_ipa.py` → `silver.normalized.tsv` + `inventory.txt`. The raw wikipron IPA had
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

## Run 7 — 2026-07-15 — scale g2p-inversion to ur/ps/fa (10,929 rider harakat pairs)

Wired ur/ps/fa into `invert_harakat.ts` (each exports a bare `phonemizeWord` + has a referee fold config; the
slot-finder treats a letter listed in both cons and vowelLetters — Persian/Pashto write و/ی/ه as consonants but
the g2p reads them as vowels — as a VOWEL, so the search doesn't blow up). `invert_harakat.ts all`, ~19 s:

| lang | words | labeled | % |
|---|---:|---:|---:|
| `fa` Persian | 10,235 | 6,916 | 67.6% |
| `ps` Pashto | 1,303 | 575 | 44.1% |
| `ur` Urdu | 7,614 | 3,144 | 41.3% |
| `pa` Punjabi | 1,260 | 294 | 23.3% |
| **total** | | **10,929** | |

Persian's high yield = leaky abjad (long vowels written → fewer ambiguous slots) + mature g2p; Punjabi's low = و/ی
long-vowel ambiguity + tonogenesis. Precision spot-checked sound on all four (ps آبکند→آبْکَنْدْ recovers fatḥa on ک
+ sukūn on the clusters = ref `ɑː b k ə n d`; ur آئین→آئینْ; fa آباد→آبادْ). **10,929 native rider harakat pairs** now
exist where there were zero — the few-shot signal to complement anchor transfer.

Silver-data prep status: eval reference ✅ · multilingual char vocab ✅ · anchor harakat ✅ (pre-existing) · rider
g2p-inversion ✅ (pa/ur/ps/fa, 10.9k pairs) · Persian/Urdu diacritized text → optional. **Ready for a training run.**

## Run 8 — 2026-07-15 — assemble the fine-tune manifest + harness

`build_training_manifest.py` → `train.tsv` / `eval.tsv` (`skeleton⇥lang⇥vocalized`) + `TRAINING.md` (the recipe).
The multilingual restorer is a **fine-tune** of the existing Arabic diacritizer — the char vocab was built to
preserve the Arabic indices 0–38 exactly for this, so the trained embedding rows transfer and the rider letters
append at 39+. Manifest = the 10,929 mined rider pairs + a hash-selected 15k Arabic **replay** sample (tagged `ar`,
so fine-tuning doesn't forget Arabic), deterministic 90/10 per-language split (md5-bucketed, no RNG):

| lang | train | eval |
|---|---:|---:|
| ar (replay) | 13,543 | 1,453 |
| fa | 6,257 | 659 |
| ur | 2,856 | 288 |
| ps | 521 | 54 |
| pa | 257 | 37 |
| **total** | **23,434** | **2,491** |

100% char-vocab coverage (4 stray-punctuation rows dropped; tatweel stripped to match the rider skeletons).
`TRAINING.md` specifies: expand the embedding 39→98 (copy Arabic rows), add a learned **language embedding** on the
lang tag, fine-tune with riders upsampled ~5–10× + Arabic replay, and evaluate on TWO axes — direct harakat DER on
the held-out split, and the real target, **end-to-end IPA** (skeleton →[model] harakat →[deterministic g2p] IPA vs
`silver.normalized.tsv`, reusing the eval fold). The run itself is an **offline GPU job**, not CI (as for the
Arabic model). Everything up to `python train_*.py` is now committed and reproducible.

## Run 9 — 2026-07-15 — TRAINED on the GPU box: the multilingual restorer works (+17.8 end-to-end)

Ran the fine-tune on the RTX 3090 (`<data root>`, torch 2.6+cu124). `train_multilingual_harakat.py`
warm-starts `bilstm_pausal.pt` (its char/label maps match the committed Arabic meta exactly) — copies the 26
vocab-independent lstm/fc tensors + 39 Arabic embedding rows by char identity, appends 5 language tokens (prepended
per word for conditioning, no arch change), and fine-tunes on `train.tsv` with riders upsampled 4× + Arabic replay
(pausalized to match the pausal warm-start). 15.3 M params, best at epoch 1, early-stopped.

Held-out **harakat DER**: ur 2.4% · fa 2.6% · ps 4.0% · pa 7.2% (Arabic replay 12% = the known classical-Tashkeela-
vs-modern gap, not a rider concern).

The real metric — **end-to-end IPA** (predicted harakat →[deterministic g2p]→ IPA vs the wikipron reference, model
vs bare-skeleton baseline; `predict_harakat.py` → `eval_endtoend.ts`), on the held-out split:

| lang | n | baseline | model | lift |
|---|---:|---:|---:|---:|
| fa | 659 | 62.1% | 87.3% | **+25.2** |
| ps | 54 | 68.5% | 77.8% | +9.3 |
| ur | 288 | 83.7% | 88.2% | +4.5 |
| pa | 37 | 70.3% | 73.0% | +2.7 |
| **ALL** | 1038 | 68.7% | **86.5%** | **+17.8** |

The thesis holds: warm-start from Arabic + 10.9k mined rider labels → the restorer predicts g2p-correct harakat on
UNSEEN words, lifting end-to-end IPA +17.8. Persian gains most (most data + most short-vowel ambiguity to resolve);
Punjabi least (257 train words + the و/ی long-vowel ambiguity harakat can't fix — a g2p limitation, not the model).
Honest scope: this is measured on the held-out INVERTIBLE subset (words a valid vocalization exists for); the full
pipeline is still capped by g2p expressiveness on the non-invertible tail. Checkpoint `bilstm_multilingual.pt` +
int8 ONNX live on `<data root>` (gitignored, as the Arabic model); `multilingual_diacritizer.meta.json` (char/label/
lang maps) is committed. NEXT: export ONNX + wire a rider restore pass (the Arabic `restore.ts` analogue); fix the
و/ی long-vowel search to lift Punjabi; add Sindhi/Saraiki once their g2p exists.

## Run 10 — 2026-07-15 — cross-script GOLD (sister-script) + the durable notes doc

**Cross-script mechanism.** Several abjad languages have a voweled SISTER-SCRIPT that writes the vowels the abjad
drops (Punjabi↔Gurmukhi, Urdu↔Hindi-Devanagari, Sindhi↔Devanagari, Persian↔Tajik-Cyrillic; Pashto is the exception).
`crossscript_pa.ts`: transliterate a Gurmukhi word → vocalized Shahmukhi → keep only pairs whose Shahmukhi form
phonemizes to the SAME IPA as the Gurmukhi original (hard gate) → GOLD harakat. Punjabi (both scripts = the same
`pa` module): **916 gold pairs @ 70.1%** vs 294 silver @ 23.3%. Surfaced + fixed a real g2p bug: `damma+waw وُ → uː`
(was oː). Vocab fix: `build_charvocab.py` now unions ALL skeleton sources so sister-script-only letters (ࣇ U+08C7)
are covered (99 chars).

**Finding — naive combination REGRESSES, so cross-script is OPT-IN.** Adding the gold pairs dropped Punjabi −12.5
(DER 7→17%). Cause: the two sources disagree on the **default-schwa label** — g2p-inversion writes explicit *fatḥa*
for ə (its search has no bare option); the sister-script transliteration leaves inherent ə *bare* = `0`. Same sound,
contradictory supervision. Fix (before enabling `--crossscript`): give the inverter a bare/`0` option and prefer it
for default-ə, matching real undiacritized text. Silver-only retrain (99-char vocab) reconfirms the working model:
end-to-end **+18.4** (fa +26.4, ps +8.0, ur +5.4; pa noisy on n=37).

**Durable docs (the training knowledge was being lost).** `tools/perso-arabic/MODEL_NOTES.md` now captures the
whole thing — GPU-box env (`<data root>`), checkpoints (`bilstm_pausal.pt` = the warm-start), the 19-label
scheme, the fine-tune recipe, every pipeline script, results, the cross-script mechanism + open issue, and how to
extend to a new language. Memory note `harakat_restorer_training` points to it.

## Run 11 — 2026-07-15 — inversion long-vowel search + bare-schwa convention

Two changes to `invert_harakat.ts`'s per-slot search, composed into the same fold-match loop:
- **Long-vowel slot:** a consonant before **و** now tries `{bare → oː, ḍamma+waw → uː}` — previously the inverter
  skipped consonants before a vowel letter, so it could never mine the oː/uː distinction (the g2p `وُ→uː` fix from
  Run 10 was unusable). Lifts the languages with و/ی ambiguity and no sister-script.
- **Bare-schwa convention:** short-vowel slots gained a `BARE` option (no diacritic = default-ə, label "0"),
  preferred over explicit fatḥa — so a default schwa harmonizes to "0", matching the cross-script transliteration.

**Inversion yields:** pa 23.3→**36.1%**, ur 41.3→**53.1%**, ps 44.1→44.7%, fa 67.6→67.5% (**11,984 pairs**). The
gains land exactly on the و/ی-ambiguous, no-sister-script riders (pa, ur), as predicted.

**End-to-end (silver-only)** stayed **+18** overall; the reliable large-n signals improved — **ur +4.5→+7.8**
(model 88→91%, n=344), **fa +25.2→+26.8** (n=616). pa/ps swung negative but are noise (n≈50, ±1–2 words; pa has
bounced +2.7/−2.7/−3.9 across runs).

**Cross-script re-tested with the harmonized convention:** the catastrophic regression is gone (pa DER 17→~12%),
but `--crossscript` still isn't a clear net win — deeper cause is a **distribution shift** (the transliteration is
*synthetic* orthography, not real Shahmukhi spelling). Stays opt-in; see MODEL_NOTES.md. Also logged: the eval split
moves with the silver data, so pin a stable held-out reference before the final retrain (follow-up). Suite 357/357.

## Run 12 — 2026-07-15 — pin a stable eval set (version-comparable, honest coverage)

The end-to-end eval had been bucketing over the *silver labels*, so it moved every time the inversion changed —
pa/ps were uninterpretable (±several words). Fixed: `build_training_manifest.py` now derives a STABLE held-out
slice from the WIKIPRON reference (`silver.tsv`, fixed) — a deterministic 10% per rider (`eval_set.tsv`, 1,699
words) — EXCLUDES those skeletons from training, and `eval_endtoend.ts` reports on it. It covers ALL held-out words
(incl. the ~half the g2p can't reproduce) → honest full-coverage denominator.

Stable result (silver-only): **43.5% → 54.3% (+10.8)** — fa +19.2 (44→63%), ur +3.2 (48→52%) clearly benefit;
**pa −0.8, ps −0.9 are ~neutral** (n≈120 — real signal now, not noise: the data-starved, g2p-ceiling-limited riders
neither gain nor lose). The lower absolutes vs the earlier "+18" are because that number scored only the invertible
subset on a moving split — not comparable. From here, all version comparisons use `eval_set.tsv`.

## Run 13 — 2026-07-15 — g2p/inversion fixes from the failure-cause analysis (+10.8 → +12.5)

Diagnosed WHY ~half the held-out words are unreachable (referee residual classes + a failure-cause tally on the
unlabeled set), then fixed the systematic ones — the couple lever (each g2p fix raises the ceiling AND adds labels):
- **Explicit fatḥa protected from schwa-deletion** (`urdu/g2p.ts` marks a written fatḥa ə+U+0332; `urdu.ts` strips
  it). `deleteMedialSchwa` was eliding *written* vowels, so no vocalization could reproduce e.g. کَرَنو→kəɾənoː.
  Quality fix (225 ur labels corrected); on its own, coverage-neutral — but it UNBLOCKS the next fix.
- **Consonant-before-glide is a short slot** (the ‑iyā/‑iyoṅ class, 77% of the "neither" failure bucket): آبادیات
  needs ɑbɑd·ə·jɑt but the inverter skipped the د (next char ی was treated as a vowel letter). Now it's a slot →
  the epenthetic ə is reachable (and survives, thanks to the protection fix).

**Inversion yields:** ur 53.1→**56.5%**, fa 67.5→**69.5%**, pa 36.1→37.2%, ps 44.7% (12,471 pairs). **Stable eval
(n=1699): 54.3% → 56.0%, +12.5** — **ur +3.2→+5.9**, **fa +19.2→+20.3**, **pa −0.8→+2.4 (positive!)**; ps −1.8 the
holdout. Bare-text referee % unchanged (fixes touch only vocalized input). Suite 357/357.

Remaining measured levers: unwritten **gemination** (9% of ur failures — needs a targeted shadda search), **ی→eː**
(14% — lexical, no clean harakat), and Pashto (no sister-script + dialectal referee).

## Run 14 — 2026-07-15 — Urdu و→uː + size-aware upsampling (+12.5 → +13.2)

Continued the failure-cause loop. The dominant remaining Urdu pattern was **medial و → uː** (آلو ours ɑlo vs ref
ɑlu, آرزو, آلود, آزمودہ…). The `damma+waw → uː` fix from Run 10 was only in `shahmukhi.ts`; **Urdu's separate
`urdu/g2p.ts` still mapped it to oː**. Fixed there too (Persian already defaulted و→uː). Urdu inversion
**56.5→62.0%** (~420 words); stable eval **ur +5.9→+9.8**.

But as ur/fa improved, **Pashto regressed** (−1.8→−3.6): uniform upsampling let the data-rich riders dominate and the
model applied their patterns to data-starved Pashto (440 words). Fix: **size-aware upsampling** (`--balance 4000` →
ps 9×, pa 12×, ur/fa 1×) — recovered Pashto (−3.6→−1.8) with no ur/fa loss. A unified model shouldn't sacrifice its
weakest language.

**Stable eval (n=1699): 56.0% → 56.7% net (+13.2)** — fa +19.3, ur +9.5, pa +1.6, ps −1.8. Suite 357/357, tsc clean.
Pashto remains the structural holdout (no sister-script, dialectal referee); it needs Pashto-specific g2p/data, not
more transfer. Next measured lever: unwritten gemination (shadda search).

## Run 15 — 2026-07-15 — gemination is NOTATION: a degemination fold, not a shadda search (+13.2 → +14.8)

Chased the unwritten-gemination bucket. First tried a targeted shadda SEARCH — it labeled ~nothing (ur unchanged)
and doubled runtime. Root cause (traced on بلا): our g2p writes gemination as **length** (بلّا → bˈəlːɑː, the ː
stripped by the backbone → `bəlɑ`), but the referee **doubles** the consonant (`b ə l l ɑ` → `bəllɑ`). It's a
NOTATION mismatch, not a harakat problem. Reverted the shadda search; added the **degemination fold** `(.)\1→$1`
to ur/fa/ps (pa already had it). Now the referee's `ll` collapses to `l`, matching our length-stripped `l`, and the
geminate words label via the default.

Inversion: **fa 69.5→73.7%, ur 62.0→65.4%** (~690 words; 13,578 pairs). Stable eval **56.7% → 59.7% net (+14.8)** —
fa +21.4, ur +10.6, pa +1.6, ps −0.9 (recovered). The fold raised the baseline too (43.5→45.0 — a more-correct
metric); the model gains sit on top. Suite 357/357, tsc clean. Lesson: when the g2p and referee agree on the
phoneme but differ on how they WRITE a length/gemination/tone feature, it's a fold, not a search.

## Run 16 — 2026-07-15 — the "lexical" tail is mostly ADAPTED-WORD encodable (+14.8 → +16.0)

Correction to Run 13/15's claim that ی→eː is "lexical, unaddressable by harakat." The harakat model's OUTPUT is a
diacritized word in OUR convention — so we can encode a distinction standard Arabic harakat lacks, exactly as
damma+waw→uː did. Defined **یَ (ya+fatḥa) → eː** (bare ی = iː) in `urdu/g2p.ts`, added a ی long-vowel slot
`{bare→iː, fatḥa→eː}` to the inverter. No label-scheme change — the label is the existing "a" (fatḥa), contextual
(ə on a consonant, eː on a ی). The g2p reads it, the model learns which words take it.

Urdu inversion **65.4→69.7%**; stable eval **ur +10.6→+13.9**, **ALL +14.8→+16.0**, and **ps flipped positive
(+0.9)**. The model generalizes ی→eː to held-out words — it IS the lexicon (memorize+generalize), like Arabic
diacritization. Lesson (again): "the g2p can't produce phoneme X" is often solvable by giving X a diacritic in the
adapted-word scheme, NOT by declaring it lexical. The genuinely-lexical residue (rare, unpredictable per-word
pronunciations) is what an OPTIONAL per-word lexicon (the Arabic `restore.ts` analogue) would mop up on top.

## Run 17 — 2026-07-15 — scaling: freeze the harness, then the convention-harmonization constraint

Two scaling prerequisites, both learned by measurement.

**(1) Froze the upsampling reps (#202).** They were `round(balance/count)` from LIVE counts, so a 16-word data
change flipped a rep (pa 9→8) and swung the whole shared eval ±2pts — which had confounded every sub-point check
this session (fa folds, word-initial ا, schwa, retroflex). Now `REPS={ar:1,ur:1,fa:1,ps:7,pa:9}` fixed. Stable
baseline **+15.6**. THIS is what makes "did more data help?" answerable.

**(2) First data-scaling probe (kaikki) → the key constraint.** kaikki (a second, larger Wiktionary extraction:
Persian 20k vs wikipron's 10k) added **+336 new fa labels** (`build_kaikki.py` → `silver.kaikki.tsv`;
invert_harakat reads it alongside wikipron; the eval_set stays wikipron-only so it's untouched). But with the reps
frozen, it cleanly **REGRESSED**: fa +21.1→+20.5, ALL +15.6→+14.9. Cause: kaikki's conventions differ (narrow t̪ʰ
aspiration, ɒ vs ɑ, syllable dots), so its labels teach the model inconsistent vocalization patterns that mis-apply
to the broad-wikipron eval. **Scaling requires CONVENTION-HARMONIZED data, not just more of it** — the same lesson
as the synthetic-orthography cross-script (Run 10). To make kaikki (or any second source) help, normalize its IPA
to the reference convention BEFORE inverting (strip aspiration, ɒ→ɑ, …). Tooling kept + inert (no `silver.kaikki.tsv`
committed) for that follow-up. epitran is NOT a source: it's an abjad-reader too (کتاب→ktɒb, no short vowels).

Net: the harness is now measurable; the scaling path is data + a per-source IPA harmonizer, and the biggest clean
source remains real-orthography Hindi→Urdu cross-script (a whole language's corpus, same-convention if sourced right).

## Run 18 — 2026-07-15 — the per-source harmonizer: kaikki now HELPS (fa +0.7)

Built the harmonizer that Run 17 said was the fix. `build_kaikki.py` now normalizes a source's narrow IPA to our
g2p's convention BEFORE inversion, per language: **Persian** — strip aspiration ʰ (Persian has none) + dental ̪ +
stress accents, ɒ→ɑ, æ→a (Tehran short-a), ɹ→ɾ, ð→z, glide w→v (keep labialization ʷ); **Urdu** — already matches
(dental, aspiration ʰ/ʱ, ə/ɪ/ʊ), just drop optional-segment parens + accents.

Effect, measured on the frozen harness: harmonization **doubled the kaikki fa yield** (336→612 words invert) and
**flipped the regression into a gain — fa +21.1 → +21.8** (the unharmonized version had regressed to +20.5). That's
the Run-17 hypothesis confirmed: convention-harmonized data helps, raw second-source data hurts. `silver.kaikki.tsv`
(1,822 new fa pairs) is committed; kaikki is ON for Persian.

Honest scope: ALL stays ~flat (+15.3–15.5) — fa is the only language with substantial NEW data (Urdu kaikki
overlaps wikipron ~95%, only 150 new), and the small riders (pa/ps, n≈120) still swing ±2 on the shared model
(residual sensitivity the frozen reps reduced but didn't eliminate). So the harmonizer is validated as the
**per-source scaling mechanism**; moving the aggregate needs substantial new data in MULTIPLE languages (the
real-orthography Hindi→Urdu cross-script) + shared-model rebalancing as totals grow.

## Run 19 — 2026-07-15 — real Hindi→Urdu parallel spellings: coverage ≠ generalization

Sourced the big Urdu lever the right way (real spellings, not synthetic transliteration). Hindi & Urdu are one
language (Hindustani); **kaikki Hindi carries the actual Urdu spelling** as a form (11,701 entries do). So:
Devanagari headword →[our `hi` g2p]→ GOLD IPA (Devanagari is voweled) + the REAL Urdu spelling → skeleton;
harmonize the Hindi IPA to the Urdu convention (aː→ɑː) → invert. `build_hindi_urdu.ts` → `silver.hindiurdu.tsv`:
**5,014 NEW Urdu words** (not in wikipron), **3,286 mined at 66% yield**, and the labels are GOLD and correct —
نیپالی→neːpɑːliː (via the یَ→eː encoding), گرہ→ɡrɪɦ, مورکھ→muːrkʰ. Unlike the Punjabi synthetic cross-script (Run 10),
these are the spellings people actually use, so no orthography drift.

**But the wikipron-held-out neural eval stayed FLAT** (ur +12.8→+12.7). The reason is the sharpest metric insight of
the scaling work: these Hindi words are a different VOCABULARY distribution (Sanskritic/formal — نیپالی, گرہ, مورکھ)
than wikipron Urdu (everyday/Perso-Arabic). Off-distribution data — even gold-correct — **cannot improve
in-distribution GENERALIZATION**; it adds COVERAGE the held-out eval can't see. So:
- **Coverage-scaling ≠ generalization.** The held-out wikipron eval measures generalization to wikipron-distribution
  words; the right yardstick for coverage is a broader/production eval (or the two-layer lexicon).
- Hindi→Urdu is therefore a **LEXICON source** (3,286 real Urdu words handled EXACTLY in production), NOT neural
  training data (where it's distribution-flat and mildly interferes). Kept out of the neural manifest; the neural
  baseline stays +15.5. `silver.hindiurdu.tsv` committed as the sourced parallel data (CC-BY-SA); wiring its mined
  vocalizations into the production lexicon layer is the follow-up. The pipeline is a template: Devanagari→Sindhi,
  Gurmukhi→Punjabi (with real spellings) next.

## Run 20 — 2026-07-15 — is the held-out eval reachable by data? Tested: NO, and here's why

Tested the hypothesis from Run 19: use Hindi's GOLD IPA to relabel the IN-DISTRIBUTION wikipron words that
g2p-inversion misses (not add off-distribution words). Flipped `build_hindi_urdu.ts` to keep the wikipron-OVERLAPPING
words and fed their Hindi IPA to the inverter as an alternate target.

**Refuted, with evidence.** Hindi labeled only **70 more unique ur words** (4764→4834); held-out ur +12.8→+13.0
(noise), ALL −0.3. Traced why on the actual misses:
- **Hindi and Urdu DISAGREE on exactly these words** — آئرلینڈ is `ɑjərlɛɳɖ` in Hindi (retroflex ɳ) but `ɑərlɛnɖ`
  in wikipron Urdu (plain n); آدرنیہ `ɑdərɳij` vs `ɑdərnəjɑ`. Same language, but the hard words differ (retroflex,
  final vowels), so the "gold" doesn't match the eval's target.
- The rest are **g2p-COVERAGE gaps** (glide+vowel, ɳ) unreachable by ANY reference — the g2p can't produce that IPA
  regardless of which source supplies it.

**Conclusion — the concern is real but precisely bounded.** The held-out GENERALIZATION eval is at its
**g2p-coverage ceiling** (~62% model vs ~76% coverage for ur). Data expansion cannot move it: off-distribution data
adds COVERAGE not generalization; in-distribution relabeling fails because sources disagree on the hard words and
the true misses are coverage gaps. The ONLY lever left for the held-out is **more g2p coverage** on hard lexical
cases (retroflex ن→ɳ, …) — which is DATA-LIMITED per language (Run 16's retroflex result).

**Resolution.** This isn't a dead end — it's the held-out eval measuring the wrong AXIS for the goal. Production
accuracy = COVERAGE (lexicon; common/seen words, exact) + generalization (neural; novel words, near ceiling).
Coverage IS scalable — Hindi→Urdu/kaikki add thousands of real words handled exactly (Run 19). So the correct next
step is a **production/coverage eval + wiring the lexicon layer**, and accepting the neural held-out is near its
ceiling — not chasing data to move a metric that structurally can't move on that axis.

## Run 21 — 2026-07-15 — production COVERAGE eval + shippable lexicon: the scaling made visible

Run 20 concluded the held-out GENERALIZATION eval is at its g2p-coverage ceiling and can't see coverage-scaling.
So built the metric that CAN — `coverage_eval.py`, over real OpenSubtitles token-frequency lists (ur 242k tokens,
fa 40M): the fraction of production TOKENS whose skeleton each data layer covers. TOKEN-weighted = production
reality (common words recur), vs the near-useless TYPE coverage.

**Urdu — the scaling that was FLAT on the held-out is +12 points here:**

| layer | token-cov | type-cov |
|---|---:|---:|
| wikipron reference | 71.0% | 26.6% |
| + kaikki | 71.0% | 26.6% |
| **+ Hindi→Urdu** | **83.1%** | 36.7% |
| **SHIPPABLE lexicon (vocalized)** | **66.4%** | 28.1% |

(Persian: kaikki +2.9; Hindi→Urdu is Urdu-only.) The token/type gap (83% vs 37%) IS the production reality — you
cover most of what people SAY. Hindi→Urdu — flat on the held-out (Run 19-20) — adds **+12 pts of production
token-coverage**, exactly the "scaling that genuinely works, now visible."

**Shippable lexicon.** `invert_harakat.ts --lexicon` mines ALL sources (wikipron + kaikki + Hindi→Urdu, real Urdu
spellings + gold IPA), deduped per skeleton → `lexicon.<lang>.tsv` (the Arabic `restore.ts`/`diacritization.tsv`
analogue). Urdu: **8,120 vocalized words → 66.4% of production tokens handled EXACTLY** (up from 56% neural-only;
Hindi added +10 pts). Kept OUT of neural training (harakat.*.silver.tsv unchanged; the neural baseline stays +15.5).
The 66.4→83.1% gap is inversion yield on the Hindi words (34% don't invert — the remaining g2p-coverage work).

Two-layer production path now concrete: **lexicon lookup (exact, ~2-in-3 Urdu tokens) → else neural (novel words) →
else default g2p.** Wiring the lexicon into the live Urdu/Persian phonemizer (the `restore.ts` pass) is the deploy
step; the artifacts + both evals are committed. The scaling frontier is measured on BOTH axes now.

## Run 22 — 2026-07-15 — the last mile: wire the coverage lexicon into the LIVE rider phonemizers

Run 21 built the shippable lexicon but left it in `tools/`. This wires it into the live path, making the coverage
layer actually ship. Mirrors Arabic's `restore.ts`/`diacritization.tsv`, but simpler — no neural pre-pass yet, so
it's a pure exact-match lookup, not a skeleton-repair supplement.

**What shipped.** `export_lexicons.sh` strips `lexicon.<lang>.tsv` to 2 columns (`skeleton⇥vocalized`), DROPS the
identity rows (a bare-skeleton vocalization is a no-op — the g2p already yields that IPA), and writes
`src/languages/<lang>/lexicon.tsv` beside each g2p. Non-identity counts (the rows that actually carry short-vowel
info): **ur 2,640 · fa 3,040 · ps 113 · pa 158.** New shared `core/harakatLexicon.ts`: `loadHarakatLexicon(url)`
(loadTsvMap, optional) + `restoreHarakat(word, lex)` — if the word already carries harakat it's RESPECTED (never
clobber a caller's explicit vowels), else a lexicon hit substitutes our vocalization before g2p, miss → unchanged.
Wired one line into `phonemizeWord` for all four riders (ur/fa/ps/pa; Punjabi Gurmukhi input has no Perso-Arabic
harakat keys so it passes through).

**No circularity.** The lexicon was mined with `fold(phonemizeWord(voc)) == fold(ref)`; `voc` carries harakat, so
`restoreHarakat` returns it unchanged during mining — re-mining is stable, and the live output for a covered
skeleton equals `phonemizeWord(voc)`, which folds to the reference.

**Effect (probes).** آبرو `ɑːbəɾoː → ɑːbɾˈuː` (و→uː, ābrū), آبادیات `…d̪jɑːt̪ → …d̪ˈʊjɑːt̪` (ʊ restored), مدرسه
`madɾasˈe` (madrase). Two nasal-assimilation goldens drifted because the lexicon now supplies the true vowel
(انگور *angūr* oː→**uː**; سنگھی ə→**ʊ**) — updated, not regressions. Suite **357/357**, tsc clean; added a
coverage-layer test per rider (hit + respect-user-harakat).

**Still deferred:** the neural GENERALIZATION layer for novel (OOV) words needs the multilingual BiLSTM exported to
ONNX + an `onnxruntime` pre-pass (the Arabic `diacritizer.ts` analogue). The lexicon is the exact-match tier under
it. Production path today: **lexicon lookup → default g2p**; the full three-tier (…→ neural → default) awaits the export.

## Run 23 — 2026-07-15 — the neural GENERALIZATION tier: ONNX export + live wiring (the last of the last mile)

Run 22 shipped the exact-match lexicon; this ships the tier UNDER it — the multilingual BiLSTM, live via ONNX. Now
the full two-layer path runs: **lexicon (exact) → neural (OOV) → default**.

**ONNX export** (`export_onnx.py`): `<data root>/bilstm_multilingual.pt` (15.3M params) → fp32 ONNX → int8
dynamic-quantize → **15.3 MB** (on par with the Arabic diacritizer). fp32 argmax == PyTorch **100%**; int8 == fp32
**98.9%** word-level (≈1% flips — the quantization cost). Committed in-repo like the Arabic model + a small
`riderDiacritizer.meta.json`.

**TS pre-pass** (`core/riderDiacritizer.ts`): per-word, prepend the language token, argmax harakat per position,
insert marks — position-preserving. Crucially it LEAVES lexicon-covered words BARE so the authoritative gold lexicon
(sync layer) wins them; it neural-vocalizes only the rest. Async entry `src/riderNeural.ts::phonemizeRiderNeural
(text, lang)` runs the pre-pass then the sync g2p. `onnxruntime-node` optional + model gitignorable → absent = no-op
(lexicon+default). ZWNJ/ZWJ (U+200C/D) are kept INSIDE the word run — the model was trained on ZWNJ-joined
compounds as one sequence; splitting there changes the LSTM context.

**Parity proof.** TS-int8 == Python-int8 single-sequence **100.0%** on the held-out set (all four langs). The
apparent 92% vs `predict_harakat.py` was a RED HERRING: that script runs PADDED batches, so the BiLSTM backward pass
is contaminated by pad tokens on short words — per-word (unpadded) inference is cleaner, and the TS path does it right.

**Effect.** End-to-end IPA on the held-out invertible split, neural vs the pure default-schwa baseline (lexicon
disabled to isolate the tier): **+23.5 overall** (fa +29.0, ur +18.6, ps +4.1, pa +4.5) — reproduces/exceeds the
historical +15.5–17.8 with the retrained checkpoint. With the lexicon ENABLED the eval instead measures neural vs
lexicon (baseline 95.7% > neural 88.8%) — the lexicon rightly wins covered words; that is the precedence working, not
a regression. Live demo (OOV): زبانشناسی default `zabaːnaʃnaːsˈiː` → neural `zabaːnʃanaːsˈiː`; پژوهشگر → `paʒˈuːhʃɡɾ`.
Suite 363/363, tsc clean; +4 gated neural tests.

**Eval-methodology note (for future me).** `eval_endtoend.ts` calls the LIVE `phonemizeWord`, which is now
lexicon-aware — so its baseline is inflated for any word in the lexicon (i.e. all wikipron held-out words, since the
lexicon mined all of silver.tsv). To measure the PURE neural-vs-default lift, disable the lexicon
(`mv src/languages/*/lexicon.tsv aside`) or eval only OOV words. And use the INVERTIBLE split (`eval.tsv`), not the
full `eval_set.tsv` — non-invertible words have no matching vocalization, so any added vowel only breaks fold-matches
the bare skeleton accidentally satisfied (that is why the full-set number reads negative).

**Riders complete.** Both tiers of the two-layer rider phonemizer are now live and shippable. Remaining frontier is
NEW bring-ups (Sindhi/Saraiki — near-perfect transfer from Urdu/Punjabi) and scaling the Arabic anchor, not the
plumbing.

## Run 24 — 2026-07-16 — pre-merge review fixes (8-angle review of PR #208)

An 8-angle code review surfaced real issues; fixed before merge:

- **Circular re-mining (the serious one).** `invert_harakat.ts` imported the rider `phonemizeWord`, which now applies
  the lexicon — so the miner's all-bare candidate got the *already-mined* vocalization injected and was recorded as
  an identity row, which `export_lexicons.sh` drops → every regen would silently erode coverage to zero. Fix: each
  rider now exports a **lexicon-free `phonemizeWordCore`**; the miner (and the number path) use it. `phonemizeWord`
  = `phonemizeWordCore(restoreHarakat(word, …))`.
- **NFC.** `restoreHarakat` keyed on the raw word; NFD input (decomposed آ/أ) silently missed the NFC lexicon keys.
  Now normalizes the lookup key. The neural pre-pass NFC-normalizes the skeleton too.
- **Numbers coupled to the content lexicon.** Spelled-out number words routed through the lexicon-aware
  `phonemizeWord` (Pashto درې/شپږ collided with content entries). Numbers now use `phonemizeWordCore` — deterministic
  from the manifest, consistent with Punjabi which already bypassed.
- **Neural graceful degrade.** `phonemizeRiderNeural` threw (not degraded) when the committed model was present but
  `onnxruntime-node` absent; `createRiderDiacritizer` now catches the ORT-load failure and the meta read → returns
  undefined → sync fallback, matching its documented contract.
- **Eager import I/O.** The lexicon loaded at module import for all four riders (registry imports them eagerly), so
  every consumer paid ~5.7k lines of TSV. Now **lazy** (`harakatLexicon()` accessor), matching french/german.
- **Neural respects writer harakat** (skips words carrying harakat, like the lexicon layer); cursor-based rebuild
  replaces the `shift` bookkeeping; shared HARAKAT regex/`stripHarakat` reused from `harakatLexicon.ts`; the
  Punjabi assimilation test asserts the `ŋɡ` property vowel-agnostically (the mined سُنگھی vowel is noisy) and the
  "gitignored-optional" comments corrected to "in-repo, optional at runtime." Suite 363/363, tsc clean.

### Superseded — the earlier IPA-target proof-of-concept sketch (kept for the record)
Char-level, language-tagged encoder (BiLSTM+CRF or small Transformer), IPA-vowel target, trained on the ~51.7k
joint pool with the riders **upsampled 5–10×** so the anchor shapes the shared representation without swamping
them. Skip `uig` + modern Turkic. If it shows transfer (riders' held-out IPA accuracy rises vs a rider-only
baseline), THEN scale the Arabic anchor with Tashkeela (ancient PD text — free to use; mind the classical-vs-MSA
domain skew) / Quran, and add fa/ur pronunciation lexicons (Tihudict, CLE). Sindhi + Saraiki are the highest-leverage new bring-ups: big populations, near-zero
standalone data, near-perfect transfer from the Urdu/Punjabi already in the repo.
