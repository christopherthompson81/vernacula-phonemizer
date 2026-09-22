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

**Gates.** 6330 TS · 6939 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons.
