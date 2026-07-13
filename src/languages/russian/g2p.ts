/**
 * Russian grapheme→phoneme engine (standard Moscow Russian). Cyrillic + a stress-vowel ordinal → canonical
 * IPA. Handles palatalization (hard/soft consonant pairs Cʲ), iotation (я/е/ё/ю after a vowel/sign/initial →
 * j+V), stress-based vowel reduction (akanye/ikanye), final devoicing and regressive voicing assimilation.
 * Stress is lexical (not derivable from spelling) — supplied by the caller from stress.tsv. See
 * docs/ru_native_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";

// All letter→IPA / voicing lookup tables are DATA (russian.jsonc). Consonant → [hard, soft] IPA (ж/ш/ц always
// hard; ч/щ/й always soft). Voicing pairs drive final devoicing + regressive assimilation.
const CONS = MANIFEST.consonants;
const ALWAYS_HARD = new Set(MANIFEST.alwaysHard);
const ALWAYS_SOFT = new Set(MANIFEST.alwaysSoft);
const SOFT_VOWEL = new Set(MANIFEST.softVowels); // palatalize the preceding consonant
const VOWELS = new Set([...MANIFEST.vowelLetters]);
const IOTATED = new Set(MANIFEST.iotatedVowels); // → j+V after a vowel/ъ/ь/word-initial

const DEVOICE = MANIFEST.devoice;
const VOICE = MANIFEST.voice;
const VOICELESS_OBSTR = new Set(MANIFEST.voicelessObstruents);
const VOICED_OBSTR = new Set(MANIFEST.voicedObstruents);

interface Unit {
    cyr: string;
    cons?: { ph: string; soft: boolean }; // a consonant (ph already hard/soft-selected)
    vowel?: { letter: string; glide: boolean; stressed: boolean; ph: string }; // ph filled at realize
}

const SOFTEN_TGT = MANIFEST.softenTargets; // dentals that soften regressively (л excluded — пополнять keeps ɫ)
const SOFTEN_TRIG = MANIFEST.softenTriggers; // ... before a soft т/д (before soft н is inconsistent: сняться keeps hard с)

/** Split a lowercased Cyrillic word into consonant / vowel / sign units, resolving palatalization + iotation. */
function parse(w: string): Unit[] {
    const chars = [...w];
    const units: Unit[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        // т/д before с → affricate t͡s (детский, отсюда); with a ь between (-ться) → long t͡sː.
        if (c === "т" || c === "д") {
            const soft = chars[i + 1] === "ь";
            const sIdx = soft ? i + 2 : i + 1;
            if (chars[sIdx] === "с") {
                units.push({
                    cyr: "ц",
                    cons: { ph: soft ? "t͡sː" : "t͡s", soft: false },
                });
                i = sIdx;
                continue;
            }
            if (chars[i + 1] === "ч") {
                units.push({ cyr: "ч", cons: { ph: "t͡ɕː", soft: true } });
                i += 1;
                continue;
            } // тч → t͡ɕː
            if (chars[i + 1] === "ц") continue; // тц/дц → t͡s (т/д merges into ц; отца → ɐt͡sa)
        }
        // сч / зч / жч → ɕː (счастье → ɕːasʲtʲjə, мужчина → mʊɕːinə).
        if ((c === "с" || c === "з" || c === "ж") && chars[i + 1] === "ч") {
            units.push({ cyr: "щ", cons: { ph: "ɕː", soft: true } });
            i += 1;
            continue;
        }
        // дж → the affricate d͡ʐ (loanwords: джинсы, менеджер, Джон, поджарить).
        if (c === "д" && chars[i + 1] === "ж") {
            units.push({ cyr: "ж", cons: { ph: "d͡ʐ", soft: false } });
            i += 1;
            continue;
        }
        // Reflexive -ся / -сь after a hard consonant keeps hard с (вернулся → …ɫsə); after й (-йся) it stays soft
        // (соприкасающийся → …jsʲə).
        if (
            c === "с" &&
            (chars[i + 1] === "я" || chars[i + 1] === "ь") &&
            i + 2 >= chars.length &&
            chars[i - 1] !== "й" &&
            !VOWELS.has(chars[i - 1] ?? "")
        ) {
            units.push({ cyr: "с", cons: { ph: "s", soft: false } });
            continue;
        }
        if (CONS[c]) {
            const next = chars[i + 1] ?? "";
            let soft: boolean;
            if (ALWAYS_HARD.has(c)) soft = false;
            else if (ALWAYS_SOFT.has(c)) soft = true;
            else soft = next === "ь" || SOFT_VOWEL.has(next);
            units.push({ cyr: c, cons: { ph: CONS[c]![soft ? 1 : 0], soft } });
        } else if (VOWELS.has(c)) {
            const prev = chars[i - 1] ?? "";
            const glide =
                IOTATED.has(c) &&
                (prev === "" ||
                    VOWELS.has(prev) ||
                    prev === "ь" ||
                    prev === "ъ");
            units.push({
                cyr: c,
                vowel: { letter: c, glide, stressed: false, ph: "" },
            });
        }
        // ь/ъ carry no phoneme (ь already softened the preceding consonant); skip.
    }
    // Regressive palatalization: a dental softens before an immediately-following soft dental (гостиный → sʲtʲ).
    for (let i = 0; i < units.length; i++) {
        const c = units[i]!;
        if (!c.cons || c.cons.soft || !SOFTEN_TGT.includes(c.cyr)) continue;
        const nx = units[i + 1];
        if (!nx?.cons?.soft) continue;
        // two-tier: с/з soften only before soft т (сделать/здесь keep hard z before soft д); т/д/н soften before
        // soft т/д/н/ч (стаканчик → nʲt͡ɕ; but женщина keeps hard н before щ).
        const ok = "сз".includes(c.cyr)
            ? "тд".includes(nx.cyr)
            : "тднч".includes(nx.cyr); // с/з soften before soft т/д (сделать→zʲdʲ, ездил→zʲdʲ)
        if (ok) c.cons = { ph: CONS[c.cyr]![1], soft: true };
    }
    // Geminate softness agreement: identical adjacent consonant letters take the softness of the second (россия
    // → sʲsʲ → collapses to sʲː downstream).
    for (let i = 0; i < units.length - 1; i++) {
        const a = units[i]!,
            b = units[i + 1]!;
        if (
            a.cons &&
            b.cons &&
            a.cyr === b.cyr &&
            b.cons.soft &&
            !a.cons.soft &&
            CONS[a.cyr]
        )
            a.cons = { ph: CONS[a.cyr]![1], soft: true };
    }
    return units;
}

// Base (stressed) vowel quality by letter + whether the preceding consonant is soft.
function stressedVowel(letter: string, softContext: boolean): string {
    switch (letter) {
        case "а":
            return softContext ? "æ" : "a"; // а fronts to æ between soft C (счастье → ɕːæsʲtʲje)
        case "я":
            return "æ";
        case "о":
            return "o";
        case "ё":
            return "o";
        case "э":
            return "ɛ";
        case "е":
            return "e";
        case "у":
        case "ю":
            return "u";
        case "и":
            return "i";
        case "ы":
            return "ɨ";
        default:
            return letter;
    }
}

// Unstressed reduction (akanye/ikanye), position-sensitive: `strong` = immediately-pretonic OR absolute
// word-initial (→ ɐ for hard а/о); post-tonic soft vowels reduce further to ə.
function reducedVowel(
    letter: string,
    softContext: boolean,
    strong: boolean,
    postTonic: boolean,
): string {
    const soft =
        softContext ||
        letter === "я" ||
        letter === "е" ||
        letter === "и" ||
        letter === "ё" ||
        letter === "ю";
    switch (letter) {
        case "а":
        case "о":
            if (soft) return postTonic ? "ə" : "ɪ"; // after a soft consonant (ча, чо…): pretonic ɪ, post-tonic ə
            return strong ? "ɐ" : "ə"; // hard: 1st-pretonic/initial ɐ, else ə
        case "я":
            return postTonic ? "ə" : "ɪ"; // post-tonic я → ə (далями), pretonic → ɪ
        case "е":
            return "ɪ"; // unstressed е → ɪ (both positions)
        case "и":
            return "ɪ";
        case "э":
            return postTonic ? "ə" : "ɪ";
        case "у":
        case "ю":
            return "ʊ";
        case "ы":
            return "ɨ";
        case "ё":
            return "o"; // ё is always stressed; unreached
        default:
            return letter;
    }
}

// Adverbs in -ого that keep [ɡ] (the genitive -ого/-его → v rule does NOT apply). Their genitive ADJECTIVE
// forms (многого, дорогого…) are regular genitives → v, so they must NOT be listed here.
const GEN_KEEP_G = new Set(MANIFEST.genitiveKeepG);

/** Phonemize a Russian word given the 0-based ordinal of its stressed vowel, and optionally a set of vowel
 *  ordinals whose preceding consonant is HARD (loanword е/и: тест → tɛst, not tʲest — supplied by the lexicon). */
export function toIpa(
    word: string,
    stressOrd: number,
    hard?: number[],
): string {
    const w0 = word.toLowerCase();
    const units = parse(w0);
    // Genitive -ого/-его → the г is [v] (красного → …nəvə, его → jɪvo); adverbs (много…) keep ɡ.
    if ((w0.endsWith("ого") || w0.endsWith("его")) && !GEN_KEEP_G.has(w0)) {
        for (let i = units.length - 1; i >= 0; i--)
            if (units[i]!.cons?.ph === "ɡ" || units[i]!.cons?.ph === "ɡʲ") {
                units[i]!.cons = { ph: "v", soft: false };
                break;
            }
    }
    const vowelIdx = units
        .map((u, i) => (u.vowel ? i : -1))
        .filter((i) => i >= 0);
    const stressPos =
        vowelIdx[stressOrd] ?? vowelIdx[vowelIdx.length - 1] ?? -1;

    // Realize vowels (quality depends on stress + soft context + reduction position).
    const stressK = vowelIdx.indexOf(stressPos);
    for (let k = 0; k < vowelIdx.length; k++) {
        const i = vowelIdx[k]!;
        const v = units[i]!.vowel!;
        const prevCons = units[i - 1]?.cons;
        const softCtx =
            !!prevCons?.soft ||
            (v.glide && v.letter !== "э" && v.letter !== "ы");
        // soft context to the right (for æ/ɵ fronting): a soft consonant, or an iotated (glide) vowel.
        let nextSoft = false;
        for (let j = i + 1; j < units.length; j++) {
            if (units[j]!.cons) {
                nextSoft = units[j]!.cons!.soft;
                break;
            }
            if (units[j]!.vowel) {
                nextSoft = units[j]!.vowel!.glide;
                break;
            }
        }
        const prevSoft = !!prevCons?.soft;
        if (i === stressPos) {
            v.ph = stressedVowel(v.letter, softCtx);
            if (
                (v.letter === "я" || v.letter === "а") &&
                v.ph === "æ" &&
                !nextSoft
            )
                v.ph = "a"; // æ only between two soft C
            // ё → ɵ whenever not word-initial (встаёт, жильё); о → ɵ after a soft consonant (тётя).
            if ((v.letter === "ё" && i > 0) || (v.letter === "о" && prevSoft))
                v.ph = "ɵ";
        } else {
            const strong = k === stressK - 1 || i === 0; // immediately-pretonic or absolute word-initial
            v.ph = reducedVowel(v.letter, softCtx, strong, k > stressK);
        }
        if (
            (v.letter === "у" || v.letter === "ю") &&
            (prevSoft || v.glide) &&
            nextSoft
        )
            v.ph = "ʉ"; // у between soft → ʉ
        // After a hard sibilant / ц: и → ɨ, stressed е → ɛ, unstressed е → ɨ.
        const prevCyr = units[i - 1]?.cyr;
        if (prevCyr && "жшц".includes(prevCyr)) {
            if (v.letter === "и") v.ph = "ɨ";
            else if (v.letter === "е") v.ph = i === stressPos ? "ɛ" : "ɨ";
        }
        // Word-final unstressed vowels: е → e (сборище → …ɕːe, счастье → …je); я → ə (дядя → …dʲə).
        if (i === units.length - 1 && i !== stressPos) {
            if (v.letter === "е") v.ph = "e";
            else if (v.letter === "я") v.ph = "ə";
        }
    }

    // Voicing: regressive assimilation + final devoicing (right to left over the segment sequence).
    for (let i = units.length - 1; i >= 0; i--) {
        const c = units[i]?.cons;
        if (!c) continue;
        let next: { ph: string; kind: "c" | "v" } | null = null;
        for (let j = i + 1; j < units.length; j++) {
            if (units[j]!.cons) {
                next = { ph: units[j]!.cons!.ph, kind: "c" };
                break;
            }
            if (units[j]!.vowel) {
                next = { ph: units[j]!.vowel!.ph, kind: "v" };
                break;
            }
        }
        if (!next) {
            // word-final → devoice
            if (VOICED_OBSTR.has(c.ph)) c.ph = DEVOICE[c.ph] ?? c.ph;
            continue;
        }
        if (next.kind === "v") continue; // before a vowel: keep as is
        // NB: в devoices normally (вш → fʂ), it just doesn't TRIGGER voicing of a preceding C (guarded below).
        if (VOICELESS_OBSTR.has(next.ph) && VOICED_OBSTR.has(c.ph))
            c.ph = DEVOICE[c.ph] ?? c.ph;
        else if (
            VOICED_OBSTR.has(next.ph) &&
            next.ph !== "v" &&
            next.ph !== "vʲ" &&
            VOICELESS_OBSTR.has(c.ph)
        )
            c.ph = VOICE[c.ph] ?? c.ph;
    }

    // Loanword hard consonant before е/и (lexicon): harden the preceding C and lower the vowel (е→ɛ/ɨ, и→ɨ).
    if (hard)
        for (const o of hard) {
            const i = vowelIdx[o];
            if (i === undefined) continue;
            const v = units[i]!.vowel!;
            if (v.letter !== "е" && v.letter !== "и") continue; // guard: only е/и harden (generator may misalign)
            const prev = units[i - 1]?.cons;
            if (prev?.soft) {
                const cyr = units[i - 1]!.cyr;
                if (CONS[cyr]) {
                    prev.ph = CONS[cyr]![0];
                    prev.soft = false;
                }
                // undo a stranded regressive softening of the consonant before it (стенд: с softened before soft т → re-hard)
                const p2 = units[i - 2]?.cons;
                if (p2?.soft && SOFTEN_TGT.includes(units[i - 2]!.cyr)) {
                    const c2 = units[i - 2]!.cyr;
                    p2.ph = CONS[c2]![0];
                    p2.soft = false;
                }
            }
            v.ph = v.letter === "и" ? "ɨ" : i === stressPos ? "ɛ" : "ɨ";
        }

    return withStress(units, stressPos);
}

/** Assemble the IPA string, inserting ˈ before the stressed vowel (after any onset j-glide). Monosyllables
 *  carry no stress mark (matching the reference convention). */
function withStress(units: Unit[], stressPos: number): string {
    const nVowels = units.filter((u) => u.vowel).length;
    const lastIdx = units.length - 1;
    let out = "";
    let prevCons = "";
    let prevCyr = "";
    for (let i = 0; i < units.length; i++) {
        const u = units[i]!;
        if (u.cons) {
            if (u.cons.ph === prevCons) {
                // Geminate: written doubles and voicing-assimilated stops stay long (русский → sː, отдых → odːɨx); only
                // a SIBILANT assimilated across a morpheme (different letters: французский зс → s) simplifies to single.
                // Final geminate → single either way.
                const sibilantAssim =
                    /^[szʂʐ]|ɕ/.test(u.cons.ph) && u.cyr !== prevCyr;
                if (!sibilantAssim && i !== lastIdx) out += "ː";
            } else out += u.cons.ph;
            prevCons = u.cons.ph;
            prevCyr = u.cyr;
            continue;
        }
        if (u.vowel) {
            if (u.vowel.glide) out += "j";
            if (i === stressPos && nVowels > 1) out += "ˈ";
            out += u.vowel.ph;
            prevCons = "";
            prevCyr = "";
        }
    }
    return out;
}
