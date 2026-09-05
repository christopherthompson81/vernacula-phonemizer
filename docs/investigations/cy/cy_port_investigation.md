# Welsh (cy) TS → C# port — review log

⚠ **SCOPE.** This records the REVIEW of the Welsh port (PR #1242) and the measurements taken during it —
not the port itself, which was written in a separate session that left no log.

## Run 1 — 2026-08-31 — the U+FEFF deletion

**Question.** Do the ~40 normalizer regexes and the g2p scan match the TypeScript?

**Finding — one defect, and it is a two-layer trap.** `Normalize.cs:302`, the RANGE rule, captured the
optional whitespace **inside** group 3 (`(\s?(?:km|kg|mm|cm|m)…)?`) and then trimmed it with a bare
`.Trim()`:

- `JsRegex`'s `\s` is the **ECMAScript** WhiteSpace set, which includes **U+FEFF**;
- .NET's `string.Trim()` does **not** strip U+FEFF — it is `Cf`, not `Zs`.

So `3-4﻿km` left the lookup key as `"﻿km"`, missed `UNIT_WORD`, and the miss branch returned
`""` — **deleting the unit from the reading** while the TypeScript still said *cilometr*:

    Mae 3-4<U+FEFF>km o iâ.
      TS   mˈaᶤ trˈiː ˈiː bˈɛdwar kilˈɔmɛtr ˈoː jˈaː .
      C#   mˈaᶤ trˈiː ˈiː bˈɛdwar             ˈoː jˈaː .

`Core/Js.cs` documents `Js.Trim` as the mandatory replacement for exactly this. Fixed, and the miss
branch now **refuses the whole match** (`return m.Value`) rather than dropping the unit — which is what
the sibling `DECIMAL_UNIT` rule twenty lines below already did. That inconsistency is what turned a wrong
reading into a missing word (trap 53: a table of READINGS refuses; a table of rewrites falls back).

**Verified against the TypeScript, not just asserted.** Probes through `normalizeWelsh` and
`phonemize(_, "cy")` on both engines over `3-4<U+FEFF>km`, `3-4 km`, `3-4km`, `3-4<NBSP>km`,
`3-4<THIN>kg`, and the unknown-unit forms `3-4<U+FEFF>zz` / `3-4 zz`: **identical on all seven**, and the
behaviour is now right — the U+FEFF case reads *cilometr*, and an unknown unit is refused rather than
having its text deleted.

Two smaller items in the same file: `Soften` rebuilt its `SOFT` dictionary on every call (hoisted), and
`LegalCodas` had dropped one of the TS's two duplicate entries while keeping the other (restored, so the
two files diff mechanically).

## Run 2 — 2026-08-31 — the rebase, and a test that could no longer be repointed

The branch predated the Slovak and Western Armenian merges. Rebasing produced one conflict, in
`LanguageBootstrapTests.UnportedLanguageIsReportedRatherThanGuessedAt` — and **neither side could
stand**: the branch still named `hyw` (ported since), and `main` named `cy`, which is what this PR ports.

⚠ **WELSH WAS THE LAST UNPORTED LANGUAGE, so the test could not be repointed at all.**

    193 codes routed by Registry.cs · 193 ported · 0 UNPORTED

The state the test asserts — a routed code whose engine has no factory — is no longer reachable through
the public API. Two things had to be checked rather than assumed before rewriting it:

- `Registry.GetPhonemizer("zzz")` is **not** a substitute. An unrouted code hits the switch's `default:`
  and throws **`ArgumentException`**, never reaching `Create`, so it exercises the other branch and
  leaves `PortPending` — the half the parity gate actually reads — untested.
- `Create(key)` is where both halves live: it throws `NotImplementedException($"port pending: {key}")`
  **and** records the key. It was `private`.

Rewritten against a **synthetic key** through `Create`, which exercises the real invariant (named
exception + `PortPending` record) without needing a language to be left unported. That required
`Create` to become `internal` plus an `InternalsVisibleTo` for the test assembly — both commented at the
site with the reason, since a visibility widening with no stated cause is the kind of thing a later
reader deletes.

## Run 3 — 2026-08-31 — the gates, after the rebase

    $ dotnet run --project csharp/tools/parity -- cy              → cy OK 200 rows · 0 differ
    $ … -- cy --poison       → 0 sites (SUBSTRING 0, desync 0)
    $ … -- cy --provenance   → tokens 5323/5323 (100.0%)
    $ … -- cy --ipaspans     → 4905/4905 (100.0%) · 0 wrong
    $ npx tsx tools/seam-parity.mts --all | grep '^  welsh '
      welsh   47   47   0   3   3
    $ dotnet run --project csharp/tools/parity                    → 189 languages, 36,495 rows, 0 differ
    $ dotnet test                                                 → 6,471/6,471

`seam-parity` also now reports **0 not yet ported to C#** — the first time that line has read zero.

**THE FLEET IS COMPLETE: 193 of 193 routed codes have a C# engine.**
