/**
 * `review.ts`'s SOURCING extractor — the half of the checklist that asks where each high-traffic word came
 * from, and the one whose false report these tests exist to pin.
 *
 * ⚠ WHY THIS EXISTS. The check reported `[??] sourcing — no percent/currency/decimal word declared` for four
 * layers (bm, my, ps/pbt, ug) that declare a percent word, currency names and, in ug's case, an argued
 * refusal of the decimal word. All four own their symbol table LOCALLY rather than through
 * `makeSymbolNormalizer({…})`, and every arm of the extractor was anchored on a declaration shape. A local
 * table is legitimate and sometimes forced — the shared tier runs after `normalize.ts`, so a layer that
 * spends the decimal point has no adjacency left for a tier rule — so the fix was to read the local shape,
 * never to push those languages back onto the shared tier.
 *
 * ⚠ AND THE OTHER DIRECTION IS THE ONE THAT MATTERS MORE. The Lao layer shipped an INVENTED currency word
 * that appears in no source, and this line is what caught it. So a test that only proved "ug is green now"
 * would be half a test: every case below has a counterpart proving the check still reports a layer whose
 * word it genuinely cannot find, and still reports NOTHING for a layer that declares nothing.
 *
 * Every fixture is the SHAPE of a shipped rule, written with a nonsense word so no test can be satisfied by
 * the repo's own corpora.
 */
import { describe, expect, test } from "vitest";
import { localDeclarations, replaceCalls, stripComments, wordLiterals } from "../tools/normalization/review.ts";

/** A haystack whose only job is the sign-in-corpus gate — `hay.text` is what decides whether a currency
 *  name is worth checking at all. */
const hay = (text: string) => ({
    tokens: new Set(text.toLowerCase().split(/[^\p{L}\p{M}]+/u).filter((t) => t !== "")),
    text: text.toLowerCase(),
});
/** A corpus that writes every sign the fixtures key on. */
const WRITES_EVERYTHING = hay("prices 12% and $5 and 7₺ and ￥9 and ٪3");

describe("localDeclarations — a LOCAL table is a declaration", () => {
    test("a percent word emitted through a helper is found (the ug shape)", () => {
        // ug: `new RegExp(...)` rather than a literal regex, a FUNCTION replacement, and the word one hop
        // away in a helper's template. Three separate reasons the old one-shape arm saw nothing.
        const src = `
            const zzpercent = (n: string): string => \`\${n} kwibbleword \`;
            export function make() {
                return (s: string): string => s.replace(
                    new RegExp(\`(\\\\d+)\\\\s?[%٪]\`, "gu"),
                    (_m: string, n: string) => zzpercent(n),
                );
            }`;
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toContain("kwibbleword");
        expect(got.unread).toEqual([]);
    });

    test("a [sign, word] pair table is found even though the rule names neither (the ug currency shape)", () => {
        const src = `
            for (const [sign, word] of [["\\\\$", "zzdollarword"], ["₺", "zzliraword"]] as const) {
                s = s.replace(new RegExp(\`\${sign}\\\\s?(\\\\d+)\`, "gu"), \`$1 \${word} \`);
            }`;
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words.sort()).toEqual(["zzdollarword", "zzliraword"]);
        expect(got.unread).toEqual([]);
    });

    test("a word nested inside a template interpolation is found (the ps shape)", () => {
        // `${named?.trim() ?? "سلنه"}` — the template swallows the string, so the two scans are separate.
        const src = 's = s.replace(new RegExp(`(\\\\d+)\\\\s?[٪%](\\\\s*zz)?`, "gu"), '
            + '(_m: string, n: string, named: string | undefined) => `${n} ${named?.trim() ?? "zzsalanaword"}`);';
        expect(localDeclarations(src, WRITES_EVERYTHING).words).toContain("zzsalanaword");
    });

    test("a plain string replacement is found (the my/is/ro shape)", () => {
        const src = 't = t.replace(new RegExp(`(\\\\d+)\\\\s*[%％]`, "gu"), "$1 zzhnoonword");';
        expect(localDeclarations(src, WRITES_EVERYTHING).words).toEqual(["zzhnoonword"]);
    });

    test("a currency name is only checked when the corpus writes its sign", () => {
        // The rule the tier arm has always followed: a language that never writes ¥ never speaks its yen
        // word, so demanding attestation for it is noise.
        const src = 'for (const [sign, word] of [["₺", "zzliraword"], ["₩", "zzwonword"]] as const) { '
            + 's = s.replace(new RegExp(sign, "gu"), word); }';
        const got = localDeclarations(src, hay("prices 7₺ only"));
        expect(got.words).toEqual(["zzliraword"]);
    });
});

describe("localDeclarations — what must NOT count as a declaration", () => {
    test("a comment naming the word is not a rule emitting it", () => {
        const src = `
            /** SOURCING. The percent word would be \`zzcommentword\` and the sign is %. */
            // and \`makeSymbolNormalizer\` is named here only to say why this layer does not call it.
            const x = 1;`;
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual([]);
        expect(got.unread).toEqual([]);
    });

    test("`n % 10` is arithmetic, not a percent rule (the en ordinal-suffix shape)", () => {
        const src = 's = s.replace(/(\\d+)(?=\\b)/gu, (m: string) => { const k = Number(m) % 10; '
            + 'return k === 1 ? `${m}st` : `${m}th`; });';
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.unread).toEqual([]);
        expect(got.words).toEqual([]);
    });

    test("`$1` and a trailing `$` anchor are not currency signs", () => {
        const src = 's = s.replace(/(\\p{L}+)\\s+(\\d+)$/gu, "$2 $1");';
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual([]);
        expect(got.unread).toEqual([]);
    });

    test("a layer with no symbol rule at all declares NOTHING, and says so", () => {
        // The honest `[??] no percent/currency/decimal word declared` — a real state, and the branch that
        // must survive: a date-and-script layer has nothing to source.
        const src = `
            export function normalizeZz(s: string): string {
                return s.replace(/(\\d{4})-(\\d{2})-(\\d{2})/gu, "$3 $2 $1").replace(/\\u200c/gu, "");
            }`;
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual([]);
        expect(got.unread).toEqual([]);
    });

    test("a percent rule whose word cannot be read reports UNREAD, never a silent pass", () => {
        // ⚠ THE DIRECTION THAT COSTS THE LAO CATCH. The word comes from an imported table, so there is no
        // literal to read and no definition to hop to. The extractor must say it went blind — an empty
        // `words` with an empty `unread` would let the caller print "nothing declared" for a layer that
        // plainly declares something.
        const src = 's = s.replace(/(\\d+)\\s?%/gu, (_m: string, n: string) => `${n} ${IMPORTED.percentWord}`);';
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual([]);
        expect(got.unread).toEqual(["percent"]);
    });

    test("an unreadable class is reported alongside the words of a readable one", () => {
        // A half-read layer is the worst case for a green line: the currency word checks out, the percent
        // word was never seen, and reporting `all 1 attested` would hide the second half.
        const src = 'for (const [sign, word] of [["₺", "zzliraword"]] as const) { s = s.replace(sign, word); }\n'
            + 's = s.replace(/(\\d+)\\s?%/gu, (_m: string, n: string) => `${n} ${IMPORTED.percentWord}`);';
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual(["zzliraword"]);
        expect(got.unread).toEqual(["percent"]);
    });

    test("a sign inside a LOOKAROUND is a guard, not a rule (the cy range shape)", () => {
        // `(?![%\p{Sc}])` means "stop before a percentage or a price" — the rule DECLINES the class. Read as
        // a declaration it contributed eleven needles: the unit table in the callback and, one hop on, the
        // digraph list.
        const src = 'const ZZUNITS = { km: "zzkilometrword", m: "zzmetrword" };\n'
            + 's = s.replace(/(\\d+)\\s?-\\s?(\\d+)(?![%\\p{Sc}])/gu, (_m: string, a: string, b: string) => '
            + '`${a} i ${b} ${ZZUNITS.km}`);';
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual([]);
        expect(got.unread).toEqual([]);
    });

    test("a sign-to-sign fold is not a reading (the ar `٪`→`%` shape)", () => {
        // Every Arabic dialect unifies the two percent signs before any rule runs. A LITERAL replacement
        // with no letter in it declares no word — and is no blindness either.
        const src = 's = s.replace(/٪/gu, "%").replace(/(\\d)\\.(\\d)/gu, "$1 $2");';
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual([]);
        expect(got.unread).toEqual([]);
    });

    test("a MANIFEST alias is data, not a blindness (the yo shape)", () => {
        // Yoruba emits its percent circumfix as `${SYM.percentBefore}` where `const SYM = MANIFEST.symbols`.
        // There is no word in the code because the words are DATA — which the manifest arm reads. Counted as
        // unread, it reported "could not read the word for percent" for a layer whose percent word the same
        // checklist line was printing.
        const src = 'const SYM = MANIFEST.symbols;\n'
            + 's = s.replace(/(\\d+)\\s?%/gu, (_m: string, n: string) => `${SYM.percentBefore} ${n}`);';
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual([]);
        expect(got.unread).toEqual([]);
    });

    test("an apostrophe in a character class does not swallow the call (the mg shape)", () => {
        // `/%\s*n['’]/` — reading the `'` as a string delimiter ran the scan past the comma, so the call
        // could not be split into pattern and replacement and its word vanished from the report. This one
        // regressed silently: mg went from four attested words to three.
        const src = `s = s.replace(/%\\s*n['’]/gu, " zzisanjaton'");`;
        expect(localDeclarations(src, WRITES_EVERYTHING).words).toEqual(["zzisanjaton'"]);
    });

    test("the hop stops at the end of the helper, not at the next semicolon (the az shape)", () => {
        // A `function` body needs no semicolon, so a definition scanner that stops at the next depth-0 `;`
        // runs off the end and swallows whatever follows. Azerbaijani's percent rule hops through a suffix
        // helper, and the era table declared after it came back as unsourced percent vocabulary.
        const src = 'function zzharmonise(stem: string): string {\n'
            + '    if (stem.length > 2) { return stem; }\n'
            + '    return stem;\n'
            + '}\n'
            + 'const ZZERA = [["b\\\\.e\\\\.", "zzeraword zzbeforeword"]] as const;\n'
            + 's = s.replace(/(\\d+)\\s?%/gu, (_m: string, d: string) => `${d} zzfaiz${zzharmonise("zzfaiz")}`);';
        const got = localDeclarations(src, WRITES_EVERYTHING);
        expect(got.words).toEqual(["zzfaiz"]);
    });

    test("a Unicode normalization form is an API argument, not a word (the yo shape)", () => {
        // Yoruba's percent rule calls a tone-folding helper whose body is `.normalize("NFD")`. One hop on,
        // `NFD` was reported as an unsourced Yoruba word — the same false positive the `spelling → g2p`
        // check hit on `"NFC"`.
        const src = 'const zzfold = (x: string): string => x.normalize("NFD").replace(/\\p{M}+/gu, "");\n'
            + 's = s.replace(/(\\d+)\\s?%/gu, (_m: string, n: string) => `${n} ${zzfold("zzpercentword")}`);';
        expect(localDeclarations(src, WRITES_EVERYTHING).words).toEqual(["zzpercentword"]);
    });

    test("the RegExp FLAGS argument is not a word", () => {
        // `gu` was the first needle ug reported after the extractor learned to read local tables, and it
        // read as an unsourced word in the checklist.
        const src = 't = t.replace(new RegExp("(\\\\d+)\\\\s*%", "gu"), "$1 zzword");';
        expect(localDeclarations(src, WRITES_EVERYTHING).words).toEqual(["zzword"]);
    });
});

describe("the pieces", () => {
    test("replaceCalls splits pattern from replacement and keeps a whole callback", () => {
        // The pattern/replacement split is what stops a `(?![%\p{Sc}])` GUARD from reading as a rule; the
        // balanced walk is what stops a callback's own `;` from cutting the word off the end.
        const src = 's = s.replace(/x(?![%\\p{Sc}])/gu, (m) => { const k = 1; return `${m}${k}`; });';
        const calls = replaceCalls(src);
        expect(calls).toHaveLength(1);
        expect(calls[0]!.pattern).toContain("(?![%");
        expect(calls[0]!.replacement).toContain("return");
    });

    test("wordLiterals reads a string nested inside a template interpolation", () => {
        expect(wordLiterals('`${a ?? "zzinner"} zzouter`').sort()).toEqual(["zzinner", "zzouter"]);
    });

    test("stripComments removes both comment forms and leaves a URL alone", () => {
        expect(stripComments("const u = 'https://x/y'; // note\n/* block */ const v = 2;"))
            .toBe("const u = 'https://x/y'; \n const v = 2;");
    });
});
