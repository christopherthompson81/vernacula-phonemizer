/**
 * IS THIS WIKI'S TEXT TRUSTWORTHY ENOUGH TO GATE ON?
 *
 * Mining wiki text extends the normalization diff gate past the FLEURS languages, and two risks have to be
 * measured BEFORE a mined corpus is trusted:
 *
 *   BOT-GENERATED WIKIS. `ceb` is ~99% bot-created from geographic databases. A corpus drawn from it has a
 *   uniform, template-shaped symbol distribution, so a diff against it looks clean while testing nothing.
 *
 *   LANGUAGE CONTAMINATION. Small wikis carry heavy untranslated quotation and foreign proper nouns, which is
 *   the exact input class that trips the embedded-Latin fallback (core/foreign.ts) — so it can mask real
 *   defects in the `--foreign` scan by making foreign phonemes the expected background.
 *
 * ⚠ BOTH FAILURES ARE SILENT AND BOTH POINT THE SAME WAY: they make a corpus look SAFER than it is. Every
 * other check in this tree hunts a defect that shows up as a defect; this one hunts a corpus that cannot show
 * a defect at all. ⚠ COVERAGE IS NOT HEALTH — a template-built wiki has EXCELLENT cell coverage, because the
 * template contains a coordinate, an area and a population, so `decimals`, `digit-run` and `grouped` all fill
 * on the first fetch.
 *
 * WHAT IS MEASURED — three signals are asserted on (template reuse, MSTTR, template fields), the rest are
 * reported. Deduplication matters for reuse: exact repeats are already dropped by `segment()`, so what it
 * finds is a template with the slots filled in DIFFERENTLY, which an exact-duplicate filter cannot see.
 *
 * ⚠ THE METRICS ARE SCRIPT-AGNOSTIC BY CONSTRUCTION. Shingles are counted over CHARACTERS, not words, and the
 * type/token ratio falls back to characters when the text is unspaced — Han, Thai, Khmer, Burmese and Lao
 * have no word boundary to tokenize on, and a word-based metric silently reports "vocabulary of 1" for every
 * one of them.
 *
 * Usage:
 *   npx tsx tools/normalization/wiki-health.ts --in ceb.raw.txt [--mode sentence|paragraph]
 *       [--terminators ".!?"] [--baseline de_de] [--label ceb]
 */
import { SCRIPTS } from "./scripts.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { segment, segmentFile, selectCells, type SegmentMode } from "./mine.ts";
import { CELLS } from "./cells.ts";
import { repairDoubleEncoded } from "../../src/core/unicode.ts";

/** ⚠ Only dispatch when this file IS the entry point — the same guard `mine.ts` carries, and for the same
 *  reason: without it the CLI runs on import and `process.exit(2)` kills the importer before it gets a chance
 *  to call `health()`. */
const IS_CLI = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

const argv = process.argv.slice(2);
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);

export interface Health {
    /** True segment count of the corpus. */
    segments: number;
    /** How many were actually measured — see MAX_ANALYZED. Equal to `segments` for any ordinary fetch. */
    analyzed: number;
    chars: number;
    /** Median segment length, and the 10th/90th percentiles — the distribution, not just its centre. */
    lenMedian: number;
    lenP10: number;
    lenP90: number;
    /** σ/μ of segment length. Reported only; it does not separate the cases — see `verdict`. */
    lenCV: number;
    /** Share of 30-char shingles occurring more than once, over already-deduplicated segments. */
    templateReuse: number;
    /** The most-reused shingle and how many segments carry it — the template itself, if there is one. */
    topShingle: { text: string; n: number } | undefined;
    /** type/token; `unit` says whether tokens were words or characters. */
    ttr: number;
    ttrUnit: "word" | "char";
    /** Per-script share of letters, descending, scripts below 0.5% dropped. */
    scripts: [string, number][];
    latinShare: number;
    /**
     * SCRIPT MIX MEASURED PER LINE, not per character — see `scriptLines` in `health` for why.
     *   native  — the line is essentially all in the corpus's dominant script
     *   mixed   — the line is in the language but carries foreign-script words
     *   foreign — the line is not in this language at all
     */
    scriptLines: { native: number; mixed: number; foreign: number };
    /** TEMPLATE FIELDS: words present in a large share of segments and appearing about ONCE in each. */
    fields: { count: number; top: { word: string; df: number; rate: number }[] };
    /** Cell occurrences per 1000 segments. */
    cellRate: Record<string, number>;
}

const SHINGLE = 30;

/**
 * TYPE/TOKEN, STANDARDIZED — mean TTR over consecutive fixed-size windows (MSTTR), not distinct-over-total.
 *
 * ⚠ THE PLAIN RATIO IS NOT SIZE-INVARIANT, WHICH MAKES IT USELESS ON A DUMP. Types accumulate sublinearly in
 * tokens (Heaps' law), so adding text drives distinct/total down mechanically — for flawless prose as much as
 * for a template. Thresholds calibrated on ~370-segment samples and applied to a 187,322-segment dump are not
 * a comparison at all:
 *
 *   plain distinct/total     ps (full Pashto dump) 0.084  ·  ceb (bot) 0.084   ← IDENTICAL
 *   MSTTR, 500-token windows ps 0.557  ·  ceb 0.340  ·  de 0.644  ·  ka 0.799
 *
 * Under the plain ratio this check condemns every corpus the dump route produces.
 *
 * A 500-token window rather than 1000: both separate `ceb` cleanly, and 500 gives twice as many windows,
 * which matters for a small wiki. Below one full window the plain ratio is returned — nothing to average.
 */
const MSTTR_WINDOW = 500;

function msttr(tokens: readonly string[]): number {
    if (tokens.length === 0) return 0;
    const windows = Math.floor(tokens.length / MSTTR_WINDOW);
    if (windows === 0) return new Set(tokens).size / tokens.length;
    let sum = 0;
    for (let i = 0; i < windows; i++)
        sum += new Set(tokens.slice(i * MSTTR_WINDOW, (i + 1) * MSTTR_WINDOW)).size / MSTTR_WINDOW;
    return sum / windows;
}

const quantile = (sorted: number[], q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

/**
 * IS THE TEXT SPACED? Decides the type/token unit. The threshold is deliberately low (one space per 25
 * characters): a Han or Thai wiki still contains spaces around Latin fragments and digits, so "has any space"
 * is not the question — "does whitespace mark word boundaries" is.
 *
 * ⚠ THE UNSPACED PATH MAKES NO TYPE/TOKEN ASSERTION AT ALL. Character type/token does not separate the cases
 * (`ceb` 0.0011 against `de` 0.0021, two-fold and confounded by alphabet size, where the WORD ratio separates
 * them four-fold). So an unspaced script has one detector here instead of two — TEMPLATE REUSE, which works
 * because shingles are counted over characters — and saying so beats reporting a number that cannot carry
 * the weight.
 */
const spaced = (text: string): boolean => (text.match(/ /gu)?.length ?? 0) / Math.max(1, text.length) > 0.04;

/**
 * HOW MANY SEGMENTS THE STATISTICS ARE COMPUTED OVER, and why there is a ceiling at all.
 *
 * ⚠ WITHOUT ONE THIS FUNCTION DIES ON A FULL DUMP. 132,981 paragraphs at stride 3 is roughly 39 million
 * distinct shingles — past V8's Map limit, so the tool throws `RangeError: Map maximum size exceeded` rather
 * than returning a verdict. Every metric here is a PROPORTION, so none needs the whole corpus; they need a
 * sample large enough to be stable, and 20,000 is two orders of magnitude past the 150-segment floor.
 *
 * ⚠ The subsample is a DETERMINISTIC STRIDE over the segment list, never a shuffle — an artifact that changes
 * between runs makes every regeneration look like a change. `segments` reports the TRUE total and `analyzed`
 * what was measured, so a reader cannot mistake the second for the first.
 */
const MAX_ANALYZED = 20_000;

export function health(all: string[], terms: string[] = []): Health {
    const total = all.length;
    const stride = Math.max(1, Math.ceil(total / MAX_ANALYZED));
    const segments = stride === 1 ? all : all.filter((_, i) => i % stride === 0);
    const joined = segments.join("\n");
    const lens = segments.map((s) => s.length).sort((a, b) => a - b);
    const mean = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);
    const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lens.length);

    // TEMPLATE REUSE over characters, so the metric means the same thing in every script. Counted over the
    // SET of segments that carry each shingle rather than raw occurrences: a single long list-like passage
    // repeating a phrase internally is one bad segment, whereas the same phrase across 300 segments is a
    // template, and the raw count cannot tell those apart.
    const carriers = new Map<string, Set<number>>();
    segments.forEach((s, i) => {
        const seen = new Set<string>();
        for (let j = 0; j + SHINGLE <= s.length; j += 3) {
            const sh = s.slice(j, j + SHINGLE);
            if (seen.has(sh)) continue;
            seen.add(sh);
            if (!carriers.has(sh)) carriers.set(sh, new Set());
            carriers.get(sh)!.add(i);
        }
    });
    let reused = 0;
    let top: { text: string; n: number } | undefined;
    for (const [sh, set] of carriers) {
        if (set.size > 1) reused++;
        if (set.size > (top?.n ?? 1)) top = { text: sh, n: set.size };
    }
    const templateReuse = carriers.size === 0 ? 0 : reused / carriers.size;

    const useWords = spaced(joined);
    const tokens = useWords
        ? (joined.toLowerCase().match(/[\p{L}\p{M}\p{Nd}]+/gu) ?? [])
        : [...joined].filter((c) => /[\p{L}\p{M}]/u.test(c));
    const ttr = msttr(tokens);

    const letters = joined.match(/\p{L}/gu) ?? [];
    const perScript = new Map<string, number>();
    for (const ch of letters) {
        const hit = SCRIPTS.find(([, re]) => re.test(ch));
        const key = hit?.[0] ?? "Other";
        perScript.set(key, (perScript.get(key) ?? 0) + 1);
    }
    const scripts = [...perScript]
        .map(([k, v]): [string, number] => [k, v / Math.max(1, letters.length)])
        .filter(([, v]) => v >= 0.005)
        .sort((a, b) => b[1] - a[1]);

    /**
     * SCRIPT MIX, PER LINE — and a character-level Latin share asks the wrong question.
     *
     * ⚠ A LATIN SHARE IS NOT CONTAMINATION IN A LANGUAGE THAT WRITES IN LATIN, AND MOST OF THESE DO.
     * Indigenous languages across the candidate set are conventionally Latinized and carry heavy lexical
     * influence from a colonial language, concentrated in exactly the academic register a Wikipedia is
     * written in. Borrowing is the orthography working as intended, not a defect, and several of these
     * languages are DUAL-SCRIPT: a real text mixes Latin with the language's own script by convention.
     *
     * A character-level share cannot tell any of that from the thing that IS a problem. Cherokee shows all
     * three at once, line by line:
     *
     *   all/mostly Cherokee   54%   the language
     *   mixed                 15%   dual-script orthography and borrowing — CORRECT, must not be flagged
     *   mostly/all Latin      32%   English prose ("Cherokee New Testament Online. Online translation…")
     *
     * A third of that corpus is not Cherokee at all — a corpus-COMPOSITION fact with a concrete consequence,
     * since those lines get phonemized as Cherokee and either produce nonsense or trip the embedded-Latin
     * fallback. It is fixed by filtering lines, never by condemning the language.
     *
     * So the measurement is per line, three-way, and only the FOREIGN bucket is a finding. `mixed` is
     * reported and deliberately never asserted on.
     */
    const dominantScript = scripts[0]?.[0];
    const scriptLines = { native: 0, mixed: 0, foreign: 0 };
    for (const seg of segments) {
        const segLetters = seg.match(/\p{L}/gu) ?? [];
        if (segLetters.length === 0) continue;
        let own = 0;
        const re = SCRIPTS.find(([k]) => k === dominantScript)?.[1];
        if (re !== undefined) for (const ch of segLetters) if (re.test(ch)) own++;
        const share = own / segLetters.length;
        if (share > 0.9) scriptLines.native++;
        else if (share > 0.3) scriptLines.mixed++;
        else scriptLines.foreign++;
    }

    /**
     * TEMPLATE FIELDS — the sharpest bot signal here, and the one that tells a generated corpus from a
     * language that is merely repetitive.
     *
     * ⚠ A REPETITIVE LANGUAGE IS NOT A TEMPLATE, and MSTTR alone cannot tell the difference — Hawaiian has 13
     * phonemes, short words and dense particle use, so `haw` measures MSTTR 0.364 against the bot wiki's
     * 0.340.
     *
     * The discriminator is not HOW MUCH a word repeats but WHAT KIND of word sits at the top. In natural
     * prose the high-frequency ranks are grammatical, and a function word recurs WITHIN a sentence. A
     * generated corpus has the template's own slots up there instead, and a slot appears in a huge share of
     * segments EXACTLY ONCE in each, because the template writes it once per article. Hence: document
     * frequency above 15%, occurrences-per-carrying-segment below 1.25.
     *
     * Measured (field-like word counts):
     *
     *   ceb (bot)  61   nahimutang df62% · ulohan df55% rate 1.00 · giiniton/kinainitan df45% rate 1.00
     *   de          6   ist, ein, eine, war, als, auch — copulas and articles, one per sentence
     *   bm          4   fichier, px, right, jpg  ← NOT words: leaked media markup, found by this metric
     *   ka          3   all grammatical
     *   haw         0   ← exonerated: not a template, just a repetitive language
     *   wo          0   ← exonerated: its 5.7% shingle reuse is not a generated template either
     */
    const tf = new Map<string, number>(), df = new Map<string, number>();
    for (const seg of segments) {
        const toks = seg.toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? [];
        const seen = new Set<string>();
        for (const t of toks) { tf.set(t, (tf.get(t) ?? 0) + 1); seen.add(t); }
        for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const fieldLike = [...df]
        .map(([word, d]) => ({ word, df: d / Math.max(1, segments.length), rate: (tf.get(word) ?? 0) / d }))
        .filter((x) => x.df > FIELD_MIN_DF && x.rate < FIELD_MAX_RATE)
        .sort((a, b) => b.df - a.df);

    const { counts } = selectCells(segments, { perCell: 0, terms });
    const cellRate: Record<string, number> = {};
    for (const c of CELLS) cellRate[c.key] = 1000 * (counts[c.key] ?? 0) / Math.max(1, segments.length);

    return {
        segments: total,
        analyzed: segments.length,
        chars: joined.length,
        lenMedian: quantile(lens, 0.5),
        lenP10: quantile(lens, 0.1),
        lenP90: quantile(lens, 0.9),
        lenCV: mean === 0 ? 0 : Math.sqrt(variance) / mean,
        templateReuse,
        topShingle: top,
        ttr,
        ttrUnit: useWords ? "word" : "char",
        scripts,
        latinShare: perScript.get("Latin") === undefined ? 0 : perScript.get("Latin")! / Math.max(1, letters.length),
        scriptLines,
        fields: { count: fieldLike.length, top: fieldLike.slice(0, 8) },
        cellRate,
    };
}

/**
 * THE SYMBOL HISTOGRAM, COMPARED AS A SHAPE AND NOT AS A LEVEL.
 *
 * ⚠ A CELL IS A BOOLEAN PER SEGMENT, so a per-segment rate scales with SEGMENT LENGTH. Wiki paragraphs run a
 * 230-character median and FLEURS utterances a single sentence, so every cell comes out 3-15× "inflated"
 * against the baseline and a naive `ratio > 4 → template-inflated?` flag fires on **de**, the control. A flag
 * that fires on the known-good corpus measures segment length, not health.
 *
 * So the comparison is between NORMALIZED distributions: each corpus's cell rates are divided by their own
 * total, which cancels the length term, and the two shapes are compared by total-variation distance
 * (½Σ|p−q|, 0 for identical to 1 for disjoint). That is scale-free.
 *
 * ⚠ AND EVEN THEN NOTHING HERE IS ASSERTED ON, because THE BASELINE IS NECESSARILY ANOTHER LANGUAGE — a
 * corpus-less language has no same-language corpus by construction, so every comparison mixes "this text is
 * degenerate" with "this language is not German". Against `de_de`, with `de` the human control, `ka` a
 * human-written non-Latin wiki and `ceb` the bot:
 *
 *   divergence         de 0.462 · ka 0.585 · ceb 0.580   — ka, human-written, diverges MORE than the bot wiki
 *   top-5 cell mass    de 84.1% · ka 76.8% · ceb 62.5%   — INVERTED; the control is the most concentrated
 *   empty vs baseline  de 5     · ka 7     · ceb 11      — ordered correctly, but four cells of margin
 *
 * The histogram stays because it is useful for READING a corpus — ceb's `degrees`/`units`/`grouped`/
 * `signed-number` saturation IS its coordinate template, legible at a glance, and that tells you what a clean
 * diff against it would and would not have exercised. Useful to read, unusable as a threshold.
 */
export interface Histogram {
    /** Total-variation distance between the two normalized cell distributions, 0..1. */
    divergence: number;
    /** Share of the mined corpus's total cell mass held by its five densest cells. */
    topMass: number;
    /** Cells the baseline populates that this corpus has ZERO of — the template's blind spots. */
    emptyVsBaseline: string[];
    /** Per-cell shares, for the printed table. */
    mined: Record<string, number>;
    base: Record<string, number>;
    baseRate: Record<string, number>;
}

const shares = (rate: Record<string, number>): Record<string, number> => {
    const total = CELLS.reduce((a, c) => a + (rate[c.key] ?? 0), 0) || 1;
    return Object.fromEntries(CELLS.map((c) => [c.key, (rate[c.key] ?? 0) / total]));
};

export function histogram(mined: Health, base: Health): Histogram {
    const m = shares(mined.cellRate), b = shares(base.cellRate);
    const divergence = 0.5 * CELLS.reduce((a, c) => a + Math.abs((m[c.key] ?? 0) - (b[c.key] ?? 0)), 0);
    const sorted = CELLS.map((c) => m[c.key] ?? 0).sort((x, y) => y - x);
    return {
        divergence,
        topMass: sorted.slice(0, 5).reduce((a, v) => a + v, 0),
        // `>= 1 per 1000` on the baseline side, so a cell the known-good corpus barely has either is not
        // held against a corpus for lacking it.
        emptyVsBaseline: CELLS.filter((c) => (mined.cellRate[c.key] ?? 0) === 0 && (base.cellRate[c.key] ?? 0) >= 1).map((c) => c.key),
        mined: m,
        base: b,
        baseRate: base.cellRate,
    };
}

/**
 * REVIEWED VERDICTS — per language, a verdict that was read by a human and what reading it settled.
 *
 * The corroboration rule is a good filter and it is not an oracle: `mg` trips two signals and is not a bot
 * corpus. The alternative to recording cases like that is re-investigating the same language on every sweep.
 * A settled refusal and a settled acceptance are both worth writing down.
 *
 * ⚠ AN ENTRY MUST CITE WHAT WAS READ, not just assert an outcome. "Looks fine" is how a real defect gets
 * waved through; the quoted evidence is what lets the next person disagree with it.
 *
 * ⚠ "BOT-CONTAMINATED" IS NOT "DISCARD" — the question is whether the contamination MISLEADS, not whether it
 * exists. Nearly every large wiki has some generated content, and condemning a corpus for containing any of
 * it throws away the human text alongside. The template only does harm two ways: by crowding out the real
 * signal, or by making a clean diff look meaningful.
 *
 * `gateable` records the share of segments carrying NO field word, where it has been measured — the field
 * detector names the template's slot words, so it can PARTITION rather than condemn. ⚠ THAT PARTITION IS A
 * STARTING POINT, NOT A CLEAN CORPUS: `bpy`'s zero-field segments mix real prose with navbox link lists at a
 * median of 83 characters, so many are fragments. Nothing partitions automatically yet.
 */
export interface Reviewed { verdict: "bot" | "usable"; why: string; gateable?: string }
export const REVIEWED: Record<string, Reviewed> = {
    // All three signals, and the template is legible: the most-reused shingle is "…according to the census
    // population", carried by 2,715 of 63,454 segments, and the fields are জনসংখ্যা "population" and
    // মানুলেহা "census", both at 31% of segments with EXACTLY one occurrence each. A census generator.
    bpy: { verdict: "bot", why: "census template; 17 fields incl. 'population'/'census' at df31% rate 1.00",
        gateable: "22.2% of segments carry no field word (~14k segments) — real prose mixed with navbox lists" },
    // All three signals and the strongest readings in the fleet: reuse 11.4%, MSTTR 0.266, 29 fields. Was
    // independently flagged by the volume probe as a stub farm — 434,486 articles averaging 62 words.
    nan: { verdict: "bot", why: "reuse 11.4% + MSTTR 0.266 + 29 fields; volume probe: 434k articles at 62 words each",
        gateable: "2.7% of segments carry no field word — small share, ~11k segments of a very large corpus" },
    // A demographic generator: `usggʷas` "year" df63% rate 1.01, `imzdaɣn` "inhabitants" df48% rate 1.02,
    // `ilkm` "reached" df48% rate 1.00. Same shape as ceb's geography and bpy's census.
    // ⚠ AND IT PRODUCED THE FLEET'S SECOND-HIGHEST DROP COUNT (205), which is how a template inflates a
    // defect tally: the `sample` tier is a uniform stride, so it mirrors the template and `percent ×131` is
    // largely one construction repeated. The HARD SET stays honest — only 14% of its entries carry a field
    // word, because that selector hunts diverse cells — so the artifact is usable and the raw count is not.
    shi: { verdict: "bot", why: "demographic template; 26 fields incl. 'year'/'inhabitants'/'reached' at df34-63% rate ~1.00",
        gateable: "hard set is only 14% template; the 205 drops are inflated by the sample tier, not the hard set" },
    // ⚠ TWO SIGNALS, 20 FIELDS, AND STILL NOT A BOT CORPUS — read rather than judged, like mg. 35.1% of
    // substantial lines carry a century template (`ngwagengkgolo`/`ngwagakgolo`), but the other 65% is
    // genuine Northern Sotho history. The `afrika`/`borwa` fields are TOPICAL — this wiki writes about South
    // Africa — and `ke` is a copula. Content words in the frequency ranks are the bot signal only when they
    // are the template's SLOTS, and these are its SUBJECT.
    nso: { verdict: "usable", why: "65% genuine history + a 35% century-template subset; afrika/borwa are topical, ke is a copula",
        gateable: "~65% of substantial lines carry no century template" },
    // ⚠ TWO SIGNALS AND NOT A BOT CORPUS — the case that made this table necessary. The reuse comes from a
    // French-commune stub set, which is real but covers 1,270 of 282,663 segments — 0.45%. Only 4 fields, two
    // of them grammatical. The prose reads as ordinary Malagasy history; the low MSTTR is the language's
    // particle density.
    mg: { verdict: "usable", why: "healthy prose + a 0.45% commune-stub subset; 4 fields, 2 grammatical; prose reads normal",
        gateable: "61.4% of segments carry no field word at all" },
};

export interface Verdict { ok: boolean; notes: string[] }

/** de 0.002 · ka 0.010 · ceb 0.101. Three times the worst human reading, a third of the bot wiki. */
const MAX_TEMPLATE_REUSE = 0.03;
/**
 * MSTTR floor. Measured: ka 0.799 · et 0.732 · arz 0.661 · de 0.644 · tt 0.614 · ps 0.557 · **ceb 0.340**.
 * Set between the lowest healthy reading and the bot wiki — 1.24× under `ps`, 1.32× over `ceb`. Tighter than
 * the other threshold's 3×, because MSTTR is a genuinely narrower spread once size is factored out.
 */
const MIN_TTR_WORD = 0.45;
/**
 * Share of LINES not in the language's own script, where that script is not Latin. Measured on the Cherokee
 * dump: 32% of lines are English prose, against 15% legitimately mixed and 54% Cherokee. Set at 25% — above
 * any plausible rate of quotation, below the composition problem chr actually has.
 *
 * ⚠ NOT a Latin-character share. That version fires on `chr` and calls dual-script orthography contamination;
 * see the long note at `scriptLines` in `health`.
 */
const MAX_FOREIGN_LINES = 0.25;

/** A word must be in more than this share of segments to be a template-field candidate. */
const FIELD_MIN_DF = 0.15;
/** ...and appear about once in each segment carrying it. A function word recurs within a sentence. */
const FIELD_MAX_RATE = 1.25;
/** ceb 61 · de 6 · bm 4 (markup) · ka 3 · haw 0 · wo 0. Set at 20 — three times the highest natural reading. */
const MAX_TEMPLATE_FIELDS = 20;

/**
 * THE VERDICT. ⚠ EVERY THRESHOLD IS SET FROM MEASUREMENT — thresholds written from the shape of the argument
 * rather than from numbers PASS `ceb`, the one wiki that is the reason this check exists. They are
 * deliberately loose: a false alarm costs one investigation, a false pass costs a language its gate.
 *
 *   template reuse   de 0.2%  · ka 1.0%  · ceb 10.1%
 *   type/token       de 0.644 · ka 0.799 · ceb 0.340   (MSTTR — see `msttr`; the plain ratio does not work)
 *
 * Both sit about 3× clear of the nearest reading on each side. That is a real margin and not a large one, so
 * a corpus that trips ONE of the two by a little is a corpus to read, not one to discard.
 *
 * ⚠ NO SINGLE BOT SIGNAL IS DECISIVE. Each fires on at least one healthy corpus for a reason that has nothing
 * to do with a generator:
 *
 *   haw  MSTTR 0.364, fields 0    Hawaiian: 13 phonemes, short words, dense particle use
 *   hak  MSTTR 0.395, fields 7    romanized Hakka: "words" are syllables, so common ones saturate
 *   cdo  MSTTR 0.431, fields 3    romanized Min Dong, same reason
 *   wo   reuse 5.7%,  fields 0    Wolof: shingle reuse without any template behind it
 *
 * The bot wiki trips ALL THREE — `ceb` reads reuse 10.1%, fields 61, MSTTR 0.340 — because a generated corpus
 * is degenerate in every direction at once. So the rule is CORROBORATION: two or more agreeing signals make a
 * corpus SUSPECT; one on its own is reported and explicitly does not fail.
 *
 * The other two findings are NOT bot signals and stay independent: a thin sample is a statement about the
 * fetch, and a foreign-line share is a statement about composition. Both are true regardless of what else the
 * corpus looks like.
 */
export function verdict(h: Health, hist?: Histogram): Verdict {
    const notes: string[] = [];
    // ⚠ SAMPLE SIZE FIRST. Every metric here is a proportion, and a PARTIAL FETCH is indistinguishable from a
    // poor wiki by any of them — a raw file still being written by a backgrounded fetch reads as a perfectly
    // plausible thin corpus, and at 52 segments `ka` matched the bot wiki's empty-cell count exactly, a
    // conclusion that dissolved when the same wiki measured 358 segments. The floor guards both cases at
    // once: a thin sample is a "fetch more", never a verdict.
    if (h.segments < MIN_SEGMENTS)
        notes.push(`only ${h.segments} segments — too few to judge; raise --random or fetch with --fill before trusting any figure here`);
    // ⚠ NOT lenCV. It does not separate the cases: de 0.71 against ceb 0.64, with the de_de FLEURS baseline
    // itself at 0.35 — LOWER than the bot wiki. Cebuano's generated articles vary in length because the
    // generator emits a variable number of template sentences per article. Reported, never asserted on.
    const bot: string[] = [];
    if (h.templateReuse > MAX_TEMPLATE_REUSE)
        bot.push(`template reuse ${(100 * h.templateReuse).toFixed(1)}% of shingles recur across distinct segments (control: 0.2%)`
            + (h.analyzed < REUSE_STABLE_AT ? ` — ⚠ only ${h.analyzed} segments measured; this figure is NOISY below ~${REUSE_STABLE_AT} (it moved 1.7→6.3→1.9% on one corpus)` : ""));
    if (h.ttrUnit === "word" && h.ttr < MIN_TTR_WORD)
        bot.push(`type/token (MSTTR-${MSTTR_WINDOW}) ${h.ttr.toFixed(3)} — small vocabulary (control: 0.644, bot wiki: 0.340)`);
    if (h.fields.count > MAX_TEMPLATE_FIELDS)
        bot.push(`${h.fields.count} words look like TEMPLATE FIELDS — in >${100 * FIELD_MIN_DF}% of segments and about once in each `
            + `(${h.fields.top.slice(0, 4).map((f) => `${f.word} ${(100 * f.df).toFixed(0)}%`).join(", ")}) `
            + `— natural prose puts grammar at the top of that list (control: 6)`);
    const dominant = h.scripts[0];
    const lines = h.scriptLines.native + h.scriptLines.mixed + h.scriptLines.foreign;
    const foreignShare = lines === 0 ? 0 : h.scriptLines.foreign / lines;
    // ⚠ AN UNLISTED SCRIPT CANNOT BE CLASSIFIED, AND MUST NOT BE CONDEMNED FOR IT. `SCRIPTS` is a finite
    // table, so a language written in a script it does not name lands in the `Other` bucket — and `Other` has
    // no regex, so the per-line test finds 0% of letters "in the dominant script" and reports
    // `100% of lines are not in Other script at all`. That is a statement about this tool's table, not about
    // the corpus.
    if (dominant !== undefined && dominant[0] !== "Latin" && dominant[0] !== "Other" && foreignShare > MAX_FOREIGN_LINES)
        notes.push(`${(100 * foreignShare).toFixed(0)}% of lines are not in ${dominant[0]} script at all `
            + `(${h.scriptLines.foreign} of ${lines}) — filter these out before mining; phonemized as this language they `
            + `either produce nonsense or make foreign phonemes the expected background of the --foreign scan`);
    // CORROBORATION: two agreeing signals condemn, one is reported and does not.
    if (bot.length >= 2) notes.push(...bot);
    const single = bot.length === 1
        ? [`ONE bot signal only, NOT treated as a failure — ${bot[0]!}`,
           "  (every single-signal case measured so far — haw, hak, cdo, wo — was the language, not the corpus. Read it.)"]
        : [];
    // `hist` is deliberately NOT asserted on — see `Histogram`'s header. It is taken as a parameter so a
    // caller can print it beside the verdict, not so it can veto one.
    void hist;
    return { ok: notes.length === 0, notes: [...notes, ...single] };
}

/** de 372 · ceb 375 · ka 358 on a completed 400-article random fetch. Set well below all three, so it fires
 *  on a truncated or thin fetch rather than on an ordinary small wiki. */
const MIN_SEGMENTS = 150;

/**
 * ⚠ TEMPLATE REUSE IS NOISY BELOW A FEW THOUSAND SEGMENTS. The metric is not biased by scale, it is NOISY at
 * small N. Measured on one corpus by deterministic stride, so the text is identical and only the sample size
 * changes:
 *
 *   n=200  1.7%   ·  n=400  6.3%   ·  n=1000  1.9%   ·  n=3000  2.8%   ·  n=10000  2.7%   ·  n=20000  3.0%
 *
 * A 1.7 → 6.3 → 1.9 swing around a true value near 3%. It settles by roughly n=3000, twenty times
 * `MIN_SEGMENTS`; below that a reading can be off by a factor of two either way, which is what produced both
 * of this check's first two positives — corpora that pass on their full dumps.
 *
 * ⚠ NOT FIXED BY RAISING `MIN_SEGMENTS`: a genuinely small wiki has a few hundred segments and no more, so a
 * 3,000 floor would refuse to judge the languages that most need judging. What absorbs it is CORROBORATION —
 * a lone reuse trip never fails a corpus.
 */
const REUSE_STABLE_AT = 3000;

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────────
/** The known-good side of the symbol histogram: a FLEURS corpus read the way corpus-diff.ts reads it. */
function baselineSegments(corpus: string): string[] {
    const root = process.env["FLEURS"] ?? "";
    const dir = join(root, corpus);
    const seen = new Set<string>();
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsv")))
        for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
            const col = line.split("\t")[2];
            if (col !== undefined && col !== "") seen.add(repairDoubleEncoded(col));
        }
    return [...seen];
}

if (IS_CLI) {
    const inPath = arg("in");
    if (inPath === undefined) {
        console.error("usage: --in <raw.txt> [--mode sentence|paragraph] [--terminators \".!?\"] [--baseline <fleurs-dir>] [--label <name>]");
        process.exit(2);
    }
    const mode = arg("mode", "paragraph") as SegmentMode;
    const terminators = arg("terminators", ".!?။。")!;
    const label = arg("label", inPath.replace(/^.*\//u, "").replace(/\..*$/u, ""))!;

    // ⚠ Streamed, not read whole: reading a dump over Node's ~512 MB string cap throws `ERR_STRING_TOO_LONG`
    // and produces no verdict at all. See `segmentFile`.
    const h = health(segmentFile(inPath, mode, terminators));
    const pct = (x: number): string => `${(100 * x).toFixed(1)}%`;

    /**
     * MACHINE-READABLE MODE, for the fleet sweep. ⚠ Parsing the prose output with a regex is the wrong shape:
     * a label lost to a shell quoting error is invisible, because an empty first column still produces a
     * plausible-looking table. A tool run over ninety languages needs an output its caller cannot mis-read.
     *
     * `ttrUnit` is included deliberately. An unspaced-script corpus reports a CHARACTER ratio, on which no
     * threshold is asserted, so a low number there means "not measured" rather than "bad" — and a reader of
     * the table has no way to tell those apart without this column.
     */
    if (has("tsv")) {
        const v0 = verdict(h);
        const lines = h.scriptLines.native + h.scriptLines.mixed + h.scriptLines.foreign;
        console.log([
            label, h.segments, h.analyzed,
            (100 * h.templateReuse).toFixed(1), h.ttr.toFixed(3), h.ttrUnit, h.fields.count,
            lines === 0 ? "0.0" : (100 * h.scriptLines.foreign / lines).toFixed(1),
            h.scripts[0]?.[0] ?? "?",
            v0.ok ? "ok" : "SUSPECT",
            REVIEWED[label] === undefined ? "-" : `reviewed:${REVIEWED[label]!.verdict}`,
            v0.notes.filter((n) => !n.startsWith("  ")).join(" | ") || "-",
        ].join("\t"));
        process.exit(0);
    }

    console.log(`\n── ${label} · ${h.segments} segments`
        + (h.analyzed < h.segments ? ` (${h.analyzed} measured, deterministic stride)` : "")
        + ` · ${(h.chars / 1000).toFixed(0)}k chars · ${mode} segmentation ──\n`);
    console.log(`  length         median ${h.lenMedian}  p10 ${h.lenP10}  p90 ${h.lenP90}  CV ${h.lenCV.toFixed(2)}  (reported only — see verdict)`);
    console.log(`  template reuse ${pct(h.templateReuse)} of ${SHINGLE}-char shingles recur across segments`);
    if (h.topShingle) console.log(`                 most reused (${h.topShingle.n} of ${h.segments} segments): ${JSON.stringify(h.topShingle.text)}`);
    console.log(`  type/token     ${h.ttr.toFixed(3)} (MSTTR-${MSTTR_WINDOW}, per ${h.ttrUnit})`);
    console.log(`  template fields ${h.fields.count}`
        + (h.fields.top.length > 0 ? `  ${h.fields.top.slice(0, 6).map((f) => `${f.word}(${(100 * f.df).toFixed(0)}%/${f.rate.toFixed(2)})`).join(" ")}` : ""));
    console.log(`  scripts        ${h.scripts.map(([k, s]) => `${k} ${pct(s)}`).join("  ")}`);
    const nLines = h.scriptLines.native + h.scriptLines.mixed + h.scriptLines.foreign;
    if (nLines > 0)
        console.log(`  lines by script native ${pct(h.scriptLines.native / nLines)}  mixed ${pct(h.scriptLines.mixed / nLines)}`
            + `  NOT THIS LANGUAGE ${pct(h.scriptLines.foreign / nLines)}   (mixed is normal — borrowing and dual-script orthography)`);

    const baseName = arg("baseline");
    let hist: Histogram | undefined;
    if (baseName !== undefined) {
        const b = health(baselineSegments(baseName));
        hist = histogram(h, b);
        console.log(`\n  ── symbol histogram, share of cell mass ── ${label} vs ${baseName} (known-good) ──`);
        console.log(`     ${"cell".padEnd(16)}${label.padStart(9)}${baseName.padStart(11)}`);
        for (const c of CELLS) {
            const m = hist.mined[c.key] ?? 0, r = hist.base[c.key] ?? 0;
            if (m === 0 && r === 0) continue;
            const flag = r >= 0.01 && m === 0 ? "  ← EMPTY, baseline has it" : m > 0.08 && m > 3 * r ? "  ← saturated" : "";
            console.log(`     ${c.key.padEnd(16)}${pct(m).padStart(9)}${pct(r).padStart(11)}${flag}`);
        }
        console.log(`\n  divergence ${hist.divergence.toFixed(3)} (total variation)  ·  top-5 cells hold ${pct(hist.topMass)} of cell mass`
            + `  ·  ${hist.emptyVsBaseline.length} baseline-populated cells empty`);
        console.log(`  baseline itself: length CV ${b.lenCV.toFixed(2)}  template reuse ${pct(b.templateReuse)}  type/token ${b.ttr.toFixed(3)} (per ${b.ttrUnit})`);
    }

    const v = verdict(h, hist);
    const rev = REVIEWED[label];
    console.log(`\n  VERDICT  ${v.ok ? "usable — no health signal tripped" : "⚠ SUSPECT"}`
        + (rev !== undefined ? `   ·   REVIEWED: ${rev.verdict.toUpperCase()} — ${rev.why}` : ""));
    if (rev?.gateable !== undefined)
        console.log(`           gateable partition: ${rev.gateable}`);
    for (const n of v.notes) console.log(`    ⚠ ${n}`);
    if (!v.ok) console.log(`\n  A suspect corpus is not unusable, it is UNGATEABLE: a clean diff against it means nothing.`);
    console.log("");
}
