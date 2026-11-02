# TECH.md —— `aosp-python-cli` 技术选型（as-built + 规划，含状态列）

> **性质**：项目级技术选型规格。回答「用了什么、什么版本、为什么、否掉了什么」，并为每项给出**已实现 / 规划中**状态。
> **依据**：`specs/constitution.md`（C1–C8）· `../docs/000-工程规划.md`（唯一规划基线 v2.1，下称「规划 §」；M1+ 条目一律标 ⬜规划）· 本仓库文件 ✅实测。
> **标记**：✅已实现（实测可复核）· ⬜规划中（`docs/000-工程规划.md` 有设计、仓内无实现，**不得当作现状引用**）· ⚠️风险或不一致。
> **版本**：v1.0 · 2026-11-02 · 状态：M0 脚手架已建成；M1（PEP 738 交叉编译）未开工。

---

## 1. 选型总表

| 类别 | 技术/版本 | 状态 | 用途 | 选型理由 |
|---|---|---|---|---|
| **构建系统** | Gradle **9.4.1** | ✅已实现（CI 钉定） | 多模块 Android 工程构建、AAR 产出 | CI 用 `gradle/actions/setup-gradle@v4` 显式装 9.4.1；本地验收同版本（test-cases 执行记录）。⚠️ 仓内**无 Wrapper**（`gradlew`/`gradle/wrapper` 不存在），本地版本不受仓约束（见 §5 #1） |
| **Android 插件** | AGP **9.2.1**（`gradle/libs.versions.toml` 唯一项） | ✅已实现 | `com.android.library` 插件，产出 AAR 容器 | 版本目录集中管理；`compileSdk 36` / `minSdk 24` |
| **发布插件** | `com.vanniktech.maven.publish.base` **0.37.0** | ✅已实现（发布面就绪，未实际发布） | Maven Central（Central Portal）发布、签名、POM、sources jar | 经 `settings.gradle.kts` pluginManagement 直载；0.37.0 起直连 central.sonatype.com；`validation=NONE`（上传后人工 Publish，`-PAUTOMATIC_RELEASE=true` 才自动）；与 aosp-node-pty 同口径移植（`publish.gradle.kts` 头注释） |
| **JDK** | Temurin **21** | ✅已实现 | Gradle/AGP 运行 | CI `actions/setup-java@v4`；本地验收 Temurin 21（test-cases 头注） |
| **host 工具链语言** | 纯 Node（`.mjs`，零第三方依赖：`node:fs/path/crypto/url`） | ✅已实现 | `tools/provision.mjs`（门禁+投放）、`scripts/fetch-python-cli-source.mjs`（接口骨架） | 「一个 `node` 就能跑」⇒ CI 与消费方机器零安装；ELF64 解析自实现，不依赖 llvm-readelf/file |
| **交叉编译脚本** | POSIX bash（`scripts/build-python-cli-android.sh`） | ✅已实现（骨架：接口+纪律注释，退出码 2） | M1 的 PEP 738 configure/make/strip 门禁链入口 | 头注释固化六条纪律（PEP 738 / 静态扩展 / OpenSSL+CA / 16KB / exec ELF / lib*.so 命名） |
| **ELF 门禁 profile** | **exec 型**（与 dlopen 库门禁三处相反）：`ET_DYN` + **PT_INTERP 恰 1 个且=`/system/bin/linker64`** + AArch64 + DT_NEEDED 白名单 + 16KB 对齐 + sha/size | ✅已实现 | 保证二进制能在 Android `nativeLibraryDir` 被 `execve` 启动 | exec 型必须物理落盘并被系统 linker 启动；`provision.mjs:146-160` 七项判据；退出码 0/2/1 |
| **打包形态** | `packaging.jniLibs.useLegacyPackaging = true`（extractNativeLibs=true） | ✅已实现 | 把 `.so` 物理落盘 `nativeLibraryDir` | 不落盘则 `execve` ENOENT（`build.gradle.kts` 注释明文）；与 node-pty 的 dlopen 库口径**相反** |
| **目标引擎** | CPython **3.14.10**（draft 计划版本，以 CI 实际钉选为准） | ⬜规划（M1 构建；本体二进制不存在） | `libpython_cli.so` 本体 + `Lib/` stdlib | PEP 738（CPython 3.13+ 官方 Android 支持）；版本=制品版本、独立 semver |
| **交叉编译路径** | PEP 738 官方路径：`configure --host=aarch64-linux-android` + `--with-build-python=<同版本 host python>` | ⬜规划（M1） | 官方支持的 Android 交叉编译 | 官方路径 ⇒ 不打源码补丁（fetch 不改源，C1）；源码树自带 Android 构建辅助优先包装（规划 §4.3） |
| **NDK** | 与 aosp-node-runtime 对齐（r28c 或更高；PEP 738 要求 r26+）⬜ | ⬜规划（未钉版） | 交叉工具链 | lock `builtFrom.ndk` 现值 `"TBD (first CI build pins NDK line + version)"`——如实未钉 |
| **OpenSSL** | vendored 源码钉版 + `./Configure android-arm64 no-shared`，静态链入 `_ssl`/`_hashlib` | ⬜规划（M1-T4） | TLS（Android 无系统证书目录，CA bundle 随包） | 版本计划写入 lock `builtFrom.deps`（规划 §4.1）；首版若失败则 `_ssl` 不编并如实上报（规划 R2） |
| **sqlite3** | 官方 amalgamation（sqlite3.c）vendored，静态链入 `_sqlite3` | ⬜规划（M1-T4） | sqlite3 标准库模块 | 同上；版本同入 lock |
| **pip** | 官方 wheel（files.pythonhosted.org）钉版 + sha256，解包进 `Lib/site-packages/`；`libpip.so`/`libpip3.so` 壳脚本 → `libpython_cli.so -m pip` | ⬜规划（M1-T5，规划决策 D6） | 首启即有 `pip` 命令、离线可用 | pip 为纯 py 不需 exec 位；wheel 内 bin 脚本不使用 |
| **host build python** | 官方 tarball 自建或发行版安装，版本=目标版本 | ⬜规划（M1-T2） | PEP 738 交叉编译前置 | CI 断言 host/target 版本一致（规划 §4.2 ②） |
| **CI runner** | `ubuntu-24.04` · JDK 21 · Gradle 9.4.1 · `timeout-minutes: 20` · `permissions: contents: read` | ✅已实现（scaffold 配置期 CI） | 配置期门禁：无 `.so` 也必须可配置；脚本语法与退出码纪律 | 真实流水线（fetch/host python/configure/make/provision 全门禁/Release）⬜ M1 替换（规划 §9）。⚠️ CI 未显式 `setup-node`，依赖 runner 预装 Node（见 §5 #2） |
| **发布通道** | 两段式：① GitHub Release（tag `v<pyver>` 触发，归档 tar.gz + sha256）；② Maven Central（`io.github.fellow99:python-cli`） | ①⬜规划（M1-T7） ②✅发布面就绪/⬜首发未执行（M3） | 先行可下载、后入中央仓 | 沿用 aosp-node-pty 两段式（规划 §10.1）；Maven 阶段执行口径按工作区 runbook；lock `mavenCentral.published=false` 如实 |
| **凭据卫生** | `RELEASE=false` 默认；Token/GPG 只放用户级 `~/.gradle/gradle.properties` | ✅已实现 | 防误发、密钥不入库 | `publish.gradle.kts:133-139` 在 RELEASE=false 或缺 Token 时禁用 sign/publish 任务；仓内只有 `gradle.properties.local.example` 模板 |
| **许可** | 本仓 MIT（LICENSE）；随包分发件：CPython PSF-2.0、pip(MIT)、OpenSSL(Apache-2.0/3.x)、CA bundle 按来源 | ✅已实现（清单文件）/ ⬜完整许可全文随 Release 归档（规划 §12） | 合规交付物 | `python-cli/THIRD-PARTY-NOTICES.md`（17 行） |
| **仓库形态** | `node-bridge-workspace` 的 git submodule；分支 `main`；Conventional Commits | ✅已实现 | 工作区统辖多仓 | 提交历史 5 笔（2026-11-02）✅ |

---

## 2. 被**否掉**的方案（源自规划 D1–D6「反面」列与仓内注释）

| 被否对象 | 否掉理由 | 替代（现状） |
|---|---|---|
| 动态扩展模块 + 自定义 importer | targetSdk≥29 SELinux 禁止从 filesDir `dlopen`，动态扩展 `.so` 落地即废；复杂度高一个量级 | **扩展全静态**（`Modules/Setup.local` `*static*`，规划 D1；`build.gradle.kts` 头注释）⬜M1 |
| `useLegacyPackaging=false` | 库直接从 APK mmap、不落盘 ⇒ `execve` ENOENT（这是 dlopen 库的口径，与本仓相反） | `useLegacyPackaging=true` ✅（FR-000-004） |
| 版本与 node 系配对（NODE_MODULE_VERSION 约束） | 与 runtime 无 ABI 耦合，配对无必要 | 版本 = CPython 上游版本，独立 semver ✅（FR-000-003；lock 无 `pairedRuntime` 字段） |
| stdlib 放 jniLibs / APK 内 mmap | 解释器需要真实文件路径；纯数据无需 exec 位 | assets → filesDir 幂等物化（规划 D4）⬜M2 |
| 第三方 fork / 源码补丁 | 违反「fetch 不改源」纪律（C1） | PEP 738 官方路径，Android 配置经 configure 参数注入（规划 D5）⬜M1 |
| 只靠 ensurepip 引导 pip | 首启多一步，且 `pip` 非直接命令可用 | pip 树随包 + 壳脚本入口（规划 D6）⬜M1（ensurepip 保留作修复兜底） |
| jniLibs 混入其它 `.so`（含 `libnode.so`） | 引擎由 node-runtime 统一供给，同名库包内冲突 | provision `--check` 的 jniLibs 兄弟文件检查 + `BANNED_IN_AAR=['libnode.so']` ✅（`provision.mjs:38,221-225,246-250`） |
| 门禁失败静默放行 | 静默降级会让不合格二进制进 AAR | 门禁不合格 ⇒ 拒绝投放，退出码 2 ✅；唯一放行 `--allow-page-align-4k` 必须显式传参且打印「仅 bring-up」警告 ✅（`provision.mjs:162-167`） |

---

## 3. 版本矩阵与兼容口径

| 维度 | 值 | 来源 |
|---|---|---|
| 制品坐标 | `io.github.fellow99:python-cli:<CLI_VERSION>` | `publish.gradle.kts:33-39` ✅ |
| 当前版本（draft） | `3.14.10`（= CPython 上游计划版本；M1 以 CI 实际可构建最新稳定版钉选回写） | `gradle.properties:8` · `python-cli.lock.json` active ✅ |
| ABI | 仅 `arm64-v8a`（明确不做 x86/x86_64/arm32） | 模块 `abiFilters` · lock `matrix.abi` ✅ |
| Android | `minSdk 24` · `compileSdk 36` · 目标 API（交叉编译 `--api` 默认 24） | `build.gradle.kts` · lock `releases[0].androidApi` · build 脚本 ✅ |
| 依赖白名单 | `libc.so` `libm.so` `libdl.so` `libz.so` `liblog.so`（仅系统库；lock 登记可扩展） | lock `matrix.allowedNeeded` ✅ |
| 页对齐 | 16KB（`-Wl,-z,max-page-size=16384`，规划 M1 落地；门禁已可校验） | 门禁⑦ ✅ / 链接参数 ⬜规划 |
| Gradle/AGP/插件 | Gradle 9.4.1（CI 钉）· AGP 9.2.1 · vanniktech 0.37.0 · JDK 21 | settings/toml/workflow ✅ |
| host Node | 本机 v24.7.0 实测可跑 `provision.mjs`；⬜ CI 版本未钉定 | ⚠️见 §5 #2 |

---

## 4. 依赖清单

| 依赖 | 谁提供 | 何时需要 | 缺失后果 | 状态 |
|---|---|---|---|---|
| Node.js（host） | 开发机 / CI runner 预装 | 跑 provision/fetch | 门禁与投放不可用 | ✅（CI 未显式钉版 ⚠️） |
| JDK 21 | Temurin | Gradle 构建 | 无 AAR | ✅ |
| Gradle 9.4.1 | CI setup-gradle / 本地安装 | 构建 | 无 AAR | ✅（无 Wrapper ⚠️） |
| AGP 9.2.1 + vanniktech 0.37.0 | google()/mavenCentral()/gradlePluginPortal | 构建/发布 | 解析失败 | ✅ |
| Android SDK 36 / NDK（r28c+） | 本地 / CI 装机 | AGP 构建 / ⬜M1 交叉编译 | AAR 产出 / M1 阻塞 | NDK ⬜未钉 |
| CPython 3.14.10 源码包 | python.org（sha256 校验） | ⬜M1 fetch | 无产物 | ⬜规划 |
| OpenSSL / sqlite / pip wheel / cacert | 官方源（各带 sha256） | ⬜M1 | `_ssl`/`_sqlite3`/`pip` 缺 | ⬜规划 |
| Central Portal Token / GPG | 用户级 gradle.properties | 仅真实发布 | 发布任务被禁用（默认态） | ✅卫生就绪 |

---

## 5. 选型层面的未决 / 风险（⚠️）

| # | 项 | 现状 | 处置建议 |
|---|---|---|---|
| 1 | 仓内无 Gradle Wrapper | Gradle 版本仅 CI 钉 9.4.1；本地开发者版本不受约束（AGP 9.2.1 对 Gradle 下限有要求） | M1 前补 `gradle wrapper --gradle-version 9.4.1` 或在 README 声明最低版本 |
| 2 | CI 未显式 `setup-node` | provision/fetch 依赖 `ubuntu-24.04` runner 预装 Node；规划 §9 装机清单要求 Node 20 | M1 替换 workflow 时显式 `actions/setup-node` 钉版 |
| 3 | CI「退出码=2 断言」在 `bash -e` 下不可达 | workflow 第 34-40 行：`node tools/provision.mjs --check` 以退出码 2 结束时，默认 `bash -eo pipefail` 会在 `code=$?` 之前终止该 step ⇒ 步骤按失败处理（症状恰好也是失败，但失败原因与断言文案不符） | 改写为 `node tools/provision.mjs --check; code=$?; if [ "$code" -ne 2 ]; then exit 1; fi` 并加 `set +e` 语义（如 `|| code=$?`）——详见 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §9 |
| 4 | `VERSION_NAME=0.1.0` 与 `CLI_VERSION=3.14.10` 双版本字段并存 | 坐标版本唯一取 CLI_VERSION；VERSION_NAME 仅 vanniktech pom 属性消费 | 明确取舍：删除或在注释中声明其为 pom 元数据专用 |
| 5 | NDK / host python / OpenSSL / sqlite / pip 均未钉版 | lock `builtFrom.ndk`/`flags` 为 `TBD` 字面值（draft 如实不伪造） | M1-T2/T4/T5 首产回写 lock |
| 6 | `gradle.properties.local.example` 含 `signing.secretKeyRingFile`，而 `publish.gradle.kts` 另支持 `signing.keyData`（内存 PGP） | 两条凭据通道并存，模板只列其一 | 发布 runbook 时统一口径 |
