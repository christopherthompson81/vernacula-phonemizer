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

### Conclusion — and ⚠ THE STORAGE QUESTION IS SETTLED SEPARATELY: KEEP ALL THE AUDIO

The finding here is about EVIDENCE, not about disk. Reconstruction answers "is there a word in this slot" and
must not be used to answer "which word" — any sourcing done from reconstructed audio has to say so.

⚠ **The full audio is retained deliberately, and pruning it would be wrong.** This investigation only ever
needed 2–5 utterances per language, and an earlier draft of this section concluded from that "prune to the
extracted utterances". That reasoning was scoped to sign-sourcing and is too narrow: the corpus audio is also
the material for FINE-TUNING work, which wants the whole distribution — every speaker, every utterance,
lossless. A conclusion drawn from one consumer's needs should not become the archive's policy. All 58 GiB stays
(182 G free on the volume, so there is no pressure forcing the question).

That leaves the codec test with exactly one use, which is still worth having: the npz set is a **validated
fallback** for a yes/no question if a tarball is ever missing. It is not a substitute for the audio and not a
storage strategy.

## Run 12 — 2026-08-04 09:xx — the re-sweep after vulgar fractions: 15 cells → 6, and the PHANTOM SYMBOL class

Re-measured #586 from scratch rather than trusting the running tally. `npx tsx tools/normalization/coverage.ts`
reported **15 defective cells across 12 of 37 treated languages**, which split cleanly into six the user had
already ruled out of scope (five designations — `चंद्रयान -1` in hi/mr/ta, `એચજેઆર -3` in gu, and kn's is the
same HJR-3 sentence — plus el's documented apposition dash) and **nine actionable**.

### What the nine actually were, and four of them were recurrences

| lang | cell | mechanism |
|---|---|---|
| id | degree | **NOT A DEGREE.** `Ä°zmir` is mojibake for `İzmir` |
| id | currency | `US$ 14,7` — the initialism defect, third occurrence after pt and nl |
| it | exponent | `2,2 milioni di km²` — a magnitude between number and unit |
| it | arithmetic | `volo+hotel` — a plus joining WORDS |
| or | arithmetic | `(UTC+1)` |
| bn, or | currency | `¥` |
| fa, ja | ampersand | `B&B` |

### ⚠ THE PHANTOM SYMBOL — the finding worth keeping from this run

Two of the nine were not defects at all. Latin-1 punctuation doubles as a UTF-8 continuation byte, so
half-repaired mojibake **manufactures a symbol** for a later pass to reason about:

```
Ä°zmir   = Ä + °   →  a DEGREE SIGN in a sentence about a city's population
SÃ£o     = Ã + £   →  a POUND SIGN in a Brazilian place name
```

Both were being chased as per-language defects. This is the same trap `repairDoubleEncoded`'s header already
recorded for mr's `â€` stranding a `€` that `\p{Sc}` read as a phantom currency — **the third instance of one
pattern**, which is what promotes it from an anecdote to a class: mojibake does not merely fail to read, it
INVENTS symbols, and the invented ones look exactly like the real ones the gates hunt for.

`repairDoubleEncoded` covered lead bytes C2, C3 and E2. `İ` is `C4 B0`, outside all three. Replaced the two
special-cased two-byte arms with the UTF-8 formula `cp = ((lead & 0x1f) << 6) | (b2 & 0x3f)`, which subsumes
what they said (for C2 it returns b2 — "drop the Â"; for C3, b2 + 0x40) and extends to C4/C5.

Bounded by measurement on the file's own standard: `[C4C5]` + a continuation byte occurs **twice across all 67
corpora, both `Ä°` in id_id**, and `[C6-CF]` occurs **zero** times, so stopping at C5 costs nothing.

⚠ **The first version of the fix silently did nothing.** The function's early-out guard was `[ÂÃâ]`, so
`Ä°zmir` returned before reaching the widened arm. Caught only because the probe printed the input unchanged.
*A fast path is part of a pattern's definition; widening one without the other is a no-op that typechecks.*

### The gates were measuring a string the engine never reads

Consequence of the above, and the more general fix: both `coverage.ts` and `corpus-diff.ts` scanned RAW corpus
text, while the engine applies `repairDoubleEncoded` to every input before any language rule runs. So the gates
were hunting symbols in text the engine never sees — reporting an **un-closable** DROP on `São Paulo`, because
the differential test is unreliable on corrupt input (blanking a phantom leaves a byte-identical reading, which
scores as a drop). Both now repair at ingestion.

⚠ **The ruler must be the same on both sides of a before/after; only the ENGINE should differ.** Verifying this
meant copying the updated `corpus-diff.ts` into the pinned baseline worktree — using the old instrument for
"before" and the new one for "after" would have conflated a tooling change with an engine change. With
consistent ingestion, id went `DROP 2 → 0`; with mixed ingestion it had falsely read `3 → 1`.

### Audio, and one thing the phones settled that MMS would have got backwards

Six cells needed a WORD, so the fourth sourcing tier again. All six languages' audio was already local
(121 GiB at `corpus/audio_cache`). Nine clips, 2–3 speakers where available.

- **it `volo+hotel`** — MMS-1b-all (`ita`): `pacchetti combinati vol o più hotel`. The reader says *più*, the
  arithmetic word, for a `+` that is not arithmetic. Directly attested.
- **fa `B&B`** — wav2vec2, **both** speakers: `b iː a n b iː` / `b i a n d b iː` = *bī and bī*, the ENGLISH
  word. ⚠ **MMS alone would have scored this a DROP**: it omits the span for speaker A and renders it
  `هاب بینبی` for B, floated to the head of the sentence looking like a false start. The phones show it is
  neither. Second time this session that the two instruments disagreed and the phone recogniser was right for
  "what is said" while MMS was right for "which word".
- **ja `B&B`** — `b iː a n d ə b iː`. **The epenthetic vowel is the proof**: Japanese cannot close a syllable
  in /d/, so a borrowed "and" must surface as /a.n.do/. That `ə` is the language's own phonotactics stamped on
  the English word, which is exactly what アンド spells. A bare English "and" would decode without it.
- **bn, or `¥`** — both bn speakers and the or speaker voice **no currency word at all**
  (`d a m d u a z ɛ r p a ʃ o t e k`; `s a t o h z e r h e b a`). Voiced anyway, per the standing TTS policy:
  an explicitly typed character is content, and a speaker's omission is evidence about reading habit. The audio
  bounds what it can — it proves no OTHER word competes for the slot. The words themselves (`ইয়েন`, `ୟେନ`) are
  ordinary lexis and are marked as such, not credited to the corpus.
- **or `(UTC+1)`** — ⚠ **the weakest-sourced cell in the whole sweep, and labelled so in the code.** Both or
  speakers skip the entire parenthetical (`11:00 ଘ ରେ`, `11:0t ରେ`) — the parenthetical-skip pattern already
  seen in ta/en/am/zu/mi/ne/sr/sw/yue/te, never counted against a word. So no attestation exists and the rule
  ships on **typology**: the six Indic languages whose plus WAS resolved from audio this sweep all borrow, with
  no native-word counterexample (hi प्लस, ne प्लस, te ప్లస్, gu પ્લસ, kn ಪ್ಲಸ್, ml പ്ലസ്, ta பிளஸ்). Seven
  recordings across four scripts is a strong prior, and ଯୋଗ — the native noun "addition" — is the exact shape
  those recordings ruled out elsewhere (hi's first draft used धन and audio corrected it).

### Two errors of my own, both caught by re-reading the output rather than the differential

1. **The `US$` fold turned a silent DROP into an audible word-order error.** Unfolding let id's tier place the
   currency noun, and it placed it wrong: *empat belas koma tujuh DOLAR MILIAR* instead of *…miliar dolar*,
   because without a `magnitudes` list the magnitude is not part of the quantity. ⚠ *Closing a drop is not
   finished when the differential changes — only when the READING is checked.*
2. **it's `magnitudes` was withheld for one consumer and broke another.** The list was deliberately absent so
   the CURRENCY path could not emit `5 milioni dollari` without the partitive — but `magnitudes` also gates
   `magAltU`, the UNIT path's connective hop, so withholding it left the tier unable to cross `milioni di` and
   `2,2 milioni di km²` read as *…milioni di KM*: exponent dropped AND unit noun raw in the IPA. One field, two
   consumers, only one of which had the problem. Safe to declare because normalize.ts step 10 runs first and
   consumes the whole preposed currency shape; measured, the corpus has exactly one currency-sign sentence,
   postposed, and zero sentences pairing a sign with *milioni*/*miliardi*.

### A cell can hide behind itself

`or`'s `£27 ନିୟୁତ` — a transfer fee reading *satāisa niyuta deya*, currency gone — only appeared **after** the
`¥` was fixed, because the coverage audit reports the FIRST defective instance per cell. Same for id. *A cell
is not done when a fix lands; it is done when the cell re-scans clean.*

### Repairing an input exposes the rules that were never exercised on it

`id`'s coordinate degree had no rule, and could not have been noticed: the corpus writes `di timur 35Â°W`, so
the sign was half of a broken `°` and the bare `(\d)\s?°` arm never saw it. Mending the mojibake put `35°W` in
front of that arm, which produced `tiga puluh lima derajatW` — the direction letter glued raw into the IPA.
Fixed with a compass map mirroring it's. *A mojibake fix must be followed by a re-read of the sentences it
unmasks, because those sentences are reaching their language's rules for the first time.*

### Result

**15 defective cells → 6**, and all six remaining are the out-of-scope class (five designations + el's
apposition dash). **Zero actionable defects remain in the 37 treated languages.**

Gates: tsc clean; **202 test files, 2901 tests** (10 added, including a new `test/unicode-mojibake.test.ts` for
the phantom-symbol class); corpus diffs on all six changed languages read in full —

| lang | changed | DROP before → after |
|---|---|---|
| id | 5/1936 | 2 → 0 |
| it | 2/1978 | 2 → 0 |
| bn | 1/1981 | 1 → 0 |
| or | 3/1327 | 3 → 0 |
| fa | 1/1856 | 1 → 0 |
| ja | 1/1788 | 1 → 0 |

No DIGIT, SLOT-GAP, RAWMARK or THROW introduced anywhere.

### ⚠ ADJACENT DEFECT FOUND, DELIBERATELY NOT FIXED HERE — id's tokenizer is ASCII-only

Reading the id diff surfaced a real defect in a different class. `id`'s `TOKEN` is `([a-zA-Z]+)`, so **every
accented Latin letter fragments the word** and each fragment is read as an English letter name:

```
São Paulo  →  s ˈə ˈo paˈulo          Cañitas  →  t͡ʃˈa ˈɛn ˈitas
Klöcker    →  ʔl ˈoᶷ t͡ʃkˈər           İzmir    →  ˈaᶦ zmˈir      (Izmir → ˈizmir, correctly)
```

Not a #586 cell and invisible to both gates — the output has no digits and no raw marks, so it is a WRONG-WORD
defect, not a leak or a drop. It is pre-existing; the mojibake repair only changed which wrong reading appears
(`ˈə zmˈir` → `ˈaᶦ zmˈir`) while making the underlying text correct.

**yue already solved this exact problem** — `test/cantonese.test.ts` pins "accented Latin stays one run for the
foreign phonemizer (×9)". That is the model for id, and the pointer for whoever picks this up. Left out of scope
because it needs its own measurement across every ASCII-tokenizer language, not a patch smuggled into a
symbol-inventory sweep.

## Run 13 — 2026-08-04 — el was MISCLASSIFIED: not a negative, a missing PAUSE

Asked whether all six residual cells were the designation/ambiguous-negative class. Five are. **el was not**,
and checking rather than assuming turned it into a fix.

el's cell was reported as `signed-number DROP` on `Ο ναός Πνομ Κρομ –12 χιλιόμετρα … Σιέμ Ριπ– που …`. It is an
**apposition bracketed by dashes**, the Greek equivalent of commas or parentheses, and BOTH dashes were being
dropped silently — so the aside ran into its host clause with no break:

```
was  … pnom kɾom   ðeka ðio çiʎometɾa … sçem ɾip   pu vɾiscete …
now  … pnom kɾom , ðeka ðio çiʎometɾa … sçem ɾip , pu vɾiscete …
```

**The missing thing was a PHRASE BREAK, not a word.** No amount of hunting for a minus vocabulary could ever
have closed it, which is why it sat in the residual for the whole sweep — it had been filed under the class that
has no fix.

### The corpus separates the two uses BY CHARACTER, with no overlap

| shape | count | what it is |
|---|---|---|
| ASCII hyphen `-` before a digit | **29** | every one a range or designation — `3-5%`, `1469-1539`, `56-64 χιλιόμετρα/ώρα`, `7:00-8:00`, `26 - 00`, `COVID-19`, `Chandrayaan-1` |
| EN DASH `–` before a digit | **1** | the apposition above |
| EM DASH `—` before a digit | **0** | |

So el contains **zero true negatives**, and its en/em dash is never arithmetic. That is what makes keying on the
dash CHARACTER safe here — a fact about this language's typography, not a fleet default.

⚠ **One instance proves the whitespace guard is needed.** Of the 21 en/em dashes, 20 are appositional with a
space on at least one side; the twenty-first is `Apollo–Soyuz` (left in Latin script), an en dash used as a
COMPOUND JOINER, with no space on either side. A pause there would be wrong. 20/20 against 1/1 — and the corpus
diff confirmed it, changing exactly 12 of the 13 dash-bearing sentences and leaving Apollo–Soyuz alone.

⚠ **My first draft of the comment said `Απόλλο–Σογιούζ`.** The corpus writes it in LATIN. Caught by grepping for
the actual unchanged instance instead of trusting what I had just written about it.

### An asymmetry found by probing past the fix

While checking the dash rule against every shape, `θερμοκρασία -5 βαθμοί` read as plain *pende*. el voices `+`
as συν (step 11, from a single `(UTC +1)`) and had **no minus word at all**. Added μείον, reusing the guard
`defects.ts` arrived at after resolving all 66 artifacts by hand rather than reinventing it.
Labelled **robustness, not a measured repair**, and said so in the code: with zero true negatives in el_gr no
gate can see it and its corpus diff is empty by construction. Worth having anyway, because a `-5` that reads
exactly like `5` is the silent content loss #586 exists to remove, and the plus/minus asymmetry inside one file
is indefensible on its own terms.

### Result

**6 defective cells → 5**, and the residual is now HOMOGENEOUS: two universal sentences (`चंद्रयान -1`,
`એચજેઆર -3`) across the five languages that write a space before the hyphen — hi, mr, ta, gu, kn. All are
designations whose hyphen is correctly silent; the readings are already right, and the DROP differential simply
cannot distinguish a spaced designation hyphen from a minus. Accepted as the limitless lexical problem.

Gates: tsc clean; 202 files / 2902 tests; el diff 12/1969, DROP 1 → 0, no DIGIT/SLOT-GAP/RAWMARK/THROW.

⚠ **The lesson worth keeping is about the residual itself.** A defect parked under a class that has no fix stops
being re-examined. el sat there for the whole sweep because the label said "ambiguous negative", and one question
about whether the label was right turned it into a twelve-sentence improvement. Re-derive the classification of
anything in a permanent-residual list before treating the list as closed.

## Run 14 — 2026-08-04 — the ten artifact-side cells: 10 → 2, and the residual is ONE fleet-wide gap

Worked the ten cells the widened audit surfaced. Diagnosed each against the actual matched character before
touching anything, which was necessary: **the labels were wrong on four of them**.

| cell | label said | what it actually was | outcome |
|---|---|---|---|
| hi currency | currency | **`¢`**, a CENT SIGN — not the `°` in the shown prefix | declared `सेंट` |
| hi signed-number | minus | era RANGE `600 ई. पू.-1200 ई.` | accepted |
| hi exponent | exponent | bare `२०²` | **open — fleet-wide gap** |
| mi arithmetic | arithmetic | attested plus the engine cannot pronounce | accepted |
| my signed-number | minus | apposition `(Koreans -၂သန်း)` | accepted |
| my arithmetic | arithmetic | compound joiner `အချိန်+ရပ်ဝန်းထု` … **and `အာဆီယံ +၃`** | fixed + accepted |
| my exponent | exponent | `E = mc²` — **English text**, and English's gap | **open — same gap** |
| my iteration | iteration | wikitable markup + a bare `ゝ` | markup fixed, mark accepted |
| xh signed-number | minus | stray hyphen `kangange -40 mph` | accepted |
| xh arithmetic | arithmetic | `+30°C`, suppressed on purpose | **fixed on policy** |

### ⚠ xh's silence was SOURCED and was reversed anyway — the policy decides, not the recording

xh's `+30°C` was deliberately silent, and the reasoning was good: both xh_za speakers of the Montevideo
sentence produce no plus phones in the TEMPERATURE position while all three of the UTC sentence do — the
"same sign, two readings in one language" rule. The file called the residual DROP "permissible".

That evidence is unchanged and still correct. What overrides it is the standing rule: **for TTS an explicitly
typed character is CONTENT, and a speaker's omission is evidence about reading habit, not licence to delete.**
The identical case was already decided on hi — hi's `+30 °C` silence was shipped on 2-of-2 omission and then
reverted to voicing under this rule — and xh was simply never brought along. Measured: `hi`, `zu`, `te` and `sw`
all read this sign and **xh alone did not**, with zu being xh's closest relative and the language where the plus
rule was moved ahead of degrees for exactly this reason. A sourced finding can be correct and still not decide
the question; the policy is a separate layer, and consistency across the fleet is evidence that it was applied.

### `my`'s plus: the both-sides guard was too tight by exactly two instances

my already read `+` between digits as `အပေါင်း`, and its comment correctly argues that a LETTER-flanked plus is
a compound joiner (`အချိန်+ရပ်ဝန်းထု` = *spacetime*) and stays silent — genuinely different from Italian's
`volo+hotel`, a coordination whose reader was recorded saying *più*. Same glyph, different function.

But the guard was "digits on BOTH sides", which also excluded the two cases where the sign is a word:
`အာဆီယံ +၃` — **ASEAN Plus Three**, where the plus is part of the organisation's NAME — and `(+⅔)`, a
positivity marker on a fraction. A digit AFTER is the discriminator, and every compound has a letter on both
sides, so it separates them with no overlap.

⚠ **The etymology plus was left unimplemented, and its reading is attested.** `(gêeo = Earth) + (graphein = to
write)` is a third construction, and the artifact **glosses the symbol in its own text** — `နိ+ ဝါန =နိ နှင့် ဝါန`
("ni+vāna = ni AND vāna") — so an etymological `+` is `နှင့်`, not `အပေါင်း`. Three instances, all inside a
bracket-gloss shape narrow enough that a rule would be fitted to the article rather than to the language.
Recorded rather than shipped.

### Markup was being SPOKEN, which is worse than a drop

my's `iteration` evidence is two wikitable rows, and `stripMarkup` handles HTML but not wikitable syntax, so
`|bgcolor="#F3F5DE"| ゝ …` read as *bɡkˈʌlɚ ɲi˨m̥ja˥ˀ ˈɛf θoʊɴ ˈɛf ŋa dˈiː* — "bgcolor equals F 3 F 5 D E", a
style attribute recited one hex digit at a time. That is the inverse of the dropped-sign problem: **audible
garbage**, and strictly worse, because silence can at least be mistaken for a reading choice.

Fixed in `stripMarkup`, on the philosophy its own header states ("a phonemizer handed `<i>` should render it,
not read it"). ⚠ **The `!` header arms were written and then removed** — wikitables mark headers with `!` and
`!!`, so both belong to the syntax, but measured across all 67 corpora AND all 67 artifacts they occur **zero
times**, while `!` is ordinary sentence punctuation everywhere. Zero value against a real cost (`Wow!! Amazing`
would lose its clause break). Only the `|` shapes ship. Verified byte-identical on en, lb (`&apos;` ×192) and
ms (`<i>` tags) — the three most markup-prone corpora.

And the mark itself: **a bare iteration mark has nothing to repeat**, so silence is the only correct output.
Routed to Japanese it still reads empty, because `ja` also has no antecedent. Those two rows are also my's ENTIRE
`iteration` evidence and they describe JAPANESE kana in a Burmese article — `ゝ`/`ゞ` are not Burmese orthography.

### The residual is ONE gap in two languages, and it is fleet-wide

Both remaining cells are a **bare-number exponent**: hi's `२०²` and my's `E = mc²` (the latter inside an
embedded ENGLISH run, so it is English's gap). Measured — **every language drops it**:

```
en 20² → twˈɛnti     de 20² → t͡svˈant͡sɪç   fr 20² → vˈɛ̃      it 20² → vˈenti
es 20² → bˈeᶦnte     hi 20² → bˈiːs        pt 20² → vˈĩtɨ     ru 20² → dvˈat͡sətʲ
```

The exponent machinery is **unit-only** across the whole fleet, and the bare form needs a DIFFERENT word from
the unit modifier — English wants "squared", not the "square" of *square kilometres*, and Italian needs a
connective (*venti al quadrato*). English does not even use the shared `exponentWords`; it handles `km²`
locally. So closing this needs a new tier field plus sourced words for 67 languages, which is its own pass.
Left OPEN and visible rather than mislabelled accepted — these two are not correct-as-is.

⚠ **hi's two cells are probably the same corrupt sentence.** `२०² या १०²` and `२०¢ या १०¢` are the same Vernier
sentence in two artifact copies with a different character in the slot, which is the signature of an OCR or
encoding corruption of `″` (arc-seconds — a Vernier scale reads those, not money and not squares). Neither `¢`
nor `²` is what the author wrote. `¢` was declared anyway, because the engine's job is to read the character it
is given, and that caveat is in the code.

### The accepted baseline generalised to any class, and immediately proved itself

`ACCEPTED_SILENT` was minus-only; it is now keyed `lang → class → literal strings`. Adding my's compound
plus **immediately surfaced a new instance** — `အာဆီယံ +၃`, which the accept correctly did NOT cover because it
names strings and not shapes. That is the property working in the wild rather than only in a test.

### Result

**10 defective cells → 2.** 12 accepted across 7 languages, every one printed with its reason. Gates: tsc clean;
**204 files / 2914 tests**; corpus diffs xh 1/1509 (DROP 2→1, the single change read), hi 0/1702, and en / lb / ms
byte-identical.

## Run 15 — 2026-08-04 — arbitrary exponent reading: the audit reaches 0/67

Implemented the bare-exponent reading the last run identified as the residual, and the audit is now **0
defective cells across 0/67 treated languages**.

### The 4+ reading: CARDINAL, not ordinal

Asked for a suggestion on the reading for powers above 3. Shipped **"to the power of N"** rather than
**"to the Nth power"**, and the argument is cross-linguistic rather than stylistic:

- the ordinal form needs the EXPONENT'S ORDINAL in every language, and several inflect it for gender and case
  — the Icelandic, Czech and Serbian runs each had to build ordinal tables, and the exponent would then need
  its own agreement rules
- the cardinal reuses the number path that already exists in every engine, and needs exactly ONE connective
  phrase per language

"to the fifth power" is the more idiomatic English of the two; it is not worth 67 languages of ordinal
morphology, and the cardinal is unambiguous. `{e}` is emitted as DIGITS so each language's own number path
speaks it.

### Why it could not reuse `exponentWords`

That field holds the UNIT MODIFIER, and in most languages the modifier and the predicate are different words:

| | unit modifier | bare predicate |
|---|---|---|
| en | *square* kilometres | twenty *squared* |
| it | chilometri *quadrati* | venti *al quadrato* |
| hi | *वर्ग* किलोमीटर | बीस *का वर्ग* |
| de | *Quadrat*kilometer | zwanzig *zum Quadrat* |

Reusing it would have produced "twenty square". So `bareExponent` is a new field, and it takes TEMPLATES
(`{n}` base, `{e}` exponent) rather than words, because the connective and the word order are language data —
`{n} al quadrato`, `{n}の{e}乗`, `{n} की घात {e}`. No arrangement of fixed fields expresses all three.

### Two mechanisms, because English does not use the shared tier

English has no `makeSymbolNormalizer` call at all — it handles `km²` in its own normalize.ts — so it needed a
local twin of the rule. Worth knowing before assuming a tier field reaches the whole fleet.

⚠ **Ordering is load-bearing in both.** The bare rule runs AFTER the unit path. Matching first would claim
every `km²` and read it "kilometre squared" instead of "square kilometres" — so by the time control reaches the
bare rule, a surviving superscript provably has no unit to modify, which is the condition the rule wants.

### The base may be LETTERS, and a superscript now travels with a foreign run

`E = mc²` was the case that exposed the gap, and it needed a second fix. `²` is `No`, not `\p{L}`, so
`FOREIGN_RUN` ended at `mc` and left the exponent in the gap to be dropped — my's artifact quotes the formula
and routes the Latin to English, which never saw the `²`. Including a TRAILING superscript in the run fixes it
for every host at once: **the fix is to stop cutting the expression in half, not to invent a Burmese reading
for an English formula.** Only trailing, and only superscript digits — a superscript cannot begin a word, so
this can neither start a run that would not otherwise exist nor swallow a host character.

### Provenance, stated because it is weaker than most data here

Ten languages declared: en, de, fr, es, it, pt, ru, ja, cmn, hi. These are **standard mathematical register,
not corpus attestations**, and the sourcing attempt is worth recording because it FAILED informatively:

```
hi घात:0   ru степени:0   de Potenz:0   it potenza:0   ko 제곱:0   vi lũy thừa:0
th กำลัง:6  ← the PROGRESSIVE ASPECT marker      fa توان:8 / ar أس:8  ← substring traps
fr carré:4 / cmn 平方:8 / hi वर्ग:5     ← all the UNIT modifier, in km² sentences
```

Every apparent hit was either the unit modifier or the substring trap `tools/normalization/attest.ts` exists to
catch. FLEURS is news and encyclopedia prose and contains no spoken arithmetic, so the power words are simply
not in it. Declared anyway under #584's rule — a dropped sign is inaudible, the one outcome that cannot be
right — and labelled in each file so no later pass credits the corpus with them.

⚠ **de has no distinct predicate cube word** and takes the generic form (*acht hoch drei*), which is the
standard spoken German. Recorded so it does not look like an omission.

The other 57 languages are UNDECLARED BY DESIGN: the field is optional, undeclared behaviour is unchanged, and
the superscript stays where the RAWMARK leak gate can see it — the same choice the unit branch makes for a
missing measure word, and for the same reason.

### Measured surface, so nobody mistakes this for a hot path

Across all 67 artifacts a superscript follows a NON-unit base **twice** (hi's `२०²`/`१०²`, both the corrupt
Vernier sentence) plus my's `mc²`. `⁴`-`⁹` and multi-digit superscripts occur **ZERO** times. The other ~113
superscripts are unit exponents the existing path already reads — including 11 with a NON-LATIN unit
abbreviation (`ኪ.ሜ²`, `किमि²`, `км²`) that an earlier Latin-only count had misfiled as "other".

### Result

**Audit: 0 defective cells across 0/67 treated languages**, with 12 accepted cells printed with their reasons.
Gates: tsc clean; **205 files / 2920 tests**; corpus diffs on twelve languages (en de fr es it pt ru ja cmn hi
el th) all **byte-identical** — the expected outcome, since FLEURS carries only unit exponents, and the
confirmation that a fleet-wide `FOREIGN_RUN` change regressed nothing.

## Run 16 — 2026-08-04 — self-review of the exponent work: three fixes, one of them a real bug

Reviewed the four branch commits before opening the PR. Three findings, and the first was a genuine defect
shipped minutes earlier.

### ⚠ A FOOTNOTE MARKER IS NOT AN EXPONENT — and my first guard against it did nothing

A superscript digit on an ordinary word is a CITATION far more often than a power: `Smith¹` is a footnote, and
reading it *smˈɪθ tʰuː ðə pʰˈaᶷɚ ʌv wˈʌn* is exactly the confidently-wrong outcome this repo ranks below
silence. The rule matched `[\p{L}\p{M}]+` before a superscript with no length limit, so it did that.

Capped the letter base at three characters — mathematical variables are short (`x`, `mc`, `E`), prose words are
not. **Then probed the motivating case and the cap had changed nothing:** `{1,3}` happily matches the LAST three
letters of a long word, so `Smith¹` matched `ith` and still read as arithmetic. A length limit only limits
anything if the match must START at a word boundary; `(?<![\p{L}\p{M}])` is what makes the cap a cap.

*A guard has to be tested against the input that motivated it, not merely against the cases it was already
passing.* Second time this session a change typechecked, ran, and did nothing — the first was
`repairDoubleEncoded`'s early-out guard.

Measured to set the cap: after mojibake repair every real letter base in the fleet is a two-letter unit
(`km²` ×108) or `mc`. The apparent long ones were `kmÂ²` and `AsunciÃ³n`, where the `²`/`³` is half of a
double-encoded byte and not an exponent at all — the phantom class again, this time inflating a length
distribution. Known exclusion: `किमि²` (ne, 4 chars) is a genuine Devanagari unit abbreviation and is now out of
reach, which is the right place for it to fail — a unit exponent belongs to the unit path.

### `{|` had to be anchored to line start

The wikitable-open arm consumed TO END OF LINE. Unanchored, a stray `{|` in prose — set-builder notation, a code
snippet — would have deleted the rest of the sentence. A table open is always first on its line, so the anchor
costs nothing and bounds the damage to nothing. Verified: `the set {|x|} is defined and more text follows`
survives intact.

### ⚠ AND I MADE THE STALE-RULER MISTAKE I WARNED ABOUT IN RUN 12

Re-diffing after the fixes, `ne` reported 8 changed utterances and `id` 6 — alarming, since neither declares
`bareExponent`. Both were **my own measurement error**: I compared against baseline files that did not come from
the right commit (`id.before` was several commits old and `ne.before` had never been emitted at all). Re-emitted
from the true branch point (`45c0226`): **both byte-identical, 0/1993 and 0/1936.**

Run 12 states the rule — "the ruler must be the same on both sides of a before/after; only the ENGINE should
differ" — and I still reached for a leftover file because it had the right name. *A baseline needs its commit
recorded, not just its filename.* The false alarm cost one re-run; believing it would have cost a wild goose
chase through two languages that were never touched.

### Result

Gates after the fixes: tsc clean; **205 files / 2921 tests** (one added, pinning the footnote case and the
boundary guard that makes the cap work); audit **0 defective cells across 0/67**; corpus diffs byte-identical on
en, de, it, hi, ne and id against the true branch point.

## Run 17 — 2026-08-04 — assessing against #586's own text, and the last named open item

Read the issue rather than working from memory of it, and checked each thing it asks for.

### What the issue asks, and where it stands

| #586 asks for | status |
|---|---|
| Round 1 — sweep every treated language against the full inventory | **done**, and the sweep itself was found to be running on 37 of 67 |
| Round 2 — re-run, because round 1 changes the inventory | **done**, repeatedly; audit now 0/67 |
| Audit the inventory against DECLARATIONS, not just rule comments | **checked** — every widely-declared field has a cell (`units` 105, `percent` 57, `currency` 54, `magnitudes` 52, `exponentWords` 51, `unitPer` 22 → `rate`, `ampersand` 17). No missing cell. |
| `arithmetic` / `=` — "needs a per-language decision, not a shared default" | **32 of 67 read it, 35 drop.** Still the deferred per-language item the issue describes. |
| Negative exponents in scientific notation — "has a cell now, no rule" | **CLOSED this run** |

⚠ **My own exponent work had a hole in exactly the place the issue names.** `U+207B` SUPERSCRIPT MINUS was
missing from the superscript run, so `10⁻³¹` read as bare *tʰˈɛn* — sign and power both gone. Implementing
"arbitrary exponent reading" and omitting the negative exponent left the issue's last named item open while
looking closed.

### ⚠ AND THE UNIT LEAKED, which is worse than the drop it accompanied

`9.11 × 10⁻³¹ kg` read as `… tʰˈaᶦmz tʰˈɛn kɡ` — a RAW `kɡ` in the IPA. A superscript sits BETWEEN the number
and its unit, which breaks the adjacency the unit rule matches on, so the unit failed and its abbreviation
reached the phoneme stream verbatim. Fixed by resolving the scientific-notation exponent BEFORE the unit rule,
which leaves the exponent's DIGITS immediately next to the unit — step 6 then sees `31 kg` and the whole phrase
comes out "…to the power of negative thirty-one kilograms", which is how a person says it.

**Two placements, and both are necessary**: scientific notation must precede the unit rule or the unit leaks; a
bare exponent must follow it or it steals every `km²` and reads it "kilometre squared".

⚠ **And it had to precede the SIGN rule too.** First placed after it, the ASCII form silently failed: step 0e
had already rewritten `-31` to "negative 31", so the pattern could no longer match and the reading kept saying
"ten negative thirty-one" — sign present, power missing. Three ordering constraints on one rule, each found by
probing rather than by reading.

### "negative" for the sign, "minus" for the operator

Corrected on the point that `minus` is the arithmetic OPERATOR and English convention reserves it for that,
spending `negative` on a sign attached to an amount. English's step 0e only ever matches the SIGN position
(start of string, after a space, after an open paren) — so it was spending the operator's word on the sign's
job. Now `-31` → "negative thirty-one", `-5 °C` → "negative five degrees Celsius".

The disambiguation is real and cheap: `negative` on a measurement is unremarkable English, and a bare `10 - 4`
is currently DROPPED, so "minus" in English output could only ever have come from a sign anyway.

⚠ **Most languages do not split the two words** — de *minus*, fr *moins*, ru *минус* serve both senses — so
`bareExponent.negative` is each language's OWN sign word, lifted from the minus rule already in its
normalize.ts rather than invented: de minus, fr moins, es menos, it meno, pt menos, ru минус, ja マイナス,
cmn 负, hi ऋण. Sourcing from the repo's own shipped data beats sourcing from my own confidence.

⚠ **Two test pins would have passed VACUOUSLY.** `expect(...).not.toContain("minus")` on the range cases still
passed after the change — because that word is no longer emitted anywhere by the rule, so the assertion tested
nothing. Retargeted to `"negative"`. *A regression pin has to name the string the code can actually emit;*
renaming an output silently defuses every negative assertion about it.

### What the corpus forms actually are

Scientific notation occurs 4 times in the artifacts, and only 2 are recoverable:

```
my  9.1093837 × 10 -31 kg     ASCII, superscript flattened  → now reads
my  2.5×10 -11 m              ASCII, superscript flattened  → now reads
hi  2.802×1010 वर्ग फु         `10¹⁰` FLATTENED INTO THE MANTISSA — unrecoverable
hi  1.1×109 वर्ग फु            `10⁹` likewise — unrecoverable
```

⚠ The last two are **data loss, not a rule gap**: `2.802×1010` genuinely reads "2.802 times 1010" and nothing in
the text says the exponent was ever superscripted. Recorded so no later pass tries to "fix" them by guessing
where a power boundary was.

The ASCII form needs the ATTACHED minus as its discriminator — `10 -31` is scientific notation, `10 - 31`
(spaced both sides) is subtraction — and both real instances write it attached, which is the convention.
Combined with the required `×`, nothing that is not scientific notation reaches the rule.

### Result

Gates: tsc clean; **205 files / 2921 tests**; audit **0 defective cells across 0/67**; corpus diffs
byte-identical on en, de, hi and ru — expected, since en_us contains no true negative at all (the fleet's only
one is hi's astronomical magnitude) and no corpus writes a superscripted exponent.

**Outstanding against #586 after this run: the `arithmetic` / `=` item only** — 35 of 67 languages still drop
`=`, which the issue itself defers as needing a per-language decision rather than a shared default.

## Run 18 — 2026-08-04 — "are WE causing the data loss?" — yes, and the answer found three more defects

Run 17 recorded hi's `2.802×1010` as unrecoverable "data loss, not a rule gap". Challenged on whether the loss
was ours or the orthography's. **It was ours**, and I had asserted otherwise without checking.

### Two places flatten `<sup>`, and the arithmetic proves the value

`wikidump-to-text.py:32` (`RE_TAG = re.compile(r"<[^>]+>")`) and `stripMarkup` both delete the brackets and
leave the digits INLINE. So `2.802×10<sup>10</sup>` is mined and read as `2.802×1010` — the exponent merges into
the mantissa and no later pass can find the boundary.

The arithmetic settles it, rather than a guess about the wiki source:

```
2,603 वर्ग किलोमीटर (2.802×1010 वर्ग फुट)   →  2,603 km² IS 2.802×10¹⁰ sq ft
100 kमी2 (1.1×109 वर्ग फुट)                →  100 km²   IS 1.1×10⁹ sq ft
```

The values only reconcile with the exponent restored. Both tools now render `<sup>N</sup>` to real superscript
characters before the tag pass.

⚠ **IT HID BECAUSE THE UNIT CASE LOOKED FINE.** `km<sup>2</sup>` flattens to `km2`, and the shared tier
deliberately accepts an ASCII exponent after a letter — the branch that made the original `<sup>` fix work. So
twelve corpora carry a harmless-*looking* `km2` and only a NUMBER base made the collision visible. *A lossy
transform that stays readable in the common case is the hardest kind to notice.*

### ⚠ AND "HARMLESS-LOOKING" WAS WRONG, WHICH MY OWN TEST CAUGHT

I wrote that the unit case "survives flattening because the tier accepts an ASCII exponent" and asserted it.
The assertion FAILED. Measured properly: 7 of the 9 tier languages carrying `km2` do read it as an exponent
(el es ml bg ne hu cmn) — but **en, sw and nb do not**, and there the `2` falls out of the unit match and reads
as a SEPARATE NUMBER: *"nineteen thousand five hundred kilometres TWO"*. Audibly wrong, and invisible to both
gates — no superscript survives to leak, nothing vanishes for DROP to catch.

- **en** matched only `[²³]`; now accepts `[23]` too, bounded by the unit list so `H2O` and `802.11g` cannot
  match. Fixes `3136 mm2` in en_us.
- **sw / nb** differ for another reason entirely: they declare no `exponentWords`, so the tier hands the exponent
  back BY DESIGN — the documented visible gap, not this bug. Left as a data gap.

### ⚠ AND CHASING THAT FOUND A LEAK IN ENGLISH — the first language ever treated

`2.2 million km2 of ocean` (the archipelago sentence, in en_us) read as *… mˈɪɫjən ˈʊkm tʰˈuː …*: **the unit
abbreviation reached the phoneme stream as RAW LETTERS** and the area was lost. The plain `2.2 million km` leaks
too, so it is the MAGNITUDE breaking adjacency, not the exponent.

This is the same defect the shared tier fixed with `magnitudes` — reported by the Luxembourgish run, found again
in Italian earlier this sweep — and English does not use that tier, so it never got the hop. Added, with the
magnitude re-emitted in place and forcing the PLURAL (the singular test reads the digits alone, so `1 million km`
would otherwise say "kilometre").

⚠ **No gate could see this one either.** Bare Latin letters are in no leak class, and nothing vanished. Two
independent invisible defects in en_us, both surfaced by asking who caused a data loss.

### Support every encoding, render them all to Unicode

On the observation that a caller passes whichever encoding is at hand. Three now converge on one reading:

| encoding | before | now |
|---|---|---|
| `km²` | ok | ok |
| `km<sup>2</sup>` | → `km2`, flattened | → `km²` |
| `km&sup2;` | **stayed LITERAL** — read as "ampersand sup two semicolon" | → `km²` |
| `km^2` | `ˈʊkm tʰˈuː` — unit LEAKED | → `km²` |
| `km&#178;` | ok (numeric entities already worked) | ok |

Named entities were the inconsistency: the numeric form worked while every NAMED one that maps to a readable
character was left literal. Added `sup1-3`, `frac12/14/34`, `minus`, `plusmn`, `micro`, `permil`, `cent` — each
paired with machinery that already reads it. Caret notation became a shared fold beside `foldSquaredDegrees`,
guarded to require an alphanumeric before and only signed digits after (`a ^ b` untouched; `^` occurs ZERO times
in all 67 corpora, so it is robustness for what a caller may hand us).

### ⚠ AND `<sub>` IS DELIBERATELY *NOT* MAPPED — I wrote it, then measured it out

Symmetry argued for rendering `<sub>2</sub>` to `₂`. Measured:

```
CO2 levels  → kʰˈoᶷ tʰˈuː lˈɛvəɫz     the flattened ASCII form — the 2 IS spoken
CO₂ levels  → kʰˈoᶷ lˈɛvəɫz           "correctly" rendered — the 2 is GONE
```

Nothing reads a subscript digit, so the "correct" rendering takes a readable form and makes it silent — **the
same error as the bug this whole run is about, pointed the other way.** `<sub>` occurs zero times in all 67
corpora and artifacts, so there was no benefit to weigh against a measured regression. *A transform is only a
repair if something downstream can read what it produces.*

### The existing artifacts are NOT retro-repaired, deliberately

The two hi entries still carry `1010`/`109`, and twelve corpora still carry `km2`. The arithmetic proves the
VALUES, but not the exact markup that was there — I inferred `<sup>` from the flattening pattern. Hand-editing
mined evidence on an inference is weaker than regenerating it from the dump, so the tools are fixed and
regeneration is the mechanism. Recorded here so the flattened forms are not mistaken for source fidelity.

### Result

Gates: tsc clean; **205 files / 2927 tests**; audit **0 defective cells across 0/67**; corpus diffs — en 2/1976
(both the defects above, read individually) and el, es, lb, ms, vi **byte-identical**.

## Run 19 — 2026-08-04 — the `arithmetic` item, and it was not about `=` at all

#586's last open item was `arithmetic` / `=`, deferred as "needs a per-language decision". Measuring it first
changed what the work was.

### The sign counts were almost all phantoms

`=` ×50, `<` ×6, `>` ×6, `±` ×1 across the artifacts — and reading them:

- **`<` and `>` ×12** — every one is an HTML TAG (`<i>`, `<sup>`) in ms. Not operators; `stripMarkup` removes them.
- **`±` ×1** — `Las CaÃ±itas`: the mojibake `Ã±` CONTAINS `±`. The phantom class again.
- **`=` ×50** — dominated by cmn's artifact carrying MediaWiki/LaTeX residue (`{\displaystyle W={\frac{Rv+Cm}{v+m}}}`,
  `Missing required parameter 1=month!`), which is being READ ALOUD as English. One genuine arithmetic (`1+4=5分`).
- **`×` ×20** — the only genuinely attested one, and mostly DIMENSIONS.

⚠ So `=` is largely an artifact-quality problem, not a vocabulary one, and `±`/`<`/`>` have ZERO real instances.

### ⚠ THE REAL DEFECT WAS ASCII `x`, AND IT WAS AUDIBLE GARBAGE

Counted in the corpora: `NxN`-shaped forms occur **~85 times against ~20 for `×`** — the ASCII form is dominant.
And almost every engine read the `x` as its own LETTER NAME:

```
en  6x6 cm → sˈɪks ˈɛks sˈɪks …     it  sˈej KS sˈej      fr  sis IKS sis      de  zɛçs KS zɛçs
```

Not a drop — *audible garbage*, which is why no leak or DROP gate ever saw it. hu was the only language right,
because it was fixed by hand earlier this sweep. Separately, 31 of 67 dropped `×` entirely.

### Two decisions, arbitrated

**1. `×` has TWO readings, and English uses different words.** A DIMENSION is "six BY six centimetres"; a PRODUCT
is "five TIMES five"; a `4x4` is "a four BY four". Most languages reuse one word (cs *krát*, da *gange*,
ro *ori*, ca *per*, ga *faoi*), so `multiply.by` defaults to `times` and a single-word language costs nothing.
The discriminator is mechanical: a unit follows → `by`; UNSPACED ascii between digits → `by` (the `4x4`/`6x6`
idiom); else `times`. ⚠ Equality of operands cannot decide it — `4x4` and `5 × 5` are both equal and read
differently.

**2. Attested first, then register.** The sweep found the word attested almost nowhere, and the apparent hits are
HOMOGRAPHS OF PREPOSITIONS: es `por` ×23, it `per` ×25, ru `на` ×31 — all the preposition, never the operator.
Same trap as the exponent sourcing. So provenance is marked per language: **✓ TREE** where the word came from
that language's own existing `×` rule (20 languages — zero new sourcing, and declaring it is what fixes ASCII
`x` for them), **~ REG** where it is standard register for a language that dropped the sign (11).

### Two ordering bugs, both found by probing

⚠ **The declarations landed in the WRONG OBJECT for four languages.** Anchoring the insertion on the first
`percent:`/`units:` line matched a field in an unrelated type or config near the top of the file, not the
`makeSymbolNormalizer({…})` call — so it, id, sw and mk typechecked, shipped, and did NOTHING. Caught because
`it 5 × 5` still read *t͡ʃˈinkwe t͡ʃˈinkwe*. *A config field in the wrong object is invisible to the compiler.*

⚠ **The rule had to run BEFORE the unit path, not after.** Placed after, `unitPrefix` languages broke: Swahili's
unit path MOVES the noun ahead of its number, so `6x6 cm` became *sita KS sentimita sita* — no digit after the
sign, and the `x` fell through to the letter reading. Running first is better anyway: the unit is still an
ABBREVIATION, so "is a unit coming?" is just "digit then letters", and the unit path still finds `6 cm` adjacent.

### Result

31 languages declared. Corpus diffs, every changed line read: **en 1/1976** (`ˈɛks`→`baᶦ`), **de 2/1956**
(`ks`→`maːl`), **it 3/1978** (`ks`→`pˈer`), **cs 2/1947** (`ks`→`krˈaːt`), **el 1/1969** (`ˈɛks`→`epi`),
sw 0/1938. Every one is a letter name becoming a word; no DROP, DIGIT, RAWMARK, SLOT-GAP or THROW anywhere.
Gates: tsc clean; 205 files / 2927 tests; audit 0 defective cells across 0/67.

**Still open**: ~26 languages have no multiplication word (the droppers I could not source confidently), cmn's
artifact carries LaTeX/template residue that is read aloud, and `±`/`<`/`>` remain undeclared almost fleet-wide
with zero attested instances.

## Run 20 — 2026-08-04 — items (2) and (1): LaTeX residue, and the multiplication word fleet-wide

### (2) LaTeX/template residue was being READ ALOUD

cmn's artifact carries `{\displaystyle W={\frac {Rv+Cm}{v+m}}}` and three MediaWiki template ERROR messages.
Both were spoken as English — *dˈʌbəɫjuː dɪsplˈeᶦstaᶦɫ …* ("W displaystyle W") and *mˈɪsɪŋ ɹikwˈaᶦɚd pɚˈæmət̬ɚ*.
Same class as the wikitable prefix: not a dropped sign but AUDIBLE GARBAGE.

- **Engine**: `stripMarkup` now removes LaTeX control sequences. ⚠ Zero risk, measured — a BACKSLASH occurs
  **zero times in all 67 corpora** and in one artifact entry, so `\word` can never reach real prose.
- ⚠ **The brace strip had to be conditional, which the first version got wrong.** `[{}]` unconditionally
  reached ordinary text (`a {curly} aside` → `a  curly  aside`). Braces are rare rather than impossible in prose,
  so a LaTeX COMMAND is what licenses treating them as math. No command, no brace strip.
  (Also needed a non-global twin for the presence test — `.test()` on a `/g` regex advances `lastIndex` and makes
  alternate calls disagree with themselves.)
- **Mining tool**: a paragraph containing a MediaWiki error marker is now DISCARDED WHOLE. These are FIXED
  strings from a broken template, so unlike ordinary garbage they can be matched exactly rather than guessed at,
  and the surrounding text is template expansion with no reliable prose to salvage.

### (1) The multiplication word, from 33 broken to 1

Started at 33 languages either dropping `×` or reading ASCII `x` as a LETTER NAME. Now **one**.

⚠ **My first measurement of who was broken was WRONG, twice over.** The detector looked for `ks`/`eks` in the
IPA — which matches `sˈɪks` (English "six") and `eksi` (Greek "six"). Both false positives, and both languages
were already correct. Replaced with the only reliable test: *does the ASCII form read identically to the `×`
form?* That split the failures into two groups that need different fixes, which the leak-string test could never
have shown.

| group | fix | count |
|---|---|---|
| no word at all | declare `multiply` (~REG standard register) | 17 |
| reads `×`, not ASCII `x` | declare `multiply` (✓TREE — their OWN word) or extend their local table | 16 |

Words came from the language's own existing rule wherever one existed (✓TREE, zero new sourcing) — harvested
from two different shapes, `replace(/×/…)` AND the `[/×/gu, " word "]` TABLE form that a first grep missed.
The rest are ~REG, marked distinctly in each file.

⚠ **Eight languages do not route this through the tier at all** and needed their local rule extended instead —
a reminder that a tier field does not reach a language that never asked the tier. ar and om use a third shape
again (`new RegExp` with a digit class; a two-group `replace`), and fa had no `×` rule of any kind.

### Result

**32 of 33 fixed.** Corpus diffs, every changed line read: cmn 2/1999 (`ˈɛks`→乘以), ta 1/1886 (`ˈɛks`→பெருக்கல்),
ru 0/1959, sv 0/1863. Gates: tsc clean; 205 files / 2927 tests; audit 0 defective cells across 0/67.

**Still open**: om's `×` (its local rule and the `unitPrefix` reorder interact — ASCII `x` works, `×` still
drops), and item (3), `±`/`<`/`>`, which remain undeclared almost fleet-wide with ZERO attested instances.

## Run 21 — 2026-08-04 — "no way to find an equal sentence and listen?" — yes, and it corrected my data

Challenged on shipping 17 multiplication words as "standard register" without trying the audio. The challenge was
right: I had dismissed the audio route on TEXT grounds ("the corpora are news prose"), which is exactly the
argument the FOURTH SOURCING TIER exists to answer — a sign's word is absent from text BY CONSTRUCTION, so you
listen. It is the same method that resolved ~15 languages' plus word earlier in this sweep, and I did not reach
for it.

### The universal sentence is the `4x4` vehicle sentence

Present in 14 of the 17. ⚠ **MMS was useless, as its own documented limitation predicts** — it echoes the
orthography at a sign: `4x4` came back as `4x4`, `44`, `4ু4`, `4ራ 4ራ`. wav2vec2 (no digits, no `x` in its
392-token vocabulary) is the instrument that can answer.

### Four register guesses CONFIRMED, and one CORRECTED

| lang | phones | reading | vs my guess |
|---|---|---|---|
| am | `a r a t **b a** r a t` | *arat ba arat* → በ | ✓ confirmed |
| bn | `tʃ a r **ɡ u n a** …` | *char guna* → গুণ | ✓ confirmed |
| mr | `tʃ a r **ɡ u n i l e** tʃ a r` | *char gunile char* → गुणिले | ✓ confirmed |
| ne | `tʃ a r **ɡ u n a** t a r` | *char guna char* → गुणा | ✓ confirmed |
| uk | `tʃ o t e r i … **n a** tʃ e t e r e` | *chotyry NA chetery* → **на** | ✗ I shipped `помножити на` |

`помножити на` is the full verbal form a textbook uses; **a reader saying a dimension uses the bare
preposition.** Corrected. That is a real defect the audio caught and no text source would have.

### ⚠ AND A FINDING THAT CHANGES THE MODEL: `4x4` IS A BORROWED DESIGNATION

Several readers do not use their language's multiplication word at all:

```
mi  f o  b aɪ  f o          "four BY four"     — English
pa  dʒ a r  b aɪ  dʒ a r    "char BY char"     — Punjabi four, ENGLISH by
om  f o r  b aɪ … f o r     "four by four"     — English
kn  f o r  i n t u  f o r   "four INTO four"   — Indian English "into"
gu  f o ɾ  e k s  v o r     "four EKS four"    — the LETTER, spelled
fa  … e k s  f o r …        "eks four"         — the LETTER, spelled
```

So `4x4` is not arithmetic in these languages — it is a **vehicle designation carried whole from English**, and
the readers carry its pronunciation with it. Two of them even spell the `x` as a letter, which is the one thing
this sweep set out to eliminate — *and for those two speakers it is the correct reading of a borrowed term.*

⚠ **This does NOT mean the register words are wrong.** They were declared for the ARITHMETIC/dimension sense
(`6 × 6 cm`), which this sentence does not test. What it means is that `4x4` needs its own treatment as a
designation, on the same footing as `चंद्रयान -1` — and that the `by` slot cannot simply be filled with the
English word, because reproducing "four by four" in Punjabi or Māori orthography is the unrenderable-loan problem
mi's plus already documented.

Recorded rather than acted on: changing six languages' reading of `4x4` on one speaker each is thinner evidence
than the correction it would make, and the arithmetic sense is unaffected.

### The lesson

*I had the tier, the method, the audio and the universal-sentence technique, and still defaulted to register
because the TEXT sweep failed.* The text failing is the trigger for the audio tier, not a reason to stop. Four
confirmations and one correction from fourteen clips, at maybe twenty minutes of work.

## Run 22 — 2026-08-04 — om's `×`: the straggler was the same ordering bug, a third time

`normalizeOromo("6 × 6 cm")` → `"6 × seentiimeetira 6"`. Oromo's unit rules honour `unitPrefix` and **move the
noun ahead of its number**, so by the time the sign rule ran there was no digit after the `×` and *si’a* was
DROPPED. `6x6 cm` failed the mirror way: the `x` broke the unit rule's adjacency, so the sign read and **`cm`
LEAKED** instead.

Moving the sign rule above the unit block fixes both at once — the reordering has not happened yet, and the unit
rule then still finds `6 cm` adjacent.

⚠ **This is the THIRD time this exact ordering has bitten in this sweep**, and every time it was a `unitPrefix`
language that exposed it:
1. the shared tier's `multiply`, where Swahili read *sita KS sentimita sita*
2. English's scientific-notation exponent, where the superscript between number and unit leaked `kg`
3. om here

*A rule that consumes a sign between two operands must run before any rule that may REORDER those operands.*
Worth stating as a rule of thumb rather than rediscovering: `unitPrefix` is the flag that makes it happen, so a
new sign rule should be probed against a `unitPrefix` language (sw, om) and not only against a fleet-typical one.

Verified: om corpus diff **0/1218 byte-identical** — expected, since om_et's own text writes the sign in the
`4x4` sentence only, which the earlier ASCII fix already covered. Unit forms pinned in the test (noun-first
`km 6,387`, the rate `165km/h`, `sq mi`, `km²`) because they are what the reorder exists for.

Gates: tsc clean; 205 files / 2928 tests; audit 0 defective cells across 0/67.

## Run 23 — 2026-08-04 — the phantom `±`: fixing the DATA, not just reading around it

#654 cited `Las CaÃ±itas` as the fleet's only `±`. The engine already repaired it — but the ARTIFACT still carried
the mojibake, so every measurement over the mined text still saw the phantom.

⚠ **THE ARTIFACTS ARE OURS, AND A CORRUPT ONE IS WORSE THAN AN INCOMPLETE ONE.** The mis-decode of a letter
CONTAINS a sign: `Ã±` contains `±`, `Ä°` contains `°`, `Ã£` contains `£`, `Â²` contains `²`. So the file did not
merely fail to read — it MANUFACTURED symbols for every downstream measurement, and #586 chased both the `°` and
the `£` as per-language defects before the cause was found. Repairing the stored text is what stops that class of
false lead at its source.

Three things done, in the order that matters:

1. **The mining tool now repairs double-encoding** (`repair_double_encoded` in wikidump-to-text.py), before
   anything reads a symbol out of the text — so a regenerated artifact needs no errata at all.
2. **The 13 affected entries were corrected in place** (id ×12, mr ×1), editing the RAW jsonc so comments and
   formatting survive and only the mojibake bytes change.
3. **An ERRATA block was added to each header**, because an artifact records its own provenance and a correction
   is part of that.

### ⚠ AND THE TWO ERRATA ARE NOT THE SAME KIND, which I got wrong on the first pass

I wrote one errata text and applied it to both files, claiming "the decode is EXACT, nothing is guessed". True for
id, **false for mr** — and checking what actually changed is what caught it:

| file | change | kind |
|---|---|---|
| id | `Ã±`→`ñ`, `Ã£`→`ã`, `Ä°`→`İ`, `Â²`→`²`, `Ã³`→`ó` | **exact DECODE** — UTF-8 `C2..C5 XX` encodes a known code point |
| mr | `â€इलर्निंगâ€�` → `“इलर्निंग”` | **INFERENCE** — the third byte did not survive; U+FFFD is all that is left |

mr's repair reconstructs rather than decodes, so its errata now says so and cites the two constraints that make it
safe to store: U+FFFD is a **fingerprint** (only five `E2 80 xx` third bytes are unmapped in CP1252, and `9D` = `”`
is by far the commonest in running text), and the pairing is **corroborated across languages** (en
`“learning” and “socialization”`, hi `“लर्निंग” और “सोशलाइजेशन”` — the same sentence with its bytes intact, which is
what settles the OPENING quote rather than a dash). Plus the damage is bounded even if wrong: every candidate is a
quote, dash or space, all clause marks or silent here, so a wrong pick cannot produce a wrong WORD.

*Applying one justification to two changes because they were in the same commit is exactly how a stronger claim
gets attached to weaker evidence.* The `<sup>` flattening in the same file's history is the third kind and is
still NOT retro-repaired: `10<sup>10</sup>` → `1010` loses the boundary, and restoring it would need inferring
where the boundary was.

### Result

`±` in the artifacts: **1 → 0**. The phantom is gone from the data, not merely tolerated by the readers.
Gates: tsc clean; 205 files / 2928 tests; audit 0 defective cells across 0/67; both artifacts re-parse
(id 80 hard + 30 sample, mr 77 + 30).

⚠ **The `Las Cañitas` READING is still wrong, for an unrelated reason** — `t͡ʃˈa ˈɛn ˈitas`, "cha en itas", because
`id`'s TOKEN is `[a-zA-Z]+` and every accented Latin letter fragments the word. That is the ASCII-tokenizer defect
already recorded in Run 12; the correct spelling now reaches it, and it still cannot read it. `yue` solved this
with `\p{Script=Latin}` and pins it with a test.

## Run 24 — 2026-08-04 — id's ASCII tokenizer: the defect the phantom `±` was hiding behind

Repairing `Las CaÃ±itas` to `Las Cañitas` (Run 23) made the *spelling* right and the *reading* no better:
`t͡ʃˈa ˈɛn ˈitas` — "cha EN itas". `id`'s TOKEN word group was `[a-zA-Z]+`, so a diacritic ENDED the token, the
letter carrying it became an unclaimed gap read as an English LETTER NAME, and the rest of the word started over.
One word became three, none of them right:

```
Cañitas → t͡ʃˈa ˈɛn ˈitas      São → s ˈə ˈo      Klöcker → ʔl ˈoᶷ t͡ʃkˈər      Cochamó → t͡ʃˈot͡ʃha ˈoᶷ
```

⚠ **INVISIBLE TO EVERY GATE.** No digit or raw mark survives, and nothing VANISHES, so it is a WRONG-WORD defect
that neither the leak classes nor the differential DROP test can reach. It was found by reading a corpus diff —
the same way English's magnitude leak was.

### Widening the token was necessary but not sufficient

`\p{Script=Latin}[\p{Script=Latin}\p{M}]*` stopped the fragmentation, and the reading was still wrong:
`Cañitas` → *t͡ʃaˈitas*, because id's native g2p has no rule for `ñ` and silently **drops the letter it cannot
spell**. Quieter than fragmenting, no more correct.

⚠ **A DIACRITIC IS THE SIGNAL, and it is a reliable one**: Indonesian orthography has none, so a token carrying
one is a FOREIGN NAME and belongs on the foreign path. `NATIVE_WORD = /^[a-zA-Z]+$/` routes it, and the registry
now injects English exactly as it does for Hindi — `createIndonesian` accepted no reader at all before, so
`this.foreign` was always undefined and the fallback always fired.

*This is the difference from yue's fix, which looked like the same problem.* yue's Latin group already fed the
foreign reader, so widening the pattern was the whole change. id's Latin group is its NATIVE word group, so
widening it alone just hands the g2p letters it cannot pronounce. Same symptom, two different fixes.

**Malay inherits both**, since `createMalay` wraps `createIndonesian` — it had to be threaded through, or `ms`
would have kept the defect `id` just lost.

### Result

`id Cañitas` → `kʰˈæniːt̬əs`, **byte-identical to English's reading**, and the same for `ms`/`zsm`.
Corpus diffs **id 21/1936 and ms 21/1908**, every changed line read: every one is a fragmented name becoming a
whole word (`t͡ʃˈa ˈɛn ˈitas`→`kʰˈæniːt̬əs`, `ʔl ˈoᶷ t͡ʃkˈər`→`klˈɑːkɚ`, ` ˈə ˈo`→`ˈaᶷ`). No DROP, DIGIT,
RAWMARK, SLOT-GAP or THROW.

Gates: tsc clean; 205 files / 2929 tests; audit 0 defective cells across 0/67.

⚠ **AND THE PROBE SAYS 42 LANGUAGES FRAGMENT**, not one. That number needs care before it becomes a work item:
for a NON-Latin-script language an accented Latin word is a foreign run and the script router may already handle
it, so the probe (comparing space counts against an ASCII twin) will over-report. The genuinely comparable cases
are the Latin-script engines whose own word group is ASCII-or-partial — `xh`, `zu`, `sw`, `om`, `naija`, `akan`,
`nama`, `tagalog`, and the partial-diacritic ones (`cs`, `it`, `pl`, `sk`, `sl`, `lv`, `lt`, `nb`, `ro`, `ig`,
`yo`). Each needs the id treatment: widen the token AND decide whether its g2p or a foreign reader takes the
result. Worth its own issue rather than a blind sweep.

### Run 24b — "shouldn't Latin runs get sent whole?" — the phrasing is fine, the WORDS were not

Asked whether an embedded Latin run should reach the foreign reader whole, spaces included, rather than word by
word. Measured both halves of the question:

**Phrasing: word-by-word is already almost identical to whole-phrase.** `bit by bit` in a non-Latin host reads
`bˈɪt bˈaᶦ bˈɪt` against English's own `bˈɪt baᶦ bˈɪt` — the only difference is stress on a function word. Not
worth a mechanism.

⚠ **But the probe exposed the same ASCII-tokenizer defect in FIVE more places.** `São Paulo` in Hindi read
*ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ* — "ES ə O Paulo" — because `makeNativeHindi`'s Latin group was `[A-Za-z]+` too. Widened
there (**17 languages compose it**) plus `pa` and `or`, which carry their own tokenizer.

*The fix was simpler here than in id, for a structural reason worth recording*: in these engines the Latin group
ALREADY means "foreign" — its match goes straight to the injected reader — so widening the pattern is the whole
change. Indonesian's Latin group is its NATIVE word group, so widening it also required deciding native-vs-foreign
per token. **Same symptom, two different fixes, and the difference is which side of the routing boundary the
group sits on.**

⚠ **The genuinely undecidable case is Latin-in-Latin, and it is left alone.** `bit by bit` and `high wheel base`
are pure-ASCII English phrases in Indonesian text; nothing in the characters distinguishes them from Indonesian,
so `id` reads them natively (*bˈit bj bˈit*) and that cannot be fixed without a lexicon. Capitalisation was
considered as a signal for extending a foreign run across spaces and rejected: `Kota São Paulo` would pull the
Indonesian `Kota` into the English run.

Corpus diffs, every changed line read: hi 2/1702, ne 2/1993, gu 1/1996, mr/pa/or 0 — every change a letter-name
fragment becoming a word (`ˈɛs ˈə mˈiː`→`sˈæmi`, `ˈɛs ˈʌ ˈo`→`sˈa`). `or`'s Latin-`I`-as-danda rule and `pa`'s
initialisms verified intact. Gates: tsc clean; 205 files / 2930 tests; audit 0 defective cells across 0/67.

## Run 25 — 2026-08-04 — #657 opened, and the first Latin-script engine done (om)

Filed #657 for the 14 Latin-script engines still shredding accented Latin, then started on it.

### The method needs no new linguistic data, which is what makes it mechanical

The observation that unlocks it: **each engine's current token class already IS its declared native inventory.**
So the class is lifted verbatim into a `NATIVE_WORD` test, the token widens to all Latin, and a token failing the
test goes to the foreign reader. Step 1 is a copy, not a judgement.

### ⚠ `ig` and `yo` do NOT need fixing, which the measurement caught before the edit

Both already use `À-ɏḀ-ỿ`, wide enough to hold the word: `ig São Paulo` → `sao paulo`, `yo` → `sa˧o˧ k͡pa˧u˧lo˧`.
They read the name NATIVELY rather than routing it — a different judgement call, and a defensible one. They were
on my scope list from a probe that only detected *fragmentation*; checking each before touching it kept two
languages out of a change they did not need.

### om done, and the registry comment was the trap

`return createOromo(); // no foreign needed — om is Latin-script`

⚠ **Being Latin-script is exactly what made a reader NECESSARY, not unnecessary.** Because the word group claims
Latin text, an accented foreign name was CLAIMED and then mangled by a g2p with no rule for the letter — the
opposite of the comment's reasoning. `São Paulo` read *s ˈə ˈo paˈulo*.

Corpus diff **3/1218**, every line read — all three are letter-name fragments becoming words
(`t͡ʃʼˈa ˈɛn itˈa`→`kʰˈæniːt̬ə`, `ˈa ˈaᶦ nˈos`→`ʰˈæiːnoᶷz`, `ard ˈaᶦ ˈuni ˈoᶷ`→`ɑːɹd̬ɪ jˈuːnjə`). Native Oromo
byte-identical; the `×` and rate rules re-verified, since both key on the Latin class.

### Remaining in #657

`pcm` and `tl` fragment and have a reader — but ⚠ **`pcm` deliberately NATIVISES English rather than reading it
as English** (`phonemizeWord(m[1], this.foreign)` uses the reader as a DICT lookup, per its own header), so it
wants the token widened WITHOUT the routing change. Then the twelve needing a reader injected: `xh`, `zu`, `sw`,
`akan`, `nama`, `cs`, `it`, `pl`, `sk`, `sl`, `lv`, `lt`, `nb`, `ro`.

Gates: tsc clean; 205 files / 2931 tests; audit 0 defective cells across 0/67.

## Run 26 — 2026-08-04 — pcm: the fix is HALF the fix, and the missing half made one case worse

pcm fragments like the others (`São Paulo` → *ɛs ˈə o pɔlo*, "ES ə O") so it needed fixing — but **not** the same
fix. Its header is explicit: the rule g2p is applied to English-spelled tokens "rather than routing them to the
English phonemizer … nativising is more correct for the creole", and its own output proves it — `water` → *wata*,
`computer` → *kampjuta*, against English's *wˈɔːt̬ɚ* / *kəmpjˈuːt̬ɚ*. Routing an accented token to the foreign
reader would contradict the engine's design.

So: widen the token, **no** native-vs-foreign routing.

### ⚠ And widening alone made one case WORSE, which only appeared on a third example

`São Paulo` → *so pɔlo* and `Cañitas` → *kaitas* both looked like wins. `Klöcker` → **klkkeɾ** — pcm has no rule
for `ö`, so the letter simply VANISHED and left an unpronounceable cluster, where fragmenting had at least
produced syllables.

**Nativising an English-spelled word means reading it with Naija values, which requires a letter to read.
Dropping it is not nativising, it is deleting.** So an accent folds to its BASE first (NFD, discard marks), and
every accented form now reads identically to its ASCII twin:

```
São Paulo → sau pɔlo   = Sao Paulo      Cañitas → kanitas = Canitas      Klöcker → klokkeɾ = Klocker
```

*Two examples agreed and the third disagreed.* Had I stopped at `São`/`Cañitas` — both of which lose a letter the
g2p cannot use and still read plausibly — the regression would have shipped looking like a fix.

### The shape of #657 is now three variants, not one

| engine kind | fix |
|---|---|
| Latin group means FOREIGN (`hi` +16, `pa`, `or`) | widen the pattern; that is all |
| Latin group is NATIVE, engine reads foreign names as foreign (`id`/`ms`, `om`) | widen **+** route non-native tokens to the reader |
| Latin group is NATIVE, engine NATIVISES by design (`pcm`) | widen **+** fold the accent to its base; **no** routing |

The third was not in the issue's method when I wrote it. Worth checking each remaining engine for which kind it
is before applying anything — `xh`, `zu`, `sw`, `akan`, `nama` are the ones most likely to be nativisers too.

Gates: tsc clean; 205 files / 2932 tests; audit 0 defective cells across 0/67.

## Run 27 — 2026-08-04 — tl: a fourth shape, where the fold has to be CONDITIONAL

`tl` is a NATIVISER like pcm — `computer` → *kompˈuteɾ*, not English's *kəmpjˈuːt̬ɚ*, and its declared reader is
not auto-used. So the pcm treatment applies: widen the token, fold the accent, no routing.

⚠ **Except that `ñ` IS TAGALOG ORTHOGRAPHY**, inherited from Spanish and read as /ɲ/. `Doña` → *dˈoɲa* and
`Cañitas` → *kaɲˈitas* were already correct. **pcm's unconditional fold would have destroyed exactly the accented
letter this language CAN read**, turning `ñ` into `n`.

So the fold is gated on the language's own inventory: a token the native class ACCEPTS is passed through
untouched, and only a token it REJECTS is folded. Both halves then work:

```
Cañitas → kaɲˈitas   (ñ preserved)          São Paulo → saʔˈo paʔˈulo = Sao Paulo
Doña    → dˈoɲa      (ñ preserved)          Klöcker   → klˈokkeɾ      = Klocker
```

The hyphen-compound token shape was preserved through the widening — Tagalog writes `kaibigan-ko` as one word,
and `kaʔibiɡˈanʔko` is unchanged.

### The variant table, now four rows

| Latin group | engine reads a foreign name | fix |
|---|---|---|
| means FOREIGN (`hi` +16, `pa`, `or`) | via the reader | widen the pattern; that is all |
| NATIVE (`id`/`ms`, `om`) | via the reader | widen **+** route non-native tokens to it |
| NATIVE (`pcm`) | NATIVISED | widen **+** fold accent to base, unconditionally |
| NATIVE, **with native accents** (`tl`) | NATIVISED | widen **+** fold **only** what the native class rejects |

*Each of the last three was discovered by the engine after it, not predicted.* The lesson for the remaining
twelve: read what the engine does with an ordinary English loan (`computer`) and with an accented letter that is
in its class, before choosing a fix. Two probes, and they pick the row.

Gates run separately: tsc PASS; 205 files / 2933 tests; audit 0 defective cells across 0/67.
Remaining in #657: `xh`, `zu`, `sw`, `akan`, `nama`, `cs`, `it`, `pl`, `sk`, `sl`, `lv`, `lt`, `nb`, `ro` — all
needing a reader injected or a fold chosen, and all needing the two probes first.

## Run 28 — 2026-08-04 — #657 closed out: the remaining fourteen, and a test that lied twice

Applied the `tl` shape to all fourteen remaining engines. The two probes picked the row before any edit, and they
picked the SAME row for all of them: every one NATIVISES its loans — `cs computer` → *t͡sˈomputɛr* (Czech `c` =
/ts/), `it` → *kompˈuter*, `pl` → *kɔmpˈutɛr*, none of them English's *kəmpjˈuːt̬ɚ*. **None has a reader injected,
and injecting English would have been wrong** — Czech reading a French name should not sound English.

So: widen the token, fold only what the native class rejects. Uniform across all fourteen, and the transform needs
no linguistic data because each engine's own class supplies the inventory.

Result: `São Paulo` and `Klöcker` now read exactly like their ASCII twins in all fourteen, while every native
accent survives — `čas`, `perché`, `łódź`, `blåbær`, `țară`, and Nama's `ǀgôa` → *ᵏǀoa* with the click intact.

Corpus diffs, ten languages: cs 10/1947, it 14/1978, pl 11/1919, nb 19/1859, ro 12/1958, xh 16/1509, zu 18/1478,
sk 9/1719, sl 16/1903, sw 0/1938. Sampled and read — every change is a letter-name fragment collapsing into a
word (`s ˈə mˈiː`→`sˈaːmi`, ` ˈoᶷ kkˈ`→`ˈokk`, ` ˈɛn ˈ`→`ɲ`). No DROP, DIGIT, RAWMARK, SLOT-GAP or THROW.

### ⚠ AND THE NEW TEST ASSERTED THE WRONG THING TWICE

`test/latin-tokenizers.test.ts` is the fleet-wide pin so the next instance is caught by a test rather than by
reading a diff. Its native-accent case took three attempts, and both failures are worth keeping:

1. **Vacuous.** I compared the native word against its de-accented form and demanded they differ. Akan's `ɛ` and
   Nama's clicks are **distinct letters, not base-plus-diacritic** — NFD cannot decompose them, so there is
   nothing for a fold to destroy and the comparison can never be true. Failed on `ak ɛdwuma`.
2. **Still wrong after guarding for that.** Nama reads `ô` as /o/ in its OWN g2p, so `ǀgôa` and `ǀgoa` coincide
   *legitimately*. Identical output is not evidence the accent was dropped.

Both versions were testing a PROXY — "differs from de-accented" — for the property I actually wanted, which is
"the word is not shredded". Asserting the property directly (no English letter names in the output, and the word
occupies exactly one token) passes for all fourteen and cannot lie about it.

*A proxy assertion fails in the cases where the proxy and the property come apart, which are exactly the cases
worth testing.* Stated directly, the test is also shorter.

Gates run separately: tsc PASS; **206 files / 2937 tests**; audit 0 defective cells across 0/67.

## Run 29 — 2026-08-04 — ⚠ Run 28 WAS WRONG: #657 was 91 languages, not fourteen, and the scope was mis-derived

**Question.** "So #657 is done?"

**Command.** The same fleet-wide behavioural probe Run 28's test was built from, but over ALL registered languages
rather than the fourteen: `Cañitas`, `São`, `Klöcker`, asserting *no English letter name in the output AND the word
occupies exactly one token*.

    checked 180 registered languages
    ⚠ STILL FRAGMENTING (91)
    TREATED still fragmenting (28): as az bn ca hr da ff de ha hu is ga ja kn ko lb ml mi fa sr sd es sv te tr ur uz cy
    UNTREATED still fragmenting (63)

**⚠ THE NEGATIVE RESULT, AND IT IS THE IMPORTANT ONE: I replaced a measurement with a grep.** The original probe
that opened #657 reported **42 languages fragmenting** — correct. The work list was then re-derived from
`grep '^const TOKEN'`, which found 21 files, and the two numbers were never reconciled. Every engine not declaring
its tokenizer in that exact shape fell out of scope silently — including `de`, `es`, `sv`, `tr`, `sr`, all of which
the probe had already flagged. Run 28's "the remaining fourteen" was the grep's output, not the defect's extent.

*A structural pattern is a convenience; the measurement is the scope.* This is the same error as the audit's
hardcoded 37-of-67 language list, made four runs after that was written down. The correction is structural, not
resolve-to-do-better: the probe becomes the test, sweeping every code the registry serves, with the remaining
languages named in an allow-list that the test also checks is not stale.

### The 91 classify into two shapes, and 17 of them collapse to 10 edit sites

Two probes per language. `computer` → does the output match English (ROUTES to an injected reader) or is it the
engine's own (NATIVISES)? Then `Ka<accent>o` for each of `ñ ã ö é å ç ł` against its de-accented twin → differs but
does not fragment, so the letter is NATIVE and must survive a fold.

17 routers, 74 nativisers. The routers collapse to ten sites because the engines share modules — `bengali.ts`
serves `bn`/`as`/`bpy`, `sinitic/hanDictIpa.ts` serves `gan`/`hak`/`cjy`/`hsn`.

**`ja`/`ko` are a DIFFERENT defect wearing the same symptom.** Their tokenizers are fine. Their initialism spellers
are bounded by `(?<![A-Za-z])…(?![A-Za-z])`, and an ASCII-only lookaround does not see an accented letter as a
letter — so the `S` of `São` passed the *isolated capital* test and was spelled out as a letter name, leaving the
rest of the name behind: `São` → *esu / ˈʌɔː*, `Sámi` → *ˈesɯ ˈɑːmi*. The fix widens the BOUNDARY, not the matched
class, which is correctly ASCII-caps-only — an initialism is ASCII by definition, but the thing that decides where
one ENDS is not.

### ⚠ The architecture correction, mid-run

> "Shared code for the scanner seems important, so that the limited regex isn't used to decide script-level
> routing. It feels like it should be an early decision and not repeated in multiple places."

That names the class exactly, and it is why widening 108 regexes one at a time was the wrong shape of fix. Each
engine's hand-written letter list —

    const TOKEN = /([a-zäöüßA-ZÄÖÜ]+)|(\d+)|([.!?…,;:])/gu;        // de
    const TOKEN = /([a-zçëA-ZÇË]+)|(\d+)|([.!?…,;:])/giu;          // sq

— was doing two unrelated jobs, and is only correct for one:

1. **which script is this** — a ROUTING question, a property of the script. A letter list is a bad approximation of
   a script: anything it omits falls out of the token, lands in the gap, and `emitUnclaimed` routes it as foreign.
   **One omitted letter re-routes mid-word.** This decision was being made 108 times over and was wrong in all 108.
2. **which letters can I pronounce** — an INVENTORY question, genuinely per-language and genuinely lexical.

`core/hostWord.ts` splits them. `hostWordRun(scripts, extra)` answers (1) from the script, once, so there is no
letter list left to omit a letter from. `makeNativiser(NATIVE_WORD)` answers (2), taking each engine's former token
class verbatim — demoted from a routing decision to what it always was, a statement about which letters the g2p has
rules for. Sixteen copies of `foldToBase`/`nat` collapse into it.

**⚠ AND THE SCOPE LIMIT, measured rather than assumed: shared script scanning cannot fix the 74 nativisers.**
Script routing only ever fires ACROSS scripts. A Portuguese name inside Spanish text is Latin inside Latin — there
is no routing decision to get right and the run correctly stays with the host. What remains is inventory: the g2p
has no rule for `ã` and simply DROPS it, and dropping is not nativising but deleting (`Klöcker` → *klkkeɾ*). So the
shared scanner prevents recurrence of the cross-script class, and the same-script class needs the fold regardless.
Two decisions, two mechanisms, and conflating them is what produced the bug in the first place.

### Applied, and the corpus diff

Ten router sites widened to `LATIN_RUN`; `ja`/`ko` boundaries widened; the sixteen already-treated nativisers
migrated onto the shared module. **91 → 74 fragmenting.** tsc PASS, 206 files / 2937 tests.

Corpus diff against baseline `b0c9882`, the ten router languages that have a FLEURS corpus, every change read:

| lang | changed | what |
|---|---|---|
| as | 2/1961 | `İzmir` *ˈaᶦ tsmˈaᶦɹ* → *ˈɪzmaᶦɹ*; `levé` *lˈɛv ˈiː* → *ɪlˈɛv* |
| bn | 7/1981 | `Cañitas`, `Asunción`, `Erdoğan`, `Guaraní`, `Ürümqi`, `Taínos`, `Guaycurú`/`Payaguá` — all whole now |
| fa | 1/1856 | `Cochamó` *kt͡ʃˈæm ˈoᶷ* → *kt͡ʃˈæmɔː* |
| sd | 1/2009 | `levé` |
| te | 2/1757 | `levé`; `Barça` *bˈɑːɹ sˈiː ˈə* → *bˈɑːɹkə* |
| ko | 2/1746 | `Müslüm`; `Sámi` *ˈesɯ ˈɑːmi* → *sˈæmi* (the initialism-boundary fix) |
| kn ml ur ja | 0 | no accented Latin in those corpora — the fix is real but unattested there |

No defect-class count moved in either direction; all 15 changes are the defect being repaired.

**Negative result worth keeping:** `levé` is the recurring one, and it is the *universal-sentence* technique paying
off in reverse — one French word in one FLEURS sentence surfaces the same defect in `as`, `sd` and `te` at once,
because all three are translations of the same English source. A single attested word is fleet-wide evidence.

## Run 30 — 2026-08-04 — 74 → 11, and the fold semantics were wrong in three separate ways

Mechanical migration of the 74 nativisers: lift each engine's token word class to `NATIVE_CLASS`, derive the
TOKEN word arm from the SCRIPT via `hostWordRun`, wrap the word handler in `nat()`. **62 of the 74 transformed
mechanically** (63 codes, since `es-419` rides on `es`); 11 remain for hand treatment. Result: **91 → 11**.

The transform is scripted, not typed by hand, which is the only reason a 62-language change was reviewable. The
guard that made it safe was refusing to touch anything it could not prove simple — a multi-script word arm, a
tokenizer that is not a top-level `const TOKEN`, a handler that is not `if (m[1])`. Those became the SKIP list
rather than a silent best-effort.

### ⚠ Three defects, each found by the corpus diff and none by any probe or test

**1. `hostWordRun` required a LETTER in lead position, and Hausa writes a leading apostrophe.**

`'yan` is Hausa for "sons of"; the apostrophe carries the glottalisation. Requiring a Latin letter first left it
outside the token, so `ʔʲˈan` came out *jˈan* — the glottal simply gone. The old hand-written classes were FLAT
(`[a-zɓɗƙƴ'’]+`), so everything in them was lead-legal; an engine that instead spelled the join out
(`[X]+(?:['’-][X]+)*`) meant those characters MEDIALLY only. Both shapes have to survive, so `hostWordRun` grew a
`medialOnly` parameter and the transform decides which from the arm's own shape. ha 46 → 15 changes.

*The lead position is not the same question as the continuation, and "one letter, then more letters" reads as
obviously right while being wrong for every orthography with a word-initial mark.*

**2. The fold was ALL-OR-NOTHING PER WORD, so one foreign letter corrupted every other letter beside it.**

Turkish came back at **189/1876 = 10.1% changed**, which is what a fix reaching far too far looks like. `İsveç`
failed the word-level inventory test on `İ`, so the fold also flattened the `ç` to `c` — and Turkish reads `c` as
/d͡ʒ/, so the word read *ɯsvˈed͡ʒ*. `makeNativiser` now judges each character separately.

**And the 10.1% was real anyway.** `İ` (U+0130) has no Unicode simple case-fold to `i` — it folds to `i` + a
combining dot — so the `/i/` flag never made the old class accept it. `İtalya` was fragmenting and reading as
English *"I"* + *talya*; folding it to bare `I` then hit Turkish's DOTLESS capital and gave *ɯtaɫja*, the wrong
vowel. Adding `İ` to the inventory fixes it properly: `g2p.ts` already maps İ→i with the right locale rule, it
just had to be handed the letter. Every one of the 189 is an `İ`-initial Turkish word — `İtalya`, `İngilizce`,
`İran`, `İsrail`, `İmparatorluk`, `İlçe` — previously read as an English letter name. **The largest single-language
win in the issue.** (Azerbaijani hit the identical trap and had already solved it the other way, normalising İ→i
before tokenizing. Two engines, same trap, two independent fixes, and neither knew about the other.)

**3. NFD cannot reach a letter that does not decompose, so the fold left it to be DROPPED.**

`Æthelred` in German read *thˈɛlʁət* — the Æ gone. `æ ø œ ð þ ß ł đ ħ ŋ ɛ ɔ ə ɓ ɗ ƙ ƴ ı` are DISTINCT letters, not
base-plus-mark; NFD leaves them alone, the g2p has no rule, and the letter is deleted. Measured: **86 languages
dropped at least one, roughly 80 languages per letter.** An explicitly typed character is content, and deleting it
is neither nativising nor routing, so `foldLatinToBase` gained a second tier mapping each to the nearest letter
the g2p is guaranteed to read. 86 → 32, and the residual 32 are probe artifacts (the fold target is itself silent
in that language, e.g. Spanish `h`).

⚠ SINGLE LETTERS, NOT the conventional digraphs. `æ`→ae, `ø`→oe, `þ`→th, `ŋ`→ng are the standard ASCII
transliterations, but a g2p reading `ae` as two vowel segments turns one sound into two — worse than an imprecise
single vowel. `ß`→`ss` is the one exception, because that IS the German orthographic identity and every g2p reads
`ss` as a single /s/.

### ⚠ And then the per-character fold exposed something the word-level fold had been hiding

Romanian: `Thérèse` → *ˈthrese*, the é gone. Romanian's class claimed `á é í ó ú à` — but its g2p has no rules for
them. **The word-level fold had been masking the mismatch by accident**: a word containing one was rejected whole,
so everything in it got folded and the over-claimed letter came out readable. Judging characters separately trusts
the class, and the class was lying.

`NATIVE_CLASS` is a CLAIM ABOUT THE G2P, so measure it. Probe every character an engine claims against
`phonemize("ka" + c + "o") === phonemize("kao")`. Eight engines over-claim: **da ro kea mt lb rup ast lg**. Each
had the offending letters removed, and `test/native-inventory.test.ts` now pins it.

⚠ The first version of that probe flagged **fourteen** languages, and six were false positives: `'`, `’`, `ʼ`,
`·`, `‑` and bare combining marks carry no segment, so a g2p ignoring one is CORRECT. Narrowed to `\p{L}` minus
`\p{Lm}` — the modifier-letter apostrophes are letters by Unicode category and punctuation by function.

**Luxembourgish is the second-largest win, and it was invisible until the class stopped lying.** Removing
`à á â ô û ü ö` took lb from 33 to **227/1896 = 12.0% changed**, and every one is a vowel that had been SILENTLY
DELETED: `berühmt` read *bærmt*, `verfügbar` *fərfɡbarə*, `Ostküst` *ostkst*, `Südkoreaner* *stkorəanər*,
`endgülteg` *ændɡltəχ*. Twelve percent of Luxembourgish utterances were missing a vowel.

📌 FOLLOW-UP, recorded rather than papered over: `ü`/`ö` ARE Luxembourgish letters in German loans, and the honest
fix is g2p rules (/y/, /ø/) rather than a fold to `u`/`o`. The fold is strictly better than deletion and is not
the right answer. Same for Luganda's `ŋ` → `n`.

### Corpus diff — 25 languages, every change read

tr 189/1876 · lb 227/1896 · cy 49/2009 · ca 15/1841 · de 26/1956 · hr 21/2007 · sv 20/1863 · ha 15/1497 ·
ro 14/1958 · ga 14/1948 · da 14/1878 · hu 7/1995 · az 3/1919 · is 1/846 · mi 1/1994 · uz 1/1957 · cs 1/1947 ·
it 1/1978 · nb 1/1859 · zu 1/1478 · pl 0 · sk 0 · sl 0 · sw 0 · xh 0

**No defect class moved in either direction in any of the 25.** Every change is a fragment collapsing into a word
or a deleted letter becoming audible: `Cañitas`, `São`, `Klöcker`, `Galápagos`, `Asunción`, `Erdoğan`, `Taínos`,
`Guaycurú`, `Payaguá`, `Chișinău`, `Cochamó`, `Bartolomé`, `Jiménez`, `Fernández`, `Sápmi`, `Sámi`, `Ürümqi`,
`İzmir`, `Æthelred`, `Łódź`, `élevé`, `República`, `Hāngī`, `Halarsvík`, `Guaraníerne`.

The zeroes are as informative as the counts: cs/sk/sl/sw/pl/xh were already correct and the semantics change did
not disturb them, which is what says the per-character fold is a strict refinement rather than a different answer.

### What remains

**11 languages**, all for the reason the transform refused to guess:

| why | languages |
|---|---|
| word arm mixes Latin with a second script | `bs` `sr` (Cyrillic), `bm` (N'Ko), `ff` (Adlam), `su` (Sundanese), `za` (Han) |
| Perso-Arabic OR Latin as two alternatives in one group | `bal` |
| tokenizer is not a top-level `const TOKEN`, or the handler is not `if (m[1])` | `hmn` `nan` `shi` `jv` |

Each needs its scripts named explicitly to `hostWordRun` — mechanical, but a blind widening would let a
MIXED-script run become one token, which is a behaviour change worth not making by accident.

Gates run separately: tsc PASS; **207 files / 2940 tests**; audit 0 defective cells across 0/67.

## Run 31 — 2026-08-04 — the last 11, and #657 reaches ZERO

The eleven the transform refused to guess at, done by hand. Result: **`✓ none fragment an accented Latin word`**
across all 180 registered languages. `REMAINING` in `test/latin-tokenizers.test.ts` is now empty, and the sweep
fails in BOTH directions so it cannot be repopulated to quiet a regression.

| language | shape | treatment |
|---|---|---|
| `sr` `bs` | Cyrillic + Latin in one class | `hostWordRun(["Latin"], "а-шђјљњћџ")` — the Cyrillic range stays as literal class content, so the widening touches only the Latin half |
| `bm` | Latin + N'Ko | `hostWordRun(["Latin", "Nko"])` — bm IS the fleet's N'Ko engine, so the full script is right |
| `ff` | Latin + Adlam | `hostWordRun(["Latin", "Adlam"])` |
| `su` | Latin + Sundanese | `hostWordRun(["Latin", "Sundanese"])` |
| `shi` | Latin + Tifinagh | `hostWordRun(["Latin", "Tifinagh"])` |
| `za` | Latin arm with `'` join; Han is a separate arm | `hostWordRun(["Latin"], "", "'")` |
| `bal` | Perso-Arabic OR Latin as two alternatives | kept the alternation, widened only the Latin arm |
| `hmn` | tokenizer is a local `const tok` | same treatment, inventory at module scope |
| `jv` | handler is `if (m[1] \|\| m[2])` | ⚠ only group 1 nativises — group 2 is the Aksara Jawa run, this language's OWN script, where there is no inventory question to ask |
| `nan` | Latin arm is group 3, with a hyphen join | `hostWordRun(["Latin"], "", "-")` |

### ⚠ `\p{Script=X}` INCLUDES X'S DIGITS, and the word arm precedes the number arm

Widening bm and ff to their second scripts broke both languages' native-digit tests: N'Ko's ߀–߉ are
`Script=Nko` and Adlam's 𞥐–𞥙 are `Script=Adlam`, so the script-derived word class silently swallowed every
native-digit numeral before the number arm could see it. `hostWordRun` now refuses digits outright
(`(?!\p{Nd})` per position — `[\p{Script=Nko}--\p{Nd}]` says it directly but needs the `v` flag, which these
tokenizers do not use).

*This is the multi-script hazard the transform's SKIP list existed to avoid, and it landed anyway on the very
languages the list deferred — which is the argument for the list, not against it: the failure surfaced in two
existing tests instead of in a corpus nobody diffed.*

### The Serbian `й`, and a probe that measured its own frame

The inventory audit flagged `sr`/`bs` for claiming `й`, `у` and `х`. Two of those three were the PROBE'S FAULT.
It built `ka` + letter + `o`, and sr/bs write both Cyrillic and Latin with the engine choosing a script PER WORD
— so `kaуo` is a mixed word no orthography contains, and the engine drops the minority script's letter. `ухо`
reads *uxo* and `хвала` *xʋala*, both perfectly. The frame now matches the letter's script.

`й` survived the corrected probe and is a REAL over-claim: the old class used the coarse range `а-ш`, which
sweeps up `й` — a Russian letter this orthography does not have (it writes `ј`, U+0458, outside the range and
listed separately). Excluding it hands the letter to the fold, and `й` DOES decompose (и + combining breve), so
`Толстой` now reads *tolstoi* instead of losing its final letter. ⚠ The TOKEN deliberately stays wide: claiming
the whole Cyrillic run is the SCRIPT question, and getting that right is what puts the letter in front of the
fold at all.

### "Mixed script words might need a Latinizer?" — mostly already there, and the gap is elsewhere

Asked mid-run, and worth answering with a measurement. `kaуo` **already** becomes `kayo`: `foldLatinConfusables`
maps a Cyrillic/Greek look-alike sitting between two Latin letters to its Latin twin, and it runs in the registry
pipeline for every language before any tokenizer sees the text.

⚠ AND NOTE IT FOLDS BY SHAPE, NOT BY VALUE — `у` → `y` because it LOOKS like one, though Serbian `у` SOUNDS like
`u`. That is the right call for the case it exists for (a homoglyph typo, where the author meant the Latin
letter); it would be the wrong call for genuine transliteration. Two different operations that happen to have the
same input.

For genuine cross-script text the SCRIPT ROUTER is the better answer than transliteration, because routing
preserves the source phonology instead of approximating it. A Serbian↔Latin transliterator would be defensible —
that mapping is bijective and standardised — but it buys little: real text writes whole words in one script, and
the router already handles whole words.

**The actual gap the question uncovered is not cross-script at all.** `phonemize("kayo", "sr")` returns *kao* — the
`y` is DROPPED, because Serbian's class claims all of `a-z` while Serbian Latin has no `q w x y`.

### 📌 A separate defect, measured: 43 engines claim `a-z` and drop part of it

    sr hr bs   drop q w x y          ak   drops c j q v x z
    mi         drops b c d f g j l q s v x y z   (thirteen of twenty-six)
    qu         drops b d f g v x z    naq  drops c f q v y z    tk  drops c q x

So `Cañitas` keeps its `ñ` now and still loses its `C` in Maori.

⚠ NOT the same fix, and that is why it is not in this issue. Folding an accent has a UNIVERSAL answer — strip the
mark and the base letter is right everywhere. An absent ASCII consonant has none: `q`→k, `w`→v or u, `x`→ks,
`c`→k or s are per-language substitution choices needing sourcing, and for several of these languages the better
answer is to ROUTE the foreign name to a reader rather than nativise it at all.

⚠ AND SOME OF THE 43 ARE CORRECT SILENCE, NOT LOSS. Spanish/Italian/Catalan/Galician/Occitan/Latin `h` IS silent.
Worse, my probe's own frame manufactures false positives: testing `a` builds `kaao` and testing `o` builds `kaoo`,
which gemination and vowel-length rules make identical to `kao` — that is the whole of German's "drops a h o q"
and Maltese's "drops a h o". The finding needs per-language judgement, not a table, which is exactly why the
inventory test states the ASCII exemption explicitly rather than leaving it to look like coverage.

### Corpus diff, the last two with corpora

sr 2/1923 (`élevé`, `Ōō`) · ff 13/1500 (`Bé`, `Ōō`, `São`). No defect class moved either way.

Gates run separately: tsc PASS; **207 files / 2940 tests**; audit 0 defective cells across 0/67.

## Run 32 — 2026-08-04 — self-review: four defects in my own fix, and one over-reach I reverted

Reviewing the branch before merge, with checks aimed at the failure modes a corpus diff CANNOT see — the ~150
languages with no corpus. Six mechanical checks over every engine carrying a `NATIVE_CLASS`: case coverage, lead
vs medial, numbers still tokenizing, punctuation still reaching the clause machinery, the fold actually taking
effect, and transform leftovers.

### 1. ⚠ NFC DEFEATS A CLASS WRITTEN AS BASE + COMBINING RANGE

The worst of the four, and it silently deleted a TONE. `makeNativiser` normalised each cluster to NFC and tested
it against ONE class occurrence. Tâi-lô tone 8 is base + U+030D COMBINING VERTICAL LINE ABOVE, which composes to
nothing, so NFC leaves the cluster two characters long and a single-occurrence test rejects it — the fold then
stripped the tone it was asked to protect. `ta̍k` read *tak*, while `tâi` (precomposed) kept its tone. **A tone
language quietly losing one tone is as bad as this layer gets.** Fixed with `+`: the question is "is every
character of this cluster in the inventory", not "is this cluster one class match".

### 2. ⚠ AND THE GENEROUS-LOOKING FIX FOR (1) BROKE IT THE OTHER WAY

My first fix also tested the DECOMPOSED form, on the reasoning that a class may spell an accent either way and
both should be honoured. That makes every combining-range class enormously over-permissive: `ñ` decomposes to
`n` + U+0303, U+0303 sits inside Tâi-lô's `̀-̍`, so `ñ` was judged NATIVE, escaped the fold, reached a g2p with
no rule for it and came out **verbatim** — `Cañitas` in Min Nan read *cañitas˥*, raw orthography in the phoneme
string. Min Dong and Tashelhit the same.

*A range written for six tone marks cannot be read as a licence for every mark in its numeric span.* NFC only.

### 3. ⚠ THREE CLASSES LISTED THEIR ACCENTS IN LOWER CASE ONLY

Welsh was missing ten capitals (`ÀÈÌÒÙÏËÖÄÜ`), Min Nan five (`ÀÁÂĀǍ`), Balochi the combining caron. Inherited
from the original token classes, and HARMLESS while the class only decided tokenization — the capital fell out of
the token and fragmented, which is the defect this issue is about. It becomes a silent DELETION the moment the
same class drives the fold. `TÂI` lost the tone `tâi` kept.

*A latent data gap becomes a live defect when you give the data a second job.* Found by checking every class
against the upper case of its own letters — no corpus involved, and cy/nan's corpus diffs did not move.

### 4. ⚠ A GUARD THAT EDITS ITS INPUT IS NOT A GUARD

`hostWordRun` documented "put `-` last" and left it to the caller. The very next caller passed `"-·"` and
produced `[\p{M}-·]` — a range from a property escape, a hard SyntaxError at first use. So I made the function
move every `-` to the end, which looks robust and **silently destroyed a legitimate range**: `sr`/`bs` pass their
whole Cyrillic alphabet as `"а-шђјљњћџ"`, and helpfully relocating that hyphen collapsed `а-ш` to `аш` and
dropped twenty-two letters out of the inventory. The over-claim test caught it immediately (22 findings for sr).
Replaced with VALIDATION: compile the class at construction and throw a named error. A constraint a caller can
silently violate belongs in the callee — but enforcing it must not mean rewriting what the caller meant.

### 📌 AND ONE OVER-REACH, REVERTED

The leak probe found `cdo` (Min Dong) emitting *cañitas˥˥*. It is a REAL leak — and identical on `main`, because
cdo never fragmented and so was never in this issue's scope. I applied the standard treatment anyway and **broke
two real tests**: cdo's class expresses its own letters as base plus a combining range, and NFC composes several
of them into precomposed forms the class does not list, so the fold destroyed `ṳ` (U+1E73, read /y/) and `ø̤`.
Narrowing that range needs Bàng-uâ-cê orthographic sourcing — evidence, not a table.

Reverted, and the leak test is explicitly scoped to engines that DECLARE an inventory, with the reason stated at
the assertion so the exclusion is not mistaken for coverage. *Taking a pre-existing, out-of-scope defect and
fixing it mechanically without the sourcing is how a clean change acquires a regression.*

### Probes that measured their own frames — a running tally, because this keeps happening

Four times on this issue now. The leak probe alone was wrong twice more in this run: first it flagged **139**
engines by treating any combining mark as orthography, when combining marks are ordinary IPA diacritics
(`t̬` voicing, `ɐ̃` nasalisation, `t͡s` the affricate tie). Narrowed to precomposed letters, it flagged **99**,
because `æ` is a phoneme. Narrowed to letters that are NEVER IPA, it flagged **9**, of which **5 were still
wrong**: `ã õ ĩ ũ` are nasalised vowels (`gn`, `ee`, `umb`, `yo` all emit them correctly) and `è ì` are this
repo's own pitch-accent notation — `sv` marks accent 2 with a grave.

139 → 99 → 9 → 1 real finding. *Every intermediate number looked like a discovery.*

### Verification

All 27 corpus diffs re-run after the fixes: byte-identical to the verified numbers, no defect class moved.
Gates run separately: tsc PASS; **207 files / 2943 tests**; audit 0 defective cells across 0/67; probe
`✓ none fragment an accented Latin word`.

## Run 33 — 2026-08-04 — #663: the orthographic fold is the WRONG MECHANISM, and Uzbek proved it in one test

### Step 1, re-measuring, because the 43-engine list was known-contaminated

Two frame bugs had to be fixed before the number meant anything.

**Aliasing.** The original probe used one frame, `ka` + L + `o`, compared against `kao` — so testing `a` built
`kaao` and testing `o` built `kaoo`, which gemination and vowel-length rules collapse to `kao`. That was the whole
of German's reported "drops a h o q" and Maltese's "drops a h o". Fixed by choosing, per letter, only frames whose
own characters are DISJOINT from the letter under test.

**Position.** The replacement frames were all INTERVOCALIC (`mi_ru`, `se_la`, `to_pi`), and German `h` is silent in
exactly that position while being perfectly pronounceable word-initially. So the probe reported German, Spanish,
Italian, Catalan, Galician and six more as "dropping h" when it had measured a CORRECT contextual silence. Fixed by
spanning initial, medial and final, and requiring EVERY usable frame to agree.

Result: **45 engines**, `x` in 30, `q` in 29, `c` in 17; Maori missing thirteen of twenty-six. Six of the 45 are
`h`-only and almost certainly correct silence (Italian, Galician, Aragonese, Asturian write `h` and read nothing).

### Step 2 built the wrong thing

`core/latinFallback.ts`: a central letter→LETTER table (`q`→k, `x`→ks, `c`→k), applied transitively by
`makeNativiser` when the fold's output was still unreadable, with per-language overrides (Maori `s`→`h`, since
Maori borrows /s/ as /h/ — `Christmas` → `Kirihimete`). Two self-inflicted defects on the way, both caught by my
own checks:

· **A total table cycles where a measured-only one could not.** `k`↔`t`, `m`↔`n`, `e`↔`i`, `o`↔`u` — each row
  individually right, collectively useless, because the cycle guard stops the oscillation and then leaves the
  letter ALONE. `Cañitas` in a Maori-like inventory came back *Canitat*, the `C` untouched. Fixed by making the
  rows a DAG onto six terminals.
· **`u` is not a terminal.** I wrote the terminal set from what LOOKS basic (`a i u t n`) rather than from the
  measurement — and Malagasy is measurably missing `u`, so `u`→`o` and `o`→`u` ended up in the same table.
· And the acyclicity CHECK was wrong too: a global visited-set calls RECONVERGENCE a cycle, and `x`→`ks` reaches
  `t` through both `k` and `s`. It rejected the correct table. DFS with an on-path set.

### ⚠ AND THEN 10 TESTS FAILED, and the failure is the whole argument

Removing a letter from an engine's `NATIVE_CLASS` is what lets the fold reach it. Uzbek cannot read a bare `c`, so
`c` came out of the class — and **Uzbek writes /t͡ʃ/ as the DIGRAPH `ch`**. Every Uzbek ordinal broke:

    ikkinchi   →  ikkinkhi        (t͡ʃ → kh)
    uch        →  ukh
    kichik     →  kikhik

*A letter can be unreadable ALONE and essential as part of a sequence.* The inventory is per-character; a g2p reads
sequences. Croatian, Luxembourgish, Maori and Serbian broke the same way — 10 tests across 5 files.

That is not a bug in the table. It is a bug in the LAYER: an orthographic substitution runs before the g2p, so it
rewrites the spelling the g2p is about to read, and any multigraph is collateral damage.

### 📌 THE REDIRECTION, and it is the right one

> "My original idea was that phones unknown to a language would still be available. So even if Ç/ç appeared in a
> word where that diacritized letter form isn't in the language, the g2p could phonemize it with sound. I figured
> there wouldn't be a need to describe out-of-language overrides, and that those centralized phonetics would be
> used."

A central letter→**PHONE** table, consulted by the g2p when it has no rule, rather than a letter→letter table
applied before it. That fixes both defects of what I built:

| | orthographic fold (built, reverted) | central phones (the redirection) |
|---|---|---|
| digraphs | DESTROYS them — `ch`→`kh` | untouched; the g2p still sees `ch` and its own rule wins |
| per-language data | NEEDED, because folding to a host letter is lossy in language-specific ways (`mi` s→h) | none — the letter keeps its own sound |
| `ç` in Maori | →`c`→`k`, the sound is gone | /t͡ʃ/, the sound survives |
| voice inventory | never leaves the host's phone set | may emit a phone the host voice lacks — accepted deliberately |

The last row is the real trade and it is now a recorded decision rather than an accident: a Maori voice may not
render /t͡ʃ/, and preserving the source sound is judged worth that.

⚠ The hook is the open question, and it is not free: the g2p is the layer that KNOWS it has no rule, and there are
45 of them. A post-hoc "did a letter vanish" check on the output would be fragile in exactly the way these probes
keep being fragile. So this needs a look at how many engines share a g2p helper before it is scoped.

Reverted to `ad3fb37`; the measurement is preserved in the issue. tsc PASS, 207 files / 2943 tests.

## Run 34 — 2026-08-04 — #663: positional ⟨x⟩, and MEASURING which languages are strict CV instead of guessing

### ⟨x⟩ is /z/ word-initially

`x`→/ks/ is the letter's value between or after vowels (`Xerox` → *…oks*, `taxi`), but no language that borrows
⟨x⟩ begins a word with the cluster — `Xerox`, `xylophone`, `Xanthe` all start /z/. Emitting /ks/ there manufactured
an initial cluster the SOURCE language does not have either, which is the worst case: illegal in the host and wrong
about the loan. `latinPhone` now takes the position; `ak Xerox` → *zeroks*.

⚠ And it correctly does NOT fire where a language has its own ⟨x⟩ rule: Albanian reads ⟨x⟩ as /d͡z/ and Uzbek as
/χ/, so `sq Xerox` → *ˈd͡zɛɾod͡z* and `uz axis` → *aχˈis* — untouched, because the fall-through is never reached.
That is the placement doing its job.

### ⚠ "The suspicious ones should be measured/routed" — measured, and my assumption was wrong

I had assumed the routing set was "engines missing many letters": mi 13, qu 7, naq 6, ak 6, mad 5, yo 5, mg 5.
That is a proxy for the wrong property. What makes the letter-level floor produce ILLEGAL output is strict CV
phonotactics — no codas, no clusters — and letter count does not measure that.

Measured from each language's OWN text (corpus where one exists, lexicon/manifest otherwise), the share of words
ending in a consonant:

| lang | letters missing | word-final consonant |
|---|---|---|
| **mi** | 13 | **4.9%** |
| hr | 4 | 23.2% |
| ff | 3 | 26.5% |
| nso | 3 | 45.8% |
| uz | 2 | 51.7% |
| az | 1 | 60.2% |
| lb | 1 | 83.8% |

**Māori is the only strict-CV engine in the set, by a factor of five** — and it is already routed. Every other
measurable language permits codas freely, so the floor produces legal forms and routing would be a regression, not
an improvement. Letter count and phonotactic restrictiveness are not the same axis: `ff` is missing three letters
and permits codas at 26.5%; `mi` is missing thirteen and permits them at 4.9%.

⚠ AND MY CLUSTER METRIC WAS CONFOUNDED, so only the coda figure is load-bearing. A crude vowel/non-vowel test
counts Māori's own ⟨ng⟩ and ⟨wh⟩ digraphs as consonant clusters, which is why Māori shows 30.8% "clusters" while
being the strictest CV language in the fleet. The digraph is one segment; the metric cannot see that.

⚠ NO EVIDENCE FOR SEVEN OF THE CANDIDATES. `naq qu ak mad yo mg` and several others have under 400 words of native
text available, so they are absent from the table entirely — not passing it. Deciding to route them would be acting
on the letter-count proxy I have just shown does not measure the property. Recorded as needing corpus data.

Gates run separately: tsc PASS; 207 files / 2943 tests; audit 0 defective cells across 0/67.

## Run 35 — 2026-08-04 — #663 complete: 45 engines → 9, and all nine remaining are by design

The last three fall-through idioms hooked (`az kl kaa naq ltg`, then `mg tk crh`). Behavioural measurement across
every registered language: **45 engines dropping an ASCII letter → 9**, and each of the nine is deliberate:

| remaining | why |
|---|---|
| `gl it quc an ast wo` | ⟨h⟩ ONLY. Written and read as nothing in those orthographies; the table declines `h` by default and these engines never opt in. Correct silence, not loss. |
| `sr hr bs` | Deferred to the normalization work. They share one Serbo-Croatian g2p, and `35°W` normalises to `stepeniW` — the degree rule consumes `°` and leaves the compass letter ATTACHED to the previous word. Voicing it reads *stepeniw*; the right answer is the Serbian word for "west", which is normalization vocabulary, not a phone. |

Residual letters: `h` 6, and `q w x y` only via the three deferred engines. From `x` in 30 engines and `q` in 29.

### Four g2p idioms, none of them findable by grep

The scan loops fall into four shapes, and locating them by pattern-matching found 8 of 41 — the same "structural
pattern instead of a measurement" error as #657, made again:

1. `if (ph !== undefined) push; i += 1;` — the fall-through is the IMPLICIT else, so augmenting the LOOKUP
   (`G[c] ?? latinPhone(c, …)`) is the whole hook (14 engines)
2. `if (!matched) i++;` — an explicit miss branch on a longest-match loop (14 engines)
3. a commented `i += 1; // unknown → skip` at the end of a long if/continue chain (9 engines)
4. `for (let i = 0; …; i++)` with NO fall-through statement at all — the increment is the loop header, so the
   branch has to be written (8 engines)

### ⚠ And ⟨q x⟩ IN THE OUTPUT IS USUALLY CORRECT, which broke my leak probe a fifth time

`crh Quixote → quiksoˈte`, `az Xerox → xeɾˈox`, `kaa → χeˈroχ`, `naq → xerox` all keep a ⟨q⟩ or ⟨x⟩ — and every one
is that language's OWN rule firing, because /q/ and /x/ are their phonemes. The fall-through was never reached.
A probe that flags "a letter that looks like orthography" cannot distinguish orthography from a phonetic alphabet
that is itself written in Latin letters. Fifth time on these two issues; the lesson is that IPA is Latin.

Gates run separately: tsc PASS; 207 files / 2943 tests; audit 0 defective cells across 0/67.
