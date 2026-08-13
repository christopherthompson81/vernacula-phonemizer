/**
 * THE MIS-READING PROBE — the unit defect that PRODUCES A WORD instead of producing garbage.
 *
 * ⚠ WHY NO EXISTING GATE SEES THIS. Every probe in this directory asks "did the input SURVIVE into the
 * IPA?" — `audit.ts` flags a raw digit or a native mark, `coverage.ts` and `mine.ts` flag a LEAK or a
 * differential DROP. All three are blind here by construction, because an undeclared unit abbreviation
 * whose letters happen to be pronounceable in the language does not survive and does not vanish: it is
 * READ. The engine hands its Latin letters to the generic grapheme fallback (`latinPhone`, an English
 * reader, or the language's own orthography) and emits a plausible word.
 *
 *   nya   `150cm`   → *…seⁿtimita*   ⟨c⟩ has no Chichewa grapheme, so the fallback gave [k] and
 *                                    CENTImetres were pronounced as KILOmetres — wrong ×100,000
 *   jv    `10 ha`   → *səpˈulʊh hˈɔ* the g2p read ⟨ha⟩ as an ordinary Javanese word
 *   tl    `10 cm`   → *sampˈu km*    ⟨c⟩→/k/, so the reading is the letter pair, not a unit
 *   ig    `790 km2` → "kilometres two"
 *
 * A raw `km` sitting in a phoneme string is at least visibly wrong. `10 cm` that sounds like `10 km` is
 * not visible anywhere — not in the corpus diff, not in the DROP counter, not to a reviewer reading IPA.
 * That is why the fleet's leak census is a LOWER BOUND: it counted the failures that produce garbage and
 * could not count the failures that produce a reading.
 *
 * THE TEST. For each unit abbreviation the probe asks three questions, none of which is "did the ASCII
 * survive?":
 *
 *   1. WAS IT CONVERTED AT ALL?  Take the token multiset of `10 <abbr>` and subtract the tokens of `10`.
 *      What is left is the UNIT SEGMENT — and this works for a preposed language (ig/nya put the unit
 *      noun first) as well as a postposed one, which a prefix-strip would not. Then obtain the same
 *      engine's FALLBACK reading of the very same letters, by DEFEATING THE UNIT GUARD instead of removing
 *      the number: every unit rule in the fleet ends `(?![\p{L}\p{M}'’ʼ])`, so `10 cm'` cannot match the
 *      rule and comes back as whatever the letter fallback makes of ⟨c⟩⟨m⟩. Segment equal to fallback ⇒ no
 *      rule fired and the letters were merely pronounced: **MISREAD**. Different ⇒ a rule expanded the key.
 *
 *      ⚠ THE OBVIOUS TEST — read the abbreviation with no number beside it — IS WRONG, and it is wrong in
 *      the direction that matters. The tier ALSO expands a bare unit symbol (`makeBareUnitNormalizer`, for
 *      table headers and captions), so `phonemize("km", "hi")` is *kɪloːmˈiːʈəɾ*, identical to the reading
 *      inside `10 km`. The first version of this probe used that test and reported Hindi and German — which
 *      declare km/cm/mm/kg correctly — as mis-reading all four. 959 of its "core" cells were that artefact.
 *
 *      ⚠ AND THE APOSTROPHE IS NOT INERT EVERYWHERE, so its inertness is MEASURED per shape rather than
 *      assumed. English reads `ha` as /hɑː/ but `ha'` as /hæ/ — a closed syllable — so the fallback would
 *      differ from the segment for a purely phonological reason and the cell would read `ok` while the
 *      defect is real. Each cell therefore first probes a SHADOW token of the same shape whose first letter
 *      cannot begin any unit key (`ha`→`ba`, `cm`→`bm`, `l`→`b`); if the apostrophe changes the shadow's
 *      reading, the apostrophe is not inert in that phonological context and the cell is reported `?`
 *      UNJUDGEABLE rather than silently cleared.
 *
 *   2. IS THE SOMETHING IT BECAME THE RIGHT SOMETHING?  Compare every pair of DISTINCT units. Two units
 *      that read identically are a **COLLIDE** — `cm` and `km` reading alike is a silent factor of
 *      100,000 and is strictly worse than either of them leaking.
 *
 *   3. HOW DOES THIS ENGINE ROUTE UNKNOWN LATIN?  A control token that no language could ever declare
 *      (`xq`, `qj`) establishes the engine's disposition, and it is the disposition that decides whether
 *      an undeclared unit is loud or silent:
 *        RAW    the control comes back as its own ASCII letters — an undeclared unit LEAKS, and every
 *               existing probe can already see it
 *        READS  the control is phonemized — an undeclared unit MIS-READS, and nothing else can see it
 *        DROPS  the control vanishes — a third disposition, silent in a different way
 *      ⚠ A `READS` engine with an undeclared unit is the whole defect class. On a `RAW` engine the same
 *      missing declaration is an already-counted leak.
 *
 * ⚠ WHAT A CLEAN LINE DOES NOT MEAN. The probe judges CONVERSION, not correctness of the word chosen: an
 * engine that expanded `cm` into the wrong noun reads as `ok` here. Choosing the word is sourcing work
 * (`attest.ts`), and no mechanical probe substitutes for it.
 *
 * Usage:  npx tsx tools/normalization/misread.ts [--langs tl,jv,ig] [--all] [--json]
 *           --all    print every language, including the fully clean ones
 *           --json   machine-readable, for diffing a before against an after
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { phonemize } from "../../src/index.ts";

const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), "../../src/registry.ts");
const ALL_CODES = [...new Set([...readFileSync(REGISTRY, "utf8").matchAll(/case "([a-zA-Z0-9-]+)":/g)].map((m) => m[1]!))].sort();

/**
 * The abbreviations probed. Chosen for the two properties that make this class silent — every one is
 * SI-or-near-universal (so essentially every written language has a settled form or a borrowing for it,
 * and "the corpus is thin" is evidence about the corpus rather than about the language), and every one is
 * spelled with letters that a Latin-reading fallback will happily pronounce.
 *
 * ⚠ ⟨L⟩ IS HERE ALONGSIDE ⟨l⟩ because both cases are official for the litre and the symbol lookup is
 * case-sensitive; a language can declare one and mis-read the other.
 */
const UNITS = ["km", "m", "cm", "mm", "kg", "g", "mg", "t", "l", "L", "ml", "ha", "s", "h", "min", "kW", "MB"] as const;

/**
 * ⚠ THE CORE SET, AND WHY THE OTHER NINE ARE REPORTED BUT NOT COUNTED IN THE HEADLINE. The first run of
 * this probe reported 2,161 mis-read cells across 190 engines, which is true and useless: `MB`, `kW`,
 * `min` and `h` are mis-read almost everywhere, and for most of them a language's own written practice is
 * genuinely unsettled — `h` is as often an hour as a hectare-abbreviation fragment, `MB` is an initialism
 * that wants a letter-name table rather than a unit word. Ranking on those buries the cases that are both
 * severe and decidable.
 *
 * The core set is the units for which a settled written form exists in essentially every written language
 * (SI base and the two everyday derived ones), where the number-adjacent reading is unambiguous, and where
 * a wrong reading is wrong by a POWER OF TEN rather than merely odd.
 */
const CORE = new Set(["km", "m", "cm", "mm", "kg", "g", "l", "ha"]);

/**
 * ⚠ THE COLLISION SET IS NOT EVERY PAIR. Comparing all 17 units pairwise reports mostly noise — two units
 * a language happens not to declare both read as their own letters and "collide" trivially, which is the
 * MISREAD finding already counted, restated. What is worth a separate flag is a pair that is CONFUSABLE
 * BY MAGNITUDE: same base unit, different prefix, so an identical reading is a silent factor of 10³ or
 * 10⁶ rather than a visibly odd noise. Those are listed here explicitly.
 */
const CONFUSABLE: readonly (readonly [string, string])[] = [
    ["cm", "km"], ["mm", "km"], ["cm", "m"], ["mm", "m"], ["cm", "mm"], ["m", "km"],
    ["mg", "kg"], ["g", "kg"], ["mg", "g"], ["ml", "l"],
];
// ⚠ ⟨l⟩ AND ⟨L⟩ ARE NOT A CONFUSABLE PAIR. Both cases are official for the litre, so a language that
// declares both is CORRECT to read them alike; listing the pair reported `l=L` on every engine that got
// the litre right, which is the opposite of what this flag is for.

/** ⚠ Two controls, not one: a single one can collide by accident with a real word of some language. A key is
 *  only called RAW/READS/DROPS when both agree, and disagreement is reported rather than averaged away. */
const CONTROLS = ["xq", "qj"] as const;

/** The number the probe measures against. `10` and not `1`, because a singular can take a different noun
 *  form in a language with number agreement and that is a different question than this one. */
const N = "10";

const strip = (s: string): string => s.replace(/[ˈˌ]/gu, "");
const tokens = (s: string): string[] => strip(s).split(/\s+/u).filter(Boolean);

/** The UNIT SEGMENT: the tokens `10 <abbr>` has that `10` alone does not. Multiset subtraction, so the
 *  result is order-free and a preposed unit language reads the same as a postposed one. */
function segment(abbr: string, lang: string, numTokens: string[]): string[] | undefined {
    let full: string[];
    try { full = tokens(phonemize(`${N} ${abbr}`, lang)); } catch { return undefined; }
    const pool = [...numTokens];
    const rest: string[] = [];
    for (const tok of full) {
        const at = pool.indexOf(tok);
        if (at >= 0) pool.splice(at, 1);
        else rest.push(tok);
    }
    return rest;
}

/**
 * ⚠ THE GUARD-DEFEATING SUFFIXES, AND WHY THERE ARE TWO. A unit rule declines when the key is followed by
 * something in its trailing guard, so gluing such a character to the key gives the engine's fallback
 * reading of the same LETTERS. That last part is why this beats appending a letter: `cmq` changes the
 * syllable structure the fallback sees, and the comparison then measures the suffix rather than the unit.
 *
 * No single character does the job, because the guards differ:
 *   · the shared tier's `unitRe` ends `(?![…\p{M}'’ʼ])`      — apostrophe works, combining mark works
 *   · a LOCAL unit rule often ends `(?![\p{L}\p{M}])`        — apostrophe does NOT break it
 * Marathi resolves its units locally with the second form, so under the apostrophe alone `10 km'` still
 * read *kɪloːmˈiːʈəɾ*, the segment matched the "fallback", and all 17 of mr's cells reported MISREAD —
 * for a language that declares km/cm/mm/kg. A COMBINING MARK is in both guards and breaks both.
 *
 * And the two are inert in different places, which is the other reason to keep both. English reads `ha'`
 * as a closed syllable /hæ/ but `ha` + U+0301 as /hɑː/; Igbo leaves the apostrophe alone but reads a
 * combining acute as a TONE mark. So each breaker's inertness is measured separately (see `shadow`), a
 * breaker that fails its shadow contributes no evidence, and a cell with no usable breaker is `?`.
 *
 * ⚠ `ok` WINS OVER `MISREAD` when the two breakers disagree. A breaker that failed to break the guard
 * reports a spurious MISREAD (the mr case); a breaker that broke it reports the truth. A unit that really
 * was not declared reads as its letters under EVERY working breaker, so agreement is the normal case and
 * disagreement means one of them did not fire.
 */
const GUARD_BREAKS = ["'", "́"] as const;

/** A token of the same shape as the abbreviation whose first letter begins no unit key — used only to ask
 *  whether `GUARD_BREAK` is phonologically inert here, never to judge a unit. */
const shadow = (abbr: string): string => (/^[bB]/u.test(abbr) ? "d" : "b") + abbr.slice(1);

type Verdict = "ok" | "MISREAD" | "LEAK" | "DROP" | "?" | "-";
interface Row {
    lang: string;
    routing: "RAW" | "READS" | "DROPS" | "MIXED" | "THROW";
    /** Does this engine have a SYMBOL TIER at all? `50%` reading differently from `50` proves one ran. An
     *  engine without a tier mis-reads every unit for a structural reason — that is a whole normalization
     *  job, not this defect class. An engine WITH a tier that still mis-reads a core unit is the fixable
     *  population: the machinery is present and one `units` key is missing. */
    tier: boolean;
    verdicts: Map<string, Verdict>;
    reading: Map<string, string>;
    collisions: string[];
}

const rows: Row[] = [];
const argv = process.argv.slice(2);
const only = argv.includes("--langs") ? argv[argv.indexOf("--langs") + 1]!.split(",") : undefined;
const codes = only ?? ALL_CODES;

for (const lang of codes) {
    let numTokens: string[];
    try { numTokens = tokens(phonemize(N, lang)); } catch {
        rows.push({ lang, routing: "THROW", tier: false, verdicts: new Map(), reading: new Map(), collisions: [] });
        continue;
    }
    let tier = false;
    try { tier = strip(phonemize("50%", lang)) !== strip(phonemize("50", lang)) && !/%/u.test(phonemize("50%", lang)); } catch { /* no number path */ }

    // Disposition first — it decides how to READ every verdict below.
    const dispositions = new Set<string>();
    for (const ctl of CONTROLS) {
        const seg = segment(ctl, lang, numTokens);
        if (!seg) { dispositions.add("THROW"); continue; }
        if (seg.length === 0) dispositions.add("DROPS");
        else if (seg.join(" ") === ctl) dispositions.add("RAW");
        else dispositions.add("READS");
    }
    const routing = dispositions.size === 1 ? ([...dispositions][0] as Row["routing"]) : "MIXED";

    const verdicts = new Map<string, Verdict>();
    const reading = new Map<string, string>();
    for (const abbr of UNITS) {
        const seg = segment(abbr, lang, numTokens);
        if (!seg) { verdicts.set(abbr, "-"); continue; }
        reading.set(abbr, seg.join(" "));
        if (seg.length === 0) { verdicts.set(abbr, "DROP"); continue; }
        // ⚠ LEAK OUTRANKS MISREAD. Raw ASCII in the phoneme string is also, trivially, "equal to the
        // fallback" — but it is the VISIBLE failure the other gates already count, and folding it into this
        // one would inflate the silent class with cases that are not silent.
        if (seg.join(" ") === abbr) { verdicts.set(abbr, "LEAK"); continue; }
        const sh = shadow(abbr);
        const shBare = segment(sh, lang, numTokens)?.join(" ");
        let converted: boolean | undefined;
        for (const brk of GUARD_BREAKS) {
            if (shBare === undefined || segment(sh + brk, lang, numTokens)?.join(" ") !== shBare) continue;
            const fallback = segment(abbr + brk, lang, numTokens);
            if (fallback === undefined) continue;
            converted = (converted ?? false) || seg.join(" ") !== fallback.join(" ");
        }
        verdicts.set(abbr, converted === undefined ? "?" : converted ? "ok" : "MISREAD");
    }

    /**
     * ⚠ A COLLISION IS ONLY INTERESTING WHERE AT LEAST ONE SIDE WAS CONVERTED. Two units that were both
     * merely spelled out by the letter fallback read alike for the trivial reason — `l` and `L` are the
     * same letter, `cm` and `km` both come back as [k][m] — and reporting that as a collision restates the
     * MISREAD finding on both keys while drowning the real ones. The first run printed `l=L /ɛɫ/` on 120
     * engines for exactly that reason.
     *
     * What survives the filter is a pair whose two sides FAILED DIFFERENTLY and met anyway — a declared
     * kilometre word landing on an undeclared centimetre, or the ⟨km⟩ that leaked as raw ASCII arriving at
     * the same string as the ⟨cm⟩ the letter fallback pronounced [k][m]. Both halves of that second shape
     * are separately reported above; the pair is worth its own line because it names the CONSEQUENCE, which
     * is that the two readings are indistinguishable downstream.
     */
    const collisions: string[] = [];
    for (const [a, b] of CONFUSABLE) {
        const ra = reading.get(a), rb = reading.get(b);
        if (ra === undefined || rb === undefined || ra === "" || rb === "") continue;
        if (verdicts.get(a) === verdicts.get(b) && verdicts.get(a) !== "ok") continue;
        if (ra === rb) collisions.push(`${a}=${b} /${ra}/`);
    }
    rows.push({ lang, routing, tier, verdicts, reading, collisions });
}

const coreMisread = (r: Row): number => [...r.verdicts].filter(([u, v]) => CORE.has(u) && v === "MISREAD").length;

if (argv.includes("--json")) {
    console.log(JSON.stringify(rows.map((r) => ({
        lang: r.lang, routing: r.routing, tier: r.tier, coreMisread: coreMisread(r),
        verdicts: Object.fromEntries(r.verdicts), reading: Object.fromEntries(r.reading),
        collisions: r.collisions,
    })), null, 1));
} else {
    const width = Math.max(...UNITS.map((u) => u.length), 3);
    const cell = (v: Verdict | undefined): string =>
        ({ ok: "·", MISREAD: "M", LEAK: "L", DROP: "D", "?": "?", "-": " " })[v ?? "-"]!.padEnd(width);
    console.log("# MIS-READING PROBE — the unit defect that produces a WORD, not garbage.");
    console.log("#   M = read into something that is not a unit word (SILENT — no other gate sees this)");
    console.log("#   L = leaked as its own ASCII (VISIBLE — already counted by audit/coverage/mine)");
    console.log("#   D = vanished · · = a unit rule fired and expanded it");
    console.log("# tier = the engine has a symbol tier (50% ≠ 50), so a mis-read core unit is ONE MISSING KEY.");
    console.log(`\n${"lang".padEnd(8)}${"routing".padEnd(8)}${"tier".padEnd(6)}${"core".padEnd(6)}${UNITS.map((u) => u.padEnd(width)).join("")}  collisions`);
    let misread = 0, leak = 0, core = 0, silentLangs = 0;
    const shown = [...rows].sort((a, b) => coreMisread(b) - coreMisread(a) || a.lang.localeCompare(b.lang));
    for (const r of shown) {
        const n = [...r.verdicts.values()].filter((v) => v === "MISREAD").length;
        misread += n;
        leak += [...r.verdicts.values()].filter((v) => v === "LEAK").length;
        core += coreMisread(r);
        if (coreMisread(r) > 0) silentLangs++;
        if (!argv.includes("--all") && coreMisread(r) === 0 && r.collisions.length === 0 && r.routing !== "THROW") continue;
        console.log(`${r.lang.padEnd(8)}${r.routing.padEnd(8)}${(r.tier ? "yes" : "-").padEnd(6)}${String(coreMisread(r)).padEnd(6)}${UNITS.map((u) => cell(r.verdicts.get(u))).join("")}  ${r.collisions.join("  ")}`);
    }
    const withTier = rows.filter((r) => r.tier);
    console.log(`\n${rows.length} engines · ${silentLangs} mis-read at least one CORE unit · ${core} core mis-read cells · ${misread} mis-read cells overall · ${leak} leaked cells`);
    console.log(`routing: ${[...new Set(rows.map((r) => r.routing))].map((k) => `${k} ${rows.filter((r) => r.routing === k).length}`).join(" · ")}`);
    console.log(`symbol tier present: ${withTier.length} · of those, ${withTier.filter((r) => coreMisread(r) > 0).length} still mis-read a core unit (${withTier.reduce((a, r) => a + coreMisread(r), 0)} cells) — THE FIXABLE POPULATION`);
    console.log(`collisions: ${rows.filter((r) => r.collisions.length).length} engines · ${rows.reduce((a, r) => a + r.collisions.length, 0)} pairs`);
}
