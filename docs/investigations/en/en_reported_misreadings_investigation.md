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
