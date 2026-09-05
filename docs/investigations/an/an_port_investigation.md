# Aragonese (an) — C# port investigation

Chronological log of the runs behind the an port.

## Run 1 — 2026-08-29 ~08:40 — scope

    wc -l src/languages/aragonese/*.ts data/languages/aragonese/aragonese.jsonc
        192 aragonese.ts · 187 normalize.ts · 77 numbers.ts · 65 aragonese.jsonc

No shared-core change was needed: `Clauses`, `LatinPhones`, `HostWord`, `Ipa` (`IPA_VOWEL`),
`NormalizeSymbols` (the full symbol tier, including `RateDenominators`, `UnitPer`, `MagnitudeConnective`
and `ExponentWords`), `LoadManifest`, `Boundaries` (`NOT_LETTER_BEFORE`) and `JsRegex` are all ported,
and `Registry.cs` already routes `case "an": return Create("aragonese")` — only the factory was missing.
`csharp/goldens/an.tsv` (200 rows) exists, so the parity gate applies from the first run.

The g2p is a shallow greedy scan over the five two-letter digraphs (`ny ll ch tz rr`) then the single
graphemes, with the code-owned rules in between: the `qu/gu(ü)` cluster (⟨u⟩ silent before a front vowel,
`kw/ɡw` before a back), the `c/g` softening (the distinción: `c+e/i→θ`, `g+e/i→x`), the rising glides
(`i→j`, `u→w` before a vowel), `y` (onset `ʝ` / coda `i`), word-initial `r` trill, and the WORD-FINAL
`-r` APOCOPE (a final tap after a vowel is dropped — the categorical Aragonese trait). Numbers are decimal
and keep their own composer: the twenties FUSE (`vintiun`) while 30–90 take the `⟨y⟩` connector, and 16–19
are the analytic `deci-` series.

The normalizer is the load-bearing half and is a re-measurement of the Asturian round (trap 55): the DOT
groups and the COMMA decimates, the DOT also decimates under 3 digits, the SPACE groups too, the era
marker, three abbreviations (`nº`, `lum.`, `hab.`) plus `m.a.`, the clock (which must DECLINE the
athletics stopwatch and the DMS coordinate), the minus (which must not claim the list separator), the
degrees (BOTH `°`/`º` codepoints against one allow-list, the compass set `NSEU` not `NSEW`), and the
ranges (guarded off citations).

⚠ **THE SEPARATOR CLASSES WERE AUDITED BEFORE THE FIRST RUN** (the nso lesson): every separator class is
a regex literal in the TS (`[ \u00a0\u202f\u2009]` in the SPACE_GROUP pattern and its replacement), so the
escapes carry through verbatim; no class relies on `\s` for a space. The symbol tier is INLINE in the TS
`makeSymbolNormalizer({...})` (not yet lifted to the manifest — that is a fleet-wide batch decision, see
`docs/manifest_lifting_survey.md`), so `Aragonese.cs` builds `SymbolData` inline, mirroring the Croatian
and other not-yet-lifted ports rather than reading a `symbolTier` key.

## Run 2 — 2026-08-29 ~08:55 — first test run: 53/53

    dotnet build csharp/Vernacula.Phonemizer            clean (one pre-existing Marathi warning)
    dotnet test --filter "FullyQualifiedName~Aragonese"  53/53

No failures. The one typo caught by the LSP before any run (a `JsR` for `JsRe`) was fixed at write time.
The ported tests pin the hallmark digraphs, the distinción, the final-r apocope, the fused twenties and
`⟨y⟩`-connector numerals, the decimal-comma fraction, and every normalize arm including the swapped
`°`/`º` allow-list, the clock's stopwatch refusals, the minus's list-separator refusal, and the
citation-guarded ranges.

## Run 3 — 2026-08-29 ~08:58 — parity gate: 200/200 byte-identical

    dotnet run --project csharp/tools/parity -- an     an  OK  200 rows

Parity is byte-identical on all 200 rows on the FIRST run. The golden (mined `an.wikipedia` prose)
exercises the grouped/decimal figures, the degree+scale and compass rows, the era marker, the currency in
both orders, the rate `hab/km²`, the exponent `km²`, and the percent postposition.

## Run 4 — 2026-08-29 ~09:00 — corpus differential + probes: 573 rows, 0 differ

an has NO FLEURS transcript (checked, not assumed), so the corpus-wide differential runs over the MINED
corpus `tools/corpus/mined/an.jsonc` — 248 `hard` + 200 `sample` = 447 unique texts — which the 200-row
golden is a SUBSET of (all 200 golden lines occur in the mined set), so the mined run subsumes the gate.
126 hand-built adversarial probes (one per normalize arm plus its refusal, plus the g2p corners the corpus
does not contain: the `qu/gü` front/back split, `y` onset vs coda, `ü/ï` folds, the out-of-2⁵³
digit-by-digit numeral) bring the haystack to **573 rows**.

    npx tsx .probe/an/ts-run.mts .        lines 573 throws 0 sync==async: true
    dotnet run --project .probe/an/cs -- .  lines 573 throws 0 sync==async: True  PortPending: (none)
    diff ts-sync cs-sync                  IDENTICAL
    diff ts-async cs-async                IDENTICAL

**573 comparisons sync AND async, 0 differ, 0 throws**, no row blocked on an unported dependency
(`PortPending` empty — the script router reached for nothing an does not have). Leak sweep over the 573
async outputs: **0 carry a raw ASCII digit** and **0 carry a should-never symbol** (`° ² ³ % $ € £ ± − –
— & ′`); the broad "symbol" counter's hits are all legitimate IPA pause marks (`.` `:` `·`) and phones.

Probe spot-checks confirm the readings the corpus does not pin: `o 57° país mas gran` leaves the ordinal
UNREAD (the sign is not spoken as a degree — the trap-56 behaviour); `37 °F` → *… ɡɾaus faɐeneit*;
`US$185 billons` → *… biʎons de dolaɾs estausunidenses* (the magnitude connective and the `US$` unit both
fire); `99999999999999999999` (above 2⁵³) reads digit-by-digit while `999999999999` (10¹²−1) composes
fully; `güela` → *ɡwela* (`ü` before a back vowel keeps the `w`), `ayer` → *aʝe* (the `y` is the onset and
the final `r` drops).

## Run 5 — 2026-08-29 ~09:02 — full suite + full gate

    dotnet test (full suite)                 2881 passed, 0 failed
    dotnet run --project csharp/tools/parity  139 languages byte-identical, 0 differ (27427 rows ok)

`an` is the 139th gated language; nothing moved in the other 138. `ManifestMappingTests` gained
`AragoneseManifestIsFullyMapped` — every key in `aragonese.jsonc` is consumed by the C# type, so no
`metadataOnly` exclusion was needed.

## Read for correctness — filed, not fixed

- **`coma` is a bare literal where 35+ languages carry it as manifest data.** The TS number branch emits
  `phonemizeWord("coma")` by hand; the sibling manifests (ast, af, …) declare a `decimalWord` key and read
  it off `DEF`. Aragonese is one of the "four that passed the word as a bare literal" the Asturian jsonc
  names. This is a data-placement inconsistency, not a behavioural one — the reading is identical either
  way, so the port mirrors the TS (literal) rather than quietly lifting data. It belongs to the same
  fleet-wide lift decision as the symbol tier, not to this port.
