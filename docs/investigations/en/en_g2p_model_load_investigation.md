# English OOV G2P model: load time and format

Question: every process that touches English loads `g2p-model.json` (the joint n-gram for out-of-vocabulary
words). How long does that take in each engine, and can a different storage format make it faster?

Instrument: scratch harnesses, not committed.
- **TS:** `createEnglishG2p` built exactly as `rust/tools/fn-diff/dump.mts` builds it, with `performance.now()`
  around the load and the construction, then warm `g2p()` passes over a word list.
- **C#:** a console project that references the library and times `Load` six times.
- **Rust:** an example that times the load four times, then the first `phonemize(_, "en")`.

## Run 1 — 2026-10-16 11:20

**Load cost, JSON** (3,755,650 bytes):

| engine | load | notes |
|---|---|---|
| TS (`JSON.parse`) | 107–178 ms | `createEnglishG2p` +8–17 ms |
| C# (`LoadJson<EnglishG2pModel>`, System.Text.Json into `JsonElement` lists) | ~400 ms cold, 210–270 ms warm | |
| Rust (`load_json`, then interning in `EnglishG2p::new`) | ~140 ms cold, ~105 ms warm | engine build 659 ms |

**The file's content:**

| contexts | by order 0/1/2/3/4 | candidate pairs | distinct tokens | max count | repeated token within a context |
|---|---|---|---|---|---|
| 61,846 | 1 / 428 / 5,969 / 23,005 / 32,443 | 149,802 | **636** | 922,884 | 0 |

All counts and totals are integers. So the whole model is small integers over a 636-entry string table. Rust had
already reached that internally (it interns tokens at load); TS and C# keyed everything by strings.

## Run 2 — 2026-10-16 11:40

**Format: `g2p-model.bin`**, version 1. The layout is in `src/languages/english/g2pModelBinary.ts`:
- the header parameters and the grapheme-chunk table;
- the token table;
- per context: its order, four u16 token slots (the order's tokens in the last slots, `0xFFFF` padding),
  and a u32 total;
- candidates in compressed rows: u16 token, u32 count.

⚠ **Splitting the JSON keys.** Tokens can hold spaces (`n:AH0 N`), and the keys join tokens with spaces. The
packer uses Rust's existing `split_context` rule (a piece whose second character is `:`, or `^`, starts a
token). It refuses a key unless the split re-joins exactly and has as many tokens as the order says. All 61,846
keys passed.

**Size:** 1,962,051 bytes (−48%). Round trip: `pack` refuses to write unless it's exact; Python's comparison of
the unpacked file against the original agrees, and the key order is identical.

**Engines:**
- **TS and C#.** The decoder's history holds token ids. A context is one number,
  `((((o·B + a)·B + b)·B + c)·B + d)` with `B` = tokens + 1, so no context string is built. TS asserts
  `5·B⁴` < 2⁵³.
- A token the model never saw is `UNSEEN`: any context holding it misses, and it is never a candidate. That is
  what the string lookup did, because a joined key containing an unseen token can't equal a stored key: the
  split is unique.
- **Rust** builds its existing id-keyed contexts from the arrays. `split_context` is removed.

## Run 3 — 2026-10-16 11:55

**Output checks, old against new:**

| check | rows | result |
|---|---|---|
| TS, fn-diff `g2p` dump (main at 8e7d9612 vs this branch) | 148,356 | identical |
| Rust, fn-diff replay of that dump | 148,356 | identical |
| C#, whole English engine over 20,000 constructed OOV words (main build vs this build) | 20,000 | identical |
| TS, the 604 Min Nan decoder inputs (nan Run 3) | 604 | identical |
| goldens (en, en-GB, en-IN, nan), all three engines | 800 | identical |

**Load cost, binary:**

| engine | load | was |
|---|---|---|
| TS | **6 ms** (`createEnglishG2p` 16–18 ms, now indexing 61,846 contexts) | 107–178 ms |
| C# | **22 ms** cold, 1–2 ms warm | ~400 ms / 210–270 ms |
| Rust | **~1 ms** | ~105–140 ms |

Other effects:
- Rust's whole English engine builds in 464 ms against 659.
- C#'s first English call takes 862 ms against 1,276 (measured in the 20,000-word harness).
- TS decoding of the 604 Min Nan words went 606 → ~465 ms per pass, since no context strings are built.
