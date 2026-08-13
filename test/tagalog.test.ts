import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    numberWords,
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/tagalog/tagalog.ts";

// Canonical-IPA goldens for Tagalog / Filipino (tl) — shallow near-phonemic Latin orthography, rule-based g2p.
// Digraphs ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ; r→ɾ; word-initial + intervocalic glottal stops [ʔ] (tao→taʔo); hyphen → [ʔ]
// (pag-ibig→paɡʔibiɡ); whole-word irregulars (mga→maŋa, ng→naŋ); penultimate stress (phonemic stress is
// unmarked in spelling).
describe("tagalog canonical IPA", () => {
    test("g2p: ng digraph, r→ɾ, glottal stops, special words", () => {
        const cases: [string, string][] = [
            ["mabuti", "mabˈuti"], // penult stress, r→ɾ absent here
            ["tao", "tˈaʔo"], // intervocalic glottal stop
            ["maganda", "maɡandˈa"], // ɡ; final stress (magandá) — from the stress lexicon, not naive penult
            ["kaibigan", "kaʔibˈiɡan"], // intervocalic ʔ + ɡ; penult (default)
            ["ngayon", "ŋajˈon"], // ng→ŋ, y→j; final stress (ngayón) — stress lexicon
            ["mga", "maŋˈa"], // special word: plural marker, pronounced mangá (final stress) — stress lexicon
            ["araw", "ʔˈaɾaw"], // word-initial ʔ, r→ɾ, w
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("word-final glottal stop set (shipped) vs rule-only (unwritten, lexical)", () => {
        // The word-final ʔ is phonemic but unwritten (a lexical residual). The shipped path appends it for words in
        // the wikipron-sourced set; the rule engine (used by the non-circular referee eval) does not.
        expect(phonemizeWord("acda")).toBe("ʔˈakdaʔ");
        expect(phonemizeWordRules("acda")).toBe("ʔˈakda");
        expect(phonemizeWord("aguho")).toBe("ʔaɡˈuhoʔ");
        // Words NOT in the set are unchanged (and an already-ʔ-final rule output is not doubled):
        expect(phonemizeWord("tao")).toBe("tˈaʔo");
        expect(phonemizeWord("araw")).toBe("ʔˈaɾaw");
    });

    test("stress lexicon (shipped) vs penult default (rule-only)", () => {
        // Phonemic stress is unwritten; the rule engine defaults to penultimate, but ~23% of words stress elsewhere.
        // The shipped path pins stress from a kaikki-sourced lexicon (single confident position); the rule engine
        // (used by the non-circular referee eval, which folds stress anyway) keeps the penultimate default.
        expect(phonemizeWord("salmon")).toBe("salmˈon"); // final stress (loanword)
        expect(phonemizeWordRules("salmon")).toBe("sˈalmon"); // penult default
        expect(phonemizeWord("doktor")).toBe("doktˈoɾ");
        expect(phonemizeWordRules("doktor")).toBe("dˈoktoɾ");
        // Stress homographs (kaikki lists >1 position) are abstained → penult default on both paths:
        expect(phonemizeWord("balik")).toBe("bˈalik");
    });

    test("loanword phonology: safe rules + shipped loanword lexicon", () => {
        // Safe deterministic rules (no native counterexample): ⟨z⟩→[s] (no native [z]), geminate ⟨rr⟩→[ɾ].
        expect(phonemizeWordRules("almarez")).toBe("ʔalmˈaɾes"); // z→s
        expect(phonemizeWordRules("aparri")).toBe("ʔapˈaɾi"); // rr→ɾ (not ɾɾ)
        // The FOREIGN-SEGMENT loanword class (Spanish ⟨j⟩→[h], soft ⟨c⟩→[s]) is pinned per-word on the SHIPPED path
        // only — origin-specific, so it never touches native words; the rule engine keeps ⟨j⟩→[d͡ʒ] → non-circular eval.
        expect(phonemizeWord("abenojar")).toBe("ʔabenˈohaɾ"); // Spanish ⟨j⟩→[h]
        expect(phonemizeWord("abece")).toBe("ʔabˈese"); // soft ⟨c⟩→[s]
        expect(phonemizeWordRules("abenojar")).toBe("ʔabenˈod͡ʒaɾ"); // rule engine keeps native ⟨j⟩→[d͡ʒ]
        // The ambiguous VV/glide/hiatus class is deliberately NOT mined (same spelling is native): core native words
        // keep their glide/ʔ, and a loan spelled the same way keeps the rule reading — no per-word corruption.
        expect(phonemizeWord("siya")).toBe("sˈija"); // native glide intact (would be corrupted by VV mining)
        expect(phonemizeWord("tao")).toBe("tˈaʔo"); // native hiatus ʔ intact
        expect(phonemizeWord("mabuti")).toBe("mabˈuti");
    });

    test("hyphen → glottal stop; number", () => {
        expect(phonemize("pag-ibig", "tl")).toBe("paɡʔˈibiɡ");
        expect(phonemize("salamat", "tl")).toContain("salˈamat");
    });

    // Native Tagalog number morphology (Wiktionary Appendix:Tagalog_numbers): irregular teens (labing- sandhi) and
    // tens (o→u raising, na/ng split), the productive -ng/" na" ligature + daan→raan + at→'t sandhi. Orthography
    // asserted directly; the IPA is derived via g2p (numbers are final-stressed except a penult exception set).
    test("number orthography (composition + ligature sandhi)", () => {
        const cases: [number, string][] = [
            [12, "labindalawa"],
            [14, "labing-apat"],
            [17, "labimpito"],
            [20, "dalawampu"],
            [21, "dalawampu't isa"],
            [40, "apatnapu"],
            [90, "siyamnapu"],
            [100, "sandaan"],
            [101, "sandaan at isa"],
            [125, "sandaan at dalawampu't lima"],
            [200, "dalawang daan"],
            [400, "apat na raan"], // daan → raan after the " na" ligature
            [900, "siyam na raan"],
            [1000, "sanlibo"],
            [2000, "dalawang libo"],
            [12345, "labindalawang libo tatlong daan at apatnapu't lima"],
            [100000, "sandaang libo"], // n-final ligature: daan/sandaan → daang/sandaang (not " na")
            [200000, "dalawang daang libo"],
            [1000000, "isang milyon"],
        ];
        for (const [n, exp] of cases) expect(numberWords(n)).toBe(exp);
    });

    test("number stress (final-except-penult; number-sense homographs)", () => {
        expect(phonemize("0", "tl")).toBe("sˈeɾo"); // séro — penult exception
        expect(phonemize("5", "tl")).toBe("limˈa"); // limá — final (number sense, general lexicon abstains)
        expect(phonemize("20", "tl")).toBe("dalawampˈu"); // dalawampú — final
        expect(phonemize("100", "tl")).toBe("sandaʔˈan"); // sandaán — final
        expect(phonemize("1000", "tl")).toBe("sanlˈibo"); // sanlíbo — penult exception
        expect(phonemize("200", "tl")).toBe("dalawˈaŋ daʔˈan"); // dalawáng daán — ligature keeps final stress
    });

    test("out-of-inventory accents fold; ñ is NATIVE and must not", () => {
        // `[A-Za-zÑñ]+` ended the token at an out-of-class diacritic, so that letter became an unclaimed gap read
        // as an English LETTER NAME: `São Paulo` → *s ˈə ʔˈo paʔˈulo*, `Klöcker` → *kl ˈoᶷ kkˈeɾ*.
        // ⚠ THE FOLD IS CONDITIONAL, and that is the whole subtlety here. Tagalog inherited `ñ` from Spanish and
        // reads it as /ɲ/, so folding every accent the way pcm does would destroy exactly the accented letter this
        // language CAN read.
        expect(phonemize("Cañitas", "tl")).toBe("kaɲˈitas");
        expect(phonemize("Doña Maria", "tl")).toContain("dˈoɲa");
        // An out-of-inventory accent folds to its base — Tagalog NATIVISES (`computer` → kompˈuteɾ, not English)
        // so a foreign name is read with Tagalog values, which needs a letter to read. Dropping it is deleting.
        expect(phonemize("São Paulo", "tl")).toBe(phonemize("Sao Paulo", "tl"));
        expect(phonemize("Klöcker", "tl")).toBe(phonemize("Klocker", "tl"));
        expect(phonemize("Klöcker", "tl")).not.toMatch(/ˈoᶷ/u);
        // The hyphen compound is one word, and native text is untouched.
        expect(phonemize("kaibigan-ko", "tl")).toBe("kaʔibiɡˈanʔko");
        expect(phonemize("ang mga bata", "tl")).toBe("ʔˈaŋ maŋˈa bˈata");
        expect(phonemize("computer", "tl")).toBe("kompˈuteɾ");
    });
});

// NORMALIZATION — the symbol tier + the shapes TOKEN gained. Every word corpus-attested with the sense
// checked (mined artifact + tl.wikipedia; the counts live in normalize.ts and the SYMBOLS block).
describe("tagalog normalization — symbols, numbers, ordinals, times", () => {
    test("percent — ⟨porsiyento⟩, the tl.wikipedia-majority spelling (575:216)", () => {
        expect(phonemize("50% ng populasyon", "tl")).toBe("limampˈu poɾsijˈento nˈaŋ populˈaʃon");
    });

    test("currency — ₱ piso, $ dolyar, postposed; magnitudes compose", () => {
        expect(phonemize("₱1,000", "tl")).toBe("sanlˈibo pˈiso");
        expect(phonemize("$19.8 bilyon", "tl")).toBe("labinsijˈam walˈo bˈiljon doljˈaɾ");
    });

    test("thousands de-group; a surviving dot reads its fraction digit-by-digit, the dot itself silent", () => {
        // ⚠ THE DECIMAL WORD IS REFUSED (the km arrangement): "punto lima" has ONE tl.wikipedia hit —
        // written Filipino does not spell the decimal word, so none is invented.
        expect(phonemize("3.5 kilometro", "tl")).toBe("tatlˈo limˈa kilomˈetɾo");
    });

    test("ika- ordinals — ika + cardinal fused, with the lexical contractions", () => {
        expect(phonemize("ika-20 siglo", "tl")).toBe("ʔikadalawampˈu sˈiɡlo");
        expect(phonemize("ika-2", "tl")).toBe("ʔikalawˈa"); // NOT *ikadalawa (tl.wikipedia 503:2)
        expect(phonemize("ika-3", "tl")).toBe("ʔikatlˈo");
    });

    test("⚠ ika-1 is suppletive ⟨una⟩, through the PROSE path — penult stress, not the number default", () => {
        expect(phonemize("ika-1", "tl")).toBe("ʔˈuna");
    });

    test("ampersand — ⟨at⟩; HTML entities are disposed of first and never voiced", () => {
        expect(phonemize("A & B", "tl")).toBe("ʔˈa ʔˈat b");
        expect(phonemize("14 &ndash; 16", "tl")).toBe("labiŋʔˈapat haŋɡˈaŋ labiŋʔˈanim"); // entity → range, not "at ndash"
    });

    test("digit ranges — the typographic dashes read ⟨hanggang⟩ (corpus ×32); the hyphen stays a compound", () => {
        expect(phonemize("1995–2000", "tl"))
            .toBe("sanlˈibo sijˈam nˈa ɾaʔˈan ʔˈat sijamnapˈut limˈa haŋɡˈaŋ dalawˈaŋ lˈibo");
    });

    test("units — km ⟨kilometro⟩ (tl.wikipedia 5,907)", () => {
        expect(phonemize("10 km", "tl")).toBe("sampˈu kilomˈetɾo");
    });

    test("times — ⚠ PROVISIONAL cardinals (the pcm arrangement): the alas- clock reading has ZERO corpus attestation", () => {
        expect(phonemize("12:23", "tl")).toBe("labindalawˈa dalawampˈut tatlˈo");
        expect(phonemize("08:50:38", "tl")).toBe("walˈo limampˈu tatlumpˈut walˈo");
        expect(phonemize("5:00", "tl")).toBe("limˈa"); // zero minutes silent — the bare hour
    });

    test("units — ⟨m⟩ ⟨mm⟩ ⟨l⟩ ⟨ha⟩, each with its SYMBOL named beside the word by tl.wikipedia", () => {
        // "Ang metro (simbolo: m)", "dalawang milimetro (2mm)", "L o l ang daglat ng litro",
        // "Ang ektarya, simbolo: ha". Before this, every one of these leaked raw ASCII into the IPA.
        expect(phonemize("10 m", "tl")).toBe("sampˈu mˈetɾo");
        expect(phonemize("10 mm", "tl")).toBe("sampˈu milimˈetɾo");
        expect(phonemize("10 l", "tl")).toBe("sampˈu lˈitɾo");
        expect(phonemize("10 L", "tl")).toBe("sampˈu lˈitɾo"); // ⚠ both cases are official for the litre
        expect(phonemize("10 ha", "tl")).toBe("sampˈu ʔektˈaɾja");
        // POSTPOSED — the artifact writes the noun after its number 11 times and before it 0 times.
        expect(phonemize("23 m", "tl")).toBe("dalawampˈut tatlˈo mˈetɾo");
    });

    test("units — ⟨cm⟩ ⟨kg⟩ ⟨mg⟩, the keys that MIS-READ rather than leaked", () => {
        // ⚠ THE DEFECT THIS PINS IS NOT A LEAK. Tagalog's g2p reads ⟨c⟩ as /k/, so `10 cm` came out
        // *sampˈu km* — the letter pair, pronounceable, plausible, and invisible to every leak class, DROP
        // counter and corpus diff in the tree. `tools/normalization/misread.ts` is the probe that names it.
        expect(phonemize("10 cm", "tl")).toBe("sampˈu sentimˈetɾo");
        expect(phonemize("150cm", "tl")).toBe("sandaʔˈan ʔˈat limampˈu sentimˈetɾo");
        expect(phonemize("40 kg", "tl")).toBe("ʔapatnapˈu kiloɡɾˈamo"); // the artifact's own "40 kg (90 lbs)"
        expect(phonemize("200 mg", "tl")).toBe("dalawˈaŋ daʔˈan miliɡɾˈamo");
        // ⚠ AND THE ONE THAT IS REFUSED. `gramo` is the best-attested of the four (49/20), but Tagalog's
        // magnitudes are declared LIGATED — `milyong`, `bilyong`, `libong` all end in ⟨g⟩ — and the tier's
        // pattern admits a magnitude between the number and the unit. Declared, `11 milyong mga Pilipino`
        // read as eleven million GRAMS of Filipinos. ×21 in the artifact against 0 genuine grams.
        expect(phonemize("11 milyong mga Pilipino", "tl")).toBe("labiŋʔisˈa mˈiljoŋ maŋˈa pilipˈino");
        // ⚠ A CAPITAL IS NOT A UNIT. One-letter symbols resolve exact-case, so `2GO` stays a shipping line.
        expect(phonemize("2GO Travel", "tl")).not.toContain("ɡɾˈamo");
    });

    test("the m/s rate composes, which is what ⟨s⟩ → ⟨segundo⟩ is declared for", () => {
        // tl.wikipedia glosses the whole frame: "metro bawat segundo para sa belosidad".
        expect(phonemize("299 m/s", "tl")).toBe("dalawˈaŋ daʔˈan ʔˈat sijamnapˈut sijˈam mˈetɾo bˈawat seɡˈundo");
        // ⚠ `s` is a rate DENOMINATOR and not a unit, so a bare trailing s is never claimed (the Il-76s lesson).
        expect(phonemize("76s", "tl")).not.toContain("seɡˈundo");
    });
});
