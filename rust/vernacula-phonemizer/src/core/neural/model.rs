//! The graph interpreter: parse once, check every op and attribute at load, prepare constant weights, then run
//! the nodes in file order (ONNX requires a topological order) over a slot table.

use std::collections::HashMap;
use std::sync::Arc;

use super::NeuralError;
use super::lstm::{Direction, Lstm};
use super::mlas::{self, QWeights};
use super::proto::{AttrValue, ModelProto, NodeProto};
use super::tensor::{self, Data, Tensor};

#[derive(Debug)]
enum Op {
    Gather {
        axis: i64,
    },
    DequantizeLinear,
    Transpose {
        perm: Option<Vec<usize>>,
    },
    Shape {
        start: i64,
        end: Option<i64>,
    },
    Unsqueeze,
    Squeeze,
    Concat {
        axis: i64,
    },
    ConstantOfShape {
        value: Tensor,
    },
    Slice,
    Reshape {
        allowzero: bool,
    },
    DynamicQuantizeLstm(Box<Lstm>),
    DynamicQuantizeLinear,
    /// B constant, prepared at load.
    MatMulInteger(Box<QWeights>),
    Cast {
        to: i32,
    },
    Mul,
    Add,
    Not,
    ReduceSum {
        keepdims: bool,
        noop_with_empty_axes: bool,
    },
    Where,
    Softmax {
        axis: i64,
    },
    MatMul,
}

#[derive(Debug)]
struct Node {
    op: Op,
    name: String,
    /// Slot per input; `None` for an omitted optional input ("").
    inputs: Vec<Option<usize>>,
    outputs: Vec<Option<usize>>,
}

/// A loaded ONNX model, ready to run. Immutable after load, so one instance can serve many calls.
#[derive(Debug)]
pub struct OnnxModel {
    inputs: Vec<(String, usize)>,
    outputs: Vec<(String, usize)>,
    /// Initializers and `Constant` outputs; every other slot starts empty.
    constants: Vec<Option<Arc<Tensor>>>,
    nodes: Vec<Node>,
}

fn attr<'a>(n: &'a NodeProto, name: &str) -> Option<&'a AttrValue> {
    n.attributes
        .iter()
        .find(|a| a.name == name)
        .map(|a| &a.value)
}

fn attr_int(n: &NodeProto, name: &str, default: i64) -> Result<i64, NeuralError> {
    match attr(n, name) {
        None => Ok(default),
        Some(AttrValue::Int(i)) => Ok(*i),
        Some(_) => Err(NeuralError::Unsupported(format!(
            "{} attribute {name} is not an int",
            n.op_type
        ))),
    }
}

/// Refuse any attribute an op's implementation does not read: a silently ignored attribute is a wrong answer.
fn only_attrs(n: &NodeProto, allowed: &[&str]) -> Result<(), NeuralError> {
    for a in &n.attributes {
        if !allowed.contains(&a.name.as_str()) {
            return Err(NeuralError::Unsupported(format!(
                "{} node {:?}: attribute {:?} is not supported",
                n.op_type, n.name, a.name
            )));
        }
    }
    Ok(())
}

fn norm_axis(axis: i64, rank: usize) -> Result<usize, NeuralError> {
    let r = rank as i64;
    let a = if axis < 0 { axis + r } else { axis };
    if a < 0 || a >= r.max(1) {
        return Err(NeuralError::Run(format!(
            "axis {axis} out of range for rank {rank}"
        )));
    }
    Ok(a as usize)
}

fn strides(shape: &[usize]) -> Vec<usize> {
    let mut s = vec![1; shape.len()];
    for i in (0..shape.len().saturating_sub(1)).rev() {
        s[i] = s[i + 1] * shape[i + 1];
    }
    s
}

/// The input index of every output element, in output order, for an output of shape `out` whose coordinate `c`
/// reads input `base + Σ c[d]·step[d]` — a transpose, a slice or a broadcast. An odometer, no division.
fn strided_indices(out: &[usize], base: i64, step: &[i64]) -> Vec<usize> {
    let n: usize = out.iter().product();
    let mut idx = Vec::with_capacity(n);
    if n == 0 {
        return idx;
    }
    let r = out.len();
    let mut coord = vec![0usize; r];
    let mut cur = base;
    for _ in 0..n {
        idx.push(cur as usize);
        for d in (0..r).rev() {
            coord[d] += 1;
            cur += step[d];
            if coord[d] < out[d] {
                break;
            }
            cur -= step[d] * out[d] as i64;
            coord[d] = 0;
        }
    }
    idx
}

/// Index of every output element into an input broadcast to `out` (numpy rules).
fn broadcast_index(shape: &[usize], out: &[usize]) -> Vec<usize> {
    let off = out.len() - shape.len();
    let in_strides = strides(shape);
    let step: Vec<i64> = (0..out.len())
        .map(|d| {
            if d < off || shape[d - off] == 1 {
                0
            } else {
                in_strides[d - off] as i64
            }
        })
        .collect();
    strided_indices(out, 0, &step)
}

fn broadcast_shape(a: &[usize], b: &[usize]) -> Result<Vec<usize>, NeuralError> {
    let r = a.len().max(b.len());
    let mut out = vec![0; r];
    for i in 0..r {
        let da = if i + a.len() >= r {
            a[i + a.len() - r]
        } else {
            1
        };
        let db = if i + b.len() >= r {
            b[i + b.len() - r]
        } else {
            1
        };
        out[i] = match (da, db) {
            (x, y) if x == y => x,
            (1, y) => y,
            (x, 1) => x,
            _ => {
                return Err(NeuralError::Run(format!(
                    "cannot broadcast {a:?} with {b:?}"
                )));
            }
        };
    }
    Ok(out)
}

fn binary_f32(a: &Tensor, b: &Tensor, f: impl Fn(f32, f32) -> f32) -> Result<Tensor, NeuralError> {
    let (av, bv) = (a.as_f32()?, b.as_f32()?);
    if a.shape == b.shape {
        return Tensor::f32(
            a.shape.clone(),
            av.iter().zip(bv).map(|(&x, &y)| f(x, y)).collect(),
        );
    }
    let out = broadcast_shape(&a.shape, &b.shape)?;
    let ia = broadcast_index(&a.shape, &out);
    let ib = broadcast_index(&b.shape, &out);
    Tensor::f32(
        out,
        ia.iter().zip(&ib).map(|(&i, &j)| f(av[i], bv[j])).collect(),
    )
}

fn transpose(x: &Tensor, perm: &[usize]) -> Result<Tensor, NeuralError> {
    if perm.len() != x.shape.len() || perm.iter().any(|&p| p >= perm.len()) {
        return Err(NeuralError::Run(format!(
            "Transpose perm {perm:?} for shape {:?}",
            x.shape
        )));
    }
    let out: Vec<usize> = perm.iter().map(|&p| x.shape[p]).collect();
    let in_strides = strides(&x.shape);
    let step: Vec<i64> = perm.iter().map(|&p| in_strides[p] as i64).collect();
    let idx = strided_indices(&out, 0, &step);
    Tensor::new(out, x.data.select(idx.into_iter()))
}

fn scalar_f32(t: &Tensor, what: &str) -> Result<f32, NeuralError> {
    match &t.data {
        Data::F32(v) if v.len() == 1 => Ok(v[0]),
        _ => Err(NeuralError::Unsupported(format!(
            "{what}: expected a float scalar (per-tensor quantization)"
        ))),
    }
}

impl OnnxModel {
    /// Parse and prepare a model. Every op, domain and attribute the interpreter does not implement exactly is
    /// refused here, not at the first `run`.
    pub fn from_bytes(bytes: &[u8]) -> Result<OnnxModel, NeuralError> {
        let m = ModelProto::parse(bytes)?;
        for (domain, version) in &m.opsets {
            let ok = match domain.as_str() {
                "" | "ai.onnx" => (13..=21).contains(version),
                "com.microsoft" => *version == 1,
                _ => false,
            };
            if !ok {
                return Err(NeuralError::Unsupported(format!(
                    "opset {domain:?} version {version}"
                )));
            }
        }
        let g = &m.graph;
        let mut slots: HashMap<String, usize> = HashMap::new();
        let mut constants: Vec<Option<Arc<Tensor>>> = Vec::new();
        let mut slot = |name: &str, constants: &mut Vec<Option<Arc<Tensor>>>| -> usize {
            *slots.entry(name.to_string()).or_insert_with(|| {
                constants.push(None);
                constants.len() - 1
            })
        };
        for init in &g.initializers {
            let s = slot(&init.name, &mut constants);
            constants[s] = Some(Arc::new(Tensor::from_proto(init)?));
        }
        let inputs: Vec<(String, usize)> = g
            .inputs
            .iter()
            .filter(|n| !g.initializers.iter().any(|i| &i.name == *n))
            .map(|n| (n.clone(), slot(n, &mut constants)))
            .collect();

        let mut nodes = Vec::new();
        for n in &g.nodes {
            let ins: Vec<Option<usize>> = n
                .inputs
                .iter()
                .map(|i| {
                    if i.is_empty() {
                        None
                    } else {
                        Some(slot(i, &mut constants))
                    }
                })
                .collect();
            let outs: Vec<Option<usize>> = n
                .outputs
                .iter()
                .map(|o| {
                    if o.is_empty() {
                        None
                    } else {
                        Some(slot(o, &mut constants))
                    }
                })
                .collect();
            let konst = |i: usize| -> Option<Arc<Tensor>> {
                ins.get(i)
                    .copied()
                    .flatten()
                    .and_then(|s| constants[s].clone())
            };
            let domain = n.domain.as_str();
            let unsupported = || {
                NeuralError::Unsupported(format!(
                    "op {}::{} (node {:?})",
                    domain, n.op_type, n.name
                ))
            };
            if !(domain.is_empty() || domain == "ai.onnx" || domain == "com.microsoft") {
                return Err(unsupported());
            }
            let ms = domain == "com.microsoft";
            let op = match (ms, n.op_type.as_str()) {
                (false, "Constant") => {
                    only_attrs(n, &["value"])?;
                    let Some(AttrValue::Tensor(t)) = attr(n, "value") else {
                        return Err(unsupported());
                    };
                    let s = outs[0].ok_or_else(unsupported)?;
                    constants[s] = Some(Arc::new(Tensor::from_proto(t)?));
                    continue;
                }
                (false, "Gather") => {
                    only_attrs(n, &["axis"])?;
                    Op::Gather {
                        axis: attr_int(n, "axis", 0)?,
                    }
                }
                (false, "DequantizeLinear") => {
                    only_attrs(n, &["axis"])?;
                    Op::DequantizeLinear
                }
                (false, "Transpose") => {
                    only_attrs(n, &["perm"])?;
                    let perm = match attr(n, "perm") {
                        None => None,
                        Some(AttrValue::Ints(p)) => Some(p.iter().map(|&x| x as usize).collect()),
                        Some(_) => return Err(unsupported()),
                    };
                    Op::Transpose { perm }
                }
                (false, "Shape") => {
                    only_attrs(n, &["start", "end"])?;
                    let end = match attr(n, "end") {
                        None => None,
                        Some(AttrValue::Int(e)) => Some(*e),
                        Some(_) => return Err(unsupported()),
                    };
                    Op::Shape {
                        start: attr_int(n, "start", 0)?,
                        end,
                    }
                }
                (false, "Unsqueeze") => {
                    only_attrs(n, &[])?;
                    Op::Unsqueeze
                }
                (false, "Squeeze") => {
                    only_attrs(n, &[])?;
                    Op::Squeeze
                }
                (false, "Concat") => {
                    only_attrs(n, &["axis"])?;
                    Op::Concat {
                        axis: attr_int(n, "axis", 0)?,
                    }
                }
                (false, "ConstantOfShape") => {
                    only_attrs(n, &["value"])?;
                    let value = match attr(n, "value") {
                        None => Tensor::f32(vec![1], vec![0.0])?,
                        Some(AttrValue::Tensor(t)) => Tensor::from_proto(t)?,
                        Some(_) => return Err(unsupported()),
                    };
                    if value.len() != 1 {
                        return Err(unsupported());
                    }
                    Op::ConstantOfShape { value }
                }
                (false, "Slice") => {
                    only_attrs(n, &[])?;
                    Op::Slice
                }
                (false, "Reshape") => {
                    only_attrs(n, &["allowzero"])?;
                    Op::Reshape {
                        allowzero: attr_int(n, "allowzero", 0)? != 0,
                    }
                }
                (false, "Cast") => {
                    only_attrs(n, &["to", "saturate"])?;
                    let to = attr_int(n, "to", 0)? as i32;
                    if ![tensor::FLOAT, tensor::INT64, tensor::INT32, tensor::BOOL].contains(&to) {
                        return Err(unsupported());
                    }
                    Op::Cast { to }
                }
                (false, "Mul") => {
                    only_attrs(n, &[])?;
                    Op::Mul
                }
                (false, "Add") => {
                    only_attrs(n, &[])?;
                    Op::Add
                }
                (false, "Not") => {
                    only_attrs(n, &[])?;
                    Op::Not
                }
                (false, "ReduceSum") => {
                    only_attrs(n, &["keepdims", "noop_with_empty_axes"])?;
                    Op::ReduceSum {
                        keepdims: attr_int(n, "keepdims", 1)? != 0,
                        noop_with_empty_axes: attr_int(n, "noop_with_empty_axes", 0)? != 0,
                    }
                }
                (false, "Where") => {
                    only_attrs(n, &[])?;
                    Op::Where
                }
                (false, "Softmax") => {
                    only_attrs(n, &["axis"])?;
                    Op::Softmax {
                        axis: attr_int(n, "axis", -1)?,
                    }
                }
                (false, "MatMul") => {
                    only_attrs(n, &[])?;
                    Op::MatMul
                }
                (false, "DynamicQuantizeLinear") => {
                    only_attrs(n, &[])?;
                    Op::DynamicQuantizeLinear
                }
                (false, "MatMulInteger") => {
                    only_attrs(n, &[])?;
                    let b = konst(1).ok_or_else(|| {
                        NeuralError::Unsupported(format!(
                            "MatMulInteger {:?}: B must be an initializer",
                            n.name
                        ))
                    })?;
                    let (k, nn) = match b.shape.as_slice() {
                        [k, nn] => (*k, *nn),
                        s => {
                            return Err(NeuralError::Unsupported(format!(
                                "MatMulInteger B shape {s:?}"
                            )));
                        }
                    };
                    let zp = konst(3);
                    let w = match (&b.data, zp.as_deref().map(|t| &t.data)) {
                        (Data::I8(v), None) => QWeights::new_s8(v, k, nn),
                        (Data::I8(v), Some(Data::I8(z))) if z.len() == 1 && z[0] == 0 => {
                            QWeights::new_s8(v, k, nn)
                        }
                        (Data::U8(v), None) => QWeights::new_u8(v, k, nn, 0),
                        (Data::U8(v), Some(Data::U8(z))) if z.len() == 1 => {
                            QWeights::new_u8(v, k, nn, z[0])
                        }
                        _ => {
                            return Err(NeuralError::Unsupported(format!(
                                "MatMulInteger {:?}: B type / zero point",
                                n.name
                            )));
                        }
                    };
                    if ins.len() > 3 && ins[3].is_some() && zp.is_none() {
                        return Err(NeuralError::Unsupported(
                            "MatMulInteger: non-constant B zero point".into(),
                        ));
                    }
                    Op::MatMulInteger(Box::new(w))
                }
                (true, "DynamicQuantizeLSTM") => {
                    only_attrs(n, &["direction", "hidden_size", "input_forget", "clip"])?;
                    if attr_int(n, "input_forget", 0)? != 0 {
                        return Err(NeuralError::Unsupported(
                            "DynamicQuantizeLSTM input_forget=1".into(),
                        ));
                    }
                    let direction = match attr(n, "direction") {
                        None => Direction::Forward,
                        Some(AttrValue::Str(s)) => match s.as_slice() {
                            b"forward" => Direction::Forward,
                            b"reverse" => Direction::Reverse,
                            b"bidirectional" => Direction::Bidirectional,
                            _ => return Err(unsupported()),
                        },
                        Some(_) => return Err(unsupported()),
                    };
                    let clip = match attr(n, "clip") {
                        None => f32::MAX,
                        Some(AttrValue::Float(c)) => *c,
                        Some(_) => return Err(unsupported()),
                    };
                    let hidden = attr_int(n, "hidden_size", 0)? as usize;
                    // sequence_lens (4) and peepholes (7) are not implemented: refuse them rather than ignore them.
                    for i in [4usize, 7] {
                        if ins.get(i).copied().flatten().is_some() {
                            return Err(NeuralError::Unsupported(format!(
                                "DynamicQuantizeLSTM input {i} (sequence_lens/P)"
                            )));
                        }
                    }
                    let need = |i: usize, what: &str| -> Result<Arc<Tensor>, NeuralError> {
                        konst(i).ok_or_else(|| {
                            NeuralError::Unsupported(format!(
                                "DynamicQuantizeLSTM {what} must be an initializer"
                            ))
                        })
                    };
                    let lstm = Lstm::new(
                        direction,
                        hidden,
                        clip,
                        &*need(1, "W")?,
                        &*need(2, "R")?,
                        &*need(8, "W_scale")?,
                        &*need(9, "W_zero_point")?,
                        &*need(10, "R_scale")?,
                        &*need(11, "R_zero_point")?,
                    )?;
                    Op::DynamicQuantizeLstm(Box::new(lstm))
                }
                _ => return Err(unsupported()),
            };
            nodes.push(Node {
                op,
                name: n.name.clone(),
                inputs: ins,
                outputs: outs,
            });
        }
        let outputs: Vec<(String, usize)> = g
            .outputs
            .iter()
            .map(|n| (n.clone(), slot(n, &mut constants)))
            .collect();
        Ok(OnnxModel {
            inputs,
            outputs,
            constants,
            nodes,
        })
    }

    pub fn input_names(&self) -> impl Iterator<Item = &str> {
        self.inputs.iter().map(|(n, _)| n.as_str())
    }

    pub fn output_names(&self) -> impl Iterator<Item = &str> {
        self.outputs.iter().map(|(n, _)| n.as_str())
    }

    /// Run the graph. Every graph input must be supplied; returns the graph outputs in declaration order.
    pub fn run(&self, inputs: &[(&str, Tensor)]) -> Result<Vec<(String, Tensor)>, NeuralError> {
        let mut values = self.constants.clone();
        for (name, slot) in &self.inputs {
            let t = inputs
                .iter()
                .find(|(n, _)| n == name)
                .ok_or_else(|| NeuralError::Run(format!("missing input {name:?}")))?;
            values[*slot] = Some(Arc::new(t.1.clone()));
        }
        for (n, _) in inputs {
            if !self.inputs.iter().any(|(name, _)| name == n) {
                return Err(NeuralError::Run(format!("unknown input {n:?}")));
            }
        }
        for node in &self.nodes {
            let args: Vec<Option<Arc<Tensor>>> = node
                .inputs
                .iter()
                .map(|s| s.and_then(|s| values[s].clone()))
                .collect();
            let results = run_node(node, &args).map_err(|e| match e {
                NeuralError::Run(m) => NeuralError::Run(format!("node {:?}: {m}", node.name)),
                e => e,
            })?;
            for (slot, t) in node.outputs.iter().zip(results) {
                if let Some(s) = slot {
                    values[*s] = Some(Arc::new(t));
                }
            }
        }
        self.outputs
            .iter()
            .map(|(name, s)| {
                let t = values[*s].take().ok_or_else(|| {
                    NeuralError::Run(format!("output {name:?} was never produced"))
                })?;
                Ok((
                    name.clone(),
                    Arc::try_unwrap(t).unwrap_or_else(|a| (*a).clone()),
                ))
            })
            .collect()
    }
}

fn arg(args: &[Option<Arc<Tensor>>], i: usize) -> Result<&Tensor, NeuralError> {
    args.get(i)
        .and_then(|a| a.as_deref())
        .ok_or_else(|| NeuralError::Run(format!("input {i} missing")))
}

fn opt(args: &[Option<Arc<Tensor>>], i: usize) -> Option<&Tensor> {
    args.get(i).and_then(|a| a.as_deref())
}

fn run_node(node: &Node, args: &[Option<Arc<Tensor>>]) -> Result<Vec<Tensor>, NeuralError> {
    Ok(match &node.op {
        Op::Gather { axis } => {
            let data = arg(args, 0)?;
            let idx = arg(args, 1)?.to_i64s()?;
            let idx_shape = arg(args, 1)?.shape.clone();
            let ax = norm_axis(*axis, data.shape.len())?;
            let dim = data.shape[ax];
            let outer: usize = data.shape[..ax].iter().product();
            let inner: usize = data.shape[ax + 1..].iter().product();
            let mut src = Vec::with_capacity(outer * idx.len() * inner);
            for o in 0..outer {
                for &i in &idx {
                    let i = if i < 0 { i + dim as i64 } else { i };
                    if i < 0 || i >= dim as i64 {
                        return Err(NeuralError::Run(format!(
                            "Gather index {i} out of range {dim}"
                        )));
                    }
                    let base = (o * dim + i as usize) * inner;
                    src.extend(base..base + inner);
                }
            }
            let mut shape = data.shape[..ax].to_vec();
            shape.extend(&idx_shape);
            shape.extend(&data.shape[ax + 1..]);
            vec![Tensor::new(shape, data.data.select(src.into_iter()))?]
        }
        Op::DequantizeLinear => {
            // Per-tensor only: `static_cast<float>(static_cast<int32_t>(x) - zp) * scale`.
            let x = arg(args, 0)?;
            let scale = scalar_f32(arg(args, 1)?, "DequantizeLinear")?;
            let out: Vec<f32> = match (&x.data, opt(args, 2).map(|t| &t.data)) {
                (Data::U8(v), zp) => {
                    let z = match zp {
                        None => 0,
                        Some(Data::U8(z)) if z.len() == 1 => i32::from(z[0]),
                        _ => {
                            return Err(NeuralError::Unsupported(
                                "DequantizeLinear zero point".into(),
                            ));
                        }
                    };
                    v.iter()
                        .map(|&q| (i32::from(q) - z) as f32 * scale)
                        .collect()
                }
                (Data::I8(v), zp) => {
                    let z = match zp {
                        None => 0,
                        Some(Data::I8(z)) if z.len() == 1 => i32::from(z[0]),
                        _ => {
                            return Err(NeuralError::Unsupported(
                                "DequantizeLinear zero point".into(),
                            ));
                        }
                    };
                    v.iter()
                        .map(|&q| (i32::from(q) - z) as f32 * scale)
                        .collect()
                }
                _ => {
                    return Err(NeuralError::Unsupported(
                        "DequantizeLinear input type".into(),
                    ));
                }
            };
            vec![Tensor::f32(x.shape.clone(), out)?]
        }
        Op::Transpose { perm } => {
            let x = arg(args, 0)?;
            let p: Vec<usize> = perm
                .clone()
                .unwrap_or_else(|| (0..x.shape.len()).rev().collect());
            vec![transpose(x, &p)?]
        }
        Op::Shape { start, end } => {
            let x = arg(args, 0)?;
            let r = x.shape.len() as i64;
            let clampi = |v: i64| (if v < 0 { v + r } else { v }).clamp(0, r) as usize;
            let (s, e) = (clampi(*start), clampi(end.unwrap_or(r)));
            let dims: Vec<i64> = x.shape[s..e.max(s)].iter().map(|&d| d as i64).collect();
            vec![Tensor::i64(vec![dims.len()], dims)?]
        }
        Op::Unsqueeze => {
            let x = arg(args, 0)?;
            let axes = arg(args, 1)?.to_i64s()?;
            let r = x.shape.len() + axes.len();
            let mut ax: Vec<usize> = axes
                .iter()
                .map(|&a| norm_axis(a, r))
                .collect::<Result<_, _>>()?;
            ax.sort();
            let mut shape = x.shape.clone();
            for a in ax {
                shape.insert(a, 1);
            }
            vec![Tensor::new(shape, x.data.clone())?]
        }
        Op::Squeeze => {
            let x = arg(args, 0)?;
            let shape: Vec<usize> = match opt(args, 1) {
                None => x.shape.iter().copied().filter(|&d| d != 1).collect(),
                Some(a) => {
                    let ax: Vec<usize> = a
                        .to_i64s()?
                        .iter()
                        .map(|&v| norm_axis(v, x.shape.len()))
                        .collect::<Result<_, _>>()?;
                    for &i in &ax {
                        if x.shape[i] != 1 {
                            return Err(NeuralError::Run(format!(
                                "Squeeze axis {i} has size {}",
                                x.shape[i]
                            )));
                        }
                    }
                    x.shape
                        .iter()
                        .enumerate()
                        .filter(|(i, _)| !ax.contains(i))
                        .map(|(_, &d)| d)
                        .collect()
                }
            };
            vec![Tensor::new(shape, x.data.clone())?]
        }
        Op::Concat { axis } => {
            let parts: Vec<&Tensor> = (0..args.len())
                .map(|i| arg(args, i))
                .collect::<Result<_, _>>()?;
            let rank = parts[0].shape.len();
            let ax = norm_axis(*axis, rank)?;
            let outer: usize = parts[0].shape[..ax].iter().product();
            let mut shape = parts[0].shape.clone();
            shape[ax] = parts.iter().map(|p| p.shape[ax]).sum();
            for p in &parts {
                if p.shape.len() != rank
                    || p.shape[..ax] != shape[..ax]
                    || p.shape[ax + 1..] != shape[ax + 1..]
                {
                    return Err(NeuralError::Run("Concat shape mismatch".into()));
                }
            }
            // Interleave the per-part blocks of each outer index.
            let mut pieces = Vec::new();
            for o in 0..outer {
                for p in &parts {
                    let block: usize = p.shape[ax..].iter().product();
                    pieces.push(p.data.select(o * block..(o + 1) * block));
                }
            }
            let refs: Vec<&Data> = pieces.iter().collect();
            vec![Tensor::new(shape, Data::concat(&refs)?)?]
        }
        Op::ConstantOfShape { value } => {
            let dims = arg(args, 0)?.to_i64s()?;
            let shape: Vec<usize> = dims.iter().map(|&d| d as usize).collect();
            let n: usize = shape.iter().product();
            vec![Tensor::new(
                shape,
                value.data.select(std::iter::repeat_n(0, n)),
            )?]
        }
        Op::Slice => {
            let x = arg(args, 0)?;
            let starts = arg(args, 1)?.to_i64s()?;
            let ends = arg(args, 2)?.to_i64s()?;
            let r = x.shape.len();
            let axes: Vec<usize> = match opt(args, 3) {
                Some(a) => a
                    .to_i64s()?
                    .iter()
                    .map(|&v| norm_axis(v, r))
                    .collect::<Result<_, _>>()?,
                None => (0..starts.len()).collect(),
            };
            let steps = match opt(args, 4) {
                Some(s) => s.to_i64s()?,
                None => vec![1; starts.len()],
            };
            let mut lo = vec![0i64; r];
            let mut step = vec![1i64; r];
            let mut shape = x.shape.clone();
            for (j, &a) in axes.iter().enumerate() {
                let d = x.shape[a] as i64;
                let st = steps[j];
                if st == 0 {
                    return Err(NeuralError::Run("Slice step 0".into()));
                }
                let fix = |v: i64| if v < 0 { v + d } else { v };
                let (s, e) = if st > 0 {
                    (fix(starts[j]).clamp(0, d), fix(ends[j]).clamp(0, d))
                } else {
                    (
                        fix(starts[j]).clamp(-1, d - 1),
                        fix(ends[j]).clamp(-1, d - 1),
                    )
                };
                let len = if st > 0 {
                    (e - s + st - 1).div_euclid(st)
                } else {
                    (s - e + (-st) - 1).div_euclid(-st)
                };
                shape[a] = len.max(0) as usize;
                lo[a] = s;
                step[a] = st;
            }
            let in_strides = strides(&x.shape);
            let base: i64 = (0..r).map(|d| lo[d] * in_strides[d] as i64).sum();
            let st: Vec<i64> = (0..r).map(|d| step[d] * in_strides[d] as i64).collect();
            let idx = strided_indices(&shape, base, &st);
            vec![Tensor::new(shape, x.data.select(idx.into_iter()))?]
        }
        Op::Reshape { allowzero } => {
            let x = arg(args, 0)?;
            let spec = arg(args, 1)?.to_i64s()?;
            let mut shape = Vec::with_capacity(spec.len());
            let mut infer = None;
            for (i, &s) in spec.iter().enumerate() {
                match s {
                    -1 => {
                        if infer.replace(i).is_some() {
                            return Err(NeuralError::Run("Reshape with two -1".into()));
                        }
                        shape.push(1);
                    }
                    0 if !allowzero => shape.push(
                        *x.shape
                            .get(i)
                            .ok_or_else(|| NeuralError::Run("Reshape 0 past rank".into()))?,
                    ),
                    s if s >= 0 => shape.push(s as usize),
                    _ => return Err(NeuralError::Run(format!("Reshape dim {s}"))),
                }
            }
            if let Some(i) = infer {
                let known: usize = shape
                    .iter()
                    .enumerate()
                    .filter(|(j, _)| *j != i)
                    .map(|(_, &d)| d)
                    .product();
                if known == 0 || x.len() % known != 0 {
                    return Err(NeuralError::Run(format!(
                        "Reshape {:?} to {spec:?}",
                        x.shape
                    )));
                }
                shape[i] = x.len() / known;
            }
            vec![Tensor::new(shape, x.data.clone())?]
        }
        Op::DynamicQuantizeLstm(lstm) => {
            let [y, yh, yc] = lstm.run(arg(args, 0)?, opt(args, 3), opt(args, 5), opt(args, 6))?;
            vec![y, yh, yc]
        }
        Op::DynamicQuantizeLinear => {
            let x = arg(args, 0)?;
            let v = x.as_f32()?;
            let (scale, zp) = mlas::quant_params_u8(v);
            let mut q = Vec::new();
            mlas::quantize_u8(v, scale, zp, &mut q);
            vec![
                Tensor::new(x.shape.clone(), Data::U8(q))?,
                Tensor::f32(vec![], vec![scale])?,
                Tensor::new(vec![], Data::U8(vec![zp]))?,
            ]
        }
        Op::MatMulInteger(w) => {
            let a = arg(args, 0)?;
            let Data::U8(av) = &a.data else {
                return Err(NeuralError::Unsupported(
                    "MatMulInteger: A must be uint8".into(),
                ));
            };
            let za = match opt(args, 2).map(|t| &t.data) {
                None => 0,
                Some(Data::U8(z)) if z.len() == 1 => z[0],
                _ => {
                    return Err(NeuralError::Unsupported(
                        "MatMulInteger: A zero point must be a uint8 scalar".into(),
                    ));
                }
            };
            let k = *a
                .shape
                .last()
                .ok_or_else(|| NeuralError::Run("MatMulInteger: scalar A".into()))?;
            if k != w.k {
                return Err(NeuralError::Run(format!(
                    "MatMulInteger: A has K={k}, B has K={}",
                    w.k
                )));
            }
            let m = a.len() / k;
            let mut out = Vec::new();
            w.gemm(av, m, za, &mut out);
            let mut shape = a.shape.clone();
            *shape.last_mut().unwrap() = w.n;
            vec![Tensor::new(shape, Data::I32(out))?]
        }
        Op::Cast { to } => {
            let x = arg(args, 0)?;
            let data = match (&x.data, *to) {
                (Data::I32(v), tensor::FLOAT) => Data::F32(v.iter().map(|&i| i as f32).collect()),
                (Data::I64(v), tensor::FLOAT) => Data::F32(v.iter().map(|&i| i as f32).collect()),
                (Data::Bool(v), tensor::FLOAT) => {
                    Data::F32(v.iter().map(|&b| if b { 1.0 } else { 0.0 }).collect())
                }
                (Data::Bool(v), tensor::INT64) => {
                    Data::I64(v.iter().map(|&b| i64::from(b)).collect())
                }
                (Data::I32(v), tensor::INT64) => {
                    Data::I64(v.iter().map(|&i| i64::from(i)).collect())
                }
                (Data::F32(v), tensor::FLOAT) => Data::F32(v.clone()),
                (Data::I64(v), tensor::INT64) => Data::I64(v.clone()),
                (Data::Bool(v), tensor::BOOL) => Data::Bool(v.clone()),
                (d, to) => {
                    return Err(NeuralError::Unsupported(format!(
                        "Cast {} to {to}",
                        d.type_name()
                    )));
                }
            };
            vec![Tensor::new(x.shape.clone(), data)?]
        }
        Op::Mul => vec![binary_f32(arg(args, 0)?, arg(args, 1)?, |a, b| a * b)?],
        Op::Add => vec![binary_f32(arg(args, 0)?, arg(args, 1)?, |a, b| a + b)?],
        Op::ReduceSum {
            keepdims,
            noop_with_empty_axes,
        } => {
            // Only the shape the models use and ORT's `FastReduceKR` serves: float, reducing a run of TRAILING
            // axes, each kept row summed by Eigen. Anything else is refused rather than summed in another order.
            let x = arg(args, 0)?;
            let v = x.as_f32()?;
            let r = x.shape.len();
            let axes: Vec<usize> = match opt(args, 1) {
                Some(a) if !a.is_empty() => {
                    let mut ax: Vec<usize> = a
                        .to_i64s()?
                        .iter()
                        .map(|&v| norm_axis(v, r))
                        .collect::<Result<_, _>>()?;
                    ax.sort();
                    ax.dedup();
                    ax
                }
                _ if *noop_with_empty_axes => return Ok(vec![x.clone()]),
                _ => (0..r).collect(),
            };
            let first = axes[0];
            if axes != (first..r).collect::<Vec<_>>() {
                return Err(NeuralError::Unsupported(format!(
                    "ReduceSum over axes {axes:?} of rank {r} (only trailing axes)"
                )));
            }
            let inner: usize = x.shape[first..].iter().product();
            let outer: usize = x.shape[..first].iter().product();
            let out: Vec<f32> = (0..outer)
                .map(|o| mlas::eigen_sum(&v[o * inner..(o + 1) * inner], (o * inner) % 4))
                .collect();
            let mut shape = x.shape[..first].to_vec();
            if *keepdims {
                shape.extend(std::iter::repeat_n(1, r - first));
            }
            vec![Tensor::f32(shape, out)?]
        }
        Op::Where => {
            let c = arg(args, 0)?;
            let (a, b) = (arg(args, 1)?, arg(args, 2)?);
            let Data::Bool(cv) = &c.data else {
                return Err(NeuralError::Run("Where condition must be bool".into()));
            };
            let (av, bv) = (a.as_f32()?, b.as_f32()?);
            let out = broadcast_shape(&broadcast_shape(&c.shape, &a.shape)?, &b.shape)?;
            let (ic, ia, ib) = (
                broadcast_index(&c.shape, &out),
                broadcast_index(&a.shape, &out),
                broadcast_index(&b.shape, &out),
            );
            let v: Vec<f32> = (0..ic.len())
                .map(|i| if cv[ic[i]] { av[ia[i]] } else { bv[ib[i]] })
                .collect();
            vec![Tensor::f32(out, v)?]
        }
        Op::Softmax { axis } => {
            let x = arg(args, 0)?;
            let r = x.shape.len();
            if norm_axis(*axis, r)? != r - 1 {
                return Err(NeuralError::Unsupported(
                    "Softmax over a non-last axis".into(),
                ));
            }
            let d = x.shape[r - 1];
            let mut v = x.as_f32()?.to_vec();
            if d > 0 {
                for row in v.chunks_exact_mut(d) {
                    mlas::softmax_row(row);
                }
            }
            vec![Tensor::f32(x.shape.clone(), v)?]
        }
        Op::MatMul => {
            // Float MatMul with one row per batch (M = 1): MLAS's M1 kernel. Larger M takes MLAS's blocked SGEMM,
            // whose summation order is not reproduced here, so it is refused.
            let (a, b) = (arg(args, 0)?, arg(args, 1)?);
            let (av, bv) = (a.as_f32()?, b.as_f32()?);
            let (ra, rb) = (a.shape.len(), b.shape.len());
            if ra < 2 || rb < 2 {
                return Err(NeuralError::Unsupported("MatMul of a 1-D operand".into()));
            }
            let (m, k) = (a.shape[ra - 2], a.shape[ra - 1]);
            let (kb, n) = (b.shape[rb - 2], b.shape[rb - 1]);
            if k != kb {
                return Err(NeuralError::Run(format!(
                    "MatMul {:?} x {:?}",
                    a.shape, b.shape
                )));
            }
            if m != 1 {
                return Err(NeuralError::Unsupported(format!(
                    "MatMul with M = {m} (only M = 1 is reproduced)"
                )));
            }
            if a.shape[..ra - 2] != b.shape[..rb - 2] {
                return Err(NeuralError::Unsupported(
                    "MatMul with broadcast batch dims".into(),
                ));
            }
            let batch: usize = a.shape[..ra - 2].iter().product();
            let mut out = vec![0f32; batch * n];
            for bi in 0..batch {
                mlas::sgemm_m1(
                    &av[bi * k..(bi + 1) * k],
                    &bv[bi * k * n..(bi + 1) * k * n],
                    n,
                    &mut out[bi * n..(bi + 1) * n],
                );
            }
            let mut shape = a.shape.clone();
            shape[ra - 1] = n;
            vec![Tensor::f32(shape, out)?]
        }
        Op::Not => {
            let x = arg(args, 0)?;
            let Data::Bool(v) = &x.data else {
                return Err(NeuralError::Run("Not of a non-bool".into()));
            };
            vec![Tensor::new(
                x.shape.clone(),
                Data::Bool(v.iter().map(|b| !b).collect()),
            )?]
        }
    })
}
