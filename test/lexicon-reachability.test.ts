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

import { phonemize } from "../src/index.ts";

import { nat as akan } from "../src/languages/akan/akan.ts";
import { nat as balochi, lexicon as balochiLex } from "../src/languages/balochi/balochi.ts";
import { nat as catalan } from "../src/languages/catalan/catalan.ts";
import { nat as czech } from "../src/languages/czech/czech.ts";
import { nat as danish, lexicon as danishLex } from "../src/languages/danish/danish.ts";
import { nat as german } from "../src/languages/german/german.ts";
import { nat as hausa } from "../src/languages/hausa/hausa.ts";
import { nat as ilocano } from "../src/languages/ilocano/ilocano.ts";
import { nat as irish } from "../src/languages/irish/irish.ts";
import { nat as javanese } from "../src/languages/javanese/javanese.ts";
import { nat as minnan } from "../src/languages/minnan/minnan.ts";
import { nat as norwegian, lexicon as norwegianLex } from "../src/languages/norwegian/norwegian.ts";
import { nat as romanian } from "../src/languages/romanian/romanian.ts";
import { nat as serbian } from "../src/languages/serbian/serbian.ts";
import { nat as slovenian, stressDict as slovenianLex } from "../src/languages/slovenian/slovenian.ts";
import { nat as swedish, lexicon as swedishLex } from "../src/languages/swedish/swedish.ts";
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
 * ⚠ THE LOADED MAPS — the only place the #1068 aliases exist. `loadTsvMap`'s `fold` option writes each key's
 * NATIVISED spelling in as an alias for the same value, so the TSV on disk is unchanged and the reachability
 * question can only be answered against what was loaded. Only the five engines whose keys the fold rewrites
 * need one; for the other 25 every key is its own nativised form, so resolution is true by construction.
 */
const LOADED: Readonly<Record<string, () => Map<string, unknown>>> = {
    "slovenian/stress.tsv": () => slovenianLex() as Map<string, unknown>,
    "swedish/accent-stress.tsv": () => swedishLex() as Map<string, unknown>,
    "norwegian/nb-lexicon.tsv": () => norwegianLex() as Map<string, unknown>,
    "danish/da-lexicon.tsv": () => danishLex() as Map<string, unknown>,
    "balochi/balochi-lexicon.tsv": () => balochiLex().ar as Map<string, unknown>,
};

/**
 * ⚠ THE SHADOWED LEDGER, AND IT MAY ONLY SHRINK. A key whose nativised spelling was ALREADY TAKEN by another
 * row cannot be aliased — the fold rule is "an unfolded key already in the file wins, always", which is what
 * guarantees no reading reachable today can change. So these rows resolve, but to the OTHER row's value.
 *
 * This is the measured, accepted residual of the fix, not a defect the fix missed. 102 of the 106 are Slovene
 * pairs where the ə-spelling and the e-spelling disagree about which nucleus is stressed (`bləste`=0 against
 * `bleste`=1) — a lexicon-PROVENANCE defect that precedence routes around rather than settles, and a separate
 * question from the one #1068 asks. The remaining 4 are Norwegian (3) and Danish (1).
 *
 * ⚠ 102, NOT THE 99 THE INVESTIGATION FIRST REPORTED, and finding the gap is what this test was for. The
 * hand-rolled sweep only counted a fold landing on a key the FILE already writes. Three Slovene pairs have
 * BOTH spellings folded — `bləsteł` and `blesteł` both reduce to `blestel`, likewise `səsał`/`sesał` and
 * `səzuł`/`sezuł` — so the collision is between two aliases and the sweep never saw it. A guard that
 * re-derives the rule finds what a guard that re-states a number cannot.
 */
const SHADOWED: Readonly<Record<string, number>> = {
    "slovenian/stress.tsv": 102,
    "norwegian/nb-lexicon.tsv": 3,
    "danish/da-lexicon.tsv": 1,
};

/** Every `<lang>/<file>.tsv` under an engine that nativises, discovered rather than listed. */
function lexicons(): Array<{ lang: string; file: string; keys: string[]; raw: Map<string, string> }> {
    const out: Array<{ lang: string; file: string; keys: string[]; raw: Map<string, string> }> = [];
    for (const lang of Object.keys(NATIVISERS)) {
        const dir = `data/languages/${lang}`;
        if (!existsSync(dir)) continue;
        for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsv"))) {
            // ⚠ THE RAW VALUE STRING IS KEPT, not the parsed one. Shadowing is a property of the DATA, and
            // several of these lexicons parse into OBJECTS — comparing those with !== measures reference
            // identity, which scored every harmless duplicate as a clash (sv read 3 where the answer is 0).
            const raw = new Map<string, string>();
            for (const l of readFileSync(`${dir}/${file}`, "utf8").split(/\r?\n/)) {
                if (l === "" || l.startsWith("#")) continue;
                const tab = l.indexOf("\t");
                if (tab <= 0) continue;
                if (!raw.has(l.slice(0, tab))) raw.set(l.slice(0, tab), l.slice(tab + 1));
            }
            out.push({ lang, file, keys: [...raw.keys()], raw });
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

    /**
     * Per row: does its own value survive to the shipped lookup, or does another row's shadow it?
     *
     * `lost` is checked against the REAL loaded map, because that is where `loadTsvMap`'s aliases live and
     * the question is whether the ENGINE can reach the row. `shadowed` re-simulates the alias rule over the
     * RAW value strings, because the question there is about the data and several engines parse to objects.
     * ⚠ The simulation must iterate the file's rows IN ORDER, for the reason `loadTsvMap` states: two keys
     * can fold onto the same free slot, and "first wins" only means anything if the order is the file's.
     */
    function classify(lang: string, file: string, keys: string[], raw: Map<string, string>) {
        const id = `${lang}/${file}`;
        const folded = keys.filter((k) => NATIVISERS[lang]!(k) !== k);
        if (!folded.length) return { folded, lost: [] as string[], shadowed: 0 };
        const load = LOADED[id];
        // ⚠ THIS IS THE FOLLOW-UP PATH, not an internal error. The other 25 lexicons carry no `fold` at their
        // `loadTsvMap` call sites, and correctly so — nothing in them is unreachable today, and aliasing on
        // spec would be an unmeasured change. If one of them GAINS a key its engine cannot spell, it lands
        // here: wire `fold: (k) => nat(k)` into that lexicon's `loadTsvMap` call and add it to LOADED above.
        expect(load, `${id} rewrites ${folded.length} keys under its own fold (e.g. ${folded.slice(0, 3).map((k) => `${k}→${NATIVISERS[lang]!(k)}`).join(", ")}) but its loadTsvMap call has no \`fold\` — see #1068`).toBeTruthy();
        const map = load!();

        const resolved = new Map(raw); // unfolded keys, exactly as the file writes them
        for (const [k, v] of raw) {
            const f = NATIVISERS[lang]!(k);
            if (f !== k && !resolved.has(f)) resolved.set(f, v);
        }

        const lost: string[] = [];
        let shadowed = 0;
        for (const k of folded) {
            const f = NATIVISERS[lang]!(k);
            if (!map.has(f)) lost.push(`${k}→${f}`);
            else if (resolved.get(f) !== raw.get(k)) shadowed++;
        }
        return { folded, lost, shadowed };
    }

    for (const { lang, file, keys, raw } of LEXICONS) {
        const id = `${lang}/${file}`;
        test(`${id} — every row resolves through the nativiser`, () => {
            const { lost } = classify(lang, file, keys, raw);
            // ⚠ ZERO, EVERYWHERE, NO LEDGER. Before the fold-at-load fix this stood at 1,289 across five
            // lexicons; `loadTsvMap`'s `fold` closes it by construction, so any non-zero here is a new
            // defect — either a lexicon that gained a key its engine cannot spell, or a `fold` that was
            // dropped from a call site.
            expect(lost.slice(0, 8), `rows lost in ${id}`).toEqual([]);
            expect(lost.length).toBe(0);
        });
    }

    // ⚠ SHRINK-ONLY, the shape `test/large-numeral-fidelity.test.ts` uses. Without it a fix that removed 90
    // of Slovene's 99 would still pass against a 99 budget and the ledger would quietly become fiction.
    test("the shadowed ledger is exact — a row rescued must be re-measured down, not left as an overcount", () => {
        const wrong: string[] = [];
        for (const { lang, file, keys, raw } of LEXICONS) {
            const id = `${lang}/${file}`;
            const actual = classify(lang, file, keys, raw).shadowed;
            const budget = SHADOWED[id] ?? 0;
            if (actual !== budget) wrong.push(`${id} — ledger says ${budget}, actual ${actual}`);
        }
        expect(wrong).toEqual([]);
    });

    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // The fix made concrete, on the witness #1068 was filed with. Counting rows proves the aliases EXIST;
    // these prove they are what `text()` actually reaches.
    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    test("sv `München` reads the lexicon's accent, not the OOV rule's", () => {
        // `münchen` is in accent-stress.tsv with NST accent 1. `text()` folded ü→u, looked up `munchen`,
        // missed, and the OOV shape rule assigned accent 2 — the combining grave in *mˈɵ̀nkhɛn*.
        expect(phonemize("München", "sv")).toBe("mˈɵnkhɛn");
        expect(phonemize("münchen", "sv")).toBe("mˈɵnkhɛn");
        expect(phonemize("munchen", "sv")).toBe("mˈɵnkhɛn"); // the alias, which is what carries it
    });

    test("sl reaches a stress entry the lexicon only spells phonetically", () => {
        // `abstraktən` is the only spelling stress.tsv has; no Slovene input will ever contain ə. 684 keys
        // of this shape alias onto a word the file does not otherwise contain, so the fold ADDS entries.
        expect(slovenianLex().has("abstrakten")).toBe(true);
        expect(phonemize("abstrakten", "sl")).toBe("apstrˈaktɛn");
    });

    // ⚠ THE SECOND, DISJOINT DEFECT #1068 CONFLATED WITH THE FOLD. The issue described five of Swedish's
    // keys as "split", as though widening the word arm were a cheap partial of the fold fix. Measured, the
    // sets do not overlap at all: `nat("o'brien")` returns it UNCHANGED — an apostrophe is not a letter the
    // nativiser maps — so these were never a reachability problem, they were a TOKENIZER one.
    test("sv reads an apostrophe-bearing headword as ONE word", () => {
        expect(phonemize("o'brien", "sv")).toBe("ɔbrˈiːɛn"); //     was `uː brˈìːɛn` — two words, "oo" + "breen"
        expect(phonemize("rock'n'roll", "sv")).toBe("rɔkːnrˈɔlː"); // was `rɔkː n rɔlː`
        expect(phonemize("mcdonald's", "sv")).toBe("mkdɔnˈalds"); //  was `mkdɔnˈald s`
        // …and the corpus's own instances, which are foreign names and possessives.
        expect(phonemize("Xi'an", "sv")).toBe("ksˈìːan");
    });

    test("⚠ …AND A CLOSING QUOTE IS NOT PART OF THE WORD, which is why the guard is a lookahead", () => {
        // `hostWordRun`'s `medialOnly` only bars the apostrophe from LEADING a run, so `'ordet'` tokenized as
        // `ordet'` — missing its lexicon entry and changing the word's accent to *ˈùːɖɛt'*. Requiring a
        // LETTER after the apostrophe is what separates a possessive from a quote. Both must stay as they
        // were before the change.
        expect(phonemize("'ordet'", "sv")).toBe("ˈuːɖɛt");
        expect(phonemize("Han sa 'nej'", "sv")).toBe("hɑːn sɑː neːj");
    });

    // ⚠ THE INVARIANT IS ABOUT LEXICON-RESOLVED READINGS, NOT ABOUT GOLDENS. #1072 claimed the second and
    // was wrong: a FREE slot is free because the word was an OOV MISS, and an OOV miss is not silence — it
    // is the fallback rule, whose answer the goldens record. Slovene's 680 added headwords moved 8 of
    // `sl.tsv`'s 200 rows, and no gate caught it because sl was unported, so nothing ran its golden.
    test("⚠ AN UNFOLDED KEY ALREADY IN THE FILE STILL WINS — no reading resolved THROUGH THE LEXICON moves", () => {
        // An alias goes only into a FREE slot. `bleste` is written in stress.tsv with nucleus 1; `bləste`
        // folds onto it with nucleus 0 and must NOT displace it.
        expect(slovenianLex().get("bleste")).toBe(1);
        expect(phonemize("hus", "sv")).toBe("hʉːs"); // an ordinary native headword, untouched
    });
});
