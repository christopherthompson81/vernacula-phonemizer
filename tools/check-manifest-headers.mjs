/**
 * A manifest key must keep the comment that heads it.
 *
 * ⚠ THE DEFECT THIS EXISTS FOR, four times over (#746, #750, #751, #755). Adding a key to a manifest means
 * picking an anchor to insert before, and the obvious anchor is the next key — which drops the new block
 * BETWEEN an existing header comment and the table it describes. Nothing breaks, every test passes, and a
 * reader following the comment reaches the wrong data: ancientgreek's "Base consonant letter → IPA" ended
 * up heading a list of voiced consonants, khmer's "Base consonant → [onset IPA, series]" the diacritics.
 *
 * Compares against a BASE REVISION (default `main`) rather than checking a standalone invariant, because
 * "every key has a comment" is not true and should not be — some keys are self-evident. The question is
 * only whether a key that HAD a header still has the SAME one.
 *
 *     node tools/check-manifest-headers.mjs [baseRev]
 *
 * ⚠ IT REFUSES TO PASS VACUOUSLY. Run against uncommitted work the diff is empty, and an earlier version
 * of this script printed "ok — every key kept its header" having compared nothing at all; that is how
 * #755 shipped with the defect this script exists to catch. Comparing zero files is now an ERROR, not a
 * pass — the same rule this repo applies to its own gates (see test/manifest-script.test.ts's count
 * assertion, and cyrillic-confusables' `expect(declared.size).toBeGreaterThan(5)`).
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const base = process.argv[2] ?? "main";

/** key → the comment block directly above it, for TOP-LEVEL keys (4-space indent) only. */
function headers(src) {
    const lines = src.split("\n");
    const map = new Map();
    for (let i = 0; i < lines.length; i++) {
        const m = /^ {4}"([a-zA-Z]+)":/.exec(lines[i]);
        if (!m) continue;
        const block = [];
        for (let c = i - 1; c >= 0 && lines[c].trim().startsWith("//"); c--) block.unshift(lines[c].trim());
        map.set(m[1], block.join("\n"));
    }
    return map;
}

const files = execSync(`git diff --name-only ${base}...HEAD -- 'src/languages/**/*.jsonc'`, { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);

if (files.length === 0) {
    console.error(
        `check-manifest-headers: NOTHING TO COMPARE against ${base}.\n` +
        `  No changed manifests between ${base} and HEAD. If you have edits in the working tree, COMMIT\n` +
        `  them first — this check reads HEAD, and a clean pass here would mean nothing.`,
    );
    process.exit(2);
}

let bad = 0;
for (const f of files) {
    if (!existsSync(f)) continue; // deleted
    let before;
    try { before = headers(execSync(`git show ${base}:${f}`, { encoding: "utf8" })); } catch { continue; } // new file
    const after = headers(readFileSync(f, "utf8"));
    for (const [key, comment] of before) {
        if (comment === "") continue; // had no header to lose
        const now = after.get(key);
        if (now === undefined) continue; // key removed — a different question
        if (now !== comment) {
            bad++;
            console.error(`✗ ${f}: "${key}" no longer carries its own header`);
            console.error(`   was: ${comment.split("\n")[0]}`);
            console.error(`   now: ${now.split("\n")[0] || "(none — a new block was inserted between them)"}`);
        }
    }
}
console.log(
    bad === 0
        ? `ok — ${files.length} changed manifest(s), every pre-existing key kept its own header`
        : `${bad} orphaned header(s)`,
);
process.exit(bad === 0 ? 0 : 1);
