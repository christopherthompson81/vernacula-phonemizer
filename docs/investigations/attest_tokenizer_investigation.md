# `attest.ts` tokenizer — word-internal punctuation is invisible to the boundary test

The reported symptom: `attest.ts --lang mad --words "sampè'"` prints `0 token / 17 substring-only` — a
verdict that reads as *unattested* — while the same run quotes example sentences containing the word.
`attest.ts` is one of the instruments that decides whether a word is allowed into a speaker's mouth, and the
standing rule is to leave a word unauthored when it is unattested, so a systematic under-report here produces
one-directional false refusals.

---

## Run 1 — 2026-08-11 09:40 — why the two tools disagree

**Question.** `corpus-words.ts` scores `sampè'` as `attested ×14`; `attest.ts` scores the same word
`0 token / 17 substring-only`. Same language, same word, opposite verdicts. Which one is wrong, and why?

**Command.**

```
grep -n "split(/\[^" tools/normalization/attest.ts tools/normalization/corpus-words.ts
```

**Raw finding.** The two tools tokenize with different character classes.

```
attest.ts:149        fold(text).split(/[^\p{L}\p{M}]+/u)
corpus-words.ts:197  u.split(/[^\p{L}\p{M}‌'’-]+/u)
```

`corpus-words.ts` treats U+200C ZWNJ, `'`, `’` and `-` as **word-internal**; its comment records why the ZWNJ
was added (Persian `سانتی‌گراد` was being reported as a negative while the corpus contained it twice). That
fix was never carried across to `attest.ts`, whose class is letters and marks only. So `sampè'` splits into
the token `sampe` plus nothing, and the probed word `sampe'` can never be a member of the token set — not for
this word, not for any word whose orthography puts punctuation inside it.

**Second finding, from the artifact itself.** `tools/corpus/attest/mad.jsonc` records the probed word as
`sampè'` with U+0027, while the examples the same run quoted are written `sampe’` with U+2019:

```
…ga malem sampe’ tengnga arè, bisa ḍâri tengnga malem sampe’ pokol 10:00…
```

`fold()` does `toLowerCase` + NFD + `\p{M}+` removal. It does **not** unify apostrophe variants, so even with
a boundary test that admits a trailing glottal, a `'`-spelled probe would still miss an `’`-spelled wiki.
There are two stacked defects, not one.

**Implication.** The diagnosis is confirmed and is a property of `tokens()`, not of Madurese. Before choosing
a fix, measure how far it reaches.

---

## Run 2 — 2026-08-11 09:52 — blast radius over every recorded finding

**Question.** How many words in the fleet's recorded attestation evidence contain word-internal punctuation,
and what verdict did each get? If the tokenizer is the cause, the affected set should be *uniformly*
negative — a skew, not a scatter.

**Command.** Parse every `{word, verdict, bounded, tokenHits, articles, substringOnly}` block out of
`tools/corpus/attest/*.jsonc` (71 languages, 522 findings) and split on whether the probed word contains
an apostrophe-class or hyphen-class character.

**Raw finding.**

```
total findings parsed: 522
findings with punctuation in the probed word: 11   → 5 languages
verdicts, punctuation-bearing words:  {'substring-only': 11}
verdicts, plain bounded single words: {'attested': 271, 'absent': 55, 'substring-only': 4}  (n=330)

ln    kilomɛtrɛ-kare      substring-only  tok=0 arts=0 sub= 8
mad   sampè'              substring-only  tok=0 arts=0 sub=17
mg    tora-telo           substring-only  tok=0 arts=0 sub= 2
mg    isan-jato           substring-only  tok=0 arts=0 sub=19
nan   pah-hun-chi         substring-only  tok=0 arts=0 sub= 1
nan   Hôa-sī              substring-only  tok=0 arts=0 sub= 1
nan   Liap-sī             substring-only  tok=0 arts=0 sub=10
nan   kong-kin            substring-only  tok=0 arts=0 sub= 4
om    baay’isuu           substring-only  tok=0 arts=0 sub= 3
om    ida’uu              substring-only  tok=0 arts=0 sub= 6
om    hir’isuu            substring-only  tok=0 arts=0 sub= 2
```

**11 of 11 — every single one.** Not one word containing an apostrophe or a hyphen has ever received a token
hit from this tool, in any language, ever. The comparison set — plain bounded single words — comes back
82% `attested`. A 0% rate against an 82% baseline is not a property of these eleven words; it is the
instrument refusing to see a character class.

The affected set is also not one language's quirk: Lingala (`n'` elision and hyphenated compounds), Madurese
(orthographic glottal), Malagasy (hyphenated compounds), Min Nan (POJ syllable hyphens) and Oromo (glottal
`’`). Every one of these is a `substring-only`, i.e. a NEGATIVE, printed to an author who was deciding
whether the word could be used.

**Implication.** The fix is worth making and must handle both the apostrophe class and the hyphen class. It
must not, however, buy recall with precision: the file's own header records four occasions where a substring
match was mistaken for an attestation (`ff tere`, `hr jen` in `jendek`, `lb Yen` in `Libyen`, `xh iiyeni` in
`yeNintendo`). Over-reporting is the worse direction here — a false positive lets a word be authored on
evidence that is not there.

---

## Run 3 — 2026-08-11 10:05 — is `tokens()` shared? what else moves?

**Question.** If `tokens()` backs other tools, changing it re-baselines counts recorded in `defects.ts`
comments and in the per-language investigation docs.

**Command.**

```
grep -rn "function tokens\|tokens(" tools/ src/ --include=*.ts
```

**Raw finding.** `tokens()` is declared at `tools/normalization/attest.ts:148` and referenced only at
`attest.ts:250`. It is not exported and not imported anywhere. `corpus-words.ts`, `mine.ts` and `sources.ts`
each carry their own tokenizer; `corpus-words.ts`'s already admits `'`, `’`, `-` and ZWNJ, which is why the
two tools disagreed in the first place.

**Implication.** The change is contained to `attest.ts`. No other tool's counts move, and no recorded
evidence for any other language needs re-baselining. What *does* move is `attest.ts`'s own recorded artifacts
for the 11 findings above — those were taken under the broken behaviour and are stale, but re-probing them is
a separate act (each needs its examples read) and is not done here.

---

## Run 4 — 2026-08-11 10:20 — the boundary, and why not simply widen the split class

**Question.** `corpus-words.ts` fixes this by adding `'’-` to the split class. Is copying that the right fix?

**Raw finding — no, and the reason is in the code already.** Widening the split class makes the tokenizer
swallow punctuation *wherever* it sits, including where it is not part of the word:

* a closing quote — `said 'ak'` would produce the token `ak'`;
* an English-style possessive — `dogs'` produces `dogs'`;
* a sentence-final apostrophe or a dash used as punctuation.

That is the over-report direction, and it is the more dangerous one for this tool.

The decisive observation is that `attest.ts` **already contains the correct test and does not use it for the
case in question.** `probe()` builds

```ts
const hitRe = new RegExp(bounded ? `(?<![\\p{L}\\p{M}])${body}(?![\\p{L}\\p{M}])` : body, "gu");
```

and uses it to *count* the hits (`[...fold(text).matchAll(hitRe)].length`) and to *quote* the examples — but
the gate deciding whether the article counts at all is `tokens(text).has(w)`. The file counts with lookarounds
and gates with a token set, and the two disagree exactly on words containing punctuation.

For a probe word made only of letters the two are **provably equivalent**: a token is a maximal run of
letters, so `w` is a member of the token set iff `w` occurs flanked by non-letters, which is what the
lookarounds say. So replacing the gate with `hitRe` is a no-op for the 511 plain findings and a fix for the
11 punctuation-bearing ones. That is the boundary to take: it widens nothing, it deletes an inconsistency.

**One tightening is still needed, in the precision direction.** The bare lookarounds treat any non-letter as
a boundary, so probing `sampe` against the text `sampe'an` would match — the `Libyen` error arriving through
punctuation instead of through a letter. So the boundary also rejects a flanking apostrophe *that is itself
glued to a letter*:

```
left:   (?<![\p{L}\p{M}])(?<![\p{L}\p{M}][APOS])
right:  (?![\p{L}\p{M}])(?![APOS][\p{L}\p{M}])
```

**The hyphen is deliberately NOT in that rejection class**, and this is a judgement rather than an oversight.
An apostrophe binds tightly — glottal stop, elision, ʼokina — so a letter on the far side of it is the same
word. A hyphen is a compound or syllable joiner whose two halves are frequently words in their own right
(German `Nord-Süd`, and the whole hyphenated-compound habit of Malagasy and Lingala). Putting the hyphen in
the rejection class would newly make `chit` fail to match inside POJ `chit-ê` — a *behaviour change in the
false-refusal direction*, which is the failure this whole exercise exists to remove. Hyphens therefore keep
exactly their present behaviour on the *left-hand* side of the question (a hyphen is still a boundary), while
hyphenated *probe words* start working because `hitRe` never splits them.

**Second change: `fold()` unifies the apostrophe variants** (`'` U+0027, `’` U+2019, `‘` U+2018, `‛` U+201B,
`ʼ` U+02BC, `ʻ` U+02BB, `´` U+00B4) to a single `'`. Run 1 showed a `'`-spelled probe missing an `’`-spelled
wiki; U+02BC/U+02BB are additionally `\p{Lm}` **letters**, so before this change a Hawaiian-style ʼokina was
silently welded into whatever token surrounded it. Because examples are quoted from the ORIGINAL text with
the ORIGINAL word (the file's existing rule, protecting against fold/original index skew), the quoting regex
gets the same treatment: an apostrophe in the probe word becomes an apostrophe *class* so the example is
still found whichever variant the wiki chose.

**Implication.** Implement: `fold()` apostrophe unification, an apostrophe-aware boundary builder used by
both the hit regex and the quote regex, `tokens()` deleted, gate = `hitRe` for all branches.

---

## Run 5 — 2026-08-11 10:55 — before/after on live wikis

**Question.** Does the fix change `mad` (the reported case) and the hyphen languages, and does it leave a
control language untouched?

**Command.** `npx tsx tools/normalization/attest.ts --lang <L> --words <…> --limit 12`, run on the same
words before and after the change. (`--limit 12` keeps the sample identical between runs and the run short;
the artifact write is the same code path either way.)

**Raw finding.** (`token / arts / substr-only` as the tool prints them.)

| lang | word | before | after |
|---|---|---|---|
| mad | `sampè'` | `0 / 0 / 6` · substring-only | `28 / 8 / 0` · **attested** |
| mad | `pokol` (plain word, same run) | `25 / 8 / 0` · attested | `25 / 8 / 0` · attested — unchanged |
| nan | `Liap-sī` | `0 / 0 / 4` · substring-only | `10 / 4 / 0` · **attested** |
| nan | `kong-kin` | `0 / 0 / 3` · substring-only | `5 / 3 / 0` · **attested** |
| nan | `pah-hun-chi` | `0 / 0 / 1` · substring-only | `1 / 1 / 0` · **attested** |
| id (control) | `dibagi` | `20 / 5 / 0` · attested | `20 / 5 / 0` · attested — unchanged |
| id (control) | `koma` | `108 / 8 / 0` · attested | `98 / 8 / 0` · attested — **moved, see Run 6** |

The examples the fix attaches are the evidence that was there all along, now filed under the word it belongs
to — mad: `bisa sampè' 2 m`, `novèlla paju sampè' 400 èbu eksemplar`, and (in the SAME run, both spellings)
`è katègghiyân 5m sampè’ 500m`; nan: `chúi kiat-peng ê un-tō͘ … siat-tēng-chòe Liap-sī 0 tō͘ (0 °C)` and
`Kong-kin (hû-hō: kg) sī chit-liōng ê SI ki-pún tan-ūi`. Those are the unit words in the unit slot.

**Implication.** The three affected languages move from a verdict that reads *unattested* to one that reads
*attested*. But the `id` control moved too, by 10 hits, and a control that moves is either a bug or an
artefact — it cannot be waved through.

---

## Run 6 — 2026-08-11 11:20 — the control that moved, and why it is not the fix

**Question.** `id koma` went 108 → 98. Indonesian has no word-internal apostrophe in `koma`. Did the
tightening (`(?!APOS[\p{L}\p{M}])`) start rejecting real hits, or is the sample different between the two
runs?

**Command.** Fetch the `koma` article set ONCE and count it with BOTH rules — the old letters-only boundary
and the new one — so the sample cannot vary between them.

**Raw finding.**

```
TOTAL old=98 new=98
```

Not one differing position, in any article. **The two rules are identical on this text; the 108 came from a
different sample.** `attest.ts` takes its articles from live CirrusSearch ranking, so two runs minutes apart
can read different pages — `articles` stayed at 8 in both runs, but not the same 8. The control did not move;
the wiki did.

**A/B over a wider control set, same method, sample held fixed:**

```
bm kɛnɛ    old-articles=6  new-articles=6  same      id koma    old=6 new=6  same
bm kubu    old-articles=0  new-articles=0  same      id dibagi  old=4 new=4  same
bm dolar   old-articles=4  new-articles=4  same      es coma    old=6 new=6  same
bm wari    old-articles=6  new-articles=6  same
bm pilisi  old-articles=0  new-articles=0  same
bm dɔgɔya  old-articles=6  new-articles=6  same
```

Nine probes, three languages, zero movement — **including `kubu` and `pilisi`, which are genuine `0` under
both rules.** That is the important half: the fix does not manufacture positives where there was nothing.

**Implication (and a warning for the next person).** A before/after comparison of this tool against live
wikis is NOT a clean experiment — the sample drifts underneath it. The trustworthy comparison holds the text
fixed and varies only the rule. The counterfactual check below does the same job offline and is the one
pinned in the test file.

---

## Run 7 — 2026-08-11 11:35 — is every part of the fix load-bearing?

**Question.** Three things changed: the gate, the apostrophe tightening, the apostrophe fold. Does each one
actually do something, or am I pinning tests that would pass anyway?

**Raw finding.**

```
OLD tokens gate: sampè'    → false     (the defect)
OLD tokens gate: Liap-sī   → false
OLD tokens gate: isan-jato → false
OLD tokens gate: baay’isuu → false
loose boundary (no tightening), sampe vs sampe'an: true    ← over-report the tightening removes
loose boundary (no tightening), baay  vs baay’isuu: true   ← same
no apostrophe fold, sampè' (U+0027) vs sampe’ (U+2019) wiki: false  ← the variant miss
```

All three are load-bearing, and the middle pair is the reason this is a boundary change and not a wider split
class: without the tightening the fix would have bought its recall by handing back the exact `Libyen`-class
false positive the tool exists to prevent, only through punctuation instead of through a letter.

**Implication.** `test/normalization-attest.test.ts` pins all three, plus the equivalence claim from Run 4
(new boundary ≡ old token set for letter-only words, asserted probe by probe) so the "511 findings cannot
move" argument is mechanically checked and not merely reasoned.

**Gates.** `npx tsc --noEmit` clean; `npx vitest run` → 238 files, 3646 passed, 5 skipped.

---

## Negative results kept

* **Copying `corpus-words.ts`'s split class was tried on paper and rejected** (Run 4). It fixes the recall
  problem and opens the over-report one, and the over-report direction is the one that puts an unattested
  word into a speaker's mouth. It also would not have fixed `sampè'` against an `’`-spelled wiki, since it
  does not touch `fold()`.
* **Putting the hyphen in the apostrophe rejection class was tried and rejected** (Run 4). It would newly
  refuse `chit` inside `chit-ê`, moving `nan` and `bm` counts in the false-refusal direction while fixing
  nothing. The recorded evidence for those languages stays valid.
* **`tokens()` is not shared** (Run 3), so the tempting worry — that fixing this re-baselines `mine.ts`,
  `sources.ts` and `corpus-words.ts` counts recorded in `defects.ts` comments — is unfounded. Checked, not
  assumed.
* **A before/after run against a live wiki is not a controlled experiment** (Run 6). The `id` control
  appeared to move by 10 hits and did not: CirrusSearch handed the two runs different articles. An hour was
  nearly spent explaining a delta that the tool's own sampling produced. Hold the text fixed, vary the rule.
* The 11 stale `substring-only` artifacts listed in Run 2 are **not** re-probed here. They are now known to
  be measured with a broken instrument, but each replacement finding needs its examples read by a human
  before it can be treated as evidence, and a bulk re-run would launder 11 unread verdicts into the tree.
  The `mad`, `nan`, `bm` and `id` artifacts touched by the runs above were restored to their committed
  state for the same reason — and because these runs used `--limit 8`, whose counts are not comparable with
  the rest of the tree's default `--limit 40`.

## What moves elsewhere

Nothing. `tokens()` was private to `attest.ts` (Run 3), so no count recorded by `mine.ts`, `sources.ts`,
`corpus-words.ts`, `review.ts` or in any `defects.ts` comment changes, and no other language's recorded
evidence needs re-baselining. The one thing that *is* now known to be stale is `attest.ts`'s own 11 findings
listed in Run 2, left in place deliberately.
