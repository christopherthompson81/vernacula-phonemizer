//! A minimal protobuf reader for the subset of `onnx.proto` the shipped models use: ModelProto, GraphProto,
//! NodeProto, AttributeProto, TensorProto and ValueInfoProto (names only). Unknown fields are skipped.
//! New code (no TypeScript twin): the TS engine hands the bytes to onnxruntime-node (#1463).

use super::NeuralError;

struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

enum Value<'a> {
    Varint(u64),
    Fixed64,
    Bytes(&'a [u8]),
    Fixed32(u32),
}

fn err(what: &str) -> NeuralError {
    NeuralError::Parse(what.to_string())
}

impl<'a> Reader<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Reader { buf, pos: 0 }
    }

    fn varint(&mut self) -> Result<u64, NeuralError> {
        let mut v = 0u64;
        for shift in (0..64).step_by(7) {
            let b = *self.buf.get(self.pos).ok_or_else(|| err("truncated varint"))?;
            self.pos += 1;
            v |= u64::from(b & 0x7f) << shift;
            if b & 0x80 == 0 {
                return Ok(v);
            }
        }
        Err(err("varint longer than 10 bytes"))
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], NeuralError> {
        let end = self.pos.checked_add(n).filter(|&e| e <= self.buf.len()).ok_or_else(|| err("truncated field"))?;
        let s = &self.buf[self.pos..end];
        self.pos = end;
        Ok(s)
    }

    /// The next `(field number, value)`, or `None` at the end of the message.
    fn field(&mut self) -> Result<Option<(u32, Value<'a>)>, NeuralError> {
        if self.pos >= self.buf.len() {
            return Ok(None);
        }
        let key = self.varint()?;
        let num = (key >> 3) as u32;
        let v = match key & 7 {
            0 => Value::Varint(self.varint()?),
            1 => {
                self.take(8)?;
                Value::Fixed64
            }
            2 => {
                let n = self.varint()? as usize;
                Value::Bytes(self.take(n)?)
            }
            5 => Value::Fixed32(u32::from_le_bytes(self.take(4)?.try_into().unwrap())),
            w => return Err(NeuralError::Parse(format!("unsupported wire type {w} (field {num})"))),
        };
        Ok(Some((num, v)))
    }
}

fn string(v: &Value) -> Result<String, NeuralError> {
    match v {
        Value::Bytes(b) => String::from_utf8(b.to_vec()).map_err(|_| err("string field is not UTF-8")),
        _ => Err(err("expected a length-delimited string")),
    }
}

fn int(v: &Value) -> Result<i64, NeuralError> {
    match v {
        Value::Varint(x) => Ok(*x as i64),
        _ => Err(err("expected a varint")),
    }
}

/// A repeated integer field, packed or not.
fn push_ints(out: &mut Vec<i64>, v: &Value) -> Result<(), NeuralError> {
    match v {
        Value::Varint(x) => out.push(*x as i64),
        Value::Bytes(b) => {
            let mut r = Reader::new(b);
            while r.pos < b.len() {
                out.push(r.varint()? as i64);
            }
        }
        _ => return Err(err("expected a repeated varint")),
    }
    Ok(())
}

/// A repeated float field, packed or not.
fn push_floats(out: &mut Vec<f32>, v: &Value) -> Result<(), NeuralError> {
    match v {
        Value::Fixed32(x) => out.push(f32::from_bits(*x)),
        Value::Bytes(b) if b.len() % 4 == 0 => {
            out.extend(b.as_chunks::<4>().0.iter().map(|c| f32::from_le_bytes(*c)))
        }
        _ => return Err(err("expected a repeated float")),
    }
    Ok(())
}

#[derive(Debug, Default, Clone)]
pub struct TensorProto {
    pub name: String,
    pub dims: Vec<i64>,
    pub data_type: i32,
    pub raw_data: Vec<u8>,
    pub float_data: Vec<f32>,
    pub int32_data: Vec<i64>,
    pub int64_data: Vec<i64>,
    pub external: bool,
}

impl TensorProto {
    fn parse(buf: &[u8]) -> Result<Self, NeuralError> {
        let mut t = TensorProto::default();
        let mut r = Reader::new(buf);
        while let Some((num, v)) = r.field()? {
            match num {
                1 => push_ints(&mut t.dims, &v)?,
                2 => t.data_type = int(&v)? as i32,
                4 => push_floats(&mut t.float_data, &v)?,
                5 => push_ints(&mut t.int32_data, &v)?,
                7 => push_ints(&mut t.int64_data, &v)?,
                8 => t.name = string(&v)?,
                9 => match v {
                    Value::Bytes(b) => t.raw_data = b.to_vec(),
                    _ => return Err(err("raw_data is not bytes")),
                },
                10 | 11 => return Err(err("double/uint64 tensor data is not supported")),
                3 => return Err(err("segmented tensors are not supported")),
                14 => t.external = int(&v)? == 1,
                _ => {}
            }
        }
        Ok(t)
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)] // FLOATS and unknown-typed attributes are parsed so they can be refused by name.
pub enum AttrValue {
    Float(f32),
    Int(i64),
    Str(Vec<u8>),
    Tensor(TensorProto),
    Floats(Vec<f32>),
    Ints(Vec<i64>),
    /// A type this reader does not decode (graphs, sparse tensors, string lists). Refused by any op that reads it.
    Other(i32),
}

#[derive(Debug, Clone)]
pub struct AttributeProto {
    pub name: String,
    pub value: AttrValue,
}

impl AttributeProto {
    fn parse(buf: &[u8]) -> Result<Self, NeuralError> {
        let mut name = String::new();
        let (mut f, mut i, mut s, mut t) = (None, None, None, None);
        let (mut floats, mut ints) = (Vec::new(), Vec::new());
        let mut ty = 0;
        let mut r = Reader::new(buf);
        while let Some((num, v)) = r.field()? {
            match num {
                1 => name = string(&v)?,
                2 => {
                    let mut one = Vec::new();
                    push_floats(&mut one, &v)?;
                    f = one.first().copied();
                }
                3 => i = Some(int(&v)?),
                4 => {
                    if let Value::Bytes(b) = v {
                        s = Some(b.to_vec());
                    }
                }
                5 => {
                    if let Value::Bytes(b) = v {
                        t = Some(TensorProto::parse(b)?);
                    }
                }
                7 => push_floats(&mut floats, &v)?,
                8 => push_ints(&mut ints, &v)?,
                20 => ty = int(&v)? as i32,
                _ => {}
            }
        }
        // AttributeProto.AttributeType: FLOAT=1 INT=2 STRING=3 TENSOR=4 FLOATS=6 INTS=7.
        let value = match ty {
            1 => AttrValue::Float(f.unwrap_or(0.0)),
            2 => AttrValue::Int(i.unwrap_or(0)),
            3 => AttrValue::Str(s.unwrap_or_default()),
            4 => AttrValue::Tensor(t.ok_or_else(|| err("tensor attribute without a tensor"))?),
            6 => AttrValue::Floats(floats),
            7 => AttrValue::Ints(ints),
            other => AttrValue::Other(other),
        };
        Ok(AttributeProto { name, value })
    }
}

#[derive(Debug, Clone, Default)]
pub struct NodeProto {
    pub name: String,
    pub op_type: String,
    pub domain: String,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
    pub attributes: Vec<AttributeProto>,
}

impl NodeProto {
    fn parse(buf: &[u8]) -> Result<Self, NeuralError> {
        let mut n = NodeProto::default();
        let mut r = Reader::new(buf);
        while let Some((num, v)) = r.field()? {
            match num {
                1 => n.inputs.push(string(&v)?),
                2 => n.outputs.push(string(&v)?),
                3 => n.name = string(&v)?,
                4 => n.op_type = string(&v)?,
                5 => {
                    if let Value::Bytes(b) = v {
                        n.attributes.push(AttributeProto::parse(b)?);
                    }
                }
                7 => n.domain = string(&v)?,
                _ => {}
            }
        }
        Ok(n)
    }
}

#[derive(Debug, Clone, Default)]
pub struct GraphProto {
    pub nodes: Vec<NodeProto>,
    pub initializers: Vec<TensorProto>,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
}

/// `ValueInfoProto.name` (field 1); the type is not needed — shapes are computed at run time.
fn value_info_name(buf: &[u8]) -> Result<String, NeuralError> {
    let mut r = Reader::new(buf);
    while let Some((num, v)) = r.field()? {
        if num == 1 {
            return string(&v);
        }
    }
    Err(err("ValueInfoProto without a name"))
}

impl GraphProto {
    fn parse(buf: &[u8]) -> Result<Self, NeuralError> {
        let mut g = GraphProto::default();
        let mut r = Reader::new(buf);
        while let Some((num, v)) = r.field()? {
            let Value::Bytes(b) = v else { continue };
            match num {
                1 => g.nodes.push(NodeProto::parse(b)?),
                5 => g.initializers.push(TensorProto::parse(b)?),
                11 => g.inputs.push(value_info_name(b)?),
                12 => g.outputs.push(value_info_name(b)?),
                15 => return Err(err("sparse initializers are not supported")),
                _ => {}
            }
        }
        Ok(g)
    }
}

#[derive(Debug, Clone, Default)]
pub struct ModelProto {
    pub ir_version: i64,
    /// `(domain, version)`; the default domain is "".
    pub opsets: Vec<(String, i64)>,
    pub graph: GraphProto,
}

impl ModelProto {
    pub fn parse(buf: &[u8]) -> Result<Self, NeuralError> {
        let mut m = ModelProto::default();
        let mut graph = None;
        let mut r = Reader::new(buf);
        while let Some((num, v)) = r.field()? {
            match num {
                1 => m.ir_version = int(&v)?,
                7 => {
                    if let Value::Bytes(b) = v {
                        graph = Some(GraphProto::parse(b)?);
                    }
                }
                8 => {
                    if let Value::Bytes(b) = v {
                        let (mut domain, mut version) = (String::new(), 0);
                        let mut rr = Reader::new(b);
                        while let Some((n, vv)) = rr.field()? {
                            match n {
                                1 => domain = string(&vv)?,
                                2 => version = int(&vv)?,
                                _ => {}
                            }
                        }
                        m.opsets.push((domain, version));
                    }
                }
                _ => {}
            }
        }
        m.graph = graph.ok_or_else(|| err("ModelProto has no graph"))?;
        Ok(m)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn varints_and_packed_ints() {
        // field 1 (dims), packed: [3, 300]
        let buf = [0x0a, 0x03, 0x03, 0xac, 0x02, 0x10, 0x07];
        let t = TensorProto::parse(&buf).unwrap();
        assert_eq!(t.dims, vec![3, 300]);
        assert_eq!(t.data_type, 7);
    }

    #[test]
    fn truncated_is_an_error() {
        assert!(TensorProto::parse(&[0x0a, 0x05, 0x01]).is_err());
    }
}
