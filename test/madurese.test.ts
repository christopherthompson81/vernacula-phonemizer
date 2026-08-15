import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/madurese/madurese.ts";
import { numberToWords } from "../src/languages/madurese/numbers.ts";
import { normalizeMadurese } from "../src/languages/madurese/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Madurese / Bhâsa Madhurâ (mad) — Austronesian (Madura, East Java), the
// 2008-revision Latin orthography. NOT a direct grapheme map: the signature is VOWEL-REGISTER HARMONY (a~ɤ,
// e~ɨ, o~u — the HIGH member after a voiced or aspirated stop, the LOW member elsewhere), plus glide/glottal
// epenthesis, word-final devoicing and geminate length. No machine referee exists; the engine's gold is the
// JIPA Illustration (Misnadin & Kirby 2020), measured at 33/35 by tools/referee-eval/eval.ts.
describe("Madurese canonical IPA", () => {
    test("the register harmony — a raise-class stop lifts the following vowel", () => {
        expect(phonemizeWord("Madhurâ")).toBe("matʰuɾɤ"); // ⟨dh⟩ = tʰ (aspirated), final ⟨â⟩ = ɤ
        expect(phonemizeWord("bân")).toBe("bɤn"); // ⟨b⟩ raises the ⟨â⟩; the conjunction, ×536 in the corpus
        expect(phonemizeWord("polo")).toBe("pɔlɔ"); // ⟨p⟩ is low-class, so ⟨o⟩ stays ɔ — the tens word
    });
});

// ── NORMALIZATION ────────────────────────────────────────────────────────────────────────────────────
// ⚠ EVERY COUNT CITED HERE IS FROM `tools/corpus/mined/mad.jsonc` — a mad.wikipedia pages-articles dump,
// 37,821 paragraph segments — and the reasoning behind each rule, including the four classes deliberately
// left unread, is in src/languages/madurese/normalize.ts. The tests below pin the rule's BRANCHES rather
// than the corpus's instances (playbook trap 13), which is why several inputs are shapes the corpus does
// not contain.
describe("text normalization", () => {
    // THE SEPARATOR PAIR, which is what this layer is built around. Madurese takes the Indonesian/Dutch
    // convention (period groups, comma decimals) and this wiki also carries English-format imports — the
    // campaign-finance article writes `Rp 16.31 milyad` and `Rp 16,09 milyad` two sentences apart. Only the
    // DIGIT COUNT separates them. Before this layer both separators were CLAUSE PUNCTUATION, so the value
    // was destroyed rather than merely left unread.
    test("thousands vs decimal, in both conventions and mixed", () => {
        expect(phonemize("5.168 km²", "mad")).toBe(
            "lɛmaʔ ɛbu bɤn atɔs bɤn ənːəm pɔlɔ bɤn bɤluʔ kilɔmɛtəɾ pəɾsəɡi",
        ); // was *lɛmaʔ . atɔs bɤn …* — "five, one hundred and sixty-eight"
        expect(phonemize("676,578 km²", "mad")).toContain("ənːəm ɛbu"); // English thousands
        expect(phonemize("1,6%", "mad")).toBe("sətːɔŋ kɔma ənːəm pəɾsən"); // comma decimal, the dominant one
        expect(phonemize("39.33%", "mad")).toContain("kɔma təlɔ təlɔ"); // period decimal, English-format
        // ⚠ MIXED IN ONE NUMBER — the native shape, which needs the period arm to ALLOW a following comma.
        expect(phonemize("2.093,45 km²", "mad")).toBe(
            "duwɤ ɛbu bɤn saŋaʔ pɔlɔ bɤn təlɔ kɔma əmpaʔ lɛmaʔ kilɔmɛtəɾ pəɾsəɡi",
        );
    });

    // ⚠ THE TWO MEASURED EXCEPTIONS THAT MAKE DE-GROUPING SAFE, both of them a three-digit tail that is a
    // DECIMAL and not a grouping. Neither is reachable by the digit-count rule alone.
    test("a three-digit tail that is a decimal, not a grouping", () => {
        // A thousands group never begins with a bare `0` — this is Earth's atmospheric water share.
        expect(normalizeMadurese("0,001%")).toBe("0 koma 0 0 1 persen");
        // …and the period arm consumes `1.857` first, after which the comma arm cannot start inside the
        // remaining digits. Sumenep's land area, 1,857.530 km².
        expect(normalizeMadurese("1.857,530 km²")).toBe("1857 koma 5 3 0 kilomèter persegi");
    });

    // ⚠ THE CLOCK HAS THREE ARMS AND ONE DELIBERATE REFUSAL. `pokol` ×5, the clipped `kol` ×2 and `jhâm` ×3
    // are the corpus's hour words; the bare colon arm exists because all seven colon-times in the artifact
    // are clocks, while the PERIOD is contested by money and by every English-format decimal.
    test("the clock — whole hours only, and the money that proves the period arm must be guarded", () => {
        expect(phonemize("pokol 14.00", "mad")).toBe("pɔkɔl sapɔlɔ bɤn əmpaʔ"); // hour word + period
        expect(phonemize("kol 17:00 WIB", "mad")).toBe("kɔl sapɔlɔ bɤn pətːɔʔ wip"); // clipped hour word
        expect(phonemize("2:00", "mad")).toBe("duwɤ"); // bare colon, no word and no marker
        // ⚠ A REAL-MINUTES CLOCK IS LEFT ALONE, not read with a guessed connective: no Madurese
        // "past"/"minutes-after" construction is attested anywhere. The pause is the recorded refusal.
        expect(phonemize("pokol 18:45", "mad")).toBe("pɔkɔl sapɔlɔ bɤn bɤluʔ , əmpaʔ pɔlɔ bɤn lɛmaʔ");
        // ⚠ AND THE COUNTER-EXAMPLE THAT FORCED THE HOUR-WORD GUARD: 16.31 BILLION rupiah, not 16:31.
        expect(phonemize("Rp 16.31 milyad", "mad")).toContain("kɔma təlɔ sətːɔŋ");
    });

    // ⚠ THREE ARMS, SPECIFIC BEFORE GENERAL — °C, then °F, then the bare sign. Run the other way round the
    // bare rule eats the sign and leaves a lone ⟨C⟩, which read as Madurese ⟨c⟩ = /c/.
    test("degrees — both encodings of the sign, both scale names, and the coordinate", () => {
        expect(phonemize("36°C", "mad")).toBe("təlɔ pɔlɔ bɤn ənːəm dɨɾaɟɤt cəlcijus");
        expect(phonemize("40 °C", "mad")).toBe("əmpaʔ pɔlɔ dɨɾaɟɤt cəlcijus"); // spaced, as the corpus writes it
        expect(phonemize("77°-100 °F", "mad")).toContain("dɨɾaɟɤt fahɾənhəit");
        // ⚠ `º` U+00BA STANDS IN FOR THE DEGREE SIGN in about half this wiki's coordinates. A rule that
        // knows `°` and not `º` gives false assurance — the Italian `dell'11º` substitution again.
        expect(phonemize("112º–113º", "mad")).toBe(
            "atɔs bɤn sapɔlɔ bɤn duwɤ dɨɾaɟɤt sampɛʔ atɔs bɤn sapɔlɔ bɤn təlɔ dɨɾaɟɤt",
        );
    });

    // ⚠ THE COORDINATE SPAN'S DASH IS CLAIMED BY ITS OWN RULE, because the left endpoint ends in a MARK and
    // not in a digit — so no digit–dash–digit rule can ever reach it. And the mark is matched as a RUN:
    // this wiki writes the arc-second as two apostrophes, so the character before the dash is itself a `’`.
    test("a coordinate span, including the doubled-apostrophe arc-second", () => {
        expect(normalizeMadurese("7°53’-8°34’")).toBe("7 derajat 53’ sampè' 8 derajat 34’");
        expect(normalizeMadurese("6º51’54’’-7º23’6’’")).toBe("6 derajat 51’54’’ sampè' 7 derajat 23’6’’");
    });

    test("era markers — SM before M, and a sentence-final era marker survives", () => {
        expect(phonemize("940 M", "mad")).toBe("saŋaʔ atɔs bɤn əmpaʔ pɔlɔ masɛhi");
        expect(phonemize("12 SM", "mad")).toBe("sapɔlɔ bɤn duwɤ sabɨlunːa masɛhi");
        expect(normalizeMadurese("875 M.")).toBe("875 Masèhi."); // the period is a sentence end, not an initial
        expect(normalizeMadurese("Prof. Dr. M. Hatta")).toBe("Prof. Dr. M. Hatta"); // no digit → no era
    });

    // ⟨sampè'⟩ ×14 is the corpus's own span connective, used between numeric endpoints. Without this rule
    // the hyphen was dropped outright and the two numbers ran together with no connective at all.
    test("ranges, and the three shapes the guards must refuse", () => {
        expect(phonemize("70-90%", "mad")).toBe("pətːɔʔ pɔlɔ sampɛʔ saŋaʔ pɔlɔ pəɾsən");
        expect(phonemize("27 - 36°C", "mad")).toContain("sampɛʔ təlɔ pɔlɔ bɤn ənːəm dɨɾaɟɤt");
        // Decimal operands, because this rule runs BEFORE the decimal step.
        expect(normalizeMadurese("(0,3-2,7%)")).toBe("(0 koma 3 sampè' 2 koma 7 persen)");
        // ⚠ A DATE PAIR IS NOT A RANGE — without the `/` guard, `2007 – 18` reads as a span.
        expect(normalizeMadurese("10/01/2007 – 18/03/08")).toBe("10/01/2007 – 18/03/08");
        expect(normalizeMadurese("(1998/1999-2008/2009)")).toBe("(1998/1999-2008/2009)");
        // ⚠ NOR IS AN IDENTIFIER CHAIN (ISBN ×8 in the artifact).
        expect(normalizeMadurese("0-07-115221")).toBe("0-07-115221");
    });

    // ⚠ TRAP 58, AND THIS LAYER IS THE ONE THAT DID NOT HAVE IT — pinned so it stays that way. The trailing
    // guard here is `(?![\d,\p{L}\p{M}/-])` with NO `.`, so a clause-final range keeps its connective where
    // five sibling layers lost theirs. The `,` IS in the guard and stays: this corpus writes the decimal
    // comma ×55 (`tegghina 1 sampè' 1,7 mèter`), so a comma after the right operand may be a fraction and
    // the rule is right to decline it rather than read half a number.
    test("⚠ a clause-final range keeps its connective, and the comma guard is deliberate (trap 58)", () => {
        expect(normalizeMadurese("1953 -1955.")).toBe("1953 sampè' 1955.");
        expect(normalizeMadurese("05-15.")).toBe("05 sampè' 15.");
        expect(normalizeMadurese("04-20.")).toBe("04 sampè' 20.");
        // the comma arm, declined ON PURPOSE — the operand rule would otherwise have to guess whether the
        // comma opens a fraction or closes a clause.
                // ⚠ THE COMMA IS NOW READ, and this assertion used to pin the opposite. The argument for rejecting it
        // was that a comma after the right operand may open a DECIMAL — true, and it only holds when a DIGIT
        // follows. The guard is now `[.,]\d`, so a fraction is still declined and a clause comma is not.
        // One shape, eleven layers: the same six characters were wrong in each. See test/clause-final-range.ts.
        expect(normalizeMadurese("04-20,")).toBe("04 sampè' 20,");
        // ⚠ AND THE DECIMAL THE OLD GUARD FEARED IS ALREADY HANDLED BY THE OPERAND ITSELF: `(\d+(?:[.,]\d+)?)`
        // takes `1,7` WHOLE, so `1-1,7 mèter` is a range from one to one-point-seven and always was. The
        // trailing comma guard was defending against a case the operand pattern had already covered.
        expect(normalizeMadurese("1-1,7 mèter")).toBe("1 sampè' 1 koma 7 mèter");
    });

    // `±` IN THIS CORPUS IS "ABOUT", NOT A TOLERANCE — all four instances are a rounded area or height, and
    // one of them glosses the sign itself: `Loas wilayana korang lebbi ±1.752,21 km²`.
    test("± is read as 'about', and is not doubled where the text already says it", () => {
        expect(phonemize("±3.78%", "mad")).toBe("kɔɾaŋ ləbːi təlɔ kɔma pətːɔʔ bɤluʔ pəɾsən");
        // ⚠ THE GUARD: two of the four corpus instances already carry the phrase, and substituting blind
        // said it twice. Here the sign simply comes out (playbook trap 12 — say it once).
        expect(normalizeMadurese("korang lebbi ±1.752,21 km²")).toBe("korang lebbi 1752 koma 2 1 kilomèter persegi");
        expect(normalizeMadurese("ra-kèra ±335,28 km²")).toBe("ra-kèra 335 koma 2 8 kilomèter persegi");
    });

    // THE SHARED TIER — and the two rate shapes it cannot reach on its own, because the thing beside the
    // unit is a WORD rather than a number.
    test("units, exponents and both rate shapes", () => {
        expect(phonemize("30kg", "mad")).toBe("təlɔ pɔlɔ kilɔɡɾɤm"); // was *təlɔ pɔlɔ kk* — a GEMINATE
        expect(phonemize("40m", "mad")).toBe("əmpaʔ pɔlɔ mɛtəɾ");
        expect(phonemize("15-60cm", "mad")).toContain("sɛntimɛtəɾ");
        expect(phonemize("84 orèng per km²", "mad")).toBe(
            "bɤluʔ pɔlɔ bɤn əmpaʔ ɔɾɛŋ pəɾ kilɔmɛtəɾ pəɾsəɡi",
        ); // a unit after the WORD `per` — the tier needs a number and there is none
        expect(phonemize("jiwa/km²", "mad")).toBe("ɟiwa pəɾ kilɔmɛtəɾ pəɾsəɡi"); // slash rate, word numerator
        expect(phonemize("2000–3000 mm/taon", "mad")).toContain("milimətəɾ pəɾ taɔn");
        // ⚠ AND THE "OR" SLASH MADURESE WRITES CONSTANTLY MUST NOT BECOME A RATE.
        expect(normalizeMadurese("bân/otabâ")).toBe("bân/otabâ");
        expect(normalizeMadurese("daging/ajam/tempe")).toBe("daging/ajam/tempe");
    });

    test("currency — the magnitude hop, the compound key, and the plain sign", () => {
        // ⚠ WITHOUT `magnitudes` THE NOUN LANDS INSIDE THE QUANTITY: *lima ratos lèma' polo DOLAR juta*.
        expect(phonemize("US$550 juta", "mad")).toBe("lɛmaʔ atɔs bɤn lɛmaʔ pɔlɔ ɟuta dulaɾ amɛɾika");
        expect(phonemize("Rp 729 jutah", "mad")).toContain("ɟutah ɾupijah"); // `Rp` was two bare consonants
        expect(phonemize("€1,3 triliun", "mad")).toBe("sətːɔŋ kɔma təlɔ tɾilijun əuɾɔ");
    });

    test("the ampersand and the dimension cross", () => {
        expect(phonemize("Woman & Violence", "mad")).toContain("bɤn"); // `&` was dropped outright
        // ⚠ NOT A DROP BUT AUDIBLE GARBAGE: the ASCII ⟨x⟩ was read as a Madurese letter, [z].
        expect(phonemize("96x100cm", "mad")).toBe("saŋaʔ pɔlɔ bɤn ənːəm kalɛ atɔs sɛntimɛtəɾ");
    });

    // ⚠ THE FOUR CLASSES THIS LAYER DELIBERATELY LEAVES UNREAD. These assertions pin a REFUSAL, so they are
    // expected to keep passing until someone SOURCES the missing word — at which point they should be
    // deleted, not weakened. The evidence for each is in normalize.ts and tools/normalization/defects.ts.
    test("the declined classes stay declined", () => {
        expect(normalizeMadurese("-5")).toBe("-5"); // no attested Madurese sign word; `korang` is comparative
        expect(normalizeMadurese("Kode telepon: +31")).toBe("Kode telepon: +31"); // a dialling prefix
        expect(normalizeMadurese('"dahana" = apoy')).toBe('"dahana" = apoy'); // every `=` is a gloss
        expect(normalizeMadurese("PBB")).toBe("PBB"); // no letter-name table exists for Madurese
        // ⚠ AND THE IMPERIAL FOOT, on a WRONG-SENSE result rather than an absent one. `kaki` (21/17) is
        // Indonesian FILM TITLES to a hit — *Kaki Palsu*, *Rumah Kaki Seribu*, *Segitiga Lepas Kaki* — and
        // `soko` (75/20) means an ETHNIC GROUP in Madurese (*soko Kaili*, *soko Mori*), not a leg and not
        // a unit. `277 m (909 ft)` keeps its `ft`.
        expect(normalizeMadurese("277 m (909 ft)")).toContain("ft");
    });

    // `dpl` — and mad.wikipedia supplies BOTH halves, which is what makes it a reading rather than a guess
    // at an Indonesian loan: it writes the full phrase and then the abbreviation in brackets after it
    // (`1.000 mèter è attas parmuka'an tasè' (dpl)`), and it writes the short running form after the metre
    // word four times more (`199,27 mèter è attas tasè'`, `0-3 meter è attas tasè'`).
    test("`dpl` reads as the phrase this wiki glosses it with", () => {
        expect(normalizeMadurese("sirkana 8 mèter dpl bit")).toBe("sirkana 8 mèter è attas tasè' bit");
        expect(normalizeMadurese("eyantara 12 – 74 meter dpl.")).toBe("eyantara 12 sampè' 74 meter è attas tasè'.");
        expect(normalizeMadurese("8 m dpl")).toBe("8 mèter è attas tasè'"); // the tier supplies the metre word first
        // ⚠ BOUND TO THE METRE WORD, which is what keeps it off the gloss lines — there the `(dpl)` follows
        // `tasè'`, so the sentence is not made to say "above sea level" twice.
        expect(normalizeMadurese("mèter è attas parmuka'an tasè' (dpl)")).toContain("(dpl)");
        // The emitted phrase ends in an apostrophe, a LETTER in this orthography, and reaches the IPA as such.
        expect(phonemize("sirkana 8 mèter dpl", "mad")).toContain("ɛ atːas tasɛʔ");
    });

    // ⚠ TWO SEAMS THAT ALREADY WORKED AND MUST NOT BE "FIXED" (playbook trap 16). Pinned through the real
    // phonemizer with an operand that would break if the ordering were wrong.
    test("the ordinal and the Roman numeral need no rule here", () => {
        expect(phonemize("abad ka-20", "mad")).toBe("abɤt ka duwɤ pɔlɔ"); // ⟨ka-⟩ is an ordinary word
        expect(phonemize("ka -8", "mad")).toBe("ka bɤluʔ"); // …and the corpus's spaced spelling of it
        expect(phonemize("Olimpiade XXIX", "mad")).toContain("duwɤ pɔlɔ bɤn saŋaʔ"); // core/roman.ts, in the registry
    });

    test("ordinary text and a sentence end survive untouched", () => {
        expect(normalizeMadurese("Madhurâ iyâ arèya polo sè bâḍâ è tèmor tasè' polo Jhâbâ.")).toBe(
            "Madhurâ iyâ arèya polo sè bâḍâ è tèmor tasè' polo Jhâbâ.",
        );
        expect(normalizeMadurese("Taon 2008.")).toBe("Taon 2008.");
    });
});

// ── THE MAGNITUDE SERIES ABOVE 10⁶ ───────────────────────────────────────────────────────────────────
// ⚠ THIS IS THE NUMBER PATH, NOT THE NORMALIZATION LAYER, and it was uncovered BY that layer: de-grouping
// newly handed `numbers.ts` whole millions, which it then read one digit at a time because its authored
// range stopped at 10⁶ (26 instances in the artifact's 437 lines, all populations and areas). The words
// are sourced at their declaration in madurese.jsonc — `juta` ×18, `miliar` ×11, `triliun` ×3 in the
// corpus's own magnitude slot, plus a Madurese numeral description and a Madurese–Indonesian dictionary.
describe("cardinal numbers above a million", () => {
    // ⚠ THE WORD ORDER IS THE ASSERTION HERE, because it is the thing that had to be established rather
    // than assumed — `nya` (Chichewa) found a language whose digit-retaining and spelled-out orders were
    // opposites. Madurese is multiplier-then-magnitude, descending: 1,508,070 is *sajuta lèmaratos bâllu'
    // èbu pèttongpolo* in the numeral description this series is sourced from.
    test("the magnitude follows its count, largest group first", () => {
        expect(numberToWords(1508070)).toBe("juta bân lèma' atos bân ballu' èbu bân petto' polo");
        // …and the grouping is by 10⁶ then 10³, so 752,425,214 is "752 million", never "0.75 miliar".
        expect(numberToWords(752425214)).toBe(
            "petto' atos bân lèma' polo bân duwâ juta bân empa' atos bân duwâ polo bân lèma' èbu"
            + " bân duwâ atos bân sapolo bân empa'",
        );
        expect(numberToWords(1e9)).toBe("miliar");
        expect(numberToWords(1e12)).toBe("triliun");
        // A bare magnitude at count 1 — this file's existing convention for `atos` and `èbu`, since the
        // fuller counting forms fuse the prefix instead (saratos, saèbu, sajuta) rather than prefixing
        // `settong`.
        expect(numberToWords(1e6)).toBe("juta");
    });

    // The corpus instance that motivated the work: Saudi Arabia's area, `2.150.000 km²`, which de-grouping
    // handed over whole and which used to read *duwâ settong lèma' nolla nolla nolla nolla*.
    test("the corpus instance that uncovered the cap", () => {
        expect(phonemize("2.150.000 km²", "mad")).toBe(
            "duwɤ ɟuta bɤn atɔs bɤn lɛmaʔ pɔlɔ ɛbu kilɔmɛtəɾ pəɾsəɡi",
        );
    });

    // ⚠ ABOVE THE AUTHORED RANGE THE NUMBER IS STILL SPOKEN — the fleet rule from d38f00d / fdab9b1 and
    // test/bignum-fallback.test.ts. Madurese caps at 10¹⁵ because no quadrillion word is attested for it
    // (the only source offering `kuwadriliyun` is one blog post, and the corpus never writes it), and
    // refusing to COMPOSE must never become refusing to SPEAK: never empty, never raw ASCII digits, and
    // the digits actually READ rather than replaced by a constant.
    test("past the authored cap it degrades to digit-at-a-time, never silence and never ASCII", () => {
        const over = phonemize("1000000000000000", "mad").trim(); // 10¹⁵ — the first quantity unnameable
        expect(over).not.toBe("");
        expect(over).not.toMatch(/\d/u);
        expect(over).not.toBe(phonemize("1000000000000001", "mad").trim());
        // …and the composed path just below the cap is untouched: 999 triliun still gets its words.
        const under = phonemize("999000000000000", "mad").trim();
        expect(under).toContain("tɾilijun");
        expect(under).not.toMatch(/\d/u);
    });
});
