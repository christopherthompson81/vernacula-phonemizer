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
