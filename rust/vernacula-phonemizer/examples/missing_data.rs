//! A wrong data root is an `Err`, not a panic: `VERNACULA_DATA_DIR=/nonexistent cargo run --example missing_data`.
fn main() {
    for lang in ["en", "en-GB", "xx"] {
        println!("{lang}: {:?}", vernacula_phonemizer::phonemize_best("Hello there.", lang));
    }
}
