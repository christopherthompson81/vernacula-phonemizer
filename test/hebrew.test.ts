import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, createHebrew } from "../src/languages/hebrew/hebrew.ts";

// Canonical-IPA goldens for Hebrew (he) — Afro-Asiatic (Semitic), the Hebrew abjad, MODERN ISRAELI pronunciation.
// A niqqud→IPA segmental g2p over VOCALIZED (pointed) input (unvocalized restoration — a neural nakdan —
// is deferred — the Arabic-diacritizer analogue). Hand-adjudicated against en.wiktionary vocalized→a=IL
// IPA (2561 words): 87.1% folded, the folds stripping stress (unwritten), the variable glottal ⟨א⟩/⟨ע⟩=ʔ, the
// velar-nasal allophone, and resh notation. Signatures: bgdkpt dagesh (בּ→b/ב→v, כּ→k/כ→χ, פּ→p/פ→f); ⟨ש⟩ shin/sin;
// ⟨ו⟩ shuruk וּ→u / holam male וֹ→o; patach genuvah (final guttural's patach surfaces before it, מָשִׁיחַ→maʃiaχ).
describe("Hebrew canonical IPA — niqqud→IPA (Modern Israeli)", () => {
    test("bgdkpt dagesh split + ⟨ש⟩ shin/sin + ⟨ו⟩ specials", () => {
        expect(phonemizeWord("בַּיִת")).toBe("bajit"); // dagesh בּ→b; ⟨יִ⟩…⟨ת⟩; yod glide
        expect(phonemizeWord("אָב")).toBe("ʔav"); // soft ⟨ב⟩→v
        expect(phonemizeWord("שָׁלוֹם")).toBe("ʃalom"); // shin-dot ⟨שׁ⟩→ʃ, holam male ⟨וֹ⟩→o
        expect(phonemizeWord("תּוֹרָה")).toBe("toʁa"); // ⟨ת⟩→t (always), holam male, silent final ⟨ה⟩
    });

    test("vowels + patach genuvah + quiescent letters", () => {
        expect(phonemizeWord("אֶבֶן")).toBe("ʔeven"); // segol→e, soft ב→v
        expect(phonemizeWord("סֵפֶר")).toBe("sefeʁ"); // tsere→e, ⟨ר⟩→ʁ
        expect(phonemizeWord("מָשִׁיחַ")).toBe("maʃiaχ"); // patach genuvah: final ⟨חַ⟩ → [aχ]
        expect(phonemizeWord("אֲבַטִּיחַ")).toBe("ʔavatiaχ"); // dagesh טּ, hiriq-yod mater, patach genuvah
    });

    test("text: words + clause punctuation", () => {
        expect(createHebrew().text("שָׁלוֹם, מָה שְׁלוֹמְךָ?")).toBe("ʃalom , ma ʃlomχa ?");
    });

    // Cardinal numbers (numbers.ts): feminine citation forms; מֵאָה fem vs אֶלֶף/מִילְיוֹן masc multipliers; duals
    // מָאתַיִם/אַלְפַּיִם; the internal וְ connector (→[v], sheva-na elided) before the last small cardinal, never a
    // magnitude word (מֵאָה אֶלֶף vs עֶשְׂרִים וְאֶחָד אֶלֶף). Digit tokens route through the rule g2p.
    test("numbers → IPA (feminine citation, gender/dual magnitudes, decimals)", () => {
        expect(phonemize("7","he")).toBe("ʃeva"); // שֶׁבַע — final-ayin glottal dropped (consensus)
        expect(phonemize("15","he")).toBe("χameʃ ʔesʁe");
        expect(phonemize("21","he")).toBe("ʔesʁim veʔaχat"); // tens · proclitic וְ (sheva-na realised [ve]) + unit
        expect(phonemize("100","he")).toBe("meʔa");
        expect(phonemize("200","he")).toBe("matajim"); // dual
        expect(phonemize("300","he")).toBe("ʃloʃ meot"); // fem unit + מֵאוֹת
        expect(phonemize("2000","he")).toBe("ʔalpajim"); // dual
        expect(phonemize("2025","he")).toBe("ʔalpajim ʔesʁim veχameʃ");
        expect(phonemize("3000","he")).toBe("ʃloʃet ʔalafim"); // construct + אֲלָפִים
        expect(phonemize("100000","he")).toBe("meʔa ʔelef"); // no vav before a magnitude word
        expect(phonemize("21000","he")).toBe("ʔesʁim veʔeχad ʔelef"); // masc multiplier, internal vav
        expect(phonemize("2000000","he")).toBe("ʃne miljon"); // construct שְׁנֵי
        expect(phonemize("3.14", "he")).toBe("ʃaloʃ nkuda ʔaχat ʔaʁba"); // decimal → נְקֻדָּה + digits
    });
});
