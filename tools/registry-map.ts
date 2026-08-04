/**
 * WHICH LANGUAGE CODES THE REGISTRY CAN ACTUALLY SERVE, and which directory each is served from.
 *
 * There is no exported list of language codes — `getPhonemizer` is a switch, and the codes exist only as `case`
 * labels. Anything that wants to sweep the whole fleet has to read them out of the source, and three tools
 * already do it independently (`coverage.ts`, `review.ts`, `sources.ts`, each with a slightly different parse).
 * This is the shared one; the tools above predate it and should be repointed at it.
 *
 * ⚠ WHY A SOURCE PARSE AND NOT A HAND-KEPT LIST. Because a hand-kept list goes stale silently and then
 * understates the scope of every sweep that trusts it — the audit ran for months against a hardcoded 37 of 67
 * languages, and #657's work list was derived from a grep that found 21 of 108 affected engines. A derived list
 * cannot drift from what the registry serves.
 *
 * ⚠ FALL-THROUGH LABELS ACCUMULATE. Several codes share one factory:
 *
 *     case "as":
 *     case "bpy":
 *     case "bn": return createBengali(...)
 *
 * so a `case` with no `return` of its own belongs to the next factory reached, and all of them map to the same
 * directory. Dropping the fall-through labels loses roughly a fifth of the fleet.
 */
import { readFileSync } from "node:fs";

const REGISTRY = new URL("../src/registry.ts", import.meta.url).pathname;

/** Factory name → the `src/languages/<dir>` it is imported from. */
export function factoryDirs(src = readFileSync(REGISTRY, "utf8")): Map<string, string> {
    const out = new Map<string, string>();
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/languages\/([^/"]+)\//gu))
        for (const name of m[1]!.split(",").map((x) => x.trim().split(/\s+as\s+/u)[0]!))
            if (name.startsWith("create")) out.set(name, m[2]!);
    return out;
}

/** Language directory → every code the registry serves from it, in `case`-label order. */
export function dirCodes(src = readFileSync(REGISTRY, "utf8")): Map<string, string[]> {
    const dirs = factoryDirs(src);
    const out = new Map<string, string[]>();
    let pending: string[] = [];
    for (const m of src.matchAll(/case\s+"([\w-]+)"\s*:|return\s+(create\w+)/gu)) {
        if (m[1] !== undefined) {
            pending.push(m[1]);
            continue;
        }
        const dir = dirs.get(m[2]!);
        if (dir !== undefined && pending.length > 0) {
            const seen = out.get(dir) ?? [];
            for (const c of pending) if (!seen.includes(c)) seen.push(c);
            out.set(dir, seen);
        }
        pending = [];
    }
    return out;
}

/** Every code the registry serves, with the directory serving it. */
export function registeredCodes(src = readFileSync(REGISTRY, "utf8")): { code: string; dir: string }[] {
    return [...dirCodes(src)].flatMap(([dir, codes]) => codes.map((code) => ({ code, dir })));
}
