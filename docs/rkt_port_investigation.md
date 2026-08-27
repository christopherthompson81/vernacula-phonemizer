# Rangpuri (rkt) — C# port investigation

Chronological log of the runs behind the rkt port.

⚠ **rkt HAS NO CORPUS OF ITS OWN.** No FLEURS split, no `tools/corpus/mined/rkt.jsonc`, no
`tools/corpus/attest/rkt.jsonc`, no `/mnt/data` artifact, no rkt.wikipedia. Its ONLY source is
`tools/referee-eval/referees/rkt.toulmin-rp.tsv` — 370 Devanagari→IPA pairs machine-extracted from a
two-column PDF (Toulmin 2006 Appendix A, Rangpur point), which the eval config itself annotates as
carrying ~15% alignment noise. And `csharp/goldens/rkt.tsv` is **VARIANT-DERIVED**: 200 rows of
HINDI FLEURS text (`csharp/goldens/hi.tsv`, column 1) re-rendered through the rkt engine by
`tools/gen_variant_golden.mts`. 200/200 therefore pins **C#↔TS parity only**; it is not coverage of
Rangpuri. Both widenings PORTING.md asks for were built against that gap — see Run 2.

## Run 1 — 2026-08-27 — what is there to port?

Question: does rkt have its own engine, or does it compose a shared one that is already ported?

    wc -l src/languages/rangpuri/rangpuri.ts   → 40
    grep -rln makeNativeHindi src/             → 13 files

`rangpuri.ts` is 40 lines and 10 of them are the header. It calls `makeNativeHindi(manifest, phonology,
foreign)` with **no overrides, no lexicon, no script override** — the thinnest composition in the family
(bho and hne are the same shape; mr, ne, gu pass overrides). Every KRNB fact is in
`data/languages/rangpuri/rangpuri.jsonc`. `Hindi.MakeNativeHindi` is already ported and gated by
hi/bho/hne/mai/awa/mr/ne/gu, so the port is one 27-line file plus a Bootstrap line, and **the shared
core needed no change**.

⚠ Checked rather than assumed, per trap 55: the sibling Devanagari engines were used only to confirm
the *composition shape* (`Bhojpuri.cs`, `Chhattisgarhi.cs` are structurally identical), never as a source
for a rule or a value. Nothing was borrowed from a sibling manifest.

**Parity: 200/200 byte-identical on the first run**, 0 differ, 0 BLOCKED.

## Run 2 — 2026-08-27 — the two widenings, and what the haystack actually contains

Question: 200 rows of Hindi text is a narrow probe for a language with no corpus. What can be measured?

    .probe/rkt/all.txt = 6,851 unique lines, assembled from
        3,395  FLEURS hi_in (train+dev+test, columns 3+4 — ⚠ col 3, not the WAV filename)
        1,427  Devanagari strings mined from tools/corpus/mined/{hi,awa,mag,mai,mr,ne}.jsonc
          200  the rkt golden's own source text
          370  the Toulmin referee headwords
        1,717  hand-built (.probe/rkt/gen_probes.mts)
    × sync AND async = 13,702 comparisons, TS (.probe/rkt/probe.mts) vs C# (.probe/rkt/run_cs.sh)

**Result: 13,700 identical, 0 throws on either side, 2 BLOCKED.** The two blocked comparisons are one
mined line carrying an embedded TIBETAN run (`ལ་དྭགས`): TS reads it `la˩ tʰaʔ˩` through the `bo` engine,
C# drops it because Tibetan is unported. Blocked, not wrong — the same class the parity runner prints
separately.

The hand-built half covers, one line per arm plus the adversarial neighbour: all 37 consonants × 13
vowel signs × 5 positions; all 12 independent vowels; anusvara before each place of articulation,
chandrabindu, visarga, nukta and virama; 33 geminate clusters; every integer 0–130 plus the magnitudes,
both comma groupings, space grouping, leading zeros, above-2⁵³ runs and native Devanagari digits; every
arm of the inherited `hindi/normalize.ts` (era, both ordinal arms, abbreviations, Devanagari unit words,
degrees + coordinates + ℃/℉, clock, ±/+/−/×/÷/=/</>/&, fractions); the shared symbol tier; Latin runs;
and all ten `Object.prototype` member names (#1026 class — 0 hits, as expected since `parseJsonc`
null-prototypes at the parse boundary).

⚠ **WHAT THE HAYSTACK DOES NOT CONTAIN, measured not assumed** (`.probe/rkt/attest.sh`, over the
FLEURS + mined + golden text only):

| shape | count | note |
|---|---|---|
| space-grouped thousands `1 000` | **0** | the uz/ig shape is unattested here |
| `0,NNN` (comma after a lone zero) | **0** | so the stranded-comma finding below is ×0 attested |
| caret exponents `10^6` | **0** | and it READS here (`dˈɔs kˈi ɡʱˈat̪ sˈɔj`), unlike pcm/ha/yo/sw/id |
| digit runs > 15 | **0** | above-2⁵³ is reachable only from the hand-built lines |
| U+2212 | 9 | all in mined text |
| degree signs | 38 | |
| visarga ः | 125 | |
| avagraha ऽ | 214 | ⚠ ALL from mai/mag mined text (`कऽ`, `करलऽ`); **0** in the golden, **0** in FLEURS, **0** in the Toulmin referee. rkt sets no `retainOnAvagraha`, and there is no evidence KRNB writes the sign at all |
| leading-zero digit runs | ~45 | see Run 3 |
| NBSP | 0 | |

So four fleet shapes that have bitten other ports are unreachable from any text rkt can be shown, and
rest entirely on the hand-built lines. Say that rather than reporting "0 differ" as coverage.

## Run 3 — 2026-08-27 — the fleet defect shapes, read against rkt's own corpus

Question: which of the known fleet shapes are LIVE in rkt, and which are attested?

    .probe/rkt/attest.sh, .probe/rkt/ctx.sh

- **`Number("007")` drops the leading zero** → `007` reads *sˈat̪*. Live, and the shared shape ckb
  already filed. **But reading the instances rather than counting them**: all ~45 leading-zero runs in
  the Devanagari corpora are clock or date fields (`06:30`, `07:30`, `10:00`, `01-01-1923`, `08.11.1992`),
  one UTC offset (`+0545`) and one ISBN (`81-212-0807-6`). In every one of them dropping the zero is the
  RIGHT reading — hour 07 is *seven*. **Zero harmful attestation.** The 100× shape needs `0` + a
  fraction, and rkt-reachable text has none.
- **Comma "decimals"** looked attested ×5 (`9,86`, `82,40`, `1,72`, `1,18`, `6,05`) — reading the
  instances, every one is a clipped INDIAN LAKH GROUP (`1,72,96,455`, `82,40,611`, `1,18,325`), which the
  tokenizer joins correctly. Not a decimal comma. The count would have said otherwise.
- **`raw` re-stringification (#1059)**: rkt's number call site is `makeNativeHindi`'s `number()`, which
  passes the STRIPPED ASCII digit STRING to `spellDigits`, not a re-stringified double. Correct already,
  and rkt is not on `ACCEPTED_LOSSY` in `test/large-numeral-fidelity.test.ts` (that test sweeps every
  registry code, so rkt has been passing it since the engine existed).
- **`\p{Lu}` under `/i`**: no such construct on any path rkt reaches.
- **An era/abbreviation rule eating initials**: `hindi/normalize.ts`'s era arm requires ई/पू/स, and the
  abbreviation arm requires a Devanagari headword plus a following space and letter. Devanagari has no
  ASCII-initials shape, so the class does not arise. `डॉना` correctly declines (→ *ɖˈæna*, not "doctor na").

## Run 4 — 2026-08-27 — does the engine do what the manifest says?

Question: the manifest makes five falsifiable KRNB claims. Does the referee support them?

    .probe/rkt/aspirate.mts    (the positional-deaspiration claim, against all 370 referee pairs)
    npx tsx tools/referee-eval/eval.ts rkt

The **POSITIONAL VOICELESS DEASPIRATION** claim is the strongest one in the file, and Toulmin backs it:

    ख INITIAL   13 with [ʰ]  /  1 without (खाइजर)      ख elsewhere   0 with  /  4 without
    ठ INITIAL    2 with      /  0 without              ठ elsewhere   0 with  /  4 without
    थ INITIAL    3 with      /  0 without              थ elsewhere   0 with  /  1 without
    फ INITIAL    6 with      /  0 without

(the "elsewhere · with" cells the raw script reported are artifacts of testing the whole IPA string for
an ʰ — `खाठाइश=kʰaʈaiʃ` counts the INITIAL ख, `हठात=hɔʈat̪`/`हाथ=hat̪` count the ह. Read individually,
non-initial voiceless aspiration is 0/9.) **24 of 25 word-initial, 0 of 9 elsewhere.** The rule is right.

Voiced aspirates: 29 initial instances, 29 written with the breathy mark, 0 without. Retention is right.
Deaffrication: छ 11/11 written with a plain sibilant. Right.

Whole-referee score: raw 0/370 (the referee writes no stress), **folded backbone 236/370 (63.8%)**,
symbol accuracy 86.8%. The residual is dominated by extraction noise (`गुर = aŋgul` is a row shifted off
आंगुल; `आड़ियॉ = aɽiæʃar` glues two entries) and by the anusvara gap the manifest already declares.

**Path check (PORTING.md question 3).** `phonemizeWord` (what the referee eval scores) is
`engine().wordRules(w)`; the shipped `text()` path calls `word(w)`, which is
`lexicon?.get(w) ?? wordRules(w)` — and rkt passes **no lexicon**. So the instrument and the product are
the same path here, unlike the `pa` case.

## Run 5 — 2026-08-27 — the reachability sweep

Question: is every table this manifest loads actually reached?

    .probe/rkt/sabotage.mts — sabotage each leaf value in rangpuri.jsonc in turn, re-render all 6,851
    probe lines, and report the values whose sabotage changes nothing.

**116 live, 8 dead** — and every one of the 8 is a DECLARATIVE string, not a lexical value. No consonant,
vowel sign, independent vowel, sign character, number word, magnitude, clause mark, postRule or finalRule
is unreached: all 116 change the output of at least one of the 6,851 lines.

    DEAD  signs.virama.effect       = "suppressInherentVowel"
    DEAD  signs.anusvara.effect     = "nasalizeVowel"
    DEAD  signs.chandrabindu.effect = "nasalizeVowel"
    DEAD  signs.visarga.effect      = "appendH"
    DEAD  signs.nukta.effect        = "composeNukta"
    DEAD  schwaDeletion.medialRule  = "ohala-VCaCV"
    DEAD  numbers.grouping          = "indian-lakh-crore"
    DEAD  nasalVowelsAreShort       = true

- The five `signs.*.effect` fields: `AbugidaDef` types `effect` on `chandrabindu` ALONE and `abugida.ts`
  reads it only there, and only against the literal `"nasalizeVowelHomorganic"` — so chandrabindu's is
  dead *by value* and the other four *by key*. ⚠ **The manifest already says this**: the anusvara note
  reads "a shared-engine limitation (the effect field isn't dispatched)". An honest note, not a silent gap.
- `schwaDeletion.medialRule` and `numbers.grouping` are the same class one layer up: `deleteMedialSchwa`
  is called unconditionally and no composer dispatches on `grouping`. Both are dead in **nine**
  Devanagari manifests, not just this one. ⚠ `ManifestMappingTests` cannot see either — it diffs the
  TOP-LEVEL key set, and `numbers`/`schwaDeletion` are each claimed as a whole.
- `nasalVowelsAreShort` is dead for a language-specific reason worth stating: it only strips a trailing
  `ː` before nasalizing, and rkt declares NO long vowels ("no phonemic vowel length" is the manifest's
  headline claim), so the flag can never fire. The `ː` the geminate postRule introduces arrives long
  after `g2p` has finished. Inert, consistent, harmless.

## Findings

### Fixed in TypeScript first

None. **No defect was found in rkt's own 40 lines or its manifest that a source could adjudicate**, and
that is the honest outcome for a language whose only referee is a noisy wordlist. Everything below is
either shared-core (and already filed for another language) or a data question with no referee.

### Found, NOT fixed

- ⚠ **THE 80 WORD HAS NO FINAL VOWEL AND IT IS IN THE GOLDEN.** `numbers.tens["80"]` is `आइस`, which
  reads ***ˈais***, and it occupies 2 of the 200 golden rows (`80 प्रतिशत`, `380 मीटर`). Every other ten
  in the table is a transparent Devanagari respelling of the Bengali/KRNB form with the ই written as
  ⟨इ⟩ — बिस/বিশ, चाइलिस/চল্লিশ, षाइठ/ষাট, सत्तइर/সত্তর, नब्बइ/নব্বই — and on that pattern 80 আশি
  should be ⟨आशि⟩ *aʃi*, not ⟨आइस⟩ *ais* with the sibilant and the vowel transposed and the wrong
  sibilant letter. **NOT FIXED**: the Toulmin referee contains no numerals at all, `rangpuri.ts` states
  "Numbers deferred (the word referee doesn't exercise them)", and a change would move golden rows on a
  hypothesis. It needs a KRNB numeral source, which is exactly what the module header says is missing.
- **21–99 read as two words, and the manifest says so.** `numbers.compound` is `{}`, so
  `indicNumberWords` takes its documented unit-then-tens fallback: 21 → *ˈek bˈis*, 56 → *sˈɔj pˈɔsas*.
  KRNB, like Bengali, has fused irregular forms (একুশ) for all of 21–99. Same blocker as above.
- **छय (6) and सय (100) are HOMOPHONES under this manifest** — both read *sɔj*, because छ→s
  deaffricates onto the same phone सय already has. So `356` reads *t̪ˈin sˈɔj sˈɔj pˈɔsas*, "three
  hundred six fifty" with two identical syllables. This is a genuine consequence of the deaffrication
  the manifest sources, not an error in it (KRNB ছয়/শয় really do converge), and no referee here can
  say whether a speaker disambiguates. Recorded because the reading looks like a bug and is not.
- ⚠ **THE GEMINATE postRule GIVES ONE CONSTRUCTION TWO ANSWERS, decided by PLACE.** Its class is
  `((?:t̪ʰ|d͡z|[kɡptbmnlʃsɳŋɽ]ʰ?ʱ?|t̪|d̪|ʈ|ɖ))\1(?!͡)`. The bracketed LETTER class carries `ʰ?ʱ?`, so
  घ्घ → *ɡʱː* and भ्भ → *bʱː*; but `t̪`, `d̪`, `ʈ`, `ɖ` and `d͡z` sit in the bare tail without it, so
  ध्ध → *d̪ʱd̪ʱ*, ढ्ढ → *ɖʱɖʱ* and झ्झ → *d͡zʱd͡zʱ* keep two full segments. **×0 attested** (those three
  clusters do not occur in Devanagari orthography — the language writes द्ध, ड्ढ, ज्झ, and all three of
  THOSE geminate correctly: बुद्ध → *bˈud̪ːʱ*). The live half is the omission of **`ɾ`**: र्र is the
  9th most frequent geminate in the Devanagari corpora at **67 instances**, `ɽ` IS in the class and `ɾ`
  is not, and the golden itself carries the ungeminated pair (दर्रा → *d̪ˈɔɾɾa*). Whether a geminate tap
  should be written `ɾː` is a phonological decision with no rkt referee; व्व (×2), य्य (×2), ह्ह and
  ञ्ञ are in the same bucket. Filed.
- **A guard's safe branch strands a separator the tokenizer reads as CLAUSE PUNCTUATION.**
  `makeNativeHindi`'s number token carries a nested lookbehind so a grouping comma may not follow a lone
  zero — which correctly stopped `0,001` reading as *एक* (the su 1000× shape). The residue is that the
  comma then falls to the clause arm: `0,001` reads ***ʃˈunj , ˈek***, one number becoming two with a
  pause. **×0 attested** in FLEURS + mined + golden (Devanagari text writes the decimal point), and it
  reaches all 17 languages built from this maker, so it is a family decision rather than a port one.
- **Shared shapes, already filed elsewhere, confirmed live here**: `1 000` → *ˈek ʃˈunj* and
  `1 000 000` → *ˈek ʃˈunj ʃˈunj* (space-grouped thousands, ×0 attested); `2 − 2` → *d̪ˈui d̪ˈui*
  (U+2212 between digits); `25°Cx` → *pˈãs bˈis ɖˈiɡɾi ks*; `1500 ई.` → *… ˈi .* (the era arm handles
  only ई.पू./ई.स.पू., so a bare CE marker leaves a word and a full stop); `11:20:30` → two stranded
  colons as pauses.
- **`numbers.grouping` and `schwaDeletion.medialRule` are dead keys in nine manifests** (hi, mr, ne,
  bho, mag, mai, awa, hne, rkt). Neither engine declares either field. `ManifestMappingTests` cannot see
  them: it diffs the TOP-LEVEL key set, and `numbers`/`schwaDeletion` are each claimed as a whole.
- **Checked and DECLINED as a defect**: `abugida.ts` emits a plain `h` for the visarga while all nine
  Devanagari manifests map ह to `ɦ` (125 visarga instances in the corpora — `क्रमशः` → *kɾˈɔmʃɔh*). The
  two are not the same phone and the visarga is classically voiceless, so the split looks deliberate
  rather than an inventory slip. Recorded so the next reader does not re-open it.
- **Inherited-Hindi words in KRNB sound, which `rangpuri.ts` already flags and does not guess at**:
  the clock (`11:20` → *ˈeɡaɾo bˈɔd͡zkɔɾ bˈis mˈinɔʈ*), the ordinals (`1ला` → *pˈɔɦla*, Hindi पहला),
  प्रतिशत, the unit words and the whole shared symbol tier. Confirmed reachable and confirmed
  unsourceable — the Toulmin list contains none of these words.
