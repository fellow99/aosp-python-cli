# STRUCTURE.md —— `aosp-python-cli` 目录与文件结构（as-built）

> **性质**：项目级结构规格（现状快照）。本文件只描述「文件在哪、干什么、进不进 git/包」，全部条目来自 2026-11-02 对仓库的实际扫描（`ls`/`find`），不描述规划中的文件。
> **依据**：`specs/constitution.md`（C1–C8 工程宪法）· `../docs/000-工程规划.md`（唯一规划基线 v2.1，下称「规划 §」；本文件只引用其中**已实现部分**，M1+ 内容一律标注「规划」）· 本仓库实际文件清单 ✅实测。
> **标记**：✅实测（本仓库可复核）/ ⬜规划（仅出现在「规划引用」栏，非现状）/ ⚠️风险或不一致。
> **版本**：v1.0 · 2026-11-02 · 状态：**M0 脚手架已建成**（Gradle 骨架 + exec 门禁 provision + draft lock + 骨架脚本 + 配置期 CI）；python 本体二进制**尚未构建**（属 M1，规划）。
> **引用基准**：文中行数为 **2026-11-02 快照**（`tools/provision.mjs` 276 行 / `publish.gradle.kts` 139 行 / `python-cli/build.gradle.kts` 45 行）。

---

## 1. 顶层目录树（2–3 层，逐文件一行用途）

```
aosp-python-cli/                        # node-bridge-workspace 的 git submodule（.git 文件指向 ../.git/modules/aosp-python-cli）；分支 main ✅
├── .github/
│   └── workflows/
│       └── build-python-cli-android.yml  # CI（000-scaffold 配置期门禁：Gradle 配置 + provision/脚本语法与退出码纪律；50 行）
├── docs/
│   └── 000-工程规划.md                    # ★ 唯一规划基线 v2.1（270 行；M0 现状 + M1/M2 实现设计；「先改本文件，再改实现」）
├── gradle/
│   └── libs.versions.toml                # 版本目录：仅 AGP 9.2.1 一项（5 行）
│   # ⚠️ 无 Gradle Wrapper（gradlew / gradle/wrapper 不存在）——Gradle 版本只由 CI 步骤钉 9.4.1（见 TECH §5）
├── python-cli/                           # ★★ 唯一 Gradle 模块：AAR 容器（零 Kotlin/Java 源）
│   ├── build.gradle.kts                  # android library + useLegacyPackaging=true + CLI_VERSION 版本覆写（45 行）
│   ├── THIRD-PARTY-NOTICES.md            # 第三方许可清单：CPython PSF-2.0 / pip(MIT) / OpenSSL / CA（17 行）
│   ├── src/main/                         # 空目录（find 无任何文件）：jniLibs 与 assets 由工具投放，且不入库
│   └── build/                            # Gradle 产物（不入库）：outputs/aar/python-cli-debug.aar 已实测产出（TC-02）
├── scripts/
│   ├── fetch-python-cli-source.mjs       # fetch 骨架：接口 + SCAFFOLD 退出码 2，下载/解压/校验属 M1（54 行）
│   └── build-python-cli-android.sh       # 交叉编译骨架：PEP 738 + 静态扩展六条纪律注释，SCAFFOLD 退出码 2（58 行）
├── specs/                                # 规格体系（本目录）：见 §5 与 README.md 索引
├── tools/
│   └── provision.mjs                     # ★ 投放 + exec 型 ELF 门禁（纯 Node，零第三方依赖；276 行）
├── publish.gradle.kts                    # 发布面共享配置（vanniktech 0.37.0 + Central Portal + RELEASE 门禁；139 行）
├── python-cli.lock.json                  # ★ 唯一事实源（draft 3.14.0/arm64-v8a；size=0、sha256 空串，不伪造哈希；53 行）
├── settings.gradle.kts                   # rootProject.name=aosp-python-cli，仅 include(":python-cli")（21 行）
├── gradle.properties                     # 公共元数据（GROUP/POM_*/CLI_VERSION=3.14.0 draft）+ RELEASE=false（20 行）
├── gradle.properties.local.example       # 用户级凭据模板（Central Portal Token / GPG；真值文件不入库；8 行）
├── .gitignore                            # 构建产物 + 密钥 + jniLibs/**/*.so + assets 树 + .dist/（31 行）
├── LICENSE                               # MIT，Copyright (c) 2026 fellow99（21 行）
├── README.md                             # 英文总览（86 行）
└── README_zh.md                          # 中文总览（77 行）
```

**一句话边界**：本仓**不含任何嵌入 API**——只有原生二进制与随包数据的可复现构建、ELF 门禁与发布流水线（README §开头明文）。发布物 = `io.github.fellow99:python-cli:<CLI_VERSION>` AAR 容器；`tools/`、`scripts/`、`specs/`、`docs/`、`.github/` 是配套物，不进 AAR。

---

## 2. `python-cli/`（唯一发布物模块）的现状

| 项 | 现状 ✅实测 | 证据 |
|---|---|---|
| 源码面 | `src/main/` 为空目录（无 manifest/无源文件；manifest 由 AGP 合成） | `find python-cli/src -type f` 零命中 |
| 合成 manifest | `package="org.fellow99.pythoncli"`，仅 `uses-sdk android:minSdkVersion="24"` | `build/intermediates/merged_manifest/debug/.../AndroidManifest.xml` |
| 已实测 AAR 内容 | `R.txt` · `AndroidManifest.xml` · `classes.jar` · `META-INF/com/android/build/gradle/aar-metadata.properties`（minCompileSdk=36）；**无 `jni/`、无 `assets/`** —— 容器空壳，与「二进制未构建」一致 | `build/outputs/aar/python-cli-debug.aar`（TC-02 产物）解包清单 |
| aar-metadata | `aarFormatVersion=1.0` / `minCompileSdk=36` / `coreLibraryDesugaringEnabled=false` | `build/intermediates/aar_metadata/.../aar-metadata.properties` |
| 规划落点 | `jni/arm64-v8a/libpython_cli.so` + `libpip*.so` 壳脚本 + `assets/python-bridge-tools/`（stdlib/pip/CA）⬜ M1 投放（规划 §5） | 规划 §5；现状 AAR 无这些条目 |

---

## 3. 关键配置文件位置

| 文件 | 层级 | 关键内容（现状 ✅实测） | 规划锚点 |
|---|---|---|---|
| `settings.gradle.kts` | 工程 | pluginManagement 直载 `com.vanniktech.maven.publish.base` **0.37.0**；`FAIL_ON_PROJECT_REPOS`；rootName `aosp-python-cli`；仅 `:python-cli` | FR-000-001 |
| `gradle/libs.versions.toml` | 工程 | `agp = "9.2.1"` 一项 + `android-library` 插件别名 | — |
| `gradle.properties` | 工程 | `GROUP=io.github.fellow99` · `VERSION_NAME=0.1.0`（见 ⚠️）· `CLI_VERSION=3.14.0`（draft）· `POM_*` 全套 · **`RELEASE=false`** | FR-000-003；宪法 C5 |
| `python-cli/build.gradle.kts` | 模块 | namespace `org.fellow99.pythoncli` · compileSdk 36 · minSdk 24 · `abiFilters += "arm64-v8a"` · **`useLegacyPackaging=true`** · 版本覆写为 `CLI_VERSION`（未设置即 error） | FR-000-002/004/003 |
| `publish.gradle.kts` | 发布 | vanniktech `coordinates(io.github.fellow99, python-cli, CLI_VERSION)` · `pomFromGradleProperties` · Central Portal（validation=NONE，`-PAUTOMATIC_RELEASE=true` 才 PUBLISHED）· `signAllPublications` · release 单 variant + sources jar · POM `<scm><url>` 补丁 · **RELEASE=false 或缺 Token 时禁用 sign/publish 任务** | 宪法 C5；规划 §10.1 |
| `python-cli.lock.json` | 事实源 | `active{3.14.0, arm64-v8a}` · `releases[0]` draft（`size:0`、`sha256:""`、gates 七键、`mavenCentral.published:false`）· `matrix{minSdk:24, abi:[arm64-v8a], allowedNeeded:[libc,libm,libdl,libz,liblog]}` | FR-000-010~013；字段模型见 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §数据模型 |
| `tools/provision.mjs` | 工具 | lock 读取 → 七项 exec 门禁（ET_DYN/PT_INTERP=/system/bin/linker64/AArch64/白名单/sha/size/16KB）→ 幂等投放 jniLibs + 写 `META-INF/python-cli.properties` | FR-000-030~036 |
| `.github/workflows/build-python-cli-android.yml` | CI | `ubuntu-24.04` + Temurin 21 + Gradle 9.4.1；`gradle :python-cli:tasks` 配置门禁 + provision 语法/退出码自检 + 脚本语法门禁；`permissions: contents: read` | FR-000-040~042 |
| `.gitignore` | 仓库 | `build/`、`*.jks/*.keystore`、**`python-cli/src/main/jniLibs/**/*.so`**、**`python-cli/src/main/assets/**`**、`.dist/`、`build/out/` | 宪法 C3 |

⚠️ **双版本字段并存**：`gradle.properties` 同时有 `VERSION_NAME=0.1.0` 与 `CLI_VERSION=3.14.0`。发布坐标版本唯一取 `CLI_VERSION`（`publish.gradle.kts:37-39` 显式 `coordinates(...)` + 模块侧 publication 反射覆写）；`VERSION_NAME` 仅由 vanniktech `pomFromGradleProperties` 消费，仓内无其它引用——两个版本口径并存，见 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §9 不一致清单。

---

## 4. 目录 ↔ 模块编号映射

本仓（M0 阶段）只有一个模块编号 `000-scaffold`，覆盖全仓骨架：

| 模块编号 | 覆盖范围（目录/文件） | spec 位置 |
|---|---|---|
| **000-scaffold** 工程搭建 | `settings.gradle.kts` · `gradle/` · `gradle.properties*` · `publish.gradle.kts` · `python-cli/build.gradle.kts` · `python-cli.lock.json` · `tools/provision.mjs` · `scripts/` · `.github/workflows/` · `.gitignore` · `THIRD-PARTY-NOTICES.md` · `README*` | [`000-scaffold/spec.md`](./000-scaffold/spec.md) |
| M1+（交叉编译 / assets 投放 / 真机探针 / 发布） | 尚无对应目录与文件 | 规划 §4/§5/§7.1/§9（⬜ 未开工，规划引用） |

> 后续里程碑若立项（如 M1 交叉编译），应新增 `specs/001-*/` 目录并在本表登记，编号沿用 `FR-000-xxx` 之后的独立段（见 [`000-scaffold/spec.md`](./000-scaffold/spec.md) §3 编号规则）。

---

## 5. specs/ 目录自身（本套文档）

| 文件 | 说明 |
|---|---|
| `README.md` | 规范索引（最后生成；链接逐一校验存在） |
| `STRUCTURE.md` | 本文件 |
| `TECH.md` | 技术选型（已实现 vs 规划中） |
| `ARCHITECTURE.md` | 整体架构（AAR 容器 + exec 制品形态 + 门禁层 + 发布两段式） |
| `constitution.md` | 工程宪法（C1–C8 + S1–S8，从代码与文档提取） |
| `overall-spec.md` | 整体规格（技术无关 WHAT/WHY，FR-000-xxx 按域索引） |
| `overall-plan.md` | 整体技术方案（HOW） |
| `overall-test-cases.md` | 测试用例索引（指向 `000-scaffold/test-cases.md`） |
| `SPECS_CHECKLIST.md` | 文档完成度追踪 |
| `000-scaffold/spec.md` | 模块功能规格（既有，保留；FR-000-001…042 定义处） |
| `000-scaffold/plan.md` | 模块技术方案（本批新增，as-built） |
| `000-scaffold/tasks.md` | 任务拆解（既有，保留，全部勾选） |
| `000-scaffold/test-cases.md` | 测试用例 TC-01…09（既有，保留，含 2026-11-02 执行记录） |

---

## 6. 不入库清单（.gitignore 摘录，宪法 C3 的落点）

| 忽略项 | 理由 |
|---|---|
| `python-cli/src/main/jniLibs/**/*.so` | 二进制不入库：由 CI 构建、`tools/provision.mjs` 投放 |
| `python-cli/src/main/assets/**` | 随包 stdlib/pip/CA 树不入库（M1 起投放）⬜ 树本身规划，忽略规则已生效 ✅ |
| `.dist/`、`build/out/` | fetch/build 工作区（M1 启用） |
| `build/`、`.gradle/`、`*.apk`、`*.aab` 等 | Gradle/Android 产物 |
| `*.jks`、`*.keystore`、`google-services.json` | 密钥不入库（宪法 C5） |

---

## 7. git 事实（✅实测，2026-11-02）

- 本仓是 `node-bridge-workspace` 的 **git submodule**（根 `.git` 为文件：`gitdir: ../.git/modules/aosp-python-cli`）。
- 当前分支 `main`；提交共 5 个，全部在 2026-11-02：`7bfae38 Initial commit` → `d3f32ca feat(scaffold): 搭建 aosp-python-cli 工程骨架` → `f2d6869`/`8130ba9`/`068fd4b` 三笔 `docs(planning)`（合并实现设计、两段式发布、D6 pip 随包决策）。
- 提交纪律：Conventional Commits（`tasks.md` T8.3）；父工程（workspace）不随本仓提交。
