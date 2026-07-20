# Magahi (mag) native bring-up — from alias to bespoke

Magahi / मगही (mag) — Indo-Aryan (Bihari, Magadhan group), Devanagari; ~14M, Bihar. Sibling of Bhojpuri (bho).

## Run 1 — aliased to Bhojpuri (no verifiable delta at the time)

Magahi has no usable machine referee (kaikki = 2 IPA entries; no wikipron/epitran) and the first source consulted
(Priya 2020, a morphophonology paper) gave no confidently-encodable segmental delta from Bhojpuri — it even shares
Bhojpuri's श→s. So, per the belt policy, `mag` was routed through `bho` as a labelled approximation (served_by='bho')
rather than an invented clone.

## Run 2 — the Bhojpuri revision + a comparative reference → bespoke

Two things changed. First, Bhojpuri itself was **revised** from a reference grammar (no vowel length, ऐ→ɛ/औ→ɔ
monophthongs, व→w), which the alias inherited. The user then asked the right question — *is mag→bho still correct?* —
and supplied **Vinod Kumar (2026), "A Comparative Phonological Study of Bihari Languages"**, which compares Magahi
and Bhojpuri directly. It confirms the alias survives the shared axes but reveals a real divergence:

**Shared (alias-safe):** both Bihari languages have *no phonemic vowel length*, a *single sibilant /s/* (श/ष→s),
the four-way stop contrast, and the retroflex/dental contrast (§6.1).

**The Magahi delta (§6.2 "Glide treatment": Magahi *Replaced* vs Bhojpuri *Mostly preserved*):** Magahi hardens
its **word-initial glides** — व→**[b]** (वंश→bans) and य→**[d͡ʒ]** (यन्त्र→jantar) — where Bhojpuri preserves them
(व→w, य→j). Magahi also has only 2 phonemic nasals (/m n/, no /ŋ/) and lacks Bhojpuri's aspirated sonorants
(mh/nh/rh/lh).

Because there is now a **documented, sourced delta**, Magahi earns a **bespoke module** (the belt policy: bespoke
when the delta is verifiable/documented, else alias). `magahi.jsonc` = the Bhojpuri data file + the glide hardening
(व→b, य→d͡ʒ); `magahi.ts` reuses the same makeNativeHindi engine. वंश→bə̃s, यंत्र→d͡ʒə̃n̪t̪ɾ, while देश→des and बैल→bɛl
stay identical to Bhojpuri.

## Verdict: 🔷 single-source

The glide-hardening delta is documented in one published comparative study (with examples वंश→bans, यन्त्र→jantar),
on the grammar-anchored Bhojpuri base. No machine referee. Gold: `test/magahi.test.ts`. Deferred residual: the
/ŋ/→n merger and the ऐ/औ analysis (the comparative study calls them Magahi diphthongs from vowel clusters, vs the
letter ऐ→ɛ inherited from Bhojpuri — a letter-vs-cluster ambiguity left as the Bhojpuri value).
