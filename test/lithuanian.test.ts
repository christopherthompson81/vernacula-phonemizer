import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

import { phonemizeWord, createLithuanian } from "../src/languages/lithuanian/lithuanian.ts";
import {
    normalizeLithuanian,
    normalizeLithuanianInitialisms,
} from "../src/languages/lithuanian/normalize.ts";

// Canonical-IPA goldens for Lithuanian / lietuvių (lt) — Baltic (Indo-European), Latin script, ~3M. A RULE-based g2p
// (g2p.ts): a left-to-right scan + the hard/soft PALATALIZATION contrast (Cʲ before front vowels / the softening ⟨i⟩,
// spreading leftward through clusters) + regressive VOICING assimilation + n→ŋ before velars. Referee: wikipron
// lit_latn_narrow (HUMAN, 15,513 words) — the folds strip the lexical PITCH
// accents (¹/²), stress-conditioned length (ː) + vowel quality (ɑ→ɐ, æ→ɛ), and narrow allophony (dark ɫ, v~ʋ, the
// glide j~ɪ̯). Several golds are referee-verified (exact after folds). Stress is lexical → not marked.
describe("Lithuanian canonical IPA — rule g2p (palatalization + voicing)", () => {
    test("PALATALIZATION: consonants → Cʲ before a front vowel ⟨e ę ė i į y⟩", () => {
        expect(phonemizeWord("katinas")).toBe("kɐtʲɪnɐs"); // ⟨t⟩ soft before ⟨i⟩; ⟨k n⟩ hard before ⟨a⟩ (referee-verified)
        expect(phonemizeWord("penki")).toBe("pʲɛŋʲkʲɪ"); // ⟨p⟩ soft before ⟨e⟩, ⟨k⟩ soft before ⟨i⟩, ⟨n⟩→ŋʲ (verified)
        expect(phonemizeWord("šeši")).toBe("ʃʲɛʃʲɪ"); // ⟨š⟩ soft before front vowels — uniform ʲ notation
        expect(phonemizeWord("medis")).toBe("mʲɛdʲɪs"); // "tree" — mʲ, dʲ
    });

    test("VELARS ⟨k ɡ⟩ do NOT receive leftward palatalization spread (soften only DIRECTLY before a front vowel)", () => {
        expect(phonemizeWord("knyga")).toBe("knʲiːɡɐ"); // "book" — ⟨k⟩ HARD before soft ⟨nʲ⟩; ⟨n⟩ soft before ⟨y⟩=iː
        expect(phonemizeWord("naktis")).toBe("nɐktʲɪs"); // ⟨k⟩ HARD before soft ⟨tʲ⟩ (referee-verified)
    });

    test("the softening ⟨i⟩ (⟨Cia Ciu⟩): silent, palatalizes the preceding consonant; ⟨a⟩ then fronts to ɛ", () => {
        expect(phonemizeWord("čia")).toBe("t͡ʃʲɛ"); // "here" — ⟨i⟩ silent, ⟨č⟩ soft, ⟨a⟩→ɛ after the soft consonant
        expect(phonemizeWord("ačiū")).toBe("ɐt͡ʃʲuː"); // "thanks" — ⟨i⟩ silent softener before back ⟨ū⟩
    });

    test("rising diphthongs ⟨ie⟩=iɛ / ⟨uo⟩=uɔ (⟨ie⟩ palatalizes the preceding consonant)", () => {
        expect(phonemizeWord("Dievas")).toBe("dʲiɛʋɐs"); // "God" — ⟨d⟩ soft before ⟨ie⟩ (referee-verified)
        expect(phonemizeWord("lietuva")).toBe("lʲiɛtʊʋɐ"); // "Lithuania" — ⟨l⟩ soft before ⟨ie⟩ (referee-verified)
        expect(phonemizeWord("aštuoni")).toBe("ɐʃtuɔnʲɪ"); // "eight" — ⟨uo⟩=uɔ
    });

    test("regressive VOICING assimilation in obstruent clusters + non-palatalizing back context", () => {
        expect(phonemizeWord("dirbti")).toBe("dʲɪrʲpʲtʲɪ"); // ⟨b⟩→[p] before voiceless ⟨t⟩ (keeps softness: bʲ→pʲ)
        expect(phonemizeWord("žmogus")).toBe("ʒmoːɡʊs"); // "man" — hard before back vowels; ⟨o⟩=oː
        expect(phonemizeWord("kalba")).toBe("kɐlbɐ"); // "language" — all hard (referee-verified)
    });

    test("clause assembly: words + punctuation", () => {
        expect(createLithuanian().text("Labas, Lietuva!").trim()).toBe("lɐbɐs , lʲiɛtʊʋɐ !");
    });

    // Cardinal numbers (numbers.ts + the lithuanian.jsonc table). Lithuanian has NO round-hundred words — the
    // hundred is a counted noun (šimtas / du šimtai) — and every magnitude noun takes the Baltic three-way concord:
    // …1 (not 11) → nom sg, …2–9 (not 12–19) → nom pl, …0 / 11–19 → gen pl.
    test("cardinal numbers: -lika teens + the three-way counted-noun concord", () => {
        const lt = createLithuanian();
        expect(lt.text("7").trim()).toBe("sʲɛpʲtʲiːnʲɪ"); // septyni
        expect(lt.text("15").trim()).toBe("pʲɛŋʲkʲoːlʲɪkɐ"); // penkiolika (the -lika teen, one word)
        expect(lt.text("21").trim()).toBe("dʲʋʲɪdʲɛʃʲɪmt ʋʲiɛnɐs"); // dvidešimt vienas
        expect(lt.text("101").trim()).toBe("ʃʲɪmtɐs ʋʲiɛnɐs"); // šimtas vienas
        expect(lt.text("555").trim()).toBe("pʲɛŋʲkʲɪ ʃʲɪmtɐɪ pʲɛŋʲkʲɛzʲdʲɛʃʲɪmt pʲɛŋʲkʲɪ"); // penki šimtai penkiasdešimt penki
        expect(lt.text("1000").trim()).toBe("tuːkstɐnʲtʲɪs"); // tūkstantis — the numeral "vienas" is dropped
        expect(lt.text("2000").trim()).toBe("dʊ tuːkstɐnʲt͡ʃʲɛɪ"); // du tūkstančiai → NOM PL
        expect(lt.text("10000").trim()).toBe("dʲɛʃʲɪmt tuːkstɐnʲt͡ʃʲuː"); // dešimt tūkstančių → …0 ⇒ GEN PL
        expect(lt.text("21000").trim()).toBe("dʲʋʲɪdʲɛʃʲɪmt ʋʲiɛnɐs tuːkstɐnʲtʲɪs"); // …1 ⇒ NOM SG tūkstantis
        expect(lt.text("100000").trim()).toBe("ʃʲɪmtɐs tuːkstɐnʲt͡ʃʲuː"); // šimtas tūkstančių
        expect(lt.text("12345").trim()).toBe(
            "dʲʋʲiːlʲɪkɐ tuːkstɐnʲt͡ʃʲuː tʲrʲiːs ʃʲɪmtɐɪ kʲɛtʊrʲɛzʲdʲɛʃʲɪmt pʲɛŋʲkʲɪ",
        ); // dvylika tūkstančių (12 ⇒ GEN PL) trys šimtai keturiasdešimt penki
        expect(lt.text("1000000").trim()).toBe("ʋʲiɛnɐs mʲɪlʲɪjoːnɐs"); // vienas milijonas (keeps the numeral)
        expect(lt.text("1000000000").trim()).toBe("ʋʲiɛnɐs mʲɪlʲɪjɛrdɐs"); // vienas milijardas
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (src/languages/lithuanian/normalize.ts)
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). Almost every rule in
// that layer is a table-plus-composition shape — `agree()` has THREE arms and the corpus exercises them
// very unevenly — so each arm gets a case, and where the corpus does not contain one the case is chosen
// anyway. Assertions are on the TEXT the normalizer produces (the layer is pure text→text); the two that
// must go through the real phonemizer say why.
describe("Lithuanian text normalization — concord, the year/metre split, and the ordered steps", () => {
    // THE THREE-WAY CONCORD, which is the reason this language cannot use core/normalizeSymbols.ts: the
    // shared tier holds one invariant string per unit and none of these three is it (trap 14). The corpus
    // writes mostly round tens, so the sg and pl arms below are largely NOT corpus instances.
    test("counted-noun concord: …1 → nom sg, …2–9 → nom pl, …0 / 11–19 → gen pl", () => {
        expect(normalizeLithuanian("1 %")).toBe("vienas procentas"); // …1 ⇒ nom SG
        expect(normalizeLithuanian("2 %")).toBe("du procentai"); // …2–9 ⇒ nom PL
        expect(normalizeLithuanian("10 %")).toBe("dešimt procentų"); // …0 ⇒ GEN PL
        expect(normalizeLithuanian("11 %")).toBe("vienuolika procentų"); // the TEEN exception ⇒ GEN PL
        expect(normalizeLithuanian("21 %")).toBe("dvidešimt vienas procentas"); // …1 again, past the teens
        expect(normalizeLithuanian("101 %")).toBe("šimtas vienas procentas"); // past the hundred boundary
        // The same three arms on a unit and on the degree, because each rule calls agree() itself.
        expect(normalizeLithuanian("1 km")).toBe("vienas kilometras");
        expect(normalizeLithuanian("2 km")).toBe("du kilometrai");
        expect(normalizeLithuanian("100 km")).toBe("šimtas kilometrų");
        expect(normalizeLithuanian("1 °C")).toBe("vienas laipsnis Celsijaus");
        expect(normalizeLithuanian("17 °C")).toBe("septyniolika laipsnių Celsijaus");
    });

    // The SQUARED modifier agrees with the noun it precedes, so it has the same three arms — and the
    // corpus contains only the genitive one (`kvadratinių kilometrų`, every area figure it writes).
    test("the squared modifier agrees with its head noun, and the ASCII `km2` is claimed too", () => {
        expect(normalizeLithuanian("1 km²")).toBe("vienas kvadratinis kilometras");
        expect(normalizeLithuanian("2 km²")).toBe("du kvadratiniai kilometrai");
        expect(normalizeLithuanian("100 km²")).toBe("šimtas kvadratinių kilometrų");
        // ⚠ `km2` must not leave the `2` behind as a NUMBER — trap 53's Igbo defect ("790 kilometres two"),
        // which no leak class can see because an ASCII digit in the reading looks like a quantity.
        expect(normalizeLithuanian("1 267 000 km2"))
            .toBe("vienas milijonas du šimtai šešiasdešimt septyni tūkstančiai kvadratinių kilometrų");
    });

    // GENDER. numberToWords emits the MASCULINE 1–9 (correct for a bare numeral, which has nothing to
    // agree with); a feminine counted noun needs the other set, on the final unit word only.
    test("a FEMININE counted noun takes the feminine numeral", () => {
        expect(normalizeLithuanian("4 val.")).toBe("keturios valandos"); // not *keturi valandos
        expect(normalizeLithuanian("21 val.")).toBe("dvidešimt viena valanda"); // the swap is on the LAST word
        expect(normalizeLithuanian("15 val.")).toBe("penkiolika valandų"); // a teen is gender-invariant
    });

    // ⚠ THE MEASUREMENT THIS LAYER TURNS ON. `m.` with a dot is the YEAR (×347 in the retained text);
    // bare `m` is the METRE (×18). Both branches, plus the shape that would break if the dot guard were
    // dropped from the one-letter key (trap 46).
    test("`m.` is the YEAR and bare `m` is the METRE — the dot is the whole discriminator", () => {
        expect(normalizeLithuanian("1802 m.").trim()).toBe("tūkstantis aštuoni šimtai du metais");
        expect(normalizeLithuanian("8850 m aukštis"))
            .toBe("aštuoni tūkstančiai aštuoni šimtai penkiasdešimt metrų aukštis");
        // A capital `M.` is a PERSONAL INITIAL in this corpus (all 6), never a year — so the rule is
        // deliberately case-SENSITIVE, which inverts trap 7's usual demand. It must stay untouched here.
        expect(normalizeLithuanian("2000 M.")).toBe("2000 M.");
    });

    // The date frame, tabulated from the corpus's own spelled-out text ("1936 METŲ liepos 24 DIENĄ").
    test("the year's case is chosen by the frame: month → genitive, bare year → instrumental", () => {
        expect(normalizeLithuanian("1930 m. balandžio 25 d.").trim())
            // …and the DAY numeral is feminine, because *diena* is — see the gender test below.
            .toBe("tūkstantis devyni šimtai trisdešimt metų balandžio dvidešimt penkios dieną");
        expect(normalizeLithuanian("1997 m. jis").trim())
            .toBe("tūkstantis devyni šimtai devyniasdešimt septyni metais jis");
        // A SMALL or decimal operand is a QUANTITY of years, not a date — "Šveicarijoje – 83,4 m." is a
        // life expectancy. That arm takes the genitive too.
        expect(normalizeLithuanian("83,4 m.").trim()).toBe("aštuoniasdešimt trys kablelis keturi metų");
        expect(normalizeLithuanian("13 m. sūnų").trim()).toBe("trylika metų sūnų");
    });

    // ORDERING. The era phrase contains the very letter the year rule claims — in `pr. m. e.` the `m.` is
    // *mūsų*, not *metai* — so it must be consumed first. This is the one ordering constraint in the file
    // that produces a wrong WORD rather than a wrong pause.
    test("the era phrase is claimed BEFORE the year abbreviation", () => {
        expect(normalizeLithuanian("1200 m. pr. m. e.").trim())
            .toBe("tūkstantis du šimtai metais prieš mūsų erą");
        expect(normalizeLithuanian("nuo maždaug m. e. pradžios")).toBe("nuo maždaug mūsų eros pradžios");
    });

    // ⚠ THROUGH THE REAL PHONEMIZER, because what is being pinned is an ordering that is not in this
    // language's files at all: lt is not in registry.ts's ROMAN_NATIVE, so `normalizeRomans` wraps
    // `text()` and a Roman numeral is DIGITS before either lt pass runs. The operand is `XV`, whose
    // letters would be spelled out by the initialism pass if the order were wrong (trap 16).
    test("Roman numerals are resolved above this layer, so the initialism pass never sees them", () => {
        // ⚠ IT MUST BE `phonemize`, NOT `createLithuanian().text()`, AND THAT IS THE POINT OF THE TEST.
        // `normalizeRomans` wraps `text()` from registry.ts, so it is NOT reached through the engine
        // object — asserted the other way this test fails with `ɪks ʋʲeː`, the initialism pass spelling
        // XV out, which is precisely the defect trap 16 says to pin end-to-end rather than in the layer.
        expect(phonemize("XV", "lt").trim()).toBe(phonemizeWord("penkiolika"));
        expect(phonemize("Louis XIV", "lt").trim())
            .toBe(`${phonemizeWord("Louis")} ${phonemizeWord("keturiolika")}`);
        // …and the century abbreviation therefore keys on digits, not on the Roman form.
        expect(phonemize("XIX a.", "lt").trim())
            .toBe(`${phonemizeWord("devyniolika")} ${phonemizeWord("amžiaus")}`);
    });

    // De-grouping runs above everything that reads a number. Without it the trailing `000` becomes the
    // WORD *nulis* — a silent 1000× error of trap 56's tg class, not a visible leak.
    test("the SPACE thousands separator is removed, iteratively", () => {
        expect(normalizeLithuanian("64 000 Lt").trim()).toBe("šešiasdešimt keturi tūkstančiai litų");
        expect(normalizeLithuanian("5 230 330 gyventojų"))
            .toBe("5230330 gyventojų"); // three groups, one pass each; the tokenizer reads the digits
        // ⚠ A GROUP MAY BE FOLLOWED BY A DECIMAL COMMA. `18 550,72 €` is one figure, and a right guard
        // that rejected a following comma split it into "18" and "550,72".
        expect(normalizeLithuanian("18 550,72 €").trim())
            .toBe("aštuoniolika tūkstančių penki šimtai penkiasdešimt kablelis septyni du eurų");
    });

    // The range joiner is a PREPOSITION in a correlative frame, not an infix — all six numeral-flanked
    // `iki` in the retained text have `nuo` in front of them, so the rule emits both halves.
    test("ranges emit the `nuo … iki …` correlative, and never double an existing preposition", () => {
        expect(normalizeLithuanian("1890–1906")).toBe("nuo 1890 iki 1906");
        expect(normalizeLithuanian("nuo 467 000 iki 114 000")).toBe("nuo 467000 iki 114000"); // no second `nuo`
        expect(normalizeLithuanian("NUO 5-10 km")).toBe("NUO 5 iki dešimt kilometrų"); // case-insensitive guard
        // Any preposition, not only `nuo` — `prieš 50–65 tūkst. metų` is "50–65 thousand years ago" and
        // already has its preposition; stacking one gave *prieš NUO 50 iki 65*.
        expect(normalizeLithuanian("prieš 50 –65 tūkst. metų").trim())
            .toBe("prieš 50 iki šešiasdešimt penki tūkstančių metų");
        // A TEMPORAL span takes the joiner alone: "nuo 1997 iki 1998 metais" would put a genitive-governing
        // preposition in front of an instrumental.
        expect(normalizeLithuanian("1997–1998 metais")).toBe("1997 iki 1998 metais");
    });

    // Signs. Omitting a plus is lossless; omitting a MINUS inverts, and this corpus has both.
    test("a sign is read only when it OPENS the token, so a range is never claimed as a negative", () => {
        expect(normalizeLithuanian("-5 °C")).toBe("minus penki laipsniai Celsijaus");
        expect(normalizeLithuanian("(-1,1 %)")).toBe("(minus vienas kablelis vienas procentų)");
        expect(normalizeLithuanian("iki +40 °C")).toBe("iki plius keturiasdešimt laipsnių Celsijaus");
        expect(normalizeLithuanian("15-16 °C")).toBe("nuo 15 iki šešiolika laipsnių Celsijaus"); // a RANGE
        expect(normalizeLithuanian("Kaunas-Vilnius")).toBe("Kaunas-Vilnius"); // a compound hyphen
        expect(normalizeLithuanian("MiG-29")).toBe("MiG-29"); // a designation
    });

    // Currency. POSTPOSED, and it must claim whatever stands between the figure and the noun.
    test("currency is postposed and claims an intervening magnitude, abbreviated or spelled", () => {
        expect(normalizeLithuanian("5713 $").trim()).toBe("penki tūkstančiai septyni šimtai trylika dolerių");
        expect(normalizeLithuanian("€151 mln.").trim()).toBe("šimtas penkiasdešimt vienas milijonas eurų");
        // A SPELLED magnitude is re-emitted verbatim and the currency follows it (trap 10). Without this
        // the noun wedged between the count and its magnitude: *dvidešimt keturi DOLERIAI milijonus*.
        expect(normalizeLithuanian("$24 milijonus kasmet")).toBe("dvidešimt keturi milijonus dolerių kasmet");
        // ⚠ A CLAUSE-FINAL FIGURE MUST STILL BE CLAIMED. A right guard that treated any following comma as
        // a decimal declined this outright and left the sign unread.
        expect(normalizeLithuanian("$4000, nugalėtojui")).toBe("keturi tūkstančiai dolerių , nugalėtojui");
        // DON'T SAY IT TWICE (trap 12) — word-bounded and case-insensitive, so `eur` cannot match inside
        // *Europos* and a sentence-initial capital cannot escape the guard and double the reading.
        expect(normalizeLithuanian("$90 milijonų dolerių")).toBe("devyniasdešimt milijonų dolerių");
        expect(normalizeLithuanian("Europos €500").trim()).toBe("Europos penki šimtai eurų");
    });

    // A magnitude between the figure and its unit — the "one declaration, two consumers" case. The
    // magnitude step words-ifies the figure and destroys the adjacency the unit step matches on, so the
    // unit step has to claim both or the unit is orphaned into the phoneme stream raw.
    test("a magnitude standing between the figure and its unit is claimed by the unit step", () => {
        expect(normalizeLithuanian("65,3 tūkst. km²"))
            .toBe("šešiasdešimt penki kablelis trys tūkstančių kvadratinių kilometrų");
        expect(normalizeLithuanian("3 mln. km²")).toBe("trys milijonai kvadratinių kilometrų");
        // A magnitude GOVERNING a following noun takes the genitive — including when that noun is an
        // acronym, which a lowercase-only test missed.
        expect(normalizeLithuanian("19 tūkst. hektarų")).toBe("devyniolika tūkstančių hektarų");
        expect(normalizeLithuanian("20 tūkst.").trim()).toBe("dvidešimt tūkstančių");
    });

    // GUARDS THAT MUST REJECT. Each of these is a shape the rule would damage, and each was probed rather
    // than assumed — trap 8: zero corpus instances is not evidence of correctness, and trap 52: a
    // lookbehind rejects a POSITION, so the operand is anchored on BOTH edges.
    test("designations, versions and rates are refused WHOLE, never half", () => {
        expect(normalizeLithuanian("802.11m")).toBe("802.11m"); // not "802.11 metres"
        expect(normalizeLithuanian("802.11g")).toBe("802.11g");
        expect(normalizeLithuanian("12.5km")).toBe("12.5km");
        expect(normalizeLithuanian("44.111.333.12")).toBe("44.111.333.12");
        // ⚠ A RATE IS REFUSED WHOLE. Without the trailing-slash guard `500 m/s` read as *penki šimtai
        // METRŲ/s* — the numerator claimed, the denominator raw, which is worse than two raw letters.
        expect(normalizeLithuanian("500 m/s")).toBe("500 m/s");
        expect(normalizeLithuanian("140–160 kcal/cm²")).toBe("nuo 140 iki 160 kcal/cm²"); // `kcal` unnamable
        // …but a CLAUSE-FINAL unit is not a designation and must still read. A right guard carrying the
        // dot bought nothing here and declined every sentence-final figure.
        expect(normalizeLithuanian("neviršija 600 km.")).toBe("neviršija šeši šimtai kilometrų.");
    });

    // The classes this layer deliberately declines. Pinned as INVARIANTS about the language rather than as
    // "not done yet", which would be an assertion about the schedule and has a shelf life (trap 5).
    test("a colon time, a fraction, an equals gloss and a bare degree are left alone", () => {
        expect(normalizeLithuanian("2:15:16")).toBe("2:15:16"); // every N:NN here is a duration or a timestamp
        expect(normalizeLithuanian("2/3 visų")).toBe("2/3 visų"); // needs the ordinal series, not sourced
        expect(normalizeLithuanian("γράφω = graphō")).toBe("γράφω = graphō"); // `=` means "means" in a gloss
        // A bare `°` is a COORDINATE here; reading it while `′` stayed silent would fuse the two numbers.
        expect(normalizeLithuanian("54° 54′ šiaurės platumos")).toBe("54° 54′ šiaurės platumos");
    });

    // The initialism seam. `letterName` is derived from espeak's letter block and validated by
    // round-tripping through this engine's own g2p; the OOV arm spells only what cannot be syllabified.
    test("initialisms: unreadable runs are spelled, pronounceable ones are left to the OOV g2p", () => {
        expect(normalizeLithuanianInitialisms("TSRS")).toBe("tė es er es"); // no vowel at all
        expect(normalizeLithuanianInitialisms("BVP")).toBe("bė vė pė");
        expect(normalizeLithuanianInitialisms("IBM")).toBe("i bė em"); // has a vowel, illegal coda
        expect(normalizeLithuanianInitialisms("JAV")).toBe("jot a vė"); // readable, but LEXICALLY spelled
        expect(normalizeLithuanianInitialisms("DOS")).toBe("DOS"); // readable and read as a word
        expect(normalizeLithuanianInitialisms("G. R. Treviranas")).toBe("gė er Treviranas"); // personal initials
        // An all-caps DOCUMENT carries no signal and must not be spelled out letter by letter.
        expect(normalizeLithuanianInitialisms("VILNIUS YRA DIDELIS")).toBe("VILNIUS YRA DIDELIS");
    });

    // The ampersand was DROPPED outright, which fused its neighbours into one token (traps 18/26).
    test("the ampersand is spaced on both sides so its neighbours cannot fuse", () => {
        expect(normalizeLithuanian("Stafecka, A. & Mikuleniene, D.")).toBe("Stafecka, A. ir Mikuleniene, D.");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE REPAIR PASS. Each test below pins a BRANCH that a review found wrong or unenforced (trap 13): the
// shape that was misread AND, where the two are one rule, the shape that must keep reading. Several pin a
// RESIDUAL — a reading this layer knowingly gets wrong — because an unpinned known defect is indistinguishable
// from a regression the next reader introduces.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("Lithuanian normalization — the refusals, the anchors, and the two residuals", () => {
    // ⚠ THE HEADLINE CLAIM, WITH ITS EXCEPTIONS PINNED. `m.`=year is right 346/347 and bare `m`=metre is
    // right 17/18; the corpus contains one counter-example each way and NEITHER is separable from the
    // string. Both are pinned as they read, not as they ought to read, so the exposure stays visible.
    test("the `m.`/`m` split carries one residual in each direction, and both are pinned", () => {
        expect(normalizeLithuanian("aukštis 174 m. Liūčių").trim())
            .toBe("aukštis šimtas septyniasdešimt keturi metais Liūčių"); // RESIDUAL: a METRE read as a year
        expect(normalizeLithuanian("2003 m, atitinkamai").trim())
            .toBe("du tūkstančiai trys metrai, atitinkamai"); // RESIDUAL: a YEAR read as metres
        // Adding `,` to the metre rule's right guard would fix the second and break these two, which is why
        // it is not added: two genuine metres for one year is the wrong trade.
        expect(normalizeLithuanian("(8850 m, Himalajuose)").trim())
            .toBe("(aštuoni tūkstančiai aštuoni šimtai penkiasdešimt metrų, Himalajuose)");
    });

    // The "NO CLOCK" refusal is enforced by the OPERAND ANCHORS, not by a comment. Before, two other rules
    // claimed clock fields: the hour rule read a MINUTE as hours and the range rule spanned two clock times.
    test("a colon is rejected on both operand edges, so no rule reads a clock field", () => {
        expect(normalizeLithuanian("(19:11 val. UTC)").trim()).toBe("(19:11 valandų UTC)"); // not *19:vienuolika*
        expect(normalizeLithuanian("8:00 - 19:00 val.").trim()).toBe("8:00 - 19:00 valandų"); // no `nuo … iki`
        expect(normalizeLithuanian("2:15:16")).toBe("2:15:16");
        // …but refusing the numeral is not a reason to hand `val.` back to the g2p as a cluster + a break.
        expect(normalizeLithuanian("apie 19:11 val.").trim()).toBe("apie 19:11 valandų");
        // A RATE still blocks it, or the denominator would be read while the numerator stays raw.
        expect(normalizeLithuanian("515,3 km/val.")).toBe("515 kablelis 3 km/val."); // the unit stays raw
    });

    // A separator belongs to the number only when a DIGIT follows it. The comma had been fixed this way and
    // the dot had not, so every CLAUSE-FINAL figure was declined and its symbol went silent.
    test("a clause-final dot does not decline the figure, but a version dot still does", () => {
        expect(normalizeLithuanian("už $800.").trim()).toBe("už aštuoni šimtai dolerių ."); // the dollar SOUNDS
        expect(normalizeLithuanian("net 25 %.").trim()).toBe("net dvidešimt penki procentai.");
        expect(normalizeLithuanian("802.11m")).toBe("802.11m"); // a digit follows the dot ⇒ still declined
        expect(normalizeLithuanian("12,367.7 km²")).toBe("12,367.7 km²");
    });

    // A CATALOGUE NUMBER is a chain of hyphen-joined digit groups. With a hyphen admitted on both edges the
    // range rule asserted a `nuo`/`iki` frame over one, and chained inside it.
    test("a hyphen chain and a letter-glued designation are refused WHOLE by the range rule", () => {
        expect(normalizeLithuanian("ISBN 978-83-01-14342-8")).toBe("ISBN 978-83-01-14342-8");
        expect(normalizeLithuanian("ISBN 84-87863-63-9")).toBe("ISBN 84-87863-63-9");
        expect(normalizeLithuanian("x86-64, PowerPC")).toBe("x86-64, PowerPC");
        expect(normalizeLithuanian("Airbus A300-600ST")).toBe("Airbus A300-600ST");
        // …and the right edge, freed of the dot and the comma, now reads the clause-final spans it declined.
        expect(normalizeLithuanian("Vilnius 1996-2005.")).toBe("Vilnius nuo 1996 iki 2005.");
        expect(normalizeLithuanian("psl. 143–145, 149.").trim()).toBe("puslapis nuo 143 iki 145, 149.");
    });

    // A SCORE IS A PAIR, NOT A SPAN. Three in the retained text, and *nuo vienas iki vienas* is a confident
    // misreading rather than a rough one — so the whole match is refused on the corpus's own score words.
    test("a sports score is refused and read as two juxtaposed cardinals", () => {
        expect(normalizeLithuanian("Rezultatas buvo lygus (1-1)")).toBe("Rezultatas buvo lygus (1-1)");
        expect(normalizeLithuanian("pergalę rezultatu 2-1.")).toBe("pergalę rezultatu 2-1.");
        expect(normalizeLithuanian("pralaimėjo komandai 155–157.")).toBe("pralaimėjo komandai 155–157.");
        // ⚠ AND THE LIST NAMES THE RESULT, NEVER THE TEAM. `komandai` was on it and suppressed the span in
        // `paskolintas Notts County komandai. 1997–1998 metais` — an ordinary year span 25 characters on.
        expect(normalizeLithuanian("Notts County komandai. 1997–1998 metais"))
            .toBe("Notts County komandai. 1997 iki 1998 metais");
        expect(normalizeLithuanian("veikė 1918–1926 metais")).toBe("veikė 1918 iki 1926 metais");
    });

    // Case- and spelling-narrow keys. `Nr.` was already `[Nn]r\.`, so the convention was known; the others
    // matched a form this corpus does not write — `psl\.` matched NOTHING at all here.
    test("the dotted abbreviations tolerate a capital, and `proc`/`psl` tolerate a missing dot", () => {
        expect(normalizeLithuanian("Pvz., vanduo").trim()).toBe("pavyzdžiui , vanduo"); // sentence-initial
        expect(normalizeLithuanian("Psl 47").trim()).toBe("puslapis 47"); // capital AND no dot
        expect(normalizeLithuanian("21,2 proc;").trim()).toBe("dvidešimt vienas kablelis du procentų;");
        expect(normalizeLithuanian("52 proc.").trim()).toBe("penkiasdešimt du procentai");
        // The word boundary, not the dot, is what keeps `proc` off the words that begin with it.
        expect(normalizeLithuanian("20 procentų")).toBe("20 procentų");
        expect(normalizeLithuanian("2 procesoriai")).toBe("2 procesoriai");
        // A capital `M.` is still a personal INITIAL and must stay untouched (that rule inverts trap 7).
        expect(normalizeLithuanian("2000 M.")).toBe("2000 M.");
    });

    // *diena* is feminine and the numeral was not. 40 of the 57 `d.` end in a gender-marked 1–9.
    test("the day numeral is FEMININE, because the noun it stands in front of is", () => {
        expect(normalizeLithuanian("balandžio 7 d.").trim()).toBe("balandžio septynios dieną");
        expect(normalizeLithuanian("sausio 1 d.").trim()).toBe("sausio viena dieną");
        expect(normalizeLithuanian("liepos 24 d.").trim()).toBe("liepos dvidešimt keturios dieną");
        expect(normalizeLithuanian("vasario 15 d.").trim()).toBe("vasario penkiolika dieną"); // teen: invariant
    });

    // The range re-emits its LEFT operand as digits, so no later rule can make it agree — audible only in
    // front of a feminine noun, which the unit rule feminises on the right operand and not on the left.
    test("a span closing on a feminine unit gets a feminine LEFT operand too", () => {
        expect(normalizeLithuanian("truko 2–3 val.").trim()).toBe("truko nuo dvi iki trys valandos");
        expect(normalizeLithuanian("2–3 km").trim()).toBe("nuo 2 iki trys kilometrai"); // masculine: unchanged
    });

    // Suppressing only HALF the correlative is not enough when the preposition already standing there IS
    // the other half — the corpus's `Iki VII–VIII, o vietomis` said the joiner twice.
    test("a preceding `iki` refuses the span outright; a preceding `nuo` only suppresses the `nuo`", () => {
        expect(normalizeLithuanian("Iki 7–8, o vietomis")).toBe("Iki 7–8, o vietomis");
        expect(normalizeLithuanian("nuo 1952-1967")).toBe("nuo 1952 iki 1967");
        expect(normalizeLithuanian("prieš 50 –65 tūkst. metų").trim())
            .toBe("prieš 50 iki šešiasdešimt penki tūkstančių metų");
    });

    // The century is a temporal span exactly as the year is, and was getting the correlative that year
    // spans are denied on the identical objection.
    test("a CENTURY span is temporal, so it takes the joiner alone and not the correlative", () => {
        expect(normalizeLithuanian("14–13 a. sandūroje").trim()).toBe("14 iki trylika amžiaus sandūroje");
        expect(phonemize("XIV–XIII a.", "lt").trim())
            .toBe(`${phonemizeWord("keturiolika")} ${phonemizeWord("iki")} ${phonemizeWord("trylika")} ${phonemizeWord("amžiaus")}`);
        expect(normalizeLithuanian("1997–1998 metais")).toBe("1997 iki 1998 metais"); // unchanged
    });

    // ORDERING COUPLING THIS LAYER CREATED: step 1 inserts *prieš mūsų erą*, and step 9's "a letter follows
    // ⇒ this magnitude governs a noun" lookahead then fired on the layer's own insertion.
    test("the magnitude's genitive lookahead does not fire on the era phrase this layer inserted", () => {
        // Through the real phonemizer, because the corpus writes the operand as a ROMAN numeral and that
        // pass is not in this file at all (lt is not in registry.ts's ROMAN_NATIVE).
        expect(phonemize("IV tūkst. pr. m. e. pabaigoje", "lt").trim()).toBe(
            [ "keturi", "tūkstančiai", "prieš", "mūsų", "erą", "pabaigoje" ].map(phonemizeWord).join(" "),
        );
        expect(normalizeLithuanian("2 tūkst. pr. m. e.").trim()).toBe("du tūkstančiai prieš mūsų erą");
        expect(normalizeLithuanian("3 tūkst. m. e.").trim()).toBe("trys tūkstančiai mūsų eros");
        // A real governed noun still takes the genitive.
        expect(normalizeLithuanian("19 tūkst. hektarų")).toBe("devyniolika tūkstančių hektarų");
        expect(normalizeLithuanian("2 mlrd. JAV dolerių").trim()).toBe("du milijardų JAV dolerių");
        // ⚠ AND THE KEY IS WORD-BOUNDED, which it was not: `tūkst` is five characters inside
        // *tūkstantmetis* and inside the spelled-out *tūkstančius*, so the corpus's own
        // `apie 3 tūkstančius upių` was rewritten as *trys tūkstančių ANČIUS* — a word already correct,
        // mangled by a needle that matched inside it.
        expect(normalizeLithuanian("apie 3 tūkstančius upių")).toBe("apie 3 tūkstančius upių");
        expect(normalizeLithuanian("37 tūkstančių hektarų")).toBe("37 tūkstančių hektarų");
        // A magnitude whose FIGURE this layer declined is still expanded, or it goes to the g2p raw.
        expect(normalizeLithuanian("55.89 mlrd €").trim()).toBe("55.89 milijardų €");
    });

    // Two units were in neither the rule table nor the header's declined list, so they simply leaked.
    test("`g`, `mg` and `min.` are declared; the rate and the letter-glued form are still refused", () => {
        expect(normalizeLithuanian("sveria 90 g,").trim()).toBe("sveria devyniasdešimt gramų,");
        expect(normalizeLithuanian("1 g").trim()).toBe("vienas gramas");
        expect(normalizeLithuanian("25 mg sorbatų").trim()).toBe("dvidešimt penki miligramai sorbatų");
        expect(normalizeLithuanian("12,5 mg/kg")).toBe("12 kablelis 5 mg/kg"); // a RATE: the unit is refused whole
        expect(normalizeLithuanian("802.11g")).toBe("802.11g");
        expect(normalizeLithuanian("25 min.").trim()).toBe("dvidešimt penkios minutės"); // feminine
        expect(normalizeLithuanian("1 min.").trim()).toBe("viena minutė");
        // A magnitude may stand between the figure and a ONE-LETTER key too — `m`/`t`/`g` lacked MAG_MID.
        expect(normalizeLithuanian("50 tūkst. t durpių").trim()).toBe("penkiasdešimt tūkstančių tonų durpių");
        // ⚠ `t` IS THE TONNE ONLY WITHOUT A FOLLOWING HYPHEN. `t-metis` is *tūkstantmetis*, the
        // MILLENNIUM, ×4 in the retained text against ONE genuine tonne — the counter-example outnumbers
        // the true positive 3:1, and the layer read all four as *tonos*. The corpus spells the expansion
        // out itself ("X TŪKSTANTMEČIO pr. m. e."), and the suffix is re-emitted verbatim with its case.
        expect(normalizeLithuanian("III t - mečio").trim()).toBe("III tūkstantmečio");
        expect(normalizeLithuanian("2 t-metis").trim()).toBe("2 tūkstantmetis");
        expect(normalizeLithuanian("II-I t - metyje").trim()).toBe("II-I tūkstantmetyje");
    });

    // The `×` sign was silent and the ASCII stand-in was READ, as /z/ — one refusal spelled two ways.
    test("a digit-flanked ASCII `x` is folded to the same silence the `×` sign has", () => {
        expect(normalizeLithuanian("110 x 46 x 21 mm").trim()).toBe("110 46 dvidešimt vienas milimetras");
        expect(normalizeLithuanian("x1, x2 ir x3")).toBe("x1, x2 ir x3"); // a multiplier PREFIX, untouched
        expect(normalizeLithuanian("x86, PowerPC")).toBe("x86, PowerPC");
    });

    // The trap-12 "don't say it twice" guard searched 30 CHARACTERS, which reaches a noun belonging to a
    // different figure. Two WORDS is the whole attested reach of the shapes it exists for.
    test("the currency-already-said guard reaches two words, not thirty characters", () => {
        expect(normalizeLithuanian("kaina 5 $ ir dešimt dolerių").trim())
            .toBe("kaina penki doleriai ir dešimt dolerių"); // the `$` is no longer deleted
        expect(normalizeLithuanian("$90 milijonų dolerių")).toBe("devyniasdešimt milijonų dolerių"); // next word
        expect(normalizeLithuanian("9 986 mlrd. JAV dolerių").trim())
            .toBe("devyni tūkstančiai devyni šimtai aštuoniasdešimt šeši milijardų JAV dolerių"); // one apart
    });

    // The de-group pass was a `for` capped at four, which is a ceiling and not a reason.
    test("de-grouping runs to a fixed point, not to a hard-coded pass count", () => {
        expect(normalizeLithuanian("1 385 000 000 gyventojų")).toBe("1385000000 gyventojų");
        expect(normalizeLithuanian("1 234 567 890 123 x")).toBe("1234567890123 x");
    });
});
