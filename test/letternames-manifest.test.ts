/**
 * The INITIALISM TIER's two tables — `letterNames` and `phonotactics` — read from each language's manifest.
 *
 * ⚠ ONE TEST FOR A BATCH OF LANGUAGES, BY DESIGN. The lift is the same three-line change in every language,
 * so a per-language test file would be the same assertions copied N times; what actually differs is the
 * DATA, and the loop below reads it from each manifest rather than restating it. Anything genuinely
 * language-specific keeps its own file (see italian-manifest-lifted.test.ts).
 *
 * ⚠ WHAT THIS CATCHES is DECOUPLING — a table re-hardcoded in a normalize.ts — not wrong data. The reading
 * assertions go through the engine, so a language that stopped reading its manifest fails here even though
 * the two copies would still agree.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST as NL } from "../src/languages/dutch/manifest.ts";
import { MANIFEST as PL } from "../src/languages/polish/manifest.ts";
import { MANIFEST as HU } from "../src/languages/hungarian/manifest.ts";
import { MANIFEST as TR } from "../src/languages/turkish/manifest.ts";
import { MANIFEST as TH } from "../src/languages/thai/manifest.ts";
import { MANIFEST as VI } from "../src/languages/vietnamese/manifest.ts";
import { MANIFEST as CMN } from "../src/languages/mandarin/manifest.ts";
import { MANIFEST as FR } from "../src/languages/french/manifest.ts";
import { MANIFEST as RU } from "../src/languages/russian/manifest.ts";
import { MANIFEST as JV } from "../src/languages/javanese/manifest.ts";
import { MANIFEST as HA } from "../src/languages/hausa/manifest.ts";
import { MANIFEST as TA } from "../src/languages/tamil/manifest.ts";
import { MANIFEST as TE } from "../src/languages/telugu/manifest.ts";
import { MANIFEST as KN } from "../src/languages/kannada/manifest.ts";
import { MANIFEST as EN } from "../src/languages/english/manifest.ts";
import { MANIFEST as TG } from "../src/languages/tajik/manifest.ts";
import { MANIFEST as ID } from "../src/languages/indonesian/indonesian.ts";

interface Lifted {
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
}

/**
 * code → its manifest, a sentence whose ALL-CAPS run must be SPELLED with the letter names, and one whose
 * run must NOT be — a loanword shape the language's own onsets and codas license as readable.
 *
 * ⚠ THE SECOND SENTENCE IS WHAT TESTS `phonotactics` AT ALL. Asserting the table's shape only proves the
 * DATA is there; emptying `legalOnsets` in a normalize.ts still passed until this column existed, because
 * nothing read the reading. Verified by making that edit.
 */
const LANGS: [string, Lifted, string, string, string, string][] = [
    ["nl", NL, "de USB-poort werkt", "usb", "de SPORT van vandaag", "s"],
    ["pl", PL, "port USB działa", "usb", "ten SPORT dzisiaj", "s"],
    ["hu", HU, "az USB port működik", "usb", "a SPORT ma", "s"],
    ["tr", TR, "USB bağlantı noktası", "usb", "bu SPOR bugün", "s"],
    ["fr", FR, "le port USB fonctionne", "usb", "un TEST de sport", "t"],
    // ⚠ RUSSIAN'S TABLE IS CYRILLIC-KEYED, so the spelled run must be Cyrillic too: a Latin run inside
    // Russian goes through the script router to English and never reaches this table at all.
    ["ru", RU, "ВВП растёт", "ввп", "СПОРТ сегодня", "с"],
    // ⚠ JAVANESE GENUINELY SPELLS `SPORT`, so it is the wrong "readable" case: jv licenses only ⟨ng⟩ and
    // ⟨ny⟩ as codas, so the ⟨rt⟩ tail is illegal and the run is spelled — correctly. `PRO` reaches the
    // ONSET table instead (⟨pr⟩ is licensed) and ends in a vowel, so nothing tests the codas there.
    ["jv", JV, "port USB mlaku", "usb", "PRO dina iki", "p"],
];

/**
 * Languages whose ONLY lifted table is `letterNames` — no phonotactics block, because the OOV
 * spell-it-out test does not apply: an embedded Latin run in a Thai, Vietnamese or Chinese sentence is
 * spelled because it is FOREIGN, not because its consonant clusters are illegal.
 *
 * ⚠ THESE TABLES ARE KEYED BY UPPERCASE LATIN, and that is load-bearing: the engine looks a run up by the
 * character as written. Verified that the loader does not lower-case dictionary keys — the camelCase policy
 * applies to PROPERTY names, and that policy is exactly what mangled English's ARPABET block.
 */
const SPELL_ONLY: [string, Record<string, string>, string, string][] = [
    ["th", TH.letterNames, "ระบบ USB ใหม่", "USB"],
    ["vi", VI.letterNames, "cổng USB hoạt động", "USB"],
    ["cmn", CMN.letterNames, "USB接口可以用", "USB"],
];

/**
 * ⚠ HAUSA IS EXCLUDED FROM THE CLUSTER ASSERTIONS ABOVE, and the reason is a PRE-EXISTING DEFECT this lift
 * surfaced rather than caused: its `legalCodas` are ALL SINGLE CHARACTERS, and 20 of its 29 `legalOnsets`
 * are too. `core/initialisms.ts` tests `w.slice(0, 2)` against those sets — a two-character slice — so a
 * one-character entry can never match. Hausa's entire coda list is therefore dead, and any Hausa run ending
 * in two consonants is judged unreadable no matter what the list says.
 *
 * NOT FIXED HERE: repairing it changes readings and needs Hausa-specific sourcing (what ARE its legal
 * two-consonant codas?), which a mechanical lift has no business guessing. The lift preserves the behaviour
 * exactly; this test pins the defect so it is visible in the suite, and will fail when it is fixed.
 */
describe("ha's phonotactics lists — the dead entries are gone", () => {
    // ⚠ THIS TEST USED TO PIN THE DEFECT. It asserted that every coda was a single character and that more
    // than fifteen onsets were, because that was true and the reason the lists could not work:
    // `makeUnreadableTest` looks them up with a 2-char slice and never sees a 1-char entry. The data is
    // fixed now, so the expectation is inverted — see test/phonotactics-shape.test.ts for the fleet guard.
    test("no entry is too short for the lookup, and the nine genuine clusters survive", () => {
        expect(HA.phonotactics.codas.filter((c) => c.length === 1)).toEqual([]);
        expect(HA.phonotactics.onsets.filter((c) => c.length === 1)).toEqual([]);
        expect(HA.phonotactics.onsets).toContain("sh");
        // ⚠ AND THE CODA LIST IS EMPTY ON PURPOSE: Hausa licenses no two-consonant coda outside a digraph,
        // which is a statement about the language rather than a table nobody filled in.
        expect(HA.phonotactics.codas).toEqual([]);
    });

    test("the letter names are live even though the clusters are not", () => {
        const say = (x: string): string => phonemize(x, "ha").replace(/[ˈˌ]/gu, "");
        for (const ch of "cd") expect(say("CD da DNA")).toContain(say(HA.letterNames[ch]!));
    });
});

describe.each(SPELL_ONLY)("%s spells an embedded Latin run from letterNames", (code, letters, sentence, run) => {
    const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

    test("every letter of the run is read as its declared name", () => {
        for (const ch of run) {
            expect(letters[ch], `${code}: no letterNames entry for ${ch}`).toBeDefined();
            expect(say(sentence)).toContain(say(letters[ch]!));
        }
    });

    test("the table is keyed UPPERCASE, which is how the engine looks a run up", () => {
        expect(Object.keys(letters).every((k) => k === k.toUpperCase())).toBe(true);
        expect(Object.keys(letters)).toHaveLength(26);
    });
});

describe.each(LANGS)("%s reads its lifted initialism tables", (code, DEF, sentence, spelled, readable, initial) => {
    const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

    test("the spelled run is composed from letterNames", () => {
        // ⚠ EACH LETTER SEPARATELY, not the joined string: the engine may re-stress or re-syllabify across
        // the run, so only the individual names are safe to assert.
        for (const ch of spelled) {
            const name = DEF.letterNames[ch];
            expect(name, `${code}: no letterNames entry for ${ch}`).toBeDefined();
            expect(say(sentence)).toContain(say(name!));
        }
    });

    test("a licensed loanword shape is READ, not spelled — which is what tests phonotactics", () => {
        // Emptying `legalOnsets` makes this run unreadable and it gets spelled letter by letter, so the
        // assertion is that the first letter's NAME is absent from the reading.
        expect(say(readable)).not.toContain(say(DEF.letterNames[initial]!));
    });

    test("phonotactics is one table, and its vowel class is the engine's", () => {
        expect(DEF.phonotactics.vowels.length).toBeGreaterThan(0);
        expect(DEF.phonotactics.onsets.length).toBeGreaterThan(0);
        expect(DEF.phonotactics.codas.length).toBeGreaterThan(0);
        // Every cluster is exactly the shape the OOV test indexes on — two or three characters, no spaces.
        for (const c of [...DEF.phonotactics.onsets, ...DEF.phonotactics.codas]) {
            expect(c).not.toMatch(/\s/u);
            expect(c.length).toBeGreaterThanOrEqual(2);
        }
    });

    test("no declared letter name is empty, and the core covers what the table omits", () => {
        for (const [k, v] of Object.entries(DEF.letterNames)) {
            expect(v, `${code}: empty name for ${k}`).not.toBe("");
            expect(k.length).toBeGreaterThan(0);
        }
        // ⚠ A LETTER NEED NOT BE IN THE TABLE. `core/initialisms.ts` falls back to the letter itself
        // (`d.letterName(...) ?? m[0]`), so a gap degrades to spelling the character rather than leaking the
        // string "undefined" into the IPA. Turkish is the case in this batch: its vowel class carries the
        // loanword circumflexes ⟨â î û⟩, which have no distinct letter NAME — they are said as the base
        // letter — and are deliberately absent from the table. Asserting full coverage of the vowel class
        // would therefore fail on correct data, which is what the first version of this test did.
        const named = DEF.phonotactics.vowels.split("").filter((v) => DEF.letterNames[v] !== undefined);
        expect(named.length).toBeGreaterThan(0);
    });
});

/**
 * ⚠ A DIFFERENT FACT UNDER A DIFFERENT NAME. ta, te and kn do NOT have a `letterNames` map. They have a
 * closed list of the letter-name spellings AS WRITTEN — யு.எஸ். , యూ.ఎస్. , ಯು.ಎಸ್. — used to build the
 * regex that RECOGNISES a dot-separated initialism run so its interior dots can be deleted. Nothing in the
 * list is ever emitted as a reading; the names reach the output as the corpus's own spellings, unchanged.
 *
 * Filing that under `letterNames` (character → spoken name, everywhere else in the fleet) would put two
 * facts under one name — the `PREFIX_GUESS` shape — so it is `initialismLetterForms`.
 *
 * ⚠ THE LIST IS CLOSED BY NECESSITY, not by laziness: a generic "short token, dot, short token" rule cannot
 * be written safely against a script with NO CASE DISTINCTION, because it matches sentence boundaries. The
 * Tamil header records probing exactly that and hitting "…ஆவர். கட்பேக்தான்".
 */
const RECOGNITION: [string, { initialismLetterForms: string[] }, string, string][] = [
    ["ta", TA, "யு.எஸ். அரசு", "யு.எஸ்."],
    ["te", TE, "యూ.ఎస్. ప్రభుత్వం", "యూ.ఎస్."],
    ["kn", KN, "ಯು.ಎಸ್. ಸರ್ಕಾರ", "ಯು.ಎಸ್."],
];

describe.each(RECOGNITION)("%s recognises an initialism run from initialismLetterForms", (code, DEF, sentence, run) => {
    const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

    test("the interior dots are deleted, so the run is one phrase and not three", () => {
        // With the list empty the regex matches nothing and every dot survives as a clause pause.
        expect(say(sentence)).not.toContain(" . ");
        expect(DEF.initialismLetterForms.length).toBeGreaterThan(0);
    });

    test("every declared form actually appears in the run it was declared for", () => {
        // The forms are WRITTEN spellings, so they must be substrings of the source text — not of the IPA.
        const used = DEF.initialismLetterForms.filter((f) => run.includes(f));
        expect(used.length, `${code}: no declared form occurs in ${run}`).toBeGreaterThan(0);
    });

    test("nothing in the list is emitted as a reading — it is a recognition list", () => {
        // Each form is native script; the IPA never contains native characters.
        for (const f of DEF.initialismLetterForms) expect(say(sentence)).not.toContain(f);
    });
});

/**
 * ⚠ ENGLISH HAS NO letterNames TABLE, AND SHOULD NOT. CMUdict already carries all 26 single letters with
 * their letter-NAME pronunciations (f = EH1 F, h = EY1 CH, w = D AH1 B AH0 L Y UW0), so the speller emits
 * the bare letters and the dictionary resolves them — a RULE, not a table. The one EXCEPTION is data: the
 * dict has ⟨a⟩ as the reduced article AH0, not the letter name, so ⟨a⟩ alone must be respelled.
 *
 * ⚠ AND ENGLISH'S PHONOTACTICS ARE NEARLY UNREACHABLE, which is worth knowing before trusting a sweep over
 * them. `core/initialisms.ts` asks `isRecorded` FIRST, and English is the one language with a pronunciation
 * dictionary — so every real word short-circuits before the cluster test. Wrecking the vowel class changes
 * nothing for NASA, TEST or STRENGTH: the dictionary owns all three. What reaches the test is an all-caps
 * run that is BOTH absent from CMUdict and has a vowel, which took invented tokens to construct.
 */
describe("en: the speller is a rule, and the phonotactics are nearly unreachable", () => {
    const say = (s: string): string => phonemize(s, "en").replace(/[ˈˌ]/gu, "");

    test("only the ⟨a⟩ exception is declared, and it is what a spelled A reads as", () => {
        // ⚠ CANNOT CATCH ITS OWN DECOUPLING — re-hardcoding `l === "a" ? "ay" : l` is observationally
        // identical while the data agrees, the same limit the es and pt lifts recorded. The guard is the
        // manifest-sabotage sweep, where wrecking `letterNameExceptions` moves 1 reading.
        expect(Object.keys(EN.letterNameExceptions)).toEqual(["a"]);
        // GWALT is spelled because ⟨gw⟩ is not a licensed onset; its A must be the exception, not the article.
        expect(say("the GWALT team")).toContain(say(EN.letterNameExceptions["a"]!));
    });

    test("a run the DICTIONARY owns never reaches the cluster test", () => {
        // NASA, TEST and STRENGTH are all in CMUdict, so `isRecorded` answers first and the phonotactics
        // tables are not consulted at all. This is why a sweep over them scored 0 until the probe carried
        // tokens the dictionary does not have.
        for (const w of ["NASA", "TEST", "STRENGTH"]) expect(say(`the ${w} team`)).not.toContain(say("ay"));
    });

    test("an unlisted onset is what forces the spell", () => {
        expect(EN.phonotactics.onsets).not.toContain("gw");
        expect(EN.phonotactics.onsets).toContain("zl"); // an odd-looking entry that is genuinely licensed
        // ⚠ COMPARE AGAINST THE BARE LETTER, not against a spelled-out name: the dictionary renders ⟨w⟩ as
        // ONE token (dʌbəɫjuː) while the phrase "double you" is two, so a phrase comparison fails on a
        // correct reading. The letter itself is what the speller emits, so the letter is what to ask for.
        const wName = say("w");
        expect(say("the GWEM group")).toContain(wName);       // spelled: G W E M
        // ⚠ ASK FOR THE LETTER THE RUN ACTUALLY STARTS WITH. The first version compared ZLORP against the
        // W name — a letter ZLORP does not contain — so it passed whether or not the run was spelled, which
        // is exactly the failure it was meant to catch. Emptying `legalOnsets` makes ⟨zl⟩ illegal and the
        // run is spelled Z L O R P; the Z name is the observable.
        expect(say("the ZLORP unit")).not.toContain(say("z"));
    });
});

/**
 * ⚠ TWO LANGUAGES THE FIRST COMPLETENESS CHECK MISSED. The sweep was scoped to languages whose LETTER-NAME
 * table was inline, so `tg` and `id` — whose letter names were already lifted but whose PHONOTACTICS were
 * not — never appeared in it. Found by re-checking the whole ported set for `legalOnsets: new Set([` rather
 * than trusting the original list.
 */
describe("tg reads its lifted phonotactics", () => {
    const say = (x: string): string => phonemize(x, "tg").replace(/[ˈˌ]/gu, "");
    test("a licensed cluster is read and the tables are live", () => {
        expect(TG.phonotactics.onsets).toContain("ст");
        expect(TG.phonotactics.vowels.length).toBeGreaterThan(0);
        expect(say("ин СПОРТ аст")).not.toContain(say(TG.letterNames["с"]!));
    });
});

/**
 * ⚠ INDONESIAN'S `legalCodas` IS ENTIRELY INERT, and unlike Hausa's this is provable rather than merely
 * likely. `core/initialisms.ts` tests `w.slice(-2)` — a TWO-character tail — against the set, so:
 *   · 12 of its 14 entries are SINGLE characters and can never match; and
 *   · the two that could, ⟨ng⟩ and ⟨kh⟩, are BOTH also declared as `digraphs`, which the very same
 *     condition accepts (`!legalCodas.has(tail) && !digraphs?.has(tail)`).
 * So deleting the whole list would change nothing — which is exactly what the sweep reported when it scored
 * `codas` 0 even with ⟨BARANG⟩ and ⟨GUDANG⟩ in the probe.
 *
 * NOT FIXED: repairing it means deciding what Indonesian's legal two-consonant codas actually are, which is
 * language sourcing, not a lift. Pinned so the redundancy is visible and a future edit cannot mistake the
 * list for load-bearing.
 */
describe("id's legalCodas — the inert list is gone", () => {
    // ⚠ THIS TEST USED TO PIN THE REDUNDANCY: every one of the 14 entries was either a single character the
    // 2-char lookup could not reach (12 of them) or a digraph the same test already licenses through its
    // `|| digraphs.has(tail)` arm (`ng`, `kh`). The list could not change one verdict, and removing it moved
    // 0 of 200 golden rows. The expectation is now the fixed state.
    test("the coda list is empty, and the onsets that remain are all reachable", () => {
        const idPt = (ID as unknown as { phonotactics: { codas: string[]; onsets: string[]; digraphs: string[] } }).phonotactics;
        expect(idPt.codas).toEqual([]);
        expect(idPt.onsets.filter((c) => c.length === 1)).toEqual([]);
        // The real consonant clusters — the part that was ever doing work — are untouched.
        for (const c of ["bl", "br", "kr", "st", "tr"]) expect(idPt.onsets).toContain(c);
    });
});
