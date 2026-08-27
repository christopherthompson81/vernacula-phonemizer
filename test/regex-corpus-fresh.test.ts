/**
 * THE CHECKED-IN REGEX CORPUS MUST MATCH A FRESH EXTRACTION (#1083).
 *
 * `csharp/regex-corpus.jsonl` is what `csharp/tools/regex-diff` replays through `JsRegex`. That harness is
 * the ONLY gate covering the pattern translator, and it found SEVEN real defects on its first run — simple
 * case folding, `[^\S\n]`, astral class members, the empty-class-is-not-empty trap, code points vs code
 * units, and the two advance rules. Every one of those is silent everywhere else: the pattern compiles, it
 * matches slightly different text, and the damage surfaces later as a wrong phoneme with no trace back.
 *
 * ⚠ AND A HARNESS ONLY SEES A PATTERN IF THE CORPUS CONTAINS IT. The corpus drifted behind `src/` for long
 * enough that a re-extraction moved 582 lines in languages nobody had touched — it still recorded zu's
 * doubled-space classes from before #925. So `regex-diff` was replaying patterns that no longer exist while
 * the ones that replaced them went untested, and it reported CLEAN throughout, because stale patterns
 * translate fine. A gate that narrows silently is worse than one that fails.
 *
 * ⚠ THE EXTRACTOR IS IMPORTED FOR ITS `CORPUS`, NOT RUN. Running it writes the very file this compares
 * against, which would make the comparison vacuous by construction — the module guards its own write on
 * being the entry point for exactly that reason.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

import { CORPUS, CORPUS_PATH } from "../tools/extract_regexes.mts";

test("csharp/regex-corpus.jsonl is a fresh extraction of src/ (#1083)", () => {
    const committed = readFileSync(CORPUS_PATH, "utf8");
    if (committed === CORPUS) return;

    // The diff is data, not prose, so report SHAPE rather than dumping 582 lines into the failure.
    const fresh = new Set(CORPUS.split("\n").filter(Boolean));
    const old = new Set(committed.split("\n").filter(Boolean));
    const added = [...fresh].filter((l) => !old.has(l));
    const gone = [...old].filter((l) => !fresh.has(l));
    const pat = (l: string): string => (JSON.parse(l) as { pattern: string }).pattern;
    expect.fail(
        `regex-corpus.jsonl is stale: ${added.length} rows to add, ${gone.length} to drop.\n` +
            `  run: npx tsx tools/extract_regexes.mts && dotnet run --project csharp/tools/regex-diff\n` +
            `  ⚠ RUN THE DIFF TOO, not just the extraction — a newly recorded pattern may be one JsRegex has\n` +
            `    never been asked to translate, and that is the whole point of keeping this current.\n` +
            `  first added: ${added.slice(0, 3).map(pat).join("  ")}\n` +
            `  first gone:  ${gone.slice(0, 3).map(pat).join("  ")}`,
    );
});
