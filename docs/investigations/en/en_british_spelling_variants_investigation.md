# British/Commonwealth spellings in the `en` reader

The `en` lexicon is CMUdict-derived, so its headwords are American spellings. A Commonwealth
speller (the reporting user writes Canadian English) types `vapour`, not `vapor` — and every
such word that CMUdict happens not to carry falls through to the OOV path and is READ as a
different word. This log is about how wide that hole is and what the right patch shape is.

## Run 1 — 2026-09-14 12:08

**Question.** Is `vapour` actually mis-read in `en`, and is it one word or a class?

**Command.** A probe over 28 `-our` spellings through both entry points:

```
npx tsx .scratch/p.mts     # phonemize(w,"en") and phonemizeAsync(w,"en")
```

**Raw finding.**

```
vapour       sync: vˈeᶦpʰaᶷɚ          async: vəpʰˈʊɹ
vapor        sync: vˈeᶦpɚ             async: vˈeᶦpɚ
colour       sync: kʰˈʌlɚ             async: kʰˈʌlɚ
honour       sync: ˈɑːnɚ              async: ˈɑːnɚ
labour       sync: lˈeᶦbɚ             async: lˈeᶦbɚ
savour       sync: sˈeᶦvɚ             async: səvˈaᶷɚ
vigour       sync: vˈɪɡʊɹ             async: vɪɡˈʊɚ
valour       sync: vˈɑːloᶷˌʌɹ         async: vəlˈʊɚ
splendour    sync: splˈɛndəɚ          async: splˈɛndɚ
candour      sync: kʰˈændaᶷɹ          async: kʰˈændɚ
tumour       sync: tuːmˈoᶷʌɹ          async: tʰˈuːmɚ
saviour      sync: sˈeᶦvʊɹ            async: sˈeᶦvjɚ
succour      sync: sˈʌkʰʊɹ            async: səkʰˈʊɹ
```

**Implication.** It is a class, and the split is *accidental*: `colour`/`honour`/`labour` are
right only because CMUdict happens to carry those three spellings as headwords. `vapour` is not
a headword, so it is OOV and the n-gram/BiLSTM reads the `-our` literally as a diphthong+rhotic
(`aᶷɚ`, `ˈʊɹ`) instead of the reduced `ɚ` the American spelling gets. Nothing in the pipeline
knows the two spellings are the same word.

Confirmed there is no spelling-variant layer anywhere in `src/` (grep for `spelling`/`variant`
finds only per-language orthography notes). So this is a missing stage, not a broken one.

## Run 2 — 2026-09-14 12:09

**Question.** How wide is the hole, and can a *rule* close it safely, or does it need a table?

**Command.** `/usr/share/dict/british-english` (24,240 of its entries are OOV in the lexicon) as an
ORACLE — not as shipped data — run through a first, deliberately loose rule set: `our→or`,
`re$→er`, `ce$→se`, `ise→ize`, `yse→yze`, `ll+suffix→l+suffix`, `l(ment|ful)→ll…`, `ae→e`, `oe→e`,
`ogue$→og`, `mme$→m`, `sulph→sulf`, `xion$→ction`, composed breadth-first to depth 3. A rewrite is
kept only when it lands on a real lexicon headword.

**Raw finding.** 959 of the 24,240 rewrote. By family: ise 615, our 101, ll 95, ae/oe 72, re 11,
yse 9, l→ll 8, mme 5, ce 2, misc 3. Reviewing all 959 by hand found three false-positive classes:

```
our    courbet>corbet  douro>doro  timour>timor        # `our` matched mid-word
ae/oe  aloes>ales  noels>nels  oe>e  phaedra>phedra    # digraph spans a morpheme boundary
       roeg>reg  baeria>beria  baeyer>beyer  taejon>tejon
ll     dolling>doling  palled>paled  pilled>piled      # ordinary English doubling, not British
       tilled>tiled  hulling>huling
```

**Implication.** The "result must be a headword" guard is doing most of the work already — it is
what makes `our`/`hour`/`flour`/`four` safe without a single special case, since those are
headwords and so never reach the rules. But it is not sufficient for these three. A table would
avoid them, and a table was the first instinct; the reason to keep rules is that the fold only ever
runs on words that are ALREADY going to the OOV G2P, so a miss costs nothing and the rules stay in
sync with the lexicon for free. Tighten the three, keep the shape.

## Run 3 — 2026-09-14 12:10

**Question.** Do the tightened rules kill the false positives without killing the class?

The three tightenings: `-our` anchored to a suffix boundary or a following lexicon word (kills
`courbet`, `douro`); `ae`/`oe` replaced by a curated stem list rather than a digraph rule; the
doubled-`l` rule guarded on the American stem being a real word.

**Raw finding.** 886 rewrites — the junk was gone, but so were `barrelled`, `channelled`,
`counselled`, `duelled`, `jeweller`, `labelling`, `levelling`, `marshalling`, `modelled`,
`parcelled`, `revelled`, `towelling`, `tunnelling` and `aeon`, `caesium`, `chimaera`, `daemons`,
`hyaena`, `primaeval`, `aetiology`, `onomatopoeia`.

**Implication — the guard was right and its test was wrong.** "Reject when the `ll` stem is itself a
lexicon word" looked principled and was fatal: CMUdict carries the surnames **`marshall`, `jewell`,
`powell`, `channell`**, so the guard rejected the entire legitimate family. The property that
actually separates `travelled` from `dolling` is that British doubling only happens after an
unstressed syllable — so the American stem is never a three-letter monosyllable. Guarding on
`stem.length > 3 && known(stem)` keeps `label`/`barrel`/`marshal` and drops `pal`/`dol`/`til`/`pil`.
The ae/oe losses were just stems I had not listed; added.

## Run 4 — 2026-09-14 12:11

**Question.** With the retuned guards, what is left over — in both directions?

**Raw finding.** 927 rewrites. One false positive survived the review of all 927: `floury>flory`.
`flour` + `-y` puts `our` at index 2 with an allowed suffix after it, and `flory` happens to be a
headword. Raising the index floor does not work — `odour` has its `our` at index 2 as well — so this
is an explicit deny-list of the `-our` words where the `u` is part of the vowel (`flour`, `scour`,
`devour`, `tour`, `amour`, …). Most are headwords already; it is their INFLECTIONS (`floury`,
`scouring`) that are OOV and need it. With the deny-list: **927 corrections, zero false positives.**

Deliberately NOT folded, recorded so a later reader does not "fix" them:

- `glamourize`, `glamourous` — `-our` + a Latinate suffix. British spelling itself drops the `u`
  there (`humorous`, `vaporize`, `honorary`, `laborious`), so widening the suffix list to include
  them would claim more than the orthography does.
- `segre>seger`, `timour>timor` — proper nouns that happen to fit. Both were OOV guesses before and
  are OOV-adjacent guesses now; neither reading is defensible over the other.
- `floury` stays OOV and is read `flˈɝi`, which is wrong. That is the PRE-EXISTING OOV reading, not
  a regression: the deny-list blocks the fold, it does not invent anything.
- `aluminium` → `əlˈuːmɪnəm` is CMUdict's own entry (it carries the British spelling with the
  American three-syllable reading). A lexicon defect, not a spelling-fold one; out of scope here.
- `learnt`/`spelt`/`dreamt`, `whisky`/`whiskey`, `aluminium`/`aluminum` are NOT spelling pairs —
  they differ in pronunciation — and are pinned as non-rules by a test.

## Run 5 — 2026-09-14 12:15

**Question.** Does the fold change anything it should not, and does the C# port agree?

**Commands.** `npx vitest run` (5,804 tests) · `dotnet test` (6,504) ·
`npx tsx tools/extract_regexes.mts && dotnet run --project csharp/tools/regex-diff`.

**Raw finding.** TS: the only failure was the regex-corpus freshness gate, which is what it is for —
11 new patterns. After regeneration the translator probe reports `142010 probe results identical,
0 DIFFER, 0 threw`, so none of the 11 sits in the JS/.NET dialect gap. C#: 6,504 pass unchanged —
the 200-row `en` and `en-GB` goldens contain no Commonwealth spelling at all, which is its own small
finding: **the golden corpus could not have caught this and still cannot.** That is why the new
tests are written as a matched TS/C# pair with the same 27 + 9 expected strings rather than as
golden rows; 42 C# assertions now pin byte-identity with the TypeScript on a class the goldens do
not reach.

**Side effect worth recording.** `phonemize` and `phonemizeAsync` now AGREE on these words. They
disagreed before (`savour` → `sˈeᶦvɚ` vs `səvˈaᶷɚ`) only because the word was OOV and the two paths
guess differently; resolving it in the lexicon removes the divergence rather than papering over it.
