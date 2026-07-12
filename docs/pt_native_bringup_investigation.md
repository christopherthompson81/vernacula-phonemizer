# Portuguese (pt) native bring-up

Target: **European Portuguese (pt-PT)**, canonical IPA, espeak-independent. Slot #7 in the OmniVoice minimal
coverage set (contributes the primitives `ɨ`, `́`, `̂`). Architecture follows the Spanish model — a rule-based
grapheme→phoneme scan producing a `Seg` list, then a stress pass, then (the Portuguese-specific part) a vowel-
REDUCTION pass. No lexicon at first; add one only if the residual is genuinely lexical (as French needed).

## Convention (the canonical target)
Portuguese orthography is shallower than French but has two hard, partly-lexical axes: (1) stressed mid-vowel
QUALITY (open ɛ/ɔ vs close e/o), disambiguated by the written accents é/ê ó/ô but ambiguous on bare e/o; and
(2) grapheme `x` (ʃ/z/ks/s). Both are deferred to a lexical layer if needed.

Vowels — stressed: a→a, â→ɐ, é→ɛ, ê→e, í→i, ó→ɔ, ô→o, ú→u; bare stressed e→e, o→o (close default).
Vowel REDUCTION (the EP signature) — unstressed: a→ɐ, e→ɨ, o→u; i/u unchanged. Applies pretonic AND final.
Nasals: ã→ɐ̃, õ→õ; V+m/n before C or word-end → nasal vowel (consonant absorbed); V+m/n+V → oral + consonant.
Nasal diphthongs: ão→ɐ̃w̃, ãe→ɐ̃j̃, õe→õj̃; final -m → nasalize (bom→bõ, sim→sĩ).
Consonants: ç→s, ch→ʃ, lh→ʎ, nh→ɲ, j→ʒ, c/g soften before e/i (s, ʒ), qu/gu→k/ɡ before e/i; h silent.
r: intervocalic single →ɾ; initial / rr / after n,l,s →ʁ. s: initial→s, intervocalic→z, coda→ʃ (voiceless) / ʒ.
l: onset→l, coda→ɫ (velarized). x: default→ʃ (ks/z/s lexical, deferred).

Stress (when no written accent): oxytone (final nucleus) if the word — ignoring a final -s — ends in
r/l/z/x, i/u, or a nasal (-im/-um, ão/ãe/õe); else paroxytone (penult). Written accent overrides.

## Run 1 — scaffold + first g2p
(in progress)
Referee: espeak-ng pt shim (../espeak-ng-portable/tools/espeak-ng -v pt) as a REGRESSION guard only — its
convention differs (no e→ɨ pretonic reduction: pequeno→pekˈenʊ not pɨkˈenu; final o→ʊ not u). Canonical target
is standard EP. An independent referee (wikipron por) to be wired before any "verified" claim.

### Run 1 result — core engine (Phase 1)
Built src/languages/portuguese/{g2p,portuguese,numbers}.ts + registered `pt`. Scan → stress → reduction →
sibilants. Compared word-for-word against the espeak pt shim on a 30-word probe; after four bug fixes the
regular vocabulary matches (modulo espeak's convention: final -o = ʊ not our standard u, and secondary stress
ˌ which we omit).

Bugs found & fixed this run:
 - ç / soft-c / ss wrongly voiced to z intervocalically (coração→...z, você→vuz, difícil→...ziɫ). Only a single
   `s` letter voices — marked voiceable via raw="s"; ç/soft-c/ss are fixed /s/.
 - nh digraph's n was eaten by the nasalization look-ahead → ɲ dropped (senhora→sẽoɾɐ). nasalizedHere now
   excludes n-before-h. → sɨɲˈoɾɐ.
 - final -am/-em produced a bare nasal vowel; EP wants the diphthongs ɐ̃w̃ / ɐ̃j̃ (falam→fˈalɐ̃w̃, homem→ˈomɐ̃j̃,
   também→tɐ̃bˈɐ̃j̃). Pushed as manual segs so the accent flag tracks the source vowel (unstressed -am vs
   stressed -ém).
 - (numbers) cem→sˈɐ̃j̃, mil e quinhentos, milhão all correct; "e" connector per EP convention.

DEFERRED (the lexical residuals, mirroring French's Phase 2 need):
 - stressed mid-vowel QUALITY: bare stressed e/o default to close e/o; open ɛ/ɔ (rosa→ʁˈɔzɐ, dorme→dˈɔɾmɨ) is
   lexical (é/ê ó/ô disambiguate when written). Needs a pronunciation lexicon.
 - grapheme x: default ʃ; z/ks/s (exame→izˈɐmɨ, táxi→ks, próximo→s) are lexical.
 - word-initial unstressed e before s+C: we keep ɨʃ- (estudante→ɨʃtudˈɐ̃tɨ); native EP deletes it (ʃtudɐ̃tɨ).
   The careful-register ɨ is arguably more explicit; revisit with the lexicon/register decision.

NEXT: wire an INDEPENDENT referee (wikipron por / kaikki) — the espeak shim is only a regression guard, not a
canonical oracle — then decide the lexicon (open/close vowels + x) as Phase 2, as with French.

### Run 1 review fixes
Adversarial review of the new engine found three concrete bugs, all fixed:
 - numbers: the millions branch never emitted the "e" connector (1000001 → "um milhão um"). Applied the same
   connector rule as thousands (r<100 or round → "e"): "um milhão e um", "um milhão e quinhentos mil".
 - stress: -ins/-uns plurals (jardins, atuns) were mis-stressed as paroxytone — the oxytone test stripped only a
   final -s, leaving -in/-un which /[iu]m$/ never matched. Widened to /[iu][mn]$/ → jardins ʒɐɾdˈĩʃ.
 - offglide over-applied to unaccented hiatus (raiz→ʁajʃ, sair→sajɾ), collapsing a nucleus and misplacing
   stress. Added a hiatus guard: a post-vocalic i/u followed by a FINAL consonant other than s is a stressed
   nucleus (raiz→ʁɐˈiʃ, sair→sɐˈiɾ, possuir→pusuˈiɾ), while mais/dois/baixo keep the diphthong. The residual
   mais-vs-raiz ambiguity (both final-s) is lexical.

## Run 2 — referee wired + rule-gap fixes
Referee: wikipron European Portuguese (por_latn_po_broad_filtered, ~38k entries after dedup) via
tools/pt-ref-sweep.mts. wikipron omits stress and coda-l velarization → normalized away (strip ˈ, ɫ→l) to
compare SEGMENTS. It also carries two conventions that differ from standard Lisbon EP and are NOT our errors —
betacism (intervocalic v→b) and the conservative affricate ch→t͡ʃ — folded (v↔b, t͡ʃ↔ʃ) for a "folded" metric.

The referee revealed real RULE gaps beyond the deferred lexical axes. Fixed this run:
 - ONGLIDE: an unstressed high/mid vowel (i/u/e) before another nucleus is a rising glide (história→iʃtɔɾjɐ,
   água→aɡwɐ, leonardo→ljunaɾdu) — done as a POST-stress demotion pass (stress settled first: dia→diɐ keeps the
   nucleus, diamante→djɐmɐ̃tɨ glides). Guard: a high vowel after an obstruent+liquid onset cluster stays a
   nucleus (criança→kɾiɐ̃sɐ). o-onglide left out (moeda→muedɐ, not mwedɐ).
 - ou → monophthong [o] (souto→sotu, amou→ɐmo), and the ou-derived o does NOT reduce (ouvir→oviɾ).
 - a diphthong nucleus (vowel + offglide) is not reduced (ceilão→sejlɐ̃w̃, was ...ɨj).
 - s does not voice after a nasal vowel — the absorbed coda n precedes it (sansão→sɐ̃sɐ̃w̃).

Scores (segment-level vs wikipron EP): proper-noun-heavy uniform sample 47.9%→59.1% raw / 67.2% folded;
FREQUENCY-common words 64.5% raw / 72.7% folded. The proper-noun sample is deflated by foreign names that
resist reduction (Holanda→ɔlɐ̃dɐ, Belarus→bɛlɐɾuʃ).

REMAINING folded residual on common words is now dominated by the LEXICAL open/close axis:
 - «e»≠«ɛ» (ela→ɛlɐ), «o»≠«ɔ» (agora→ɐɡɔɾɐ) — stressed mid-vowel quality, ~8% of tokens. THE lexicon target.
 - convention choices wikipron makes: word-initial pretonic e→i (está→iʃta, we give ɨʃta), initial o→ɔ (olá),
   final -ei→e. To be decided (adopt vs keep) alongside the lexicon.
NEXT (Phase 2 lexicon): resolve stressed open/close e/o + grapheme x. NOTE the design constraint — wikipron
can't be used RAW as the lexicon (betacism injects b-for-v; ch→t͡ʃ). Either de-affricate + extract only the
open/close & x decisions as corrections to the engine, or de-betacize carefully.
