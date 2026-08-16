import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeTurkmen, ordinalOf, foldTurkmenTildes } from "../src/languages/turkmen/normalize.ts";

import { phonemizeWord, createTurkmen } from "../src/languages/turkmen/turkmen.ts";

// Canonical-IPA goldens for Standard Turkmen (tk) — Türkmençe, Oghuz Turkic, Latin.
// THE HALLMARK: the INTERDENTAL fricatives ⟨s⟩→[θ] and ⟨z⟩→[ð] (shared with Bashkir — söz→θøð). 9 vowels with
// ⟨a⟩→[ɑ] (back), ⟨ä⟩→[æ], ⟨ö⟩→[ø], ⟨ü⟩→[y] (front rounded), ⟨y⟩→[ɯ] (close back unrounded); ⟨ç⟩→t͡ʃ, ⟨j⟩→d͡ʒ,
// ⟨ž⟩→ʒ, ⟨ş⟩→ʃ, ⟨ň⟩→ŋ, ⟨ý⟩→j (glide, vs the vowel ⟨y⟩), ⟨h⟩→x. Word-final (oxytone) stress; unwritten phonemic
// length not emitted. Referees: wikipron + kaikki.
describe("Turkmen (Türkmençe) canonical IPA", () => {
    test("the INTERDENTAL hallmark ⟨s⟩→θ, ⟨z⟩→ð", () => {
        expect(phonemizeWord("söz")).toBe("ˈθøð"); // 'word' — ⟨s⟩→θ, ⟨ö⟩→ø, ⟨z⟩→ð
        expect(phonemizeWord("göz")).toBe("ˈɡøð"); // 'eye' — ⟨z⟩→ð
        expect(phonemizeWord("suw")).toBe("ˈθuw"); // 'water' — ⟨s⟩→θ, ⟨w⟩→w
        expect(phonemizeWord("ýazmak")).toBe("jɑðˈmɑk"); // 'to write' — ⟨z⟩→ð, ⟨a⟩→ɑ (back)
    });

    test("the 9-vowel system + ⟨y⟩[ɯ] vs ⟨ý⟩[j]", () => {
        expect(phonemizeWord("gyz")).toBe("ˈɡɯð"); // 'girl' — ⟨y⟩→ɯ (the vowel)
        expect(phonemizeWord("ýyl")).toBe("ˈjɯl"); // 'year' — ⟨ý⟩→j (the glide) then ⟨y⟩→ɯ
        expect(phonemizeWord("dünýä")).toBe("dynˈjæ"); // 'world' — ⟨ü⟩→y, ⟨ý⟩→j, ⟨ä⟩→æ
        expect(phonemizeWord("köşk")).toBe("ˈkøʃk"); // 'palace' — ⟨ö⟩→ø, ⟨ş⟩→ʃ
    });

    test("special consonants ⟨ç ž ň h⟩ + word-final stress", () => {
        expect(phonemizeWord("çaga")).toBe("t͡ʃɑˈɡɑ"); // 'child' — ⟨ç⟩→t͡ʃ, final stress
        expect(phonemizeWord("jaň")).toBe("ˈd͡ʒɑŋ"); // 'bell' — ⟨j⟩→d͡ʒ, ⟨ň⟩→ŋ
        expect(phonemizeWord("žurnal")).toBe("ʒuɾˈnɑl"); // 'journal' — ⟨ž⟩→ʒ
        expect(phonemizeWord("äheň")).toBe("æˈxeŋ"); // 'melody' — ⟨ä⟩→æ, ⟨h⟩→x, ⟨ň⟩→ŋ
    });

    test("NUMBERS — Turkic decimal: one lexeme per round ten, juxtaposed with no connector", () => {
        const tk = createTurkmen();
        // Data + provenance: turkmen.jsonc `numbers` (enedilim.com "Sanlar" + Wiktionary Appendix:Turkmen numerals).
        expect(tk.text("7").trim()).toBe("jeˈdi"); // ýedi — a bare unit
        expect(tk.text("11").trim()).toBe("ˈon ˈbiɾ"); // on bir — teens are TWO words in Turkmen (unlike Tatar's fused унбер)
        expect(tk.text("25").trim()).toBe("jiɡɾiˈmi ˈbæʃ"); // ýigrimi bäş — the 21-99 compound, no connector
        expect(tk.text("100").trim()).toBe("ˈjyð"); // ýüz — the multiplier "bir" is DROPPED before ýüz
        expect(tk.text("555").trim()).toBe("ˈbæʃ ˈjyð elˈli ˈbæʃ"); // bäş ýüz elli bäş
        expect(tk.text("1984").trim()).toBe("ˈbiɾ ˈmyŋ doˈkuð ˈjyð θeɡˈθen ˈdøɾt"); // bir müň dokuz ýüz segsen dört — "bir" IS kept before müň
        expect(tk.text("12345").trim()).toBe("ˈon iˈki ˈmyŋ ˈyt͡ʃ ˈjyð ˈkɯɾk ˈbæʃ"); // on iki müň üç ýüz kyrk bäş
        expect(tk.text("1000000").trim()).toBe("ˈbiɾ milliˈon"); // bir million
    });

    test("final stress with maximal-onset syllabification (loanword clusters)", () => {
        expect(phonemizeWord("türkmen")).toBe("tyɾkˈmen"); // ˈ before ⟨m⟩ (⟨k⟩ is coda of tü'rk, not part of the onset)
        expect(phonemizeWord("plan")).toBe("ˈplɑn"); // loan — ˈ before the whole ⟨pl⟩ onset
        expect(phonemizeWord("sport")).toBe("ˈθpoɾt"); // loan — ⟨sp⟩→[θp] (s→θ), stress before the whole onset
    });
});

// ── TEXT NORMALIZATION (src/languages/turkmen/normalize.ts) ─────────────────────────────────────────
//
// The evidence for every case is `tools/corpus/mined/tk.jsonc` (tk.wikipedia dump, 28,836 paragraph
// segments) and the argument is in the normalizer's own header. Roman numerals are tested through
// `phonemize`, NOT a constructed engine: `core/roman.ts` runs in registry.ts WRAPPING `text()`, so a test
// on `createTurkmen()` never exercises the policy at all (playbook trap 16).
describe("Turkmen text normalization", () => {
    const tk = { text: (s: string) => phonemize(s, "tk") };

    test("THE SPANISH TILDE FOR THE CARON — 157 words against 1,892, and nothing splits", () => {
        // Both letters are Latin, so unlike Chuvash's twin defect the word does NOT break; the grapheme
        // scan simply has no rule for ⟨ñ⟩ and drops to a plain [n], deleting the velar nasal.
        for (const [wrong, right] of [["öñ", "öň"], ["onuñ", "onuň"], ["biziñ", "biziň"], ["Koreÿa", "Koreýa"]] as const)
            expect(tk.text(wrong)).toBe(tk.text(right));
        expect(tk.text("öñ")).toBe("ˈøŋ"); // was ˈøn
        // ⚠ THE GUARD IS "EVERY OTHER LETTER IS ONE TURKMEN USES", and its reach is exactly that far.
        // A foreign word carrying a letter the alphabet lacks is safe — ⟨c⟩ is not a Turkmen letter, so:
        expect(foldTurkmenTildes("München")).toBe("München");
        expect(foldTurkmenTildes("Cañón")).toBe("Cañón");
        // …and one spelled only with Turkmen letters is NOT. That is the honest cost of the fold, and it
        // is stated rather than papered over: measured over this corpus it is zero (all 161 affected
        // words are Turkmen), and the alternative is deleting a phoneme from 8% of the genitives.
        expect(foldTurkmenTildes("señor")).toBe("seňor");
    });

    test("the ORDINAL — the writer chooses the backness, the rule supplies the linking vowel", () => {
        expect(ordinalOf(1, true)).toBe("birinji");
        expect(ordinalOf(4, true)).toBe("dördünji"); // ⚠ the one stem that voices its final stop
        expect(ordinalOf(6, false)).toBe("altynjy"); // vowel-final: no linking vowel
        expect(ordinalOf(10, false)).toBe("onunjy"); // ⚠ monosyllable → labial harmony reaches the suffix
        expect(ordinalOf(30, false)).toBe("otuzynjy"); // ⚠ disyllable → it does NOT: never *otuzunjy*
        expect(ordinalOf(100, true)).toBe("ýüzünji"); // ⚠ ⟨ý⟩ is the GLIDE, not a vowel — counting it
        expect(ordinalOf(3, true)).toBe("üçünji"); //    made `ýüz` look disyllabic and gave *ýüzinji*
        // …and in running text, where the suffix was reaching the g2p as the bare word [nd͡ʒɯ].
        expect(tk.text("24-nji gün")).toBe("jiɡɾiˈmi døɾdyˈnd͡ʒi ˈɡyn");
        expect(tk.text("1-nji ýarymy")).toBe("biɾiˈnd͡ʒi jɑɾɯˈmɯ");
    });

    test("DEGREES are both thermal and angular, and the corpus glosses its own sign", () => {
        // "+11° gradus" writes the sign AND the word, so the bare-sign rule must not double it.
        expect(tk.text("+11° gradus")).toBe("plˈjuθ ˈon ˈbiɾ ɡɾɑˈduθ");
        expect(tk.text("+10° dan")).toBe("plˈjuθ ˈon ɡɾɑduˈθdɑn"); // the ablative glued to the sign
        // ⚠ `Selsi`, not `Selsiý` — the corpus's own "0 K (Kelwin)= -273,15°C (gradus Selsi)".
        expect(tk.text("50 ° C-e ýetýär")).toBe("elˈli ɡɾɑˈduθ θelθiˈe jeˈtjæɾ");
        expect(tk.text("39°31′0″N")).toBe("oˈtuð doˈkuð ɡɾɑˈduθ oˈtuð ˈbiɾ miˈnut ˈnol θeˈkunt n");
    });

    test("the FRACTION is bounded, because this corpus writes it BOTH ways round", () => {
        // Turkmen reads it denominator-locative first: "dörtden üç".
        expect(tk.text("3/4 bölegine")).toBe("døɾtˈden ˈyt͡ʃ bøleɡiˈne");
        expect(tk.text("1/9")).toBe("dokuˈðdɑn ˈbiɾ");
        // ⚠ `10/1 bölegini` is ONE TENTH in this corpus — the Turkic order — and nothing but the
        // numerator > denominator test separates it from an ordinary fraction. Refused, not guessed.
        expect(normalizeTurkmen("10/1 bölegini")).toBe("10, 1 bölegini");
        expect(normalizeTurkmen("2015/16 ýyly")).toBe("2015, 16 ýyly"); // …and the year spans too
    });

    test("the ERA MARKER in the five spellings the corpus uses, tilde and all", () => {
        expect(normalizeTurkmen("b.e. öñ 330-njy")).toBe("biziň eramyzdan öň üç ýüz otuzynjy");
        expect(normalizeTurkmen("B.e.ö. VI asyrda")).toBe("biziň eramyzdan öň VI asyrda");
        expect(normalizeTurkmen("B.e. öňki III asyryň")).toBe("biziň eramyzdan öňki III asyryň");
        expect(normalizeTurkmen("500-494ý.")).toBe("500, 494 ýyl");
    });

    test("ROMAN CENTURIES — and the backness the writer never typed", () => {
        // `ordinalOf` takes the backness from the WRITTEN suffix; a Roman numeral has none, so the policy
        // derives it from the numeral's own last vowel.
        expect(tk.text("XX asyr")).toBe("jiɡɾimiˈnd͡ʒi ɑˈθɯɾ");
        expect(tk.text("VI asyrda")).toBe("ɑltɯˈnd͡ʒɯ ɑθɯɾˈdɑ");
    });

    test("the symbol tier, the percent suffix, and the range's pause", () => {
        // ⚠ The tier reads `60%` but cannot see the `-ini` hanging off it, so normalize.ts claims both.
        expect(tk.text("60%-ini")).toBe("ɑltˈmɯʃ ɡøteɾimiˈni");
        expect(tk.text("30,3 mln km²")).toBe("oˈtuð , ˈyt͡ʃ milliˈon inedøɾˈdyl kiloˈmetɾ");
        expect(tk.text("163 mm ygal")).toBe("ˈjyð ɑltˈmɯʃ ˈyt͡ʃ milliˈmetɾ ɯˈɡɑl");
        expect(tk.text("№ 5")).toBe("belˈɡi ˈbæʃ");
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
        expect(tk.text("1606-1669.")).toBe("ˈbiɾ ˈmyŋ ɑlˈtɯ ˈjyð ɑlˈtɯ , ˈbiɾ ˈmyŋ ɑlˈtɯ ˈjyð ɑltˈmɯʃ doˈkuð .");
    });

    test("INITIALISMS — the caps runs that reached the g2p as consonant clusters", () => {
        expect(tk.text("ABŞ")).toBe("ˈɑ ˈbe ˈʃe"); // the USA
        expect(tk.text("BMG")).toBe("ˈbe ˈem ˈɡe"); // the UN
    });
});
