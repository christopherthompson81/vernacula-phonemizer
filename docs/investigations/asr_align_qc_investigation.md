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
