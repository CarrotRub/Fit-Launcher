# Verifying Fit Launcher Downloads

Every installer on the [release page](https://github.com/CarrotRub/Fit-Launcher/releases) comes with a matching `.sig` file. This guide explains what those files are and how to use them to check that the file you downloaded is the one the Fit Launcher release pipeline signed.

---

## 1. What is the `.sig` file?

The `.sig` files are **not GPG/PGP signatures**, so `gpg --verify` will not work on them.

They are [minisign](https://jedisct1.github.io/minisign/) signatures produced by the [Tauri updater](https://v2.tauri.app/plugin/updater/) when the release is built. Tauri stores the whole minisign signature file **base64-encoded on a single line**. Once decoded, it is a normal `.minisig` file:

```
untrusted comment: signature from tauri secret key
RUQbljnjCRCc1vdTLa9N9HBwsE1S9juExSx7o6kdI5VrBR7kC5QjyWafCLI1FHTcitnm/QDAIIO/vcvr4L92PULzWonHNb8ioQE=
trusted comment: timestamp:1775471303	file:Fit Launcher_4.2.0_x64_en-US.msi
FTL0gkzAYmDiHQG2O0zl5bwp5WZ+De+tdpceCgPTIbLIJ/zgz4kuNGcVc84eD+DBJZxXI2Y4ZeO8/ZJcjjixBQ==
```

- **Line 1**: untrusted comment, not covered by the signature. Ignore it.
- **Line 2**: the signature itself (Ed25519 over the BLAKE2b-512 hash of the file) and the ID of the key that made it.
- **Line 3**: trusted comment, signed. It contains the signing timestamp and the original file name.
- **Line 4**: global signature, covering line 2 and the trusted comment.

These are the same signatures the launcher's auto-updater checks before installing an update.

---

## 2. The public key

The public key is [`minisign.pub`](../minisign.pub) at the root of this repository:

```
untrusted comment: minisign public key: D69C1009E339961B
RWQbljnjCRCc1l1GVCmH6uQkrUeZlhho2mu/B+nKp0XJqOPqrEb7j6E3
```

It is the decoded form of `plugins.updater.pubkey` in [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json), which is the key the auto-updater trusts. You can check that they match:

```bash
grep -o '"pubkey": "[^"]*"' src-tauri/tauri.conf.json | cut -d'"' -f4 | base64 -d | diff - minisign.pub && echo "keys match"
```

You can either download `minisign.pub` and pass it with `-p minisign.pub`, or pass the key directly with `-P RWQbljnjCRCc1l1GVCmH6uQkrUeZlhho2mu/B+nKp0XJqOPqrEb7j6E3`.

> [!NOTE]
> If you pass neither `-p` nor `-P`, minisign looks for `./minisign.pub` in the current directory and fails with `minisign.pub: No such file or directory`.

---

## 3. Installing minisign

- **Linux**: install the `minisign` package from your distribution (`apt install minisign`, `dnf install minisign`, `pacman -S minisign`, ...).
- **macOS**: `brew install minisign`
- **Windows**: any of
  - `winget install jedisct1.minisign`
  - `scoop install minisign`
  - `mise use -g minisign`
  - or download the binary from the [minisign releases](https://github.com/jedisct1/minisign/releases).

---

## 4. Verifying a file

Put the installer and its `.sig` file in the same folder, for example `Fit.Launcher_4.2.0_x64_en-US.msi` and `Fit.Launcher_4.2.0_x64_en-US.msi.sig`.

### Linux / macOS / Git Bash / MSYS2

```bash
# 1. Decode the Tauri .sig into a regular minisign signature
base64 -d Fit.Launcher_4.2.0_x64_en-US.msi.sig > Fit.Launcher_4.2.0_x64_en-US.msi.minisig

# 2. Verify it
minisign -Vm Fit.Launcher_4.2.0_x64_en-US.msi \
  -x Fit.Launcher_4.2.0_x64_en-US.msi.minisig \
  -P RWQbljnjCRCc1l1GVCmH6uQkrUeZlhho2mu/B+nKp0XJqOPqrEb7j6E3
```

On macOS versions older than Ventura, use `base64 -D` instead of `base64 -d`.

### Windows (PowerShell)

```powershell
# 1. Decode the Tauri .sig into a regular minisign signature
$sig = "Fit.Launcher_4.2.0_x64_en-US.msi.sig"
[IO.File]::WriteAllBytes("$PWD\$($sig -replace '\.sig$', '.minisig')", [Convert]::FromBase64String((Get-Content $sig -Raw).Trim()))

# 2. Verify it
minisign -Vm Fit.Launcher_4.2.0_x64_en-US.msi -x Fit.Launcher_4.2.0_x64_en-US.msi.minisig -P RWQbljnjCRCc1l1GVCmH6uQkrUeZlhho2mu/B+nKp0XJqOPqrEb7j6E3
```

---

## 5. Reading the result

A valid file prints:

```
Signature and comment signature verified
Trusted comment: timestamp:1775471303	file:Fit Launcher_4.2.0_x64_en-US.msi
```

- `Signature and comment signature verified` means the file was not modified after it was signed, and the trusted comment was not tampered with either.
- `file:` is the name the file had when it was built. GitHub replaces spaces with dots in asset names, so `Fit Launcher_4.2.0_...` and `Fit.Launcher_4.2.0_...` are the same file. Make sure the version and type (`.msi`, `-setup.exe`, ...) match what you downloaded.
- `timestamp:` is the Unix time of signing (`date -u -d @1775471303` on Linux, `[DateTimeOffset]::FromUnixTimeSeconds(1775471303)` in PowerShell). It should be close to the release date.

If the file was modified, minisign prints `Signature verification failed`. If it was signed with another key, it prints `Signature key id in <file> is <id> but the key id in the public key is D69C1009E339961B`. In both cases it exits with a non-zero code. **Do not run the file in that case.**

---

## 6. What this does and does not prove

The public key lives in the same repository that publishes the releases. A successful verification proves that the file was signed by whoever holds the release signing key used by this project's CI, and that it is a file the launcher's auto-updater would accept. It is not an independent identity check: if someone controlled both this repository and the signing key, they could replace both. Comparing the key with an earlier copy (for example an older release's `tauri.conf.json`) helps detect a key change.
