//! Decoding data structs from a parsed `serde_json::Value`, the runtime half of `#[derive(FromJson)]`
//! (crate `vernacula-json-derive`, which says why this replaces serde's `Deserialize`).
//!
//! Text is parsed once into a `Value` by serde_json (`parse_json`), and each struct then reads its fields
//! through `field` / `field_or`. Those are generic only over the field's type, so one copy serves every
//! struct with a field of that type. Data is read once per process, so the intermediate tree costs nothing
//! that matters.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::hash::Hash;
use std::sync::Arc;

use indexmap::{IndexMap, IndexSet};
use serde_json::{Map, Value};

pub use vernacula_json_derive::FromJson;

/// A decode failure: the message, prefixed by the key path to the value that failed (`numbers.ordinals:`).
#[derive(Debug, Clone, PartialEq)]
pub struct JsonError(pub String);

impl std::fmt::Display for JsonError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for JsonError {}

impl From<serde_json::Error> for JsonError {
    fn from(e: serde_json::Error) -> Self {
        JsonError(e.to_string())
    }
}

impl JsonError {
    fn expected(what: &str, got: &Value) -> Self {
        let kind = match got {
            Value::Null => "null",
            Value::Bool(_) => "a boolean",
            Value::Number(_) => "a number",
            Value::String(_) => "a string",
            Value::Array(_) => "an array",
            Value::Object(_) => "an object",
        };
        JsonError(format!("invalid type: {kind}, expected {what}"))
    }

    fn at(self, key: &str) -> Self {
        JsonError(format!("{key}: {}", self.0))
    }

    pub fn untagged(ty: &str) -> Self {
        JsonError(format!(
            "data did not match any variant of untagged enum {ty}"
        ))
    }

    pub fn unknown_variant(got: &str, ty: &str) -> Self {
        JsonError(format!("unknown variant `{got}` of {ty}"))
    }
}

/// A type that decodes from a JSON value.
pub trait FromJson: Sized {
    fn from_json(v: &Value) -> Result<Self, JsonError>;

    /// The value a struct field of this type takes when its key is absent. `None`: the key is required.
    fn absent() -> Option<Self> {
        None
    }
}

/// Parse JSON text and decode it: serde_json's parser runs once, into a `Value`, for every type.
pub fn parse_json<T: FromJson>(src: &str) -> Result<T, JsonError> {
    T::from_json(&serde_json::from_str::<Value>(src)?)
}

// --- The helpers the derive calls. ---

pub fn object<'a>(v: &'a Value, ty: &str) -> Result<&'a Map<String, Value>, JsonError> {
    v.as_object()
        .ok_or_else(|| JsonError::expected(&format!("struct {ty}"), v))
}

pub fn field<T: FromJson>(o: &Map<String, Value>, key: &str) -> Result<T, JsonError> {
    match o.get(key) {
        Some(v) => T::from_json(v).map_err(|e| e.at(key)),
        None => T::absent().ok_or_else(|| JsonError(format!("missing field `{key}`"))),
    }
}

/// `#[json(default)]`: an absent key takes `default`. A present `null` is still decoded (and fails unless
/// the type accepts it), as in serde.
pub fn field_or<T: FromJson>(
    o: &Map<String, Value>,
    key: &str,
    default: T,
) -> Result<T, JsonError> {
    match o.get(key) {
        Some(v) => T::from_json(v).map_err(|e| e.at(key)),
        None => Ok(default),
    }
}

pub fn deny_unknown(o: &Map<String, Value>, known: &[&str]) -> Result<(), JsonError> {
    match o.keys().find(|k| !known.contains(&k.as_str())) {
        Some(k) => Err(JsonError(format!(
            "unknown field `{k}`, expected one of {known:?}"
        ))),
        None => Ok(()),
    }
}

pub fn variant<'a>(v: &'a Value, ty: &str) -> Result<&'a str, JsonError> {
    v.as_str()
        .ok_or_else(|| JsonError::expected(&format!("a variant of {ty}"), v))
}

// --- Leaf and container impls. ---

impl FromJson for Value {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        Ok(v.clone())
    }
}

impl FromJson for String {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        v.as_str()
            .map(str::to_owned)
            .ok_or_else(|| JsonError::expected("a string", v))
    }
}

impl FromJson for char {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        let mut it = v.as_str().map(str::chars);
        match it.as_mut().map(|c| (c.next(), c.next())) {
            Some((Some(c), None)) => Ok(c),
            _ => Err(JsonError::expected("a character", v)),
        }
    }
}

impl FromJson for bool {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        v.as_bool()
            .ok_or_else(|| JsonError::expected("a boolean", v))
    }
}

macro_rules! unsigned {
    ($($t:ty),*) => {$(
        impl FromJson for $t {
            fn from_json(v: &Value) -> Result<Self, JsonError> {
                v.as_u64()
                    .and_then(|n| <$t>::try_from(n).ok())
                    .ok_or_else(|| JsonError::expected(stringify!($t), v))
            }
        }
    )*};
}
unsigned!(u8, u16, u32, u64, usize);

macro_rules! signed {
    ($($t:ty),*) => {$(
        impl FromJson for $t {
            fn from_json(v: &Value) -> Result<Self, JsonError> {
                v.as_i64()
                    .and_then(|n| <$t>::try_from(n).ok())
                    .ok_or_else(|| JsonError::expected(stringify!($t), v))
            }
        }
    )*};
}
signed!(i8, i16, i32, i64, isize);

impl FromJson for f64 {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        v.as_f64().ok_or_else(|| JsonError::expected("f64", v))
    }
}

impl FromJson for f32 {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        Ok(f64::from_json(v)? as f32)
    }
}

impl<T: FromJson> FromJson for Option<T> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        match v {
            Value::Null => Ok(None),
            _ => T::from_json(v).map(Some),
        }
    }

    fn absent() -> Option<Self> {
        Some(None)
    }
}

impl<T: FromJson> FromJson for Box<T> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        T::from_json(v).map(Box::new)
    }
}

impl<T: FromJson> FromJson for Arc<T> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        T::from_json(v).map(Arc::new)
    }
}

fn array(v: &Value) -> Result<&Vec<Value>, JsonError> {
    v.as_array()
        .ok_or_else(|| JsonError::expected("an array", v))
}

fn items<T: FromJson>(v: &Value) -> impl Iterator<Item = Result<T, JsonError>> + '_ {
    array(v)
        .map(|a| a.as_slice())
        .unwrap_or_default()
        .iter()
        .enumerate()
        .map(|(i, x)| T::from_json(x).map_err(|e| e.at(&format!("[{i}]"))))
}

impl<T: FromJson> FromJson for Vec<T> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        array(v)?;
        items(v).collect()
    }
}

impl<T: FromJson + Eq + Hash> FromJson for HashSet<T> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        array(v)?;
        items(v).collect()
    }
}

impl<T: FromJson + Eq + Hash> FromJson for IndexSet<T> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        array(v)?;
        items(v).collect()
    }
}

impl<T: FromJson, const N: usize> FromJson for [T; N] {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        let a = array(v)?;
        if a.len() != N {
            return Err(JsonError(format!(
                "invalid length {}, expected an array of {N}",
                a.len()
            )));
        }
        let got: Vec<T> = items(v).collect::<Result<_, _>>()?;
        got.try_into()
            .map_err(|_| JsonError(format!("expected an array of {N}")))
    }
}

impl<A: FromJson, B: FromJson> FromJson for (A, B) {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        match array(v)?.as_slice() {
            [a, b] => Ok((A::from_json(a)?, B::from_json(b)?)),
            _ => Err(JsonError::expected("a pair", v)),
        }
    }
}

impl<A: FromJson, B: FromJson, C: FromJson> FromJson for (A, B, C) {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        match array(v)?.as_slice() {
            [a, b, c] => Ok((A::from_json(a)?, B::from_json(b)?, C::from_json(c)?)),
            _ => Err(JsonError::expected("a triple", v)),
        }
    }
}

/// A map key: JSON object keys are strings, and a numeric key type parses it, as serde_json does.
pub trait FromJsonKey: Sized {
    fn from_key(k: &str) -> Result<Self, JsonError>;
}

impl FromJsonKey for String {
    fn from_key(k: &str) -> Result<Self, JsonError> {
        Ok(k.to_owned())
    }
}

macro_rules! numeric_key {
    ($($t:ty),*) => {$(
        impl FromJsonKey for $t {
            fn from_key(k: &str) -> Result<Self, JsonError> {
                k.parse().map_err(|_| JsonError(format!("invalid map key `{k}`, expected {}", stringify!($t))))
            }
        }
    )*};
}
numeric_key!(u8, u16, u32, u64, usize, i32, i64);

fn entries<K: FromJsonKey, V: FromJson>(
    v: &Value,
) -> Result<impl Iterator<Item = Result<(K, V), JsonError>> + '_, JsonError> {
    let o = v
        .as_object()
        .ok_or_else(|| JsonError::expected("a map", v))?;
    Ok(o.iter()
        .map(|(k, x)| Ok((K::from_key(k)?, V::from_json(x).map_err(|e| e.at(k))?))))
}

impl<K: FromJsonKey + Eq + Hash, V: FromJson> FromJson for IndexMap<K, V> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        entries(v)?.collect()
    }
}

impl<K: FromJsonKey + Eq + Hash, V: FromJson> FromJson for HashMap<K, V> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        entries(v)?.collect()
    }
}

impl<K: FromJsonKey + Ord, V: FromJson> FromJson for BTreeMap<K, V> {
    fn from_json(v: &Value) -> Result<Self, JsonError> {
        entries(v)?.collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(FromJson, Debug, PartialEq, Default)]
    #[json(rename_all = "camelCase")]
    struct Inner {
        unit_words: Vec<String>,
        maybe: Option<u32>,
        #[json(default)]
        flag: bool,
    }

    #[derive(FromJson, Debug, PartialEq)]
    #[json(rename_all = "camelCase", deny_unknown_fields)]
    struct Strict {
        a_b: String,
    }

    #[derive(FromJson, Debug, PartialEq)]
    #[json(rename_all = "lowercase")]
    enum Pos {
        Before,
        After,
    }

    #[derive(FromJson, Debug, PartialEq)]
    #[json(untagged)]
    enum Either {
        One(String),
        Many(IndexMap<String, String>),
    }

    #[derive(FromJson, Debug, PartialEq)]
    struct Outer {
        #[json(flatten)]
        inner: Inner,
        #[json(rename = "p")]
        pos: Pos,
        e: Either,
    }

    #[test]
    fn decodes_what_serde_did() {
        let o: Outer =
            parse_json(r#"{"unitWords":["x"],"p":"after","e":{"k":"v"},"extra":1}"#).unwrap();
        assert_eq!(
            o.inner,
            Inner {
                unit_words: vec!["x".into()],
                maybe: None,
                flag: false
            }
        );
        assert_eq!(o.pos, Pos::After);
        assert_eq!(
            o.e,
            Either::Many(IndexMap::from([("k".into(), "v".into())]))
        );
        assert_eq!(
            parse_json::<Either>(r#""s""#).unwrap(),
            Either::One("s".into())
        );
    }

    #[test]
    fn fails_where_serde_did() {
        let missing = parse_json::<Inner>(r#"{}"#).unwrap_err();
        assert_eq!(missing.0, "missing field `unitWords`");
        let nested = parse_json::<Inner>(r#"{"unitWords":["x",2]}"#).unwrap_err();
        assert_eq!(
            nested.0,
            "unitWords: [1]: invalid type: a number, expected a string"
        );
        assert!(parse_json::<Strict>(r#"{"aB":"","c":1}"#).is_err());
        assert!(parse_json::<Pos>(r#""middle""#).is_err());
        assert!(parse_json::<Either>("3").is_err());
        assert!(parse_json::<u32>("-1").is_err());
        assert!(parse_json::<u32>("1.5").is_err());
        assert!(parse_json::<Inner>(r#"{"unitWords":[],"flag":null}"#).is_err());
    }
}
