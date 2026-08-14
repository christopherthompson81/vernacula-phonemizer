# Accented Latin letters are DELETED — fleet investigation

Chronological log for the `q/accent` run. The defect was handed over by the `ki` normalization run, which
found it and deliberately declined to fix it in a language commit:

> A separate, larger finding is recorded and NOT fixed: `é á ó à è ò â ê ô ç ñ` are deleted too, in every
> Latin-script language with no rule for them. That is `src/core`, it affects all 191 languages, and it must
> not land as a side effect of one language's commit.
> — `docs/investigations/ki_normalization_investigation.md`, Run 3

## Run 1 — 2026-08-13 (baseline: how many engines, and by what mechanism)

**Question.** Which engines drop an accented Latin letter, and — the part the headline count cannot answer —
is each one a DELETION, or something else that merely looks shorter?

**Commands.**

```
npx tsx probe-accent.scratch.mts                 # the handed-over probe, 193 engines × 11 letters
npx tsx fleet-sweep.scratch.mts <scratch>/before  # every mined corpus × its own engine, one reading per line
```

**Raw finding — the probe.** 17 of 193 engines read the accented frame SHORTER than the base frame:

```
mos ki kam   é á ó à è â ô ï   (8 each)
fr fr-CA     á ó ñ             pt pt-BR   è ï ñ        nl   â ô ñ
umb  â ô ï   af  â ñ ç         id ms zsm om ee  ñ ç    hak  ü        mi  ñ
```

**Raw finding — reading the engines beside the probe.** The 17 are FOUR different mechanisms, and only two of
them are the defect:

| engines | mechanism | is it a deletion? |
|---|---|---|
| `mos ki kam umb` | scan falls through to `latinPhone`, which has no row for a precomposed accented vowel and returns `undefined`; the caller appends `?? ""` | **yes** |
| `fr pt nl af om ee` | the engine's own scanner has a `default:` / trailing `i++` that drops the character, and never consults `latinPhone` at all | **yes** |
| `id ms zsm` | `NATIVE_WORD = /^[a-zA-Z]+$/` — a token carrying ANY diacritic is deliberately handed to the injected foreign (English) reader | no |
| `hak mi` | the Latin arm parses Pha̍k-fa-sṳ / `NATIVE_CLASS` first and hands a non-parsing run to the foreign reader | no |

Evidence for the "no" rows, in real words rather than the probe's frame:

```
id   señor  → siːnjˈɔːɹ      garçon → ɡɑːɹsˈoᶷn        (English reader; ñ→nj, ç→s — both read)
mi   Cañitas → kʰˈæniːt̬əs                             (English reader; ñ read)
hak  kük    → kʰˈʌk   vs  kuk → kʊk̚˩                  (the base form PARSES AS PFS and gets a Hakka
                                                        reading with a tone letter; the accented one does
                                                        not and goes to English. Different, not shorter.)
```

⚠ **The probe over-reports by five engines.** `kñk` under the English reader is *ŋk* — English folds ⟨ñ⟩ to
⟨n⟩ and then reads word-initial ⟨kn⟩ as /n/, exactly as in *know*. A length comparison cannot tell a silent-k
orthography rule from a deletion. The count that matters is **12 engines**, not 17.

**Implication.** Two fixes, at two layers, and they are not substitutes:

1. `latinPhone` has no LAST RESORT. Its own header says a letter that reaches the fall-through "still denotes
   a sound"; a precomposed `é` denotes the sound of `e` plus a mark the engine has already declined. Stripping
   the mark before giving up is the floor, and it fixes every engine that already routes through the table —
   including any future one.
2. Six engines never reach that floor because their scanner's last branch is a bare `i++`. Each needs its own
   decision, because for several of them the letter is not foreign at all.

---

## Run 2 — 2026-08-13 (the shared last resort, measured before shipping)

**Question.** If `latinPhone` decomposes an unknown letter and reads its BASE as the last thing it does before
returning `undefined`, what does that change across the whole fleet — not just the four engines it is aimed at?

**Change.** `src/core/latinPhones.ts`: the precomposed character is looked up FIRST (so the `ñ ç ß ü ö ł æ …`
rows keep their own phonemic identity and are NOT flattened), and only a character the table has never heard
of is NFD-stripped and looked up by its base. The `\p{M}` guard on bare combining marks is unchanged.

**Command.** `npx tsx fleet-sweep.scratch.mts <out>` — every one of the 162 mined corpora read by its own
engine, one reading per line, before vs after. Plus `probe-accent`, `vitest`, `tsc`, and `referee-eval` for
every engine that consults the table.

**Raw finding — the footprint is four engines wide and every changed line is the defect being repaired.**

```
162 corpora swept · 2 changed at all:   ki 19/363 utterances (5.2%)   mos 86/431 (20.0%)
(kam and umb have no mined corpus; they are covered by the probe and by kam's referee)
```

Sample of the changed readings, before → after:

```
ki   Fágúnwà       fɣnw       → faɣunwa        (a Yoruba name quoted in ki.wikipedia, ×2 in one sentence)
ki   Concepción    ɕɔᶮtɕɛpɕin → ɕɔᶮtɕɛpɕion
ki   Motomorfóza   mɔtɔmɔɾfza → mɔtɔmɔɾfoza
ki   mũnõ mũno     mon monɔ   → mono monɔ      ⚠ KIKUYU's OWN word, ⟨õ⟩ typed for ⟨o⟩
mos  Tônd  têng  bône  zabé   → tond teŋɡ bone zabe   ⚠ MOORÉ's OWN words — Mooré writes ⟨ê ô⟩
mos  Étoile        toile      → etoile
mos  lélek         llek       → lelek
```

⚠ **The severe group is not mostly foreign names.** Mooré's own orthography uses the circumflex vowels, and
20% of its corpus paragraphs contained a deleted native vowel. That is the same shape as the `ki` run's ⟨ű ī
ū⟩ finding, reached from the other end.

**Raw finding — gates.**

```
probe-accent      17 engines → 13    (mos ki kam umb clear all eight letters)
vitest            242 files, 4008 passed, 5 skipped — no golden moved
tsc --noEmit      clean
referee-eval      ki 1056/1062 99.4% · mos 37/39 94.9% · kam 5/5 · unchanged, to the word
referee-eval mi   1003/1005 (99.8%) → 1005/1005 (100.0%)  ⚠ AN IMPROVEMENT ON AN INDEPENDENT REFEREE
```

The two Māori words are ⟨Ḵ⟩ U+1E34 (K with line below), which the engine read as the EMPTY STRING and
wikipron reads as /k/. Nothing in this run was aimed at that character; it is what a last resort is for.

**Implication.** Ship it. The property it buys — a typed letter is never silently deleted by `latinPhone`
again, for any engine present or future — costs two corpora's worth of movement, all of it repair, and it
gains two words on a referee that was not part of the brief.

---

## Run 3 — 2026-08-13 (the six engines that never reach the shared floor)

**Question.** `fr pt nl af om ee` scan with their own tables and drop the character at the end of the loop.
For each: is the letter foreign, and what is the right reading — the base letter, a rule of its own, or
nothing at all?

**Command.** A corpus letter census (scratch): every non-ASCII Latin character in the language's own mined
corpus, with counts, example words, and whether the engine's reading changes when the character is removed.
Plus `attest.ts --lang af` for the letters af.wikipedia actually writes.

**Raw finding — the census.**

```
fr  16 distinct   deleted: í ×1 (Taínos)                      · é è à ê î ç É â ô ö û ù œ ï all read
pt  19 distinct   deleted: ö ×1 (Klöcker)                     · ã ç í á ê õ ó â ú à ô ñ all read
nl   4 distinct   deleted: none present                       · ë é ï ö all read
af   7 distinct   deleted: none present                       · ë ê ï İ ö Ü ü all read
om   0 distinct   ⚠ ZERO non-ASCII letters in 92 lines
ee  54 distinct   deleted: ç ×1 (Française), ý ×1 (Podobský), and three BARE COMBINING MARKS
```

⚠ **The corpora understate it and the reason is structural.** These artifacts are ~110 lines each; the letters
at issue arrive on proper names, so their corpus rate is a fact about how many foreign names 110 lines happen
to contain, not about the defect. Probed on real words instead, all six were still deleting:

```
fr  Málaga → mlaɡa    Taínos → tano       Cañitas → kaita
pt  naïve  → nave     Klöcker → kɫkkeɾ    Cañitas → kɐitɐʃ
nl  enquête → ɛnkʋtə  crêpe  → krpeː      Cañitas → kaːitɑs     ⚠ the first two are DUTCH words
af  bâton  → btɔn     garçon → χarɔn      piñata → pinata
ee  Française → flanaise   Podobský → podobsk    señor → seor
om  señor → siːnjˈɔːɹ  garçon → ɡɑːɹsˈoᶷn                       ⚠ ENGLISH — om routes, it does not delete
```

**Implication, per language — and they are not the same decision.**

| lang | what the letters are | decision |
|---|---|---|
| `om` | nothing: `NATIVE_WORD = /^[A-Za-zʼ’']+$/`, so any diacritic word goes to the injected English reader | **no change.** The probe's frame was routed, not deleted — the fifth false positive |
| `fr` | foreign only; French's own accents are all in `vowelLetters`/`vowelGroups` | `latinPhone` at the `default:` — and it gives ⟨ñ⟩ /ɲ/, which French has and spells ⟨gn⟩ |
| `pt` | foreign only; Portuguese's five accents are all in the manifest | fold the unknown accent to its base BEFORE the scan, so the vowel machinery sees a vowel |
| `nl` | ⚠ **NOT foreign — ⟨â ê î ô û⟩ are Dutch spelling** (enquête, crêpe, gêne, coûte) | add them to `VOWELS` and to the file's own accent→base chain |
| `af` | ⟨â⟩ foreign; ⟨ç ñ⟩ foreign but ATTESTED in af.wikipedia's own prose | fold ⟨â⟩; give ⟨ç⟩ and ⟨ñ⟩ grapheme rows |
| `ee` | ⟨ý ç⟩ are marked forms of letters Ewe HAS (⟨y⟩ = /j/, ⟨c⟩ = /t͡s/) | drop the vowel-only guard on the base-letter branch; add ⟨ñ⟩ = /ɲ/ |

⚠ **`ñ` IS DECIDED PER LANGUAGE, BY WHAT THAT ENGINE ALREADY EMITS FOR THE PALATAL NASAL** — not by one
fleet-wide value, and never by folding to /n/, which throws away a sound all five languages make:

```
fr  ⟨gn⟩ = ɲ   → ñ = ɲ        pt  ⟨nh⟩ = ɲ → ñ = ɲ        ee  ⟨ny⟩ = ɲ → ñ = ɲ
nl  ⟨nj⟩ = nj  → ñ = nj       af  ⟨nj⟩ = nj → ñ = nj      (neither engine emits /ɲ/ anywhere else)
```

**af evidence, `attest.ts --lang af` on af.wikipedia**, with the sense read: `garçon` ×15, `Provençaalse` ×3,
`piñata` ×4 — and `piñata` in a plainly Afrikaans sentence, *"tradisionele gebruike soos vir 'n piñata — 'n
versierde figuur of diertjie wat met lekkergoed gevul word"*. ⟨ç⟩ is given **/s/**, its value in the French and
Portuguese words Afrikaans takes it from, NOT the /t͡ʃ/ the shared table defaults to: that row is
Turkish/Albanian and would be wrong for every attestation here. This is the "a wrong reading can be worse than
a deletion" case, and it is why af gets its own row instead of the shared fallback.

**NEGATIVE RESULT — the shared fallback was WRONG for Portuguese ⟨y⟩, and the corpus caught it.** With
`latinPhone` on pt's `default:`, ⟨y⟩ (the one ASCII letter pt's switch has no case for) came out /j/:

```
Vichy → vˈiʃj      curry → kˈuʁj      Zachary → zˈaʃɐɾj      Beauty → bˈeawtj
```

/j/ is the letter's consonantal value — right for German and English, wrong for every Portuguese reading of
it. `curry` → *kuʁj is a worse answer than the *kuʁ it replaced. Portuguese's own orthographic reforms
replaced Greek-derived ⟨y⟩ with ⟨i⟩ throughout (*yoga* → ioga), so pt folds ⟨y⟩ → ⟨i⟩ and runs it through the
ordinary ⟨i⟩ machinery, glide rule included: `Vichy` → viʃi, `curry` → kuʁi, `Madhya` → mɐdiɐ. **The shared
last resort is a floor for letters a language has no opinion about — where it does have one, it needs its
own rule.**

---

## Run 4 — 2026-08-13 (gates, and what a golden change means)

**Question.** Does any of this move a referee, a golden, or a corpus line it was not aimed at?

**Commands.** `fleet-sweep` (162 corpora), `referee-eval` for every affected language against a pristine
baseline tree, `vitest run`, `tsc --noEmit`, `corpus-diff emit`/`compare` and `mine.ts scan` for the seven
languages with both a corpus and a change.

**Raw finding — corpus.** Of 162 mined corpora, five move, and every changed word is a repair:

```
mos 86/431 (20.0%)   ki 19/363 (5.2%)   pt 12/115 (10.4%)   ee 2/396 (0.5%)   fr 1/107 (0.9%)
nl 0/110 · af 0/109  — their corpora contain no â ô ñ ç at all; the referees below are their meter
DROP / THROW / LEAK counts identical before and after in all seven; mine.ts scan identical
```

Every pt/fr/ee change, at word level:

```
kɫkkˈeɾ→klukkˈeɾ  vˈiʃ→vˈiʃi  ɡˈoɾlɨ→ɡˈoɾlej  zˈaʃɐɾ→zɐʃˈaɾi  uɡˈaɾʒnʃkɐ→uɡɐɾzˈĩʃkɐ
bˈeawt→bjˈawti  kɐˈitɐʃ→kɐɲˈitɐʃ  kˈuʁ→kˈuʁi  flˈod→flˈoid  ʃɐ̃dɾɐˈaɐ̃→ʃɐ̃dɾajˈaɐ̃  mˈadɐ→mɐdˈiɐ
tano→taino (fr)   podobsk→podobskj (ee)   flanaise→flant͡saise (ee)
```

**Raw finding — referees. Every one moves UP or not at all; none regresses.**

```
             primary                     secondary
fr      3704 → 3705 /4669    (96.0 → 96.1% symbol)   2738/3000 unchanged
pt      3857 → 3862 /4749                            169/170 unchanged
pt-BR  49622 → 49673 /57131  (97.7 → 97.8% symbol)
nl     31144 → 31149 /46519                          30823 → 30829 /45872
af      1765 unchanged /2220                         17885 → 17886 /27428
ee/mi/ki/mos/kam  unchanged (mi already banked its +2 in Run 2)
```

⚠ nl and af moved a referee while their CORPUS moved zero lines — the corpora are 110 lines and carry no
instance, the referees are 46 519 and 27 428 words and do. Neither gate could stand in for the other here.

**Raw finding — ONE GOLDEN CHANGED**, `test/afrikaans.test.ts`, and it is the pin doing its job:

```
- expect(trigger).toEqual(["f","g","k","p","q","s","t","v","x"])
+ expect(trigger).toEqual(["f","g","k","p","q","s","t","v","x","ç"])
```

That assertion pins the REGRESSIVE-devoicing trigger set, derived as `fixed ∩ voicelessPhones`, and its own
comment says why it exists: a grapheme added whose phone is missing from `voicelessPhones` would silently drop
out of the trigger. Here the opposite happened — ⟨ç⟩ = [s], [s] IS in `voicelessPhones`, so ⟨ç⟩ joins the
trigger and a voiced obstruent before it devoices exactly as it does before ⟨s⟩. That is correct Afrikaans and
the test caught the change rather than the change slipping past it. ⟨ñ⟩ = [nj] was added in the same commit
and correctly did NOT join, [n] being voiced. Updated with the justification written into the file.

**Added — the property, pinned fleet-wide.** `test/latin-tokenizers.test.ts` gains a second sweep: for every
registered code, an accented letter in a fixed frame must not read SHORTER than the same frame with its base
letter. Differential, so it never asserts what the reading should be; and a ROUTING engine is exempted by
MEASUREMENT (`this engine's answer IS English's answer`) rather than by a list that could go stale. It reports
**47 violations on the pre-change tree and 0 after** — the same defect the whole run is about, now a test.

**Left, deliberately, and why.**

- **`id ms zsm om hak mi` — not fixed, because they are not broken.** All five route a diacritic-bearing token
  to the injected reader; the probe compared a routed reading against a native one. Six of the original 17.
- **`ee` fragments ⟨Ð⟩ U+00D0** (`Ðasefowo` → *dˈiː asefowo* — the English letter name "dee"): contributors
  typing Latin ⟨Ð⟩ for Ewe's ⟨Ɖ⟩ U+0189, which is not in ee's `TOKEN` class. ×19 in the corpus. Pre-existing
  and UNCHANGED by this run (verified against the baseline tree) — it is the FRAGMENTATION defect, a different
  layer from this one, and it belongs with the tokenizer sweep at the top of that test file.
- **Bare combining marks are still dropped, everywhere.** `latinPhone` refuses `\p{M}` by design, and ee's
  corpus carries U+0342, U+030E and a stray U+0301 (`Avɛ́no`). A mark is not a segment; inventing a phone for
  one would be a different and worse error.
- **`ee ç` reads /t͡s/, not /s/.** It reaches the base-letter branch and Ewe's own ⟨c⟩ is /t͡s/. The single
  corpus instance is French (`La Française`, and Ewe's contact language IS French), so /s/ is arguable — but
  it is one instance, and reading the letter under the mark with the language's own value makes no new claim.
  Recorded rather than decided.
- **ki's ⟨í ú⟩ question is untouched.** Run 3 of the ki investigation refused to fold them to ⟨ĩ ũ⟩ because
  they are equally ordinary in the foreign names that wiki quotes (`Fágúnwà`, `Lucía`) and the guard scored
  ~75%. Nothing here revisits that: this layer does not decide which KIKUYU letter was meant, only that the
  vowel is pronounced instead of deleted — which is an improvement under either reading, and is exactly what
  `Fágúnwà` → faɣunwa and `mũnõ` → mono show.
