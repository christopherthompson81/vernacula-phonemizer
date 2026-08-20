# The `ɑ`/`a` question — one notation choice across several languages

Opened by the nso result (`docs/investigations/nso_vowel_investigation.md`). Working the elevated-median
list top-down looked wrong once the second language's residual had the same shape as the first's.

## Run 1 — 2026-08-20 — triage before picking a language

**Command.** For the 22 highest-median languages, the share of substitutions in their top 3 pairs.

**Question.** "High median" has three causes — our bug, reader divergence, recognizer artefact — and only
one is ours. Is there a cheap screen that separates them?

**Raw finding.**

```
lang      median  top3 share   dominant substitutions
sw_ke      0.444        59%    ɑ>a=43%  ɛ>e=8%  ɔ>o=8%
nso_za     0.665        49%    ɑ>a=24%  ɛ>e=13% ɔ>o=13%
hy_am      0.429        45%    ɑ>a=31%  ɾ>r=11%
kk_kz      0.458        38%    ɑ>a=24%  e>i=9%
ps_af      0.547        34%    ə>a=17%  ɑ>a=10%
ur_pk      0.458        34%    ɑ>a=18%  ə>a=9%
az_az      0.550        33%    æ>ɛ=12%  ɑ>a=11%
...
sd_in      0.506        15%    ə>a=6%   ɾ>r=5%
ga_ie      0.481        14%    ɾ>ɹ=6%   x>k=4%
my_mm      0.537        13%    θ>d=5%   ə>a=4%
mn_mn      0.549        11%    t>d=4%   ŋ>n=4%
vi_vn      0.571        10%    j>ɪ=4%   n>ŋ=4%
km_kh      0.480         8%    ɑ>ɔ=3%   j>ɪ=3%
```

**Implication.** Concentration separates them cleanly. A high median with a **diffuse** residual (no pair
over ~5%) is the recognizer finding the language hard — mostly the tonal ones, exactly what the asr-align
README says not to engineer away. A high median **concentrated in two or three pairs** is systematic and
worth opening. And `ɑ>a` leads six of the top 22, which is one question, not six investigations.

## Run 2 — 2026-08-20 — scoping the `ɑ` question

**Command.** Per language: how often our `ɑ` comes back as `ɑ` vs `a`, and whether we emit plain `a` at all.

**Raw finding.**

```
lang        our ɑ      →ɑ      →a    we also emit plain a
sw_ke        5338    0.0%   82.0%       0
nso_za       4251    0.1%   83.3%       0
hy_am        4049    1.9%   86.9%       2
ky_kg        3227    2.1%   86.2%       4
ur_pk        2150    1.5%   83.8%       0
fi_fi        2968    9.6%   70.7%       0
et_ee        2924   11.2%   59.8%       0
az_az        2602   13.1%   60.4%       0
--
fr_fr         790   94.6%    0.9%    1786
en_us         386   69.7%    8.0%     463
cmn_hans_cn  1295   62.9%   28.5%     756
ga_ie         600   28.0%    7.7%    2109
```

**Implication.** Where a language emits both `a` and `ɑ`, the recognizer confirms the `ɑ` (French 94.6%,
English 69.7%). Where `ɑ` is the only low vowel, it essentially never returns it. So the recognizer is not
biased toward `a` — it tracks a contrast where one exists.

## Run 3 — 2026-08-20 — the refinement that decides it

"We emit no plain `a`" is necessary but not sufficient: Finnish and Estonian emit no `a` either, and their
`ɑ` is the back member of a real contrast with `ä`=`æ`. The right test is whether **any** other low vowel
is in the inventory.

```
lang          ɑ      a      æ    verdict
sw_ke      5684      0      0    ɑ is the ONLY low vowel → notation
nso_za     4827      0      0    ɑ is the ONLY low vowel → notation
hy_am      4609      2      2    ɑ is the ONLY low vowel → notation
ky_kg      3598      4      6    ɑ is the ONLY low vowel → notation
ur_pk      2425      0      1    ɑ is the ONLY low vowel → notation
--
az_az      2943      0   2875    contrast (a/ə)      → ɑ may be real
fi_fi      3357      0   1126    contrast (a/ä)      → ɑ may be real
kk_kz      3284    156    248    contrast (а/ә)      → ɑ may be real
et_ee      3218      0    274    contrast (a/ä)      → ɑ may be real
nb_no      1586      0    343    contrast            → ɑ may be real
ps_af      1592    511     22    contrast            → ɑ may be real
```

**Implication.** This screen is **structural, not acoustic** — it reads our own inventory, so it does not
spend the audio evidence the way nso's mid-vowel call did. The audio only confirms what the inventory
already implies: a symbol that distinguishes nothing is notation, and notation should match what listeners
hear. The worklist is **sw_ke, hy_am, ky_kg, ur_pk** (nso done).

## Run 4 — 2026-08-20 — Swahili

**Raw finding.** Both referees write `ɑ` — wikipron 356:8, kaikki 387:7 — so unlike Sepedi there IS a
written tradition behind it. But **wikipron swa and kaikki swa are both en.wiktionary**: one tradition
counted twice, the same circularity found for arz. The sources that are *not* that tradition both disagree:

- **epitran swa-Latn**: `habari→haɓaɾi`, `jambo→ʄambo`, `asante→asante` — a/e/o throughout.
- **3,070 FLEURS utterances:**

```
our ɑ (n=66826) → a 81.4%   (control: our i → i 87.8%)
our ɛ (n=13719) → e 73.5%   (control: our u → u 80.0%)
our ɔ (n=12439) → o 77.3%
ɛ→ɛ and ɔ→ɔ do not reach 3.3%
```

**Sweep:**

```
current (ɑ ɛ ɔ)     median 0.4439
ɑ→a                 median 0.2359
ɛ→e, ɔ→o            median 0.3619
ɑ→a, ɛ→e, ɔ→o       median 0.1571     <- rank 6 of 102
```

Applied; verified end-to-end through the engine at **0.1571 / mean 0.1673**, matching the proxy exactly.

## ⚠ The referee could not see it, and that is the finding

Swahili scores **93.5% / 97.8%** against two human referees. Those numbers are **byte-identical before and
after** this change — verified by running the eval both ways — because `sw.jsonc` folds `a~ɑ`, `e~ɛ`,
`o~ɔ`.

The folds are correct: Swahili has no low or mid contrast, so the symbols carry no phonology and penalising
a notation difference would measure nothing. But their consequence is that **an engine can sit on the wrong
vowel set indefinitely behind two referees at 93%+**, and no dictionary-based instrument will ever say so.
It took a different modality to notice.

This is the third instance of one pattern in two days:

| language | the instrument | what it could not see |
|---|---|---|
| arz | wikipron arz | fold ordering; the pausal fold fired on one side only |
| tn | epitran tsn, 0.98 | `[ɛɪ]→e`, `[ɔʊ]→o` collapse the vowel-height axis |
| sw | wikipron + kaikki, 93.5% | `a~ɑ`, `e~ɛ`, `o~ɔ` collapse the vowel-quality axis |

A fold that is right for scoring is still a blind spot for detection. Neither the fold nor the score is
wrong; what is missing is anywhere that records *which axes a language's referee cannot judge*.

## Still open

- **hy_am, ky_kg, ur_pk** — same screen, same verdict, not yet applied.
- **`ɪ>i` / `ɐ>a`** leads ko_kr (15%), ru_ru (11%), ta_in (11%), tr_tr (9%). Same *shape*, but expected to
  resolve differently: `ɪ` is contrastive in English and German and the recognizer writes it 586k times, so
  the structural screen from run 3 has to be run on it rather than assumed.
- Nothing reads the medians as a queue. The 3×MAD flag list is scored within a language and cannot rank
  across them, which is why nso sat last of 102 with 1,989/1,990 rows marked verified.

## Run 5 — 2026-08-20 — ⚠ the confound I should have tested first

**Question.** Before batching hy/ky/ur, one thing was never checked: the recognizer is
`wav2vec2-xlsr-53-espeak-cv-ft` — note the **espeak** in the name — is fine-tuned to emit espeak phoneme
labels. When it returns `a` where we
write `ɑ`, is that an acoustic judgement or espeak's transcription convention played back?

**Command.** `espeak-ng -v<lang> -q --ipa` on native-script words for every language in the worklist.

**Raw finding.**

```
lang  espeak writes   wikipron    other written                  recognizer → our ɑ
nso   NO VOICE        none        epitran tsn: a                 a 83%
sw    a               ɑ 356:8     epitran: a                     a 82%
hy    a               ɑ 23622     none                           a 87%
ky    ɑ               ɑ 440:156   epitran: ɑ                     a 86%
ur    aː              ɑ 5142:6    CLE speech: ɑ · epitran: ɑː    a 84%
```

**Implication — two, pulling opposite ways.**

**Kyrgyz is a natural experiment that partly exonerates the recognizer.** espeak's Kyrgyz voice writes `ɑ`,
Kyrgyz has an espeak voice and is a CommonVoice language, and the recognizer *still* returns `a` 86.2% and
`ɑ` only 2.1%. If it were replaying espeak's per-language convention, Kyrgyz would come back `ɑ`. It does
not — the model appears to apply one pooled acoustic mapping rather than a per-language convention. (Not
provable from here: Kyrgyz may have been absent or tiny in the fine-tuning split.)

**But it is not an independent witness against espeak.** Wherever espeak and the recognizer agree, they are
one source, not two. That is exactly the arz/sw error — counting one tradition twice — arriving from a new
direction, and it changes what each language's evidence is worth.

## Run 6 — 2026-08-20 — the batch does not hold; all three held

Re-reading the table with the confound applied:

- **ky — DO NOT CHANGE.** epitran `ɑ`, espeak `ɑ`, wikipron mostly `ɑ` (440:156). Three written sources,
  two of them independent of each other, all against one recognizer with a documented prior toward `a`
  (it writes `a` 3.58M times against `ɑ` 151k corpus-wide). The recognizer loses this one.
- **ur — DO NOT CHANGE.** wikipron `ɑ`, epitran `ɑː`, **and the CLE Lahore Phonetically Rich Urdu Speech
  Corpus writes `ɑ` (2,711:0)** — a human transcription of actual read speech, independent of Wiktionary
  AND of espeak. That is a better witness to Urdu acoustics than a multilingual recognizer. Separately, the
  structural screen was wrong here: Urdu's `ɑː` is contrastive with `ə`, so the symbol is not free.
- **hy — DO NOT CHANGE, though it is the close call.** Only Wiktionary says `ɑ` (23,622 tokens); espeak's
  Armenian voice writes `a` and is a genuine voice (`մարդ→mˈard`, `քաղաք→kʰaʀˈakʰ`, `հաց→hˈatsʰ`), not an
  English fallback. But there is no epitran hye, so the ledger is one written tradition against one written
  tradition, plus a recognizer that is downstream of one of them. **1-vs-1 is not enough to overturn an
  18,090-word human referee.** hy needs a source that is neither Wiktionary nor espeak.

**I proposed three languages and the evidence supports none of them.** Recorded because the screen in run 3
looked sufficient and was not: it tests our own inventory for a competing symbol, which is necessary, but it
says nothing about how much *written* attestation the current symbol has.

### The screen, corrected

A low-vowel notation change needs all three:

1. **Structural** — no other low vowel in the inventory for the symbol to contrast with. (Fails for ur:
   `ɑː` vs `ə`.)
2. **Written** — at most one written tradition supports the current symbol, and at least one written source
   *independent of espeak* supports the change. (Fails for ky and ur; fails for hy for want of a second
   source.)
3. **Acoustic** — the recognizer agrees, with the fr/de/pt control showing it resolves the contrast
   elsewhere.

## What this does to nso and sw

**nso is unaffected and is the strongest case in the set.** There is **no espeak Sepedi voice at all**, so
the recognizer cannot have learned an nso convention — its output there is acoustic generalisation. The
independent written source (epitran tsn) agrees. Nothing to revise.

**sw stands, but its writeup overstated the audio's independence.** espeak's Swahili voice writes `a`
(`habˈari wˈatu kitˈabu`), so the recognizer and espeak are one source there, not two. What survives is:
epitran swa-Latn (a rule system independent of espeak) writes `a/e/o`; the structural argument holds
(Swahili has no low or mid contrast, so the symbols distinguish nothing); and the only source for `[ɑ ɛ ɔ]`
was a single Wiktionary lineage counted twice. That is still enough — but it is 1 independent written source
plus a confounded recognizer, not 2 independent sources, and the PR said otherwise.
