//! Wall time of `phonemize` over astral-heavy text (the #1464 review's quadratic case).
fn main() {
    for n in [1000, 4000] {
        let text = format!("{} a", "😀".repeat(n));
        let t = std::time::Instant::now();
        let ipa = vernacula_phonemizer::phonemize(&text, "en").unwrap();
        println!("{n} emoji: {:?} → {:?}", t.elapsed(), ipa);
    }
}
