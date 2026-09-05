import { describe, expect, test } from "vitest";

import { phonemizeWord, createLuo } from "../src/languages/luo/luo.ts";
import { numberToWords } from "../src/languages/luo/numbers.ts";
import { normalizeLuo } from "../src/languages/luo/normalize.ts";

// Canonical-IPA goldens for Luo / Dholuo (luo) — Western Nilotic (Luo group), Latin orthography, spoken around Lake
// Victoria in Kenya + Tanzania (~4–5M). Hand-adjudicated against the 17-word
// en.wiktionary Luo IPA referee (the only source; single-source) + Tucker (1994) 'A Grammar of Kenya Luo'. The
// greedy g2p agrees with all 17 — ⚠ a perfect score on a 17-word referee is a statement about the referee's
// size, not the engine's margin. The folds strip tone + ±ATR (both
// UNWRITTEN), the one-palatal notation, aspiration, and the tap/glide notation. Signatures: the DENTAL vs ALVEOLAR
// contrast (⟨th dh⟩=θ ð vs ⟨t d⟩=t d); PRENASALIZED voiced stops (⟨mb⟩=ᵐb, ⟨nd⟩=ⁿd, ⟨nj⟩=ⁿd͡ʒ, ⟨ng⟩=ᵑɡ); ⟨ng'⟩=ŋ,
// ⟨ny⟩=ɲ; the palatals ⟨ch⟩=t͡ʃ, ⟨j⟩=d͡ʒ; the high-vowel glide (⟨i u⟩+V → j/w). The 9-vowel ±ATR distinction and
// register TONE (H/L) are UNWRITTEN → emitted at a +ATR/toneless default.
describe("Luo (Dholuo) canonical IPA — greedy g2p (Nilotic: dental contrast + prenasalization)", () => {
    test("DENTAL vs ALVEOLAR: ⟨th dh⟩=θ ð (dental) vs ⟨t d⟩=t d (alveolar)", () => {
        expect(phonemizeWord("dhano")).toBe("ðano"); // "person" — ⟨dh⟩→ð (dental fricative)
        expect(phonemizeWord("thum")).toBe("θum"); // "music/instrument" — ⟨th⟩→θ (dental fricative)
        expect(phonemizeWord("adek")).toBe("adek"); // "three" — ⟨d⟩→d, ⟨k⟩→k (plain alveolar/velar)
        expect(phonemizeWord("kidi")).toBe("kidi"); // "stone" — ⟨d⟩→d alveolar (not dental)
    });

    test("PALATALS + velar nasal: ⟨ch⟩=t͡ʃ, ⟨ny⟩=ɲ, ⟨ng'⟩=ŋ, ⟨y⟩=j", () => {
        expect(phonemizeWord("rech")).toBe("ɾet͡ʃ"); // "fish" — ⟨ch⟩→t͡ʃ, ⟨r⟩→ɾ
        expect(phonemizeWord("wich")).toBe("wit͡ʃ"); // "head"
        expect(phonemizeWord("nyang'")).toBe("ɲaŋ"); // "crocodile" — ⟨ny⟩→ɲ, ⟨ng'⟩→ŋ
        expect(phonemizeWord("ng'ato")).toBe("ŋato"); // "someone" — word-initial ⟨ng'⟩→ŋ
        expect(phonemizeWord("nyaroya")).toBe("ɲaɾoja"); // ⟨y⟩→j
    });

    test("PRENASALIZED voiced stops as single units: ⟨mb nd nj ng⟩", () => {
        expect(phonemizeWord("ndalo")).toBe("ⁿdalo"); // "time/days" — ⟨nd⟩→ⁿd
        expect(phonemizeWord("mbaka")).toBe("ᵐbaka"); // ⟨mb⟩→ᵐb
        expect(phonemizeWord("ngano")).toBe("ᵑɡano"); // "story" — ⟨ng⟩→ᵑɡ (prenasalized, vs ⟨ng'⟩→ŋ)
    });

    test("⟨i⟩+{a,e} GLIDE only (conservative — ⟨u⟩+V + ⟨i⟩+high left as hiatus)", () => {
        expect(phonemizeWord("dhiang'")).toBe("ðjaŋ"); // "cow" — ⟨i⟩+a → j glide, after dental ð
        expect(phonemizeWord("chíeng'")).toBe("t͡ʃjeŋ"); // "sun/day" — ⟨i⟩+e → j (tone-marked citation → base)
        expect(phonemizeWord("dholuo")).toBe("ðoluo"); // the endonym — ⟨u⟩+o is HIATUS (/ðoluo/), NOT glided to ðolwo
        expect(phonemizeWord("guok")).toBe("ɡuok"); // "dog" — ⟨u⟩+o kept as a vowel sequence (no ⟨u⟩→w glide)
    });

    test("+ATR/toneless default (ATR + tone unwritten); ⟨ng'⟩ apostrophe robust to ' / ’ / ʼ", () => {
        expect(phonemizeWord("kelo")).toBe("kelo"); // ⟨e⟩,⟨o⟩ emitted +ATR by default (referee kɛlɔ, folded)
        expect(phonemizeWord("kuno")).toBe("kuno"); // ⟨u⟩,⟨o⟩ +ATR default (referee kʊnɔ, folded)
        // ang'o "what" — the ⟨ng'⟩ digraph resolves to ŋ for ASCII ', ’ (U+2019), and ʼ (U+02BC, the letter apostrophe)
        expect(phonemizeWord("ang'o")).toBe("aŋo");
        expect(phonemizeWord("ang’o")).toBe("aŋo");
        expect(phonemizeWord("angʼo")).toBe("aŋo");
    });

    test("text: words + clause punctuation; numbers spoken", () => {
        expect(createLuo().text("Dhano gi rech.")).toBe("ðano ɡi ɾet͡ʃ .");
        expect(createLuo().text("Adek 3.")).toBe("adek adek ."); // the digit is now read as adek
    });

    // NUMBERS — DECIMAL. Bespoke for one reason the data schema cannot carry: the coordinator gi 'and' ELIDES
    // before a vowel-initial word and every Dholuo unit is vowel-initial, so gi is written SOLID with the unit
    // (apar + gi + achiel → apar gachiel) but stays free before the consonant-initial magnitude words
    // (mia ariyo gi piero adek). Not quinary in the living system — 6 auchiel is a frozen 5+1 beside achiel 1,
    // but 7–9 are opaque. 1000+ uses the everyday BORROWED elfu/milion/bilion rather than the older gana/tara.
    // Sources: Omniglot "Numbers in Dholuo", learndholuo.com. See src/languages/luo/numbers.ts.
    test("numbers: units, apar/piero tens, and the gi → g- elision", () => {
        expect(numberToWords(0)).toBe("nono");
        expect(numberToWords(7)).toBe("abiriyo");
        expect(numberToWords(10)).toBe("apar");
        expect(numberToWords(11)).toBe("apar gachiel"); // gi + achiel → gachiel (elided)
        expect(numberToWords(20)).toBe("piero ariyo"); // the multiplier FOLLOWS piero
        expect(numberToWords(21)).toBe("piero ariyo gachiel");
        expect(numberToWords(42)).toBe("piero ang'wen gariyo");
        expect(numberToWords(99)).toBe("piero ochiko gochiko");
    });

    test("numbers: mia hundreds, elfu thousands, milion/bilion (gi stays free before a consonant)", () => {
        expect(numberToWords(100)).toBe("mia achiel");
        expect(numberToWords(101)).toBe("mia achiel gachiel");
        expect(numberToWords(555)).toBe("mia abich gi piero abich gabich"); // gi + piero → free gi
        expect(numberToWords(1000)).toBe("elfu achiel");
        expect(numberToWords(12345)).toBe("elfu apar gariyo gi mia adek gi piero ang'wen gabich");
        expect(numberToWords(1_000_000)).toBe("milion achiel");
        expect(numberToWords(1_000_000_000)).toBe("bilion achiel");
    });

    test("numbers: end-to-end through the g2p (text path)", () => {
        expect(createLuo().text("20")).toBe("pjeɾo aɾijo"); // the ⟨i⟩+V glide applies inside the numerals too
        expect(createLuo().text("4")).toBe("aŋwen"); // ⟨ng'⟩ → ŋ
    });
});

// ⚠ EVERY ASSERTION BELOW ENCODES A MEASUREMENT over the luo_ke FLEURS transcripts — 2,742 rows → 1,660
// UNIQUE cased utterances (column 3), counted by hand because Luo has NO mined artifact and `mine.ts scan`
// cannot run for it. The evidence and the refusals are argued in src/languages/luo/normalize.ts and
// registered in ACCEPTED_SIGN_SILENCE; docs/investigations/luo/luo_normalization_investigation.md is the log.
// Several tests here PIN A REFUSAL, and those are worth as much as the rewrites: a class with no sourceable
// word must keep reading exactly as it did rather than gain a confidently wrong one.
describe("Luo text normalization", () => {
    const luo = createLuo();

    test("the grouping comma is a SENTENCE BREAK — ×35, and the largest defect in the corpus", () => {
        // `¥2,500` read *ariyo , mia abich* ("two , five hundred") and `¥130,000` as
        // *mia achiel gi piero adek , NONO* — a hundred thirty, then ZERO. The comma groups every time it
        // sits between digits here (three digits, ×35); nothing in this corpus uses it as a decimal.
        expect(normalizeLuo("nengo mar kind ¥2,500 kod ¥130,000")).toBe("nengo mar kind ¥2500 kod ¥130000");
        expect(normalizeLuo("welo maromo 5,000,000 edwe")).toBe("welo maromo 5000000 edwe"); // deepest: two joins
        expect(luo.text("1,600")).toBe("elfu at͡ʃjel ɡi mja aut͡ʃjel"); // 1600, one number, no interior pause
    });

    test("trap 58 — the clause-final figure must still de-group AND still decimate", () => {
        // `manyalo ting'o pipni 55,000. (galons tara 23)` is clause-final; a `(?![\d.,])` trailing guard
        // declines it and loses the whole grouping. And `mwandu ma dirom dola bilion $2.3.` is the same
        // trap on the DECIMAL rule — the first draft's "exactly one dot" guard read it back as
        // *dola bilion ariyo . adek .*, the sentence period defeating the rule that exists to stop the
        // false break mid-number.
        expect(normalizeLuo("pipni 55,000.")).toBe("pipni 55000.");
        expect(normalizeLuo("dola bilion $2.3.")).toBe("dola bilion 2 nukta 3.");
    });

    test("the DECIMAL DOT reads `nukta`, sourced from the corpus glossing its own notation", () => {
        // `nukta` ×1 and the instance IS the gloss (trap 45's shape): "chiegni kilomita squeya tara ariyo
        // NUKTA ariyo ei nam" — about 2.2 million square kilometres. There is no second reading of
        // *tara ariyo nukta ariyo*. The fractional digits are SPACED so the number path speaks them one at
        // a time: `3.50` must be *adek nukta abich nono*, never "fifty".
        expect(normalizeLuo("kilomita 12.8 kata mail 8")).toBe("kilomita 12 nukta 8 kata mail 8");
        expect(normalizeLuo("lach mar mita 3.50 moro ka moro")).toBe("lach mar mita 3 nukta 5 0 moro ka moro");
        expect(normalizeLuo("inji 6.34 e rapim")).toBe("inji 6 nukta 3 4 e rapim");
    });

    test("the DOT ALSO CLOCKS, and the writer's own `saa` / `UTC` is the discriminator", () => {
        // `e saa 12.00 GMT kawuono`, `kar saa 11.00 saa ma aluora no (UTC+1)` and `(15.00 UTC)` are times
        // of day written with a dot — three of them. ⚠ `riembo mar saa 1.5 kowuok Vancouver` is a decimal
        // number of HOURS after the same noun, and the two-digit fraction is what separates them.
        expect(normalizeLuo("ne ochiwo ripot mare e saa 12.00 GMT")).toBe("ne ochiwo ripot mare e saa 12 00 GMT");
        expect(normalizeLuo("seche mag pinyno (15.00 UTC)")).toBe("seche mag pinyno (15 00 UTC)");
        expect(normalizeLuo("Whistler (riembo mar saa 1.5 kowuok")).toBe("Whistler (riembo mar saa 1 nukta 5 kowuok");
    });

    test("the COLON is a clock ELEVEN times of fourteen, and `saa` is already written", () => {
        // Every clock in this corpus is introduced by the writer's own `saa` ("hour"), so the colon is
        // SPENT and no hour word is emitted. ⚠ And no six-hour conversion is attempted: Dholuo has a
        // traditional offset clock and nothing in the corpus says whether the reader converted.
        expect(normalizeLuo("kar saa 11:35 otieno.")).toBe("kar saa 11 35 otieno.");
        expect(normalizeLuo("e kar saa 9:30 okinyi")).toBe("e kar saa 9 30 okinyi");
        // …and the clock RANGE, claimed whole, above both the generic range rule and the clock rule.
        expect(normalizeLuo("E kind seche mag 10:00-11:00 otieno")).toBe("E kind seche mag 10 00 nyaka 11 00 otieno");
    });

    test("REFUSED: `2:2` is a lower-second-class DEGREE, and the sports times are not clocks", () => {
        // ⚠ THE ONE `digri` IN THE CORPUS IS THE ACADEMIC DEGREE — "moyudo 2:2 (digri man piny, clas mar
        // ariyo)" — which is the ki `digirii` trap again, and it is what refuses the TEMPERATURE word
        // below. The three non-clocks are declined for three independent reasons: `2:2` fails `[0-5]\d`,
        // and both sports times fail the trailing guard on their `.`, at every position the engine retries
        // from (trap 52).
        expect(normalizeLuo("moyudo 2:2 (digri man piny")).toBe("moyudo 2:2 (digri man piny");
        expect(normalizeLuo("gi dakika 1:09.02 mos")).toBe("gi dakika 1:09 nukta 0 2 mos"); // colon untouched
    });

    test("RANGES take `nyaka`, the corpus's own joiner — and it reads SCORES too", () => {
        // ×17 hyphen-flanked figures, and the engine fused both endpoints with no boundary at all.
        // `nyaka` is attested ×6 between numerals in BOTH directions, which is why the fleet's usual
        // ascending-only test is wrong here: "okang' achiel mar locho, 21 nyaka 20" is a descending SCORE.
        expect(normalizeLuo("jolweny dhod Qing (1644-1912) nokaw")).toBe("jolweny dhod Qing (1644 nyaka 1912) nokaw");
        expect(normalizeLuo("mar 5-3 mane giloyo")).toBe("mar 5 nyaka 3 mane giloyo"); // a score, descending
        expect(normalizeLuo("loch mayom mar 26-00 e kindgi")).toBe("loch mayom mar 26 nyaka 00 e kindgi");
        expect(normalizeLuo("higni tara 4.2-3.9 mokalo")).toBe("higni tara 4 nukta 2 nyaka 3 nukta 9 mokalo");
        // …the SEASON is the one shape refused, and the guard is a DIGIT-COUNT test, not an ascending one:
        // a truncated second endpoint is what "1995-96" is, and it is the only one in the corpus.
        expect(normalizeLuo("higa mar 1995-96, ka Jaromir")).toBe("higa mar 1995-96, ka Jaromir");
        // …⚠ AND A LETTER GLUED TO THE SECOND OPERAND IS A DESIGNATION. `ndege mar II-76s` is the Ilyushin
        // Il-76 mistyped with two capital I's; `registry.ts` resolves Roman numerals to digits BEFORE
        // text() runs, so this rule sees `2-76s`. The first draft read it *ariyo NYAKA piero abiriyo
        // gauchiel s* — the one defect this layer INTRODUCED, found only by reading the corpus diff.
        expect(normalizeLuo("ndege mar 2-76s bang' masirano")).toBe("ndege mar 2-76s bang' masirano");
    });

    test("the DOTTED DESIGNATION is spent silently, and a decimal glued to a unit is not one", () => {
        // `802.11a/b/g/n` ×5 read as *mia aboro gariyo . apar gachiel a* — a full stop inside a Wi-Fi
        // standard's name. The discriminator is that the trailing run is ONE LETTER; `22.4Ghz` and
        // `5.0Ghz` have three, so they stay decimals. ⚠ Note the corpus spells the gigahertz `Ghz` with a
        // LOWERCASE h — a rule keyed on the SI `GHz` would match neither instance.
        expect(normalizeLuo("kodok chien gi 802.11a, 802.11b")).toBe("kodok chien gi 802 11a, 802 11b");
        expect(normalizeLuo("duto mag 22.4Ghz to kod 5.0Ghz.")).toBe("duto mag 22 nukta 4Ghz to kod 5 nukta 0Ghz.");
    });

    test("CURRENCY: the noun already precedes, so the sign is claimed only where it does not", () => {
        // ⚠ Dholuo writes currency-noun · magnitude · sign · figure — `dola bilion $2.3` — so the shared
        // tier says *dola* TWICE in every configuration (its suppression is adjacency-based and cannot see
        // across `bilion`). Measured one at a time, every `$` in this corpus is a trap-12 permissible drop
        // and exactly one sign needs reading. `paund` is corpus-attested as the currency in
        // "paund achiel mar Britain (GBP)"; ⚠ it is ALSO the WEIGHT ×3, and the `£` is what selects.
        expect(normalizeLuo("mwandu ma dirom dola bilion $2.3")).toBe("mwandu ma dirom dola bilion 2 nukta 3");
        expect(normalizeLuo("maromo dola $1000 kuom keth")).toBe("maromo dola 1000 kuom keth");
        // …and the noun HOPS THE MAGNITUDE, because that is the order the corpus itself writes.
        expect(normalizeLuo("nengo molandi mar tara £27.")).toBe("nengo molandi mar paund tara 27.");
        expect(normalizeLuo("mar $5 kuom keth")).toBe("mar dola 5 kuom keth"); // unglossed: still read
        // ⚠ `AUD$45 milion` is left alone ON PURPOSE (trap 64 in mirror image): the ISO code is present and
        // is itself spoken, which is trap 12's own ISO clause.
        expect(normalizeLuo("mar AUD$45 milion.")).toBe("mar AUD$45 milion.");
    });

    test("REFUSED: percent, degrees and the plus — each priced, none of them made worse", () => {
        // ⚠ NO percent word exists in ANY source Luo has: espeak ships no Luo, luo.wikipedia.org does not
        // exist, and the corpus's 5 `mia` are the numeral 100. The composable candidate `kuom mia achiel`
        // is named in normalize.ts and deliberately not shipped.
        expect(normalizeLuo("oriwo 3% mar pinyno.")).toBe("oriwo 3% mar pinyno.");
        // ⚠ NO degree word either — see the `2:2` test for why `digri` cannot be it. The refusal is WHOLE
        // (trap 53): the sign is left in place rather than consumed, so `+30°C` reads exactly as it did
        // before this layer, `C` and all. Both signs are `°` U+00B0 and the letter is ASCII C — no
        // confusable, checked byte by byte, which is the finding after three rounds that each had one.
        expect(normalizeLuo("moloyo +30°C.")).toBe("moloyo +30°C.");
        expect(normalizeLuo("e yimbo mar 35° Ugwe.")).toBe("e yimbo mar 35° Ugwe."); // Ugwe is WEST
        // …and the plus is trap 48 twice over: redundant after the comparative `moloyo`, and unattested in
        // `UTC+1`, which is the one contentful plus.
        expect(normalizeLuo("no (UTC+1) e Whitehall")).toBe("no (UTC+1) e Whitehall");
    });

    test("the SPACED DASH is a clause break — 19 pauses that vanished, and one name that must not gain one", () => {
        // Dropped entirely before this layer. ⚠ It must NOT require a non-digit on both sides (the fleet's
        // usual shape): "kuonde 26 - mang'eny moloyo" is a clause dash after a NUMBER. ⚠ And it requires
        // SPACES on both sides, which is what protects the corpus's one en dash — a NAME JOINER in
        // "Aora mokuny mar White Sea–Baltic Canal".
        expect(normalizeLuo("mopuodhi - kata mana Armenia - mane")).toBe("mopuodhi, kata mana Armenia, mane");
        expect(normalizeLuo("nochakore chon — pichni mag")).toBe("nochakore chon, pichni mag");
        expect(normalizeLuo("kuonde 26 - mang'eny moloyo")).toBe("kuonde 26, mang'eny moloyo");
        expect(normalizeLuo("mar White Sea–Baltic Canal")).toBe("mar White Sea–Baltic Canal");
        // …and step 5 has already claimed the one SPACED range, so it does not become a pause instead.
        expect(normalizeLuo("loch mar Ruoth Sejon (1418 - 1450).")).toBe("loch mar Ruoth Sejon (1418 nyaka 1450).");
    });

    test("nothing bites a Dholuo word — the ⟨ng'⟩ apostrophe is a LETTER, in all three encodings", () => {
        // ⚠ NEVER `\b` (trap 1/23): the word-continuation class has to carry ASCII `'`, U+2019 and U+02BC,
        // exactly as Hawaiian's ʻokina does, or a guard treats `ng'wech` / `maduong'` as two words.
        const plain = "Ng'wech mar chieng' kod maduong’ gi ngʼato";
        expect(normalizeLuo(plain)).toBe(plain);
        expect(normalizeLuo("Kwom aoche matindo maromo gana.")).toBe("Kwom aoche matindo maromo gana.");
    });

    test("end-to-end: the clause pause survives, and the number is one number", () => {
        // The whole point of the layer, read through the real phonemizer: a grouped figure at a sentence
        // end keeps its full stop and gains no interior break, and a clock is not cut in half.
        expect(luo.text("pipni 55,000.")).toBe("pipni elfu pjeɾo abit͡ʃ ɡabit͡ʃ .");
        expect(luo.text("kar saa 11:35 otieno.")).toBe("kaɾ saa apaɾ ɡat͡ʃjel pjeɾo adek ɡabit͡ʃ otjeno .");
    });
});
