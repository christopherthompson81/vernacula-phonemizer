//! The tensor type the interpreter passes between nodes: a shape and a typed, row-major buffer.

use super::NeuralError;
use super::proto::TensorProto;

#[derive(Debug, Clone, PartialEq)]
pub enum Data {
    F32(Vec<f32>),
    I64(Vec<i64>),
    I32(Vec<i32>),
    U8(Vec<u8>),
    I8(Vec<i8>),
    Bool(Vec<bool>),
}

/// ONNX `TensorProto.DataType` codes for the types above.
pub const FLOAT: i32 = 1;
pub const UINT8: i32 = 2;
pub const INT8: i32 = 3;
pub const INT32: i32 = 6;
pub const INT64: i32 = 7;
pub const BOOL: i32 = 9;

#[derive(Debug, Clone, PartialEq)]
pub struct Tensor {
    pub shape: Vec<usize>,
    pub data: Data,
}

impl Data {
    pub fn len(&self) -> usize {
        match self {
            Data::F32(v) => v.len(),
            Data::I64(v) => v.len(),
            Data::I32(v) => v.len(),
            Data::U8(v) => v.len(),
            Data::I8(v) => v.len(),
            Data::Bool(v) => v.len(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn type_code(&self) -> i32 {
        match self {
            Data::F32(_) => FLOAT,
            Data::I64(_) => INT64,
            Data::I32(_) => INT32,
            Data::U8(_) => UINT8,
            Data::I8(_) => INT8,
            Data::Bool(_) => BOOL,
        }
    }

    pub fn type_name(&self) -> &'static str {
        match self {
            Data::F32(_) => "float32",
            Data::I64(_) => "int64",
            Data::I32(_) => "int32",
            Data::U8(_) => "uint8",
            Data::I8(_) => "int8",
            Data::Bool(_) => "bool",
        }
    }

    /// Gather the elements at `idx` (a permutation, a slice, a broadcast) into a new buffer of the same type.
    pub fn select(&self, idx: impl Iterator<Item = usize>) -> Data {
        match self {
            Data::F32(v) => Data::F32(idx.map(|i| v[i]).collect()),
            Data::I64(v) => Data::I64(idx.map(|i| v[i]).collect()),
            Data::I32(v) => Data::I32(idx.map(|i| v[i]).collect()),
            Data::U8(v) => Data::U8(idx.map(|i| v[i]).collect()),
            Data::I8(v) => Data::I8(idx.map(|i| v[i]).collect()),
            Data::Bool(v) => Data::Bool(idx.map(|i| v[i]).collect()),
        }
    }

    /// Concatenate same-typed buffers.
    pub fn concat(parts: &[&Data]) -> Result<Data, NeuralError> {
        macro_rules! cat {
            ($variant:ident) => {{
                let mut out = Vec::new();
                for p in parts {
                    match p {
                        Data::$variant(v) => out.extend_from_slice(v),
                        _ => return Err(NeuralError::Run("Concat of mixed element types".into())),
                    }
                }
                Data::$variant(out)
            }};
        }
        Ok(match parts.first() {
            None => return Err(NeuralError::Run("Concat of nothing".into())),
            Some(Data::F32(_)) => cat!(F32),
            Some(Data::I64(_)) => cat!(I64),
            Some(Data::I32(_)) => cat!(I32),
            Some(Data::U8(_)) => cat!(U8),
            Some(Data::I8(_)) => cat!(I8),
            Some(Data::Bool(_)) => cat!(Bool),
        })
    }
}

impl Tensor {
    pub fn new(shape: Vec<usize>, data: Data) -> Result<Tensor, NeuralError> {
        let n: usize = shape.iter().product();
        if n != data.len() {
            return Err(NeuralError::Run(format!(
                "shape {shape:?} holds {n} elements, data has {}",
                data.len()
            )));
        }
        Ok(Tensor { shape, data })
    }

    pub fn f32(shape: Vec<usize>, v: Vec<f32>) -> Result<Tensor, NeuralError> {
        Tensor::new(shape, Data::F32(v))
    }

    pub fn i64(shape: Vec<usize>, v: Vec<i64>) -> Result<Tensor, NeuralError> {
        Tensor::new(shape, Data::I64(v))
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    pub fn as_f32(&self) -> Result<&[f32], NeuralError> {
        match &self.data {
            Data::F32(v) => Ok(v),
            d => Err(NeuralError::Run(format!(
                "expected float32, got {}",
                d.type_name()
            ))),
        }
    }

    pub fn as_i64(&self) -> Result<&[i64], NeuralError> {
        match &self.data {
            Data::I64(v) => Ok(v),
            d => Err(NeuralError::Run(format!(
                "expected int64, got {}",
                d.type_name()
            ))),
        }
    }

    /// An integer tensor (int64 or int32) as i64, for shape/index inputs.
    pub fn to_i64s(&self) -> Result<Vec<i64>, NeuralError> {
        match &self.data {
            Data::I64(v) => Ok(v.clone()),
            Data::I32(v) => Ok(v.iter().map(|&x| i64::from(x)).collect()),
            d => Err(NeuralError::Run(format!(
                "expected an integer tensor, got {}",
                d.type_name()
            ))),
        }
    }

    pub fn from_proto(t: &TensorProto) -> Result<Tensor, NeuralError> {
        if t.external {
            return Err(NeuralError::Unsupported(format!(
                "tensor {} uses external data",
                t.name
            )));
        }
        let shape: Vec<usize> = t
            .dims
            .iter()
            .map(|&d| {
                usize::try_from(d)
                    .map_err(|_| NeuralError::Parse(format!("negative dim in {}", t.name)))
            })
            .collect::<Result<_, _>>()?;
        let n: usize = shape.iter().product();
        let raw = &t.raw_data;
        let data = match t.data_type {
            FLOAT if !raw.is_empty() => Data::F32(
                raw.as_chunks::<4>()
                    .0
                    .iter()
                    .map(|c| f32::from_le_bytes(*c))
                    .collect(),
            ),
            FLOAT => Data::F32(t.float_data.clone()),
            INT64 if !raw.is_empty() => Data::I64(
                raw.as_chunks::<8>()
                    .0
                    .iter()
                    .map(|c| i64::from_le_bytes(*c))
                    .collect(),
            ),
            INT64 => Data::I64(t.int64_data.clone()),
            INT32 if !raw.is_empty() => Data::I32(
                raw.as_chunks::<4>()
                    .0
                    .iter()
                    .map(|c| i32::from_le_bytes(*c))
                    .collect(),
            ),
            INT32 => Data::I32(t.int32_data.iter().map(|&x| x as i32).collect()),
            // int32_data carries the small integer types when raw_data is absent (onnx.proto).
            UINT8 if !raw.is_empty() => Data::U8(raw.clone()),
            UINT8 => Data::U8(t.int32_data.iter().map(|&x| x as u8).collect()),
            INT8 if !raw.is_empty() => Data::I8(raw.iter().map(|&b| b as i8).collect()),
            INT8 => Data::I8(t.int32_data.iter().map(|&x| x as i8).collect()),
            BOOL if !raw.is_empty() => Data::Bool(raw.iter().map(|&b| b != 0).collect()),
            BOOL => Data::Bool(t.int32_data.iter().map(|&x| x != 0).collect()),
            other => {
                return Err(NeuralError::Unsupported(format!(
                    "tensor {} has element type {other}",
                    t.name
                )));
            }
        };
        if data.len() != n {
            return Err(NeuralError::Parse(format!(
                "tensor {} has {} elements for shape {:?}",
                t.name,
                data.len(),
                shape
            )));
        }
        Ok(Tensor { shape, data })
    }
}
