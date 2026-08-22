# A self-labelled phone recognizer, as a disposable per-language instrument

**Status:** plan only. Nothing here has been built or run. Written 2026-08-22, at the
close of the ASR-alignment QC campaign (see
`docs/investigations/asr_align_qc_investigation.md`), as a description of the
instrument that campaign turned out to need and did not have.

---

## 1. Why: both referees are the defect we exist to fix

The QC campaign used two phone recognizers:

| instrument | label space | identity rate vs our IPA (fleet median) |
|---|---|---|
| `facebook/wav2vec2-xlsr-53-espeak-cv-ft` | espeak | 72.2% (range 47–94) |
| allosaurus | PHOIBLE | 51.0% (range 24–75) |

Both were treated, in practice, as noisy-but-neutral referees. They are not neutral.
They are the two reference systems whose known weaknesses are a founding motivation
for this project:

- **espeak has weak contrast and outright errors.** The wav2vec2 model is trained
  *on espeak targets*, so espeak's neutralizations are baked into its label
  space. Where espeak collapses a distinction, the model cannot emit it. Our
  correct distinction then reads either as our error, or — after `fold()` — as
  spurious agreement. Both directions are corrupted, and the corruption is
  invisible from inside the comparison.
- **PHOIBLE is a collection of narrow phonemic transcripts** that do not converge
  on IPA primitives for canonical-reference purposes. Which symbol allosaurus
  reaches for depends on which source doculect fed PHOIBLE for that language.

### The result this downgrades

The campaign's headline was: *for 101 of 102 languages, our IPA is closer to a
recognizer than the two recognizers are to each other* (their mutual median PER
0.424).

That bar is set by two referees who **do not share a symbol system**. A large but
unmeasured share of the 0.424 is notation, not acoustics. The honest reading is
therefore closer to *"the referees are too mutually incoherent to convict us"*
than *"we were measured against a competent instrument and passed."* The result
was bounded and is not wrong — the shuffled control scored 0/102 — but it is
weaker evidence of correctness than its phrasing implied.

### The axes we cannot see at all

Because the two label spaces are foreign, every comparison passes through
`fold()`, which strips stress marks, word boundaries, tone digits, length, and
Lm modifiers. On those axes we currently have **no instrument whatsoever**. The
phrase-final stress defect in French was found by hand-reading, not by
measurement, and would not have been visible to any metric we ran across 268,677
rows. Cf. the standing note that a fold which deletes an axis scores that axis's
absence as free.

**A recognizer that emits our own symbol set needs no fold.** That is the single
strongest argument for building one: not a sharper version of an existing
measurement, but first light on axes that are currently dark.

---

## 2. What it is

Fine-tune `facebook/wav2vec2-xls-r-2b` (436k hours pretrained) with a CTC head
over **our** phone inventory, on our own aligned corpus, with the language under
investigation held out. Then run it on that language and read the disagreements.

Deliberately **not** a general-purpose model. It is a disposable instrument with
exactly one job: predict the IPA of audio outside its training set, in our
notation. Build one per language under investigation and throw it away. This is
inelegant and repetitious by design; LoRA on the 2B over ~1,000 hours is a few
GPU-hours, so ten of them is a weekend, not a program.

Being disposable buys real freedom: **the model is permitted to be bad.** It does
not need to be accurate in absolute terms. It needs to disagree informatively on
one language.

---

## 3. What the holdout does and does not buy

**Breaks lexical circularity, cleanly.** The model cannot have memorized how our
module renders a particular grapheme sequence in the held-out language. Its
predictions there are genuine.

**Does not break systemic circularity.** Our IPA across ~190 modules is not many
independent labelings; it is one codebase's notational dialect — how we mark
aspiration, length, schwa, syllabicity, stress placement, rhotic choice. A model
trained on it learns *our conventions* and transfers them. Agreement on the
held-out language partly measures "the convention transferred," not "the
acoustics match."

**The leak scales with relatedness.** Holding out `bn_in` while retaining
as/or/pa/gu/mr/ne/ur keeps nearly every phonological decision Bengali depends on
— breathy voice, the four-way laryngeal contrast, inherent-vowel handling. That
holdout is close to cosmetic at the systemic level. Holding out the whole family
is genuinely independent and genuinely worse at hearing. **Independence and
competence trade off directly, and the trade must be made consciously per run.**

### Structural blind spot, stated up front

Fleet-wide convention error. If we notate something the same wrong way in eighty
languages, the model learns it, reproduces it on the holdout, and the transfer
score looks excellent. This instrument is sharp on per-language idiosyncrasy and
**blind by construction to shared error.** Same shape of trap as the aggregate
delta metric — record it next to every number this thing produces.

---

## 4. Design: ablation, not holdout

Prefer a **difference of two models** over a single held-out prediction.

Train two models identical in every respect except that one saw the target
language and one did not. Compare their predictions on that language.

Most shared defects — fleet convention error, 2B pretraining bias, tokenization
artifacts, CTC peakiness — are common to both and **cancel in the difference**.
That is what makes the measurement survive the model being mediocre.

- Including the language barely moves the output → the fleet already predicted
  our notation for it; it is coherent with the rest of the corpus.
- Output moves a lot → our module is idiosyncratic relative to the fleet, and
  **where** it moves is the queue.

Note what this question is, and is not. It is not "is language X right." It is
*"given this audio, is X notated the way the rest of the fleet notates comparable
acoustics?"* That is a fleet-coherence audit — something ~190 modules written over
a long period by different reasoning have never had — and it is far less
circular than a correctness claim.

## 5. Controls (non-optional)

Without these the target-language number is uninterpretable, in exactly the way
the shuffled control made the earlier result readable.

### The trap: the obvious control produces a null

The instinctive positive control is "ablate a language we trust — `fr_fr` — and
check it behaves." But if French is well-notated and coherent with the fleet,
the *expected* result is **little or no movement** between seen and unseen. A
null cannot distinguish:

- French is coherent (the conclusion we want), from
- the ablation is insensitive and would show nothing whatever we fed it.

A passing `fr_fr` arm therefore demonstrates **specificity** — no false alarm on
a good language — and says **nothing about sensitivity**. If the real target then
also comes back quiet, we have no basis for reading it as "clean" rather than
"the instrument is blind." Flat may mean blind.

### Three arms, not one

| arm | expected | establishes |
|---|---|---|
| `M_all` vs `M_−fr` on French audio | small movement | specificity — no false alarm on a known-good language |
| `M_all_frcorrupt` vs `M_−fr` on French audio | large, **localized to the planted phones** | sensitivity — it can recover a known-position bug |
| shuffled / mismatched audio | floor | the metric is measuring something |

**The planted-defect arm is the load-bearing one.** Corrupt French training
labels in a known way, retrain, and require that the disagreement localize to
exactly the corrupted phones — not merely that it grow.

Choose the corruption on an axis we care about. **Stripping stress marks from
French is the sharpest choice**, because stress is precisely what `fold()`
deletes today: that run doubles as proof the new instrument sees what the old
referees structurally cannot. If planted stress cannot be recovered, the
tokenization decision in §6 was wrong, and we learn it for the cost of one
training run rather than ten.

Only if arms 1 and 2 *both* land is there a readable scale for a real target.

### Run order within the control block

Arm 1 first, arm 2 second. Two reasons: arm 1 needs only models we must build
anyway (`M_all`, `M_−fr`) while arm 2 costs an extra training run, so a failure
there kills the programme cheaply; and "does not fire when it should not" is the
weaker, necessary-but-not-sufficient claim, which is the right thing to try to
falsify first.

**Execution order is not evaluation order.** Arm 1's "small" is only
interpretable against arm 2's "large" — that is why both exist. Arm 1 may kill
unilaterally if it comes back *catastrophic*; if it comes back merely *quiet*,
that quiet cannot be scored until arm 2 supplies the scale.

Run the shuffled floor alongside arm 1. It is an eval, not a training run, and
it gives the null an absolute reference immediately rather than only a relative
one later.

### Family-depth sweep

Same target, holding out (a) the language, (b) the family. The gap between them
measures how much of the prediction is family-transfer versus fleet-general
convention — it puts a number on the leak in §3 instead of leaving it a caveat.

### Practical note

`M_all` is the "seen" arm for **every** target and is trained once and reused.
Marginal cost per target is one holdout model, not two.

## 6. The decision that constrains everything: tokenization

Whether stress marks, length, and diacritics are **separate CTC tokens or fused
into atomic units** determines whether the model can learn the axes `fold()`
currently deletes.

Fusing gives a cleaner, better-behaved model — and throws away the entire reason
to build it. Decide this first, deliberately, and favour decomposition even at a
cost in headline accuracy.

Open sub-questions: inventory size across the fleet after decomposition; whether
tone digits and Lm modifiers get their own tokens; whether word boundary is a
token or is recovered from timing.

## 7. Training data

Gate on the align DB. The campaign's main output — the exclusion list — is
exactly the filter this needs, which is convenient:

- exclude `defective_audio` outright
- exclude unrepaired `reader_divergence` (keep where `read_text_src = 'hand'`)
- consider excluding `recognizer_short` and high-`defect` rows
- targets come from the `ipa` column, with hand-corrected `read_text` rows preferred

Roughly 2.7k rows per language, ~102 languages, on the order of 1,000 hours.
Ample for a LoRA adaptation over a 436k-hour pretrain.

---

## 8. Cheap tests to run *before* any of this

Both are queries against data we already have, and either could settle a
question this plan would otherwise spend GPU-hours on.

**8a. Assamese as a Bengali control.** `as_in` shares Bengali's script and is
closely related phonologically, with different recordings and different readers.
Now fully populated (1,692 rows filled from wav filenames).

- `as_in` normal, `bn_in` bad → the instruments' Indic competence is not the
  explanation; something is specific to `bn_in`.
- both bad → the instrument.

**8b. Does the error track acoustics or linguistics?** Correlate per-row distance
against cps, duration, and clipping. Audio-limited rows should cluster on the
acoustic axes; instrument-limited rows should look acoustically ordinary. cps is
already computed.

### On Bengali specifically — a correction to the campaign's conclusion

The campaign closed Bengali on the reading that its residual was recording
quality and reader elocution. That conclusion is **not adequately supported**,
and this document supersedes it.

The evidence was: inter-recognizer PER in the 0.7 band, 12.8% multi-take
divergence (352/2,745), and an elocution observation. The first two are measured
*through the defective referees* on a family where both instruments are weak, so
they cannot separate bad audio from bad instrument — they are consistent with
either. The third was an observation about English readings, extrapolated to
Bengali without warrant.

Neither the instruments nor we can adjudicate this by ear, and that is the actual
problem: **no available referee has demonstrated competence on this language.**
Bengali is therefore a reasonable first target for §4 — not because it is the
most likely to yield a fix, but because it is the case where our current
instruments most clearly cannot answer the question, and where the ablation
design would tell us which of the two explanations is right.

**`as_in` and `bn_in` must be held out together.** They share a script and most
of their phonology, so holding out Bengali while Assamese remains in training
means the "unseen" model has effectively seen Bengali — the difference collapses
for reasons unrelated to coherence. Hold the pair out as a unit and read the one
model twice; the differential between the two, under identical holdout and
family, is the actual signal. This is cheaper than two sequential ablations, not
more expensive.

---

## 9. Gates and order of operations

1. **§8a and §8b first.** SQL against data we already hold. Either may redirect
   or cancel everything below before a single GPU-hour. If §8b shows the `bn_in`
   error tracking cps and clipping, the question is answered without training.
2. **Train `M_all`** — reused as the seen arm for every subsequent target.
3. **`fr_fr` specificity arm** (§5, arm 1) plus the shuffled floor (arm 3).
   Catastrophic movement here is a standalone kill.
4. **Planted-defect sensitivity arm** (§5, arm 2) — the extra training run.
5. **Gate.** Proceed only if arm 1 is quiet *and* arm 2 fires in the right place.
   A quiet arm 2 means the instrument is blind; stop, and revisit §6.
6. **`as_in`/`bn_in` held-out pair**, read twice.
7. **Family-depth sweep** to quantify the Indic leak.

Additional stop conditions:

- If transfer PER on held-out families lands anywhere near the 0.424
  inter-recognizer median, the instrument is too weak to say anything — stop.
- If it lands materially below *and* the planted defect was localized, the
  stress, length, and word-boundary axes open up, and the fleet-coherence audit
  in §4 becomes worth running broadly.

## 10. Secondary use, with no circularity problem at all

The same model is a much better **per-row alignment scorer for TTS training-set
selection**, and there the epistemics evaporate: the question is "does this audio
match the text we would train on," where a systematically-shifted-but-consistent
model is perfectly adequate for *ranking*. That use needs no holdout, no
controls, and no ablation — just one model trained on everything clean.

If the QC case in §9 fails its gate, this use likely still justifies the build.
