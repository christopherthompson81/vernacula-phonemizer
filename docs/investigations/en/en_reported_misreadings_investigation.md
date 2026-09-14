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

**Fix.** `foldSubscriptDigits` in `core/normalizeSymbols.ts`, called from the shared pipeline and
— separately — from English's own copy of that pass, because English does not route through
`makeSymbolNormalizer` (0 uses; 141 other languages do) and a tier feature reaches it only if it is
called there too. A subscript is a COUNT, not an exponent, so it gets none of the exponent
machinery: fold to ASCII and every existing number rule reads it. `CH₄` now equals `CH4` in all six
languages tested, `x²` is untouched, and the markup.ts note is updated to record that its premise
no longer holds.
