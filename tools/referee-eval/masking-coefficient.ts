/**
 * Masking-coefficient analysis — how much of a language's reported folded% is propped up by folds that MERGE
 * PHONEMICALLY DISTINCT sounds (and can therefore convert a wrong g2p output into a false match), as opposed to
 * benign one-to-one relabels (ɾ→r) and suprasegmental strips (tone/stress) that only rename or peel a layer.
 *
 * Every fold is auto-TAGGED from its shape (no manual annotation of the 130 configs):
 *   - strip         replace is empty / not a single base phone (suprasegmental or notation removal — ˈ, ʰ, tie)
 *   - structural    the pattern is a regex (gemination (.)\1, clusters) — not a phone substitution
 *   - relabel       one base phone → one DIFFERENT base phone, and no other phone maps to that same target (ɾ→r)
 *   - collapse      ≥2 distinct base phones map to the SAME target (e.g. [e o ɒ]→a) — the masking class
 *
 * The MASKING COEFFICIENT is measured, not just counted: re-run the eval keeping every fold EXCEPT the `collapse`
 * ones, and report the drop. That drop is the pp of the headline folded% that rests on phoneme-merging folds — the
 * amount by which the score can overstate the g2p on a genuinely-contrastive (often input-unrecoverable) axis.
 *
 *   npx tsx tools/referee-eval/masking-coefficient.ts            # ranked masking table over all languages
 *   npx tsx tools/referee-eval/masking-coefficient.ts --tags fa  # per-fold tags for one language
 */
import { CONFIG } from "./config.ts";
import { evaluate } from "./eval.ts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE = 1500; // deterministic stride sample; the coefficient is a ratio, so a sample is a faithful estimate

// Codepoints that are NOT a segmental base phone: combining marks, spacing modifiers (ʰ ʷ ʲ ˤ tone letters),
// superscripts (ᵘ ᶷ ⁱ …), ties, length. A fold source/target made only of these is notation, not a phone.
function isModifier(cp: number): boolean {
    return (
        (cp >= 0x300 && cp <= 0x36f) || // combining diacritics
        (cp >= 0x2b0 && cp <= 0x2ff) || // spacing modifier letters (ʰ ʲ ʷ ˤ ˠ ˀ + tone letters ˥–˩)
        (cp >= 0x1d2c && cp <= 0x1d6b) || // phonetic superscripts (ᵃ ᵇ …)
        (cp >= 0x1da0 && cp <= 0x1dff) || // superscript/subscript phonetic extensions (ᵝ ᶷ ᶦ …)
        (cp >= 0x2070 && cp <= 0x209f) || // super/subscripts (ⁱ ⁿ …)
        cp === 0x361 || cp === 0x35c || // tie bars
        cp === 0x2d0 || cp === 0x2d1 || // length ː ˑ
        cp === 0xa71b || cp === 0xa71c // up/down-step
    );
}

/** The single BASE phone of a fold member (NFD, drop modifiers). Returns the base char, or null if the member is
 *  empty, all-modifier (notation), or more than one base phone (a cluster / gemination target). */
function baseSingle(s: string): string | null {
    const base = [...s.normalize("NFD")].filter((c) => !isModifier(c.codePointAt(0)!));
    if (base.length !== 1) return null;
    return base[0]!.normalize("NFC");
}

/** Expand a fold PATTERN (from RegExp.source) into its literal source members, or null if it's a structural regex
 *  (metacharacters, backreferences) that isn't a plain phone substitution. */
function patternMembers(src: string): string[] | null {
    const cls = /^\[([^\]]+)\]$/u.exec(src);
    if (cls) {
        if (cls[1]!.includes("-")) return null; // a range → treat as structural (rare in phone folds)
        return [...cls[1]!.normalize("NFC")];
    }
    if (/[.*+?()|\\^$]/u.test(src)) return null; // regex metachars / backrefs → structural
    return [src]; // a plain literal (may still be multi-phone, filtered by baseSingle)
}

type Tag = "strip" | "structural" | "relabel" | "collapse";
interface TaggedFold { note: string; source: string; replace: string; tag: Tag; sources: string[]; target: string | null }

/** Tag every fold of a language and identify the `collapse` (masking) set. */
function tagFolds(folds: readonly [RegExp, string, string][]): TaggedFold[] {
    // First pass: base source phones → base target, pooled across ALL folds (so two rules sharing a target count).
    const tgt2src = new Map<string, Set<string>>();
    const parsed = folds.map(([re, rep, note]) => {
        const members = patternMembers(re.source);
        const target = baseSingle(rep);
        const sources = members === null || target === null
            ? []
            : [...new Set(members.map(baseSingle).filter((b): b is string => b !== null && b !== target))];
        if (target !== null) for (const s of sources) (tgt2src.get(target) ?? tgt2src.set(target, new Set()).get(target)!).add(s);
        return { note, source: re.source, replace: rep, members, target, sources };
    });
    const collapseTargets = new Set([...tgt2src].filter(([, s]) => s.size >= 2).map(([t]) => t));
    return parsed.map((p): TaggedFold => {
        let tag: Tag;
        if (p.members === null) tag = "structural";
        else if (p.target === null) tag = "strip";
        else if (collapseTargets.has(p.target) && p.sources.length > 0) tag = "collapse";
        else if (p.sources.length > 0) tag = "relabel";
        else tag = "strip"; // maps a phone to itself after backbone (pure notation)
        return { note: p.note, source: p.source, replace: p.replace, tag, sources: p.sources, target: p.target };
    });
}

function verdicts(): Map<string, string> {
    const m = new Map<string, string>();
    const path = join(dirname(fileURLToPath(import.meta.url)), "../../docs/language-maturity.md");
    for (const line of readFileSync(path, "utf8").split("\n")) {
        const mm = /^\| \*\*([\w-]+)\*\*[^|]*\|[^|]*\|[^|]*\|\s*([^\s|]+)\s*\|/u.exec(line);
        if (mm) m.set(mm[1]!, mm[2]!);
    }
    return m;
}

// ---- --tags <lang> mode: print the per-fold tags for one language ---------------------------------------------
const tagsArg = process.argv.indexOf("--tags");
if (tagsArg >= 0) {
    const lang = process.argv[tagsArg + 1]!;
    const cfg = CONFIG[lang];
    if (!cfg) throw new Error(`no config for ${lang}`);
    const all = [...cfg.folds, ...cfg.referees.flatMap((r) => r.folds ?? [])];
    for (const f of tagFolds(all)) {
        const merge = f.tag === "collapse" ? `  [${f.sources.join("")}→${f.target}]` : "";
        console.log(`  ${f.tag.padEnd(11)} /${f.source}/→"${f.replace}"${merge}  — ${f.note.slice(0, 90)}`);
    }
    process.exit(0);
}

// ---- default mode: measured masking coefficient over the whole fleet -------------------------------------------
const verd = verdicts();
interface Row { lang: string; full: number; noMask: number; lift: number; symbol: number; merges: string; verdict: string }
const rows: Row[] = [];

for (const lang of Object.keys(CONFIG).sort()) {
    const cfg = CONFIG[lang]!;
    try {
        const full = await evaluate(lang, true, SAMPLE);
        const p = full.find((r) => r.role === "primary") ?? full[0];
        if (!p || p.total === 0) continue;
        const fullPct = (p.folded / p.total) * 100;

        // Tag folds POOLED across the language + its per-referee folds (so a target shared between the two lists is
        // counted once), then mark the exact fold tuples that came out `collapse`.
        const pooled = [...cfg.folds, ...cfg.referees.flatMap((r) => r.folds ?? [])];
        const tags = tagFolds(pooled);
        const isCollapse = new Map<readonly [RegExp, string, string], boolean>();
        pooled.forEach((f, i) => isCollapse.set(f, tags[i]!.tag === "collapse"));
        const merges = [...new Set(tags.filter((t) => t.tag === "collapse").map((t) => `${t.sources.join("")}→${t.target}`))].join(" ");
        if (![...isCollapse.values()].some(Boolean)) {
            rows.push({ lang, full: fullPct, noMask: fullPct, lift: 0, symbol: p.symbolAcc * 100, merges: "", verdict: verd.get(lang) ?? "?" });
            continue;
        }
        // Re-eval keeping every fold EXCEPT the collapse ones (filter by tuple reference identity).
        const savedFolds = cfg.folds, savedRef = cfg.referees.map((r) => r.folds);
        (cfg as { folds: unknown }).folds = savedFolds.filter((f) => !isCollapse.get(f));
        cfg.referees.forEach((r, i) => { if (savedRef[i]) (r as { folds: unknown }).folds = savedRef[i]!.filter((f) => !isCollapse.get(f)); });
        const noMask = await evaluate(lang, true, SAMPLE);
        (cfg as { folds: unknown }).folds = savedFolds;
        cfg.referees.forEach((r, i) => ((r as { folds: unknown }).folds = savedRef[i]));

        const b = noMask.find((r) => r.role === "primary") ?? noMask[0]!;
        const noMaskPct = (b.folded / b.total) * 100;
        rows.push({ lang, full: fullPct, noMask: noMaskPct, lift: fullPct - noMaskPct, symbol: p.symbolAcc * 100, merges, verdict: verd.get(lang) ?? "?" });
    } catch (e) {
        process.stderr.write(`skip ${lang}: ${(e as Error).message}\n`);
    }
}

rows.sort((a, b) => b.lift - a.lift);
console.log("lang    full   no-mask  masking  symbol  verdict  collapses");
for (const r of rows) {
    if (r.lift < 0.05 && r.merges === "") continue; // hide the clean (no-collapse) rows
    console.log(
        `${r.lang.padEnd(7)} ${r.full.toFixed(1).padStart(5)}% ${r.noMask.toFixed(1).padStart(6)}% ${("+" + r.lift.toFixed(1)).padStart(7)} ${r.symbol.toFixed(1).padStart(5)}%   ${r.verdict.padEnd(3)}    ${r.merges}`,
    );
}
