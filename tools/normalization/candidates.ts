/**
 * WHICH OF THE UNMINED LANGUAGES CAN BE MINED AT ALL? — the triage that has to come before the sweep.
 *
 * proposes extending the normalization diff gate past the 67 FLEURS languages to the rest of the
 * registry, by mining wiki text. Measured when this file was written: **188 registry codes, 67 mined
 * artifacts, 121 to go**, and the 67 are exactly the FLEURS set — not one corpus-less code has been mined,
 * though the tooling to do it (`mine.ts`, `cells.ts`, the `review.ts` staleness gate) has existed since the
 * Burmese pilot.
 *
 * ⚠ THE ISSUE COUNTS CANDIDATES BY THE WRONG RESOURCE, and it matters because it inflates the answer. It
 * reasons that "90 have a word-level referee … which means there is running text behind the route we are
 * already using for pronunciation". A referee is a PRONUNCIATION LEXICON — `kaikki` and `wikipron` are
 * word→IPA tables extracted from Wiktionary — and a dictionary is not running text. The two resources are
 * independent in both directions, measured here:
 *
 *   `hil` (Hiligaynon)  has a referee and NO WIKIPEDIA AT ALL — hil.wikipedia.org does not resolve
 *   `ig`  (Igbo)        has a live wiki with 60k+ articles and NO referee
 *
 * So this tool counts the resource mining actually consumes: a wiki with prose in it.
 *
 * ⚠ THE REGISTRY CODE IS NOT THE WIKI CODE, and guessing it is how a live wiki gets filed as absent.
 * Chuvash is `cv` not `chv`, Bhojpuri is `bh` not `bho`, Chichewa is `ny` not `nya`. Five of the codes that
 * look wiki-less have a wiki under another name, so the override table below is hand-verified against
 * sitematrix rather than derived.
 *
 * "CLOSED" IS NOT "ABSENT" — a closed wiki stops accepting edits and keeps serving its content through the
 * API, so frozen text is still minable text and the two closed wikis here were checked rather than dropped.
 * The check then said no: `kl` reports 1,293 pages and **0 articles, 18 words** of indexed article text, and
 * `ak` 1,709 pages and 17 words. They are frozen AND empty. Recording the measurement rather than the
 * expectation, because "closed but readable" was the plausible answer and it was wrong.
 *
 * WHAT THIS DOES NOT ANSWER. Whether the text is TRUSTWORTHY — a bot-built wiki has plenty of articles and
 * cannot gate anything. That is `wiki-health.ts`, which runs on the fetched text, and it is a separate
 * question from this one on purpose: `ceb` scores near the top of this table.
 *
 * Usage:
 *   npx tsx tools/normalization/candidates.ts                 # the unmined fleet, ranked by article count
 *   npx tsx tools/normalization/candidates.ts --all           # including the 67 already mined
 *   npx tsx tools/normalization/candidates.ts --blocked       # only the codes with no minable wiki
 *   npx tsx tools/normalization/candidates.ts --plan 12       # the next N fetch commands, ready to run
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { mapPool } from "./mine.ts";
import { SISTER_STANDARDS } from "./defects.ts";

const argv = process.argv.slice(2);
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);

const UA = "vernacula-phonemizer-corpus-probe/0.1 (https://github.com/christopherthompson81/vernacula-phonemizer)";
const MINED = "tools/corpus/mined";
const REFEREES = "tools/referee-eval/referees";

/**
 * REGISTRY CODE → WIKI CODE, for the cases where they differ. Every entry was checked against sitematrix
 * (`cv bh ny ku nah ms` all present) rather than inferred from the code's shape.
 *
 * A mapping is only listed where the wiki genuinely serves the registry language's variety. `nci` →
 * `nah` is the loosest of these and is marked: nah.wikipedia is written in modern Nahuatl varieties and
 * `nci` is Classical Nahuatl, so its text is evidence for the macrolanguage's orthographic conventions and
 * not for the classical standard. That is still worth mining and the caveat has to travel with it.
 */
const WIKI_OVERRIDE: Record<string, string> = {
    chv: "cv",   // Chuvash
    bho: "bh",   // Bhojpuri — bh.wikipedia IS the Bhojpuri wiki, the ISO code never got its own domain
    nya: "ny",   // Chichewa / Nyanja
    kmr: "ku",   // ku.wikipedia is Kurmanji in Latin script, which is exactly what kmr is
    nci: "nah",  // ⚠ macrolanguage wiki, modern varieties — not the Classical standard
    zsm: "ms",   // Standard Malay
    "es-419": "es", // Latin American Spanish shares the Spanish wiki
};

const fleet = (): string[] => [
    ...new Set([...readFileSync("src/registry.ts", "utf8").matchAll(/case "([a-z][a-z0-9-]*)":/gu)].map((m) => m[1]!)),
];

interface Wiki { open: boolean; closed: boolean }

/**
 * ONE REQUEST FOR THE WHOLE WIKI LIST. The alternative — probing 121 domains — was tried and it is both
 * slower and less informative: a nonexistent wiki fails DNS, which curl reports as HTTP `000`, and that is
 * indistinguishable from a network fault. sitematrix is authoritative and carries the `closed` flag, which
 * no per-domain probe can tell you at all.
 */
async function sitematrix(): Promise<Map<string, Wiki>> {
    const u = new URL("https://meta.wikimedia.org/w/api.php");
    for (const [k, v] of Object.entries({ action: "sitematrix", format: "json", smtype: "language", smlangprop: "code|site" }))
        u.searchParams.set(k, v);
    const j = await (await fetch(u, { headers: { "User-Agent": UA } })).json() as any;
    const out = new Map<string, Wiki>();
    for (const [k, v] of Object.entries<any>(j.sitematrix ?? {})) {
        if (k === "count" || k === "specials") continue;
        const site = (v.site ?? []).find((s: any) => s.code === "wiki");
        if (site === undefined) continue;
        out.set(v.code, { open: !("closed" in site), closed: "closed" in site });
    }
    return out;
}

/**
 * VOLUME, before a single article is fetched. Two figures, and the second is the one that matters:
 *
 *   `articles`  the headline count, and the one that misleads. `chr` has 1,034 articles and `ti` 366, which
 *               ranks Cherokee first — but Cherokee's articles average 39 words and Tigrinya's 266.
 *   `words`     `cirrussearch-article-words`, the total indexed article text. This is the resource mining
 *               consumes, and dividing it by `articles` gives the stub-vs-prose signal directly.
 *
 * ⚠ THE API ANSWERING IS NOT THE WIKI EXISTING. `rup.wikipedia.org` is listed as an open language wiki by
 * sitematrix and serves an HTML redirect to Wikimedia Incubator — the project never graduated to its own
 * wiki. So a non-JSON response is a real outcome and not a hiccup to swallow: it was being reported as
 * "0 articles", which reads as an empty wiki rather than as no wiki.
 *
 * ⚠⚠ AND THEN THE OPPOSITE ERROR, WHICH THIS FILE COMMITTED AND WHICH IS WORSE. The first version folded
 * EVERY failure into that one outcome — `catch { return undefined }` — and `undefined` was read as
 * "incubator". Running the tool twice in a row, the second run reported **he, ka, lt, hy, ky, km, yo, ig and
 * fifteen others as never-launched wikis**, while the first run had listed the same codes with 20-270
 * MILLION words each. Hebrew Wikipedia is not in incubator. Hammering the API at concurrency 8 twice in
 * quick succession dropped connections, and a dropped connection was being laundered into a verdict about
 * the wiki's existence.
 *
 * That is the manufactured-confident-negative failure this toolchain keeps producing in a new place — the
 * `attest.ts` `exlimit` bug and the missing User-Agent in `mine.ts` are the same shape — so the three
 * outcomes are kept apart here, and only ONE of them is a finding:
 *
 *   a 200 whose body is not statistics JSON  → INCUBATOR (a fact about the wiki)
 *   a network or HTTP failure, after retries → UNKNOWN   (a fact about this run, reported as such)
 *   statistics JSON                          → the volume
 */
export interface Volume { articles: number; words: number }
export type Probe = Volume | "incubator" | "unknown";

/**
 * CLASSIFY A PROBE RESPONSE. Extracted so it can be tested: this is the logic that once reported two dozen
 * live wikis as never launched, and it was buried in the CLI where nothing could reach it.
 *
 * `ok` is whether the transport succeeded at all. A body that will not parse as JSON is the incubator
 * redirect — an HTML document — which is a fact about the WIKI, decided on content and unreachable by a
 * transport failure. Everything else that fails is a fact about the RUN.
 */
export function classify(ok: boolean, body: string | undefined): Probe {
    if (!ok || body === undefined) return "unknown";
    let j: any;
    try { j = JSON.parse(body); } catch { return "incubator"; }
    const st = j?.query?.statistics;
    if (typeof st?.articles !== "number") return "incubator";
    return { articles: st.articles, words: typeof st["cirrussearch-article-words"] === "number" ? st["cirrussearch-article-words"] : 0 };
}

const delay = (ms: number): Promise<void> => new Promise((res) => { setTimeout(res, ms); });

async function volume(wiki: string): Promise<Probe> {
    const u = new URL(`https://${wiki}.wikipedia.org/w/api.php`);
    for (const [k, v] of Object.entries({ action: "query", format: "json", meta: "siteinfo", siprop: "statistics" }))
        u.searchParams.set(k, v);
    for (let attempt = 0; attempt < 3; attempt++) {
        let body: string;
        try {
            const r = await fetch(u, { headers: { "User-Agent": UA } });
            if (!r.ok) { await delay(400 * (attempt + 1)); continue; }
            body = await r.text();
        } catch { await delay(400 * (attempt + 1)); continue; }
        return classify(true, body);
    }
    return "unknown";
}

/**
 * ⚠ THE CLI MUST NOT RUN ON IMPORT, and it did. `mine.ts` and `wiki-health.ts` both carry this guard with the
 * same note — "without this the whole CLI ran on import and the test suite died before a single test collected"
 * — and this file is the third to need it. Measured before the fix: importing this module took 1,482 ms and
 * emitted the full report, because it issues roughly ninety live requests to the MediaWiki API at module scope.
 * A test file importing `classify` would therefore have hammered someone else's server on every `vitest run`.
 */
const IS_CLI = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main(): Promise<void> {
    const mined = new Set(readdirSync(MINED).map((f) => f.replace(/\.jsonc$/u, "")));
    const referees = readdirSync(REFEREES);
    const matrix = await sitematrix();

    interface Row {
        code: string;
        wiki: string | undefined;
        state: "open" | "closed" | "none" | "incubator" | "unknown";
        vol: Volume | undefined;
        referees: number;
        sister: string | undefined;
        mined: boolean;
    }

    /** Below this the wiki has no minable prose. `kl` reports 18 words of article text and `ak` 17. */
    const MIN_WORDS = 20_000;

    const codes = fleet().filter((c) => has("all") || !mined.has(c));
    const rows: Row[] = codes.map((code) => {
        const wikiCode = WIKI_OVERRIDE[code] ?? code;
        const entry = matrix.get(wikiCode);
        return {
            code,
            wiki: entry === undefined ? undefined : wikiCode,
            state: entry === undefined ? "none" : entry.closed ? "closed" : "open",
            vol: undefined,
            referees: referees.filter((f) => f.startsWith(`${code}.`)).length,
            sister: SISTER_STANDARDS.find((s) => s.includes(code))?.find((c) => c !== code && mined.has(c)),
            mined: mined.has(code),
        };
    });

    // Volume only for the wikis sitematrix lists, pooled. Concurrency 4, not 8: at 8 the API dropped enough
    // connections that the retry loop above was doing real work on every run, and this is a 90-request sweep
    // against someone else's server.
    const live = rows.filter((r) => r.wiki !== undefined);
    const vols = await mapPool(live, 4, (r) => volume(r.wiki!));
    live.forEach((r, i) => {
        const p = vols[i]!;
        if (p === "incubator" || p === "unknown") r.state = p;
        else r.vol = p;
    });

    /** A wiki with no prose is as blocked as no wiki at all, and for the sweep's purposes the same thing. */
    const empty = (r: Row): boolean => r.state === "incubator" || (r.state !== "unknown" && (r.vol?.words ?? 0) < MIN_WORDS);
    // `unknown` is in NEITHER list — it is a failed probe, and putting it in `blocked` would be the same lie the
    // header describes, one layer up. It is printed separately with an instruction to re-run.
    const unknown = rows.filter((r) => r.state === "unknown");
    const blocked = rows.filter((r) => r.state === "none" || empty(r));
    const usable = rows.filter((r) => r.state !== "none" && r.state !== "unknown" && !empty(r))
        .sort((a, b) => (b.vol?.words ?? 0) - (a.vol?.words ?? 0));

    if (has("blocked")) {
        console.log(`\n── ${blocked.length} codes with no minable wiki ──\n`);
        for (const r of blocked) {
            const why = r.state === "incubator"
                ? `${r.wiki}.wikipedia.org redirects to Wikimedia Incubator — listed by sitematrix, never launched`
                : r.state === "closed"
                    ? `CLOSED wiki with ${r.vol?.words ?? 0} words of article text — frozen AND empty, not frozen and readable`
                    : r.state !== "none"
                        ? `only ${(r.vol?.words ?? 0).toLocaleString("en")} words of article text across ${(r.vol?.articles ?? 0).toLocaleString("en")} articles`
                        : r.sister !== undefined
                            ? `sister artifact ${r.sister}.jsonc covers it`
                            : r.referees > 0 ? `${r.referees} referee(s) but no running text — the referee is a lexicon, not a corpus`
                                : "no wiki and no referee";
            console.log(`  ${r.code.padEnd(8)} ${why}`);
        }
        console.log("");
    } else if (arg("plan") !== undefined) {
        const n = Number(arg("plan"));
        console.log(`\n# next ${n} fetches, densest wiki first. Health-check each BEFORE mining it.\n`);
        for (const r of usable.filter((x) => !x.mined).slice(0, n)) {
            console.log(`npx tsx tools/normalization/mine.ts fetch --wiki ${r.wiki} --out /tmp/${r.code}.raw.txt --random 500`);
            console.log(`npx tsx tools/normalization/wiki-health.ts --in /tmp/${r.code}.raw.txt --label ${r.code} --baseline de_de`);
        }
        console.log("");
    } else {
        console.log(`\n── ${rows.length} unmined registry codes · ${usable.length} with a wiki · ${blocked.length} blocked ──\n`);
        console.log(`  ${"code".padEnd(8)}${"wiki".padEnd(8)}${"articles".padStart(9)}${"words".padStart(14)}${"w/art".padStart(7)}  ${"ref".padStart(3)}  note`);
        for (const r of usable) {
            const perArt = (r.vol?.articles ?? 0) === 0 ? 0 : Math.round((r.vol?.words ?? 0) / r.vol!.articles);
            const note = [
                r.state === "closed" ? "CLOSED wiki — frozen, but the text is still served" : "",
                r.wiki !== r.code ? `filed under ${r.wiki}, not ${r.code}` : "",
                r.sister !== undefined ? `sister ${r.sister} already mined` : "",
                // A stub farm passes the volume floor and still cannot fill a cell inventory: a 40-word article
                // is a lead sentence and an infobox, and the infobox does not survive plain-text extraction.
                perArt > 0 && perArt < 80 ? `⚠ ${perArt} words/article — stubs` : "",
                r.referees === 0 ? "no referee (irrelevant to mining — recorded because the issue counts by it)" : "",
            ].filter(Boolean).join("; ");
            console.log(`  ${r.code.padEnd(8)}${(r.wiki ?? "—").padEnd(8)}${(r.vol?.articles ?? 0).toLocaleString("en").padStart(9)}`
                + `${(r.vol?.words ?? 0).toLocaleString("en").padStart(14)}${String(perArt).padStart(7)}  ${String(r.referees).padStart(3)}  ${note}`);
        }
        console.log(`\n  blocked (${blocked.length}): ${blocked.map((r) => r.code).join(" ")}`);
        if (unknown.length > 0)
            console.log(`  ⚠ PROBE FAILED for ${unknown.length} — ${unknown.map((r) => r.code).join(" ")} — this says nothing about those wikis; re-run`);
        console.log(`  run with --blocked for why each one is blocked, or --plan N for the next N fetch commands\n`);
    }
}

if (IS_CLI) await main();
