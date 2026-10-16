//! Decoder for `pos-model.bin`, the binary POS model. Ported from src/languages/english/posModelBinary.ts,
//! which holds the layout and the encoder. It decodes to `PosModel`, the compressed rows the tagger reads
//! directly.

use std::collections::HashMap;

use super::pos_tagger::PosModel;
use crate::core::data_path::data_file;
use crate::core::data_source::read_data;

const VERSION: u32 = 1;

/// Load `pos-model.bin` from the module's data directory.
pub fn load_pos_model(dir: &str) -> Result<PosModel, String> {
    let key = data_file(dir, "pos-model.bin");
    let bytes = read_data(&key).map_err(|e| e.to_string())?;
    decode(&bytes).map_err(|e| format!("{key}: {e}"))
}

pub fn decode(bytes: &[u8]) -> Result<PosModel, String> {
    let mut r = Reader { buf: bytes, at: 0 };
    if r.bytes(4)? != b"VPOS" {
        return Err("not a VPOS file".into());
    }
    let version = r.u32()?;
    if version != VERSION {
        return Err(format!("version {version}, expected {VERSION}"));
    }
    let scale = r.i32()?;
    let classes = r.strings()?;
    let tag_keys = r.strings()?;
    let tag_cls = r.bytes(tag_keys.len())?;
    let tagdict = tag_keys
        .into_iter()
        .zip(tag_cls)
        .map(|(k, &c)| (k, usize::from(c)))
        .collect();
    let features = r.strings()?;
    let n = features.len();
    let rows: HashMap<String, usize> = features
        .into_iter()
        .enumerate()
        .map(|(i, f)| (f, i))
        .collect();
    if rows.len() != n {
        return Err("repeated feature".into());
    }
    let row_start = (0..=n).map(|_| r.u32()).collect::<Result<Vec<_>, _>>()?;
    let nnz = row_start[n] as usize;
    let cls = r.bytes(nnz)?.to_vec();
    let weight = (0..nnz).map(|_| r.i32()).collect::<Result<Vec<_>, _>>()?;
    if r.at != bytes.len() {
        return Err("trailing bytes".into());
    }
    Ok(PosModel {
        scale: f64::from(scale),
        classes,
        tagdict,
        rows,
        row_start,
        cls,
        weight,
    })
}

struct Reader<'a> {
    buf: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn bytes(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self.at.checked_add(n).filter(|&e| e <= self.buf.len());
        let end = end.ok_or("truncated")?;
        let x = &self.buf[self.at..end];
        self.at = end;
        Ok(x)
    }

    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_le_bytes(self.bytes(4)?.try_into().unwrap()))
    }

    fn i32(&mut self) -> Result<i32, String> {
        Ok(i32::from_le_bytes(self.bytes(4)?.try_into().unwrap()))
    }

    fn strings(&mut self) -> Result<Vec<String>, String> {
        let n = self.u32()? as usize;
        let offsets = (0..=n)
            .map(|_| self.u32().map(|x| x as usize))
            .collect::<Result<Vec<_>, _>>()?;
        let block = self.bytes(offsets[n])?;
        (0..n)
            .map(|i| {
                let s = block
                    .get(offsets[i]..offsets[i + 1])
                    .ok_or("bad string offsets")?;
                String::from_utf8(s.to_vec()).map_err(|e| e.to_string())
            })
            .collect()
    }
}
