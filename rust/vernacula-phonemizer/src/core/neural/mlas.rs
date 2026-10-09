//! The arithmetic of ONNX Runtime 1.27.0's CPU kernels (MLAS) that the int8 models depend on, reproduced bit for
//! bit for an x86-64 AVX2/FMA3 machine without AVX-VNNI or AVX512 — the golden machine (#1463).
//! The source each function follows is named on it; docs/investigations/rust-port/rust_neural_runtime_investigation.md
//! records what each one is worth, measured by switching it off (`knobs`).

// The MLAS constants are kept digit for digit as the C source spells them; they round to the same f32.
#![allow(clippy::excessive_precision, clippy::approx_constant)]
// `x.max(lo).min(hi)` spells out the kernels' maxps-then-minps order.
#![allow(clippy::manual_clamp)]

use std::sync::atomic::{AtomicU32, Ordering};

/// Switches that replace one MLAS behaviour with the "obvious" one, so a differential run can measure what the
/// behaviour is worth. All off is the shipped, ORT-exact path. Nothing in the engine sets these.
#[doc(hidden)]
pub mod knobs {
    use super::*;
    /// Plain int32 dot products instead of `vpmaddubsw`'s int16 pair saturation.
    pub const NO_U8S8_SATURATION: u32 = 1;
    /// `1 / (1 + exp(-x))` (libm) instead of MLAS's rational polynomial.
    pub const LIBM_LOGISTIC: u32 = 2;
    /// `tanh` (libm) instead of MLAS's rational polynomial.
    pub const LIBM_TANH: u32 = 4;
    /// The QGEMM accumulate post-processor as one FMA instead of a multiply and an add.
    pub const FMA_ACCUMULATE: u32 = 8;
    /// Quantize by multiplying with the reciprocal scale instead of dividing.
    pub const QUANT_RECIPROCAL: u32 = 16;
    /// Round half away from zero when quantizing, instead of `cvtps2dq`'s half-to-even.
    pub const QUANT_ROUND_AWAY: u32 = 32;
    /// The polynomials evaluated with separate multiply and add instead of FMA.
    pub const POLY_NO_FMA: u32 = 64;
    /// Float reductions (ReduceSum, the MatMul dot products) as one sequential left-to-right sum.
    pub const NAIVE_FLOAT_REDUCTIONS: u32 = 128;
    /// Softmax with libm `exp` and a sequential sum, instead of MLAS's exp polynomial and lane sums.
    pub const LIBM_SOFTMAX: u32 = 256;

    pub(crate) static KNOBS: AtomicU32 = AtomicU32::new(0);

    pub fn set(bits: u32) {
        KNOBS.store(bits, Ordering::Relaxed);
    }

    #[inline]
    pub(crate) fn on(bit: u32) -> bool {
        KNOBS.load(Ordering::Relaxed) & bit != 0
    }
}

use knobs::on;

/// `GetQuantizationParameter<uint8_t>` (core/util/qmath.h): the range is widened to include 0,
/// `scale = (max - min) / 255`, `zp = RoundHalfToEven(clamp(0 - min / scale, 0, 255))`. A constant input
/// (max == min, which after widening means all zeros) gets scale 1.
pub fn quant_params_u8(data: &[f32]) -> (f32, u8) {
    let mut min = f32::MAX;
    let mut max = f32::MIN;
    for &x in data {
        // MlasFindMinMaxElement uses minps/maxps; with no NaN in the input the result is order-independent.
        min = min.min(x);
        max = max.max(x);
    }
    let min = min.min(0.0);
    let max = max.max(0.0);
    let scale = if max == min {
        1.0f32
    } else {
        (max - min) / 255.0f32
    };
    let initial_zero_point = 0.0f32 - min / scale;
    let clamped = 0.0f32.max(255.0f32.min(initial_zero_point));
    (scale, round_half_to_even(clamped) as u8)
}

/// `RoundHalfToEven` in qmath.h: `x - remainderf(x, 1)`. For the finite values that reach it this is
/// round-to-nearest, ties to even.
fn round_half_to_even(x: f32) -> f32 {
    x.round_ties_even()
}

/// `MlasQuantizeLinearU8Kernel` (mlas/lib/quantize.cpp, SSE2 path): `x / scale`, clamped to
/// `[0 - zp, 255 - zp]`, converted with `cvtps2dq` (round to nearest even under the default MXCSR), plus zp.
pub fn quantize_u8(data: &[f32], scale: f32, zp: u8, out: &mut Vec<u8>) {
    out.clear();
    let lo = (0 - i32::from(zp)) as f32;
    let hi = (255 - i32::from(zp)) as f32;
    let recip = on(knobs::QUANT_RECIPROCAL);
    let away = on(knobs::QUANT_ROUND_AWAY);
    let inv = 1.0f32 / scale;
    out.extend(data.iter().map(|&x| {
        let v = if recip { x * inv } else { x / scale };
        // maxps(v, lo) then minps(v, hi): a NaN in `v` yields the second operand. No NaN reaches here.
        let v = v.max(lo).min(hi);
        let r = if away { v.round() } else { v.round_ties_even() };
        (r as i32 + i32::from(zp)) as u8
    }));
}

/// A constant weight matrix B [K, N] prepared for the QGEMM, K padded with zeros to a whole number of quads.
/// An s8 B is packed as MLAS packs it for `MlasGemmU8S8KernelAvx2`: per K-quad, per column, the four bytes
/// `B[4q..4q+4][j]`. A u8 B is stored as K-pairs of i16 with its zero point subtracted, the `pmaddwd` operand of
/// `MlasGemmU8U8KernelAvx2`.
#[derive(Debug, Clone)]
pub struct QWeights {
    pub k: usize,
    pub n: usize,
    /// K rounded up to a multiple of 4.
    k4: usize,
    signed: bool,
    /// s8: [k4 / 4][N][4] bytes.
    quads: Vec<i8>,
    /// u8: [k4 / 2][N] packed (lo, hi) i16 pairs.
    pairs: Vec<i32>,
    colsum: Vec<i32>,
}

#[inline]
fn pack_pair(lo: i32, hi: i32) -> i32 {
    ((lo as i16 as u16 as u32) | ((hi as i16 as u16 as u32) << 16)) as i32
}

#[inline]
fn unpack_pair(p: i32) -> (i32, i32) {
    (i32::from(p as i16), i32::from((p >> 16) as i16))
}

impl QWeights {
    pub fn new_s8(b: &[i8], k: usize, n: usize) -> QWeights {
        Self::build(k, n, true, b.iter().map(|&v| i32::from(v)))
    }

    pub fn new_u8(b: &[u8], k: usize, n: usize, zp: u8) -> QWeights {
        Self::build(k, n, false, b.iter().map(|&v| i32::from(v) - i32::from(zp)))
    }

    fn build(k: usize, n: usize, signed: bool, vals: impl Iterator<Item = i32>) -> QWeights {
        let k4 = k.div_ceil(4) * 4;
        let mut rows: Vec<i32> = vals.take(k * n).collect();
        assert_eq!(rows.len(), k * n, "QWeights: B has fewer than K·N elements");
        rows.resize(k4 * n, 0);
        let mut colsum = vec![0i32; n];
        for r in rows.chunks_exact(n) {
            for (c, &v) in colsum.iter_mut().zip(r) {
                *c += v;
            }
        }
        let (mut quads, mut pairs) = (Vec::new(), Vec::new());
        if signed {
            quads = vec![0i8; k4 * n];
            for q in 0..k4 / 4 {
                for j in 0..n {
                    for i in 0..4 {
                        quads[(q * n + j) * 4 + i] = rows[(4 * q + i) * n + j] as i8;
                    }
                }
            }
        } else {
            pairs = vec![0i32; k4 / 2 * n];
            for p in 0..k4 / 2 {
                for j in 0..n {
                    pairs[p * n + j] = pack_pair(rows[2 * p * n + j], rows[(2 * p + 1) * n + j]);
                }
            }
        }
        QWeights {
            k,
            n,
            k4,
            signed,
            quads,
            pairs,
            colsum,
        }
    }

    /// `MlasGemm` over quantized A [M, K] (u8, zero point `za`) and this B: the int32 result
    /// `Σ (a - za)(b - zb)` as the dispatched kernel computes it.
    ///
    /// u8 × s8 (`MlasGemmU8S8KernelAvx2`): each K-quad goes through `vpmaddubsw`, which adds the two
    /// adjacent u8·s8 products and SATURATES the pair to int16, then `vpmaddwd` with ones, exact in int32;
    /// the zero-point term `-za · colsum(B)` is added exactly. The pairs are (k, k+1) for even k, and the
    /// RAW bytes of A (not A - za) are multiplied, so saturation depends on the raw bytes. The row-sum term
    /// `(rowsum - K·za)·(-zb)` vanishes because an s8 B has zero point 0 (checked at load).
    /// u8 × u8 (`MlasGemmU8U8KernelAvx2`): both sides widened to int16 and `vpmaddwd`, exact.
    pub fn gemm(&self, a: &[u8], m: usize, za: u8, out: &mut Vec<i32>) {
        let (k, n) = (self.k, self.n);
        assert_eq!(a.len(), m * k);
        out.clear();
        out.resize(m * n, 0);
        let saturate = !on(knobs::NO_U8S8_SATURATION);
        if self.signed {
            // [M][k4/4] A quads; the K loop is outside the M loop so one quad-row of B serves every row of A
            // from L1 (MLAS blocks the same way; integer sums do not depend on the order).
            let nq = self.k4 / 4;
            let mut aquads = vec![0u32; m * nq];
            for (i, &v) in a.iter().enumerate() {
                let (mm, kk) = (i / k, i % k);
                aquads[mm * nq + kk / 4] |= u32::from(v) << (8 * (kk % 4));
            }
            for q in 0..nq {
                let brow = &self.quads[q * n * 4..(q + 1) * n * 4];
                for mm in 0..m {
                    accumulate_quads_u8s8(
                        aquads[mm * nq + q],
                        brow,
                        n,
                        saturate,
                        &mut out[mm * n..(mm + 1) * n],
                    );
                }
            }
            let za = i32::from(za);
            for acc in out.chunks_exact_mut(n) {
                for (c, &cs) in acc.iter_mut().zip(&self.colsum) {
                    *c -= za * cs;
                }
            }
        } else {
            let np = self.k4 / 2;
            let at = |mm: usize, i: usize| {
                if i < k {
                    i32::from(a[mm * k + i]) - i32::from(za)
                } else {
                    0
                }
            };
            for p in 0..np {
                let brow = &self.pairs[p * n..(p + 1) * n];
                for mm in 0..m {
                    let ap = pack_pair(at(mm, 2 * p), at(mm, 2 * p + 1));
                    accumulate_pairs_u8u8(ap, brow, &mut out[mm * n..(mm + 1) * n]);
                }
            }
        }
    }
}

/// `acc[j] += sat16(a0·b0 + a1·b1) + sat16(a2·b2 + a3·b3)` for one K-quad (a u8, b s8): `brow` is that quad's
/// [N][4] bytes.
fn accumulate_quads_u8s8(aq: u32, brow: &[i8], n: usize, saturate: bool, acc: &mut [i32]) {
    if aq == 0 {
        return;
    }
    #[cfg(target_arch = "x86_64")]
    {
        if saturate && std::arch::is_x86_feature_detected!("avx2") {
            // SAFETY: AVX2 is present (checked above).
            unsafe { accumulate_quads_u8s8_avx2(aq, brow, n, acc) };
            return;
        }
    }
    accumulate_quads_u8s8_scalar(aq, brow, n, saturate, acc);
}

fn accumulate_quads_u8s8_scalar(aq: u32, brow: &[i8], n: usize, saturate: bool, acc: &mut [i32]) {
    let sat = |s: i32| {
        if saturate {
            s.clamp(i16::MIN as i32, i16::MAX as i32)
        } else {
            s
        }
    };
    let a = aq.to_le_bytes().map(i32::from);
    for (c, b) in acc[..n].iter_mut().zip(brow.as_chunks::<4>().0) {
        let (b0, b1, b2, b3) = (
            i32::from(b[0]),
            i32::from(b[1]),
            i32::from(b[2]),
            i32::from(b[3]),
        );
        *c += sat(a[0] * b0 + a[1] * b1) + sat(a[2] * b2 + a[3] * b3);
    }
}

/// The MLAS inner loop itself: broadcast the A quad, `vpmaddubsw` against 8 columns' quads, `vpmaddwd` with ones.
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn accumulate_quads_u8s8_avx2(aq: u32, brow: &[i8], n: usize, acc: &mut [i32]) {
    use std::arch::x86_64::*;
    assert!(brow.len() >= 4 * n && acc.len() >= n);
    let ones = _mm256_set1_epi16(1);
    let av = _mm256_set1_epi32(aq as i32);
    let n8 = n / 8 * 8;
    let mut j = 0;
    while j < n8 {
        // SAFETY: 4·(j + 8) <= 4·n <= brow.len(), and j + 8 <= n <= acc.len().
        unsafe {
            let b = _mm256_loadu_si256(brow.as_ptr().add(4 * j) as *const __m256i);
            let s = _mm256_madd_epi16(_mm256_maddubs_epi16(av, b), ones);
            let c = _mm256_loadu_si256(acc.as_ptr().add(j) as *const __m256i);
            _mm256_storeu_si256(
                acc.as_mut_ptr().add(j) as *mut __m256i,
                _mm256_add_epi32(c, s),
            );
        }
        j += 8;
    }
    accumulate_quads_u8s8_scalar(aq, &brow[4 * n8..], n - n8, true, &mut acc[n8..]);
}

/// `acc[j] += a_lo·b_lo + a_hi·b_hi` for one packed i16 pair, exact.
fn accumulate_pairs_u8u8(ap: i32, brow: &[i32], acc: &mut [i32]) {
    if ap == 0 {
        return;
    }
    let (a0, a1) = unpack_pair(ap);
    for (c, &bp) in acc.iter_mut().zip(brow) {
        let (b0, b1) = unpack_pair(bp);
        *c += a0 * b0 + a1 * b1;
    }
}

/// `MLAS_QGEMM_SCALE_BIAS_OUTPUT_PROCESSOR` in ZeroMode, without bias: `out = float(acc) · scale`, the scale
/// per matrix (`scale.len() == 1`) or per column. `acc` and `out` are [M, N].
pub fn dequant(acc: &[i32], scale: &[f32], out: &mut [f32]) {
    let n = if scale.len() == 1 {
        out.len()
    } else {
        scale.len()
    };
    for (orow, arow) in out.chunks_exact_mut(n).zip(acc.chunks_exact(n)) {
        if scale.len() == 1 {
            let s = scale[0];
            for (o, &a) in orow.iter_mut().zip(arow) {
                *o = a as f32 * s;
            }
        } else {
            for ((o, &a), &s) in orow.iter_mut().zip(arow).zip(scale) {
                *o = a as f32 * s;
            }
        }
    }
}

/// The same processor in AccumulateMode (the LSTM's recurrent GEMM): `out = float(acc) · scale + out`. On this
/// build `MlasMultiplyAddFloat32x4` is SSE2 `_mm_add_ps(_mm_mul_ps(..))` — two roundings, not an FMA.
pub fn dequant_accumulate(acc: &[i32], scale: &[f32], out: &mut [f32]) {
    let fma = on(knobs::FMA_ACCUMULATE);
    let n = if scale.len() == 1 {
        out.len()
    } else {
        scale.len()
    };
    for (orow, arow) in out.chunks_exact_mut(n).zip(acc.chunks_exact(n)) {
        for (j, (o, &a)) in orow.iter_mut().zip(arow).enumerate() {
            let s = if scale.len() == 1 { scale[0] } else { scale[j] };
            *o = if fma {
                (a as f32).mul_add(s, *o)
            } else {
                a as f32 * s + *o
            };
        }
    }
}

#[inline(always)]
fn madd(a: f32, b: f32, c: f32, fma: bool) -> f32 {
    if fma { a.mul_add(b, c) } else { a * b + c }
}

/// One element of `MlasComputeLogisticF32KernelFma3` (mlas/lib/x86_64/LogisticKernelFma3.S, constants from
/// logistic.cpp).
#[inline(always)]
fn logistic1(x: f32, fma: bool) -> f32 {
    const A9: f32 = 4.37031012579801e-11;
    const A7: f32 = 1.15627324459942e-07;
    const A5: f32 = 6.08574864600143e-05;
    const A3: f32 = 8.51377133304701e-03;
    const A1: f32 = 2.48287947061529e-01;
    const B10: f32 = 6.10247389755681e-13;
    const B8: f32 = 5.76102136993427e-09;
    const B6: f32 = 6.29106785017040e-06;
    const B4: f32 = 1.70198817374094e-03;
    const B2: f32 = 1.16817656904453e-01;
    const B0: f32 = 9.93151921023180e-01;
    // vmaxps(lower, x) then vminps(upper, x): with no NaN, a plain clamp.
    let xv = x.max(-18.0).min(18.0);
    let x2 = xv * xv;
    let mut p = madd(x2, A9, A7, fma);
    p = madd(x2, p, A5, fma);
    p = madd(x2, p, A3, fma);
    p = madd(x2, p, A1, fma);
    let mut q = madd(x2, B10, B8, fma);
    q = madd(x2, q, B6, fma);
    q = madd(x2, q, B4, fma);
    q = madd(x2, q, B2, fma);
    q = madd(x2, q, B0, fma);
    let p = xv * p;
    // Only the lower clamp: the FMA3 kernel has no `min(.., 1)`.
    (p / q + 0.5).max(0.0)
}

/// One element of `MlasComputeTanhF32KernelFma3` (mlas/lib/x86_64/TanhKernelFma3.S, constants from tanh.cpp).
#[inline(always)]
fn tanh1(x: f32, fma: bool) -> f32 {
    const A13: f32 = -2.76076847742355e-16;
    const A11: f32 = 2.00018790482477e-13;
    const A9: f32 = -8.60467152213735e-11;
    const A7: f32 = 5.12229709037114e-08;
    const A5: f32 = 1.48572235717979e-05;
    const A3: f32 = 6.37261928875436e-04;
    const A1: f32 = 4.89352455891786e-03;
    const B6: f32 = 1.19825839466702e-06;
    const B4: f32 = 1.18534705686654e-04;
    const B2: f32 = 2.26843463243900e-03;
    const B0: f32 = 4.89352518554385e-03;
    let xv = x.max(-9.0).min(9.0);
    let x2 = xv * xv;
    let mut p = madd(x2, A13, A11, fma);
    p = madd(x2, p, A9, fma);
    p = madd(x2, p, A7, fma);
    p = madd(x2, p, A5, fma);
    p = madd(x2, p, A3, fma);
    p = madd(x2, p, A1, fma);
    let mut q = madd(x2, B6, B4, fma);
    q = madd(x2, q, B2, fma);
    q = madd(x2, q, B0, fma);
    (xv * p) / q
}

// The same loops compiled with hardware FMA (`mul_add` is otherwise a call to libm `fmaf`). FMA is exactly
// rounded either way, so the two builds give identical bits; this is only speed.
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2,fma")]
unsafe fn logistic_fma3(v: &mut [f32]) {
    for x in v.iter_mut() {
        *x = logistic1(*x, true);
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2,fma")]
unsafe fn tanh_fma3(v: &mut [f32]) {
    for x in v.iter_mut() {
        *x = tanh1(*x, true);
    }
}

fn has_fma3() -> bool {
    #[cfg(target_arch = "x86_64")]
    {
        std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma")
    }
    #[cfg(not(target_arch = "x86_64"))]
    {
        false
    }
}

/// `MlasComputeLogistic` as dispatched on an FMA3 machine.
pub fn logistic(v: &mut [f32]) {
    if on(knobs::LIBM_LOGISTIC) {
        for x in v.iter_mut() {
            *x = 1.0 / (1.0 + (-*x).exp());
        }
        return;
    }
    let fma = !on(knobs::POLY_NO_FMA);
    #[cfg(target_arch = "x86_64")]
    if fma && has_fma3() {
        // SAFETY: AVX2 and FMA are present.
        unsafe { logistic_fma3(v) };
        return;
    }
    for x in v.iter_mut() {
        *x = logistic1(*x, fma);
    }
}

/// `MlasComputeTanh` as dispatched on an FMA3 machine.
pub fn tanh(v: &mut [f32]) {
    if on(knobs::LIBM_TANH) {
        for x in v.iter_mut() {
            *x = x.tanh();
        }
        return;
    }
    let fma = !on(knobs::POLY_NO_FMA);
    #[cfg(target_arch = "x86_64")]
    if fma && has_fma3() {
        // SAFETY: AVX2 and FMA are present.
        unsafe { tanh_fma3(v) };
        return;
    }
    for x in v.iter_mut() {
        *x = tanh1(*x, fma);
    }
}

/// A C hex-float literal `0x1.<frac24>p<exp>` (6 hex digits = 24 bits, the last of which must be 0).
const fn hexf(frac24: u32, exp: i32) -> f32 {
    assert!(frac24 & 1 == 0);
    f32::from_bits((((127 + exp) as u32) << 23) | (frac24 >> 1))
}

/// `MlasComputeSumExpF32KernelFma3` (mlas/lib/x86_64/TransKernelFma3.S, constants `MlasExpConstants` in
/// compute.cpp): writes `exp(x + neg_max)` for each element and returns their sum, accumulated as the kernel
/// does — eight lane accumulators, then `vhaddps`×2 within each 128-bit half and the two halves added.
pub fn sum_exp(input: &[f32], neg_max: f32, out: &mut [f32]) -> f32 {
    const LOWER_RANGE_SUM_EXP: f32 = -88.3762626647949;
    const ROUNDING_BIAS: f32 = 12582912.0;
    const LOG2_RECIPROCAL: f32 = 1.44269504088896341;
    const LOG2_HIGH: f32 = -6.93145752e-1;
    const LOG2_LOW: f32 = -1.42860677e-6;
    const P0: f32 = hexf(0x694000, -10);
    const P1: f32 = hexf(0x125edc, -7);
    const P2: f32 = hexf(0x555b5a, -5);
    const P3: f32 = hexf(0x555450, -3);
    const P4: f32 = hexf(0xfffff6, -2);
    const P56: f32 = hexf(0x000000, 0);
    const MAXIMUM_EXPONENT: i32 = 0x3F800000;
    let exp1 = |v: f32| -> f32 {
        let x = (neg_max + v).max(LOWER_RANGE_SUM_EXP);
        let biased = x.mul_add(LOG2_RECIPROCAL, ROUNDING_BIAS);
        let m = biased - ROUNDING_BIAS;
        let x = m.mul_add(LOG2_HIGH, x);
        let x = m.mul_add(LOG2_LOW, x);
        let mut p = P0.mul_add(x, P1);
        p = p.mul_add(x, P2);
        p = p.mul_add(x, P3);
        p = p.mul_add(x, P4);
        p = p.mul_add(x, P56);
        p = p.mul_add(x, P56);
        // vpslld 23 then vpaddd the exponent bias: integer arithmetic on the biased float's bits.
        let scale =
            f32::from_bits(((biased.to_bits() << 23) as i32).wrapping_add(MAXIMUM_EXPONENT) as u32);
        p * scale
    };
    let mut acc = [0f32; 8];
    // The 24-wide loop adds three vectors in order, the 8-wide loop one; lane-wise that is one add per element
    // in input order, so a single pass reproduces both. A partial last vector adds 0.0 in its unused lanes.
    for (i, (&v, o)) in input.iter().zip(out.iter_mut()).enumerate() {
        let e = exp1(v);
        *o = e;
        acc[i % 8] += e;
    }
    let lo = (acc[0] + acc[1]) + (acc[2] + acc[3]);
    let hi = (acc[4] + acc[5]) + (acc[6] + acc[7]);
    hi + lo
}

/// `MlasComputeSoftmax` for one row (compute.cpp): the maximum, `sum_exp`, then every element multiplied by
/// `1 / sum` (`MlasComputeSoftmaxOutputF32KernelAvx`).
pub fn softmax_row(row: &mut [f32]) {
    let max = row.iter().copied().fold(f32::MIN, f32::max);
    if on(knobs::LIBM_SOFTMAX) {
        let mut sum = 0.0f32;
        for v in row.iter_mut() {
            *v = (*v - max).exp();
            sum += *v;
        }
        for v in row.iter_mut() {
            *v /= sum;
        }
        return;
    }
    let input = row.to_vec();
    let sum = sum_exp(&input, -max, row);
    let scale = 1.0f32 / sum;
    for v in row.iter_mut() {
        *v *= scale;
    }
}

/// Eigen 3.4's `Map<VectorXf>::sum()` (Redux.h, `LinearVectorizedTraversal`) with SSE `Packet4f`, as ORT's
/// `ReduceSum` computes a contiguous row: two packet accumulators over the 16-byte-aligned body, the
/// unaligned head and the tail added afterwards one by one. `align_offset` is the row's start in floats from
/// a 16-byte boundary (ORT buffers are 64-byte aligned, so a row at element offset `o` has `o % 4`).
pub fn eigen_sum(x: &[f32], align_offset: usize) -> f32 {
    let size = x.len();
    if size == 0 {
        return 0.0;
    }
    if on(knobs::NAIVE_FLOAT_REDUCTIONS) {
        return x.iter().fold(0.0f32, |a, &v| a + v);
    }
    let aligned_start = ((4 - align_offset % 4) % 4).min(size);
    let aligned_size2 = (size - aligned_start) / 8 * 8;
    let aligned_size = (size - aligned_start) / 4 * 4;
    let aligned_end2 = aligned_start + aligned_size2;
    let aligned_end = aligned_start + aligned_size;
    let load = |i: usize| [x[i], x[i + 1], x[i + 2], x[i + 3]];
    let add = |a: [f32; 4], b: [f32; 4]| [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
    if aligned_size == 0 {
        let mut res = x[0];
        for &v in &x[1..] {
            res += v;
        }
        return res;
    }
    let mut p0 = load(aligned_start);
    if aligned_size > 4 {
        let mut p1 = load(aligned_start + 4);
        let mut i = aligned_start + 8;
        while i < aligned_end2 {
            p0 = add(p0, load(i));
            p1 = add(p1, load(i + 4));
            i += 8;
        }
        p0 = add(p0, p1);
        if aligned_end > aligned_end2 {
            p0 = add(p0, load(aligned_end2));
        }
    }
    // predux<Packet4f>: tmp = a + movehl(a) = [a0+a2, a1+a3, ..]; tmp0 + tmp1.
    let mut res = (p0[0] + p0[2]) + (p0[1] + p0[3]);
    for &v in &x[..aligned_start] {
        res += v;
    }
    for &v in &x[aligned_end..] {
        res += v;
    }
    res
}

/// `MlasSgemmKernelM1Avx` (mlas/lib/x86_64/SgemmKernelM1Avx.S), beta = 0: `c = a · B` for one row `a` [K] and
/// B [K, N]. K is consumed in groups of 4, then a group of 2, then 1; each group's products are summed left to
/// right (`vmulps` then `vaddps`, no FMA) and only then added to C, which is 0.0 for the first group.
pub fn sgemm_m1(a: &[f32], b: &[f32], n: usize, c: &mut [f32]) {
    let k = a.len();
    assert_eq!(b.len(), k * n);
    let mut first = true;
    let mut kk = 0;
    if on(knobs::NAIVE_FLOAT_REDUCTIONS) {
        for j in 0..n {
            c[j] = (0..k).fold(0.0f32, |acc, kk| acc + a[kk] * b[kk * n + j]);
        }
        return;
    }
    let group = |kk: usize, g: usize, first: bool, c: &mut [f32]| {
        for j in 0..n {
            let mut t = a[kk] * b[kk * n + j];
            for i in 1..g {
                t += a[kk + i] * b[(kk + i) * n + j];
            }
            c[j] = t + if first { 0.0 } else { c[j] };
        }
    };
    while kk + 4 <= k {
        group(kk, 4, first, c);
        first = false;
        kk += 4;
    }
    if k - kk >= 2 {
        group(kk, 2, first, c);
        first = false;
        kk += 2;
    }
    if k - kk == 1 {
        group(kk, 1, first, c);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quant_params_include_zero() {
        // All-positive input: min widens to 0, so zp = 0 and scale = max / 255.
        let (s, zp) = quant_params_u8(&[0.5, 1.0, 2.0]);
        assert_eq!(zp, 0);
        assert_eq!(s, 2.0f32 / 255.0);
        // All zeros: scale 1, zp 0 (the first recurrent step).
        assert_eq!(quant_params_u8(&[0.0; 8]), (1.0, 0));
    }

    #[test]
    fn quantize_rounds_half_to_even() {
        let mut out = Vec::new();
        quantize_u8(&[0.5, 1.5, 2.5, -1.0, 300.0], 1.0, 0, &mut out);
        assert_eq!(out, vec![0, 2, 2, 0, 255]);
    }

    #[test]
    fn u8s8_pair_saturates_to_int16() {
        // K = 2: 255·127 + 255·127 = 64770 saturates to 32767.
        let w = QWeights::new_s8(&[127, 127], 2, 1);
        let mut out = Vec::new();
        w.gemm(&[255, 255], 1, 0, &mut out);
        assert_eq!(out, vec![32767]);
        // The two halves of a quad saturate separately: K = 4 gives 2 · 32767.
        let w = QWeights::new_s8(&[127; 4], 4, 1);
        w.gemm(&[255; 4], 1, 0, &mut out);
        assert_eq!(out, vec![65534]);
        // Zero point: (a - za)·b exactly, with the saturated raw product: 32767 - 10·254.
        w.gemm(&[255; 4], 1, 10, &mut out);
        assert_eq!(out, vec![65534 - 10 * 508]);
    }

    #[test]
    fn simd_and_scalar_quad_kernels_agree() {
        // A deterministic pseudo-random walk over the full operand ranges, N not a multiple of 8.
        let mut x = 12345u32;
        let mut next = || {
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            x
        };
        let n = 37;
        let mut s = vec![0i32; n];
        let mut v = vec![0i32; n];
        for _ in 0..40 {
            let aq = next();
            let bq: Vec<i8> = (0..n * 4).map(|_| next() as i8).collect();
            accumulate_quads_u8s8_scalar(aq, &bq, n, true, &mut s);
            accumulate_quads_u8s8(aq, &bq, n, true, &mut v);
        }
        assert_eq!(s, v);
    }

    #[test]
    fn fma3_build_matches_portable_build() {
        let x: Vec<f32> = (-4000..=4000).map(|i| i as f32 * 0.00731).collect();
        let (mut a, mut b) = (x.clone(), x.clone());
        logistic(&mut a);
        tanh(&mut b);
        for i in 0..x.len() {
            assert_eq!(a[i].to_bits(), logistic1(x[i], true).to_bits());
            assert_eq!(b[i].to_bits(), tanh1(x[i], true).to_bits());
        }
    }

    #[test]
    fn hex_float_constants() {
        assert_eq!(hexf(0x000000, 0), 1.0);
        assert_eq!(hexf(0x800000, -1), 0.75);
    }

    #[test]
    fn softmax_and_sums_are_close_to_exact() {
        let mut row: Vec<f32> = (0..37).map(|i| (i as f32 * 0.37).sin() * 4.0).collect();
        let x = row.clone();
        softmax_row(&mut row);
        let m = x.iter().copied().fold(f32::MIN, f32::max);
        let z: f64 = x.iter().map(|&v| ((v - m) as f64).exp()).sum();
        for (r, &v) in row.iter().zip(&x) {
            assert!((*r as f64 - ((v - m) as f64).exp() / z).abs() < 1e-6);
        }
        let s: f32 = x.iter().sum();
        assert!((eigen_sum(&x, 0) - s).abs() < 1e-4);
        assert!((eigen_sum(&x, 3) - s).abs() < 1e-4);
        let b: Vec<f32> = (0..37 * 5).map(|i| i as f32 * 0.01).collect();
        let mut c = vec![0f32; 5];
        sgemm_m1(&x, &b, 5, &mut c);
        for j in 0..5 {
            let e: f32 = (0..37).map(|kk| x[kk] * b[kk * 5 + j]).sum();
            assert!((c[j] - e).abs() < 1e-3);
        }
    }

    #[test]
    fn logistic_and_tanh_are_close_to_libm() {
        let mut v: Vec<f32> = (-40..=40).map(|i| i as f32 * 0.25).collect();
        let x = v.clone();
        let mut t = v.clone();
        logistic(&mut v);
        tanh(&mut t);
        for i in 0..x.len() {
            assert!(
                (v[i] - 1.0 / (1.0 + (-x[i]).exp())).abs() < 1e-6,
                "logistic({})",
                x[i]
            );
            assert!((t[i] - x[i].tanh()).abs() < 1e-6, "tanh({})", x[i]);
        }
    }
}
