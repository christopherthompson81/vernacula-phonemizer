# Rust crate code size

Question: inference.rs measured its library grow by 17 MiB (`.text` +13.5 MiB) when the crate went from 11 to 116
languages. Per-language Cargo features (#1600) let it link only its 8 languages, but what makes each language cost
so much code? Is it code that should be data?

Instrument for every run: build the parity tool (`cargo build --release -p parity`, all languages) and read `.text`
with `size -A`. Attribute it with `nm -S -C`, grouping symbols by module and by generic instantiation. For
inference.rs's build, use the `astral_timing` example with
`--no-default-features --features 'en-GB,es,fr,hi,it,pt-BR,ja,cmn'`.

## Run 1 — 2026-10-16 08:15

**Attribution at a22cd855.** `.text` 20.03 MB; the symbols sum to 19.63 MiB.

| source | MiB | symbols |
|---|---|---|
| `provenance::rewrite_with::<closure>` | 4.02 | 1,012 |
| `JsRegex::replace_with::<closure>` | 2.48 | 1,036 |
| serde `Deserialize` code (visitors, `deserialize_struct`) | 4.24 | 1,885 |
| the languages' own logic | ~4.5 | 116 languages, ~40 KB each |

**Code that should be data: not the cause.** The Rust source holds 4,006 `("…", "…")` table rows, 127 KB in all.
Tables go to `.rodata` (0.75 MB) and `.data.rel.ro` (0.7 MB), not `.text`.

**The cause is monomorphisation.** Both rewrite helpers take `impl FnMut`, so each of the ~1,040 call sites gets
its own copy of the whole body. 105 new languages meant ~2,000 new call sites.

## Run 2 — 2026-10-16 08:40

**#1617:** each helper became an `#[inline]` shim over a body that takes `&mut dyn FnMut`.

- `.text`: 20.03 → 14.51 MB (all languages); 4.27 → 3.52 MB (inference.rs's set).
- 1 copy of each body remains.
- Parity run time 16.5 s vs 16.7 s before (3 runs each), so no slowdown.

Merged as 7f438d91.

## Run 3 — 2026-10-16 09:00

**Hypothesis: serde's size is the JSON lexer inlined into every struct's decoder.** If so, parsing to a
`serde_json::Value` once and decoding from it (`from_value`) should shrink it. I tried it on the two central helpers
(`parse_jsonc`, `load_json`).

Result: `.text` 14.51 → **14.66 MB, larger**. Split by deserializer:

| | from text (`StrRead`) | from `Value` |
|---|---|---|
| before | 874 fns, 4.00 MiB | 28 fns, 0.01 MiB |
| after | 81 fns, 0.09 MiB | 1,987 fns, 4.01 MiB |

The code just moved. The cost is serde's derived decoder per struct (~9 KB each: field matching, a sequence form,
nested decoders inlined), whatever feeds it. **Hypothesis rejected; reverted.**

In inference.rs's build serde is 0.82 MiB of 3.36 MiB of code (24%).

## Run 4 — 2026-10-16 09:30

**A derive that does not write a decoder per struct.** New crate `rust/vernacula-json-derive`, a
`#[derive(FromJson)]`. Each struct's impl is one call per field into `core::from_json::{field, field_or}`, which
are generic only over the field type, so ~170 field types share their code across ~440 structs. Text is parsed
once into a `Value` by serde_json.

It replicates the serde attributes the crate used: `rename_all` (`camelCase` 247, `lowercase` 6), `default`
(container and field), `deny_unknown_fields`, `untagged` (2 enums), `rename`, `skip`, `skip, default = "fn"`,
`flatten` (17, all onto structs). The swap was mechanical: 437 derives, 340 attributes (`#[serde(` → `#[json(`),
128 imports, 47 `serde_json::from_str` calls. The crate now has no direct `serde` dependency.

Known differences from serde, none of which the data relies on:
- A struct is read only from a JSON object, never from an array.
- A repeated key keeps its last value instead of failing.

**Size:**

| build | before | after |
|---|---|---|
| all languages | 14.51 MB | **11.10 MB** (−23.5%) |
| inference.rs's set | 3.52 MB | **2.88 MB** (−18.3%) |

Decoding code: 4.35 MiB of serde → 0.96 MiB of `FromJson` (1,037 fns), plus 0.03 MiB left in serde/serde_json.

Since #1617, overall: 20.03 → 11.10 MB (−44.6%), and 4.27 → 2.88 MB (−32.6%) for inference.rs's set.

**Proving every data file still decodes.** Parity being identical only covers what parity loads.

- I temporarily logged every decoded type and every data key read during the parity run and `cargo test`.
- The log contained no real decode failure. The only non-`ok` lines were the new decoder tests' deliberate
  failures, plus a few lines that parallel test threads wrote over each other.
- All 170 load call sites' types appear in the log. The two that didn't match by name are aliases
  (`XhosaManifest = ZuluManifest`, and `HindiDef`).
- 122 of the 203 `.json`/`.jsonc` files in `data/` were read. None of the other 81 is referenced from Rust: they
  belong to languages not yet ported (arabic, persian, hebrew, …).
- The instrumentation was removed afterwards.

**A gate hole found on the way.** `tools/fn-diff` decoded crate types with `serde_json::from_value` and stopped
compiling. That broke `cargo test` for the whole workspace, but the gate script only grepped for
`FAILED|panicked`, so it printed nothing rather than a failure. The script now prints `RUST-TEST-EXIT` and
`^error` lines. fn-diff now uses `FromJson::from_json`.

## Run 5 — 2026-10-16 09:50

**The POS weights as binary** (`data/languages/english/pos-model.bin`, replacing `pos-model.json`). This step is
about load time and file size, not code size, and it touches all three engines.

The layout is in `src/languages/english/posModelBinary.ts`, version 1:
- two string blocks, `rowStart` (u32), `cls` (u8) and `weight` (i32), all little-endian;
- the weights range from −13,737 to 34,605, so they don't fit an i16;
- there are 49 classes, so a u8 holds the class index.

`tools/english/pos_model_pack.mts` converts both ways. `pack` refuses to write unless the round trip is exact; it
was exact, and Python's comparison of the unpacked file against the original JSON agrees.

**File size:** 2,911,001 → 2,048,082 bytes (−30%). The feature strings (728 KB) are most of what's left.

**Load time in Node** (median of 7, while another job was running, so noisy):

| | ms |
|---|---|
| `JSON.parse` of the old file | 22–35 |
| first decoder, decoding to the old object shape | 42 |
| after decoding each string block once and reading the arrays in bulk | **9–13** |

⚠ The first decoder was *slower* than `JSON.parse`. A breakdown put about 21 ms in building the 39k per-feature
row objects. That's the same work `JSON.parse` does in native code, so keeping the old in-memory shape cancelled
out the format. The tagger now holds the compressed rows directly in all three engines (`PackedPosModel` in TS,
`PosModel` in C# and Rust). Summation order is unchanged (ascending class within each row), and every sum is
over integers.

⚠ A Node `Buffer`'s `.slice()` is a view, and its `.buffer` is the whole shared pool. A typed array built from it
read the wrong bytes (`RangeError` in the shipped-model test). The fix is to copy with `new Uint8Array(view)`.

**Guard check.** I made the Rust tagger read every weight as 0, on both the first decoder and the final one. Parity
for en, en-GB and en-IN went to 193/200 each, and back to 200/200 when restored. ⚠ After the second restore it
still read 193/200: the file restored by `mv` had a timestamp older than the sabotaged build, so cargo didn't
rebuild it. `touch` fixed it.

**Gates:** all green. One run had a single failure in `english-1504-able` (an async neural-path test with the
default 5 s timeout, while another job was benchmarking). It passed alone and in a full rerun (7224/7224). The
gate log didn't keep the failure text, so its cause is unconfirmed.

## Next

- `pos-model.bin` needs a new HF data tag before inference.rs, or anyone else loading the data from HF, can use it.
