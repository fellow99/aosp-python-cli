# ARCHITECTURE.md —— `aosp-python-cli` 整体架构（as-built + 规划标注）

> **性质**：项目级架构规格。回答「制品长什么样、门禁怎么拦、数据怎么流、发布怎么走、和消费方怎么分界」。
> **依据**：`specs/constitution.md`（C1–C8）· `../docs/000-工程规划.md`（唯一规划基线 v2.1，下称「规划 §」）· 源码 ✅实测（行号取 2026-11-02 快照）。
> **标记**：✅已实现（M0，实测可复核）/ ⬜规划（M1+，仅规划引用，**不是现状**）/ ⚠️风险或不一致。
> **版本**：v1.0 · 2026-11-02 · 状态：**M0 脚手架已建成**；`libpython_cli.so` 本体尚未构建（M1 ⬜）。

---

## ① 整体架构图（host 侧工具链 → AAR 制品 → 设备侧运行）

```
┌─ HOST 侧（开发者 / CI，一次性构建链）────────────────────────────────────────────┐
│                                                                                │
│  ①fetch ⬜M1: python.org CPython tgz ──sha256──▶ .dist/src/cpython/（源码不改，C1）│
│  ②build ⬜M1: PEP 738 configure --host=aarch64-linux-android + 静态扩展          │
│        + OpenSSL/sqlite vendored + 16KB 链接 ⇒ strip ⇒ build/out/libpython_cli.so │
│        + stdlib-assets/（Lib/ 纯 py + pip 树 + ensurepip + cacert.pem）          │
│  ③lock 回写：CI 首产把 size/sha256/ndk/flags 写入 python-cli.lock.json           │
│        （draft 不伪造哈希；现值 size=0、sha256="" ✅如实空）                       │
│  ④provision ✅M0：tools/provision.mjs                                           │
│        读 lock → 七项 exec 门禁（不合格=退出 2，拒绝投放）                        │
│        → 幂等投放 python-cli/src/main/jniLibs/arm64-v8a/libpython_cli.so         │
│        → 写 src/main/resources/META-INF/python-cli.properties                    │
│  ⑤Gradle ✅M0：:python-cli（AAR 容器，useLegacyPackaging=true）                  │
│        → python-cli-<CLI_VERSION>.aar（io.github.fellow99）                      │
│  ⑥publish ✅发布面就绪/⬜首发未执行：vanniktech → Central Portal（RELEASE=false   │
│        默认禁用）；⬜M1 GitHub Release 先行（两段式，规划 §10.1）                  │
└────────────────────────────────────────────────────────────────────────────────┘
                                   │ AAR（runtimeOnly 依赖）
┌─ 消费方 App 进程（Android，arm64-v8a）──────────────────────────────────────────┐
│  nativeLibraryDir/  libpython_cli.so（exec 型 PIE，物理落盘 ✅打包口径已定）       │
│                     libpip.so / libpip3.so（sh 壳脚本）⬜M1                     │
│  filesDir/python-bridge-tools/   assets（stdlib/pip/CA）幂等物化 ⬜M2（规划 D4）  │
│        │ 环境引导层注入 PYTHONHOME / PYTHONPATH / SSL_CERT_FILE / PATH ⬜规划 §7  │
│        ▼ pty.spawn(<nativeLibraryDir>/libpython_cli.so, …)（node-pty）           │
│  python 子进程（exec 型，独立生命周期；forkpty → setsid → TIOCSCTTY）⬜M2 真机     │
└────────────────────────────────────────────────────────────────────────────────┘
```

**本仓不进入设备侧代码**：环境引导层（物化与环境变量注入）属消费方（bridge 载荷或 Kotlin）；本仓只保证「合格二进制 + 随包数据装进 AAR」。运行期契约（环境变量表、回程探针 P1–P6）是**规划 §7** 的消费方契约，⬜M2 验收。

---

## ② 制品形态：exec 型 vs dlopen 型（本仓与 aosp-node-pty 的根本差异）

| 维度 | 本仓 python-cli（**exec 型**） | aosp-node-pty（dlopen 库，对照） |
|---|---|---|
| 加载方式 | `forkpty` + `execve` 独立进程 | `dlopen` 进宿主进程 |
| ELF `e_type` | `ET_DYN`（PIE 可执行）——门禁① ✅ | `ET_DYN`（共享库） |
| `PT_INTERP` | **恰 1 个且 = `/system/bin/linker64`**——门禁② ✅（`provision.mjs:148-150`） | 必须为 0（相反） |
| `DT_NEEDED` | 白名单：仅系统库 + lock 登记——门禁④ ✅ | 必须含 `libnode.so` |
| NAPI 符号门禁 | 无（独立进程不解析 napi_*） | 有（napi_* 未定义引用） |
| 打包 | **`useLegacyPackaging=true`**（物理落盘 `nativeLibraryDir`，否则 `execve` ENOENT）✅ FR-000-004 | 通常 false（从 APK mmap） |
| 执行位合规 | targetSdk≥29 SELinux 禁止从应用可写目录 exec ⇒ `nativeLibraryDir` 是唯一合规执行位 | 不涉 exec |
| 版本口径 | 版本 = CPython 上游版本（独立 semver，无配对） | 与 node-runtime 配对 |

> 架构含义：**静态扩展**（规划 D1 ⬜M1）+ 纯数据 stdlib 的组合让产物「一个可执行 + 一堆数据文件」，全程不触碰 dlopen 禁令——这是本仓一切打包口径的出发点。

---

## ③ 门禁层（已实现的七项 exec 门禁，`tools/provision.mjs`）

| # | 门禁 | 判据 | 实现落点 ✅ | draft（现状）行为 |
|---|---|---|---|---|
| ① | ELF 形态 | `e_type == ET_DYN(3)` | `provision.mjs:146` | 硬校验 |
| ② | 解释器 | `PT_INTERP` 恰 1 个且内容 = `/system/bin/linker64` | `provision.mjs:148-150` | 硬校验 |
| ③ | 机器 | `e_machine == 183 (AArch64)` | `provision.mjs:151` | 硬校验 |
| ④ | 依赖白名单 | `DT_NEEDED ⊆ lock.matrix.allowedNeeded`（libc/libm/libdl/libz/liblog） | `provision.mjs:152-155` | 硬校验 |
| ⑤ | SHA-256 | 与 lock `releases[].sha256` 一致 | `provision.mjs:156-157` | **仅记录不比对**（draft 无锁值，`sha256:""`） |
| ⑥ | 大小 | 与 lock `releases[].size` 一致 | `provision.mjs:158-159` | **仅记录不比对**（draft `size:0`） |
| ⑦ | 页对齐 | 所有 PT_LOAD `p_align ≥ 0x4000`（16KB） | `provision.mjs:160` | 硬校验；`--allow-page-align-4k` 显式放行且必打印「仅 bring-up」警告（`:162-167`） |

补充纪律（同文件）：`--check` 校验已投放产物 + **jniLibs 兄弟文件白名单**（仅 `libpython_cli.so`，其余 `.so` 一律不合格，`:221-228`）；投放路径上 `BANNED_IN_AAR=['libnode.so']` 拒绝引擎入库（`:246-250`）；投放成功写 `META-INF/python-cli.properties`（`tool.version/abi/name/size/sha256/provisionedAt`，`:253-267`）。

**退出码纪律**：`0` 全过 · `2` 门禁不合格/未投放 · `1` 用法/IO 错误（`provision.mjs:24,205,216,228,237,275`）。ELF 解析是**纯 Node 自实现**（ELF64 小端，`parseElf()` `:58-130`），任何机器可跑，不依赖 llvm/file。

⬜规划扩展（M1-T6，规划 §6）：`--assets` 投放 + manifest.json 生成/校验；stdlib-assets 静态性检查（内不得有 `.so`）；jniLibs 壳脚本白名单（`libpip*.so`）。

---

## ④ 数据流与唯一事实源（lock）

```
python-cli.lock.json（draft，唯一事实源 ✅）
   active{version:3.14.10, abi:arm64-v8a}
   releases[0]{name, androidApi:24, size:0, sha256:"", builtFrom{…ndk:TBD…},
               gates{7 键}, mavenCentral{coordinates, published:false}, status:"draft"}
   matrix{minSdk:24, abi:[arm64-v8a], allowedNeeded[5], execPackaging, note}
        │ provision 读取（--version/--abi 可覆盖，缺记录即报错）
        ▼
   门禁判据 + 投放目标（python-cli/src/main/jniLibs/<abi>/<name>）+ properties 元数据
        ▼ Gradle AAR ──▶ Maven Central 坐标 io.github.fellow99:python-cli:3.14.10
```

- **draft 不伪造哈希**：`size:0`、`sha256:""`（C5/S5）✅；首个真实 CI 构建后回写并以实际钉住的 CPython 版本为准（规划 §2/§8）。
- 字段级模型（逐字段表）见 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §4。

---

## ⑤ 发布两段式（规划 §10.1；Maven 发布面已就绪）

| 段 | 触发 | 内容 | 状态 |
|---|---|---|---|
| ① GitHub Release | tag `v<pyver>` push（⬜M1-T7） | `python-cli-v<ver>-android-arm64-v8a.tar.gz`（so + 壳脚本 + stdlib-assets + BUILD/FETCH-METADATA + LICENSES）+ `.sha256`；lock 回写 `status=released` | ⬜规划 |
| ② Maven Central | M3 | vanniktech → Central Portal；`publish.gradle.kts` 已内置管线（coordinates/签名/sources jar/POM SCM 补丁/RELEASE 门禁）；lock 回写 `mavenCentral.published=true` | ✅发布面就绪（`RELEASE=false` 默认禁用发布任务）/ ⬜首发未执行 |

**发布卫生**（宪法 C5 落点）：`RELEASE=false` 默认；`publish.gradle.kts:133-139` 把 `signMaven*`/`publishToMavenCentral` 任务在「RELEASE≠true 或缺 Token」时一律 `enabled=false`；凭据只在用户级 `~/.gradle/gradle.properties`（模板 `gradle.properties.local.example`，真值不入库）。

---

## ⑥ 系统边界（谁做什么）

| 面 | 本仓承诺（AAR + 工具链） | 消费方/其它仓 |
|---|---|---|
| 二进制 | 交叉编译（⬜M1）、门禁、投放、打包 ✅（M0 工具链齐） | — |
| 随包数据 | stdlib/pip/CA 装进 assets（⬜M1） | filesDir 物化 + 环境注入（消费方环境引导层，⬜规划 §7） |
| 终端接入 | 提供 exec 型可执行与打包口径 | node-pty `pty.spawn` 启动；`PATH` 指向 `nativeLibraryDir` |
| 引擎供给 | **禁** `libnode.so` 入本 AAR（provision 白名单 ✅） | aosp-node-runtime 统一供给 node 系 |
| python 环境管理 | 不做（venv 组合属消费方/环境引导层） | 消费方 |
| 嵌入 API | **不做**（本仓明文边界；出现真实需求另立 `aosp-python-runtime` 线，规划 §1.3） | — |

**不在范围（规划 §1.3，能力边界）**：pip 装 sdist / 含 C 扩展的 wheel（设备无编译器 + 静态解释器不能加载新 `.so`）；tkinter/curses/readline 类 UI 模块（首版不编 ⬜规划）；uv 本体（属 aosp-uv-cli）。

---

## ⑦ 已知缺口（M0 现状，全部有规划归属）

| 缺口 | 归属 | 现状证据 |
|---|---|---|
| `libpython_cli.so` 本体与 AAR 内 `jni/` 条目 | ⬜M1（规划 §4/§5） | 实测 AAR 仅 4 个容器条目、无 `jni/`（STRUCTURE §2） |
| lock `size/sha256/ndk/flags` 真实值 | ⬜M1 首产回写 | draft `size:0`/`sha256:""`/`TBD` ✅如实 |
| assets 投放与 manifest 校验 | ⬜M1-T6（规划 §6） | provision 无 `--assets` 分支（实读源码） |
| fetch/build 真实逻辑 | ⬜M1-T1/T3 | 两脚本退出码 2（SCAFFOLD）✅语义已固化 |
| CI 真实流水线 + GitHub Release | ⬜M1-T7（规划 §9/§10.1） | 现 CI 仅配置期门禁 ✅；⚠️ 退出码断言缺陷见 TECH §5 #3 |
| 真机回程探针 P1–P6 | ⬜M2（规划 §7.1） | 无设备侧代码（本仓边界） |
