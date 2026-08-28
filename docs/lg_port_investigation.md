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

Three findings. All are reproduced IDENTICALLY by both engines, so all three are FILED rather than fixed
here (PORTING.md: the fix lands in the TypeScript first, with a test and regenerated goldens).

### FINDING 1 (#1131) — ⟨ŋ⟩ does not "drop outright"; the shipped path folds it to ⟨n⟩ and speaks an alveolar

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

    parity lg               200/200 byte-identical, 0 BLOCKED — first run
    parity fleet            135 languages, 26,627 rows, 0 differ
    differential            8,884 comparisons (sync + async), 0 differ, 0 throws
    dotnet test             2,581 passed, 0 failed
    leak sweep              0 of 4,442 outputs carry a digit or an unread symbol
    findings                3, all reproduced identically by both engines → FILED (#1131, #1132)

The referee weakness is inherited from the bring-up and is unchanged by the port: epitran lug-Latn is the
only machine referee for lg and is itself rule-based, so the 99.1% is a fidelity measure. What the port adds
is that the two ENGINES agree over 4,442 lines of the language's own text — which is a different claim, and
the only one the gate can make.
