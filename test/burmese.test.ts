import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, segment } from "../src/languages/burmese/burmese.ts";

// Canonical-IPA goldens for Burmese / မြန်မာ (my) — Sino-Tibetan, the Mon-Burmese abugida (logical order). The
// core challenge is the RIME chart (vowel × coda: ောင်→aʊɴ, ိုင်→aɪɴ, ိန်→eɪɴ, ုန်→oʊɴ, bare င်→ɪɴ), the ⟨ွ⟩
// labialisation, minor-syllable reduction (bare open non-final → ə), medial palatalisation (ကျ→t͡ɕ, ငြ→ɲ) and the
// voiceless ⟨ှ⟩ sonorants (မှ→m̥). The FOUR tones (low ˨ / high ˥˩ / creaky ˥ˀ / checked ʔ) are ORTHOGRAPHIC and
// rule-derived — see the tone test below. Validated vs wikipron mya (54.2% segmental, 99.6% mono tone) + kaikki
// mya (55.9%). See docs/my_native_bringup_investigation.md.
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
        expect(phonemizeWord("ကမ္ဘာ")).toBe("ɡəba˨"); // kaba → ɡəba ('world', stacked ္ဘ)
        expect(phonemizeWord("ကတော့")).toBe("ɡədɔ˥ˀ"); // ka-tɔ → ɡə-dɔ
        expect(phonemizeWord("ကား")).toBe("ka˥˩"); // OOV-style: word-initial FULL syllable does NOT voice
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
});
