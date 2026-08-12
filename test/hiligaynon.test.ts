import { describe, expect, test } from "vitest";

import { createHiligaynon, phonemizeWord } from "../src/languages/hiligaynon/hiligaynon.ts";

// Canonical-IPA goldens for Hiligaynon / Ilonggo (hil) — Austronesian (Western Bisayan), Latin, near-phonemic.
// A shallow rule g2p (the Cebuano/Tagalog pattern), refereed by wikipron hil_latn + kaikki hil, both human. Shares the Bisayan core with Cebuano; the deltas are the Spanish-loan letters ⟨j⟩→[h] and ⟨f⟩→[p].
// Stress (penultimate default) is phonemic-but-unwritten (folded by the eval); the word-final glottal and the
// Spanish rising diphthongs are deferred residuals.
describe("Hiligaynon canonical IPA — Bisayan rule g2p", () => {
    test("glottal stops: word-initial + hiatus; ⟨ng⟩→ŋ", () => {
        expect(phonemizeWord("anak")).toBe("ʔˈanak"); // word-initial glottal onset
        expect(phonemizeWord("daan")).toBe("dˈaʔan"); // hiatus glottal between the two a's
        expect(phonemizeWord("mango")).toBe("mˈaŋo"); // ⟨ng⟩→ŋ (word-final glottal [maŋoʔ] deferred)
        expect(phonemizeWord("balay")).toBe("bˈalaj"); // ⟨ay⟩ glide → aj
    });

    test("the Spanish-loan deltas from Cebuano: ⟨j⟩→h, ⟨f⟩→p", () => {
        expect(phonemizeWord("Bermejo")).toBe("beɾmˈeho"); // ⟨j⟩ → h (Spanish jota, NOT Cebuano's d͡ʒ)
        expect(phonemizeWord("Demafeliz")).toBe("demapˈelis"); // ⟨f⟩ → p (nativised), ⟨z⟩ → s
    });

    test("native vocabulary (the Cebuano core)", () => {
        expect(phonemizeWord("kalibutan")).toBe("kalibˈutan"); // "world" — plain CV
        expect(phonemizeWord("ginhawa")).toBe("ɡinhˈawa"); // "breath/ease"
    });
});

// Native Hiligaynon cardinal numbers (numbers.ts): tens-first with the "kag" connector and the "ka" ligature before
// a magnitude — the Cebuano/Bisayan shape, and the NATIVE set rather than the co-current Spanish loans (uno, dos,
// baynte), following the tagalog/cebuano precedent. Sources cited in hiligaynon.jsonc + numbers.ts.
describe("Hiligaynon cardinal numbers", () => {
    const hil = createHiligaynon();
    const say = (n: number): string => hil.text(String(n)).trim();

    test("units and the irregular ka-…-an tens", () => {
        expect(say(0)).toBe("sˈeɾo"); // sero (Spanish loan; no native numeral for zero)
        expect(say(5)).toBe("lˈima"); // lima
        expect(say(20)).toBe("kaluhˈaʔan"); // kaluhaan (hiatus glottal)
        expect(say(40)).toBe("kapʔˈatan"); // kap-atan (hyphen → glottal)
    });

    test("compounds 11-99 join tens-first with kag", () => {
        expect(say(11)).toBe("napˈulo kˈaɡ ʔˈisa"); // napulo kag isa
        expect(say(25)).toBe("kaluhˈaʔan kˈaɡ lˈima"); // kaluhaan kag lima
        expect(say(99)).toBe("kasijˈaman kˈaɡ sˈijam"); // kasiyaman kag siyam
    });

    test("hundreds / thousands / millions take the ka ligature", () => {
        expect(say(100)).toBe("ʔˈisa kˈa ɡˈatos"); // isa ka gatos
        expect(say(555)).toBe("lˈima kˈa ɡˈatos kˈaɡ kalˈimʔan kˈaɡ lˈima"); // lima ka gatos kag kalim-an kag lima
        expect(say(1000)).toBe("ʔˈisa kˈa lˈibo"); // isa ka libo
        expect(say(1000000)).toBe("ʔˈisa kˈa mˈiljon"); // isa ka milyon
    });

    test("the native series tops out at milyon → ≥10⁹ reads digit-by-digit", () => {
        expect(say(1000000000).split(" ")).toHaveLength(10); // isa sero sero … (documented fallback)
    });
});

// ── TEXT NORMALIZATION (src/languages/hiligaynon/normalize.ts) ──────────────────────────────────────────
//
// ⚠ THE EVIDENCE BASE IS THE WIKIMEDIA INCUBATOR'S Wp/hil, because there is no hil.wikipedia and no FLEURS
// hil — meta's sitematrix lists Wikipedias for bcl, ceb, ilo, pag, pam, tl and war and no hil site at all.
// 3,799 paragraphs after `filter-by-language.py --lang hil` (whose CONTRAST row is tl + ceb, not English).
// The second source is Kaufmann, *Visayan-English Dictionary* (Iloilo, 1934). Counts and citations live in
// normalize.ts's header and in defects.ts's CITED_WORDS.
//
// ⚠ THESE ASSERT THROUGH `phonemize`, NOT THROUGH `normalizeHiligaynon` DIRECTLY, and deliberately: a
// rewrite is only worth pinning once it has survived the tokenizer and the g2p as well. Asserting on the
// normalizer's own output would have passed for `km` → "kilometro" while the tier's trailing guard still
// rejected the match, and it is the ORDERING between `normalizeHiligaynon`'s steps and the shared symbol
// tier that most of these cases exist to hold still.
describe("Hiligaynon text normalization", () => {
    const hil = createHiligaynon();
    const say = (s: string): string => hil.text(s).trim();

    test("de-grouping and the decimal point — the two rules that carry 3,515 of the instances", () => {
        // ×1,872. The comma was clause punctuation, so the value read *napulo kag apat , apat ka gatos …*
        expect(say("populasyon nga 14,473")).toBe(
            "populˈasjon ŋˈa napˈulo kˈaɡ ʔˈapat kˈa lˈibo kˈaɡ ʔˈapat kˈa ɡˈatos kˈaɡ kapitˈuʔan kˈaɡ tˈatlo");
        // ×1,643. `punto` is Kaufmann's `púnto` "Point, full stop, period"; the fractional part is read
        // digit by digit, which is what a decimal is.
        expect(say("May 302.18 kilometro")).toBe("mˈaj tˈatlo kˈa ɡˈatos kˈaɡ dˈuha pˈunto ʔˈisa wˈalo kilomˈetɾo");
        // Both at once, and in that order — the corpus's own `4,428.81 kilometro kwadrado` shape. The
        // de-grouping guard has to let a group through when its decimal point follows.
        expect(say("1,821.42")).toBe("ʔˈisa kˈa lˈibo kˈaɡ wˈalo kˈa ɡˈatos kˈaɡ kaluhˈaʔan kˈaɡ ʔˈisa pˈunto ʔˈapat dˈuha");
        // ⚠ THE PERIOD-THOUSANDS INSTANCE MUST NOT BE READ AS A DECIMAL. Exactly one exists — a GERMAN
        // town's population, the source's own imported convention — and the two-fractional-digit cap is
        // what refuses it. Pinned so a later widening of that cap cannot pass silently.
        expect(say("17.865 ka pumuluyo")).not.toContain("pˈunto");
    });

    test("ranges read `hasta`, and the operands may be decimals", () => {
        // ×10 unwritten, against ×20 where the corpus writes the word out between the digits itself.
        // ⚠ `hasta` is HILIGAYNON, not Cebuano's `ngadto sa` — which is ×0 here (Kaufmann: `hásta, Until`).
        expect(say("1910-1912")).toBe(
            "ʔˈisa kˈa lˈibo kˈaɡ sˈijam kˈa ɡˈatos kˈaɡ napˈulo hˈasta ʔˈisa kˈa lˈibo kˈaɡ sˈijam kˈa ɡˈatos kˈaɡ napˈulo kˈaɡ dˈuha");
        // ⚠ THE BRANCH THE ORDERING EXISTS FOR (trap 13): the range rule runs ABOVE the decimal rule so its
        // operands are still whole. Reversed, this reads `3 punto 5 hasta 3 punto 8` — i.e. `5 hasta 3`,
        // a backwards span INSIDE a number. The corpus's `3.5–3.8 bilyon ka tinúig` is the real instance.
        expect(say("3.5–3.8 bilyon")).toBe("tˈatlo pˈunto lˈima hˈasta tˈatlo pˈunto wˈalo bˈiljon");
        // A connective the text already wrote is not doubled.
        expect(say("2016 hasta 2022")).not.toContain("hˈasta hˈasta");
    });

    test("the symbol tier: percent, ₱, units, the squared word, and the rate", () => {
        expect(say("59%")).toBe("kalˈimʔan kˈaɡ sˈijam poɾsijˈento"); // the sign was DROPPED outright
        expect(say("₱5")).toBe("lˈima pˈiso"); // the only currency sign in the corpus; `$` is declined
        // ⚠ `km`/`m` reached the IPA RAW before this — `12,706 km²` read *…km…*, unit letters and all.
        // `kwadrado` ×1,661 is the best-attested content word in the corpus.
        expect(say("12,706 km²")).toBe(
            "napˈulo kˈaɡ dˈuha kˈa lˈibo kˈaɡ pˈito kˈa ɡˈatos kˈaɡ ʔˈanum kilomˈetɾo kwadɾˈado");
        // The ASCII exponent, which is what the corpus's `911–949 km2` writes — it used to read the `2` as
        // the NUMBER two (*km duha*), trap 37's `mm2` defect.
        expect(say("949 km2")).toBe("sˈijam kˈa ɡˈatos kˈaɡ kapʔˈatan kˈaɡ sˈijam kilomˈetɾo kwadɾˈado");
        expect(say("120 km/h")).toBe("ʔˈisa kˈa ɡˈatos kˈaɡ kaluhˈaʔan kilomˈetɾo kˈada ʔˈoɾas"); // `kada` = Kaufmann's `káda` "Each"
        // ⚠ TRAP 46, PINNED AS A BRANCH THE CORPUS DOES NOT CONTAIN. Bare `m` is a declared one-letter unit
        // key, so a dotted designation could read as metres — and the tier's `NOT_VERSION` guard only works
        // because the tier runs ABOVE the decimal rule and can still see the dot. Reorder those two and
        // this becomes "…eleven METRES".
        expect(say("802.11m")).not.toContain("mˈetɾo");
    });

    test("the clock is guarded on `alas`, because the corpus's other colons are a standard's number", () => {
        // ×1: `halin Sabado sa alas-5:00 sang aga`. The colon was clause punctuation, so it read
        // *ʔalas lima , sero* — a pause plus a phantom "sero" for the empty minutes.
        expect(say("sa alas-5:00 sang aga")).toBe("sˈa ʔˈalas lˈima sˈaŋ ʔˈaɡa");
        expect(say("alas 9:30")).toBe("ʔˈalas sˈijam kˈaɡ katlˈoʔan"); // minutes join with `kag`, ×2,207
        // ⚠ THE ADVERSARY, AND THE REASON THE GUARD IS NOT OPTIONAL. `ISO 20715:2023` is the corpus's other
        // `\d{1,2}:\d{2}` shape (×2) — an unguarded clock rule matches `15:20` inside it. So the bare colon
        // is deliberately left as clause punctuation: 1 instance fixed, 0 broken.
        expect(say("ISO 20715:2023")).toContain(","); // still a pause, not a time
    });

    test("dotted abbreviations, and the ordinal's bound linker", () => {
        // A CLOSED LIST, never a shape: `Panay.` ×8, `Asya.` ×5 and `Roxas.` ×3 are SENTENCE ENDS (trap 2).
        expect(say("Dr. Jose")).toBe("dˈoktoɾ hˈose"); // Kaufmann `doktór`; was *dɾ* plus a phrase break
        expect(say("Fr. Tomas")).toBe("pˈadɾe tˈomas"); // ⟨f⟩→[p], so the bare form is the cluster [pɾ]
        expect(say("Panay.")).toBe("pˈanaj ."); // a genuine sentence end survives untouched
        // ⚠ THE SEAM THAT ALREADY WORKED IS LEFT ALONE (trap 16): ⟨ika-⟩ is an ordinary Hiligaynon ordinal
        // prefix (Kaufmann `ikaduhá, (H) Second`), so this needed no rule. Pinned so it stays that way.
        expect(say("ika-19 nga siglo")).toBe("ʔˈika napˈulo kˈaɡ sˈijam ŋˈa sˈiɡlo");
        // ⚠ TRAP 14/15: the linker glued to the DIGITS cannot become a word, so the tokenizer read the
        // stranded `ng` on its own and the g2p gave it a bare [ŋ] — a consonant emitted as a whole word.
        expect(say("ika-5ng Gobernador")).toBe("ʔˈika lˈima ŋˈa ɡobeɾnˈadoɾ");
    });

    test("ordinary Hiligaynon text is untouched by every rule above", () => {
        // The sample tier's ordinary shape — no digits, no signs, nothing for the layer to claim.
        expect(say("Ang kada barangay may mga purok kag ang iban")).toBe(
            "ʔˈaŋ kˈada baɾˈaŋaj mˈaj mˈaŋa pˈuɾok kˈaɡ ʔˈaŋ ʔˈiban");
        // ⚠ `tunga` MUST STILL BE THE PREPOSITION. All 21 corpus instances are `sa tunga sang X kag Y`,
        // "in the middle of" — which is why Cebuano's `1/2` → `tunga` rule was NOT copied, and why no
        // fraction rule ships at all (see normalize.ts's refusal).
        expect(say("sa tunga sang mga atomo")).toBe("sˈa tˈuŋa sˈaŋ mˈaŋa ʔatˈomo");
    });
});
