# en — a lone Greek letter in English text (#1448)

`the β value` reads `ðə vita vˈæɫjuː` — Modern Greek — and seven letters emit a phone
`data/languages/english/english.jsonc` does not declare. This log works out where the fix belongs and
what it must NOT touch.

## Run 1 — 2026-09-22 — the mechanism, and two corrections to the issue

**Mechanism.** `english.ts`'s tokenizer matches Latin only, so a Greek character falls into the GAP pass
(`english.ts:336`), is matched by `FOREIGN_RUN` (`core/clauses.ts:93`) and handed to `readForeignRun`,
which routes it to the Greek engine. That is **correct for a Greek word** and wrong for a single letter
used as a symbol:

```
the word λόγος means word   ->  ðə wˈɝd loɣos mˈiːnz wˈɝd      ✓ intended
Ελλάδα is Greece            ->  elaða ɪz ɡɹˈiːs                 ✓ intended
α and β                     ->  alfa ənd vˈita                  ✗ these are symbols
```

⚠ **CORRECTION 1 TO #1448: `μ` (U+03BC) IS ALREADY HANDLED IN THE UNIT SLOT.** The issue says it is not.
Measured, both spellings already normalize identically, so there is nothing to fix there:

```
a 5 µm layer (U+00B5)  ->  "a 5 micro meters layer"
a 5 μm layer (U+03BC)  ->  "a 5 micro meters layer"
```

⚠ **CORRECTION 2 TO #1448: THIS FIX WILL NOT REMOVE `ɣ` FROM ENGLISH OUTPUT, ONLY FROM LONE LETTERS.**
`λόγος` → `loɣos` still carries it, and that is the *intended* reading of embedded Greek. A foreign run's
phones being outside the host inventory is a general property of reading foreign text inside a host
language — a real question, much larger than this issue, and NOT what #1448 should be closed on.

## Run 2 — substituting the English NAME as text works for 23 of 24

The right layer is the normalizer: rewrite the lone letter to its English name as TEXT, and let the
ordinary lexicon read it. 21 of the 24 names are already lexicon words, and the reading that comes back
is correct — **including the stress the current output lacks entirely**.

```
α alpha  ˈæɫfə      ζ zeta  zˈeᶦt̬ə    λ lambda lˈæmdə   π pi   pʰˈaᶦ     φ phi   fˈaᶦ
β beta   bˈeᶦt̬ə    η eta   ˈeᶦt̬ə     μ mu     mjˈuː     ρ rho  ɹˈoᶷ      χ chi   kʰˈaᶦ
γ gamma  ɡˈæmə      θ theta θˈeᶦt̬ə    ν nu     nˈuː      σ sigma sˈɪɡmə   ψ psi   sˈaᶦ
δ delta  dˈɛɫtə     ι iota  aᶦˈoᶷt̬ə   ο omicron ˈɑːmɪkɹˌɑːn  τ tau tʰˈaᶷ  ω omega oᶷmˈɛɡə
ε epsilon ˈɛpsəlˌɑːn κ kappa kʰˈæpə    υ upsilon ˈʌpsələn
```

⚠ **ONE COLLISION, AND IT IS `ξ`.** The lexicon's `xi` is the CHINESE SURNAME — `ʃˈiː` — so substituting
the letter's own name inherits a reading that is right for a different word:

```
the xi value   ->  ðə ʃˈiː vˈæɫjuː      ✗
the ksi value  ->  ðə ksˈiː vˈæɫjuː     /ksiː/, attested
the ksai value ->  ðə ksˈaᶦ vˈæɫjuː     /ksaɪ/, attested
```

It is a HOMOGRAPH, not a defect in the `xi` row — the surname reading is correct for the surname — so it
cannot be fixed by editing the lexicon, and the POS-heteronym mechanism does not apply because the split
is not by part of speech. **This one needs the user's call**: /zaɪ/ is the commonest English reading of ξ
in mathematics, /ksaɪ/ and /ksiː/ are also attested, and none of them is spelled `xi` in a way this
lexicon reads correctly.

## Run 3 — `Ω` is a unit and is not handled at all

```
set 5 Ω now    ->  "set 5 Ω now"     (unchanged — the symbol reaches the word layer)
a 5 Ω resistor ->  "a 5 Ω resistor"
5 kΩ           ->  "5 kΩ"
```

Unlike `μ`, `Ω` has no unit handling. `5 Ω` should be "5 ohms" — the same shape as `5 µm` → micrometers —
and that is a different question from the letter name, which is what `the Ω value` wants.

## Run 4 — 2026-09-22 — the fix, and a pre-existing bug it exposed

**The rule.** A Greek letter with no Greek letter *or combining mark* on either side — a run of exactly
one — is rewritten to its English name as TEXT, after the unit rules. The user named the threshold
independently ("min run >= 2?") and it is the right one: one letter is a symbol, two or more is a word.

```
the β value   ->  "the beta value"   ->  ðə bˈeᶦt̬ə vˈæɫjuː
the Δ x term  ->  "the delta x term" ->  ðə dˈɛɫtə ˈɛks tʰˈɝm
λόγος         ->  unchanged          ->  loɣos          ← still Greek, as intended
```

All 24 letters now read as English words **with stress**, and the stress is the tell for what was wrong:
not one of the 24 previous readings carried a mark, because none was being read as an English word.
`ɣ`, `ɾ` and `ç` are gone from lone letters.

⚠ **`Ω` IS A UNIT BEFORE IT IS A LETTER**, so the unit table gained it — plus `kΩ`/`MΩ`/`mΩ`, declared
EXACTLY rather than folded, because `mΩ` (milli) and `MΩ` (mega) are 10⁹ apart and `toLowerCase` makes
them one key. Without the prefixed keys the longest-first sort would match the bare `Ω` and strand the `k`.

⚠ **AND THE PREFIXED FORMS ARE TWO WORDS BECAUSE THE GLUED ONES ARE MANGLED.** First draft emitted
`kiloohm`, which the OOV g2p read `kʰˈɪləm` — "killum" — with `megaohm` → `mˈɛɡɑːm` and `milliohm` →
`mˈɪɫjəm`. The `o|o` seam is what breaks them. The table's own micro entries already document this idiom;
I had to rediscover it by listening to the output.

### ⚠ THE `ξ` COLLISION IS UNRESOLVED AND IS THE USER'S CALL

`ξ` emits `ksi` (`ksˈiː`), not `xi`, because the lexicon's `xi` is the Chinese SURNAME (`ʃˈiː`) — correct
for that word, wrong for the letter. It is a HOMOGRAPH, so no lexicon edit fixes it and the POS-heteronym
mechanism does not apply. **/zaɪ/ is commoner in mathematics and this rule does not produce it.**

### ⚠ IT EXPOSED A PRE-EXISTING BUG, AND FINDING IT TOOK FOUR SEPARATE PROBES

Two inputs normalizing to BYTE-IDENTICAL text phonemized differently:

```
"the τ value"    normalized "the tau value"   ->  ðə tʰˈɔː vˈæɫjuː
"the tau value"  normalized "the tau value"   ->  ðə tʰˈaᶷ vˈæɫjuː
```

Verified identical by hex dump; `phonemize()` (sync) agrees on both; only `phonemizeAsync` differs.
**Cause: `englishNeural.ts:92` builds its tagger pre-pass by scanning the CALLER'S RAW TEXT**, so a word
the normalizer creates is never tagged and silently falls to the weaker n-gram path. Filed as **#1452** —
it hits `tau`, `omicron`, `upsilon`, `ksi`, the ohm prefixes and `microinch(es)`, i.e. exactly the
normalizer-introduced words that have no dictionary row to fall back on.

⚠ **AND NOTHING IN THE TRACE COULD EXPLAIN IT.** `TraceToken` reports *where* a reading came from in the
text and *where* it landed in the IPA, but not *which tier resolved it* — lexicon, heteronym, tagger or
n-gram. Working it out took a hex dump, an order-dependence test, a sync/async comparison and reading the
neural entry point; a `source` field would have answered it in one call. Filed as **#1453** at the user's
prompting, and it would also make #1452 checkable by a gate rather than by a person.

## Run 5 — 2026-09-22 — ⚠ THE REPO HAD ALREADY SOLVED THE HARD PART, AND I DID NOT FIND IT FIRST

Two tests failed, and reading them turned up `GREEK_LETTER_NAME` in `src/core/scripts.ts` — a fleet-wide
mechanism that already decides a lone Greek letter is mathematics and wants its NAME:

> *"A lone Greek letter in another script is usually MATHEMATICS (α, β, π, Δ) and wants its NAME —
> 'alpha', 'pi' — not a Greek word's worth of phonology, so the router declined it and the letter was
> DELETED in 186 of 188 engines."*

⚠ **AND ITS DISCRIMINATOR IS BETTER THAN MINE.** It separates mathematics from Greek prose on the ACCENT,
measured over 162 mined artifacts: bare in ~34 languages is always mathematics (`α Scorpii`, `χ² kritēriju`,
`δ(G)`), accented in 2 languages is always prose (`ἡ θάλασσα`, `Ελευθερία ή θάνατος`). It also normalises
to NFD so a precomposed accent is caught. My run-length guard is a weaker restatement of the same idea.

**So #1448 was narrower than I wrote it.** The defect is not "nobody handles lone Greek letters" — it is
that the name is given in GREEK and read by the GREEK reader, so an English document hears `alfa`. That
was a deliberate fleet-wide choice (`scripts.ts` says "why the name did not need a per-host table"), and
it is right for the 187 hosts where the letter names are not native words. **English is the exception:
"alpha", "beta", "omega" ARE ordinary English words with lexicon rows and stress.**

The English rule therefore stays in `normalize.ts`, pre-empting the router, and the fleet mechanism is
untouched. Verified in both directions:

```
en  "The value is α"   ->  ðə vˈæɫjuː ɪz ˈæɫfə     ← English name, English stress
fr  "La valeur est α"  ->  la valœʁ e alfˈa        ← fleet mechanism, unchanged
ru  "Значение α"       ->  znɐt͡ɕˈenʲɪje alfa      ← unchanged
th  "ค่า α"            ->  kʰˈaː˥˩ alfa            ← unchanged
```

Both tests were updated to say what changed and why, and `foreign-runs.test.ts` gained the fr/ru
assertions — the half that would break silently if the English rule were ever generalised to the router.

### ⚠ A SECOND PIN SAID THE `²` QUESTION WAS OPEN, AND IT WAS NOT OPEN, IT WAS BROKEN

`english-tier-agreement.test.ts` pinned `normalizeEnglish("Ω²") === "Ω²"` with the note that *"a
Greek-letter base is a physics variable, and English's OOV path may serve it better than a spoken 'omega
squared'"*. Measured, English's OOV path never saw it: the `Ω` went to the Greek reader as `omeɣa` and
**the `²` was dropped outright** — silent content loss, which this file ranks worst.

The Greek rule now consumes a trailing `²`/`³` itself. ⚠ It has to, because step 6b's bare-exponent rule
**caps a letter base at three characters** — `Smith¹` is a footnote, not an exponent — and `omega` is
five. The cap's reasoning does not apply to a Greek base: nobody footnotes a lone Greek letter.

```
Ω²       ->  "omega squared"
χ² test  ->  "chi squared test"    ← the name of the test, and the `²` was previously dropped
```
