# The ungated codes — why seven languages had no gate, and what closing it cost

Opened 2026-08-31 after a review of PR #1231 (naq) found that `parity`, `--provenance`, `--ipaspans`
and `--poison` all skip a language with no golden, so naq shipped with no seam gate having ever run
against it — and the fleet count did not move when the port landed, so nothing said so.

## Run 1 — 2026-08-31 12:41 — the seven are not one problem

`ls csharp/goldens` against the registry's own `case` labels: 192 codes, 186 goldens, 7 without —
`bgc mto naq nog pbt smj zsm`. Tabulating what each actually is:

| code | module | ported to C#? | text source in repo |
| --- | --- | --- | --- |
| bgc | hindi | yes (as `hi`) | — |
| zsm | malay | yes (as `ms`) | — |
| pbt | pashto | yes (as `ps`) | `data/languages/pashto/*.tsv` |
| mto | totontepecmixe | **no** | `mto.asjp-swadesh.tsv` |
| nog | nogai | **no** | `nog.asjp-swadesh.tsv` |
| naq | nama | yes | `naq.wiktionary-khoekhoe.tsv` |
| smj | lulesami | yes | `smj.asjp-swadesh.tsv` |

Three are **aliases**: `case "bgc"` and `case "hi"` are the same line, `return Create("hindi")`, with no
code-specific parameterisation, and `hi`/`ms`/`ps` each already have a 200-row golden. Verified rather
than read — 9 probes through each pair, **0 differ**. The engine is gated; the alias adds no code path.

Two are **unported** (`mto`, `nog`): there is no C# engine to gate.

So the real gap is **two languages**, `naq` and `smj` — both ported, both with a word list sitting in
the tree the whole time. `tools/gen_parity_goldens.mts`'s third ("lexicon") tier scans
`data/languages/<dir>/*.tsv`; their lists live under `tools/referee-eval/referees/`, which it never
looked at.

## Run 2 — 2026-08-31 12:52 — the obvious fix, and the 16 goldens it grew

Extended `lexiconWords` to fall back to `tools/referee-eval/referees/<code>.*.tsv` (same
`headword \t ipa` shape, same `#`-comment convention). Regenerated:

```
16 goldens MODIFIED, 3 new (naq, nog, smj)
```

⚠ The 16 were not rewritten, they were **appended to** — `ak.tsv` gained 20 rows, and so on. The
generator uses `lexiconWords` twice: once as the `thin` fallback for a language with no rows, and once
to **top up** a mined-tier golden toward 200 rows. Feeding the referee tier into the top-up changes the
gates of 16 languages that were already fine, which is a different decision from closing an ungated
one. Restricted the referee tier to the `thin` path.

## Run 3 — 2026-08-31 12:58 — restricted, and still 12 goldens changed

Same regeneration, now `thin`-only: **12 modified**, and this time they were LOSSES — `quc` down 48
rows, `acm` down 92, `grc` fully rewritten.

Ran the control before theorising: `git stash` the generator change, regenerate with the unmodified
tool.

```
100 FLEURS + 68 mined + 1 lexicon-only; 24 EMPTY: … es-419 acm afb ayl ajp acw pt-BR quc rkt bho grc …
0 goldens changed
```

⚠ **That is the whole explanation, and it is a property of the generator rather than of my change.**
The rich sources are not always present in a working copy — the FLEURS alignment ledger is a 337 MB
artifact — so for ~24 codes the generator produces NOTHING and skips them, leaving their committed
goldens untouched. That skip is the safety. The referee tier converts "nothing" into "something thin",
and the thin file then overwrites the good one.

A generator that silently downgrades a committed reference whenever a data file is missing locally is a
worse defect than the one being fixed. Guarded: the referee tier is offered only when
`csharp/goldens/<code>.tsv` does not already exist.

## Run 4 — 2026-08-31 13:06 — the result

```
0 goldens modified · 3 new: naq.tsv (45 rows), smj.tsv (43), nog.tsv (24)
```

| gate | naq | smj |
| --- | --- | --- |
| parity | 45/45, 0 differ | 43/43, 0 differ |
| provenance | 45/45 tokens (100%) | 43/43 (100%) |
| ipaspans | 45/45, 0 wrong | 43/43, 0 wrong |
| poison | 0 sites | 0 sites |

Fleet parity **177 → 179 languages** (34,627 rows). These are thin goldens — headwords, not running
text — which pins the g2p and not normalization; that is the tier's documented trade ("thinner but
real"), and it is the difference between a thin gate and no gate.

`nog` gets a golden without a C# engine, and that is the repo's normal state rather than a mistake:
`LanguageInitializationTests` reads the goldens directory precisely so "a newly ported language is
covered the day it lands", and treats `NotImplementedException` as the registry's deliberate report.
`parity -- nog` reports 0 languages and skips. The gate is pre-positioned.

C# suite 5,870 → 5,877: +6 from the three new goldens entering `LanguageInitializationTests`'s two
theories, +1 from the Maltese pin below.

## Standing

- **Closed:** naq and smj are gated, by four gates each.
- **Not a gap:** bgc, zsm, pbt — aliases of already-gated engines.
- **Open by construction:** mto and nog cannot be gated until they have C# engines. `nog` now has its
  golden waiting; `mto` produced none (its ASJP list yields under the 20-row floor).
- ⚠ **Worth knowing:** running `gen_parity_goldens.mts` without the FLEURS ledger present yields
  nothing for ~24 codes. It skips them safely, but anyone adding a tier to that tool should re-run the
  Run 3 control before trusting a diff.
