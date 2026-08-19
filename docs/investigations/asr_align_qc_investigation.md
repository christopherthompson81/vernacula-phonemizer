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
