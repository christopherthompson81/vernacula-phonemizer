//! The synchronous data seam: everything the engine loads goes through one `read(key)`.
//! Ported from src/core/dataSource.ts and src/core/nodeDataSource.ts.
//!
//! The default source reads the repo-root `data/` tree from the filesystem: `VERNACULA_DATA_DIR` if set,
//! else the `data/` beside this crate's checkout. A consumer that ships the data elsewhere calls
//! `set_data_root` (or installs its own `DataSource`) before the first phonemize.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};

use super::env::env;

pub trait DataSource: Send + Sync {
    /// The bytes for `key`, or `DataError::Missing`. Never empty bytes for an absent file.
    fn read(&self, key: &str) -> Result<Vec<u8>, DataError>;
}

#[derive(Debug)]
pub enum DataError {
    /// No source is installed: a configuration error, never treated as an optional file's absence.
    NoSource(String),
    Missing {
        key: String,
        detail: String,
    },
}

impl std::fmt::Display for DataError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DataError::NoSource(key) => {
                write!(f, "No data source installed — cannot read \"{key}\".")
            }
            DataError::Missing { key, detail } => {
                write!(f, "data key \"{key}\" not readable: {detail}")
            }
        }
    }
}

impl std::error::Error for DataError {}

/// Reads keys as files under a root directory.
pub struct FsDataSource {
    pub root: PathBuf,
}

impl DataSource for FsDataSource {
    fn read(&self, key: &str) -> Result<Vec<u8>, DataError> {
        std::fs::read(self.root.join(key)).map_err(|e| DataError::Missing {
            key: key.to_string(),
            detail: format!("{} ({e})", self.root.join(key).display()),
        })
    }
}

/// `VERNACULA_DATA_DIR`, else `<checkout>/data` when it exists.
pub fn resolve_data_root() -> Option<PathBuf> {
    if let Some(dir) = env("VERNACULA_DATA_DIR") {
        return Some(PathBuf::from(dir));
    }
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../data");
    repo.exists().then_some(repo)
}

static SOURCE: RwLock<Option<Arc<dyn DataSource>>> = RwLock::new(None);
static DEFAULTED: std::sync::Once = std::sync::Once::new();
static RECORDER: Mutex<Option<BTreeSet<String>>> = Mutex::new(None);

fn current() -> Option<Arc<dyn DataSource>> {
    DEFAULTED.call_once(|| {
        let mut s = SOURCE.write().unwrap();
        if s.is_none() {
            *s = resolve_data_root()
                .map(|root| Arc::new(FsDataSource { root }) as Arc<dyn DataSource>);
        }
    });
    SOURCE.read().unwrap().clone()
}

/// Install the data source. ⚠ Call before the first phonemize: loaded tables are cached for the process.
pub fn set_data_source(next: Option<Arc<dyn DataSource>>) {
    DEFAULTED.call_once(|| {});
    *SOURCE.write().unwrap() = next;
}

/// Install a filesystem source rooted at `root` (a directory laid out like the repo's `data/`).
pub fn set_data_root(root: impl Into<PathBuf>) {
    set_data_source(Some(Arc::new(FsDataSource { root: root.into() })));
}

pub fn read_data(key: &str) -> Result<Vec<u8>, DataError> {
    let source = current().ok_or_else(|| DataError::NoSource(key.to_string()))?;
    let bytes = source.read(key)?;
    if let Some(r) = RECORDER.lock().unwrap().as_mut() {
        r.insert(key.to_string());
    }
    Ok(bytes)
}

/// `TextDecoder("utf-8")`: invalid sequences become U+FFFD and a leading BOM is dropped.
pub fn read_data_text(key: &str) -> Result<String, DataError> {
    let bytes = read_data(key)?;
    let text = String::from_utf8_lossy(&bytes);
    Ok(text.strip_prefix('\u{FEFF}').unwrap_or(&text).to_string())
}

/// Every key `f` reads, sorted. Not reentrant across threads: one recording per process at a time.
pub fn record_data_keys<T>(f: impl FnOnce() -> T) -> (T, Vec<String>) {
    let outer = RECORDER.lock().unwrap().replace(BTreeSet::new());
    let result = f();
    let own = std::mem::replace(&mut *RECORDER.lock().unwrap(), outer).unwrap_or_default();
    if let Some(o) = RECORDER.lock().unwrap().as_mut() {
        o.extend(own.iter().cloned());
    }
    (result, own.into_iter().collect())
}
