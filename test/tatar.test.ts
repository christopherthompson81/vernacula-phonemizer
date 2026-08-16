import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/tatar/tatar.ts";
import { getPhonemizer } from "../src/registry.ts";
import { phonemize } from "../src/index.ts";
import { normalizeTatar, ordinalOf } from "../src/languages/tatar/normalize.ts";

// Canonical-IPA goldens for Standard Tatar (tt) — Татар теле, Kipchak Turkic, CYRILLIC (official), the
// Tatar. Signature: VOWEL-HARMONY backing of ⟨к г⟩ — [q]/[ʁ] next to a BACK vowel (ак→ɑq) but [k]/[ɡ] next to a
// FRONT vowel (мәктәп→mæktæp); the special letters ⟨ә⟩→[æ], ⟨ө⟩→[ø], ⟨ү⟩→[y], ⟨ы⟩→[ɨ], ⟨җ⟩→[ʑ], ⟨ң⟩→[ŋ], ⟨һ⟩→[h];
// ⟨а⟩ fronts to [a] in a front-harmony word. Word-final (oxytone) stress. THIN single-source (kaikki, 69) referee —
// the folded % is deflated by loan noise; validated on the native subset.
describe("Tatar (Татар теле) canonical IPA", () => {
    test("vowel-harmony backing of ⟨к г⟩: [q ʁ] (back) vs [k ɡ] (front)", () => {
        expect(phonemizeWord("ак")).toBe("ˈɑq"); // 'white' — BACK word: ⟨а⟩→ɑ, ⟨к⟩→q
        expect(phonemizeWord("мәктәп")).toBe("mækˈtæp"); // 'school' — FRONT word (⟨ә⟩): ⟨к⟩→k
        expect(phonemizeWord("балык")).toBe("bɑˈlɨq"); // 'fish' — BACK: ⟨ы⟩→ɨ, ⟨к⟩→q
        expect(phonemizeWord("көз")).toBe("ˈkøz"); // 'autumn' — FRONT: ⟨ө⟩→ø, ⟨к⟩→k
    });

    test("the special letters ⟨ә ө ү җ ң⟩ + iotated ⟨я⟩", () => {
        expect(phonemizeWord("дүшәмбе")).toBe("dyʃæmˈbe"); // 'Monday' — ⟨ү⟩→y, ⟨ә⟩→æ
        expect(phonemizeWord("вөҗдан")).toBe("vøʑˈdan"); // 'conscience' — ⟨ө⟩→ø, ⟨җ⟩→ʑ, ⟨а⟩→a (front word)
        expect(phonemizeWord("якшәмбе")).toBe("jɑqʃæmˈbe"); // 'Sunday' — ⟨я⟩→jɑ, ⟨к⟩→q (local, next to я)
        expect(phonemizeWord("шимбә")).toBe("ʃimˈbæ"); // 'Saturday' — ⟨ә⟩→æ
    });

    test("harmony of ⟨а⟩: back [ɑ] vs front-word [a]", () => {
        expect(phonemizeWord("татар")).toBe("tɑˈtɑr"); // 'Tatar' — BACK word: ⟨а⟩→ɑ
        expect(phonemizeWord("ана")).toBe("ɑˈnɑ"); // 'mother' — BACK: ⟨а⟩→ɑ
        expect(phonemizeWord("китап")).toBe("kiˈtap"); // 'book' — FRONT word (⟨и⟩): ⟨а⟩→a, ⟨к⟩→k
    });

    test("NUMBERS — Turkic decimal with Tatar's FUSED teens", () => {
        const tt = getPhonemizer("tt");
        // Data + provenance: src/languages/tatar/numbers.ts (Wiktionary Module:number list/data/tt + Omniglot).
        expect(tt.text("7").trim()).toBe("ʑiˈde"); // җиде — a bare unit
        expect(tt.text("11").trim()).toBe("unˈber"); // унбер — ONE word (one stress domain), Tatar's deviation
        expect(tt.text("25").trim()).toBe("jeɡerˈme ˈbiʃ"); // егерме биш — 21-99 stay TWO words
        expect(tt.text("100").trim()).toBe("ˈjøz"); // йөз — the multiplier "бер" is dropped
        expect(tt.text("555").trim()).toBe("ˈbiʃ ˈjøz ilˈle ˈbiʃ"); // биш йөз илле биш
        expect(tt.text("1984").trim()).toBe("ˈmeŋ tuˈʁɨz ˈjøz sikˈsæn ˈdyrt"); // мең тугыз йөз сиксән дүрт
        expect(tt.text("12345").trim()).toBe("uniˈke ˈmeŋ ˈøɕ ˈjøz qɨˈrɨq ˈbiʃ"); // унике мең өч йөз кырык биш — fused teen as a thousands multiplier
        expect(tt.text("1000000").trim()).toBe("ˈber milliˈon"); // бер миллион — the leading "бер" IS kept here
    });

    test("⟨ч⟩→[ɕ] (Kazan deaffrication), ⟨г⟩ neutral-⟨а⟩, initial ⟨е⟩→[je], loan-cluster stress", () => {
        expect(phonemizeWord("чәч")).toBe("ˈɕæɕ"); // 'hair' — ⟨ч⟩ is the fricative [ɕ] (Kazan standard, like ⟨җ⟩→ʑ)
        expect(phonemizeWord("гаилә")).toBe("ɡaiˈlæ"); // 'family' — front word: ⟨г⟩→ɡ (⟨а⟩ is harmony-neutral for backing)
        expect(phonemizeWord("елга")).toBe("jelˈɡa"); // 'river' — word-initial ⟨е⟩→[je]
        expect(phonemizeWord("спорт")).toBe("ˈsport"); // loan — ˈ before the whole ⟨sp⟩ onset (max-onset)
    });
});

// ── TEXT NORMALIZATION (src/languages/tatar/normalize.ts) ───────────────────────────────────────────
//
// The evidence for every case here is `tools/corpus/mined/tt.jsonc` (tt.wikipedia dump, 1,014,015
// paragraph segments) and the argument is in the normalizer's own header. Roman numerals are tested
// through `phonemize`, NOT through a constructed engine: `core/roman.ts` runs in registry.ts WRAPPING
// `text()`, so a test on `createTatar()` never exercises the policy at all (playbook trap 16).
describe("Tatar text normalization", () => {
    const tt = { text: (s: string) => phonemize(s, "tt") };

    test("THE ORDINAL SUFFIX IN ALL THREE ATTACHMENTS — the class this language is defined by", () => {
        // HYPHENATED, the shape Bashkir writes and the only one a ported ba rule would have caught.
        expect(tt.text("3-нче")).toBe("øɕenˈɕe"); // өченче
        expect(tt.text("2009-нчы елдан")).toBe("iˈke ˈmeŋ tuʁɨzɨnˈɕɨ jelˈdan");
        // The LONG form, with the linking vowel typed out — `19-ынчы гасырда`.
        expect(tt.text("19-ынчы гасырда")).toBe("untuʁɨzɨnˈɕɨ ʁɑsɨrˈdɑ");
        // SPACED. `1917 нче елда` — read before this layer as the bare fragment *нче*.
        expect(tt.text("1917 нче елда")).toBe("ˈmeŋ tuˈʁɨz ˈjøz unʑidenˈɕe jelˈda");
        expect(tt.text("1 нче президенты")).toBe("berenˈɕe prezidenˈtɨ");
        // GLUED, and carrying a GENITIVE past the ordinal's own tail — spliced on the overlap, not
        // matched with `endsWith`, or *ике мең бишенче* + *нең* comes out doubled.
        expect(tt.text("2005нченең мартында")).toBe("iˈke ˈmeŋ biʃenɕeˈneŋ mɑrtɨnˈdɑ");
    });

    test("the CASE suffix is a CLOSED SET — which is what makes the spaced attachment safe", () => {
        // A genuine case ending glues to the spelled cardinal: the writer already chose the allomorph.
        expect(tt.text("2000-гә якын")).toBe("iˈke meŋˈɡæ jɑˈqɨn");
        // ⚠ AND A FIGURE NUMBER MUST SURVIVE. The corpus's ophthalmology article writes `рәс. 12.1а`,
        // `12.2б`, `12.2в`, `12.2д` — a chapter.figure reference with a Cyrillic enumerator glued to it.
        // An OPEN suffix alternation (ba's `SFX{1,5}`) would have read every one as a declined numeral.
        expect(normalizeTatar("рәс. 12.1а")).toBe("рәс. 12.1а");
        expect(normalizeTatar("(рәс. 12.2в, г)")).toBe("(рәс. 12.2в, г)");
        // Russian `-е` is excluded: this corpus carries Russian bibliography, and `4-е изд.` is not Tatar.
        expect(normalizeTatar("4-е изд.")).toBe("4-е изд.");
    });

    test("the ordinal is DERIVED, and Tatar has no labial harmony where Bashkir does", () => {
        // ba rounds after ⟨ө о⟩ (өс → өсөнсө); porting that across gives *өчөнчө* and *йөзөнчө*.
        expect(ordinalOf(3)).toBe("өченче");
        expect(ordinalOf(100)).toBe("йөзенче");
        expect(ordinalOf(6)).toBe("алтынчы"); // vowel-final back stem drops the linking vowel
        expect(ordinalOf(9)).toBe("тугызынчы");
        // ⚠ ONE STEM LENITES — `кырык` → *кырыгынчы*, and tt.wikipedia's own century-article title
        // confirms it: "XL (кырыгынчы) гасыр".
        expect(ordinalOf(40)).toBe("кырыгынчы");
        expect(ordinalOf(41)).toBe("кырык беренче"); // …and only when the suffix actually follows it
    });

    test("ROMAN CENTURIES take the ordinal — through the registry seam, not the constructor", () => {
        expect(tt.text("XX гасыр")).toBe("jeɡermenˈɕe ʁɑˈsɨr");
        expect(tt.text("XL гасыр")).toBe("qɨrɨʁɨnˈɕɨ ʁɑˈsɨr"); // the corpus's own gloss
        expect(tt.text("IV гасырдан")).toBe("dyrtenˈɕe ʁɑsɨrˈdɑn"); // the noun keeps the writer's case
        // A REGNAL number is a cardinal — no trigger noun, so the shared pass reads it plainly.
        expect(tt.text("Александр III")).toBe("alekˈsandr ˈøɕ");
    });

    test("CLOCK, including the three-field timestamp and the suffix on its last field", () => {
        expect(tt.text("22:30-га")).toBe("jeɡerˈme iˈke utɨzˈʁɑ"); // the suffix goes on the spoken MINUTE
        expect(tt.text("13:23:58дә")).toBe("uˈnøɕ jeɡerˈme ˈøɕ ilˈle siɡezˈdæ");
        expect(tt.text("21: 00 сәгатьтә")).toBe("jeɡerˈme ˈber sæɡatˈtæ"); // the corpus's own spacing
    });

    test("DEGREES ARE COORDINATES HERE — and the case suffix sits on the PRIME", () => {
        // Not one of this corpus's ten `°` is a temperature; `градус`'s own article says the sign is
        // "почмакның" — of an ANGLE.
        expect(tt.text("90° әйләндерелгән")).toBe("tuqˈsɑn ʁrɑˈdus æjlænderelˈɡæn");
        expect(tt.text("66°30'")).toBe("ɑltˈmɨʃ ɑlˈtɨ ʁrɑˈdus uˈtɨz miˈnut");
        // `к.к.нең 41°11'ында` — the locative must be GLUED to *минут*, not left standing as a word.
        expect(tt.text("41°11'ында")).toBe("qɨˈrɨq ˈber ʁrɑˈdus unˈber minutɨnˈda");
    });

    test("ERA MARKERS — the corpus glosses all four expansions in one sentence", () => {
        expect(tt.text("Б.э.к. 334 елда")).toBe("bezˈneŋ eraˈɡa kaˈdær ˈøɕ ˈjøz uˈtɨz ˈdyrt jelˈda");
        expect(normalizeTatar("я. э. к.")).toBe("яңа эрага кадәр.");
        expect(normalizeTatar("һ.б.")).toBe("һәм башкалар.");
        expect(normalizeTatar("8 млн. т")).toBe("8 миллион т");
    });

    test("space GROUPING, the decimal COMMA, and the range's pause", () => {
        expect(tt.text("142 914 мең кеше"))
            .toBe("ˈjøz qɨˈrɨq iˈke ˈmeŋ tuˈʁɨz ˈjøz unˈdyrt ˈmeŋ keˈʃe");
        expect(tt.text("0,6 км")).toBe("ˈnul øˈter ɑlˈtɨ kiloˈmetr"); // the comma was a clause pause
        expect(tt.text("1236—1237 елларда"))
            .toBe("ˈmeŋ iˈke ˈjøz uˈtɨz ɑlˈtɨ , ˈmeŋ iˈke ˈjøz uˈtɨz ʑiˈde jellarˈda");
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — a citation ends this way.
        expect(tt.text("С. 34-37.")).toBe("s . uˈtɨz ˈdyrt , uˈtɨz ʑiˈde .");
    });

    test("the SYMBOL tier, and the rate whose numerator carries an exponent", () => {
        expect(tt.text("11,5%")).toBe("unˈber øˈter ˈbiʃ proˈt͡sent");
        expect(tt.text("$100 миллион")).toBe("ˈjøz milliˈon dolˈlɑr");
        expect(tt.text("11 500 км²")).toBe("unˈber ˈmeŋ ˈbiʃ ˈjøz qvɑˈdrɑt kiloˈmetr");
        // ⚠ `м³/с` — the river-discharge shape. Before the core fix the rate alternative began at the
        // slash, so the `³` ended the match and `/с` reached the phoneme sink as a bare [s].
        expect(tt.text("9,44 м³/с")).toBe("tuˈʁɨz øˈter ˈdyrt ˈdyrt ˈqub ˈmetr sekundɨˈna");
        expect(tt.text("№ 5")).toBe("noˈmer ˈbiʃ");
    });

    test("what is REFUSED, and why the refusal is the finding", () => {
        // `=` is a GLOSS SEPARATOR in 12 of this corpus's 13 instances, so the rule is DIGIT-GATED.
        expect(normalizeTatar("aba=«ölkän ir tuğan»")).toBe("aba=«ölkän ir tuğan»");
        expect(normalizeTatar("5 = 5")).toBe("5 тигез 5");
        // No fraction rule: every `\d+/\d+` here is a document number, an address or an academic year.
        expect(normalizeTatar("ПБУ 19/02")).toBe("ПБУ 19/02");
        expect(normalizeTatar("2010/11 уку елында")).toBe("2010/11 уку елында");
        // No dot-decimal fold: 17 of the 18 dot-separated pairs in the Cyrillic text are figure
        // references (`рәс. 12.1а`) or a date (`08.10.07`), and only `−2.88` is a number.
        expect(normalizeTatar("08.10.07")).toBe("08.10.07");
    });

    test("INITIALISMS — the caps runs that reached the g2p as consonant clusters", () => {
        expect(tt.text("ТР")).toBe("ˈte ˈer"); // was [tr]
        expect(tt.text("АКШ")).toBe("ˈɑ ˈqɑ ˈʃɑ"); // the USA
        expect(tt.text("СССР")).toBe("ˈes ˈes ˈes ˈer");
    });
});
