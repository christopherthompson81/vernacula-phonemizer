import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeIrish, ordinalWords } from "../src/languages/irish/normalize.ts";
import { numberToWords } from "../src/languages/irish/numbers.ts";
import { phonemizeWord } from "../src/languages/irish/irish.ts";

// Canonical-IPA goldens for Irish Gaelic (ga) — Standard/Connacht-leaning, espeak-independent. The defining
// axis is BROAD (velarized ˠ, next to a/o/u) vs SLENDER (palatalized ʲ, next to e/i) consonants, determined by
// the flanking vowel letters ("caol le caol"). Slender velars are the palatal stops c/ɟ; slender s → ʃ. First-
// syllable stress (marked even on monosyllables); unstressed short vowels reduce to ə. Authored to
// Standard/Connacht; the espeak-ng-portable ga engine is a LOOSE cross-check — a few goldens deliberately
// diverge from it (Connacht final -e → ə, silent -dh/-gh, broad bh/mh → w). See docs/investigations/ga_bringup_investigation.md.
describe("irish canonical IPA", () => {
    test("broad consonants (velarized ˠ, dental l̪ˠ/n̪ˠ/d̪ˠ/t̪ˠ)", () => {
        expect(phonemizeWord("mór")).toBe("mˠˈoːɾˠ");
        expect(phonemizeWord("cat")).toBe("kˈat̪ˠ"); // broad k (velar), dental broad t
        expect(phonemizeWord("madra")).toBe("mˠˈad̪ˠɾˠə"); // final a → ə (unstressed reduction)
        expect(phonemizeWord("lá")).toBe("l̪ˠˈɑː"); // dark dental broad l
        expect(phonemizeWord("carr")).toBe("kˈaɾˠ"); // rr → single broad ɾˠ
        expect(phonemizeWord("focal")).toBe("fˠˈɔkəl̪ˠ");
    });

    test("slender consonants (palatalized ʲ; velars → palatal c/ɟ; s → ʃ)", () => {
        expect(phonemizeWord("bí")).toBe("bʲˈiː");
        expect(phonemizeWord("fir")).toBe("fʲˈɪɾʲ");
        expect(phonemizeWord("tír")).toBe("tʲˈiːɾʲ");
        expect(phonemizeWord("teach")).toBe("tʲˈax"); // slender t → tʲ, ch → x (broad)
        expect(phonemizeWord("súil")).toBe("sˠˈuːlʲ");
        expect(phonemizeWord("duine")).toBe("d̪ˠˈɪnʲə");
    });

    test("broad/slender in one word (caol le caol) + word-initial r broad", () => {
        expect(phonemizeWord("fear")).toBe("fʲˈaɾˠ"); // slender f (e), broad r (a)
        expect(phonemizeWord("bean")).toBe("bʲˈan̪ˠ");
        expect(phonemizeWord("rí")).toBe("ɾˠˈiː"); // word-initial r broad even before i
        expect(phonemizeWord("baile")).toBe("bˠˈalʲə");
    });

    test("lenition (séimhiú) + silent -dh/-gh endings", () => {
        expect(phonemizeWord("bhí")).toBe("vʲˈiː"); // bh → vʲ (slender)
        expect(phonemizeWord("oíche")).toBe("ˈiːçə"); // ch → ç (slender)
        expect(phonemizeWord("deoch")).toBe("dʲˈɔx"); // eo → ɔ here (lexicon pins the semi-lexical eo split)
        expect(phonemizeWord("chéadaigh")).toBe("çˈeːd̪ˠə"); // ch→ç, final -aigh: gh silent, ai→ə
        expect(phonemizeWord("airigh")).toBe("ˈaɾʲə");
    });

    test("review fixes: eclipsis (urú), s-cluster + coda quality, native ng → ŋ, oi → ɔ", () => {
        expect(phonemizeWord("gcat")).toBe("ɡˈat̪ˠ"); // eclipsis gc → ɡ (c silent)
        expect(phonemizeWord("mbád")).toBe("mˠˈɑːd̪ˠ"); // mb → mˠ
        expect(phonemizeWord("ngaeilge")).toBe("ŋˈeːəlʲɟə"); // ng → ŋ; unstressed i reduces to ə (referee-backed)
        expect(phonemizeWord("bhfuil")).toBe("wˈɪlʲ"); // bhf → w (f silent)
        expect(phonemizeWord("spéir")).toBe("sˠpʲˈeːɾʲ"); // s stays BROAD in the s-cluster; only p palatalizes
        expect(phonemizeWord("ainm")).toBe("ˈanʲmˠ"); // final m broad (no adjacent slender vowel)
        expect(phonemizeWord("long")).toBe("l̪ˠˈɔŋ"); // native ng → ŋ, final ɡ absorbed
        expect(phonemizeWord("scoil")).toBe("sˠkˈɔlʲ"); // oi → ɔ (not ɛ)
    });

    test("Run 2 — i-offglide (long back V + slender coda) + svarabhakti epenthesis", () => {
        expect(phonemizeWord("áit")).toBe("ˈɑːⁱtʲ"); // ɑː + slender coda t → i-offglide
        expect(phonemizeWord("cóir")).toBe("kˈoːⁱɾʲ");
        expect(phonemizeWord("súil")).toBe("sˠˈuːlʲ"); // uː gets NO offglide
        expect(phonemizeWord("baile")).toBe("bˠˈalʲə"); // pre-vocalic slender l → no offglide
        expect(phonemizeWord("gorm")).toBe("ɡˈɔɾˠəmˠ"); // r + coda m → epenthetic ə
        expect(phonemizeWord("bolg")).toBe("bˠˈɔl̪ˠəɡ"); // l + coda ɡ → ə
        expect(phonemizeWord("gairm")).toBe("ɡˈaɾʲəmˠ"); // r-epenthesis; short a → no offglide
        expect(phonemizeWord("ainm")).toBe("ˈanʲmˠ"); // n does NOT trigger epenthesis
    });

    test("Run 3 — ia/ua diphthongs, onset offglide, eo no-glide, lexicon overrides", () => {
        expect(phonemizeWord("iad")).toBe("ˈiəd̪ˠ"); // ia → iə (short first element; referee-confirmed)
        expect(phonemizeWord("ciall")).toBe("cˈiəl̪ˠ");
        expect(phonemizeWord("nuair")).toBe("n̪ˠˈuəɾʲ"); // ua → uə
        expect(phonemizeWord("áirithe")).toBe("ˈɑːⁱɾʲəhə"); // offglide before a slender ONSET, not just coda
        expect(phonemizeWord("ceoil")).toBe("cˈoːlʲ"); // eo carries its glide → no i-offglide
        expect(phonemizeWord("deoch")).toBe("dʲˈɔx"); // lexicon: the semi-lexical eo → ɔ split
        expect(phonemizeWord("féidir")).toBe("fʲˈeːdʲəɾʲ"); // unstressed i reduces to ə (referee), NOT the oracle's ɪ
    });

    test("fada (long vowels) + first-syllable stress", () => {
        expect(phonemizeWord("bó")).toBe("bˠˈoː");
        expect(phonemizeWord("fada")).toBe("fˠˈad̪ˠə");
        expect(phonemizeWord("cara")).toBe("kˈaɾˠə");
        expect(phonemizeWord("obair")).toBe("ˈɔbˠəɾʲ"); // stress first syllable; 2nd (ai) → ə
    });
});

// Irish numeral composition (#549). The Run-1 stub read every multi-digit number digit-by-digit
// (25 → "dó cúig"). Irish needs a bespoke compositor: two numeral series (counting ceathair vs
// attributive ceithre), the `a` particle, h-prefix on vowel-initial counting forms, and initial
// mutation of the magnitude word (2–6 lenite, 7–10 eclipse). Every word below is attested in
// ga.wikipron-gle-broad.tsv, including the mutated shapes céad/chéad/gcéad and déag/dhéag.
describe("Irish numbers", () => {
    for (const [n, expected] of [
        [0, "náid"],                      // bare zero takes no particle
        [1, "a haon"],                    // h-prefix on the vowel-initial counting form
        [4, "a ceathair"],                // COUNTING series (not attributive ceithre)
        [8, "a hocht"],
        [11, "a haon déag"],
        [12, "a dó dhéag"],               // déag lenites after dó ONLY
        [13, "a trí déag"],
        [20, "fiche"],
        [25, "fiche a cúig"],             // the issue's headline case
        [40, "daichead"],
        [98, "nócha a hocht"],
        [100, "céad"],                    // bare magnitude — no "aon"
        [101, "céad a haon"],
        [200, "dhá chéad"],               // 2–6 LENITE: céad → chéad
        [400, "ceithre chéad"],           // ATTRIBUTIVE series before a magnitude
        [700, "seacht gcéad"],            // 7–10 ECLIPSE: céad → gcéad
        [1000, "míle"],
        [2000, "dhá mhíle"],
        [7000, "seacht míle"],            // m has no eclipsed form → bare
        [1998, "míle naoi gcéad nócha a hocht"],
        [999999, "naoi gcéad nócha a naoi míle naoi gcéad nócha a naoi"], // 3-digit magnitude count
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no digit-by-digit fallback, and no gaps, across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) {
            const w = numberToWords(n);
            expect(w, `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/);
        }
    });

    test("end-to-end: the numeral is phonemized, not spelled out digit-wise", () => {
        expect(phonemize("25", "ga")).toBe("fʲˈɪçə ˈa kˈuːɟ"); // fiche a cúig
        expect(phonemize("1998", "ga")).toContain("ɟˈeːd̪ˠ"); // gcéad — the ECLIPSED hundred
    });
});

// TEXT NORMALIZATION (src/languages/irish/normalize.ts) — the pre-tokenizer pass behind #562. The defining
// rules are the `Nú` ordinal digits (chéad, tríú, cúigiú … déag — the article is the text's own), the comma-thousands, the dot-decimal
// "pointe", the i.n./r.n./A.D./R.C. era markers, the msu/km-u rates, and the letter-spelled initialisms.
describe("Irish text normalization", () => {
    const ph = (s: string): string => phonemize(s, "ga").trim();

    test("text→text: the Nú ordinal reads the Irish ordinal word", () => {
        // NO ARTICLE from the layer: 27 of the corpus's 36 `Nú` instances already have one ("an 15ú
        // haois", "sa 10ú haois"), and a table carrying "an" read them twice. The NOUN goes inside a
        // compound, which is the corpus's own register ("an naoú haois déag").
        expect(normalizeIrish("15ú")).toBe("cúigiú déag");
        expect(normalizeIrish("an 15ú haois")).toBe("an cúigiú haois déag");
        expect(normalizeIrish("sa 10ú haois")).toBe("sa deichiú haois");
        expect(normalizeIrish("an 37ú tír")).toBe("an seachtú tír is tríocha");
        expect(normalizeIrish("an 190ú áit")).toBe("an céad nóchadú áit");
        expect(normalizeIrish("an 8ú lá")).toBe("an t-ochtú lá"); // the t- prefix after a bare "an"
        expect(ordinalWords(11)).toBe("aonú déag"); // eleven is aonú, never chéad
        expect(normalizeIrish("18ú")).toBe("ochtú déag");
        expect(normalizeIrish("20ú")).toBe("fichiú");
        expect(ph("7ú")).toBe("ʃˈaxt̪ˠuː"); // seachtú
        expect(ph("190ú")).toBe("cˈeːd̪ˠ n̪ˠˈoːxəd̪ˠuː"); // céad nóchadú, with the article left to the text
    });

    test("comma-thousands stay grouped; the dot is a decimal (pointe)", () => {
        expect(ph("1,400")).toBe("mʲˈiːlʲə cˈɛhɾʲə çˈeːd̪ˠ");
        expect(ph("400,000")).toBe("cˈɛhɾʲə çˈeːd̪ˠ mʲˈiːlʲə");
        expect(ph("1.5 million")).toBe("ˈa hˈeːn̪ˠ pˠˈɔnʲtʲə ˈa kˈuːɟ mʲˈɪlʲən̪ˠ");
        expect(ph("12.8 km")).toBe("ˈa d̪ˠˈoː jˈeːɡ pˠˈɔnʲtʲə ˈa hˈɔxt̪ˠ cˈɪlʲəmʲeːd̪ˠəɾˠ");
        // trap pins: the haon-ending compound ordinals (21ú, 31ú) and the decimal-percent (3.5%)
        expect(ph("21ú")).toBe("ˈeːn̪ˠuː ˈɪʃ fʲˈɪçə"); // aonú is fiche — the unit first, the tens last
        expect(ph("3.5%")).toBe("ˈa tʲɾʲˈiː pˠˈɔnʲtʲə ˈa kˈuːɟ fˠˈiːnʲ ɟˈeːd̪ˠ"); // faoin gcéad after the decimal
    });

    test("clocks read hour [minute] with i.n./r.n. as iarnóin / réamhnóin", () => {
        expect(ph("11:35 i.n.")).toBe("ˈa hˈeːn̪ˠ dʲˈeːɡ tʲɾʲˈiːxə ˈa kˈuːɟ ˈiəɾˠn̪ˠoːⁱnʲ");
        expect(ph("8:30 p.m.")).toBe("ˈa hˈɔxt̪ˠ tʲɾʲˈiːxə ˈiəɾˠn̪ˠoːⁱnʲ");
        expect(ph("1:15 r.n.")).toBe("ˈa hˈeːn̪ˠ ˈa kˈuːɟ dʲˈeːɡ ɾˠˈeːwn̪ˠoːⁱnʲ");
    });

    test("era markers expand; ranges join go dtí; rates use san uair", () => {
        expect(ph("400 A.D.")).toBe("cˈɛhɾʲə çˈeːd̪ˠ t̪ˠˈaɾˠ ˈeːʃ çɾʲˈiːsˠt̪ˠ"); // tar éis Chríost
        expect(ph("1000 R.C.")).toBe("mʲˈiːlʲə ɾˠˈɪvʲ çɾʲˈiːsˠt̪ˠ"); // roimh Chríost
        expect(ph("35-40 msu")).toBe("tʲɾʲˈiːxə ˈa kˈuːɟ ɡˈɔ dʲˈiː d̪ˠˈaçəd̪ˠ mʲˈiːlʲə sˠˈan̪ˠ ˈuəɾʲ");
        expect(ph("160km/h")).toBe("cˈeːd̪ˠ ʃˈasˠkə cˈɪlʲəmʲeːd̪ˠəɾˠ sˠˈan̪ˠ ˈuəɾʲ");
    });

    test("degrees, fractions, ampersand and currency read their Irish words", () => {
        expect(ph("30°C")).toBe("tʲɾʲˈiːxə cˈeːmʲ cˈɛlʲʃʊsˠ");
        expect(ph("35°W")).toBe("tʲɾʲˈiːxə ˈa kˈuːɟ cˈeːmʲ ʃˈiəɾˠ"); // céim siar — longitude
        expect(ph("1/5 orlach")).toBe("ˈan̪ˠ kˈuːɟuː ˈɔɾˠl̪ˠəx"); // an cúigiú orlach
        expect(ph("B&Banna")).toBe("bʲˈeː ˈaɡəsˠ bʲˈeːn̪ˠə"); // bé agus béanna
        expect(ph("US$14.7")).toBe("d̪ˠˈɔl̪ˠəɾˠ n̪ˠˈə sˠt̪ˠˈɑːt̪ˠ ˈeːn̪ˠt̪ˠəhə ˈa cˈahəɾʲ dʲˈeːɡ pˠˈɔnʲtʲə ˈa ʃˈaxt̪ˠ");
    });

    test("S.A./N.A. and initialisms expand or letter-spell", () => {
        expect(ph("S.A.")).toBe("sˠt̪ˠˈɑːⁱtʲ ˈeːn̪ˠt̪ˠəhə"); // Stáit Aontaithe
        expect(ph("N.A.")).toBe("n̪ˠˈɑːⁱʃuːənʲ ˈeːn̪ˠt̪ˠəhə"); // Náisiúin Aontaithe
        expect(ph("H5N1")).toBe("hˈeːʃ ˈa kˈuːɟ ˈɛnʲ ˈa hˈeːn̪ˠ"); // héis a cúig ein a haon
    });
});
