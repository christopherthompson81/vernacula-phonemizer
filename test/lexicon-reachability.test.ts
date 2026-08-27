/**
 * EVERY LEXICON KEY MUST SURVIVE ITS OWN ENGINE'S FOLD (#1068).
 *
 * `makeNativiser` folds a word to the engine's declared inventory BEFORE the lexicon is consulted, so a
 * headword spelled with a letter the fold rewrites can never be matched from `text()`. It does not throw and
 * it does not drop a phone — the word silently takes the OOV path and gets a plausible wrong reading.
 *
 * ⚠ THE PARITY GATE CANNOT SEE ANY OF THIS. Both engines fold identically, so every miss below is a defect
 * both sides reproduce byte-for-byte — the "a bug both engines agree on passes forever" class. It is equally
 * invisible to the goldens: Swedish's 15 keys have 0 FLEURS instances. The only instrument is this test.
 *
 * Two witnesses, and they are DIFFERENT DEFECTS wearing the same clothes:
 *
 *   sv   key `münchen` (NST accent 1) · input `München` → nat → `munchen` → MISS → OOV rule says accent 2.
 *        The key and the input agreed; the fold broke the agreement.
 *   sl   key `abstraktən` · no Slovene input will EVER contain ə — those keys are kaikki phonetic
 *        respellings that leaked into the orthographic key column. The key never agreed with anything.
 *
 * The measurement that produced the ledger is `docs/investigations/nativiser_lexicon_seam_investigation.md`.
 *
 * ⚠ TS-ONLY, DELIBERATELY. This asserts a property of the DATA against a fold, and both engines read the same
 * TSVs — so a C# mirror would re-measure the same numbers unless the two nativisers had diverged, which is
 * what the parity gate is for. The asymmetry closes on its own once the keys are folded AT LOAD: the fold
 * then changes what the lexicon CONTAINS, so a C# loader that skipped it would move real readings and the
 * gate would catch it on the first row touching a folded key.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { nat as akan } from "../src/languages/akan/akan.ts";
import { nat as balochi } from "../src/languages/balochi/balochi.ts";
import { nat as catalan } from "../src/languages/catalan/catalan.ts";
import { nat as czech } from "../src/languages/czech/czech.ts";
import { nat as danish } from "../src/languages/danish/danish.ts";
import { nat as german } from "../src/languages/german/german.ts";
import { nat as hausa } from "../src/languages/hausa/hausa.ts";
import { nat as ilocano } from "../src/languages/ilocano/ilocano.ts";
import { nat as irish } from "../src/languages/irish/irish.ts";
import { nat as javanese } from "../src/languages/javanese/javanese.ts";
import { nat as minnan } from "../src/languages/minnan/minnan.ts";
import { nat as norwegian } from "../src/languages/norwegian/norwegian.ts";
import { nat as romanian } from "../src/languages/romanian/romanian.ts";
import { nat as serbian } from "../src/languages/serbian/serbian.ts";
import { nat as slovenian } from "../src/languages/slovenian/slovenian.ts";
import { nat as swedish } from "../src/languages/swedish/swedish.ts";
import { nat as tagalog } from "../src/languages/tagalog/tagalog.ts";
import { nat as turkish } from "../src/languages/turkish/turkish.ts";
import { nat as welsh } from "../src/languages/welsh/welsh.ts";
import { nat as zhuang } from "../src/languages/zhuang/zhuang.ts";
import { nat as zulu } from "../src/languages/zulu/zulu.ts";

/** Engine directory → its own nativiser. Every entry is the engine's REAL `nat`, imported, not a copy. */
const NATIVISERS: Readonly<Record<string, (s: string) => string>> = {
    akan, balochi, catalan, czech, danish, german, hausa, ilocano, irish, javanese, minnan,
    norwegian, romanian, serbian, slovenian, swedish, tagalog, turkish, welsh, zhuang, zulu,
};

/**
 * ⚠ THE KNOWN-UNREACHABLE LEDGER, AND IT MAY ONLY SHRINK. Each entry is `<lang>/<file>` → the count measured
 * when #1068 was written up. These are not accepted as correct — they are the open defect, pinned so that
 * fixing them is visible and adding a new one is impossible. A second test below asserts the ledger holds no
 * stale entry, so a fix must delete its line rather than leave a passing overcount behind.
 */
const LEDGER: Readonly<Record<string, number>> = {
    "slovenian/stress.tsv": 1252,
    "swedish/accent-stress.tsv": 15,
    "norwegian/nb-lexicon.tsv": 14,
    "danish/da-lexicon.tsv": 4,
    "balochi/balochi-lexicon.tsv": 4,
};

/** Every `<lang>/<file>.tsv` under an engine that nativises, discovered rather than listed. */
function lexicons(): Array<{ lang: string; file: string; keys: string[] }> {
    const out: Array<{ lang: string; file: string; keys: string[] }> = [];
    for (const lang of Object.keys(NATIVISERS)) {
        const dir = `data/languages/${lang}`;
        if (!existsSync(dir)) continue;
        for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsv"))) {
            const keys = readFileSync(`${dir}/${file}`, "utf8").split(/\r?\n/)
                .filter((l) => l !== "" && !l.startsWith("#"))
                .map((l) => l.slice(0, l.indexOf("\t")))
                .filter((k) => k !== "");
            out.push({ lang, file, keys: [...new Set(keys)] });
        }
    }
    return out;
}

const LEXICONS = lexicons();
const unreachable = (lang: string, keys: string[]): string[] =>
    keys.filter((k) => NATIVISERS[lang]!(k) !== k);

describe("lexicon keys must survive their own engine's nativiser (#1068)", () => {
    // ⚠ THE DISCOVERY MUST NOT GO VACUOUS. If `NATIVISERS` silently stopped resolving, or every engine's data
    // directory moved, the per-lexicon assertions below would all pass over an empty list. Pin the shape.
    test("the sweep actually finds the lexicons it is guarding", () => {
        expect(LEXICONS.length).toBeGreaterThanOrEqual(30);
        expect(LEXICONS.reduce((a, l) => a + l.keys.length, 0)).toBeGreaterThan(400_000);
        // …and every engine that nativises AND ships a TSV must be registered above. A new one that forgets
        // is the exact way this guard would rot, so the filesystem — not the table — decides the set.
        const shipping = readdirSync("src/languages").filter((lang) => {
            const dir = `src/languages/${lang}`;
            const src = readdirSync(dir).filter((f) => f.endsWith(".ts"))
                .map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("");
            return src.includes("makeNativiser")
                && existsSync(`data/languages/${lang}`)
                && readdirSync(`data/languages/${lang}`).some((f) => f.endsWith(".tsv"));
        });
        expect(shipping.filter((l) => !(l in NATIVISERS))).toEqual([]);
    });

    for (const { lang, file, keys } of LEXICONS) {
        const id = `${lang}/${file}`;
        const budget = LEDGER[id] ?? 0;
        test(`${id} — ${budget === 0 ? "every key is reachable" : `at most ${budget} unreachable keys (ledger)`}`, () => {
            const bad = unreachable(lang, keys);
            // The message carries examples, because the count alone does not say WHICH letter is the problem.
            expect(bad.length, `unreachable in ${id}: ${bad.slice(0, 8).map((k) => `${k}→${NATIVISERS[lang]!(k)}`).join("  ")}`)
                .toBeLessThanOrEqual(budget);
        });
    }

    // ⚠ SHRINK-ONLY, the shape `test/large-numeral-fidelity.test.ts` uses for its lossy ledger. Without this,
    // a fix that removed 1,200 of Slovene's 1,252 would still "pass" against a 1,252 budget and the ledger
    // would quietly become fiction. An entry must be RE-MEASURED down or deleted.
    test("the ledger holds no stale entry — a fix deletes its line, it does not leave an overcount", () => {
        const stale: string[] = [];
        for (const [id, budget] of Object.entries(LEDGER)) {
            const lex = LEXICONS.find((l) => `${l.lang}/${l.file}` === id);
            if (!lex) { stale.push(`${id} — no such lexicon (renamed or removed?)`); continue; }
            const actual = unreachable(lex.lang, lex.keys).length;
            if (actual < budget) stale.push(`${id} — ledger says ${budget}, actual ${actual}: lower or delete it`);
        }
        expect(stale).toEqual([]);
    });
});
