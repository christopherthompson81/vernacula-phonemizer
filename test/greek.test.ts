import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/greek/greek.ts";
import { normalizeGreek } from "../src/languages/greek/normalize.ts";
import { numberToWords } from "../src/languages/greek/numbers.ts";

// Canonical-IPA goldens for Modern Greek (el). The g2p itself is a context-sensitive scan (greek.ts);
// these pin the #562 TEXT-NORMALIZATION layer (normalize.ts), which rewrites everything that is not
// already a pronounceable word before the tokenizer sees it. Every expectation below is a form the
// el_gr FLEURS corpus actually writes.

describe("greek g2p (regression guard for the normalization layer)", () => {
    test("the context rules still hold", () => {
        expect(phonemizeWord("κοιλιά")).toBe("ciʎa"); // synizesis before a stressed vowel
        expect(phonemizeWord("άντρας")).toBe("andɾas"); // medial ντ → prenasalised
        expect(phonemizeWord("μπλε")).toBe("ble"); // word-initial μπ → b
        expect(phonemizeWord("γίδα")).toBe("ʝiða"); // velar palatalisation before a front vowel
    });
});

describe("greek normalization — embedded Latin (291/1969 utterances, the largest defect)", () => {
    test("all-caps initialisms take Greek letter names, not English phonemes", () => {
        // Before: "to ˈɛfbˈiːʲˈaᶦ ce to d͡ʒˈiː pʰˈiː ˈɛs" — ENGLISH phonemes in a Greek stream.
        expect(normalizeGreek("το FBI και το GPS")).toBe("το εφ μπι άι και το τζι πι ες");
        expect(phonemize("το FBI και το GPS", "el")).toBe("to ef bi ai ce to d͡zi pi es");
        // Spaced, not joined: μπ is [b] word-initially but [mb] medially, so «εφμπι» would give the B of
        // FBI as [mb].
        expect(phonemize("FBI", "el")).toBe("ef bi ai");
    });

    test("established acronyms take their word reading", () => {
        expect(normalizeGreek("η UNESCO και το ISIS")).toBe("η Ουνέσκο και το Ίσις");
        expect(phonemize("η UNESCO", "el")).toBe("i unesko");
    });

    test("a hyphen is not a boundary; an apostrophe is", () => {
        expect(normalizeGreek("COVID-19")).toBe("Κόβιντ-19");
        expect(normalizeGreek("XDR-TB")).toBe("εξ ντι αρ-τι μπι");
        expect(normalizeGreek("Super-G")).toBe("Super-τζι");
        expect(normalizeGreek("People's")).toBe("People's"); // the `s` is not a letter mention
    });

    test("mixed-case names are deliberately left to the foreign fallback", () => {
        expect(normalizeGreek("το Haldarsvík παρέχει")).toBe("το Haldarsvík παρέχει");
        expect(normalizeGreek("Apple")).toBe("Apple");
        expect(normalizeGreek("το H στο pH")).toBe("το έιτς στο πι έιτς"); // …except pH
    });

    test("single letters are spelled, but not when a digit is attached", () => {
        expect(normalizeGreek("το c και το g")).toBe("το σι και το τζι");
        expect(normalizeGreek("A(H5N1) χωρίς")).toBe("έι(H5N1) χωρίς"); // H5N1 is not an initialism
        expect(normalizeGreek("η χρήση 4x4")).toBe("η χρήση 4x4"); // nor is 4x4
    });

    test("Latin↔Greek homoglyphs are folded, not read as English letters", () => {
        // A corpus defect: a Greek word with a lookalike Latin letter typed into it. Before, the English
        // fallback split each of these into a Greek fragment plus an English letter name.
        expect(normalizeGreek("από τη Bουλή")).toBe("από τη Βουλή");
        expect(normalizeGreek("λογοκρiσίας")).toBe("λογοκρισίας");
        expect(normalizeGreek("ποιος τo έγραψε")).toBe("ποιος το έγραψε");
        expect(normalizeGreek("και o αγριόκουρκος")).toBe("και ο αγριόκουρκος"); // the bare article
        // Sentence-initial H/O are the same defect one case up — the Greek articles Η/Ο. Distinguished
        // from a genuine letter mention, which is always mid-sentence behind its own Greek article.
        expect(normalizeGreek("H Μεγάλη Πυραμίδα")).toBe("Η Μεγάλη Πυραμίδα");
        expect(normalizeGreek("O Κάρολος ήταν")).toBe("Ο Κάρολος ήταν");
        expect(normalizeGreek("να μετατρέψει το «O» ώστε")).toBe("να μετατρέψει το «όου» ώστε");
        expect(phonemize("από τη Bουλή και", "el")).toBe("apo ti vuli ce");
    });
});

describe("greek normalization — numbers written in Greek convention", () => {
    test("thousands group with a PERIOD, which was becoming a phrase break", () => {
        expect(normalizeGreek("1.000 άτομα")).toBe("1000 άτομα");
        expect(normalizeGreek("5.000.000 άτομα")).toBe("5000000 άτομα");
        expect(phonemize("1.000 άτομα", "el")).toBe("çiʎa atoma"); // was "ena . miðen atoma"
    });

    test("the decimal mark is the COMMA and reads as κόμμα", () => {
        expect(normalizeGreek("το 2,3 τοις")).toBe("το 2 κόμμα 3 τοις");
        expect(phonemize("το 2,3 τοις", "el")).toBe("to ðio koma tɾia tis");
    });

    test("numberToWords reaches past 10⁶ (5.000.000 fell off the old ceiling)", () => {
        expect(numberToWords(5_000_000)).toBe("πέντε εκατομμύρια");
        expect(numberToWords(1_500_000)).toBe("ένα εκατομμύριο πεντακόσιες χιλιάδες");
        expect(numberToWords(999)).toBe("εννιακόσια ενενήντα εννέα"); // unchanged below the ceiling
    });
});

describe("greek normalization — ordinals, which carry the CASE in their ending", () => {
    test("both members of a compound ordinal inflect", () => {
        expect(normalizeGreek("τον 15ο αιώνα")).toBe("τον δέκατο πέμπτο αιώνα");
        expect(normalizeGreek("του 18ου αιώνα")).toBe("του δέκατου όγδοου αιώνα");
        expect(normalizeGreek("την 21η Μαρτίου")).toBe("την εικοστή πρώτη Μαρτίου");
        expect(normalizeGreek("της 9ης Αυγούστου")).toBe("της ένατης Αυγούστου");
        expect(normalizeGreek("το 60ο")).toBe("το εξηκοστό"); // oxytone stem ⇒ accented ending
    });

    test("the one digit+Greek non-ordinal in the corpus is not claimed", () => {
        expect(normalizeGreek("της 53χρονης")).toBe("της 53χρονης");
    });

    test("Greek ALPHABETIC numerals read as ordinals, not as letters", () => {
        // Written with U+0384 in the corpus rather than the canonical keraia; both are accepted.
        expect(normalizeGreek("τον Β΄ Παγκόσμιο Πόλεμο")).toBe("τον δεύτερο Παγκόσμιο Πόλεμο");
        expect(normalizeGreek("Λουδοβίκο ΙΣΤ΄,")).toBe("Λουδοβίκο δέκατο έκτο,"); // ΣΤ is the sign for 6
        expect(phonemize("τον Β΄ Παγκόσμιο", "el")).toBe("ton ðefteɾo paŋɡozmio"); // was "…v paŋɡozmio"
    });
});

describe("greek normalization — clock, guarded against sports times", () => {
    test("hours are FEMININE and a whole hour drops its minutes", () => {
        expect(normalizeGreek("στις 11:00 τοπική")).toBe("στις έντεκα τοπική");
        expect(normalizeGreek("στις 07:19 π.μ.")).toBe("στις εφτά και δεκαεννιά προ μεσημβρίας.");
        expect(normalizeGreek("στις 3:00")).toBe("στις τρεις"); // not «τρία» — ώρα is feminine
    });

    test("a sports time is NOT a clock time", () => {
        // 4:41.30 is 4 minutes 41.30 seconds. The same trap claimed a Russian and an Indonesian time.
        expect(normalizeGreek("χρόνο 4:41.30, 2:11.60")).toBe("χρόνο 4:41.30, 2:11.60");
        expect(normalizeGreek("πρώτη και 1:09.02 λεπτά")).toBe("πρώτη και 1:09.02 λεπτά");
    });
});

describe("greek normalization — dotted abbreviations", () => {
    test("π.Χ. and π.χ. differ only in case and mean different things", () => {
        expect(normalizeGreek("τον 3ο αιώνα π.Χ., είναι")).toBe("τον τρίτο αιώνα προ Χριστού, είναι");
        expect(normalizeGreek("π.χ. στην Ολλανδία")).toBe("παραδείγματος χάριν στην Ολλανδία");
        expect(normalizeGreek("το 400 μ.Χ. και")).toBe("το 400 μετά Χριστόν και");
        expect(normalizeGreek("κ.λπ. τα οποία")).toBe("και λοιπά τα οποία");
        expect(normalizeGreek("βλ. παρακάτω")).toBe("βλέπε παρακάτω");
    });

    test("the abbreviation's final dot: consumed mid-sentence, kept sentence-finally, never doubled", () => {
        expect(normalizeGreek("έγινε π.Χ.")).toBe("έγινε προ Χριστού."); // the sentence pause survives
        expect(normalizeGreek("το 1000 π.Χ. Οι")).toBe("το 1000 προ Χριστού. Οι");
        // and not «προ Χριστού.,» — a full stop AND a comma where the text has one mark.
        expect(normalizeGreek("το 1000 π.Χ., οι")).toBe("το 1000 προ Χριστού, οι");
        expect(phonemize("τον 3ο αιώνα π.Χ., είναι", "el")).toBe("ton tɾito eona pɾo xɾistu , ine");
    });
});

describe("greek normalization — symbols, units and rates", () => {
    test("percent and currency", () => {
        expect(normalizeGreek("Το 3-5% των")).toBe("Το 3-5 τοις εκατό των");
        expect(normalizeGreek("χρέωση 30 $ ή 10 $")).toBe("χρέωση 30 δολάρια ή 10 δολάρια");
    });

    test("a rate takes an AGREEING ARTICLE, so it is kept local rather than using unitPer", () => {
        // The corpus writes the long form itself: «149 μίλια την ώρα», «μιλίων την ώρα».
        expect(normalizeGreek("480 km/h (133 m/s, 300 mph)"))
            .toBe("480 χιλιόμετρα την ώρα (133 μέτρα το δευτερόλεπτο, 300 μίλια την ώρα)");
        expect(normalizeGreek("(165 χλμ / ώρα)")).toBe("(165 χιλιόμετρα την ώρα)");
    });

    test("χλμ, exponents and degrees", () => {
        expect(normalizeGreek("70 χλμ. στην")).toBe("70 χιλιόμετρα στην");
        expect(normalizeGreek("220 χλμ (140 μίλια)")).toBe("220 χιλιόμετρα (140 μίλια)");
        // The measure word is an adjective and precedes, as in Russian.
        expect(normalizeGreek("καλύπτει 783.562 km²")).toBe("καλύπτει 783562 τετραγωνικά χιλιόμετρα");
        expect(normalizeGreek("άνω των 30 °C")).toBe("άνω των 30 βαθμοί Κελσίου");
    });

    test("signs and vulgar fractions", () => {
        expect(normalizeGreek("(UTC +1)")).toBe("(γιου τι σι συν 1)");
        expect(normalizeGreek("29¾ επί 24½ ίντσες")).toBe("29 και τρία τέταρτα επί 24 και μισή ίντσες");
    });
});

describe("greek clause marks", () => {
    test("; is the question mark and the ano teleia is a semicolon", () => {
        // U+0387 GREEK ANO TELEIA sits inside the Greek letter range the tokenizer's word group uses, so
        // normalize.ts folds it to U+00B7 MIDDLE DOT — the codepoint the corpus writes and the manifest maps.
        expect(phonemize("ναι· όχι", "el")).toBe("ne , oçi"); // U+0387
        expect(phonemize("ναι· όχι", "el")).toBe("ne , oçi"); // U+00B7
        expect(phonemize("γιατί;", "el")).toBe("ʝati ?"); // γι- synizes: the [i] is absorbed into [ʝ]
    });

    test("#586 the APPOSITION dash is a pause, and the range hyphen is not", () => {
        // Reported for a whole sweep as a `signed-number` DROP, and misclassified: not a minus, not a
        // designation, not ambiguous. Greek brackets an aside between dashes and BOTH were silently dropped,
        // so the aside ran into its host clause with no break.
        const g = phonemize("Ο ναός Πνομ Κρομ –12 χιλιόμετρα νοτιοδυτικά του Σιέμ Ριπ– που βρίσκεται στην κορυφή.", "el");
        expect(g).toContain("kɾom , ðeka ðio");
        expect(g).toContain("ɾip , pu");
        // An opening dash before a LETTER is the same construction (×19 of the 20).
        expect(phonemize("θρησκείες –τον ιουδαϊσμό.", "el")).toContain("θɾiscies , ton");
        // ⚠ NO SPACE EITHER SIDE = a COMPOUND joiner, not an apposition. The corpus's one instance, and a
        // pause here would be wrong.
        expect(phonemize("της αποστολής Apollo–Soyuz δείχνοντας.", "el")).not.toMatch(/apolo ,/u);
        // The corpus separates the two uses BY CHARACTER: all 29 ranges/designations use ASCII `-`.
        expect(phonemize("Το 3-5% των μαθητών.", "el")).not.toContain(",");
        expect(phonemize("γκουρού Νανάκ (1469-1539).", "el")).not.toContain("mion");
        expect(phonemize("τον COVID-19.", "el")).not.toContain("mion");
        expect(phonemize("το Chandrayaan-1 εξώθησε.", "el")).not.toContain("mion");
        expect(phonemize("με 26 - 00 νίκες.", "el")).not.toContain("mion");
        // The minus itself: ROBUSTNESS only — el_gr has zero true negatives, so no gate can see this.
        expect(phonemize("θερμοκρασία -5 βαθμοί.", "el")).toContain("mion pende");
    });
});
