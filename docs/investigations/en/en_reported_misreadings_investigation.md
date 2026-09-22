# Reported misreadings in the `en` reader

A running log of words a listener reported hearing wrong, one run per report. The recurring shape is
not a bad rule — it is a word the reader **guesses** instead of knowing, where the lexicon has a gap
and the two entry points (n-gram vs BiLSTM) then disagree with each other.

The Commonwealth-spelling class has its own log:
`en_british_spelling_variants_investigation.md`.

## Run 1 — 2026-09-14 12:17 — `in situ` read as "in see-two"

**Report.** *"in-situ is a latin phrase. pronunciation is 'in si-chew' (at least when I've heard it).
kokoro/vernacula-phonemizer comes out 'in see-two'. If the people around me have just been
pronouncing it wrong, that's also a possibility."*

**Question.** Which reading is right, and where does "see-two" come from?

**Raw finding.** The two entry points disagree, which immediately says the word is OOV:

```
en     "in situ"   sync: ɪn sˈɪt͡ʃuː     async: ɪn sˈiːt̬uː
en-GB  "in situ"   sync: ɪn sˈɪt͡ʃuː     async: ɪn sˈiːtuː
```

`grep -P "^situ\t" data/languages/english/accent-lexicon.tsv` → nothing. `situ` is not a headword.
The sync n-gram guesses `sˈɪt͡ʃuː`; the BiLSTM guesses `sˈiːt̬uː`. The app and the Kokoro path both
use `phonemizeAsync`, which is why the reported reading is the BiLSTM's. **The Kokoro alphabet
mapping is not involved at all** — `t͡ʃ` → `ʧ` is correct in KokoroFormat, and would have rendered
the sync reading fine.

**Who is right.** The reporter's colleagues are. The lexicon settles it against itself: CMUdict
carries the entire rest of the family with /sɪtʃu/ —

```
situate      S IH1 CH UW0 EY2 T        sˈɪt͡ʃuːˌeᶦt
situated     S IH1 CH UW0 EY2 T IH0 D  sˈɪt͡ʃuːˌeᶦt̬ᵻd
situation    S IH2 CH UW0 EY1 SH AH0 N sˌɪt͡ʃuːˈeᶦʃən
situational                            sˌɪt͡ʃuːˈeᶦʃənəɫ
```

— so the stem was simply MISSING, not contested. espeak-ng, the fleet's referee, agrees on the
vowel in both accents (`en-us sˈɪɾuː`, `en-gb sˈɪtuː`); /ˈsɪtʃuː/ is that with the British
/ˈsɪtjuː/ yod coalesced, which is the standard Commonwealth reading. (US dictionaries do also list
/ˈsaɪtuː/ and /ˈsiːtuː/, so "see-two" is an attested American variant rather than nonsense — but
nothing supports it as the reading for a stem the lexicon already spells /sɪtʃu/ four other times.)

**Fix.** `situ  S IH1 CH UW0` added to `g2p-dict.tsv`, regenerated through `makeArpabetToIpa` to
`situ\t\tsˈɪt͡ʃuː` in `accent-lexicon.tsv` — the same discipline as the `beyond` fix, so the
lexicon's derivability from the ARPABET survives. Both entry points and both accents now agree.

## Run 2 — 2026-09-14 12:20 — `max` not expanded to "maximum"

**Report.** *"'max' is frequently an abbreviation for 'maximum'. I'd like that normalized. I don't
know if we can disambiguate? Proper names should be spelled with a capital letter?"*

**Question.** Is the capitalisation heuristic enough, and what does it cost?

**Raw finding.** `max` is a lexicon headword (`mˈæks`), so it reads as the clipped word, and a
dotted `max.` additionally breaks the sentence:

```
"max. 40"  →  mˈæks . fˈɔːɹt̬i        # the dot reaches the clause segmenter as a phrase break
```

That second half is an unambiguous defect of exactly the shape `cf.`/`viz.` already have entries
for in `PLAIN_ABBREV`. But `max` cannot join that table: its arms carry `i` on purpose (`Dr.` and
`dr.` are the same abbreviation), and a case-insensitive `max` would turn a sentence-final
"…his name is Max." into "maximum".

⚠ **No attestation corpus.** The usual move here is to count instances in the corpus and quote the
number. There is none for this: the only English rows on disk are 2,602 FLEURS-style read-speech
sentences (`phonemized_vernacula/byid/en_us.tsv`), which contain **zero** occurrences of `max` —
it is technical-prose vocabulary and that corpus is news/wiki. The rule below is therefore reasoned
from the morphology, not measured, and is recorded as such.

**The reasoning.** Normalization runs BEFORE the POS tagger, so the verb cannot be identified by
tag. It does not need to be: the verb takes a particle (`max out`, `max it out`), and `maxed` /
`maxing` are different tokens this rule never sees. So the rule is lowercase-only, and declines
when `out` follows within two words.

**Residuals, accepted and rare.** An ALL-CAPS `MAX` does not expand either ("MAX 40 CHARACTERS"
in a heading reads as the clipping) — in an all-caps run the capital carries no information, so
telling the name from the abbreviation there needs the surrounding run's case, which this arm does
not look at. Left undone deliberately rather than guessed at. Beyond that: a lowercase name ("max said so") expands; a
particle-less verb ("max the settings") expands; and a sentence-initial "Max 40 characters" does
NOT expand, because at this stage it cannot be told from the name. Pinned by tests either way, so
a later widening has to decide about them deliberately.

## Run 3 — 2026-09-14 12:24 — `IR` should read as "infrared"

**Report.** *"IR - normalize to infrared"*

**Raw finding.** It was worse than an un-expanded initialism — `IR` was not being read as letters
either:

```
"IR spectroscopy"  →  ˈɪɹ spɛktɹˈɑːskəpi      # an invented word, "irr"
"UV and IR light"  →  jˈuːvˈiː ənd ˈɪɹ lˈaᶦt   # note UV beside it, correctly spelled out
```

**Why.** The initialism pass only spells out a run its phonotactic gate (`isUnreadableEnglish`)
calls unpronounceable, and that gate is carried mostly by the no-vowel test — `NHS`, `MP`, `GDP`,
`DVD`, `TV`, `UV` all lack a vowel entirely. `IR` HAS one, and ⟨r⟩ is a legal coda, so the gate
says "readable" and hands it to the OOV g2p, which duly invents `ˈɪɹ`. It is the same false
negative the `acronymLetters` list in `english.jsonc` exists for (`cra`, `nyc`, `rov`, `suv`).

**Fix.** Not `acronymLetters` — that would give the letter names, and the report asked for the
expansion. A gloss arm in `normalizeEnglish`, case-sensitive on the exact uppercase form so `Ir`
(iridium) and a lowercase `ir` are untouched. Verified: `Ir` still reads `ˈɪɹ`.

⚠ **This is a judgement, not a derivation, and it is not reversible by context.** `IR` is also
Investor Relations, incident response, and the ISO code for Iran; the entry asserts that infrared
dominates in the text this reader sees. That is true for the reporter's documents and is recorded
here because nothing downstream can tell that a choice was made. The comment in `normalize.ts`
carries the same warning, so the next entry added to that arm has to clear the same bar.

## Run 4 — 2026-09-14 12:43 — `CH₄` read as "see-ehch"

**Report.** *"`CH₄` came out 'see-ehch' instead of 'see-ehch-four'"*

**Question.** Is it the `₄`, and is it only English?

**Raw finding.** It is the `₄`, and it is not only English — **nothing in any tier read a subscript
digit, in any of the 192 languages.** The ASCII spelling of each of these was already correct, which
is what makes the gap invisible:

```
"CH₄"   norm: "CH₄"   → sˈiː ˈeᶦt͡ʃ            "CH4"  → sˈiː ˈeᶦt͡ʃ fˈɔːɹ
"H₂O"   norm: "H₂O"   → ˈeᶦt͡ʃ ˈoᶷ             "H2O"  → ˈeᶦt͡ʃ tʰˈuː ˈoᶷ
"CO₂"   norm: "CO₂"   → kʰˈoᶷ                  "CO2"  → kʰˈoᶷ tʰˈuː
"x²"    norm: "x squared"                      ← superscripts DO have machinery
```

`CO₂` is the worst of them: it loses the digit and then the bare `CO` is short enough to pass the
initialism pass's pronounceability gate, so it reads as the invented word *kʰˈoᶷ*. Sampled across
tiers, `CH₄` dropped its 4 in de, fr, es, hi and pl exactly as in en.

**⚠ The gap was already known, one layer up, and written down.** `core/markup.ts` deliberately does
not map `<sub>` to real subscript characters, and its comment gives this exact reason with this
exact example — *"NOTHING reads a subscript digit, so rendering `<sub>2</sub>` to `₂` takes a form
that was readable and makes it silent"* — closing the hole for HTML input by flattening to ASCII,
and ending: *"if a subscript reading is ever wanted, the digit words come first and the mapping
second."* Text that arrives with the subscripts already in it never met that flattening. So the
note was right, the workaround was right for its own entry point, and the underlying hole stayed
open for every other one.

**First fix, and why it was wrong.** `foldSubscriptDigits` called from `makeSymbolNormalizer` and —
separately — from English's own copy of that pass, since English does not route through the shared
one (0 uses; 141 other languages do). Spot-checked on de/fr/es/hi/pl, it looked complete.

**It was not.** Running `CH₄` against `CH4` for every language in the golden set:

```
languages: 189  match: 151  differ: 38
ak bal bg bm bo chr ckb ee fa grc he hmn ht is ka ki kl lg ln lt luo mn mos my
naq nci nog ps quc ro sd smj syl ug vi xh za zu
```

**38 languages use NEITHER path.** 141 + English is not 189, and "I patched both tiers" reads like
full coverage while leaving a fifth of the fleet broken. The spot-check could not see it because the
five languages sampled all happened to be `makeSymbolNormalizer` users.

**Second fix.** The fold belongs at `prePass` in `registry.ts` — the single dispatch point every
language passes through "before the engine's own tokenizer sees a character" — beside
`foldNativeDigits`, whose own comment already carries the argument for it: a digit is *script-marked
but language-neutral in value*. A subscript digit is that same thing. Moved to `core/unicode.ts`
next to it. Re-measured: **189 of 189 match.** `vi`, `xh` and `zu` now match too, and they were never
digit failures — they differed in how the LETTERS `CH` tokenized — which is the point: folding
before the tokenizer makes the two spellings the same string by the time any engine runs, so the
invariant holds by construction rather than by 189 separate coincidences.

⚠ Not opt-outable, unlike the native-digit fold. `FOLD_OPT_OUT` exists for a language that reads its
own script's digits natively; a subscript is a formatting mark on an ASCII digit and no language
wants it preserved.

`x²` is untouched — a subscript is a count, a superscript is a power — and the markup.ts note is
updated to record that its premise no longer holds.

## Run 5 — 2026-09-14 12:55 — `and` heard as "ind"

**Report.** *"'and' can sometimes sound like 'ind'"*, in a list sentence where the SECOND `and` —
the one resuming after a comma — was the bad one.

**Question.** Is the reader producing something different for the two `and`s?

**Raw finding.** No. Both are `ənd`, byte-identical, in IPA and in Kokoro tokens alike. So nothing
downstream could have told them apart, and the difference the listener heard is the acoustic model
responding to position. That ruled out a reader defect and made this a question about what the
reader SHOULD emit, which only a listener can answer — so: synthesize both and ask.

**A/B (Kokoro af_heart).** A = as-is (`ənd`), B = the clause-initial one forced to `ˈænd`.
Reported: **B is better.** A clause-initial coordinator is not in a reduction environment — it is
phrase-initial and carries the beat that restarts the clause.

**⚠ The first implementation was a no-op for the only word it was for.** It was written as a SET of
words that "keep their citation stress", which is correct for `or` (CMUdict has the strong `AO1 R`,
lexicon `ˈɔːɹ`) and does nothing whatever for `and`: CMUdict carries only the weak `AH0 N D`, so
`and`'s citation IS `ənd`. The probe showed `or` changing and `and` not, which is the only reason it
was caught. It is a MAP to the strong form now, written out, so neither word depends on which form
CMUdict happened to record.

**⚠ `or` was extrapolated and is NOT shipped.** It is the obvious parallel — also a coordinator, also
in `unstressedWords` — and the A/B did not support it: *"I could hear a difference, but not one that
carried any meaning to me — just pure speaker dynamicism."* `and` earns its entry because the reduced
reading was reported as actively wrong; `or` gets nothing until something measures it. Its absence is
pinned by a test so re-adding it has to be deliberate.

Coordinators only: clause-initial `the`, `to`, `of`, `in` must keep reducing — "…, the man arrived"
does not want `ðˈiː`. And the strong coordinator is excluded from the clause's primary-stress test,
or restoring it silently cancels the tonic guarantee: ", and it was" has no other primary, and the
nucleus must still land on `wˈʌz` rather than staying at the head.

## Run 6 — 2026-09-14 13:05 — `profile` read as "pro-fil"

**Report.** *"profile -> 'pro-fil', I expected 'pro-FI-ul'"*, in a sentence using it as a verb.

**Question.** Is the reader wrong, or is this the acoustic model again?

**Raw finding — the reader agrees with both references.** `pɹˈoᶷfaᶦɫ`, and espeak-ng gives
`pɹˈoʊfaɪl` and CMUdict `P R OW1 F AY2 L`. Initial stress in all three. So on its face the reported
expectation contradicts the dictionaries, and the first A/B (A as-is vs B/C with the second syllable
stressed and the `l` vocalized) came back **C**, i.e. against the references.

⚠ **That is when to look harder, not to edit the lexicon.** A second A/B was run on `profile` as a
NOUN to test the noun/verb-heteronym hypothesis — the reader has POS-gated heteronyms and this is
the shape `record`/`permit` take. Result: **still C**, so not a heteronym, and a flat override of
two references on one listener's preference was the only remaining option. Which was the cue that
the hypothesis was wrong.

**The real cause.** CMUdict writes `AY2` — a SECONDARY STRESS — and the reader was emitting no
stress mark on it at all:

```
profile     P R OW1 F AY2 L      →  pɹˈoᶷfaᶦɫ     ← no mark on the AY
crocodile   K R AA1 K AH0 D AY2 L →  kɹˈɑːkəd̬ˌaᶦɫ  ← keeps its ˌ
```

`englishArpabet.ts` drops a 2° whose syllable is ADJACENT to the 1° — the stress-clash rule. It fires
for `profile` (PRO-file) and not for `crocodile` (CRO-co-dile). The mark is not replaced by anything:
the vowel is a full diphthong that is simply UNMARKED, and the TTS renders unmarked as reduced. So
the third A/B offered the faithful reading — `pɹˈoᶷfˌaᶦɫ`, exactly what CMUdict says — and it came
back **"B, C, and D are all good"**: the dictionary-faithful reading is as good as the override.

⚠ **A rule change alone does nothing here, and `en_rebuild_lexicon.mts` says why.** `profile` is a
flat-lexicon hit, resolved before the OOV G2P runs, so editing the rule changed what the G2P *would*
have produced and changed nothing about what is said. The first attempt looked like a no-op for
exactly that reason.

**Scoping it — every guard was bought with a measurement.** Rows changed, per
`en_rebuild_lexicon.mts --diff`:

| rule | rows | verdict |
|---|---|---|
| every diphthong, any position | 13,189 | far past the reported shape |
| + final nucleus only | 2,684 | ✗ `zorro`→`zˈɔːɹˌoᶷ`, `aalto`, `adolfo` — CMUdict writes `OW2` on an ordinary final `-o`, and marking it over-articulates |
| + true diphthongs only (AY/OY/AW) | 1,113 | ✗ `a priori`→`pɹaᶦˈɔːɹˌaᶦ`, an OPEN final syllable — broke an existing test |
| + closed final syllable | **1,024** | ✓ whole suite green |

What survives is compounds whose second element genuinely takes a beat: `skylines`, `breakout`,
`graveside`, `birthrights`, `yuletide`, `zeitgeist`, `textile`.

⚠ **The referee cannot see this change, and says so.** en scores **41.86% (954/2279) before and
41.86% after** — identical, because the eval folds to a segmental backbone and stress marks are not
in it. So the referee neither supports nor opposes, and this rests on the dictionary being followed
rather than overruled, plus one listener's A/B. Recorded because a reader later looking for
independent corroboration will not find any.

Round trip after the rebuild: 117,480/117,480, 0 would change.

## Run 7 — 2026-09-14 13:35 — adversarial A/B on the clash change before merging

**Question.** Run 6 landed on 1,024 changed rows with NO referee signal and one word's A/B behind it.
Before merging: what would most likely expose a flaw, and does it?

**Designing the test rather than guessing at it.** All 1,024 changed words were extracted by diffing
the two lexicon versions, then filtered to the 475 that appear in `/usr/share/dict/british-english`
— which strips CMUdict's surname noise (`boehnlein`, `grumbine`, `bauknight`) and leaves what
actually occurs in prose. The class is overwhelmingly COMPOUNDS (`deadline`, `website`, `midnight`,
`workout`, `playground`), which is the intended target. Two subgroups are where it could be wrong:

- **Latinate non-compounds** — `finite`, `canine`, `senile`, `archive`, `enzyme`, `percentile`,
  `textile`. Not compounds, so the final syllable has not EARNED a beat the way `sky·line` has.
- **Idiom-weak** — `in the meantime`, `sometime`, `online`, where the second element normally goes
  weak; and the test sentence for these puts FIVE marked syllables in a row, so it doubles as the
  cumulative-rhythm test.

Plus `unite`, the most interesting single word in the set: CMUdict writes `Y UW1 N AY2 T`, primary
on the FIRST syllable, which is already arguable (most say yoo-NITE). Before, the second syllable was
unmarked and the oddity was hidden; after, it is audible. And a CONTROL of ordinary compounds, on the
principle that if the control sounds worse the whole change is wrong.

**Method.** True before/after — the submodule was checked out at `main` and at the branch and each
sentence synthesized from scratch, so the C# and the lexicon move together. NOT hand-edited phoneme
strings, which would have tested a string I wrote rather than the change.

```
before:  ɪn ðə mˈintIm, ðə wˈɛbsIt wˈɛnt ˈɔnlIn sˈʌmtIm ˈæftəɹ mˈɪdnIt.
after:   ɪn ðə mˈintˌIm, ðə wˈɛbsˌIt wˈɛnt ˈɔnlˌIn sˈʌmtˌIm ˈæftəɹ mˈɪdnˌIt.
```

**Raw finding.** *"latinate: after A is good; idiom: both are fine, I like after better; unite: after
(just barely); control: after (again, barely)."*

**Implication.** No flaw found, and the two cases built specifically to break it did not. The
adversarial subgroups came back at least as good as the compounds, and the control — the case that
would have condemned the whole change — came back better. The two "barely" verdicts are the honest
shape of the result: this is a small improvement, not a dramatic one, which is what a
dictionary-faithfulness fix should look like. Merged on that basis rather than on the single
`profile` A/B that started it.

## Run 8 — 2026-09-14 13:30 — four more reports

**Reports.** `BTU/hr/sf` should read "B T U per hour, per square foot"; `thermocouple` sounds like
"thermo-coople"; `≥` is not said; `TY2024` should read "Tax Year 2024".

### `≥` — and every other Unicode relational

Measured across the operator set, not just the reported symbol:

```
handled:  =  equals      >  greater than     <  less than      ×  times
DROPPED:  ≥      ≤      ≠      ±      ≈
```

`=`, `<`, `>` and `×` being voiced is exactly what hid this. ⚠ `≠` and `±` are the dangerous two:
this file ranks its failure classes "missing word ≥ wrong word ≫ invented number", and a dropped
`≠` is not a missing word — it is the INVERSE claim. `a ≠ b` read as "a b"; `5 ± 0.2` as "five zero
point two", a wrong number rather than an absent one.

The ASCII `<`/`>` are digit-gated on purpose (they can be markup). The Unicode five cannot be
anything but themselves, so they are claimed wherever they stand — **including the prefix position,
which is where they mostly occur**: "Panels lit at ≥30%" has no left operand for an infix pattern to
bind to, and read as "at thirty percent", the threshold gone and the sentence still fluent.

### `thermocouple` — the same shape as `in situ`

OOV, so the two entry points guessed, and they guessed differently — the async one the app uses
guessed `kʰˌuːpəɫ`, which is literally "coople":

```
thermocouple    sync: θˈɝmoᶷkʰˌʌpəɫ    async: θˈɝmoᶷkʰˌuːpəɫ    ← the reported reading
thermocouples   sync: θˈɝmoᶷkʰˌʌpəɫz   async: θˈɝmoᶷkʰˌaᶷpəɫz   ← "cow-ples"
```

The SINGULAR and PLURAL guessing differently is the tell that neither was a reading of anything.
Two independent sources fix the entry: espeak-ng gives `θˈɜːməkˌʌpəl`, and CMUdict's own
`thermostat` is `TH ER1 M AH0 S T AE2 T` — so the `-mo-` is a SCHWA, not the `oᶷ` the OOV g2p read
off the spelling, and `couple` is `K AH1 P AH0 L`. Added as `TH ER1 M AH0 K AH2 P AH0 L`; round trip
after, 0 would change. No A/B needed — nothing here was a matter of taste.

### `TY2024` and `BTU/hr/sf`

`TY2024` read as the word "tie" plus a number — the `IR` shape again, two letters with a vowel that
the phonotactic gate calls pronounceable. The four-digit year is what makes it claimable at all,
since bare `TY` is "thank you" in casual writing. "Tax Year 2024" then earns the pair-wise year
reading (`twenty twenty-four`) for free, because the existing rule keys on the word `Year`.

`BTU/hr/sf` read as `bˈiː tʰˈiː jˈuː ˈeᶦt͡ʃˈɑːɹ sf` — slashes dropped and **`sf` arriving in the
phoneme stream as raw letters**. Fixed with slashed rate keys, which is the table's own idiom
(`km/h`, `m/s`, `mbit/s`). Two things the measurement forced:

- The expansion spells `b t u` rather than emitting `BTU` for the initialism pass, because **after a
  number that pass deliberately backs off** — a caps run there is the unit rule's territory. `250 BTU`
  read as the word *bt͡ʃˈuː* ("btchoo") on main, before any of this, and emitting `BTU` would have
  changed nothing. Pre-existing, now fixed as a side effect.
- A bare arm for slashed keys with NO number in front, because that is the shape the report arrived
  in (a column header). The number gate exists because a bare `km` in prose is mostly not a unit;
  that reasoning does not extend to a slashed key, since a slash inside a token can never be a word.
  Ordered after the number arm so count agreement survives (`50 km/h` plural, bare `km/h` singular),
  with letter lookarounds that keep it out of URLs — `example.com/s/page` contains `m/s`.

⚠ **Also left undone: the plural of a spelled unit.** `50 BTUs` reads `btˈʌs` ("buttus"). The
initialism pass's run needs a non-letter after it, so a trailing plural `s` blocks the match and the
g2p reads the whole cluster. Measured on main, so it is pre-existing and general — `50 CDs` and
`50 MPHs` take the same path and only come out right by accident of the g2p reading their letters.
The obvious fix, letting the unit rule take an optional `s`, COLLIDES: `m` is a unit key, so `50 ms`
would become "fifty meters" instead of milliseconds. Not worth it for this.

⚠ **Left undone, recorded rather than fixed.** `500 SF` still reads `sf` as raw letters: the
initialism pass only claims ALL-CAPS runs, so a lowercase vowelless OOV token leaks its graphemes.
`hr` escapes only because it happens to be a lexicon headword with the spelled IPA baked in — the
same accidental coverage as the Commonwealth-spelling report. Inside a slashed rate there is nothing
else those tokens can be, which is why the fix above is safe; bare `SF` is San Francisco and bare
`HR` is home runs often enough that neither earns a unit entry, and the general leak wants its own
change.

## Run 9 — 2026-09-14 13:48 — `CO₂` read as "co two"

**Report.** *"CO₂ reads as co two instead of see oh two."*

**Question.** Why does `CH₄` spell out and `CO₂` not, when Run 4 fixed the subscript for both?

**Raw finding — the same accidental coverage as every other report in this log.** The subscript fold
is working; the difference is one step later, in the initialism pass:

```
CH₄    sˈiː ˈeᶦt͡ʃ fˈɔːɹ      ✓   `CH` has no vowel → isUnreadable → spelled
CO₂    kʰˈoᶷ tʰˈuː           ✗   `CO` is pronounceable AND a dictionary word
SO₂    sˈoᶷ tʰˈuː            ✗   "so two"
NO₂    nˈoᶷ tʰˈuː            ✗   "no two"
AS400  æz fˈɔːɹ hˈʌndɹəd     ✗   "az four hundred"
H2SO4  ˈeᶦt͡ʃ tʰˈuː sˈoᶷ fˈɔːɹ ✗  "H two so four"
```

`CH₄` is right by luck. `CO`, `SO`, `NO`, `AS` are all pronounceable and all recorded, so every test
in `core/initialisms.ts` passes them through as the word they spell.

**Fix.** A two-letter caps run GLUED to digits is a code, not a word. Placed so it OUTRANKS the
dictionary test, because the whole failing class is runs that ARE words — placing it after would fix
nothing. The callback needed the match offset to tell the two `RUN_OR_CODE` alternatives apart; the
existing `tok.length < 2` check only worked because a free-standing run cannot be one letter.

⚠ **Two letters only, and `COVID19` is the case that says so.** Widening to any glued run turns it
into "C O V I D nineteen". Longer glued runs are where the real words live; no two-letter caps run
glued to a digit is a word being used as one.

**Shared-tier change, measured as one.** This is `core/initialisms.ts`, which all 189 languages use.
`dotnet test` 6,597 passed with **no golden changed** — the fleet's parity corpus contains no
two-letter-plus-digits token, so nothing moved anywhere but the new tests.

⚠ **Known limit, not fixed.** `Fe₂O₃` still reads "fay two oh three": `Fe` is MIXED case, and
`RUN_OR_CODE` claims only all-caps runs. Covering mixed-case element symbols needs a periodic table,
which is the chemical-name question the reporter raised separately and which was recommended against
— so it is recorded here rather than started.

## Run 10 — 2026-09-14 14:08 — `5–15%` read as "five fifteen percent"

**Report.** *"'the 5–15% methane-in-air flammable range' — the number range to be 'five to fifteen
percent'; it's currently reading 'five fifteen percent'."*

**Raw finding.** The en dash is dropped outright, and with it the only thing marking the two numbers
as a span. The year rule makes the same shape worse in its own way:

```
"5–15%"       → "5–15 percent"        → five fifteen percent
"2019–2020"   → "20 19–20 20"         → twenty nineteen twenty twenty
"pages 5–15"  → unchanged
```

**⚠ The ASCII hyphen is NOT claimable, and the measurement is what settles it.** The obvious rule —
any dash between digits becomes "to" — is wrong three ways over, all of them already working:

```
2024-01-15   → "january 15th 20 24"   an ISO DATE, already read by the rule above
555-0100     → unchanged               a phone number
3-2          → unchanged               a score
```

Claiming the hyphen turns all three into ranges. The typographic dashes — figure U+2012, en U+2013,
em U+2014 — are none of those things: they are what a document uses for a span, and nothing else.
U+2212 MINUS is excluded too, being a sign that belongs to the negatives rule at step 0f.

**Unspaced only.** A SPACED en dash is a parenthetical break ("the result — 15 — was high"), not a
span; the range form is written tight in every style guide that has an opinion.

**Ordered after the year rule**, which turns out to be free: `2019–2020` has already become
`20 19–20 20` by then and the dash is still between digits, so both halves read pair-wise AND the
range says "to" — `twˈɛnti nˈaᶦntˈiːn tʰuː twˈɛnti twˈɛnti`.

⚠ **A test expectation written by hand was wrong and the suite caught it**: `fifteen` is `fɪftˈiːn`
in this context, not the `fˈɪftiːn` I assumed — the stress moves with the phrase. Both expectations
are generated from the engine now rather than guessed.

⚠ **The suite caught a second thing: there was ALREADY a dashed-year-range rule**, and its test
pinned the dash being KEPT (`guru nanak 1469–1539` → `guru nanak 14 69–15 39`). That rule converts
both years pair-wise and deliberately left the dash in the text, where the tokenizer dropped it — so
the span went unsaid there too, and had since it was written. The expectation moved to
`14 69 to 15 39`; what that test exists for, that the LEFT year is not eaten first, is unaffected.
Its ASCII-hyphen lines are unchanged, which is the point of the whole gate.

## Run 11 — 2026-09-14 14:22 — `Rev. B` read as "reverend"

**Report.** *"'Rev. B, 2025-10-21' currently reads 'reverend', instead of 'revision'. Not sure about
the fix."*

**Raw finding — three problems, not one.** `rev` is in `PLAIN_ABBREV`, the FIXED-reading table, which
claims the token unconditionally:

```
"Rev. B, 2025-10-21"  → "reverend B, october 21st 20 25"
"Rev. 3"              → "Rev. 3"              ← unchanged, and the DOT SURVIVES
"3000 rev. per minute"→ "3000 reverend per minute"
```

`Rev. 3` is the `max.` defect again: the table's arm requires a following LETTER, so before a digit it
does not fire at all and the dot reaches the clause segmenter as a phrase break.

**The discriminator is what follows**, which is the shape `st.` and `dr.` already use — but their
neighbour test reads a following LOWERCASE word, and a revision designator is a capital or a digit,
so this needs its own arm rather than an entry in their table. A designator is a lone capital or a
number; `(?![a-z.])` is what separates it from a name:

```
Rev. Smith      capital + lowercase → a name        → reverend ✓
Rev. J. Smith   capital + PERIOD    → an initial    → reverend ✓   ← the hard one
Rev. B,         capital + comma     → a designator  → revision ✓
Rev. 3          a digit             → a designator  → revision ✓
```

⚠ **The `i` flag silently inverted the test, and a two-letter designator is what caught it.** With
`i`, the `[a-z]` inside the lookahead matches UPPERCASE too, so `(?![a-z.])` rejected a following
capital and `Rev. AB` fell through to "reverend" while `Rev. B1` worked. The flag is off now and the
literal is cased by hand (`[Rr][Ee][Vv]`). Worth remembering generally: adding `i` to a pattern
changes what every character class in it means, including the ones inside lookarounds.

⚠ **Left undone.** `3000 rev. per minute` still reads "reverend" — that `rev.` is *revolutions*, and
telling it apart needs a preceding number rather than a following designator. Not reported, genuinely
ambiguous, and a different arm; recorded rather than guessed at.

## Run 12 — 2026-09-15 15:10 — a doubled capital read as one vowel

**Report.** A project code whose last field is `-AA` read as one run-together
vowel instead of two letter names. Heard through Kokoro, seen against the
reader's on-screen IPA.

**Question.** Is the code's whole shape misread, or only the doubled field?

**Command.** `phonemize("(ABC-AA)", "en")` and neighbours.

**Raw finding.**

```
(ABC-AA)  → ˈeᶦbiːsˌiː ˈɑː      ⚠ ABC is letters, AA is the WORD [ˈɑː]
(ABC-BB)  → ˈeᶦbiːsˌiː bˈiː bˈiː   BB is already letters
AAA       → tɹˌɪpəlˈeᶦ            "triple-A", a recorded reading
```

So only the doubled field, and not because it is doubled: `AA` is a CMUdict
entry (the Hawaiian lava word), so `isRecorded` claims it and the initialism
pass hands it to the dictionary — which is the documented, correct behaviour of
that test for `CD`, `TV`, `PC`.

**Census, because one token is not a class.** All 676 two-letter capital runs,
each in a lowercase frame (`the XX thing`), classified by whether the reading
comes back as one token or as separate letter names:

```
read as a WORD: 315/676
doubled among them: AA CC EE MM OO SS UU YY
```

The 315 is not a defect count — most of it is CMUdict's own letter readings
(`CD` → siːdˈiː, `TV`, `PC`, `DC`, `FM`, `IQ`), which are one token with one
stress and better prosody than spelling out. The genuinely wrong ones are the
doubled capitals, and there are six:

```
AA [ˈɑː]   the lava word            MM [m]    the interjection
EE [ˈiː]   ONE letter name for two  OO [ˈuː]  UU [ˈʌ]  YY [d͡ʒˈiː]
```

`EE` is the one worth pausing on: it returns a plausible-looking reading that is
exactly half the token. `CC` and `SS` are on the list of doubled capitals but are
NOT defects — CMUdict records both with their letter readings already.

**Implication.** A repeated capital is an identifier, a date mask or a size, and
never a word being used as one. But that is a lexical fact about English, and
`initialisms.ts` is explicit that lexical facts belong in the manifest rather
than in logic ("⚠ THERE IS DELIBERATELY NO LENGTH-BASED LEXICALIZATION
THRESHOLD"). So the fix is six entries in `acronymLetters`, not a doubled-letter
rule. Data-only, so the C# port inherits it by reading the same `english.jsonc` —
no port change and parity holds by construction.

**Turned up by the same run, and fixed with it:** `YYYY-MM-DD` read its first
field as the invented word [jˈiːʲiʲi]. `DD` needs no entry (unrecorded and
unpronounceable, so the OOV rule already spells it); `yyyy` gets one.

**⚠ NOT FIXED, found while measuring.** `the II thing` → `ðə ðə sˈɛkənd θˈɪŋ` —
"the the second". The Roman-numeral pass claims `II` and expands it to an
ordinal WITH its article, without noticing the article already there. Pre-existing,
unrelated to this report, and a different pass; recorded rather than folded into
an unrelated change.

## Run 13 — 2026-09-15 16:20 — a space-guarded dash introduces no pause

**Report.** Space-guarded hyphens, en dashes and em dashes should introduce a
pause in sentence prosody. Heard in a question with a spaced hyphen mid-clause.

**Command.** `phonemize` on the four written forms against the comma baseline.

**Raw finding.** All four are dropped outright, and the comma is not:

```
the answer - a long one - arrived   → ðə ˈænsɚ ə lˈɔːŋ wˈʌn ɚˈaᶦvd
the answer -- … --                  → (identical, no boundary)
the answer – … –                    → (identical)
the answer — … —                    → (identical)
the answer, a long one, arrived     → ðə ˈænsɚ , ə lˈɔːŋ wˈʌn , ɚˈaᶦvd
```

**Implication.** The rule immediately above this one in `normalize.ts` had
already written the diagnosis and not acted on it — "⚠ UNSPACED, because a
SPACED en dash is a parenthetical break, not a span". The span rule correctly
refused the spaced form and nothing else claimed it.

The pause is a COMMA, not a word: `clausePunctuation` already maps `;` and `:`
to `,` for the same reason, and inventing a connective would be reading
something the writer did not write.

**The disambiguation is the spaces, and it was measured against the joiner:**

```
a well-known case       → ə wˈɛɫ nˈoᶷn kʰˈeᶦs        unchanged ✓
state-of-the-art design → stˈeᶦt ʌv ðə ˈɑːɹt …       unchanged ✓
re-enter the code       → ɹˈeᶦ ˈɛntɚ …               unchanged ✓
```

**A second form, found while checking the first.** The UNSPACED em dash — the
standard US style — was dropped just as completely, and it is claimed too. The
unspaced EN dash is NOT: in English it is a joiner (`Bose–Einstein`), and
between digits it is a span the range rule has already turned into "to". Split
by evidence rather than symmetry.

**A list marker is why the left guard is a non-space rather than `\s`.** With
`\s`, a newline satisfies it and `\n- second item` becomes a pause on every
bullet. Pinned as a test.

**⚠ THE FIRST VERSION BROKE TWO PINNED TESTS, and they were right.** A spaced
dash between two NUMBERS is a span written loose, not a parenthesis:

```
the 1418 - 1450 period   expected "the 14 18 - 14 50 period"
                         got      "the 14 18, 14 50 period"
Sejong (1418 – 1450)     same shape
```

Both pins carry corpus measurement behind them (one records +0.106 against two
recognizers). A pause there is not obviously wrong, but it is a different
question from this report, and changing a measured reading as a side effect of an
unrelated fix is how a regression ships under a green gate. The rule is now two
arms that claim everything EXCEPT digit-on-both-sides; the digit/word mixes
(`from 1990 - present`, `page - 5`) still pause.

**⚠ LEFT OPEN:** a spaced dash between two numbers still gets no boundary at all
— neither a pause nor "to". The tight form says "to" and the loose form says
nothing, which is a real inconsistency, but closing it means moving two measured
pins and wants its own evidence.

**Goldens: zero drift.** 25 stale `en` rows and 103 findings fleet-wide, before
and after — no golden row carries the shape. `regex-diff`: 142808 probes, 0
DIFFER, so both new patterns translate identically for the port.

### ⚠ The class is 179 languages wide

Measured across all 189 shipped languages, comparing `"aba - ebe"` against
`"aba, ebe"` and counting only the languages that mark a comma as a pause at all:

```
comma-marking languages: dash also pauses 9, dash DROPPED 179
```

English was one of the 179 and is now one of the 9 that pause. This is the same
shape the tree already argues about elsewhere — "the same six characters were
wrong in eleven files is the case for fixing the class, not the language"
(`separatorHygiene.ts`) — and the rule qualifies under that file's own test for a
shared rule: it spends a separator and emits no word, so it cannot speak a word a
language may not use.

NOT done here, deliberately. It is a punctuation change to 179 languages and
would move goldens across the fleet, which is a measurement exercise of its own
and one that should not be started while 103 golden findings are already
outstanding and undiagnosed. Recorded for a session of its own.

## Run 14 — 2026-09-15 17:05 — a postfix plus is dropped

**Report.** A chemical-fraction code ending in `+` read without the sign.

**Command.** `phonemize` over the sign in every position.

**Raw finding.** The sign is read in INFIX and PREFIX position and dropped in
POSTFIX position:

```
2 + 2       → tʰˈuː plˈʌs tʰˈuː      ✓        C7+         → sˈiː sˈɛvən        ⚠
2+2         → tʰˈuː plˈʌs tʰˈuː      ✓        18+         → eᶦtʰˈiːn           ⚠
+5 volts    → plˈʌs fˈaᶦv vˈoᶷɫts    ✓        100+ people → wˈʌn hˈʌndɹəd …    ⚠
5 + 3 = 8   → … plˈʌs … ˈiːkwəɫz …   ✓        C++ code    → sˈiː kʰˈoᶷd        ⚠
                                              Na+ ion     → nˈɑː ˈaᶦən         ⚠
                                              the + sign  → ðə sˈaᶦn           ⚠
```

**Implication.** Both existing arms require a DIGIT ON THE RIGHT
(`(\S)\+\s?(\d)` and `(^|\s)\+\s?(\d)`), so a sign in final position has no
operand for either to bind to. This is the same shape as the Unicode relationals
(Run 9): a pattern that can only match an operand it does not have, failing
silently and leaving a fluent sentence with the content gone.

Two arms added — postfix, and the sign between two NON-digit operands, which the
infix arm's digit gate misses the same way (`a + b` → "a b").

**⚠ THE RUN MUST BE MATCHED WHOLE, and the first attempt at it would not have
been.** `C++` is two signs, and a per-sign rule reads the first and STRANDS the
second: `String.replace` scans the ORIGINAL string, so after consuming `C+` the
next `+` no longer has a letter before it and the pattern declines. Matched as
`(\++)` and repeated per sign, `C++` reads "C plus plus", which is also the right
reading of the language's name.

**The list-marker guard is the same one the dash rule needed** (Run 13): the
between-words arm takes HORIZONTAL space only, because with `\s` a newline
satisfies the left guard and a `+`-marked list says "plus" on every bullet.
Pinned.

**Gates.** TS 5878 pass, C# 6648 pass, regex-diff 142982 probes 0 DIFFER,
goldens unchanged (25 stale en rows, 103 fleet findings). The corpus freshness
test caught the two new patterns before the diff did, which is what it is for.

**⚠ NOT FIXED, visible in the same measurement:** `A+` reads `ə plˈʌs` — the sign
is now there but the ⟨A⟩ is the reduced ARTICLE, not the letter name. A lone
capital `A` is genuinely ambiguous ("A dog barked." must stay `ə`), so telling
the grade from the article needs context this pass does not have. Recorded
rather than guessed at.

## Run 15 — 2026-09-15 17:45 — a dash between two month names is dropped

**Report.** `May–June 2025` should say "to" between the months; it read
`meᶦ d͡ʒˈuːn twˈɛnti twˈɛnti fˈaᶦv` — "may june".

**Command.** `phonemize` over the written forms and the neighbouring shapes.

**Raw finding.** The span is lost in every form, and the two rules that could
have claimed it both decline for their own good reasons:

```
May–June 2025    → meᶦ d͡ʒˈuːn …        ⚠ dropped
May-June 2025    → meᶦ d͡ʒˈuːn …        ⚠ dropped
July–August 2025 → d͡ʒuːlˈaᶦ ˈɑːɡəst …  ⚠ dropped
Monday–Friday    → mˈʌndi fɹˈaᶦd̬i      ⚠ dropped
May – June 2025  → mˈeᶦ , d͡ʒˈuːn …     ⚠ a PAUSE, from Run 13's rule
```

**Implication.** The range rule is digit-gated on both sides (`(\d)[dash](?=\d)`)
because an unspaced dash between digits is a span; a dash between two NAMES had
no rule at all. And Run 13's parenthetical rule claimed the SPACED forms as a
pause, which is the right default for words and the wrong one here — so the
spaced form was losing the span a second way, by a rule added this morning.

A dash between two CALENDAR NAMES is a span. Months and weekdays are closed sets
the file already carries.

**⚠ ⟨may⟩ IS SAFE THOUGH IT IS A MODAL VERB**, and that is worth stating because
the weekday-abbreviation gate a few lines above had to exclude it explicitly
("they wed May 5" read as "they WEDNESDAY may fifth"). The licence here is not
the word — it is TWO calendar names joined by a dash, and a modal is not followed
by a dash and a second month. `March` and `August` are ordinary words on the same
footing and take the same licence.

**⚠ ORDER IS LOAD-BEARING:** the calendar rule runs BEFORE Run 13's parenthetical
rule, or the spaced forms are claimed as a pause first. Pinned.

**Gates.** TS 5878 pass, C# 6654 pass, goldens unchanged (25 stale en rows, 103
fleet findings). ⚠ The new pattern is DYNAMIC (built from the month table), so it
is not a regex LITERAL and the corpus extractor does not see it — the corpus is
unchanged and the differential does not cover it. Parity is carried by the C#
tests instead, which assert the TypeScript's strings verbatim. The same is true
of the month-abbreviation rules already in this file.

**⚠ NOT FIXED, two things visible in the same measurement:**

  · `Jan–Mar` and `Mon–Fri` still read as two words. The abbreviations are
    deliberately out of the calendar set: `Jan`, `Mar` and `Aug` are personal
    names, and this file's own abbreviation rules already refuse them without an
    adjacent digit for exactly that reason. A pair of them IS a stronger signal
    than one, but it is not a signal this report measured.
  · `May` in `May to June` reads UNSTRESSED (`meᶦ`, not `mˈeᶦ`), because ⟨may⟩ is
    in `unstressedWords` as a modal. The month wants citation stress. Telling the
    noun from the modal is POS work the de-accent pass does not do here.

## Run 16 — 2026-09-15 20:40 — three words, two causes, and a rule that had to be withdrawn

**Report.** `details` read "dee-tuls" rather than "de-TAILS"; `determine` and
`replaced` reported as front-stressed.

**Command.** `phonemize` over each word and its whole inflectional paradigm.

**Raw finding.** Three different situations, and one of them was not a defect:

```
determine   dᵻtʰˈɝmən     ✓ already second-stressed, in both engines and in the
                            Kokoro stream (ᵻ is vocab id 177, carried through)
detail(s)   dˈiːt̬eᶦɫ(z)   ⚠   detailed   dᵻtʰˈeᶦɫd   ✓
replace(d)  ɹiːplˈeᶦs(t)  ⚠   replacing/replaces/replacement  ɹᵻplˈeᶦs…  ✓
```

**Implication.** Both defects are a paradigm at war with itself, and neither is a
missing rule.

`detail` was in the POS-HETERONYM table: `{ default: dˈiːt̬eᶦɫ, verb: dᵻtʰˈeᶦɫ }`.
It is the one entry there whose two readings are a REGIONAL variant rather than a
part of speech — every other row is a stress pair a speaker uses both halves of
(`ˈæbstɹækt` the thing, `æbstɹˈækt` the act), while this asked the POS tagger to
choose a reading the noun takes both of. CMUdict records ONE pronunciation for
all three forms, `D IH0 T EY1 L`, so the table was asserting something its own
source does not carry — and it split the paradigm, since the lexicon still had
`detailed`. Entry removed. ⚠ General American does use the front-stressed noun;
this is a one-line restore if that is wanted.

`replace` is `R IY2 P L EY1 S` while `replacing` is `R IH0 P L EY1 S IH0 NG` —
same stem, same prefix, two ARPABET vowels. Only `IH0` reaches the weak-vowel
rule.

### ⚠ The rule I wrote for it was wrong, and the lexicon rebuild is what showed it

First attempt: reduce any `IY` in the Latinate-prefix position. 896 lexicon rows
moved. Narrowing to a SECONDARY stress — on the theory that a 2° on a prefix the
same paradigm reduces is a recording artifact — still moved 184, and the golden
check found `reconstructed` among them:

```
ɹˌiːkənstɹˈʌktᵻd  →  ɹˌᵻkənstɹˈʌktᵻd     ⚠ "REE-constructed" is right
```

The revert diff is the whole argument: `reconstruct`, `redesign`, `redeploy`,
`refinance`, `rehabilitate`, `relocate`, `reproduce`, `preteen`, `preseason`,
`decompose`, `deform` — the PRODUCTIVE prefix meaning "again", which genuinely
carries that beat. Nothing in the ARPABET separates `R IY2 P L EY1 S` from
`R IY2 K AH0 N S T R AH1 K T`. What separates them is that `replace`'s own
inflections contradict it and `reconstruct`'s do not — a lexical fact about three
rows, not a phonological rule.

**Rule withdrawn; three ARPABET rows corrected instead** (`replace`,
`replaced`, `replaceable` → `R IH0`), which is what `initialisms.ts` says in its
own header about not re-deriving lexical facts in logic.

⚠ **An unstressed `IY0` prefix is deliberately left alone.** It cannot be told
apart from the productive one — `rewire` and `report` are both `R IY0 …` — and
this tree already pins both readings as correct. `report` → `ɹipʰˈɔːɹt` stands.

**Gates.** TS 5905 pass, C# 6654 pass, lexicon round-trip 100%, goldens 3 rows
(all `details`, in en/en-GB/en-IN) then 0 stale, parity 189 languages
byte-identical.

**⚠ Left open, measured:** `review` is `R IY2 V Y UW1` while its own inflections
are `R IY0` — the same paradigm split one step milder (a length difference, not a
vowel-quality one: `ɹiːvjˈuː` against `ɹivjˈuː…`). Not reported, and correcting it
means the same three-row judgement on a word nobody has complained about.

## Run 17 — 2026-09-18 13:10 — thirteen reports from a document review, and one gate behind five of them

**Report.** A batch of thirteen, from reading real documents in the desktop reader:

| reported | heard | wanted |
|---|---|---|
| `horsepower` | horse-pour | horse-power |
| `Section G.2` | G 2 | gee point two |
| `PSI` | psy | P S I |
| `wd 40` | d 40 | W D forty |
| `litres/day` | litres day | litres per day |
| `m³/hr` | cubic meters H R | cubic metres per hour |
| `Colin` | co-lin | call-lin |
| `vs` | v s | versus |
| `derivable` | der-iv-able | der-**I**v-able |
| `Oct-Dec 2024` | Oct December 2024 | October to December 2024 |
| `Saipavan` | s'puvan | sI-PA-van |
| `FREQUENCY/CRITERIA` | frequency criteria | frequency slash criteria |
| `MSAPR` | M S A P R | em sapper |

**Question.** Which reproduce, and against which engine? The reports come from the app, which runs
the C# port, so a report could be a port defect rather than an engine one.

**Raw finding — the first probe was wrong, and wrong in a way worth recording.** Comparing
`phonemize()` in TypeScript against `PhonemizeAsync` in C# showed four rows differing:

```
                TS (sync)          C# (async)
wd 40           wd fˈɔːɹt̬i         wdˈiː fˈɔːɹt̬i
litres/day      lˈɪtɹˌeᶦz dˈeᶦ     lˈiːt̬ɚz dˈeᶦ
derivable       dɚˈaᶦvəbəɫ         dɚˈɪvəbəɫ
Saipavan        sˈeᶦpəvən          spˈʌvən
```

Every differing row is an OOV word, which is the tell: `phonemize()` is the SYNC entry point and
falls back to the n-gram, while `PhonemizeAsync` loads the BiLSTM. Re-probed through
`phonemizeAsync`, the two engines are byte-identical on all thirteen. **No port defect.** The parity
gate's own header warns about exactly this ("the goldens are async-mode output"); the warning is
about generating goldens, and it applies just as much to an ad-hoc comparison.

Corrected baseline, `en`, neural:

```
horsepower           hˈɔːɹspaᶷɚ             ← already correct, does not reproduce
Section G.2          sˈɛkʃən d͡ʒˈiː . tʰˈuː  ← the dot is a phrase break, not "point"
PSI                  sˈaᶦ                   ← read as the Greek letter
wd 40                wdˈiː fˈɔːɹt̬i
litres/day           lˈiːt̬ɚz dˈeᶦ           ← slash dropped
m³/hr                ˈɛm kjˈuːbd ˌeᶦt͡ʃˈɑːɹ
Colin                kʰˈoᶷlɪn
vs                   vˌiːʲˈɛs
derivable            dɚˈɪvəbəɫ
Oct-Dec 2024         ˈɔːkt dᵻsˈɛmbɚ …       ← Dec expanded, Oct not
FREQUENCY/CRITERIA   fɹˈiːkwənsi kɹaᶦtʰˈɪɹiʲə
MSAPR                ˈɛm ˈɛs ˈeᶦ pʰˈiː ˈɑːɹ
Saipavan             spˈʌvən
```

**The finding that outgrew the report.** `wd 40` looked like one bad token. It is not:

```
"WD 40"        → wdˈiː fˈɔːɹt̬i        "WD 40 spray"  → dˈʌbɫ̩juː dˈiː fˈɔːɹt̬i   ✓
"NHS 24"       → ˌɛnˈɛs …             "the NHS 24"   → ðə ˈɛn ˈeᶦt͡ʃ ˈɛs …       ✓
"ISO 9001"     → ˈaᶦsoᶷ nˈaᶦn …
"DSLR 5"       → dˈiːzɫjɚ fˈaᶦv
"WTO 2024"     → wtˈuː …
"CO2 LEVELS"   → kʰˈoᶷ tʰˈuː lˈɛvəɫz
```

Adding one lowercase letter anywhere fixes every one of them. `core/initialisms.ts` opens with

```js
if (!/\p{Ll}/u.test(text) && /\s/u.test(text.trim())) return text;
```

— the shouting-document guard. Digits and punctuation carry no case, so a heading, a table cell or a
form field with no lowercase in it satisfies "no lowercase + has whitespace" and **the entire
initialism pass is switched off**. The failures it then produces — `NHS` with the H gone, `WTO` as
*wtoo*, `DSLR` as *deezlyer*, `CO2` as *co two* — are verbatim the failures the file's own header
says the pass exists to prevent. The reader reaching this often is not bad luck: a document under
review is full of all-caps cells and headings.

**What the guard actually protects.** Walking the branches: `isRecorded` and the pronounceable
fall-through both return the token unchanged, and the glued-digit and unreadable branches only ever
claim runs that cannot be a shouted word. The only branch that would misfire on a shouting document
is `acronymLetters` — the lexical list of acronyms whose lowercase form IS a word (`US`, `IT`, `WHO`,
`LED`), where `WHO CARES` would become *W H O CARES*. So the guard is needed for exactly one branch
and is being applied to all six.

**Implication.** Narrow the guard to the `acronymLetters` branch instead of returning early. That is
strictly additive — the only outputs that can change are glued-digit codes and vowelless runs, both
of which are wrong today by construction.

**The narrow fix was wrong, and the goldens said so.** Guarding only `acronymLetters` and letting the
unreadable arm run made one tt row stale:

```
text: ПОЛОЖЕНИЕ ПО БУХГАЛТЕРСКОМУ УЧЁТУ «УЧЁТ ФИНАНСОВЫХ ВЛОЖЕНИЙ» ПБУ 19/02
want: … finansoˈvɨx vloʒeˈnij pˈbu …
got : … finansoˈvɨx ˈve ˈel ˈo ˈʒe ˈje ˈen ˈi qɨˈsqɑ ˈi ˈpe ˈbe ˈu …
```

`ВЛОЖЕНИЙ` is an ordinary Russian word in a Russian title being read by the TATAR engine, and its
⟨вл⟩ onset is illegal in Tatar phonotactics — so the unreadable arm calls it OOV and spells it out.
The claim that the unreadable arm "only claims runs that cannot be a shouted word" is therefore
false: a shouting document can contain a foreign word that no phonotactic test will save. The guard
is real; it was only its DEFINITION that was wrong.

(The same row also shows the guard costing something: `ПБУ` stays the cluster [pbu]. Both are true
at once, which is why the answer is a better document test rather than removing the guard.)

**Second attempt: count caps RUNS ≥ 2.** Failed on `(ABC-AA)` — a project code, one word, two runs,
no document anywhere in sight, and the `AA` that Run 12 had fixed went back to reading as CMUdict's
Hawaiian lava word.

**What shipped: count WHITESPACE-SEPARATED WORDS containing a caps run, ≥ 2.** The tt title is eight
such words; every shape in this batch is one; `(ABC-AA)` is one. And the two branches that claim a
run GLUED TO DIGITS moved above the guard, because a code is a code whether or not the document
shouts — that is what recovers `CO2 LEVELS` → "C O two".

```
WD 40        dˈʌbɫ̩juː dˈiː fˈɔːɹt̬i          NHS 24     ˈɛn ˈeᶦt͡ʃ ˈɛs twˈɛnti fˈɔːɹ
DSLR 5       dˈiː ˈɛs ˈɛɫ ˈɑːɹ fˈaᶦv         MP 3       ˈɛm pʰˈiː θɹˈiː
WTO 2024     dˈʌbɫ̩juː tʰˈiː ˈoᶷ …            CO2 LEVELS sˈiː ˈoᶷ tʰˈuː lˈɛvəɫz
```

`ISO 9001` deliberately still reads as a word: `iso` is pronounceable and unrecorded, which is the
documented "needs a data entry" case, and *eye-so* is what people say anyway.

**A pre-existing Polish defect fell out of it.** With the pass no longer switched off, `100 PLN` read
*sto pe el en*. Not a regression — `mam 100 PLN` (any lowercase at all) read that way already; the
caseless form was the only one the guard was accidentally rescuing, so the test covering it was green
on an accident. Cause: the symbol tier runs LAST, so a currency CODE meets the initialism pass first
and `pln` has no vowel. Fixed where the hook was designed for it — Polish now names its own currency
codes through `isRecorded`, and BOTH forms now reach the tier as *złotych*.

**Gates.** 6012 TS tests, 6687 C# tests, goldens fresh at 189 languages / 36495 rows, parity 189
languages byte-identical, regex-diff 143816 probes identical.

**Still open from the batch of thirteen:** `horsepower` does not reproduce (already
`hˈɔːɹspaᶷɚ`). The other eleven are untouched by this run and are separate causes — the slash, the
letter-dot-digit, the month range, bare `vs`, two lexicon entries, and two acronym classifications.

## Run 18 — 2026-09-18 15:20 — the slash, the section dot, bare `vs`, and half a month range

Four of the thirteen, all in `normalize.ts`, all the same shape: a mark or an abbreviation that no
rule claimed, reaching the g2p to be read as letters or dropped on the floor.

**The slash was three reports and one gap.** The unit table enumerates its slashed keys (`km/h`,
`btu/hr/sf`) and step 6a2 claims those wherever they stand; anything else kept its slash into the
g2p, where the mark is not a phone and vanishes.

```
litres/day           litres day
m³/hr                cubic meters aitch ar      ← `hr` spelled, the mark gone
FREQUENCY/CRITERIA   frequency criteria         ← two column headings run into one phrase
```

The compositional rule has two readings. A RATE — "per" — when either side resolves against the unit
table or the denominator is a period of time; that second test is what carries the measure words the
table does not have (`litres`, `visits`, `doses`). A CONJUNCTION — "slash" — otherwise.

**The conjunction arm over-fired, and the goldens caught it.** Said between any two words it makes
prose absurd:

```
transport to/from the airport   → "transport to slash from the airport"
the cluster/group of islands    → "the cluster slash group of islands"
```

Both are `en` golden rows. English does not voice this slash in running prose; it voices it between
LABELS. So the arm now requires both sides to be ALL-CAPS — the column-heading shape the report came
from — and leaves prose exactly as it was. `FREQUENCY/CRITERIA` and `TCP/IP` are claimed; `Pass/Fail`
and `yes/no` are not, which is the conservative side of a line that has to be drawn somewhere.

**And single letters are not a conjunction either.** `w/o`, `c/o`, `n/a` are words written with a
mark in them; giving them "slash" would have been louder than the old silent drop. They have fixed
readings, and any other two-single-letter pair is left alone.

**Bare `vs`.** `PLAIN_ABBREV` already had `vs: versus`, but every arm requires the dot — and bare it
reached the initialism pass, which found no vowel and read it *vee ess*. The table cannot simply drop
the dot requirement: `no`, `ed`, `col`, `gen`, `rep`, `sen`, `ave` and `ch` are all English words.
A small bare-safe list answers it.

⚠ **`jr`/`sr` were on that list for one commit.** `the SR&O series` came out "the senior and O
series". A two-letter run is half of an initialism far more often than it is a bare abbreviation;
`vs` survives the test only because it sits between two names, where an initialism half cannot.

**The month range.** `MONTH_ABBREV`'s gate is an adjacent DIGIT, which is what makes it safe on keys
that are also personal names (`Jan`, `Mar`, `Aug`). `Oct-Dec 2024` has a digit after `Dec` and
nothing at all after `Oct`, so one date was read two different ways in four characters — *ockt
December*. A month abbreviation with a dash and another month on the far side of it is as good a
frame as a digit, and better than one for the name keys: no person is written `Jan-Mar`. Ordered
first, so the digit rules and the existing dash-range rule then see two month NAMES.

**A section number's dot.** `Section G.2` — the dot is neither an abbreviation dot nor a sentence
end, and left alone it became a phrase break between the letter and the number, so the reference read
as two fragments with a pause where the listener needs the opposite.

**Result.**

```
Section G.2          sˈɛkʃən d͡ʒˈiː pʰˈɔᶦnt tʰˈuː
litres/day           lˈiːt̬ɚz pʰɝ dˈeᶦ
m³/hr                ˈɛm kjˈuːbd pʰɝ ˈaᶷɚ
vs                   vˈɝsəs
Oct-Dec 2024         ɑːktˈoᶷbɚ tʰuː dᵻsˈɛmbɚ twˈɛnti twˈɛnti fˈɔːɹ
FREQUENCY/CRITERIA   fɹˈiːkwənsi slˈæʃ kɹaᶦtʰˈɪɹiʲə
```

**Gates.** 6024 TS, 6687 C#, goldens 189/36495 fresh, parity 189 byte-identical, regex-diff 143990
probes identical.

**Found in passing, not fixed:** `24/7` reads "24 sevenths" — the fraction rule claims it. Out of
this batch's scope and recorded here so it is not rediscovered.

**Still open from the thirteen:** `PSI` (read as the Greek letter), `MSAPR` (wants a lexical
reading), `Colin`, `derivable`, `Saipavan` — two acronym classifications and three lexicon entries.

## Run 19 — 2026-09-18 16:30 — four lexical facts, and one name that is not going in

The residue of the thirteen: two dictionary rows that were wrong, two words that were in no
dictionary at all, and one that will not be committed.

**`PSI`.** CMUdict records `psi` as `S AY1` — the Greek letter — and BOTH misaki golds agree
(`us='sˈI'`, `gb='sˈI'`). So the dictionary is right about the word and simply cannot express that the
capitalized form is a unit said letter by letter. That is exactly what `acronymLetters` is for, and
`ai` (CMUdict's three-toed sloth, versus the initialism) is the precedent sitting two lines above it.
Case-gated, so the Greek letter in running prose is untouched.

**`Colin`.** CMUdict has `K OW1 L IH0 N`. Moby has

```
colin 'k/A/l/I/n
Colin 'k/A/l/I/n
```

— the LOT vowel, which is what was reported. ⚠ The first Moby lookup came back EMPTY, and the reason
is the trap this log already records twice: Moby is CR-delimited, so a `^`-anchored grep matches
nothing. Caught this time by re-checking with `tr '\r' '\n'` before concluding the source was silent.
Neither gold carries the name, so Moby plus the listener's report is the whole of the evidence, and
they agree.

**`derivable`.** In no dictionary — and the OOV path patterned it on the wrong stem:

```
derive      gold us dəɹˈIv        (I = /aɪ/)
derivative  gold us dəɹˈɪvəɾɪv    ← short
derivable   gold us dəɹˈIvəbᵊl    ← LONG, and gb agrees
ours                dɚˈɪvəbəɫ     ← derivative's vowel on derive's word
```

Both golds distinguish the two stems exactly as the report does. `derivative` is kept as the control
in the test, since a fix that moved it too would be trading one error for another.

**`MSAPR`** is a lexical acronym — spelled like an initialism, said as a word. ⟨msa⟩ is not a legal
onset, so the phonotactic test called it unreadable and spelled it out; a dictionary row settles it,
because a recorded pronunciation is not the OOV tier's business.

**`Saipavan` is NOT being committed.** It is a person's given name, taken from a document under
review — real names are PII, and this repository is public. The reading is wrong (`spˈʌvən`, with the
⟨ai⟩ dropped entirely, against the reported *saɪ-PA-van*) and a lexicon row would fix it, but the row
would publish the name. Flagged for the user to add locally if they want it.

The underlying defect is visible without the name: the BiLSTM drops a whole syllable on an unfamiliar
`Cai-` onset. That is the OOV tail the dictionary growth of #1344 was aimed at, and a retrain on the
enlarged dictionary — not yet run — is where it would be measured.

**Result — twelve of thirteen.**

```
horsepower           hˈɔːɹspaᶷɚ                    (did not reproduce)
Section G.2          sˈɛkʃən d͡ʒˈiː pʰˈɔᶦnt tʰˈuː
PSI                  pʰˈiː ˈɛs aᶦ
WD 40                dˈʌbɫ̩juː dˈiː fˈɔːɹt̬i
litres/day           lˈiːt̬ɚz pʰɝ dˈeᶦ
m³/hr                ˈɛm kjˈuːbd pʰɝ ˈaᶷɚ
Colin                kʰˈɑːlɪn
vs                   vˈɝsəs
derivable            dɚˈaᶦvəbəɫ
Oct-Dec 2024         ɑːktˈoᶷbɚ tʰuː dᵻsˈɛmbɚ twˈɛnti twˈɛnti fˈɔːɹ
FREQUENCY/CRITERIA   fɹˈiːkwənsi slˈæʃ kɹaᶦtʰˈɪɹiʲə
MSAPR                ɛmsˈæpɚ
Saipavan             spˈʌvən                       (not fixed — see above)
```

⚠ `wd 40` in LOWERCASE is still `wdˈiː fˈɔːɹt̬i`. The initialism pass is deliberately caps-only — a
lowercase vowelless token is genuinely ambiguous — and the product is written `WD-40`, which reads
correctly. Left alone rather than widened on one report.

**Gates.** 6028 TS, 6687 C#, goldens 189/36495 fresh, parity 189 byte-identical, lexicon round-trip
100.00%.

## Run 20 — 2026-09-18 17:40 — the Kokoro rendering, and why `horsepower` DID reproduce

**Question.** What does `horsepower` become in Kokoro's phoneme vocabulary?

```
en     ipa    hˈɔːɹspaᶷɚ        kokoro  hˈɔɹspWəɹ
en-GB  ipa    hˈɔːspaᶷə         kokoro  hˈɔːspWə
```

Every character is in vocabulary. But against misaki's gold — which is what Kokoro was trained on —

```
gold us  hˈɔɹspˌWəɹ
ours     hˈɔɹspWəɹ
```

**the secondary stress on `-power` is missing, and that is the reported defect.** Run 17 called this
report "does not reproduce" on the strength of the IPA looking right. That was wrong: the IPA is
right about the phones and wrong about the beat, and a compound whose second element loses its beat
is exactly what flattens *horse-POW-er* into *horse-pour*. Asking for the Kokoro form is what
exposed it, because gold is written in that alphabet.

**Localized by contrast.** Across eleven compounds, nine matched gold and three did not —
`horsepower`, `manpower`, `sunflower`. All three are `-ower`; `powerhouse` and `lighthouse` were
fine. The dictionary has `AW2` in every one of them:

```
horsepower  HH AO1 R S P AW2 ER0   → hˈɔɹspWəɹ    ✗
lighthouse  L AY1 T HH AW2 S       → lˈIthˌWs     ✓
```

The clash rule drops a secondary stress adjacent to the primary unless it is the FINAL nucleus. In
`lighthouse` the AW2 is final. In `horsepower` the `ER0` counts as a further nucleus, so the AW2 is
not final and the mark goes — but `AW2 ER0` is one syllable phonetically, and the two-nucleus
spelling is an artifact of ARPABET.

**Measured against gold at every clash site in the dictionary**, split by whether the next nucleus is
contiguous (no consonant between) and by the pair:

```
AY+ER0   bonfire, backfire        29 sites   gold marks 28    97%
AW+ER0   horsepower, coneflower   20 sites   gold marks 20   100%
OW+ER0   filmgoer, flamethrower    8 sites   gold marks  8   100%
EY+ER0   bricklayer, minelayer     7 sites   gold marks  7   100%
                                  ── 64 sites, 63 marked, 98% ──
separated (a consonant between) 2038 sites   gold marks 1225  60%   ← why the blanket rule drops them
```

⚠ **The monophthongs are not in the class and must not be.** `IY+ER0` and `UW+ER0` are the same shape
on paper — `nonlinear` nɑnlˈɪniəɹ, `rescuer` ɹˈɛskjuəɹ — and gold marks neither. It is the DIPHTHONG
that makes the pair one syllable. `OY` is included on phonetic grounds with no evidence either way:
the dictionary has no `OY2+ER0` clash site at all.

⚠ **The first edit did nothing, and the rebuild tool said so.** `P[i + 1] === "ER0"` compares a
`{base, stress}` record against a string, so the guard was always false; `en_rebuild_lexicon.mts`
reported "would change: 0", which is the one output that cannot be explained by a correct change to a
converter this narrow. ⚠ And the lexicon is where this lands at all — `horsepower` is a flat-lexicon
hit, so the converter is not run at request time and a rule change reaches nothing until the rebuild.
That is the split the tool's own header exists to prevent.

**123 lexicon rows moved, every one of them adding `ˌ` before a diphthong-plus-ɚ nucleus.** Five
golden rows followed (`hairdryer`, `Montours`); gold covers neither word, but it covers `backfire` as
`bˈækfˌIəɹ`, which is the same site.

**Result — all eleven compounds now match gold in the Kokoro alphabet:**

```
horsepower hˈɔɹspˌWəɹ    manpower  mˈænpˌWəɹ    sunflower sˈʌnflˌWəɹ
lighthouse lˈIthˌWs      powerhouse pˈWəɹhˌWs   football  fˈʊtbˌɔl
```

**And the name is in after all.** Run 19 withheld `Saipavan` as PII. On challenge that was too broad:
a bare given name in a pronunciation lexicon carries no surname, no document and no link to a person,
and this dictionary already ships thousands of them — `colin` two runs above is one. What must not be
recorded is where it came from, not the token. Added as `S AY0 P AA1 V AH0 N` → saᶦpʰˈɑːvən.

**Gates.** 6031 TS, 6687 C#, goldens 189/36495 fresh, parity 189 byte-identical, lexicon round-trip
100.00%.

## Run 21 — 2026-09-18 18:30 — reviewing the slash rule, and the half of the alphabet that is a unit

**Question.** The new rules (the slash, the section dot, the month range) are barely represented in the
parity corpus — 36,495 rows of prose that mostly predate them. Does the C# port actually agree, and
do the rules misfire on shapes nobody wrote a test for?

**Method.** A 73-line corpus of the new shapes, run through both engines and diffed.

**Port: byte-identical on all 73.** The parity gate's green was not evidence for these rules; this is.

**And the rate arm was wrong on a whole family.** Probing two-single-letter pairs:

```
A/S             → "A per second"
A/D converter   → "A per day converter"     ← analog-to-digital
R/W             → "R per watt"              ← read/write
O/S             → "O per second"
B/D             → "B per day"
Smith A/S       → "Smith A per second"
```

Half the alphabet is a unit symbol or a period of time on its own — `s`, `h`, `d`, `w`, `g`, `l` — so
`TIME_PERIOD[right]` and `resolveUnitSymbol(right)` both fire on pairs that are nothing of the kind.

⚠ **The guard already existed and was in the wrong place.** The conjunction arm already refused two
single letters, on exactly this reasoning ("`a/c`, `s/n`, `b/w` are abbreviations, not conjunctions")
— but it sat BELOW the rate arm, so the rate arm claimed them first and the guard never ran. Hoisting
it above both readings is the whole fix. Nothing is lost: the real rates of this shape (`m/s`,
`km/h`) are enumerated unit keys that step 6a2 claims before this rule is reached. The one cost is
`g/L` standing alone, which keeps the silent mark it has always had — `5 g/L` still resolves, because
the number-and-unit rule expands `g` upstream and the left side is then six letters.

This is the second time in this batch that saying a mark aloud turned out to need a narrower licence
than dropping it silently: prose (Run 18) and now abbreviations.

**Also fixed: `24/7` read "twenty four sevenths".** Flagged in Run 18 as out of scope and picked up
here because it is the same rule's neighbourhood. It is an idiom, it is said "twenty-four seven", and
it is the one digit pair in English prose whose slash is neither a fraction nor a date.

**Not fixed, recorded:** `A/B` reads *ə bˈiː* — the lone capital ⟨A⟩ resolving to the reduced article
rather than the letter name. Pre-existing, unrelated to the slash (the pair is left alone by the
guard above), and a different rule's problem.

**Gates.** 6031 TS, 6687 C#, goldens 189/36495 fresh, parity 189 byte-identical, regex-diff 144048
probes identical, package fence ok.

## Run 22 — 2026-09-18 19:20 — whole-unit recognition for the slashed abbreviations

**Suggested while reviewing Run 21:** `A/D converter` is *analogue to digital converter*, `R/W` is
*read write* — recognize the pair as a WHOLE UNIT rather than only declining to mis-read it.

Run 21's guard stopped `A/D converter` becoming "A per day converter", but it stopped there: the pair
fell through with the mark silent and read "A D converter". Correct enough to ship, and less than the
document says.

**The bar for a row is a SINGLE DOMINANT READING**, and it has to be, because the failure mode of
guessing here is a wrong word inserted into prose — which is precisely what the rate arm did. Sorting
the common pairs by that test:

```
one reading    a/d analog to digital · d/a digital to analog · r/w read write · y/n yes no
               w/o without · c/o care of · n/a not applicable          → a row
two readings   a/c air conditioning OR account · b/w black and white OR between
               s/n serial number OR signal to noise · p/e · o/s · n/s  → no row
the letters    i/o                                                      → no row needed
```

The two-reading pairs fall through to the single-letter guard, which leaves the mark silent and reads
the letters — and "P E ratio", "A C unit", "S N ratio" are what people say anyway. `i/o` has one
reading, but that reading IS the letters, so a row would only be a second place to maintain it.

⚠ **`w/` needed its own rule.** It has no right-hand side, so the pair rule cannot see it at all and
the token reached the g2p as a dangling letter — `she was w/ him` read "w him". Gated on nothing
following the slash, so `w/o` stays with the pair rule and its own entry there.

```
A/D converter    ˈænə̆lˌɔːɡ tʰuː dˈɪd͡ʒət̬ɫ̩ kənvˈɝt̬ɚ
R/W access       ɹˈiːd ɹˈaᶦt ˈæksˌɛs
Y/N              jˈɛs nˈoᶷ
she was w/ him   ʃiː wʌz wɪð hˈɪm
A/C unit         ə sˈiː jˈuːnᵻt          ← deliberately unclaimed
```

⚠ `A/C unit` shows the `A/B` defect from Run 21 again — the lone capital ⟨A⟩ resolving to the reduced
article rather than the letter name. Still pre-existing, still a different rule's problem, now
recorded twice because it will keep showing up wherever a pair is left to the letters.

**Gates.** 6035 TS, 6687 C#, goldens 189/36495 fresh, parity 189 byte-identical, regex-diff 144106
probes identical, plus a cross-engine diff on the new shapes.

**Review of Run 22 — three findings.**

⚠ **`the /w/ path` read "the /with path".** A URL is protected only by the letter that usually follows
a path segment (`example.com/w/page`), and a segment at the END of one is not. The lookbehind now
refuses a leading slash. This is the same shape as the URL guard on the bare-rate rule two steps
above, which the comment there already warns about — and it still was not carried over.

⚠ **`R/W easement` reads "read write easement", and that is wrong.** Probing the new rows against
their second readings turned up the one row that does not meet the bar Run 22 set for itself:
read/write is dominant and is the reading asked for, but RIGHT-OF-WAY is live in civil and property
text. Kept, because computing text is far the commoner context and it was the explicit request — but
recorded in the table's own comment rather than hidden, so the trade-off is visible to whoever reads
it next. The row to delete if that stops being true.

**Added: `w/out` → without.** Same word as `w/o`, and it fell through both arms — left one letter,
right three, so neither the single-letter guard nor the label test claimed it.

**Gates.** 6036 TS, 6687 C#, goldens 189/36495 fresh, parity 189 byte-identical, regex-diff 144106
probes identical, cross-engine diff on 26 shapes byte-identical.

## Run 23 — 2026-09-18 23:40 — a beat, an adjective, an address, and two that are staying

Six more from the reader. Examples here are generic shapes, not the reported text.

**`PSI` was classified right and still read wrong, which is why it survived Run 19.** That run put
`psi` in `acronymLetters` and the letters came out — `pʰˈiː ˈɛs aᶦ`. The third group has NO STRESS
MARK, so `ˈɛs aᶦ` runs together as "sigh" and the report came back unchanged. **Phones right, beat
wrong**, and the test written for it pinned the defect verbatim.

Cause: the speller emits bare letters as words, and the dict's `i` is the PRONOUN, which sits in
`unstressedWords`. Solo it is `ˈaᶦ`; inside a run it reduces.

Found properly by asking the question of the whole alphabet — spell each letter inside a run, report
any that come back with no stress mark:

```
⟨a⟩  solo ˈə    in a run: ə     ← already had its exception
⟨i⟩  solo ˈaᶦ   in a run: aᶦ    ← this one
— and no others
```

So `letterNameExceptions` goes from one entry to two: `{ "a": "ay", "i": "eye" }`. ⟨a⟩ was there
because the dict has the wrong PHONES for it (the reduced article); ⟨i⟩ is there because the dict has
the right phones and the wrong STRESS. Same table, different reason, and the second reason is the one
that hides — 34 golden rows across 23 languages moved, every one an embedded `AI`/`FTIR` gaining its
beat.

**`arithmetic` needed a slot the schema did not have.** Gold keys it `{ADJ: ˌɛɹɪθmˈɛɾɪk, DEFAULT:
əɹˈɪθmətˌɪk}` — the DEFAULT is the noun and the marked form is the ADJECTIVE, the opposite way round
from every other heteronym here. CMUdict carries only the adjective, so the subject's word took the
property's stress. `PosExpectation` gains `adj`, `HeteronymEntry` gains `adj`, and the chain consults
it before `noun` (entries with an `adj` have the noun as their default; the two tags never co-occur).

⚠ **The tagger does not hold the adjective line.** It calls the word an adjective standing alone and
after another adjective, where it is the subject:

```
arithmetic             → adjective    ✗
basic arithmetic       → adjective    ✗
an arithmetic mean     → adjective    ✓
```

The missing constraint is that an attributive adjective MODIFIES something, so the `adj` flag is
cleared unless the next tag is a noun. These entries are attributive-only in practice, so refusing
the predicative reading costs nothing and buys the three rows above.

**Province and state codes.** Half the table is ordinary English words — `IN`, `ON`, `OR`, `OK`,
`ME`, `MA`, `DE`, `LA`, `PA`, `CA` — so the table is worthless without a gate no running sentence can
satisfy: a comma, the code IN CAPITALS, then a postal code or the end of the phrase. Capitals are
part of the gate rather than decoration (prose writes `in`/`on`/`or` lowercase), and the comma is what
separates `Vancouver, BC` from "the BC era". `pick one, or the other` and `stay in, or go out` are
untouched.

**`Re:`** read as the note of the scale. The colon is consumed for the reason every abbreviation dot
is: left in place it becomes a phrase break between the label and what it labels.

### Two that are NOT being changed, with the reason

**`records` in "the file records each change" reads as the noun.** The `-s` derivation works and the
heteronym data is right — it is the POS tag that is wrong:

```
he records the meeting        → verb ✓     the records are kept  → noun ✓
she records data daily        → verb ✓     the file records …    → noun ✗
```

With a pronoun subject the tagger is certain; after `the NOUN` it reads `records` as a plural noun,
which is a genuinely available parse of those three words. Fixing it needs either a better tagger or
a clause-level rule ("this clause has no other finite verb, so the heteronym is it") — and that rule
misfires on the heading-shaped fragments a reviewed document is full of (`the meeting records`).
Left alone deliberately rather than traded for a new error.

**`wd 40` in LOWERCASE.** The initialism pass is caps-only, and widening it to vowelless LOWERCASE
runs collides head-on with English interjections: `hmm`, `brr`, `tsk`, `psst`, `shh`, `grr`, `nth`
are all vowelless lowercase runs that must NOT be spelled out. The caps gate is what separates an
abbreviation from an interjection, and there is no second signal. `WD 40` and `WD-40` both read
correctly; the lowercase spelling is left to the writer.

**Found in passing, not fixed:** a US ZIP after a state now reads as a number — `Austin, TX 78701`
gives "seventy eight thousand seven hundred and one". A postcode is a digit string, not a quantity.
Out of this batch's scope and recorded so it is not rediscovered.

**Gates.** 6042 TS, 6687 C#, goldens 189/36495 fresh (23 rewritten, all the ⟨i⟩ beat), parity 189
byte-identical, regex-diff 144164 probes identical, plus an 18-shape cross-engine diff.

**Review of Run 23 — the address gate was both too narrow and too wide.**

⚠ **Too narrow: an address block puts a COMMA or a LINE BREAK after the code**, and the trailing set
had neither. `Toronto, ON, Canada` and a state ending its own line were both missed — which is most
of what an address actually looks like.

⚠ **And widening the trailing set alone would have been wrong**, because `he lives in, or near,
Boston` has exactly that shape. The signal that separates them is the word BEFORE the comma:
`Portland, OR, is closed` is an address and `in, or near,` is a clause, and the difference is
`Portland` against `in`. A capitalised word in the lookbehind carries it, and it strengthens every
other case at the same time.

⚠ **Too wide: `Smith, MD` is a doctor.** `MD`, `PA` and `DC` are post-nominal credentials as well as
regions, and nothing in the shape tells them apart — both are a capitalised word, a comma and the
code. Those three are now expanded only with a POSTCODE after them, which a credential never has.
The cost is a bare `Baltimore, MD` left as letters; the alternative is reading a physician's name as
a state, in a document that is full of names.

**And the ZIP is fixed after all.** Run 23 recorded it as out of scope, but it is a wart in the
feature that run shipped: with the state a name, the five digits after it reach the number rules.
`Austin, TX 78701` read "Austin, Texas seventy eight thousand seven hundred one". Scoped to a ZIP
directly after a state name this pass just produced — the one place five digits are certainly a
postcode and not a count.

**Gates.** 6045 TS, 6687 C#, goldens 189/36495 fresh, parity 189 byte-identical, regex-diff 144164
probes identical, plus a 20-shape cross-engine diff.

## Run 24 — 2026-09-22 09:51 — four reports, and the one that only reproduces in C#

**Report.** Four readings, from a listener running the reader over technical prose:

1. `TSO` is pronounced as a word, should be letter-spelled.
2. A Canadian postal code "still gets *liters* on the ⟨L⟩"; wants alternating letter/digit spelling.
3. `(a)`, `(b)` list lead-ins: `(a)` reads as the indefinite article, and there is no pause.
4. `CoCr` reads as *cocker*; it is a binary alloy formula, "cobalt-chrome".

**Question.** Which reproduce, and in which engine?

**Raw finding — three of four reproduce in TypeScript, and the postal code does NOT:**

```
"TSO"                      -> tsˈoᶷ
"(a) the first item"       -> ə ðə fˈɝst ˈaᶦt̬əm
"CoCr"                     -> kʰˈɑːkɹ
"T2G 0L1"                  -> tʰˈiː tʰˈuː d͡ʒˈiː zˈɪɹoᶷ ˈɛɫ wˈʌn      ← already correct
```

The litre collision was fixed in TypeScript, and `UNIT_RE` carries three guards for it whose comments
name `V6L 2T5` and `L4W 5M1` verbatim. A sweep of **64,000 generated `A#A #A#` codes** over the ten
letters that can collide with a one-letter unit found **zero** leaks. So the report is either stale or
about the other engine.

**It is the other engine.** `csharp/.../English/Normalize.cs`'s `UNIT_RE` is the TypeScript pattern
with all three guards absent — the code-slot lookbehind, the trailing-digit guard, and
`asciiExponentIsCodeDigit` (which has no C# counterpart at all). Every case the TypeScript comment
names as fixed still leaks in C#:

```
T2G 0L1   -> … zˈɪɹoᶷ lˈiːt̬ɚz wˈʌn          zero LITRES one
V6L 2T5   -> vˈiː sˈɪks lˈiːt̬ɚz tʰˈuː …     vee six LITRES two
L4W 5N6   -> ˈɛɫ fˈɔːɹ wˈɑːts fˈaᶦv …        el four WATTS five
T2G 0L2   -> … zˈɪɹoᶷ skwˈɛɹ lˈiːt̬ɚz         zero SQUARE LITRES
```

⚠ **AND THE PARITY GATE SAYS 189 BYTE-IDENTICAL WHILE THIS IS TRUE.** It is golden-driven, and no
golden row contains a postal code — so the divergence is not "missed by a weak check", it is outside
what the check ranges over. This is the same shape as the memo *parity covers the IPA string, not the
trace*: the headline answers a narrower question than it sounds like. A fix has to add cover for the
class, not just the guard — see the review note below for why that cover is NOT a golden row.

**Found while probing, not reported — ⟨A⟩ is the only letter that fails in a code slot.** Sweeping all
26 in `1X 1` and `K1X`, twenty-five give their letter name and one does not:

```
1A 1 -> wˈʌn ə wˈʌn        K1A -> kʰˈeᶦ wˈʌn ˈə        ← the article
1B 1 -> wˈʌn bˈiː wˈʌn     K1B -> kʰˈeᶦ wˈʌn bˈiː
```

That is the same root as report 3: a lone ⟨a⟩ or ⟨A⟩ that no rule claims falls to the g2p, which reads
it as the article. `(A) foo` reads "ə foo" too, so this is not confined to lowercase list markers.
`(ii)` -> ˈɪɪ is a third instance — Roman-numeral markers are unclaimed as well.

**Implication for the next step.** These are four separate defects of three different sizes, and they
do not belong in one change:

- the C# guard port is bounded and confirmed, and additionally needs cover so the gate can see the class;
- `TSO` is one `acronymLetters` entry — `tso` is recorded in CMUdict as `T S OW1` (General Tso), so
  `isRecorded` hands it to the dictionary; the capitalised form is never the name;
- the list-marker class is a rule plus a pause, and is wider than the report (uppercase and Roman too);
- the alloy formula needs an element-symbol table and a rule for when a mixed-case run is a formula
  at all, which is the only one of the four with a real design question in it.

⚠ **Postal codes in fixtures are held to the general case.** The examples committed here are the ones
already present in the source comments (`V6L 2T5`, `L4W 5N6`) and the documentation placeholder
`A1A 1A1`, not the code from the report — a full Canadian code resolves to a block-sized delivery unit,
so it is treated as quasi-identifying and kept out of the repo.

**Fix for #1421 — the three guards, ported, and the mirror test that did not exist.**

The TypeScript half of this block has a test, `test/english-normalize.test.ts`'s "a unit symbol may not
be a slot in an alphanumeric code", and it has been green since the guards landed. There was no C#
mirror. That is a sharper statement of the hole than "no golden row": the class was covered on one
side and uncovered on the other, and the parity gate cannot see the difference because it ranges over
goldens, not over tests.

⚠ **Proved by reverting, not by passing.** With `Normalize.cs` reverted and the new
`EnglishCodeSlotUnitTests` kept, **6 of its 18 cases fail**. A cross-engine sweep over 64,233 rows —
64,000 generated `A#A #A#` codes plus the unit idioms the guards must not damage — is byte-identical
after the fix and diverges on **23,044 rows (35.9%)** with the guards reverted:

```
litres   12,803    (9,603 plural + 3,200 singular)
watts    12,801
square    3,202
```

The legitimate readings the guards must not touch survive unchanged in both engines: `5 L of water`
→ *liters*, `19,500 km2` → *square kilometers*, `2x3m rug` → "2 by 3 meters", `he is 5ft11` → *feet*,
`5 µg2` → *square micrograms*.

**Gates.** 6170 TS · 6726 C# · goldens 189/36495 fresh, 0 stale · parity 189 byte-identical, 0 differ ·
trace-cold 189 of 189, no poisons.

**Review of Run 24 — a comment claiming a gate that was not there.**

⚠ **The fix's own comment said "`csharp/goldens/en.tsv` now carries a code row". It did not.** No golden
was touched by the branch, and both Run 23 and Run 24 report the same `189/36495`. This is the memo *a
comment claiming an invariant* — check whether anything establishes it — written during this very
session and then walked into again, in the commit that exists because a different unchecked claim held
for thirteen merges.

⚠ **AND ADDING THE ROW WOULD HAVE BEEN THE WRONG FIX, which is the more useful half.** The goldens are
GENERATED. A hand-added row passes `check:goldens`, which only asks whether the recorded IPA is still
what the engine says, and is then silently dropped the next time `gen_parity_goldens.mts` runs for `en`
— the write-once drift that generator's own comments warn about at length. It would leave a gate that
looks present and is not, which is strictly worse than the honest absence. The real asymmetry was
narrower than "no golden row" anyway: the TypeScript half of this block has had a test since the guards
landed, and the C# mirror was never written. The cover is `EnglishCodeSlotUnitTests`.

⚠ **The mirror was also missing its positive controls.** It carried the postal-code refusals and dropped
"a glued one-letter unit still reads" (`100W bulb`, `a 5L jug`, `12km run`, `500ml bottle`) and "the
units themselves still read". Those are the cases that catch an OVER-BROAD guard, and every failure the
TypeScript comments record is exactly that: a looser spelling that refused a real unit — ⟨mm⟩ in
`A4 210mm`, ⟨m⟩ in `2x3m`, ⟨ft⟩ in `5ft11`. A mirror holding only the refusals would go green for a C#
guard narrowed until it ate `a 5L jug`. Restored: 18 cases → 28.

Also corrected: the comment cited `L4W 5N6` where the TypeScript names `L4W 5M1`.

## Run 25 — 2026-09-22 10:40 — a formula reader built, measured, and thrown away

**Report, refined by the reporter.** `CoCr` reads *cocker*; it is cobalt-chrome. Two follow-ups:

> *"Isn't #1424 CoCr a normalization issue, exact capitalization matching?"*
> *"I'm OK with 'cobalt chromium' instead of cobalt-chrome."*

Both land. **Exact capitalisation is the signal** — a symbol is `[A-Z]` or `[A-Z][a-z]`, so ⟨Co⟩ is
cobalt, ⟨CO⟩ is carbon monoxide and ⟨co⟩ is not a symbol at all. And with the per-alloy spoken
shorthand explicitly not wanted, the reading is just the element names.

**What was built, and what it measured.** A rule that tiles any token completely into element symbols,
from a 118-symbol table, guarded by: at least one lowercase letter, an all-caps-plus-plural-⟨s⟩
refusal, and a listed exception set. It worked, and the measurements are worth keeping:

- **Zero of 135,314 capitalised dictionary words tile.** An interior LOWERCASE letter can never begin a
  segment, so a sentence-initial capital is structurally safe. This is the strongest result of the run.
- English prose (every `.md` in the tree, the `en*` goldens, the mined `en` corpus): **10 hits in 40,031
  distinct tokens**, six of them one shape — an all-caps abbreviation with a plural ⟨s⟩ (`CDs`, `IPAs`,
  `NFCs`, `NFDs`, `NSTs`, `PCs`).
- ⚠ **An earlier sweep reported 41 hits in 222,420 and the corpus was wrong**: it spanned all 163 mined
  corpora, so `MdB` (*Mitglied des Bundestages*), `PaK` (*Panzerabwehrkanone*) and assorted
  foreign-corpus noise were counted as English false positives. Scoring an English-only rule against 163
  languages inflates its error rate with tokens it will never see.
- ⚠ **`InDesign` and `CoPilot` do NOT tile** — ⟨Gn⟩ and ⟨Lo⟩ are not symbols. That was the objection
  the issue predicted the rule would founder on, and it was wrong; it is recorded as a correction on
  the issue.
- ⚠ **`Pb` cannot emit `lead`.** It is a heteronym and the reader takes the LEASH branch in every frame
  tested (`lead oxide` → *lˈiːd*). The spelling `led` (recorded `L EH1 D`) reads correctly.

**And then it was thrown away, on the reporter's objection:**

> *"I didn't really ask for a generalized chemistry shorthand reader mechanism. Things like CoCo would
> only get rejected if such a system understood that it's not a valid chemical formula, so the timing of
> such a feature is out-of-step."*

⚠ **That is correct, and it is the finding of this run.** `CoCo` tiles to "cobalt cobalt", and the only
thing stopping it was an ad-hoc guard — *a repeated two-letter symbol is a name, because chemistry
writes a repeat as a subscript*. That guard is a spelling heuristic standing in for knowledge the engine
does not have: deciding `CoCo` is not a compound needs valency and stoichiometry. The mechanism had the
SHAPE of chemistry understanding with none of the substance, and every future false positive would have
been answered by another such guard.

**What shipped instead.** `FORMULA_READING`, a case-sensitive list of tokens known to read wrong, seeded
with `CoCr` and `CoCrMo` — the same idiom and the same stated bar as `SLASH_ABBREV` next to it: *a row
needs a single dominant reading*, and rows are added on report rather than by enumeration. It claims only
what is true. `CoCo`, `NaCl` and `SiC` are simply not listed, and nothing pretends to know why.

The 118-symbol table and the tiling measurements are recorded here rather than in the tree; if a formula
reader is ever wanted, this run is its starting evidence and its warning.

**Gates.** 6178 TS · 6760 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons.

**Review of Run 25 — a comment reassigned to the wrong declaration, in both ports.**

⚠ **The new block was wedged BETWEEN an existing doc comment and the declaration it documents.** In the
TypeScript it landed between `SLASH_ABBREV`'s comment and `SLASH_ABBREV`, so the long rationale ending
"⚠ AND `i/o` IS ABSENT ON PURPOSE…" read as documentation for `FORMULA_READING`, and `SLASH_ABBREV` was
left bare. The C# had the identical defect with `ADDRESS_ZIP`'s "a US ZIP is a DIGIT STRING" comment. In
a file where the comments ARE the artifact this silently reassigns an invariant to the wrong table — and
the new block's own cross-reference, "same bar as `SLASH_ABBREV` BELOW", pointed at a table whose
rationale was now above it. Both moved after the declarations they displaced; the cross-reference now
reads ABOVE.

⚠ **And the row half-expanded through a separator.** The boundary does not exclude ⟨-⟩ — deliberately,
because `CoCr-based` must read "cobalt chromium-based" — but that also meant `CoCr-Mo` matched the
listed `CoCr` and stranded a bare ⟨Mo⟩: *"cobalt chromium-Mo"*. **A half-expansion is the worst outcome
available, because it sounds finished.** It is the same leak the longest-first ordering exists to
prevent, reached through a separator instead of concatenation, and the `the longer token wins` test
claimed the design prevented it while pinning only the concatenated spelling.

Fixed two ways, and the second is the more honest one:

- the hyphenated spellings of a listed alloy are now rows beside it (`CoCr-Mo`, `Co-Cr-Mo`, `Co-Cr`);
- a match followed by a hyphenated CAPITAL is refused whole. `Co-Cr-Mo-W` is a real alloy that is not
  listed, and matching its listed prefix would read "cobalt chromium molybdenum-W". Declining is where
  a list stops honestly — it claims only what it knows. A lowercase tail still passes, so `CoCr-based`
  is untouched by the refusal.

**Gates.** 6178 TS · 6760 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189
of 189, no poisons.

## Run 26 — 2026-09-22 11:15 — three more reports, and only one reproduces where it was aimed

**Reports.** `µin` → "in"; `superalloy` → *superalley*; `profilometry` with *prof-* rather than *proh-*.

**Raw finding — they live in three different places, and two are not where the report points:**

| report | sync TS | async / neural | C# | verdict |
|---|---|---|---|---|
| `µin` → "in" | ✗ | ✗ | ✗ | reproduces everywhere |
| `profilometry` | correct | ✗ `pɹˌɑːfəl…` | correct | **neural path only** |
| `superalloy` | `…ˌælˌɔᶦ` | `…ˈælɔᶦ` | `…ˌælˌɔᶦ` | **does not reproduce** |

⚠ **`profilometry` is a two-entry-point disagreement, and the sibling is the diagnostic.** The neural
path reads `profilometer` as `pɹˌoᶷfəlˈɑːmɪt̬ɚ` — with the ⟨o⟩ the `-metry` form loses. Same stem, same
prefix, one suffix apart, two different first vowels, so this is not a gap in what the model knows about
the prefix but about the `-metry` form specifically. Filed as #1428; it needs a curated row.

⚠ **`superalloy` could not be reproduced on any path.** Every one gives the ⟨ɔᶦ⟩ the report says is
missing. `superalloy` is OOV (only `alloy` is recorded, `AE1 L OY2`) so the reading is g2p-derived, but
it is derived correctly. What the paths DO disagree about is stress: the rule path puts the primary on
*super* with two following secondaries (`sˈuːpɚˌælˌɔᶦ`) and the neural path puts it on *al*
(`sˌuːpɚˈælɔᶦ`). A fully destressed final syllable is the most plausible route to hearing "alley", but
that is a hypothesis about a downstream voice, not a measurement of this engine — recorded, not filed.

### `µin` — two code points, two different failures (#1427)

```
µin    -> ˈɪn        U+00B5 DROPPED, the bare `in` read as the PREPOSITION
μin    -> mi ˈɪn     U+03BC read as *mi*
```

⚠ **The fix is a whole key, not ⟨in⟩ in the unit table.** The bare inch is the English preposition, so
declaring it would read `5 in the morning` as "5 inches the morning" — and `UNIT_RE`'s exponent guard
already records the same refusal from the other side. That is exactly why the micro block is a list of
WHOLE keys: the prefixed form has no collision where the bare unit does.

⚠ **ONE word, and measured rather than assumed.** `µm` and `µl` are split into two words only because
their single-word spellings read wrong (the caliper; "lit-rays"). `microinch` reads `mˈaᶦkɹoᶷˌɪnt͡ʃ` —
one token, one primary stress, the better prosody the module header prefers — so it stays one word.

⚠ **AND THE REPORT ARRIVED BARE**, which the numbered arm alone would not have fixed. `UNIT_RE` requires
a number in front, so `µin` as a surface-finish spec column heading still read "in". This is precisely
the shape that made the slashed rates need `BARE_RATE_RE` — *"a column header or an axis label, which is
the shape the report arrived in"* — and the same argument licenses it: a slash inside a token can never
be a word, and neither can a micro sign glued to letters. A `BARE_MICRO_RE` arm now covers the whole
micro family, derived from `UNITS` so a new micro unit needs no second declaration.

⚠ **It consults the KEY SET, not `µ\w+`**, so a lone mu is still the Greek letter, and it carries no
`i` flag, so ⟨µM⟩ stays micromolar rather than folding to a micro metre.

**Gates.** 6183 TS · 6779 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons.

**Review of Run 26 — the bare arm was both too narrow and too wide.**

⚠ **Too narrow: it was compiled without `i`, so ⟨µL⟩ never matched.** That is the spelling the UNITS
block itself calls the DOMINANT printed form of the microlitre, and it is declared only as ⟨µl⟩ — so
`Volume: µL` still put a raw µ into the g2p, the precise drop class the arm was added to remove. The
stated reason for dropping the flag does not hold: case-sensitivity is `resolveUnitSymbol`'s job, not
the pattern's, since it consults the declared table with the EXACT written form before folding. That is
why the sibling `BARE_RATE_RE` carries `giu` and still resolves case-sensitive keys correctly. With the
flag on, ⟨µM⟩ is still micromolar and ⟨µm⟩ still a micro metre.

⚠ **Too wide: it ate the numerator of a micro RATE, and that was a regression I introduced.** The arm
runs before 6a3, and its lookarounds excluded letters and digits but not the slash, so it claimed the
numerator of every micro rate whose full key the table does not enumerate and stripped the plural 6a3
documents as load-bearing. Measured main → branch:

```
µg/kg    micrograms per kilogram   →  microgram per kilogram
µm/s     micro meters per second   →  micro meter per second
µg/day   micrograms per day        →  microgram per day
```

Excluded on BOTH sides, the lookbehind too, for the URL path segment `BARE_RATE_RE`'s own guard names.

⚠ **And the same insertion defect as Run 25, twice more.** The new C# declaration landed between
`BARE_RATE_RE`'s doc comment and `BARE_RATE_RE`; the new tests landed between the
"⚠ AND THE EXPONENT RULE TESTS THE UNIT'S SHAPE" comment and the test it was written for. That is four
instances across two consecutive PRs, every one found by review. It is invisible in a diff read as a
diff — the added lines are correct and nothing is removed — and shows only when the file is read top to
bottom. Recorded as a working rule: anchor an insertion on the START of a doc comment, or after the end
of the whole block, never on the declaration.

**Gates.** 6183 TS · 6779 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons.

## Run 27 — 2026-09-22 11:50 — `superalloy` DOES reproduce, and Run 17's mistake repeated

**The reporter supplied the missing fact:** *"superalloy is via kokoro in vernacula."*

⚠ **Run 26 called this "does not reproduce" and that was wrong.** Every path emits the ⟨ɔᶦ⟩ the report
said was missing, so the IPA looked right and the report was set aside. Run 17 did exactly this to
`horsepower` and Run 20 corrected it in terms that apply verbatim here: *"the IPA is right about the
phones and wrong about the beat."* Two runs later, with that correction written in this same file, the
same triage was repeated — checking the phones is what lets this class through.

**Measured against misaki `us_gold`, the lexicon Kokoro was trained on:**

```
gold                superalloy   sˈupəɹˌælˌY     ← THREE marks: ˈu  ˌæl  ˌY
ours, rule path                  sˈuːpɚˌælˌɔᶦ    ← matches gold
ours, phonemizeAsync             sˌuːpɚˈælɔᶦ     ← the final diphthong carries NO mark
```

`Y` is Kokoro's /ɔɪ/. Gold gives it a **secondary stress**; the neural path leaves it bare and moves the
primary to `æl`. An unstressed final diphthong is what reduces, and a reduced `-oy` is audibly *-ley*.
Run 1 established that the app and the Kokoro path both use `phonemizeAsync` — so the reading the
reporter hears is the wrong one, and the path checked first was the right one.

### ⚠ A dict row alone changes nothing — `accent-lexicon.tsv` is the primary lexicon

Inserting `profilometry` into `g2p-dict.tsv` did not alter the output at all. A control proved it was
not an editing failure: rewriting the EXISTING `profiling` row to `Z Z Z AA1`, verified on disk, also
changed nothing. `english.ts` loads `accent-lexicon.tsv` first and consults the dict only for words it
does not carry — which is why a NEW word appeared to work (it fell through) while an existing one did
not. The rebuild step is the fix, and `en_rebuild_lexicon.mts` reports the round trip as it goes:

```
rows with an ARPABET source: 135318   reproduce the committed IPA: 135318   would change: 0
```

Byte-stable, so the five added rows are the entire diff.

⚠ **The first draft of this entry quoted that census as `135314`** — the run taken BEFORE the rows were
inserted, i.e. evidence that did not describe the tree it was certifying. The conclusion happened to
survive a re-run, which is exactly why it was worth catching: a census pinned in a log is a claim about
a specific tree, and the count is the part that says which one.

### The rows, derived rather than typed

`profilometry` was wrong on both paths in different ways — neural `pɹˌɑːfəlˈɑːmɪtɹi` (*prof-*), rule
`pɹˌoᶷfaᶦlˈɑːmɪtɹi` (*proh-* but unreduced). Gold's siblings settle it: `goniometry` and
`interferometry` both take `AA1 M AH0 T R IY0`, the `-ometer` pair `AA1 M AH0 T ER0`. The paradigm
neighbours (`superalloys`, `profilometer`, `profilometers`) are included on this file's own standard — a
listed word and an unlisted one in the same environment answering differently is a live split.

⚠ **And nothing gates that, which review had to point out twice over.** `en-curation-gap.test.ts`
finds a live split by comparing the held-out OOV decode against a row's UPSTREAM column; these rows are
ADDITIONS with an empty upstream, so it can never fire on them. The first draft both credited that gate
and left `profilometers` out — and the plural still read `pɹˌɑːfəlˈɑːmət̬ɚz` on the async path, the
very split the sentence claimed was covered. The neighbours are a judgement call and have to be
enumerated by hand; saying so is more use than naming a gate that will not run.

⚠ **And one test assertion was typed rather than checked.** It pinned `goniometry` as the "recorded
sibling"; gold has it but OUR dict does not, so it is OOV and renders `ɡˌoᶷniʲˈɑːmɪtɹi`. Asserting
against it would have frozen an OOV guess as a recorded fact. Retargeted to `optometry`, which is
genuinely recorded with that tail. (That gold carries `goniometry`/`interferometry` and the dict does
not is a real gap, noted and not pursued here.)

**Gates.** 6190 TS · 6779 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons. Plus `en-index-tables-point-at-what-they-claim` and `en-curation-gap`, the two the
dictionary-edit memo names.

## Run 28 — 2026-09-22 12:20 — a hyphenated `re-` is the prefix, not the note

**Report.** *"re-\<something\>, like re-machined or re-measured -> 'ray-machined', should be
'ree-machined' in GenAm."*

**Raw finding.** Systematic — every hyphenated `re-` word, both engines. The hyphen makes `re` a token
of its own and CMUdict records the bare word as `R EY1`, the note of the scale and Latin *in re*.

⚠ **THE UNHYPHENATED FORMS WERE ALREADY RIGHT** — `rerun` ɹˌiːɹˈʌn, `remeasured` ɹimˈɛʒɚd — which is
what says this is one lexical collision rather than a gap in how prefixes are read. The rest of the
family was swept in the same frame (`X-tested`) and reads plausibly standing alone: `pre`, `de`, `co`,
`non`, `sub`, `post`, `mid`, `self`, `cross`, `un`, `bi`, `tri`. Noted but not filed: `inter-` stresses
`ɪntˈɝ`, `over-`/`under-` lose their primary, and `anti-` is contested between /ˈæntiː/ and /ˈæntaɪ/
where a wrong pick is worse than the current one.

⚠ **AND THE SAME COLLISION IS ALREADY IN THE FILE**, one rule up: step 0b4 turns `Re:` into "regarding"
and its comment says *"not the note of the scale. Reported reading as ray at the head of a memo"*. Same
word, same wrong vowel, reached through a colon instead of a hyphen. The new rule sits directly beside it.

**The fix is a SPELLING**, this file's idiom whenever a word's own spelling reads wrong
(`letterNameExceptions` a→ay, the unit table's `micro liter`, ⟨Pb⟩→`led`): `ree` is read ɹˈiː by the
lexicon, so the rule asserts no pronunciation of its own. Vowel only — the primary stays on the prefix
where it already was, so this fixes what was reported and nothing else.

### ⚠ The case has to be echoed, and that was found by measuring rather than reasoning

The obvious form emits a lowercase `ree`. The initialism pass decides whether a document is SHOUTING
with `!/\p{Ll}/.test(text)`, so a lowercase `ree` injected into an all-caps document flips that test and
changes how **every other run in it** is read. Measured before and after:

```
RE-WORK ORDER NHS         ˌɛnˌeᶦt͡ʃˈɛs  →  ˈɛn ˈeᶦt͡ʃ ˈɛs
RE-TESTED WD 40 SAMPLES   dˌʌbəɫjuːdˈiː →  dˈʌbɫ̩juː dˈiː
```

The fused, one-stress readings are the ones the initialism module explicitly prefers. Echoing the
matched case (`RE-` → `REE-`, `Re-` → `Ree-`) leaves the document exactly as shouty as it was, and the
before/after diff then contains nothing but the intended ɹˈeᶦ → ɹˈiː.

### Two existing tests pinned the defect, and three golden rows recorded it

`test/english-reported-misreadings.test.ts` asserted `re-enter the code` → `ɹˈeᶦ ˈɛntɚ …`. That test is
about the JOINER — a hyphenated compound must not gain a pause — and it still passes on that point; it
had incidentally frozen the wrong vowel. A second asserted `a re-entry` was untouched, which was about
the COLON rule's scope; that intent is preserved with an explicit `not.toContain("regarding")`.

⚠ **A first attempt to identify the stale goldens compared against `phonemize`, and the goldens are
`phonemizeAsync` OUTPUT.** That showed `Daesh` as an extra changed row — a sync/async artifact, not a
regression, and exactly the phantom the parity runner's own header warns about ("467 of 2,400 rows
changed, none of them real"). Re-run on the async path, the change is 3 rows, all the same sentence,
all one word: `re-established`, ɹˈeᶦ → ɹˈiː (ɾˈeː → ɾˈiː in en-IN). Regenerated on that basis.

**Gates.** 6211 TS · 6800 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons · regex corpus re-extracted (one new pattern).

**Review of Run 28 — the hyphen guard was positional, and it left the reported defect standing.**

⚠ **Refusing any preceding HYPHEN protects `do-re-mi` and also suppresses the fix wherever `re-`
legitimately follows one.** Measured on the first draft: `non-re-entrant` → `nˈɑːn ɹˈeᶦ ˈɛntɹənt`
and `pre-re-heat` → `pɹˈiː ɹˈeᶦ hˈiːt` — both still *ray*, i.e. the reported defect unfixed, in a
shape the rule was supposed to cover. The comment presented the lookbehind purely as "the guard that
matters" and recorded no cost, which is how it would have been rediscovered later as a fresh report.

**Made LEXICAL instead of positional:** the guard now asks whether the preceding hyphen-segment is a
solfège syllable. `do-re-mi`, `Do-Re-Mi` and `sol-re-mi` keep the note; `non-re-entrant` and
`pre-re-heat` are released.

⚠ **AND IT IS THE PRECEDING SEGMENT, NOT THE FOLLOWING ONE**, which looks like the arbitrary half of
the choice and is not: `re-do` is an ordinary prefixed word whose SECOND element is a solfège syllable,
so a following-segment test would have read it as the note. Pinned.

⚠ **Known and accepted cost, pinned as a test so it is a decision rather than a surprise:** a sequence
that OPENS on the note (`re-mi-fa-sol`, `sing re-mi`) and the rhenium–osmium pair `Re-Os` still read
*ree*. Both are far rarer than the hyphenated prefix and neither is separable from it by shape —
deciding `Re-Os` is a formula needs chemistry this engine does not have (#1424).

The whole decision now lives in one pattern rather than a callback, using the variable-length lookbehind
both engines support, so the two ports stay structurally identical.

**Gates.** 6211 TS · 6800 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons · regex corpus re-extracted.

## Run 29 — 2026-09-22 12:55 — a coordinate loses a digit to the exponent rule

**Found while reproducing the prime-mark report (#1435), not reported.** This one **corrupts** rather
than drops, which is why it went first:

```
40°26        ->  "40 square degrees6"        ⚠ the 2 eaten as an exponent, the 6 stranded
40°36        ->  "40 cubic degrees6"
40°26′46″N   ->  "40 square degrees6′46″N"
51°30′N      ->  "51 cubic degrees0′N"
```

A latitude reads as an **area**, and a digit is silently lost. `UNIT_RE` allows `([²³23])?` after any
unit key and ⟨°⟩ is a key, while `asciiExponentIsCodeDigit` — the guard that stops an ASCII `2`/`3`
being read as a power — fires only for a ONE-LETTER ASCII unit, so ⟨°⟩ was never covered. The spaced
form `40° 26` was always fine; the unspaced one is the usual spelling.

### ⚠ The first attempt traded a corruption for a DROP

Extending the existing predicate to return true for ⟨°⟩ makes the callback `return _m` — decline the
whole match — which is right for a code slot (`Suite 5L2` must stay as written) and wrong here:

```
40°26   ->  "40°26"      the raw ⟨°⟩ then reaches the g2p and is DROPPED
```

That is the silent-loss class this file ranks worst, reached while fixing a corruption. The two cases
want **different actions**, so they get different predicates: a code slot declines the match whole, a
coordinate expands the unit and hands the digit back. `asciiExponentIsCoordinateMinutes` is the second.

```
40°26        ->  "40 degrees 26"
40°26′46″N   ->  "40 degrees 26′46″N"     (the ′″ drop is #1435, untouched here)
```

Declining the exponent on ⟨°⟩ costs nothing real: a solid angle is written `deg²` or `sq deg`, never
`°2`, and the SUPERSCRIPT is left alone — the same split the code-slot rule makes.

**Checked and unaffected:** `19,500 km2`, `3 m2 of floor`, `5 µg2`, `5°C`, `Suite 5L2`, `T2G 0L2`.
**Checked and fine as-is:** `40°46` normalizes to `40 degrees46` with the digits glued, and reads
`fˈɔːɹt̬i dᵻɡɹˈiːz fˈɔːɹt̬i sˈɪks` — the tokenizer splits letter from digit, so no space is needed.

**Found in passing, NOT fixed:** `40°N` drops the degree sign outright (`fˈɔːɹt̬i ˈɛn`), and so does
`51°S`. Verified pre-existing on `main`, so not caused by this change. It is a different guard — the
unit's trailing `(?![\p{L}\p{M}])` lookahead, which exists so a unit cannot be part of a longer word —
and unpicking it is not this fix's business. Recorded so it is not rediscovered as new.

### ⚠ And a comment I "fixed" in Run 26's review shipped DUPLICATED

`test/english-normalize.test.ts` carried two identical copies of the `⚠ AND THE EXPONENT RULE TESTS THE
UNIT'S SHAPE` block, both sitting above the `µin` test rather than above the exponent test they
document, which was left bare. That is the Run 25/26 insertion defect a third time — and this time the
repair itself introduced it, in the commit that claimed to fix it. The test suite stayed green
throughout, because a misplaced comment is invisible to every gate. De-duplicated and re-attached here.

**Gates.** 6214 TS · 6810 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons.
