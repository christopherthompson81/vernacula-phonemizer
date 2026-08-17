import { describe, expect, test } from "vitest";

import { phonemizeWord, createXhosa } from "../src/languages/xhosa/xhosa.ts";
import { normalizeXhosa } from "../src/languages/xhosa/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Xhosa / isiXhosa (xh) — Nguni Bantu, AUTHORED. The sibling of Zulu:
// it REUSES the shared Zulu g2p scan (the 15-way click series, depressor consonants, implosive b→ɓ, ejective
// stops) with the Xhosa rule table — the one addition being ⟨rh⟩→[x] (voiceless velar fricative, Zulu lacks it).
// Nguni penultimate stress with vowel lengthening (ˈ + ː); tone is lexical/unwritten → deferred.
// Referees: wikipron xho narrow + epitran.
describe("Xhosa canonical IPA", () => {
    test("clicks (c/q/x → kǀ/kǃ/kǁ, xh→kǁʰ) + penult stress/length", () => {
        expect(phonemizeWord("xhosa")).toBe("kǁʰˈɔːsa"); // xh → kǁʰ (aspirated lateral click)
        expect(phonemizeWord("iqanda")).toBe("ikǃˈaːnd̤a"); // q → kǃ (postalveolar click)
        expect(phonemizeWord("ukutya")).toBe("ukʼˈuːcʼa"); // ty → cʼ; k → kʼ (ejective); penult stress
    });

    test("the Xhosa ⟨rh⟩ → [x] (Zulu lacks it)", () => {
        expect(phonemizeWord("rhoxa")).toBe("xˈɔːkǁa"); // rh → x, x → kǁ (lateral click)
        expect(phonemizeWord("irhafu")).toBe("ixˈaːfu"); // rh → x
    });

    test("depressor/implosive/nasal + penult length", () => {
        expect(phonemizeWord("molo")).toBe("mˈɔːlɔ"); // penult ˈ + ː
        expect(phonemizeWord("amanzi")).toBe("amˈaːnz̤i"); // z → z̤ (depressor)
        expect(phonemizeWord("ndiyabulela")).toBe("nd̤ijaɓulˈɛːla"); // b → ɓ (implosive), d → d̤
    });

    test("numbers (Nguni agglutinative; Xhosa 2=-bini, 6=isithandathu)", () => {
        const d = createXhosa();
        expect(d.text("2").trim()).toBe("kʼuɓˈiːni"); // kubini (Xhosa -bini, not Zulu -bili)
        expect(d.text("6").trim()).toBe("isitʰand̤ˈaːtʰu"); // isithandathu
        expect(d.text("10").trim()).toBe("iʃˈuːmi"); // ishumi
    });

    // As Zulu: three distinct unit series — standalone ku-, connective na-, multiplier ama-. Source: xhosa.jsonc
    // "numbers". Regression note: 13/15/23/25/… were once reported as failures by a number-audit probe whose
    // sentinel regex was case-insensitive and matched the legitimate na- forms "NANtathu"/"NANhlanu" as "NaN".
    test("numbers — the na- connective series (units 3 and 5) is intact, plus magnitudes", () => {
        const d = createXhosa();
        expect(d.text("3").trim()).toBe("kʼutʰˈaːtʰu"); // kuthathu — standalone ku-
        expect(d.text("5").trim()).toBe("kʼuɬˈaːnu"); // kuhlanu
        expect(d.text("13").trim()).toBe("iʃˈuːmi nantʼˈaːtʰu"); // ishumi nantathu — connective na-
        expect(d.text("15").trim()).toBe("iʃˈuːmi nanɬˈaːnu"); // ishumi nanhlanu
        expect(d.text("21").trim()).toBe("amaʃˈuːmi amaɓˈiːni nˈaːɲɛ"); // amashumi amabini nanye
        expect(d.text("555").trim()).toBe("amakʰˈuːlu amaɬˈaːnu amaʃˈuːmi amaɬˈaːnu nanɬˈaːnu");
        expect(d.text("2000").trim()).toBe("amawˈaːkʼa amaɓˈiːni"); // amawaka amabini
        expect(d.text("1000000").trim()).toBe("isiɡ̤ˈiːd̤i"); // isigidi
    });
});

// TEXT NORMALIZATION. These pin the RULE'S BRANCHES, not the corpus's instances :
// every rule with a table plus a fallback gets one case from each side, and the cases the corpus does NOT
// contain (a capitalised ordinal suffix, `°F`, `00:30`, an out-of-range hour, a comma decimal) are pinned
// deliberately, because zero corpus instances is not evidence of correctness.
describe("Xhosa text normalization", () => {
    test("thousands de-grouping — comma, space, and the two shapes that must NOT de-group", () => {
        expect(normalizeXhosa("eziyi-3,850")).toBe("eziyi-3850");
        expect(normalizeXhosa("ezingama-5,000,000")).toBe("ezingama-5000000");
        // The trailing guard is `(?![\d]|,\d)`: a clause comma and a sentence period must not block it.
        // Both of these silently declined with a `(?![\d.,])` guard, and step 6 then read the leftover
        // comma as a decimal — `¥130,000` came out "one hundred and thirty zero zero zero yen".
        expect(normalizeXhosa("ne-¥130,000, yaye")).toBe("ne-¥130000, yaye");
        expect(normalizeXhosa("nayi-2,207.")).toBe("nayi-2207.");
        expect(normalizeXhosa("abangama-6 500.")).toBe("abangama-6500.");
        expect(normalizeXhosa("ne-10 000 BCE")).toBe("ne-10000 bhi si i");
        // A four-digit tail is a DATE comma (Novemba 26,2008), not grouping.
        expect(normalizeXhosa("Novemba 26,2008")).toBe("Novemba 26,2008");
        // A partial grouped match must not be taken (`1,234` inside `1,234,5`).
        expect(normalizeXhosa("1,234,5")).toBe("1,234,5");
        // Space grouping needs blocks of exactly three, or two unrelated numbers would fuse.
        expect(normalizeXhosa("nge 30 9")).toBe("nge 30 9");
    });

    test("the clock — all four minute branches of the na- connective, plus the refusals", () => {
        // :00 → the hour alone. Otherwise the zero word `iqanda` ("egg") is spoken, which is what
        // `12.00 GMT` read before.
        expect(normalizeXhosa("ngo-11:00")).toBe("ngo-ishumi nanye");
        // 1–9: the manifest's own suppletive na- series (kunye → nanye), not a derivation.
        expect(normalizeXhosa("8:08")).toBe("isibhozo nesibhozo");
        // 10–19: the head is `ishumi`, so na+i → ne.
        expect(normalizeXhosa("ngo-07:19 a.m.")).toBe("ngo-isixhenxe neshumi nethoba kusasa");
        // 20+: the head is `amashumi`, so na+a → na. The corpus writes this one with a SPACE after the
        // colon; `10: 00` and `11: 00` do too.
        expect(normalizeXhosa("nge-8: 30 p.m.")).toBe("nge-isibhozo namashumi amathathu emva kwemini");
        expect(normalizeXhosa("ngo-11:20,amapolisa")).toBe("ngo-ishumi nanye namashumi amabini,amapolisa");
        // The DOT clock, which needs its timezone to be distinguishable from a decimal.
        expect(normalizeXhosa("ngo-12.00 GMT")).toBe("ngo-ishumi nambini ji emu thi");
        expect(normalizeXhosa("(15.00 UTC)")).toBe("(ishumi nanhlanu yu thi si)");
        // A SPORTS TIME IS NOT A CLOCK — a third field. All three corpus paces must fall through.
        expect(normalizeXhosa("le-4: 41.30")).toBe("le-4: 41 3 0");
        expect(normalizeXhosa("eyi-1: 09.02")).toBe("eyi-1: 09 0 2");
        // Out-of-range operands are left alone rather than read as a time.
        expect(normalizeXhosa("24:45")).toBe("24:45");
    });

    test("currency — the compound key, the concord-prefix split, and the decimal path", () => {
        // THE DROP THIS LAYER EXISTS FOR. `$` is letter-bounded on the left in the shared tier, and Xhosa
        // glues its concord straight onto the sign, so both of these were silently swallowed.
        expect(phonemize("leUS$30", "xh")).toContain("iid̤ˈɔːla z̤asɛmɛlˈiːkʼa");
        expect(phonemize("i$10", "xh")).toContain("iid̤ˈɔːla");
        // …and the spaced code form converges on the same compound key.
        expect(phonemize("i-US $ 14.7 yezigidi", "xh")).toContain("iid̤ˈɔːla z̤asɛmɛlˈiːkʼa");
        // A decimal amount must claim its own sign and magnitude — step 12 destroys the tier's adjacency.
        expect(normalizeXhosa("bungange-$2.3 bhiliyoni")).toBe("bungange-2 3 bhiliyoni iidola");
        // A GROUPED comma is not a decimal, even right after a sign.
        expect(normalizeXhosa("ne-¥7,000.")).toBe("ne-¥7000.");
        expect(phonemize("ne-¥7,000.", "xh")).toContain("iijˈɛːni");
        expect(phonemize("ye-£ 27 yezigidi", "xh")).toContain("iipʼˈɔːntʼi");
    });

    test("units and rates — the tier's nouns, and the rate the tier cannot express", () => {
        expect(phonemize("i-5 mm", "xh")).toContain("iimilimˈiːtʰa");
        expect(phonemize("30 cm", "xh")).toContain("iisɛntʼimˈiːtʰa");
        expect(phonemize("500 mi", "xh")).toContain("iimajˈiːlɛ");
        expect(phonemize("3,850 km²", "xh")).toContain("iikʰilɔmˈiːtʰa iz̤ikʼwˈɛːrɛ");
        // A decimal with a unit: the rule claims the unit itself (the second clause).
        expect(normalizeXhosa("ezingange 3.50 m ububanzi")).toBe("ezingange 3 5 0 iimitha ububanzi");
        // Rates are local because Xhosa's denominator is ONE attested word, not "A per B".
        expect(normalizeXhosa("kwi-480 km/h")).toBe("kwi-480 iikhilomitha ngeyure");
        expect(normalizeXhosa("nge-160km/h.")).toBe("nge-160 iikhilomitha ngeyure.");
        expect(normalizeXhosa("kwi-83 km / h,")).toBe("kwi-83 iikhilomitha ngeyure,");
        expect(normalizeXhosa("133 m/s;")).toBe("133 iimitha ngomzuzwana;");
        expect(normalizeXhosa("300 mph")).toBe("300 iimayile ngeyure");
        expect(normalizeXhosa("i-64 kph")).toBe("i-64 iikhilomitha ngeyure");
        // ORDERING: the range must be claimed BEFORE the rate, or the second endpoint is not adjacent to
        // its unit and `km/h` reaches the g2p as raw letters.
        expect(normalizeXhosa("u-35-40 mph (56-64 km/h)")).toBe(
            "u-35 ukuya ku 40 iimayile ngeyure (56 ukuya ku 64 iikhilomitha ngeyure)");
    });

    test("ranges — ascending spans only; scores and seasons keep their juxtaposition", () => {
        expect(normalizeXhosa("ibine-120-160")).toBe("ibine-120 ukuya ku 160");
        expect(normalizeXhosa("(1644-1912)")).toBe("(1644 ukuya ku 1912)");
        expect(normalizeXhosa("(1418 – 1450)")).toBe("(1418 ukuya ku 1450)");
        expect(normalizeXhosa("ngu- 7-2.")).toBe("ngu- 7-2.");     // a tennis score
        expect(normalizeXhosa("ka 1995-96,")).toBe("ka 1995-96,");  // a season
        expect(normalizeXhosa("26 - 00.")).toBe("26 - 00.");        // an ice-hockey score
        // A DECIMAL range needs its own rule and must run first — and it is not ascending-gated, because
        // the corpus's one instance counts backwards in time.
        expect(normalizeXhosa("kwi-4.2-3.9 yezigidi")).toBe("kwi-4 2 ukuya ku 3 9 yezigidi");
    });

    test("degrees — the redundancy guard, the compass, and the unattested neighbours", () => {
        // TRAP 12: the corpus's one Celsius sentence already says `amaqondo`, so it must not be doubled.
        // ⚠ THE LEADING `+` IS NOW VOICED, reversing a SOURCED silence on policy grounds. The evidence stands
        // — both xh_za speakers of this sentence produce no plus phones in the TEMPERATURE position while all
        // three of the UTC sentence do — but for TTS an explicitly typed character is CONTENT, and a speaker's
        // omission is evidence about reading habit, not licence to delete. The identical case was decided on
        // hi (shipped silent on 2-of-2 omission, then reverted to voicing); xh was the last holdout, so
        // hi/zu/te/sw all read this sign and xh alone did not.
        expect(normalizeXhosa("amaqondo angaphezulu kwe +30°C aqhelekile."))
            .toBe("amaqondo angaphezulu kwe plas 30 aqhelekile.");
        // A leading MINUS on a temperature is a real negative and is read — 0 corpus instances, pinned as
        // the adversarial neighbour.
        expect(normalizeXhosa("(-30°C)")).toBe("(thabatha amaqondo 30)");
        // …but the sign capture is letter-guarded, because Xhosa's CONCORD hyphen looks exactly like a
        // minus. Unguarded, this ordinary spelling read *kwi thabatha amaqondo 30* — "in minus thirty".
        expect(normalizeXhosa("kwi-30°C")).toBe("kwi-amaqondo 30");
        expect(normalizeXhosa("kwimpuma 35°W.")).toBe("kwimpuma amaqondo 35 entshona.");
        // Neither of these occurs in the corpus. `°F` fell through every branch before it was claimed
        // alongside `°C` (the bare-degree rule rejects a trailing letter), losing the ° and leaking the F.
        expect(normalizeXhosa("nge-98°F")).toBe("nge-amaqondo 98");
        expect(normalizeXhosa("kwi-40°N")).toBe("kwi-amaqondo 40 emantla");
        expect(normalizeXhosa("kwi-45°")).toBe("kwi-amaqondo 45");
    });

    test("the English ordinal suffix is stripped — the Xhosa concord is already written", () => {
        expect(normalizeXhosa("le-18th sentyhuri")).toBe("le-18 sentyhuri");
        expect(normalizeXhosa("yango 17th-century")).toBe("yango 17-century");
        expect(normalizeXhosa("yakhe ye 60th,")).toBe("yakhe ye 60,");
        // Case-insensitive : a capitalised suffix is ordinary in a title and must not fall through
        // to the raw-letter reading the rule exists to remove.
        expect(normalizeXhosa("ye-21ST")).toBe("ye-21");
        expect(normalizeXhosa("ye-1st ne-2nd ne-3rd")).toBe("ye-1 ne-2 ne-3");
    });

    test("dotted abbreviations — the final dot survives a sentence end but not a continuation", () => {
        // Glued next word: separate it, no period.
        expect(normalizeXhosa("yi-U.S.Geological Survey")).toBe("yi-yu esi Geological Survey");
        // Mid-sentence: the dot goes.
        expect(normalizeXhosa("ne-1000 B.C.E., ama-Asiriya")).toBe("ne-1000 bhi si i, ama-Asiriya");
        // End of input, and a new capitalised sentence: the SENTENCE break must be kept, or three pauses
        // are silently deleted (the Swahili `expandDotted` lesson).
        expect(normalizeXhosa("yase U.S.")).toBe("yase yu esi.");
        expect(normalizeXhosa("yase U.S. Ngoko ke")).toBe("yase yu esi. Ngoko ke");
        expect(normalizeXhosa("kwi-U.S House")).toBe("kwi-yu esi House");
        expect(normalizeXhosa("uN.Wayne Hale Jr. uthe")).toBe("uN Wayne Hale Jr uthe");
        expect(normalizeXhosa("UMnu. Costello uthe")).toBe("UMnumzana Costello uthe");
        expect(normalizeXhosa("watsho uMnu Costello.")).toBe("watsho uMnumzana Costello.");
    });

    test("decimals emit NO separator word — none is attested in any source (see normalize.ts)", () => {
        expect(normalizeXhosa("eziyi-12.8 okanye")).toBe("eziyi-12 8 okanye");
        expect(normalizeXhosa("ku 6.34 ye intshi")).toBe("ku 6 3 4 ye intshi");
        // The corpus's one COMMA decimal, and the 3-digit tail that must stay grouping.
        expect(normalizeXhosa("eziyi-2,3 miliyoni")).toBe("eziyi-2 3 miliyoni");
        expect(normalizeXhosa("eziyi-2,300 miliyoni")).toBe("eziyi-2300 miliyoni");
        // A version dot is read digit-by-digit too, which at least removes the full stop it used to emit.
        expect(normalizeXhosa("se-802.11n")).toBe("se-802 1 1n");
        expect(normalizeXhosa("iFigure 1.1.")).toBe("iFigure 1 1.");
    });

    test("relational and arithmetic signs — 0 corpus instances, read anyway", () => {
        // Every word is the HSRC maths dictionary's own gloss for that SYMBOL; most are corpus tokens too.
        expect(normalizeXhosa("x = y")).toBe("x lilingana ne y");
        expect(normalizeXhosa("5 < 6")).toBe("5 ngaphantsi kuna 6");
        expect(normalizeXhosa("23 > 19")).toBe("23 ngaphezulu kuna 19");
        expect(normalizeXhosa("7 × 2")).toBe("7 phindaphinda 2");
        expect(normalizeXhosa("8 ÷ 2")).toBe("8 yahlula 2");
        // `plas`, not the HSRC dictionary's addition operator `dibanisa`: all THREE xh_za speakers of
        // the `UTC+1` sentence say the English loan, decoded with a PHONEME recognizer whose vocabulary holds
        // no `+` and no digits (`j u t i s i p l a s w a n`). `dibanisa` glosses the SYMBOL correctly and is
        // not what a reader says. Spelled `plas` because the attested vowel is [a] and the orthography is
        // phonemic — `plus` would read pʼlˈuːs.
        expect(normalizeXhosa("+5")).toBe("plas 5");
        expect(normalizeXhosa("-5")).toBe("thabatha 5");
        // `UTC+1` is the corpus's one operator-position plus.
        expect(normalizeXhosa("lalapha( UTC+1) e")).toBe("lalapha( yu thi si plas 1) e");
        // THE STRAY DASH. The corpus's one ` -N` is a hyphen, not a negative: the English original reads
        // "winds blowing at 40 mph". Reading it as *thabatha* would be confidently wrong, so the guard
        // rejects a dash whose space follows a word — and the ` -` here must stay unread.
        expect(normalizeXhosa("ebhudla kangange -40 mph")).toBe("ebhudla kangange -40 iimayile ngeyure");
        // …while a compound hyphen is never touched.
        expect(normalizeXhosa("i-COVID-19 ne-Il-76")).toBe("i-COVID-19 ne-Il-76");
    });

    test("the ampersand and its HTML entity → kunye", () => {
        expect(normalizeXhosa("Arts & Sciences")).toBe("Arts kunye Sciences");
        expect(normalizeXhosa("iiB&amp;B ezikhuphisana")).toBe("iiB kunye B ezikhuphisana");
    });

    test("no SLOT-GAP: a padded replacement must not leave a double or edge space", () => {
        for (const probe of ["Arts & Sciences", "leUS$30", "+30°C", "yase U.S.", "9:30 a.m."])
            expect(normalizeXhosa(probe)).not.toMatch(/^\s|\s$|\s\s/u);
    });
});

// ⚠ NGUNI IS WRITTEN IN LATIN, so its tokenizer claims embedded English outright — there is no unclaimed
// gap for core/foreign.ts to fill, the way there is for a non-Latin-script host. The g2p then reads the
// English word, and c/q/x are CLICK letters, so the result is confidently wrong rather than merely
// accented: `hurricane center` read [hurrikǀˈaːnɛ kǀˈɛːntʼɛr]. 19.2% of xh and 14.8% of zu FLEURS
// utterances carry such a word.
describe("embedded English words route to the foreign reader instead of becoming clicks", () => {
    const CLICK = /[ǀǁǃǂ]/u;

    test("an English word with a click letter AND a non-Nguni shape is read as English", () => {
        // Each of these carries a cluster or a consonant ending Nguni does not license, so it cannot be a
        // Nguni word and routing is unambiguous.
        for (const w of ["arctic", "microsoft", "hurricane", "district", "electric", "atlantic"]) {
            const out = phonemize(`nge ${w} yakhe`, "xh");
            expect(out, `${w} still has a click`).not.toMatch(CLICK);
        }
    });

    test("...but an UNLISTED vowel-final CV English word stays NATIVE, and that is still the trade", () => {
        // `cuba` and `cima` are indistinguishable as orthography, so routing on shape alone would take
        // Nguni words with it. An unlisted one keeps a wrong click; the alternative was reading `xhosa`
        // as English.
        //
        // ⚠ THIS TEST USED TO PIN `china`, and that expectation is now obsolete rather than wrong: the
        // loan LEXICON (zulu/nguniLoans.ts) resolves the named words one at a time, which is the whole
        // point of lexicalising them — it fixes `china` WITHOUT loosening the signal that protects
        // `cima`, `cha` and `xhosa`. The trade the test documents still holds for everything not listed,
        // and `cuba` is one of those.
        expect(phonemize("nge cuba yakhe", "xh")).toMatch(CLICK);
        expect(phonemize("nge cima yakhe", "xh")).toMatch(CLICK);
        // …and the listed one is now correct.
        expect(phonemize("nge china yakhe", "xh")).not.toMatch(CLICK);
    });

    test("...but NATIVE words keep their clicks — c/q/x are real Nguni letters", () => {
        // Each of these is an ordinary Xhosa word whose c/q/x IS a click. Routing them would be a far
        // worse error than the one this fixes.
        for (const w of ["ukucula", "iqiniso", "ixesha"]) {
            expect(phonemize(w, "xh"), `${w} lost its click`).toMatch(CLICK);
        }
    });

    test("...and English-dictionary COLLISIONS are left alone, which is why both signals are required", () => {
        // The most frequent CMUdict hits in these corpora are Nguni words — uma ×105, ngo ×95, ama ×67.
        // The click-letter signal is what keeps them native; the English-word signal alone would wreck them.
        const native = phonemize("uma ngo ama kahle yonke kuba moya", "xh");
        expect(native).not.toMatch(/ɹ|æ|ɚ/u); // no English phones leaked in
    });
});

// ⚠ REGRESSION GUARD for the review finding: signals 1+2 alone (click letter + English dictionary) routed
// six real Nguni words to English, because CMUdict carries them as names or brands. `cha` occurs in the
// zu FLEURS corpus, so this was live corruption rather than a hypothesis.
describe("Nguni words that collide with the English dictionary stay native", () => {
    test.each([["cha"], ["cela"], ["caba"], ["cima"], ["coca"], ["xhosa"]])(
        "%s is not routed to English",
        (w) => {
            const out = phonemize(w, "xh");
            expect(out, `${w} was routed to English`).toMatch(/[ǀǁǃǂ]/u);
        },
    );
});

/**
 * ⚠ THE NGUNI LOANWORD LEXICON. `isForeignNguniWord` decides click-vs-foreign from three signals, and
 * its own note records the cost: a vowel-final CV English name is shaped exactly like a Nguni word, so
 * `canada` and `cabanga` cannot be told apart orthographically. Those words are LEXICALISED instead —
 * which is what English does with its own loans, and what these are.
 *
 * ⚠ THE READINGS SPLIT TWO WAYS, measured against the FLEURS audio, which is why no single rule could
 * have worked. Long-established borrowings are NATIVISED and newer names keep English phonology:
 *
 *   canada  ASR `b a s e k a n a d`   -> /kanada/     mexico ASR `m e ð u k s i k o` -> /meksiko/
 *   congo   ASR `k o ŋ ɡ`             -> /kongo/      china  ASR `tʃ h aɪ n n a`     -> English
 *
 * See src/languages/zulu/nguniLoans.ts for each entry's evidence.
 */
describe("the Nguni loan lexicon", () => {
    const CLICK = /[ǀǁǃǂ]/u;

    test("nativised loans read with a plain stop, not a click", async () => {
        expect(await phonemize("canada", "xh")).toBe("kʼanˈaːd̤a");
        expect(await phonemize("congo", "xh")).toBe("kʼˈɔːŋɡ̤ɔ");
        // ⟨x⟩ takes its Latin /ks/, which is what the recognizer heard: meksiko
        expect(await phonemize("mexico", "xh")).toBe("mɛkʼsˈiːkʼɔ");
    });

    test("English-read loans go to the foreign reader", async () => {
        // the ⟨aɪ⟩ diphthong is the tell — Nguni does not have it
        expect(await phonemize("china", "xh")).toContain("aᶦ");
        expect(await phonemize("carolina", "xh")).toContain("aᶦ");
        for (const w of ["china", "chile", "carolina"])
            expect(await phonemize(w, "xh"), w).not.toMatch(CLICK);
    });

    test("foreign surnames, which fail ONLY the dictionary signal", async () => {
        for (const w of ["cuerden", "cadwalder", "corniglia", "choudhary", "capuzzo", "chhatrapati"])
            expect(await phonemize(w, "xh"), w).not.toMatch(CLICK);
    });

    /**
     * ⚠ THE GUARD THAT MATTERS MOST. Relaxing signal 2 instead of adding a lexicon was measured and it
     * routes REAL Nguni words to English — including `compyutha`, the nativised borrowing of
     * "computer", and `xhosa` itself. A lexicon adds words one at a time; loosening a signal removes a
     * guard from all of them at once.
     */
    test("native words keep their clicks", async () => {
        for (const w of ["cha", "cela", "caba", "cima", "coca", "xhosa", "cishe", "xesha",
                         "qiniseka", "cwaka", "ukucela", "compyutha", "qho"])
            expect(await phonemize(w, "xh"), w).toMatch(CLICK);
    });
});
