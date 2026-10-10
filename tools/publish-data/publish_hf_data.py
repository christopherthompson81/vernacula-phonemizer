#!/usr/bin/env python3
"""Publish the `data/` tree to the Hugging Face model repo that binaries download it from.

The repo mirrors `data/` exactly: a data KEY (`languages/english/g2p-dict.tsv`) is the repo PATH, so a
consumer's DataSource maps keys to `hf_hub_download(repo, key, revision=TAG)` with no translation. Each
publish is tagged with the phonemizer git commit's short hash, so a crate pinned at git `rev = "5acc6b73"`
reads data tagged `5acc6b73`, the same string on both sides.

    python3 -I tools/publish-data/publish_hf_data.py [--rev REV]            # dry run (the default)
    python3 -I tools/publish-data/publish_hf_data.py --rev 5acc6b73 --publish [--create]

--publish needs `huggingface_hub` (pip install huggingface_hub) and a login (`hf auth login`); the dry
run needs neither.

What it guarantees:
  * The bytes come from `git archive REV`, never the working tree, so a tag means exactly that commit.
  * The licensing files travel with the data (`LICENSE`, `LICENSES/`, `NOTICE.md`, the `*.PROVENANCE.md`
    sidecars). The publish REFUSES if any is missing, because CC-BY / CC-BY-SA / GPL redistribution and the
    Sindhi Open Lexicon's mandatory attribution all depend on them (LICENSES/PROVENANCE.md).
  * Tags are immutable: an existing tag is refused, never moved.
  * After the upload, every file at the tag is checked against the export: the path set, then the git blob
    id for plain files or the LFS sha256 for LFS ones. Any mismatch fails the run.
"""

import argparse
import hashlib
import os
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

DEFAULT_REPO = "christopherthompson81/vernacula-phonemizer-data"
LICENCE_SET = ["LICENSE", "NOTICE.md", "LICENSES"]
REQUIRED = ["LICENSE", "LICENSES/PROVENANCE.md", "NOTICE.md"]
SHORT_LEN = 8


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout.strip()


def export_data(rev: str, dest: Path) -> Path:
    """`git archive REV data` plus the root licence set, unpacked into dest; returns dest/data.

    The licence set is gitignored under data/ and copied in at `npm pack` time from the repo root
    (tools/pack-data-licenses.mjs: one source of truth). This does the same copy, from the same commit,
    so the Hub tree is the npm data package's tree.
    """
    archive = dest / "data.tar"
    with open(archive, "wb") as out:
        subprocess.run(["git", "archive", "--format=tar", rev, "data", *LICENCE_SET], check=True, stdout=out)
    with tarfile.open(archive) as tar:
        tar.extractall(dest, filter="data")
    archive.unlink()
    for name in LICENCE_SET:
        (dest / name).rename(dest / "data" / name)
    return dest / "data"


def git_blob_id(path: Path) -> str:
    """The git blob sha1 (what the Hub reports as `blob_id` for a non-LFS file)."""
    data = path.read_bytes()
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def card(repo: str, full: str, short: str) -> str:
    # The Hub validates license_link as an https URI, so a relative path is refused at upload.
    return f"""---
license: other
license_name: per-file
license_link: https://huggingface.co/{repo}/blob/{short}/LICENSES/PROVENANCE.md
tags:
  - phonemizer
  - g2p
  - ipa
---

# vernacula-phonemizer data

The data tree read at runtime by [vernacula-phonemizer](https://github.com/christopherthompson81/vernacula-phonemizer)
(the TypeScript, C# and Rust engines): lexicons, rule tables, manifests and int8 ONNX models. A data key
such as `languages/english/g2p-dict.tsv` is a path in this repo.

This revision is tag `{short}`, built from phonemizer commit `{full}`. Pin the same tag as the engine's
git revision.

## Licensing

There is **no single license**. The project's own work is MIT ([`LICENSE`](LICENSE)). Third-party-derived
files keep their parent license (CC0, CC-BY, CC-BY-SA, GPL-3.0 and two bespoke licenses), declared per file
in [`LICENSES/PROVENANCE.md`](LICENSES/PROVENANCE.md) and the `*.PROVENANCE.md` sidecars. The full license
texts are in [`LICENSES/`](LICENSES/), and the attribution roll-up, including attributions that are
**mandatory**, is [`NOTICE.md`](NOTICE.md). Redistributing these files means honouring those per-file terms.

### Attributions required by name

> This package uses the JMdict/EDICT and KANJIDIC dictionary files. These files are the property of
> the Electronic Dictionary Research and Development Group, and are used in conformance with the
> Group's licence.

(`languages/japanese/readings.tsv`, `fallback.tsv`, `adverbs.txt`; © EDRDG, CC-BY-SA 4.0,
<https://www.edrdg.org/edrdg/licence.html>.)

The Sindhi Open Lexicon: **SindhiLanguage.org** (<https://sindhilanguage.org/>), prepared and curated by
**Amar Fayaz Buriro (امر فياض ٻرڙو)**. Behind `languages/sindhi/sindhi-lexicon.tsv` and
`languages/sindhi/sd-g2p-tagger.int8.onnx`; terms in `LICENSES/LicenseRef-SindhiOpenLexicon.txt`.
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rev", default="HEAD", help="git revision whose data/ to publish (default HEAD)")
    ap.add_argument("--repo", default=DEFAULT_REPO)
    ap.add_argument("--publish", action="store_true", help="actually upload and tag (default: dry run)")
    ap.add_argument("--create", action="store_true", help="create the Hub repo if it does not exist")
    ap.add_argument("--private", action="store_true", help="with --create: make the repo private")
    args = ap.parse_args()

    full = git("rev-parse", "--verify", f"{args.rev}^{{commit}}")
    short = full[:SHORT_LEN]
    with tempfile.TemporaryDirectory(prefix="vp-data-") as tmp:
        data = export_data(full, Path(tmp))
        missing = [r for r in REQUIRED if not (data / r).exists()]
        if missing:
            print(f"REFUSED: {full} data/ lacks {missing}; the licensing files must ship with the data.")
            return 2
        (data / "README.md").write_text(card(args.repo, full, short), encoding="utf-8")
        files = sorted(p for p in data.rglob("*") if p.is_file())
        total = sum(p.stat().st_size for p in files)
        print(f"rev {full} → tag {short}; repo {args.repo}")
        print(f"{len(files)} files, {total / 1e6:.1f} MB (README.md card added)")
        for p in sorted(files, key=lambda p: -p.stat().st_size)[:5]:
            print(f"  {p.stat().st_size / 1e6:7.1f} MB  {p.relative_to(data)}")
        if not args.publish:
            print("dry run: nothing uploaded. Re-run with --publish (and --create for the first publish).")
            return 0

        from huggingface_hub import HfApi
        from huggingface_hub.utils import RepositoryNotFoundError

        api = HfApi()
        try:
            api.repo_info(args.repo, repo_type="model")
        except RepositoryNotFoundError:
            if not args.create:
                print(f"REFUSED: {args.repo} does not exist; pass --create to create it.")
                return 2
            api.create_repo(args.repo, repo_type="model", private=args.private)
            print(f"created {args.repo} ({'private' if args.private else 'public'})")
        if short in {t.name for t in api.list_repo_refs(args.repo, repo_type="model").tags}:
            print(f"REFUSED: tag {short} already exists on {args.repo}; tags are never moved.")
            return 2

        commit = api.upload_folder(
            repo_id=args.repo,
            repo_type="model",
            folder_path=str(data),
            commit_message=f"data at vernacula-phonemizer {short}",
            commit_description=f"git archive {full} data",
            delete_patterns="*",  # mirror: a file removed from data/ is removed here too
        )
        api.create_tag(args.repo, repo_type="model", tag=short, revision=commit.oid,
                       tag_message=f"vernacula-phonemizer {full}")
        print(f"uploaded commit {commit.oid}, tagged {short}")

        # Verify the tag against the export, file by file.
        remote = {e.path: e for e in api.list_repo_tree(args.repo, repo_type="model", revision=short,
                                                        recursive=True)
                  if getattr(e, "size", None) is not None}
        local = {str(p.relative_to(data)).replace(os.sep, "/"): p for p in files}
        remote.pop(".gitattributes", None)  # the Hub keeps its own; upload_folder never deletes it
        bad = sorted(set(local) ^ set(remote))
        for path, p in local.items():
            e = remote.get(path)
            if e is None:
                continue
            ok = (e.lfs.sha256 == sha256(p)) if e.lfs else (e.blob_id == git_blob_id(p))
            if not ok:
                bad.append(path)
        if bad:
            print(f"VERIFY FAILED: {len(bad)} paths differ, e.g. {bad[:10]}")
            return 1
        print(f"verified: {len(local)} files at tag {short} match git {full}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
