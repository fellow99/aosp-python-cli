# aosp-python-cli

[English](README.md) · [**中文**](README_zh.md)

**以 AAR 形式发布的、Android 版 `python` 命令行可执行**——一份基于 **PEP 738**（CPython 3.13+
官方 Android 支持）交叉编译的 `libpython_cli.so`（arm64-v8a，exec 型 PIE），扩展模块**全部静态
链入**，随包 assets 携带纯 Python stdlib + ensurepip + CA bundle。终端里由 node-pty 经
`forkpty` + `execve` 启动，提供真正的 `python` / `pip` 命令。

本仓库**不含任何嵌入 API**——只有原生二进制与随包数据的可复现构建、ELF 门禁与发布流水线。
规划基线见 [`docs/000-工程规划.md`](docs/000-工程规划.md)；工作区级方案背景见
node-bridge-workspace 的 `docs/aosp+node+python+git运行方案.md`。

## 版本：跟随 CPython 上游（独立 semver）

制品版本 = CPython 版本。与其它仓**无配对关系**（无 NODE_MODULE_VERSION 约束）。

> ⚠️ **只发布 AArch64（arm64-v8a）一个架构**。

### 发布版本 —— Maven Central（`io.github.fellow99:python-cli`）

| 版本 | 状态 | 链接 |
|---|---|---|
| 3.14.0 | ⬜ draft（M1 首产后发布；以 CI 实际钉住的 CPython 版本为准） | — |

## 关键架构决策：扩展模块静态化

targetSdk≥29 的 SELinux 禁止从应用可写数据目录 `dlopen`——动态扩展 `.so` 若随 stdlib 落在
filesDir 会全部无法加载。因此本仓的 python 构建**必须**全静态扩展（`Modules/Setup.local`
的 `*static*`）：一个可执行 + 纯数据 stdlib，全程不触碰 dlopen 禁令。

## 用法（消费方）

```kotlin
dependencies {
    runtimeOnly("io.github.fellow99:python-cli:3.14.0") // 独立版本，不与 node 系配对
}
```

终端侧：`PATH` 指向 `nativeLibraryDir` 后，`pty.spawn(`${nativeLibraryDir}/libpython_cli.so`, …)`；
`PYTHONHOME`/`PYTHONPATH`/`SSL_CERT_FILE` 由环境引导层注入（物化后的 stdlib 与 CA 路径）。

## exec 型打包要点

- **`useLegacyPackaging=true`**（必须物理落盘 `nativeLibraryDir`，否则 `execve` ENOENT）；
- PT_INTERP 必须为 `/system/bin/linker64`（门禁强制）；
- DT_NEEDED 白名单（仅系统库）；16KB 页对齐。

## AAR 内容

```
jni/arm64-v8a/libpython_cli.so    # python 命令行（exec 型 PIE，静态扩展，16KB 对齐）
assets/python-bridge-tools/Lib/       # 纯 Python stdlib（M1 投放）
assets/python-bridge-tools/ensurepip/ # pip wheels（M1 投放）
assets/python-bridge-tools/cacert.pem # CA bundle（M1 投放）
```

## 如何构建（000-scaffold 骨架；M1 接入真实交叉编译）

```bash
node scripts/fetch-python-cli-source.mjs --python 3.14.0 --out .dist/src   # M1
bash scripts/build-python-cli-android.sh --python 3.14.0 --api 24 \
  --src .dist/src/cpython --ndk "$ANDROID_NDK_HOME" --out build/out        # M1
node tools/provision.mjs --out python-cli/src/main/jniLibs --from build/out/libpython_cli.so
node tools/provision.mjs --check
```

## 锁定与校验

[`python-cli.lock.json`](python-cli.lock.json)（唯一事实源，当前 draft）。退出码：`0` 全过 ·
`2` 门禁不合格/未投放 · `1` 用法/IO 错误。门禁：ET_DYN（PIE）、PT_INTERP=系统 linker64、
AArch64、DT_NEEDED 白名单、16KB 对齐、sha/size。
## 能力边界 / 已知限制

以下均为**实测事实**（来源：[`docs/20261105-cli-实测问题-修复设计.md`](https://github.com/fellow99/node-bridge-workspace/blob/main/docs/20261105-cli-实测问题-修复设计.md)（父仓 workspace docs/，本子仓 docs/ 无此文）
§4.3 能力边界披露口径；叠加规划 §7 已知限制），消费方集成前必须知悉：

- **sdist 不可设备编译**：设备无编译器，且静态解释器不能加载新 `.so`——pip/uv 均无法在设备
  上编译源码分发版；含 C/Rust 扩展的包是否可装取决于是否恰好有现成的 android arm64 wheel，
  现状≈不可装。
- **`python -m venv` / `uv` 依赖环境引导层**：CPython venv 把 `pyvenv.cfg home` 写成**解释器
  软链所在目录**（无 stdlib）→ venv 解释器找不到 stdlib；`uv` 建环境还写死**符号解析后**的
  realpath home（uv 自身缺陷）。**当前裸执行不保证**，须由环境引导层（dsh-desktop-android）
  构造自洽 prefix 并覆写 `home` 自愈（修复设计 §4.2 C1）。
- **venv 自愈**：覆写 `home` 指向**含 stdlib 的 prefix** 后，`.venv/bin/python -m ensurepip`
  可成功安装 pip（修复设计 §2.2 实证）。
- **pip 安装的 CLI 脚本落 filesDir 不可直接 exec**（SELinux，规划 §7 已知限制）——须以
  `python -m <mod>` 或 pip 内部机制调用。

## 许可

[MIT](LICENSE)。CPython 适用 PSF-2.0——见
[`python-cli/THIRD-PARTY-NOTICES.md`](python-cli/THIRD-PARTY-NOTICES.md)。
