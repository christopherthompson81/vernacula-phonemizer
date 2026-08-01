import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeFula } from "../src/languages/fula/normalize.ts";
import { createFula, phonemizeWord } from "../src/languages/fula/fula.ts";
import { numberToWords } from "../src/languages/fula/numbers.ts";

describe("Fula g2p (authored)", () => {
    it("implosives, prenasalized digraphs, geminates, length", () => {
        expect(phonemizeWord("ɓiɗɗo")).toBe("ɓˈiɗːo"); // implosive ɓ, geminate ɗɗ→ɗː
        expect(phonemizeWord("ƴiiƴam")).toBe("ʄˈiːʄam"); // ƴ→ʄ (implosive), long ii→iː
        expect(phonemizeWord("ngol")).toBe("ᵑɡˈol"); // prenasalized ng→ᵑɡ
        expect(phonemizeWord("njamndi")).toBe("ⁿd͡ʒˈamⁿdi"); // nj→ⁿd͡ʒ, nd→ⁿd
        expect(phonemizeWord("koŋgol")).toBe("kˈoŋɡol"); // ŋ + g (not the ng digraph)
        expect(phonemizeWord("debbo")).toBe("dˈebːo"); // geminate bb→bː
        expect(phonemizeWord("moƴƴude")).toBe("moʄːˈude"); // geminate ƴƴ→ʄː
    });

    it("penultimate stress", () => {
        expect(phonemizeWord("Fulfulde")).toBe("fulfˈulde"); // 3 syllables → penult
        expect(phonemizeWord("tati")).toBe("tˈati"); // 2 syllables → first (penult)
        expect(phonemizeWord("gorko")).toBe("ɡˈoɾko"); // r→ɾ
    });

    it("Adlam (𞤀𞤁𞤂𞤃) front-end — transliterates to Boko, IDENTICAL IPA to the Latin path", () => {
        expect(phonemizeWord("𞤊𞤵𞤤𞤩𞤫")).toBe("fˈulɓe"); // Fulɓe (the people); bhe→ɓ
        expect(phonemizeWord("𞤊𞤵𞤤𞤩𞤫")).toBe(phonemizeWord("Fulɓe")); // Adlam ≡ Latin
        expect(phonemizeWord("𞤆𞤵𞤤𞤢𞥄𞤪")).toBe("pˈulaːɾ"); // Pulaar — the ALIF LENGTHENER (𞥄) → long aː
        expect(phonemizeWord("𞤂𞤢𞥄𞤥𞤯𞤮")).toBe("lˈaːmɗo"); // laamɗo "chief" — lengthener + implosive ɗ (dha)
        expect(phonemizeWord("𞤁𞤫𞤦𞥆𞤮")).toBe("dˈebːo"); // debbo — the GEMINATION MARK (𞥆) → long bː
    });

    // NUMBERS — QUINARY (base-5) below ten, DECIMAL above it, with a vigesimal relic at 20: 6–9 are 5+n
    // compounds on jee- < jowi 'five', noogaas 20 is its own lexeme (< 'it is finished' — fingers AND toes),
    // and 30–90 are cappanɗe (the ƊE plural of sappo, with s→c mutation) + a multiplier that may itself be
    // quinary (cappanɗe jeetati = 10×(5+3) = 80). Slots join with the comitative e. Magnitude nouns go to their
    // plural when multiplied (teemedere → teemedde, ujundere → ujunaaje). Lect: Pulaar Futa-Tooro.
    // Sources: Kosogorova 2023 (SALC 57) §2.1–2.2, Peace Corps/Mauritania "Introduction to Pulaar", Omniglot.
    // See src/languages/fula/numbers.ts.
    it("numbers: the QUINARY 6–9 (jee- + n)", () => {
        expect(numberToWords(5)).toBe("joyi");
        expect(numberToWords(6)).toBe("jeegom"); // 5+1
        expect(numberToWords(7)).toBe("jeeɗiɗi"); // 5+2
        expect(numberToWords(8)).toBe("jeetati"); // 5+3
        expect(numberToWords(9)).toBe("jeenayi"); // 5+4
    });

    it("numbers: sappo / noogaas / cappanɗe tens + the comitative e", () => {
        expect(numberToWords(10)).toBe("sappo");
        expect(numberToWords(11)).toBe("sappo e goo");
        expect(numberToWords(20)).toBe("noogaas"); // a lexeme, not 2×10
        expect(numberToWords(21)).toBe("noogaas e goo");
        expect(numberToWords(42)).toBe("cappanɗe nayi e ɗiɗi"); // 10×4 + 2
        expect(numberToWords(80)).toBe("cappanɗe jeetati"); // 10×(5+3) — quinary multiplier
        expect(numberToWords(99)).toBe("cappanɗe jeenayi e jeenayi");
    });

    it("numbers: teemedere/ujundere and their ƊE plurals; the borrowed million/milyar", () => {
        expect(numberToWords(100)).toBe("teemedere"); // singular, bare
        expect(numberToWords(101)).toBe("teemedere e goo");
        expect(numberToWords(555)).toBe("teemedde joyi e cappanɗe joyi e joyi"); // plural when multiplied
        expect(numberToWords(1000)).toBe("ujundere");
        expect(numberToWords(12345)).toBe("ujunaaje sappo e ɗiɗi e teemedde tati e cappanɗe nayi e joyi");
        expect(numberToWords(1_000_000)).toBe("million");
        expect(numberToWords(2_000_000)).toBe("milionji ɗiɗi");
        expect(numberToWords(1_000_000_000)).toBe("milyar");
    });

    it("numbers: both registered scripts — Adlam digits (𞥐–𞥙) ≡ ASCII", () => {
        const ff = createFula();
        expect(ff.text("7")).toBe("d͡ʒeːɗˈiɗi"); // jeeɗiɗi — long ee→eː, implosive ɗ, penultimate stress
        expect(ff.text("𞥗")).toBe(ff.text("7")); // Adlam digits fold to ASCII → identical IPA
    });
});

// TEXT NORMALIZATION (src/languages/fula/normalize.ts) — the pre-tokenizer pass behind #562. The defining
// rules are the English ordinal digits read as Fula ordinals (1st → gootal), the comma-thousands (the
// corpus groups with commas), the dot-decimal "tere", the a.m./p.m. clocks with Fula time-of-day words,
// the rates "e wakkati gootel", and the letter-spelled initialisms.
describe("Fula text normalization", () => {
    const ph = (s: string): string => phonemize(s, "ff").trim();

    it("text→text: the English ordinal digit reads the Fula ordinal", () => {
        expect(normalizeFula("1st")).toBe("gootal");
        expect(normalizeFula("16th")).toBe("sappo e jeegaɓal");
        expect(normalizeFula("190th")).toBe("teemedere e cappanɗe jeenayaɓal");
        expect(ph("1st je janeru")).toBe("ɡˈoːtal d͡ʒˈe d͡ʒanˈeɾu");
    });

    it("comma-thousands stay grouped; the dot is a decimal (tere)", () => {
        expect(ph("2,243")).toBe("ud͡ʒunˈaːd͡ʒe ɗˈiɗi ˈe teːmˈedːe ɗˈiɗi ˈe t͡ʃapːˈanɗe nˈaji ˈe tˈati");
        expect(ph("100,000")).toBe("ud͡ʒunˈaːd͡ʒe teːmedˈeɾe");
        expect(ph("1.5 million")).toBe("ɡˈoː tˈeɾe d͡ʒˈoji milːˈion");
        expect(ph("12.8km")).toBe("sˈapːo ˈe ɗˈiɗi tˈeɾe d͡ʒeːtˈati kilomˈetɾe");
    });

    it("clocks read hour [minute] with p.m./a.m. as kikiiɗe / fajiri", () => {
        expect(ph("1:15 a.m.")).toBe("ɡˈoː ˈe sˈapːo ˈe d͡ʒˈoji fad͡ʒˈiɾi");
        expect(ph("8:30 p.m.")).toBe("d͡ʒeːtˈati ˈe t͡ʃapːˈanɗe tˈati kikˈiːɗe");
        expect(ph("15.00 UTC")).toBe("sˈapːo ˈe d͡ʒˈoji ˈu tˈa t͡ʃˈa");
    });

    it("era markers expand; ranges join hakkunde; rates use e wakkati gootel", () => {
        expect(ph("1000B.C.")).toBe("ud͡ʒuⁿdˈeɾe ɓˈawo");
        expect(ph("7-2")).toBe("d͡ʒeːɗˈiɗi hakːˈuⁿde ɗˈiɗi");
        expect(ph("160km/h")).toBe("teːmedˈeɾe ˈe t͡ʃapːˈanɗe d͡ʒˈeːɡom kilomˈetɾe ˈe wakːˈati ɡˈoːtel");
        expect(ph("300mph")).toBe("teːmˈedːe tˈati mˈiles ˈe wakːˈati ɡˈoːtel");
    });

    it("currency, percent, degrees and initialisms read their words or letters", () => {
        expect(ph("US$11,000")).toBe("dˈolːaɾ amˈeɾik ud͡ʒunˈaːd͡ʒe sˈapːo ˈe ɡˈoː");
        expect(ph("AUD$45")).toBe("dˈolːaɾ awstɾalˈija t͡ʃapːˈanɗe nˈaji ˈe d͡ʒˈoji");
        expect(ph("88%")).toBe("t͡ʃapːˈanɗe d͡ʒeːtˈati ˈe d͡ʒeːtˈati tˈeɾe");
        expect(ph("30°C")).toBe("t͡ʃapːˈanɗe tˈati diɡˈiɾi t͡ʃelsˈius");
        expect(ph("MRI")).toBe("mˈa ɾˈa ˈi");
        expect(ph("H5N1")).toBe("hˈa d͡ʒˈoji nˈa ɡˈoː");
        expect(ph("U.S.")).toBe("ˈu sˈa");
    });
});
