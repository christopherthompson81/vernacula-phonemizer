import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, createHebrew } from "../src/languages/hebrew/hebrew.ts";

// Canonical-IPA goldens for Hebrew (he) — Afro-Asiatic (Semitic), the Hebrew abjad, MODERN ISRAELI pronunciation.
// A niqqud→IPA segmental g2p over VOCALIZED (pointed) input; UNVOCALIZED text is restored first by the neural
// nakdan (hebrewNeural.ts — the Arabic-diacritizer analogue), covered in test/hebrewNeural.test.ts.
// Hand-adjudicated against en.wiktionary vocalized→a=IL
// IPA, the folds stripping stress (unwritten), the variable glottal ⟨א⟩/⟨ע⟩=ʔ, the
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

// ── TEXT NORMALIZATION (src/languages/hebrew/normalize.ts) ────────────────────────────────────────────
// The pre-tokenizer pass. Counts, sourcing and every refusal are in that file's header and in
// docs/investigations/he_normalization_investigation.md. These assert through the real `phonemize`, so
// they also pin the ordering couplings between the numbered steps.
// ⚠ THE BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). Each proclitic is exercised separately because
// each has its OWN vocalization, and the two that are not plain sheva — הַ [ha] and מֵ [me] — are the ones
// the corpus writes least and the ones that were wrong.
describe("Hebrew text normalization", () => {
    // The layer's biggest class: a one-letter preposition attached to a numeral with a hyphen or a MAQAF.
    // Before this rule each read as a BARE CONSONANT and `ה-` read as the empty string.
    test("proclitic + hyphen/maqaf + digits → the vocalized prefix", () => {
        expect(phonemize("ב-106", "he")).toBe("be meʔa veʃeʃ"); // בְּ, sheva-na realised [e]
        expect(phonemize("כ-90", "he")).toBe("ke tiʃʔim"); // כְּ "approximately"
        expect(phonemize("ל-450", "he")).toBe("le ʔaʁba meot veχamiʃim");
        expect(phonemize("ו-84", "he")).toBe("ve ʃmonim veʔaʁba");
        expect(phonemize("מ-2015", "he")).toBe("me ʔalpajim veχameʃ ʔesʁe"); // מֵ, not sheva — see PROCLITIC
        expect(phonemize("ה-19", "he")).toBe("ha tʃa ʔesʁe"); // הַ patach; read as "" before this layer
        expect(phonemize("ל־650", "he")).toBe("le ʃeʃ meot veχamiʃim"); // MAQAF U+05BE, ×36
        expect(phonemize("בכ-6", "he")).toBe("be ke ʃeʃ"); // a TWO-letter run, each letter vocalized alone
        expect(phonemize("ב-Google", "he")).toBe("be ɡˈuːɡəɫ"); // …and before a Latin run, ×26
    });

    // ⚠ A HYPHEN BEFORE A HEBREW WORD IS A COMPOUND, NOT A PROCLITIC — all 29 corpus instances. The left
    // guard is what keeps `הים-תיכוני` from looking like the proclitic run ⟨ים⟩ (trap 1's lookaround form).
    test("the hyphen rule does not claim a compound or a range", () => {
        expect(phonemize("הים-תיכוני", "he")).toBe("hjm tjχvnj");
        expect(phonemize("על-פני", "he")).toBe("ʔl fnj");
        expect(phonemize("1990-1995", "he")).toBe("ʔelef tʃa meot vetiʃʔim ʔelef tʃa meot tiʃʔim veχameʃ");
    });

    // ⚠ THE GERSHAYIM PARTITION. An acronym's mark sits before the LAST letter and the whole thing is read
    // as one word; a proclitic run before a mark and a whole word is an opening QUOTE. 146/146 in the
    // corpus. The eight glossed abbreviations at step 4 are expanded instead, and run first.
    test("gershayim: acronym joins, opening quote splits, glossed abbreviations expand", () => {
        expect(phonemize('צה"ל', "he")).toBe("t͡shl"); // joined to a skeleton the tagger can vocalize
        expect(phonemize('תשפ"ד', "he")).toBe("tʃfd"); // a GEMATRIA year takes the same arm — it is read as a word
        expect(phonemize('כמנכ"לית', "he")).toBe("χmnχljt"); // multi-letter tail, but כמנכ is not all-proclitic
        expect(phonemize('ו"העיר', "he")).toBe("ve hʔjʁ"); // …against a proclitic + a quoted word
        expect(phonemize('ול"אלבום', "he")).toBe("ve le ʔlvvm"); // a two-letter proclitic run before a quote
        expect(phonemize('ד"ר', "he")).toBe("doktoʁ");
        expect(phonemize('לפנה"ס', "he")).toBe("lifne hasfiʁa"); // the era marker, ×10
        expect(phonemize('ק"מ', "he")).toBe("kilometeʁ");
        expect(phonemize('קמ"ר', "he")).toBe("kilometeʁ ʁavua");
        expect(phonemize('לסמ"ק', "he")).toBe("lesentimeteʁ meʔukav"); // the glued proclitic is VOCALIZED, not carried
    });

    // Digit de-grouping first, or the grouping comma is a clause pause and the tail is its own number.
    // The dot is Hebrew's decimal point in all 53 corpus instances and stays with the engine's own reader.
    test("digit de-grouping, and the dot left alone", () => {
        expect(phonemize("1,234", "he")).toBe("ʔelef matajim ʃloʃim veʔaʁba");
        expect(phonemize("11.4", "he")).toBe("ʔaχat ʔesʁe nkuda ʔaʁba");
    });

    // Signs. Both orders for `$` — that is bidi, not inconsistency — and the MINUS is written after the
    // unit for the same reason. The minus rule must run above the degree rule, which spends its `°C`.
    test("percent, currency in both orders, the trailing minus, degrees and the exponent", () => {
        expect(phonemize("8%", "he")).toBe("ʃmone ʔaχuz"); // אָחוּז, singular after any number
        expect(phonemize("בסך $100", "he")).toBe("vsχ meʔa dolaʁ");
        expect(phonemize("(60,134$)", "he")).toBe("ʃiʃim ʔelef meʔa ʃloʃim veʔaʁba dolaʁ"); // sign LAST
        expect(phonemize("815,272 מיליון $", "he")).toBe("ʃmone meot veχameʃ ʔesʁe ʔelef matajim ʃivʔim "
            + "veʃtajim mjljvn dolaʁ"); // a magnitude between the number and the sign
        expect(phonemize("2°C", "he")).toBe("ʃtajim maʔalot t͡selzius");
        expect(phonemize("18°C-", "he")).toBe("minus ʃmone ʔesʁe maʔalot t͡selzius"); // the RTL trailing minus
        expect(phonemize("78°", "he")).toBe("ʃivʔim veʃmone maʔalot"); // a coordinate: no scale name
        expect(phonemize("8²", "he")).toBe("ʃmone beʁibua");
        expect(phonemize("15 km³", "he")).toBe("χameʃ ʔesʁe kilometeʁ meʔukav");
    });

    // The colon is declared clause punctuation, so a clock read as a sentence break. Substituting a SPACE
    // removes the pause and invents no vocabulary — four of the corpus's five instances are not clocks.
    test("the clock colon is a space, not a pause", () => {
        expect(phonemize("12:30", "he")).toBe("ʃtem ʔesʁe ʃloʃim");
    });

    // ⚠ THE GERESH DIGRAPH IS A G2P FACT, NOT A NORMALIZATION ONE (hebrew.ts + hebrew.jsonc). Before it,
    // the token class split the word at the mark AND the base letter kept its plain value: `ג'יימס` read
    // *ɡ jjms*. The word-MEDIAL and word-FINAL positions are both pinned — the medial one is what the
    // neural path's own token class still got wrong.
    test("geresh digraphs ג׳ צ׳ ז׳, in every position", () => {
        expect(phonemizeWord("ג'וֹן")).toBe("d͡ʒon"); // onset, with the holam male the vocalized path supplies
        expect(phonemizeWord("בייג'ינג")).toBe("vjjd͡ʒjnɡ"); // word-MEDIAL (bare skeleton: soft ⟨ב⟩, no niqqud)
        expect(phonemizeWord("ג'ורג'")).toBe("d͡ʒvʁd͡ʒ"); // and word-FINAL
        expect(phonemizeWord("צ'רלי")).toBe("t͡ʃʁlj");
        expect(phonemizeWord("סמיונוביץ'")).toBe("smjvnvvjt͡ʃ"); // final ץ׳
        expect(phonemizeWord("ז'אן")).toBe("ʒn");
        // …and a geresh on any OTHER letter contributes nothing but must still not split the word.
        expect(phonemizeWord("נורת'")).toBe("nvʁt");
    });

    // ⚠ A FURTIVE PATACH NEEDS A VOWEL TO BE FURTIVE TO. On a one-letter word the rule ran backwards and
    // the definite article הַ read as *ah* — which is the word the proclitic rule emits 41 times.
    test("the furtive patach does not fire on a one-letter word", () => {
        expect(phonemizeWord("הַ")).toBe("ha");
        expect(phonemizeWord("מָשִׁיחַ")).toBe("maʃiaχ"); // …and still fires where it should
    });
});
