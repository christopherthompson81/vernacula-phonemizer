# Thread safety in the C# port

A log of places where a TypeScript construct was ported faithfully and became unsafe, because JS is
single-threaded and C# is not. The recurring shape: a MEMO.

## Run 1 — 2026-09-22 16:20 — `HanDictIpa.MaxWordFor` throws from `Phonemize()`

**How it surfaced.** A full `dotnet test` failed once in three runs, on
`GroupingSpaceTests.EverySpaceCharacterGroupsAlike(lang: "gan")`:

```
System.ArgumentException : An item with the same key has already been added.
   at System.Runtime.CompilerServices.ConditionalWeakTable`2.Add(TKey key, TValue value)
   at Vernacula.Phonemizer.Core.HanDictIpa.MaxWordFor(...)   HanDictIpa.cs:163
   at Vernacula.Phonemizer.Core.HanDictIpa.Engine.Text(String input)  HanDictIpa.cs:187
```

⚠ **NOT A FLAKY TEST — A FLAKY ENGINE.** The stack goes through `Engine.Text`, so the throw is on the
shipped path. A test that fails one run in three is easy to re-run and move past; this one was reporting
a real defect in `Phonemize()`.

**Cause: check-then-act.**

```csharp
if (MAX_WORD_CACHE.TryGetValue(dict, out var cached)) return (int)cached;
var m = 0;
foreach (var k in dict.Keys) m = Math.Max(m, Js.CodePoints(k).Count());
MAX_WORD_CACHE.Add(dict, m);          // throws if another thread got here first
```

`ConditionalWeakTable.Add` is documented to throw on a duplicate key. `GetValue(key, factory)` is the
non-throwing form; its factory may run more than once under contention, which is harmless here because
the value is a pure function of the dictionary and only one result is published.

⚠ **IT IS REACHABLE ON THE FIRST CONCURRENT CALL**, which is the production shape and not an exotic one:
a cold memo means every thread misses at once. Measured with 32 threads against a fresh engine —
**16 threw on the first attempt**, and none on any attempt after, because the memo was then warm.

⚠ **AND IT IS PORT-INTRODUCED.** The TypeScript memoises with a `WeakMap`, and JS is single-threaded, so
the hazard does not exist there. The comment recording that correspondence — *"TS uses a WeakMap"* —
said nothing about thread-safety, which is exactly where this lands: a faithful translation of a
construct whose safety came from the source language's execution model rather than from its shape.

### The sweep

Every `ConditionalWeakTable` and shared-static memo in the C# engine:

| site | shape | verdict |
|---|---|---|
| `Core/HanDictIpa.cs` `MAX_WORD_CACHE` | `TryGetValue` → compute → `Add` | ⚠ **throws** — fixed |
| `Languages/Hakka/Pfs.cs` `INDEX` | `TryGetValue` → `GetValue(factory)` | safe already |
| `Registry.cs` `Cache`/`Engines` | inside `lock (Gate)` | safe |
| `Registry.cs` `PortPendingRequested` | inside `lock` | safe |
| ~20 `??=` lazy loads (Wu, Xiang, Telugu, Romanian, Vietnamese …) | reference assignment | **a different class** |

⚠ **THE `??=` SITES ARE NOT THE SAME BUG, and saying so precisely matters.** A racing `??=` on a
reference field duplicates work; the write itself is atomic and the loser's object is discarded. It does
not THROW. Several are already under a `lock` anyway. They are worth a separate look for publication
safety on weak-memory hardware, but conflating them with this would overstate the finding.

### Testing it at all

⚠ **THROUGH THE PUBLIC PATH THE MEMO CAN ONLY BE COLD ONCE PER PROCESS**, so a test calling
`Phonemize(…, "gan")` would pass trivially whenever another test had run first — it would assert
nothing, in the way that is hardest to notice. `MaxWordFor` is therefore `internal`, and the test builds
a **fresh dictionary per round** so the cold memo is repeatable.

**Proved by reverting:** with the check-then-act version restored and the test kept, it fails. The test
also asserts that every thread agrees on the value, which is what licenses the "factory may run twice"
argument rather than assuming it.

### ⚠ Review: `Parallel.For` does not guarantee concurrency, so the proof was weaker than it looked

The first version of the test used `Parallel.For(0, 32, …)`. The TPL partitions by available
parallelism, so on a one- or two-core CI container — or a box already saturated by xUnit's own class
parallelism — the 32 iterations can run as ONE sequential range: the first warms the memo and the other
31 are cache hits. **The test would then pass against the buggy version on exactly the constrained
machines where the race matters**, and the "proved by reverting" check had been run on this dev box
only. Replaced with explicit threads meeting at a `Barrier`, so every thread arrives at a cold memo at
the same instant.

⚠ **AND THE LIMIT THAT REMAINS IS STATED RATHER THAN PAPERED OVER.** Measured under `taskset -c 0`
against the check-then-act version: it **passes**. On one usable core the race cannot be won, because
after the barrier releases, one thread runs the short critical section to completion before another is
scheduled — and lengthening that section to 40,000 keys did not change it. The barrier removes the
scheduler-partition hole; it cannot manufacture parallelism the machine does not have. The test detects
the bug on any machine with two or more usable cores, and that is what it claims.

### Two comments that had gone out of date

⚠ The `InternalsVisibleTo` note in the csproj read *"For LanguageBootstrapTests ONLY, and for one
reason"* — an invariant this change falsified by adding a second consumer. In a codebase this
comment-rigorous that note is what the next person widening an `internal` reads as the gate on doing so,
so it now carries both reasons.

⚠ And the note that this run's whole narrative turns on — *"TS uses a WeakMap"* — was sitting
twenty-eight lines away from `MaxWordFor`, above an unrelated `Number.isSafeInteger` helper. A reader
following the argument would not have found it attached to anything relevant, and the correspondence had
ended up stated in two places. Moved onto the function it describes and merged with the new block.

**Gates.** 6330 TS · 6939 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons.
