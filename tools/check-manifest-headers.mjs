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

const files = execSync(`git diff --name-only ${base}...HEAD -- 'data/languages/**/*.jsonc'`, { encoding: "utf8" })
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
let compared = 0, unreadable = 0;
for (const f of files) {
    if (!existsSync(f)) continue; // deleted
    let before;
    // ⚠ `stdio: pipe` so git's "exists on disk, but not in <base>" goes to the catch instead of the
    // terminal. The catch means "no version at base to compare against" — usually a new manifest, but also
    // EVERY file when the base predates a tree move, which is how this loop can compare nothing at all.
    // Counted, and reported below, so an "ok" always states what it actually looked at.
    try { before = headers(execSync(`git show ${base}:${f}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })); }
    catch { unreadable++; continue; }
    compared++;
    const src = readFileSync(f, "utf8");
    const after = headers(src);
    // The defect is a header SEPARATED from its key — the old comment survives in the file, now heading
    // someone else's data. A header EDITED in place (old text gone from the file entirely) is a
    // deliberate change, not an orphaning, and must not trip the gate — flagging it would train people
    // to never improve a stale comment.
    const normalized = src.split("\n").map((l) => l.trim()).join("\n");
    for (const [key, comment] of before) {
        if (comment === "") continue; // had no header to lose
        const now = after.get(key);
        if (now === undefined) continue; // key removed — a different question
        // ⚠ AN EXTENDED HEADER IS NOT AN ORPHANED ONE, and this exemption is what makes the gate usable:
        // appending a caveat to a header leaves the old text in the file AND still above its own key, which
        // is indistinguishable from an orphaning by the `normalized.includes` test alone. In a real
        // orphaning the old text has moved to a DIFFERENT key, so `now` cannot contain it. Without this the
        // gate fires on every deliberate header improvement — the same "train people to ignore it" failure
        // the comment above guards against, just from the other direction.
        if (now.includes(comment)) continue;
        if (now !== comment && normalized.includes(comment)) {
            bad++;
            console.error(`✗ ${f}: "${key}" no longer carries its own header`);
            console.error(`   was: ${comment.split("\n")[0]}`);
            console.error(`   now: ${now.split("\n")[0] || "(none — a new block was inserted between them)"}`);
        }
    }
}
const newAtBase = unreadable === 0 ? "" : `, ${unreadable} with no version at ${base} (new, or the base predates a tree move)`;
console.log(
    bad === 0
        ? `ok — ${files.length} changed manifest(s), ${compared} compared${newAtBase}; every pre-existing key kept its own header`
        : `${bad} orphaned header(s)`,
);
// ⚠ SAME RULE AS THE EMPTY-DIFF BRANCH ABOVE: changed files that were all unreadable at the base compared
// nothing, and "ok" over nothing is the vacuous pass that let #755 ship. Distinguished from a real pass.
if (bad === 0 && compared === 0) {
    console.error(`check-manifest-headers: NOTHING WAS ACTUALLY COMPARED — ${files.length} changed manifest(s), none readable at ${base}.`);
    process.exit(2);
}
process.exit(bad === 0 ? 0 : 1);
