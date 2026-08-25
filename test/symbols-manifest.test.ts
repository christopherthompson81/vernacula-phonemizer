/**
 * The SHARED SYMBOL TIER's data — percent, currency, units, exponents, magnitudes — read from each
 * language's manifest instead of a literal in its engine file.
 *
 * ⚠ THE COMMENTS ARE THE POINT, not just the data. Each tier body carried the evidence for every declared
 * unit: why a bare `m` is declared, why ⟨V⟩ and ⟨W⟩ are capital, which hazards are bounded and unattested.
 * That is the part that cannot be reconstructed, so it moved verbatim with the values it explains.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST as AF } from "../src/languages/afrikaans/manifest.ts";
import { MANIFEST as NL } from "../src/languages/dutch/manifest.ts";
import { MANIFEST as TR } from "../src/languages/turkish/manifest.ts";
import { MANIFEST as HA } from "../src/languages/hausa/manifest.ts";
import { MANIFEST as MI } from "../src/languages/maori/manifest.ts";
import { MANIFEST as UMB } from "../src/languages/umbundu/manifest.ts";
import { MANIFEST as KO } from "../src/languages/korean/manifest.ts";
import { MANIFEST as CEB } from "../src/languages/cebuano/manifest.ts";
import { MANIFEST as DE } from "../src/languages/german/manifest.ts";
import { MANIFEST as EL } from "../src/languages/greek/manifest.ts";
import { MANIFEST as PL } from "../src/languages/polish/manifest.ts";
import { MANIFEST as HU } from "../src/languages/hungarian/manifest.ts";
import { MANIFEST as RU } from "../src/languages/russian/manifest.ts";
import { MANIFEST as FR } from "../src/languages/french/manifest.ts";

interface Tier { symbolTier: { percent: string[]; units: Record<string, string[]>; currency: Record<string, string[]> } }

const LANGS: [string, Tier, string][] = [
    ["af", AF, "dit is 5 km ver"],
    ["nl", NL, "het is 5 km ver"],
    ["tr", TR, "bu 5 km uzakta"],
    ["ha", HA, "yana da nisan 5 km"],
    ["mi", MI, "he 5 km te tawhiti"],
    ["ceb", CEB, "lima ka 5 km"],
    ["de", DE, "das sind 5 km"],
    ["el", EL, "είναι 5 km"],
    ["pl", PL, "to 5 km"],
    ["hu", HU, "ez 5 km"],
    ["ru", RU, "это 5 км"],
    ["fr", FR, "c'est 5 km"],
];

describe.each(LANGS)("%s reads its symbol tier from the manifest", (code, DEF, kmSentence) => {
    const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

    test("the unit noun comes from the manifest", () => {
        // ⚠ ANY DECLARED FORM, not index 0. The count decides which one a language uses, and 5 takes the
        // PLURAL in Greek (χιλιόμετρα) — asserting the singular fails on a correct reading.
        const forms = DEF.symbolTier.units["km"]!;
        expect(forms.some((f) => say(kmSentence).includes(say(f))), `no declared km form in the reading`).toBe(true);
    });

    test("percent and currency are declared and reached", () => {
        expect(DEF.symbolTier.percent.length).toBeGreaterThan(0);
        expect(Object.keys(DEF.symbolTier.currency).length).toBeGreaterThan(0);
    });
});

/**
 * ⚠ `percentPrefix` IS WORD ORDER, AND LOSING IT IS SILENT. Turkish and Hausa put the percent word BEFORE
 * the number (*yüzde elli*, not *elli yüzde*). The flag reached the jsonc in the first pass and nothing
 * wired it back, so both languages quietly reversed — no error, no throw, just the wrong order. Caught by
 * the probe, and pinned here.
 */
describe.each([["tr", TR, "% 50 insan", "yüzde"], ["ha", HA, "50 % na mutane", "kashi"]] as const)(
    "%s puts the percent word before the number", (code, DEF, sentence, word) => {
        test("the reading leads with the percent word, not the numeral", () => {
            const words = phonemize(sentence, code).replace(/[ˈˌ]/gu, "").split(" ");
            const pct = phonemize(DEF.symbolTier.percent[0]!, code).replace(/[ˈˌ]/gu, "").split(" ")[0]!;
            expect(words[0], `${code}: expected ${word} first`).toBe(pct);
        });
    },
);

/**
 * ⚠ FOUR LANGUAGES PASSED THE DECIMAL WORD AS A BARE LITERAL while 35 declared it. The same fact was
 * manifest data in Dutch (`decimalWord: "komma"`) and a string in the code next door in Afrikaans.
 */
describe("the decimal word is declared, not written into the engine", () => {
    // ⚠ THE KEY IS NOT IN THE SAME PLACE IN EVERY LANGUAGE: Afrikaans declares it at the top level (added
    // here), Dutch nests it under `numbers`. The test reads whichever exists rather than assuming a shape.
    test.each([["af", AF, "dit is 12.5 meter"], ["nl", NL, "het is 12,5 meter"]] as const)(
        "%s reads its declared decimalWord", (code, DEF, sentence) => {
            const d = DEF as unknown as { decimalWord?: string; numbers?: { decimalWord?: string } };
            const w = d.decimalWord ?? d.numbers?.decimalWord ?? "";
            expect(w.length).toBeGreaterThan(0);
            // ⚠ STRIP STRESS FROM BOTH SIDES. The sentence carries [kˈɔma] and the bare word [kɔma]; stripping
            // only one of them fails on a correct reading.
            const bare = (x: string): string => phonemize(x, code).replace(/[ˈˌ]/gu, "");
            expect(bare(sentence)).toContain(bare(w));
        },
    );
});

/**
 * ⚠ `4x4` IS IN EVERY PROBE FROM HERE ON, and the reason is a bug the probes MISSED. Batch 1 dropped
 * Afrikaans's `Multiply` in the C# port and `4x4` read *fˈir ˈɛks fˈir* — "four EX four", the letter name —
 * instead of *fˈir kˈiər fˈir*. No probe line covered it; the single `4x4` row in the af GOLDEN is what
 * caught it. ASCII ⟨x⟩ between digits is the case a symbol-tier port loses most quietly, because the output
 * stays plausible.
 */
describe("the ASCII multiply sign survives the lift", () => {
    test.each([["af", "'n 4x4 voertuig"], ["nl", "een 4x4 wagen"], ["ceb", "4x4 nga sakyanan"],
               ["de", "ein 4x4 Wagen"], ["pl", "auto 4x4 nowe"], ["fr", "un 4x4 neuf"]] as const)(
        "%s does not read x as a letter name", (code, sentence) => {
            const said = phonemize(sentence, code).replace(/[ˈˌ]/gu, "");
            const letterX = phonemize("x", code).replace(/[ˈˌ]/gu, "");
            expect(said, `${code}: the x is being spelled`).not.toContain(letterX);
        },
    );
});

/**
 * ⚠ THE INDIC GROUP FILES ITS TIER UNDER `symbolTier`, NOT `symbols`, and the collision is real: `symbols`
 * already means the BARE-SIGN → word map the abugida engine's own tokenizer reads (`% → প্রতিশত`, `₹`
 * stripped). Two different tables, read by two different passes. Filing both under one name would be the
 * PREFIX_GUESS shape — and here it also would not compile.
 */
import { MANIFEST as BN } from "../src/languages/bengali/manifest.ts";
import { MANIFEST as GU } from "../src/languages/gujarati/manifest.ts";
import { MANIFEST as KN2 } from "../src/languages/kannada/manifest.ts";
import { MANIFEST as OR } from "../src/languages/odia/manifest.ts";

const INDIC: [string, { symbolTier?: { percent?: string[] }; symbols?: Record<string, string> }, string][] = [
    ["bn", BN, "50 % মানুষ"],
    ["gu", GU, "50 % લોકો"],
    ["kn", KN2, "50 % ಜನರು"],
    ["or", OR, "50 % ଲୋକ"],
];

describe.each(INDIC)("%s keeps the two symbol tables apart", (code, DEF, pctSentence) => {
    test("the tier's percent word is read, and it is not the tokenizer's sign map", () => {
        const pct = DEF.symbolTier?.percent?.[0];
        expect(pct, `${code}: no symbolTier.percent`).toBeDefined();
        const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");
        expect(say(pctSentence)).toContain(say(pct!));
    });

    test("a declared unit key is actually read", () => {
        // ⚠ NOT EVERY LANGUAGE DECLARES `units` HERE: bengali keeps a manifest OVERRIDE with a code fallback
        // (`def.unitWords ?? BENGALI_UNITS`) and kannada declares none, so the assertion is conditional on
        // the key existing rather than assuming a uniform shape across the group.
        const units = (DEF.symbolTier as { units?: Record<string, string[]> } | undefined)?.units;
        if (units === undefined) return;
        const [key, forms] = Object.entries(units)[0]!;
        const say = (x: string): string => phonemize(x, code).replace(/[ˈˌ]/gu, "");
        const said = say(`5 ${key}`);
        expect(forms.some((f) => said.includes(say(f))), `${code}: 5 ${key} did not read a declared form`).toBe(true);
    });

    test("`symbols` — where declared — is the bare-sign map, a DIFFERENT table", () => {
        // ⚠ THIS ASSERTION IS ABOUT `symbols`, NOT `symbolTier`, and a blanket rename over test/ rewrote it
        // to the wrong one — turning the test that documents the distinction into a test that denied it.
        // It maps a single sign CHARACTER to a word; the tier maps a unit/currency KEY to count forms.
        const signMap = (DEF as { symbols?: Record<string, string> }).symbols;
        if (signMap === undefined) return;
        for (const k of Object.keys(signMap)) expect([...k]).toHaveLength(1);
    });
});

/**
 * ⚠ `unspacedScript` IS A BOOLEAN THAT CHANGES GUARDS, AND LOSING IT IS SILENT — the shape `percentPrefix`
 * already demonstrated in batch 1. The tier's boundary guards assume spaces between words; Chinese, Japanese
 * and Thai have none, so without the flag the ORDINARY case is the one the guard rejects and `為$500` drops
 * its currency sign entirely. Probed on UNSPACED input, which is the only input that can tell.
 */
import { MANIFEST as YUE } from "../src/languages/cantonese/manifest.ts";
import { MANIFEST as JA } from "../src/languages/japanese/manifest.ts";
import { MANIFEST as CMN2 } from "../src/languages/mandarin/manifest.ts";
import { MANIFEST as TH2 } from "../src/languages/thai/manifest.ts";

const UNSPACED: [string, { symbolTier: { unspacedScript?: boolean; currency: Record<string, string[]> } }, string][] = [
    ["yue", YUE as never, "為$500。"],
    ["ja", JA as never, "$500の価格。"],
    ["cmn", CMN2 as never, "价格$500。"],
    ["th", TH2 as never, "ราคา $500."],
];

describe.each(UNSPACED)("%s declares unspacedScript and reads a sign with no space", (code, DEF, sentence) => {
    test("the flag is declared", () => {
        expect(DEF.symbolTier.unspacedScript, `${code}: unspacedScript missing`).toBe(true);
    });

    test("the currency sign is READ, not dropped", () => {
        const say = (x: string): string => phonemize(x, code).replace(/[ˈˌ]/gu, "");
        const forms = DEF.symbolTier.currency["$"]!;
        expect(forms.some((f) => say(sentence).includes(say(f))),
            `${code}: $ dropped from an unspaced context`).toBe(true);
    });
});

/**
 * ⚠ THE THREE LANGUAGES THAT SHARE `HindiDef` NOW AGREE ON WHERE THE TIER LIVES — but they got there by
 * three different routes, and the test records that rather than flattening it:
 *   · `hi` and `gu` declare a `symbolTier` block in their own jsonc;
 *   · `mr` was ALREADY fully manifest-backed from an earlier lift (#953) under TOP-LEVEL keys
 *     (`percent`, `currency`, `units`, `multiply`, `ampersand`), so it has no `symbolTier` at all and
 *     lifting it again would have created an empty block. Its tier reads `DEF.*` directly.
 * The invariant that matters is not "every language has the same key" — it is that NO language reads a
 * hard-coded table.
 */
import { MANIFEST as HI } from "../src/languages/hindi/manifest.ts";
import { DEF as MR } from "../src/languages/marathi/marathi.ts";

describe("the HindiDef family is manifest-backed by three different routes", () => {
    test("hi declares a symbolTier block", () => {
        expect((HI as { symbolTier?: object }).symbolTier).toBeDefined();
    });

    test("mr has NO symbolTier, and that is correct — its tier reads top-level keys", () => {
        expect((MR as { symbolTier?: object }).symbolTier).toBeUndefined();
        // The keys its tier actually reads, lifted in #953.
        for (const k of ["percent", "currency", "units", "multiply", "ampersand"])
            expect(MR, `mr: ${k} missing`).toHaveProperty(k);
    });

    test("both read the same declared percent word as the engine emits", () => {
        const sayHi = (x: string): string => phonemize(x, "hi").replace(/[ˈˌ]/gu, "");
        const sayMr = (x: string): string => phonemize(x, "mr").replace(/[ˈˌ]/gu, "");
        const hiPercent = (HI as never as { symbolTier: { percent: string[] } }).symbolTier.percent[0];
        expect(hiPercent, "hi: symbolTier.percent is empty").toBeTypeOf("string");
        expect(sayHi("50% लोग")).toContain(sayHi(hiPercent!));
        expect(sayMr("50% लोक")).toContain(sayMr((MR as never as { percent: { plural: string } }).percent.plural));
    });
});

/**
 * BATCH 7 — the last seven. Two of them are the reason this block is separate from the generic table above.
 *
 * ⚠ SWAHILI PUTS THE NOUN FIRST, AND THE TWO FLAGS THAT SAY SO WERE ALMOST LOST. `currencyPrefix` and
 * `unitPrefix` reached the manifest and would have been dropped on the way back: the sweep's applier carried
 * a HAND-WRITTEN list of tier keys that predated both fields, so the data would have sat in the jsonc with
 * nothing reading it and *dola 30* / *kilomita 19* would have quietly become *30 dola* / *19 kilomita* — the
 * `percentPrefix` failure from batch 1, twice over. Both appliers now derive their key list from `SymbolData`
 * itself. Pinned here on the reading, which is the only place the flags are visible.
 */
import { MANIFEST as AM } from "../src/languages/amharic/manifest.ts";
import { MANIFEST as AR } from "../src/languages/arabic/manifest.ts";
import { MANIFEST as JV } from "../src/languages/javanese/manifest.ts";
import { MANIFEST as QU } from "../src/languages/quechua/manifest.ts";
import { MANIFEST as SW } from "../src/languages/swahili/manifest.ts";
import { MANIFEST as TG } from "../src/languages/tajik/manifest.ts";
import { MANIFEST as YO } from "../src/languages/yoruba/manifest.ts";

const BATCH7: [string, { symbolTier: { units: Record<string, string[]>; currency: Record<string, string[]> } }, string, string][] = [
    ["am", AM as never, "70 km ርቀት", "$50 እና"],
    ["ar", AR as never, "70 km مَسَافَة", "$50 وَ"],
    ["jv", JV as never, "70 km adoh", "$50 lan"],
    ["qu", QU as never, "70 km karu", "$30 qullqi"],
    ["sw", SW as never, "70 km umbali", "$50 na"],
    ["tg", TG as never, "70 km дур", "$50 ва"],
    ["yo", YO as never, "70 km jìnnà", "$30 owó"],
];

describe.each(BATCH7)("%s reads its symbol tier from the manifest", (code, DEF, kmSentence, dollarSentence) => {
    const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

    test("the km noun in the reading is a form the manifest declares", () => {
        const forms = DEF.symbolTier.units["km"] ?? DEF.symbolTier.units["км"]!;
        expect(forms.some((f) => say(kmSentence).includes(say(f))), `${code}: no declared km form`).toBe(true);
    });

    test("the dollar noun in the reading is a form the manifest declares", () => {
        const forms = DEF.symbolTier.currency["$"]!;
        expect(forms.some((f) => say(dollarSentence).includes(say(f))), `${code}: no declared $ form`).toBe(true);
    });
});

describe("swahili emits the measure noun BEFORE the number, as the manifest's two flags say", () => {
    const say = (s: string): string => phonemize(s, "sw").replace(/[ˈˌ]/gu, "");
    const tier = SW.symbolTier as { unitPrefix: boolean; currencyPrefix: boolean; units: Record<string, string[]>; currency: Record<string, string[]> };

    test("both flags are declared in the manifest", () => {
        expect(tier.unitPrefix, "sw: unitPrefix missing").toBe(true);
        expect(tier.currencyPrefix, "sw: currencyPrefix missing").toBe(true);
    });

    test("the unit noun leads the reading of `70 km`", () => {
        // Whole-token comparison, not `startsWith`: a prefix match would also pass on *kilomitaXX*.
        expect(say("70 km").split(" ")[0]).toBe(say(tier.units["km"]![0]!));
    });

    test("the currency noun leads the reading of `$50`", () => {
        expect(say("$50").split(" ")[0]).toBe(say(tier.currency["$"]![0]!));
    });
});

/**
 * ⚠ TWO LANGUAGES DECLARE NO PERCENT AND BOTH ARE RIGHT, for two DIFFERENT reasons — which is why this is a
 * test and not a lint rule that would flag them as incomplete:
 *   · `qu` — no sourceable word. The field is optional precisely so a language can take the tier for
 *     everything else and leave the sign where the leak gates can see it.
 *   · `yo` — the percent is a CIRCUMFIX (`ìdá 84 nínú ọgọ́rùn-ún`), which the tier cannot express: its
 *     `percentPrefix` moves ONE word to the front. Yoruba's own rule consumes every `%` before the tier
 *     runs, so the `percent`/`percentPrefix` pair declared here was DEAD — wrecking the manifest key moved
 *     zero readings. Both were removed. This test is what stops them coming back.
 */
describe("a missing percent is a decision, not a gap", () => {
    test("qu declares no percent word, and invents none", () => {
        expect((QU.symbolTier as { percent?: string[] }).percent).toBeUndefined();
        // ⚠ THE SIGN IS NOT IN THE IPA — the tokenizer drops it downstream, so the leak gates see it in the
        // NORMALIZED string, not here. What this asserts is the part that matters at the output: the reading
        // of `50%` is exactly the reading of `50`, with no word conjured for a sign the language cannot say.
        expect(phonemize("50% runa", "qu")).toBe(phonemize("50 runa", "qu"));
    });

    test("yo declares neither percent nor percentPrefix in the tier", () => {
        const tier = YO.symbolTier as { percent?: string[]; percentPrefix?: boolean };
        expect(tier.percent, "yo: the tier's percent is dead — rule 3 consumes every %").toBeUndefined();
        expect(tier.percentPrefix, "yo: percentPrefix cannot express a circumfix").toBeUndefined();
    });

    test("yo still reads its circumfix, from the OTHER manifest table", () => {
        const say = (s: string): string => phonemize(s, "yo").replace(/[ˈˌ]/gu, "");
        const sym = YO.symbols as unknown as { percentBefore: string; percentAfter: string };
        const said = say("50% àwọn ènìyàn");
        expect(said.startsWith(say(sym.percentBefore)), "yo: no percent word before the number").toBe(true);
        expect(said).toContain(say(sym.percentAfter));
    });
});

/**
 * ⚠ THE RATE IS ITS OWN ASSERTION, because unwiring `unitPer` broke NOTHING in the tests above. The sabotage
 * sweep proved the manifest key was live (wrecking it moved readings), but nothing in the coupling test read
 * it — and a key the tests do not touch is one a later refactor can drop in silence. `A per B` needs both
 * halves: the connective AND the denominator noun the abbreviation stands for.
 */
const RATES: [string, { symbolTier: { unitPer: string; rateDenominators: Record<string, string> } }, string, string][] = [
    ["jv", JV as never, "120 km/jam banter", "jam"],
    ["sw", SW as never, "120 km/h kasi", "h"],
    ["tg", TG as never, "120 км/соат тез", "соат"],
    ["yo", YO as never, "120 km/h yara", "h"],
];

describe.each(RATES)("%s reads both halves of a rate from the manifest", (code, DEF, sentence, denom) => {
    const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

    test("the connective and the denominator noun both come from the tier", () => {
        const said = say(sentence);
        expect(said, `${code}: unitPer missing from the reading`).toContain(say(DEF.symbolTier.unitPer));
        const word = DEF.symbolTier.rateDenominators[denom]!;
        expect(said, `${code}: rateDenominators.${denom} missing from the reading`).toContain(say(word));
    });
});
