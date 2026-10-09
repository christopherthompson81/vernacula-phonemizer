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
