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
