# ASR-alignment QC — working the investigate queue

Continues the ASR-alignment harness in `tools/corpus/asr-align/` (PR #836). That README states what the
instrument is; this log records what it found, run by run, including the runs that concluded "not our bug".

DB: `$ASR_ALIGN_ROOT/work/asr_align/align.sqlite`, 270,106 rows over 102 FLEURS languages.

## Run 1 — 2026-08-18 14:00 — is `oc_fr` a truncated-audio language, or an over-productive phonemizer?

The open question from the handoff. Occitan flags 94 utterances as `defective_audio` — 2.78% of its 3,379
train rows, twelve times the next-highest language on the same test (`ny_mw`, 0.52%) and two orders of
magnitude above the corpus tail. The `defective_audio` label is a *seconds-per-phone* test, and it takes
**our** phone count as its denominator. Occitan orthography is dialect-variable and that engine has only
been spot-checked, so an over-productive phonemizer inflates phones-per-second and mimics short audio
exactly. Either the audio is genuinely short — in which case it is upstream, like `cy_gb` — or we are
writing phones nobody said.

### 1a. The audio really is short inside the source tar

Read the member sizes out of `corpus/audio_cache/data/oc_fr/audio/train.tar.gz` directly, so the answer does
not depend on our extraction:

    tar tvf .../oc_fr/audio/train.tar.gz | awk '{print $3, $NF}'

    status             n     median tar bytes    median duration
    defective_audio    94             328,378             5.13 s
    verified        3,153             963,898            15.06 s

All 3,379 DB rows are present in the tar; none is missing. So the short files are short as shipped. That
rules out a download artefact but **not** the phonemizer — 5.13 s is a perfectly plausible utterance
length, unlike Welsh's 1.44 s. Being short is not the same as being *too* short for its text, and only the
denominator decides that.

### 1b. The discriminating test: where in our IPA does the recognized audio land?

If the audio is cut short, the recognized phones align to a **prefix** of our IPA and stop. If we
over-produce, the extra phones are spread throughout and the match still reaches the end. Folded and
coarsened both sides with `asr_align_report.fold`/`COARSEN`, then took the `SequenceMatcher` matching
blocks and asked how far into our IPA the last matched phone sits (`match_maxpos`).

    oc_fr             n      dur   our_ph  rec_ph  our_pps  rec_pps  matchcov  maxpos
    defective_audio   94    5.13s   147.5    43.0    27.81     8.38     0.194   0.377
    verified       3,153   15.06s   110.0   102.0     7.26     6.82     0.637   0.984
    investigate      101   10.92s   118.0    74.0    10.49     6.92     0.250   0.738

Two things settle it. The recognizer's own phones-per-second in the defective group is **8.38** against
6.82 for verified — the audio contains normal-rate speech, not a sentence compressed into a third of its
duration. And the match ends at **0.377** of our IPA where verified reaches 0.984. The audio is the front
of the transcript and then nothing.

### 1c. Confirming it is not us: prefix-restricted similarity

Scored each recognized string against the best-matching *prefix* of our IPA rather than the whole of it:

    oc_fr defective_audio   sim vs full IPA 0.304   sim vs best prefix 0.634
    oc_fr verified          sim vs full IPA 0.653   sim vs best prefix 0.639
    cy_gb defective_audio   sim vs full IPA 0.075   sim vs best prefix 0.231
    cy_gb verified          sim vs full IPA 0.732   sim vs best prefix 0.696
    fr_fr verified          sim vs full IPA 0.916   sim vs best prefix 0.894

**0.634 against a baseline of 0.639.** Where there is audio, our Occitan IPA matches it exactly as well as
it matches a healthy Occitan utterance. An over-productive phonemizer would still be depressed here; it is
not depressed at all. The phonemizer is exonerated on these 94.

### 1d. `oc_fr` is NOT the `cy_gb` defect — two different upstream failures

The same table shows Welsh behaving differently: its truncated files do not match even a prefix (0.231 vs a
0.696 baseline), consistent with the upstream report's finding that they decode to nothing or to English.
Measured the waveform tails to confirm the two are physically different — RMS of the last 100 ms over the
file's overall RMS:

                    median tail/overall    frac ending above 0.5×overall    median dur
    cy_gb defective        0.494                    49.6%                     1.44 s
    cy_gb verified         0.021                     2.0%                    13.53 s
    oc_fr defective        0.033                     2.1%                     5.13 s
    oc_fr verified         0.013                     1.0%                    14.73 s

Welsh files are **hard cuts mid-signal** — half of them stop at full amplitude. Occitan files end in
silence like any normal recording. Whatever produced the Occitan set stopped at a plausible boundary; it
just stopped early.

### 1e. And there is no discrete broken subset — it is a continuous tail

Expressed every `oc_fr` utterance as *fraction of the duration its transcript implies* at the language's own
verified rate (7.26 folded phones/s), and binned:

    oc_fr (n=3,379)              cy_gb (n=3,427)            fr_fr (n=3,193)
    0.0-0.1      0               0.0-0.1    322  ( 9.40%)   0.0-0.6      0
    0.1-0.2     12               0.1-0.2    216  ( 6.30%)   0.6-0.7     10 (0.31%)
    0.2-0.3     62               0.2-0.3     45  ( 1.31%)   0.7-0.8    244 (7.64%)
    0.3-0.4     94               0.3-0.4      4  ( 0.12%)  <-- GAP
    0.4-0.5     92               0.4-0.5     28  ( 0.82%)
    0.5-0.6     79               0.5-0.6    230  ( 6.71%)
    0.6-0.7     80               0.6-0.7    198  ( 5.78%)
    0.7-0.8    219               0.7-0.8    216  ( 6.30%)

Welsh is **bimodal with a real gap** at 0.3–0.5: a broken population and a healthy one. Occitan has **no
gap** — 12, 62, 94, 92, 79, 80, 219 — a smooth ramp into the threshold. French and Catalan have nothing at
all below 0.5. So the 94 are not "the broken files"; they are the part of a heavy left tail that happens to
fall under the detector's one-third cutoff, which is also why the distribution is censored at 0.33.

Banding the prefix test along that same axis shows the tail is one phenomenon at varying strength:

    fraction of expected duration    n      match_maxpos   our_phones   rec_pps    sim
    0.1-0.2                          12         0.275         164        8.40     0.237
    0.2-0.3                          62         0.357         151        8.26     0.294
    0.3-0.4                          94         0.490         118        7.99     0.384
    0.4-0.5                          92         0.527         110        7.15     0.412
    0.5-0.6                          79         0.636          97        7.47     0.459
    0.6-0.7                          80         0.951         107        8.63     0.516
    0.7-0.8                         219         0.982         119        8.48     0.587
    0.9-1.0                         681         0.986         117        7.25     0.662

`match_maxpos` tracks the duration fraction almost one-for-one up to ~0.7 and then saturates, while
`rec_pps` stays flat at 7–8.6 in every band. The amount of transcript present is proportional to the amount
of audio present, at a constant, normal speaking rate. That is the signature of audio that stops early, and
it is the *opposite* of what an over-productive phonemizer produces.

### 1f. Sanity: the Occitan engine is unremarkable

Median folded distance by language, over the 102 in the DB: `oc_fr` ranks **57th at 0.355**, between
`ca_es` (41st, 0.316) and the middle of the pack — nowhere near the degenerate end, and per §4 of the
handoff a middling median is not a defect anyway. Nothing suggests the engine is misbehaving.

### Verdict

**The claim stands, restated.** `oc_fr`'s 94 flagged utterances are upstream FLEURS audio that is short for
its transcript, not a phonemizer defect. But it is a *different* defect from `cy_gb`, and describing it as
the same one would be wrong on three counts: the audio is intelligible and matches the transcript, it ends
cleanly rather than being cut mid-signal, and the affected population is a continuous tail rather than a
separable subset. Roughly **340 utterances (10% of the split)** sit below 0.7 of their implied duration;
only the 94 below one-third are labelled.

### Implications for the next step

- The `cy_gb` upstream report's control line — "58 / 247,861 = 0.023% for every other language" — was
  computed before Occitan was in the DB and is now misleading. Recomputed: the seconds-per-phone test fires
  **743** times corpus-wide; excluding `cy_gb` (585) and `oc_fr` (94) that is **64 / 263,300 = 0.024%**,
  which reproduces the original figure. `oc_fr` needs to be disclosed in that report as a distinct,
  milder case rather than quietly folded into the control. (Doc updated in the corpus repo; still not
  filed — that is the user's call.)
- Do **not** move the one-third threshold to catch the rest of the Occitan tail. It is calibrated against
  the whole corpus and Occitan is the only language with a tail of that shape; loosening it globally to fit
  one language is exactly the generalisation §6 of the handoff warns about. Whether to exclude the 0.33–0.7
  band from training is a corpus-policy question for `exclude_defective.py`, not a phonemizer question.
- Nothing to fix in `src/` from this run.

## Run 2 — 2026-08-18 14:10 — the scorer imports were still pointing at the repo it moved from

Not a measurement, but it belongs in the log because it is the §1 failure shape. Five files in
`tools/corpus/asr-align/` still open with

    sys.path.insert(0, "/mnt/data/Programming/vernacula/scripts/omnivoice_ipa")
    from asr_align_report import fold

— `asr_align_label.py`, `consonant_skeleton.py`, `confusion_pairs.py`, `judge_alignment.py`,
`judge_cascade.py`. That directory no longer contains `asr_align_report.py`; the imports worked only
because the script's own directory is on `sys.path` anyway. The moment that path regrew the file, every
one of these would have silently scored against a **stale `fold()`** — no error, just different numbers.
Replaced with `os.path.dirname(os.path.abspath(__file__))` and checked each still imports from a foreign
cwd.

## Run 3 — 2026-08-18 14:20 — is the top of the queue about our IPA at all?

`bn_in` heads the queue at **12.71%** of its split flagged — 3.4× `km_kh`, which §4 of the handoff already
established as "hard for the recognizer, not defective". Its distance histogram is genuinely bimodal (a
mass at 0.2–0.4, a second hump at 0.6–0.9), so the tail does separate and this is not the `km_kh` case.

The confusion table is a flat tail of expected inventory differences (`ɾ→r`, `i→ɪ`, `ʃ→s`, `ɦ→h`, `ɖ→d`)
with no dominant pair, so no single mapping explains it. Duration explains almost nothing either —
binned by duration quintile, `bn_in`'s median distance runs 0.275 → 0.336, nowhere near 0.6.

**What did explain it was the speaker.** FLEURS ships a gender column (col 7 of `train.tsv`), and it is a
usable proxy for speaker identity in a corpus with a handful of readers per language:

    lang     nF   inv%F   medF     nM   inv%M   medM
    bn_in  2081   18.21   0.320   922    0.33   0.244
    el_gr  1927   14.06   0.257  1288    1.01   0.229
    hu_hu  2187   13.40   0.303   908    2.20   0.342
    en_us  1569    1.66   0.176  1032   12.89   0.187
    kn_in   896    0.56   0.233  1386    6.06   0.274

379 of `bn_in`'s 382 flagged rows are one gender. And the skew runs **both ways** — `en_us`, `kn_in`,
`pt_br`, `te_in`, `ml_in` are male-skewed — so this is not "the recognizer is worse on female voices."
Corpus-wide there is no bias at all: **3.46% of female rows against 2.66% of male**, with 55 of 101
languages skewing female, i.e. a coin flip.

`hu_hu` is the one that proves it. Its female median distance (0.303) is *better* than its male (0.342),
and yet female rows supply 293 of its 313 queue entries. A phonemizer cannot produce that. It does not
know who read the sentence.

## Run 4 — 2026-08-18 14:30 — the sibling test, and 77% of the queue evaporates

Run 3's argument generalises into an exact instrument. FLEURS records the **same sentence read by
different speakers**, and our IPA for a sentence is a pure function of its text — byte-identical across
those recordings. So if one recording of a sentence is flagged and another is `verified`, the IPA cannot
be the cause. Not an inference; a construction.

Implemented over `sentence_id`, asserting the sibling IPAs really are identical before comparing:

    lang           inv  w/sib  exonerated       %    within-sentence spread (med|max)
    el_gr          284    273         265   93.3%    0.101 | 0.726
    hu_hu          313    293         277   88.5%    0.092 | 0.699
    bn_in          382    342         311   81.4%    0.091 | 0.668
    ky_kg          149    127         119   79.9%    0.091 | 0.644
    en_us          159    132         122   76.7%    0.030 | 0.604
    ny_mw          174    142         131   75.3%    0.094 | 0.641
    fr_fr           77     76          56   72.7%    0.026 | 0.361

    CORPUS-WIDE: 8,367 flagged · 7,191 have a same-text sibling · 6,442 exonerated = 77.0%

Two sibling recordings of one sentence, scored against one identical IPA string, can differ by up to
**0.73**. That number is the queue's noise floor, and it is larger than most of the signal in it.

**Residual: 1,925 rows** — 1,178 with no sibling, and **747 where every recording of the sentence is
flagged**. (Run 8e corrects those two figures from 1,176 / 749.) That second set is the high-value one: multiple independent readers all disagreeing with our
IPA of the same text. Written to `residual_queue.tsv`.

    residual by language: bn_in 71, pa_in 55, fil_ph 43, ny_mw 43, sn_zw 42, he_il 41, en_us 37,
                          ln_cd 37, hu_hu 36, ckb_iq 35, te_in 35, fa_ir 33, ceb_ph 32, km_kh 32
    all-siblings-flagged: ln_cd 37, sn_zw 30, he_il 25, ceb_ph 24, de_de 23, sn_zw…

This should become a column in the tooling — see the write-up at the end.

### A dead end recorded on purpose

Before the sibling test I tried to catch orthographic leakage by scanning our IPA for `c q w x` on the
premise that none is a real IPA symbol. **All four are** — /c/ palatal plosive, /q/ uvular plosive, /w/
labial-velar approximant, /x/ velar fricative — so it "found" 167,356 rows across 96 languages, every one
a false positive. Xhosa `kǀɛcʼwˈaːjɔ` and Kazakh `qˈəjsəq` are correct. The check was worthless and there
is no cheap character-level leak test; the letters that leak are the letters IPA uses.

## Run 5 — 2026-08-18 14:45 — the first real defects out of the cleaned queue

Read `de_de`'s 23 all-siblings-flagged rows. **20 of the 23 contain embedded English** — *medical center*,
*united states geological survey*, *college of arts & sciences*, *university of virginia*, *royal society
for the prevention of cruelty to animals*, *new york university*, *harvard law school*, *green card*,
*indianapolis motor speedway*. Both readers pronounce them English; we apply German letter-to-sound:

    ucla        ours ˈʊklaː             read  j uː s iː ɛ l eɪ    (spelled out, both readers)
    sciences    ours skˈiːnkəs          read  s aɪ ə n s ə s
    society     ours zˈoːkiːtyː         read  s ʊ s aɪ ə t i
    earthquake  ours ˈeːaɐ̯thkvaːkə      read  (not reached)

That is a large open feature (unassimilated foreign runs), not a bug fix, and it is noted rather than
attacked. The **three rows that are not English** are where the actual bugs were.

### 5a. German reads years as cardinals — FIXED? no: confirmed, not yet fixed

    text  diesen trat er 1945 bei und blieb bis 1958
    ours  … ˈaɪ̯ntaʊ̯zənt nˈɔʏ̯nhʊndɐtfʏnfʊntfiːɐ̯t͡sɪç …   "eintausendneunhundertfünfundvierzig"
    read  … n aɪ n ts ɪ n ɔ t f n f ɪ ɾ ts ɪ ç …        "neunzehnhundertfünfundvierzig"

Both readers, both years, and again on `im jahr 1950`. German reads a year in 1100–1999 in the
hundreds form. Ours emits the plain cardinal. `2019 → t͡svˈaɪ̯taʊ̯zənt nˈɔʏ̯nt͡seːn` is correct, so the
defect is confined to the range where German switches form.

It is not a missing capability in the fleet — **English already has exactly this rule**
(`yearWords()` in `src/languages/english/normalize.ts`, cued by a preposition), and Swedish gets it
right: `år 1945 → nˈɪ̀tːɔnhɵndrafʏʈɪɔfɛm`. Probing the neighbours:

    en  in 1945 → nˈaᶦntˈiːn fˈɔːɹt̬i fˈaᶦv           correct
    en  in 1066 → wˈʌn θˈaᶷzənd sˈɪksti sˈɪks        wrong ("ten sixty-six")
    sv  år 1945 → nittonhundrafyrtiofem              correct
    de  im jahr 1945 → eintausendneunhundert…        WRONG
    nl  in het jaar 1945 → duizend negenhonderd…     WRONG
    da  år 1945 → et tusind …                        WRONG
    fr  en 1945 → mil neuf cent quarante-cinq        correct (the year form)
    es  en 1945 → mil novecientos cuarenta y cinco   correct

So: de, nl, da need the hundreds-form year rule; en has a gap below 1100. Not yet fixed — a year rule
needs a cue (`im Jahr`, `seit`, `von … bis`) because *1200 Menschen* is legitimately "eintausendzweihundert".

### 5b. `°c` lowercase → *Grad k* — FIXED

    text  die passagiere bekamen wasser während sie bei 90 °f 32 °c warteten
    ours  … nˈɔʏ̯nt͡sɪç ɡʁatf t͡svaɪ̯ʊndʁˈaɪ̯sɪç ɡʁatk …
    read  … ɡ ɾ ɑː t f ɑː r ə n h aɪ t …  and  … ɡ r a ts ɛ l z j ʊ s …

`src/languages/german/normalize.ts` **has** the rule, but as `/(\d)\s?°\s?C\b/gu` — uppercase only. FLEURS
transcripts are case-folded, so `°c` fell through to the bare-`°` rule and left a loose `c` for the g2p,
which maps `c → k` context-free. Added the `i` flag. `npm run typecheck` and 4,819 tests pass.

    after:  90 °f 32 °c → … nˈɔʏ̯nt͡sɪç ɡʁaːt fˈaːʁənhaɪ̯t t͡svaɪ̯ʊndʁˈaɪ̯sɪç ɡʁaːt kˈɛlzi̯ʊs

Fahrenheit is now right. **Celsius is still wrong** — `kˈɛlzi̯ʊs`, and the readers say `ts ɛ l z j ʊ s`.
German ⟨C⟩ before a front vowel is /t͡s/ (Celsius, Cent, Cäsar, circa); before a back vowel or consonant
/k/ (Café, Computer, Clown). The manifest has `"c": "k"` context-free. Left open: English loans are a real
exception class (*City* /ˈsɪti/), so this needs a referee measurement before it is changed, per §2.

### 5c. The case-sensitivity is fleet-wide, and lowercase is the MAJORITY form

Counted `°c/°f` against `°C/°F` across all 102 FLEURS `train.tsv` files:

    lowercase  298      uppercase  151

The form the fleet does not match is **twice as common** as the form it does. And the pattern is
everywhere: **127 case-sensitive `°C`/`°F` rules across 79 language files**. Only Mongolian is already
fixed, and its comment names this exact bug — "a case-sensitive `=== "F"` let `5°f` through to a
confident CELSIUS reading".

The sweep is mechanical but not blind: 15 of those rules **capture** the scale letter and branch on it
(`scale === "C" ? …`), so adding `i` to the regex without fixing the comparison flips Celsius to
Fahrenheit — strictly worse than the current miss. Both halves have to move together. Not yet done;
raised for a decision, since it touches 79 files and belongs in its own commit.

## Run 6 — 2026-08-18 15:10 — `Celsius` should be `t͡sˈɛlzi̯ʊs`, and the obvious fix does not pay

Prompted by the user's question on Run 5b's leftover: yes — German ⟨C⟩ before a front vowel is /t͡s/, so
*Celsius* is `t͡sˈɛlzi̯ʊs`, and kaikki has it exactly (`Celsius ˈt͡sɛlzi̯ʊs`). This run is why the fix did
not land.

### 6a. It is a lexical class, not a rule — measured

Of the **249** kaikki German words spelled with a bare ⟨c⟩ before a front vowel, kaikki gives /t͡s/ to
**98 (39.4%)**. We give /k/ to all 249.

    celsius   ours kˈɛlzi̯ʊs        kaikki ˈt͡sɛlzi̯ʊs
    circa     ours kˈɪɐ̯ka          kaikki ˈt͡sɪʁka
    mercedes  ours mɛɐ̯kˈeːdəs      kaikki mɛʁˈt͡seːdəs
    calcium…  ours kˈalki̯ʊm…       kaikki ˈkalt͡si̯ʊm…
    silicium  ours ziːlˈiːki̯ʊm     kaikki ziˈliːt͡si̯ʊm

A blanket rule would therefore be **wrong 60% of the time** — the other 151 are English and Romance loans
where /k/ or /s/ is correct (*City*, *Ceylon*). This is exactly the shape `consonant.tsv` exists for.

### 6b. Why the table could never learn it

`consonant.tsv` aligns our reading against kaikki **by consonant ordinal** and drops any word where the two
sides disagree on consonant count. The tie bar is in the skip set, so `t͡s` counts as **two** consonants
against our one — `Celsius` is 4 slots against 5 and falls out on the length check, before the pair
allow-list is even consulted. Two independent barriers, and the visible one (`PAIRS` has no `k → t͡s`) is
the second, not the first. Also `${i}${target}` is parsed back with `c.slice(-1)`, so a multi-character
target could not be written down at all.

### 6c. Fixed all three, and the independent referee said no

Made an affricate one slot on both sides, canonicalised the tie bar into the unit (kaikki writes the same
affricate both ways — `t͡s→ts` 2,086 times, `ts→t͡s` 868, `pf→p͡f` 710, none of it a real difference),
taught the spec parser multi-character targets, and added `k → t͡s` plus the Fugen-s unit pairs
`t͡z → t͡s` / `p͡z → p͡s`. It worked as intended in the small: `celsius 0t͡s`, `circa 0t͡s`, `mercedes 2t͡s`,
93 corrections in the new class, and the 132 Fugen-s compounds (*amtseid*, *arbeitsamt*) recovered.

Then measured, **controlled** — same kaikki extract, only the change differing:

                                    baseline        after      Δ
    kaikki deu (primary, circular)  3711/4744    3698/4744    −13
    wikipron deu (INDEPENDENT)      2313/3015    2305/3015     −8
    table entries                        3472         3401    −71
    words dropped for count skew         7023         8216  +1193

**A net regression on both referees, including the independent one.** Collapsing stop+fricative fixes the
words where one side has an affricate and the other one segment, and breaks the ones where the counts
already agreed. Reverted `german.ts`, `build-de-consonant.mts` and `consonant.tsv`; only the `°C`/`°F`
normalizer fix from Run 5b remains. `Celsius` still reads `kˈɛlzi̯ʊs` and the test says so explicitly.

### An input trap worth recording

The first regeneration came out at **1,086 entries against the committed 3,340** — a collapse that looked
like a catastrophic bug in the change. It was the input: `/mnt/data/de_kaikki.tsv` is **not** the extract
this generator documents. `tools/gen/extract_kaikki_de.py` lowercases its keys (`key=w.lower()`) and that
dump does not — 51,213 of its 72,074 rows are capitalised German nouns, and the generator's
`/^[a-zäöüß]+$/` filter silently discarded every one. Lowercasing first reproduced 3,334 entries against
the committed 3,340, and only then was a controlled before/after possible.

**Regenerate a committed table and check the entry count against the committed one before believing any
measurement taken on it** — §2's rule, and it fired twice in this run.

### Left open

- The narrow fix has no home: under the committed tokenizer `Celsius` skews out regardless of `PAIRS`, so
  there is no smaller version of this change that works. A dedicated 98-word ⟨c⟩→/t͡s/ table would do it,
  and is the honest next option if the class is judged worth it.
- The German year reading (Run 5a) is still unfixed and is the larger of the two defects.
- The fleet-wide `°C`/`°F` case-sensitivity sweep (Run 5c) is still unstarted: 127 rules across 79 files,
  15 of which branch on a captured scale letter and need the comparison fixed in the same edit.

## Run 7 — 2026-08-18 15:15 — the three open items, all landed

### 7a. ⟨c⟩ → /t͡s/ as a dictionary, /k/ as the OOV rule (the user's framing, and it works)

Run 6 failed because it tried to teach `build-de-consonant.mts`'s ordinal alignment a new trick and
regressed the table. Reframed as "put the known words in the dict", it is clean and needs **one** engine
change: `applyConsonant` parsed its target back with `c.slice(-1)`, so a multi-character target could not
be written down at all. Parsing `^(\d+)(.+)$` instead is inert for every existing single-character row
(referee unchanged at 3711 / 2313 with only that edit in).

The list itself is `tools/gen/de-consonant-curated.tsv`, built by a new `build-de-c-affricate.mts` and
merged into `consonant.tsv` by the main generator. The affricate-collapse that regressed the whole table
lives *inside that small build*, where it only has to align this one class, and its unit indices are
converted back to the shipped tokenizer's counting before they are written.

    84 entries, from the 249 kaikki words spelled with a bare ⟨c⟩ before a front vowel
    celsius 0t͡s   circa 0t͡s   mercedes 2t͡s   silicium 2t͡s   cyan 0t͡s   acetat 0t͡s …

    per-word against the gold:  84 better, 0 worse
    kaikki deu (primary)        3711 → 3717
    wikipron deu (INDEPENDENT)  2313 → 2314

`Celsius` now reads **`t͡sˈɛlzi̯ʊs`**. And the OOV default holds where it should: `Cafe → kafˈeː`,
`Computer → kɔmpˈuːtɐ`, and `Calcium → kˈalki̯uːm` — the honest case, since `calcium` is absent from the
kaikki extract (only its compounds are there) and so is genuinely OOV.

⚠ The shipped `consonant.tsv` is the **committed** table plus the 84 curated rows, not a wholesale
regeneration. Regenerating from the extract available here also pulls in 132 unrelated entries that the
committed table does not have (§6's input trap), and those are not this change's business.

### 7b. German years — the hundreds form, measured off the audio in both directions

    im jahr 1945  →  ɪm jaːɐ̯ nˈɔʏ̯nt͡seːnhʊndɐtfʏnfʊntfiːɐ̯t͡sɪç      (was: …ˈaɪ̯ntaʊ̯zənt nˈɔʏ̯nhʊndɐt…)

Two decisions, both taken from the recognized phones rather than from grammar books.

**The range is 1100–1999 and stops there.** Over de_de utterances carrying exactly one 4-digit 1100–2099
number and a recognisable reading:

    11xx–19xx   hundreds 37   tausend  6
    20xx        hundreds  0   tausend 67

German switched at the millennium — 2008 is *zweitausendacht* and never *zwanzighundertacht* — so the
existing 20xx behaviour was already right and is untouched. 10xx is excluded too: German says
*tausendsechsundsechzig*, not *zehnhundert…*.

**No context cue, unlike English.** `yearWords` in English is gated on `in|of|since|…` because "2011
people died" is a live ambiguity. German writes a count of that size with a unit or measure noun after it:
of the **176** four-digit 1100–1999 numbers in the de_de splits, exactly **2** are count-like (`1600 km`,
the same sentence twice). A cue list would have caught only 21 of the 37 audio-confirmed cases — readers
use the hundreds form after a bare noun (*Festung 1620*), after a verb, and at a sentence start. So the
rule defaults to the year reading and a measure/quantity guard carries the exceptions.

Re-scored against the audio over all 110 de_de utterances with an 11xx–19xx number:

    closer to what the reader said  104
    further away                      4
    unchanged                         2
    mean distance  0.2662 → 0.2337     median  0.2620 → 0.2289

The 4 regressions, named rather than smoothed over: two are the same sentence (`1200 Briefkastenfirmen`,
a count whose noun no guard list will contain), one is `um 1500` where the reader chose the cardinal for a
round year, and one is a mangled transcript (`nördlich von 1770`). That is the precision limit of a
default-to-year design and it is 2 sentences in 110.

⚠ **Two traps, both caught by CI rather than by me.** The trailing guard was written `(?![\d.,])` by
analogy with the lookbehind; that rejects a year ending a clause, so `1990-1995.` had its first endpoint
turned to words and its second left a numeral, and the range rule then dropped the reading (trap 58,
`test/clause-final-range.test.ts`). English's `(?![.,]?\d)` is the correct shape. And the count guard was
written with capitalised nouns, so `1200 menschen` sailed through as *zwölfhundert* — the identical
case-sensitivity bug this same session found in the degree rule, reintroduced one screen away from it.

### 7c. The `°C` / `°F` case sweep — every registry code, and a fleet test to hold it

    lowercase °c/°f  298      uppercase °C/°F  151     (all 102 FLEURS train splits)

The form the fleet did not match was twice as common as the form it did. Swept the regex flag across
**127 rules in 79 files**, then fixed the other half of the fix: **14 handlers branch on the captured
scale letter** (`scale === "C" ? Celsius : Fahrenheit`, `SCALE[sc]`). Adding `i` without those is
*strictly worse* than the original miss — `°c` starts matching and reads as **Fahrenheit**, or the table
lookup misses and a literal `undefined` reaches the IPA. Setswana actually produced `undɪfinɪd` mid-run,
and Latvian and Sylheti threw outright, before the lookups were made case-folding.

Final state: **all 192 registry codes read `°c` exactly as `°C`**, no flips, no `undefined` leaks.
`test/degree-scale-case.test.ts` asserts all four properties fleet-wide off the language catalogue.

⚠ **A self-inflicted failure worth recording, because it nearly shipped.** The sweep's second pass matched
`new RegExp\((.*?),\s*"([gimsuyv]*)"\)` with `re.DOTALL`. Across a whole file that `.*?` spans statements,
and `"([gimsuyv]*)"` happily matches an **empty string** — so `, "")` closing an ordinary
`.replace(X, "")` far below a `new RegExp(` was treated as its flags argument and became `, "i")`. Five
replacement strings were corrupted that way, in five unrelated languages: Japanese pitch accent, Latvian
digit de-grouping, Estonian and Sepedi whitespace collapse, Setswana comma stripping. The full suite
caught all five (4 failing files), none of which had anything to do with degrees.

**A regex sweep across a repo must be anchored to a single line, or it will edit code it never matched.**
The re-application was done as 14 named, one-per-site edits instead.

⚠ **AND ANCHORING TO A LINE IS NOT ENOUGH — the same trap fired again, within one line.** Many languages
fold the single-character ligatures on a single statement:

    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");

Neither regex literal there contains a `°`. But a literal-matching pattern will happily run from the first
`/` across `℃/gu, "°C").replace(/` — a span that DOES contain a `°` and a `C` — treat that as one regex
body, find empty flags after it, and insert its `i` in the middle. The result is `/i℉/gu`: **twelve
languages silently stopped normalising ℉**, in Bavarian, Bulgarian, Burmese, Central Kurdish, Danish,
Finnish, Icelandic, Norwegian, Romanian, Sindhi, Swedish and Tibetan.

**All 4,821 tests still passed.** Nothing in the suite read a ℃ or a ℉. It was caught only by diffing every
changed line against `HEAD` and requiring each one to reduce to an intended edit — which is the check that
should have run before the first CI pass, not after. `test/degree-scale-case.test.ts` now asserts the
ligature fold fleet-wide, so the gap that hid this is closed.

Final: **250 files, 4,826 tests**, and every changed line in the 95 swept files verified to be either a
flag gaining `i` or a `.toUpperCase()` on a scale lookup.

### Where the QC work stands

All three items from the handoff's follow-on list are done. `npm run ci` is green — 250 files, 4,825
tests. Still open, and now the top of the queue:

- The `all-flagged` residual (Run 4) is 747 rows and only `de_de`'s 23 have been read. `ln_cd` (37, none
  with a sibling), `sn_zw` (30), `he_il` (25) and `ceb_ph` (24) are next by size.
- Embedded English in German (Run 5) is untouched — 20 of the 23 `de_de` rows, and a large open feature
  rather than a bug fix.
- `sl_si` stress (handoff §4) has not been started.

## Run 8 — 2026-08-18 15:45 — the review, and the regression it caught

`/code-review 837 high` returned seven findings. Two were mine and serious.

### 8a. The year rule ran before the symbol tier and ate its input

The worst finding, and a regression this branch introduced rather than a pre-existing gap. Every symbol
rule in German — the degree arm in `normalize.ts`, and `%` / `€` / `$` / `×` in the shared
`normalizeSymbols` tier — is keyed on a **digit adjacent to the symbol**. `normalizeGerman` runs before
that tier, so rewriting a year's digits to words left the symbol with nothing to attach to, and it was
dropped in silence:

    1200 % der Fälle   →  t͡svˈœlfhʊndɐt deːɐ̯ fˈɛlə          Prozent gone
    1500 €             →  fˈʏnft͡seːnhʊndɐt                   Euro gone
    1500 $             →  fˈʏnft͡seːnhʊndɐt                   Dollar gone
    ein Winkel von 1200 °  →  … t͡svˈœlfhʊndɐt                Grad gone
    1200 x 800         →  t͡svˈœlfhʊndɐt ks ˈaxthʊndɐt        mal → the letter ks

Not a wrong reading — a **deleted** one, which is the failure shape §1 of the handoff is about. The rule
is now its own exported pass, `normalizeGermanYears`, run after `SYMBOLS` in the German pipeline. That
also improves the guard: by the time it runs the symbols are already spelled out, so it inspects
*Prozent*, *Euro*, *Kilometer*, *mal* rather than `%`, `€`, `km`, `×` — one form per unit instead of two.

### 8b. Every symbol alternative in the guard was dead, and the words were uninflected

Two more holes in the same guard, both from `\b`:

- `\b` is a **word**-boundary assertion, so after a non-word character it only holds when a word character
  follows. `%\b`, `°\b`, `€\b`, `\$\b` therefore never matched anything at all. Every symbol alternative I
  wrote into that list was inert from the start — the `1500 €` case above would have failed even with the
  ordering right.
- German inflects its measure nouns, and `Einwohner\b` fails on the dative `-n`. *mit 1200 Einwohnern*
  read as a year. The guard is a **stem** list with a trailing `\p{L}*` now, and it gained the nouns that
  were simply missing: Prozent, Jahr, Million/Milliarde, mal, Stück, Meile, Volt, Hektar and the rest.

### 8c. Five more sites where the blanket flag widened the wrong thing

Run 7c already caught Crimean Tatar's `\p{Ll}` suffix capture folding under `i`. The review found five
more of the same shape — a lowercase-only sub-pattern sitting beside the scale letter:

    fi   `[a-zåäö]+`  case suffix        ba/tk/tg  SFX / SUFFIX      hyw  ARM_LOWER

and one of them was observably broken: `ba "20 °C-ТА"` took the suffixed arm it should not have and
**lost the Celsius word** (`jɪɡɪɾˈmɪ ɡɾɑdusˈtɑ` against `… t͡sɪlˈsij ɡɾɑduˈsɯ ˈtɑ`). All five now put the
lowercase scale letters in the character class and drop the flag, which is what the languages that were
already correct here (Bosnian `[CFСcf]`, Croatian `[CFcf]`) do.

Hungarian was the mirror image: its suffixed arm got the `.toUpperCase()` half of the fix and not the flag
half, so `20 °c-a` fell through to the plain arm and `-a` was stranded as its own stressed word — exactly
the "half the fix" failure the test file's own header warns about.

**The fleet test missed all of this because it probed only `30 °C`.** Several languages claim a suffixed
or signed degree with a separate, earlier rule, and only that rule keeps the suffix attached. The test now
probes `20 °C-a`, `-5 °C` and `20 °C-den` as well.

### 8d. The curated builder was not reproducible

`build-de-c-affricate.mts` keys on our `k` where kaikki has `t͡s` — but `phonemizeWord` lazily loads
`consonant.tsv`, which is the file the curated list is merged into. Re-running it once the 84 rows were in
place made `ou[i] === "k"` false for every one of them and emitted a nearly empty list: the class would
have silently disappeared on the next regeneration. It truncates `consonant.tsv` first now, exactly as
`build-de-consonant.mts` does, and the header states the run order. Verified byte-identical across a
re-run — which is why the file's header is generated rather than hand-written.

### 8e. The screen's stale-verdict clear leaked two ways

`status <> 'investigate'` is NULL, not true, for a row at status NULL — the rows the README warns are
"invisible to any exclusion gate". And a row still flagged whose `dist` was cleared never enters the
grouping loop at all, so nothing re-derives its verdict and nothing removed it either. Both disappear if
the column is blanked first and then written, which is what it does.

### What to take from this round

The two findings that mattered were both **deletions**, not wrong answers: a symbol dropped from the
output, and a lexicon class that would empty itself on the next build. Neither moved a test. §1 of the
handoff says the failure mode here is a stage that quietly does not run; the same is true of a rule that
quietly stops matching, and `\b` after a non-word character is a very good way to write one.

### 9e. Swept the class rather than waiting for round three

Rather than let a third review find a fourth sibling arm, audited every remaining `i`-flagged degree rule
in the tree for a lowercase-only class or property beside the scale letter. One left — Russian, where the
fold makes a NEGATIVE guard (`(?![а-яё])`, against a spelled-out *Cельсия*) stricter rather than looser, so
it was not a live defect. Given both cases of both alphabets in the class and the flag dropped anyway;
output byte-identical across all eight scale-letter spellings. **Remaining fold hazards in the tree: 0.**

`npm run ci`: 250 files, 4,827 tests.

## Run 9 — 2026-08-18 16:05 — the second review round

Re-ran `/code-review 837 high` against the fixed branch. Six findings, and the pattern in them is the
useful part: **three were sibling arms of rules I had already fixed, in files I had already touched.**

### 9a. Three more suffix arms, in the same three files

Run 8c fixed the `i`-widening in Bashkir, Turkmen, Tajik, West Armenian and Finnish. Each of those files
has more than one degree rule, and I fixed the one the earlier grep surfaced:

    ky   line 498   `suffixArm` embeds SUFFIX_RE, lowercase Cyrillic only
    ba   line 287   the LETTER-FIRST arm (`С°-суффикс`), sibling of the one fixed at 282
    hyw  line 219   the BARE-degree suffix arm — which contains no scale letter at all,
                    so the flag was pure widening with no fix attached to it

Kyrgyz was the one with teeth. The widened capture took an uppercase suffix, `suffixKind()` then failed to
recognise it, and the `?? CASE.loc` fallback substituted **the wrong grammatical case in silence**:

    30 °C-ДАН   (ablative, "from 30 degrees")   read as   otuz ʁrɑdustɑ   (locative, "at 30 degrees")

Not a dropped word — a wrong one, and plausible enough to survive a reading. All three now put the
lowercase scale letters in the character class and drop the flag.

**The lesson is about the sweep, not the languages: a per-line grep finds the rule, not the RULE FAMILY.**
Bashkir has four degree arms and West Armenian five. Having fixed one arm in a file, the others need
reading — the comment sitting directly above Bashkir's line 287 states the very invariant that line broke.

### 9b. `all-flagged` was the else of "no sibling is verified"

A real logic defect in the screen, in its highest-value category. `recognizer_short` and `defective_audio`
mean the comparison **did not happen** — the recognizer returned almost nothing, or the audio is broken —
so such a row says nothing about our IPA in either direction. Treating "not verified" as agreement
promoted a sentence with one flagged recording and one *silent* one into `all-flagged`, which the README
sends a reviewer to read first as the strongest signal in the corpus.

Only comparably scored siblings (`verified` / `investigate`) are evidence now; hand verdicts are excluded
on the same reasoning. Blast radius measured before fixing: **2 of 749 rows**. Small today and structural
— it grows with every defective_audio row the sweep finds.

    exonerated 6,442 · all-flagged 749 → 747 · no-sibling 1,176 → 1,178

### 9c. The generated table no longer rebuilt byte-identically

The two header lines about the curated ⟨c⟩ list were added by the merge step, not by
`build-de-consonant.mts`, so re-running the generator silently dropped them — breaking the property
`LICENSES/PROVENANCE.md` relies on for every other generated artefact. The generator's `hdr` owns them now.

### 9d. The new fleet test could not reach any of 9a

Its suffix probes were `20 °C-a`, `-5 °C`, `20 °C-den` — all ASCII Latin, while the classes that fold are
Cyrillic and Armenian. Cross-script probes added there; and the three languages got concrete anchors in
their own test files, which is the better instrument for this — `ky "30 °C-ДАН"` must read as
`ky "30 °-ДАН"` does, and `ba "35 С°-ТАН"` must keep its hyphen.

### The shape of both review rounds

Thirteen findings over two rounds, and **not one of them moved a test**. They divide almost evenly into
things that stopped matching (`\b` after a non-word character, an uppercase-only rule, a builder reading
its own output) and things that started matching (five `i`-widened suffix classes). Both halves are
invisible to a green suite, and both were found by reading the diff against what the code is *for* rather
than by running it.

### 9e. Swept the class rather than waiting for round three

Rather than let a third review find a fourth sibling arm, audited every remaining `i`-flagged degree rule
in the tree for a lowercase-only class or property beside the scale letter. One left — Russian, where the
fold makes a NEGATIVE guard (`(?![а-яё])`, against a spelled-out *Cельсия*) stricter rather than looser, so
it was not a live defect. Given both cases of both alphabets in the class and the flag dropped anyway;
output byte-identical across all eight scale-letter spellings. **Remaining fold hazards in the tree: 0.**

`npm run ci`: 250 files, 4,827 tests.

## Run 10 — 2026-08-18 16:40 — working the `all-flagged` queue: what 747 rows are made of

With the screen corrected (Run 9b) the residual is **747 rows**. Prioritised by lift over each language's
own median rather than by raw count, because a language the recognizer finds easy showing an all-flagged
cluster is the stronger signal:

    lang    n   median  all-flagged  ratio        lang    n   median  all-flagged  ratio
    fr_fr  20   0.085     0.279      3.26         ceb_ph 24   0.246     0.603      2.46
    hr_hr  17   0.137     0.386      2.81         sn_zw  30   0.219     0.539      2.46
    ln_cd  37   0.189     0.530      2.80         bs_ba  11   0.157     0.372      2.37

Classified all 747 by what the text contains:

    384  (51.4%)  same-script prose
    337  (45.1%)  contains digits
     26  ( 3.5%)  ≥10% of letters in a script the language does not own

**Numbers are the largest tractable class**, and they concentrate hard: `ln_cd` 33 of 37, `ceb_ph` 22 of
24, `sn_zw` 22 of 30, `fil_ph` 13 of 17. The script test under-counts the second class badly — French and
German embedded English is *same-script*, so it lands in "prose".

### 10a. Code-switching is what the readers do, and it is measurable

The user's read of the French cases: a professional reader code-switches into English for an embedded
English run rather than applying French letter-to-sound — speaker-dependent, but that is the target.

Tested it. Took the nine `fr_fr` all-flagged rows carrying a hand-marked English span, phonemized each
twice — French throughout, and with the span read by the **English** engine — and scored both against the
recognized phones:

    French throughout   mean 0.3092
    code-switched       mean 0.2760          closer in 7 of 9 rows

Grouped by sentence, the speaker-dependence shows up exactly as predicted:

    sentence 222  "…à la crown court de birmingham…"        M 0.321→0.284  F 0.236→0.200  M 0.558→0.487
    sentence 1464 "…« wonders of the african world »…"       F 0.306→0.248  F 0.287→0.214
    sentence 818  "…le running tours barcelona…"             F 0.300→0.233  F 0.252→0.305   SPLIT
    sentence 954  "…airlines such as emirates etihad…"       F 0.245→0.227  F 0.278→0.286   SPLIT

Unanimous on the two sentences whose English is an institutional proper name (*crown court*, a programme
title); **split between two readers of the identical sentence** on the two that are running English prose.
So code-switching is the right default and the residual disagreement is genuine reader variation, not a
defect to engineer away.

⚠ **This also validates the screen.** These rows are `all-flagged` — every recording of the sentence
disagrees with our IPA — and the fix improves the majority of them. The category is doing what it claims:
pointing at systematic gaps rather than at reader noise.

### 10b. Why the foreign-run host does not already do this

`src/core/foreign.ts` routes unclaimed runs by **script**. French owns Latin, so its own tokenizer claims
`crown court` and there is no unclaimed run for the host to see. Same-script code-switching needs a
LANGUAGE signal, not a script one — which is what `docs/OpenLID-fastText.scratch.md` is already scoped
for, span output included ("mixed-language input described as runs of language over input offsets").

Not attempted here: a span-level language identifier is its own piece of infrastructure, not a queue fix.
What this run contributes is a **number to size it by** — −11% mean distance on the affected French rows,
plus the 20 of 23 `de_de` rows from Run 5 that are the same class.

### 10c. Two smaller things seen in passing, both recorded rather than fixed

- The **French neural OOV tagger emits `nŋ`** — `birmingham → biʁminŋˈam`, `buckingham → bukinŋˈam`,
  `kingston → kinŋstˈɔ̃` — tagging both letters of ⟨ng⟩ as a consonant. No French analysis produces a
  coronal-plus-velar nasal cluster, and the sync rules do not (they give `biʁmɛ̃ɡˈɑ̃`, a full French
  spelling-pronunciation). Only ~5 tokens in the corpus, so it is a tagger artefact rather than a defect
  class; `el_gr` shows the same shape more often (145: `ɾaninŋɡ`, `bumeɾanŋɡ`, `xanŋɡul`). ⚠ Most
  `nasal+nasal` sequences corpus-wide are LEGITIMATE — Korean and Thai syllable boundaries (`tˈoŋmuɭ`),
  Nguni nasal-plus-click (`mŋǀ`), Swedish `dɛsˈɪŋn` — so this must be counted as `nŋ`/`ŋn` specifically,
  not as any nasal cluster. A first pass that did not distinguish them "found" 17,687 rows, nearly all
  correct.
- **Lingala readers code-switch into French for numerals.** `783 562 kilomètres carrés` — we emit the
  Lingala number words (`bi˩lu˥ⁿdu˩ sa˩ᵐbo˩ na˩ mi˩ko˩ko˩…`) and the readers say French
  (`s ɛ ts ɑ̃ k a t o n t`, `m i l k a t r v ɛ t ʁ`). The same phenomenon as 10a in the other direction,
  and it is why `ln_cd` is 33/37 digits. Whether to follow the readers here is a policy question, not a
  bug — but the number class in this queue is not one defect, it is at least two.

## Run 11 — 2026-08-18 17:10 — the digit class is the SAME defect, and it is not ours

Run 10 called numbers "the largest tractable class" at 45% of the residual. That was the wrong frame.
Reading `ceb_ph`'s digit rows makes it obvious — the readers say the numerals in **English**
(`s e v e n a n d ɹ i d d e t ɾ i t aʊ z a n d`, `t w ɛ n t i f ɔ ɹ s t`) while we emit the native
Cebuano numerals (`pˈito kˈa ɡˈatos ʔˈuɡ kawalˈoʔan…`). It is 10a again, applied to numerals.

Tested it the same way: phonemize each digit-bearing all-flagged row twice — natively, and with the digit
runs alone read by another engine — and score both against the recognized phones.

    lang       n   native      →en      →es      →fr    sourced target
    ceb_ph    22   0.6028   0.4643   0.5214   0.5188    en   (Δ +0.1385)
    fil_ph    13   0.5519   0.4677   0.5147   0.4965    en   (Δ +0.0842)
    sn_zw     22   0.5407   0.4026   0.4527   0.4586    en   (Δ +0.1381)
    ln_cd     33   0.5333   0.4925   0.4413   0.3729    fr   (Δ +0.1604)

    85 of 90 rows closer — 94%

⚠ **THE TARGET LANGUAGE IS SOURCED, NOT ASSUMED**, and that mattered. Cebuano and Tagalog have three
numeral systems in use — native, Spanish-derived and English — so "English" was a hypothesis with a real
competitor, not a given. The audio refutes Spanish for both (`ceb` 0.521 against 0.464, `fil` 0.515
against 0.468). Each language lands on the language of its own administrative history, and each beats
both alternatives rather than merely beating native.

### What this does to the queue

The two largest classes in the 747-row residual collapse into one phenomenon:

    same-script prose  384 (51.4%)   — includes the fr/de embedded-English rows (10a)
    contains digits    337 (45.1%)   — numeral code-switching, this run

Neither is a phonemizer defect. Both are the same missing capability — **a span-level language signal**,
which `docs/OpenLID-fastText.scratch.md` is already scoped for. The prize is now measured on two
independent slices: −11% mean distance on French prose spans, −25% on numerals across four languages.

⚠ **And the priority ordering in Run 10 was wrong.** It offered "work the digit rows" and "treat
code-switching as its own project" as alternatives. They are the same work; the digit rows are not a
separate pile of bugs. What remains genuinely unexplained in this queue is the same-script prose that is
NOT embedded foreign material — which is where `hr_hr` (2.81× lift) and `bs_ba` (2.37×) sit.

### A tooling trap worth recording

The first `fil_ph` run died with `no phonemizer registered for "fil"`. The probe derived the engine code by
splitting the FLEURS code on `_`, which is right for 97 of 102 languages and wrong for five — the corpus
tooling already carries the mapping (`VARIETY` in `phonemize-fleurs.mts`: `fil_ph→tl`, `ar_eg→arz`,
`es_419→es-419`, `pt_br→pt-BR`, `ny_mw→nya`). **Re-derive nothing the corpus tooling already states**; a
one-off analysis script that guesses the code will be wrong exactly on the languages whose code is
interesting.

## Run 12 — 2026-08-18 17:40 — the first genuine phonemizer defect out of this queue: BCS geminates

`hr_hr` sits at 2.81× lift and its all-flagged rows are same-script prose, so it survives the Run 10/11
finding that most of the queue is code-switching. Reading them:

    ellsworth land regija je južno od otoka okružena bellingshausenovim morem
      OURS  ˈellsʋortx land rˈeː˥˩ɡija … bˈellinɡsxausenoʋim mˈorem
      HEAR  ɛ l z w ə θ l ɛ n d r e ɡ h i a … b ɛ l i ŋ s h aʊ z ə n ɔ v i m m o r ə m

**Every doubled consonant letter was emitted as a geminate**, and BCS has none. Confirmed across the
shared engine — `anna → ˈanna`, `emma → ˈemma`, `holland → xˈolland`, `hobbit → xˈobbit`, `jazz → jazz`.

    hr_hr  344/3461 rows (9.9%) carry a geminate
    bs_ba  237/3091 rows (7.7%)
    sr_rs   28/2944 rows (1.0%)   ← Cyrillic, so foreign names arrive already transliterated

175 distinct source-word types, **every one a loan or a foreign name** (costello, guinness, danielle,
running, buffalo, whitehall, apple, ellsworth).

### The exception I wrote, and the audio taking it away

`naj-` before a ⟨j⟩-initial stem is the one doubled consonant BCS writes natively —
*najjednostavniji*, *najjeftiniji* — so I exempted it. Then checked what the readers say:

    n aː j e d n o s t a v n i        n aɪ j e f t i n i        n aː j a n u s t a v n i

**A single /j/**, with the length on the prefix vowel rather than the consonant. The exemption was removed.
The prefix seams a grammar would predict next — `podd-`, `izz-`, `nuzz-` — appear in neither the corpus nor
the referee, so there is nothing to carve out and nothing to carve it from. Degemination is unconditional
for consonants; **vowels are untouched**, since ⟨oo⟩ in a loan is two syllables (`zoo → zˈoo`).

### Why the referee could not decide this, and the audio could

The wikipron/epitran sets hold **four** doubled-consonant words between them, and the human referee
contradicts itself across two of them — it keeps `Matteo`'s Italian geminate and drops `inšallah`'s
(`ǐ n ʃ a l aː x`, exactly what we now emit). Net referee movement: **−2 of 26,486** primary, −4 secondary,
all of it `Matteo`.

Against the audio, over every geminate-bearing utterance in the three languages:

    bs_ba  n=237   0.1895 → 0.1858    better 218, worse 12
    hr_hr  n=344   0.1846 → 0.1807    better 318, worse 18
    sr_rs  n= 28   0.1697 → 0.1698    better   8, worse  9   ← abbreviations, not loans; a wash
    TOTAL  n=609   0.1858 → 0.1822    better 544, worse 39

14:1 in favour. The absolute movement is small because one collapsed phone sits in a hundred-phone
utterance; the ratio is the signal.

⚠ **IMPLEMENTED IN THE SCAN, NOT AFTER IT.** `phonemizeWord` records each nucleus as a span into the output
string and places the pitch accent by that index. Collapsing geminates in a post-pass shifts every span
after the first one and lands the accent on the wrong vowel. Skipping the duplicate letter during the scan
keeps the spans correct by construction.

Two goldens were pinning the defect (`Dr. Moll → …moll` in the hr and bs tests) and are updated — the
reader of that very utterance says `m o l o t k r e`, a single /l/.

### Also seen, not fixed

`sr`/`bs` **drop ⟨w⟩ entirely** where `hr` maps it to /ʋ/ — `watt → at` against `ʋat`, `ellsworth → ˈelsortx`
against `ˈelsʋortx`. A deletion rather than a mis-mapping, and the hr side already has the fix, so this is
a straightforward next item rather than an open question.

## Run 13 — 2026-08-18 18:30 — the #838 review: two more silent deletions

Six findings. The pattern from Run 9 repeated exactly — **the fix for one language reintroduced the same
defect in its sibling**, and the two serious findings were both deletions no test could see.

### 13a. Degemination was deleting letters from initialisms

The rule fired on any doubled consonant in any word, and this pipeline reads an acronym as a letter run
rather than spelling it out:

    СССР → sr        SSSR → sr        MMF → mf        BBC → bt͡s        www → ʋ

`СССР`/`SSSR` and `MMF` are high-frequency in BCS news prose. ⚠ **And the distance metric cannot see this**
— a deleted letter in a four-letter acronym barely moves a sentence-level score, which is precisely why the
`sr_rs` result in Run 12 read as an uninformative wash (8 better / 9 worse) instead of as this. The audio
instrument has a floor, and a short token is under it.

Guarded on two signatures, either sufficient: **no vowel letter** (`sssr`, `mmf`, `www`, `bbc`, `cctld`) or
**all caps with ≥2 letters** (`ADD`). Neither can fire on a real BCS word carrying a geminate — they are all
loans, and loans have vowels. A native vowelless word (`krv`, `prst`, `crn`) takes its nucleus from a
syllabic ⟨r⟩ and never doubles a consonant.

### 13b. The `stepeniW` defect was fixed for Serbian and introduced in Bosnian

Run 12 found and fixed this for `sr`. Bosnian's compass arm allows only `[SJIZsjiz]`, so `W X Y Q` survived,
and once the shared fold started mapping the letter it glued onto the noun — `stˈepeniʋ`, with the stress
lookup then running on the nonexistent `stepeniv` and losing the pitch accent. The identical failure, in the
file next door, created by the very change that fixed it elsewhere.

### 13c. And the Serbian guard I added scoped to the whole match

`(?![\p{L}\p{M}])` on the end of the rule made a degree followed by **any** other letter fail outright,
taking the degree noun with it:

    35°З   main  trˈiː˩˥deset peː˥˩t stˈepeniz   →   HEAD  trˈiː˩˥deset peː˥˩t z

`З` is the Cyrillic west-bearing — the form a Cyrillic corpus actually writes, so this was a regression on
the only script that matters for `sr`. The lookahead now scopes to the compass letter alone, and the class
carries both scripts (`С Ј И З`), which is the trap `bosnian/normalize.ts` already records against
Croatian's Latin-only list.

### 13d. Documentation that outlived its code

The 40-line JSDoc sourcing the ⟨q w x y⟩ readings stayed in `croatian.ts` when the code moved to
`serbian.ts`. It lexically re-attached to `export const SYMBOLS` and its "⚠ WHAT THIS DELIBERATELY DOES NOT
DO … It does not touch `serbian/serbian.ts`" paragraph asserted the opposite of the change that moved it.
A `See FOREIGN_LETTER` cross-reference dangled at an identifier no longer in the file. **Moving a definition
means moving its rationale**, and a lifted block does not error — it silently documents the wrong thing.

### 13e. The seams I named were not the productive ones

The comment cited `podd-`, `izz-`, `nuzz-` as the classes checked and absent. The productive native seams
are `van-`/`izvan-` + n and `nad-`/`pod-` + d — *vannastavni*, *izvannastavni*, *naddržavni*,
*poddijalekt* — and they **are** collapsed. Restated as the stated limit it is: absent from the corpus and
from both referees, and the one native class that *could* be measured (`naj-` + j) degeminated in the
readers' speech against every expectation, so carving out an unmeasured class after that would be guessing
twice.

### Deliberately left

Cyrillic scale letters after a degree (`°Ц`, `°Ф`) still glue onto the noun, as on main. Counted what
follows a degree sign anywhere in the BCS corpus: only Latin `w f c z`. Adding Cyrillic scale letters would
invent behaviour for a population the artifact does not contain.

    whole corpus after the fixes:  716 better, 148 worse over 9,496 rows   (was 719 / 165)
    hr_hr worse 18 → 11 — the removed cases were the deleted letters

### Checking the third sibling before a third round could

Run 9's lesson applied to this change: having fixed the degree arm in `sr` and `bs`, read Croatian's.
It has the same shape and no bare-degree arm at all — `35°` drops the noun outright, and `35°Q` leaks a
stray `k`. Pre-existing, not introduced (only `croatian.ts` is touched here, never its `normalize.ts`).

**Left alone, and the corpus is the reason.** Counting bare degrees not already claimed by the C/F or
compass arm across `hr_hr`: **zero**. Its only bare degrees are `35° w`, a longitude the compass arm claims
through its `\s?` — which is what the rule's own comment says it is for ("a LONGITUDE — the bare-degree
rule must not claim it"). Adding an arm there would invent behaviour for a population the artifact does not
contain, the same reason the Cyrillic scale letters were left. Recorded so it is not mistaken for an
oversight the next time this family is read.

### Across three review rounds now

Nineteen findings, **not one of which moved a test**. The recurring shape is no longer surprising: a fix
applied to one member of a shared-engine family leaves the siblings holding the same defect, and the
measurement instrument that justifies the fix is blind to short tokens. Both are arguments for reading the
whole family and for checking a per-token diff, not only an aggregate.

## Run 14 — 2026-08-18 19:15 — the third round, and a design lesson about my own change

Eight findings. **The three HIGH ones were all mine, all in the same rule, and all introduced by the
previous round's fix.** That is worth recording as a pattern rather than as three bugs.

### 14a. The degree arm was wrong in three ways at once

    whitespace outside the group   око 35° од екватора  →  …stepeniод екватора
    Cyrillic bearing class         температура 35° и падавине  →  the conjunction DELETED
    Latin bearings missing         35°Z, 35°J glued; bs 35°N, 35°E fell through both arms

The second is the ugly one. `и` ("and") and `с` ("with") are two of the commonest words in Serbian **and**
they are compass bearings, so a rule that tolerates a space before the bearing letter eats them. The same
shape existed **pre-existing** in the siblings: `bs 35° i padavine` read the conjunction as *istočno*, and
`sr 35° с падавинама` read the preposition as *Celsius* via the scale arm.

The unifying fix is one constraint: **a bearing must be attached to the degree sign.** Every bearing in
this corpus is written that way — `35°w`, `35°z` — so requiring it costs nothing and removes the ambiguity
at the root instead of enumerating exceptions. Cyrillic ⟨С⟩ left the scale class with it, on the same
reasoning: Cyrillic scale letters are ×0 in the corpus, so between keeping an unattested reading and
deleting a common preposition, the unattested one goes.

### 14b. The all-caps guard made the phonemizer case-sensitive

Run 13's initialism guard used "no vowel **or** all caps". The second arm fires on any all-caps token:

    Holland → xˈoland        HOLLAND → xˈolland
    Anna    → ˈana           ANNA    → ˈanna

So every all-caps proper noun and every headline kept a geminate the language does not have. **A
phonological rule must not depend on capitalisation.** The no-vowel signature alone identifies a letter run
(`sssr`, `mmf`, `www`, `bbc`), and it cannot fire on a real BCS word: the words carrying a geminate are all
loans, and loans have vowels. A vowel-bearing initialism (`ADD`) is read as the pseudo-word this engine
already treats it as — the pre-existing absence of an initialism speller, not this rule's to fix.

### 14c. The lesson: the weak half of the change forced the risky half

Worth stating plainly, because it is a design observation and not a bug. The degree-arm surgery exists
**only** because the `foreignLetters` fold makes a stray bearing letter audible — before it, the letter was
silently dropped by the g2p and nothing needed to consume it. And the fold is the half of this work whose
evidence is weak: `qu` is 23-4, but `w` is 93-67 and `y` 107-91, both confounded by code-switching.

So the strongly-evidenced change (degemination, 544-39) needed no rule surgery at all, while the
weakly-evidenced one (the ⟨w⟩/⟨y⟩ fold) has now cost three HIGH regressions across two review rounds in
three different files. **A change that is merely defensible should not be allowed to drag a change that is
well-measured into risk.** If the fold's ⟨w⟩/⟨y⟩ arms were deferred until span-level LID exists, the degree
arms in all three languages could be left exactly as they were.

Recorded rather than acted on: the fold also removes real deletions (`Qing → inɡ`), the degree arms are now
correct and tested, and the pre-existing conjunction bugs it surfaced are worth having found. But the next
time a weakly-supported fold wants to ride along with a strong fix, split the commit.

    whole corpus, unchanged by this round: 716 better, 148 worse over 9,496 rows
    every corpus degree form still reads: 35°z, 35°w, 30 °c, +30°c, 35° w, 90 °f

### Four rounds

Twenty-seven findings, none of which moved a test. The three recurring shapes are now nameable: a fix
applied to one member of a shared-engine family leaves the siblings holding the same defect; a measurement
instrument that scores whole sentences is blind to a deleted letter in a short token; and a rule written to
consume one thing will consume its neighbours unless the anchor is tight.

## Run 15 — 2026-08-18 20:10 — round five, and the split question answered by measurement

Six findings. The three MEDIUM ones share one cause: round four's attachment rule was **case-blind**.
`s` is the preposition "with" and `S` is *južno*; `i` is "and" and `I` is *istok*. Only the LOWERCASE
letter is ever a word, so requiring attachment of both removed the spaced uppercase bearing — an ordinary
way to write a latitude. `35° S od ekvatora` stopped reading and left a bare `s` phone.

Also: ⟨W⟩ was being consumed in Bosnian while N and E were read, though *zapadno* sits in the same table;
and `prevLetter` was not reset on an unknown character, so degemination reached across a separator —
`pop-pevač` → *popevač*. Unreachable through the engines (their tokenizers exclude `-`) but reachable
through the exported `phonemizeWord`, which the referee eval now scores directly.

**Two findings did not reproduce**, recorded because a non-reproducing report is still information:

- Roman numerals (`XX. stoljeća` → *ks*) are correct in all three ENGINES — the registry's Roman pass runs
  before the word path, so the fold never sees them. Measured against `phonemizeWord` in isolation.
- Cyrillic ⟨С⟩ resolving to Celsius rather than *север* is the intended priority: `°С` on a figure is
  overwhelmingly a temperature, arm 4 runs first by design, and the corpus holds no Cyrillic latitude.

### The split question, and why the answer is no

Five rounds, and **every** HIGH/MEDIUM finding has been in the bearing arms or the fold; **zero** in
degemination. That trajectory (HIGH → HIGH → MEDIUM) is converging, but it was reason enough to ask whether
the weakly-evidenced half should be pulled out and the strong half shipped alone.

Checked it rather than argued it — ran the collisions against `main` in a worktree:

    MAIN bs  "temperatura 35° i padavine"  →  … stˈe˥˩peni ˈi˩˥stot͡ʃno pˈa˥˩daʋine   conjunction DELETED
    MAIN bs  "35° s vjetrom"               →  … stˈe˥˩peni sjˈe˥˩ʋerno ʋjˈe˥˩trom      preposition DELETED
    MAIN hr  "35° s padavinama"            →  … stˈupɲeʋa jˈu˥˩ʒno pˈadaʋinama         preposition DELETED

**Three of them are live on `main` today and have nothing to do with the fold.** A rule that deletes one of
the commonest words in the language and invents a compass bearing in its place is a real user-facing defect,
and the degree-arm work is what fixes it. Reverting the fold would take those fixes with it.

So the answer is no split — not because the risk was imaginary, but because the work the risk bought turns
out to stand on its own. What the five rounds actually cost was **process**, not correctness: the same
family was patched five times because each round fixed the member in front of it instead of the principle.
The principle, arrived at last rather than first, is one line — *a bearing letter that is also a function
word must be attached, and only its lowercase form is that word* — and it applies unchanged to all three
engines.

    whole corpus, steady across rounds 3–5: 716 better, 148 worse over 9,496 rows

## Run 16 — 2026-08-19 — he_il: one unreadable word was costing the sentence its vowels

`he_il` sat at 2.32× its own median with 25 all-flagged rows, all same-script prose, so it survives Run
11's finding that most of the queue is code-switching.

Reading them showed two behaviours in the same language. Some rows are properly vocalized
(`leχevʁat … jeʃ ʃte maχlkot beʁiχvot hanosʔim`); others are a bare consonant skeleton
(`hfjʁmjd hɡdvl hvkm lχvvd fʁʔ` — the Hebrew letters transliterated with no vowels at all).

    he_il rows 3,242
      consonant skeleton   216  (6.6%)   median dist 0.649   59 of the 120 investigate rows, 14 of 25 all-flagged
      vocalized          3,027           median dist 0.342

⚠ **Deterministic, not a transient batch failure** — re-running the six worst reproduced every skeleton.
And two of them were PARTIALLY vocalized (`sidʁat ha …` then skeleton; `basvivot ʔaχat ʔesʁe …` then
skeleton), which located the failure at the CLAUSE, not the row.

### The cause: an alignment guard that turns a partial failure into a total one

`hebrewNeural.ts` batches consecutive bare words into a clause for cross-word context, then:

    if (out.length === run.length) queue.push(...out);
    else for (const w of run) queue.push(phonemizeWord(w));   // ← the whole run, to the rule engine

On unvocalized input the rule engine IS the skeleton. So any mismatch cost every vowel in the sentence.
Instrumented it: **7.6% of clause runs tripped the guard, and the tagger returned exactly ONE token every
time** — `in 24 → out 1`. Not a misalignment; an empty string.

    צ'מברס → ""      ג'ון → ""      ח'ופו → ""      ד"ר → ""
    אלוהים → ʔelohim   תבע → tava    ישראל → jisʁaʔel

**The geresh and gershayim.** The marks Hebrew writes foreign consonants with — צ׳ /t͡ʃ/, ג׳ /d͡ʒ/, ז׳ /ʒ/ —
which is to say every transliterated name. The tagger's charset has none of them.

⚠ **Not a character-normalisation problem, which was the first hypothesis and the cheap fix.** The model
fails on the ASCII apostrophe AND on U+05F3/U+05F4 alike, and reads the same word fine with the mark
removed. Only retraining fixes the word. What is fixable is the blast radius.

Retrying word by word instead of abandoning the clause:

    skeleton rows  216 → 0        median 0.3520 → 0.3408      mean 0.3854 → 0.3641
    330 rows closer to what the reader said, 28 further

⚠ **The family was checked before a review could.** Persian has the same clause-batching shape but its
mismatch path already retries THROUGH THE MODEL per word rather than falling to the sync engine. Swept
every language in the corpus for the same bimodal signature — a sub-population whose vowel fraction sits
well below that language's own median — and `he_il` is the only one.

## Run 16b — is the recognizer cutting off? No, and this validates the instrument

The largest single regression in the Hebrew set (+0.478) had a correct new reading whose recognized phones
stopped short of the text tail, which raises a question about every measurement in this log: if wav2vec2
truncates its output, then longer and more complete IPA is systematically penalised.

`asr_align_corpus.py` has no length cap, but it batches with `padding=True` and decodes `argmax` over the
full padded length, so both truncation and padding contamination were worth ruling out. Measured recognized
phone count against audio duration over every scored row:

    decile   duration        OUR phones/s   THEIR phones/s   ratio
    D1      1.7-  7.5s          9.63            9.02         0.937
    D5     11.0- 12.1s          9.20            8.68         0.943
    D10    19.7-256.4s          6.79            6.57         0.968

**The ratio is flat.** Our phone rate — which the recognizer cannot influence, being derived from the
transcript — declines in lockstep with theirs, 9.63 → 6.79 against 9.02 → 6.57. So the falling
phones-per-second is real speaking-rate variation (longer utterances carry more pauses), not the model
giving up. Pushed into the extreme tail, where a cap would show first:

    20- 30s  n=21691  ratio 0.961      45- 80s  n=319  ratio 1.051
    30- 45s  n= 3210  ratio 1.002      80-300s  n= 11  ratio 1.548

It rises above 1.0 rather than collapsing. **No truncation, no cap, no padding contamination of the short
clips** (D1's ratio matches D5's), so there is nothing to re-run. The +0.478 row is a single-row artefact
of a length-normalised distance against a partially-covered reference, not a symptom.

That is worth more than the row it came from: the recognizer's coverage is duration-independent across
1.7–256s, which is the assumption every measurement in Runs 1–16 rests on and had not been tested.

## Run 17 — 2026-08-19 — the Hebrew review rounds, and what the fix did to the queue

Three review rounds on #839, and the recurring finding was my own: each round I patched the branch in
front of me and the next round found the hole that patch opened. Round two's was the sharpest — my
`out.every(Boolean)` guard reintroduced the exact defect the PR fixes, because some Hebrew words
legitimately phonemize to nothing (`phonemizeWord("ה") === ""`, likewise `ע`) and `emit()` drops an empty
string harmlessly. So one unrelated one-letter word condemned its whole clause: `ה בית הגדול` lost `bet`
to `vjt`.

**The word-COUNT mismatch was always the only real failure signal.** It catches the all-or-nothing decline
too, since that returns `""` → one token against N. After three rounds in the same function I rewrote it
rather than patch again; it reads in one screen now, and the review's other findings fell out of the
rewrite:

- the segment retry re-issued the **byte-identical call** against a deterministic model when no word was
  unreadable — a guaranteed-wasted inference, then the original blast radius anyway. `ה בית הגדול` went
  from two model calls to one.
- the maqaf rejoin was unvalidated, so a half whose reading is empty vanished inside the join
  (`ה־בית גדול` → *bet ɡadol*, the `ה` gone).

⚠ **One finding acknowledged as a limit rather than fixed**, and stated at the site: the segment still
flushes at a maqaf compound, so the words on either side lose context across it. Deferring needs a
placeholder entry filled in after the fact — real surgery for 28 rows, when the compound itself already
restores correctly.

### The invariant, finally asserted rather than exemplified

Every branch of `flush` must push **exactly one queue entry per input word**, because `assembleClauses`
draws one entry per TOKEN match. A branch that pushes two shifts every later word and silently drops the
last — which is how `ɡadol` disappeared when I pushed the maqaf halves separately. Nothing in the output
shape reveals it; only the missing tail does. It is now a test with one case per branch, and checked
against 600 real corpus rows (no dropped words).

### What it did to the queue

    he_il                 n     median before → after    better / worse
    all-flagged          25       0.800 → 0.456             16 / 2
    investigate         120       0.796 → 0.570             73 / 5
    whole language     3242       0.352 → 0.340            327 / 31   · skeletons 216 → 0

The effect concentrates on exactly the rows the screen flagged, which is the queue working as designed —
`he_il` reached the top of the residual by lift (2.32×), and the defect behind it turned out to be one
guard in one function.

⚠ **The three iterations are within noise of each other on the audio** — word-by-word 0.3408, segment-split
0.3402, rewritten 0.3402. The metric cannot separate them because a homograph vowel barely moves a
sentence-level folded distance. The case for the segment split is linguistic: `הוא קרא ספר של ג'ון טוב`
reads `hu kaʁa sefeʁ` where word-at-a-time gives `koʁa`/`sifeʁ`, and those are the module's own documented
homographs. Recorded because it is the clearest case in this log of the instrument being blind to a real
improvement — the opposite of Run 13a, where it was blind to a real regression.

## Run 18 — 2026-08-19 — six review rounds on one function, and what actually stopped the bleeding

#839 went through six review rounds. The finding count barely fell (3, 2, 4, 8, 8, 4) and **the majority
were defects introduced by the previous round's fix**, not pre-existing ones. That is worth recording as a
process result, because the code is now correct and the process that got it there was not.

    round 2   `out.every(Boolean)` — my round-1 guard condemned clauses whose word legitimately reads ""
    round 3   a declined SINGLE-word run emitted "" and the word vanished — worse than the skeleton
    round 4   my maqaf split fused `בֵּית־סֵפֶר`; my niqqud range pasted U+05FD for U+05BD
    round 5   my proclitic split misread BOTH the clitic and its host (`ha bet` for `habajit`)
    round 6   my particle patch was applied at one call site and not its sibling

### What each of the two structural moves actually bought

Two changes broke the cycle, and neither was a bug fix:

1. **Rewriting the function instead of patching it** (after round 3). Three rounds of accreted branches had
   made each fix land in one arm and miss the others. The rewrite fit on a screen and rounds 4–5 found
   fewer *structural* holes as a result — though they still found holes.

2. **Moving the repair to where the reading is produced** (round 6). The particle patch had been applied at
   one of four `restore` call sites. Putting it *inside* `restore` makes omitting it impossible rather than
   merely unlikely. That is the difference between fixing an instance and removing a class, and it is the
   move I should have made in round 5 when the same shape had already appeared twice.

Applied the same reasoning unprompted to the one remaining inconsistency — a `|| bare(w)` fallback present
at three call sites and missing at the fourth — rather than waiting for round 7 to report it.

### The tests were part of the problem, twice

Two tests I wrote *specifically to catch dropped words* were shaped so they could not see one:

- `toContain("bet haɡadol")` passes whether or not the article survives.
- the invariant test's `>= words - 1` slack was exactly one word wide.

**A test that normalises its input before asserting cannot see the class of bug it was written for**, and
`trim()` / `filter(Boolean)` / a tolerance are all forms of normalising. Both now assert whole strings.

A third shape showed up in round 6: every branch was covered *individually* and the bug lived in a branch
*combination* — it takes a clause holding both an unreadable word and a standalone particle to route
through the segment path with something to patch. The case list now combines branches deliberately.

### Where the measurement was and was not useful

The audio metric drove the original finding (216 skeleton rows at 0.649 against 0.342) and confirmed the
fix. It was **blind to almost every defect the reviews found** — a dropped one-letter article, a fused
compound, a wrong clitic vowel — because a sentence-level folded distance does not move on one segment.
Across six rounds the corpus number never shifted outside 0.3402–0.3408.

That is the honest summary of this PR's instrumentation: the metric found the disease and could not see
the complications of the cure. Both facts matter, and the second is why six review rounds were worth
running rather than merging on a green number.

    final   skeletons 216 → 0   median 0.3520 → 0.3402   333 better / 31 worse
            all-flagged 0.800 → 0.456    investigate 0.796 → 0.570

## Run 19 — 2026-08-19 — mi_nz, and the numeral register measured across 14 languages

`mi_nz` was next by lift (2.5×) and is what sent this session to the LID work: 12 of its 15 all-flagged
rows carry digits. Its non-digit row turned out to be one sentence read three times, whose only
disagreements are recognizer-inventory noise (`ɾ→r`, `e→i`, `u→y`, `o→u`) — `ɸ→f` is already in `COARSEN`,
so `confusion_pairs.py` reporting it is a pre-fold artifact. **No phonemizer defect in Māori.**

So the question became the numeral register, and Run 11 had only measured four languages. Measuring all 14
with ≥8 digit-bearing all-flagged rows, against every plausible register rather than an assumed one:

    lang      n    native    →best    closer/further   register
    sn_zw    400   0.3213   0.2599     381/19   95.2%   CLEAN → en
    ny_mw    400   0.4726   0.3996     378/19   95.2%   CLEAN → en
    zu_za    400   0.4631   0.3854     379/21   94.8%   CLEAN → en
    xh_za    400   0.4889   0.4353     362/38   90.5%   CLEAN → en
    ln_cd    400   0.2902     —           89%          CLEAN → fr
    ceb_ph   400   0.3393   0.2982     339/61   84.8%   mixed → en
    ig_ng    400   0.4055   0.3875     263/131  66.8%   mixed → en
    mi_nz    400   0.3180   0.2985     254/146  63.5%   mixed → en
    fil_ph   388   0.3119   0.2938     241/146  62.3%   mixed → en
    bn_in    400   0.3762   0.4078      38/306  11.0%   NATIVE
    ckb_iq   400   0.3582   0.3811      16/151   9.6%   NATIVE
    mt_mt    400   0.3387   0.4015      17/381   4.3%   NATIVE
    de_de    400   0.2088   0.2807      10/390   2.5%   NATIVE
    fr_fr    400   0.1118   0.2147       3/397   0.8%   NATIVE

⚠ **THE REGISTER MUST BE SOURCED PER LANGUAGE, NOT ASSUMED FROM THE REGION.** `ln_cd` reads 66% for English
and **89% for French** — testing only English would have called it "mixed" and applied the wrong language.
Maltese is native under all three registers (fr 6%, en 4%, es 4%), so a low English score does not imply
some other foreign register; it implies the language reads its own numerals.

⚠ **AND FIVE OF THE FOURTEEN ARE NATIVE.** de_de, fr_fr, bn_in, ckb_iq and mt_mt already read numerals
correctly and applying a register would regress them badly — fr_fr 3 closer against 397 further. Any
implementation must be a per-language opt-in, never a default with exceptions.

### Three tiers, and only the first is actionable now

- **CLEAN (≥90%)** — sn_zw, ny_mw, zu_za, xh_za → en; ln_cd → fr. A per-language setting is safe here and
  is worth ~1,900 rows across the four English ones alone.
- **MIXED (60–85%)** — ceb_ph, ig_ng, mi_nz, fil_ph. Net positive but a third of rows get worse. `mi_nz`
  splits 58–69% across small integers, years and large grouped numbers alike, so it is genuine
  reader-to-reader variation rather than a shape rule waiting to be found. Applying it is a judgement
  about mean-versus-variance, not a correctness fix.
- **NATIVE** — leave alone.

This is the same shape as the code-switching finding one level down: the phenomenon is real, the mean
improves, and a naive global rule does harm. The difference is that here the safe subset is identifiable
in advance and measurable per language.

## Run 20 — 2026-08-19 — the year reading, and where the engine already knew the answer

The largest of the three findings deferred out of #840's review: the register was reading `1998` as its
cardinal, *one thousand nine hundred ninety eight*, where an English-register reader says
*nineteen ninety-eight*. Bare 4-digit runs are **1,349 of the 4,679 digit runs (29%)** in the five wired
languages, so the shape is worth measuring rather than assuming.

    lang    bare 4d   1000–1099   1100–1999   2000–2099
    ln_cd     298        14          168         116
    xh_za     331        20          184         127
    zu_za     260        12          143         105
    ny_mw     234         6          136          92
    sn_zw     226         7          131          88

⚠ **THE ENGINE ALREADY HAS THE YEAR RULE, AND IT CANNOT FIRE HERE.** `src/languages/english/normalize.ts`
`yearWords` reads years pair-wise and handles every irregular shape — `1905` → "19 oh 5", `1900` →
"19 hundred", `2007` → "2 thousand 7", `2011` → "20 11". But the rule that calls it is gated on an **English
context word** (`in|since|from|…|circa|year`, or a month name), on purpose: "2011 people died" must not read
*twenty eleven people*. The context around a digit run in a Zulu sentence is Zulu, so the gate never opens.
The register has to decide year-ness itself.

⚠ **AND IT EMITS THE ENGINE'S TOKENS, NOT WORDS.** `yearWords` returns digit-pair tokens the number path
then expands (`1998` → `"19 98"`). Handing that string to the `en` segment round-trips exactly —
`19 98` → *nˈaᶦntˈiːn nˈaᶦnti ˈeᶦt* — so the pair-wise reading is composed by the English number path rather
than by a second compositor in `numeral_register.mts`. Only the 4-line shape rule is duplicated.

### Measured on the 681 rows the rule changes

    lang    n     before → after     closer/further
    nya    156   0.4164 → 0.3696       145 / 11
    sn     148   0.3001 → 0.2545       132 / 16
    xh     210   0.4435 → 0.4078       173 / 37
    zu     167   0.4090 → 0.3662       150 / 17
    ALL    681   0.3977 → 0.3555       600 / 81   (88%)

Over the whole digit-bearing corpus: mean 0.3160 → 0.3141, better 2,926 → 2,938, worse 322 → 312. Every one
of the four English-register languages improves and none regresses.

⚠ **`ln` IS UNAFFECTED AND CORRECTLY SO.** French reads a year as its cardinal — `1998` is
*mil neuf cent quatre-vingt-dix-huit* — which is exactly what the register already emitted. The engine
normalises both `mil` and `mille` to `mil`, so the existing `frWords` output is already the year form. A
"years read pair-wise" rule applied by analogy across all five wired languages would have damaged Lingala;
scoring it separately is what showed there was nothing to do. **Same lesson as Run 19's `ln → fr`, one level
down.**

### The shape guards, and the honest size of the evidence for them

Bucketing the 681 changed rows by shape:

    plain year               306 rows   280 closer /  26 further
    plural decade (`ma 1700`) 32 rows    30 closer /   2 further
    unit follows (`1600 km`)   2 rows     0 closer /   2 further

- **Range 1100–2099**, the engine's own. Excludes `1000` (26 occurrences), where "one thousand" is right.
- **A following unit declines the year reading.** The corpus's `1600 km` trail is *one thousand six hundred
  kilometres*, not *sixteen hundred*. ⚠ **The independent evidence here is 2 rows.** Both move further from
  the audio under a year reading, which is consistent but is not a measurement; the guard is carried over
  from the engine's rule on principle, and is recorded as such rather than dressed up as a finding.
- **`ma 1700` stays a year.** The plural-decade shape ("muzaka zama 1700", the 1700s) reads *seventeen
  hundred* and scores 30 closer against 2. No separate rule needed — a negative result worth keeping,
  since a "decades are different" rule looked plausible before it was checked.

### Tests, mutation-checked

Three mutations, each caught by a different assertion: disabling the year rule, removing the unit guard, and
widening the range to any 4-digit run. This matters more than usual here — **three tests earlier in this
session laundered away the bugs they were written for** (a `toContain` that could not fail, a `- 1`
tolerance, and a key list compared against a hardcoded copy of itself), so a new test now has to be shown
failing against a deliberately broken implementation before it counts.

### Still open from the #840 review

- **Adjacent 3-digit runs merge.** `783,562 300,948` is read as one 12-digit number, because the grouping
  rule accepts a space before three digits. 4 occurrences.
- **~30 rows declined by the punctuation lookahead**, where a digit run is followed by sentence punctuation.

## Run 21 — 2026-08-19 — the last two review items, both exact

Both remaining #840 findings turned out to be enumerable rather than estimated, so each was fixed against a
known row set rather than a guess.

**1. Two grouped numbers merged into one.** `GROUPED` treated `,` and the space separators as
interchangeable *within a single run*, so `783,562 300,948` — two 6-digit figures side by side — matched as
one 12-digit number and read as *seven hundred eighty three billion…*. Exactly 4 rows, all this shape, all
two 6-digit figures. Anchoring the separator to whichever the run opened with (`\d{1,3}(?:,\d{3})+` OR
`\d{1,3}(?:[  ]\d{3})+`, never a mix) splits them. ⚠ Genuine space grouping had to survive: `ln` writes its
thousands that way and there are **153 space-grouped runs** (`104 500`, `24 000`, `1 000`), so a fix that
simply dropped the space separator would have been far more expensive than the bug.

⚠ **AND `800 500` REMAINS UNRESOLVABLE.** Two adjacent 3-digit numbers and one space-grouped 6-digit number
are the same string. The mixed-separator case is decidable and is now decided; the same-separator case is
not, and no rule was invented for it.

**2. Sentence punctuation read as a decimal point.** The trailing lookahead refused any run touching `.` or
`,`, which also refused every run at the end of a clause — `na 1992.`, `kv62.`, `1469-1539.`,
`ngo1624,inkampani` — **28 rows** of ordinary cardinals declined for a shape they did not have. Only
`.`/`,` *followed by a digit* is a decimal; `:` stays refused unconditionally, a trailing colon in this
corpus being a clock.

Together, on the 33 rows they change:

    lang    n     before → after     closer/further
    ln     13   0.2850 → 0.2622        11 /  2
    zu      6   0.4766 → 0.4036         6 /  0
    sn      6   0.3196 → 0.2492         6 /  0
    nya     4   0.3973 → 0.3129         4 /  0
    xh      4   0.3922 → 0.3183         4 /  0
    ALL    33   0.3527 → 0.2985        31 /  2

⚠ **BOTH REGRESSIONS ARE FRENCH ORDINALS, AND ARE LEFT ALONE.** `ekeke ya 19.` is the *19th* century and
`mbiu 21.` a clause-final age; French says *dix-neuvième*, not *dix-neuf*. Recognising an ordinal from
Lingala context is a different problem from the one this change is solving, and 2 rows against 31 does not
justify starting it here. Recorded rather than fixed.

Whole digit-bearing corpus after both: mean 0.3160 → **0.3140**, better 2,938 → **2,946**, worse 312 → 313.

Three more mutations, each caught by a different assertion: separators made interchangeable again, the old
lookahead restored, and the decimal guard dropped entirely. Suite 251 files / 4,849 tests.

**Nothing from the #840 review is now outstanding.** The register's remaining known gap is the one Run 19
already quantified and declined on principle: clock times and decimals have no correct reading implemented
in the register language, worth ~115 rows, and are refused rather than approximated.

## Run 22 — 2026-08-19 — bn_in: the largest residual class in the language, and it is correctly lexical

`bn_in` was next by lift: 31 all-flagged rows, which collapse to **15 distinct sentences** (each recorded
2–3×, every recording flagged). Reading all 15 found no defect — the recognizer's Bengali output is
fragmented and insertion-heavy, and rows whose numerals are demonstrably RIGHT still score badly
(`৭৮৩,৫৬২` → *ʃat̪ lakʰ t̪iɾaʃi ɦad͡ʒaɾ pãt͡ʃ ʃɔt̪ baʃɔʈʈi*, correct Indian lakh grouping, heard back
almost phone-for-phone, and the row still sits at 0.741). So the per-row queue had nothing to give and the
question moved to the aggregate.

### Two instruments, one class

`confusion_pairs.py` reports pre-`coarsen` counts, so its top rows (`ɦ→h`, `ʈ→t`, `ɖ→d`) are pairs the
distance ALREADY folds. Re-running the alignment after `coarsen`, the real tally is:

    ɾ -> r  8438  13.6%      ɔ -> o  5950   9.6%      ɾ -> l  2145  3.5%      o -> u  1845  3.0%

⚠ **`ɾ → r` IS NOT A CANDIDATE FOR `COARSEN`, AND THE COUNT IS WHY IT LOOKS LIKE ONE.** The recognizer
writes `ɾ` 253,498 times corpus-wide against our 660,205 — 38%, not the <1% that put `ʈ ɖ ɦ ɫ` in the map.
It HAS the symbol and uses it; folding ɾ→r globally would erase a contrast it makes. Same argument the
COARSEN docstring already records for `c`.

That leaves `ɔ → o`. The referee harness independently points at the same thing: of 6,666 wikipron words,
**610 differ from our rule engine by ɔ/o ALONE** — 9.2% of the referee and **17% of all its misses**, the
single largest identifiable class in the language.

### The measurement that settled it

For every position where the rule engine writes `ɔ`, what does the human referee write there (same-length
pairs only, so positions index the same segment — 5,004 of 6,666):

    context                        n     referee o        ɔ
    ɔ + 1C #  (final closed syll) 602    244  (41%)     358
    ɔ + 2C +i (medial)            105     66  (63%)      39
    ɔ + 2C #                      101     45  (45%)      56
    ɔ + 1C +a                     255     40  (16%)     215
    ɔ + 1C +ɔ                     231     21   (9%)     210
    ɔ #  (word-final vowel)        40      1   (3%)      39

⚠ **THE BIGGEST CELL IS A COIN FLIP. 41% / 59% over 602 positions is not a rule** — defaulting to [o] in a
final closed syllable would break 358 words to fix 244. `bengali-lexicon.tsv`'s header already asserts this
and gives the proof I could not improve on: **মন [mon] against কম [kɔm]** — identical shape, opposite
outcome, an etymological tatsama/tadbhava split. The existing design (rule engine + a 331-entry adjudicated
lexicon, override applied only on the shipped path so the referee signal stays non-circular) is right, and
this run is the number behind the claim rather than a change to it.

⚠ **AND THE LEXICON CANNOT ADJUDICATE ITS OWN CLASS.** In the final-closed-syllable cell it reads 79 [o]
against 4 [ɔ], which looks like overwhelming corroboration and is worth nothing: an override list contains
only the words the rules got WRONG, so it is selection-biased by construction and cannot estimate a base
rate. Checking what the file is made of is what stopped that number from being quoted as evidence.

### Left open, deliberately

`ɔ + 2C + [i u]` — 63% [o] in wikipron (n=105) — is the one cell with a majority. Our harmony rule fires
only across exactly one consonant (Ferguson & Chowdhury 1960: an open syllable; a coda blocks it), so we
write `ɔ` there. 63% against a documented phonological description, from a referee `bn.jsonc` itself calls
"noisy on the inherent-vowel ɔ/o", is a candidate and not a finding. The harness's own rule — corroborate
across ≥2 INDEPENDENT sources — cannot be satisfied here, because the only other source is the lexicon and
the lexicon was built partly from wikipron.

### A trap for the next probe

⚠ **BENGALI'S SYNC AND ASYNC ENTRIES DISAGREE, AND ONLY THE ASYNC ONE IS THE CORPUS.** `phonemize("হয়নি",
"bn")` gives *ɦɔjoni*; `phonemizeAsync` gives *ɦɔeni*, which is what the DB holds — the language ships a
neural tagger reachable only from the async entry. Probing with the sync entry and diffing against the
corpus makes the corpus look stale when it is current. Verified: re-running a flagged sentence through
`phonemizeAsync` reproduces its stored IPA byte for byte.

### Verdict

**No phonemizer defect in bn_in.** Its largest residual class is real, is the same class both instruments
report, and is lexical. Two candidates recorded above rather than acted on. Next by lift: hu_hu (16),
hy_am (15), de_de (13), fr_fr (12), he_il (12).

## Run 23 — 2026-08-19 — hu_hu: a missing fold hid the queue, and behind it a real defect class

### The instrument first

`hu_hu`'s 16 all-flagged rows are 8 distinct sentences and none of them contains an error — Hungarian's
hard parts are all right in the flagged output (`fotózásban` → *ˈfotoːzaːʒbɒn*, regressive voicing;
`köztársaságot` → *ˈkøstaːrʃɒʃaːɡot*). The aggregate said why: after `coarsen`, **30% of every substitution
in the language involves `ɒ`** — ɒ→ɔ 11.7%, ɒ→a 7.6%, ɒ→o 5.7%, ɒ→ɑ 4.8%.

⚠ **`ɒ` MET THE `COARSEN` CRITERION OUTRIGHT AND WAS NOT IN THE MAP.** We write it 52,582 times across the
corpus; the recognizer writes it **zero** times in 270,106 utterances — not "under 1%", none. Only three
languages emit it, and for two of them it is the plain ⟨a⟩/⟨o⟩ vowel, so a third of every Hungarian
utterance was being scored against a symbol the recognizer cannot produce.

    median      hu_hu    uz_uz    da_dk
    current    0.3117   0.3394   0.5258
    ɒ -> ɔ     0.2810   0.3134   0.5167     <- best for each, none worse
    ɒ -> a     0.2897   0.3369   0.5258
    ɒ -> o     0.2984   0.3168   0.5243
    ɒ -> ɑ     0.2957   0.3381   0.5258

No other language can be affected, and that is provable rather than swept: `coarsen` applies to both sides
and the recognizer's ɒ count is 0, so the entry is unreachable outside these three.

⚠ **IT DOES COST DANISH ONE THING.** da_dk emits both ɒ (2,859) and ɔ (2,897), so the fold merges a contrast
it makes: a Danish row writing ɒ where ɔ belongs currently scores as a miss and now will not. That is the ʔ
argument from the COARSEN docstring pointing the other way. Accepted because the recognizer has no ɒ at all
— the comparison was never able to *judge* the symbol, only to penalise it — and da_dk still improves.
Recorded so it is not discovered later as a surprise.

### What the corrected queue surfaced

Re-deriving hu_hu's queue in memory under the fixed fold moved the median 0.3117 → 0.2810 and changed the
all-flagged set: **six new sentences**, and they share one defect.

⟨sch⟩ and ⟨ch⟩ are foreign spellings Hungarian orthography has no rule for, so the longest-match scan took
⟨c⟩→[t͡s] and then a bare ⟨h⟩ — producing *t͡sh*, a sound no reading of these words yields:

    charles     ˈt͡shɒrlɛʃ        schumacher  ˈʃt͡ʃ- (⟨s⟩ alone, then ⟨ch⟩)
    nicholas    ˈnit͡sholɒʃ       zachary     ˈzɒt͡shɒri
    canyoning   ˈt͡sɒɲoniŋɡ       cuddeback   ˈt͡sudːɛbɒt͡sk

173 tokens across 66 distinct words, essentially all proper names.

⚠ **[t͡ʃ] IS THE MEASURED DEFAULT AND [x] WAS THE OBVIOUS ONE.** Hungarian's own learned vocabulary reads
⟨ch⟩ as [x] — technológia, hierarchia, jacht — so [x] was the first candidate. Against the audio it is
**net negative: 103 rows closer against 149 further.** The corpus is name-dominated (≈140 foreign tokens
against ≈33 learned), and [t͡ʃ] scores **142 closer against 13 further** on the 155 rows it changes, mean
0.3253 → 0.3168. A `chn → xn` carve-out for the techn- family was tried too and measured very slightly
WORSE than leaving it out, so it is not there.

### The trap, and why the whole thing had to be measured

The unguarded rule looked clean at 174/78. Twelve of those 78 were one native class:

⚠ **⟨c⟩ + ⟨h⟩ ACROSS A MORPHEME BOUNDARY.** *harminchat* (36) is harminc+hat, not harmin-csat — and **every
one of the 12 regressed rows came from OUR OWN numeral compositor**, not from corpus text, which contains
no native c+h word at all. This is the same failure the ⟨csz⟩ skip in `hungarian.ts` already exists for
(*kilencszáz*), found the same way. The guard covers the numeral compounds and also the productive allative
`-hoz/-hez` on any c-final noun (*archoz*, *tánchoz*, *perchez*) — unattested here, guarded anyway, because
a silent regression on ordinary inflection would outweigh what the names gain.

Guarding cost 3 rows that had scored *better* under the wrong reading — the "phonetically overlapping by
accident" case the numeral register's docstring names. Final: 171 better / 69 worse corpus-wide,
142 / 13 on the changed rows.

⚠ **A SECOND INSTRUMENT AGREES.** The wikipron hu referee gains 13 words (59,568 → 59,581 of 64,286) — an
independent source, not the audio the rule was tuned against.

### Left alone

Bare ⟨c⟩ before a back vowel in a foreign word (*canyoning* → ˈt͡sɒɲoniŋɡ, *cuddeback*, *costello*, *covid*)
is still [t͡s]. Unlike ⟨ch⟩ there is no orthographic discriminator: native *cukor*, *cella*, *célja* need
[t͡s] in the same shape. That is the German ⟨c⟩ problem again and it is lexical, not contextual.

⟨ck⟩ looked like a clean rule — Hungarian "has no native ⟨ck⟩" — and is not: *palackok*, *kockázat*,
*arcképét*, *építőkockáiként* are ordinary Hungarian where [t͡sk] is correct. ~58 foreign tokens against
~12 native ones is not a rule, and checking the word list before writing it is what stopped it.

## Run 24 — 2026-08-19 — hy_am: the referee's biggest residual class, refuted by both instruments

19 all-flagged rows, 9 distinct sentences, and the Armenian in them is accurate — the word-initial ե/ո
glides (*jen*, *voɾ*, *voɾonkʰ*), initial-cluster epenthesis (*t͡ʃʰəmʃkoɾdin*, *dəɾɑn*, *məɾɡɑjin*), the
aspirate series, and the compound numerals (Armenian writes 500 as one word, հինգհարյուր → *hinɡhɑɾjuɾ*,
which looked like a missing space and is not).

### The dominant confusion pair is notation, and the referee settles it

`ɑ → a` is **34.3% of all substitutions** in the language, 40,091 of them. It is not a `COARSEN` candidate:
the recognizer writes `ɑ` 151,005 times corpus-wide against our 492,171 — 31%, nowhere near the <1% that
qualified `ɒ` in Run 23 — and four languages (cmn, ps, nl, km) genuinely contrast ɑ with a, so a global
fold would erase a distinction the recognizer makes. More decisively, **wikipron's human Eastern Armenian
transcriptions use `ɑ` exactly where we do.** Our symbol is right; the recognizer simply prefers `a`.

### The schwa class: 37% of the referee's misses, and not a rule gap

`hy.jsonc` records the residual as "largely the schwa-epenthesis layer (unwritten ə in clusters)", and the
measurement bears out the size. Excluding 68 all-caps acronyms (where the referee spells letter names with
ə and we do not — a citation convention, not phonology):

    referee hits            14,907
    reconciled by ə ALONE    1,133      <- 37% of the 3,115 misses
    other                    1,982

    of the ə-only:  referee has MORE 762   we have more 371

`armenian.ts` implements Vaux-style epenthesis for INITIAL and FINAL clusters only — medial clusters are
untouched, and every referee-has-more example is a medial one: *ɑdɾbed͡ʒɑn* → *ɑdəɾbed͡ʒɑn* (Ադրբեջան),
*ɑfʁɑnstɑn* → *ɑfʁɑnəstɑn*, *dɑʁstɑn* → *dɑʁəstɑn*, *ɡɑlstjɑn* → *ɡɑləstjɑn*. Every one is a 3+ consonant
medial run. That is a clean hypothesis with an obvious rule.

⚠ **AND IT IS WRONG. EVERY PLACEMENT MAKES THE REFEREE WORSE:**

    baseline        14,907/18,022   82.72%
    ə after 1st     14,799          82.12%
    ə after 2nd     14,801          82.13%
    ə before last   14,803          82.14%

The examples were consistent because they were the cases the rule would fix; the rule also fires on the
far larger set of medial clusters the referee leaves intact.

⚠ **THE AUDIO AGREES, AND THAT MATTERS MORE HERE THAN USUAL.** `hy.jsonc` declares an explicit
`secondaryGap` — wikipron hye_e is the ONLY referee, and Western Armenian is a different dialect rather
than a second source — so the harness's "corroborate across ≥2 independent sources" rule cannot normally be
satisfied for Armenian. The ASR corpus is that second source, and it is independent of Wiktionary:

    baseline        mean 0.4430   median 0.4286
    ə after 1st     mean 0.4436                  better  19   worse 598
    ə after 2nd     mean 0.4434                  better  21   worse 596
    ə before last   mean 0.4436                  better  28   worse 589

Roughly 25:1 against, on every variant. Two instruments that disagree about almost everything else agree
that medial epenthesis is not a rule Armenian applies across the board — it is lexical, or it is wikipron's
narrow-transcription habit, and nothing here can separate those.

### Verdict

**No phonemizer defect in hy_am, and no change made.** The largest class the referee reports was worth
chasing precisely because it looked so clean, and the value of the run is the refutation: the next person
to read `hy.jsonc`'s "largely the schwa-epenthesis layer" note now has the number saying a blanket rule
costs more than it gains, on both instruments.

⚠ **A CANDIDATE THIS RAISES, NOT ACTED ON.** `COARSEN` is global, and `ɑ` shows why that is sometimes the
wrong grain: the recognizer writes it 2.3% as often as we do for hy_am, 0.05% for sw_ke and nso_za, but
72% for cmn. A per-language fold would serve those languages better, at the cost of the property that
makes the current map trustworthy — one definition of "phones this recognizer cannot distinguish", shared
with `consonant_skeleton.py`.

**Two languages in a row with no defect found.** bn_in and hy_am both had a large, real, aggregate-visible
residual class, and in both cases the class turned out to be correctly designed. That is worth noting about
the queue's remaining yield rather than only about these two languages.

## Run 25 — 2026-08-19 — de_de: a second fold, and the ⟨th⟩ digraph at a word edge

`de_de` is the best-scoring language in the corpus (median 0.183, all-flagged mean 0.371 against an
exonerated mean of 0.364 — the flagged rows are barely distinguishable from the exonerated ones).

### `ɜ`, the mirror of Run 23's `ɒ`

`ɐ → ɜ` was 8.0% of substitutions. `ɐ` itself is not foldable (the recognizer writes it 21% as often as we
do), but `ɜ` is the reverse case: **the recognizer writes it 31,657 times and no language in the fleet
writes it at all**, so every occurrence was an unavoidable miss. The map's stated purpose is our-side
phones the recognizer lacks; the penalty is symmetric, and naming that is the extension.

It lands mostly on our `ɐ` (5,345) and `ə` (2,801). Swept over **all 87 languages whose recognizer output
contains `ɜ`: 4 improved, 83 unchanged, 0 worse** — the standard the docstring sets. de_de 0.1789 → 0.1660,
da_dk 0.5167 → 0.5075. `ɜ → ə` makes da_dk worse; `ɜ → ɛ` makes da_dk and th_th worse. Unlike `ɒ` it merges
nothing on our side, so there is no per-language cost to record.

### What the flagged rows are, and what they are not

The all-flagged set is dominated by **English institution names in German sentences** — *ronald reagan ucla
medical center*, *college of arts & sciences*, *united states geological survey*, *royal society for the
prevention of cruelty to animals*. The recognizer plainly hears them in English (`ucla` → *j uː s iː l eɪ*,
the letters spelled out; `society` → *s ʊ s aɪ ə t i*) while we read them with German rules (*zˈoːkiːtyː*).
This is the code-switching class the LID work already measured as **net harmful** to act on for French, and
`core/hostWord.ts` already records why the existing router cannot help: routing fires across SCRIPTS, and
English-in-German is Latin-in-Latin. Left alone.

⚠ **AND THE GERMAN ⟨c⟩ QUESTION IS ALREADY SETTLED WITH DATA.** *sciences* → *skˈiːnkəs* and *society* →
*zˈoːkiːtyː* look like an OOV-rule bug, and `tools/gen/de-consonant-curated.tsv`'s header answers it:
"of the 249 kaikki words spelled with a bare ⟨c⟩ before a front vowel only 98 take /t͡s/ … so /k/ stays the
OOV default and the known words are named here." 39% is not a rule. Same shape as Bengali's ɔ/o.

### The real defect: ⟨th⟩

German has no [th] sequence — *Thema* is [ˈteːma], *Theater* [teˈaːtɐ], *Ruth* [ʁuːt] — but the h rule
pronounces h after any consonant, so every one carried a spurious [h]. Position decides whether it is safe
to remove, and the kaikki referee gives the split cleanly:

    word-initial ⟨th⟩    8 silent /  0 kept   (100%)
    word-final   ⟨th⟩    3 silent /  0 kept   (100%)
    medial       ⟨th⟩   34 silent / 18 kept    (65%)

Medially, ⟨th⟩ is as often a COMPOUND BOUNDARY with a real [h]: *Rathaus*, *Schlachthof*, *Aufenthalt*,
*Truthahn*, *Lufthansa*, and the productive **`-heit` suffix on any -t adjective** (Vertrautheit,
Bejahrtheit). The edges are a rule; the middle is not.

    edge only (shipped)   88 closer /  0 further
    plus medial           186 closer / 24 further

⚠ **THE MEDIAL EXTENSION IS NET POSITIVE AND IS NOT TAKEN.** +162 is a real gain, but the 24 are ordinary
German compounds plus English-in-German (*parenthood*, *south*, *ninth*), and deciding them needs a
compound detector rather than a list of second elements — German compounding would outrun any list.
`lexicon.tsv` already carries a `k` compound-constituent flag that could drive one. Recorded as the next
step with its numbers attached.

⚠ **⟨rh⟩ LOOKS IDENTICAL AND IS THE OPPOSITE.** Only **3 of 47** kaikki ⟨rh⟩ words drop the h — Jahrhundert,
Mehrheit, verhandlung, fieberhaft are the norm and Rhythmus the exception — and ⟨gh⟩ is **0 of 12**
(Birmingham, Flughafen, Recklinghausen). Checking the base rate before generalising is the only reason
⟨rh⟩ is not in this change.

Referee: kaikki 3,717 → 3,727 of 4,744.

⚠ **AND ONE OF MY THREE MUTATIONS DID NOT FAIL.** The "⟨rh⟩ keeps its h" test used *Jahrhundert* and
*Mehrheit* — both MEDIAL — so an edge-only ⟨rh⟩ fold sailed past it. The rule under test is edge-only, so
the test has to be too; it now leads with *Rhythmus* and *Rhein*. A test whose examples sit outside the
rule's domain cannot fail against a wrong rule, which is the fourth version of this same mistake this
session.

### Also seen, not acted on

⟨h⟩ is deleted after a vowel across a MORPHEME boundary — *Gänsehaut* → *ɡɛnzəaʊ̯t*, *behaglich* →
*bəˈaːɡlɪç*, *vorbehalten* → *fˈoːɐ̯bəaltən*, *Balsaholz*, *Johannes*. 19 words in the kaikki referee. The
frequent ones (*behalten*) are rescued by the lexicon; the rule under-generates and the dictionary covers
it, the same architecture Bengali uses for ɔ/o. Worth its own run with a prefix/compound test.

## Run 26 — 2026-08-19 — de_de: the ⟨h⟩ morpheme-boundary loss, and the half of it that is fixable

Run 25 recorded ⟨h⟩ being deleted across morpheme boundaries and moved on. Taking it properly.

The rule treats a post-vowel ⟨h⟩ as a silent length marker (sehen, Uhr, fahren) — correct — with one
exception for ⟨hö⟩ after a prefix (ge·hör, be·hörde). Everything else at a boundary lost its h.

### The referee suggests a rule, and the corpus overturns it

Bucketing every kaikki word with exactly one post-vowel ⟨h⟩ (so the referee's h-presence is unambiguous)
by the FOLLOWING letter:

    h + r   78    pronounced   0 (0%)        h + a   11    pronounced  9 (82%)
    h + l   41                 0 (0%)        h + o    7                7 (100%)
    h + n   37                 0 (0%)        h + ä    5                5 (100%)
    h + m   15                 0 (0%)        h + u    5                3 (60%)
    h + s    7                 0 (0%)        h + e   40                7 (18%)
    h + #    6                 0 (0%)        h + i   15                4 (27%)

That is the *Dehnungs-h* distinction stated in orthography: h is a length marker before a consonant, a word
edge, or a REDUCIBLE vowel (⟨e⟩ → schwa in -en/-e, ⟨i⟩ → [ɪ] in -ig), and a real onset before a full vowel.
24 of 28 in the full-vowel buckets. It looks like the rule.

⚠ **AND ON THE CORPUS IT IS NET NEGATIVE: 80 rows closer against 138 FURTHER.** Restricting to the
strongest buckets (a/o/ä only) is no better — 66 against 123. Real German text is full of compounds where
the h ENDS the first morpheme and the next one starts with the vowel: *Dreh·arbeit*, *Roh·öl*,
*Ein·weihung*, *Erzieh·ung*. The dictionary sample under-represents them; the corpus does not.

⚠ **THE PREFIX TEST IS WHAT IDENTIFIES A BOUNDARY WITH h ON THE RIGHT OF IT.** Keeping it and widening only
the vowel — ⟨ö⟩ → the full-vowel set — is **39 rows closer and 0 further**. So the original author's gate
was the load-bearing half and the ⟨ö⟩ was the incidental half; that is the opposite of how it reads.

    be·haglich      bəˈaːɡlɪç      -> bəhˈaːɡlɪç
    vor·be·halten   fˈoːɐ̯bəaltən   -> fˈoːɐ̯bəhaltən
    ent·halten      ɛntˈaltən      -> ɛnthˈaltən

and the protected cases are untouched: gehen ɡˈeːən, sehen zˈeːən, rohöl ʁˈoːøːl, dreharbeit dʁˈeːaɐ̯baɪ̯t,
einweihung ˈaɪ̯nvaɪ̯ʊŋ, ruhig ʁˈuːɪç, Uhr uːɐ̯.

Referee: kaikki 3,727 → 3,732, wikipron 2,319 → 2,324.

### Half fixed, and the half that is not

Compound boundaries still lose their h — *Gänse·haut* ɡˈɛnzəaʊ̯t, *Balsa·holz*, *Johannes*. A prefix is a
closed list; a compound's first element is not. This wants the same compound detector the medial ⟨th⟩ note
in Run 25 wants, and `lexicon.tsv`'s `k` compound-constituent flag is the obvious input for both. **Two
findings now point at the same missing tool**, which is a better argument for building it than either alone.

### A mutation that lied, for the second time in two runs

⚠ **MY FIRST MUTATION HIT TWO RULES.** `sed`-ing the bare literal `"aouäöü"` also changed line 262 — the
⟨i⟩-glide rule in medial hiatus uses the same character set — so "revert the h gate" actually reverted two
unrelated rules and failed 6 tests. The 5 extra failures looked like my change breaking pre-existing tests;
they were the sed's collateral damage. Re-run against the h rule alone, exactly 1 test fails, the right one.

The literal is now `FULL_VOWEL`, named once. The two rules genuinely share the concept — reducible ⟨e i⟩
against everything else — so naming it keeps them from drifting and makes an edit to one visibly not an
edit to both.

## Run 27 — 2026-08-19 — fr_fr: two referees against the audio, and the audio wins

`fr_fr` is the best-scoring language in the corpus by a wide margin (median **0.089**; the next best, de_de,
is 0.166). Its all-flagged set is 9 distinct sentences and **every one of them is English inside French** —
*crown court de birmingham*, *running tours barcelona*, *wonders of the african world*, *airlines such as
emirates etihad airways*, *walt disney world*. That is the code-switching class this session already
measured and declined for French specifically (293 worse against 67 better). The per-row queue has nothing
new, so this run is entirely about the aggregate.

### One systematic class, and one that only looks like one

    ɔ -> o   4174  20.9%      ɛ -> e   1565  7.8%      e -> ɛ   1294  6.5%

⚠ **`ɔ/o` IS THE BIGGEST PAIR AND IS NOT A DEFECT.** Against the 3,000-word frequency-ranked gold it splits
**13 one way and 17 the other** — balanced, so it is word-by-word lexical variation, not a rule error. The
near-balance in the ASR tally (7.8% against 6.5% for ɛ/e) says the same thing a second way.

`e/ɛ` is different: **87 words where we write ɛ and the gold has e, against 9 the other way.** By spelling:
⟨ai⟩ 40 (jamais, vraiment, maison, raison), bare pretonic ⟨e⟩ 35 (médecin, terrible, mettez, verra,
professeur), ⟨ei⟩ 9, ⟨ê/è⟩ 3.

⚠ **AND THE TWO REFEREES CORROBORATE IT.** Of the words present in BOTH the adjudicated gold and wikipron,
6 fall in this class and **all 6 agree against us, with zero dissent** — vraiment vʁɛmɑ̃→vʁemɑ̃, terrible
tɛʁibl→teʁibl, mettons mɛtɔ̃→metɔ̃, terreur, plaisanterie, plus destruction in the other direction. The
harness's "≥2 independent sources" bar is met. Both encode the neutralised pretonic mid vowel.

### The third instrument says no

The ⟨ai⟩ half is a single line with a named source: *"ai → ɛ (laine, mais, vraiment, maison) — the Lexique
convention renders it ɛ across positions."* Flipping it to [e] is the cleanest possible test of the whole
hypothesis, and against the audio:

    ai -> e     40 rows closer,  99 further

⚠ **TWO DICTIONARY REFEREES AGREED AND THE SPEECH DISAGREED, 2.5:1.** The referees encode a transcription
convention — neutralised pretonic mid vowels, the modern descriptive norm — and FLEURS readers produce the
conservative [ɛ]. Both are real French; the corpus this engine feeds is speech, and Lexique is the
convention the code already names. **No change.**

Worth stating plainly because it inverts the usual precedence: through Runs 22–26 the referee was the
arbiter and the audio the corroboration. Here they conflict outright.

⚠ **AND THE FIRST REASON I GAVE FOR SIDING WITH THE AUDIO WAS WRONG.** I argued the FLEURS readers are the
professional register the project targets, so the audio directly witnesses it. The user, who has listened
to the recordings, corrected that: in English they sound like university-affiliated readers, not news
anchors. **No instrument in this corpus witnesses the anchor register** — the audio shows what one set of
non-professional readers did, and a dictionary referee records a transcription convention.

The decision is unchanged, on the surviving argument: [ɛ] is the CONSERVATIVE, careful variant and [e] the
neutralised one, and careful is the better bet for the target register. The audio agreeing is corroboration
from a different population, not proof of register. Both readings are real French, so per project policy
this is a convention choice rather than a defect — and the burden is on a change to beat the incumbent,
which [e] does not.

### Left alone

The bare-⟨e⟩ half (35 words) would need a THIRD category the engine does not have: `case "e"` emits `ɛ` in a
closed syllable and `ə` in an open one, with no pretonic [e], and adding one would interact with the schwa
deletion machinery. Given the ⟨ai⟩ result went 40/99 against the same hypothesis, the prior is now against
it and the cost is high. Recorded, not attempted.

### Verdict

**No phonemizer defect in fr_fr, and no change made.** Three languages of the last four have come back
clean — bn_in, hy_am, fr_fr — each with a large aggregate class that turned out to be correct as designed.

## Run 28 — 2026-08-19 — he_il: ktiv male writes one consonant with two letters

`he_il` scores worst of the languages worked this session (median 0.340) and its all-flagged rows are again
Latin-in-Hebrew. But its deletion tally is unlike any other language's: **`ʔ` 7,928 and `h` 7,118 deleted**,
far above any substitution pair. `ʔ` is the documented deliberate exclusion from `COARSEN` (dropping it
scored 1.8:1 against 4.6:1 in the skeleton work, and it is the evidence for the Kazakh spurious-glottal
defect), and word-final ⟨ה⟩ is already correctly silent (תורה → *toʁa*). Neither was the lead.

The lead was a shape no other language in this corpus has:

    identical-consonant clusters in he_il output: 1,312 across 783 of 3,242 rows (24%)
        jj 599    vv 374    ll 83    mm 60    nn 32    χχ 31    tt 29    ʃʃ 27    dd 25

⚠ **KTIV MALE WRITES A SINGLE CONSONANT WITH TWO LETTERS.** Unvocalized Hebrew doubles ⟨ו⟩ and ⟨י⟩ to mark
the consonantal /v/ and /j/ apart from the mater reading; pointed spelling uses one letter with a dagesh.
The scan is niqqud-driven, so it read both:

    שווה      ʃvev            חייל      χajajl          בניין   binjajn
    טלוויזיה  televivjzja     תיירות    tajajʁut        אווירה  ʔavivjʁa

**This is not a variant reading** — Hebrew has no identical-consonant clusters, and no reader of any
register produces *χajajl* for חייל. 973 of the 1,312 clusters are this one pair.

    1,107 rows closer / 31 further      (mean 0.3637 → 0.3620, median 0.3402 → 0.3379)

⚠ **AND THE REFEREE IS UNTOUCHED, WHICH IS THE POINT.** Only **31 of 3,242** corpus rows carry niqqud while
the referee is entirely vocalized — the two exercise different paths. The referee moves 2,264 → 2,265, so
the change is provably confined to unvocalized input rather than merely appearing safe.

### The guard that took regressions from 72 to 31

⟨ו⟩ is also the holam/shuruk mater and ⟨י⟩ the hiriq/tsere mater, so an adjacent pair is not automatically
a digraph. The first version collapsed on the letters alone and **deleted a real [v]**: חווים is [o]+[v],
and it came out *χoim* for [χavim]. Requiring the previous chunk to have resolved to the CONSONANT (its IPA
starts with v/j) separates the two.

⚠ **THE COLLAPSED LETTER KEEPS ITS CHUNK.** `phonemizeAligned` is the tagger's TRAINING ALIGNMENT —
`tools/hebrew/build_tagger_data.ts` reads the cons→ipa pairing — so dropping a chunk would desynchronise it
from the skeleton. The letter keeps its chunk with the consonant removed and the vowel retained, the same
shape the silent maters already use. It has to keep the vowel because the tagger puts it on whichever of
the pair it chooses.

### A pre-existing gold moved, and a test of mine could not fail

`בייג'ינג` → *vjjd͡ʒjnɡ* was pinned by the geresh test; Beijing is [bejd͡ʒiŋ] with ONE [j], so the gold
encoded the bug. Updated to *vjd͡ʒjnɡ*; what that test exists to pin — the geresh surviving word-medially —
is unchanged.

⚠ **AND MY MATER-GUARD TEST PASSED AGAINST A BUILD WITH THE GUARD DELETED.** I wrote it with חֹווִים, where
the holam sits on the ⟨ח⟩ — so the first vav IS the consonant and the guard is never consulted. The case
needs holam MALE, the mater on the vav itself: חוֹוִים, שׁוּוִי, חוֹוֶה, which go χovim/ʃuvi/χove with the guard
and χoim/ʃui/χoe without it. **Third time this session** a test sat outside the domain of the rule it
guarded (German ⟨rh⟩ medial-vs-edge, the German sed hitting two rules, this). The pattern is always the
same: the example is *about* the right feature but not *in* the branch under test.

## Run 29 — 2026-08-19 — sl_si: the stress deferral closed, and why the sibling's fallback was wrong

The last item from the original handoff (§4): `sl_si` has its own kaikki dump and a separate engine, "same
treatment as sr/hr/bs, not yet done". Slovene emitted **no stress at all** across 2,512 corpus rows, and
`slovenian.jsonc` recorded it as deferred pending a lexicon.

⚠ **NEITHER INSTRUMENT CAN MEASURE THIS, AND BOTH CONFIRM IT DID NO HARM.** `fold()` strips ˈ for the ASR
distance and the referee's BACKBONE strips it too, so a stress addition is invisible to each. Verified
rather than assumed: after the change the referee is **4995/5177, identical**, and the corpus is
**mean 0.3161 / median 0.3103, 0 better 0 worse** — bit-identical. Validation is therefore held-out
accuracy against the lexicon, the same standard the sr/hr/bs work used.

### Stress only, and the DUMP decides that

Slovene has two accepted standard norms, and I was about to pick between them on judgement. The dump does
it instead: kaikki labels every Slovene pronunciation `"phoneme, tonal variety"` or `"phoneme, non-tonal
variety"`. The non-tonal (stress + length) norm is the broadcast standard; the tonemic one is a minority
standard. So unlike sr/hr/bs — where the four-way pitch accent IS the system and is emitted as Chao letters
— Slovene gets position and no contour.

### Two bugs in my own builder, both silent

⚠ **⟨r⟩ IS A NUCLEUS ONLY WHEN SYLLABIC.** I copied the Serbo-Croatian builder's one-line "a vowel or ⟨r⟩"
rule without checking it against this g2p, which inserts the schwa only for an r with no vowel neighbour
(prst → pərst). Counting every ⟨r⟩ puts a phantom nucleus before the real one: *robót* indexed 2 where the
engine has 1, and the mark would have landed a syllable late in every word containing an ordinary r.

⚠ **AND STRIPPING "EVERY COMBINING MARK" DESTROYS ⟨š č ž⟩.** They decompose to s/c/z + U+030C, so *država*
was stored under the key `drzava`, which no corpus token can ever match. Coverage of polysyllabic tokens
went **35.0% → 42.6%** on fixing it. Only the five accents plus the quality dot (U+0323) and the macron
come off. The same trap the Serbo-Croatian builder documents for ⟨ć⟩, hit from the other direction.

    marks on the accented forms:  U+0301 74,788   U+030C 42,590   U+0311 15,253   U+0302 10,192
                                  U+0323  8,461   U+0300  7,059   U+0304  3,427   U+030F  2,436

U+030C is the second-commonest mark in the file and is almost entirely ⟨š č ž⟩ — reading it as an accent
would have "stressed" a consonant.

### The fallback is penultimate, and copying the sibling would have been 24 points worse

    fallback          by type    by token
    first nucleus       43.5%      51.7%     <- what serbian.ts uses (correctly, for itself: 66.8% there)
    penultimate         57.2%      76.1%     <- taken
    antepenultimate     56.8%      56.7%
    last nucleus         6.2%       9.0%

⚠ The token figure is measured on lexicon-COVERED words, so it is a frequent-word number; the OOV
population it actually applies to is likelier to behave like 57.2%. Both are recorded, because the
optimistic one is not the one the fallback will be judged on.

37,340 words, 42.6% of polysyllabic corpus tokens exact, the rest at ~57–76%. The out-of-lexicon misses are
overwhelmingly monosyllabic clitics (v, in, na, ki, za), which take no mark at all.

### What the change broke, and the test that caught it

⚠ **THE ×14 HYPHEN-COMPOUND DEFERRAL RESTED ON THIS ENGINE EMITTING NO STRESS.** Its test said so in
as many words — the compounds are safe to split "on the claim that this engine emits no stress, so
splitting the compound is phonemically identical", and it **verified** that rather than asserting it,
"because if any word-boundary phonology existed the claim would be false."

It is now false. A Slovene compound takes one primary stress, but the split form stresses both halves:
`21-letni` → *ɛnaindʋˈajsɛt lˈɛtni* against *ɛnaindʋajsɛtlˈɛtni* joined. Two of the four differ (`8-krat`
and `100-metrska` happen not to). The segmental claim still holds and is still pinned; the prosodic one is
now a small real defect — 14 corpus instances with one spurious mark — and joining the compound is the fix,
downstream of normalize.ts, which leaves `21-letni` untouched. **A test written to detect exactly this did
exactly that**, five months after it was written.

### And I laundered eight goldens before catching myself

Nine existing tests failed because every polysyllabic gold now carries a mark. I bulk-replaced expected
with actual — which is the gold-laundering failure this session has been fighting — and then checked each
against the accented spelling: *pólje, glázba, člôvek, Ljubljána, Abhazíja, vôda, dóber, čevápi, dvésto,
drúgo, svetóvno, vójno, pokríva, devétnajst, tísoč, pétsto, kvadrátnih, kilométrov* all correct.

Two were not, and one was worse than wrong:

- ⚠ **THE BULK REPLACE HIT AN INPUT.** `phonemizeWord("banja")` became `phonemizeWord("bˈanja")` — a
  stress-marked input compared to itself, a test that cannot fail. It matched because the input and the
  old expected value were the same string.
- **`petintrideset` / `štiriintrideset` are fallback errors** and are now pinned AS fallback errors, with
  the correct form and the rule that would fix it named. A composed numeral takes its last element's own
  stress offset by the preceding nuclei: dvajset is lexicon-0 and enaindvajset is lexicon-3, which is
  0 + the three nuclei of "enain" — the arithmetic checks out against the entries we have, so the rule is
  known-good and simply not implemented. Left for its own change.

## Run 30 — 2026-08-19 — the three open items; two land, and the third's premise was wrong

### 1. Slovene compound stress — landed

A compound takes its LAST element's own stress, shifted right by the nuclei in front of it. Checkable
against the lexicon rather than inferred from the words it fixes: `dvajset` is stored at 0 and
`enaindvajset` at 3 = 0 + the three nuclei of *enain*. Held out 4,000 polysyllabic lexicon words:

    minsuf   covers   rule     penultimate on the SAME words   net
       4     20.2%   63.8%               45.4%                 +3.73pp
       5     10.2%   87.5%               46.5%                 +4.20pp
       6      6.8%   96.3%               36.5%                 +4.05pp

5 and 6 are within noise on net; **6** is taken for the reason `serbian.ts` gives for the same choice — a
wrong rule prediction ASSERTS a stress, a fallback error is a default already known unreliable. Requiring
the PREFIX to be a known word too (a stricter "real compound" test) collapses coverage to 3.6%: the
prefixes here are bound forms (*petin-*, *štiriin-*) that are not words.

It corrected four numerals the penultimate fallback had put a syllable late — *petintrídeset*,
*štiriintrídeset*, *petinštírideset*, *triindevétdeset* — two of which were pinned as known-wrong goldens
one run earlier.

### 2. Slovene numeral-initial hyphen compounds — landed

`normalize.ts` rule 11z joins them (36 corpus instances). ⚠ **THE OTHER TWO HYPHEN SHAPES WERE ALREADY
CLAIMED UPSTREAM**, which is what lets the rule be blunt: a unit abbreviation (`360-km`, `35-mm`) is read
by the unit tier and an inflectional ending (`1830-ih`, `5-ih`) by the case rules, both before this point.
Checking that first is why the rule is four lines instead of a classifier. The ≥4-letter guard is the belt:
every attested compound suffix is 4+ (krat, urne, letni, metrska, stopinjski, milimetrski), every ending
and unit ≤3.

The ×14 deferral is closed, and `slovenian.test.ts` now pins that the joined and split forms agree — the
same assertion as before, but true by construction rather than by the absence of prosody.

### 3. The German compound detector — IT ALREADY EXISTS, AND WAS ALREADY RUNNING

⚠ **THE PREMISE OF THIS ITEM WAS WRONG AND I WROTE IT TWICE.** Runs 25 and 26 both concluded that the
medial ⟨th⟩ extension (186 closer / 24 further) and the compound-boundary ⟨h⟩ loss "need a compound
detector", and named `lexicon.tsv`'s `k` flag as the input for one. There is a full decomposer already —
`morphology.ts` over `core/germanicMorphology.ts` — `phonemizeWord` calls it and g2p's each morpheme
SEPARATELY, and it was doing so during the 186/24 measurement. A word that splits never presents ⟨th⟩ as a
unit at all: *Gasthaus* is read as "gast" + "haus", *Kunsthändler* as "kunst" + "händler", *achthundert*
as "acht" + "hundert". Those are already safe and are not among the 24.

The 24 are exactly the words `decompose` cannot split, and every one is a LEXICON-COVERAGE gap:

    rathaus                  `rat` is 3 letters; splitCompound floors a leading constituent at 4, and
                             that floor is load-bearing (measured −143 on Afrikaans at 3)
    truthahn, balsaholz,     `trut`, `balsa`, `gänse` absent from lexicon.tsv
      gänsehaut
    vertrautheit,            ⟨heit⟩ IS a listed suffix but strips only when the remainder is a known word:
      bejahrtheit            schön/frei/gesund/krank split, traut/bejahrt/mehr do not
    parenthood, south,       English inside German, where [θ] is right and no tier helps
      ninth

**So the extension stays unshipped, for a better reason than before.** Widening `lexicon.tsv` is
generated-data work (kaikki ∩ frequency), not a rule change. And the trade is bad in KIND, not merely in
count: the 24 DELETE a consonant from ordinary nouns (*Rathaus* → *ʁaːtaʊ̯s*) while the 186 remove a
spurious [h] from loanwords. By the project's own test — would a professional reader ever say this? — the
24 are misreadings and the 186 are variants.

The `g2p.ts` note now says this instead of asking for a detector, and a test pins the mechanism so the
item is not re-proposed a third time.

⚠ **THE LESSON FOR MYSELF: I ASKED FOR A TOOL WITHOUT CHECKING WHETHER IT EXISTED**, in two consecutive
runs, in a file whose sibling module imports that very tool eight lines from the code I was editing. The
same failure the `south_slavic_stress_sources_investigation.md` header records for the stress audit — "the
grep found nothing" promoted to "the data does not exist" — arriving as "the fix needs X" promoted to
"X does not exist".

## Run 31 — 2026-08-19 — the corpus re-scored, and the queue re-prioritised

Nine languages' engines moved this session and the fold moved for all of them, so the DB was stale in two
independent ways. Refreshed: **7,676 of 26,667 re-phonemized rows changed** (`ipa_prev` preserved, DB backed
up to `align.sqlite.bak-pre-refresh`), then `asr_align_label.py --apply`, which recomputes `dist` with the
current fold and redoes the sibling screen.

⚠ **THE RECOGNIZER PASS WAS NOT RE-RUN AND MUST NOT BE.** `phones` is what the audio says; only our side
moved. `asr_align_corpus.py` would re-run wav2vec2 over 104 GB for no change.

    all-flagged rows   747 -> 682   (-65, -8.7%)
    investigate rows 8,367 -> 8,297

    sn_zw  30 -> 8    ln_cd 37 -> 17   he_il 25 -> 13   de_de 23 -> 15
    zu_za  13 -> 8    hu_hu 16 -> 12   xh_za 10 ->  7

⚠ **AND `ny_mw` ROSE, 11 → 20, BECAUSE IT GOT BETTER.** Its median improved 0.3385 → 0.3258; a tighter
distribution moves the 3×MAD threshold down, so rows that used to sit inside it no longer do. `xh_za` did
the same (flagged 95 → 107 on a median of 0.4063 → 0.3947). This is the relative-scoring design working:
**fixing a systematic error sharpens the outlier detector on what remains.** Six of Chichewa's nine
all-flagged sentences are new and are prose, not digits — genuine new signal.

⚠ **`sl_si` IS UNCHANGED — 45 → 46 flagged, median 0.3103 both sides.** Predicted, and worth having
confirmed on the real pipeline rather than in a probe: stress is folded out, so the whole Slovene run is
invisible here and its validation had to be the held-out lexicon table.

### The by-lift ordering is now misleading

    lang          af  sent  digit%  latin%   status
    bn_in         31    15    42%     6%     CLEAN — investigated, no defect
    ceb_ph        24    10    92%     0%     not examined
    ny_mw         20     9    20%     0%     fixed this session
    fr_fr         20     9    40%     0%     CLEAN — investigated, no defect
    hy_am         19     9    21%     0%     CLEAN — investigated, no defect
    cmn_hans_cn   19     9    21%    32%     not examined
    ln_cd         17     7    76%     0%     fixed this session
    hr_hr         17     8    41%     0%     not examined
    fil_ph        17     8    76%     0%     not examined
    mt_mt         16     7    75%     0%     not examined
    ckb_iq        16     7    50%    50%     not examined
    mi_nz         15     7    80%     0%     not examined

**Three of the top five are known-clean** — bn_in, fr_fr and hy_am account for 70 all-flagged rows that
have each been read and found correct. Working the list by size sends the next person straight back into
them. The queue needs a "examined, no defect" mark; until it has one, this table is the mark.

### The unexamined tier is mostly one already-made decision

⚠ **ceb_ph, fil_ph, mi_nz AND ig_ng ARE THE FOUR "MIXED" NUMERAL-REGISTER LANGUAGES FROM RUN 19** — measured
at 84.8% / 62.3% / 63.5% / 66.8% and declined because a third of their rows would get worse. Their
all-flagged queues are 71–92% digit-bearing *because of that decision*, not because nobody has looked.
Re-opening them means re-opening the mean-versus-variance judgement, not finding a bug.

`mt_mt` is the one that is genuinely different: Run 19 measured Maltese **NATIVE** (4.3% English, 6% French,
4% Spanish — it reads its own numerals), so its 75% digit-bearing queue is not a register question at all.

### And that pointed straight at a real defect

    9.30            ->  dɪsa punt tlɛtɪn        correct — "punt" is the decimal point
    id-9.30 am      ->  ɪt dɪsa . tlɛtɪn am     the period reaches the IPA as a CLAUSE MARK

The decimal rule's left boundary is defeated by the Maltese article-hyphen (`id-`, `fis-`, `il-`), so the
number splits and the `.` is read as sentence punctuation — a spurious pause inside a clock time. 9 rows.
Small, exact, and the kind of thing only a re-scored queue surfaces.

### What to do next, in order

1. **`mt_mt`** — the article-hyphen decimal bug above, plus the rest of its 75% digit queue, which is the
   only unexamined digit-heavy language that is not a settled register decision.
2. **`hr_hr` (17, 41% digit)** — unexamined, not a register language, and it shares `serbian.ts`'s g2p, so
   a finding there lights up three engines.
3. **`cmn_hans_cn` / `ckb_iq` / `fa_ir`** — 21–50% Latin, i.e. the code-switching class already measured as
   net harmful for French. Expect no defect; confirm cheaply rather than working them.
4. **NOT bn_in / fr_fr / hy_am** — read, measured, clean. Their 70 rows are the queue's floor, not its lead.

## Run 32 — 2026-08-19 — marking what was actually examined, and what the marking exposed

The queue has no "examined, no defect" state, so Run 31's known-clean rows would sit at the top forever.
`asr_align_label.py --set` writes a hand verdict into `status`, and `apply_auto` carries an explicit
`⚠ Never clobber a hand verdict` guard — its UPDATE only touches NULL/verified/investigate/
recognizer_short — so a hand verdict is durable across re-labelling. The sibling screen excludes them too,
so a marked row neither exonerates nor all-flags its siblings.

### The bar, and why most of the "clean" rows failed it

I was about to mark bn_in's 31 and hy_am's 19 on the strength of Runs 22 and 24. Before doing it, a
measurable test: what fraction of each row's post-`coarsen` substitutions are pairs that dominate the
WHOLE language (i.e. inventory/notation noise rather than anything about this row)?

    bn_in   7% – 52%   (most rows ~20%)
    hy_am  36% – 58%

⚠ **NOT ONE ROW IS EXPLAINED BY KNOWN NOISE, SO NOT ONE WAS MARKED.** Runs 22 and 24 concluded "no
phonemizer defect in this language" — a statement about the CLASS (Bengali's ɔ/o is lexical; Armenian's
medial epenthesis is refuted on both instruments). That is not the same claim as "this row's IPA is
right", and the distance these rows carry is still unaccounted for. Marking them would have converted a
class-level finding into 50 row-level certifications I cannot support.

### What was marked: fr_fr, all 20 rows, on per-row evidence

Every fr_fr all-flagged sentence carries a foreign run, and the recognizer shows the reader producing the
SOURCE language while we applied French rules — the same shape as the corpus's existing hand verdict
(`cinque terre: we read French, reader code-switched to Italian`). The evidence is per row, not per class:

    running       ours ʁyniŋ            heard ɹɛnɪŋ
    wonders of…   ours wɔ̃dɛʁ ɔf t       heard wɔndəz ʌv ði     ← a real /ð/
    birmingham    ours biʁminŋam        heard bœmɪŋhæm
    nixon         ours niksɔ̃            heard nɪksən
    airlines      ours ɛʁlin            heard ɛʁlaɪns
    kanjar        ours kɑ̃ʒaʁ            heard kandʒaʁ          ← Indian name, not English

8 sentences → `reader_divergence`. **fr_fr's all-flagged queue is now 0.**

### ⚠ AND CERTIFYING THE ROWS FOUND A BUG THAT READING THEM HAD NOT

Sentence 82 does not fit the pattern, and checking instead of assuming is what showed it:

    hesperonychus    ours ɛspeʁoniʃy     heard ɛsperonikus
    dromaeosauridae  ours dʁomozoʁid     heard tʁomaʊsaʁidaɪ

These are LATIN BINOMIALS, not English, and ⟨ch⟩ in the Greek-derived class is [k] in French. The engine
knows that — *psychologie* psikoloʒi, *archéologie* aʁkeoloʒi, *orchestre* ɔʁkɛstʁ, *écho* ekɔ, *chorale*
koʁal are all correct, and *chimie*/*machine*/*chat* correctly keep [ʃ] — so the class is lexicon-driven
and this genus is simply OOV. Marked `defect`, not `reader_divergence`.

In Run 27 I had counted this row among fr_fr's "English institution names" and moved on. It is neither
English nor a reader divergence; it is ours. **The act of writing a per-row justification caught what
reading the same row twice had not** — which is the argument for the verdict column carrying a reason
string rather than just a label.

    all-flagged  747 (session start) -> 682 (re-scored) -> 662 (hand verdicts)

## Run 33 — 2026-08-19 — retiring the queue as a worklist, and the instrument that replaces it

662 all-flagged rows remain and hand-verifying them is not the answer: Run 32 marked 20 and each needed a
careful per-row justification. The question is what the 662 ARE.

⚠ **THEY ARE A SAMPLE, NOT A BACKLOG.** Every fix this session moved far more rows than it had in the
queue — Hebrew's ktiv-male digraph moved **1,107 corpus rows while only 13 were ever all-flagged**. The
queue points at CLASSES; as a worklist it is 0.25% of the corpus (662 of 270,106) and its remaining
categories are mostly already-decided: code-switching (measured net harmful, declined), the MIXED-tier
numeral register (measured 62–85%, declined), and recognizer noise in languages it finds hard.

### Where the defects actually came from

Not one of this session's three real defect classes was found by reading a flagged row:

    he_il  identical-consonant clusters in OUR OUTPUT  ->  ktiv male     1,107 rows
    de_de  the referee's residual                      ->  ⟨th⟩            127 rows
    hu_hu  a re-derived queue after fixing the fold    ->  ⟨ch⟩            171 rows

The Hebrew one is the template and the cheapest: it used **no audio, no referee, and no comparison at
all** — just the observation that Hebrew has no identical-consonant clusters, so any in our output are
ours. That generalises.

### `output_anomalies.py` — check the output against what IPA can BE

⚠ **AND THE OBVIOUS CHECKS ARE MOSTLY NOISE, which is the main design finding.** The first draft flagged
76k "identical-consonant clusters" that are Italian geminates (*dˈella*), 33k "punctuation inside a word"
that is Lao's syllable separator, and called Mandarin's syllabic *ʐ̩* and Portuguese's *bˈẽj̃* vowel-less —
the detector reporting its own gaps. Only a check whose violation is impossible **in every language**
belongs in the default run. One qualifies outright: **a word with no nucleus cannot be said.**

    lang      no-nucleus   tokens    rate    examples
    ps_af           7310    65005   11.25%   d̪ hm t̪r hr kɻ
    mt_mt            655    60704    1.08%   fl bl t͡ʃ jr dr
    ckb_iq           634    55930    1.13%   kɾd tɾ bn ɡʃt pʃt
    mn_mn            436    58400    0.75%   t͡ʃʰ nt kʰm kʰw
    he_il            407    56638    0.72%   d͡ʒvn knd͡ʒʁ t͡ʃʁls

**`ps_af` at 11.25% — one Pashto word in nine is unpronounceable.** `pashto.ts` already records a "deferred
short-vowel-restoration subsystem", so this is a known deferral; what is new is the NUMBER.

⚠ **AND PASHTO IS THE ONE LANGUAGE WHERE A NUMBER LIKE THIS NORMALLY CANNOT BE TRUSTED.** It is a
macro-language, the referees are multi-dialectal, and the dialect segregation of the referee data is
imperfect (Kandahari is the variety this engine targets — `ښ/ږ` = retroflex ʂ/ʐ — and the referee records
other dialects' readings for a significant share of headwords). `pashto.ts` says as much in a double-⚠:
do not quote the referee score without the caveat, because the coverage lexicon was mined from the
referees and the shipped 69.6% is substantially circular against a rules-only 46.9%.

**None of that touches this measurement.** The no-nucleus check uses no referee, no audio and no dialect
assumption: *هم* is [ham] in Kandahari, Yusufzai and Wazirwola alike, and `hm` is not a possible reading in
any of them. That is precisely why the check is worth having in a language whose comparison-based numbers
are confounded — it is the one instrument the dialect problem cannot reach.

What the 5,091 alignable tokens are, mechanically: only **8%** involve the ⟨ه⟩ branch (which returns [h]
without ever inserting the inherent vowel); the other **92%** are ordinary short words — *د, تر, شک, تش,
کش, ژر, کړ* — where the zwarakay insertion does not fire. The insertion at `pashto.ts:218` is conditioned
on a FOLLOWING consonant, so it cannot serve a word's last consonant, and `کړ` is additionally in
`lexicon.tsv` as `کْړ`, sukun'd to no vowel on purpose. Diagnosing the remainder properly needs a session
on that engine and is not attempted here — the finding is the measured cost, not the fix. The detector's
real value is turning "deferred" into a measured cost and ranking the fleet's deferrals by how much output
each actually damages. Nothing in 33 runs of distance work surfaced this, because a language that is
uniformly bad has no outliers — the same degeneracy the README records for `ga_ie`.

⚠ **AND IT FOUND AN UNDOCUMENTED CLASS IN A LANGUAGE ALREADY WORKED TWICE.** German lowercase
abbreviations are read as consonant clusters instead of being spelled out:

    dvd -> tft      tv -> tf      mrt -> mʁt      ms -> ms      nhc -> nhk

*dvd* → *tft* even applies final devoicing to an acronym. FLEURS transcripts are lowercased, which destroys
the casing signal `core/initialisms.ts` needs; `initialism_casing.mts` exists to restore it and these slip
past. 8 distinct words in de_de, but the mechanism is fleet-wide.

### The recommendation

1. **Retire the all-flagged queue as a per-row worklist.** Keep it as a class detector, re-derived after
   each fix — Run 31 showed it sharpens as the language improves (`ny_mw` rose 11→20 *because* its median
   fell).
2. **Run `output_anomalies.py` as the primary sweep.** Cheaper, unambiguous, fleet-wide, and it finds what
   the distance cannot see: uniform damage, which by construction produces no outliers.
3. **The 662 are training-corpus policy, not a defect list.** A pair whose IPA disagrees with its audio is
   a poor training example whatever the cause; `exclude_defective.py` in the corpus repo already answers
   that question, and 0.25% is a rounding error against 270,106 rows.

Next by measured damage: **ps_af** (11.25%, a quantified deferral), the **German lowercase-initialism**
class, then **mt_mt** (1.08% plus the `id-9.30` decimal bug from Run 31).

## Run 34 — 2026-08-19 — the backlog: the casing wall, and what the reader actually says at a clock

### The initialism class — one fix, nine tokens, two languages

Run 33's German finding (`dvd` → *tft*) and Run 18's Pashto one (`qvc` → *kvk*) are the same wall: FLEURS
lowercases every transcript, and `core/initialisms.ts` matches `\p{Lu}{2,}`. The engine is already right —
`DVD` → *deː faʊ̯ deː*, `QVC` → *kjˈuː vˈiː sˈiː* — so only the corpus text needs repairing, which is
exactly what `initialism_casing.mts` exists for.

⚠ **AND ENGLISH HID THE WHOLE CLASS.** English reads most of these as letters ALREADY (dvd → *dˌiːviːdˈiː*,
tv → *tʰˈiːvˈiː*, mri → *ˌɛmɑːɹˈaᶦ*), so the English-only casing differential that produced the earlier
tranches was **inert for every one of them**. Re-running it with de/sv/cs/tr/xh as the host is what surfaced
them — and that same inertness is why the repair is free in English, the argument the list already makes
for `usa`.

Added: `dvd` (spread 381), `tv` (301), `mri` (240), `abc` (179), `http` (129), `tb` (116), `ms` (88),
`aol` (584), `mrt` (23). Collision-checked across the 30 languages each appears in — every lowercase form
is unpronounceable (*tf*, *tp*, *tβ*, *t̪ˠvˠ*, *mˠsˠ*, *tʼɓ*) and every uppercase gives that language's
letter names, including Mandarin's *aⁱ˥˩ mu˨˩˦ aⁱ˥˩ sɹ̩˥˥* for MS. Contexts read individually: `ms` is
multiple sclerosis, `abc` the broadcaster, `tb` tuberculosis inside `xdr-tb`, `mrt` the German/Swedish MRI.

### The Maltese clock — and the reader disagrees with BOTH readings

`decimalPoint` correctly refuses `9.30 am` as a decimal, but handed the string back with its dot intact and
the clause layer read that as sentence punctuation: *ɪt dɪsa **.** tlɛtɪn am*, a prosodic break inside a
clock time. The existing test pinned this deliberately — "the pause it already had stands" — and reversing
it is deliberate too: **refusing did not produce nothing, it produced a pause**, which is as much an
assertion as a reading and one no reader makes.

⚠ **BUT THE FIX IS NOT THE READING, AND THE AUDIO SAYS SO.** Asked what the reader actually does, both
recordings answer the same way:

    text     madwar id-9.30 am ħin lokali
    reader   m a d w a r · e d i s a · u n o s t a · f i l o t o · h i l l o k a l i
                            id-disgħa   u nofs ta'   filgħodu

**id-disgħa u nofs ta' filgħodu** — half past nine in the morning. The reader does not say the minutes as a
number at all (30 is *nofs*, half) and reads `am` as *ta' filgħodu*, not as letters. So "disgħa tletin" is
wrong too; this change removes the pause and nothing more.

⚠ **AND THAT IS THE ATTESTATION THE CLOCK FRAME WAS SAID TO LACK.** `punt` was admitted into this engine on
espeak plus two wikipedia articles. Here the corpus AUDIO supplies the frame directly, twice, for a
construction the file had no textual evidence for. A real clock reader —
`hour (u nofs | u kwart | u N) [ta' filgħodu | ta' waranofsinhar]` — is therefore buildable on evidence
rather than invention. Not attempted for 3 corpus rows, but no longer blocked on evidence.

This is the same shape as Run 19's Lingala note (*onze juste* for `11:00`), and it generalises: **the
recognizer is a source of attestation for spoken frames that text corpora do not record.** The numeral
register already quantified the prize at ~115 rows across five languages for clocks and decimals alone.

### Run 34b — the Maltese clock reader, built on the audio

Ten corpus readings, different speakers, decoded from the recognizer output — this IS the attestation the
engine's own note said the clock frame lacked:

    11:00                 il-ħdax                              hour ALONE
    10:00 ta' filgħodu    fl-għaxra ta' filgħodu               hour alone again
    1:15  ta' filgħodu    fis-siegħa u kwart ta' filgħodu
    8:30  ta' filgħaxija  fit-tmienja u nofs ta' filgħaxija
    9.30  am              id-disgħa u nofs ta' filgħodu        the DOTTED spelling, same frame
    11:20                 fil-ħdax u għoxrin                   bare, no minute-noun
    11:29                 fil-ħdax u disgħa u għoxrin minuta
    7:19  a.m.            fis-sebgħa u dsatax-il minuta
    10:08 ta' filgħaxija  fl-għaxra u tmien minuti             construct plural
    15:00 utc             it-tlieta ta' waranofsinhar          24h spoken as 12h

Implemented: `hour u minutes`, with `:00` → hour alone, `:15` → *u kwart*, `:30` → *u nofs*, 13–23 mapped to
1–11, and 1 o'clock as the feminine **siegħa** (the written article `fis-` agrees with it).

⚠ **THE MINUTE-NOUN IS NOT EMITTED, BECAUSE THE READERS DO NOT AGREE ON IT** — 11:20 bare, 11:29 *minuta*,
7:19 the teen linker *dsatax-il minuta*, 10:08 the construct plural *tmien minuti*. Three agreements for one
slot. Silence matches four of the ten exactly and the rest to within that noun.

⚠ **AND `nieqes kwart` IS NOT DERIVED.** The reader gave 8:46 as *fid-disgħa nieqes kwart* — quarter TO the
next hour — which needs rounding :46 to :45 and incrementing. That is a reader's rounding, and one
attestation cannot license inventing arithmetic.

⚠ **THE METRIC IS NEARLY NEUTRAL AND THAT IS EXPECTED: 17 closer / 10 further, mean 0.3336 → 0.3335.** The
gains are the frame (8:30 +0.087, 1:15 +0.049, 9.30 +0.033, 11:00 +0.015) and every loss is ≤0.035 and is
the minute-noun we deliberately withhold. The distance cannot reward what this change is actually for —
`l-11:00` used to read *l ħdaʃ **,** zɛrɔ*, a pause AND the literal digit zero inside a clock time, and
`fold()` strips the comma before scoring so the pause was never counted against us in the first place.
**The justification is the attestation, not the number**, and the number is reported so that is visible.

This also revises a decision twice: the test first pinned the raw dot ("the pause it already had stands"),
then two bare cardinals from Run 34's interim repair. Both are gone.

## Run 35 — 2026-08-19 — `read_text`: the corpus now records what was actually read

⚠ **`utt.text` WAS NOT THE PHONEMIZER'S INPUT, AND ITS SCHEMA COMMENT SAID IT WAS.** The corpus pass repairs
the transcript before reading it — `restoreInitialismCasing` → `restoreAbbreviationDots` →
`restoreNguniConcordAcronyms`, then the numeral register — and that repaired string was **transient**. So
`ipa` was derived from a string the database never held. **19,511 of 270,106 rows (7.2%) differ**, which
makes this a systemic inconsistency rather than a corner: for 7% of the corpus the `(text, ipa)` pair a
trainer reads does not describe itself, a reviewer cannot see why a row's IPA has capitals the transcript
lacks, and no single row could be corrected.

`read_text` + `read_text_src` (`auto` | `hand`) fix all three. The auto pass **excludes `hand` rows from its
SELECT**, not merely from its UPDATE — a human edit is never even recomputed — the same guarantee
`apply_auto` gives a hand verdict in `status`.

⚠ **AND IT IS WHERE A READER'S JUDGEMENT BELONGS.** A phonemizer reads the text it is given; it cannot make
the choices a reader makes. Maltese `8:46 ta' filgħodu` is read *fid-disgħa nieqes kwart* — quarter TO nine,
needing a round of :46 to :45 **and** an increment of the hour. Run 34b declined to derive that and was
right to: one attestation cannot license inventing arithmetic. But declining left the reading nowhere to
live, and the three rows now carry it as a hand-authored `read_text`. **The rule stays honest and the
corpus stays correct** — which is only possible once the two are separate columns.

    text       preċiżament fit-8:46 ta' filgħodu …
    read_text  preċiżament fid-disgħa nieqes kwart ta' filgħodu …
    src        hand

### ⚠ And my own Run 31 refresh had been writing degraded rows

The refresh in Run 31 re-phonemized 7,676 rows with `phonemizeAsync` + `numeralSegments` but **skipped all
three text repairs**, because I reimplemented the pipeline instead of calling it. Those rows sat in the
corpus without their casing repair until this run. Repaired here by re-deriving 33,850 rows — every language
I had touched, plus every language containing one of the nine new initialisms — through a script that
mirrors `phonemize-fleurs.mts` exactly; 3,784 changed.

That mistake is also an argument for the column: had `read_text` existed, the missing repair would have been
visible as a diff instead of invisible inside a transient string. **A pipeline whose intermediate is not
stored cannot be audited**, and I could not audit it.

    status after re-label:  verified 259,759 · investigate 8,274 · defective_audio 1,248
                            recognizer_short 797 · reader_divergence 21 · defect 6 · convention 1

## Run 36 — 2026-08-19 — sr/hr/bs initialisms, and a per-variety split the shared engine hid

`hr_hr` was next in the queue. Its all-flagged rows are English proper names, but the **no-nucleus** check
pointed at something else: `DVD` → *dʋd*, `GPS` → *ɡps*, `TV` → *tʋ*, `SSSR` → *sssr* — unpronounceable in
all three varieties. `serbian/normalize.ts` declared the class deferred, and gave the reason:

> INITIALISMS. Latin acronyms (FBI, GPS, CCTV) reach the g2p as unreadable clusters, but whether Serbian
> reads a foreign Latin acronym with Serbian or English letter names is a LEXICAL fact, and inventing it
> would be confidently wrong rather than merely raw.

⚠ **AND THE FIRST MEASUREMENT I MADE SAID THE DEFERRAL WAS OVERCAUTIOUS. IT WAS NOT.** Hand-decoding the
first occurrence of a dozen acronyms gave Serbo-Croatian names 10 against English 3 — *de-ve-de*,
*ge-pe-es*, *ge-em-te*, *u-te-ce*, *es-es-es-er* — and I wrote that into the code as settled. Counting the
WHOLE corpus reverses it:

    hr_hr   Serbo-Croatian 15, English 22
    sr_rs   Serbo-Croatian  7, English 15
    bs_ba   Serbo-Croatian 11, English 12

**A hand-picked first-occurrence sample is not a measurement**, and this one pointed the wrong way. Same
failure as the German ⟨ch⟩ candidate in Run 23, where the examples were consistent because they were the
cases the rule would fix.

⚠ **AND THE VARIETIES DISAGREE WITH EACH OTHER ON THE SAME TOKEN**, which the shared engine had no way to
express: `sr` says *di-vi-di* for DVD where `hr` says *de-ve-de*; `bs` says *dʒi-pi-es* for GPS where `hr`
says *ge-pe-es*. Three engines, one g2p, three conventions. That is a real finding about the language pair
and not about this change.

### Shipped anyway, for a narrower reason than I first wrote

The choice of names is contested; that **the run is spelled out at all** is not. *dʋd* has no vowel and is
wrong under either convention, while *de-ve-de* and *di-vi-di* differ from each other in two vowels. Any
letter-by-letter reading is far closer to the audio than the cluster.

    hr 76 closer / 50 further      sr 36 / 48      bs 59 / 43      net +30 of 312 rows changed

Thin, and the thinness IS the English-name split showing through — `sr`, the most English-reading variety,
is the one that measures negative. Every token the pass claims was checked and is a genuine initialism
(ABC ADT AOL DVD FBI GMT GPS HTTP NBA NHC NSA PBS PNG PSTN RSPCA SSSR TB TT TV UN UTC VPN…); nothing fires
on ordinary vocabulary, and the syllabic-⟨r⟩ words the naive test would claim — *krv*, *smrt*, *prst*,
*crn* — are exempted by the shared run test's liquid rule.

⚠ **ONE TABLE, THREE ENGINES, AND THREE NORMALIZERS.** hr/bs run `serbian.ts`'s g2p but each has its own
`normalize.ts`, so adding the pass to Serbian left Croatian unchanged until it was wired in all three —
worth knowing, because "they share the g2p" reads as "a fix there lights up three engines" and only half of
that is true.

The letter names are the native default and are **not** Slovene's: a stop or ⟨v z⟩ takes a following -e
(*be ce de ge pe te ve ze*), a continuant a preceding e- (*ef el em en er es eš*). Copying the sibling's
uniform table would have been wrong on half the alphabet.

## Run 37 — 2026-08-19 — ckb: the bizroke is real, emitting it is net negative, and the referee cannot say

`ckb_iq` was next on both instruments — 16 all-flagged and the highest remaining no-nucleus rate. The
structural check found the class immediately: **634 tokens across 54 word types with no nucleus at all**
(1.13%), all ordinary high-frequency words — کرد *kɾd*, گشت *ɡʃt*, تر *tɾ*, من *mn*, پشت *pʃt*. Sorani
writes every long vowel and the short /a/, but not the short /ɪ/ (the *bizroke*), and
`central-kurdish.ts` records that as a deliberate deferral: "not emitted here, and folded in the eval."

Inserting one vowel after the first consonant removes **every one** of them, 1.13% → 0.00%. Against the
audio, every quality is worse:

    insert ɪ    52 closer / 500 further        insert e   160 / 392
    insert i   133 / 419                       insert ə   106 / 446

⚠ **AND THE REFEREE CANNOT ARBITRATE — IT IS BLIND BY CONSTRUCTION.** `ckb.jsonc` folds `[əɪ] → ""` on both
sides, precisely because the bizroke "is not positionally predictable". Before and after are byte-identical
(922/972 and 977/1037). I briefly misread those two referee lines as a before/after drop; they are two
different referees. The audio is the only witness available, and it says no.

⚠ **THE FAILURE IS LEXICAL, NOT POSITIONAL**, which the mid-90s referee already implies: at 94.9% the
residue is word-specific, so a positional rule has nothing left to win. The shape of the failure shows it —
سفر is *safar*, an ordinary two-vowel word written with neither, and one insertion after the first consonant
gives *sɪfɾ*: right that a vowel is missing, wrong about how many and which. The recognizer agrees the vowel
is usually audible (something between the ⟨k⟩ and the rhotic of کرد in 71% of instances) but reports it as
`e` 32, `a` 26, `i` 9, `ə` 7, nothing 29 — no single quality to insert.

⚠ **AND A LEXICON MUST BE HOMOGRAPH-AWARE.** An abjad's defective spelling can be several words, and a
whole-word entry silently picks one. Sorani is better placed than Arabic or Persian — it writes ⟨و⟩ and
⟨ی⟩, so *Kurd* کورد is distinct from *kird* کرد — but the Pashto file already shows the failure shape,
sukun-ing `کْړ` to no vowel because that reading is contested. Any ckb lexicon needs that abstention
mechanism, not a bare spelling→pronunciation map. **Not quantified here**: measuring how much of the class
is genuinely homographic needs word-aligned audio, and this corpus's proportional windowing catches
neighbouring words' vowels, so the per-spelling distributions it yields are too noisy to settle it.

**Reverted.** The deferral stands and now carries its numbers, so it is not re-tried a third time.

## Run 38 — 2026-08-19 — why the referee could not move, and how much of the bizroke class we actually reached

**Question.** Run 37 shipped 2,517 bizroke entries yet the referee score did not change. If words that were
missing a vowel now have one, why is the referee flat?

**Command.**

    cat tools/referee-eval/langs/ckb.jsonc

**Finding.** The last fold in the file is `{ "pattern": "[əɪ]", "replace": "" }` — the bizroke axis is folded
to nothing on *both* sides before the comparison. The referee is blind to this change by construction, and was
made blind deliberately in the ckb bring-up, because the two human referees disagree on the vowel's *quality*
(wikipron writes ɪ, kaikki writes ə) and scoring that disagreement would have been noise. Flat is the only
result it could have produced. Nothing to diagnose.

**The instrument gap this exposes.** Counting the vowels in each shipped entry:

    entries 2517 | all-vowels-are-bizroke 97 | more than one bizroke 403

Only **97 of 2,517 (3.9%)** of the class is visible to `output_anomalies.py`, because the no-nucleus check
fires only when a word has *no* vowel at all, and 96% of bizroke words carry a written long vowel elsewhere
(`کوردستان` = *kʊɾdəstaːn* — the ⟨ا⟩ is written, the ə is not). The 1.13% → 0.19% no-nucleus improvement was
therefore the tip, not the measure. Combined with the referee fold and the ASR's Sorani under-transcription
(0.929 of our folded phone count), **there is no instrument in this repo that can score the bizroke.** The
held-out split of the source is the only one available, which is a real constraint on anything built next.

**Corpus reach.**

    ckb corpus: 9993 types, 55873 tokens
    lexicon hits: 641 types (6.4%), 5128 tokens (9.2%)

The lexicon lands on 9.2% of tokens — better than its 6.4% type share, so it is catching frequent words —
but the source vocabulary says the bizroke rate among words we transcribe correctly otherwise is
2517/(2517+6870) = **26.8%**. Scaling that to the corpus puts roughly 2,000 word types still unvoweled.
**Implication:** the lexicon closed about a quarter of the class by type. The remainder is OOV and needs a
model, not more lexicon — the source is exhausted at 10,041 words.

## Run 39 — 2026-08-19 — the bizroke tagger: the class IS learnable, and a builder bug found on the way

**Question.** Run 38 left ~2,000 ckb corpus types the exhausted lexicon cannot reach. Run 37 concluded the
class is "LEXICAL … not positionally predictable" — but that was measured of a *fixed epenthesis rule*, not of
a model. Does a BiLSTM conditioned on the whole skeleton do better than the never-insert prior?

**A builder bug, found while rebuilding the training data.** `engine_says.mts` called `phonemizeWord` — the
SHIPPED path, which since Run 37 consults the very lexicon it is used to build. Re-running
`build_ckb_lexicon.py` today would have classified all 2,517 entries as "already agrees" and rewritten
`lexicon.tsv` EMPTY. Switched to `phonemizeWordRules`; the rebuilt file is byte-identical to the shipped one
and the classification reproduces exactly (`6870 agree, 2517 bizroke-only, 654 other`). The same
lexicon-vs-rules distinction that keeps the referee honest turns out to keep the *builder* honest too, and
only one of the two was wired.

**Command.**

    .venv/bin/python tools/central-kurdish/train_ckb_bizroke.py --src <clone> --eval-only

**Finding.**

    10041 source pairs -> 9387 trainable (2517 carry a bizroke)
    stem-blind held-out: train 8426 / test 961 words
      never-insert baseline : 73.8%
      tagger word-exact     : 95.1%

The class is learnable. Error 4.9% against the prior's 26.2% — a 5.3× reduction — and this is word-exact, so
one misplaced vowel anywhere in a word counts against it. **The split is stem-blind** (grouped by the first 5
characters) because Sorani's inflected families would otherwise straddle it; a random split reads 96.5%, and
the 1.4pp gap is the size of the lie a random split would have told.

**What Run 37 actually established, restated.** Not that the bizroke is unpredictable — that *one insertion
after the first consonant* is unpredictable. سفر is *safar*: the rule is right that a vowel is missing and
wrong about how many and which. Conditioning on the whole skeleton is a different question and it has a
different answer. Worth remembering the next time a "not tabulable" finding is reached for as a reason not to
model something.

**The shape, and why it is unusual.** The tagger's input is `phonemizeWordRules` output, not the orthography,
so every tag is either a symbol or that symbol + ɪ. Two consequences: the consonant-consistency mask makes
altering the skeleton *structurally* impossible (the test asserts the round-trip — strip ɪ, get the rule
reading back), and the referee path stays non-circular. A tagger reading the abjad directly would have had
neither property.

**Corpus impact**, `phonemize` vs `phonemizeAsync` over all 3,040 ckb rows: 5,350 of 58,704 tokens change
(9.1%), all by an inserted ɪ. No-nucleus barely moves (3.72% → 3.61%) — exactly as Run 38 predicted, since
only 3.9% of the class is visible to that detector. **The 9.1% is the measure; the no-nucleus delta is not.**

**A fleet-wide arity hazard, found by the test suite.** Adding the `oovOverride` parameter to
`phonemizeWord(word, oov?)` broke `test/bignum-fallback.test.ts` with "oov is not a function":
`core/numbers.ts` `spellDigits` did `.map(word)`, and `Array.map` passes `(value, index, array)` — so the
index arrived as the OOV resolver. Fixed to `.map((w) => word(w))` in the shared helper rather than at the ckb
call site, since **every** engine's word reader passes through there and any of them could grow a second
parameter next.

**Instrument note.** Neither the referee nor the audio can score this tier (Run 38). The stem-blind split is
the whole instrument, and is reported as such in `ckb-bizroke-tagger.PROVENANCE.md`.

## Run 40 — 2026-08-19 — fold the bizroke to a VOWEL, and the residual starts talking

**Question.** With the vowel restored by lexicon + tagger, is `[əɪ] → ""` still the right fold? And if the
referee becomes an instrument again, what does its residual say we should fix?

**The fold was wrong, and wrong in a specific way.** The two referees disagree about the bizroke's QUALITY
(wikipron ɪ, kaikki ə). The fold that disagreement justifies is *normalise the quality*. What was there
instead **deleted the vowel from both sides**, which additionally scores its PRESENCE as free — so rules,
lexicon and tagger all read identically and Run 37's flat referee was "no instrument", not "no effect".
Changing `replace` from `""` to `"ə"`:

| ckb tier (folded backbone) | wikipron | kaikki |
|---|---|---|
| rules only | 72.3% | 71.2% |
| + bizroke lexicon | 74.8% | 73.6% |
| + bizroke tagger | **85.4%** | **84.9%** |

The tagger is worth 4.4× the lexicon, which is what an exhausted 2,517-word source against ~2,000 remaining
corpus types predicts. **This is the external confirmation the held-out split could not give** — both referees
are independent of AsoSoft. The eval's ckb entry now runs the whole shipped tier (lexicon → tagger → rules)
rather than the lexicon path, which is only legible because the fold stopped hiding it.

⚠ The regression floor in `test/referee-eval.test.ts` moved **down**, 0.92 → 0.80, while the engine got
better. The old 94.9% was measured with Sorani's one unwritten vowel deleted from both sides.

**⚠ THE TWO REFEREES ARE NOT INDEPENDENT OF EACH OTHER.** Checked directly: all 972 wikipron headwords appear
in kaikki, and after folds the two agree on **964 (99.2%)** — 5 bizroke placements and 3 other segments apart.
Both scrape en.wiktionary; kaikki is a near-superset adding 65 words. The ckb headers called them "TWO
independent HUMAN referees" and that overstates one upstream measured twice. Corrected in `ckb.jsonc`, the
engine header, the provenance doc and the eval test. They remain independent *of AsoSoft*, which is the axis
that matters here — but the answer to "is there dialectal intermixing between the referees" is no: there is
barely a second referee.

**Residual classification** (142 wikipron / 157 kaikki misses, by whether the consonant skeleton matches —
measured on the pre-packing model; Run 41 re-measures it at 144/154 with the wrong-slot class halved to 3/4):

|  | wikipron | kaikki |
|---|---|---|
| bizroke-only (skeleton exact) | 92 | 105 |
| — we omit a vowel the referee has | 53 | 62 |
| — we add one it does not | 33 | 37 |
| — right count, wrong slot | **6** | **6** |
| skeleton differs | 50 | 52 |

Two readings. Omission and over-insertion are **near-balanced**, so what is left is placement rather than a
bias — a systematically over-eager model would be lopsided. And only **6** misses put the right *number* of
vowels in the wrong *slot*: when the model knows a vowel belongs, it nearly always knows where. The
skeleton-differs half is pharyngeal ħ/ʕ~h, uvular χ~x, long-vowel quality, and kaikki letter-name rows
(⟨و⟩ → *waw*) — outside this tier.

**Two bugs the residual surfaced.**

1. **The palatal fold was voicing-blind.** `[cɟ] → k` sent the referee's [ɟ] to k while our ɡ stayed ɡ, so all
   12 ⟨گ⟩ palatalisations (گیتار *ɟiːtaːɾ*, گیان, گیسک, گیا…) were scored wrong for a distinction *neither
   side wrote*. Split into `c → k` and `ɟ → ɡ`: **+0.8 / +0.7**.
2. **Word-final ɪ is a model artifact, and measurably so.** Only **9 of the 9,387 training words (0.1%)** end
   in a bizroke, but the tagger emits a final one on **2.4%** of referee vocabulary and **1.1%** of FLEURS ckb
   types — 10–24× its own data. It is generalising the cluster-breaking vowel into a position AsoSoft almost
   never puts it (ئاشت *aʃtɪ* for *aʃt*, بیست *biːstɪ* for *biːst*). Suppressed in the tagger's `postprocess`:
   **+1.9 / +2.1**, 18 and 21 words. ⚠ The base-rate check is what makes this a correction rather than
   referee-fitting — the training data and the referee agree against the model. The 9 legitimate cases are
   lexicon entries and the lexicon is consulted first, so they are untouched.

**Implication for the training data.** Nothing to fix in it: the balance of omissions to over-insertions says
the model is not biased, the 6 wrong-slot cases say placement is nearly solved, and the one systematic error
was the model departing from its data rather than following it. The remaining lever is *more* data of the same
kind, and AsoSoft is exhausted — so the next real gain in ckb is a second word list, not a better model.

## Run 41 — 2026-08-19 — the word-final artifact was the TRAINING METHOD, not the data

**Question.** Run 40 measured the tagger emitting a word-final ɪ 24× more often than its training data ever
does, and patched it with a `postprocess` strip. It also concluded "nothing to fix in the training data" —
which does not license "nothing to fix". If the data does not contain the behaviour, where did the model get
it?

**Finding — no packing.** `Tagger.forward` ran the BiLSTM over padded batches with no
`pack_padded_sequence`. The BACKWARD direction therefore crosses the pad steps *before* it reaches a word's
last real symbol, so that symbol's representation is contaminated — by a varying amount, since it depends on
the batch's longest word. Serving is batch=1 and unpadded, where the backward pass starts cleanly at the true
final symbol: a condition training barely presented. **The damage lands precisely at the end of the word**,
which is exactly and only where the artifact appeared.

**Command.**

    .venv/bin/python tools/central-kurdish/train_ckb_bizroke.py --src <clone>

| | before | after packing |
|---|---|---|
| held-out word-exact (stem-blind) | 95.1% | **96.6%** |
| word-final ɪ, referee vocabulary | 2.4% | **0.1%** |
| word-final ɪ, FLEURS ckb types | 1.1% | **0.0%** |
| referee, wikipron / kaikki | 82.7 / 82.1 | **85.2 / 85.0** |
| random-split held-out (same probe) | 96.5 → | 98.2% vs 96.7% stem-blind |

The final-ɪ rate lands on the training data's own 0.1%. Error rate 4.9% → 3.4%, a 30% reduction, from a
change that touches no data and no hyperparameter.

**Verified before touching anything else, at the user's instruction.** Full CI green; `test/ckbNeural.test.ts`
still passes unchanged, including the round-trip assertion that stripping ɪ from any tagger reading returns
`phonemizeWordRules` exactly (so the retrain did not loosen the safety property). Corpus effect 9.1% → 9.2% of
ckb tokens, no-nucleus 3.61% → 3.59%. A new smoke check asserts the packing invariant directly — packed logits
are independent of trailing padding, a padded row equals the same word alone, and (the mutation guard) the
unpacked path really does differ at the word end; reverting the packing fails the first two and keeps the
third.

**The Run 40 postprocess is removed.** On the fixed model it is worth ONE word and would suppress the genuine
final bizroke. It was treating a symptom; the note stays in `centralKurdishTagger.ts` because the next person
to see a position-specific artifact should suspect the padding before the data.

⚠ **EVERY BiLSTM TRAINER IN THIS REPO HAD IT.** Checked all ten — `tools/bilstm_training/tagger.py` (the
shared core for nb/en/da/fr) and the standalone trainers for sd, bn, af, he, fa: none packed. The shared core
is now fixed so the bug cannot propagate to the next language, but **every committed `.onnx` except ckb's was
trained under it** and carries some amount of word-final damage.

**Not retrained wholesale, on purpose.** Each of those nine has a measured provenance table and a regression
floor in `test/referee-eval.test.ts`; a retrain moves both and needs its own before/after against its own
referee, and a couple (sd's inherent-vowel masking, fa's encoder/decoder pair) have training-time subtleties
that do not survive a blind rerun. It is a campaign, not a sweep. ckb is the cleanest possible demonstration
of the size of the prize — a tagger that decides exactly one thing, so the effect is not confounded — and
1.5pp word-exact is what it was worth there.

**Method note.** The base-rate check in Run 40 (model 2.4% vs data 0.1%) is what made this findable. A
divergence between what a model does and what its data contains is a bug in the *machinery* until proven
otherwise; "the data is fine" and "the training is fine" are different claims and Run 40 conflated them.

## Run 42 — 2026-08-19 — PR review: four defects, three of them in things I had already written down

Reviewing the ckb branch before merge, rather than trusting it because CI was green.

**1. The `ckb` floor needed the OPTIONAL ONNX runtime, and would have cried regression without it.**
`onnxruntime-node` is in `optionalDependencies`. The eval's ckb entry is the whole shipped stack and the
tagger self-falls-back, so on a machine without the runtime the score drops to the LEXICON-ONLY 74.8% and the
0.80 floor fails — reported as a linguistic regression in a suite whose header says floors are sized for
"ordinary churn". A 10-point cliff is not churn. Fixed two ways: the test skips ckb's floor when the model or
the runtime is missing (verified by moving the .onnx aside — 170 passed, 1 skipped, no failure), and
`eval.ts` prints a warning instead of quietly reporting a lower tier's number under this tier's name. ⚠ And
the first draft of both said "rules-only 72.3%" — running it showed 74.8%, because the lexicon lookup happens
BEFORE the tagger and still fires. Wrong number in a warning is worse than no warning.

**2. A test that passed for the wrong reason.** `tag("ⵣⵣ") === ""` was meant to cover the out-of-vocab
DECLINE path. But `phonemizeWordRules("ⵣⵣ")` is `""`, so the factory returns at its `T === 0` early exit and
never consults the vocab. Checking properly: **the decline path is unreachable from real Sorani** — every
symbol this engine can emit is in the model's 35-symbol `src`. So the test was replaced with the invariant
that actually matters: add a grapheme to `central-kurdish.jsonc` without retraining and the tier silently
declines every word containing it, no error and no failure. Mutation-checked by deleting ɫ from the vocab.
The `T === 0` case is now its own test so neither can stand in for the other again.

**3. Two self-contradictions in the ckb engine header** — the same file that establishes wikipron and kaikki
are one upstream also said "THE TWO INDEPENDENT REFEREES" and, in the paragraph justifying the override of the
audio, "THREE INDEPENDENT HUMAN SOURCES AGREE". It is two: AsoSoft and Wiktionary. That overcount was
load-bearing — it is the argument for shipping against the ASR — so it is corrected rather than softened.

**4. Stale numbers throughout**, because the packing fix landed after the prose: the tagger header's "a random
split reads 2pp higher" (measured 1.5pp), the fold note's ladder (pre-fix values), the provenance residual
table (pre-packing), and the claim that the referee eval "runs `phonemizeWordRules`" — no longer true, since
the eval now runs the whole tier. That last one is not cosmetic: it is the file's non-circularity argument,
which changed from by-tier to by-source, and a future reader "fixing" the eval to rules-only by analogy with
sd/bn/af would silently stop measuring the tier. Now says so explicitly.

Also re-measured with both fixes in: the residual's wrong-slot class **halved**, 6 → 3 (wikipron) and 6 → 4
(kaikki). Two fixes found by reading a residual, and the residual is smaller and better-shaped for it.

**Method note.** Three of the four were things I had written down myself and not re-read after the numbers
moved. Prose asserting a measurement goes stale the moment the measurement is repeated; the review that
matters is the one that re-derives the claims rather than re-reading them.

## Run 43 — 2026-08-19 — the packing rollout: what could be retrained, and what could not

Run 41 fixed `tools/bilstm_training/tagger.py` but retrained only ckb. Rolling the fix out to the other nine.

**Five of the nine needed no code change** — nb, en, da, fr and af all sit on the shared core, so the Run 41
fix reaches them the moment they are retrained. Four are standalone and were patched the same way (sd, bn, he,
fa). ⚠ In bn and he the HELD-OUT pass was padded and unpacked too, so those languages' reported accuracies had
never described the served model; both are packed now, which changes what the number means as well as what the
model is.

**Data, not code, is the gate.** A retrain is only comparable if it runs on the corpus the committed artifact
was trained on:

| | corpus | on disk | retrained |
|---|---|---|---|
| af | `tools/afrikaans/af-g2p-data.tsv` (32.5k) | yes | ✅ |
| sd | `tools/sindhi/sd_tagger_data_marked.tsv` (9.3k) | yes | ✅ |
| bn | Google `language-resources/bn`, refetched → 60.0k rows | yes (rebuilt) | ✅ |
| fr | `src/languages/french/lexicon.tsv` (125k) | yes | ✅ |
| en | `src/languages/english/g2p-dict.tsv` (117k CMUdict) | yes | ✅ |
| nb | NST 199k dump (`/tmp/nb_train.tsv`) | **no** | ❌ |
| da | NST 199k dump (`/tmp/da_train.tsv`) | **no** | ❌ |
| he | `/tmp/hebrew_diacritized` corpus | **no** | ❌ |
| fa | homorich parquet → `homorich_ipa_clean.tsv` | **no** | ❌ |

⚠ For nb/da the committed `src/languages/*/[nd][ba]-lexicon.tsv` are the ~38k SHIPPING subsets, not the 199k
training dumps. Retraining on those would produce a different, smaller model and call it a bug fix. Left
alone, with the padding damage documented in the shared core rather than papered over.

**Protocol per language.** Measure the baseline by temporarily reverting the packing in that file, discard its
artifacts, restore packing, retrain, compare on the SAME split and seed. Only then export. ⚠ The first attempt
at af skipped the baseline and exported straight over the shipped model — restored from git and redone. A
retrain with no before-number is not a measurement.

**af — done. 90.5% → 92.0% whole-set held-out** (n=4,096, same md5 split, same seed), dictionary-gold subset
91.4% → 93.0%. ⚠ The baseline reproduced the committed 90.5% to the decimal, which is the check that makes the
pairing trustworthy: the difference is the packing and nothing else. +1.5pp, the same figure ckb saw.

**Every baseline reproduced its committed number to the decimal.** That is the check that makes each pairing a
measurement of the packing and nothing else — not a different seed, a re-fetched corpus, or a drifted aligner:

| | committed figure | baseline reproduction |
|---|---|---|
| af | 90.5% whole-set held-out | 90.5% |
| bn | 90.5% ɔ/o on 11,993 OOV | 90.5% |
| fr | 94.9% word-exact / 99.1% symbol | 94.9% / 99.1% |
| en | 68.4% word-exact (stress-independent) | 68.4% |

**⚠ bn's first pairing was CONFOUNDED and had to be redone.** Its held-out pass was padded-and-unpacked too,
so packing it changed the *measurement* at the same time as the model — 86.4% → 86.7% full-word conflates the
two. Re-run with training unpacked and the held-out pass packed to isolate the training effect. The lesson
generalises: when a fix touches both the trainer and the evaluator, the naive before/after measures their sum.

**Results — five retrained, every one better.** Paired on the same split and seed, baseline first:

| | metric | unpacked | **packed** | Δ |
|---|---|---|---|---|
| **en** | word-exact (stress-indep) | 68.4% | **71.5%** | **+3.1** |
| **sd** | slot accuracy (5-fold) | 78.3% | **80.3%** | **+2.0** |
| **af** | word-exact | 90.5% | **92.0%** | +1.5 |
| ckb | word-exact (Run 41) | 95.1% | 96.6% | +1.5 |
| **fr** | word-exact | 94.9% | **96.3%** | +1.4 |
| **bn** | full-word (both arms packed-eval) | 85.5% | **86.7%** | +1.2 |

**The effect size tracks how much of a language's signal sits at the END of the word**, which is what the
mechanism predicts and is worth stating because it makes the finding falsifiable. English leads because its
tag alphabet carries STRESS, placed by the suffix; Sindhi is next because 81.4% of its word-final slots are
the retained grammatical -ʊ, the whole reason its tagger beats always-ə; Bengali moves least because ɔ/o
raising is distributed through the word. No language got worse.

**Two artifacts were shipping stale and nearly stayed that way.** `fr_g2p_bilstm.py` and `en_g2p_bilstm.py`
export only fp32, but what ships is the `int8`. A retrain that ends at "[production] exported" leaves the
served model untouched — fr's int8 was still dated 25 July after a successful production run. Quantized
separately, 400/400 argmax parity against fp32 in both cases. ⚠ Anyone repeating this campaign must check the
mtime of the file the language actually loads, not the one the script prints.

**he and fa are patched but unrun**, their corpora being absent; nb and da are neither. The four keep the
padding damage, and the shared core now documents that at `Tagger.forward` so it is not rediscovered as a
mystery.

## Run 44 — 2026-08-19 — PR review of the rollout: what a green CI did not catch

**1. Two trainers were patched and CANNOT be run here, so nothing tested them.** he and fa have no corpus on
disk; their packing fix was committed on a reading, not a run. Extracted each `Tagger` by AST and exercised
`forward` directly against the shared core's invariant — padded-and-packed must equal the same word alone, and
unpacked must differ at the word end. All five standalone trainers pass. **This is now check 9 in
`smoke_test.py`**, so an edit to an unrunnable trainer is still verifiable; mutation-checked by reverting
Hebrew's packing, which fails it. A fix nobody can execute needs a test that does not need the corpus.

**2. `--set` clearing `ipa` SILENTLY DROPS THE ROW FROM SCORING.** Both `asr_align_report.py` and
`asr_align_label.py` filter `ipa IS NOT NULL`, so a cleared row does not error — it vanishes from the QC
corpus. That is the right failure mode (a wrong ipa is worse than none) but the wrong visibility, and it was
reachable only via an opt-in `--stale`. `stats()` now reports pending rows on every invocation, and `--set`
says the row is EXCLUDED rather than merely "re-derive it". Verified end-to-end on a copy of the DB: the
broadcast warning fires on exactly the pattern that caused the mt_mt defect.

**3. bn's `meta.json` stopped reproducing byte-for-byte.** Content identical — `src`, `tags` and `charTags`
all compare equal, which incidentally confirms the re-fetched Google corpus matches the original — but
`json.dump`'s default separators put a space after every `:` and `,`, inflating the shipped file 24%
(3,985 → 4,933 bytes) for zero semantic change. Minified in the exporter and the artifact restored to
byte-identical with `main`. ⚠ A rebuild that does not reproduce the committed artifact makes every provenance
claim about it unfalsifiable; the size drift was the only visible symptom.

**Method note.** All three were found by reading the diff for things CI cannot express: code with no possible
test, a change whose failure mode is silence, and an artifact whose bytes moved for a reason nobody stated.
Green CI answers "did anything I already test break", never "is this change sound".

## Run 45 — 2026-08-19 — the sweep was incomplete, the rider was retrainable, and the corpora were all findable

**Question, from the user: have we retrained all affected BiLSTMs?** No — and the survey behind that claim was
itself wrong.

**The first sweep searched for `*tagger*` trainers.** Re-grepping for `nn.LSTM(… bidirectional=True)` over a
padded batch finds four more SHIPPED models the rollout never touched: `km-segmenter`, the perso-arabic
`riderDiacritizer` (serves ur + pnb), `fa-vowel-restorer` and `fa-context-restorer`. Corrected count: **6 of
13 in-repo models**, not "all ten trainers". ⚠ The lesson is the search key: a naming convention is not a
type. Grep the construct, not the filename.

**And the two Arabic diacritizers are affected as well — their trainer is just in another repo.** Recorded as
"unknown" until the user pointed at `/mnt/data`, where the whole training rig turned out to be sitting:
`train.sh` drives `~/Programming/espeak-ng-portable/tools/diacritization/train_bilstm_sent.py`, with
`/mnt/data/ar-diac` (silver 320k, train 310k, val 5k) and `/mnt/data/arz-diac` (350k). That trainer is
bidirectional over a `pad_sequence` collate with `def forward(s, x)` — and ⚠ **its collate already returns
`torch.tensor([len(x) for x in xs])`, computed and then never passed.** The lengths were plumbed and dropped.
Since the rider is a direct descendant of this file, that is almost certainly where the entire family
inherited the defect, and it means the fix upstream is one line plus using the third tuple element.
Not applied here: it is another repository, and the rider warm-starts FROM the Arabic base, so the two must be
retrained in that order or the comparison is meaningless. Recorded in `tools/CORPORA.md` as a deliberate
follow-up rather than done as a side effect of a phonemizer PR.

**The rider was retrainable all along** — `train.tsv`/`eval.tsv`/charvocab are committed and the Arabic
warm-start sits in `$ARDIAC`. Retrained.

**And it reproduced the bn confound, this time reversing the sign of the conclusion.** The naive comparison
said the retrain was WORSE (best rider-DER 7.43% → 7.53%), because the DER pass is padded too and each arm was
scored under its own evaluator. Added `--eval-ckpt` to re-score a saved checkpoint without retraining, and
under the identical packed eval:

    unpacked training   RIDER-DER 8.18%   ur 8.85%  fa 7.67%  ps 17.58%
    packed   training   RIDER-DER 7.53%   ur 8.21%  fa 6.88%  ps 16.41%

A 0.65pp DER improvement, not a regression. End-to-end on `ur.cle-speech` (n=5,667): **2,319 → 2,342** exact
words, async-only-right 238 → 265, and the registry's async-beats-sync decision survives (41.3% vs 39.7%).
**Twice now the naive before/after has been not merely imprecise but sign-wrong.** When a fix touches the
evaluator, decompose or do not report.

**`export_onnx.py` wrote to a path the module left long ago** (`src/core/`), so a successful-looking export
produced two orphan files while the served model stayed untouched — the same shape as fr/en exporting fp32
while the int8 ships (Run 43). Third instance of "the script reported success on a file nothing loads".

**Every missing corpus was found in under an hour.** nb/da = NST (CC0, both archives checksummed), he =
Nakdimon `hebrew_diacritized` (MIT, permissive subset only), fa = HomoRich (CC0), km = a kmwiki dump (CC BY-SA).
Four models had been left carrying a known defect purely for want of a download URL. Now
`tools/CORPORA.md` + `tools/fetch_corpora.sh` (checksum-verified; tested end-to-end on da).

⚠ **Not committing the corpora, deliberately.** 280 MB+ raw, and `.gitignore` excludes two sources for
LICENCE reasons — the Urdu HF/Dakshina silver and the Khmer aakanee dictionary are CC BY-NC-SA. A blanket
"commit the training data" would push encumbered material to a public remote. The record of how to fetch and
rebuild is the substitute, and it is the thing whose absence actually cost us.

## Run 46 — 2026-08-19 — PR review: the rebuild doc's own command was wrong

Reviewing #843. The file's entire purpose is "follow this and you get the committed model back", so the review
that matters is checking each documented command against the script it invokes rather than re-reading prose.

**1. The nb rebuild command was wrong three ways, and would have shipped a worse model as a "reproduction".**

    documented:  NB_LEX=/tmp/nb_train.tsv .venv/bin/python -u tools/norwegian/train_nb_bilstm.py
    correct:     NB_LEX=/tmp/nb_train_stress.tsv NB_KEEP_STRESS=1 NB_SUBSAMPLE=0 …

`build_nb_data.py --train-out` defaults to `/tmp/nb_train_**stress**.tsv`, a path the documented command does
not name. `NB_KEEP_STRESS` defaults OFF and **nb's tag alphabet embeds ˈ/ˌ** — training without it yields a
tagger that cannot place stress at all. `NB_SUBSAMPLE` defaults to **150000**, roughly a quarter of the ~630k
lexicon. Every one of the loader's defaults is wrong for a production retrain, which is presumably why the
trainer's own docstring spells all three out — and why copying the *builder* invocation without the *loader*
environment was the easy mistake to make. The other five languages' commands were checked the same way and
are correct (da's `DA_LEX` default already matches `--train-out`; km's `train_km_segmenter.py` needs
`km-wordfreq.tsv` in its OUTDIR, which is committed).

**2. `fetch_corpora.sh` claimed a pin it did not enforce.** The he branch cloned HEAD and echoed the recorded
commit hash beside it — which reads like verification and is not. If upstream has moved, that rebuilds a
DIFFERENT corpus under instructions that assert reproducibility. Now checks the ref out (`HE_REF=HEAD` to opt
into current upstream deliberately). Verified: `hebrew_diacritized @ 1211c8f (pin checked out)`.

**3. Failure paths exercised rather than assumed.** Corrupted an archive → `CHECKSUM MISMATCH`, exit 1; unknown
corpus name → exit 2; no args → usage, exit 0. Also guarded the fa branch on `huggingface-cli` being installed
instead of failing inside the download.

**Method note.** A reproducibility document is executable prose, and the failure mode is that it looks right.
Three of the four defects across this and Run 44 were things that *read* correctly — a pin that was printed
not checked, a warning with the wrong number in it, a command with plausible defaults. Diff-reading does not
catch those; running them does.

## Run 47 — 2026-08-19 — the outstanding four, and three process traps

**Corpus recovery worked, and it validated the builders as well as the data.** All five corpora fetched and
rebuilt from `tools/CORPORA.md`. ⚠ Both NST rebuilds reproduce their SHIPPED lexicons byte-identically
(`da-lexicon.tsv`, `nb-lexicon.tsv`) — the strongest available evidence that the recovered corpus is the one
the repo was built from, and it settles whether recovery was even meaningful.

**Seven of nine baselines reproduced their committed figure**, nb to the individual word (56,456/62,838 =
89.8%), fa to 0.1pp (87.6 vs 87.7). km did not, and its unigram Viterbi CONTROL moved too (66.7 vs 66.8) —
the tell that a newer wiki dump changed the data rather than the model. he is measured on a rebuilt harness
(below).

| | metric | unpacked | **packed** | Δ |
|---|---|---|---|---|
| **da** | word-exact (19,831) | 73.1% | **78.7%** | **+5.6** |
| **km** | F1 (Viterbi 66.7 both arms) | 88.5 | **90.5** | +2.0 |
| **he** | modern-holdout word-exact | 87.7% | **88.7%** | +1.0 |
| **fa** | per-word (13,021) | 87.6% | **88.4%** | +0.8 |

Danish is the largest word-exact gain of the whole campaign, and its baseline was an exact reproduction, so
the delta is unusually well-founded. he's incumbent scores 87.9% on the same harness, so the packed model
beats what is deployed, and the unpacked arm's 87.7% confirms the rebuild reproduces the incumbent.

**⚠ TRAP 1 — `timeout` failures arrive as SUCCESSFUL background tasks.** nb's baseline reported "completed",
wrapper exit 0, while the inner command returned **124**: killed at 5,400s mid-phase-2, epoch 25 of 40. Caught
only because the export line was missing. Phase 1's number was already banked so nothing was lost, but a run
truncated this way is indistinguishable from a clean one unless the inner exit code is checked. nb rerun
unbounded — it is the heaviest job in the fleet (631k words, two trainings, two aligner passes) and, unlike
da/fr/en, has NO production gate, so phase 2 always runs.

**⚠ TRAP 2 — the fp32/int8 split bit a THIRD language.** da's production run printed
`exported → da-g2p-tagger.onnx` and looked entirely successful, but `danishTagger.ts` loads
`${basename}.int8.onnx`, still dated 25 July. Same as fr and en (Run 43). Quantized separately, 398/400 argmax
parity. **Three instances is a pattern, not three footnotes** — the trainer prints a success line naming a
file the runtime does not load.

**⚠ TRAP 3 — the held-out decode is single-word, single-core** (user's observation). `decode_chunks` runs one
word per call; nb's 62,838-word held-out pins one core at 100% while the GPU idles, and it is why nb alone
overran a budget every other language fit inside. ⚠ **Batching it is safe NOW and was not before**: a padded
batch used to change the answer, so a batched decode would have scored a different model than serving; with
`lengths` the packed batch is bitwise the batch-1 result, asserted by smoke check 8. The speedup is unlocked
BY the packing fix. Deferred deliberately — changing the evaluator mid-campaign is the confound that already
reversed two conclusions.

## Run 48 — 2026-08-19 — PR review of the final batch: an unrun code path and a doc that omits verification

**1. The nb quantization block had never executed.** It was added AFTER nb's export had already run, so the
committed trainer carried a path nothing had exercised — the same exposure as the he/fa trainers patched blind
in Run 43. Extracted lines 110–113 from the shipped source and executed them against a scratch directory:
int8 produced, fp32 removed, block correct. ⚠ A retrain-and-then-edit ordering silently produces untested
shipping code; the edit must be re-run or the block executed in isolation.

**2. `CORPORA.md` told you how to REBUILD but never how to VERIFY** — which is the precise gap that lost
Hebrew's harness in the first place. Every other language's trainer prints its own held-out number, so the
omission was invisible; he's does not measure what he is judged on. Added the explicit verification command
plus reference points (incumbent 87.9%, current 88.7%), and the warning that the trainer's per-consonant and
CLAUSE-exact figures are a bad proxy and a different metric respectively. **A reproducibility record that
stops at "train" is only half a record.**

**3. The nb section still named the fp32** as the artifact after the int8 switch. Corrected, with a note that
`.gitignore` and the `package.json` files-negation are a pair the packaging test enforces — that test is what
caught the half-done switch during the work.

**Also checked and clean:** km's `batches()` now yields three values and both of its consumers are in the same
file (no external caller); the fetch script still runs end-to-end after the `-type f` fix and prints the FILE
rather than the shadowing directory; nb's `meta.json` is byte-identical to the committed one (48 chars, 474
tags both), confirming the shipped model was already a phase-2 export.

**Method note.** Three of the last four review rounds found defects in things that READ correctly — a pin that
was printed not checked, a warning with the wrong number, a command with plausible defaults, and now a doc
whose omission was invisible because every other language happened not to need it. The reviews that pay are
the ones that execute the artifact rather than re-read it.

## Run 49 — 2026-08-20 — Arabic: the trainer comes in, the model does NOT ship, and four instrument failures

**The root-cause fix landed where it belongs.** `train_bilstm_sent.py` is now
`tools/arabic/train_ar_diacritizer.py`, packed at all three call sites. ⚠ Its `collate` has ALWAYS returned
`torch.tensor([len(x) for x in xs])` and all three sites already unpacked it as `lens` — plumbed end to end and
never passed, because `forward(s, x)` had no parameter for it. The rider is a direct descendant of this file;
this is where the fleet's defect originates. Covered by smoke check 9.

**Measured, with a consistent harness (matching vocab, matching `--pausal 1`):**

| | TEST DER | TEST WER |
|---|---|---|
| shipped checkpoint `bilstm_silver_only.pt` | 2.02% | 7.81% |
| my 25-epoch unpacked baseline | **2.02%** *(exact reproduction)* | 7.81% |
| + cosine tail, unpacked | 1.85% | 7.23% |
| + cosine tail, packed | **1.83%** | **7.20%** |

**Attribution: ~0.17pp from the SCHEDULE, ~0.02pp (noise) from the packing.** Arabic is the one language where
packing is not measurable, and the mechanism predicts it — a sentence-level model with `maxlen 400` has almost
no positions near the sequence end, where a 10-character word is nearly all "near the end" (da +5.6, nb +2.2).
The effect scales with how much of each input sits at the tail; the rider, also sentence-level, sat between.

⚠ **THE SCHEDULE FINDING IS THE USEFUL ONE, AND IT WAS AN A/B ARTEFACT FIRST.** At the 25-epoch cap the arms
read 2.02 vs 2.10 — "packing made Arabic worse" — because `ReduceLROnPlateau` is ADAPTIVE: each arm decayed on
its own timetable and the cap cut them at different LRs (1.3e-04 vs 2.5e-04) while this model's gains arrive AT
lr drops. Resuming both from the same epoch under an identical cosine anneal removed the confound and found
0.2pp neither arm had reached. Only two trainers in the fleet use an adaptive schedule — this one and the
rider, its descendant. The shared trainer uses `CosineAnnealingLR` precisely because it is deterministic.

**⚠ THE MODEL IS DELIBERATELY NOT SHIPPED.** Four reasons, in order of weight:
1. **int8 appears to cost ~0.9pp DER** (my export: fp32 1.83% → int8 2.74%, same harness and vocab). That
   would erase the entire gain. Needs its own investigation — the fleet is split between `QInt8` and `QUInt8`
   and nobody has ever scored a quantized artifact on a task metric.
2. **The committed `diacritizer.onnx` behaves as FULL diacritization** (3.63% DER at `--pausal 0`, 17.09% at
   `--pausal 1`) while its provenance and `train.sh` both say pausal. Unexplained; replacing it with a pausal
   model before understanding that is reckless.
3. The gain is ~90% schedule, so shipping it under "packing rollout" would credit the wrong cause.
4. My measurement harness was wrong twice in this run alone (below). That is not the footing for swapping a
   shipped model.

**FOUR INSTRUMENT FAILURES, all mine, all initially read as model defects:**
- `--eval-onnx` took the vocab from `--resume`: character ids are assigned in first-seen order, so the same 39
  characters carry different ids — 30 of 39 differed. The committed model scored **66.20% DER** and looked
  destroyed. Fixed to read the artifact's own sidecar.
- Even corrected it read 17.09%, which was the pausal/full mismatch above, not the model.
- The int8 gate measured **whole-sentence** argmax agreement over ~60 chars (65%) where the fleet's gates are
  per-word over ~10; per-character it is 98.5%. Same quality, unrecognisable number. And it scores
  `torch.randint` garbage rather than Arabic.
- A runtime gold-scoring harness read 0% sentence-exact because `test.txt` gold is full-diacritized and the
  model is pausal.

⚠ **THE CHECK THAT SETTLED IT COST ONE COMMAND AND I RAN IT FOURTH**: `phonemizeAsync` on three sentences
showed the shipped model producing *marħˈabaː bilʕˈaːlam*, *ðˈahab alwˈalad ʔlˈaː almadrˈasa* — obviously
healthy. **Run the product before debugging the metric.** A model-vs-model runtime A/B then showed the retrain
is 98.04% word-identical to the incumbent over 400 sentences, i.e. a safe drop-in whenever the int8 and pausal
questions are answered.

**Also corrected: the rider does NOT depend on this checkpoint.** `CORPORA.md` and PR #843 both claimed
retraining the Arabic base forces a rider re-warm-start. The rider warms from `bilstm_pausal.pt` (5 Jul); the
diacritizer derives from `bilstm_silver_only.pt` (12 Jul) — different files. Asserted from shared lineage,
never checked.

## Run 50 — 2026-08-20 — PR review of the Arabic import: three defects in the carried-over files

Reviewing #845. Copying a toolchain out of another repository is not a move — the files carry assumptions
about where they live, and none of them announce it.

**1. The exporter crashed AFTER all the expensive work.** No `makedirs` on `--dest`, so a fresh output
directory meant export + quantize + two parity sweeps completed and then `shutil.copy` raised
`FileNotFoundError`. The worst possible failure position: everything computed, nothing kept. Directory created
before the work now.

**2. `decode_ar_sent.py` had the packing bug too, and it is a MEASUREMENT script.** It pads batches with
`pad_sequence` and ran `forward(s, x)` unpacked, so the predictions it emits for scoring came from a
different computation than serving performs. Fixing the trainer while leaving the scorer unpacked would have
meant measuring the fixed model with a broken instrument — precisely the class of error this run already hit
four times. Packed.

**3. `train_ar.sh` still invoked the espeak-ng-portable path**, so the committed recipe would have trained
with the OLD unpacked trainer while the repo advertised the fixed one. Rewritten against the in-tree tools,
and ⚠ **the split reshuffle is now opt-in** (`RESPLIT=1`): the original began every run with
`shuf silver.txt > silver.shuf` and a fresh train/val/test, which silently changes the held-out set and makes
any retrain incomparable to the shipped model. That is the same mechanism that makes km's numbers
non-continuous, sitting unremarked at the top of the canonical recipe.

**Also:** `CORPORA.md` still described the trainer as living in another repo — stale the moment this PR moved
it — and its ar/arz driver row pointed at `/mnt/data/ar-diac/train.sh`. Both corrected, with the unresolved
int8 and pausal questions recorded where a rebuilder will meet them.

**Method note.** All three defects are the same shape: **an imported file's implicit context does not travel
with it.** A hardcoded sibling path, an assumption that the output directory exists, a scorer whose
correctness depended on a bug that was just fixed elsewhere. Nothing here was caught by reading the diff; all
three came from running the files in their new home.

## Run 51 — 2026-08-20 — Arabic ships, and the sixth instrument failure was the campaign's own bug

**Both blockers from Run 49 dissolved, and neither was what it looked like.**

**int8 costs 0.01pp, not 0.9pp.** fp32 1.83% / QInt8 1.84% / QUInt8 1.84% DER, scored ONE SENTENCE AT A TIME as
the runtime serves. ⚠ The earlier 2.73% came from `--eval-onnx` feeding PADDED BATCHES to a graph with no
packing — an unpacked BiLSTM over padding, **the exact defect this entire campaign exists to fix, reintroduced
inside the tool measuring the fix**. The shim accepted `lens` and ignored it, which reads as unremarkable code.
Having just fixed this in five trainers and written the invariant test for it did not help; the fault was
attributed to quantization type, label convention and vocab tables before the actual cause.

**The pausal difference is real but absorbed.** The deployed artifact predicts FULL diacritization (3.31% at
`--pausal 0`, 16.89% at `--pausal 1`); `diacritizer.ts::pausalize()` strips case endings downstream. A
pausal-trained model is therefore a valid drop-in — `pausalize()` is simply a no-op on it — which is why the
two agree on 98.04% of words over 400 real sentences.

**The comparison that decided it** — `tools/arabic/eval_ar_runtime.mts`, end-to-end through the runtime against
gold pausalized by a faithful port of `pausalize()`, 1,500 sentences / 32,018 words:

| | word-exact | sentence-exact |
|---|---|---|
| previous model | 85.10% | 11.9% |
| **retrain** | **85.53%** | **12.3%** |

+0.43pp, and the gap GREW from +0.27pp at 400 sentences while both metrics moved together. Shipped.
⚠ The first version of this harness read 0% because it scored pausal model output against UN-pausalized gold.
Both sides must go through the same transformation — the same discipline `eval_modern_holdout.ts` uses for he.

**A documentation defect found on the way, worth its own attention.** `diacritizer.PROVENANCE.md` names
`bilstm_silver_only.pt` as the source of the previously deployed model. That checkpoint is PAUSAL; the artifact
it shipped was FULL. They are different models, so **the previously deployed Arabic diacritizer was not
reproducible from the checkpoint its own provenance named.** Recorded in that file. The model now shipped is
reproducible: `tools/arabic/train_ar.sh`.

**Tally for the Arabic work: six instrument failures, zero model defects.** Vocab table, pausal convention,
wrong agreement unit, mismatched gold, padded-batch ONNX scoring, un-pausalized gold. Every one initially read
as the model being broken. The check that would have caught all of them cost one command —
`phonemizeAsync` on three sentences, showing the shipped model obviously healthy — and it was run fourth.

## Run 52 — 2026-08-20 — full vs pausal training: equivalent, and a retraction

**The question** (user's): does full diacritization + `pausalize()` give up anything against training pausal
directly? Run 51 asserted the full arrangement "spent capacity on syntax nobody consumes". That was an
assertion, so it was tested.

**Method.** A full-diacritization model under the BEST recipe rather than a mirror of the incumbent's —
packed, cosine 1e-3 → 0 across all 40 epochs, `--patience 99` so the anneal cannot be truncated, same split.
⚠ The user's steer here was right and worth keeping: *the best training method is the one to use regardless* —
matching a legacy recipe for the sake of symmetry would have handicapped the arm being tested.

**Result**, both arms scored in a single run through `eval_ar_runtime.mts`, 1,500 sentences / 32,018 words:

| | word-exact | sentence-exact |
|---|---|---|
| full (`--pausal 0`) | 85.57% (27,399) | 12.5% |
| pausal (shipped) | 85.53% (27,385) | 12.3% |

**14 words apart — equivalent.** ⚠ **RETRACTED: "capacity spent on syntax nobody consumes."** A model trained
on the harder target matches one trained directly on the served task, so the case endings are not wasted
effort. Neither are they a useful auxiliary signal at this scale. Both leanings favour full and both are
inside noise.

**Kept pausal for a MEASUREMENT reason.** Its DER scores only what survives `pausalize()`; the full model's
2.83% counts errors the runtime discards. Given equivalent output, prefer the model whose headline number
cannot be misread — this session lost hours to exactly that misreading.

**Mid-run checkpoints predicted the endpoint well.** At epoch 28/40 (val DER 3.07%, LR 2.1e-4) the full model
already scored 85.45% end-to-end, 0.08pp off its final 85.57%. `best_state` is written into the resume
checkpoint every epoch, so a long run can be interrogated cheaply rather than waited out — worth remembering
before committing to a full training cycle to answer a question.

## Run 53 — 2026-08-20 — the audible question, and an alternate kept rather than discarded

**User's question: would a TTS listener hear the difference between full and pausal?** Yes — **1.17% of words**
(145 of 12,350), about one word in 85. And not randomly distributed.

**A prediction that failed first, which is why the answer is trustworthy.** I expected the accusative ـًا to be
the audible class, because `pausalize()` has a special rule converting tanwīn fatḥ before alif into a fatḥa. It
is not: the **alif itself** supplies the /aː/ whether or not tanwīn is predicted, so that rule prevents a
doubled vowel rather than creating one. Five probes (`شكرا جزيلا`, `أهلا وسهلا`, …) were identical across both
models. The real class turned out to be **case marking on ATTACHED PRONOUN SUFFIXES** —
`wabiħaːrˈihaː`/`wabiħaːrˈahaː`, `wasufˈunih`/`wasufˈunah` — which survives pausalization precisely because it
is not word-final, plus vowel quality in names and loans.

**Which model is right on the contested words**, scored against pausalized gold:

    full right, pausal wrong : 54
    pausal right, full wrong : 42
    both wrong               : 49

56/44 — real but not decisive, and a third of the disagreements neither model gets.

**Decision: keep the shipped pausal model, PRESERVE the alternate.** The quality case is a wash (85.57 vs
85.53); the reason to prefer pausal is that its DER describes what serves, while the full model's 2.83% counts
case endings the runtime discards. But "equivalent overall" and "identical to the ear" are different claims,
and the second is false — so discarding the alternate would throw away the only thing that might separate them.
Kept at `/mnt/data/ar-diac/alt-full-diacritization/` with swap and rebuild commands, and feedback solicited
from `diacritizer.PROVENANCE.md` and the `ar` row of `docs/language-maturity.md`.

⚠ **Review step worth generalising: execute the instructions a user would follow.** The swap-and-revert was
run end to end (model loads, output correct, `git checkout` clean) and every flag cited in the alternate's
README was checked against the tools' actual `--help`. A documented procedure nobody has run is a guess.

## Run 54 — 2026-08-20 — the all-flagged queue, re-ranked; and one closed path re-walked

**Question.** After the elevated-median work (`docs/investigations/low_vowel_notation_investigation.md`),
turn to the all-flagged queue: 658 rows where every recording of a sentence is flagged.

### The queue is a TEXT-NORMALIZATION queue, and that is measurable

```
sibling        n     contains digits   contains symbol
all-flagged    658        39.7%             4.1%
exonerated    6444        26.7%             2.1%
no-sibling    1172        31.5%             2.8%
corpus       268098       21.3%             1.8%
```

All-flagged rows carry digits at **1.9× the corpus rate**. The de_de precedent (the year reading, the `°C`
rule) generalises: when several readers all disagree with one IPA string, the defect is upstream of the
phones.

### ⚠ I re-walked a closed decision — read the numeral-register docstring first

Measured that `ceb_ph` readers voice numerals in Spanish and English, `fil_ph` and `mi_nz` in English, with
a non-digit control at ~0% and `es_419` (18.1%) as the calibration ceiling. All of it is already in
`tools/corpus/numeral_register.mts` and run 19 of this document: **ceb / fil / mi / ig measured 84.8% /
62.3% / 63.5% / 66.8% and were DECLINED** because a third of their rows would get worse. Their all-flagged
queues are 71–92% digit-bearing *because of that decision*.

The docstring says so explicitly and I did not read it before measuring. It also already answered the
sub-question I thought was new — Cebuano's Spanish — since every candidate was scored against en, fr AND es.

### A ranking the queue did not have

Run 42 noted "the by-lift ordering is now misleading" and that the queue needs an examined mark. Raw row
count sends you into the largest queues, which are the known-clean and the known-declined. Ranking each
language's all-flagged mean against **its own median** separates them:

```
lang     rows  median  af_mean  excess  digit%
hr_hr      17   0.138    0.385    2.8×    41%    <- not examined
ln_cd      17   0.184    0.484    2.6×    76%    declined (numeral register)
ceb_ph     24   0.246    0.603    2.5×    92%    declined
el_gr       8   0.244    0.609    2.5×     0%    <- not examined, NO digits
mi_nz      15   0.243    0.607    2.5×    80%    declined
sn_zw       8   0.211    0.535    2.5×     0%    <- not examined, NO digits
bs_ba      11   0.157    0.372    2.4×    55%
hu_hu      12   0.280    0.667    2.4×     0%    <- not examined, NO digits
bn_in      31   0.289    0.674    2.3×    29%    CLEAN, investigated
```

An all-flagged row in a language whose baseline is *clean* is worth more than one in a language the
recognizer finds hard, and raw count does not show that. The three 0%-digit entries (el_gr, sn_zw, hu_hu)
cannot be the numeral story at all and are the most interesting unexamined rows in the queue.

### ⚠ The stored `ipa` column is STALE, and reading it directly misleads

`align.sqlite` holds `ellsworth → ˈellsʋortx` with a geminate. The current engine emits `ˈelsʋortx` — the
degemination was fixed after that pass. Any conclusion drawn from the stored `ipa` is a conclusion about
whatever the engine was that day. Re-phonemize before believing a row. (The nso and sw results in the
sibling investigations were verified end-to-end for exactly this reason; this queue reading was not, at
first, and one of the two Croatian "defects" evaporated on checking.)

### hr_hr examined — ⟨th⟩ → [tx] in foreign words

Croatian ⟨h⟩ is /x/, so ⟨t⟩+⟨h⟩ falls out as `tx`. Verified live against the engine:

```
the        -> txe          matthew    -> mˈatxeʋ
ellsworth  -> ˈelsʋortx    otthon     -> ˈotxon
```

Croatian adapts foreign θ as **[t]** (*teorija*, *matematika*), so `txe` is wrong. The recognizer agrees —
readers gave `ɛ l s w ø θ` for ellsworth and `d ə` for "the".

⚠ **But a blanket ⟨th⟩→[t] would break native words**, and the corpus contains them: `prethodno`,
`prethodnika`, `prethodnim` are `pred-` + `hod-`, where the two letters are separate phonemes across a
prefix boundary and `tx` is *correct*. Split over the whole hr_hr corpus:

```
distinct ⟨th⟩ words: 32   tokens: 136
  NATIVE (pret- prefix):   8 types,  29 tokens   prethodio, prethodna, prethodni, prethodnika, …
  FOREIGN:                24 types, 107 tokens   arthur, chatham, ellsworth, lufthansa, macbeth,
                                                 northern, smith, thomson, the, ninth, …
```

79% of ⟨th⟩ tokens are foreign. Fires on 120 of 3,459 rows (3.5%). **A fix needs a prefix guard, not a
grapheme edit** — the obvious rule is net-negative on 29 tokens of correct native output.

Two further hr_hr items seen but not sized: `xdr-tb → ksdr tb` where the reader spelled the letters
(*iks-de-er tuberkuloza*), and embedded English runs read with Croatian rules (`national superintendent of
the year → nˈational sˈuperintendent of txe ˈiear`). The second is a foreign-run-handler question, the same
shape as Swahili's `makeNativiser`, and is larger than a table fix.

## Run 55 — 2026-08-20 — the queue gets a memory, and IPA cannot be a payload

Run 54 re-walked a decision that was already made and documented. That is the second time the queue has
sent someone into finished work (run 42 found three of its top five already clean), and the cause is that
**the record lived in prose, not in the row**.

### `examined_clean`

Added to `asr_align_label.py`. It is the only status that means *a human looked* — `verified` is automatic
and only means "inside this language's own distribution", which is exactly what a uniformly-wrong language
looks like (nso_za: 1,989/1,990 verified, worst median in the fleet).

`--set` now validates against the documented vocabulary. It previously accepted anything, and the DB holds
`convention` with exactly one row — a real verdict and a typo are indistinguishable after the fact.
`--force-status` is the escape hatch, and it says to document the new value.

`--set` also gained `--sibling` / `--digits` so a bulk review verdict is reproducible through the tool
rather than ad-hoc SQL. Marks applied:

```
examined_clean     50   bn_in 31, hy_am 19      (run 42: read, no defect)
reader_divergence  57   ceb_ph 22, fil_ph 13, mi_nz 12, ig_ng 10, +existing
                        (digit-bearing all-flagged only — the declined numeral register)
```

`fr_fr` matched 0: its all-flagged rows were re-screened to `exonerated` since run 42, and its 20
`reader_divergence` + 2 `defect` verdicts were already recorded. The run-42 table is stale, which is the
argument for the column.

### ⚠ IPA in `read_text` does not pass through — measured, and it fails SILENTLY

`numeral_register.mts` records this from one direction (`fˈɔːɹ` came back as *f o*). Confirmed across ten
languages with `naɪntiːn fɔːɹti faɪv`:

```
ceb  nˈanti n fˈo tˈi fˈab      mi   nˈaɪnti n fˈɔ ɹtˈi fˈaɪv
hr   nˈanti n fo ti faʋ         en   naɪnti ˈɛn fɔ ɹti fˈaɪv
sw   naˈn̩ti ˈn̩ fˈo tˈi fˈav      xh   nˈaːntʼi n fˈɔː tʼˈiː fˈaːv̤
```

**Not one passed through.** Length marks and `ɹ` are absorbed, and the stray `n` becomes a syllabic nasal
in the Bantu engines. The output still *looks* like IPA, so nothing in a corpus dump reveals the
corruption. `read_text.py --set` now refuses it.

⚠ **And the guard had to be narrowed before it was right.** The first version listed "IPA-looking"
characters and refused three legitimate orthographies on the first test: Maltese `fid-disgħa` on ⟨ħ⟩, Ewe
`ɖeviɖu ƒe ŋkɔ` on ⟨ŋ ɔ ɖ⟩, Azerbaijani `səkkiz` on ⟨ə⟩ — including the exact Maltese hand-reading the
README documents. The guard is now suprasegmentals and modifier letters only (`ˈ ˌ ː ˑ` tone letters, tie
bars, superscripts), which carry no orthographic duty in any script and appear in every IPA string the
fleet emits.

### What `read_text` can and cannot carry

| the reader… | vehicle |
|---|---|
| chose a different wording in the same language (Maltese *fid-disgħa nieqes kwart* for `8:46`) | `read_text` — works today |
| voiced a numeral in another language | **neither** — `read_text` makes the host re-read the spelling (`mi` passes `nineteen` through as raw letters), and the segment path in `numeral_register.mts` is per-LANGUAGE, not per-row |
| said something with no orthographic form at all | nothing — mark `reader_divergence` and let the row be excluded |

The middle row is the open gap, and it is exactly why ceb/fil/mi/ig were declined: their register is a
per-ROW fact and the table can only express a per-LANGUAGE one.

## Run 56 — 2026-08-20 — code-switch spans, and the re-derivation that never existed

**Question.** Run 55 established that a reader who switches LANGUAGE has no vehicle: `read_text` makes the
host re-read the spelling, IPA is destroyed on re-parse, and `numeral_register.mts` is per-language. Build
the per-row form.

### `{en:nineteen forty five}`

`tools/corpus/code_switch.mts` parses inline spans into the same `Segment` shape the numeral register
already emits — text and a language, never phones — and host text still passes through the register.

The constraint that shaped it: **a span carries text so the row keeps testing the phonemizer.** Hand-written
IPA would make a row permanently unfailable, which is worse than a wrong row because it is a wrong row that
looks right forever. Nine unit tests, including the global-regex statefulness trap that has bitten this
campaign twice.

### The contract that was documented and unimplemented

`read_text.py` says "ipa is derived from read_text", `--set` clears `ipa` so the gap is visible, and
`--stale` LISTS the rows awaiting re-derivation. **Nothing re-derived them.** `phonemize-fleurs.mts` cannot:
it reads the FLEURS TSV and never sees a hand `read_text`.

Measured on export: **2 rows were parked** — the two this change created. ⚠ A first draft of this entry
said five, three of them pre-existing and silently excluded. Wrong: the three Maltese hand rows carry an
`ipa` and score normally. The `5` came from the `--stats` line (total hand rows), read as if it were the
pending count.

`rederive_read_text.mts` + `read_text.py --export-pending / --import-ipa` closes it. The import only fills
`ipa IS NULL`, so re-running it cannot restate a scoring row from a stale export.

⚠ **The FLEURS→registry code map is now EXPORTED from `read_text.mts` rather than copied.** Its own comment
says the passes must agree about which engine read a language; a second copy is how they stop agreeing.
Four codes are not a prefix split (`ar_eg→arz`, `fil_ph→tl`, `ny_mw→nya`, `es_419→es-419`), and the first
run of the new tool failed on exactly this — `no phonemizer registered for "ceb_ph"`.

### End-to-end, on two real rows

```
text       … kaniadtong 1945 ug nagpabilin hangtod 1958
read_text  … kaniadtong {en:nineteen forty five} ug nagpabilin hangtod {en:nineteen fifty eight}
ipa        … kaniʔˈadtoŋ nˈaᶦntˈiːn fˈɔːɹt̬i fˈaᶦv ʔˈuɡ naɡpabˈilin hˈaŋtod nˈaᶦntˈiːn fˈɪfti ˈeᶦt

15654683974721888057   0.6634 -> 0.2727   (-0.3907)
2887141455778020347    0.6716 -> 0.3521   (-0.3195)
```

The Cebuano engine read the Cebuano and the English engine read the span. Being per-row, this costs the
two-thirds of ceb rows that read natively exactly nothing — which is the difference between this and the
register table that was declined.

### ⚠ And a second wrong reading, caught in review

Those three Maltese rows then looked stale on inspection — `read_text` says `fid-disgħa`, `ipa` says
`fɪt dɪsa`, which reads as a hybrid of the original `fit-8:46` and the hand reading. It is not. Maltese
devoices the assimilated article: `phonemize("fid-disgħa", "mt")` **is** `fɪt dɪsa`. Re-deriving all five
hand rows changed nothing.

That is twice in two runs that reading the stored `ipa` produced a defect that was not there — run 54's
Croatian geminate was the other. **Run the engine before believing a mismatch.** Recorded at the site.

⚠ **A third reading of the same row, also wrong, and the audio settles it.** If `text` has `fit-8:46` and
`read_text` has `fid-disgħa`, is the `fid` a slip by whoever authored the reading? No — the Maltese article
assimilates to the word actually spoken, and changing *tmienja* (t-initial, `fit-`) to *disgħa* (d-initial)
obliges `fid-`. The hand reading is right.

Which then raises whether OUR `fɪt dɪsa` is right, since an assimilated article is normally a geminate
([fɪdˈdɪsa]) rather than a devoiced separate word. The three readers of this sentence:

```
reader 1   f i t   d i s a       devoiced      <- our output
reader 2   f e d d i s a         voiced + geminated
reader 3   f i t   d e s a       devoiced
```

2 of 3 devoice. Our rendering is the majority reading and there is no defect. The row looked wrong three
times and was right three times — each time because a plausible inference was made from stored text
instead of from the engine or the audio.

`--export-hand` / `--import-ipa --overwrite` were added during that diagnosis and are kept on the sound
part of the reasoning: a hand row's IPA goes stale whenever the engine changes, `ipa IS NULL` does not
catch that, and re-deriving a hand row is unconditionally correct.

**Not done:** the other 45 marked `reader_divergence` rows in ceb/fil/mi/ig. Each needs a human to read
what the recognizer heard and write the reading; the mechanism is in place and the rows are marked.

## Run 57 — 2026-08-20 — Croatian ⟨th⟩, with the guard the obvious version needs

Run 54 found `the → txe`, `Matthew → mˈatxeʋ` in `hr`: Croatian ⟨h⟩ is /x/, so ⟨t⟩+⟨h⟩ falls out as an
impossible `tx`. Croatian adapts foreign /θ/ as **[t]** (*teorija*, *matematika*, *atletika*), which is the
same evidence class the existing ⟨q w x y⟩ fold already uses — the readings the orthography writes when it
adapts the spelling.

⚠ **The blind version is net-negative.** Native ⟨th⟩ is a PREFIX BOUNDARY — `pred+hod` → *prethodni*,
`pod+hraniti` → *pothranjenost*, `pod+hlađen` → *pothlađenost* — where the letters are separate phonemes
and `tx` is correct. Counted over the sr/hr/bs corpora:

```
NATIVE (prefix + h)   104 tokens   prethod* ×13 forms, pothranjenost, pothlađenost
FOREIGN               167 tokens   arthur chatham ellsworth lufthansa macbeth north
                                   northern smith thomson the ninth parenthood …
```

The guard checks the prefix at WORD START and immediately before the ⟨h⟩ (`pret|pot|ot|nat`), which admits
every native token in the corpora and no foreign one. It will be wrong on `Othello`/`otherwise` — recorded
at the site rather than papered over; a root list (*hod, hran, hlad, hvat*…) is fragile the other way.

**Measured on the rows that contain a foreign ⟨th⟩:**

```
bs_ba   52 rows   mean 0.2009 -> 0.1937
hr_hr   90 rows   mean 0.2280 -> 0.2244
sr_rs    8 rows   mean 0.1855 -> 0.1852     (Cyrillic — barely any Latin ⟨th⟩)

per-row: 128 closer / 17 further / 5 unchanged      7.5:1
```

7.5:1 clears the 4.6:1 bar the ⟨ʔ⟩ decision was held to. Fleet medians move as expected for a fold touching
3.5% of rows: hr 0.1375 → 0.1368, bs 0.1571 → 0.1565, sr unchanged. All 171 referee floors pass.

⚠ **It lives in `foreignLetters` in the SERBIAN module**, which hr/bs/sr all call — the fold is a spelling
rewrite applied per word before nativisation, so `phonemizeWord` stays byte-identical for its three callers.

One gold assertion moved: `test/croatian.test.ts` pinned `Ellsworth → ˈelsʋortx`, where the `tx` was
incidental to a degemination test. Now `ˈelsʋort`, with the fold and its guard pinned in their own test.

## Run 58 — 2026-08-20 — the 45 reader-divergence rows, authored per row

Run 56 built the `{code:…}` span and left the marked rows. This applies it, and the method is the point:
**the register is chosen per row from that row's own audio**, not asserted.

**Procedure.** For each marked row, generate the whole-row candidates — host unchanged, every plain cardinal
or year wrapped `{en:…}`, the same `{es:…}` — phonemize each through the segment path, score against the
stored recognizer output, and accept the best only if it beats the host reading by ≥0.02. Clock and decimal
shapes are refused outright, exactly as `numeral_register.mts` refuses them: a shape whose correct reading
is not implemented scores well for the wrong reason.

```
57 candidate rows
  35 accepted     ceb 10 en + 2 es · fil 9 en + 1 es · ig 8 en · mi 5 en
   4 kept host    the reader used the host language after all (fil ×3, mi ×1)
  18 no candidate clock / decimal / grouped shapes the register declines
```

⚠ **Cebuano splits 10 English to 2 Spanish, and Filipino 9 to 1.** That is the per-language table's failure
made concrete — no single register answers for the language, which is exactly why run 19 measured
ceb/fil/mi/ig at 62–85% and declined them. A per-row fact needs a per-row vehicle.

⚠ **Four rows kept the host reading and were left alone.** The screen has to be able to say no, or it is
not evidence — those readers voiced the numeral natively and their rows are already right.

**Result, over the 37 hand rows now carrying a span (35 + the two from run 56):**

```
ceb_ph  14 rows   mean 0.5949 -> 0.3629
fil_ph  10 rows   mean 0.5602 -> 0.3374
ig_ng    8 rows   mean 0.6345 -> 0.3738
mi_nz    5 rows   mean 0.6075 -> 0.4042

all 37  mean 0.5958 -> 0.3640   median 0.5968 -> 0.3488   37 closer / 0 further
```

Example, with both registers in one corpus:

```
text       natukod ang relihiyon sa ika-15 nga siglo ni guru nanak 1469 …
read_text  natukod ang relihiyon sa ika-{es:quince} nga siglo ni guru nanak {es:mil cuatrocientos sesenta y nueve} …
```

⚠ **THE DATA LIVES IN `align.sqlite`, NOT IN GIT.** This entry and the tooling are the repository's record
of it; the 37 `read_text` values and 35 re-commented verdicts are in the corpus database. Re-running the
authoring pass is not idempotent-by-accident — it reads `status='reader_divergence' AND sibling='all-flagged'`
and the accepted rows are now `read_text_src='hand'`, which the auto pass skips.

**Still open:** the 18 declined rows. They need a clock and decimal reading in the register language —
`numeral_register.mts` already quantifies that opportunity at ~115 rows across the five wired languages, and
these add to it.

## Run 59 — 2026-08-20 — the all-flagged queue, re-ranked; and a Latin-acronym hole

With `examined_clean` / `reader_divergence` now marked, the queue re-ranks by excess over each language's
own median. The three highest with **0% digit-bearing rows** — el_gr 2.5×, sn_zw 2.5×, hu_hu 2.4× — cannot
be the numeral-register story, so they were read first.

### The finding: `ucla`

Greek, `…κέντρο ρόναλντ ρήγκαν του ucla όπου…`

```
ours    … ɾiŋɡan tu ˈuːklæ opu …          the WORD
heard   … ɾeɪɡʌntʊ ɣuːsiːɪlleɪ opʊ …      the LETTERS — "yoo see el ay"
```

The reader spelled it, in **English** letter names (not Greek *ipsilon-si-lamda-alfa*). And the engine
already knows how: `phonemize("UCLA", "el")` is **`ʝu si el ei`** — English letter names in Greek phonology,
which is what the reader said. **Only the casing was missing.** FLEURS lowercases (0 rows corpus-wide
contain `UCLA`), and `restoreInitialismCasing` had no entry for it.

Added to `INITIALISM_UPPERCASE` — the first entry justified on AUDIO rather than the casing differential,
and it needed to be: `ucla` is perfectly pronounceable, so `isUnreadableEnglish` declines it and the OOV
g2p produces the word. Spread is 22 languages / 37 tokens, clearing the list's documented ≥4 bar.

```
el_gr  0.5484 -> 0.5220     th_th  0.5188 -> 0.4783
el_gr  0.8831 -> 0.6709     th_th  0.3577 -> 0.3239
```

### ⚠ The negative result: the list cannot be extended on audio in general

Scanned every lowercase Latin run in the non-Latin-script corpora, took the 60 with the widest
cross-language spread, and scored word-reading against spelled-out over 118 row comparisons.

```
run     better worse   Δmean   langs        run     better worse   Δmean
jas       3     0    +0.0123    1           minae     3     3    -0.0076
il        3     0    +0.0096    1           zmapp     2     4    -0.0031
dna       3     1    +0.0146    1           of        0     3    -0.0093
add       3     1    +0.0134    2           de        0     4    -0.0041
```

Effect sizes of ±0.01 on three or four rows are the recognizer's noise floor — compare the numeral work
(0.5958 → 0.3640) or nso's vowels (0.6647 → 0.2763). **The audio cannot adjudicate a one-token change
inside a long sentence at these sample sizes.** `ucla` is the exception because 22 languages × the same
FLEURS sentence gives repeated evidence and the effect reached −0.21 on one row.

The spread test alone is also useless here: FLEURS is PARALLEL, so every brand name appears in 20+ corpora
too — `ebay` 31 languages, `yahoo` 27, `apple` 24, `google` 21. 843 runs clear ≥4 languages. The docstring
already says a phonotactic test fails in both directions; so does spread, on its own.

### ⚠ The bigger hole: 4 of 26 non-Latin-script languages spell Latin acronyms at all

```
spells out (4):   el th ja ko
reads as an English WORD (22):  ru bg uk he ka hy ta mr ne ar fa ur hi bn te kn ml si my km lo am
```

`core/initialisms.ts` declines a PRONOUNCEABLE acronym by design — "the existing OOV g2p already produces
that word, so this pass gets out of the way". That is right for a Latin-script language, where the OOV g2p
is the host's own. For a non-Latin-script language it hands the token to **English**: `UCLA` → `ˈuːklæ`,
`internet` → `ˈɪntɚnˌɛt` with `ɚ`, inside a Russian or Hebrew stream.

Greek found this independently and fixed it locally — `greek/normalize.ts` opens with it: *"the all-caps
initialisms have to be claimed, or `το FBI` reads with ENGLISH phonemes in a Greek stream (to ˈɛfbˈiːʲˈaᶦ)
and `η UNESCO` comes out carrying ɪ ʊ ɹ ʃ d͡ʒ æ ɫ."* 2,084 rows across 41 non-Latin-script corpora contain
one of the 90 already-listed initialisms.

⚠ **And it is context-dependent, so the casing fix does not reach everyone.** Japanese spells `UCLA` in
isolation (`jɯᵝːɕiːe̞ɾɯᵝe̞ː`) but embedded in a Japanese sentence still emits `ˈuːklɑː`. The two ja rows
moved 0.0000. Not chased further here; it is the same shape as the Greek hole, one layer in.

### Tooling gap found by using it

`read_text.py --apply` did not clear `ipa` when the derived text CHANGED — only `--set` did. Adding `ucla`
to the repair list therefore rewrote 135 rows' `read_text` to carry `UCLA` while their `ipa` still said
*ˈuːklæ*, and **nothing detects that**: `--stale` only finds `ipa IS NULL`. A wrong IPA that scores is
worse than an absent one that does not. `--apply` now clears `ipa` on change, and reports the count.

### Run 59b — the repair applied corpus-wide

`--apply` had only been run for the four languages measured, so the rest of the corpus still held the old
reading. Full pass: **125 rows changed, `ipa` cleared** (the fix above working as intended), re-derived.

Listed-initialism repair coverage across the whole corpus: **16,840 / 16,861 = 99.9%.**

⚠ **Count and magnitude disagree, and magnitude is right.** Over the 131 `ucla` rows, 23 moved: **12 closer
/ 11 further**, which reads like a wash. It is not — the wins are an order of magnitude larger:

```
nso_za -0.3571   nso_za -0.2446   el_gr -0.2122   th_th -0.0405   th_th -0.0337   el_gr -0.0264
bg_bg  -0.0234   he_il  -0.0137   zu_za  -0.0130  vi_vn -0.0113   zu_za  -0.0104  xh_za -0.0024
xh_za  +0.0407   om_et  +0.0126   vi_vn  +0.0098  sk_sk +0.0094   cs_cz  +0.0088  sl_si +0.0087
ckb_iq +0.0082   sl_si  +0.0080   ckb_iq +0.0077  fr_fr +0.0053   fr_fr  +0.0051

gained 0.9887   lost 0.1245   = 7.9:1
```

7.9:1 clears the 4.6:1 bar the ⟨ʔ⟩ decision was held to. The losses are Latin-script languages whose
readers said the word rather than the letters — real, small, and the price of a per-corpus repair list
where the reading is per-reader.

⚠ **The 21 remaining unrepaired occurrences are all CORRECT declines**, which is the useful part:

```
tr_tr hiv/fbi/mri · az_az mri   the TURKIC rule the module documents — Turkish does not uppercase ⟨i⟩→⟨I⟩
az_az  i̇rs                      a real Azerbaijani word (heritage); the scan matched inside it
yo_ng  ìwọ̀nba                   a real Yoruba word; likewise
he_il  utcּ+1                    a combining dagesh breaks the word boundary — 3 occurrences, a genuine edge
```

Only the Hebrew one is a miss, and it is 3 rows behind a combining mark.

## Run 60 — 2026-08-20 — the three "unrepaired" cases, and two of them were mine

### tr_tr / az_az — NOT a defect; my scan was wrong

The Turkic entry does not decline to uppercase. It uses `toLocaleUpperCase("tr")`, which maps ⟨i⟩→⟨İ⟩,
because plain ⟨I⟩ is the capital of ⟨ı⟩ — a different vowel. The repair had worked all along: **`HİV` ×2
and `MRİ` ×4 are in `read_text`.** My coverage scan searched for the naive `w.upper()` (`HIV`, `MRI`) and
counted its own bug as a corpus gap. Real coverage is 16,861/16,861.

The engine agrees with the locale, and does the right thing on both sides of the pronounceability line:

```
tr  HİV  -> hˈiv           the WORD, and hˈiv not hˈɯv — the dotted capital survived
tr  FBİ  -> fˈe bˈe ˈi     the LETTERS, in Turkish letter names
az  MRİ  -> ˈem ˈeɾ ˈi     the LETTERS, in Azerbaijani letter names
az  mri  -> mɾˈi           lowercase reads as a word — the casing is doing the work
```

### az `i̇rs` — correct as it stands, and the combining dot is already handled

`i̇rs` is ⟨i⟩ + COMBINING DOT ABOVE — the Unicode default lowercase of ⟨İ⟩, so the source was capitalised.
But in context (*maddi i̇rs üzrə*, "on material heritage") it is the Azerbaijani WORD, not an acronym, and
the engine reads all three spellings identically: `i̇rs`, `irs`, `İRS` → **`ˈiɾs`**. Nothing to fix; the
capitalisation marker is not by itself an acronym signal, since a sentence-initial or title-cased word
carries the same dot.

### he_il `utcּ+1` — a real boundary bug, at TWO layers

`utc` + HEBREW POINT DAGESH (U+05BC) + `+1`. A stray Hebrew mark on a Latin run, and `\p{M}` cannot tell it
from a diacritic that belongs there — so the trailing lookahead refused the token in **both** matchers:

- `initialism_casing.mts` left it lowercase, so the repair never fired;
- `core/initialisms.ts` refused the run even when uppercased, so `UTCּ+1` still read as the word *ˈaᶷt͡ʃ*.

Both now bound on the Latin combining-diacritic blocks only (U+0300–036F, 1AB0–1AFF, 1DC0–1DFF, FE20–2F),
from a SINGLE exported `LATIN_MARK` in `core/initialisms.ts` that the corpus tool imports — the same
boundary written twice is the drift this file warns about elsewhere. `INITIAL_RUN` (the dotted `U.S.A.`
form) took the same bound, since it had the identical lookbehind.
A Hebrew point, an Arabic harakat or a Devanagari matra after Latin letters is ADJACENT, not attached; a
decomposed `MRI`+U+0301 is still refused, which is what the boundary exists for.

```
he  UTCּ+1  ˈaᶷt͡ʃ ʔaχat  ->  jˈuː tʰˈiː sˈiː ʔaχat
```

No regressions on the cases the module documents: `NASA→nˈæsə` (word), `MRI→ˌɛmɑːɹˈaᶦ` (letters),
`США→ɛs ʂa a` (the Cyrillic case this boundary was written for), `A380` intact. 4,912 tests green.

⚠ **The audio does not confirm a benefit here**: the 5 he rows move −0.0010, −0.0021, +0.0041, 0, 0. This is
a correctness fix — a token was being silently refused — not a measured win. Recorded as such.

### Open: the default for a PRONOUNCEABLE uppercase Latin run

`core/initialisms.ts` spells out only what `isUnreadableEnglish` rejects, deferring everything else to the
OOV g2p. That is an **English phonotactic test deciding what a Turkish or Greek reader does with foreign
letters**, and the evidence so far says readers spell them: the Greek reader spelled `ucla` (7.9:1 by
magnitude once repaired), and `tr UCLA → ˈud͡ʒɫa` is the same shape unmeasured.

Inverting the default — in a non-English host, spell an uppercase Latin run unless the host's own lexicon
has it as a word — is defensible and is what `NATO→natˈo` in Turkish would have to survive. It is a
fleet-wide change to 190 engines and needs its own measurement pass.

**→ Measured and REJECTED at 0.11:1** — see `docs/investigations/uppercase_latin_default_investigation.md`.
The losses are one token: `UN`, the Romance indefinite article, ×802 in Italian alone. It sits on the repair
list safely precisely BECAUSE a pronounceable run falls through to the word reading, so inverting the
default deletes the property the casing list is built on. The same entry also withdraws the framing of the
English fallback as a defect: the Greek reader spelled `ucla` with ENGLISH letter names, so routing Latin
material to English is what the readers themselves do.

## Run 61 — 2026-08-20 — the queue after the fixes, hu_hu triaged, and a COARSEN entry

**Housekeeping first.** The ⟨th⟩ fold and `ucla` changed the ENGINE, which the `read_text` machinery does
not notice — only text changes clear `ipa`. Cleared and re-derived the 252 affected sr/hr/bs rows, then
`asr_align_label.py --apply`. **Flagged 8,274 → 8,167, all-flagged 658 → 549**: 107 rows left the tail
because the fixes landed. Hand verdicts survived, as designed.

### hu_hu — examined, recognizer artefact

12 rows / 6 sentences at 2.4× its own median, 0% digit-bearing. No systematic class:

```
top substitutions   a>ɛ 2.4%   ɛ>ə 1.6%   o>ʊ 1.5%   ɔ>ə 1.3%   r>ɾ 1.1%      — diffuse
DELETIONS           37% of all non-matching ops, spread over l ɔ r t o ɛ a k   — no class
phone-count ratio   recognizer/ours 0.77 on these rows vs 0.95 for hu_hu overall
```

The recognizer returned about a fifth less than we emit and dropped material broadly. Marked `artefact`.
`sn_zw` (0.96 vs 0.97) and `el_gr` (0.90 vs 0.94) do NOT show this, so it is not a general property of the
all-flagged class.

### ⚠ A retraction: `c` is NOT unhearable

Chasing Hungarian ⟨ty⟩=/c/, a raw count said the recognizer writes `c` **zero** times against our 44,509 —
which would meet the COARSEN bar outright and contradict the docstring's flat rejection ("corpus-wide the
recognizer writes `c` 10,292 times … a fifth, not a hundredth"). Both databases agreed on zero, so the
docstring looked stale.

It is not. **The recognizer writes `ç` — 12,288 times — and `fold()` NFD-normalises it to `c`.** The
docstring measured folded units, which is the correct unit for a COARSEN decision; I measured the raw
column. The rejection stands.

Third time this session that reading a raw column produced a defect that was not there (stale stored `ipa`
twice, now raw-vs-folded). **Measure on the units the decision operates on.**

### `ɀ` → `ʒ` — a COARSEN entry that does meet the bar

Measured properly, on folded units:

```
sym    ours    recog   langs
ɀ      4394        0        0      <- not in COARSEN
ʑ     12664        0        0         already in COARSEN
ɓ     35192        0        0         already in COARSEN
```

`ɀ` is Shona's whistled sibilant (⟨zv⟩ → `ɀin̤u`), emitted by **sn_zw only**, and the recognizer has no
symbol for it. Target chosen by measurement:

```
ɀ -> ʒ    median 0.2157 -> 0.2000   1215 closer /    6 further   <- taken
ɀ -> z              -> 0.2127        460 closer /   33 further
ɀ -> s              -> 0.2143        291 closer /   46 further
ɀ -> zw             -> 0.2212        296 closer / 1345 further
```

**sn_zw language median 0.2105 → 0.2000, mean 0.2242 → 0.2142.** No other language can be affected —
provable, since only sn_zw emits it and the recognizer's count is zero.

⚠ **It merges a contrast**, the cost `ɒ` records for Danish: Shona emits both `ɀ` (4,394) and `ʒ` (821), so
a row writing one where the other belongs now scores as a hit. Accepted on the same grounds — with the
recognizer at zero the comparison could only penalise the symbol, never judge it.

### Still open in sn_zw

Three of its four all-flagged sentences are **English code-switching** — *maslow's hierachy of needs
theory*, *virgin … northen rock … asset management* — read with Shona rules, producing `neeɗs` with a
Shona implosive and `theorj`. That is what `{en:…}` spans are for; not authored yet.

## Run 62 — 2026-08-20 — Shona code-switching, and the line between a switch and a loanword

Run 61 left three `sn_zw` all-flagged sentences reading English with Shona rules — *maslow's hierachy of
needs theory* → `θeorj`, *needs* → `neeɗs` with a Shona **implosive**. `{en:…}` spans are the mechanism.

### The mechanism needed one addition: TIGHT joins

Shona takes English stems under its noun-class prefixes — `maneutron`, `nezveasset` — so a span is not
always at a word boundary. Written `ma{en:neutron}` and joined on a space, that gives `ma nˈuːtɹɑːn`,
inventing a word break the speaker did not make. ⚠ **The distance metric strips whitespace, so it would
never have shown up in the score** — a trainer reading the IPA would simply see two words.

Adjacency is already in the source (the span either touches the previous character or it does not), so
`codeSwitchSegments` now marks such a segment `tight` and the re-derivation joins it with no space.

⚠ **The numeral register had the same gap and it was invisible for the same reason.** `numeralSegments`
PARTITIONS the host text, so a space between its segments lives inside one of them and is lost when
`phonemize` trims — xh `ngo1956` rejoined as `ngo 19 56`. Now flagged the same way. Seven shapes pinned in
`test/code-switch.test.ts`, including a span abutting a span and a digit glued to a host word.

### ⚠ And then the measurement said not to use it here

Wrapping the prefixed stems as well as the standalone English:

```
sid 559   0.5490 -> 0.5842  +0.0351      sid 153   0.5163 -> 0.5733  +0.0570
sid 559   0.4757 -> 0.6078  +0.1321      sid 153   0.6623 -> 0.6954  +0.0330
sid 1184  0.5099 -> 0.3669  -0.1430      sid 1184  0.4830 -> 0.3630  -0.1200
```

The standalone English phrases win big; every prefixed stem loses. The reason is in the recognizer output:
the reader says **`maɲuːtrɔn`** — a Shona palatal `ɲ` on an English stem. That is a **nativised loanword**,
not a code-switch, and neither a pure-Shona nor a pure-English rendering captures it.

**So the span is for code-switching, not for loanwords**, and the two are not distinguishable by looking at
the orthography — only by what the reader did. Standalone English only:

```
sid 1184  0.5099 -> 0.3669      sid 559  0.5490 -> 0.5098      sid 153  0.5163 -> 0.5033
sid 1184  0.4830 -> 0.3630      sid 559  0.4757 -> 0.4951      sid 153  0.6623 -> 0.6623

mean 0.5327 -> 0.4834     gained 0.315  lost 0.019  = 16:1     all three sentences net positive
```

Applied to both recordings of each sentence — `read_text` is a property of the text — and marked
`reader_divergence` with the loanword exclusion recorded in the comment so it is not re-tried.

**The general rule, for the next language:** an English run that stands alone is a candidate for a span; an
English stem carrying host morphology is a loanword the host engine should keep. The corpus can tell them
apart, the orthography cannot.

## Run 63 — 2026-08-20 — `es_419` is not Latin American

`es_419` has the fleet's best median (0.082), so its all-flagged rows are a strong signal. Reading them
turned up two things, and the second is about the corpus rather than the engine.

### The all-flagged rows themselves: English proper names

`turkish airlines` → ours `tuɾkis aᶦɾlines`, heard `tœɾkʃɛlaɪns`; `air canada delta air lines` → heard
`erɡanaða deldaerlaɪns`; `minneapolis star-tribune` → heard `minjapolis tʃaɾtɹiːbun`. The same
code-switching class as Shona (run 62), not yet authored.

### ⚠ And the split is speaking PENINSULAR Spanish

The recognizer keeps returning `θ` where we write `s` — `katorθe`, `θerkana`, `imbesθiɡaθjon`, `loftanθa`.
That is *distinción*, which Latin American Spanish does not have.

**It tracks the ORTHOGRAPHY, which is what makes it real:**

```
corr(θ count, ⟨z/ce/ci⟩ count) = 0.749        mean θ per row        1.83
corr(θ count, ⟨s⟩ count)       = 0.254        mean ⟨z/ce/ci⟩ per row 2.11
```

⚠ ⚠ **I CLAIMED THIS CLOSED THE CONFOUND. IT DOES NOT — SEE RUN 64.** The argument was that the model is
purely acoustic and never sees the text, so an orthographic correlation must come from the speakers. That
misses a mechanism: the model can learn the pattern LEXICALLY. Trained on (Spanish audio, espeak-`es`
labels), it sees *ciudad* labelled with θ every time, and reproduces it from the word's acoustic shape
without any [θ] being present. Run 64 tests this and the evidence favours it.

Textbook, in one breath: `los ciudadanos` → heard `los θjuðaðanos`. [s] for the ⟨s⟩ of *los*, [θ] for the
⟨c⟩ of *ciudadanos*.

Over rows with ≥3 ⟨z/ce/ci⟩:

```
distinción (θ/cz ≥ 0.5)   697   86%
seseo      (θ/cz < 0.15)   23    3%
mixed                      90   11%
```

### The engine is right and the LABEL is wrong

`phonemize-fleurs.mts` maps `es_419 → es-419`, which correctly emits seseo. Scoring the same audio against
the Peninsular engine instead:

```
es-419 (current)     median 0.0824   mean 0.0894
es    (Peninsular)   median 0.0744   mean 0.0825
                     1295 closer / 467 further      gained 22.93  lost 6.98  =  3.3:1
```

**Not a phonemizer defect — a corpus-labelling one.** The `VARIETY` map exists for exactly this (it already
carries `ar_eg→arz`, `ny_mw→nya`), and the numeral-register precedent says rendering choices of this kind
are training-corpus policy rather than phonemizer correctness.

⚠ **DO NOT REMAP — see run 64.** Recorded rather than applied, and run 64 turns "not yet" into "no".

## Run 64 — 2026-08-20 — the θ is probably espeak's, not the speakers'

Run 63 concluded the `es_419` audio is Peninsular. **That conclusion is withdrawn**, on a mechanism I had
not considered: the recognizer was trained with **espeak-generated labels**, and espeak's Spanish choice is
a DIALECT choice.

```
espeak -ves      la θjuðˈad ðe seɾβˈiθjo katˈoɾθe θapˈato lˈos     <- Spain, θ
espeak -ves-419  la sjuðˈad ðe seɾβˈisjo katˈoɾse sapˈato lˈos     <- Latin America, s
espeak -vca      lɐ siwðˈat ðə sərβˈisjʊ kɐtˈorsə zɐpˈatʊ lˈos     <- no θ
```

CommonVoice Spanish is one locale, so the labelling pipeline almost certainly used `es`. The model was then
trained on mixed-origin Spanish audio against **European** labels, and can reproduce that pattern
LEXICALLY — recognising the word-shape of *ciudad* and emitting the θ it was always labelled with, whether
or not the speaker produced one. That generates the orthographic correlation with no [θ] in the audio.

**Catalan is consistent with this.** espeak `ca` writes no θ, and ca_es shows θ in 17.7% of rows against
es_419's 79.7%.

### The test: does θ depend on word FREQUENCY?

A speaker's pronunciation does not. A memorised lexical pattern does. Over rows containing exactly one
⟨c/z⟩ word, so the θ is attributable:

```
bucket        n    θ rate   median dist
freq >= 5   319      77%       0.0829
freq 2-4    256      77%       0.0730
hapax        39      56%       0.0728
```

**The θ rate falls 77% → 56% for words seen once, while those rows are recognised just as well** (median
distance 0.0728 vs 0.0829/0.0730). That rules out the obvious confound — rare words being harder overall —
and leaves a lexical effect, which is what memorisation looks like and what genuine distinción does not.

⚠ n=39 in the hapax bucket, so this SUPPORTS the espeak explanation rather than proving it. What would
settle it: listening to a sample, FLEURS speaker-locale metadata, or a second recognizer trained on
different labels.

### It inverts the recommendation

Run 63's 3.3:1 for remapping `es_419 → es` now reads as **fitting the instrument, not the speech**. If the
θ is espeak's, remapping would pair genuinely Latin American audio with Peninsular IPA — corrupting the
training pairs to chase a metric artefact. **Do not remap.**

### And it generalises the espeak confound

The earlier entry established that the recognizer is not independent of espeak for SYMBOL choices. This
adds: **it is not independent for DIALECT choices either**, and that failure mode looks exactly like a
corpus-labelling defect — an entire language appearing to be recorded in the wrong variety. Any future
"this split is speaking the wrong dialect" finding has to clear espeak's voice for that language first.

## Run 65 — 2026-08-20 — hr_hr: a bare `dr`, and more code-switching

`hr_hr` at 2.8× its own median, 17 rows / 8 sentences. Two findings and a confirmation of the run-62 rule.

### `dr` without a period is read as a consonant cluster

```
[639] dr damadian je 1977. …      ours  dr damadian …        heard  dɔktɔ deɾmeːdjn …
[1447] dr. tony moll …            ours  doktor toni mol …    heard  doktortonimol …
```

The dotted form expands and the bare one does not — `restoreAbbreviationDots` exists for exactly this
(FLEURS strips the trailing period) but had **no `hr_hr` entry**. Corpus-wide the bare form appears **99
times across many languages**, every sampled one the doctor abbreviation (`dr damadian`, `dr ehud ur`).

⚠ **Only the languages whose own table expands `dr.` may have it**, and that is not most of them:

```
cs  dr̩ smɪtx  -> doktor smɪtx     ✓        mt  dr smɪtħ  -> dr . smɪtħ    ✗ the dot becomes a CLAUSE MARK
en  dɹaᶦv smɪθ -> dɑːktɚ smɪθ     ✓        cy, et, ny, pl, bs, sr  likewise ✗
hr  dr smit    -> doktor smit     ✓        fr  already expands without it  — nothing to repair
```

⚠ **English reads the bare token as `dɹaᶦv` — *drive*.** That is the worst of the eighteen.

Added for cs/en/hr/ms/sk/sl — 18 occurrences, all verified as the abbreviation:

```
17 closer / 1 further     gained 0.2773   lost 0.0021   = 132:1
```

⚠ **A self-review catch, and then a second one from the guard it prompted.** The first edit added
`cs_cz: ["dr"]` as a SECOND key. A duplicate key in an object literal silently wins, and **tsc does not flag
it** — the type is a `Record<string, …>` index signature, so repeated literal keys are legal. It would have
dropped `tzv/atd/tzn/sv/cca` with no error and no failing test. Merged into the existing entry, reformatted
one key per line (five on one line is what hid it), and `test/abbreviation-table.test.ts` now parses the
SOURCE for repeated keys, since the runtime object cannot show them.

That test immediately found a second one: **`mrt` was listed twice** in `INITIALISM_UPPERCASE` — once in the
casing-differential batch and once in the later UNSURE-bucket pass. Harmless at runtime (the extra matcher
repeats an idempotent replacement) but the list is hand-reviewed and its length is quoted in its own
docstring. Removed the later entry, kept the one with the stronger justification.

### Code-switching again, and the run-62 rule holds

Four sentences carry standalone English read in English: `national superintendent of the year` (ours
*…of te iear*), `george w bush` (heard `dʒordʒ idablju boʃ` — the English letter name for ⟨w⟩),
`henry louis gates`, `ellsworth land`.

```
sid 177   0.3835 -> 0.2615    0.4225 -> 0.2950    0.4493 -> 0.3037
sid 1464  0.3273 -> 0.2093    0.3333 -> 0.2056
sid 1062  0.3504 -> 0.2931    0.3729 -> 0.2991
sid 1129  0.3387 -> 0.2806    0.4000 -> 0.3224

9 rows, ALL closer, gained 0.9074  lost 0.0000
```

⚠ **`bellingshausenovim` was left alone** — it carries a Croatian instrumental suffix, so by the run-62
rule it is a nativised loanword rather than a switch, and the host engine should keep it. The rule
transferred from Shona to Croatian without adjustment.

### Not resolved

`[1447]` the reader expands `TB` to *tuberkuloza* — a reader's lexical choice, not derivable. `[808]` and
`[1006]` are pure Croatian with garbled recognizer output. Left unmarked pending the same
under-production check run 61 used for hu_hu.

All-flagged is now **528**, down from 658 when this stretch began.

## Run 66 — 2026-08-20 — ff_sn reads numerals in French, but it is NOT a register

`ff_sn` (Fulah, Senegal) at 2.6× its own median, **100% digit-bearing**. The recognizer output is
unmistakable:

```
6387 km  3,980 miles   ->  … katrvɛnset kilomeːtr … virɡil …    quatre-vingt-sept, kilomètre, VIRGULE
783,562 square km      ->  … sesankatrventruː … kilmɛtɛr …      sept cent quatre-vingt-trois
HJR-3 … legislature    ->  … lezislatʃir …                      législature
```

Senegal is francophone, and `ln_cd` is already wired to French for the same reason — so the obvious move is
a register entry. **Run 19 never measured `ff_sn`**, so this replicates its method over all 704 digit rows:

```
register    median    closer/further      %
fr          0.3333          344/327     51.3%
en          0.3571          277/394     41.3%
es          0.3419          308/355     46.5%
                 native median 0.3279
```

**French fails the bar and the median gets WORSE.** Below even the 60–85% "mixed" tier. But split by the
sibling screen:

```
all-flagged   n=  6   0.6837 -> 0.5145     6/0    100%
exonerated    n= 45   0.6303 -> 0.6166    38/5     88%
not flagged   n=648   0.3184 -> 0.3230   296/321   48%
```

The tail favours French overwhelmingly; the bulk is a coin flip. ⚠ **And that split is partly circular** —
a row where the reader used French is flagged BECAUSE our native reading mismatched, so the flagged subset
is selected for exactly the property being tested. What the unflagged 648 show is the honest signal: **most
Fulah readers read the numerals natively.**

So this is per-row reader variation, like ceb/fil/mi/ig, not a language fact. `{fr:}` spans on the six
all-flagged rows:

```
sid 1189  0.5837 -> 0.3366      sid 430   0.6909 -> 0.5186      sid 301  0.5748 -> 0.4932
sid 430   0.7903 -> 0.7576      sid 301   0.7252 -> 0.6856
5 rows, ALL closer, gained 0.5732  lost 0.0000
```

⚠ **A tension worth recording.** `read_text` is a property of the TEXT, but a numeral register is a property
of the READER — and the 45 exonerated rows are exactly the case where one recording of a sentence switched
and another did not. Per-`wav` `--set` handles it correctly, but the "same text, same reading" framing used
in run 58 does not hold for this class.

**Those 45 were then scored per row** and 25 accepted at a >0.02 margin (3 rejected, 17 neutral) — the
screen saying no on 3 is what makes it evidence rather than assumption. Applied per `wav`, not per sentence.

```
all ff_sn spans (31 rows):  31 closer / 0 further   gained 3.4973  lost 0.0000
ff_sn language median:      0.2587 -> 0.2587
```

The median does not move, and saying so matters: 31 rows out of 3,000-odd cannot shift it. The gain is real
and entirely in the tail, which is where the training pairs were wrong.

⚠ **A process bug, caught by checking the applied state rather than the script output.** The first pass set
5 of 6 rows: the generator wrote the TSV with no trailing newline and bash `while read` drops an
unterminated final line — silently, with the loop reporting success. The generator now emits a trailing
newline and the loops use `|| [ -n "$var" ]`. Verified the other batches were unaffected (sn 6/6, hr 9/9,
and run 58's 37 = 35 accepted + 2 demo).

## Run 67 — 2026-08-20 — wordize's first use: BCS final devoicing is real, and should not be modelled

First finding from `wordize.py` rather than from reading rows. Ranking `hr_hr` word types put **`zˈarez` at
mean 0.494, +0.345 over the language baseline** — the highest of any type, and a word WE insert (the
Croatian decimal comma).

The readers do say it. The divergence is one segment:

```
ours  zˈarez        heard  z a ɾ e z  /  z a r e s  /  z a r e z
```

Final `z` coming back as `s`. That is **word-final obstruent devoicing**, which standard BCS orthoepy does
NOT prescribe (unlike Russian, Polish or German).

### The control that makes it a finding

A 26–36% devoicing rate could simply be the recognizer being unreliable about voicing. It is not — compare
the same obstruents word-MEDIALLY, on clean 1:1 alignments only:

```
lang     FINAL n  devoiced      MEDIAL n  devoiced    ratio
hr_hr       378     33.6%           4487     2.7%     12.3x
sr_rs       374     47.3%           4979     2.4%     19.5x
bs_ba       335     32.8%           4330     1.5%     22.6x
```

**12–23×.** Position-specific, so the phenomenon is real. Medial 1.5–2.7% is the recognizer's voicing noise
floor, which is a useful number in its own right.

⚠ **And pl/de/ru are the other half of the control**: they return almost no word-final voiced obstruents at
all (pl 0, de 0, ru 20), because their engines already devoice. Only the BCS three carry them.

### But applying it is net negative

```
hr_hr  median 0.1374 -> 0.1390   527 closer / 931 further   gained 7.08 lost 11.99   0.59:1
sr_rs  median 0.1469 -> 0.1478   570 closer / 716 further   gained 7.28 lost  9.07   0.80:1
bs_ba  median 0.1570 -> 0.1594   381 closer / 874 further   gained 5.11 lost 11.28   0.45:1
```

At 33–47% the devoicing is **variable, not categorical** — a rule is wrong more often than right. Both
readings are real and the standard keeps the voicing, so the standard is what ships. **Not applied**, and
recorded so the 12–23× signal is not rediscovered as a defect.

It also explains part of why BCS word-level means sit above baseline: a third of their final obstruents
disagree for a reason that is not an error.

### Still open in hr_hr

`kˈoji`/`kˈoje`/`kˈoja` (873 occurrences combined, +0.16 to +0.18), `ɡdje` (+0.251), `zbog` (+0.230), and
the number words `tisuću`/`devetsto`/`dvadeset` (+0.08 to +0.17). None examined.

## Run 68 — 2026-08-20 — the rest of hr_hr's word ranking: standard vs connected speech

Run 67 left four leads from `wordize`. All four resolve the same way, and together they explain why BCS
word-level means sit above baseline without a single defect being present.

### `tisuću` (+0.169) — instrument blindness, not a defect

Croatian ⟨ć⟩ is /t͡ɕ/ and the recognizer writes `tʃ` for it. It is not that it lacks the symbol:

```
lang            our ɕ n   what comes back
cmn_hans_cn        2656   ɕ=93%          <- it writes ɕ freely for Mandarin
hr_hr               288   ʃ=93%   ɕ=0%
sr_rs               217   ʃ=91%   ɕ=0%
pl_pl              1258   ʃ=49%   s=21%
```

So the recognizer HAS `ɕ` and uses it heavily — for the Mandarin fricative. It never hears BCS ⟨ć⟩ as
distinct from ⟨č⟩, which makes the contrast invisible to this instrument.

⚠ **NOT a COARSEN candidate**, and this is where the `ɒ` precedent does not transfer. `ɒ`'s justification
was "the recognizer's count is 0, so the map is unreachable outside these three languages". Here the count
is 29,514 and 93% of it is Mandarin — a global `ɕ→ʃ` would destroy a distinction the recognizer genuinely
makes. Cost of leaving it, measured as the share of edit operations attributable to `ɕ` vs `ʃ`:

```
hr_hr  480 / 16695 = 2.9%      sr_rs  364 / 17241 = 2.1%      bs_ba  361 / 19480 = 1.9%
```

A fixed 2–3% penalty carrying no information. It does not distort the ranking WITHIN a language, but it
does inflate every ⟨ć⟩ word — which is exactly how `tisuću` reached the top of the list.

### `koji`/`koje`/`koja` (+0.16 to +0.18) — variable /ji/ reduction

```
ours kˈoji   n=393   ->   ko 222x · koj 42x · koi 40x · koɪ 27x · koji 13x
```

Control, over hr_hr words of ≥3 units ending in a vowel:

```
final vowel absent from the heard span, all words:   25.1%   (10,035 words)
final vowel absent, words ending in /ji/:            47.4%   (1,091 words)
```

**Roughly double the baseline**, so the reduction is specific to /ji/ rather than general final-vowel loss.
Real, and at 47% variable rather than categorical — the same shape as the final devoicing in run 67, and
declined for the same reason.

### `zbog` (+0.230), `gdje` (+0.251)

`zbog` → `zbok` 25× / `sbok` 14× / `zboɡ` 13×: the run-67 final devoicing again, plus initial z~s. `gdje`
→ `ɡde` 8× / `de` 7×: the /j/ of the jat reflex dropping.

### What this says about hr_hr as a whole

Every elevated word type in the ranking is **our careful/standard form against connected speech** —
`ć`/`č` the instrument cannot separate, final obstruents variably devoiced, /ji/ variably reduced, jat /j/
dropped. None is a phonemizer error, and the standard is the right thing to emit.

⚠ **The useful consequence is for reading the tool.** A high word-level mean in BCS is the expected state,
not a lead. Languages whose orthography is close to their careful pronunciation will rank clean; languages
with heavy connected-speech reduction will not, and that says nothing about the engine.

## Run 69 — 2026-08-20 — a SECOND recognizer, and it settles es_419

Run 64 said the Spanish θ was probably espeak's rather than the speakers', and named what would settle it:
"listening, FLEURS speaker metadata, or a second recognizer trained on different labels". The third is
available.

### Allosaurus

`pip install allosaurus` — a universal phone recognizer over ~2000 languages, trained on a PHOIBLE phone-
inventory/allophone tradition rather than espeak labels. That independence is the whole point: it is the
one thing the espeak confound cannot reach.

```
text        exactamente a las 8:46 a m la ciudad se volvió silencio marcando el preciso
wav2vec2    …laθjðadseβoljosilɛnθjomaɾkandoelpɾesiso…      θ=3
allosaurus  …las̪iuðals̪eɡol̪ʎosilensiomalkanðoðelpoɾes…    θ=0    <- dental s̪, exactly where θ was
```

Over the 11 rows that could be extracted and converted:

```
⟨z/ce/ci⟩ graphemes in the text:            28
θ returned by wav2vec2 (espeak-trained):    28      <- one per orthographic c/z, exactly
θ returned by allosaurus (PHOIBLE-trained):  0
```

⚠ **A recognizer whose θ count EQUALS the spelling count one-for-one is reproducing the orthography, not
the acoustics.** And an independent model on the same audio hears none. Run 64's retraction was right, the
`es_419` audio is Latin American as labelled, and remapping it to `es` would have corrupted 2,306 rows of
published training data.

### What a second recognizer is worth, generally

Every espeak-confound finding in this document — the ⟨ɑ⟩/⟨a⟩ holds for hy/ky/ur, the Spanish θ, the
"22 languages cannot spell Latin acronyms" framing — turned on not being able to separate the instrument's
convention from the speech. A second, differently-labelled model separates them directly.

Practical notes for wiring it in:

- **FLEURS wavs are float32 (WAV format 3)** and allosaurus's reader takes 16-bit PCM only. `ffmpeg -ac 1
  -ar 16000 -sample_fmt s16` converts; the corpus pass would need that step.
- It takes an **ISO-639-3 language code** (`spa`, `ces`) and can restrict output to that language's phone
  inventory, which is a different failure mode from espeak's — a narrow inventory can suppress a real
  phone rather than invent one. Worth measuring before trusting it as a primary.
- Its output is **coarser**: fewer length marks, and it writes dental diacritics (`s̪`, `l̪`, `t̪`) the
  current `fold`/`COARSEN` would need to handle.
- Extraction is the slow part, not inference: each `tar xzf --wildcards` decompresses the whole per-language
  archive, so a real pass should stream the tar once per language.

**It should not replace wav2vec2 — it should sit beside it.** Agreement between two independently-labelled
recognizers is far stronger evidence than either alone, and disagreement is exactly the signal that a
finding is about the instrument. That is the check this campaign has needed four separate times.

## Run 70 — 2026-08-20 — allosaurus becomes a standing column, and the es_419 control that closes run 69

Run 69 used allosaurus once, by hand, on 11 rows. This makes it a permanent second opinion:
`tools/corpus/asr-align/asr_align_allo.py` fills a new **`phones_allo`** column beside `phones`, with
`phones_allo_lang` recording which decode each row got.

### First, the control run 69 did not run

Run 69's claim was "allosaurus hears no θ in es_419". That claim is worthless if allosaurus cannot
write θ, or if a restricted inventory forbade it. Both checked:

```
θ in allosaurus's SPANISH inventory (46 phones):   YES   <- it was free to write it
θ emitted on 20 en_us utterances w/ a θ word:      11    <- it does write it when it hears it
θ on es_419, restricted (spa) decode, 25 rows:      0    of 66 <z/ce/ci> graphemes
θ on es_419, UNRESTRICTED (ipa) decode, same rows:  0    <- not inventory suppression
wav2vec2 on the same 25 rows:                      58
```

⚠ **The zero survives the unrestricted decode**, which has 230 phones available. Run 69's conclusion
holds and is now controlled: the espeak-trained model was reproducing the orthography.

### Language coverage

96 of 102 corpus languages resolve to a PHOIBLE inventory. Six do not (`be_by`, `bs_ba`, `kk_kz`,
`nso_za`, `ny_mw`, `om_et`) and take the unrestricted `ipa` decode instead.

⚠ **THE TWO DECODES ARE DIFFERENT INSTRUMENTS, not two settings of one.** On es_419 the restricted
decode yields 33 phone types and the unrestricted 88, at 0.249 PER between them — the unrestricted one
invents exotica (`b̞`, `ɻ̩`, `k͡p̚`) no fold table will tame. `phones_allo_lang` exists so the column can
never be silently pooled across the two. The six are exactly the wrong six to lose, `nso_za` included.

### ⚠ allosaurus runs at 8 kHz

`pm.sample_rate = 8000`. Every 16 kHz FLEURS clip is resampled down before features, so **everything
above 4 kHz is discarded** — which is precisely where sibilant and fricative energy lives. This is a
standing caveat on every θ/s, s/ʃ, and sibilant-inventory question we ask it. It does not overturn the
es_419 result (the English control shows θ recall survives the 4 kHz ceiling), but it means a
*negative* result from allosaurus on a fricative contrast is weaker than a positive one.

### Instrument floors, measured

Three separate noise floors, worth knowing before any single-phone disagreement is read as signal:

```
same bytes, decoded twice                    0.0000 PER   exact 20/20   (do_dither is commented out upstream)
GPU-batched vs CPU reference                 0.0005 PER   exact 114/120, max 0.0213
ffmpeg -sample_fmt s16 vs in-memory int16    ~0.02-0.04 PER on non-degenerate rows
```

⚠ **The ffmpeg floor is the largest of the three and it is an artefact of run 69's own method.** ffmpeg
DITHERS on the float32→s16 conversion, so run 69's temp-file pipeline perturbed its own input. The
column is built with a deterministic in-memory int16 conversion instead — not more correct, but free
and reproducible.

⚠ **cuDNN picks a different kernel at batch size 1.** A single-item CUDA decode disagrees with both the
CPU decode and the batched CUDA decode (37 vs 38 phones on the row that exposed it); CPU is
batch-invariant across B=1/8/48. Anyone re-deriving one row on the GPU to check the table will see
spurious disagreement. Use CPU, or batch.

### Making it affordable: the pass was 91% MFCC and 3% GPU

Naive throughput was 7.8 utt/s — 9.6 hours for the corpus — and both CPU and GPU sat underutilized.
Profiling found the cost was nowhere near the model:

```
tar stream + gunzip     2.2%
wav decode              0.4%
MFCC (pm.compute)      91.3%     <- and 92% of THAT is resampy, 16 kHz -> the model's 8 kHz
GPU acoustic model      3.1%
LM decode               3.0%
```

Three fixes, each verified not to change output rather than assumed not to:

1. **`allo_fast.py` vectorizes `framesig`.** Upstream loops over ~1,100 frames per utterance in Python
   doing DC-offset removal and preemphasis one frame at a time, and rebuilds the Povey window with
   another Python loop per call. Both vectorize over the frame axis exactly. **Bit-identical features,
   40/40, on two languages** — not merely phone-identical. It monkeypatches a third-party package, so
   `install()` refuses to patch if upstream's source no longer matches, and `--selftest` re-checks.
2. **BLAS pinned to 1 thread.** Stock MFCC spent 19m40s of CPU to make 2m12s of wall-clock on af_za —
   BLAS spreading tiny per-frame matmuls over 16 cores and paying 9× the power to thrash.
3. **A 12-thread MFCC pool and a producer thread for the tar.** resampy's kernel is a numba gufunc and
   releases the GIL, so plain threads scale: 15.8 → 100 utt/s, bit-identical 96/96.

**7.8 → ~50 utt/s**, and af_za went 132s → 25s. ⚠ Note what the profile says about instrument choice
generally: the GPU was never the constraint, and the second recognizer is cheap. There is no throughput
argument against adding a third.

## Run 71 — 2026-08-21 — the restricted decode was the wrong default, and the probe that hid it

Run 70 shipped one allosaurus decode per row, restricted to the language's PHOIBLE inventory, and
justified it on the es_419 control: θ was IN the Spanish inventory and went unwritten anyway, so the
inventory was not suppressing. That control was sound but it was one language and one phone.

### The first comparison came back "identical", and that was a bug

Comparing the restricted and unrestricted decodes on `ast_es` returned **exactly** the same median and
the same mean unit count for both. Two decodes over a 29-phone inventory and a 230-phone one agreeing
to four decimals is not a result, it is a defect:

```python
# allosaurus/lm/decoder.py
mask = self.inventory.get_mask(lang_id, approximation=self.config.approximate)
logits = mask.mask_logits(logits)        # <- MUTATES IN PLACE
```

⚠ **The second call was reading the array the first had already masked**, so it returned the first
decode's answer while looking like it ran. The es_419 spa-vs-ipa figures in run 70 are unaffected —
that probe recomputed features per decode, so each call got a fresh array — but every call site now
passes `.copy()`.

### With the bug fixed, neither decode wins

```
                 restricted   universal        units vs wav2vec2
ast_es (29-phone inv)  0.5200      0.4140       0.649  ->  1.083
af_za  (36-phone inv)  0.6342      0.7207       0.919  ->  1.074
```

⚠ **`ast_es` is the suppression failure mode, caught in the act.** Its inventory is the fleet's
smallest and the restricted decode returns barely two thirds of a phone per wav2vec2 phone — the
decode is being starved, not sharpened. ⚠ **And `af_za` reverses the ordering**, so this is not a case
of "the universal decode is simply better". Picking either one globally would have silently biased
every per-language conclusion the column is meant to support — the same class of error as run 64's
es_419 remap, arrived at from the opposite direction.

Both decodes now ship: `phones_allo` (restricted) and `phones_allo_uni` (all 230 phones). The acoustic
model forward is shared, so the second costs ~4%. `allo_compare.py --decodes` reports which fits each
language.

### What the column is for

`allo_compare.py` asks the question the second recognizer exists to answer, per language:

    delta = median dist(ours, wav2vec2) - median dist(ours, allosaurus)

A large POSITIVE delta means the all-flagged queue is ranking an espeak artefact rather than our
output — we agree with the independent instrument and disagree only with the espeak-trained one. Near
zero means the disagreement survives a change of tradition and is a real lead. Large NEGATIVE means we
agree with espeak's conventions specifically, which for rules written against espeak output is
circularity surfacing as a number.

⚠ **Delta triages, it does not adjudicate**, and three things keep it honest: allosaurus is deaf above
4 kHz (run 70), it is coarser in general so it will agree with a coarser transcription for
uninteresting reasons, and the decode choice above moves it. Read `--decodes` first.

## Run 72 — 2026-08-21 — the fleet pass, a metric that failed, and what the corroborated queue actually contains

270,106 rows, 102 languages, both decodes, ~100 min at 32–66 utt/s.

### ⚠ The aggregate delta failed its validation case

`delta = median dist(ours, wav2vec2) - median dist(ours, allosaurus)` was supposed to separate "our
output is wrong" from "the instrument is wrong". On the full fleet **all 102 languages came out
negative** (median −0.176, none above +0.10), and `es_419` — the one case whose answer we know —
ranked **32nd of 102**, indistinguishable from the fleet.

⚠ **Aggregate distance measures which recognizer is better, not where either is biased.** The θ
artefact is ~28 phones in a ~107-phone utterance; the baseline quality gap between the two recognizers
swamps it. Kept in the tool with this recorded, because it is an inviting trap.

### The decode split was worth shipping

84 languages prefer the restricted decode, 12 the universal, 6 identical. The three worst-starved
inventories are all in the universal group (`sr_rs` 0.566 phones per wav2vec2 phone, `ast_es` 0.646,
`ckb_iq` 0.704). Had run 70's single restricted decode shipped, 12 languages would have been measured
through a starved instrument.

### What does work: the three-way per-symbol verdict

With three streams you can ask which one is the odd one out. It recovers es_419's θ as `w2v-alone` at
15.2/1k against 0.0 and 0.0 — the known answer, found by the general instrument.

⚠ **But `corroborated` is not a defect queue until three things are removed, and each was found the
hard way:**

1. **Inventory forcing.** The restricted decode cannot corroborate a symbol its inventory lacks.
   allosaurus's Azerbaijani and Estonian inventories contain **no `a` at all**, so it must write `ɑ`;
   its Armenian, Swahili, Urdu and Spanish inventories contain no `ɑ`, so it must write `a`. Read
   naively this produced "both recognizers hear `a` and we do not" for Armenian — a statement about a
   PHOIBLE inventory file, not about audio. **Use `--uni` for anything you intend to act on.**
2. **Shared notation.** Two recognizers agreeing against us is only evidence if they are not simply
   agreeing on a convention we did not adopt. Both write `ɾ` where we write `r` (10 languages) and `ɪ`
   where we write `i` (10 languages). A symmetric `NOTATION` fold, applied to all three streams, takes
   538 findings to 232. ⚠ It DELETES those axes — this tool can no longer see an r/ɾ error at all.
3. **Connected-speech reduction.** 33 of the remaining 232 are `ə` across ~15 languages: both
   recognizers hear reduced vowels, we write the careful form. Run 68 established this for hr_hr; a
   second independent instrument now confirms it fleet-wide. Not a defect — the register is a choice.

### The low-vowel axis, with an independent witness at last

`low_vowel_notation_investigation.md` proposed three changes on recognizer evidence and withdrew all
three because wav2vec2 is not independent of espeak. Correlating the per-language ratio ɑ/(ɑ+a):

```
corr(ours, wav2vec2)               +0.281
corr(ours, allosaurus RESTRICTED)  +0.142    <- inventory-forced, not evidence
corr(ours, allosaurus UNIVERSAL)   +0.074    <- no inventory prior
corr(wav2vec2, allosaurus UNIVERSAL) +0.467
```

⚠ **The two recognizers agree with each other far better than either agrees with us**, and the
unrestricted decode is discriminating rather than defaulting (it writes `ɑ` in 60/101 languages against
the restricted decode's 23). This does not license a change — both models carry a ~23:1 frequency prior
toward `a`, so shared prior is not excluded — but it is the first evidence on this axis that espeak
cannot explain. The withdrawal stands; the question is now answerable rather than blocked.

### The residual, and it is small

Of 199 non-schwa corroborated findings after folding, **177 are in a language that also has an
`ours-alone` symbol** — almost certainly the same segment written differently. **22 are not**: the
language has no unwritten-symbol of its own, so we simply never emit that phone.

```
lang       sym  ours/1k  w2v/1k  allo/1k
ast_es       ð      0.0    33.4     25.8     <- /d/ spirantisation
it_it        ð      0.0     6.5     17.4
kea_cv       j      0.0    11.2     25.9
umb_ao       r      0.0     9.2     20.3
pt_br        ŋ      0.0    29.7      9.3     <- and ŋ in yo_ng, ln_cd, umb_ao, ast_es, ro_ro
```

⚠ **`ŋ` recurs across six unrelated languages** — a phone the fleet never emits and both recognizers
hear. That is the shape of a systematic gap rather than six coincidences, and it is the one lead here
that a single recognizer could not have produced.

## Run 73 — 2026-08-21 — the word-level corroborated queue finds a real defect: ckb's free ⟨و⟩

Runs 71–72 kept converging on vowel quality — ɑ/a, ɪ/i, ə. ⚠ **That is a statement about the
INSTRUMENT, not about the fleet.** A per-symbol detector finds per-symbol things; its output going
fine-grained means there is nothing coarse left *of that kind*, not that fine-grained work is what
matters most. Asking the blunt question instead — which WORD TYPES do both recognizers put far from
us — found a defect on the first try.

### The queue

`allo_compare.py --words`, on the four languages the re-ranked all-flagged list put on top. Two-stage:
the cheap row score filters to rows no recognizer vouches for, then `wordize` aligns only those. Word
distance is `min` across wav2vec2 and both allosaurus decodes, so no single instrument's convention can
carry a finding.

```
=== ckb_iq  (107 rows no recognizer vouches for)
    1.000  x59   w          <- taken
    1.000  x15   j
    1.000  x7    duː
=== he_il  (89 rows)
    1.000  x12   be         <- proclitics; not actioned
    1.000  x6    ve
    0.750  x10   pʰˈiː      <- English letter-names, in Hebrew and Kurdish both
```

### ckb: the free conjunction ⟨و⟩ was a bare [w]

`scanWord` resolves the و/ی matres lectionis as "glide word-initially or next to a written vowel, else
the vowel". For the ONE-LETTER WORD ⟨و⟩ — the conjunction "û", *and* — `i === 0` makes it word-initial,
so it emitted a bare `[w]`: a consonant standing alone as a word, with no following segment to glide
onto.

⚠ **We already knew, and routed around it instead of fixing it.** From `numbers.ts`:

> The connective is an ENCLITIC, so `link()` appends it to the END of the preceding word rather than
> emitting it as a free token … **Emitting a standalone ⟨و⟩ would instead phonemize to a bare [w] (the
> ckb g2p reads a word-initial ⟨و⟩ as the glide).**

That workaround fixed the numeral connective and left the far commoner free conjunction standing. ⟨و⟩
is a whole word **1,900 times in 3,040** FLEURS ckb sentences.

### Measured, against both recognizers

Over the 1,337 affected rows, distance = min(wav2vec2, allosaurus-restricted, allosaurus-universal),
notation folded:

```
             median    mean    closer / further
current      0.2742   0.3018
w -> u       0.2663   0.2918    861 /  23   = 37.4:1     <- taken
w -> uː      0.2663   0.2918    861 /  23               (indistinguishable: fold strips length)
w -> drop    0.2698   0.2971   1312 /  25   = 52.5:1
```

⚠ **Deleting it scores more rows closer but a worse median and mean.** That is the count-vs-magnitude
split the ⟨ʔ⟩ decision already set a bar for, and it resolves the same way: deletion is the
connected-speech reduction, `[u]` is the standard form, and the register is a choice. ⚠ `u` over `uː`
is decided on the language, not the metric — the eval cannot see length at all.

⚠ **This is the first fleet change in this campaign carried by a non-espeak instrument.** 37:1 against
wav2vec2 alone would have been the low_vowel_notation situation over again; 37:1 against the minimum of
two independently-labelled recognizers is not something an espeak convention can produce.

### Not actioned

- **he_il `be`/`ve`/`hen` at 1.000** — Hebrew proclitics we emit as free words. Whether that is a defect
  or a segmentation convention needs the `pr839` proclitic work, not a grapheme edit.
- **`pʰˈiː`, `jˈuː`, `duː`, `ˈɛn` in BOTH he_il and ckb_iq** — Latin acronyms read with English letter
  names. The English fallback was accepted deliberately; recorded because it now has a measured cost.
- ⚠ The stored `ipa` for ckb_iq is now stale. The corpus needs a re-derivation pass before these
  numbers are re-measured.

## Run 74 — 2026-08-21 — mn_mn ⟨б⟩→[b] REJECTED: two recognizers agreeing is not two witnesses

Run 73's method — a word/symbol divergence corroborated by both recognizers — proposed a second change
and the literature killed it. Recording the whole path, because the failure mode generalises.

### The case, as it looked

Mongolian was the fleet's worst residual: 27.0% of rows serious, median 0.519. The symbol profile said
we write `p` 31.7/1k where both recognizers write 2.4–9.6, and we write `b` **zero times in the whole
language** where they write 26.4 and 36.3. `mongolian.jsonc:44` looked internally inconsistent —
⟨б⟩→`p` and ⟨д⟩→`t` but ⟨г⟩→`ɡ`, three members of one series treated two ways.

Measured on the unaspirated series only (`fold` strips ʰ, so a naive `p→b` also converts ⟨п⟩ /pʰ/ and
the first attempt was confounded):

```
p (unasp) -> b   median 0.5188 -> 0.4949   2149 closer /  308 further = 7.0:1
t (unasp) -> d   median 0.5188 -> 0.5319    922 closer / 1713 further = 0.5:1
k (unasp) -> ɡ   no effect (we already write ɡ 10,785 times)
```

7.0:1, well over the ⟨ʔ⟩ bar. ⚠ **And the obvious objection was tested and appeared to fail.** Mongolian
contrasts aspiration, not voicing, so a recognizer trained on voicing languages should map unaspirated
to its voiced category — but the control said no: in ko_kr, cmn_hans_cn and th_th, all
aspiration-contrast languages, our `p` rate matches both recognizers closely (cmn 20.1 vs 19.2/24.1).
Mongolian looked like the lone outlier.

### The literature says our table is right

Svantesson, *Khalkha* (in Janhunen ed., *The Mongolic Languages*), on the weak obstruents:

> The weak stops and affricates are basically plain voiceless unaspirated sounds in all positions. In
> Modern Khalkha, however, this is **fully true only of the weak labials and dentals** [p, t, ts], while
> the **weak velars seem to be functionally voiced**, though they can be phonetically voiceless [k, q]
> word-finally and before a voiceless consonant. In other positions, they are phonetically voiced [ɡ, ɢ].

and every worked example transcribes ⟨б⟩ as [p]: `baatar` [patr] 'hero', `bal` [paɮ] 'honey', `bol-`
[pɔɮ] 'to become', `bar` [par] 'tiger', `bag` [paɢ] 'team'.

⚠ **`mongolian.jsonc` already encodes that exact three-way asymmetry** — ⟨б⟩→p, ⟨д⟩→t, ⟨г⟩→ɡ. What
looked like an inconsistency is the documented phonetics, and it is why `t→d` measured NEGATIVE while
`p→b` measured positive: the table is not applying a rule unevenly, it is following the language.

**Rejected. No change shipped.**

### ⚠ The lesson, and it undercuts the tool's headline criterion

**Two recognizers agreeing against us is not two witnesses when both are mapping an unfamiliar category
into a familiar one.** Neither model has a voiceless-unaspirated-vs-aspirated category system; both
have voiced-vs-voiceless. Confronted with Mongolian's weak labial they make the *same* reduction for
the *same* reason, and their agreement measures their shared architecture, not the audio. This is the
`low_vowel_notation` shape again, arrived at from a direction that was supposed to be immune to it.

⚠ **And the control that was supposed to catch it was too weak.** Comparing our rate to the recognizers'
rate in other aspiration languages cannot detect a bias that only bites where OUR transcription is
unusual — ko/cmn/th agree with the recognizers already, so there was nothing for the control to see.
A sufficient control would need a language where we write voiceless-unaspirated AND the recognizers are
known to be right, which is close to assuming the answer.

⚠ **What this does NOT overturn: ckb ⟨و⟩→[u] (run 73).** That was not a category mapping. A bare [w]
standing alone as a word is not pronounceable in any framework, our own `numbers.ts` had documented the
defect and routed around it, and the corroboration was internal as well as acoustic. The distinction
worth keeping: **corroboration is strong for "is there a segment here at all", and weak for "which
category does this segment belong to."**

### Standing rule for this tool

Before acting on a corroborated finding, ask whether the disputed symbol lies on a **category axis the
recognizers share and the language does not** — voicing, aspiration, vowel height/backness, length.
If it does, the agreement is worth nothing on its own and the question needs the literature or a
purpose-built acoustic probe. Both recognizers are trained on inventories, and an inventory is a claim.

### Marked in the database, so neither comes back

⚠ **A verdict that is not written into the row is not a verdict.** Both of run 73/74's conclusions are
now `status` in `align.sqlite`, with `asr_align_label.py --wav-file` added to mark a computed row SET
(the tool could previously do one row, one language, or one sibling class, and nothing in between):

```
mn_mn    469 rows  convention   the 469 SERIOUS rows the weak-labial axis actually drives -- not all 831.
                                The other 362 are not explained by run 74 and stay in the queue.
ckb_iq  1333 rows  defect       the free conjunction; fixed in the engine, ipa stale until re-derived.
```

⚠ **And `allo_compare` was still resurfacing them**, because its exclusion list held only the
audio/instrument/reader statuses — a row a human had marked `convention` came straight back the next
run. That is precisely the failure `examined_clean` was created to prevent, reintroduced by new tooling
that did not know about it. The list is now the CLOSED set. mn_mn drops 27.0% → 13.9% serious, which is
the 469 rows leaving and the 362 unexplained ones remaining, as intended.

⚠ `defect` is deliberately NOT excluded. Those rows are ours, and ckb_iq's 1,333 need the re-derivation
pass before any ckb number is quoted again.
