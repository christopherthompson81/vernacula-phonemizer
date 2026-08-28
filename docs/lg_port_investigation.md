# Luganda (lg) — C# port investigation

Chronological log of the runs behind the lg port. lg is Bantu (Great Lakes, JE15), the principal language of
Uganda (~11M incl. L2), Latin orthography, 758 lines of TypeScript across four modules.

## Run 1 — 2026-08-28 06:40 — what is there to port?

    wc -l src/languages/luganda/*.ts
        99 luganda.ts · 66 manifest.ts · 522 normalize.ts · 71 numbers.ts = 758

No shared-core change was needed (`Clauses`, `HostWord`, `LoadManifest`, `JsRegex`, `Js` were all already
ported) and `Registry.cs` already routed `case "lg": return Create("luganda")`. **No shared symbol tier is
wired** — Luganda puts the measure noun BEFORE its number (`mmita 800`, `kiromita 10`, `ddoola US$29`) and
the tier can only postpose, so all seven normalization steps are local.

Three rules live in CODE rather than the grapheme table, and all three had to be ported as written:

  · **PRENASALISATION** — ⟨n m⟩ + an obstruent emits a place-assimilated superscript nasal and consumes ONE
    letter, so the obstruent is scanned normally and its labialisation survives (`ndw` → ⁿdʷ). The
    superscript is chosen by `"bpfv".includes(x)` / `"kg".includes(x)`, i.e. by ASCII letter — see Run 4.
  · **CONSONANT GEMINATION** — a doubled consonant is [Cː], gated on `!VOWEL_LETTERS.has(c) && w[i+1] === c
    && G[c]`. The last conjunct is a JS TRUTHINESS test on the grapheme; ported as
    `TryGetValue(...) && v.Length > 0`.
  · **VOWEL LENGTHENING BEFORE A PRENASALISED CONSONANT** — a post-step `replace(/([aeiou])(?=[ᵐⁿᵑ])/g,…)`.
    ⚠ Flags `g` only, no `u`; compiled through `JsRegex` like every other pattern.

⚠ **THE SEPARATOR CLASSES WERE AUDITED BY CODE POINT BEFORE THE FIRST RUN** (the nso lesson, #1109). Every
one in `normalize.ts` is written as an ESCAPE (`[  ]`, `[    ]`) rather than a literal —
the TS file says so explicitly, having once had one collapse into a duplicate ASCII space — so the escapes
carry through to `JsRegex` unchanged. No all-ASCII-space class in any of the four new files.

⚠ **THE `replace` CALLBACK'S THIRD ARGUMENT IS THE PRE-REPLACEMENT STRING.** `normalize.ts` reads it in nine
places (`saidNear`, `NAMED_DOLLAR`), so the C# freezes `s` before each individual `Replace` and offsets into
the frozen copy — one frozen copy per call, not one for the function.

**Parity: `dotnet run --project csharp/tools/parity -- lg` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED. (200 rows, **128 unique texts**.)

## Run 2 — 2026-08-28 06:52 — the corpus-wide differential

lg HAS a FLEURS transcript — `lg_ug`, which is the corpus #1102 landed. Columns 3+4 (⚠ not column 2, the WAV
filename).

    .probe/lg/all.txt = 4,442 unique lines
        3,749  FLEURS lg_ug, columns 3+4
          476  tools/corpus/mined/lg.jsonc + tools/corpus/attest/lg.jsonc
          166  hand-built off-golden probes (.probe/lg/probes.txt)
          128  the golden's own unique text
    × sync AND async = 8,884 comparisons

**Result: 8,884 comparisons, 0 differ, 0 throws, 0 BLOCKED.** A sweep of every C# output for a raw digit or
a `$ € £ % ² ³ °` returns **0 lines of 4,442**, and sync output equals async output on every row (lg has no
neural path).

What the haystack actually contains — the fraction that exercised the new code, per PORTING.md:

| construct | FLEURS (3,749) | mined+attest (476) | golden (128u) | probes (166) |
|---|---|---|---|---|
| any digit | 704 | 304 | 31 | 140 |
| comma grouping | 46 | 35 | 3 | 7 |
| space grouping | **1** | 9 | **0** | 5 |
| period grouping | **0** | 6 | **0** | 2 |
| decimal dot | 36 | 70 | 4 | 34 |
| percent | 8 | 24 | 1 | 10 |
| currency `$ € £` | 16 | 20 | 2 | 10 |
| unit key after a digit | 41 | 22 | 2 | 22 |
| `km²`/`km2` | 4 | 10 | 1 | 4 |
| dash range | 34 | 39 | 1 | 18 |
| `N:NN` / `N.NN` | 36 | 41 | 2 | 37 |
| English ordinal suffix | 22 | 2 | **0** | 6 |

**The golden alone reaches five of the seven steps and no more.** Step 1 (the English ordinal suffix) is ×0
in it, and step 3's SPACE and PERIOD arms are ×0 in it — the period arm, the one the TS calls "the risky
one", is ×0 in FLEURS as well and is carried by the mined artifact and the probes alone. That is the whole
argument for the two widenings: 200 golden rows would have left the language's most dangerous rule
(period-grouped thousand vs. three-place decimal) entirely unmeasured on the C# side.

## Run 3 — 2026-08-28 06:58 — the gate, whole-fleet

`dotnet run --project csharp/tools/parity` → **135 languages byte-identical, 26,627 rows ok, 0 differ, 0
BLOCKED**; `dotnet test` → **2,581 passed, 0 failed** (includes the 99 new `LugandaTests` cases and the
`LugandaManifestIsFullyMapped` structural check).

## Run 4 — 2026-08-28 07:00 — reading for correctness

Three findings. All were reproduced IDENTICALLY by both engines, so all three were FILED rather than fixed
here (PORTING.md: the fix lands in the TypeScript first, with a test and regenerated goldens).

⚠ **FINDING 1 IS NO LONGER OPEN — see Run 5.** #1131 landed in the TypeScript (PR #1134) while this port was
in review, so this branch was rebased onto it and now implements the FIXED behaviour. The text below is kept
as the finding was written, because it is the evidence that produced the fix; Run 5 records what changed.

### FINDING 1 (#1131, FIXED in #1134) — ⟨ŋ⟩ does not "drop outright"; the shipped path folds it to ⟨n⟩ and speaks an alveolar

`luganda.ts` says, at `NATIVE_CLASS`:

> ⚠ ŋ IS DELIBERATELY ABSENT: the g2p has no rule for it, and drops it outright — listing it here would
> promise a reading that does not exist.

The premise is true of `phonemizeWord` and **false of `text()`**, which is the path users reach. A token
outside `NATIVE_CLASS` goes through `makeNativiser`, whose `UNDECOMPOSABLE` table maps **ŋ → n** before
`phonemizeWord` ever sees the character. So the letter is not dropped, it is REPLACED, and the replacement
is the one segment Luganda's own sources single out as contrastive:

    phonemizeWord("ŋŋamba")  → "aːᵐba"      (dropped — what the comment describes)
    phonemize("ŋŋamba","lg") → "nːaːᵐba"    (folded to ⟨nn⟩ — what ships)
    phonemize("ng'amba","lg")→ "ŋaːᵐba"     (the same word spelled the commoner way)

⚠ **AND IT IS IN THIS LANGUAGE'S OWN FLEURS TEXT, not a synthesised probe.** `lg_ug` line
*"…mu ziseŋŋendo ezetoloola enjuba…"* reads `zisenːeːⁿdo`, an alveolar geminate where the orthography wrote
the velar nasal. 2 FLEURS lines and 4 mined-corpus lines carry a literal ⟨ŋ⟩; the golden carries **0**,
which is why 200 rows could never see it. The bring-up doc's fieldwork source is explicit that the speaker
"insists ŋŋamba, not \*nggamba" — the contrast the fold erases.

⚠ **AND THE INSTRUMENT CANNOT SEE IT** (PORTING.md question 3). `tools/referee-eval/eval.ts` imports
`phonemizeWord` directly, so the 99.1% folded score measures the path where ⟨ŋ⟩ is dropped, not the path
where it is spoken as [n]. The eval and the product are different paths at exactly this character.

The shape of a fix is a one-row grapheme entry (`"ŋ": "ŋ"`, and the doubled letter already reaches the
gemination rule) plus ⟨ŋ⟩ in `NATIVE_CLASS`; it moves golden rows in neither engine (0 instances) but it
moves 6 corpus lines, so it needs the TS-first route.

**That is what #1134 did — plus one thing this finding did not anticipate.** Giving ⟨ŋ⟩ a grapheme row TOOK
AWAY a reading the fold had been supplying: while the letter folded to ⟨n⟩ it reached the PRENASALISATION
rule, so ⟨ŋk⟩ read `ᵑk`, and with a row of its own it split into two segments. That is the same
one-phoneme-two-readings defect displaced to the pre-obstruent slot, so ⟨ŋ⟩ joined the prenasalisation
trigger too. Both engines carry both halves.

### FINDING 2 (#1132) — the ⟨ɡ⟩ (U+0261) entry in `prenasalisable` is a "defensive alias" that makes things worse

`luganda.jsonc` lists U+0261 LATIN SMALL LETTER SCRIPT G beside ASCII ⟨g⟩ in `prenasalisable`, commented as
"a defensive alias — Luganda text is written with ⟨g⟩". But there is no ⟨ɡ⟩ row in `graphemes`, and the
superscript choice in step 2 tests the ASCII string `"kg"`. So the alias fires the prenasal rule, picks the
WRONG PLACE, and then loses the consonant:

    "nɡa"  (U+0261) → "ⁿa"     — alias present: ⟨n⟩'s own reading gone, place wrong, ɡ dropped
    "nɡa"  without the alias  → "na"     — ⟨n⟩ kept, ɡ dropped
    "nga"  (ASCII)  → "ᵑɡa"    — correct

The alias is the only thing that turns a dropped letter into a corrupted syllable. It is **×0 in FLEURS, ×0
in the mined artifact and ×0 in the golden**, so it is latent, not live — but it is defence that defends
nothing and costs a phoneme when it fires. Either add the `ɡ` grapheme row and widen the `"kg"` test, or
delete the alias; both are TS-first.

### FINDING 3 (#1132) — the twelve prenasal digraph rows in the grapheme table are unreachable (documentation)

`luganda.jsonc` comments its grapheme block as *"Scanner sorts keys LENGTH DESC (nng'/nny/ng'/ny + Cw +
prenasal + vowel digraphs → singles)"*, but `OTHER_DIGRAPHS` in `luganda.ts` filters the length-2 keys down
to `k[1] === "w"` or vowel+vowel — which excludes every prenasal digraph by construction, deliberately and
with a comment saying so one screen up. Nothing else reads them.

Verified row by row that the code rule reproduces all twelve **byte-identically** (mb→ᵐb, mp→ᵐp, mf→ᵐf,
mv→ᵐv, nf→ᵐf, nv→ᵐv, nd→ⁿd, nt→ⁿt, nc→ⁿc, nj→ⁿɟ, nk→ᵑk, ng→ᵑɡ), so **no behaviour is at stake** — this is
PORTING.md question 2 ("is every table this file loads actually reached?") answered NO with no cost
attached. Worth recording because the next reader who edits one of those rows will change nothing and have
no way to find out.

## Verdict

    parity lg               200/200 byte-identical, 0 BLOCKED — first run; re-verified after the rebase
    parity fleet            135 languages, 26,627 rows, 0 differ  (unchanged — #1134 moved 0 golden rows)
    differential            8,976 comparisons (sync + async), 0 differ, 0 throws, 0 PortPending  [Run 5]
    dotnet test             2,592 passed, 0 failed  (+11 ŋ cases)
    leak sweep              0 of 4,488 outputs carry a digit or an unread symbol
    findings                3 — #1131 FIXED in #1134 and implemented here; #1132 (×2) still filed

The referee weakness is inherited from the bring-up and is unchanged by the port: epitran lug-Latn is the
only machine referee for lg and is itself rule-based, so the 99.1% is a fidelity measure. What the port adds
is that the two ENGINES agree over 4,442 lines of the language's own text — which is a different claim, and
the only one the gate can make.

## Run 5 — 2026-08-28 — rebase onto the #1131 fix, and the recount

**Question.** #1131 — this port's own Finding 1 — landed in the TypeScript as PR #1134 while the port was in
review. The port must now implement the FIXED behaviour, not the behaviour it filed. What moves?

    git rebase main          clean, no conflicts (the fix touches src/ + data/, the port touches csharp/)

**What the shared `data/` tree gives for free.** The fix's grapheme row (`"ŋ": "ŋ"`) lives in
`data/languages/luganda/luganda.jsonc`, which per PORTING.md is owned by no engine — so the C# picked it up
with no port change at all. Only the two CODE-side halves needed porting:

  * `NATIVE_CLASS` `"[a-z'’]"` → `"[a-zŋ'’]"`, or the nativiser still folds the letter before the new row
    can be reached;
  * the prenasalisation trigger `(c == 'n' || c == 'm')` → `(… || c == 'ŋ')`, the half #1131 did not
    anticipate (see Finding 1 above).

⚠ **A STALE `PAIRED-FIX PENDING`-SHAPED COMMENT WAS DELETED.** `Luganda.cs` carried "⚠ ŋ IS DELIBERATELY
ABSENT … Both engines do it; do not 'fix' it here." Every clause of that is now false, and PORTING.md is
explicit that a stale marker is a fork that documents itself as fidelity. The C# note is gone rather than
rewritten — the evidence lives in the TS and in this doc, which is where PORTING.md wants it.

**The recount.** Corpus rebuilt from source; ⚠ the original run's 166 hand-built probes were in `.probe/`,
which is gitignored and did not survive the session, so `probes.txt` here is a NEW 44-line set aimed at this
change (both spellings in every position, ŋ+obstruent, ŋŋ, casing, and foreign-letter folding). The mined
tier is also a superset of the original's 476 — this walker takes every string in the artifacts. So the line
count is not comparable to Run 2's 4,442 and is not presented as such.

    .probe/lg/all.txt = 4,488 unique lines
        3,749  FLEURS lg_ug, columns 3+4   (first line verified a SENTENCE, not a WAV filename)
          642  mined + attest
          128  the golden's own unique text
           44  probes aimed at #1131
    × sync AND async = 8,976 comparisons

    differential   8,976 comparisons, 0 differ, 0 throws, 0 PortPending
    leak sweep     0 of 4,488 C# outputs carry a digit or an unread `$ € £ % ² ³ °`
    parity lg      200/200, 0 BLOCKED
    parity fleet   135 languages, 26,627 rows, 0 differ   (unchanged: #1134 moved 0 golden rows)
    dotnet test    2,592 passed, 0 failed   (2,581 + 11 new ŋ cases)

**What fraction of the corpus exercised the new code** (PORTING.md's requirement, and the point of the whole
finding): **6 lines of the 4,519 corpus lines** — 2 FLEURS, 4 mined+attest, **0 golden** — counted
independently here and matching Finding 1's claim exactly. All six now read the velar in BOTH engines:

    Enceladus … mu ziseŋŋendo ezetoloola enjuba …
      TS  eːⁿceladus kje kiːⁿtu ekisiːᵑɡa okumulisa mu ziseŋːeːⁿdo ezetoloːla eː…
      C#  eːⁿceladus kje kiːⁿtu ekisiːᵑɡa okumulisa mu ziseŋːeːⁿdo ezetoloːla eː…

Across the 41 rows of `all.txt` whose INPUT carries a literal ⟨ŋ⟩, 0 differ.

⚠ **The honest limit of this recount, restated because it is the same one Run 2 had.** 6 of 4,519 corpus
lines exercise the changed code — 0.13%. The differential's 0-differ over 8,976 comparisons is overwhelmingly
a statement about the *unchanged* engine; it is the 44 probes and the 11 new xunit cases that actually cover
⟨ŋ⟩, and the golden covers it not at all. That is the same structural blindness #1131 was filed about, and
regenerating the golden does not remove it — `gen_parity_goldens.mts lg` still produces 0 rows carrying the
letter, because FLEURS lg_ug simply does not write it often.

## Run 6 — 2026-08-28 — #1132: the ⟨ɡ⟩ alias and the twelve dead rows

**Question.** #1132 leaves finding 1 with two coherent resolutions — make the U+0261 "defensive alias" work
(add a `"ɡ": "ɡ"` row and widen the ASCII `"kg"` place test), or delete it. Which does the evidence support?

### The alias has no input for which it helps

Both reproduce first:

    "nɡa" (U+0261)  → ⁿa       ⟨n⟩'s own reading gone, place wrong, ɡ dropped anyway
    "nga" (ASCII)   → ᵑɡa      correct
    dead rows       → 12       (the issue's count is right; ⟨ny⟩ and ⟨n'⟩ are reachable via SPECIAL,
                                not OTHER_DIGRAPHS, so a naive filter says 14)

Then measured EXHAUSTIVELY rather than argued: every 3-letter frame over the language's alphabet plus
U+0261, scanned twice — manifest as shipped, and with the alias removed.

    1,951 frames containing U+0261
      1,798 identical with and without the alias
        153 DIFFER — and 0 of the 153 favour the alias

Every one of the 153 has the same shape, and it is worse than the issue described:

    anɡ    alias → aːⁿ      no-alias → an

The alias does not merely pick the wrong place. It (a) replaces the nasal's own full segment with a
superscript, (b) picks the wrong place, (c) drops the ɡ regardless, and (d) **spuriously lengthens the
preceding vowel**, because the superscript it emits triggers the vowel-lengthening post-step. That fourth
effect is not in the issue text. **A defence with no input for which it helps is not a defence.**

### Why DELETE rather than wire it up

Neither resolution is distinguishable by corpus impact — U+0261 is ×0 in FLEURS `lg_ug`, ×0 in
`tools/corpus/mined/lg.jsonc`, ×0 in `tools/corpus/attest/lg.jsonc`, ×0 in the golden's input column
(re-counted here, matching the finding). So the tie-break has to be a principle, and two were available:

- Fleet convention: **there is none.** `grep "defensive alias"` returns exactly one hit in the repo — this
  one. Where U+0261 does occur fleet-wide it is inside an embedded IPA gloss in Wikipedia-derived text
  (`csharp/goldens/hil.tsv`: *"…sa lokal bilang [bɛˈniɡnɔʔ aˈkino]…"*), not as a language's orthography.
- Internal consistency: **Luganda's g2p drops every unknown letter** — it has no `latinPhone` fallback, so
  ⟨ɛ⟩, ⟨ð⟩, ⟨ø⟩ and the rest are all simply unread. Singling out U+0261 for rescue would be the one-off; a
  general "an unread letter still denotes a sound" policy is a different and much larger change.

⚠ **The honest residual: deletion does not make U+0261 READ, it makes it fail predictably instead of
corruptly.** `Buɡanda` (U+0261) now reads *buaːⁿda* — a whole consonant missing — where the ASCII spelling
reads *buɡaːⁿda*. That is the same degradation every other out-of-inventory letter gets here, which is the
point, but it is not a correct reading. If evidence ever turns up of Luganda text actually written with
U+0261, the other resolution in #1132 is still the right one and this entry is where to start.

### Finding 2 — the twelve rows are deleted, not annotated

`OTHER_DIGRAPHS` filters length-2 keys to `k[1] === "w"` or vowel+vowel, so ⟨mb mp mf mv nf nv nd nt nc nj
nk ng⟩ were unreachable BY CONSTRUCTION, while the block comment above them claimed the scanner tried them.
Deleted rather than re-commented, because the mapping they held is already stated once in
`convention.prenasal` and computed once in the code rule — PORTING.md's own argument that a second copy is
not a second witness but a copy that drifts. A test now pins that the code rule still produces all twelve
byte-identically, which is the property the rows were silently standing in for.

### Both halves are DATA-side, so the C# needed no code change

Both edits are in `data/languages/luganda/luganda.jsonc`, which PORTING.md says is owned by no engine.
Verified rather than assumed: no hardcoded digraph lookup exists in `Luganda.cs`, and the C# picked both
changes up through the shared tree.

    goldens        1 row changed FLEET-WIDE (hil), from the UNDECOMPOSABLE row; lg itself 0
    parity lg      200/200, 0 BLOCKED
    parity fleet   136 languages, 26,827 rows, 0 differ — re-closed over the regenerated goldens
    differential   4,496 lines × sync AND async = 8,992 comparisons, 0 differ, 0 throws, 0 PortPending
    leak sweep     0 of 4,496 C# outputs carry a digit or an unread symbol
    TS suite       5,683 passed        dotnet test  2,695 passed
    (rebased onto the rn port landing on main mid-review; the fleet numbers include Kirundi, and the
     UNDECOMPOSABLE row was re-checked against its new golden — rn does not move.)

⚠ Same limit as Run 5, and worse here: **U+0261 is ×0 in the corpus**, so 8 of the 8,992 comparisons are the
probes I added for it and the rest say nothing about this change. The 17 new xunit cases and the 2 new
vitest cases are the whole instrument. The 0-differ number is a statement that the change moved nothing it
should not have — not evidence that it moved what it should.

### Review addendum — the third resolution I did not weigh, now TAKEN (#1144)

Review on PR #1142 pointed out that the two resolutions #1132 offered are both LOCAL, and the fleet already
has the mechanism for exactly this class of character: `core/hostWord.ts`'s `UNDECOMPOSABLE` table, which
maps the letters NFD cannot decompose onto a base the g2ps do have rules for (ŋ→n, ɛ→e, ɔ→o, ə→e, ɓ→b…).
**It has no `ɡ → g` row.** I actually printed `foldLatinToBase("ɡ") === "ɡ"` in the very first probe of this
run and did not follow it up — the no-op fold was on screen and I read past it.

The consequence is not local at all:

    phonemize("ɡato",    "es")  → ˈato       vs  gato    → ɡˈato
    phonemize("ɡut",     "de")  → uːt        vs  gut     → ɡuːt
    phonemize("luɡanda", "lg")  → luaːⁿda    vs  luganda → luɡaːⁿda

A whole consonant deleted, in three unrelated languages. And the input is not exotic: U+0261 is the IPA
voiced velar stop, Wikipedia-derived text is full of inline pronunciation glosses, 11 corpus artifacts carry
it, and `csharp/goldens/hil.tsv` already ships a row whose INPUT contains one.

**Taken in this PR** rather than filed — a `ɡ: "g", Ɡ: "G"` row in `UNDECOMPOSABLE`, in both engines. It was
first filed as #1144 and then fixed inline instead, on the direction that this work was proliferating issues
rather than closing them.

⚠ **Checked BEFORE adding the row, because a fold that fires where a g2p had a rule is #1140's defect in
reverse:** across every language declaring a `NATIVE_CLASS`, U+0261 is **never** an orthographic input key in
any grapheme/consonant/letters/digraphs table. So the fold cannot take a reading away from a g2p that had
one. (The 20-odd manifests that carry U+0261 as a key are keyed on the IPA side, which the input fold never
touches.)

Blast radius, measured rather than assumed: **1 golden row in the fleet**, `csharp/goldens/hil.tsv`, and the
change is a dropped consonant restored inside an IPA gloss:

    nˈino  →  nˈiɡno        ("…sa lokal bilang [bɛˈniɡnɔʔ aˈkino]…")

⚠ **This does not change #1132's verdict, it sharpens it.** Deleting the alias was still right, and the two
changes COMPOSE: with the fold in place U+0261 becomes ASCII ⟨g⟩ before the g2p sees it, so no ⟨ɡ⟩ entry in
`prenasalisable` is wanted at all. Wiring the alias up — the resolution I rejected — would have been actively
in the fold's way. Deleting the alias alone would have left the letter unread; the fold alone would have left
a corrupting alias in the table.

⚠ The two tests that pinned `nɡa → na` were REWRITTEN, not deleted, exactly as their annotations said: they
now assert U+0261 reads *identically to the ASCII spelling* in both engines, so neither half can regress
silently. `nɡa` → *ᵑɡa*, `anɡ` → *aːᵑɡ*, `nɡwadde` → *ᵑɡʷadːe* (prenasal + labialisation both preserved).

### Four smaller review findings, all fixed in the PR

  * `manifest.ts` and `Manifest.cs` still described the grapheme table as holding "prenasalised units" and the
    scan as trying "the Cw + prenasal digraphs" — **stale comments of exactly the class #1132 removes**, left
    behind by my own deletion. Fixed in both engines, along with two `⟨n m⟩` prenasal docstrings that #1131
    had already made `⟨n m ŋ⟩`.
  * The new jsonc comment claimed the deleted mapping "is stated once, in `convention.prenasal`" — but that
    string listed TEN pairs, not twelve: ⟨mf⟩ and ⟨mv⟩ were absent, so two of the twelve were left stated
    NOWHERE. The guarantee was false as written. Fixed by completing the string.
  * "the 1,951 three-letter frames" was not reproducible without naming the alphabet it ranged over (a
    reviewer re-running it over the manifest's own 27 single-letter keys got 2,269 frames / 165 differing —
    same conclusion, different number). The alphabet is now named: ASCII a–z with ⟨g⟩ replaced by U+0261,
    26³ − 25³ = 1,951.
  * `csharp/STATUS.md` still listed both #1132 items as open findings, so an auditor would have re-filed them.
