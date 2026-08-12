/**
 * Reproducibility and correctness of the normalization miner.
 *
 * The miner's output is an ARTIFACT that gets committed and reviewed, so byte-stability across runs is a
 * property worth holding: a selection that reorders itself between runs makes every regeneration look like
 * a change and destroys the diff. Nothing in the pipeline may consult a clock or a random source — the
 * `sample` tier uses a deterministic stride for exactly this reason.
 *
 * The rest of these are regressions for bugs the Burmese run actually produced.
 */
import { describe, expect, test } from "vitest";
import { parseJsonc } from "../src/core/jsonc.ts";
import { SAMPLE_CAVEAT, extracts, mapPool, segment, selectCells, renderJsonc } from "../tools/normalization/mine.ts";
import { CELLS, staleness } from "../tools/normalization/cells.ts";

const TERMINATORS = ".!?။።۔؟।॥…。！？៕";

/** Burmese, because it is the language whose native digits and native terminator broke the ASCII
 *  assumptions. Every fixture below is the SHAPE of a real mined passage, not a real one. */
const BURMESE = [
    "မြန်မာနိုင်ငံတွင် လူဦးရေ ၉၈% သည် ၁၈၅၅ ခုနှစ်တွင် နေထိုင်ခဲ့ကြသည်။",
    "အပူချိန်သည် ၃၅°C ရှိပြီး ညနေ ၁၄:၃၀ အချိန်တွင် မိုးရွာသွန်းခဲ့သည်။",
    "U.S. နှင့် U.K. တို့သည် ကမ္ဘာ့နိုင်ငံကြီးများ ဖြစ်ကြသည်။",
    "ဤစာသည် အင်္ဂလိပ်စာလုံး တစ်လုံးမျှ မပါဝင်သော ရိုးရှင်းသည့် ဝါကျတစ်ခု ဖြစ်ပါသည်။",
].join(" ");

describe("normalization miner", () => {
    test("selection is byte-identical across runs", () => {
        const segs = segment(BURMESE, "sentence", TERMINATORS);
        const a = selectCells(segs, { perCell: 3 });
        const b = selectCells(segs, { perCell: 3 });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("the rendered JSONC is byte-identical across runs and parses once comments are stripped", () => {
        const segs = segment(BURMESE, "sentence", TERMINATORS);
        const sel = selectCells(segs, { perCell: 3 });
        const doc = { language: "my", source: "fixture", segmentMode: "sentence" as const, totalSegments: segs.length, counts: sel.counts, asciiCounts: sel.asciiCounts, picked: sel.picked, sample: segs.slice(0, 2) };
        const one = renderJsonc(doc), two = renderJsonc(doc);
        expect(one).toBe(two);
        // The repo's own JSONC parser, not a regex strip — the counts block carries TRAILING comments
        // on the same line as data, which a line-anchored strip leaves behind.
        const parsed = parseJsonc<{ language: string; hard: unknown[] }>(one);
        expect(parsed.language).toBe("my");
        expect(parsed.hard.length).toBe(sel.picked.length);
    });

    // The bug that emptied three cells: `.` is a sentence terminator, so `U.S.` split into `U.` and `S.`,
    // both below the minimum length, and `dotted` / `era-marker` / `abbrev` read zero across 786k Burmese
    // sentences while a grep of the same text found 1437 dotted forms.
    test("sentence mode does not split an abbreviation dot", () => {
        const segs = segment(BURMESE, "sentence", TERMINATORS);
        expect(segs.some((s) => s.includes("U.S."))).toBe(true);
        const counts = selectCells(segs, { perCell: 3 }).counts;
        expect(counts["dotted"]).toBeGreaterThan(0);
    });

    test("paragraph mode never interprets a dot at all", () => {
        const segs = segment("ပထမ စာပိုဒ်။ U.S. နှင့် U.K. တို့ဖြစ်သည်။ ဤသည်မှာ အလွန်ရှည်လျားသော စာကြောင်းတစ်ခုဖြစ်သည်။\nဒုတိယ စာပိုဒ်တွင် ၉၈% နှင့် ၃၅°C တို့ ပါဝင်ပြီး နောက်ထပ် အချက်အလက်များစွာ ရှိပါသေးသည်။", "paragraph", TERMINATORS);
        expect(segs.length).toBe(2);
        expect(segs[0]).toContain("U.S.");
    });

    // The trap the whole tool exists to avoid: `\d` is ASCII-only under `u`, so a selector built on it is
    // blind to every language that writes its own numerals.
    test("selectors match native digits, which an ASCII selector would miss", () => {
        const segs = segment(BURMESE, "sentence", TERMINATORS);
        const { counts, asciiCounts } = selectCells(segs, { perCell: 3 });
        expect(counts["percent"]).toBeGreaterThan(0);
        expect(asciiCounts["percent"]).toBe(0); // ← \d finds none of them
        expect(counts["year"]).toBeGreaterThan(0);
        expect(asciiCounts["year"]).toBe(0);
    });

    /**
     * ⚠ THE DEFECT THAT SILENTLY DESTROYED THE FILL STEP, and it was invisible to every other check.
     *
     * `extracts` collapsed `\s+` across the whole extract, which is right for an intro (one paragraph) and
     * wrong for the full article the fill pulls: the article became one line of a median 19,029 characters,
     * paragraph mode splits on `\n` alone, and the 1,200-character ceiling then discarded it. Measured:
     * `he` 65 filled articles → **1** usable segment, `fi` 59 → 2, `ka` 111 → 12.
     *
     * The visible symptom was six languages reporting thousands of `insource:` hits per cell, "pulled 8
     * articles" each, and coverage moving 23→24. The plausible explanation — the pattern lives in infoboxes,
     * which plain-text extraction drops — was wrong, and would have been recorded as a limit of the method.
     */
    test("a full-article extract keeps its paragraph boundaries, so paragraph mode can segment it", () => {
        const para = (n: number): string => `Paragraph ${n}. `.padEnd(400, `text about subject ${n} `);
        const json = { query: { pages: { 1: { extract: `${para(1)}\n\n== Heading ==\n\n${para(2)}\n${para(3)}` } } } };
        const lines = extracts(json, false);
        expect(lines).toHaveLength(3);
        // Every line must survive the paragraph-mode ceiling, which is what the old code failed.
        const segs = segment(lines.join("\n"), "paragraph", TERMINATORS);
        expect(segs).toHaveLength(3);
        // And no line may carry a newline of its own — paragraph mode's contract is one paragraph per line.
        expect(lines.every((l) => !l.includes("\n"))).toBe(true);
    });

    test("an intro-shaped extract is unchanged by the paragraph split", () => {
        const json = { query: { pages: { 1: { extract: "Ein  einzelner   Absatz mit reichlich Text darin, lang genug für die Untergrenze." } } } };
        expect(extracts(json, true)).toEqual(["Ein einzelner Absatz mit reichlich Text darin, lang genug für die Untergrenze."]);
    });

    /**
     * ⚠ A RENDERED TEMPLATE ERROR IS ENGLISH SPLICED INTO THE SENTENCE, and only the API route can produce it —
     * a dump carries unexpanded wikitext. Found in Magahi by the template-field detector: `is` and
     * `deprecated` came back as field-like words in 17% of segments at rate 1.02, the signature of a fixed
     * string rather than vocabulary. 131 of 759 paragraphs carried `code: raj is deprecated raj`.
     */
    test("a paragraph carrying a rendered template error is discarded whole", () => {
        const good = "अजमेर मण्डल एगो भारत के राज्य में स्थित एगो जिला हवे जेकर मुख्यालय अजमेर शहर में बा।";
        const bad = "अजमेर मण्डल (अजमेर जिला; मारवाड़ी: अजमेर जिल्लौcode: raj is deprecated raj) एगो जिला हवे।";
        const json = { query: { pages: { 1: { extract: `${good}\n${bad}` } } } };
        expect(extracts(json, false)).toEqual([good]);
    });

    /**
     * ⚠ THE CAVEAT INVERTED ITSELF ON THE FIRST AWKWARD SOURCE STRING. `mag` records "… NO DUMP is published
     * for this wiki", and a bare `/\bdump\b/i` matched it — so the artifact told its reader that its sample
     * IS the language's real distribution, about an API fetch with no dump behind it. Backwards, in the one
     * field whose job is to stop a reader over-trusting the data.
     */
    test("the sample caveat matches the canonical dump form and fails closed on a negation", () => {
        const dumpish = SAMPLE_CAVEAT("bm.wikipedia.org dump (pages-articles, paragraphs)");
        expect(dumpish).toContain("dump-sourced");
        expect(dumpish).toContain("real distribution");
        // The negation must win, whatever else the string says.
        for (const s of [
            "mag.wikipedia.org (random 400 + targeted insource: fill; NO DUMP is published for this wiki)",
            "xx.wikipedia.org (api only — not a dump)",
        ]) expect(SAMPLE_CAVEAT(s), s).toContain("API-sourced");
        // The bare word alone is no longer enough to claim dump provenance.
        expect(SAMPLE_CAVEAT("some notes mentioning a dump somewhere")).toContain("API-sourced");
        expect(SAMPLE_CAVEAT("FLEURS de_de")).toContain("corpus-sourced");
    });

    test("every cell has a unique key, and each non-lexical cell has a fill query", () => {
        expect(new Set(CELLS.map((c) => c.key)).size).toBe(CELLS.length);
        for (const c of CELLS) {
            if (c.lexical || c.key === "zero-width") continue;
            expect(c.search, `${c.key} needs a search pattern to be fillable`).toBeDefined();
        }
    });

    // A cell's `search` is substituted with the language's digit range; if a digit-bearing pattern forgot
    // the {D} placeholder it would silently fill from ASCII digits only — the same bug one level up.
    test("a fill query that targets digits uses the {D} placeholder, not a literal 0-9", () => {
        for (const c of CELLS) {
            if (c.search === undefined) continue;
            expect(c.search, `${c.key} hardcodes an ASCII digit range`).not.toContain("0-9");
        }
    });
});

/**
 * The fill's article fetches are pooled — 9114 ms serial vs 1304 ms at 4 on a fixed 16-title list.
 * Two properties are load-bearing and neither is visible from the output of a successful run.
 */
describe("mapPool", () => {
    test("preserves RESULT ORDER even when completions arrive reversed", async () => {
        // The artifact is sampled per cell from the fetched file, so an order that depends on network timing
        // would make a re-fetch produce a different artifact from the same query.
        const out = await mapPool([80, 60, 40, 20, 0], 4, async (d, i) => {
            await new Promise((r) => setTimeout(r, d));
            return i;
        });
        expect(out).toEqual([0, 1, 2, 3, 4]);
    });

    test("a NON-NUMERIC limit falls back to serial instead of fetching NOTHING", async () => {
        // `--concurrency abc` gives NaN, and `Array.from({ length: NaN })` is the EMPTY array — zero workers,
        // `Promise.all([])` resolving at once, and a fetch that reports success having downloaded nothing.
        const seen: number[] = [];
        const out = await mapPool([1, 2, 3], Number("abc"), async (v) => { seen.push(v); return v * 2; });
        expect(out).toEqual([2, 4, 6]);
        expect(seen).toHaveLength(3);
    });

    test("a limit wider than the list, and an empty list, are both safe", async () => {
        expect(await mapPool([1, 2], 99, async (v) => v)).toEqual([1, 2]);
        expect(await mapPool([], 4, async (v) => v)).toEqual([]);
    });
});

/**
 * THE SENTENCE-BOUNDARY CELL and the backfill channel that let it be added at all. Both encode a
 * distinction that is invisible in a passing run: which marks belong to the cell, and the difference
 * between a mined corpus count and a presence lower bound read off an artifact's own retained text.
 */
describe("native-terminator", () => {
    const cell = CELLS.find((c) => c.key === "native-terminator")!;

    test("claims the boundary marks of every script that has one", () => {
        // Twelve scripts, and none of them was matched by ANY of the 35 cells that predate this one —
        // the inventory had no punctuation-boundary cell at all.
        for (const m of "।॥۔؛؟،܀።፣᙮᠃។៕᱾꓿꘎꠨⁕᜶᭞꧈။၊།。、")
            expect(cell.re.test(`word${m} word`), `${m} U+${m.codePointAt(0)!.toString(16)}`).toBe(true);
    });

    test("refuses ASCII lookalikes, fullwidth ASCII and the Arabic number separators", () => {
        // `|` is table markup that survived extraction — 252 hits across 49 artifacts — and admitting it
        // would fire this cell on noise in half the fleet. Fullwidth ！？ are ASCII at another width, a
        // folding problem. `٫ ٬` are the decimal and thousands separators, i.e. `decimals` and `grouped`.
        for (const m of "|!?.,;:！？；：٫٬")
            expect(cell.re.test(`word${m} word`), `${m} U+${m.codePointAt(0)!.toString(16)}`).toBe(false);
    });
});

describe("staleness", () => {
    const artifact = (counts: string, extra = ""): string =>
        `{ "cellsTotal": 2, "counts": {\n${counts}\n    },${extra}\n    "hard": [] }`;
    const all = CELLS.map((c) => `        "${c.key}": 1`).join(",\n");

    test("a cell present only in `backfill` counts as evaluated, and is reported APART from a mined one", () => {
        // The whole point of the separate block: it satisfies the gate without being laundered into
        // `counts`, where it would read as a corpus frequency it cannot support.
        const mined = all.split(",\n").filter((l) => !l.includes("native-terminator")).join(",\n");
        const st = staleness(artifact(mined, `\n    "backfill": {\n        "native-terminator": 7\n    },`));
        expect(st.missing).toEqual([]);
        expect(st.backfilled).toEqual(["native-terminator"]);
        expect(st.unknown).toEqual([]);
    });

    test("a genuinely mined cell is NOT reported as backfilled, even if both blocks name it", () => {
        const st = staleness(artifact(all, `\n    "backfill": {\n        "native-terminator": 7\n    },`));
        expect(st.backfilled).toEqual([]);
        expect(st.missing).toEqual([]);
    });

    test("a dead key is dead in EITHER block — a rename cannot hide in the backfill", () => {
        // `negative` → `signed-number` was silent in both directions across 35 artifacts. A new block that
        // only the counts check inspected would have re-opened exactly that hole.
        expect(staleness(artifact(`${all},\n        "negative": 3`)).unknown).toEqual(["negative"]);
        expect(staleness(artifact(all, `\n    "backfill": {\n        "negative": 3\n    },`)).unknown).toEqual(["negative"]);
    });

    test("a missing cell is still missing when neither block mentions it", () => {
        const mined = all.split(",\n").filter((l) => !l.includes("native-terminator")).join(",\n");
        expect(staleness(artifact(mined)).missing).toEqual(["native-terminator"]);
    });
});
