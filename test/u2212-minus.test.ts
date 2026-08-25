/**
 * U+2212 MINUS SIGN — the nine languages that read the ASCII hyphen as a minus and dropped the real one.
 *
 * ⚠ THE CHARACTER IS THE EVIDENCE. U+2212's only Unicode meaning is the arithmetic operator and no keyboard
 * types it by accident, so it is read on the character's identity rather than on corpus attestation — it is
 * ×0 in all nine mined corpora and ×0 in every golden, which is exactly why the reading could go missing
 * without a single test or golden row noticing. Dropping a minus INVERTS the value it belongs to.
 *
 * ⚠ WHAT THIS DOES NOT CLAIM. The character says a minus was MEANT; it says nothing about the structure of
 * the expression. The fleet's corpus has `×10 −31 kg` (a flattened negative exponent), `90 −120` (a range),
 * and `занҳо −76,2` (an apposition dash), all U+2212. So the guards are unchanged: leading position only.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

/** Every language here already read `-5` and dropped `−5`. The pair is the assertion. */
const NINE = ["af", "az", "ca", "cy", "ff", "ga", "ha", "kk", "kmr"] as const;

describe.each(NINE)("%s reads U+2212 exactly as it reads the ASCII hyphen", (code) => {
    test("a leading minus before a bare number", () => {
        const hyphen = phonemize("-5", code);
        expect(phonemize("−5", code), `${code}: U+2212 dropped`).toBe(hyphen);
        // ⚠ AND IT MUST NOT BE THE BARE NUMBER — an assertion that only compared the two spellings would
        // pass just as well if BOTH had silently stopped reading the sign.
        expect(hyphen).not.toBe(phonemize("5", code));
    });

    test("a negative temperature", () => {
        expect(phonemize("−5 °C", code)).toBe(phonemize("-5 °C", code));
    });

    test("a digit−digit RANGE is still refused", () => {
        // The lookbehind rejects a preceding digit, so a lifespan is not read as a subtraction (#955).
        expect(phonemize("1838−1917", code)).toBe(phonemize("1838 1917", code));
    });

    test("a negative exponent written digit−digit is still refused", () => {
        expect(phonemize("10−19", code)).toBe(phonemize("10 19", code));
    });
});

/**
 * ⚠ KURMANJI HAD FOUR ARMS AND THE FIRST PASS FIXED ONE — which the tests above caught, because the pair
 * assertion is symmetric and an asymmetry anywhere fails it. Its minus is claimed by a temperature rule, a
 * bare-degree rule, a `pile`-phrase rule and a string-START rule, each written with an ASCII hyphen, so
 * `−5` stayed silent while `-5` read. Widening the character class in all four does not widen any trigger:
 * a minus MID-STRING before a bare number is still refused here, deliberately, and for both spellings —
 * kurmanji measured ~22 dashes before a digit and found only the ten temperatures genuine.
 */
describe("kmr keeps its narrow trigger, for both spellings alike", () => {
    test("a minus mid-string before a bare number is claimed by neither spelling", () => {
        expect(phonemize("heta −5", "kmr")).toBe(phonemize("heta 5", "kmr"));
        expect(phonemize("heta -5", "kmr")).toBe(phonemize("heta 5", "kmr"));
    });
});

/**
 * ⚠ THREE LANGUAGES THAT READ NO MINUS AT ALL NOW READ U+2212, ON A CAVEATED WORD — and the caveat is the
 * reason the claim is restricted to this one character.
 *
 * Silence is not the safe option: omitting a minus INVERTS the value, so `−6.0 °C` read as "six degrees" is
 * wrong by twelve and on the wrong side of freezing. But that argument only buys a word that MEANS negative.
 * The candidates rejected for these languages were transitive verbs of removal (`ntsha` "emit", `gukuramo`
 * "extract", `ìyọkúrò` "removal"), a comparative, and Tibetan `མོ་གྲངས` — which reads as "number of FEMALES"
 * in every modern instance, i.e. census counts. Those do not convey negativity, so they do not make the
 * trade; these three do.
 *
 *   nan  負 / hū    — the corpus GLOSSES ITS OWN SIGN: `(−10 m/s) … hū-hō tāi-piáu hong-hiòng`
 *   ilo  negatibo  — ×12/6, `negatibo a numero` in a maths list; the ADJECTIVE, not a reader's word
 *   ht   mwens     — ×569 comparative, the reflex of French *moins*; never digit-adjacent
 *
 * ⚠ THE ASCII HYPHEN IS NOT CLAIMED IN ANY OF THE THREE, and that is what makes reading a caveated word
 * defensible: the hyphen carries BCE years, ISBNs, UTC offsets, POJ compounding and page spans, while
 * U+2212 can only be the operator.
 */
describe.each([
    ["nan", "(−10 m/s)", "(-10 m/s)"],
    ["ilo", "−4.6", "-4.6"],
    ["ht", "−20°C", "-20°C"],
] as const)("%s reads U+2212 and leaves the hyphen alone", (code, minus, hyphen) => {
    test("the sign is read", () => {
        expect(phonemize(minus, code)).not.toBe(phonemize(minus.replace("−", ""), code));
    });

    test("the ASCII hyphen is still refused — the ambiguous character keeps its refusal", () => {
        expect(phonemize(hyphen, code)).toBe(phonemize(hyphen.replace("-", ""), code));
    });
});

/**
 * ⚠ THE SPACE-SEPARATED NEGATIVE EXPONENT IS THE SHAPE A LEADING-POSITION GUARD CANNOT SEE. `×10 −31 kg` is
 * 10⁻³¹ with the superscript flattened by mining; the lookbehind looks ONE character back, finds a space,
 * and fires — reading "ten minus thirty-one". Seven languages in this fleet's corpora write it that way, so
 * all three rules carry a second lookbehind refusing a preceding `digit + space`.
 */
describe.each(["nan", "ilo", "ht"] as const)("%s refuses the shapes that are not a minus", (code) => {
    test("a space-separated negative exponent", () => {
        expect(phonemize("×10 −31 kg", code)).toBe(phonemize("×10 31 kg", code));
    });

    test("a digit−digit range", () => {
        expect(phonemize("1838−1917", code)).toBe(phonemize("1838 1917", code));
    });
});

/**
 * ⚠ YORUBA — AND THE TERM WAS FOUND BY READING THE ARTICLE, NOT BY PROBING A WORD. Three earlier rounds
 * refused `ìyọkúrò` / `yọ kúrò` (physical removal — methane removed, water evaporated) and a composed
 * "below zero", whose juncture is a syntax claim the two content words do not supply. ⚠ AN EARLIER VERSION
 * OF THIS COMMENT ALSO CALLED `ìsàlẹ̀ òdo` A HOMOGRAPH OF `ìsàlẹ̀ odo` ("downriver") AND THAT ARGUMENT WAS
 * WRONG: `òdo` is [o˩do˧] and `odo` is [o˧do˧], so the two differ in TONE and this layer emits the tone
 * marks — the g2p would render the zero word. A collision that only exists for a human reading UNTONED
 * text is not a collision in what a phonemizer outputs. The refusal stands on the syntax, not the spelling.
 * What settled it was yo.wikipedia's own article `Nọ́mbà alòdì àti nọ́mbà adájú`, which defines the
 * term beside its own operand:
 *
 *     "Nomba alodi ni awon nomba tiwonkere ju òdo lo fun apere -√2, -1.44, -1"
 *      negative numbers are the numbers less than ZERO, for example −√2, −1.44, −1
 *
 * The same gloss shape that settled tn and nan. ⚠ `dín ní` — offered alongside — is REFUSED and is worse
 * than merely wrong: it is how Yoruba BUILDS NUMERALS (*márùn dín ní ọgọ́ta* is 55, "five less than sixty"),
 * so emitted before a figure it would be parsed as part of the number.
 */
describe("yo reads U+2212 with the term its own maths article glosses", () => {
    const say = (s: string): string => phonemize(s, "yo");

    test("a negative temperature carries the marker", () => {
        expect(say("−47.6 °C")).not.toBe(say("47.6 °C"));
        expect(say("−47.6 °C").startsWith(say("alòdì"))).toBe(true);
    });

    test("every member of a signed list is marked, not just the first", () => {
        // The article's own example shape. Claiming only the leading member signs one of three.
        const said = say("(−1, −2, −3)");
        expect(said.split(say("alòdì")).length - 1).toBe(3);
    });

    test("the HYPHEN is untouched — it is this language's range mark", () => {
        // 3,378 hyphens and 4,159 en dashes sit between digits here and `sí` reads them as a range.
        expect(say("-47.6 °C")).toBe(say("47.6 °C"));
        expect(say("ọgọ́rùn-ún méjì sí mẹ́fà")).toBe(say("ọgọ́rùn-ún méjì sí mẹ́fà"));
    });

    test("the space-separated exponent this corpus writes is refused", () => {
        expect(say("1.98739x10 −21 s")).toBe(say("1.98739x10 21 s"));
    });
});

/**
 * ⚠ NAIJA READS THE ENGLISH WORD, AND THAT IS THE LANGUAGE BEING ITSELF RATHER THAN A SHORTCUT. Nigerian
 * Pidgin is English-lexified, and this layer already declares `percent: ["percent"]` — the bare English
 * word, sourced from pcm.wikipedia's own "85 percent", read as [pasɛnt] because the engine nativises a
 * known English spelling through the English dict. `minus` takes the identical route and comes out
 * [mainas]. Attestation is ×1 and recorded as a LEAD: *"Sovereign credit rating (of BB minus)"*, the word
 * in Naija prose in the modifier sense.
 */
describe("pcm reads U+2212 through its own English-nativisation path", () => {
    const say = (s: string): string => phonemize(s, "pcm");

    test("the sign is read, and through the nativiser rather than spelled out", () => {
        expect(say("−47.6 °C")).not.toBe(say("47.6 °C"));
        expect(say("−47.6 °C").startsWith(say("minus"))).toBe(true);
    });

    test("the corpus's own sentence — both signs in one parenthetical", () => {
        // `get di lowes minimum temperashor of 49 K (−224 °C; −371 °F)` — Uranus, the only U+2212 mined.
        expect(say("(−224 °C; −371 °F)").split(say("minus")).length - 1).toBe(2);
    });

    test("the hyphen is untouched — it is this language's compounding mark", () => {
        expect(say("planet-dem")).toBe(say("planet dem"));
        expect(say("-47.6 °C")).toBe(say("47.6 °C"));
    });
});

/**
 * ⚠ ABKHAZ — declared on the BLOCK'S PATTERN, not on a token of its own, and that is stated rather than
 * blurred. `минус` is ×0 on ab.wikipedia (and so is the a-prefixed `аминус`). What carries it is that every
 * other symbol word in `abkhaz.jsonc` is a bare Russian loan the full-wiki sweep DID attest — процент,
 * градус, доллар, евро, фунт, километра, метра, квадрат — so Abkhaz takes its sign vocabulary from Russian
 * unadapted, and Russian's minus is минус. ky and kk, same contact profile, ship the same word on
 * attestation. The cost of silence is measured: eleven signed temperatures on ab.wikipedia, every one a
 * genuine negative.
 */
describe("ab reads U+2212 on the Russian-loan pattern its whole symbol block follows", () => {
    const say = (s: string): string => phonemize(s, "ab");

    test("a negative temperature carries the marker, and the scale still reads", () => {
        const said = say("−47.6 °C");
        expect(said).not.toBe(say("47.6 °C"));
        expect(said.startsWith(say("минус"))).toBe(true);
        // `Цельси иградус` is the manifest's own sourced Celsius form — the sign must not disturb it.
        expect(said.endsWith(say("Цельси иградус"))).toBe(true);
    });

    test("the ASCII hyphen is untouched — in this corpus it is the RANGE mark", () => {
        // `15-20 километра аҳаракыраҿы` is a span, and step 4 reads it as one.
        expect(say("15-20 километра")).not.toBe(say("15 20 километра"));
        expect(say("-47.6 °C")).toBe(say("47.6 °C"));
    });

    test("range and space-separated exponent are refused", () => {
        expect(say("1838−1917")).toBe(say("1838 1917"));
        expect(say("×10 −31 kg")).toBe(say("×10 31 kg"));
    });
});

/**
 * ⚠ ZHUANG — `lingzha` < Chinese 零下 "below zero", and HALF OF IT IS VERIFIED IN THE MANIFEST ITSELF.
 * `lingz` is the zero in `numbers.units`, and it is the Chinese 零 loan already carrying Zhuang's own
 * number names (`bak lingz haj` = 105). A language whose ZERO is a Chinese numeral loan taking 零下 for the
 * sub-zero reading is that borrowing continued.
 *
 * ⚠ WHAT IS NOT VERIFIED: the word is ×0 on za.wikipedia, and the second syllable's tone is a guess — a
 * bare `ha` is tone 1 in the 1982 orthography while 下 is falling. Recorded in the jsonc, not hidden.
 * ⚠ AND THE ASCII HYPHEN IS REFUSED EVEN THOUGH IT CARRIES REAL NEGATIVES HERE — the corpus's Dead Sea
 * elevations are `-418m` / `-420m` — because in this language the hyphen is also the range mark its own
 * era rule reads (`259BC-210BC`), and the two cannot be told apart.
 */
describe("za reads U+2212 as the Chinese-loan `lingzha`", () => {
    const say = (s: string): string => phonemize(s, "za");

    test("the sign is read, preposed as 零下 is in Chinese", () => {
        expect(say("−47.6 °C")).not.toBe(say("47.6 °C"));
        expect(say("−47.6 °C").startsWith(say("lingzha"))).toBe(true);
    });

    test("the corpus's own sentence", () => {
        // `Average daily temperatures range between −20 and 30 °C.`
        expect(say("−20 and 30 °C")).not.toBe(say("20 and 30 °C"));
    });

    test("the hyphen is refused — it is this language's range mark", () => {
        expect(say("-418m")).toBe(say("418m"));
        expect(say("1838−1917")).toBe(say("1838 1917"));
    });
});
