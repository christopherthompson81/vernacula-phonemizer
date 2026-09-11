# en: the `-es` plural after a sibilant — `ə` or the weak vowel `ᵻ`?

Issue #1275. The lexicon writes `services → sˈɝvəsəz`; misaki/espeak would plausibly write
`sˈɜɹvᵻsᵻz`. The question is whether `isBarredI` should cover this environment — **not** whether
some rows are wrong, because the convention is 100% uniform across the family.

⚠ The decision rule set by the issue: *decide on the number, not on the transcription convention*,
and "leave it alone" is a legitimate outcome.

## Run 1 — 2026-09-11 12:24 — is the lexicon mechanically regenerable?

Everything downstream depends on this: `services` is a FLAT-LEXICON hit, resolved before the OOV
G2P ever runs, so a rule change alone cannot reach it. Either the lexicon can be rebuilt from its
ARPABET source or the whole approach is 345 hand edits.

Command: rebuild every `accent-lexicon.tsv` row from `g2p-dict.tsv` through `makeArpabetToIpa`
and diff against the committed IPA.

```
reproduced: 117479   differ: 0   no-arpabet-row: 7449
round-trip fidelity: 100.00%
```

Reproduces the issue's figure exactly. The 7,449 unreproducible rows have no `g2p-dict.tsv` entry
at all (contractions like `wasn't`, hand-added entries); a regeneration leaves them untouched.

**Implication:** a rule change CAN be propagated into the lexicon verifiably. Proceed.

## Run 2 — 2026-09-11 12:31 — can the referee see this distinction at all?

The issue's evidence is "referee writes `ɪ` in 10 of 14 family rows". Before acting on that I wanted
the **control** it was missing: what does the referee write in the slots where we ALREADY commit to
`ᵻ`? If it writes `ɪ` there too, `ɪ` is just wikipron's weak-vowel spelling and says nothing about
`ᵻ` vs `ə`. If it writes `ə` there, the instrument is blind and the whole argument is void.

Positional alignment of our nuclei against the referee's, bucketed by **what we wrote in that slot**:

```
A. we wrote ᵻ (established environments)    slots=  81  ɪ= 70.4%  ə= 21.0%
B. we wrote ə (ALL environments)            slots= 688  ɪ= 10.6%  ə= 81.8%
C. we wrote ə, word-final, ends -es         slots=   5  ɪ= 80.0%  ə= 20.0%
D. we wrote ə, word-final, NOT -es          slots= 382  ɪ=  7.1%  ə= 88.0%
E. we wrote ə, non-final                    slots= 301  ɪ= 14.0%  ə= 75.1%
```

**The instrument is not blind — it discriminates sharply.** Where we write `ᵻ` the referee writes
`ɪ` 70.4% of the time; where we write `ə` it writes `ɪ` 10.6%. That is a real separation, so the
referee's `ɪ` *is* evidence about which of our two symbols belongs in a slot.

And the `-es` slot lands with the `ᵻ` group (80%), not with the rest of our own `ə` usage (7.1%).
This is the measurement that turns the issue's bare n=14 into a test: the comparison is no longer
"14 rows say ɪ" but "this environment behaves like our ᵻ environments and unlike our ə environments".

## Run 3 — 2026-09-11 12:34 — the family, defined on ARPABET rather than spelling

Spelling-based filters catch unrelated shapes. Defining the family the way a rule would see it —
`SIBILANT + AH0/IH0 + Z` word-final, spelled `-es`:

```
family size: 345          (matches the issue exactly)
en-US referee coverage: 5 rows — ɪ 5 (100%)
  chances t͡ʃ æ n s ɪ z · masses m æ s ɪ z · premises p ɹ ɛ m ə s ɪ z
  princes p ɹ ɪ n s ɪ z · sciences s a ɪ ə n s ɪ z
P(X>=5 | n=5, p=0.071) = 1.8e-06   [null: behaves like our other word-final ə slots]
```

n=5 is small, so the **en-GB referee** was brought in as a second, much larger sample:

```
en-GB referee coverage of the same 345: 133 rows
  'ɪ': 125 (94.0%)    'i': 4 (3.0%)    'ə': 4 (3.0%)
  the 4 'i' rows are the /iːz/ variant (classes, phases, processes, approaches)
  the 4 'ə' rows: entrances, gazes, misses, thrushes
```

**Greek plurals need no exclusion.** The issue flagged `Alces`/`apheses`/`diaereses` (→ /iːz/) as a
morpheme a rule must avoid counting. They cannot reach the rule: CMUdict writes them with **IY**,
and `isBarredI` returns false for anything but `IH`/`AH`. `crises K R AY1 S IY0 Z`,
`analyses … S IY2 Z`, `hypotheses … S IY2 Z` — all IY. The source data already separates them.

**Verdict on the evidence: change it.** Not on n=14 in isolation, which the issue rightly called
insufficient, but on the contrast (70.4% / 7.1% / 94.0%) across two independent referees.

## Run 4 — 2026-09-11 12:52 — the rebuild, and a scope the issue did not anticipate

`tools/english/en_rebuild_lexicon.mts` (new) rebuilds `accent-lexicon.tsv` from `g2p-dict.tsv`
through the same `makeArpabetToIpa` the engine uses. With `isBarredI` extended:

```
rows with an ARPABET source: 117479
  reproduce the committed IPA: 116401
  would change:                1078
rows with no ARPABET source (passed through): 7449
```

**1,078 rows, not the 345 the issue scoped.** The split is the finding:

```
  ə → ᵻ : 345    (exactly the issue's family)
  ɪ → ᵻ : 733
```

The 733 are the SAME environment; CMUdict simply wrote `IH0` there instead of `AH0`:

```
  advances  AH0 D V AE1 N S AH0 Z      abuses  AH0 B Y UW1 S IH0 Z
  bridges   B R IH1 JH AH0 Z           badges  B AE1 JH IH0 Z
```

So the lexicon currently renders **one morpheme two different ways** — `ə` in 345 words and `ɪ` in
733 — on an arbitrary CMUdict coin flip. That is a stronger argument for the change than the one the
issue made: it is not only "ə should be ᵻ" but "the same suffix should not have two spellings".
Restricting the rule to `AH0` to hit exactly 345 would PRESERVE that inconsistency.

Containment verified: **0 of the 1,078 lie outside the ARPABET-defined family**, and all 1,078 new
values end in `ᵻz`.

## Run 5 — 2026-09-11 12:58 — the whole-word referee eval, and why it cannot adjudicate this

```
before: folded backbone 1829/4558 (40.1%)   symbol accuracy 81.6%
after:  folded backbone 1826/4558 (40.1%)   symbol accuracy 81.6%
```

**−3 words.** The cause is a property of the instrument, not of the change: `tools/referee-eval/langs/en.jsonc`
has **no `ᵻ`↔`ɪ` fold**, so every `ᵻ` we emit is scored as a mismatch against the referee's `ɪ` —
all 4,525 established `ᵻ` rows included. The −3 are rows that previously agreed with the referee *by
accident*, because CMUdict wrote `IH0` and we rendered it `ɪ`.

⚠ **I did not add that fold.** Adding one in the same change would be tuning the instrument to the
answer, and the whole-word metric is the wrong instrument anyway: it is the slot-level control of
Run 2 that separates our `ᵻ` slots (70.4% referee `ɪ`) from our `ə` slots (7.1%), and that is what
adjudicates a `ᵻ`-vs-`ə` question. The missing fold is worth its own issue — it currently biases the
`en` score against the house convention everywhere, not just here.

Floor unaffected: `en` floor is 0.30 and the measure is 0.4006.

## Run 6 — 2026-09-11 13:04 — the parity gate was ALREADY RED on main

Regenerating the C# goldens surfaced changes I had not made — `wˈɑːz → wʌz`. Checked on a clean
tree with all my work stashed:

```
clean main, no local changes:
  en-GB    DIFF  26/200 rows differ
  en-IN    DIFF  26/200 rows differ
  en       DIFF  26/200 rows differ
  0 languages byte-identical, 3 differ (522 rows ok, 78 differ)
```

**#1274 (the copula `was`) landed without regenerating `csharp/goldens/`.** It changed shared `data/`,
which BOTH engines read, so C# and TS still agree with each other — what they no longer agree with is
the committed TS snapshot. Not a port divergence, but the gate is red and this branch cannot be
measured until it is repaired. Classifying every token in the regenerated goldens:

```
token changes:  was(#1274)=90   -es(mine)=89   other=0
```

This branch therefore repairs #1274's staleness as well as carrying its own. Said explicitly in the PR
rather than folded in silently.

## Run 7 — 2026-09-11 13:22 — a red row I misattributed, and the correction

Regenerating the 13 non-English goldens that carry embedded English spans left one row red — an English
parenthetical in `sat`, `(Pt. Udai Mazumdar)`, where the committed golden had `pt` and my regeneration
produced `t`. Clean main reproduced `t` too, so I concluded it was a pre-existing C#/TS PORT DIVERGENCE:
TS async warming the English neural OOV cache that the sync foreign reader hits, the port not doing so.

**That was wrong, and the file that disproves it says so in its own docstring.** `core/foreign.ts`:

> ⚠ FOR BATCH TOOLS THAT RENDER MANY LANGUAGES IN ONE PROCESS, and it is not an optimisation — it is what
> makes their output REPRODUCIBLE. The memo is global and survives across languages, so a mixed-script
> language whose prewarm tagged `duxbury` leaves that BiLSTM reading behind, and a LATIN-script language
> rendered afterwards picks it up through the foreign reader … `tools/gen_parity_goldens.mts` captured 15
> such rows in the Māori golden, none of which the engine reproduces on its own.

`gen_parity_goldens.mts:286` calls `clearForeignOov()` **per language** for exactly this reason. My
regeneration harness did not — so an earlier language's neural prewarm reached `sat`, the documented
failure reproduced verbatim. (Run 8 shows the clear alone does not even close it fully.)

## Run 8 — 2026-09-11 13:41 — `clearForeignOov()` alone was NOT enough; one process per language is

Adding the per-language clear to the harness and re-running all 16 in one process still produced the
contaminated `sat` row. Rendering `sat` BY ITSELF settles it:

```
sat rendered alone                  → pt . jˈuːd̬əˌɪ …    matches C# and the original golden
sat rendered after 10 other langs   → t  . jˈuːd̬əˌɪ …    the contaminated value
```

So the global foreign-OOV memo is not the only state that survives across languages — the English engine's
own neural cache does too, and `clearForeignOov()` does not reach it. ⚠ A BATCH REGENERATION MUST THEREFORE
GIVE EACH LANGUAGE ITS OWN PROCESS, not merely call the clear between them.

Re-running one language per process:

```
en en-GB en-IN chr cjy gan hak mag nan pcm shn syl te tt wuu : 0 rows updated
sat                                                          : 1 row updated  (t → pt)
```

**Only `sat` was ever contaminated**; the other 15 goldens were correct as committed. The earlier
"0 updated" for those 15 proved nothing on its own — it only showed that two runs with the SAME ordering
agreed — which is why the per-process re-run was needed to confirm rather than assume.

**There is no port divergence.** The original `sat` row was right throughout; only my harness was wrong.

## Decision

**Change it.** `-es` after a sibilant takes `ᵻ`, propagated into the lexicon by the new regenerator.

Not on the issue's n=14 — which was rightly called insufficient — but on:
- the slot-level control separating our `ᵻ` slots (70.4% referee `ɪ`) from our `ə` slots (7.1%), with
  this environment at 80-100%;
- en-GB corroboration at n=133, 94.0%;
- and the discovery that the lexicon was spelling ONE morpheme two ways (345 `ə` / 733 `ɪ`) on a
  CMUdict coin flip. The change removes an internal inconsistency, which is a stronger reason than the
  one the issue was filed on.

Costs, stated rather than buried: the whole-word referee eval moves **−3 words** (1829→1826) because
`en.jsonc` carries no `ᵻ`↔`ɪ` fold and scores every `ᵻ` as a miss; scope is **1,078 rows (0.86%)**,
not the 345 (0.28%) the issue authorised.

## Run 9 — 2026-09-11 13:10 — review, and the two halves of the morpheme I had missed

Six findings. The two that mattered were both the SAME defect this change claims to remove, surviving on
paths the lexicon does not cover.

**1. The morph OOV branch never saw the rule.** `englishG2p.g2p` passed an empty word to `arpabetToIpa`
for both the compound AND the morph decomposition, so `isBarredI` could not see the `-es`:

```
  before:  quiches kʰˈiːʃɪz   crevasses kɹəvˈæsɪz     (OOV, stem in dict)
           niches  nˈɪt͡ʃᵻz    trusses   tɹˈʌsᵻz        (recorded)
```

The empty word is right for a COMPOUND — `subreddit` ends "-it" but is not -it suffixed — but a morph
decomposition only fires when the word ends in a KNOWN suffix whose stem is in the dictionary, so the
suffix is real by construction. Narrowed the guard to `d.source === "C"`. `subreddit` verified unchanged.

**2. The possessive is the same morpheme, and it is not in this rule at all.** An `'s` arm in `isBarredI`
would have been DEAD CODE — `english.ts` strips the clitic and looks up the STEM, so the word reaching the
converter never carries the apostrophe. I wrote that arm first, watched `glorse's` ignore it, and found the
real site: `sibilantAllomorph` returned a hard-coded `ɪz`.

```
  before:  advance's ədvˈænsɪz  beside  advances t͡ʃˈænsᵻz-shaped ᵻ
  after :  advance's ədvˈænsᵻz   Marx's mˈɑːɹksᵻz   (cat's, dog's, putin's untouched)
```

⚠ This also means the ~954 possessive rows in `accent-lexicon.tsv` are never consulted: the lookup strips
`'s` first. The earlier reading that they were "unreachable by the regenerator" was true and irrelevant.

**3. The heteronym table shadowed the rebuilt lexicon.** `"houses": { "default": "hˈaᶷzəz" }` wins over the
regenerated row, so `houses` kept `ə` while `bases` moved — same suffix, two spellings, in both varieties.
It is the only `-es`-shaped entry in that table. Fixed to `hˈaᶷzᵻz`, keeping the voiced `z` the override
exists for.

**4. KNOWN LIMIT, kept deliberately.** `stress > 0` also refuses a SECONDARY-stressed suffix vowel, which
CMUdict writes for two rows (`axes AE1 K S IH2 Z`, `pisses P IH1 S IH2 Z`); they keep `ɪ`. Loosening that
guard would loosen it for the four other rules it governs, which is not worth two rows. Noted in the source.

**5. Nothing ran the round-trip.** The regenerator was manual-only, so the next edit to `isBarredI` would
again leave the flat-hit path disagreeing with the G2P path silently. Added
`test/en-lexicon-regenerable.test.ts`, which asserts every sourced row reproduces byte-identically.

**6.** C# doc comment had been displaced by the new fields; moved them beside the other patterns.

## Run 10 — 2026-09-11 13:20 — the eval cost after the review fixes

```
baseline (main)        : folded 1829/4558 (40.1%)   symbol 81.6%
after the -es rule     : folded 1826/4558 (40.1%)   symbol 81.6%    (−3)
after the review fixes : folded 1822/4558 (40.0%)   symbol 81.6%    (−7 total)
```

The extra −4 is the OOV/possessive half: `sibilantAllomorph` and the morph branch now emit `ᵻ` where they
emitted `ɪ`, and the referee writes `ɪ` with no fold to reconcile them. Same instrument limitation as Run 5,
now reaching more words BECAUSE the change is more complete.

⚠ Stated plainly: making the change CORRECT made the headline number WORSE. That is the expected sign
whenever an engine moves toward a convention the referee does not notate, and it is the reason the decision
rests on the slot-level control rather than on this figure. Floor 0.30 against 0.3997 — unaffected.
