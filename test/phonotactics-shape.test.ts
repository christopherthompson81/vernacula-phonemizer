/**
 * PHONOTACTICS: the onset and coda sets are consulted with a TWO-CHARACTER key and with nothing else.
 *
 * `core/initialisms.ts` `makeUnreadableTest` asks `legalOnsets.has(w.slice(0, 2))` and
 * `legalCodas.has(w.slice(-2))`, guarded on both characters being consonants. A ONE-character entry in
 * either list can therefore never be looked up — it is data that reads as a licence and grants none.
 *
 * ⚠ THREE LANGUAGES CARRIED SUCH ENTRIES AND TWO OF THEM WERE ENTIRELY DEAD. Hausa's coda list was 16
 * single letters for 16, Indonesian's was 12 of 14 with both survivors (`ng`, `kh`) already licensed by
 * `digraphs` through the same test's `|| digraphs.has(tail)` arm. So both languages declared a coda
 * inventory that could not change one verdict, and Hausa's even listed `"n"` twice — the tell that nothing
 * was reading it. Removing them moved 0 of 200 golden rows each.
 *
 * This test is the guard. It is deliberately a SHAPE assertion over the shipped data rather than a
 * behavioural one: the failure mode is silent by construction, so a reading-based test cannot see it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseJsonc } from "../src/core/jsonc.ts";

interface Phonotactics { vowels?: string; onsets?: string[]; codas?: string[]; digraphs?: string[] }

/** Every shipped manifest that declares a `phonotactics` block, as [language, block]. */
const BLOCKS: [string, Phonotactics][] = readdirSync("data/languages").flatMap((lang) => {
    const dir = `data/languages/${lang}`;
    return readdirSync(dir).filter((f) => f.endsWith(".jsonc")).flatMap((f) => {
        const doc = parseJsonc(readFileSync(`${dir}/${f}`, "utf8")) as { phonotactics?: Phonotactics };
        return doc.phonotactics === undefined ? [] : [[`${lang}/${f}`, doc.phonotactics] as [string, Phonotactics]];
    });
});

describe("phonotactics onset/coda entries are reachable", () => {
    test("the fleet actually declares some — a passing empty sweep would prove nothing", () => {
        expect(BLOCKS.length).toBeGreaterThan(5);
    });

    test.each(BLOCKS)("%s declares no one-character onset or coda", (_name, p) => {
        // ⚠ NOT `.every(...)` — naming the offenders is the point, since the fix is to delete them.
        expect((p.onsets ?? []).filter((x) => [...x].length < 2)).toEqual([]);
        expect((p.codas ?? []).filter((x) => [...x].length < 2)).toEqual([]);
    });

    test.each(BLOCKS)("%s lists no duplicate onset or coda", (_name, p) => {
        for (const list of [p.onsets ?? [], p.codas ?? []])
            expect(list.length, `duplicates: ${list.filter((x, i) => list.indexOf(x) !== i).join(", ")}`)
                .toBe(new Set(list).size);
    });
});
