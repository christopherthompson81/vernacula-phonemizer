pub mod english;
pub mod english_gb;
pub mod french;
pub mod hindi;
pub mod italian;
pub mod japanese;
pub mod mandarin;
pub mod portuguese;
pub mod portuguese_br;
pub mod spanish;

/// The fraction guards are mirrors in the ported `\b…\b` family and Italian (#1495). Relational, as
/// test/fraction-guards-1495.test.ts: a declined fraction reads as its numbers spaced.
#[cfg(test)]
mod fraction_guard_tests {
    use crate::phonemize;

    #[test]
    fn fraction_guards_are_mirrors_in_the_word_edge_family() {
        let dot = [
            ("1/2.5", "1 2.5"),
            ("1.5/2", "1.5 2"),
            ("1/1,000", "1 1,000"),
            ("1,000/2", "1,000 2"),
        ];
        let comma = [
            ("1/2,5", "1 2,5"),
            ("1,5/2", "1,5 2"),
            ("1/2.5", "1 2.5"),
            ("1.5/2", "1.5 2"),
        ];
        let shared = [
            ("3/1/2", "3 1 2"),
            ("1/2/3", "1 2 3"),
            ("1/2,3/4", "1/2, 3/4"),
            ("1/2.", "1/2 ."),
        ];
        for lang in ["en", "es", "pt", "fr", "it"] {
            let say = |s: &str| phonemize(s, lang).unwrap();
            let own: &[(&str, &str)] = if lang == "en" { &dot } else { &comma };
            for (input, spaced) in own.iter().chain(shared.iter()) {
                assert_eq!(say(input), say(spaced), "{lang} {input}");
            }
            assert_ne!(say("1/3"), say("1 3"), "{lang}");
        }
    }
}
