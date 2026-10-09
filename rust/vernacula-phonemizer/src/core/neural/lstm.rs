//! `com.microsoft.DynamicQuantizeLSTM`, as ONNX Runtime 1.27.0 computes it on CPU: contrib_ops/cpu/quantization/
//! dynamic_quantize_lstm.cc → providers/cpu/rnn/lstm_base.cc → uni_directional_lstm.cc, with the quantized GEMM of
//! rnn_helpers.cc (`ComputeGemm` for `GemmWeights<uint8_t>`). Batch 1 only: for batch ≥ 2 ORT splits the batch
//! across threads and each split quantizes its own rows, so the result would depend on the thread count.

use super::NeuralError;
use super::mlas::{self, QWeights};
use super::tensor::{Data, Tensor};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Direction {
    Forward,
    Reverse,
    Bidirectional,
}

/// One direction's constant weights, prepared at load.
#[derive(Debug)]
struct DirWeights {
    w: QWeights,
    r: QWeights,
    /// One scale (per-tensor) or 4H (per-column), as in the model.
    w_scale: Vec<f32>,
    r_scale: Vec<f32>,
}

#[derive(Debug)]
pub struct Lstm {
    pub direction: Direction,
    pub hidden: usize,
    pub clip: f32,
    dirs: Vec<DirWeights>,
    input_size: usize,
}

fn scales_for(
    t: &Tensor,
    d: usize,
    nd: usize,
    h4: usize,
    what: &str,
) -> Result<Vec<f32>, NeuralError> {
    let v = t.as_f32()?;
    match t.shape.as_slice() {
        [n] if *n == nd => Ok(vec![v[d]]),
        [n, c] if *n == nd && *c == h4 => Ok(v[d * h4..(d + 1) * h4].to_vec()),
        s => Err(NeuralError::Unsupported(format!(
            "DynamicQuantizeLSTM {what} scale shape {s:?}"
        ))),
    }
}

fn weights_for(
    t: &Tensor,
    zp: &Tensor,
    d: usize,
    k: usize,
    h4: usize,
    what: &str,
) -> Result<QWeights, NeuralError> {
    let per = k * h4;
    match (&t.data, &zp.data) {
        (Data::I8(w), Data::I8(z)) => {
            if z.iter().any(|&x| x != 0) {
                return Err(NeuralError::Unsupported(format!(
                    "DynamicQuantizeLSTM {what}: int8 weights need zero point 0"
                )));
            }
            Ok(QWeights::new_s8(&w[d * per..(d + 1) * per], k, h4))
        }
        (Data::U8(w), Data::U8(z)) => {
            let z0 = z[0];
            if z.iter().any(|&x| x != z0) {
                return Err(NeuralError::Unsupported(format!(
                    "DynamicQuantizeLSTM {what}: uint8 zero point must be constant"
                )));
            }
            Ok(QWeights::new_u8(&w[d * per..(d + 1) * per], k, h4, z0))
        }
        _ => Err(NeuralError::Unsupported(format!(
            "DynamicQuantizeLSTM {what}: weight/zero-point types"
        ))),
    }
}

impl Lstm {
    /// `w`, `r` [D, K, 4H]; scales [D] or [D, 4H]; zero points the same shape as their scales.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        direction: Direction,
        hidden: usize,
        clip: f32,
        w: &Tensor,
        r: &Tensor,
        w_scale: &Tensor,
        w_zp: &Tensor,
        r_scale: &Tensor,
        r_zp: &Tensor,
    ) -> Result<Lstm, NeuralError> {
        let nd = if direction == Direction::Bidirectional {
            2
        } else {
            1
        };
        let h4 = 4 * hidden;
        let (input_size, rk) = match (w.shape.as_slice(), r.shape.as_slice()) {
            ([a, i, n], [b, hh, m])
                if *a == nd && *b == nd && *n == h4 && *m == h4 && *hh == hidden =>
            {
                (*i, *hh)
            }
            (ws, rs) => {
                return Err(NeuralError::Unsupported(format!(
                    "DynamicQuantizeLSTM weight shapes {ws:?} / {rs:?}"
                )));
            }
        };
        let mut dirs = Vec::new();
        for d in 0..nd {
            dirs.push(DirWeights {
                w: weights_for(w, w_zp, d, input_size, h4, "W")?,
                r: weights_for(r, r_zp, d, rk, h4, "R")?,
                w_scale: scales_for(w_scale, d, nd, h4, "W")?,
                r_scale: scales_for(r_scale, d, nd, h4, "R")?,
            });
        }
        Ok(Lstm {
            direction,
            hidden,
            clip,
            dirs,
            input_size,
        })
    }

    /// X [T, 1, I]; B [D, 8H]; initial h/c [D, 1, H]. Returns Y [T, D, 1, H], Y_h [D, 1, H], Y_c [D, 1, H].
    pub fn run(
        &self,
        x: &Tensor,
        bias: Option<&Tensor>,
        init_h: Option<&Tensor>,
        init_c: Option<&Tensor>,
    ) -> Result<[Tensor; 3], NeuralError> {
        let h = self.hidden;
        let h4 = 4 * h;
        let nd = self.dirs.len();
        let (t_len, batch, isz) = match x.shape.as_slice() {
            [t, b, i] => (*t, *b, *i),
            s => {
                return Err(NeuralError::Run(format!(
                    "DynamicQuantizeLSTM input X must be 3-D, got {s:?}"
                )));
            }
        };
        if batch != 1 {
            return Err(NeuralError::Unsupported(format!(
                "DynamicQuantizeLSTM batch {batch}: only batch 1 is ORT-reproducible"
            )));
        }
        if isz != self.input_size {
            return Err(NeuralError::Run(format!(
                "DynamicQuantizeLSTM input size {isz}, weights expect {}",
                self.input_size
            )));
        }
        let xs = x.as_f32()?;
        let bias = bias.map(|b| b.as_f32()).transpose()?;
        if let Some(b) = bias
            && b.len() != nd * 8 * h
        {
            return Err(NeuralError::Run(
                "DynamicQuantizeLSTM bias must be [D, 8H]".into(),
            ));
        }
        let state = |t: Option<&Tensor>, what: &str| -> Result<Option<Vec<f32>>, NeuralError> {
            match t {
                None => Ok(None),
                Some(t) if t.len() == nd * h => Ok(Some(t.as_f32()?.to_vec())),
                Some(t) => Err(NeuralError::Run(format!(
                    "DynamicQuantizeLSTM {what} shape {:?}",
                    t.shape
                ))),
            }
        };
        let init_h = state(init_h, "initial_h")?;
        let init_c = state(init_c, "initial_c")?;

        let mut y = vec![0f32; t_len * nd * h];
        let mut y_h = vec![0f32; nd * h];
        let mut y_c = vec![0f32; nd * h];
        let mut q = Vec::new();
        let mut acc = Vec::new();
        for (d, dw) in self.dirs.iter().enumerate() {
            let reverse = self.direction == Direction::Reverse
                || (self.direction == Direction::Bidirectional && d == 1);
            // `ReverseSequence` over the full length (no sequence_lens).
            let input: Vec<f32> = if reverse {
                (0..t_len)
                    .rev()
                    .flat_map(|t| xs[t * isz..(t + 1) * isz].iter().copied())
                    .collect()
            } else {
                xs.to_vec()
            };
            // Wb + Rb, fused per gate (`LoadBias`), gate order i, o, f, c.
            let fused: Option<Vec<f32>> = bias.map(|b| {
                let b = &b[d * 8 * h..(d + 1) * 8 * h];
                (0..h4).map(|j| b[j] + b[j + h4]).collect()
            });

            // Xt·W for every step at once: one quantization of the whole input.
            let mut iofc = vec![0f32; t_len * h4];
            if t_len > 0 {
                let (sa, za) = mlas::quant_params_u8(&input);
                mlas::quantize_u8(&input, sa, za, &mut q);
                dw.w.gemm(&q, t_len, za, &mut acc);
                let mult: Vec<f32> = dw.w_scale.iter().map(|&s| sa * s).collect();
                mlas::dequant(&acc, &mult, &mut iofc);
            }

            let mut hp: Vec<f32> = init_h
                .as_ref()
                .map(|v| v[d * h..(d + 1) * h].to_vec())
                .unwrap_or_else(|| vec![0.0; h]);
            let mut cp: Vec<f32> = init_c
                .as_ref()
                .map(|v| v[d * h..(d + 1) * h].to_vec())
                .unwrap_or_else(|| vec![0.0; h]);
            let mut outs = vec![0f32; t_len * h];
            let mut tmp = vec![0f32; h];
            for t in 0..t_len {
                let g = &mut iofc[t * h4..(t + 1) * h4];
                // + H(t-1)·R, accumulated into the input projection by the post-processor.
                let (sh, zh) = mlas::quant_params_u8(&hp);
                mlas::quantize_u8(&hp, sh, zh, &mut q);
                dw.r.gemm(&q, 1, zh, &mut acc);
                let mult: Vec<f32> = dw.r_scale.iter().map(|&s| sh * s).collect();
                mlas::dequant_accumulate(&acc, &mult, g);
                // `clip_add_bias` / `clip_ignore_bias`: x = min(clip, x + b); x = max(-clip, x).
                match &fused {
                    Some(b) => {
                        for (v, &bb) in g.iter_mut().zip(b) {
                            *v = (*v + bb).min(self.clip).max(-self.clip);
                        }
                    }
                    None => {
                        for v in g.iter_mut() {
                            *v = v.min(self.clip).max(-self.clip);
                        }
                    }
                }
                let (pi, rest) = g.split_at_mut(h);
                let (po, rest) = rest.split_at_mut(h);
                let (pf, pc) = rest.split_at_mut(h);
                mlas::logistic(pi);
                mlas::logistic(pf);
                mlas::tanh(pc);
                // `merge_lstm_gates_to_memory`: c = c_prev·f + i·g, no FMA.
                for j in 0..h {
                    cp[j] = cp[j] * pf[j] + pi[j] * pc[j];
                }
                mlas::logistic(po);
                // `tanh_m`: h = tanh(c)·o.
                tmp.copy_from_slice(&cp);
                mlas::tanh(&mut tmp);
                for j in 0..h {
                    hp[j] = tmp[j] * po[j];
                }
                outs[t * h..(t + 1) * h].copy_from_slice(&hp);
            }
            for t in 0..t_len {
                let src = if reverse { t_len - 1 - t } else { t };
                y[(t * nd + d) * h..(t * nd + d + 1) * h]
                    .copy_from_slice(&outs[src * h..(src + 1) * h]);
            }
            y_h[d * h..(d + 1) * h].copy_from_slice(&hp);
            y_c[d * h..(d + 1) * h].copy_from_slice(&cp);
        }
        Ok([
            Tensor::f32(vec![t_len, nd, 1, h], y)?,
            Tensor::f32(vec![nd, 1, h], y_h)?,
            Tensor::f32(vec![nd, 1, h], y_c)?,
        ])
    }
}
