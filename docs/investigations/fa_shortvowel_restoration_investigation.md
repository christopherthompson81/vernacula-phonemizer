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

## Run 10 — SHIPPED: the seq2seq restorer wired into fa's runtime (2026-07-20)

Productionised the abjad→IPA seq2seq (Run 8, 45.8%) end to end.

**Model artifacts** (`src/languages/persian/`): the two graphs exported to ONNX (encoder + decoder-step) and
**int8-quantised** — `fa-vowel-restorer.enc.onnx` (2.3 MB) + `.dec.onnx` (2.6 MB) + `.meta.json` + `.PROVENANCE.md`.
Exported by `tools/fa-restoration/export_s2s_onnx.py` on the GPU venv; int8 output is byte-identical to fp32.

**TS inference** (`vowelRestorer.ts`): `createFaVowelRestorer()` loads the graphs via the OPTIONAL `onnxruntime-node`
(the riderDiacritizer pattern — resolves to `undefined`, i.e. a clean no-op, if the dep or model is absent). It
runs the autoregressive decode (encode once, greedy-loop the decoder-step) and post-normalises the training set's
classical/Dari convention to **Iranian** (short i→e, u→o, final ه→e) + adds **Persian final stress**. Verified:
خانه→xaːnˈe, گل→ɡˈol, کتاب→ketˈaːb, بلبل→bolbˈol, دانشگاه→daːneʃɡˈaːh — correct Iranian, including OOV words.

**Runtime wiring** (`faNeural.ts`): `phonemizeFaNeural(text)` — a SEPARATE async path (like riderNeural), so the
sync engine + its C#-parity + referee-eval are untouched. Precedence **lexicon → neural → default**: it neural-
restores only lexicon-OOV words of ≥3 letters (the seq2seq is unreliable on 1–2 letter function words like و/به,
which the lexicon/g2p handles), everything else on the sync path. Degrades to `phonemize(text,"fa")` with no model.

**Honest limitations:** (a) 2-letter content words (گل) are guarded to the sync path and keep its default-vowel
error — a small tail; a lexicon-completeness pass would fix it. (b) The eval stays the folded sync referee (the
neural is a separate deploy path); a proper unfolded eval of `phonemizeFaNeural` vs the Iranian gold is the next
measurement. (c) Beam search + the parallel-corpus context model (for homographs/ezafe) remain the accuracy
levers. But the pipeline — train → int8 ONNX → TS autoregressive inference → Iranian output → OOV runtime wiring
— is COMPLETE and shipped, optional and non-regressing. `tsc` clean; sync persian + the restorer test pass.

## Run 11 — the production number: unfolded Iranian eval of the shipped path (2026-07-20)

Put a real number on `phonemizeFaNeural`. Reference = the classical wikipron gold mapped to **Iranian** (short
i→e, u→o, final ه→e — the genuine Iranian merger, not a skeleton fold); comparison **unfolded** (a/e/o counted),
only notation unified. On the neural's 926 held-out UNSEEN words:

| | unfolded Iranian exact |
|---|---|
| fa CURRENT (lexicon + default [a]) | 45.6% |
| **SHIPPED (lexicon → neural → default)** | **49.0%** (+3.5pp) |
| — on the 559 OOV words the neural serves — | fa default 43.8% → **neural 49.6% (+5.7pp)** |

So the shipped neural tier is a **real, positive** production improvement (+3.5pp overall, +5.7pp on served OOV),
and it never hurts covered words (lexicon precedence). It's modest, honestly: 49% Iranian on the OOV tail reflects
the **homograph/ezafe shared-merger ceiling** (Run 5) that word-level restoration can't break — the parallel-corpus
CONTEXT model is the lever past it. (Beam(5) adds +1.5pp on the classical held-out — a cheap decode-side gain to
port to the TS inference.) The eval is `tools/fa-restoration/eval_iranian.ts`.

## Run 12 — beam search ported to the shipped inference (2026-07-20)

Ported beam(5) decode into `vowelRestorer.ts` (length-normalised log-softmax over the ONNX decoder-step; ~5×
decode calls per OOV word, still an async pre-pass). Re-ran the unfolded Iranian production eval:

| | unfolded Iranian exact |
|---|---|
| fa CURRENT (lexicon + default [a]) | 45.6% |
| SHIPPED greedy | 49.0% (+3.5) |
| **SHIPPED beam(5)** | **50.1%** (+4.5) |
| — OOV words the neural serves — | fa 43.8% → **51.3%** (+7.5) |

Beam adds **+1.1pp overall / +1.7pp on OOV** over greedy and crosses 50% Iranian. The shipped model now stands at
**+4.5pp overall, +7.5pp on served OOV**, non-regressing (lexicon precedence). The remaining ceiling is still the
homograph/ezafe context problem (the parallel-corpus model). Suite/test/tsc green.

## Run 13 — SCALED the parallel corpus: the full aligned Shahnameh (2026-07-20)

The Run-4 POC was 30 aligned lines; a context model needs thousands. Scaled it: crawled the **full Ganjoor
Shahnameh** (777 poems → 99,220 Persian hemistichs) and aligned it to the **full Tajik edition** (8 jilds →
91,443 hemistichs, HF shahnameh-tajik-corpus).

**Alignment = exact CONSONANT-skeleton match** (`tools/fa-restoration/align_shahnameh.ts`). Positional alignment
fails (edition drift + Tajik section-headings), and hemistich exact-match on the full skeleton was 0.4% — because
Tajik writes the short u→و and izofat -и→ی the abjad omits, so the matres diverge. Dropping the matres (ا و ی) and
matching CONSONANTS ONLY is edition-stable and position-agnostic (a hash match, so drift is irrelevant): **5,734
matches → 5,375 deduped clean aligned hemistichs (~31k in-context word tokens)**. Recall is ~6% (one variant word
breaks a hemistich) but precision is high — random spot-checks are all correct (Kaykhosrow, Siyâvash, …).

`tools/fa-restoration/parallel/shahnameh-aligned.fa-tg-ipa.tsv` — permissive (Ferdowsi PD + Tajik CC-BY-SA + our
IPA). This is the **data foundation for the context model** — the sentence context is exactly what the
homograph/ezafe shared-merger ceiling (Run 5) needs and word-level restoration structurally lacks. Recall-boost
lever = fuzzy/anchored alignment (≤1 variant word); the next build = a sentence-level model trained on this corpus.

## Run 14 — fuzzy alignment recall boost: 5,375 → 39,080 (2026-07-20)

The exact consonant-match (Run 13) got 6% recall; most misses are hemistichs off by 1–2 consonants (the izofat-ی
/ short-u→و matres residue the consonant-strip can't fully remove). Boosted recall with a fuzzy pass.

**Scope-limited first (Chris's steer — verify effectiveness before scaling).** The naive anchored pass
UNDERPERFORMED (1,654 < exact 5,375 — the exact anchors are non-monotonic: first-occurrence tg indices + edition
reordering corrupt the position estimate). A position-agnostic length-bucket + multiset prefilter was too SLOW
(3k lines = minutes → 99k = hours). The fix was a **trigram inverted index**: 3k lines in 10.5s, extrapolating
cleanly — so the full run was worth it.

**Full fuzzy** (`tools/fa-restoration/fuzzy_align_shahnameh.py`, trigram candidates → bounded edit-distance ≤2,
each tg used once): **39,949 pairs → 39,080 deduped triplets (~224k in-context words)** — d=0 5,464, d=1 15,272,
d=2 19,213. Precision stays high: random edit-2 pairs across the corpus are all correct (the residue is the
matres, not different lines). **7.3× the exact-only corpus.**

`tools/fa-restoration/parallel/shahnameh-aligned.fa-tg-ipa.tsv` is now a substantial context corpus. The lesson
(Chris's question): a scope-limited pass is what surfaced that the index — not brute force — was the lever.

## Run 15 — the CONTEXT model: sentence-level beats word-level by +18.8pp (2026-07-20)

The whole arc's premise (Run 5): the OOV ceiling is the homograph/ezafe shared-merger ambiguity that only SENTENCE
CONTEXT resolves. Tested it directly on the scaled corpus (Run 14, 39k aligned hemistichs). Trained TWO char
seq2seqs (BiLSTM enc + attention dec) on the SAME data (`train_context_model.py`) — a word-level one (one word in)
and a sentence-level one (whole hemistich in) — so the gap IS the context benefit. Per-word eval on held-out
sentences (1203 tokens, GPU):

| model | held-out per-word IPA |
|---|---|
| word-level (no context) | 70.2% |
| **sentence-level (CONTEXT)** | **89.0%** (+18.8pp) |

**The context model decisively wins — the ceiling IS broken by sentence context.** The sentence model resolves the
homographs, ezafe, and word-boundary/sandhi effects (the -у connector, ezafe chains) the context-free word model
cannot. This closes the loop: word-level restoration plateaus (the shipped 50/51%), and CONTEXT is empirically the
lever past it — exactly what Run 5 predicted and the parallel corpus was built for.

**Honest caveats:** in-domain (Shahnameh), silver IPA (Tajik-derived ~71%), archaic vocabulary — a DEMONSTRATION
of the context benefit, not a shipped model. Shipping a context restorer for modern Persian needs modern
contextualized data (the same dual-script pipeline on modern parallel text) + a production integration. But the
core question — does context break the ceiling? — is answered: **yes, +18.8pp.**

## Run 16 — SHIPPED the context model (optional, classical-scoped, non-regressing) (2026-07-20)

Shipped the sentence-level context model end to end, the same pipeline as the word restorer.

**Artifacts** (`src/languages/persian/`): `fa-context-restorer.{enc,dec}.onnx` (int8, ~5 MB) + meta + PROVENANCE,
exported by `tools/fa-restoration/export_context_onnx.py`. **Inference** (`contextRestorer.ts`):
`createFaContextRestorer()` runs the autoregressive sentence decode via the optional `onnxruntime-node`
(no-op degrade); output is already Iranian (trained on the normalised corpus) + per-word final stress.
**Wiring** (`faNeural.ts`): `phonemizeFaContext(sentence)` — a SEPARATE optional export.

**Why optional / not the default.** The verify made the domain split concrete:
- In-domain (Shahnameh): به نام خداوندِ جان و خرد → **bˈa nɒmˈe χodɒwandˈe d͡ʒɒnˈo χerˈad** — nails the ezafe chain
  (nɒm**e**, χodɒwand**e**) and the -o connector (d͡ʒɒn**o**), from CONTEXT a word-level model can't see. The
  +18.8pp made concrete.
- Out-of-domain (short/modern): خانه بزرگ → hallucinated repetition. It is CLASSICAL-scoped, so it is NOT wired
  into the default modern runtime (`phonemizeFaNeural` is unchanged) — shipping it as the default would regress
  modern text.

So it ships as an opt-in path — which (Chris) "at least lets us evaluate it" on real classical text. A modern
context restorer needs modern contextualised data (the same dual-script pipeline on modern parallel text). tsc
clean; sync persian + both restorer tests pass; the shipped word-level path is untouched.

## Run 17 — 2026-07-20 — MODERN context model on HomoRich, promoted to the default

The classical context model (Run 16) proved context breaks the homograph/ezafe ceiling but was Shahnameh-scoped
(hallucinates on modern text). This run trains the MODERN analogue on **HomoRich-G2P-Persian** (CC0, ~528k modern
homograph-rich sentences) and — because it does NOT hallucinate on everyday text — promotes it to the DEFAULT
modern path.

**Data pipeline** (`tools/fa-restoration/build_homorich_ipa.py`, `export_modern_context_onnx.py`):
- Train on HomoRich's clean `Phoneme` column (Grapheme→phoneme). Diagnostics showed HomoRich ships TWO conventions:
  the clean `Phoneme` column keeps the glottal onset (`?`→ʔ, 606579 vs 8) and encodes vowel length implicitly —
  which MATCHES our fa; the `Mapped`/`IPA Homograph` columns DROP initial-ʔ (30404/31497), mark `ː` explicitly, and
  `1`-tag the ezafe. Trusting the anchor column's char-votes would have flipped the ʔ convention. Verified the map
  against `getPhonemizer("fa")`.
- Deterministic Phoneme→canonical-IPA map: `A→aː i→iː u→uː S→ʃ Z→ʒ C→t͡ʃ j→d͡ʒ y→j g→ɡ r→ɾ ?→ʔ`.
- **ق/غ**: HomoRich merges both→`q` (the Iranian phonemic merge); we **gheyn-condition** back to our fa's `q`/`ɣ`
  split (γ-only source word → that word's `q→ɣ`; 99.2% of q-words are unambiguously ق-only or غ-only). All OTHER
  Arabic-letter merges (ث/س/ص→s, ذ/ز/ض/ظ→z, ت/ط→t, ح/ه→h, ء/ع→ʔ) already agree with our fa.
- **ZWNJ (the big one)**: 41.7% of HomoRich rows contain ZWNJ. Replacing ZWNJ with SPACE (first attempt) dropped
  99.2% of them on the word-count filter (HomoRich writes می‌خوانم / کتاب‌ها as ONE phoneme word). Switching to
  ZWNJ→CONCATENATE recovers 95.9% (dataset 197k→404k pairs) AND matches the runtime, which strips ZWNJ before the
  model. This is what fixed میخوانم degrading to `meːxwˈaːnm`.

**Measured (shipped int8 ONNX, greedy decode == contextRestorer.ts):**
- Word-vs-sentence on the same modern held-out: **64.3%→86.2% per-word, +21.9pp** (the modern analogue of Run 16's
  +18.8pp; context breaks the ceiling on MODERN homographs too).
- Sentence model held-out (canonical IPA): **83.2% per-word** (int8 == fp32 == torch — quantization lossless).
- **Default comparison (the decision):** current word-level `phonemizeFaNeural` **33.5%** vs modern context
  **78.2%** per-word on modern held-out — **+44.8pp**. The word-level path structurally cannot do ezafe (never sees
  the next word), and ezafe is in nearly every noun phrase → context MUST be the default. (Chris pushed on this:
  "we worked on a modern corpus so that it could be the default.")

**Shipping (this PR):** `fa-context-modern.{enc,dec}.onnx` (int8 ~5 MB) + meta + PROVENANCE.
`createFaModernContextRestorer()` reuses the (now basename-parameterized) `contextRestorer.ts`. `phonemizeFaNeural`
is restructured CONTEXT-FIRST: it runs the modern model over each clause (a run of Persian words; digits/punctuation
break the run), and falls back PER-WORD to the word-level path (lexicon→OOV-seq2seq→g2p) on a degenerate decode, or
WHOLESALE when the model is absent. **Degeneration guard** (~1% greedy runaway, e.g. ɾaft→ɾaftatmat…; NOT a
quantization artifact): word-count mismatch OR an implausibly long token OR a repeated bigram → per-word fallback.
Also fixed: Persian-Indic digits (۰-۹, which fall in the PERSO letter range) were being fed to the context model as
words → now routed to the number path via ASCII folding. `phonemizeFaContext` stays the classical opt-in.

## Run 18 — 2026-07-20 — error-composition analysis (the "are we capped?" tiebreaker)

Bucketed every per-word miss on 500 held-out sentences (shipped int8 ONNX, greedy) — `tools/fa-restoration`
throwaway `analyze_errors.py` + a homograph lookup mined from HomoRich's `Homograph Grapheme`/`Phoneme` columns.
87.6% ok / 12.4% miss on this slice; composition of the MISS tail:

- **consonant/other 38.5%** — but LARGELY not real error: hiatus notation (ʔ vs j vs bare between vowels:
  tad͡ʒɾobeiː vs tad͡ʒɾobeʔiː, ʃabahhaːʔiː vs ʃabahhaːjiː) + spurious ezafe-ye (honaɾiː→honaɾiːje). Convention, not quality.
- **lexical-vowel 23.2%** — vowel a/e/o; partly GOLD-INCONSISTENT (تأثیرش→aʃ vs رفتارش→eʃ — the -aš/-eš enclitic
  transcribed both ways in the gold) + dialect (xejliː/xajliː).
- **ezafe 19.9%** — clean missed/spurious ezafe -e (context-dependent, improvable).
- **homograph 17.8%** — errors on the annotated homograph word (شوم šavam~šum) — exactly what HomoRich's labels target.
- **degeneration 0.6%** — greedy runaway (beam fixes).

**Verdict: NOT capped, and not a big-transformer problem.** ~38% of the tail is directly improvable (homograph
labels + more context for ezafe + beam); a large part of the 38.5% "consonant/other" is hiatus CONVENTION (fold ʔ/j
→ free accuracy, no model change); a sliver is irreducible gold noise. Real quality > the 85% headline. The
"transformer for world-knowledge" idea is RETRACTED (a small from-scratch transformer ≈ BiLSTM, no world knowledge;
the world-knowledge version is a big pretrained dependency, out of scope). Bounded levers, model-size-neutral.

**Next (Run 19):** retrain with (1) HomoRich homograph-column LOSS-WEIGHTING (the labels we ignored — the homograph
word's gradient was diluted ~10×) + a homograph-specific eval so we can SEE it move; (2) uncapped data (404k) +
more epochs with PATIENCE early-stopping (Chris: loss was still dropping at epoch 7); (3) BEAM decode in inference.
Hiatus-convention normalization flagged as a follow-up (its own careful pass — pick ʔ/j/bare vs getPhonemizer("fa")).

## Run 19 — 2026-07-21 — scheduled sampling for EOS/degeneration; measurement lessons

The modern context model degenerates (free-running EOS-failure loops) on ~7% of sentences (greedy) / ~5% (beam),
MASKED by prefix-aligned per-word scoring (looked like 86-88% while whole-sentence was ~30% = 0.87^9). Diagnosis:
exposure bias (low teacher-forced loss, free-running spirals). Fix = SCHEDULED SAMPLING (feed the model its own
argmax back at rate ss; loss stays anchored to gt → can only teach recovery). Training-only, no ONNX/inference change.

MEASUREMENT LESSONS (both were my errors, caught by Chris):
- Teacher-forced val loss is BLIND to free-running degeneration — selecting/stopping on it exports the WRONG (low-ss)
  model. Fixed: select + patience on a FREE-RUNNING metric (greedy-decode a val subset each epoch).
- A BINARY degeneration rate (word-count mismatch y/n) hides SEVERITY: SS turns a ×10 loop into a ×2 without changing
  the binary count. Fixed: log `excess` (total excess words) and select on combined `score = frr − 0.03·excess`.
- Don't delete a checkpoint to relaunch — kill, edit, RESUME (per-epoch checkpoints + resume-tolerant-of-metric-rename).
- WARM-START from the converged base (Run A best, val 0.072) + SS from epoch 1 at reduced LR (3e-4) — no re-warmup.

RESULTS (warm-start + SS, combined-score selection, uncapped epochs, no-earlystop past a plateau):
excess (severity, /300 val) fell 130→48 at the good troughs; per-word (frr) climbed 87→90%. Selected epoch 16
(frr 90.4%, excess 48, score 88.93). END-TO-END on the shipped int8: RAW restore(beam) 90.5% (degeneration wc-mismatch
7.2%→2.8%), PIPELINE `phonemizeFaNeural` 82.0%→89.8% across the whole investigation (guard+chunker got 82→85.6; SS
model + reduced degeneration got 85.6→89.8). SS REDUCED but did NOT eliminate degeneration — it floors ~2.8% (short
imperatives کن/بده, OOV proper names), caught by the pipeline fallback.

NEXT (Chris, post-epoch-25): ROLLOUT scheduled sampling — the floor is because per-token independent substitution
(reroll every step) never lets a SUSTAINED loop form in training, so the model never practices breaking one. Two
targeted variants: (1) STICKY/contiguous substitution (own-prediction spans, length ramping) → mid-sequence loops
form + get corrected; (2) TAIL free-running (teacher-force prefix, free-run the tail incl. the final EOS target) →
learns to terminate from its own drifted state. A/B vs per-token SS on the same excess/frr, warm-started from this
run's best epoch. Still training-only.

## Run 20 — 2026-07-21 — ROLLOUT scheduled sampling breaks the per-token floor

Per-token SS floored at excess≈48 (severity) / degeneration 2.8% because independent per-step substitution (reroll
every step) never lets a SUSTAINED loop form in training — the model can't practise breaking a loop it never enters.
ROLLOUT SS (`FA_SS_MODE=rollout`, sticky contiguous substitution spans of mean length SS_SPAN=8) fixes that: a span
of own-predictions lets a multi-char loop develop and the gt-anchored loss corrects it; spans reaching the tail =
tail free-running (learns to emit EOS from its own drifted state).

Warm-started from the per-token best (epoch 16), rollout dropped straight through the floor: excess 71→41→**32** by
epoch 3 (ss only 0.22), frr holding ~90.5% — score 89.59 beat the entire per-token run. NOTE: full ss=0.30 rollout
OVERSHOT (epochs 4-6 excess 84/53/95, noisier/worse) — big contiguous free-run chunks destabilise; the sweet spot
was ss≈0.22. Best = epoch 3.

FINAL (rollout epoch 3, shipped int8, beam):
- held-out per-word **90.5%**, homograph **80.4%** (best of every run; per-token ep16 was 90.0/78.9).
- RAW restore(beam) 90.8%, degeneration (wc-mismatch) **1.4%** (halved again from per-token's 2.8%).
- PIPELINE `phonemizeFaNeural` **90.5%** — nearly == raw (fallback barely fires now).
- sad-path: نمیتوانسته/بیدار fixed; به سمت loop SHORTENED (konanakat×5 → konand×2); OOV names (امیرخسرو) still loop.

WHOLE-INVESTIGATION ARC (deployed pipeline per-word): 82.0% → 85.6% (training-faithful guard + length chunker) →
89.8% (per-token SS, once measured/selected on free-running severity) → **90.5%** (rollout SS). Raw degeneration
7.2% → 1.4% (5×). Residual (short imperatives, OOV names) is an architectural floor of the char BiLSTM-attention
decoder, caught by the pipeline fallback. Decode: contextRestorer.ts BEAM (greedy was near-identical pre-SS but beam
is kept). GPU inference opt-in (FA_ORT_EP) exists but is SLOWER for this autoregressive decode — CPU is the default.
