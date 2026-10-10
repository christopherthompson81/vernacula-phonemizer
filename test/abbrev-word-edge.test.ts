/**
 * THE DOTTED-ABBREVIATION RULES START AT A UNICODE WORD EDGE, NOT AN ASCII `\b` (#1480's shape, carried to
 * es, de, en, id, ceb and hil).
 *
 * JS `\b` is defined on ASCII `\w` even under the `u` flag, so after an accented letter it sees a boundary
 * and an abbreviation key matched the END of a longer word: `Taínos.` read *Taínumbers*, `gelöst.`
 * *gelöSankt*, `taoísta.` *taoísanta* — one FLEURS text each in en, de and es.
 *
 * Each row is a pair: the abbreviation on its own (the rule must still fire — the input changes) and the
 * same letters glued to the end of a word after a non-ASCII letter (the rule must not fire — the input is
 * returned as it was). Every word in this file is synthetic.
 */
import { describe, expect, test } from "vitest";

import { normalizeCebuano } from "../src/languages/cebuano/normalize.ts";
import { normalizeEnglish } from "../src/languages/english/normalize.ts";
import { normalizeGerman } from "../src/languages/german/normalize.ts";
import { normalizeHiligaynon } from "../src/languages/hiligaynon/normalize.ts";
import { normalizeIndonesian } from "../src/languages/indonesian/normalize.ts";
import { normalizeSpanish } from "../src/languages/spanish/normalize.ts";

type Row = [fires: string, declines: string];

const CASES: [string, (s: string) => string, Row[]][] = [
    ["es", (s) => normalizeSpanish(s), [
        ["Es la sta. María.", "Es un taoísta. María."],          // table, continuing
        ["Vino la sta.", "Era un taoísta."],                      // table, phrase-final
        ["En 300 a. C. hubo", "En 300 Ña. C. hubo"],            // era
        ["En 300 d. C. hubo", "En 300 Ñd. C. hubo"],
        ["Los EE. UU. ganan", "Los ÑEE. UU. ganan"],
        ["los ee. uu. ganan", "los ñee. uu. ganan"],
        ["a las 10 p. m. hoy", "a las 10 Ñp. m. hoy"],           // a.m./p.m.
        ["el n.º 5 gana", "el Ñn.º 5 gana"],                     // número
    ]],
    ["de", (s) => normalizeGerman(s), [
        ["Er kam St. Peter", "Es ist gelöst. Peter"],             // table, continuing
        ["Er wohnt in St.", "Es ist gelöst."],                    // table, phrase-final
        ["im Jahr 50 v. Chr. kam", "im Jahr 50 Öv. Chr. kam"],
        ["im Jahr 50 n. Chr. kam", "im Jahr 50 Ön. Chr. kam"],
        ["Obst, z. B. Äpfel", "Obst, Öz. B. Äpfel"],
        ["also d. h. nein", "also Öd. h. nein"],
        ["Leute, u. a. wir", "Leute, Öu. a. wir"],
        ["Obst u. Ä. hier", "Obst Öu. Ä. hier"],
    ]],
    ["en", (s) => normalizeEnglish(s), [
        ["They met Mr. smith", "They met Ømr. smith"],            // st/dr/mt/mr/mrs + lowercase word
        ["on Main St.", "on Main Øst."],                          // st/dr/mt, phrase-final
        ["see Rev. 3 here", "see Žrev. 3 here"],
        ["the Nos. Then", "the Taínos. Then"],                    // PLAIN_ABBREV, continuing
        ["counted the nos.", "They met the Taínos."],             // PLAIN_ABBREV, phrase-final
        ["up to max. 5 more", "up to Ømax. 5 more"],
        ["up to max 5 more", "up to Ømax 5 more"],                // bare max, start edge
        ["up to max 5 more", "up to maxé 5 more"],                // bare max, END edge
        ["they saw st louis", "they saw Øst louis"],               // bare saint
        ["Smith et al. said", "Smith Øet al. said"],
        ["built ca. 1900 here", "built Ýca. 1900 here"],
        ["see No. 5 here", "see Taíno. 5 here"],
        ["fruit, e.g. apples", "fruit, Øe.g. apples"],
        ["fruit, i.e. apples", "fruit, Øi.e. apples"],
        ["at 10 a.m. today", "at 10 Øa.m. today"],
        ["the U.S. army", "the ØU.S. army"],                      // dotted initialism
    ]],
    ["id", (s) => normalizeIndonesian(s), [
        ["harga Rp 500 saja", "harga ÉRp 500 saja"],
        ["kosmonot No. 11 itu", "kosmonot Éno. 11 itu"],
        ["ke Jl. Merdeka", "ke Éjl. Merdeka"],                    // table, continuing
        ["di jalan dll.", "di jalan Édll."],                      // table, phrase-final
    ]],
    ["ceb", (s) => normalizeCebuano(s), [
        ["si Dr. Santos", "si Édr. Santos"],
    ]],
    ["hil", (s) => normalizeHiligaynon(s), [
        ["si Dr. Santos", "si Édr. Santos"],
    ]],
];

test("en: the `iu` fold now reaches `ſt.`, and the miss branch returns it unchanged", () => {
    // The st./dr. rules gained `u` (for \p{L}); under `iu` the alternation folds `s`↔`ſ` (#1122), so the
    // callbacks need a miss branch — the old `!` would have called `undefined`.
    expect(normalizeEnglish("the ſt. louis")).toBe("the ſt. louis");
});

describe.each(CASES)("%s: an abbreviation glued after a non-ASCII letter is not an abbreviation", (_lang, norm, rows) => {
    test.each(rows)("fires on %j, declines %j", (fires, declines) => {
        expect(norm(fires)).not.toBe(fires);
        expect(norm(declines)).toBe(declines);
    });
});
