/**
 * Native Bishnupriya Manipuri / বিষ্ণুপ্রিয়া মণিপুরী (bpy) text phonemizer — canonical IPA.
 * Eastern Indo-Aryan, Bengali / Eastern-Nagari script (~120k, Assam/Tripura + Sylhet). Reuses the Bengali engine
 * (makeNativeBengali — the generic abugida scan + inherent-vowel deletion + geminate→length) with a Bishnupriya
 * manifest whose phoneme values are BENGALI (the ʃ sibilants, the retroflex/dental split, the affricates — the
 * referee is Bengali-like, not Assamese-like). The one divergence encoded in the manifest is heightHarmony:false
 * (no ɔ→o raising). Because the phoneme inventory is exactly Bengali's, the Bengali engine's own geminate→length
 * pass already covers it — no extra wrapper pass is needed (unlike Assamese's deaffricated t/d/s/z/x).
 */
import {
    makeNativeBengali,
    type BengaliDef,
    type ForeignPhonemizer,
} from "../bengali/bengali.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

/** Load bishnupriya.jsonc (beside this file) and build the Bishnupriya phonemizer. `foreign` handles embedded Latin. */
export function createBishnupriya(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "bishnupriya.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

let BPY: ReturnType<typeof makeNativeBengali> | undefined;
/** Bare word→IPA (tests / eval). */
export function phonemizeWord(w: string): string {
    return (BPY ??= makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "bishnupriya.jsonc"),
    )).word(w);
}
