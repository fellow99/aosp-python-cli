# aosp-python-cli

[English](README.md) · [**中文**](README_zh.md)

**The Android `python` command-line executable, packaged as an AAR** — a `libpython_cli.so`
(arm64-v8a, exec-form PIE) cross-compiled via **PEP 738** (CPython 3.13+ official Android
support) with **all extension modules statically linked**, plus bundled assets carrying the
pure-Python stdlib + ensurepip + CA bundle. Launched from the terminal by node-pty via
`forkpty` + `execve`, providing real `python` / `pip` commands.

This repository contains **no embedding API** — only the reproducible build, ELF gates and
release pipeline for the native binary and its bundled data. Planning baseline:
[`docs/000-工程规划.md`](docs/000-工程规划.md); workspace-level rationale: the
node-bridge-workspace doc `docs/aosp+node+python+git运行方案.md`.

## Version: follows upstream CPython (independent semver)

The artifact version = the CPython version. **No pairing** with other repos (no
NODE_MODULE_VERSION constraint).

> ⚠️ **AArch64 (arm64-v8a) only**.

### Releases — Maven Central (`io.github.fellow99:python-cli`)

| Version | Status | Link |
|---|---|---|
| 3.14.0 | ⬜ draft (after the first M1 build; the CI-pinned CPython version prevails) | — |

## Key architectural decision: static extension modules

SELinux forbids `dlopen` from app-writable data dirs for targetSdk≥29 — dynamically loaded
extension `.so` files shipped alongside the stdlib in filesDir would all fail to load.
Therefore the python build here **must** link all extensions statically
(`*static*` in `Modules/Setup.local`): one executable + pure-data stdlib, never touching
the dlopen prohibition.

## Usage (consumers)

```kotlin
dependencies {
    runtimeOnly("io.github.fellow99:python-cli:3.14.0") // independent version, not paired with the node family
}
```

Terminal side: with `PATH` pointing at `nativeLibraryDir`,
`pty.spawn(`${nativeLibraryDir}/libpython_cli.so`, …)`; `PYTHONHOME`/`PYTHONPATH`/
`SSL_CERT_FILE` are injected by the environment bootstrap layer (materialized stdlib and CA
paths).

## Exec-form packaging points

- **`useLegacyPackaging=true`** (must be physically extracted to `nativeLibraryDir`,
  otherwise `execve` ENOENT);
- PT_INTERP must be `/system/bin/linker64` (hard gate);
- DT_NEEDED whitelist (system libs only); 16KB page alignment.

## AAR contents

```
jni/arm64-v8a/libpython_cli.so    # python CLI (exec-form PIE, static extensions, 16KB aligned)
assets/python-bridge-tools/Lib/       # pure-Python stdlib (provisioned in M1)
assets/python-bridge-tools/ensurepip/ # pip wheels (provisioned in M1)
assets/python-bridge-tools/cacert.pem # CA bundle (provisioned in M1)
```

## How to build (000-scaffold skeleton; real pipeline lands in M1)

```bash
node scripts/fetch-python-cli-source.mjs --python 3.14.0 --out .dist/src   # M1
bash scripts/build-python-cli-android.sh --python 3.14.0 --api 24 \
  --src .dist/src/cpython --ndk "$ANDROID_NDK_HOME" --out build/out        # M1
node tools/provision.mjs --out python-cli/src/main/jniLibs --from build/out/libpython_cli.so
node tools/provision.mjs --check
```

## Lock & verification

[`python-cli.lock.json`](python-cli.lock.json) (single source of truth, currently draft).
Exit codes: `0` pass · `2` gate failure / not provisioned · `1` usage/IO error. Gates:
ET_DYN (PIE), PT_INTERP=system linker64, AArch64, DT_NEEDED whitelist, 16KB alignment,
sha/size.

## License

[MIT](LICENSE). CPython is PSF-2.0 — see
[`python-cli/THIRD-PARTY-NOTICES.md`](python-cli/THIRD-PARTY-NOTICES.md).
