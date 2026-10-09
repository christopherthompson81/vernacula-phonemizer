//! Line-oriented data loaders: `key<TAB>value` maps and plain line lists, `#` comments and blank lines
//! skipped. Ported from src/core/loadTsv.ts.

use indexmap::IndexMap;

use super::data_path::data_file;
use super::data_source::{DataError, read_data_text};
use super::js_string::JsString;

fn read_data_lines(dir: &str, filename: &str, optional: bool) -> Result<Vec<String>, DataError> {
    let text = match read_data_text(&data_file(dir, filename)) {
        Ok(t) => t,
        Err(DataError::Missing { .. }) if optional => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    // `split(/\r?\n/)`: a lone `\r` is NOT a separator.
    Ok(text
        .split('\n')
        .map(|l| l.strip_suffix('\r').unwrap_or(l))
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(str::to_string)
        .collect())
}

#[derive(Default)]
pub struct TsvOptions<'a> {
    pub optional: bool,
    /// Also file each row under `fold(key)`, unless that key already has a row of its own.
    pub fold: Option<&'a dyn Fn(&JsString) -> JsString>,
}

/// `key<TAB>rest` rows into an insertion-ordered map; the LAST row for a key wins, keeping the first
/// row's position (JS `Map.set`). `parse` returning `None` drops the row. A line whose tab is missing or
/// at column 0 is skipped.
pub fn load_tsv_map<V: Clone>(
    dir: &str,
    filename: &str,
    mut parse: impl FnMut(&JsString, &JsString) -> Option<V>,
    opts: TsvOptions,
) -> Result<IndexMap<JsString, V>, DataError> {
    let mut map = IndexMap::new();
    let mut rows: Vec<(JsString, V)> = Vec::new();
    for line in read_data_lines(dir, filename, opts.optional)? {
        let line = JsString::from(line.as_str());
        let tab = match line.index_of(&JsString::from("\t"), 0) {
            Some(t) if t > 0 => t,
            _ => continue,
        };
        let key = JsString::from_units(&line.0[..tab]);
        let value = JsString::from_units(&line.0[tab + 1..]);
        if let Some(v) = parse(&value, &key) {
            map.insert(key.clone(), v.clone());
            rows.push((key, v));
        }
    }
    if let Some(fold) = opts.fold {
        for (k, v) in rows {
            let f = fold(&k);
            if f != k && !map.contains_key(&f) {
                map.insert(f, v);
            }
        }
    }
    Ok(map)
}

/// `load_tsv_map` with the value kept as the raw string.
pub fn load_tsv_strings(dir: &str, filename: &str, opts: TsvOptions) -> Result<IndexMap<JsString, JsString>, DataError> {
    load_tsv_map(dir, filename, |v, _| Some(v.clone()), opts)
}

pub fn load_lines(dir: &str, filename: &str, optional: bool) -> Result<Vec<JsString>, DataError> {
    Ok(read_data_lines(dir, filename, optional)?.iter().map(|l| JsString::from(l.as_str())).collect())
}
