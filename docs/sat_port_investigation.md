# Santali (sat) — C# port

757 TS lines across three modules mirrored 1:1 into `Languages/Santali/`. Santali is Munda
(Austroasiatic), ~7.6M speakers, written in OL CHIKI (U+1C50–1C7F) — a distinct ALPHABET, not an
abugida, which is why every sign in the block is `\p{L}` and nothing decomposes.

## Run 1 — 2026-08-31 14:02 — scope, and what makes this port hard

The difficulty is in two places, and neither is the letter table:

- **The sign machinery** (`santali.ts`). Six signs MODIFY a neighbouring segment rather than carrying a
  phone: ⟨ᱷ OH⟩ aspirates the preceding stop or is [h]; ⟨ᱹ GAAHLAA⟩ substitutes the preceding vowel;
  ⟨ᱸ MU⟩ nasalizes it and ⟨ᱺ MU-GAHLA⟩ ALSO lowers it first; ⟨ᱻ RELAA⟩ lengthens it; ⟨ᱼ PHAARKAA⟩ checks
  the preceding stop; ⟨ᱽ AHAD⟩ marks it plain and BLOCKS the hallmark word-final checking rule.
  Every one reads the last EMITTED segment, so they compose in loop order.
- **The normalizer** (467 TS lines), which for this language is not mainly a number layer: sat.wikipedia
  types ⟨ᱹ GAAHLAA⟩ as an ASCII PERIOD (246×) and ⟨ᱼ PHAARKAA⟩ as an ASCII HYPHEN (99×), and each dot
  splits its word, inserts a clause pause AND leaves the vowel unmodified.

Artifacts present: a 200-row golden, `tools/corpus/mined/sat.jsonc`, `tools/corpus/attest/sat.jsonc`
and `sat.kaikki-santali.tsv`. So unlike naq/smj this port has a real gate from the start.

## Run 2 — 2026-08-31 14:20 — the port, and the one place the C# cannot be written naively

`phonemizeWord` reads `segs[segs.length - 1]` at six sites. ⚠ In JS that is `undefined` on an empty
list and every branch depends on it — a word that OPENS with a sign has nothing to modify and the sign
is consumed silently. `segs[^1]` THROWS instead, which is exactly the crash the Nogai review had just
found (PR #1233: every word beginning with ⟨в⟩ died with `ArgumentOutOfRangeException`). Modelled once
as a nullable local accessor rather than guarded six times:

```csharp
string? Last() => segs.Count > 0 ? segs[^1] : null;
```

Everything else is the fleet's own idiom: `Js.CodePoints` for the `[...s]` spreads, `Js.Normalize` for
both NFC passes and the NFD vowel test, `Js.Number`/`Js.NumberToString` at the number seam, and the
shared `NormalizeSymbols` tier for step 10 (percent, currency, units, ²), which Santali can use
unchanged because everything it declares is POSTPOSED.

**First parity run: 200/200 byte-identical.**

## Run 3 — 2026-08-31 14:31 — the walks, because a 200-row golden is narrow

The Nogai crash passed 68/68 parity, three seam gates and 5,840 tests, so the golden is a floor rather
than an argument. Exhaustive where the space is finite:

| walk | rows | differ |
|---|---|---|
| Ol Chiki word walk — every letter+sign alone and **every ordered PAIR** over the 37-character alphabet, every LETTER × every ordered SIGN PAIR (the sign-interaction space), every sign pair word-INITIAL (the crash class), the voiced-stop finals with and without ⟨ᱽ AHAD⟩, and the multi-word split path | 3,576 | 0 |
| corpus — mined + attest + kaikki referee + golden, on `norm`/`word`/`text` | 1,798 ×3 | 0 |
| numbers — 0…150,000 exhaustive, ±1,200 around **every Indian-grouping seam** (10², 10³, 10⁵, 10⁷, 10⁹, 10¹¹) plus 2³¹/2⁵³, 70k random below 2⁵³, 20k above, non-finite, astral, lone surrogate | 252,158 | 0 |
| `ReadDigits` as its own entry point, including Ol Chiki digits ᱐-᱙ | 8,376 | 0 |
| normalizer adversarial + fuzz — every documented step's instances and its refusals, 35k random Ol-Chiki/sign/digit/astral/invisible strings, on `norm`/`word`/`text` | 27,868 ×3 | 0 |

## Run 4 — 2026-08-31 14:44 — a golden-swap widening, and TWO harness defects in it

Generated a 33,241-row TS-sourced reference and swapped it in. Parity reported **50 rows differ**, all
inside ENGLISH runs (`pʰˈʌ` against `p`).

⚠ Both causes were mine, and the second is the instructive one.

1. My generator did not call `clearForeignOov()`. The repo's own generator does, with a warning that the
   memo is GLOBAL and leaks between rows. Measured: adding it changed nothing here — so this was a real
   omission that happened not to matter, which is worth separating from the cause that did.
2. ⚠ My generator called the SYNC `phonemize`. `csharp/tools/parity/Program.cs` says so on its **third
   line** — "THE GOLDENS ARE ASYNC-MODE OUTPUT. tools/gen_parity_goldens.mts calls phonemizeAsync" — and
   the sync path's fallback disagrees with the async reader on an English OOV word. My reference was
   therefore not a valid golden, and the 50 rows were the two entry points differing, not the engines.

The independent check that located it before any theorising: re-running the C# probe against the same
file gave **0 differ**, so the disagreement was between two C# invocations rather than between C# and
TS. Regenerated with `phonemizeAsync`:

```
parity       33,241 rows ok, 0 differ
provenance   133,051/133,051 tokens (100.0%)
ipaspans     103,020/103,020, 0 spans that do not cover what the token emitted
poison       0 SUBSTRING, 0 desync
```

Golden restored afterwards as its own command and verified byte-identical to the committed 200 rows.

## Run 5 — 2026-08-31 14:52 — the leak sweep, which lied twice before it was right

First sweep over the Ol-Chiki-only rows reported **897 strays, 7 distinct** — `ə ɛ ã ẽ ĩ õ ũ`. All seven
are legitimate engine output and the instrument was wrong twice:

- `ə` and `ɛ` come from the `gahla` table, which is written on ONE line in the JSONC; my block-anchored
  regex expected `\n    }` and skipped it entirely.
- `ã ẽ ĩ õ ũ` are what the ⟨ᱸ MU⟩ branch emits — `NFC(vowel + combining tilde)` — so the precomposed
  forms never appear in any table.

Rebuilt from every `"k": "v"` pair in the file plus the NFC closure of the tilde, with a planted `ħ`:
**0 strays, 0 distinct**, probe fires. Recorded because "897 strays" would have read as a serious leak
and was purely a mis-specified inventory.

## Gates

```
dotnet test        5,966 passed, 0 failed (64 Santali)
parity -- sat      200/200 byte-identical
parity (full)      181 languages byte-identical, 0 differ (34,895 rows)   [was 180]
seam gates         provenance 7,566/7,566 · ipaspans 6,870/6,870 · poison 0
  widened          provenance 133,051 · ipaspans 103,020 · poison 0 over 33,241 rows
TS suite           290 files / 5,746 tests (untouched side)
```

Test-case pair diff against `test/santali.test.ts`: **57 TS pairs, 57 with a C# twin, 0 missing** (C#
adds 12 through Theory expansion). No duplicate `InlineData`. Culture sweep: `Js.Normalize` at all four
normalization sites and no raw `.Normalize` anywhere, no `ToLowerInvariant`, no `Parse`, no ordering.

## Standing

Nothing outstanding. Two things worth carrying forward for the next port's harness:

1. ⚠ **A hand-rolled golden must call `phonemizeAsync`, not `phonemize`** — the parity tool states this
   on line 3 and it cost this run a false 50-row "difference".
2. ⚠ **A leak sweep's inventory must be built from the manifest's pairs, not from block-anchored
   regexes**, and must include what the CODE composes (here the NFC nasal vowels) as well as what the
   tables list.
