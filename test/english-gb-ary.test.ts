/**
 * THE `-ary / -ery / -ory` WEAK VOWEL (#1380) — a RULE, not a word list, because the suffix is productive.
 *
 * GenAm carries a secondary-stressed full vowel there and SSBE does not. Putting a productive family in
 * `en-gb-lexical.tsv` would be the `aluminium` mistake in the other direction, so this is asserted as a
 * rule: an unseen `-ary` word must take it too.
 */
import { describe, expect, it, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWord as say } from "../src/languages/english-gb/english-gb.ts";

const GB = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english-gb");

describe("the -ary/-ery/-ory weak vowel", () => {
    it("reduces the suffix vowel and drops the secondary stress", () => {
        // ⚠ THE MARK IS DROPPED AND NOTHING HERE CAN VERIFY THAT. The referee carries no stress marks at
        // all and the eval's fold strips them, so this is taken on the phonology — a reduced vowel does
        // not carry a secondary stress — and pinned so the decision is at least visible.
        expect(say("secretary")).toBe("sˈɛkɹətʰəɹi");   // referee sɛkɹətəɹi
        expect(say("military")).toBe("mˈɪlətʰəɹi");     // referee mɪlɪtəɹi
        expect(say("dictionary")).toBe("dˈɪkʃənəɹi");   // referee dɪkʃənəɹi
        expect(say("cemetery")).toBe("sˈɛmətʰəɹi");     // referee sɛmətɹi (syncope; see the residue below)
    });

    // ⚠ `-ory` COMES TOO, and its GenAm vowel is THOUGHT rather than DRESS. Measured separately because
    // it is the bigger half of the change: -ary/-ery is +45/−4 against the referee and -ory is +24/−6.
    it("reduces the THOUGHT vowel of -ory as well", () => {
        expect(say("category")).toBe("kʰˈætəɡəɹi");     // referee kætɪɡəɹi
        expect(say("accusatory")).toMatch(/əɹi$/u);
    });

    // ⚠ THE TRIGGER IS THE SPELLING **AND** A NON-PRIMARY SUFFIX VOWEL, and the first version of this got
    // it wrong: `/ˌ?(ɛ|ɔː)ɹi$/` reads as "an optional secondary" but the PRIMARY mark also sits before the
    // vowel, so it matched `ˈɛɹi` with the group empty and deleted the tonic nucleus.
    it("leaves the suffix alone when it carries the primary stress", () => {
        expect(say("canary")).toBe("kənˈɛɹi");
        expect(say("actuary")).toBe("ˌækt͡ʃuːˈɛɹi");
    });

    it("is a rule, so it reaches a word the dictionary does not carry", () => {
        // not in g2p-dict.tsv — the whole argument for a rule over a table
        expect(say("zorbulary")).toMatch(/əɹi$/u);
        expect(say("frimbery")).toMatch(/əɹi$/u);
    });

    // ⚠ ~65 OF 774 RESIST IT AND ARE LEFT WRONG ON PURPOSE: 40 attest only the syncope and 25 keep a full
    // vowel. Each is one segment out; an exception table would be another generated artifact to keep
    // fresh, which is what #1381, #1385 and #1388 were about. Pinned so the residue is known, not
    // discovered later as a regression.
    it("has a documented residue rather than an exception table", () => {
        expect(say("necessary")).toBe("nˈɛsəsəɹi");      // referee nɛsəsɛɹi / nɛsəsɹi
        expect(say("monastery")).toBe("mˈɒnəstəɹi");     // referee mɒnəstɹi — syncope-only word
    });

    // ⚠ `amatory` IS A SECOND-ORDER CASUALTY AND BELONGS TO #1391, NOT TO THIS RULE. Reducing its suffix
    // made it claimable into BATH, and the row it was claimed on is the referee's `ɑmətəɹi` — a
    // LENGTH-LESS `ɑ` in a non-rhotic corpus, i.e. an American transcription. RP is ˈæmətəɹi. The rule
    // did not cause it; it exposed it, by making the rest of the word match.
    // ⚠ PINNED AS-IS SO THE REGRESSION IS VISIBLE rather than discovered later: when #1391 tightens
    // BATH's claim test this assertion should go back to `ˈæmətʰəɹi`, and this test failing is the
    // signal that it worked.
    it("records amatory's BATH mis-claim, which is #1391 and not this rule", () => {
        expect(say("amatory")).toBe("ˈɑːmətʰəɹi");
    });
});

/**
 * ⚠ THE BUILDER AND THE RUNTIME APPLY THIS RULE ON OPPOSITE SIDES OF THE SETS, AND THAT IS ONLY SAFE
 * WHILE THIS IS EMPTY. `build-en-gb-sets.ts` probes set edits on top of `phonemizeWordRules`, i.e.
 * AFTER the suffix rule; `toRP` applies the sets BEFORE it. For a `marry` word spelled `-ary` the
 * runtime's `ɛ(ˈ|ˌ)?ɹ → æ$1ɹ` would consume the suffix `ɛɹ` first and block the reduction, shipping
 * `…ˌæɹi`, while the builder scored `…əɹi`.
 *
 * ⚠ REORDERING IS THE WRONG REMEDY AND WAS MEASURED BEFORE BEING REFUSED: `cloth` has EIGHT members
 * spelled this way (`corollary`, `coronary`, `offertory`, `oratory`, `glossary`, `orrery`, `flory`,
 * `lory`) and its `ɔː → ɒ` is first-occurrence, so moving the suffix rule ahead of the set block would
 * change those real words to remove a divergence that affects none. `marry` has zero.
 *
 * So the divergence is left in place and GUARDED instead. If a `marry` member spelled `-ary/-ery/-ory`
 * is ever added, this fails and the ordering has to be settled then, on a word that exists.
 */
test("no marry-set word is spelled -ary/-ery/-ory, which is what makes the rule order safe", () => {
    const marry = readFileSync(join(GB, "en-gb-marry.tsv"), "utf8").split("\n")
        .filter((l) => l.includes("\t") && !l.startsWith("#")).map((l) => l.split("\t")[0]!);
    expect(marry.filter((w) => /(ar|er|or)(y|ies)$/u.test(w))).toEqual([]);
});
