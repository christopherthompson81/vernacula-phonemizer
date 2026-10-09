//! An environment variable, or `None`.
//! Ported from src/core/env.ts.

pub fn env(name: &str) -> Option<String> {
    std::env::var(name).ok()
}
