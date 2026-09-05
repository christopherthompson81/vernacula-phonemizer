# Latin (la) — C# port investigation

Chronological log of the runs behind the la port.

⚠ **la HAS NO FLEURS SPLIT** — it is a dead language and `$ASR_ALIGN_ROOT/corpus/fleurs*`
carries no `la` directory or transcript. So widening (1) of PORTING.md, the corpus-wide differential
over the FLEURS transcript, **is unavailable in its usual form**, and the weight falls on the mined
artifact (`tools/corpus/mined/la.jsonc`) plus hand-built off-golden probes. `csharp/goldens/la.tsv` is
the MINED tier: 200 rows of la.wikipedia prose.

## Run 1 — 2026-08-27 12:00 — what is there to port?

Question: how much of la is its own code and how much is shared core already ported?

    wc -l src/languages/latin/*.ts
        242 latin.ts · 151 normalize.ts · 115 numbers.ts = 508

Every import `latin.ts` reaches for is already ported: `Clauses`, `NormalizeSymbols`, `HostWord`
(`LATIN_RUN`, `MakeNativiser`), `LoadManifest`, `LatinPhones`, `Ipa.IPA_VOWEL`, and on the normalize side
`Unicode.FoldNativeDigits` and `Boundaries`. **No shared-core change was needed.** Four C# files
(Manifest, Normalize, Numbers, Latin) + a `Bootstrap.cs` line + a `ManifestMappingTests` entry.
`Registry.cs` already routed `case "la": return Create("latin")`, so nothing there changed either.

Two porting hazards actually present in this engine, both handled by the existing contract:

  · **`w[i]` is a UTF-16 unit walk over an NFC string.** Ported as `w[i].ToString()` with an `At(k)`
    that returns `null` out of range (JS `undefined`), so the `at(i-1)` at `i === 0` declines exactly
    as the TS does rather than throwing.
  · **`toLowerCase` is JS's**, so `Js.ToLowerCase`, not `ToLowerInvariant` — and it is load-bearing on
    `İ` (U+0130), which the probe list carries.

Every regex — including the one-character `/ː/u`, `/̯/u`, `/̆/gu` tests the scan runs per segment — goes
through `JsRegex.Compile` with the TS pattern string verbatim, and `NATIVE_CLASS` was copied out of the
TS **programmatically** rather than retyped, because it ends in a bare combining range (`̀-ͯ`).

**Parity: `dotnet run --project csharp/tools/parity -- la` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED.

## Run 2 — 2026-08-27 12:10 — the widenings, and what the haystack actually contains

Question: 200 rows of unmacronized wiki prose is a narrow probe for a macron-driven engine. What can be
measured, and what does the haystack NOT contain?

    .probe/la/all.txt = 863 unique lines
        493  every string in tools/corpus/mined/la.jsonc ("hard" + "sample")
        370  hand-built (.probe/la/gen_probes.mts) — one line per arm plus its adversarial neighbour
        200  the golden's own source text
    (+ a 52-line second round, .probe/la/p2.txt, for the corners Run 2 raised)
    × sync AND async = 1,726 + 104 comparisons, TS (.probe/la/probe.mts) vs C# (.probe/la/probe.csproj)

**Result: 1,830 comparisons, 0 differ, 0 throws on either side, 0 BLOCKED.**

⚠ **AND HERE IS THE MEASUREMENT THAT MATTERS, per PORTING.md's "measure whether the haystack contains the
thing":**

| construct | mined (493) | golden (200) |
|---|---|---|
| **macron ⟨āēīōūȳ⟩** | **9** | **0** |
| diaeresis ⟨ëïöüÿ⟩ | 21 | 8 |
| aspirate digraph ph/th/ch/rh | 238 | 106 |
| ⟨gn⟩ | 59 | 20 |
| ⟨qu⟩ | 191 | 54 |
| ⟨ngu⟩+V | 10 | 7 |
| diphthong ae/au/oe | 280 | 113 |
| word-final ⟨-Vm⟩ | 289 | 111 |
| intervocalic ⟨z⟩ | 16 | 5 |
| era marker a.C./p.C. | 8 | 2 |
| `&c.` | 2 | **0** |
| degree sign | 12 | 5 |
| percent sign | 24 | 2 |
| currency $ / € | 15 | **0** |
| space-grouped number | 7 | **0** |
| minus sign | 16 | **0** |

**The golden contains ZERO literal macrons.** The `LONG` table — the whole vowel-length half of this
g2p — is reached in the golden only *indirectly*, through the number composer, whose output
(`ūnus`, `mīlle`, `nōngentī`) is macronized by construction; row 3 is `sɛptuaːˈɡɪntaː ˈuːnʊs`. So a
200/200 here does **not** demonstrate the macron path over written text, and the 9 mined lines plus the
hand probes (`ā ē ī ō ū ȳ`, `vīta`, `cīvis`, `amīcus`, `cōnsul`, `īnfāns`, `Rōmānum`, `fīlī`, `dū̆cō`) are
what does. Same for `&c.`, currency, space grouping and the minus: **zero golden instances each**, all
four covered only by the probes.

## Run 3 — 2026-08-27 12:15 — reading for correctness, not only fidelity

Question 1 of PORTING.md's three (does the code do what its docstring promises?), asked per file.

**FINDING — the word-final ⟨-Vm⟩ rule nasalizes an OFFGLIDE, and it is live in the shipped golden.**

`latin.ts` step (3) is documented as "word-FINAL ⟨-Vm⟩ → nasalized long vowel [Ṽː]". Its guard is
`isVowelSeg(segs[len-2])`, and `isVowelSeg` is true of a DIPHTHONG OFFGLIDE (`u̯` contains `u`), so a
word ending `-aum` has its offglide nasalized and lengthened:

    Nicolaum  →  ˈnɪkɔɫaũ̯ː      (TS and C# identically)

`ũ̯ː` is a long nasalized NON-SYLLABIC vowel, which is not a coherent segment; and because `placeStress`
skips anything carrying `̯`, the ultima also stops counting as a nucleus, so a four-syllable word is
stressed as a three-syllable one. **Attested, not hypothetical: `Nicolaum` is in `tools/corpus/mined/la.jsonc`
and in `csharp/goldens/la.tsv` row 43**, where `nɪkɔɫaũ̯ː` is the shipped reading. `Achaum`, `laum` and the
bare `aum` reproduce it; `Achaeum` (`aˈkʰae̯ũː`) and `laudem` (`ˈɫau̯dẽː`) are the correct neighbours.

Filed as **#1097**. Per PORTING.md the C# ported the CURRENT behaviour rather than fixing it here: the
fix is TS-first, and it moves at least one golden row, so it belongs in its own change with the goldens
regenerated. **NOTHING IN THE TYPESCRIPT WAS CHANGED BY THIS PORT.** ⚠ It has since landed upstream — see
Run 5, which is what this branch is now gated against.

Two more things noticed and deliberately NOT filed, with the reason:

  · **Epigraphic capitals are not read as such.** `QVINQVE` → `kˈwɪŋkwɛ`: `QV` does not match the `qu`
    digraph and `V` falls to [w]. Both engines agree, and the corpus writes lowercase ⟨u⟩ — there is no
    attestation to argue a rule from, so this is a limitation, not a defect.
  · **The clear-⟨l⟩ test lists `i`, `ī`, `j`, `y` but not the diaeresis front vowels `ï`/`ë`.** Zero
    instances of `l` + diaeresis-front-vowel in either the mined artifact or the golden, so there is
    nothing to argue from and nothing observable to change.

Questions 2 and 3 came back clean: every table `latin.jsonc` declares is reached by the scan
(`short`/`long`/`tense`/`vowelLetters`/`velars`/`mutae`/`liquids`/`consonants` — `ManifestMappingTests`
now pins that structurally), and there is one entry point — `text()` → `phonemizeWord` — so the golden,
the eval and the shipped path are the same path.

## Run 5 — 2026-08-27 14:30 — the finding landed upstream, and the branch follows it

#1097 was fixed in the TypeScript (#1110) while this port was in review, which is the bidirectional flow
PORTING.md describes working as intended: the port read the code, the reading found a defect, the defect
went back to the TS with a referee behind it, and the C# now implements the FIXED behaviour rather than the
one it was written against.

⚠ **THE REFEREE ANSWERED A QUESTION THIS DOC LEFT OPEN.** Run 4 framed the repair as a phonological choice
— decline on the offglide, or reach past it to the nucleus — and said it wanted a referee check. It got one:
of the 45 `la.wikipron-lat-clas-narrow` rows spelled ⟨a|o|e⟩⟨u|e⟩m, **not one nasalizes an offglide**. So
`-aum` is a HIATUS and the answer is neither candidate exactly — make the offglide SYLLABIC.

Merged `origin/main` and applied the three changes the upstream commit carries for this branch:

    Latin.cs   NasalizeLong strips U+032F as well as ː and the tilde (the one-line fix, in the same
               place the TS put it — the function's contract is "return a nasalized long NUCLEUS")
    Numbers.cs NumberToWords gained the `raw` parameter the TS added in the same window (#1095's
               large-numeral work), so the digit fallback reads the TOKEN, not the float's string
    Latin.cs   the call site passes the raw token through

    Nicolaum   ˈnɪkɔɫaũ̯ː  →  nɪˈkɔɫaũː     the segment is syllabic AND the word gets its syllable back
    Boleslaum  bɔˈɫɛsɫaũː · Coeum ˈkoe̯ũː · Idaeum ɪˈdae̯ũː · Caesareum kae̯ˈsareũː   — referee-exact
    bellum ˈbɛllũː · aquam ˈakʷãː · laudem ˈɫau̯dẽː · mensa ˈmẽːsa   — untouched

Re-gated after the merge: **parity la 200/200 against the NEW golden**, and the differential re-run against
the fixed engine is **1,726 comparisons, 0 differ, 0 throws** (plus the 104-comparison second round, still
identical). Nine C# assertions mirror the TS's new ones, four of them segment-for-segment against the
referee rows.

⚠ Plus a 12-line CASE-FOLDING probe (`ſ`, `İ`, `ẞ`, `ﬁ` against the two `gui`-flagged degree patterns),
added because the wo review found a `KeyNotFoundException` of exactly that shape in another port: **24
comparisons, 0 differ, 0 throws.** la's callbacks index no dictionary by matched text.

## Gates

    csharp tests            1,905 pass (79 in LatinTests.cs incl. 9 new for #1097), 0 fail
    parity, la              200/200 byte-identical against the POST-#1110 golden, 0 differ, 0 BLOCKED
    parity, fleet           128 languages, 25,227 rows, 0 differ, 0 BLOCKED
    differential            1,830 comparisons (sync + async), 0 differ, 0 throws — re-run after the merge
    case-folding probe      24 comparisons, 0 differ, 0 throws
    typescript              unchanged by this branch (#1097 landed separately as #1110)
