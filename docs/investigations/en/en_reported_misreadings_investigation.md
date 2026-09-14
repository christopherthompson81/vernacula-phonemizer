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
