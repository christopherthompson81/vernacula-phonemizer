import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, segment } from "../src/languages/burmese/burmese.ts";

// Canonical-IPA goldens for Burmese / မြန်မာ (my) — Sino-Tibetan, the Mon-Burmese abugida (logical order). The
// core challenge is the RIME chart (vowel × coda: ောင်→aʊɴ, ိုင်→aɪɴ, ိန်→eɪɴ, ုန်→oʊɴ, bare င်→ɪɴ), the ⟨ွ⟩
// labialisation, minor-syllable reduction (bare open non-final → ə), medial palatalisation (ကျ→t͡ɕ, ငြ→ɲ) and the
// voiceless ⟨ှ⟩ sonorants (မှ→m̥). The FOUR tones (low ˨ / high ˥˩ / creaky ˥ˀ / checked ʔ) are ORTHOGRAPHIC and
// rule-derived — see the tone test below. Validated vs wikipron mya (54.2% segmental, 99.6% mono tone) + kaikki
// mya (55.9%). See docs/investigations/my_native_bringup_investigation.md.
describe("burmese canonical IPA", () => {
    test("consonants, medials, rimes, minor-syllable reduction (+ tone)", () => {
        const cases: [string, string][] = [
            ["မြန်မာ", "mja˨ɴma˨"], // Myanmar — မြ medial-j, န် → aɴ, both low
            ["ဗမာ", "bəma˨"], // Bama — minor syllable bə (toneless) + low
            ["ကျောင်း", "t͡ɕaʊ˥˩ɴ"], // 'school' — ကျ→t͡ɕ, ောင်→aʊɴ (aung), visarga း → high
            ["အိမ်", "ʔeɪ˨ɴ"], // 'house' — ိ+m → eɪɴ (ein), nasal → low
            ["တစ်", "tɪʔ"], // 'one' — bare စ် → ɪʔ (checked, toneless)
            ["ဆရာ", "sʰəja˨"], // 'teacher' — ဆ→sʰ, ရ→j, minor ə
            ["ငြိမ့်", "ɲeɪ˥ˀɴ"], // 'calm' — ငြ → ɲ (velar-nasal palatalisation), dot ့ → creaky
            ["လွင်", "lwɪ˨ɴ"], // ⟨ွ⟩ stays a -w- glide before -ng (not rounded)
            ["ဗုဒ္ဓ", "boʊʔda˥ˀ"], // 'Buddha' — stacked ဒ္ဓ: the upper ဒ is a CHECKED coda (oʊʔ), ဓ the next onset
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("voiceless ⟨ှ⟩ sonorants + ⟨ွ⟩ labialisation", () => {
        expect(phonemizeWord("မှ")).toBe("m̥a˥ˀ"); // voiceless m, creaky
        expect(phonemizeWord("လှ")).toBe("l̥a˥ˀ"); // voiceless l, creaky
        expect(phonemizeWord("ကွန်")).toBe("kʊ˨ɴ"); // ⟨ွ⟩ rounds → ʊ before -n
    });

    // The four tones are orthographic: explicit marks (visarga း → high, dot-below ့ → creaky, asat-on-vowel ော် →
    // low) win, else a closed (nasal) syllable is low and an open one is by vowel (◌ော/◌ဲ high; bare/short ◌ိ/◌ု
    // creaky; else low). Checked (ʔ) syllables carry no tone letter.
    test("tone (Chao: low ˨ / high ˥˩ / creaky ˥ˀ)", () => {
        expect(phonemizeWord("က")).toBe("ka˥ˀ"); // bare inherent open → creaky
        expect(phonemizeWord("ကန်")).toBe("ka˨ɴ"); // nasal coda → low
        expect(phonemizeWord("ကန်း")).toBe("ka˥˩ɴ"); // visarga → high
        expect(phonemizeWord("ကန့်")).toBe("ka˥ˀɴ"); // dot-below → creaky
        expect(phonemizeWord("ကျော်")).toBe("t͡ɕɔ˨"); // asat-on-vowel ော် → low
        expect(phonemizeWord("မီး")).toBe("mi˥˩"); // long ◌ီ + visarga → high
        expect(phonemizeWord("ဩ")).toBe("ʔɔ˥˩"); // independent vowel: default high
        expect(phonemizeWord("ဦး")).toBe("ʔu˥˩"); // independent vowel ဦ (low) + visarga → high
    });

    // Intervocalic voicing sandhi is LEXICAL (per-word voicing-lexicon.tsv, mined from the kaikki gold): a
    // voiceless onset voices after a vowel/nasal inside a compound (word-initial only for a minor ə syllable).
    // OOV words keep the careful voiceless reading.
    test("voicing sandhi (lexicon)", () => {
        expect(phonemizeWord("စကား")).toBe("zəɡa˥˩"); // sa-ka → zə-ɡa (minor-ə initial + medial voice)
        expect(phonemizeWord("ဗုဒ္ဓဟူး")).toBe("boʊʔdəhu˥˩"); // 'Buddha' — voiced ဟ→d + stacked ဒ္ဓ checked coda
        expect(phonemizeWord("ကတော့")).toBe("ɡədɔ˥ˀ"); // ka-tɔ → ɡə-dɔ
    });

    // Pronunciation lexicon (the LEXICAL layer, dictionary.tsv, mined from the kaikki gold): a per-word canonical-IPA
    // override for words the rule g2p can't derive — lexical rime (ည→ɛ, ေ→i), colloquial forms, Pali gemination.
    // Authoritative over the rules; OOV words fall through to the rule g2p.
    test("pronunciation lexicon (lexical overrides)", () => {
        expect(phonemizeWord("လည်")).toBe("lɛ˨"); // lexical ◌ည် → ɛ (not the rule default i)
        expect(phonemizeWord("ချေး")).toBe("t͡ɕʰi˥˩"); // lexical ◌ေး → i
        expect(phonemizeWord("ဘုရား")).toBe("pʰəja˥˩"); // colloquial 'pagoda'
    });

    // Word segmentation: Burmese is spaceless, so a connected run is split into words (DAG maximal-match over
    // seg-words.txt, boundaries constrained to syllable starts) before phonemizing — which also lets the per-word
    // voicing lexicon fire on running text. A single word segments to itself (per-word eval unaffected).
    test("segmentation splits spaceless runs (+ voicing on running text)", () => {
        expect(segment("စကားပြော")).toEqual(["စကား", "ပြော"]); // 'speak' + 'say'
        expect(segment("မြန်မာစကား")).toEqual(["မြန်မာ", "စကား"]);
        expect(segment("စကား")).toEqual(["စကား"]); // a single word is unchanged
        // voicing now fires across the segmented run (စကား → zəɡa)
        expect(phonemize("မြန်မာစကား", "my")).toBe("mja˨ɴma˨ zəɡa˥˩");
    });

    test("cardinal numbers (#562)", () => {
        // Burmese names every power of ten from 10¹ to 10⁷, read place by place — and writes the
        // numeral SOLID, so the composed form must equal the single-word spelling (which is what
        // lets the engine compound voicing apply: 100 is [təja˨], not [tɪʔ ja˨]).
        expect(phonemize("0", "my")).toBe(phonemize("သုည", "my"));
        expect(phonemize("5", "my")).toBe(phonemize("ငါး", "my")); // was read in ENGLISH before
        expect(phonemize("၅", "my")).toBe(phonemize("ငါး", "my")); // Burmese digits were DROPPED before
        expect(phonemize("၂၅", "my")).toBe(phonemize("25", "my"));
        // The multiplier တစ် is omitted at ဆယ် but spoken at ရာ and above.
        expect(phonemize("10", "my")).toBe(phonemize("ဆယ်", "my"));
        expect(phonemize("100", "my")).toBe(phonemize("တစ်ရာ", "my"));
        expect(phonemize("1000", "my")).toBe(phonemize("တစ်ထောင်", "my"));
        // A place word is CREAKY when a nonzero remainder follows, plain when the number ends there.
        expect(phonemize("20", "my")).toBe(phonemize("နှစ်ဆယ်", "my"));
        expect(phonemize("25", "my")).toBe(phonemize("နှစ်ဆယ့်ငါး", "my"));
        expect(phonemize("101", "my")).toBe(phonemize("တစ်ရာ့တစ်", "my"));
        expect(phonemize("12345", "my")).toBe(phonemize("တစ်သောင်းနှစ်ထောင့်သုံးရာ့လေးဆယ့်ငါး", "my"));
        // Above 10⁷ the places repeat: 10⁹ is "a hundred crore".
        expect(phonemize("1000000", "my")).toBe(phonemize("တစ်သန်း", "my"));
        expect(phonemize("1000000000", "my")).toBe(phonemize("တစ်ရာကုဋေ", "my"));
    });
});
