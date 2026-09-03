# Word-initial /ɹ/ deleted before ᵻ — en-GB, and pcm by another route (#1250)

`en-GB` deletes an ONSET /ɹ/ whenever the next vowel is the reduced `ᵻ`, because `ᵻ` is missing from the
`VOWEL` class its "not before a vowel = coda" guard is built from. `pcm` loses the same words plus a larger
class. This log is the audit the issue asked for — the class measured against the symbols the engine actually
emits, rather than patched for the one reported symbol.

## Run 1 — 2026-09-03 17:40 — reproduce

```
npx tsx r1.mts     # 20 words × en / en-GB / en-IN / pcm
```

```
reports   en=ɹᵻpʰˈɔːɹts  en-GB=ᵻpʰˈɔːts   en-IN=ɾɪpˈɔːɾʈs  pcm=ipɔts
report    en=ɹipʰˈɔːɹt   en-GB=ɹipʰˈɔːt   en-IN=ɾipˈɔːɾʈ   pcm=ɾipɔt
around    en=ɚˈaᶷnd      en-GB=əɹˈaʊnd    en-IN=əɾˈaʊnɖ    pcm=aaund
"Television reports show white smoke…"  →  tʰˈɛləvˌɪʒən ᵻpʰˈɔːts ʃˈəʊ …
```

Reproduces exactly, including the tell: `report` survives because its first vowel resolves to `i`, not `ᵻ`.
⚠ Note `en-GB around → əɹˈaʊnd` is CORRECT — en-GB's linking-r rule works; only the `ᵻ` case is broken there.
`pcm around → aaund` is a second, larger defect.

## Run 2 — 2026-09-03 17:50 — the en-GB audit: what can actually follow ɹ?

The class is used three times, and all three uses sit AFTER the GOAT/offglide/NURSE/lettER remaps, so the
alphabet it must cover is the POST-transform one, not GenAm's. Replicated that prefix and ran it over all
117,479 dict words, collecting every character that can follow an `ɹ`:

```
npx tsx coda.mts
```

| follows `ɹ` | n | in VOWEL |
|---|---|---|
| ə i ɪ ɛ æ e ɒ a u ʌ ɔ ʊ ɑ ɜ | 7686 … 9 | ✅ |
| **ᵻ** | **828** | ❌ |
| t d k m n s b z l ɡ p f v ʃ θ w h ɫ j ð ŋ ʒ, word-end | — | ❌ (correct — these are codas) |

**`ᵻ` is the only vowel that can reach this guard and is missing from it.** Not a symptom of a wider drift:
every other vowel in the emitted inventory is already covered.

And the two members the issue flagged as suspicious are both DEAD, which explains how the omission survived:

- `ɐ` — never emitted by this engine anywhere, at any stage (checked against the full 48-character inventory
  of GenAm output over the same 117k words).
- `o` — emitted 17,063 times by GenAm but only ever inside `oᶷ`, which the GOAT rule rewrites to `əʊ` two
  lines before the class is first used. No bare `o` survives to any of the three uses.

⚠ THE RIGHT RESPONSE TO A DEAD MEMBER IS TO LEAVE IT. The class sits in a NEGATIVE lookahead, so the error is
one-sided: a vowel MISSING deletes a consonant, a vowel that never occurs costs nothing. The fix is to make
the class a generous superset and pin it with the audit, not to trim it to today's inventory.

## Run 3 — 2026-09-03 17:55 — a second en-GB defect the audit turned up

The same sweep reported `ˈ` as a character that can follow `ɹ` (n=5). Chasing it:

```
greedier   en = ɡɹˌˈiːd̬iʲɚ   →   en-GB = ɡˌˈiːdiə      the ɹ of the ONSET CLUSTER ɡɹ, deleted
```

The GenAm form carries TWO stress marks in a row and `CODA` allows only one (`[ˈˌ]?`), so the guard cannot
see the `iː` behind them and the cluster loses its /ɹ/. Same defect class as `ᵻ` — a vowel the guard cannot
see — reached by a different obstruction. ×5 in the dict.

⚠ And the `ᵻ` defect is NOT only word-initial, which the issue's 13 `re-` words understate:

```
alacrity   en = əlˈækɹᵻt̬i   →   en-GB = əlˈækᵻti      the ɹ of the cluster kɹ, deleted
```

`barroom` (`bˈɑːɹɹuːm` → `bˈɑːɹuːm`) was checked and is NOT a defect: START `ɑːɹ` is correctly consumed and
the second /ɹ/ is a real onset that survives.

## Run 4 — 2026-09-03 18:00 — the pcm audit

`naija.ts` has its own vowel class `V` for the onset-/r/ lookahead, and the same two rules in the other order:
onset `[ɹr]` before a vowel → `ɾ`, then a BLANKET `.replace(/[ɹr]/gu, "")` labelled "CODA r → dropped" that
carries no coda context — it is correct only for as long as the onset rule above it is exhaustive.

Ran naija's own chain over the same 117k words:

```
npx tsx pcm.mts
```

- **`ᵻ` is again the only vowel missing from `V`** (828 words). Every other character reaching the blanket
  drop is a genuine coda.
- **`ɚ`/`ɝ` are mapped to plain vowels BEFORE the onset rule runs** (`.replace(/ɝ/gu,"ɔ").replace(/ɚ/gu,"a")`,
  commented "the r is absorbed"), and **3,776 of those are PRE-VOCALIC** — 3,457 `ɚ` and 319 `ɝ` — where the
  /r/ is the onset of the next syllable and not a coda at all: `around`, `arrive`, `correct`, `aberle`,
  `administering`. Absorbing it there is what produces `aaund`.

So pcm needs both halves: `ᵻ` in `V`, and `ɚ`/`ɝ` split by context the way en-GB already splits them for its
linking /ɹ/ — `ɚ` → `aɾ` before a vowel and `a` elsewhere, `ɝ` → `ɔɾ` / `ɔ`.

## Run 5 — 2026-09-03 18:20 — the fix, measured over the whole dict

`ᵻ` added to both vowel classes; en-GB's three mark tests widened from `[ˈˌ]?` to `[ˈˌ]*`; pcm's `ɚ`/`ɝ`
split by context (`aɾ`/`ɔɾ` before a vowel, `a`/`ɔ` elsewhere) and its blanket drop given the coda condition
it was only ever pretending to have.

Rendered all 117,479 dict words through both engines before and after:

| | words changed | became SHORTER (a loss) |
|---|---|---|
| en-GB | **833** | 0 |
| pcm | **4,553** | 0 |

(Run 10 takes these to 928 and 4,648 — see below. Still zero shortened.)

Nothing got shorter, which is the shape of the claim: this fix only ever puts a consonant back.

⚠ The en-GB 833 are three classes, and only the first was reported:

- **761** — a plain onset /ɹ/ restored (`reports`, `alacrity`).
- **67** — a vowel+r remap that was ALSO misfiring on the same gap. `ɛɹ` before `ᵻ` is not SQUARE and `ɔːɹ`
  before `ᵻ` is not NORTH, but with `ᵻ` outside the class they matched their `CODA` test and centred the
  vowel: `asperity` was *əspˈɛəᵻti* and is now *əspˈɛɹᵻti*, `authority` *əθˈɔːᵻti* → *əθˈɔːɹᵻti*. The issue
  reported the deletion; the same one line was quietly corrupting five other rules.
- **5** — the stress-mark run (`greedier`).

## Run 6 — 2026-09-03 18:30 — the referee, and the parity goldens

```
npx tsx tools/referee-eval/eval.ts en-GB      # before / after
```

|  | before | after |
|---|---|---|
| folded backbone | 29880/76284 (39.2%) | 29880/76284 (39.2%) |
| symbol accuracy | 80.0% | **80.1%** |

A tenth of a point, and that is the honest size of it: the wikipron UK list is dominated by names and rare
words, so the `ɹᵻ` verbs are a thin slice of 76k. It moves the right way and nothing regresses. pcm has no
referee at all (wikipron/epitran/kaikki all 404 for it — recorded in `tools/referee-eval/langs/pcm.jsonc`),
so its anchor is the authored gold plus the sweep above.

⚠ AND THE PARITY GOLDENS CARRIED THE BUG. `csharp/goldens/en-GB.tsv` shipped `ᵻd͡ʒˈɛktᵻd` for *rejected*,
`ᵻzˈaɪd` for *reside*, `ᵻkʰˈɔːɫ` for *recall*; `pcm.tsv` had `sɛnt͡ʃai` for *century* and `atɔiti` for
*authority*. Re-rendered column 1 from the same text: **39/200 en-GB rows and 40/200 pcm rows** move. The
IPA column is not asserted by any test today — only column 0 is read, to enumerate ported languages — but it
is what `csharp/tools/parity` compares the port against, so a stale golden pins the defect for the port.
Both engines are byte-identical to the re-rendered files (`200 rows ok, 0 differ`, each).

## Run 7 — 2026-09-03 18:40 — the instrument, so the class cannot drift back

The fix is one character in each of two strings, which is exactly the kind of thing that regresses silently.
`test/onset-r.test.ts` audits the descendants against the PARENT rather than against a word list: every
rhotic onset in the GenAm source — an `ɹ` before a vowel, or an `ɚ`/`ɝ` before one, which is a syllable-initial
/r/ written as a diacritic — must survive into the descendant as that descendant's rhotic. Coda /r/ is not
counted, so the non-rhoticity the accents exist for is not asserted away. 117,479 words × 2 engines, ~20s.

One exclusion, and it is not an onset loss: `dr` is an ABBREVIATION the two engines expand to different
WORDS — `en` reads *drive* (`dɹˈaᶦv`), pcm's own table reads *dakta*. Listed by name rather than filtered by
a heuristic, so the exception stays a fact about the abbreviation tables.

## Run 8 — 2026-09-03 19:05 — review sweep, and one thing found that is NOT this fix

Swept all 117,479 dict words through both fixed engines looking for damage the before/after counts would not
show — a raw `ɹ` leaking out of pcm's newly-guarded coda drop, a doubled tap, a doubled `ɹ` in en-GB:

```
npx tsx leak.mts
pcmDoubleTap  none        gbDoubleR  none        pcmStray  none
pcmRawR       were: wɛre
```

The one hit is **not** from the rule path and is **not** new — `were` and `werey` are hand-authored LEXICON
entries in `data/languages/naija/naija.jsonc` (`"were": "wɛre"`, Naija *wèrè*, "madman"), and the lexicon
bypasses `nativise` entirely. Verified identical on both sides of the fix.

⚠ IT IS A REAL DEFECT THOUGH, AND AN ADJACENT ONE: that manifest is internally inconsistent about its own
rhotic. Three of its seven rhotic-bearing IPA values use a plain `r` (`wɛre` ×2, `d͡ʒare`) and four use the
tap `ɾ` (`jaɾn`, `kɾez`, `ɾod`, plus the `r` → `ɾ` consonant mapping itself). The rule path can only ever
produce `ɾ` — the consonant table says so — so the same phoneme reaches the phoneme stream spelled two ways
depending on whether the word was in the lexicon.

NOT FIXED HERE, deliberately. It is a data question with its own evidence to gather (does the NLA orthography
manual or Faraclas write a trill anywhere, or is this simply three entries typed with an ASCII `r`?), it is
not caused by and does not interact with the /r/-deletion fix, and three lexicon values changed on a hunch is
exactly the unsourced edit this repo's data rules exist to prevent. Reported so the next reader has the count
and the file.

## What did not get fixed, and why

- **The pcm lexicon's rhotic inconsistency** — above.
- **`ɐ` and `o` stay in en-GB's `VOWEL`** though the audit proves both unreachable. The class is a negative
  lookahead; the error is one-sided; a superset is the safe shape. See the header comment on the class.
- **The referee number is a tenth of a point.** The `ɹᵻ` population is thin in a 76k list dominated by names,
  and no fold in `en-GB.jsonc` was touched, so this is the real size of the gain by that instrument. The
  dict sweep (833 words, none shortened) is the measurement that actually sizes the defect.

## Run 9 — 2026-09-03 19:25 — a perf defect the fix introduced, and the one it was sitting next to

Reading the diff back: the two new `ɚ`/`ɝ` rules were written as `new RegExp(...)` **inside** `nativise`,
which runs once per word. That is the "repeated recompilation of regexes" PORTING.md lists as free to fix,
and I had just added two more of them to a hot path.

Hoisted all four of naija's rhotic patterns, then noticed en-GB does the same thing eight times over in
`toRP` — pre-existing there, but the same file the fix already edits and the same class. Measured, 40k dict
words, median of five runs each:

| | per-word `new RegExp` | hoisted |
|---|---|---|
| pcm | 420 ms | **392 ms** (−7%) |
| en-GB | 1916 ms | **1607 ms** (−16%) |

Both verified output-identical: `csharp/tools/parity` reports `200 rows ok, 0 differ` for each, and the
authored tests pass unchanged. The C# port has held all twelve as statics since it was written, so this is
the TypeScript catching up rather than a new idea.

⚠ ONE HAZARD WORTH THE COMMENT IT GOT: a `/g` regex hoisted to module scope carries `lastIndex`. All twelve
are used with `.replace`, which resets it; the same move under `.test()` or `.exec()` would be a stateful bug
that only shows on the second call.

## Run 10 — 2026-09-03 19:50 — the fix was incomplete in exactly the way it diagnoses

A review pass caught the thing this whole document exists to prevent, one rule to the left of where I looked.

`ɚ` and `ɝ` **are vowels**, and neither is in `VOWEL`/`V`. The two LINKING rules — the ones that split an
r-coloured vowel into "keep the /r/" and "absorb it" — look ahead with that same class, so when an `ɚ` is
followed by *another* `ɚ`/`ɝ` the first one fails the pre-vocalic test, falls through to the unconditional
`ɚ → ə` / `ɚ → a`, and its onset /r/ is deleted:

```
caterer      en = kʰˈeᶦt̬ɚɚ    →  en-GB  kʰˈeɪtəə     pcm  ketaa       RP is /ˈkeɪtərə/
adventurer   ædvˈɛnt͡ʃɚɚ      →  ædvˈɛnt͡ʃəə                advɛnt͡ʃaa
acquirer     əkwˈaᶦɚɚ         →  əkwˈaɪəə                   akwaiaa
murderer     mˈɝd̬ɚɚ          →  mˈɜːdəə                    mɔdaa
```

**96 dict words**, and it is the identical defect class to the missing `ᵻ`.

⚠ AND THE SWEEP IN RUN 7 REPORTED THEM CLEAN, because `GENAM_VOWEL` in the test omitted `ɚ`/`ɝ` too. An
instrument that shares the blind spot of the bug is not an instrument — it is the same assumption written
twice, and it defeats the whole point of auditing rather than patching. Widening the test's class alone turns
it red on 95 words before any engine change, which is how it should have read from the start.

The fix is a SEPARATE class rather than two more characters in `VOWEL`/`V`. Adding them there would be a
provable no-op for the coda guards — nothing r-coloured survives the linking rules, so `CODA`/`ONSET_R` can
never see one — but those classes are documented as the alphabet at the point they are USED, and `ɚ`/`ɝ` are
not in it. A class that says something false about itself is how the first omission survived; `PRE_VOWEL` /
`PRE_V` say what they are: the same vowels one step earlier, where the r-coloured pair still exists.

⚠ AND THE ORIGINAL AUDIT'S CONCLUSION NEEDED THE SAME QUALIFIER. "The only vowel that can follow an `ɹ` here
and is missing" is true, but the parent writes `ɹɚ` 115 times and `ɹɝ` 8 times and neither is in the class —
they are safe because of RULE ORDERING, not coverage. That distinction is what licensed skipping `ɚɝ` in the
first place, so both engines' headers now state it.

Re-measured against the same pre-fix baseline:

| | words changed | became SHORTER |
|---|---|---|
| en-GB | 833 → **928** | 0 |
| pcm | 4,553 → **4,648** | 0 |

Goldens re-rendered: en-GB moves 0 further rows, pcm 2. `csharp/tools/parity`: 400 rows ok, 0 differ.

Two documentation defects from the same review, both fixed: the class header pointed at
`test/english-gb-onset-r.test.ts`, a path that does not exist (the file is `test/onset-r.test.ts`), and the
completeness claim above needed the ordering qualifier.
