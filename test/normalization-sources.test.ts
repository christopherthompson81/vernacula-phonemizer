/**
 * The pre-flight source report must know about every class the gates will fail a layer on.
 *
 * ⚠ WHY THIS TEST EXISTS. `sources.ts` is the check that must run BEFORE writing a normalization layer,
 * and its own header explains the stake: "the cost of doing it by hand is not the time, it is that it was got
 * wrong". But its class list was hand-written and had fallen behind twice over.
 *
 * ⚠ THE SIGN CLASSES LIVE IN `defects.ts`, `review.ts` AND `coverage.ts` — not here. `sources.ts` carried its
 * own hand-written copy, which drifted; `ampersand` and `iteration` were never represented at all. So an author
 * running the mandated check was told, BY SILENCE, that eight classes did not apply. Writing the Khmer layer,
 * that is exactly what happened: the report listed percent, currency, degrees, decimal and fractions, said
 * nothing about signs, and the author asserted "× ÷ and = have no corpus-attested Khmer reading" into a code
 * comment without checking. Every one was attested — ដក ×3,808, គុណ ×3,338, ចែក ×3,285, ស្មើ ×2,077 — with
 * `៣គុណ៥` and `២៨ ដក៥` written out in arithmetic position.
 *
 * A silent class is how folklore replaces a lookup. This test makes the two lists reconcile mechanically, so the
 * next class added to `DROPPABLE` cannot arrive without either a row or a stated reason for having none.
 */
import { describe, expect, test } from "vitest";
import { DROPPABLE } from "../tools/normalization/defects.ts";
import {
    SCALE_PROBES,
    foldMarks,
    SOURCES_EXEMPT, context, evidenceKin, scaleNames, strippedOfComments, unitDeclaration, unitWords, type Ctx,
} from "../tools/normalization/sources.ts";
import { readFileSync } from "node:fs";

/** The class names `sources.ts` actually reports on, read from its own source rather than re-declared here. */
const reported = new Set(
    [...readFileSync("tools/normalization/sources.ts", "utf8").matchAll(/klass: "([a-z-]+)"/gu)].map((m) => m[1]!),
);

/** `degree` is reported under the name `scale-names`, which is the scale word rather than the sign. */
const ALIAS: Readonly<Record<string, string>> = { degree: "scale-names" };

describe("sources.ts covers what the gates check", () => {
    test("every DROPPABLE class has a source row or a declared exemption", () => {
        const missing: string[] = [];
        for (const [klass] of DROPPABLE) {
            if (klass in SOURCES_EXEMPT) continue;
            const names = [klass, `${klass}-word`, ALIAS[klass] ?? ""].filter(Boolean);
            if (!names.some((n) => reported.has(n))) missing.push(klass);
        }
        expect(missing, `no pre-flight row for: ${missing.join(", ")} — add one to sources.ts, or an entry to `
            + `SOURCES_EXEMPT saying why the class needs no vocabulary`).toEqual([]);
    });

    test("every exemption names a real class, and gives a reason", () => {
        // An exemption for a class that no longer exists is dead weight that makes the reconciliation lie.
        const classes = new Set([...DROPPABLE].map(([k]) => k));
        for (const [klass, why] of Object.entries(SOURCES_EXEMPT)) {
            expect(classes.has(klass), `${klass} is exempt but is not a DROPPABLE class`).toBe(true);
            expect(why.length, `${klass}'s exemption needs a reason, not a placeholder`).toBeGreaterThan(20);
        }
    });

    test("the sign classes are all represented", () => {
        // Named explicitly rather than derived, because these are the ones that went missing for a whole issue's
        // worth of work and the failure was invisible — the report simply did not mention them.
        for (const sign of ["minus", "plus", "plus-minus", "equals", "less-than", "greater-than", "times", "divide"])
            expect(reported.has(`${sign}-word`), `${sign} has no pre-flight row`).toBe(true);
    });
});

/**
 * THE SCALE-NAMES CHECK, PINNED IN BOTH DIRECTIONS — which is how its two defects were found, and why one
 * test class would not have been enough.
 *
 * ⚠ A FALSE `ok` IS THE FAILURE THIS INSTRUMENT EXISTS TO PREVENT. `sources.ts` caught a Lao layer that had
 * INVENTED a currency word by reporting it "in NO source"; an `ok` assembled out of the layer's own
 * identifiers would have waved that through, because a layer's source text always agrees with itself. So the
 * `ok` cases below are asserted on their EVIDENCE, not merely on the verdict — an `ok` whose detail is the
 * English word "Celsius" for a language that emits 攝氏 is still wrong even though the verdict reads right.
 *
 * ⚠ AND A FALSE `NONE` COSTS THE CATCH. It teaches whoever reads the report next that the line carries no
 * information, which is the same outcome as not printing it. So the `[??]` cases are pinned too: the point of
 * that verdict is that it is NOT `none`, and a later "simplification" that collapses it back into `none` to
 * make the matrix tidier must fail here.
 */
const CTX = (over: Partial<Ctx>): Ctx =>
    ({ code: "xx", dir: "xx", espeak: "", referee: "", langSrc: "", corpus: "20 °C", ...over });

describe("scale-names tells a declared word from an option key", () => {
    test("FALSE GREEN: a helper's option keys are not the language's vocabulary", () => {
        // The cdo shape, exactly: three arms, all emitting the bare degree word, under keys named for the two
        // scales. The words `celsius` and `fahrenheit` are present in the source and mean nothing.
        const r = scaleNames(CTX({
            langSrc: "s = readDegrees(s, { celsius: (n) => `${n} dô`, fahrenheit: (n) => `${n} dô`, bare: (n) => `${n} dô` });",
        }));
        expect(r.verdict, `option keys were read as scale words: ${r.detail}`).toBe("none");
        expect(r.detail).toContain("dropped");
    });

    test("FALSE GREEN: a quoted object KEY names the slot, not the word", () => {
        // The ab shape. `"celsius"` is a manifest field name; the Abkhaz word is the VALUE beside it.
        const r = scaleNames(CTX({ langSrc: '{ "celsius": "Цельси иградус" }', corpus: "20 °C" }));
        expect(["have", "partial"]).not.toContain(r.verdict);
    });

    test("FALSE GREEN: an arm that differs from the OTHER scale arm still declares nothing", () => {
        // The uz shape, which the first version of this fix got wrong: `°C` reads as the bare degree word and
        // only `°F` adds a scale name. A "the two arms differ" test invents a Celsius word out of that.
        const r = scaleNames(CTX({
            langSrc: 's.replace(/(\\d)\\s?°\\s?C(?![\\p{L}])/gu, "$1 daraja")'
                + '.replace(/(\\d)\\s?°\\s?F(?![\\p{L}])/gu, "$1 daraja farengeyt")'
                + '.replace(/(\\d)\\s?°/gu, "$1 daraja")',
        }));
        expect(r.verdict).toBe("partial");
        expect(r.detail).toContain("Fahrenheit");
        expect(r.detail).not.toContain("Celsius");
    });

    test("a `N°` numero rule is not a degree arm", () => {
        const r = scaleNames(CTX({ langSrc: 's.replace(/(?<![\\p{L}])[Nn]\\s?°\\s?(?=\\d)/gu, "nimewo ")' }));
        expect(["have", "partial"]).not.toContain(r.verdict);
    });

    test("distinct arms declare a scale name, and the EMITTED text is what gets reported", () => {
        const r = scaleNames(CTX({
            corpus: "13.3 °C", langSrc: "readDegrees(s, { celsius: (n) => `攝氏${n}度`, fahrenheit: (n) => `華氏${n}度`, bare: (n) => `${n}度` })",
        }));
        expect(r.verdict).toBe("have");
        expect(r.detail, "an ok must cite the language's own word, not the English name").toContain("攝氏");
        expect(r.detail).toContain("華氏");
    });

    test("a scale word inside a ternary hole counts (the sr/hr shape)", () => {
        const r = scaleNames(CTX({
            langSrc: 's.replace(/(\\d+)\\s?°\\s?([CFСcf])(?![\\p{L}])/gu, (_m, n, u) => `${n} ${/[Ff]/u.test(u) ? "Farenhajta" : "Celzijusa"}`)',
        }));
        expect(r.verdict).toBe("have");
    });
});

describe("scale-names refuses to answer rather than inventing an absence", () => {
    test("FALSE NEGATIVE: a non-Latin corpus is an unread haystack, not an absence", () => {
        // The transliteration probe is a list of Latin spellings. Reporting `none` over a corpus it cannot
        // read is an assertion about evidence nobody looked at.
        const r = scaleNames(CTX({ corpus: "১৮°ꠍꠦ. ০°–১০০° ꠍꠦꠟꠍꠤꠀꠍ ꠔꠣꠚꠝꠣꠔ꠆ꠞꠣ" }));
        expect(r.verdict).toBe("unknown");
        expect(r.detail, "the reader must be handed the candidate, not just a shrug").toContain("ꠍꠦꠟꠍꠤꠀꠍ");
    });

    test("FALSE NEGATIVE: an arm whose output is computed is unknown, never none", () => {
        const r = scaleNames(CTX({
            langSrc: 's.replace(new RegExp(`(\\\\p{Nd})\\\\s*°\\\\s*(ꠍꠦ|ꠚꠣ)`, "gu"), (_m, d, k) => `${d} ${SCALE[k]}`)',
        }));
        expect(r.verdict).toBe("unknown");
    });

    test("`none` is still reachable where the probe COULD have read the corpus", () => {
        // Not every negative is wrong, and softening all of them would cost the class its meaning.
        const r = scaleNames(CTX({ corpus: "the temperature reached 20 ° yesterday", langSrc: "" }));
        expect(r.verdict).toBe("none");
    });

    test("no ° in the corpus is not a judgement about the vocabulary", () => {
        expect(scaleNames(CTX({ corpus: "no sign here" })).verdict).toBe("n/a");
    });
});

describe("scale-names on the real fleet", () => {
    // ⚠ REAL LAYERS, not fixtures, because both defects were invisible until the check met an actual layer:
    // the false green needed cdo's helper call and the false negative needed a Syloti Nagri corpus.
    test("cdo: no scale name, and the layer says so itself", () => {
        const r = scaleNames(context("cdo"));
        expect(r.verdict, `cdo emits the bare dô on all three arms: ${r.detail}`).toBe("none");
    });

    test("syl: both names are in the corpus, so `none` is not an answer", () => {
        const r = scaleNames(context("syl"));
        expect(r.verdict).not.toBe("none");
    });

    test("languages that were already right stay right", () => {
        for (const code of ["en", "sv", "sr", "hak"])
            expect(scaleNames(context(code)).verdict, `${code} regressed`).toBe("have");
        // om and mg are SETTLED REFUSALS this file's own header cites — they must not become noise.
        for (const code of ["om", "mg"])
            expect(scaleNames(context(code)).verdict, `${code} lost a settled refusal`).toBe("none");
    });
});

/**
 * THE UNIT-WORD CLASS, PINNED IN BOTH DIRECTIONS — for the same reason `scale-names` is, and with the same
 * asymmetry: an honest `[??]` costs a look, a false `ok` costs the catch.
 *
 * ⚠ THIS CLASS EXISTS BECAUSE ITS ABSENCE WAS THE ROOT CAUSE. `sources.ts` excluded `units` by design, so Igbo
 * called the shared tier with no `units` key for the whole life of its layer — `48 kg` read as
 * *iɾi anɔ na asatɔ kɡ*, the letters PRONOUNCED as a cluster — and the mandated pre-flight said nothing about
 * it, because the class did not exist. The `none` cases below are that state; the `ok` cases are the ways a
 * probe can be fooled into calling something a unit word when it is a numeral spelling, a G2P digraph, or the
 * abbreviation itself.
 */
const UCTX = (over: Partial<Ctx>): Ctx =>
    ({ code: "xx", dir: "xx", espeak: "", referee: "", langSrc: "", corpus: "48 kg and 10 km", ...over });

describe("unit-word finds the missing word", () => {
    test("THE IGBO STATE: a tier call with no `units` key at all is a NONE, not a silence", () => {
        const r = unitWords(UCTX({ langSrc: 'const S = makeSymbolNormalizer({ percent: ["pasent"], currency: { "₦": ["naira"] } });' }));
        expect(r.verdict, `a layer with no unit word must be loud: ${r.detail}`).toBe("none");
        expect(r.detail).toContain("kg");
    });

    test("a language with NO layer is `check`, never `none` — nothing is blocked, nobody has looked", () => {
        expect(unitWords(UCTX({ langSrc: "" })).verdict).toBe("check");
    });

    test("no unit abbreviation in the evidence and nothing declared is not a judgement", () => {
        expect(unitWords(UCTX({ corpus: "no measurements here", langSrc: "" })).verdict).toBe("n/a");
    });

    test("a ONE-LETTER key glued to its digits is not a unit (the syl `l99l` shape)", () => {
        // A Latin ⟨l⟩ standing in for the digit ONE in a transliterated date. Spaced, `2 l` would count.
        const r = unitWords(UCTX({ corpus: "(Γ00l) l99l ৪৫৯", langSrc: "" }));
        expect(r.verdict, `a numeral lookalike was read as a litre: ${r.detail}`).toBe("n/a");
    });
});

describe("unit-word tells a declared word from a lookalike", () => {
    test("FALSE GREEN: `units` is also the DIGIT SPELLINGS, and a nested one must not answer", () => {
        // Every manifest in the fleet carries `numbers: { units: [...] }` for 0–9. A substring probe finds a
        // unit table in every language there is.
        const r = unitWords(UCTX({
            langSrc: 'const N = { numbers: { units: ["otu", "abụọ", "atọ"] } };'
                + 'const S = makeSymbolNormalizer({ percent: ["pasent"] });',
        }));
        expect(r.verdict, `the digit spellings were read as unit words: ${r.detail}`).toBe("none");
    });

    test("FALSE GREEN: a G2P digraph table is not a unit table", () => {
        // The Guaraní shape (`mb: "ᵐb"`) and the Hmong one (`ml: "mˡ"`) — a phoneme map pairs a two-letter
        // key with a string exactly the way a unit table pairs a word.
        const r = unitWords(UCTX({
            langSrc: 'const G = { mb: "ᵐb", nd: "ⁿd", ng: "ᵑɡ", ml: "mˡ", kw: "kʷ" };'
                + 'const S = makeSymbolNormalizer({ percent: ["p"] });',
        }));
        expect(["have", "partial"], `a phoneme map was read as vocabulary: ${r.detail}`).not.toContain(r.verdict);
    });

    test("FALSE GREEN: an arm that emits the ABBREVIATION is not a word", () => {
        const r = unitWords(UCTX({ langSrc: 's.replace(/(\\d)\\s?km²/gu, "$1 km²");' }));
        expect(r.verdict, `the abbreviation was accepted as its own reading: ${r.detail}`).not.toBe("have");
    });

    test("FALSE GREEN: the layer's own source is not text evidence", () => {
        // The word is declared and appears NOWHERE else. A declaration cannot be its own attestation — the
        // door the Igbo `ntụkpọ` finding closed in review.ts, where the needle was extracted from the very
        // manifest being searched.
        const r = unitWords(UCTX({
            corpus: "48 kg and 10 km", langSrc: 'makeSymbolNormalizer({ units: { km: ["zzqqxwood"], kg: ["zzqqxfood"] } });',
        }));
        expect(r.verdict).toBe("partial");
        expect(r.detail).toContain("zzqqxwood");
    });

    test("attestation is TOKEN-wise: a compound containing the word does not attest it", () => {
        // The German shape exactly — `Kilometer` occurs in its referee only inside `Kilometerzähler`. Same
        // discipline as the Fula `tere`, which any longer word containing those four letters satisfied.
        const decl = 'makeSymbolNormalizer({ units: { km: ["Kilometer"] } });';
        expect(unitWords(UCTX({ langSrc: decl, referee: "kilometerzähler\tkiloˈmeːtɐˌt͡sɛːlɐ" })).verdict).toBe("partial");
        expect(unitWords(UCTX({ langSrc: decl, referee: "zehn kilometer weit" })).verdict).toBe("have");
    });
});

describe("unit-word refuses to answer rather than inventing an absence", () => {
    test("a computed table with nothing to resolve is `[??]`, never `none`", () => {
        const r = unitWords(UCTX({ langSrc: "makeSymbolNormalizer({ units: buildUnits(LOCALE, table) });" }));
        expect(r.verdict).toBe("unknown");
    });

    test("ONE level of indirection IS resolved — the ig/rw/rn shape", () => {
        const r = unitWords(UCTX({
            corpus: "48 kg and 10 km kilomita kilogram",
            langSrc: 'const UNIT = { km: "kilomita", kg: "kilogram" };'
                + "makeSymbolNormalizer({ units: Object.fromEntries(Object.entries(UNIT).map(([k, w]) => [k, [w]])) });",
        }));
        expect(r.verdict, `the local table was not resolved: ${r.detail}`).toBe("have");
        expect(r.detail).toContain("kilomita");
    });

    test("a declaration with NO haystack is an unread haystack, not an unattested word", () => {
        const r = unitWords(UCTX({
            corpus: "", referee: "", espeak: "", langSrc: 'makeSymbolNormalizer({ units: { km: ["kilometro"] } });',
        }));
        expect(r.verdict).toBe("unknown");
        expect(r.detail).toContain("nothing could attest");
    });

    test("`none` stays reachable — softening every negative would cost the class its meaning", () => {
        expect(unitWords(UCTX({ langSrc: "makeSymbolNormalizer({ percent: [\"p\"] });" })).verdict).toBe("none");
    });
});

describe("unit-word on the real fleet", () => {
    test("ig: the language that motivated the class reads its four words", () => {
        const r = unitWords(context("ig"));
        expect(r.verdict, `ig lost its unit words: ${r.detail}`).toBe("have");
        expect(r.detail).toContain("kilomita");
    });

    test("as: the fleet's one `NONE`, now sourced — and it was never the state ig was in", () => {
        // ⚠ THIS TEST ASSERTED `none` AND THE PREMISE WAS WRONG, which is worth keeping rather than
        // rewriting away. Assamese writes `৩৫mm`, `২৪mm`, `৩৬mm`, and the layer's own directory declared no
        // unit word — but the reading was never raw: as reuses the Bengali engine, whose symbol tier ships
        // BENGALI unit words, so `mm` was read all along as `মিলিমিটার`. What the `NONE` actually found was a
        // language reading its measurements through another language's vocabulary, and for `cm` that was a
        // wrong phoneme (`সেন্টিমিটার` → *xentimitaɹ*, the Assamese স being [x]). The manifest now declares
        // Assamese's own seven; see assamese.jsonc for the per-word sourcing.
        const r = unitWords(context("as"));
        expect(r.verdict, `as lost its unit words: ${r.detail}`).toBe("have");
        expect(r.detail).toContain("চেণ্টিমিটাৰ");
    });

    test("AN ABUGIDA WORD IS STILL A WORD — `\\p{L}{2}` cannot see one", () => {
        // The bug that hid the line above: in `কিলোমিটাৰ` every letter is followed by a combining matra, so
        // no two letters are adjacent and a `\p{L}{2}` word test was false for the whole script. The table
        // was read, then filtered down to nothing, and the tool reported "declares NO unit word" at a
        // manifest naming all seven. Devanagari, Gujarati, Kannada, Khmer and Thai are the same shape.
        const d = unitDeclaration('{ "unitWords": { "km": ["किलोमीटर"], "cm": ["सेंटीमीटर"] } }');
        expect(d?.words.length, `an abugida unit table read as empty: ${JSON.stringify(d)}`).toBe(2);
    });

    /**
     * THE FOUR CODES WITH NO EVIDENCE AND NO LAYER OF THEIR OWN. `apd`, `zsm`, `pbt` and `bgc` are served off
     * `arabic/`, `malay/`, `pashto/` and `hindi/`, so the unit words judged for them are the SHARED LAYER's.
     * Reporting `[??] nothing could attest them` was true about their own evidence and silent about the
     * question — while the language the declaration belongs to has a corpus that answers it.
     */
    test("a code with no evidence of its own is judged on the layer it shares — apd zsm pbt bgc", () => {
        for (const code of ["apd", "zsm", "pbt", "bgc"]) {
            const r = unitWords(context(code));
            expect(r.verdict, `${code} is back to an unread haystack: ${r.detail}`).not.toBe("unknown");
            expect(r.detail, `${code} does not say whose evidence answered`).toContain("the layer it shares");
        }
    });

    test("and it reproduces the OWNING language's row, which is what says the relation is right", () => {
        // The borrowed reading must agree with the reading the owner gets from the same evidence, or the
        // relation is not the one claimed. pbt/ps and bgc/hi are the two clean pairs (zsm also sees `id`).
        for (const [code, owner] of [["pbt", "ps"], ["bgc", "hi"], ["apd", "ar"]]) {
            const ratio = (d: string): string => /(\d+\/\d+)/u.exec(d)?.[1] ?? "?";
            expect(ratio(unitWords(context(code!)).detail), `${code} disagrees with ${owner}`)
                .toBe(ratio(unitWords(context(owner!)).detail));
        }
    });

    test("evidenceKin is DERIVED from the registry, and includes the sister set it does not duplicate", () => {
        // Same layer directory: the four above. Sister standards: separate directories, so the imported
        // `SISTER_STANDARDS` is not redundant with the directory rule — `nb`/`nn` are the proof.
        expect(evidenceKin("pbt")).toContain("ps");
        expect(evidenceKin("bgc")).toContain("hi");
        expect(evidenceKin("zsm")).toEqual(expect.arrayContaining(["id", "ms"]));
        expect(evidenceKin("nb")).toContain("nn");
        expect(evidenceKin("pbt")).not.toContain("pbt");
    });

    test("SETTLED REFUSALS MUST NOT BECOME NOISE — za, mg and syl", () => {
        // za and mg both source their unit nouns (za's `goengleix` is the commonest noun in its corpus); syl
        // refuses the class on measured grounds (`units` and `rate` are ×0 in its artifact).
        for (const code of ["za", "mg"]) expect(unitWords(context(code)).verdict, `${code} regressed`).toBe("have");
        expect(unitWords(context("syl")).verdict, "syl's measured refusal became a defect").toBe("n/a");
    });

    test("a layer that owns its table locally is not an absence — bg, my, ko, en", () => {
        for (const code of ["bg", "my", "ko", "en"])
            expect(unitWords(context(code)).verdict, `${code} reads as having no unit word`).not.toBe("none");
    });
});

/**
 * ⚠ THE COMMENT STRIPPER HAD TO BECOME A SCANNER, and this pins the case that forced it: a line comment that
 * ends with an emphasis marker against a slash contains a comment CLOSE and a comment OPEN overlapping. The
 * two-regex version opened a block comment inside that line and ran it to the next close in the file, deleting
 * the live code in between — which is how Italian, a layer declaring nineteen unit words, reported having none.
 */
describe("the comment stripper does not delete code", () => {
    test("an emphasis marker against a slash inside a line comment", () => {
        const src = "// a note about *milioni* and *miliardi*, written as *milioni*"
            + "/" + "*miliardi*.\nconst KEPT = { units: { km: [\"chilometro\"] } };\n/** doc */\nconst AFTER = 1;";
        const out = strippedOfComments(src);
        expect(out, "the tier declaration was swallowed by a comment that never opened").toContain("chilometro");
        expect(out).toContain("AFTER");
        expect(out).not.toContain("miliardi");
    });

    test("a `//` inside a STRING is not a comment", () => {
        expect(strippedOfComments('const u = "https://example.invalid/x"; const v = 1;')).toContain("example.invalid");
    });

    test("it: the layer whose source used to stop three lines above its unit table", () => {
        const d = unitDeclaration(context("it").langSrc);
        expect(d?.words ?? [], "italian's unit table is unreadable again").toContain("chilometro");
    });
});

/**
 * ⚠ WHY THERE IS NO `SOURCES_EXEMPT` ENTRY FOR UNITS, stated as a test so the next reader does not add one.
 *
 * The reconciliation runs ONE WAY: every `DROPPABLE` class needs a source row or a declared exemption. A unit
 * is LETTERS, not a sign — `km` is not droppable typography, it is a token the reader must be given a word
 * for — so `units` is not in `DROPPABLE`, needs no probe in `review.ts`, and must NOT be added to
 * `SOURCES_EXEMPT`, whose own test asserts that every exemption names a real `DROPPABLE` class. A row with no
 * sign behind it is exactly what the one-way direction leaves room for.
 */
describe("the units row fits the reconciliation without bending it", () => {
    test("unit-word is reported, is not DROPPABLE, and is not exempt", () => {
        expect(reported.has("unit-word")).toBe(true);
        expect([...DROPPABLE].map(([k]) => k)).not.toContain("units");
        expect(Object.keys(SOURCES_EXEMPT)).not.toContain("units");
    });
});


/**
 * THE SCALE PROBES — the stems that decide whether a language has a word for the Celsius and Fahrenheit
 * scales. Both halves of this block exist because both directions went wrong at once.
 *
 * ⚠ FALSE ABSENCE: the Celsius stem ended in `i`, so `Ċelsju` — what Maltese writes and what its layer
 * EMITS — reported as no word at all, and Polish's genitive `Celsjusza` likewise. A borrowing is not always
 * Latinate, and the class whose whole job is to say whether the word exists was saying no for languages that
 * say it correctly.
 *
 * ⚠ FALSE PRESENCE, WHICH THE FIX FOR THE FIRST ONE SURFACED: a bare `faren` stem matches ordinary words in
 * three languages, every one of them trap 37 — a real token in the wrong sense.
 *
 *     mos  `Fãrens`      FRANCE, in `Alencon, Farens`
 *     lv   `farenozojs`  the PHANEROZOIC eon, in a sentence listing `proterozojs` before it
 *     tr   `farenjit`    PHARYNGITIS /faɾenʒit/ — Turkish for Fahrenheit is *Fahrenhayt*
 *
 * Every genuine rendering keeps the `h` of *Fahrenheit* somewhere, so requiring it costs nothing real.
 */
describe("SCALE_PROBES", () => {
    test("Celsius is recognised in a non-Latinate borrowing", () => {
        for (const w of ["Celsius", "Ċelsju", "Celsjusza", "Selsiyis", "sentigrad"])
            expect(SCALE_PROBES.celsius.test(foldMarks(w)), w).toBe(true);
    });

    test("Fahrenheit keeps its `h`, and the three collisions stay out", () => {
        for (const w of ["Fahrenheit", "Farenheit", "Fārenheita", "farenhajt"])
            expect(SCALE_PROBES.fahrenheit.test(foldMarks(w)), w).toBe(true);
        // ⚠ the half that matters: real words that are not the scale
        for (const w of ["Fãrens", "farenozojs", "farenjit"])
            expect(SCALE_PROBES.fahrenheit.test(foldMarks(w)), w).toBe(false);
    });

    test("foldMarks strips diacritics without joining words", () => {
        expect(foldMarks("Ċelsju")).toBe("Celsju");
        expect(foldMarks("Sèlsiyis")).toBe("Selsiyis");
        expect(foldMarks("a b")).toBe("a b"); // no space collapsing — a fold is not a tokenizer
    });
});
