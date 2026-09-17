# Spurious secondary stress on a word-final vowel

Run 14 of `kokoro_vphon_investigation.md` listed this as a defect: **275 words** where we mark a
secondary stress on the final vowel and misaki's gold does not (`ability` → `əbˈɪlᵻtˌi`, gold
`əbˈɪləTi`). Half of them were dictionary-sourced, which put the cause below the fallback paths.

Run 15 measured one slice of it (`IY2` on a `-y` spelling) and recommended it as the next thing to
take, because it closes two Run 14 defects at once: the stress itself, and the FLAP those rows
currently suppress — `ability` is `…ᵻtˌi` rather than `…ᵻTi` precisely because a stressed vowel
blocks flapping.

## Run 1 — 2026-09-16 19:30 — it is CMUdict contradicting itself, and only on one vowel

Sweep: `full_syl2.jsonl`, current `main` (44.19% exact vs gold — matches Run 16, so the sweep is
live). 80,222 words.

### The class, by the vowel it lands on

275 words. Final phone of OUR reading: `i` 185, `O` 30, `A` 30, `u` 10, `I` 6, other 14. So this is
a dictionary-shape question, not a rule: 2,005 `g2p-dict.tsv` rows end in a stress-2 vowel.

Against gold, split by which ARPABET vowel:

| vowel | dict rows | gold has | unstressed | 2° | 1° | verdict |
|---|---|---|---|---|---|---|
| `OW` | 546 | 144 | 100 | 44 | 0 | MIXED (69%) |
| `IY` | 508 | 171 | **153** | 16 | 2 | **DROP — 89% unstressed** |
| `EY` | 311 | 100 | 6 | 87 | 7 | KEEP — 94% stressed |
| `UW` | 151 | 49 | 11 | 34 | 4 | KEEP — 78% |
| `AY` | 141 | 98 | 1 | 96 | 1 | KEEP — 99% |
| `AA` | 125 | 18 | 11 | 6 | 1 | MIXED |
| `AO` | 92 | 14 | 1 | 11 | 2 | KEEP — 93% |
| `OY` | 54 | 12 | 0 | 12 | 0 | KEEP — 100% |
| `ER`/`AW`/`AH`/`EH`/`IH` | 75 | 30 | — | — | — | small n |

⚠ **A BLANKET "drop final secondary stress" RULE WOULD BE WRONG.** Gold KEEPS it on 50.5% of these
rows overall, and on 94–100% of `EY`/`AY`/`OY`/`AW`. Those are the real compounds and full
diphthongs — `airway`, `alleyway`, `alibi`, `aircrew`, `afterglow`. Only `IY` is lopsided.

### The cause: CMUdict is inconsistent in the same slot

`g2p-dict.tsv` is regenerated from upstream CMUdict, so the first question was whether our
derivation introduced the digit. It did not — upstream `cmudict-0.7b` has it verbatim:

    ABILITY  AH0 B IH1 L AH0 T IY2
    ANARCHY  AE1 N ER0 K IY2
    APOLOGY  AH0 P AA1 L AH0 JH IY2

But CMUdict writes the SAME position the other way 97% of the time:

| words spelled `-y`, final phone `IY*` | rows | |
|---|---|---|
| `IY0` | **7,219 (97%)** | `city`, `happy`, `only`, `very`, `really`, `thirty` |
| `IY2` | **198 (2.7%)** | `ability`, `anarchy`, `apology`, `adversity` |
| `IY1` | 24 | almost all surnames |

`city` and `ability` end in the same unstressed FLEECE vowel in the same environment and get
different digits. This is upstream noise, not a convention, and gold sides with the 97%.

### The `-y` spelling is the gate, and it does real work

| final `IY2` rows | dict | gold has | unstressed | stressed |
|---|---|---|---|---|
| spelled `-y` | 198 | 123 | **121 (98.4%)** | 2 |
| NOT spelled `-y` | 310 | 48 | 32 (66.7%) | 16 |

The non-`-y` residue is genuine: `bumblebee`, `carefree`, `honeybee`, `jubilee`, `filigree`,
`doubletree`, `manatee`, `peewee`, `oversee`, `divorcee` — compounds and loanwords whose final
syllable is a free morpheme carrying real stress. The `-y` gate excludes all of them for free.

### ⚠ The obvious exception gate is a trap

The only two `-y` words gold stresses are `latchkey` (`lˈæʧkˌi`) and `turnkey` (`tˈɜɹnkˌi`) — both
`-key`, both real compounds. So "`-y` unless it ends `-key`" looks like the rule.

**It is not.** 17 of the 198 rows end in `-key`, and 15 of them are SURNAMES — `bankey`, `barkey`,
`buskey`, `forkey`, `gaskey`, `gokey`, `hawkey`, `mankey`, `markey`, `pankey`, `parkey`, `rodkey`,
`starkey`, `tinkey`, `whipkey`. Across all 121 `-key` words CMUdict writes `IY0` 100 times, covering
the phonologically identical `berkey`, `blakey`, `buckey`, `brickey`. A `-key` exception would hold
secondary stress on 15 surnames whose twins are unstressed — re-creating exactly the inconsistency
this is fixing, and on the side with less evidence.

So: no exception gate. The demotion applies uniformly to final `IY2` on a `-y` spelling, and
`latchkey`/`turnkey` are **declared known misses** — 2 words against 121, in a mark on a vowel that
is already the right vowel.

## Run 2 — 2026-09-16 19:45 — implemented in the converter; 275 → 122, and the flap came with it

Applied in `makeArpabetToIpa` (and its C# twin) rather than in `g2p-dict.tsv`, for two reasons. The
dict is regenerated from upstream by `en_g2p_ngram.ts --emit`, which is what `g2p-curated.tsv` exists
to record; and the n-gram and BiLSTM predict the same digit from the same training data, so a per-row
edit would leave the OOV path saying `IY2` for an unlisted word in the identical environment — the
live split that file's gate is built to catch.

**The DIGIT is demoted, not the mark suppressed.** The digit does three jobs: it picks the stress
mark, it picks the vowel (`cv.IY.stressed` = `iː` vs `unstressed` = `i`), and the flap guard reads it
directly. Suppressing only the mark would have left `ability` as `əbˈɪlᵻtʰiː` — an unmarked LONG vowel
after an unflapped /t/, a third reading that is neither the dictionary's nor gold's.

    ability    əbˈɪlᵻtʰˌiː  →  əbˈɪlᵻt̬i        gold əbˈɪləɾi
    company    kʰˈʌmpə̆nˌiː  →  kʰˈʌmpə̆ni       gold kˈʌmpᵊni
    identity   …ᵻntᵻtʰˌiː   →  …ᵻntᵻt̬i         gold Idˈɛntəɾi

### Result, on an identical 80,222-word denominator

|  | exact vs gold | spurious final 2° | flap-count disagreements |
|---|---|---|---|
| before | 35,450 (44.19%) | 275 | 1,290 |
| after | **35,495 (44.25%)** | **122** | **1,245** |

+45 exact, **0 regressions**. Only +45 because most of the 153 corrected words diverge for OTHER
reasons too — `ability` is now `əbˈɪlᵻTi` against gold `əbˈɪləTi`, still carrying the separate `-ity`
`ᵻ`/`ə` class. The stress class itself fell 56%, and the residue is the non-`-y` spellings left alone
on purpose (`-ae` 21, `-ee` 17, `-io` 13).

⚠ **THE MEASUREMENT NEEDED ITS OWN PORT VALIDATED FIRST.** Scoring means rendering canonical IPA
through `KokoroFormat` (C#), so the scorer carries a Python re-implementation of it — a fresh place
for a fake result to come from. Checked by rendering the new sweep and diffing against the previous
C#-produced one on words the change CANNOT touch: **80,043 identical, 56 differ**, and all 56 are the
rule firing on OOV `-y` words absent from the dict (`phrenology`, `autarchy`, `ology`). Zero genuine
differences, and incidentally the proof that the rule does reach the OOV path.

### Three test expectations changed, and none of them was re-recorded blindly

The lesson from #1319 is that a bulk expectation update is how a defect gets written down as
correct. Each was checked against gold first:

| | was | now | why |
|---|---|---|---|
| `english.test.ts` `inquiry` | `ɪŋkwˈaᶦɹiː` | `ɪŋkwˈaᶦɹi` | gold `ˈɪnkwˌIɹi`, unstressed. It also removes a contradiction the test already carried: the dict wrote the singular `…R IY2` and the plural `…R IY0 Z`, so `inquiry` was long and stressed while `inquiries` was short and unstressed, asserted one line apart |
| `english-reported-misreadings.test.ts` | `("TH ER1 D IY2","thirty")` | `("M AE1 N AH0 T IY2","manatee")` | the synthetic case was kept by #1317 "independent of whether any word still supplies one". A `-y` word no longer reaches that branch by design, so it stopped testing the thing; `manatee` is a real final-`IY2` row that does, gold-verified `mˈænətˌi` — 2° kept, `t` unflapped |
| `EnglishFlapStressTests.cs` | same | same | the C# twin of the row above |

Four goldens went stale, all 8 findings the same two words (`company`, `identity`), both moving
toward gold. `si` appears in that list because its golden sentences contain embedded English
("Doubleday & Company") read through the foreign-run delegation — propagation, not a surprise.

### An adjacent divergence this surfaced, NOT fixed here

Writing the "other final vowels keep their 2°" test, `airway` (`EH1 R W EY2`) and `aircrew`
(`EH1 R K R UW2`) failed it: their 2° sits on the syllable NEXT TO the primary, so the older
**secondary-stress clash rule** drops the mark, and that rule's diphthong exception covers only the
true diphthongs `AY`/`OY`/`AW`, not `EY`/`UW`. Gold marks both (`ˈɛɹwˌA`, `ˈɛɹkɹˌu`), so it is a real
divergence — just a different one. Pinned as its own test case so the two cannot be confused later.

Gates: parity 189/189 byte-identical (36,495 rows, 0 differ), C# 6,687, vitest 5,930, goldens 0
stale, tsc and package fence clean.
