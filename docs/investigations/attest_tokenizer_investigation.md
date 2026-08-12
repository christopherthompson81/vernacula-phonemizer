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

---

## Run 8 — 2026-08-12 17:00 — the carry-forward regex has never matched the file it writes

**Question.** Runs 1–7 fixed the boundary and left 11 findings deliberately un-re-probed. A separate report
says the cache cannot be built incrementally at all — that `attest.ts`'s merge regex expects a finding's
closing brace at **8** spaces while the writer emits **12**. Reproduce before trusting it.

**Command.** Parse a cache the tool wrote itself with the tool's own pattern, and with the proposed fix:

```
{ blocks: prior.matchAll(/\{\s*"word":[\s\S]*?\n        \}/gu),   // the shipped pattern
  fixed:  prior.matchAll(/\{\s*"word":[\s\S]*?\n {8,12}\}/gu) }   // the proposed one
```

**Raw finding.** On `cdo.jsonc`: `blocks parsed: 0 · words present: 16 · blocks with proposed fix: 16`.

Confirmed, and the mechanism is exactly as reported. The writer's template literal is itself indented four
spaces, so a finding's keys land at 16 and its closing brace at 12; the parser was written against a mental
model of the file rather than against the file. The blast radius is total — **not one cache in the tree has
ever been parseable by the tool that wrote it.**

The failure is loud, which disguised how bad it is. Zero parsed blocks trips the guard added with the
carry-forward itself (`REFUSING TO WRITE: N existing finding(s) could not be parsed`), so nothing is
deleted. But the guard's advice — "restore it from git and re-run" — is unfollowable, because a re-run hits
the same wall. The only way past it is one run covering every word, and a probe costs live Wikipedia
fetches, so that run is one a rate limiter can void. It did: a sibling investigation records an agent
deleting a cache to force the single clean run the tool demanded, the wiki answering 429, and nine recorded
findings surviving only in prose.

**Implication.** Fix, but not by patching the number: writer and parser must come from one place, or they
will drift again the next time the template is touched. Extracted `renderFinding()` and `BLOCK_RE`; the
brace width stays a *range* because both widths are now in the tree (71 files close at 12; a block re-emitted
through carry-forward keeps whatever it was born with). Nothing inside a block sits at 8–12 spaces and is a
brace, so the lazy match still stops at the block's own closer.

---

## Run 9 — 2026-08-12 17:06 — a real incremental probe, and the trap under it

**Question.** With the parser fixed, does probing word A then word B leave A in the tree?

**Command.** `npx tsx tools/normalization/attest.ts --lang cdo --words lī-mī`, then the same for
`gŭng-gĭng`, then `lĭk-huŏng` — default `--limit`, three separate processes.

**Raw finding.** Each run: `(re-probed 1 existing finding(s)), 15 earlier finding(s) kept`, and after all
three the file holds 16 words with A's fresh block intact. Carry-forward works.

**But the first run reproduced the second defect instead of fixing it.** `lī-mī` came back `absent` again —
0 token, 0 articles, **0 substring**. A word reported absent with zero substring hits is a word the probe
never had any text for.

**Implication.** The `absent` was never about the language. Go look at the query.

---

## Run 10 — 2026-08-12 17:07 — the remote tokenizer splits the same words the local one did

**Question.** `9539e03` fixed *this tool's* boundary so a hyphenated probe could be a token. CirrusSearch
tokenises too. Does the search itself split the probe?

**Command.** The same three cdo words, each as a plain word query and as `insource:"…"` / `insource:/…/`,
counting articles returned:

**Raw finding.**

```
lī-mī                200  40   Mī-guók | Hŭk-lò̤-lī-dăk | Gŭng-lī
insource:"lī-mī"     200   2   Kă-giù | Dô-dâing
gŭng-gĭng            200  40   Gŭng-buô (工) | Liù-giù Gĭng Ciŏng-gŭng Miêu | Báe̤k-gĭng
insource:"gŭng-gĭng" 200   1   Mà-hṳ̀ng
lĭk-huŏng            200  40   Săng-huŏng-chék-háe̤ng | Lĭk-sé̤ṳk-cŭk | Lĭk-sṳ̄
insource:"lĭk-huŏng" 200   9   Tiék | Dè̤ng | Ngṳ̀ng
```

**⚠ The word query is not empty. It is FULL — of the wrong articles.** The wiki serves `lī-mī` as the two
terms `lī` and `mī` and hands back 40 articles about America (`Mī-guók`) and about kilometres (`Gŭng-lī`),
none containing the compound. The probe reads twenty of them, finds nothing, and prints the most confident
negative it has.

This matters more than the three verdicts. **The obvious guard is wrong**: "retry with `insource:` when the
search returns nothing" — the first fix I wrote, and it never fires, because emptiness is not the symptom.
The trigger has to be the punctuation in the probe itself. Trap 19's shape one layer out, and the same
false-refusal direction as the bug Runs 1–7 fixed: the verdict was corrected while the sample stayed wrong.

**Implication.** Every punctuation-bearing probe widens its sample with `insource:"…"` and reads those
titles first, word-query titles after. Recall only — every article still faces the same `hitRe`, so nothing
about what counts as an attestation is relaxed — and the sample is recorded in the cache as
`"via": "insource"` so a verdict stays reproducible. Re-run: `lī-mī` **2/2**, `gŭng-gĭng` **1/1**,
`lĭk-huŏng` **1/1**, all `attested`, all three previously `absent`.

Senses read, because that is the only filter this tool cannot supply:

* `lī-mī` is **centimetre** (釐米), not kilometre — "siáng kuăng ng-sāi chiĕu guó 12 lī-mī" (the line must
  not exceed 12 of them), and one sentence contrasts "gūi lī-mī" with "3 mī". cdo's kilometre is `gŭng-lī`,
  separately recorded in the same cache.
* `gŭng-gĭng` is **kilogram** (公斤) — a panda eating "15 gáu 20 gŭng-gĭng" of bamboo a day. One article
  only, so a lead by this tool's own rule.
* `lĭk-huŏng` is **cubic** (立方), and it is attested *bound*: "1,980 lĭk-huŏng-mī/miēu", cubic metres per
  second. The hyphen-as-boundary asymmetry from Run 4 is what let it match inside `lĭk-huŏng-mī` — working
  as designed, but the finding is the morpheme, not a free word.

---

## Run 11 — 2026-08-12 17:10 — the 11 stale findings, re-probed and read

**Question.** Run 2's 11 punctuation-bearing findings were all `substring-only` with 0 token hits under the
old boundary. Run 7 deliberately did not re-probe them, on the grounds that a bulk re-run laundered 11
unread verdicts into the tree. So: re-probe them, and read every one.

**Command.** `npx tsx tools/normalization/attest.ts --lang <ln|mad|mg|nan|om> --words …`, default `--limit`,
one language per invocation.

**Raw finding. Eleven of eleven flip from `substring-only` to `attested`.** A 0% attestation rate became
100%, which is what Run 2 predicted an instrument fault would look like from the other side.

| lang | word | was | now | sense, from the examples |
|---|---|---|---|---|
| ln | `kilomɛtrɛ-kare` | 0/0/8 | **9/8** | square kilometre — park and province areas, and a density: "bato 11 na kilomɛtrɛ-kare moko" |
| mad | `sampè'` | 0/0/17 | **52/19** | "until / up to" — date ranges ("15 Oktober 2012 sampè’ 16 Oktober 2014"), amounts ("sampè’ Rp 516 jutah"), "sampè’ samangkèn" = until now. The range connector, exactly the slot |
| mg | `tora-telo` | 0/0/2 | **2/2** | cubed — definitional: "1 000 000 000 metatra toratelo ny kilômetatra tora-telo". ⚠ the same sentence writes the solid form `toratelo`; the hyphen is optional in practice |
| mg | `isan-jato` | 0/0/19 | **21/20** | percent — "nitombo 7 isan-jato isan-taona", "latsaky ny roapolo isan-jato". Numeral precedes |
| nan | `pah-hun-chi` | 0/0/1 | **1/1** | percent (百分之) — one article, but it is the **`%` sign's own definitional page**: "1/100 (pah-hun-chi-it, 0.01)…Sò͘-ha̍k hû-hō sī '%'". ⚠ and it **precedes** its numeral: `pah-hun-chi-it` = 1% |
| nan | `Hôa-sī` | 0/0/1 | **12/10** | Fahrenheit — "Hôa-sī un-piau (°F)". ⚠ two hits are a homographic broadcaster name (華視, a TV station); the temperature sense is independently definitional |
| nan | `Liap-sī` | 0/0/10 | **22/14** | Celsius — "Liap-sī un-piau (°C)", "Liap-sī 25-tō͘ (25°C)", "lak kàu Liap-sī 0-tō͘ í-hā". Precedes its numeral |
| nan | `kong-kin` | 0/0/4 | **23/17** | kilogram — the SI unit article states the mapping: "Kong-kin (hû-hō: kg) sī chit-liōng ê SI ki-pún tan-ūi. 1 kg = 1000 g". Follows its numeral |
| om | `baay’isuu` | 0/0/3 | **18/12** | multiply — "Fkn, 3x2=6. Mallattoon baay'isuu x dha." The sign-to-word mapping stated outright |
| om | `ida’uu` | 0/0/6 | **17/10** | add — "ida'uu: x + 0 = 0 + x = x" |
| om | `hir’isuu` | 0/0/2 | **26/19** | subtract — carried on the minus sign: "mallattoo hir’isuu ( −1, −2, −3 …)". ⚠ one hit is a disaster-*reduction* council, the general sense; the arithmetic sense is definitional elsewhere |

Two things the counts alone would have hidden, and that only reading gives: the Min Nan and Malagasy
percent/temperature words **precede** their numeral while `kong-kin` follows, which is a word-order fact any
reading rule needs; and `tora-telo`'s wiki writes the compound solid as often as hyphenated.

**Implication.** Run 7's refusal to bulk re-probe was right for the reason it gave and wrong about the
outcome — every one of the eleven was a real word all along. The instrument, not the languages.

---

## Run 12 — 2026-08-12 17:12 — a 429 is not an error, it is a wait

**Question.** Probing `nan` died mid-run: `Error: 429 Too Many Requests — nan.wikipedia.org`, stack trace,
nothing written. Is that the same mechanism that cost the `bar` cache?

**Raw finding.** Yes, and it is the other half of it. `api()` threw on the first non-OK response, so a rate
limit arriving at word 3 of 20 killed the process and the run wrote **nothing** — which, combined with the
Run 8 defect forcing every cache into one all-or-nothing run, is enough for a small wiki's rate limiter to
make a language unprobeable indefinitely.

**Implication.** Transient statuses (429/502/503/504) retry with exponential backoff, honouring
`Retry-After`. Everything else still throws at once: a 404 or the 414 this file already documents is a fact
about the request, and waiting cannot improve it. Exhausted retries throw too — never return empty — because
the manufactured confident negative is this file's standing hazard. The error text now says to back off and
retry rather than to reduce `--limit`, since a smaller limit yields counts incomparable with the tree's.

Re-run of the same four `nan` words then completed on the first attempt.

---

## Run 13 — 2026-08-12 17:13 — restoring the cache the rate limit destroyed

**Question.** A sibling investigation records four successful probe batches whose artifact never reached the
tree: the agent deleted the cache to force the single clean run Run 8's defect demanded, and the wiki
answered 429 to everything after. The verdicts survive as prose. Can the artifact be re-measured?

**Command.** The 20-word list recorded in that document, one invocation, default `--limit`.

**Raw finding.** The wiki answered normally — the earlier 429 has lifted. **20 findings, all `attested`,
zero substring-only**, and the counts reproduce the prose where the prose recorded them (`Prozent` 128/19,
`Dollar` 105/17, `Grad` 37/20, `Celsius` 35/20, `minus` 19/15, `Komma` 24/19). The artifact is restored by
measurement, not transcribed from the document.

**⚠ And two of those `attested` verdicts are traps, which is the point.** The sibling document establishes
both by reading, and this run's own examples reproduce both: `Komma` scores 24 hits in 19 articles and every
example is the **verb** ("do komma genau segn", "zu Schadn komma", "der Dreißgjährige Kriag komma is") —
never the punctuation mark. `plus` scores 45 in 18 and the examples are **Adblock Plus**. The cache cannot
say this; only the examples can, and the cache stores them for exactly that reason.

Note also that the restored list probes `Eiro` and not `Euro`: the sibling run found `Euro` scoring 60 hits
that were German book titles, against a wiki whose own article opens "Da Eiro (amtli: Euro …)". The
word list already carries that correction.

**Gates.** `npx tsc --noEmit` clean; `npx vitest run` → 240 files, 3773 passed, 5 skipped.

---

## Negative results kept (Runs 8–13)

* **"Retry with `insource:` when the search returns zero results" was written, and is wrong** (Run 10). It
  never fires: a tokenised query for a hyphenated word is not empty, it is full of articles about the parts.
  Emptiness is not the symptom; the punctuation in the probe is. This is the second time on this tool that
  the obvious guard tested the wrong end of the pipe.
* **Patching the brace count from 8 to 12 was rejected** (Run 8). It would have worked today and drifted
  again at the next touch of the writer's template, and it cannot read the 71 files already in the tree if
  the template ever changes. One source, plus a round-trip test that feeds the writer's own output back
  through the parser — a hand-typed fixture cannot catch this class of bug, because the same person writes
  the fixture and the regex.
* **Reducing `--limit` to get past the 429 was rejected** (Run 12), and the error message now says so. It
  would have produced counts incomparable with every other finding in the tree, i.e. bought an artifact by
  spending the thing that makes artifacts comparable.
* **No before/after count is reported for the `insource:` change** (Run 6's rule still binds). The cdo,
  ln, mad, mg, nan and om numbers above are *new measurements replacing findings known to be made with a
  broken instrument*, not an A/B — the old counts were all 0 token hits by construction.

## What moves elsewhere

The 11 findings from Run 2 are no longer stale, and `bar.jsonc` exists again, so `review.ts`'s sourcing line
stops reporting "wikipedia NOT probed" for 20 Bavarian words that were in fact probed. Every cache in the
tree is now parseable by the tool that writes it — pinned by a test that sweeps `tools/corpus/attest/` and
asserts block count equals word count, so a file that would silently break the next probe run fails CI
instead.
