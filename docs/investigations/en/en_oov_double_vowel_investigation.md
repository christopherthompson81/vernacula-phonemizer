# en OOV: a vowel doubled before a diphthong — "Croydon" → kɹˈɑːɔᶦd̬ɑːn (#1260)

#1260 reports en-GB reading Croydon as *kɹˈɒɔᶦdɒn* — a spurious vowel before the CHOICE diphthong plus a
failure to reduce the final syllable — and calls the GenAm reading correct. This log establishes where the
defect actually lives before touching anything.

## Run 1 — 2026-09-04 14:10 — it is not the accent delta, and the US reading is only correct on one path

```
npx tsx -e '…phonemize(w,"en") / phonemize(w,"en-GB") / phonemizeAsync(…)'   over CHOICE words
```

```
word      en (sync)        en-GB (sync)     en (ASYNC)       en-GB (ASYNC)
Croydon   kɹˈɑːɔᶦd̬ɑːn      kɹˈɒɔᶦdɒn        kɹˈɔᶦd̬ən         kɹˈɒɔᶦdɒn
Boydon    bˈɔːɔᶦd̬ɑːn       bˈɔːɔᶦdɒn        bˈɔᶦd̬ən          bˈɔːɔᶦdɒn
Croyd     kɹˈɑːɔᶦd         kɹˈɒɔᶦd          kɹˈɔᶦd           kɹˈɒɔᶦd
Roydon    ɹˈɔᶦd̬ən          ɹˈɔᶦdən          ɹˈɔᶦd̬ən          ɹˈɔᶦdən         ← in g2p-dict.tsv (R OY1 D AH0 N)
boycott Boyd Lloyd Floyd toyed void avoid point joint coin oil boil Doyle Hoyt — all correct on every path
en-IN     kɾˈɑːɔɪɖɑːn (sync and async)        pcm  kɾojdon
```

Three facts:

1. **The doubled vowel is GenAm's, not en-GB's.** `toRP` maps `ɑː→ɒ` (LOT) and un-flaps `d̬→d`, so
   *kɹˈɒɔᶦdɒn* is exactly *kɹˈɑːɔᶦd̬ɑːn* through the delta. The "reduction failure" is the same thing: the
   final syllable was never `ən` — the n-gram gave it `ɑːn`, and LOT turned that into `ɒn`.
2. **It is the sync n-gram OOV G2P.** Roydon is fine only because it is in the dictionary. Croydon and
   Boydon are OOV, and the n-gram reads ⟨o⟩ as a vowel AND ⟨oy⟩ as the diphthong — the ⟨o⟩ consumed twice.
3. **`en` is correct on `phonemizeAsync` because that path routes OOV words through the neural tagger
   first** (english.ts `oovOverride`, "async neural path only"). The accent variants compose on
   `createEnglish().text(...)` and never see the override, so their async reading is the sync one. The
   corpus is built with `phonemizeAsync`, which is why the issue saw en-GB wrong and en right — it compared
   a neural reading with an n-gram one.

Implication: two defects, in two places. (a) The n-gram double-consumes a vowel letter before a vowel
digraph, in the sync path every English user gets. (b) en-GB / en-IN do not engage the neural OOV path that
`en` does on async. Fixing (b) alone makes the issue's 12 tokens go away in the corpus and leaves (a) for
every sync caller; the next runs measure how big (a) is.

## Run 2 — 2026-09-04 14:35 — the mechanism: one letter per step, and a penalty for a vowel letter that says nothing

```
e.g2p.decompose(w)     # the n-gram's ARPABET, with the path that produced it (C dict / M morphology / N n-gram)
```

```
croydon  N  K R AA1 OY2 D AA0 N     croy   N  K R AA1          ← ⟨y⟩ says nothing, ⟨o⟩ says AA
boydon   N  B AO1 OY2 D AA0 N       boyd   N  B AO1 OY2 D      ← ⟨o⟩ says AO, ⟨y⟩ says OY: both
roydon   N  R OW1 OY2 D AA0 N       hoyle  N  AA1 OY2 L        (roydon forced through the n-gram, dict bypassed)
coyle    N  K OY1 L                 broyles N B R OY1 L Z      ← the right analysis exists and wins here
```

The decoder (`ngramDecode`) walks the word ONE LETTER AT A TIME; each letter emits a chunk of zero or more
phones, scored by a 5-gram over `letter:chunk` tokens. `graphemeChunks.o` contains `OY1`/`OY2` and so does
`graphemeChunks.y` — the training alignment put the diphthong on either letter — so for ⟨oy⟩ the model has
two right analyses (`o:OY y:""`, `o:"" y:OY`) and the wrong one above (`o:AA y:OY`). What tips it: a vowel
letter that emits nothing is penalised (`evp` = 5 nats) unless the n-gram found a context of order ≥ 3 for
it (`evpOrder`). After an unseen onset like ⟨cr⟩/⟨b⟩+⟨oy⟩+⟨d⟩ the context backs off below that, the empty
chunk on ⟨o⟩ costs 5, and the beam buys its way out by making ⟨o⟩ say a vowel and letting ⟨y⟩ say the
diphthong. `croy` shows the mirror: ⟨y⟩ word-final emits nothing (that is common, so no backoff, no
penalty) and ⟨o⟩'s vowel stands alone — `kɹˈɑː`, the diphthong lost outright.

So the unit is right but the guard is blind to digraphs: the empty-vowel penalty exists to stop the model
swallowing a syllable, and a vowel letter inside a vowel DIGRAPH is exactly where "nothing" is the correct
emission. Run 3 measures how often this fires across the whole dictionary before deciding what to change.

## Run 3 — 2026-09-04 15:20 — the mechanism, second try: the tables are pruned to four continuations

Run 2's hypothesis (the empty-vowel penalty tips the beam) was tested by exempting the penalty inside a
vowel digraph, and by adding an anti-hiatus penalty on top — neither moved a single word. A beam trace
(`G2P_DEBUG`) showed why:

```
[c] K=-2.8 | =-16.1 | S IY2=-16.1 …
[r] K R=-4.9 | K ER0=-18.9 | K=-18.9 …
[o] K R AA1=-7.5 | K R AO0=-21.1 | K R OW2=-21.1 | K R AO2=-21.1 | K R OW1=-21.1      ← everything but AA1 is at the FLOOR
[y] K R AA1=-23.6 | K R AA1 IY0=-23.6 | K R AA1 EY1=-23.6 …                            ← every continuation at the floor
[d] K R AA1 OY2 D=-28.0 | K R AA1 EY0 D=-28.6 | K R AA1 D=-39.7 …                      ← `d:D` after `o:AA1 y:OY2` IS a known context
```

Every alternative to `o:AA1` after `k:K r:R` scores log(1e-7) — not backed off, floored — and so does every
`y` continuation after it. Then `d:D` happens to be a stored continuation of the context `o:AA1 y:OY2`, and
that one real score (−4.4 against the floor's −16) decides the word. The doubled vowel is not chosen; it is
the only path that ever found a table entry.

The reason is in the shipped model, not the decoder:

```
g2p-model.json: 54,405 contexts; c = top-K continuations, K ≤ 4:  len 1 ×37,269  2 ×7,282  3 ×2,990  4 ×6,864
mass kept per context (t ≥ 100): median 0.628, min 0.207
'0|'      t=782,545  c has 4 tokens (e: n:N t:T …) — no OY token in the UNIGRAM table at all
'1|r:R'   t=31,577   c has 4 tokens — no o:… continuation
y:OY1 is predicted in 29 contexts (^ b:B o:, p:P l:L o:, ^ r:R o:, j:JH o:) — boy, ploy, roy, joy work; croy, hoyle do not
```

`tools/english/en_g2p_ngram.ts --emit` writes each context's continuations `.slice(0, 4)` (line 493). A
5-gram whose every context keeps four tokens and whose unigram table keeps four tokens has no backoff to
speak of: a word outside a covered context lands on a floor where all chunks tie, and the tie is broken by
whichever later context happens to exist. That is the `croydon`/`hoyle`/`boyd` class exactly, and the
`croy → kɹɑː` class too (⟨y⟩ emits nothing because `y:` is one of the four things the context knows).

Implication: the fix is the emitted table's width, measured — retrain with a larger K and score the whole
dictionary, watching word accuracy, the spurious-VV count, and the model's size (2.8 MB today, loaded by
every English caller). Run 4 gives the baseline on the current model.

## Run 4 — 2026-09-04 16:10 — defect (b) closed, and the shipped model scored as shipped for the first time

**(b) The accent variants now take the neural OOV reader on the async path.** `phonemizeEnNeural` accepts the
variant's host and per-word delta; `neuralRegistry` gains `en-GB` and `en-IN` entries; en-GB and en-IN export
the hook `createEnglishGB`/`createEnglishIN` already pass to `text()`.

```
                  sync              async (before)     async (after)
en-GB Croydon     kɹˈɒɔᶦdɒn         kɹˈɒɔᶦdɒn          kɹˈɔᶦdən
en-GB Boydon      bˈɔːɔᶦdɒn         bˈɔːɔᶦdɒn          bˈɔᶦdən
en-IN Croydon     kɾˈɑːɔɪɖɑːn       kɾˈɑːɔɪɖɑːn        kɾˈɔɪɖən
en-GB sentence    …kɹˈɒɔᶦdɒn ɪn nˈaᶦntˈiːn nˈaᶦnti sˈɛvən æt sˈɪksti mˈaᶦɫz pʰɜː ˈaᶷə   → only the OOV word moves
```

That is the issue's 12 corpus tokens. It is not the n-gram.

**(a) The shipped n-gram, scored on the trainer's own held-out tenth, AS EMITTED** (`scratch/ngram_bench2.mts`
— the pruned `g2p-model.json` through the runtime decoder, 11,748 words):

```
word-acc (with stress)  25.36%      word-acc (segments)  29.20%      PER  24.00%      spurious VV  1,601 (13.63%)
```

⚠ **The trainer never scored this.** Its held-out accuracy (the 18.2% PER the englishNeural.ts header quotes for
the n-gram) is computed on the IN-MEMORY tables before `--emit` prunes them; `--emit` exits before the eval runs.
The model every sync English caller uses — and, until this run, every en-GB/en-IN async caller — has a 24% phone
error rate on held-out words and doubles a vowel in one word in seven. The top-4 pruning is the whole gap.

Next: retrain with `--topk 8 / 16 / 32 / 0` (the trainer now takes the width as an argument; 4 stays the default
until measured) and score each emitted model the same way — word accuracy, PER, spurious VV, and size, since the
model is loaded by every English caller and by the C# port too (`English.cs` reads the same JSON).

## Run 5 — 2026-09-04 16:40 — the whole dictionary through the pruned model, and the retrain reproduces it

```
npx tsx scratch/ngram_bench.mts        # all 117,479 dict headwords forced through the shipped model (empty dict)
CMUDICT=… EN_FREQ=data/languages/english/g2p-common.txt npx tsx tools/english/en_g2p_ngram.ts --comp --morph --emit scratch/model_k4
cmp scratch/model_k4/g2p-model.json data/languages/english/g2p-model.json     → byte-identical
```

All words (training and held-out together, so the number is generous to the model):

```
exact (segments) 32.57%      truth has adjacent vowels in 12,601      output has them in 24,209
SPURIOUS adjacent vowels: 15,090 words = 12.84%
top pairs   IY AH 516   AH AH 485   AH ER 484   IH ER 470   UH ER 402   AE AH 360   ER AH 349   AE UW 324
by spelling ⟨au⟩ 992  ⟨ou⟩ 901  ⟨ai⟩ 736  ⟨ie⟩ 606  ⟨oo⟩ 601  ⟨ea⟩ 586  ⟨ei⟩ 360  ⟨ay⟩ 350  ⟨oi⟩ 190 — and 6,255 with NO digraph
aaberg   AH AH B ER G      truth AA B ER G          aalborg  AH AE L B AO R G   truth AO L B AO R G
aachen   AH AA K AH N      truth AA K AH N          aalsmeer AH AH L Z AH M EH ER  truth AA L S M IH R
```

So ⟨oy⟩ is a small corner (190) of a class that fires on one word in eight: every vowel digraph, and — the
6,255 — single vowel letters too, where a letter emits a vowel because the empty chunk is not among the four
the context kept. It is one mechanism, Run 3's, everywhere.

The K=4 retrain from the same CMUdict with `--comp --morph` reproduces the shipped `g2p-model.json` **byte for
byte** (and the dict body), so the shipped model's provenance is now known and the wider-K runs below are
measured against the true baseline rather than a re-aligned one. `--topk` was added to the trainer for this;
its default stays 4 until Run 6 says otherwise. (The first launch of the wider runs forgot to pass the flag
and produced four identical 2.8 MB models — caught by the sizes, relaunched.)

## Run 6 — 2026-09-04 17:30 — width against accuracy, held-out, as emitted

```
scratch/train2.sh  (--topk 8 16 32 0, each ~150 s, run in parallel)  →  scratch/ngram_bench2.mts on each emitted model
```

```
top-K   size    word-acc(stress)  word-acc(segments)  PER      spurious VV        croydon
4       2.8MB   25.36%            29.20%              24.00%   1,601 (13.63%)     K R AA1 OY2 D AA0 N   ← shipped
8       3.0MB   33.82%            38.80%              19.41%     919  (7.82%)
16      3.1MB   40.40%            45.87%              16.19%     669  (5.69%)
32      3.2MB   45.00%            51.41%              14.32%     581  (4.95%)
all     3.3MB   47.20%            53.25%              13.71%     634  (5.40%)     K R OY2 D AA1 N       ← taken
```

The pruning was costing the model nearly half its word accuracy for half a megabyte. `all` (no top-K; the
`minCount 3` floor still applies) is taken: best PER and word accuracy, and the 0.45% more spurious VV than
K=32 is 53 words against 260 more exact words. The remaining 5.4% is the model's real ceiling on this class,
not an artefact — those are hiatus decisions the n-gram gets wrong on its own merits.

Note what `all` says for `croydon`: `K R OY2 D AA1 N` — the doubled vowel is gone, but the stress is on the
wrong syllable and the last vowel is a full `AA`, not the schwa. That is the n-gram being a 47% model; the
BiLSTM reads it as `kɹˈɔᶦd̬ən`. The sync path is better, not right, and the corpus path (async, now with the
tagger for en-GB too) is the one that is right.

The C# port loads the same JSON, so its OOV readings move identically; parity and a full golden re-render
follow, since any golden with an English OOV run through the n-gram will change.

## Run 7 — 2026-09-04 18:40 — what the new model moved, and what only looked moved

Full TS suite on the unpruned model: 9 failures in 8 files, three kinds.

**Pins of the old model's readings** (retargeted, each judged): hmong `Zamenhof` *zˈæmənhf* → *zˈæmɪnhəf*;
minnan `Ukraina` *ˈuːkɹæˌiːnə* → *ʌkɹˈeᶦnə*; cherokee `km` *ˈʊkm* → *kʰˈʌm* (a leak either way, which is
what that test pins); enNeural's "the tagger differs from the n-gram" example, Zelensky, no longer differs —
the n-gram now reads it as the tagger does — so the example is Croydon; foreign-runs' `caboolture` likewise.

**Instruments that depended on the old model by accident.** `test/rate-denominator.test.ts` and
`test/rate-half-reading.test.ts` recognised a RAW unit in a host's output by comparing tokens with
`phonemize("kg", "en")` — which the pruned model happened to return as the literal `kɡ`. The new model says
*kʰˈɪŋ* for `kg` (and *kʰˈʌm* for `km`), so sixteen languages whose output had not changed by a byte were
suddenly "spoken" and five were "now reading". Both instruments now recognise the raw unit by its LETTERS
(`ɡ→g`, stress and aspiration stripped) as well as by the English reading. That fold exposed one more thing:
smj says *ˈm* and *ˈkʰm* for `m`/`km` — letters, not nouns — so its `km/h` and `m/s` were never spoken
denominators but unread units; removed from `ACCEPTED_SPOKEN` (which may only shrink).

**One genuine regression, in a class that improved overall.** `SNES` read *snˈɛs* and now reads *sn*;
`ISIL` → *ˈɪsɪ*, `GIF` → *ɡˈɪ*. Measured on the held-out tenth:

```
                  K=4 (shipped)   all
no vowel phone       53            21
short by ≥2 phones  286           155
long by ≥2 phones   529           139
final consonant lost 206          216      ← the one class that did not improve; SNES/ISIL/GIF live here
```

The final-consonant class is the n-gram's own (a consonant letter emitting nothing word-finally is legal
for it — `lamb`, `damn`, `corps` — and nothing penalises it the way `evp` penalises a silent vowel letter);
it is 1.8% either way and filed separately rather than patched into this change. The lexicalization-threshold
pin uses `SNAV` → *snˈæv*, a shape the model reads whole, since what it pins is the ROUTE, not the model.

**Goldens.** 20 files, 519 rows moved, every one an English OOV run inside another language through the sync
n-gram: nan 152, hak 62, mi 18, syl 16, vi 15, hmn 12, sat 10, gan 6 … `en.tsv` itself did not move (rendered
async → the BiLSTM). Sampled: `Oise` *ˈɔːɪz* → *ˈɔᶦz*, `Adulyadej` *ædjˈuːliʲəd̬ˌɛd͡ʒ* → *ədˈʌliʲˌæd̬ɪd͡ʒ*,
mi `ISIL` *ˈaᶦsɪɫ* → *ˈɪsɪ* (the class above). `en-GB.tsv` is re-rendered from `en.tsv` with its own tool
(`gen_variant_golden.mts`), which also showed the committed file had been built from an OLDER `en.tsv` — 107
of its 200 sentences were not in the current base; now they are, and its OOV words come from the BiLSTM.

## Run 8 — 2026-09-04 19:20 — parity, and the C# mirror of the async entry

`csharp/tools/parity` over the fleet after the model swap and the golden re-render: 187 byte-identical, **en-GB
29/200 and en-IN 20/200 differ** — as they must: the goldens are async-mode, so the TS render now carries the
BiLSTM's OOV readings for the variants (`Daesh (ISIL)` → *dˈɛʃ ˈɪzəɫ*), and the C# port, which has the same
tagger (`EnglishNeural.cs`), had no `en-GB`/`en-IN` entry in its `NeuralRegistry` either. Mirrored the same way
— `PhonemizeEnNeural(text, host, wordTransform)`, `EnglishGb.RpWordTransform()`, `EnglishIn.IndianWordTransform`
— and the two are byte-identical (400 rows). en-IN's golden was re-rendered with `gen_variant_golden.mts` for
the same reason en-GB's was, and it too had been built from an older `en.tsv`.

C# pins that recorded the old n-gram: HmongTests `Zamenhof`, LanguageBootstrapTests nan `Ukraina-gí` —
retargeted to the same readings as the TS pins.
