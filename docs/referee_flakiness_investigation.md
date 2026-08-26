# A non-reproducing failure in `test/referee-eval.test.ts`

Two agents in the pcm/tl/wuu/bho and ne/awa/mai/hne batches independently reported a full-`vitest` run
failing in the referee suite, which did not reproduce on subsequent runs. `mai` saw 1 failure and could
not identify it; `hne` saw 2 and described the suite as timing-sensitive. Both were running with three
other agents active, each doing `dotnet build`/`dotnet test` concurrently.

Two independent reports of the same suite is corroboration, not noise, so it is worth a look. **I did not
reproduce it**, and what follows is one hypothesis disproven and one left standing.

## Run 1 — 2026-08-26

**Not the collected-file-set hazard.** `vitest.config.ts` already scopes `include` to `test/**/*.test.ts`
precisely because agent worktrees land inside the checkout and the default recursive glob collects their
copies too. Its own comment records a run that reported three phantom failures from
`.claude/worktrees/agent-…/test/languageCatalogue.test.ts`. That is fixed, and it only ever affected the
PARENT of a fan-out — an agent inside its own worktree has no nested `.claude/`. Ruled out.

**Timings, idle-ish machine, 171 tests:**

    en   3,574 ms      ← slowest by 2.3x
    ar   1,534 ms
    ajp  1,411 ms
    acw  1,266 ms
    ary  1,228 ms
    everything else < 500 ms

The per-test timeout is **30,000 ms**, so `en` has ~8x headroom when nothing else is running. Four
concurrent agents each running `dotnet build` and their own probe harnesses is exactly the condition that
eats 8x, and it is the condition both reports were made under.

## The hypothesis I disproved, because it looked better than it was

`src/core/foreign.ts`'s memo is global and survives across languages. Its own docstring says clearing it
is "not an optimisation — it is what makes their output REPRODUCIBLE", and names the failure mode: a
mixed-script language's prewarm leaves a BiLSTM reading behind and a Latin-script language rendered
afterwards picks it up through the foreign reader, producing "a row that depends on what ran before it".
`tools/gen_parity_goldens.mts` clears it per language for that reason and is the ONLY caller.

The referee eval renders **171 languages in one process** and never clears it — so on paper it is exactly
the batch tool the warning describes, and a score that depends on execution order would explain an
intermittent failure neatly.

**Measured, and it does not happen.** Evaluating a language alone versus after a full `en` evaluation
(which prewarms the BiLSTM):

    mi   alone 1005/1005 = 100.000%      after en 1005/1005 = 100.000%
    vi   alone 1970/2727 =  72.241%      after en 1970/2727 =  72.241%
    tl   alone 3615/4198 =  86.112%      after en 3615/4198 =  86.112%

`tl` was chosen because it code-switches with English heavily and is the likeliest to route a run through
the foreign reader. Byte-identical. The referee backbone does not reach the memoised path, so this is a
real hazard in general and NOT the cause here.

## What was changed, and what it does not claim

The per-test timeout is raised 30s → 120s. It is a HANG GUARD, not a performance assertion — nothing about
the suite's meaning depends on 30 rather than 120, a genuine hang is still caught, and the cost of a false
failure here is high: a floor suite that cries wolf is one a reader stops believing, which is the opposite
of what these 171 floors exist for.

⚠ **This is a mitigation for the most plausible mechanism, not a confirmed fix.** I did not reproduce the
failure, so I cannot say the reports were timeouts rather than something else. If it recurs, the next
thing to check is whether `it.skipIf(lang === "ckb" && !haveCkbModel)` is flipping between runs —
`onnxruntime-node` is an OPTIONAL dependency, so a concurrent `npm` operation could change its
resolvability mid-session, and that would change which tests run.
