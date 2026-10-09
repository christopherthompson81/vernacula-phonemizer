//! Foreign runs: the default foreign reader, the host-language stack for nested engines, and the
//! process-wide foreign-OOV memo. Ported from src/core/foreign.ts.
//!
//! The host stack is per thread: one phonemize call runs on one thread, as the JS engine's one call stack.
//! The readers and the OOV memo are process-wide, as in JS (the memo is warmed by one call and read by later
//! ones, in any language).

use std::cell::RefCell;
use std::sync::{Arc, Mutex, RwLock};

use indexmap::IndexMap;

use super::js_string::JsString;

pub type ForeignPhonemizer = Arc<dyn Fn(&JsString) -> JsString + Send + Sync>;
pub type ScriptReader = Arc<dyn Fn(&JsString, &JsString) -> Option<JsString> + Send + Sync>;

static DEFAULT_FOREIGN: RwLock<Option<ForeignPhonemizer>> = RwLock::new(None);
static SCRIPT_READER: RwLock<Option<ScriptReader>> = RwLock::new(None);

pub fn set_default_foreign(f: ForeignPhonemizer) {
    *DEFAULT_FOREIGN.write().unwrap() = Some(f);
}

pub fn get_default_foreign() -> Option<ForeignPhonemizer> {
    DEFAULT_FOREIGN.read().unwrap().clone()
}

pub fn set_script_reader(f: ScriptReader) {
    *SCRIPT_READER.write().unwrap() = Some(f);
}

thread_local! {
    static HOSTS: RefCell<Vec<JsString>> = const { RefCell::new(Vec::new()) };
}

pub fn host_depth() -> usize {
    HOSTS.with(|h| h.borrow().len())
}

pub fn push_host(lang: &JsString) {
    HOSTS.with(|h| h.borrow_mut().push(lang.clone()));
}

pub fn pop_host() {
    HOSTS.with(|h| {
        h.borrow_mut().pop();
    });
}

/// Run `f` with `lang` as the innermost host; popped even if `f` panics.
pub fn with_host<T>(lang: &JsString, f: impl FnOnce() -> T) -> T {
    struct Pop;
    impl Drop for Pop {
        fn drop(&mut self) {
            pop_host();
        }
    }
    push_host(lang);
    let _pop = Pop;
    f()
}

pub fn read_foreign_run(run: &JsString) -> Option<JsString> {
    let (host, depth) = HOSTS.with(|h| {
        let h = h.borrow();
        (h.last().cloned(), h.len())
    });
    let reader = SCRIPT_READER.read().unwrap().clone();
    match (reader, host) {
        (Some(reader), Some(host)) if depth <= 3 => reader(run, &host),
        _ => None,
    }
}

const FOREIGN_OOV_MAX: usize = 20_000;
static FOREIGN_OOV: Mutex<Option<IndexMap<JsString, JsString>>> = Mutex::new(None);

/// Memo a neural reading; at capacity the OLDEST insertion is evicted (JS `Map` order).
pub fn add_foreign_oov(g2p_key: &JsString, ipa: &JsString) {
    let mut guard = FOREIGN_OOV.lock().unwrap();
    let memo = guard.get_or_insert_with(IndexMap::new);
    if memo.len() >= FOREIGN_OOV_MAX {
        memo.shift_remove_index(0);
    }
    // `Map.set` on an existing key keeps its position.
    memo.insert(g2p_key.clone(), ipa.clone());
}

pub fn clear_foreign_oov() {
    if let Some(m) = FOREIGN_OOV.lock().unwrap().as_mut() {
        m.clear();
    }
}

pub fn lookup_foreign_oov(g2p_key: &JsString) -> Option<JsString> {
    FOREIGN_OOV.lock().unwrap().as_ref()?.get(g2p_key).cloned()
}
