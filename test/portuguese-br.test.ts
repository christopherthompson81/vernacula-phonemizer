/**
 * pt-BR ("neutral"/paulistano BP) accent DIAGNOSTIC GOLD — the hand-adjudicated quality anchor. Unlike English,
 * the referee number is NOT noise-limited (the `pt` rule engine has real coverage): pt-BR scores 83% vs wikipron
 * por_latn_bz (57k). This gold hand-checks the EP→BP delta on core vocabulary + every signature feature (RP from
 * Cristófaro Silva / Wikipédia BP conventions, corroborated against the wikipron BZ referee). See
 * docs/investigations/pt-br_native_bringup_investigation.md.
 *
 * NOT included (documented lexical tail): open/close stressed-mid words where the shared EP lexicon differs from
 * BP (telefone → EP-lexicon [ɔ] vs BP [o]; beringela [ɛ]); ea-hiatus (Ceará); loanwords.
 */
import { describe, expect, it } from "vitest";
import {
    createPortugueseBR,
    phonemizeWord,
} from "../src/languages/portuguese-br/portuguese-br.ts";

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
