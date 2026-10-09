# Rust port: the pure-Rust neural runtime (`core::neural`)

Tracking issue: #1463. Settled there: no `ort`, no native library; the output is held to ONNX Runtime 1.27.0 CPU
on the machine that generated the goldens, aiming at BIT-EXACT float logits. English first.

## Run 1 — 2026-10-09 13:40 (what the models are, and what ORT actually executes)

**Question.** Which ops do the 18 `.onnx` files under `data/` use, and does ORT run the graph as written or a
rewritten one? A runtime that matches the file op-for-op is not bit-exact if ORT executes a fused kernel with a
different rounding order.

**Command.** `onnx.load` over every model (op histogram, inputs, outputs); then
`ort.InferenceSession(path, SessionOptions(optimized_model_filepath=…))` with default options (what `src/` passes to
onnxruntime-node: none) to dump the graph ORT executes. `lscpu` for the dispatch.

**Raw finding.**
- All 18 are opset 17 + `com.microsoft` 1, IR 8, no external data.
- 15 taggers/diacritizers share one shape: `Gather(u8 emb) → DequantizeLinear → Transpose → DynamicQuantizeLSTM
  (bidirectional, H=256; the three Arabic-family diacritizers have three layers, H=512) → Transpose/Reshape → …`
  plus shape plumbing (`Shape, Gather, Unsqueeze, Concat, ConstantOfShape, Slice`) that only builds zero
  initial states, and a head `DynamicQuantizeLinear → MatMulInteger → Cast → Mul(scale·scale) → Add(bias)`.
- The two Persian encoders are the same minus the head. The two decoders add `Not, ReduceSum, Where, Softmax,
  MatMul (float), Squeeze` and a unidirectional `DynamicQuantizeLSTM`.
- Weights: every LSTM W/R is int8 with zero-point 0 and one scale per direction; the embedding is u8 per-tensor.
  The weights use the FULL int8 range (e.g. English `R` is −127..127), i.e. the models were NOT quantized with
  `reduce_range`.
- ORT's optimized English graph: identical except the head is fused into ONE `com.microsoft.DynamicQuantizeMatMul`
  (A float, B int8, bias). The shape plumbing is constant-folded away into one `Slice` of zeros.
- CPU: AVX2 + FMA, no AVX-VNNI, no AVX512. MLAS therefore dispatches `MlasGemmU8S8KernelAvx2` (u8 activations ×
  s8 weights via `vpmaddubsw`, which SATURATES the pair sum to int16), `MlasComputeLogisticF32KernelFma3` and
  `MlasComputeTanhF32KernelFma3`.

**ORT 1.27.0 source read (shallow clone of the v1.27.0 tag).** What the executed path does, step by step:
1. `DynamicQuantizeLSTM` → `LSTMBase::ComputeImpl` → `UniDirectionalLstm` per direction (reverse = reverse the
   input in time, run forward, reverse the output back).
2. Input projection: ONE quantized GEMM over all T rows: `GetQuantizationParameter` over the whole [T·B, I]
   input (min/max widened to include 0; `scale = (max−min)/255`; `zp = RoundHalfToEven(clamp(−min/scale))`),
   `MlasQuantizeLinear` (x/scale — a DIVIDE, clamp to [−zp, 255−zp], `cvtps2dq` round-half-even, + zp),
   u8s8 QGEMM, then `C = float(acc) · (a_scale·w_scale)`.
3. Each step: the same for h_{t−1} (one row, its own scale), and the post-processor ACCUMULATES:
   `C = float(acc)·scale + C` — on this Linux x86 build `MLAS_FMA3_INTRINSICS` is off (no `-mfma` for
   qpostprocessor.cpp), so that is a multiply and an add, two roundings.
4. Gates (order i, o, f, c): `x = pre + (Wb+Rb)`, clipped to ±FLT_MAX; i,f,o = MLAS logistic (clamp ±18, odd
   rational polynomial with FMA, `p/q + 0.5`, max 0), g = MLAS tanh (clamp ±9, rational polynomial with FMA, no
   final clamp); `c = c_prev·f + i·g` (no FMA); `h = tanh(c)·o`.
5. QGEMM integer semantics: B packed in K-quads; per quad `sat16(a0·b0 + a1·b1) + sat16(a2·b2 + a3·b3)` summed in
   int32, minus `zpA · colsum(B)` (B zero-point is 0). K is cut into 384-wide panels, which changes nothing in
   integers.
6. Head (`DynamicQuantizeMatMul`): quantize the whole [T, 512] activation, the same QGEMM,
   `y = float(acc)·(a_scale·b_scale) + bias` — exactly what the unfused `Cast → Mul → Add` computes too, so the
   fusion does not move a bit and a runtime can execute the graph as written.

**Implication.** Build an interpreter over the written graph, with MLAS's integer and float semantics reproduced
in the ops that carry them (quantize, QGEMM incl. the int16 saturation, logistic, tanh, the post-processor's
mul-then-add). Then prove each of those against ORT by reverting it.

## Run 2 — 2026-10-09 13:55 (the English reference set)

**Question.** A reference set big enough that a rare rounding event shows up: does it exist, and is it the
same thing the goldens saw?

**Command.** `.venv/bin/python -I rust/tools/onnx-diff/gen_refs.py --n 5000 en-g2p-tagger.int8` (new; writes
`.probe/neural/en-g2p-tagger.int8.ref`, gitignored, 48 MB). Then the same file replayed through
onnxruntime-node 1.27.0 (`node_modules/onnxruntime-node`, what `src/` and the goldens use) by a throwaway
scratchpad script.

**Raw finding.** 6,450 cases = 5,000 g2p-dict.tsv keys the tagger vocabulary covers, 625 two-word
concatenations, 625 random-letter pseudo-words (1–16), every dictionary key longer than 20 letters, and 200
cut-down three-word concatenations of 21–60 letters; 57,056 logit rows (one per character). Node replay:
`6450/6450 outputs bit-identical to the Python reference, max|diff| 0`.

**Implication.** Python's onnxruntime and onnxruntime-node 1.27.0 run the same MLAS on this machine, so the
Python file is a valid stand-in for what the goldens saw, and it can be regenerated without Node.

## Run 3 — 2026-10-09 14:05 (first replay of the interpreter)

**Question.** Does the interpreter built from Run 1's reading reproduce ORT on English?

**Command.** `cd rust && cargo run --release -p onnx-diff` (new tool `rust/tools/onnx-diff`).

**Raw finding.**
`en-g2p-tagger.int8 [logits]: cases 6450/6450 exact, rows 57056/57056 exact, max|diff| 0e0, argmax flips 0 (31.25s)`.

**Implication.** Bit-exact on the first run. That is suspicious enough to need the reverse proof: if a step I
believe necessary can be switched off without moving the count, either it is not necessary or the harness
cannot see it. Run 4.

## Run 4 — 2026-10-09 14:15 (proving each MLAS behaviour by reverting it)

**Question.** Which of the reproduced behaviours are load-bearing on English? Each is swapped for the
"obvious" implementation by a bit in `core::neural::mlas::knobs` (all off = shipped path).

**Command.** `./target/release/onnx-diff --knobs K` for each K.

**Raw finding** (6,450 cases / 57,056 rows; shipped path = 6450 / 57056 / 0 / 0):

| K | replaced behaviour | cases exact | rows exact | max abs diff | argmax flips |
|---|---|---|---|---|---|
| 1 | `vpmaddubsw` int16 pair saturation → plain int32 dot | 72 | 457 | 0.573 | 32 |
| 2 | MLAS logistic polynomial → libm `1/(1+exp(−x))` | 3,637 | 33,063 | 0.189 | 2 |
| 4 | MLAS tanh polynomial → libm `tanh` | 3,843 | 35,541 | 0.217 | 1 |
| 8 | post-processor mul-then-add → one FMA | 4,737 | 41,836 | 0.187 | 0 |
| 16 | quantize by `x/scale` → `x·(1/scale)` | 4,489 | 38,770 | 0.854 | 16 |
| 32 | quantize half-to-even → half-away-from-zero | 4,430 | 39,035 | 0.890 | 12 |
| 64 | polynomials with FMA → separate mul/add | 3,029 | 27,907 | 0.217 | 0 |

**Implication.** Every one of the seven is load-bearing; none is cosmetic. The saturation is the big one: it
is not a rare corner, it fires in almost every word (only 72 of 6,450 survive without it), because the
weights use the full int8 range and dynamically quantized activations reach 255. A runtime that "fixes"
the saturation as an overflow bug would be wrong on 99% of words. The float-side details each move 30–55% of
words and flip a handful of argmaxes — the same order as the cross-microarchitecture divergence recorded in
csharp/PORTING.md (#1287), which is why "close" was never going to be good enough.

## Run 5 — 2026-10-09 14:40 (speed: where 4.8 ms per word went)

**Question.** The first build took 31 s for 6,450 English words (4.8 ms/word), and a first full fleet run
did not finish in 10 minutes. What is slow? (`perf` is not permitted on this machine, so by timers.)

**Command.** `cargo run --release --example neural_bench` (new: one T=10 English call ×2000, plus each
primitive in isolation), then `onnx-diff --model en-g2p-tagger.int8` after each change.

**Raw finding**, in order of the fixes:
- A column-per-column scalar GEMM vectorised over N (`[K][N]` rows): SLOWER, 55 s. Baseline x86-64 has no
  vector `pmulld`, so i32 multiplies stay scalar.
- AVX2 `pmaddwd` over packed i16 K-pairs, runtime-detected: 20 s.
- The MLAS kernel itself (`vpmaddubsw` + `vpmaddwd` with ones over K-quads, one byte per weight): 14 s.
  Integer results identical to the scalar path (unit test `simd_and_scalar_quad_kernels_agree`).
- Primitives in isolation then showed `activations 1024: 19.75 us` against `gemm 1x256x1024: 5.95 us`:
  `f32::mul_add` without the `fma` target feature is a CALL to libm `fmaf`. Compiled under
  `#[target_feature(enable = "avx2,fma")]` (runtime-detected): `0.32 us`. FMA is exactly rounded either way,
  so the bits cannot move (`fma3_build_matches_portable_build`).
- Transpose/Slice/broadcast index maps rebuilt as an odometer instead of a div/mod per element, the GEMM's K
  loop hoisted outside its M loop (one quad-row of B serves every row of A from L1), the per-element knob
  checks hoisted out of the dequantize loops: 5.8 s, ~0.9 ms/word.

Every step was re-run against the reference: 6450/6450 exact throughout.

**Implication.** Fast enough for the engine (the tagger runs only on OOV words). ORT itself is faster still;
the remaining cost is the input projection streaming W (512 KB per direction) and the per-step R (256 KB,
just over this core's 256 KB L2). Not pursued further.

## Run 6 — 2026-10-09 15:00 (the whole fleet)

**Question.** Does the same interpreter reproduce every other model?

**Command.** `.venv/bin/python -I rust/tools/onnx-diff/gen_refs.py --n 2000` (taggers: 2,000 random id
sequences from each model's own embedding vocabulary, T = 1..48; restorers: 200 encoder runs of T = 1..40 and
6 greedy decoder steps each), English regenerated at `--n 5000`; then `cargo run --release -p onnx-diff`.

**Raw finding.**
```
af-g2p-tagger.int8 [logits]: cases 2000/2000 exact, rows 48547/48547 exact, max|diff| 0e0, argmax flips 0
bn-g2p-tagger.int8 [logits]: cases 2000/2000 exact, rows 48563/48563 exact, max|diff| 0e0, argmax flips 0
ckb-bizroke-tagger.int8 [logits]: cases 2000/2000 exact, rows 48901/48901 exact, max|diff| 0e0, argmax flips 0
da-g2p-tagger.int8 [logits]: cases 2000/2000 exact, rows 49901/49901 exact, max|diff| 0e0, argmax flips 0
diacritizer-egy [logits]: cases 2000/2000 exact, rows 47911/47911 exact, max|diff| 0e0, argmax flips 0
diacritizer [logits]: cases 2000/2000 exact, rows 49064/49064 exact, max|diff| 0e0, argmax flips 0
en-g2p-tagger.int8 [logits]: cases 6450/6450 exact, rows 57056/57056 exact, max|diff| 0e0, argmax flips 0
fa-context-restorer.dec: LOAD FAILED: unsupported ONNX model: op ::ReduceSum (node "/ReduceSum")
fa-context-restorer.enc [enc_o]: cases 200/200 exact, rows 4339/4339 exact, max|diff| 0e0, argmax flips 0
fa-tagger.int8 [logits]: cases 2000/2000 exact, rows 49876/49876 exact, max|diff| 0e0, argmax flips 0
fa-vowel-restorer.dec: LOAD FAILED: unsupported ONNX model: op ::ReduceSum (node "/ReduceSum")
fa-vowel-restorer.enc [enc_o]: cases 200/200 exact, rows 4068/4068 exact, max|diff| 0e0, argmax flips 0
fr-g2p-tagger.int8 [logits]: cases 2000/2000 exact, rows 49166/49166 exact, max|diff| 0e0, argmax flips 0
he-tagger.int8 [logits]: cases 2000/2000 exact, rows 47953/47953 exact, max|diff| 0e0, argmax flips 0
km-segmenter.int8 [logits]: cases 2000/2000 exact, rows 48708/48708 exact, max|diff| 0e0, argmax flips 0
nb-g2p-tagger.int8 [logits]: cases 2000/2000 exact, rows 49137/49137 exact, max|diff| 0e0, argmax flips 0
riderDiacritizer [logits]: cases 2000/2000 exact, rows 48472/48472 exact, max|diff| 0e0, argmax flips 0
sd-g2p-tagger.int8 [logits]: cases 2000/2000 exact, rows 48828/48828 exact, max|diff| 0e0, argmax flips 0
```
af/da/fr/nb have a u8 head weight (the u8u8 kernel, exact in int32); the other heads are s8 (u8s8, saturating).
Both kernels are exercised and both are exact. 2m30s for the fleet.

**Implication.** All 15 family-(a) models and both Persian encoders: bit-identical. The two decoders fail
loudly at load, as designed: they need `ReduceSum`, `Where`, `Softmax`, float `MatMul` and `Squeeze`, which are
float reductions whose summation order is ORT's (Eigen and MLAS), not arithmetic. Next: read those.

## Run 7 — 2026-10-09 15:30 (the Persian decoders: float reductions)

**Question.** The decoders add attention: `Mul → ReduceSum(−1) → Where(mask, ·, −1e9) → Softmax → MatMul(enc_o)`.
What does ORT execute for each, and does reproducing it close the decoders?

**ORT/Eigen source read.**
- ORT's optimized decoder graph fuses both heads into `DynamicQuantizeMatMul` (same arithmetic as Run 1) and
  folds `Not → Cast → Where` into `Where` with swapped branches (a select: exact either way).
- `ReduceSum` over the last axis is `FastReduceKR`: per row, `Eigen::Map<VectorXf>(row).sum()`. ORT pins Eigen
  at commit 1d8b82b0 (cmake/deps.txt). Its `redux_impl<LinearVectorizedTraversal, NoUnrolling>` with SSE
  `Packet4f` (ORT's C++ is built for baseline x86-64): two packet accumulators over the 16-byte-aligned body,
  `predux` = `(a0+a2)+(a1+a3)`, then the unaligned head and the tail added one by one. The head depends on the
  row's ADDRESS, so a row at float offset `o` (ORT buffers are 64-byte aligned) starts its body at
  `(4 − o%4) % 4`.
- `Softmax` → `MlasComputeSoftmax`: max (exact), `MlasComputeSumExpF32KernelFma3` (an exp of its own: clamp at
  −88.376, range-reduce by `round(x/ln2)` via the 12582912 rounding-bias trick, a degree-6 FMA polynomial, the
  2^m scale built by integer adds on the bits; the sum in 8 lane accumulators, then `vhaddps`×2 and the two
  128-bit halves added), then every element × `1/sum`.
- `MatMul` [1,1,T]×[1,T,512] → `MlasGemmBatch` → M = 1 → `MlasSgemmKernelM1Avx`: K in groups of 4 (then 2,
  then 1), each group's products summed left to right with `vmulps`/`vaddps` (no FMA) and only then added to C.

**Command.** Implemented as `mlas::{eigen_sum, sum_exp, softmax_row, sgemm_m1}`;
`onnx-diff --model fa-vowel-restorer.dec --model fa-context-restorer.dec`.

**Raw finding.** Both decoders, every output (`logits`, `h_out`, `c_out`): `cases 1200/1200 exact` (200 encoder
runs × 6 greedy steps, a random half with a partial mask).

Reverting each piece (knob, `logits` rows exact of 1,200; context / vowel):

| K | replaced | context | vowel |
|---|---|---|---|
| 128 | Eigen sum + M1 grouping → sequential sums | 1,134 | 1,122 |
| 256 | MLAS softmax → libm exp, sequential sum | 1,199 | 1,200 |
| 1 | u8s8 saturation | 1,017 | 1,070 |
| 2 / 4 | MLAS logistic / tanh | 886 / 912 | 1,143 / 1,134 |
| 8 | post-processor FMA | 1,127 | 1,183 |
| 16 / 32 | quantize reciprocal / round-away | 1,175 / 757 | 1,192 / 1,172 |
| 64 | polynomials without FMA | 802 | 1,109 |

**Implication.** The softmax is a WEAK witness here: switching it to libm moves 1 row of 2,400, because the next
op (`DynamicQuantizeLinear` of the concat) absorbs sub-ulp differences. That is "flat may mean blind", not
proof that the MLAS softmax is unnecessary. So: test the three float ops in isolation (Run 8).

## Run 8 — 2026-10-09 15:45 (single-op probes for the float reductions)

**Question.** Are `ReduceSum`, `Softmax` and `MatMul` exact on their own, where nothing downstream rounds the
difference away?

**Command.** `gen_refs.py --n 3000 ops` (new: writes one-node models `op-softmax`, `op-reducesum`, `op-matmul`
into `.probe/neural/` with ORT outputs — softmax rows of 1–64 with 15% masked to −1e9 at three logit scales;
ReduceSum rows of 512 and of 1, 3, 7, 37, 130, 513; MatMul K = 1–64 (every residue mod 4), N = 512, 37, 8, 3),
then `onnx-diff --model op-softmax --model op-reducesum --model op-matmul --knobs K`.

**Raw finding** (cases exact of 3,000):

| | shipped | K=128 sequential sums | K=256 libm softmax | alignment-blind Eigen sum (temporary edit) |
|---|---|---|---|---|
| op-softmax | 3,000 | 3,000 | **286** | — |
| op-reducesum | 3,000 | **834** | 3,000 | **1,611** |
| op-matmul | 3,000 | **261** | 3,000 | — |

**Implication.** In isolation each reproduction is load-bearing: the MLAS softmax (2,714 of 3,000 differ
without it), Eigen's packet order (2,166), the address-dependent unaligned head (1,389 — only odd row
lengths; the decoders' 512 never trigger it), and the M1 kernel's grouping (2,739). All exact as shipped.
Every model under `data/` is now bit-identical. A `PINNED` table of 11 English words' logit hashes, generated
by `gen_refs.py --pin`, guards it in `cargo test`; reverting the saturation (knob 1) or the post-processor
(knob 8) by editing the knob default makes that test fail, so the guard sees both the large and a small
regression.

## Run 9 — 2026-10-09 16:10 (final fleet, thread count, and Node again)

**Question.** After the decoder ops and the clippy clean-up, is everything still exact; does the ORT
reference depend on its thread count; and is Python's ORT still Node's ORT for the newly covered ops?

**Command.** `cargo run --release -p onnx-diff` (all 21 reference files); `gen_refs.py --threads 1` into a
scratch directory and `cmp` against the default-thread English file; the Node replay script on
fa-vowel-restorer.dec, riderDiacritizer and op-softmax.

**Raw finding.** Every line of the fleet run reads `… exact, max|diff| 0e0, argmax flips 0` (2m23s):
15 taggers/diacritizers, both encoders, both decoders (`logits`, `h_out`, `c_out`), three op probes. The
one-thread English reference is byte-identical to the default-thread one. Node:
`3600/3600`, `2000/2000`, `3000/3000 outputs bit-identical to the Python reference`.

**Implication.** Done for every model under `data/` on this machine. Known limits, all refused loudly rather
than approximated: batch > 1 (ORT splits the batch over threads, and each split quantizes its own rows);
`sequence_lens`, peepholes, `input_forget`, non-default LSTM activations; per-axis `DequantizeLinear`;
`ReduceSum` over non-trailing axes; `Softmax` over a non-last axis; float `MatMul` with M > 1 (MLAS's blocked
SGEMM order is not reproduced). The reproduction is of THIS dispatch (AVX2 + FMA3, no AVX-VNNI/AVX512): on a
VNNI machine MLAS uses `vpdpbusd`, which does not saturate, so the saturation emulation would be wrong there —
consistent with csharp/PORTING.md's "on one machine" contract (#1287), and not detected at run time.
