/**
 * Loads the Ewe data manifest (ewe.jsonc) once and exposes it typed.
 *
 * Ewe (Eʋegbe) is a Gbe language (Niger-Congo, Kwa) of Ghana and Togo written in the Latin-based African
 * alphabet with ⟨ɖ ƒ ʋ ɣ ŋ ɔ ɛ⟩ and the labial-velars ⟨gb kp⟩. The orthography is near-phonemic, so these
 * two tables carry almost the whole g2p and only three things are contextual — the ⟨r⟩ [l]~[r] split, the
 * ⟨w⟩ [w]/[ɰ] rounding rule and the nasalization tilde — all of which live in Ewe.cs.
 *
 * Ported from src/languages/ewe/ewe.ts's `EweDef` — see ewe.jsonc for the referee note.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ewe;

public sealed record EweDef
{
    /** Multi-letter units, longest-match first: ⟨gb kp⟩ labial-velars, ⟨dz ts⟩ affricates, ⟨ny⟩→ɲ. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();

    /** Single letters. ⚠ The ⟨r⟩ and ⟨w⟩ rows are the DEFAULTS ONLY — both letters are claimed by a
     *  context rule in Ewe.cs before this table is consulted. ⟨ñ⟩ has its own row so the marked-base branch
     *  cannot read it as plain /n/; see the jsonc. */
    public IReadOnlyDictionary<string, string> Letters { get; init; } = new Dictionary<string, string>();
}

public static class Manifest
{
    public static readonly EweDef MANIFEST = LoadManifest.Load<EweDef>("languages/ewe", "ewe.jsonc");
}
