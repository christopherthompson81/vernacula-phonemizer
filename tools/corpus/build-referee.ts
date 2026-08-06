/**
 * Referee builder — assemble a `word<TAB>IPA` referee for a language from en.wiktionary's
 * `Category:<Lang> terms with IPA pronunciation`, the human-transcribed pronunciation set the referee-eval grades
 * against. This is the committed, reusable replacement for the throwaway per-language scrapers each bring-up was
 * hand-rolling (mos, ki, …).
 *
 * ── The corpus lesson: BATCH + CACHE, don't sequential-live-API ───────────────────────────────────────────────
 * The naive scraper does one `titles=<word>&prop=revisions` request PER word (1062 words → 1062 round-trips,
 * minutes). Instead this uses the MediaWiki GENERATOR: `generator=categorymembers` + `prop=revisions` fetches up to
 * 50 pages' wikitext IN ONE request, so ki's 1062 members come back in ~22 round-trips (seconds). Each raw batch
 * response is cached under `.cache/<lang>/` so a re-run (or `--no-network`) is instant and reproducible — the
 * corpus engine's durable-cache stance.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *   npx tsx tools/corpus/build-referee.ts --lang ki                  # Kikuyu → referees/ki.wiktionary-ki.tsv
 *   npx tsx tools/corpus/build-referee.ts --lang mos --wnl Moore     # Wiktionary section name ≠ our label
 *   npx tsx tools/corpus/build-referee.ts --lang ki --code kik       # {{IPA|kik|…}} template code ≠ --lang
 *   npx tsx tools/corpus/build-referee.ts --lang ki --no-network     # rebuild from cache only
 *
 * Flags:
 *   --lang <code>   (required) our language code; names the output + template code + Wiktionary section by default
 *   --wnl <name>    Wiktionary L2 section / category language name (default: builtin map, else capitalised --lang)
 *   --code <code>   the {{IPA|<code>|…}} template language code (default: --wnl-derived builtin, else --lang)
 *   --out <path>    output TSV (default tools/referee-eval/referees/<lang>.wiktionary-<lang>.tsv)
 *   --cache-dir <d> raw-response cache root (default tools/corpus/.cache)
 *   --no-network    use only cached batches; fail if a needed batch is absent
 *   --limit <N>     stop after N category members (debug)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");
const API = "https://en.wiktionary.org/w/api.php";
const UA = "vernacula-phonemizer-referee/1.0 (linguistic research; https://github.com/christopherthompson81/vernacula-phonemizer)";

// Wiktionary L2 language NAME (section header + category) and template {{IPA|CODE}} for our code, where they differ
// from a naive capitalisation. Extend as languages are added.
const WNL: Record<string, string> = { mos: "Moore", ki: "Kikuyu" };
const CODE: Record<string, string> = { mos: "mos", ki: "ki" };

interface Args {
    lang: string;
    wnl: string;
    code: string;
    out: string;
    cacheDir: string;
    network: boolean;
    limit: number;
}

function parseArgs(argv: string[]): Args {
    const a: Partial<Args> = { cacheDir: join(REPO, "tools", "corpus", ".cache"), network: true, limit: Infinity };
    for (let i = 0; i < argv.length; i++) {
        const f = argv[i];
        const next = () => argv[++i]!;
        if (f === "--lang") a.lang = next();
        else if (f === "--wnl") a.wnl = next();
        else if (f === "--code") a.code = next();
        else if (f === "--out") a.out = next();
        else if (f === "--cache-dir") a.cacheDir = resolve(next());
        else if (f === "--no-network") a.network = false;
        else if (f === "--limit") a.limit = Number(next());
        else if (f === "--help" || f === "-h") { console.log("See the file header for usage."); process.exit(0); }
        else { console.error(`unknown flag: ${f}`); process.exit(2); }
    }
    if (!a.lang) { console.error("--lang is required"); process.exit(2); }
    a.wnl ??= WNL[a.lang] ?? a.lang[0]!.toUpperCase() + a.lang.slice(1);
    a.code ??= CODE[a.lang] ?? a.lang;
    a.out ??= join(REPO, "tools", "referee-eval", "referees", `${a.lang}.wiktionary-${a.lang}.tsv`);
    return a as Args;
}

/** One batched generator call: up to 50 category members with their wikitext. Cached by batch index. */
async function fetchBatch(args: Args, dir: string, idx: number, cont: Record<string, string>): Promise<any> {
    const cacheFile = join(dir, `batch-${String(idx).padStart(4, "0")}.json`);
    if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));
    if (!args.network) throw new Error(`--no-network but batch ${idx} not cached (${cacheFile})`);
    const p = new URLSearchParams({
        action: "query", format: "json", formatversion: "2",
        generator: "categorymembers", gcmtitle: `Category:${args.wnl} terms with IPA pronunciation`,
        gcmnamespace: "0", gcmlimit: "50", prop: "revisions", rvprop: "content", rvslots: "main", ...cont,
    });
    let last: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const res = await fetch(`${API}?${p}`, { headers: { "User-Agent": UA } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            writeFileSync(cacheFile, JSON.stringify(data));
            return data;
        } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500)); }
    }
    throw last;
}

/** Extract the first phonemic /…/ (else phonetic […]) IPA from the page's `==<wnl>==` section {{IPA|<code>|…}}. */
function sectionIpa(content: string, wnl: string, code: string): string | undefined {
    const m = content.match(new RegExp(`\\n==\\s*${wnl}\\s*==\\s*\\n([\\s\\S]*?)(?=\\n==[^=]|$)`, "u"));
    const sect = m ? m[1]! : content;
    const tpl = sect.match(new RegExp(`\\{\\{IPA\\|${code}\\|([^}]*)\\}\\}`, "u"));
    if (!tpl) return undefined;
    const forms = [...tpl[1]!.matchAll(/[/[]([^/\]]+)[/\]]/gu)].map((f) => f[1]!.trim());
    return forms[0];
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const dir = join(args.cacheDir, args.lang);
    mkdirSync(dir, { recursive: true });
    // If a re-run and network is off, honour any manually-cleared cache by re-numbering from 0.
    if (args.network) for (const f of readdirSync(dir)) if (/^batch-\d+\.json$/.test(f)) { /* keep — resumable */ }
    console.error(`[referee] lang=${args.lang} wnl=${args.wnl} code=${args.code} → ${args.out}`);

    const rows: [string, string][] = [];
    let cont: Record<string, string> = {}, idx = 0, members = 0;
    for (;;) {
        const data: any = await fetchBatch(args, dir, idx, cont);
        for (const page of data?.query?.pages ?? []) {
            members++;
            const content: string | undefined = page?.revisions?.[0]?.slots?.main?.content;
            if (!content) continue;
            const ipa = sectionIpa(content, args.wnl, args.code);
            if (ipa) rows.push([page.title as string, ipa]);
        }
        process.stderr.write(`\r[referee] batch ${idx} · ${members} members · ${rows.length} with IPA …`);
        if (members >= args.limit || !data?.continue) break;
        cont = data.continue as Record<string, string>;
        idx++;
    }
    rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const header = [
        `# ${args.wnl} (${args.lang}) — en.wiktionary Category:${args.wnl} terms with IPA pronunciation (HUMAN, ${args.wnl} section).`,
        `# Built by tools/corpus/build-referee.ts (batched generator API, cached). ${members} members → ${rows.length} with a parseable {{IPA|${args.code}|…}}.`,
    ].join("\n");
    writeFileSync(args.out, header + "\n" + rows.map(([w, ipa]) => `${w}\t${ipa}`).join("\n") + "\n");
    console.error(`\n[referee] wrote ${rows.length} word/IPA rows → ${args.out} (cache: ${dir})`);
}

main().catch((e) => { console.error("\n", e); process.exit(1); });
