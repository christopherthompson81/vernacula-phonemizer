# Signed numbers and the multiplication sign — what the `math-sign` / `signed-number` cells actually measure

Scope: #586, the two cells `arithmetic` (`[+±×÷=<>]`) and `signed-number` (`[-−–]` before a digit). Opened
because #627 closed both "by negative" — *no corpus spells a plus, so no rule is authorable* — and that
conclusion was reached from a class-level count without ever resolving **which symbol** in **which shape**.

## Run 1 — 2026-08-03 — resolve the two cells per SYMBOL instead of per class

The class-level gate (`coverage.ts`) reports `arithmetic DROP` / `signed-number DROP` for 29 languages. That
number is a count of *probe hits, not causes* (playbook trap: a gate's count is not a defect count), so the
first question is which symbol each hit is.

Command — over all 66 committed artifacts, per symbol, the differential drop test (substitute, never delete):

```
per-symbol: [+ − × ÷ ± = < >] plus [-–] restricted to the digit-initial (minus) shape
for each: does phonemize(line) === phonemize(line with symbol → space) ?
```

### Raw finding

`+` drops in **17** languages: am fa gu kn mi ml my nb ne sr sw ta te vi xh yue zu.
`×` drops in **4**: ar hu ja th.
`-`/`–` (minus shape) drops in **12**: de el gu hi kn ml mr my ta th xh zu.

### What the `+` hits actually are — two universal sentences, and nothing else

Every single `+` instance in every artifact is one of two FLEURS sentences (the universal-sentence
technique — FLEURS is a translation of one English set, so a shape recurs fleet-wide):

- `+30 °C` — the Montevideo sentence, "in the summer months temperatures above +30 °C are common"
  → am gu mi ne sw ta te vi xh zu
- `UTC+1` — the Downing Street protest sentence, "began around 11:00 local time (UTC+1) on Whitehall"
  → fa kn ml sr yue

**These are two different phenomena and want two different readings.** A signed temperature is arithmetic-ish
("plus thirty degrees"); a UTC offset is an offset ("UTC plus one"). Neither is *arithmetic* — the cell is
misnamed for what it is catching.

### What the `×` hits actually are — two more universal sentences

- the manuscript: "(measuring 29¾ inches × 24½ inches)" → ar, th
- the film camera: "6 × 6 cm, more precisely 56 × 56 mm" → ja, hu (also cs, nb, en, which already read it)

Both are **dimensions** ("six by six centimetres"), not multiplication. Two things fall out:

- ⚠ **`hu` writes BOTH spellings in one sentence** — `6 x 6 cm` (ASCII x) *and* `56 × 56 mm` (U+00D7). That is
  an internal control, not a typo: the ASCII variant is real orthography and must be handled. A rule matching
  only U+00D7 reads half of hu's own sentence.
- ⚠ **THE DIMENSION `×` IS NOT RELIABLY DIGIT-FLANKED.** In ar's `29¾ بوصة × 24½ بوصة` the left neighbour is a
  unit WORD and the numbers carry vulgar fractions. `(\d)\s*×\s*(\d)` — the shape cs uses — misses it
  entirely. Any guard written from the film-camera sentence alone is wrong for the manuscript sentence.

### What the minus hits actually are — almost all FALSE POSITIVES, with named causes

This is the part #627 got wrong, and the part I previously dismissed "by eye" without naming the causes.
Resolved individually, the 12 languages' minus hits are:

| language | text | what it really is |
|---|---|---|
| de, gu | `dem 10.-11.`, `10મી -11મી` | an ordinal **range** |
| el | `–12 χιλιόμετρα … Σιέμ Ριπ–` | a **parenthetical dash pair**, an aside |
| hi, mr, ta | `चंद्रयान -1`, `சந்திரயான் -1` | a product **designation** (Chandrayaan-1) |
| kn, zu | `26 -00`, `1995 -96`, `ngo-26 -00` | a **score** / a year range |
| xh, zu | `ezingama-3000`, `wama-10 -11` | Bantu **hyphen-bound numeric prefix** |

So the `signed-number` cell is measuring a negative number in **approximately none** of its hits. Its guard
`(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\p{Nd})` is defeated by a space after a word (`चंद्रयान -1` — the guard sees
a space, not a letter), and by the Bantu prefix, where a hyphen is ordinary orthography.

**Implication for the plan.** Building hybrid corpora to give this cell more material would add text to a cell
that cannot tell a minus from a Zulu noun prefix. The guard is the prerequisite, not the corpus.

### What this retires, and what it confirms

- ✗ Retired: #627's "no rule is authorable because no corpus spells a plus". The corpora contain **17
  languages' worth of dropped `+`** in two well-defined shapes. The sign is unspelled, but the *shape* is
  abundant — what was missing was a sourced WORD, which is a sourcing problem, not a corpus-content one.
- ✓ Confirmed, and this is the real reason a hybrid/wiki route is needed: the word for "plus" / "minus" /
  "by" is a **written sign in every corpus**, so no amount of FLEURS reading yields it. It has to come from
  prose that spells it out — the wiki route, exactly as `ff`'s `kaaree` and `ga`'s `cearnach` did.
- The design follows from the split: the SHAPES are cross-linguistically identical (`+30 °C`, `UTC+1`,
  `6×6 cm`), only the WORD differs → a shared-tier cell with declared words, not 17 local rules. Languages
  with an idiomatic split keep their local rule — `cmn` says 零下 ("below zero") before a degree word and 负
  otherwise, which is precisely the "truly language-idiomatic" case that belongs local.

### Next step

1. Tighten the `minus` guard so the cell measures minuses (prerequisite for trusting any later count).
2. Source `plus` / `minus` / `by` per language, corpus → referee → wiki, and declare them in the tier.
3. Re-measure. Only then is an empty cell evidence of anything.

## Run 2 — 2026-08-03 — the guard, and then the sourcing wall

### The guard (shipped, c517e4b)

Added a second lookbehind excluding the range shape. 15 dropped-minus hits → **9**; de, kn, ml, th, zu go
clean. hi's one real negative survives, which is the constraint that set the window width. Tooling-only, so no
runtime effect. Remaining 9: 4 designations, 2 apposition dashes, hi's `पू.-1200` (a range the tight window
cannot reach — accepted), hi's true negative, xh's `kangange -40 mph` (a Bantu prefix with an intruding space).

### The sourcing wall — this is the real blocker, and it is NOT corpus volume

`concept.ts --items Q6265342,Q10764194,Q1900125` (plus sign / minus sign / ×) over all 19 affected languages:

```
       plus sign      minus sign     ×
  am   +              -              ×          ← the LABEL IS THE BARE CHARACTER
  gu   +              -              ×             …and so for fa kn mi ml ne sr sw ta te th xh zu
  ar   علامة زائد     علامة ناقص     علامة الضرب
  hu   pluszjel       mínuszjel      ×
  ja   プラス記号        マイナス記号       ×
  vi   +              -              dấu nhân
  yue  加號            減號            乘號
```

**14 of 19 languages return the bare character as their own label for it.** That is the same laundering the
tool's header warns about — a label that is the symbol says nothing about what a reader says. Only ar, hu, ja,
vi, yue yield a word at all, and those are SIGN NAMES (`pluszjel` = "plus-sign", 加號 = "plus-sign"), which
still need the operand-position sense checked separately.

`attest.ts` on the candidates, senses checked (trap 37 — the bare modifier is never the attestation):

| candidate | verdict | what the hits actually are |
|---|---|---|
| hu `mínusz` | ✓ **attested, right sense** | `egy sárga lap: mínusz 1 pont` — directly before a number |
| ja `マイナス` | ✓ attested by a **reading gloss** | the album title `-（マイナス）`: the character, then its reading |
| ja `プラス` | ✗ sense unproven | only the TV title `99プラス` |
| ja `掛ける` | ✗ wrong sense | pouring broth over noodles |
| ar `في` | ✗ wrong sense | the locative preposition "in", thousands of hits |
| ar `ضرب` | ✗ wrong sense | "struck" — a hurricane struck the city |
| th `ลบ` | ✗ wrong sense | the ADJECTIVE "negative", `การป้อนกลับทางลบ` = negative feedback |
| th `คูณ`, `บวก` | ✗ | zero hits |
| hu `-szor` | ~ real, wrong sense | `13-szor` = "13 times over" (frequency), and vowel-harmonic → local if ever |

### Why more corpus would not fix this, and what would

The dimension `×` and the signed `+` are **written as signs in running prose, in every language, including in
the wiki**. So the word is not rare in the corpus — it is *systematically absent from written text*, because
writing uses the glyph. Adding text cannot surface a word that writing never spells. That is a different
failure from `ff`'s `kaaree` and `ga`'s `cearnach`, which were ordinary words merely missing from FLEURS and
sitting in wiki prose; those the wiki route found immediately.

The two things that DID work are worth naming, because they are the only routes that can work here:

- a **reading gloss** — text that writes the character and then its pronunciation (`-（マイナス）`). Rare, but
  decisive when present, and findable by searching for a character next to a parenthesis.
- a **word-only context where the sign cannot be used** — `mínusz 1 pont` in a rules list. Prose that must
  read as speech (sports rules, recipes, spoken-register text) spells what formal prose signs.

⚠ So NOTHING is shipped for ar/th here, and hu/ja's sourced words do not match their measured defects: hu's
and ja's actual drop is `×`, not the minus. Declaring `mínusz` for hu would be speculative robustness for a
symbol hu's corpus already reads. Recorded as unsourced rather than filled with a plausible guess.

### What this run establishes

- #627's conclusion is retired but its *instinct about the corpus* was half right: the SHAPE is abundant (17
  languages' dropped `+`), the WORD is unobtainable from written text by construction. "No rule is authorable"
  was wrong; "no rule is authorable **from prose alone, for most of the fleet**" is right, and is a much
  narrower claim than the one closed on.
- The remaining route for the other 14 languages is a **speech-register source**, not a bigger corpus: a
  reading gloss, a spoken-register wiki (Wikipedia's "spoken articles"), or a language's own maths-teaching
  text. Untried here.
- ⚠ `hu` writes `6 x 6` and `56 × 56` in ONE sentence, so whatever eventually ships must accept the ASCII `x`.

## Run 3 — 2026-08-03 — ASR ON THE FLEURS AUDIO. The wall comes down.

**The speech-register source was sitting in the corpus the whole time.** FLEURS ships audio aligned to every
transcript, so the sentence containing `+30 °C` has a recording of a human reading it aloud. Whatever the
speaker said in that position **is** the word — no prose required, and prose was never going to give it.

Checked first, and negative: FLEURS's own column 4 ("normalized" transcription, which this repo's tooling never
reads — it takes column 3) only lowercases and strips punctuation. It **keeps `+` as a sign** in all 19
languages. So the text side of the dataset is exhausted; the audio side is not.

### Route

Local audio: `/mnt/data/omnivoice_ipa/corpus/audio_cache/data/<corpus>/audio/train.tar.gz`, 29 languages, 46G.
ASR: AI4Bharat IndicConformer, ONNX, 22 Indic languages with per-language vocab spans —
`/home/chris/models/indicconformer_600m_onnx`, driven by
`vernacula/scripts/indicconformer_export/validate_indicconformer_package.py` (pure onnxruntime, no torch).

⚠ `indicconformer_onnx` (the 400M export) decodes EMPTY, including on the reference audio its own docs use. A
broken export is indistinguishable from an unintelligible recording unless you check a known-good file first.
Use the 600m package.

### ta — `பிளஸ்`, three speakers, two sentences

```
+30 °C   →  …வெப்பம் பிளஸ் முப்பது டிகிரி சி…      (piḷas = "plus")
UTC+1    →  …சுமார் பதினோரு மணிக்கு யூடிசி பிளஸ் ஒன்…   ×2 speakers
UTC+1    →  (third speaker skipped the parenthetical entirely)
```

The offset is read wholly as English loans — `ஒன்` ("one"), not Tamil `ஒன்று`.

### hi — and here the two shapes DIVERGE, which is the finding

```
UTC+1    →  …यूटीसी प्लस एक…   /  …यूटीसी प्लस वन…      plus SPOKEN, 2 speakers
+ 30° C  →  …तीस डिग्री सेल्सियस से अधिक…             plus NOT SPOKEN, 2 speakers
```

**Both Hindi speakers omitted the `+` before the temperature and both said `प्लस` in the offset.** So:

- ✓ Run 1's guess that `+30 °C` and `UTC+1` are read differently is confirmed as a fact about **speakers**.
- ⚠ **BUT THE OMISSION IS NOT A LICENCE TO DROP THE SIGN, and concluding that was this run's error.** The
  target is TTS: a reader who skips a character the author explicitly typed is evidence about reading habits,
  not about content we may delete. An author who writes `+30 °C` marked the sign deliberately, so the faithful
  rendering voices it. Both ta and hi therefore read the plus in both positions.
- What the audio DOES settle is the **word** — hi's `प्लस`, replacing a `धन` that was correctly sourced from a
  maths article naming the sign and is simply the wrong register. That correction is the run's real product.
- Corollary for the gate: had the silence shipped, hi's `+30 °C` would have registered as a permanent `DROP`,
  since a differential test only knows the symbol vanished. Voicing the sign keeps gate and reading aligned.
- Both speakers also said `सेल्सियस` for a bare `C`, and one read `1` as Hindi `एक` while the other used
  English `वन` — the same sentence, the same position, two registers.

### What this establishes as a method

A FOURTH sourcing tier, above the wiki: **the corpus's own audio**. It is stronger than every text tier for
this class of question, because it answers *what a reader says*, which is the actual question a phonemizer
asks, and it is immune to the failure that blocked Runs 1–2 (prose writes the glyph, so the word is absent
from writing by construction — not rare, absent).

It also supplies something no text tier can: **evidence about reading habit** — "two speakers read this sign as
nothing". ⚠ That is not the same as "the correct output is silence", and the distinction is the whole lesson of
this run. For a TTS target the written character is the content; the recording is a referee on *how* it is said,
and an audio referee will routinely hear things that do not line up with the script. Interpret it, don't obey it.

### Coverage and limits, measured

- audio cache and the omnivoice token set cover the **same 28–29 corpora**; `te_in` is in NEITHER, and te's
  `+` rows are in `train` while only its `test` tarball is cached. te needs a network fetch.
- every other affected language has `train` cached and its `+` rows in `train`: am ta vi xh zu ar ja th hi.
- but ASR coverage is the binding constraint: IndicConformer is Indic-only, so of the affected set only
  **ta and hi** are reachable locally today. am/vi/xh/zu/ar/ja/th need Cohere-transcribe, OmniVoice or
  Qwen3-ASR — all present in the HF cache but all requiring torch, which is broken in this environment
  (`libtorch_global_deps.so` missing).
- the omnivoice token `.npz` set is a route to reconstruct audio for the 28 covered corpora, but it does not
  extend LANGUAGE coverage — it needs the omnivoice decoder, i.e. torch again.

## Run 4 — 2026-08-03 — the C# ONNX backends: en confirms the convention, ar and ja get their word

The Indic path covered only ta/hi. Vernacula ships **C# ONNX** ASR backends and the weights are installed at
`~/.local/share/Vernacula/models` (parakeet, qwen3asr, cohere_transcribe, whisper_turbo) — no torch involved, so
the "blocked on a broken torch install" note in Run 3 was wrong about the whole fleet, only right about the
Python path.

```
dotnet run --project src/Vernacula.CLI -c Release --no-build -- --audio X.wav \
  --model <dir with parakeet files + silero_vad.onnx> --diarization vad --export-format txt
  [--asr qwen3asr --qwen3asr-model ~/.local/share/Vernacula/models/qwen3asr --language ja]
```
⚠ Parakeet resolves its files at the `--model` ROOT while silero/sortformer live in subdirectories, so a
composed directory of symlinks is needed; pointing `--model` at the models root fails on `nemo128.onnx`.

### en (parakeet) — the convention, measured

| shape | speakers | result |
|---|---|---|
| `temperatures above +30°C` | 2 | **0 of 2 voice the plus** — "temperatures above thirty degrees Celsius are common" |
| `(UTC+1)` | 3 | **2 of 3** say "UTC plus one"; the third skipped the parenthetical entirely |

Confirms the general convention independently: **a measurement plus is frequently omitted, a UTC offset is
voiced.** en behaves exactly as hi does. ⚠ **NO CODE CHANGE FOLLOWS** — under the TTS policy the written sign is
content and gets voiced, so en's existing unconditional `plus` is correct. The measurement closes the follow-up
rather than opening a change.

Also: the "one speaker skips `(UTC+1)`" pattern has now recurred in **ta and en**. Treat a missing
parenthetical as expected reader behaviour, not as a signal about the language.

### ar and ja — the dimension `×`, sourced at last

| lang | decoded | reading |
|---|---|---|
| ja | `六掛ける六センチ` … `56かける56ミリ` | `×` → **かける** |
| ar | `…ستة وثلاثين في أربعة وعشرين ملليمتر…` | `×` → **في** |

Both are the words Run 2 failed to source and mis-attested: `掛ける` returned the everyday verb (broth over
noodles) and `في` returned thousands of locative hits. The dimension sense is invisible in writing because
writing uses the glyph; the recording puts the word in the slot.

⚠ **ar was cross-checked with two backends** because Qwen3-ASR rendered the slot as `فاربعة` — a ف-initial
function word with the yāʾ elided, suggestive but not clean. Cohere renders `في أربعة` cleanly. That agreement
settles the TRANSCRIPTION, not speaker variation: it is still one speaker, and ar's second `×` instance sits in
the `test` split whose audio this corpus does not carry. ja likewise has one speaker, but the sign occurs
**twice inside the one utterance** and both were rendered かける.

Shipped: ar reads `في` keyed on the FOLLOWING digit alone (the manuscript's `29¾ بوصة × 24½ بوصة` has a unit
word on the left, so a digit-flanked rule misses it); ja keys on both digits, which is safe because the
language is unspaced.

Gates: corpus diff **ar DROP 2 → 0** (defect-free on this class), **ja DROP 2 → 1**; 2/1702 and 1/1788 changed,
every change read. Referee eval unchanged by construction — zero `×` in any ar or ja referee list.

### Remaining, honestly

- th, vi, am, xh, zu — audio cached, ASR backends present; not yet run.
- te — in neither the audio cache nor the token set; needs a download.
- hu's `×` — European, so parakeet covers it, but hu has no FLEURS corpus here (its `×` came from the mined
  wiki artifact), so there is no aligned recording to consult.
- ⚠ ar drops the vulgar fraction in `29¾` (reads "twenty-nine"). Pre-existing, unrelated to this work, unfixed.

## Run 5 — 2026-08-03 — vi shipped; th/am/xh/zu are backend-limited, and the `ipa` field is CIRCULAR

### vi (Cohere) — `cộng`, 2 of 2 speakers on both sentences

`(UTC +1)` → "…utc cộng một…"; `+30°C` → "…trên ba mươi độ c" (sign not voiced). Shipped voicing both arms per
the TTS policy. vi joins en and hi in the convention. Corpus diff DROP 2 → 0.

### th, am, xh, zu — not sourceable with the installed backends

| lang | backend | outcome |
|---|---|---|
| th | Cohere | transcribes Thai audio as **Vietnamese-looking nonsense** — unusable, obviously so |
| th | Whisper | accurate Thai, but **re-orthographizes**: emits `UTC + 1` and `11.00 น.` |
| am, xh, zu | Cohere | decodes collapse into loops and hallucinated language switches |

⚠ **THE ASR MUST EMIT SPOKEN FORM, NOT WRITTEN FORM.** This is a selection criterion for the whole method, not
a fixable step. Verified in `WhisperTurbo.cs`: no text post-processing exists anywhere in the file (the only
`Normalize` is ISO language-code remapping) and the text path is a plain byte-level BPE decode of emitted
tokens. So the `+` is a TOKEN THE DECODER CHOSE — Whisper trained on web-scraped audio/written-text pairs and
emits formatted text end-to-end. Once re-orthographized the evidence is gone; no post-process recovers it.
IndicConformer (CTC, verbatim) / Cohere / Qwen3-ASR all verbalize; Whisper does not.

⚠ A convergent lead deliberately NOT used: three of the collapsed decodes independently emitted "plus one" near
the UTC slot (am `بلاس وان`, xh `UTC plus one`, zu `U. T. C. plus one.`). Suggestive that these languages use
the English loan in offsets — but taking a fragment out of a garbage decode is laundering. Logged as a lead.

The unblock, untried here because it needs torch (broken in this environment: `libtorch_global_deps.so`):
**`facebook/mms-1b-all`** (1162 languages, CTC so verbatim, per-language adapters incl. `amh`/`xho`/`zul`/`tha`)
and, for IPA rather than text, **`facebook/wav2vec2-xlsr-53-espeak-cv-ft`** — a phone recognizer structurally
cannot re-orthographize, which is exactly the Whisper failure mode.

### ⚠ THE `omnivoice_ipa` MANIFEST `ipa` FIELD IS OUR OWN OUTPUT — NOT AN AUDIO REFEREE

`/mnt/data/omnivoice_ipa/corpus/tokens/manifest_<corpus>.jsonl` carries a per-utterance `ipa` field, and the
corpus name invites reading it as audio-derived. It is not. Compared against `phonemize()` on the same text for
am/xh/zu it is **essentially identical** — same phone inventory, same stress marks, same idiosyncratic click
transcription (`ikʼwiŋɡ̤iŋ̤ǃˈaːna`); the only differences are older behaviour (am lacks today's `diɡɨɾi sˈiː`,
commas placed differently).

So the absence of a "plus" word in that field reflects **our dropping of the sign**, not what any speaker said.
Reaching for it as evidence would be reading our own bug back. It IS useful as a snapshot of past output for
regression archaeology — never for sourcing.

## Run 6 — 2026-08-03 — pt's unexplained `DROP currency ×1`, and a verification that verified nothing

The standing note on pt's declared `US$` key said it was "verified on the direct form, inert on the corpus, and
the difference is not yet explained". Both halves are now resolved, and the explanation indicts the check.

Isolation, which is what makes the cause visible:

```
US$ 11.000          → ˈõzɨ mˈiɫ dˈɔlɐɾɨʃ      "onze mil dólares"    ✓
por US$ 11.000 a    → poɾ ˈu ˈesɨ ˈõzɨ mˈiɫ    "por U S onze mil"    ✗
```

It reads correctly **iff the currency expression is the entire string** — any token before or after breaks it,
independent of the number. Instrumenting the two layers separately:

```
US$ 11.000        → initialisms → US$ 11.000              (untouched)
por US$ 11.000 a  → initialisms → por u esse$ 11.000 a    (US split into letters)
```

**Cause.** `portuguese.ts` composes `SYMBOLS(initialisms(normalize(x)))`, so the initialism pass runs BEFORE the
symbol tier and splits the all-caps run; the `$` is then preceded by a letter and the tier's guard — the one
that stops a key biting into a word — correctly refuses it. The sign vanishes.

⚠ **WHY THE ORIGINAL CHECK PASSED.** `core/initialisms.ts` opens with an all-caps-DOCUMENT guard,
`if (!/\p{Ll}/.test(text) && /\s/.test(text.trim())) return text`. The probe string `US$ 11.000` contains no
lowercase at all, so it tripped that guard and skipped the pass entirely. **The one context tested was the one
context where the interfering rule is inactive.** A single-expression probe can trip a document-level
heuristic — test a sign inside a sentence.

**Fix, and why it is local.** pt folds `US$`/`AUD$` → `$` in normalize step 5b, before initialisms; the
compound keys are removed as unreachable. Folding rather than emitting words keeps the tier's count agreement
(`US$ 1` still reads *dólar*). The fold is the attested reading, not a convenience: **both pt_br speakers say
the currency word and never voice the code** — "vendidas por 11 mil dólares a 22 mil e quinhentos dólares a
onça" (Parakeet, 2 of 2).

⚠ **NOT fixed in `core/initialisms.ts`.** Excluding `\p{Sc}` from that pass's trailing guard would fix pt and
regress the others: measured across all 66 artifacts, **20 languages carry an uppercase run glued to a currency
sign, every instance `US$` or `AUD$`, no counterexample** — and 18 of them declare no compound key, so they
would stop spelling the letters and start reading `US` as a WORD with the sign still dropped. The general
repair is to let the currency tier claim a sign before the initialism pass sees the letters, which is a
reordering and belongs to its own change.

Gates: corpus diff pt 1/1943, **DROP 1 → 0**. (The pre-existing `RAWMARK 1`, the `1.000º` ordinal, is untouched.)

## Run 7 — 2026-08-03 — the PHONEME recognizer closes am, xh and zu. Text ASR could not, and here is the proof.

Run 5 left four languages blocked. Two more models were tried, and the difference between them is the finding.

### `facebook/mms-1b-all` — accurate, and WRONG FOR THIS QUESTION

1162 languages, CTC, per-language adapters. It transcribes am/xh/zu/th well. But at the sign it emits
**the sign**: `utc+1` (amh), `kwe-+30°c` (xho), `kuka-+30°c` (zul), `utc.1` (tha). Its vocabulary is
orthographic — characters, digits, punctuation.

A `+` in that output is tempting to read as "a plus was spoken". **A control on languages whose answer was
already known kills that reading:**

| language | speakers actually said (verbalizing ASR) | MMS emitted |
|---|---|---|
| ta `+30 °C` | `பிளஸ் முப்பது` | `130ப` — word lost |
| ta `UTC+1` | `பிளஸ் ஒன்` | `utc.1` — word lost |
| hi `यूटीसी + 1` | `प्लस एक` (2 of 2) | `यूटीसी1` / `यूटीसी.1` — **word lost** |
| vi `UTC +1` | `cộng một` (2 of 2) | `utc cộng 1` — rendered |

So MMS is unreliable **in both directions** at a sign slot: it dropped two demonstrably spoken plus words and
rendered a third. Its `+` for xho/zul is a character, not evidence. ⚠ Without this control the run would have
reported "xh and zu voice the plus" on the strength of a `+` glyph.

### `facebook/wav2vec2-xlsr-53-espeak-cv-ft` — the right instrument

A PHONEME recognizer: its vocabulary contains **no `+` and no digits**, so it physically cannot echo the
orthography back. Whatever is in the slot must appear as phones. (Decoded with a hand-rolled CTC collapse over
`vocab.json` — the `Wav2Vec2PhonemeCTCTokenizer` demands the `phonemizer` package at construction, which is only
needed for text→phoneme encoding, not for decoding.)

**Validated on hi first, where the answer was already known — 4 of 4:**

```
UTC  →  j uː d i s iː  p l a s e k        ("plus ek")   matches प्लस एक
UTC  →  j uː d i s iː  p l e s w a n      ("plus one")  matches प्लस वन
temp →  m e t iː s d e ɡ r i s s e l ʃ e s     no plus phones — matches the SILENCE
temp →  m e d iː z l i ɡ l s e l s i s         no plus phones
```

Reproducing the silence is the part that matters: it shows the instrument is not inventing the word either.

### Results

| lang | `UTC+1` | `+30 °C` |
|---|---|---|
| am | `m j uː t iː s iː p l a s w a n` — **2 of 3** (third skips the parenthetical) | `s a l a s a d i ɡ l i s…` — **no plus, 2 of 2** |
| xh | `p l a s w a n` — **3 of 3** | `…k w e t e t i…` — **no plus, 2 of 2** |
| zu | `p l a s w a n` — **1 of 3**; the other two skip the parenthetical, so 1 of 1 among readers | `p l a s o m aɪ n a s…` — plus present, ONE noisy file |

All three voice the English loan. The skip pattern has now recurred in **ta, en, am and zu** — a missing
parenthetical is expected reader behaviour, not a fact about the language.

### What shipped, and three judgements inside it

- **am** — new rule, `+` → `ፕላስ` (reads `pɨlas`). DROP 2 → 0.
- **xh** — `dibanisa` → `plas`. ⚠ This CORRECTS a correctly-sourced word: `dibanisa` is the HSRC English/isiXhosa
  maths dictionary's ADDITION OPERATOR, a right gloss of the symbol and the wrong register for a reader.
  ⚠ And it UPGRADES an honest limit: xh left `+30 °C` unread partly because "Xhosa has no attested positivity
  word". The word is now known, so absence is no longer the argument — what survives is the redundancy with the
  sentence's own *angaphezulu* ("above"), and the recordings confirm it, since both Montevideo speakers produce
  no plus phones while all three UTC speakers do. Same language, same sign, two positions, distinction made by
  the readers. DROP 2 → 2 (a word swap; the residual is that deliberately-silent sentence).
- **zu** — ` no-` → `plas`. ` no-` was inferred from the sense of `(UTC+1)` while the rule's own comment said a
  bare positive sign was left under-specified "rather than guessing a borrowing". It did not need guessing.
  DROP 3 → 2. ⚠ zu's temperature position is NOT decided: its one Montevideo file decodes as
  `p l a s o m aɪ n a s`, so plus phones are present unlike xh's two speakers, but one noisy file is not a
  source and no separate temperature arm was invented.
- ⚠ Spelled `plas`, not `plus`, in xh/zu: the attested vowel is [a] and both orthographies are phonemic, so
  `plus` would read `pʼlˈuːs`. **The conventional loan spelling in isiXhosa/isiZulu is UNSOURCED** — this
  spelling is chosen to reproduce the attested phones, which is what this layer exists to feed.

### Where this leaves the class

Sourced from audio and shipped: **ta, hi, vi, am, xh, zu** (plus), **ar, ja** (`×`), **pt** (currency), with
**en** measured and deliberately unchanged. Still unreachable: **th** (Cohere cannot do the language; Whisper
re-orthographizes; MMS emits the sign — the phoneme model was not run on it) and the twelve languages with no
locally cached audio at all (gu kn ml ne sr sw mi yue te fa nb my), which need a FLEURS download.

## Run 8 — 2026-08-03 — `p l a s o m aɪ n a s` is not Zulu, it is `-+`

Run 7 filed zu's Montevideo decode — `…kuka p l a s o m aɪ n a s v e d i…` — as "plus phones present but the
decode is noisy". That was lazy. Read as words it is plainly "plus or minus", which is semantically incoherent
for *angaphezu* ("above") — and the explanation is in the SOURCE TEXT, not the audio:

```
zu:  amazinga okushisa angaphezu kuka-+30°C avamile.     ← hyphen IMMEDIATELY followed by the sign
xh:  amaqondo angaphezulu kwe +30°C aqhelekile.          ← space before the sign
```

`kuka-` is Zulu's bound-prefix hyphen, so the text carries **`-+`, two adjacent marks, and the reader voiced
BOTH**. The decode is therefore accurate, not noisy — a faithful reading of a two-character sequence. And the
xh/zu divergence Run 7 attributed to *language* is really a difference in the source orthography: same sign,
same sentence, different neighbouring character, different reading.

⚠ **So there is no zu evidence about a plain `+` before a temperature.** The one recording speaks to `-+`.

### And the `-+` broke our normalizer too

Probing it surfaced a live defect that the Run 7 numbers had hidden (zu's DROP went 3 → 2, not 3 → 1):

```
+30°C     → amazinga angu-30      the plus SILENTLY GONE
kuka-+30  → kuka- plas 30         without °C, the plus rule fires fine
```

zu's degree pattern opened with `[+]?` — matching the sign and never re-emitting it. Harmless while zu had no
sourced plus word; once `plas` was sourced it HID one. And the sign could not reach the sign step regardless:
after the degree rewrite the text reads `+amazinga…`, and that step requires a digit after the sign.

Fixed by the ordering coupling the playbook records — **claim the sign before the rule that consumes its
operand**: a plus arm at step 8c, before degrees, and `[+]?` removed from both degree patterns so a form the
arm misses cannot be quietly eaten there either. `+30°C` now reads `plas amazinga angu-30`; the corpus sentence
reads `kuka- plas 30` (the degree noun still suppressed by the existing trap-12 rule, since *amazinga* precedes).

Corpus diff zu **DROP 3 → 1**, 3 utterances changed, all three accounted for:

| line | change |
|---|---|
| 428 | **IPA byte-identical** — only the `⟪DROP:minus⟫` annotation vanished. That is Run 2's guard fix landing on a real utterance: `ngo-26 -00` is a score, not a minus. |
| 947 | `nˈɔː kʼˈuːɲɛ` → `pʼlˈaːs kʼˈuːɲɛ` — the offset word |
| 1437 | the plus now read; `⟪DROP:math-sign⟫` gone |

The lesson worth keeping: **an odd decode is a question about the TEXT before it is a fact about the language.**
"Noisy" was the wrong verdict; the corpus had a two-character sequence in it, and both the reader and the
normalizer stumbled on the same thing.

## Run 9 — 2026-08-03 — th, the last language with cached audio. `บวก`.

Thai was the one language where every prior tier had failed, each in a different way — which makes it the
cleanest demonstration of why the phoneme recognizer is the right instrument:

| tier | outcome on Thai |
|---|---|
| `concept.ts` (Wikidata label) | returns the BARE CHARACTER `+` as Thai's own label for "plus sign" |
| `attest.ts` on `ลบ` | the ADJECTIVE "negative" (`การป้อนกลับทางลบ`, negative feedback) — not the operator |
| `attest.ts` on `คูณ`, `บวก` | zero hits in the wiki haystack |
| Cohere-transcribe | renders Thai audio as VIETNAMESE-looking nonsense |
| Whisper large-v3-turbo | accurate Thai, but RE-ORTHOGRAPHIZES: `UTC + 1`, `11.00 น.` |
| MMS-1b-all (tha) | accurate, and also emits the sign: `utc.1` |

`facebook/wav2vec2-xlsr-53-espeak-cv-ft`, whose 392-token vocabulary contains no `+`, both th_th speakers:

```
… t ɔ ŋ k i5 n   j uː t iː s i5   b ʊ k   l i5 ŋ   t i5 w aɪ h ɑu5 s …
… t ɑu5 ŋ t i5 n  j u5 t i5 s i5  b ʊ k   n ŋ     t i5 w aɪ t h ɑu5 s …
```

`j uː t iː s i5` = ยูทีซี · **`b ʊ k` = บวก** · `n ŋ` / `l i5 ŋ` = หนึ่ง → "UTC บวก หนึ่ง", **2 of 2**.

No new lexical data was needed: the engine already reads บวก as `bˈua˨˩k` and หนึ่ง as `nˈɯ˨˩ŋ`, matching the
decode. Shipped at step 8b, BEFORE the degree rule — the ordering coupling zu's `[+]?` taught, insurance here
since Thai's degree rule does not match the sign today.

⚠ `+30 °C` has ZERO instances in th_th — this corpus does not carry the Montevideo sentence, unlike most of the
fleet — so that arm is the arbitrary-text case #584 argues for, not an attested one.

Corpus diff th **DROP 4 → 2**, 2 utterances changed, both accounted for:

| line | change |
|---|---|
| 484 | **IPA byte-identical** — only `⟪DROP:minus⟫` vanished: the guard fix on the range `ค.ศ. 1000 -1300` |
| 1517 | the UTC sentence now reads บวก; `⟪DROP:math-sign⟫` gone |

th's remaining 2: the `×` of the manuscript sentence (`29¾ นิ้ว × 24½ นิ้ว`) — which sits in th's **test** split,
whose audio this corpus does not carry, so it is unsourced and no rule was invented (`คูณ` is ×0 in the wiki) —
and the `B&B` ampersand.

## Where the class stands after nine runs

**Sourced from audio and shipped:** ta, hi, vi, am, xh, zu, th (plus) · ar, ja (`×`) · pt (currency).
**Measured and deliberately unchanged:** en — the convention is confirmed, and the TTS policy says voice the
written sign, so its existing unconditional `plus` is correct.
**Still unreachable:** the twelve languages with no locally cached audio — gu kn ml ne sr sw mi yue te fa nb my
— which need a FLEURS download; and th's `×`, ar's second `×`, and or/pa's `¥`, all in uncached splits or absent.

## Run 10 — 2026-08-03 — closing the class: hi's true negative, and the final residuals

### ⚠ A measurement bug in my own probe, caught before it was reported

The closing re-measurement used `persym.ts`, which HARD-CODES its own copy of the `minus` regex — the
pre-fix one. Its `-(neg)` column therefore showed 15 hits and looked like a regression of Run 2. It is not a
regression; it is the same trap that bit `minus.ts` at the start of this investigation, and for the same
reason. **A probe that copies a pattern instead of importing it measures the past.** The `+`/`×` columns use
plain `\+`/`×` and were valid.

### hi's `-२.८८ परिमाण` — the fleet's only true negative, fixed

It read *do dashamlav aath aath*, positive. The existing degree arm could not reach it: that arm requires a
DEGREE word after the number, and परिमाण ("magnitude") is not one. Adding परिमाण to the lookahead would fix one
sentence and teach nothing, so the general property was used instead:

**A MINUS BEFORE A DECIMAL.** Every false positive this class suffers is an INTEGER — designation
(`चंद्रयान -1`, `फ़ॉर्मूला-1`), score, year range (`२०१७ -१७`) — and none of those is ever written with a
fractional part.

⚠ The single counterexample is the one hi's own file already documents: `कोच (३१,३८१ -९८.५३% हिंदू)`, where the
dash INTRODUCES the percentage and is a decimal. It is excluded because a digit precedes the dash, so the range
guard is repeated on this arm rather than trusted to the class above. Verified both ways: `-२.८८ परिमाण` now
reads ऋण, `-९८.५३%` stays silent.

Inert on the FLEURS corpus — that sentence comes from hi's wiki hybrid fill, so `hi` corpus diff stays DROP 1→1
(its 2 changed utterances are the plus work from Run 3). The effect shows in the artifact measurement.

### Final state of both classes

**minus: 9 → 8 hits, and ZERO are true negatives.** All eight have named causes:

| residual | cause | decidable here? |
|---|---|---|
| gu `એચજેઆર -3`, hi/mr/ta `चंद्रयान -1` | designation | ✗ needs a lexicon — `word␣-␣digit` is also a real minus |
| el `–12 χιλιόμετρα … Ριπ–`, my `(Koreans -၂သန်း)` | apposition dash | ✗ |
| hi `पू.-1200` | range past the tight window | ✗ by design — widening it swallowed hi's true negative |
| xh `kangange -40 mph` | Bantu hyphen prefix + intruding space | ✗ |

**math-sign / plus:** shipped from audio in ta, hi, vi, am, xh, zu, th; `×` in ar, ja; en measured and
correctly unchanged. Remaining `+` drops are the twelve languages with **no locally cached audio**
(fa gu kn mi ml my nb ne sr sw te yue) plus xh's deliberate, now-sourced silence. Remaining `×`: hu (ASCII
`6 x 6`, no FLEURS corpus so no aligned audio) and th (test split, uncached).

**So the class is closed to the limit of the available evidence**, and what remains is a data-acquisition
task (a FLEURS download) or genuinely undecidable without a lexicon — not an unexamined gap.

## Run 11 — 2026-08-03 — can the 2 kbps codec substitute for the audio? Tested, and the answer is "for one question only"

The corpus ships Higgs-Audio-v2 codec tokens (`corpus/tokens/codes_<lang>.npz`, 7–12 MB per language against
~1.6 GB of audio), so the obvious economy is to keep the codes and drop the tarballs. Measured from the npz
shapes the bitrate is **8 quantizers × 25 Hz × 10 bits = 2.0 kbps** at 24 kHz native, which is deep in
"intelligible but not faithful" territory — so it needed a test rather than a decision.

⚠ The reconstruction path is REAL and already in the tree: `higgs_decoder.onnx` (86 MB) plus
`ingest_fleurs.py`'s own `validate_roundtrip`. No torch needed. Worth checking before assuming, because a
tokenizer with no decoder would have made the whole idea moot.

**The test that matters is the one with ground truth.** hi's four `+` utterances were already decoded from REAL
audio in Run 3 — two where the plus is spoken, two where it is silent — so the round trip can be graded rather
than admired: decode from codes, resample 24 k → 16 k, re-run the phoneme recognizer.

| utterance | real audio | reconstructed | |
|---|---|---|---|
| UTC (1) | `j u d i s i p l a s e k` | `j u d i s i p l a s e k` | ✓ identical |
| UTC (2) | `j uː d i s iː p l e s w a n` | `j uː d iː s s t iː p l a s w ɔ l` | ✓ `p l a s` survives |
| temp (1) | `m e t iː s d e ɡ r i s …` no plus | `m e d iː s d e ɡ r i s …` no plus | ✓ silence preserved |
| temp (2) | `m e d iː z l i ɡ l …` no plus | `m e d iː z l i ɡ l i …` no plus | ✓ silence preserved |

**4 of 4 survive**, log-mel spectral distance 3.04–3.19 dB, durations frame-exact.

### ⚠ But the degradation lands exactly where this session made a decision

```
real  p l e s w a n     →  recon  p l a s w ɔ l      the VOWEL moved [e] → [a]
real  … e k  p a r …    →  recon  … e k  b a r …     voicing flipped p → b
```

The `plas` vs `plus` spelling shipped for xh and zu rests on **the attested vowel being [a]** — and this round
trip can manufacture exactly that shift. So:

- ✓ **presence or absence of a word in a slot** — survives 2 kbps
- ✗ **fine phonetic judgement** (vowel quality, voicing) — does NOT, and that is what an orthography choice
  rests on

### Conclusion

**Do not transcode-and-delete.** Prune to the EXTRACTED utterances instead: every language treated this session
needed 2–5 wavs, 2–5 MB total — *smaller* than the 7–12 MB npz and lossless, because the question never needs
ten hours of speech. Deletion is safe because `tools/corpus/fetch-fleurs-audio.py` resumes and skips
size-matched files, so a re-fetch is ~3 minutes at 8 MB/s.

What the test does buy: the npz set is a **validated fallback**. If a tarball is gone and the question is the
yes/no kind, the codes answer it. That is worth knowing and was not knowable without measuring — but it is a
safety net, not the primary source, and any sourcing done from reconstructed audio must say so.
