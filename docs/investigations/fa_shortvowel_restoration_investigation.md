# Persian (fa) short-vowel restoration via abjad→IPA — investigation

Persian is 🟡: the Perso-Arabic **abjad omits short vowels** (a/e/o), so the g2p produces the consonant +
long-vowel skeleton with a DEFAULT [a] for the omitted shorts, and the restoration subsystem is deferred. Two
ideas (from Chris) reframe the fix:

1. **Train/lookup on abjad↔IPA pairs, not abjad↔harakat.** The current restorer leans on Arabic **Tashkeela**
   harakat silver (machine-diacritized). But harakat is a lossy intermediate — it can't encode the **ezafe** (-e
   linker), final **ه** (/e/ in خانه vs /h/), or **و** (v/u/o/ow). `abjad → IPA` end-to-end keeps them.
2. **Use a Tajik parallel text as a data source.** Persian and Tajik are the same language; Tajik Cyrillic writes
   the very short vowels the abjad drops (and disambiguates homographs the abjad collapses). Shared classical
   literature published in both scripts (Shahnameh, Hafez, Rudaki) is a positionally-aligned parallel corpus for
   the frequent/native lexicon.

## Run 1 — the abjad→IPA gold already exists, and the headroom (2026-07-19)

**Finding: the abjad→IPA training gold is not missing — fa just isn't using it.** wikipron `fas_arab` is a large,
HUMAN, fully-voweled abjad→IPA source: **9,257 unique words (broad)** / 10,712 (narrow; +1,696 broad-lacks).
It is currently wired only as a *folded* eval referee (the short vowels are folded away as "unrecoverable"), and
fa's restorer trains on Arabic Tashkeela silver instead of this Persian human gold.

Built the cleaned gold `tools/fa-restoration/fa-abjad-ipa-gold.tsv` (broad, deduped, homograph variants kept as
tab fields, single-letter name citations dropped) and measured fa's CURRENT output through the *same* normalization
pipeline twice (`tools/fa-restoration/measure.ts`):

| metric | score | meaning |
|---|---|---|
| **FOLDED** (short vowels ignored) | **71.3–71.9%** | the consonant + long-vowel SKELETON (= the current eval basis; official eval 71.3%) |
| **UNFOLDED** (short vowels counted) | **30.1%** | the REAL pronunciation |
| **HEADROOM** | **~42 pp** | what short-vowel restoration is worth, on 9,256 human words |

So the skeleton is already ~72% right, but the full pronunciation is only ~30% — **short-vowel restoration is the
dominant error source and is now a measured target** (the folded metric hid it). (The stale memory figure "42.9%"
is superseded: the current official folded is 71.3%.)

**Honest ceiling:** ~9% of broad words are homographs with >1 valid pronunciation that only *sentence context*
resolves (مرد mard 'man' ~ mord 'died'; آخر ʔaːxir ~ ʔaːxar). Word-level restoration — from wikipron, Tajik, or
harakat — can store variants and pick the frequent one, but can't fully disambiguate context-free. This caps a
word-level restorer below 100% regardless of source.

## Plan

- **Phase 1 (this run, done):** cleaned abjad→IPA gold + the unfolded baseline measurement. fa's restoration is
  now scored (30.1% → skeleton ceiling ~72%), not hidden by the fold.
- **Phase 2:** an abjad→IPA restorer — **lexicon-first** (the 9.3k gold + the 1.7k narrow-only words cover the
  frequent lemmas directly), then a model for the OOV tail. Trained/evaluated on abjad↔IPA (idea 2), replacing the
  Arabic-silver harakat detour. Target: move UNFOLDED up toward the skeleton ceiling.
- **Phase 3:** Tajik parallel-text cognate mining (idea 1) to extend coverage past the wikipron gold — remapping
  Tajik→Persian (the majhul merger ō→u / ē→i, and ɔ→ɒ) — for the shared classical/frequent lexicon.

## Run 2 — the lexicon ceiling, and why the answer is a model (2026-07-19)

Wired-in check before wiring: **fa's eval already uses `phonemizeWord` (with the wikipron-derived harakat
lexicon)** — non-circular *only* because the eval folds short vowels away, so the lexicon's short-vowel additions
don't inflate the folded score. Measuring an abjad→IPA lexicon's "unfolded gain" on the wikipron gold would
therefore be **circular** (the gold IS the lexicon's source). The honest metric is real-text **frequency
coverage**.

Measured the 9.3k gold against the committed fa frequency wordlist (`espeak-ng-portable
tools/qa-compare/words-50000.fa.txt`, 15.8k types, frequency-ranked):

| span | coverage |
|---|---|
| top-1000 (most frequent) | **17.5%** |
| top-5000 | 16.4% |
| all 15.8k | 20.5% |

**A citation-form lexicon reaches only ~1 in 5 running-text tokens.** Persian is morphologically rich (ezafe,
plurals, verb conjugation, clitics), so the lemma gold misses the inflected/clitic-attached forms that dominate
text — and fa's existing 4.1k harakat lexicon already covers much of that same ~20%. So **expanding the lexicon
is not the win**; the 80% tail needs something that *generalizes morphologically* and *uses context*.

**→ Pivot to a sequence model (the BiLSTM Chris raised).** Two jobs a lexicon structurally cannot do:
1. **Morphological generalization** — a char-level seq2seq (BiLSTM encoder-decoder) predicts pronunciation for
   *unseen inflected/OOV* forms from spelling, covering the 80% tail. Trainable now on the 9.3k+ wikipron/kaikki
   word→IPA pairs.
2. **Context (homographs + ezafe)** — a sentence-level BiLSTM resolves مرد mard~mord and predicts the ezafe -e
   (both context-dependent, invisible to any word-level method). This needs *contextualized* pronunciation data,
   which word-level wikipron lacks — and which the **Tajik parallel text is uniquely good for**: Tajik running
   text is fully voweled AND disambiguated *in context*, so aligned fa↔tg sentences yield per-token contextual
   pronunciations, i.e. BiLSTM training data for exactly the homograph/ezafe cases (idea 1 feeds the model, not
   just a lexicon).

Revised plan: **(a) char-level BiLSTM word→IPA restorer** on wikipron/kaikki (the big coverage win) → **(b)
sentence-level context model** for homographs/ezafe trained on Tajik-parallel + diacritized corpora → lexicon
kept as a high-precision override. The 42pp headroom is mostly reachable by (a); (b) removes the "context-free
ceiling" caveat from Run 1.

## Run 3 — Tajik as a Persian pronunciation oracle: validated, but alignment is the wall (2026-07-19)

Built the cross-script pipeline (`tools/fa-restoration/tajik-align.ts`): transliterate a Tajik Cyrillic word to a
Persian consonant+long-vowel SKELETON (collapsing the Arabic letter classes Tajik merged — س ص ث / ز ذ ض ظ / ت ط /
ه ح — so it can match the real fa spelling), and derive Persian IPA from the Tajik pronunciation by remapping the
Persian/Tajik divergences: **Tajik ɔ→Persian ɒ** (ā), the **majhul merger ɵ→u**, **в=v→w**, ʁ→ɣ, and a
word-initial **ʔ**.

**The remap is VALIDATED** against fa's own human gold on aligned cognates:

| | match |
|---|---|
| derived Persian IPA == fa gold (FULL, short vowels) | **71.4%** (689/965) |
| == fa gold (SKELETON only) | **82.7%** (798/965) |

So Tajik IS a viable Persian pronunciation oracle — it supplies the short vowels correctly ~71% of the time *when
the alignment is right*. (This wordlist is proper-noun-heavy — names transliterate worse than native vocabulary —
so native words should score higher.)

**But word-level alignment is the wall.** Skeleton matching is many-to-one: a Persian skeleton matches several
Tajik cognates, so choosing by frequency mis-selects — e.g. آخر 'last' matched ахёр instead of охир. Aligning the
15.5k fa frequency wordlist to the tgwiki vocabulary (509k types, built via `tools/corpus/build.ts --wiki tg`)
covered 2400 words (15.5%), of which **1342 are NOT in the wikipron gold** — a real coverage extension, but
SILVER (~71% est., with alignment noise on top) rather than gold.

**Conclusion — the two problems have one solution: real parallel text.** A shared classical work in both scripts
(Shahnameh, Hafez) is *positionally* aligned, which (a) removes the skeleton ambiguity that makes word-level
alignment noisy, and (b) provides the SENTENCE CONTEXT a homograph/ezafe model needs. So the next step is to
source and align a parallel classical corpus — that upgrades the silver to gold AND yields the contextualized
training data for the sentence-level BiLSTM. The transliteration + remap built here (validated 71%/83%) is the
per-token engine that pipeline will run.

## Run 4 — the REAL parallel corpus: aligned classic text → (fa, tg, IPA) triplets (2026-07-20)

Corrected framing (Chris): the parallel corpus isn't the noisy word-level skeleton match of Run 3 — it's
**aligned classic texts** yielding **(Tajik, Farsi, IPA) triplets in running-text form**, where alignment is
POSITIONAL (same poem, same order) so the skeleton ambiguity never arises.

**Sourcing** (TajikNLPWorld org, huggingface.co/TajikNLPWorld):
- `TajPersParallelCorpusFull` — pre-aligned tg↔fa, Apache-2.0, 100K–1M rows — **GATED (HTTP 401)**; access
  requested, pending. This is the fast path once approved.
- `shahnameh-tajik-corpus` — the Shahnameh in Tajik Cyrillic, **CC-BY-SA-4.0, public** — 8 volumes (jilds).
- Persian side: **Ganjoor** (api.ganjoor.net, Ferdowsi id 4 → Shahnameh cat 33 → آغاز کتاب cat 34 → poem 1321);
  Ferdowsi is public domain.

**POC built** (`tools/fa-restoration/parallel/shahnameh-opening.fa-tg-ipa.tsv`, 30 lines): the two editions align
line-for-line (به نام خداوندِ جان و خرد ↔ Ба номи худованди ҷону хирад), and the tg engine + remap gives the IPA
per line → a clean running-text triplet corpus.

**KEY finding the classic text reveals (the proper-noun validation missed it):** Tajik and Persian diverge
SYSTEMATICALLY in short vowels on GRAMMATICAL morphemes — Tajik **izofat -и = Persian -е** (nɒm**i** vs nɒm**e**),
the **connector -у = Persian -о** (ному → nɒm**u** vs nɒm o), ба=ba vs fa be, and Tajik short **и often = Persian
е** (хирад→χirad vs xerad). So the naive remap yields *Tajik* pronunciation in the Persian phoneme set, ~correct
on content words but shifted on exactly the morphemes Persian omits (izofat, connector). Run 3's 71% was on names
(no grammatical morphemes), which is why it didn't surface. **This is the whole point of the parallel corpus:**
with fa↔tg aligned, these tg→fa correspondences are learnable (rule or model), rather than guessed — and the
izofat/connector are precisely the ezafe cases the sentence-level model needs.

**Scale path:** pull the full Ganjoor Shahnameh (thousands of poems) and align to the full Tajik (8 jilds, ~100k
hemistichs) positionally; fold in `TajPersParallelCorpusFull` when access clears. Then add a tg→fa short-vowel
correspondence layer (izofat -и→e, connector -у→o, …), learned from the aligned pairs, to turn the Tajik-derived
IPA into true Persian IPA.

## Run 5 — are the divergences regular, and do they beat fa's current restorer? (2026-07-20)

Two questions (Chris): do the tg↔fa divergences correspond regularly, and can Tajik predict the short vowels fa
currently gets wrong? Measured directly (`tools/fa-restoration/divergence-analysis.ts`) on the 965 tg↔fa cognates
— Tajik-derived IPA AND fa's current engine, both vs the true fa gold (short vowels counted, notation folded):

| on the 965 cognates | == fa gold |
|---|---|
| **Tajik-derived** | **71.9%** |
| **fa current engine** | **51.4%** |
| **Tajik advantage** | **+20.5 pp** |

**So yes — Tajik predicts the short vowels fa misses, by +20pp on cognate words.** That's a real restoration
source, not a marginal one.

**On regularity — partly, with a hard core:**
- The dominant raw "mismatch" (ɒ→a, ~400) is pure NOTATION (fa writes ā as *aː*, we as ɒ) — folds away, not a
  divergence.
- The largest *real* divergence is **Tajik у → Persian o (64)**. It's regular in origin but **not resolvable
  from Tajik**: Tajik у merged Persian's short-u(→o) and long-ū(→u) the same way, so Tajik carries an 87%/13%
  (u/o) prior and nothing more. I tested whether the Persian abjad breaks the tie (و present → u): **it doesn't**
  — both u- and o-words write و (cf. دو 'do'). So this residual is a genuine shared-merger CEILING, not a
  data-volume or rule problem.
- Smaller, bidirectional **i↔e** (~17 each way) — the same story on the front vowels.

**Conclusion.** Tajik is a strong, usable restoration SIGNAL — integrate it (as a lexicon override / a feature or
teacher for the char model / the aligned-corpus training signal): it roughly *closes half* the 30→72 short-vowel
gap on cognate words. The residual ~28% is dominated by mergers Tajik shares with Persian (u/o, i/e) that neither
Tajik nor the abjad can disambiguate context-free — that's the ceiling the *sentence-level* model must reach past
(from context: مرد mard vs mord), which is exactly what the aligned parallel corpus (Run 4) is for.

## Run 6 — the model: a BiLSTM that targets IPA DIRECTLY, not harakat (2026-07-20)

Built the dataset, trained a model on the GPU (`/mnt/data/ar-diac-venv`, torch+cuda), and tested whether it aligns
closer to the expected IPA. **Architectural pivot (Chris): target IPA, not harakat** — where we diverge from the
mature `tools/arabic-restorer/` pipeline (skeleton→harakat→[g2p]→IPA).

**The evidence for the pivot is concrete.** Feeding our Tajik-derived silver through the harness's g2p-inversion
labeler (harakat target) labeled only **981 / 2400 (40.9%)** — the other **59% were LOST** because their true IPA
can't be expressed as harakat the g2p reproduces (ezafe, و, final ه — exactly the harakat blind spots). Targeting
the IPA vowel directly keeps all of it.

**Model** (`tools/fa-restoration/train_ipa_bilstm.py`): a 2-layer char-level **BiLSTM per-position tagger** over
fa's g2p skeleton (consonants + long vowels + default-[a] slots); it predicts the correct IPA vowel at each short
slot directly. Dataset = the 9.3k wikipron abjad→IPA gold + the 2.4k Tajik-derived silver (1,335 words new beyond
wikipron). Held-out on UNSEEN words:

| model | held-out exact IPA | vs baseline |
|---|---|---|
| baseline (fa g2p, default [a]) | 16.0% | — |
| BiLSTM IPA-target, **gold only** | **30.7%** | **+14.7pp** (≈ doubles the OOV baseline) |
| BiLSTM IPA-target, **gold + Tajik** | **32.2%** | **+16.2pp** (Tajik adds +1.5pp) |

**Both ideas validated in one run.** (1) The IPA target nearly doubles OOV short-vowel accuracy vs the rule
baseline — and it's the *right* target (a bigram POC of the same signal got only +7pp; the BiLSTM's full-sequence
context is the difference). (2) The Tajik silver measurably helps (+1.5pp) — and it only can *because* we target
IPA; the harakat path had discarded 59% of it. This is the OOV generalization tail; the lexicon covers
seen/frequent words separately (~exact), so the shipped system is lexicon ⊕ this model ⊕ the Tajik cognate source.

**Scaling levers (next):** the full 40k narrow wikipron (not just 9k broad), the aligned parallel corpus (Run 4)
for the ezafe/homograph context, a larger model, and ONNX export to ship it (the arabic-restorer runtime pattern).

## Run 7 — scaling attempt: naive volume regresses; convention + context are the real levers (2026-07-20)

Tested the two obvious scaling levers — more wikipron data (add the narrow set) and a bigger model — on the GPU.
Both underwhelmed, and the failure is diagnostic.

**Fair comparison** (same fixed broad held-out, 926 unseen words; only the *added* training data varies):

| added training | held-out exact IPA |
|---|---|
| broad only (9.3k) | 30.7% |
| + narrow-only (+1.7k words) | **30.3%** (−0.4) |
| + Tajik silver | **32.2%** (+1.5) |
| + narrow + Tajik | 31.1% |

**Narrow wikipron does NOT help — it slightly HURTS**, and it drags the Tajik gain down (32.2→31.1). This is a
CONVENTION-consistency problem, not a volume one: the narrow set's fine allophony (aspiration, ä, ɦ, w-for-в,
dental) doesn't harmonize cleanly with the broad convention even after normalization — the SAME regression the
`arabic-restorer` documented when it added kaikki naively (that Run 17: "kaikki's conventions differ → REGRESSED").

**Bigger model was neutral** (emb128/h256/3L: 25.6% vs the small model's 24.9% on the combined set) → we are NOT
data-starved at this scale; raw capacity isn't the bottleneck.

**Conclusion — the productive levers are not volume:**
1. **Convention harmonization** — the narrow (and kaikki) data only helps after real normalization to one
   convention (the multi-run effort the arabic-restorer spent on exactly this). Volume without it regresses.
2. **Context, not more word-level data** — the ceiling is the shared-merger homographs/ezafe (Run 5), which need
   the SENTENCE-level signal from the aligned parallel corpus (Run 4), a different axis from word count.
3. **Richer input** — feed the abjad letters (char-level) rather than the collapsed fa-engine IPA frame; the
   abjad carries structure (و/ی/ه, word shape) the frame has already thrown away.

So the best config stays **broad + Tajik (32.2%)**; the Tajik silver remains the one augmentation that reliably
helps. Scaling is a data-QUALITY / context / input-representation problem now, not a data-volume or model-size one.

## Run 8 — the real lever was INPUT: abjad seq2seq → 45.8% (overturns Run 7) (2026-07-20)

Run 7 said scaling was a quality/context/input problem, not volume. Tested lever #3 — **richer input** — and it is
decisive. Replaced the per-position frame-tagger (which reads fa's collapsed g2p output) with a char-level
**seq2seq over the ABJAD letters** (BiLSTM encoder + attention decoder → IPA). Same fixed broad held-out:

| model | held-out exact IPA |
|---|---|
| baseline (fa [a] default) | 16.0% |
| frame-tagger (IPA-frame input), gold+Tajik | 32.2% |
| **seq2seq (ABJAD input), gold** | **41.4%** |
| **seq2seq (ABJAD input), gold+Tajik** | **45.8%** |

**Input representation was the lever, not volume.** Reading the abjad directly (vs the collapsed frame) is
+9–14pp — the model sees the و/ی/ه and word structure the frame discarded, and isn't constrained to the frame's
slots (so it handles ezafe/insertions). **And the Tajik silver now helps MORE (+4.4pp vs +1.5pp on the tagger)** —
the stronger model exploits the extra data better; augmentation scales with capacity. Net: **16% → 45.8% ≈ 3× the
OOV baseline** (`tools/fa-restoration/train_ipa_seq2seq.py`, GPU).

Remaining levers, now correctly ordered: (1) ship it — ONNX export + TS inference (the arabic-restorer runtime
pattern); (2) the aligned parallel corpus (Run 4) for the ezafe/homograph CONTEXT (the shared-merger ceiling);
(3) a convention-harmonized narrow set (raw narrow still regresses). Volume and model-size alone do not move it.

## Run 9 — shipping foundation: ONNX export + TS inference proven (2026-07-20)

Exported the single-pass frame-tagger to **ONNX** (`tools/fa-restoration/export_tagger_onnx.py`, opset 17, 2.4 MB,
32 input tokens × 12 labels) and ran it from TypeScript via **`onnxruntime-node`** (the repo's optional, lazy,
degrade-to-no-op runtime — same pattern as `src/core/riderDiacritizer`). End-to-end works: fa g2p frame → tokenize
→ ONNX → argmax → corrected IPA.

**Two findings that scope the remaining production work:**
1. **Convention gap.** The model reflects the wikipron *classical/Dari* convention, not fa's Iranian output:
   خانه → xaːn**a** (Iranian xaːn**e**), کتاب → k**i**taːb (Iranian k**e**taːb). This is the exact final-ه / short-i·e
   mismatch `invert_harakat.ts` already special-cases (`heFinal`, the classical-final-[a]→Iranian-[e] fix). A
   shipped model needs that Iranian normalization layer on its output.
2. **OOV-only + lexicon precedence.** Those examples are all common (lexicon-covered) words; the neural tier is
   for OOV. Integration must mirror riderDiacritizer: **lexicon → neural(OOV) → default**, as an async pre-pass,
   so the sync/C#-parity path is untouched and covered words keep their gold lexicon pronunciation.

**Remaining to ship (scoped, not blocking):** (a) export the stronger **seq2seq** (45.8%) instead of the tagger
(32.2%) — needs autoregressive ONNX (encoder graph + decoder-step + a TS greedy loop, two sessions); (b) the
Iranian normalization layer; (c) wire into `persian.ts` as the OOV async pre-pass with lexicon precedence; (d)
verify the folded referee eval is unchanged (short vowels folded → non-circular, as today) + tsx/tests. The
foundation (train → ONNX → TS inference) is proven; these are the productionization steps.
