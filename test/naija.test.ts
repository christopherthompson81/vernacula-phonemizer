import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/naija/naija.ts";

// Adjudicated canonical-IPA gold for Nigerian Pidgin / Naija (pcm) — the first English-lexified creole. Media
// (English-etymological, BBC-Pidgin) orthography → a LEXICON of high-frequency irregular/open-mid words + a
// Naija-phonology RULE g2p for the rest (7 vowels, TH-stopping, no schwa, ɡ͡b/k͡p, ɲ/ŋ, ɾ, degemination). NO
// independent referee exists (no wikipron/epitran/kaikki pcm) — this gold, drawn from Faraclas (1996) + the NLA
// orthography manual, IS the committed anchor. Segmental only (Naija tone is unmarked in the media orthography).
describe("naija (Nigerian Pidgin) canonical IPA", () => {
    test("lexicon: irregular / open-mid high-frequency words", () => {
        const cases: [string, string][] = [
            ["na", "na"], // copula
            ["dey", "dɛ"], // continuous marker — irregular ⟨ey⟩→ɛ
            ["di", "di"], // 'the'
            ["dem", "dɛm"], // 'they/them', TH written ⟨d⟩
            ["e", "i"], // 3sg subject — ⟨e⟩ pronounced /i/
            ["wetin", "wɛtin"], // 'what'
            ["go", "ɡo"], // future marker — close-mid /o/
            ["don", "dɔn"], // perfect — open /ɔ/
            ["make", "mek"], // 'let/should' — silent ⟨e⟩
            ["say", "se"], // complementizer
            ["comot", "kɔmɔt"], // 'leave' — open /ɔ/
            ["chop", "t͡ʃɔp"], // 'eat' — ⟨ch⟩→t͡ʃ
            ["abeg", "abɛɡ"], // 'please'
            ["oyibo", "ɔjibo"], // 'white person'
            ["for", "fɔ"], // preposition — /fɔ/, r dropped
            ["sef", "sɛf"], // emphatic
            ["come", "kɔm"], // silent ⟨e⟩ → /kɔm/
            ["one", "wan"], // English-etymological → /wan/
            ["you", "ju"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("rule g2p: nativised (phonemically-spelled) words", () => {
        const cases: [string, string][] = [
            ["pikin", "pikin"], // 'child'
            ["wahala", "wahala"], // 'trouble'
            ["waka", "waka"], // 'walk'
            ["oga", "oɡa"], // 'boss'
            ["mumu", "mumu"], // 'fool'
            ["japa", "d͡ʒapa"], // 'flee' — ⟨j⟩→d͡ʒ
            ["katakata", "katakata"], // 'chaos'
            ["danfo", "danfo"], // minibus
            ["okada", "okada"], // motorbike taxi
            ["gbege", "ɡ͡bɛɡɛ"], // 'trouble' — labial-velar ɡ͡b
            ["jollof", "d͡ʒolof"], // degemination ll→l
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("English-spelling nativisation: known-English words → Naija phonetics (via the English dict)", () => {
        // BBC-Pidgin text is mostly ENGLISH-spelled; a known-English word (English CMUdict dict-hit) is nativised
        // to the 7-vowel system, TH-stopped, NON-rhotic. Routed through phonemize → the English knownWord lookup;
        // OOV substrate loans (danfo, egusi) fall through to the rule g2p instead.
        const cases: [string, string][] = [
            ["once", "wɔns"], // STRUT → ɔ
            ["when", "wɛn"], // DRESS → ɛ
            ["while", "wail"], // PRICE → ai
            ["because", "bikɔz"], // THOUGHT → ɔ
            ["sister", "sista"], // non-rhotic coda (r dropped) + lettER → a
            ["first", "fɔst"], // NURSE → ɔ
            ["abbreviate", "abɾivijet"], // palatal glide ʲ → j
            ["though", "do"], // ð → d (TH-stopping)
            ["people", "pipal"], // schwa → a (lossy — the documented GenAm-source ceiling)
        ];
        for (const [w, exp] of cases) expect(phonemize(w, "pcm")).toBe(exp);
        // An OOV substrate loan is NOT routed through English — the rule g2p reads it phonemically:
        expect(phonemize("danfo", "pcm")).toBe("danfo");
        expect(phonemize("egusi", "pcm")).toBe("eɡusi");
    });

    test("numbers (nativised English, compositional)", () => {
        expect(phonemize("1", "pcm")).toBe("wan");
        expect(phonemize("15", "pcm")).toBe("fiftin");
        expect(phonemize("21", "pcm")).toBe("twɛnti wan");
        expect(phonemize("100", "pcm")).toBe("wan hɔndɛd");
    });

    // The compositor stopped at tauzin, so 10⁶+ leaked the raw digit string into the IPA. Naija is English-lexified
    // and the numbers block stores IPA DIRECTLY, so the scales are added the same way: pcm.wikipedia.org writes
    // million ⟨miliọn⟩ ("pas 75 miliọn", article "Naijá langwej"), and ⟨ọ⟩ = /ɔ/ in NLA orthography → /miliɔn/;
    // /biliɔn/ is extrapolated from the same pattern (see naija.jsonc).
    test("numbers: the miliɔn / biliɔn scales", () => {
        expect(phonemize("12345", "pcm")).toBe("twɛlv tauzin tɾi hɔndɛd an foti faiv"); // thousands
        expect(phonemize("100000", "pcm")).toBe("wan hɔndɛd tauzin");
        expect(phonemize("1000000", "pcm")).toBe("wan miliɔn"); // was a DIGIT-LEAK
        expect(phonemize("2000000", "pcm")).toBe("tu miliɔn");
        expect(phonemize("1000000000", "pcm")).toBe("wan biliɔn"); // was a DIGIT-LEAK
    });

    test("running text (BBC-Pidgin sentences)", () => {
        const s = phonemize("Wetin dey happen? Di pikin don chop.", "pcm");
        expect(s).toContain("wɛtin dɛ");
        expect(s).toContain("di pikin dɔn t͡ʃɔp");
        expect(phonemize("Abeg make you no vex.", "pcm")).toContain(
            "abɛɡ mek ju no vɛks",
        );
    });

    test("accented Latin stays ONE word and is NATIVISED, not routed and not deleted", () => {
        // `[A-Za-z]+` ended the token at a diacritic, so the letter carrying it became an unclaimed gap read as
        // an English LETTER NAME: `São Paulo` → *ɛs ˈə o pɔlo* ("ES ə O"), `Cañitas` → *kɔ ˈɛn itas*.
        // ⚠ NO FOREIGN ROUTING HERE, unlike id and om. This engine NATIVISES — its header says the
        // rule g2p is applied to English-spelled tokens because "nativising is more correct for the creole", and
        // its own output proves it: `water` → wata, `computer` → kampjuta, not English's wˈɔːt̬ɚ / kəmpjˈuːt̬ɚ.
        expect(phonemize("water", "pcm")).toBe("wata");
        expect(phonemize("computer", "pcm")).toBe("kampjuta");
        // ⚠ AND WIDENING THE TOKEN ALONE MADE ONE CASE WORSE: pcm has no rule for `ö`, so the letter VANISHED and
        // `Klöcker` came out *klkkeɾ*, an unpronounceable cluster. Nativising needs a letter to read; dropping it
        // is not nativising, it is deleting. So an accent folds to its BASE first.
        const pairs: [string, string][] = [["São Paulo", "Sao Paulo"], ["Cañitas", "Canitas"], ["Klöcker", "Klocker"]];
        for (const [acc, ascii] of pairs)
            expect(phonemize(acc, "pcm"), acc).toBe(phonemize(ascii, "pcm"));
        expect(phonemize("Klöcker", "pcm")).toBe("klokkeɾ");
        // Native Naija is untouched.
        expect(phonemize("di pikin dem", "pcm")).toBe("di pikin dɛm");
    });

    /**
     * NORMALIZATION. pcm was flagged PCT-DROP and CUR-DROP by tools/normalization/audit.ts: the sign
     * contributed nothing, so `50%` was byte-identical to `50` and `$5` to `5` — a silent loss no
     * downstream gate could see. Separately the number class was a bare `\d+`, so the thousands COMMA and
     * the decimal DOT were claimed by the clause branch and the number was destroyed outright.
     * Every word is attested in the mined pcm corpus; the counts are in the SYMBOLS block.
     */
    test("the symbol tier reads %, currency and & instead of dropping them", () => {
        expect(phonemize("50%", "pcm")).toBe("fifti pasɛnt");
        expect(phonemize("$5", "pcm")).toBe("faiv dola");
        // ⚠ the corpus word is ⟨dolla⟩ ×2, not English ⟨dollar⟩ ×1 — the minority form is the English one.
        expect(phonemize("₦2,000", "pcm")).toBe("tu tauzin nɛɾa");
        expect(phonemize("fish & chips", "pcm")).toBe("fiʃ an t͡ʃips");
        // the sign must not be a no-op — the exact shape of the defect the audit names
        for (const [sign, bare] of [["50%", "50"], ["$5", "5"], ["₦5", "5"]] as const)
            expect(phonemize(sign, "pcm"), sign).not.toBe(phonemize(bare, "pcm"));
    });

    test("thousands separators and decimals survive the tokenizer", () => {
        // `(\d+)` alone read ₦2,000 as *tu , ziɾo* ("two [pause] zero") and 3.5 as *tɾi . faiv*.
        expect(phonemize("3.5 kilo", "pcm")).toBe("tɾi pɔint faiv kilo");
        expect(phonemize("I get 1,000 naira", "pcm")).toBe("a ɡɛt wan tauzin nɛɾa");
        // a decimal tail is read DIGIT BY DIGIT, so 1.50 is not "fifty"
        expect(phonemize("1.50", "pcm")).toBe("wan pɔint faiv ziɾo");
        expect(phonemize("87.14%", "pcm")).toBe("eti sɛvin pɔint wan fo pasɛnt");
    });

    test("a magnitude hops the currency word, capitalised or not", () => {
        // ⚠ THE CAPITALISED FORM IS THE REGRESSION: the tier's magnitude alternation is case-SENSITIVE and
        // this corpus capitalises 8 of 38, so `₦200 Million` stranded the magnitude after the currency
        // noun — *tu hɔndɛd nɛɾa miljan*, "two hundred naira million" — while the lowercase was fine.
        expect(phonemize("₦200 million", "pcm")).toBe("tu hɔndɛd miljan nɛɾa");
        expect(phonemize("₦200 Million", "pcm")).toBe("tu hɔndɛd miljan nɛɾa");
        // ⚠ `US$` needs its own key (the tier's match is letter-bounded on the left) but NOT its own word:
        // this engine nativises ⟨US⟩ as the pronoun *us* → [ɔs], which shipped `US$2` as *tu ɔs dola*.
        expect(phonemize("US$2 million", "pcm")).toBe("tu miljan dola");
        expect(phonemize("US$750,000", "pcm")).toBe("sɛvin hɔndɛd an fifti tauzin dola");
    });

    /**
     * ORDINALS. `1st` reached the g2p as the WORD ⟨st⟩ and read *stɾit* ("street") — `1st place` was
     * *wan stɾit ples*. The productive rule is `nɔmba` + the CARDINAL (APiCS survey 17), with suppletive
     * forms for 1–3; that rule is what made 4th+ expressible at all, since an English-style ordinal table
     * would have been unsourced above ⟨third⟩.
     */
    test("ordinals read as ordinals, and above three use nɔmba + the cardinal", () => {
        expect(phonemize("1st place", "pcm")).toBe("fɛst ples");
        expect(phonemize("2nd", "pcm")).toBe("sɛkond");
        expect(phonemize("3rd", "pcm")).toBe("tɛd");
        expect(phonemize("4th", "pcm")).toBe("nɔmba fo");
        expect(phonemize("12th", "pcm")).toBe("nɔmba twɛlv");
        expect(phonemize("21st", "pcm")).toBe("nɔmba twɛnti wan");
        expect(phonemize("103rd", "pcm")).toBe("nɔmba wan hɔndɛd an tɾi");
        // the suffix must never survive as a word
        expect(phonemize("1st", "pcm")).not.toContain("stɾit");
    });

    test("units and the Dr. abbreviation", () => {
        // ⟨kilomita⟩/⟨mita⟩ come from pcm.wikipedia ("85 kilomita fom di main kampos", "di 100 mita race") —
        // the mined corpus has 29 unit-bearing numbers and zero spelled-out unit words. kg/cm are NOT
        // declared: zero attestations, and guessing is costly here (English ⟨kilometer⟩ nativises to
        // *kalamata*).
        expect(phonemize("10km", "pcm")).toBe("ten kilomita");
        expect(phonemize("di 100 m race", "pcm")).toBe("di wan hɔndɛd mita ɾes");
        // ⟨Dr⟩ nativised as a word → *dɾaiv* ("drive"). Dot optional (the corpus writes both), and the dot
        // must be CONSUMED or it reads as a clause pause.
        expect(phonemize("Dr. Ada", "pcm")).toBe("dakta eda");
        expect(phonemize("Dr Zeh", "pcm")).toBe("dakta zɛ");
        // ⚠ the guard: a word merely STARTING with dr- is untouched
        expect(phonemize("Drama awod", "pcm")).toBe("dɾama awod");
        expect(phonemize("Dreamstar FC", "pcm")).toContain("dɾeamstaɾ");
    });

    /**
     * INITIALISMS ARE LETTER-SPELLINGS UNLESS LEXIFIED. `FC` scanned as a word gave the unpronounceable
     * *fk*; `A.I.` split on the dots so ⟨I⟩ hit the pcm PRONOUN lexicon and read *a*. The lexified test is
     * the English dict, which already carries both the word-pronounced ones (FIFA, NEPA) and the ones
     * conventionally spelled out (APC, BBC, TV) — so only a dict MISS is spelled here.
     */
    test("initialisms spell out, lexified acronyms do not", () => {
        expect(phonemize("A.I. dey", "pcm")).toBe("e ai dɛ");
        expect(phonemize("U.S. team", "pcm")).toBe("ju ɛs tim");
        expect(phonemize("FC Barcelona", "pcm")).toBe("ɛf si basilona");
        expect(phonemize("PSV", "pcm")).toBe("pi ɛs vi");
        expect(phonemize("YBNL", "pcm")).toBe("wai bi ɛn ɛl");
        // lexified → read as a word, not spelled
        expect(phonemize("FIFA", "pcm")).toBe("fifa");
        expect(phonemize("BBC", "pcm")).toBe("bibisi");
        // ⚠ ⟨a⟩ is why letterNames is declared: the English dict's single-letter entry is the ARTICLE [ə],
        // not the letter name [e], so the dict alone would mis-spell any initialism containing an A.
        expect(phonemize("A.B.", "pcm")).toBe("e bi");
    });

    test("times follow the English pattern with pcm number words", () => {
        // ⚠ PROVISIONAL — no pcm source for clock-reading was found; recorded as such in naija.ts.
        expect(phonemize("5:30", "pcm")).toBe("faiv tɔti");
        expect(phonemize("11:40", "pcm")).toBe("ilɛvin foti");
        expect(phonemize("5:00", "pcm")).toBe("faiv"); // bare hour
        expect(phonemize("2:20", "pcm")).toBe("tu twɛnti");
        // a minute under ten keeps its zero rather than borrowing English's unsourced "oh"
        expect(phonemize("00:05", "pcm")).toBe("ziɾo ziɾo faiv");
        // the colon must not survive as a clause pause
        expect(phonemize("5:30", "pcm")).not.toContain(",");
    });
});
