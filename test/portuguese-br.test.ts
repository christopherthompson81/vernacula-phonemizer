/**
 * pt-BR ("neutral"/paulistano BP) accent DIAGNOSTIC GOLD — the hand-adjudicated quality anchor. Unlike English,
 * the referee number is NOT noise-limited (the `pt` rule engine has real coverage): pt-BR scores 83% vs wikipron
 * por_latn_bz (57k). This gold hand-checks the EP→BP delta on core vocabulary + every signature feature (RP from
 * Cristófaro Silva / Wikipédia BP conventions, corroborated against the wikipron BZ referee).
 *
 * NOT included (documented lexical tail): open/close stressed-mid words where the shared EP lexicon differs from
 * BP (telefone → EP-lexicon [ɔ] vs BP [o]; beringela [ɛ]); ea-hiatus (Ceará); loanwords.
 */
import { describe, expect, it, test } from "vitest";
import {
    createPortugueseBR,
    phonemizeWord,
} from "../src/languages/portuguese-br/portuguese-br.ts";
import { phonemize } from "../src/index.ts";
import { ROMAN_POLICY as PT_POLICY } from "../src/languages/portuguese/romanOrdinals.ts";
import { ROMAN_POLICY } from "../src/languages/portuguese-br/romanOrdinals.ts";

// word → adjudicated BP IPA. Signature features: /t d/ affrication before [i], coda-l → [w], coda-s → [s]/[z],
// position-split reduction (pretonic mid, final raise), -em → [ẽj̃].
const GOLD: [string, string][] = [
    // /t d/ affrication before the onset GLIDE [j] from ⟨i⟩ too (categorical in the BZ referee)
    ["adiado", "ad͡ʒjˈadu"], ["diamante", "d͡ʒjamˈɐ̃t͡ʃi"], ["idioma", "id͡ʒjˈomɐ"], ["tédio", "tˈɛd͡ʒju"],
    // /t d/ affrication before [i] (incl. raised final ⟨e⟩→[i])
    ["tia", "t͡ʃˈiɐ"], ["dia", "d͡ʒˈiɐ"], ["gente", "ʒˈẽt͡ʃi"], ["dente", "dˈẽt͡ʃi"], ["noite", "nˈojt͡ʃi"],
    ["cidade", "sidˈad͡ʒi"], ["verde", "vˈeɾd͡ʒi"], ["leite", "lˈejt͡ʃi"], ["quente", "kˈẽt͡ʃi"], ["forte", "fˈɔɾt͡ʃi"],
    ["tarde", "tˈaɾd͡ʒi"], ["onde", "ˈõd͡ʒi"], ["time", "t͡ʃˈimi"], ["grande", "ɡɾˈɐ̃d͡ʒi"], ["desde", "dˈezd͡ʒi"],
    // coda /l/ vocalization → [w]
    ["brasil", "bɾazˈiw"], ["sal", "sˈaw"], ["mal", "mˈaw"], ["papel", "papˈɛw"], ["soldado", "sowdˈadu"],
    ["final", "finˈaw"], ["total", "totˈaw"], ["animal", "animˈaw"], ["fácil", "fˈasiw"], ["útil", "ˈut͡ʃiw"],
    // coda /s/ alveolar [s]/[z] (not EP [ʃ]/[ʒ])
    ["estado", "estˈadu"], ["português", "poɾtuɡˈes"], ["três", "tɾˈes"], ["dez", "dˈɛs"], ["seis", "sˈejs"],
    ["atrás", "atɾˈas"], ["mesmo", "mˈezmu"],
    // position-split reduction: pretonic mid (bonito NOT bunitu), final raise (e→i, o→u)
    ["você", "vosˈe"], ["professor", "pɾofesˈoɾ"], ["menino", "menˈinu"], ["bonito", "bonˈitu"], ["pequeno", "pekˈenu"],
    ["escola", "eskˈɔlɐ"], ["doce", "dˈosi"], ["sede", "sˈed͡ʒi"], ["rede", "ʁˈed͡ʒi"], ["pobre", "pˈɔbɾi"],
    // -em → [ẽj̃] (BP), NOT the EP [ɐ̃j̃]; -am and -ãe stay [ɐ̃w̃]/[ɐ̃j̃]
    ["tem", "tˈẽj̃"], ["bem", "bˈẽj̃"], ["viagem", "vjˈaʒẽj̃"], ["também", "tɐ̃bˈẽj̃"],
    ["ontem", "ˈõtẽj̃"], ["jovem", "ʒˈɔvẽj̃"], ["mãe", "mˈɐ̃j̃"], ["pão", "pˈɐ̃w̃"], ["coração", "koɾasˈɐ̃w̃"],
    // stressed mid vowel CLOSES before a nasal-onset consonant in BP (the ô/ê; EP keeps ó/é open)
    ["homem", "ˈomẽj̃"], ["fome", "fˈomi"], ["telefone", "telefˈoni"], ["abandona", "abɐ̃dˈonɐ"], ["pessoa", "pesˈoɐ"],
    // plain words (rr/initial [ʁ], coda-r [ɾ] — both attested in BZ)
    ["casa", "kˈazɐ"], ["mesa", "mˈezɐ"], ["rua", "ʁˈuɐ"], ["carro", "kˈaʁu"], ["terra", "tˈɛʁɐ"],
    ["porta", "pˈɔɾtɐ"], ["água", "ˈaɡwɐ"], ["muito", "mˈujtu"], ["trabalho", "tɾabˈaʎu"], ["falar", "falˈaɾ"],
    ["amor", "amˈoɾ"], ["mulher", "muʎˈɛɾ"], ["bom", "bˈõ"], ["tempo", "tˈẽpu"],
];

describe("pt-BR (neutral BP) accent delta", () => {
    for (const [word, ipa] of GOLD) {
        it(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});

// The BP open/close override lexicon (rule-unpredictable stressed-vowel openness, mined from the BZ referee):
// these are wrong on the rule-only path (phonemizeWordRules) and corrected on the shipped phonemizeWord.
describe("pt-BR open/close lexicon (shipped)", () => {
    for (const [word, ipa] of [
        ["cheque", "ʃˈɛki"],
        ["acerola", "aseɾˈɔlɐ"],
        ["anedota", "anedˈɔtɐ"],
        ["pobre", "pˈɔbɾi"],
    ] as const) {
        it(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});

// The BP "dez-e-" teens (16/17/19), distinct from the EP "dez-a-" forms — spoken through text() with the BP
// realization on top (affrication, coda-s→s). Guards the dialect-parameterized number compositor.
describe("pt-BR numbers (dez-e- teens)", () => {
    const bp = createPortugueseBR();
    for (const [n, ipa] of [
        ["16", "dezesˈejs"],
        ["17", "dezesˈɛt͡ʃi"],
        ["19", "dezenˈɔvi"],
        ["26", "vˈĩt͡ʃi e sˈejs"],
    ] as const) {
        it(`${n} → ${ipa}`, () => {
            expect(bp.text(n)).toBe(ipa);
        });
    }
});

// ── Roman-numeral policy (src/languages/portuguese-br/romanOrdinals.ts) ──
// A CENTURY IS A CARDINAL in pt-BR (Brazilian usage shares the ordinal-≤X / cardinal-≥XI convention: século dezenove) — the shared Roman→digits pass is already right and the policy
// must not change that. What the policy adds is the PRENOMINAL ordinal of event names, which is ordinal at ANY
// value (XL/L aniversari·o → the -ésimo / -è series), where the cardinal would be the wrong register.
describe("pt-BR Roman-numeral policy — centuries cardinal, prenominal events ordinal", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal(n);

    test("a century stays a CARDINAL (the century noun is not a trigger)", () => {
        expect(ROMAN_POLICY.ordinalBefore).toBeUndefined();
        expect(ROMAN_POLICY.ordinalAfter?.test("século")).toBe(false);
        expect(phonemize("século xix", "pt-BR")).toBe('sˈɛkulu dezenˈɔvi');
    });

    test("a bare numeral, with no ordinal context, stays a CARDINAL", () => {
        expect(phonemize("xix", "pt-BR")).toBe('dezenˈɔvi');
    });

    test("prenominal event context is ordinal, and unbounded — XL / L / above L", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("aniversário")).toBe(true);
        expect(ord(40)).toBe('quadragésimo');
        expect(ord(50)).toBe('quinquagésimo');
        expect(ord(60)).toBe('sexagésimo');
        expect(phonemize('quinquagésimo aniversário', "pt-BR")).toBe('kĩkwaʒˈɛzimu aniveɾsˈaɾju');
    });

    test("feminine heads are deliberately NOT triggered (the series is masculine)", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("edição")).toBe(false);
    });

    test("pt-BR re-exports the pt policy verbatim (identical words, only the g2p differs)", () => {
        expect(ROMAN_POLICY).toBe(PT_POLICY);
    });
});

// #562 — the eighth language, structurally the closest to Spanish. Asserted on pt-BR because that is the
// locale of the FLEURS audio these were measured against; the layer is shared with European pt apart from
// the date rule below.
describe("portuguese normalization", () => {
    test("ordinal indicators no longer leak, and ° is not one of them", () => {
        // º and ª were reaching the phoneme string RAW — a non-IPA character in the output, on 13 corpus
        // utterances.
        expect(phonemize("o 1º dia", "pt-BR")).toBe("o pɾimˈejɾu d͡ʒˈiɐ");
        expect(phonemize("a 5ª vez", "pt-BR")).toBe("a kˈĩtɐ vˈes"); // feminine
        expect(phonemize("o 37º", "pt-BR")).toBe("o tɾiʒˈɛzimu sˈɛt͡ʃimu");
        // ° (U+00B0) is DEGREES; "35°" and "32 °" occur in this corpus and are temperatures.
        expect(phonemize("20 °C", "pt-BR")).toBe("vˈĩt͡ʃi ɡɾˈaws sewsˈiws");
        expect(phonemize("35°", "pt-BR")).toBe("tɾˈĩtɐ e sˈĩku ɡɾˈaws");
    });

    test("clock: both written forms were broken", () => {
        // The h form (×28) dropped its marker entirely and the colon form (×17) made the colon a PAUSE
        // with a spurious "zero" at :00. `hora` is feminine, so 1 takes *uma*.
        expect(phonemize("07h19", "pt-BR")).toBe("sˈɛt͡ʃi ˈɔɾɐs e dezanˈovi");
        expect(phonemize("10 h", "pt-BR")).toBe("dˈɛs ˈɔɾɐs");
        expect(phonemize("8:46", "pt-BR")).toBe("ˈojtu ˈɔɾɐs e kwaɾˈẽtɐ e sˈejs");
        expect(phonemize("11:00", "pt-BR")).toBe("ˈõzi ˈɔɾɐs");
    });

    test("abbreviations, R$, and número", () => {
        expect(phonemize("o Sr. Silva", "pt-BR")).toBe("o seɲˈoɾ sˈiwvɐ"); // was the cluster [zʁ] + a pause
        expect(phonemize("o Dr. Costa", "pt-BR")).toBe("o dotˈoɾ kˈɔstɐ");
        expect(phonemize("etc.", "pt-BR")).toBe("etsˈɛteɾɐ ."); // was [ˈetk]
        // `a.` is 8 of the 19 dotted abbreviations in the corpus and every one is the era marker.
        expect(phonemize("356 a.C.", "pt-BR")).toBe("tɾezˈẽtus e sĩkˈẽtɐ e sˈejs ˈɐ̃t͡ʃis de kɾˈistu");
        // R$ was read as a stray [ʁ] followed by "dólares" — the shared tier saw only the $.
        expect(phonemize("R$ 50", "pt-BR")).toBe("sĩkˈẽtɐ ʁjˈajs");
        expect(phonemize("no 1", "pt-BR")).toBe("nˈumeɾu ũ"); // only before a DIGIT — bare "no" is em+o
        expect(phonemize("120 km/h", "pt-BR")).toBe("sˈẽtu e vˈĩt͡ʃi kilˈometɾus poɾ ˈɔɾɐ"); // /h was dropped
    });

    test("initialisms, with Roman numerals claimed upstream", () => {
        expect(phonemize("os EUA", "pt-BR")).toBe("os ˈɛ ˈu a"); // was read as the word [ˈewɐ]
        expect(phonemize("a TV", "pt-BR")).toBe("a tˈe vˈe"); // was the cluster [tv]
        expect(phonemize("a AOL", "pt-BR")).toBe("a a ˈɔ ˈɛli");
        // pt is not in ROMAN_NATIVE, so the shared pass converts these at the registry seam before the
        // initialism rule ever sees them.
        expect(phonemize("século XV", "pt-BR")).toBe("sˈɛkulu kˈĩzi");
        expect(phonemize("Luís XIV", "pt-BR")).toBe("luˈis katˈoɾzi");
    });

    test("fractions, signs, and the one variety-specific rule", () => {
        expect(phonemize("1/5", "pt-BR")).toBe("ũ kˈĩtu");
        expect(phonemize("-5 graus", "pt-BR")).toBe("mˈenus sˈĩku ɡɾˈaws");
        // The first of the month DIFFERS between the varieties: Brazil says primeiro, Portugal um. An
        // explicit 1º is honoured in both, because there the writer marked it.
        expect(phonemize("1 de julho", "pt-BR")).toBe("pɾimˈejɾu de ʒˈuʎu");
        expect(phonemize("1 de julho", "pt")).toBe("ũ de ʒˈuʎu");
        expect(phonemize("1º de julho", "pt")).toBe("pɾimˈejɾu de ʒˈuʎu");
    });
});
