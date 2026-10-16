//! Decoder for `g2p-model.bin`, the binary English OOV G2P model. Ported from
//! src/languages/english/g2pModelBinary.ts, which holds the layout and the encoder.

use indexmap::IndexMap;

use super::english_g2p::{EnglishG2pModel, PAD};
use crate::core::data_path::data_file;
use crate::core::data_source::read_data;

const VERSION: u32 = 1;

/// Load `g2p-model.bin` from the module's data directory.
pub fn load_g2p_model(dir: &str) -> Result<EnglishG2pModel, String> {
    let key = data_file(dir, "g2p-model.bin");
    let bytes = read_data(&key).map_err(|e| e.to_string())?;
    decode(&bytes).map_err(|e| format!("{key}: {e}"))
}

pub fn decode(bytes: &[u8]) -> Result<EnglishG2pModel, String> {
    let mut r = Reader { buf: bytes, at: 0 };
    if r.take(4)? != b"VG2P" {
        return Err("not a VG2P file".into());
    }
    let version = r.u32()?;
    if version != VERSION {
        return Err(format!("version {version}, expected {VERSION}"));
    }
    let order = r.u32()? as usize;
    let alpha = r.f64()?;
    let evp = r.f64()?;
    let evp_order = i64::from(r.i32()?);
    let _min_count = r.i32()?; // a training parameter, carried for the round trip
    let mut grapheme_chunks = IndexMap::new();
    for letter in r.strings()? {
        let chunks = r.strings()?;
        grapheme_chunks.insert(letter, chunks);
    }
    let tokens = r.strings()?;
    let n = r.u32()? as usize;
    let ctx_order = r.take(n)?.to_vec();
    let ctx_tok = r.u16s(n * 4)?;
    let total = r.u32s(n)?;
    let row_start = r.u32s(n + 1)?;
    let nnz = row_start[n] as usize;
    let cand = r.u16s(nnz)?;
    let count = r.u32s(nnz)?;
    if r.at != bytes.len() {
        return Err("trailing bytes".into());
    }
    if cand.iter().any(|&t| usize::from(t) >= tokens.len()) {
        return Err("candidate token out of range".into());
    }
    for (i, &o) in ctx_order.iter().enumerate() {
        if o > 4 {
            return Err("context order out of range".into());
        }
        for j in 0..4 {
            let t = ctx_tok[i * 4 + j];
            let bad = if j < 4 - usize::from(o) {
                t != PAD
            } else {
                usize::from(t) >= tokens.len()
            };
            if bad {
                return Err("context token out of range".into());
            }
        }
    }
    if row_start.windows(2).any(|w| w[0] > w[1]) {
        return Err("row table not ascending".into());
    }
    Ok(EnglishG2pModel {
        order,
        alpha,
        evp,
        evp_order,
        grapheme_chunks,
        tokens,
        ctx_order,
        ctx_tok,
        total,
        row_start,
        cand,
        count,
    })
}

struct Reader<'a> {
    buf: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self
            .at
            .checked_add(n)
            .filter(|&e| e <= self.buf.len())
            .ok_or("truncated")?;
        let x = &self.buf[self.at..end];
        self.at = end;
        Ok(x)
    }

    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn i32(&mut self) -> Result<i32, String> {
        Ok(i32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn f64(&mut self) -> Result<f64, String> {
        Ok(f64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }

    fn u32s(&mut self, n: usize) -> Result<Vec<u32>, String> {
        let b = self.take(n.checked_mul(4).ok_or("truncated")?)?;
        Ok(b.chunks_exact(4)
            .map(|c| u32::from_le_bytes(c.try_into().unwrap()))
            .collect())
    }

    fn u16s(&mut self, n: usize) -> Result<Vec<u16>, String> {
        let b = self.take(n.checked_mul(2).ok_or("truncated")?)?;
        Ok(b.chunks_exact(2)
            .map(|c| u16::from_le_bytes(c.try_into().unwrap()))
            .collect())
    }

    fn strings(&mut self) -> Result<Vec<String>, String> {
        let n = self.u32()? as usize;
        let offsets = self.u32s(n + 1)?;
        let block = self.take(offsets[n] as usize)?;
        (0..n)
            .map(|i| {
                let s = block
                    .get(offsets[i] as usize..offsets[i + 1] as usize)
                    .ok_or("bad string offsets")?;
                String::from_utf8(s.to_vec()).map_err(|e| e.to_string())
            })
            .collect()
    }
}
