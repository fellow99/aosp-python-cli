# overall-plan.md —— `aosp-python-cli` 整体技术方案（HOW，as-built + 规划标注）

> **性质**：项目级**技术方案**。回答「怎么实现、横切关注点怎么落、测试与发布怎么走」。所有断言给真实文件路径；M1+ 的策略一律标 ⬜规划（`../docs/000-工程规划.md`，下称「规划 §」）。
> **依据**：`specs/constitution.md`（C1–C8/S1–S8/G1–G6）· `specs/TECH.md`（选型与版本）· 源码 ✅实测（行号取 2026-11-02 快照）。
> **版本**：v1.0 · 2026-11-02 · 状态：M0 已建成；M1 未开工。

---

## 1. 技术上下文（Technical Context）

### 1.1 运行环境

| 面 | 值 | 证据 ✅ |
|---|---|---|
| 宿主工程 | `node-bridge-workspace` 的 git submodule；分支 `main` | `.git`（gitdir 指针）、git log |
| 构建编排 | Gradle 9.4.1（CI `gradle/actions/setup-gradle@v4` 钉定；仓内无 Wrapper ⚠️） | `.github/workflows/build-python-cli-android.yml:29-32` |
| Android 插件 | AGP 9.2.1（`gradle/libs.versions.toml` 唯一项） | 同文件 |
| 发布面 | vanniktech `com.vanniktech.maven.publish.base` 0.37.0（`settings.gradle.kts` pluginManagement 直载） | `settings.gradle.kts:3-5` |
| host 工具链 | Node（本机 v24.7.0 实测；CI 未显式钉版 ⚠️）+ bash | `node --version`；workflow `run:` 块 |
| CI runner | `ubuntu-24.04` · Temurin JDK 21 · timeout 20min · `permissions: contents: read` | workflow:16-33 |
| 仓库内 Android SDK | compileSdk 36 / minSdk 24 / `abiFilters=[arm64-v8a]` | `python-cli/build.gradle.kts:22-32` |

### 1.2 关键依赖与版本（发布坐标链）

```
GROUP=io.github.fellow99（gradle.properties:2）
  + artifactId = python-cli（模块名，publish.gradle.kts:36）
  + version    = CLI_VERSION = 3.14.10（draft；gradle.properties:8，lock active 同值）
  ⇒ io.github.fellow99:python-cli:3.14.10（mavenCentral.coordinates 同值）
```

版本链双保险：`publish.gradle.kts:39` 显式 `coordinates(...)` + `python-cli/build.gradle.kts:19-26` 对每个 publication 反射 `setVersion`；任一处 `CLI_VERSION` 缺失即 error（`:16-17` / `publish.gradle.kts:38`）。

---

## 2. 宪法符合性检查表（逐条）

| # | 原则 | 现状 | 证据 / 缺口 |
|---|---|---|---|
| C1 | fetch 不改源 | ✅纪律已固化 / ✅逻辑属 M1 | `scripts/fetch-python-cli-source.mjs:5-12` 注释 + exit 2 骨架；lock `builtFrom.source` |
| C2 | lock 唯一事实源 | ✅ | `provision.mjs:33,42,177-193`；无第二事实源 |
 | C3 | 二进制不入库 | ✅ | `.gitignore:23-24,27-28`；实测 `git status` 干净（TC-09） |
| C4 | 门禁强制不静默降级 | ✅ | `provision.mjs:146-167,235-238`；唯一放行 `--allow-page-align-4k` 显式+告警 |
| C5 | 发布卫生 | ✅ | `gradle.properties:20` `RELEASE=false`；`publish.gradle.kts:133-139` 任务禁用；`gradle.properties.local.example` 仅模板 |
| C6 | 未实测标 ⬜ | ✅ | 规划 §11 风险表 R1–R8；lock `TBD` 字段；本套 specs 标记口径 |
| C7 | 许可合规 | ✅清单 / ⬜全文随归档 | `python-cli/THIRD-PARTY-NOTICES.md`；规划 §12 |
| C8 | 先改文档再改实现 | ✅ | 规划版本头；git 历史三笔 `docs(planning)` 先行 |
| S1 | 退出码 0/2/1 | ✅ | 三件工具一致（TC-04/05/06/07） |
| S2 | AAR 容器零源码 | ✅ | `python-cli/build.gradle.kts:11`；`src/main` 空 |
| S3 | useLegacyPackaging=true | ✅ | `python-cli/build.gradle.kts:40-42` |
| S4 | 版本唯一源 CLI_VERSION | ✅（⚠️残留双字段） | `VERSION_NAME=0.1.0` 与 `CLI_VERSION` 并存，见 §6 不一致 #2 |
| S5 | draft 不伪造哈希 | ✅ | lock `size:0`/`sha256:""`/`ndk:TBD` |
| S6 | jniLibs 白名单 | ✅ | `provision.mjs:38,221-228,246-250` |
| S7 | 脚本接口先冻结 | ✅ | fetch/build 参数集与默认值已定（TC-06/07 语义锁死） |
| S8 | Conventional Commits | ✅ | git log；`tasks.md` T8.3 |

---

## 3. 实现策略总览

### 3.1 M0（已建成）↔ 文件 ↔ FR 映射

| 策略件 | 文件（真实路径） | 实现 FR |
|---|---|---|
| 工程骨架 | `settings.gradle.kts` · `gradle/libs.versions.toml` · `gradle.properties` · `gradle.properties.local.example` | FR-000-001/003 |
| 容器模块 | `python-cli/build.gradle.kts`（apply 发布面、版本覆写、arm64、legacy packaging） | FR-000-002/003/004/005 |
| 发布面 | `publish.gradle.kts`（coordinates/pomFromGradleProperties/Central Portal/signing/SCM 补丁/RELEASE 门禁） | FR-000-003（坐标）+ C5 |
| 事实源 | `python-cli.lock.json`（draft） | FR-000-010~013 |
| 投放与门禁 | `tools/provision.mjs`（lock 驱动、七项门禁、幂等投放、白名单、元数据） | FR-000-030~036 |
 | 脚本接口 | `scripts/fetch-python-cli-source.mjs` · `scripts/build-python-cli-android.sh`（exit 2 骨架） | spec §2「脚本骨架（接口固化）」+ 宪法 S7（模块 spec §3 未为此段设 FR 编号，如实沿用） |
| 配置期 CI | `.github/workflows/build-python-cli-android.yml` | FR-000-040~042 |
| 卫生/许可/文档 | `.gitignore` · `python-cli/THIRD-PARTY-NOTICES.md` · `README.md`/`README_zh.md` · `LICENSE` | C3/C7 |

### 3.2 M1 策略（⬜规划 §4/§5/§6/§9，逐项映射任务）

| 策略 | 规划落点 | 对应任务 |
|---|---|---|
| 五源钉选 fetch（python/openssl/sqlite/pip/cacert，各带 sha256） | 规划 §4.1/§9 | M1-T1 |
| host build python 版本一致性断言 | 规划 §4.2② | M1-T2 |
| configure/make 首轮试编（先动态基线后静态） | 规划 §4.2/§4.3（优先包装官方 Android 辅助） | M1-T3 |
| Setup.local 静态化 + OpenSSL/sqlite vendored | 规划 §4.1/§4.2④ | M1-T4 |
| strip + stdlib 收集 + pip 树解包/壳脚本 + ensurepip/CA | 规划 §4.2⑥⑦、D6 | M1-T5 |
| provision 扩展：`--assets` + manifest + 静态性检查 + 壳脚本白名单 | 规划 §6「M1 新增」 | M1-T6 |
| CI 真实流水线 + GitHub Release + lock 回写 | 规划 §9/§10.1 | M1-T7 |

### 3.3 依赖顺序

fetch → host python 校验 → configure/make → strip → stdlib/pip/CA 收集 → provision（jniLibs+assets 全门禁）→ AAR → （GitHub Release ⇒ Maven Central）。M0 已就位的是**最后一半**（provision/AAR/发布面）；M1 从链条头部接入。

---

## 4. 横切关注点

### 4.1 门禁（已实现的面）

- 七项判据与实现落点见 [`ARCHITECTURE.md`](./ARCHITECTURE.md) §③；ELF 解析零依赖（`provision.mjs:58-130`）。
- draft 语义：`sha256/size` 无锁值时**只记录不比对**（`:156-159`），并在目标 release 打印 draft 警示（`:197`）——避免「空值当通过依据」（FR-000-011）。
- 放行面唯一：`--allow-page-align-4k`（`:162-167`），打印「仅 bring-up」警告；其余门禁无任何绕过。

### 4.2 物化（设备侧，⬜规划 §7——本仓只定义契约）

- 随包数据 `assets/python-bridge-tools/`（stdlib/pip/CA + manifest）→ 消费方幂等物化到 `filesDir`；环境变量 `PYTHONHOME`/`PYTHONPATH`/`SSL_CERT_FILE`/`PATH`/`HOME`/`TMPDIR` 注入属消费方环境引导层。
- 已知限制（消费方文档必须写明）：pip 安装的 CLI 脚本在 filesDir 不可直接 exec（SELinux）；sdist 不可安装。

### 4.3 发布（两段式）

- GitHub Release 先行（⬜M1-T7）：tag `v<pyver>` 触发，归档 tar.gz + sha256，lock 回写 `status=released`。
- Maven Central 随后（⬜M3 首发；发布面代码已就绪 ✅）：`gradle publishToMavenCentral -PCLI_VERSION=<ver> -PRELEASE=true` + 用户级凭据；`-PAUTOMATIC_RELEASE=true` 才自动 Publish（`publish.gradle.kts:46-56`）；lock 回写 `mavenCentral.published=true`。
- 防误发三道闸：`RELEASE=false` 默认（`gradle.properties:20`）→ Token 缺失即禁用（`publish.gradle.kts:72-73,133-139`）→ 签名材料只在用户级配置。

---

## 5. 测试途径与部署策略

### 5.1 测试途径（详见 [`overall-test-cases.md`](./overall-test-cases.md)）

| 层 | 手段 | 状态 |
|---|---|---|
| 静态门 | `node --check` / `bash -n`（CI + 本地） | ✅ |
| 配置门 | `gradle :python-cli:tasks`（无 `.so` 必须可配置） | ✅（TC-01） |
| 构建门 | `gradle :python-cli:assembleDebug` → AAR 存在 | ✅（TC-02，产物实测在 `python-cli/build/outputs/aar/`） |
| 语义门 | 退出码纪律（provision 未投放=2；fetch/build SCAFFOLD=2） | ✅（TC-05/06/07） |
| 卫生门 | `git status --porcelain` 无 jniLibs/assets 条目 | ✅（TC-09） |
| 门禁全链 | 真实二进制过七项门禁 | ⬜M1（无二进制可测） |
| 真机探针 P1–P6 | PTY 内回程 | ⬜M2（规划 §7.1） |

### 5.2 部署（发布）策略

- **发布物**：AAR（`jni/arm64-v8a/libpython_cli.so` + 壳脚本 ⬜M1 + `assets/python-bridge-tools/` ⬜M1）与 GitHub Release 归档（tar.gz + `.sha256` ⬜M1-T7）。
- **顺序**：GitHub Release 先行 → Maven Central（M3）→ lock 双回写（`status` / `mavenCentral.published`）。
- **可复现（G4）**⬜M1：干净 runner 单条 workflow 重出同口径产物（缓存：ccache + OpenSSL/sqlite 构建缓存，首轮耗时 ⬜ 实测后定）。

---

## 6. 与规划/文档的不一致 + 缺陷登记（评审必读）

| # | 项 | 事实 | 影响 | 处置建议 |
|---|---|---|---|---|
| 1 | CI 退出码断言在 `bash -e` 下不可达 | workflow:34-40 先执行 `node tools/provision.mjs --check` 再 `code=$?`；GitHub Actions 默认 `bash --noprofile --norc -eo pipefail`，命令以 2 退出时 shell 在 `code=$?` 前终止 ⇒ 步骤直接失败 | 断言语义（区分 2 与其它非零）从未生效；症状恰好也是「红」，掩盖缺陷 | → **002-building-workflow FR-002-004 接办**（`|| code=$?` 模式，2026-11-02 立项，workflow 随本批 dev 重写） |
| 2 | `VERSION_NAME=0.1.0` 与 `CLI_VERSION=3.14.10` 双版本字段并存 | 坐标版本唯一取 CLI_VERSION（两处覆写）；`VERSION_NAME` 仅 vanniktech `pomFromGradleProperties` 隐式消费 | 读者可能误取 0.1.0 为制品版本 | 删除 `VERSION_NAME` 或注释声明其仅 pom 元数据 |
| 3 | 仓内无 Gradle Wrapper | 仅 CI 钉 9.4.1；本地版本漂移无约束 | 新成员环境不可复现 | M1 前提交 wrapper 或 README 声明最低版本 |
| 4 | CI 未显式 setup-node | provision/fetch 依赖 runner 预装 Node；规划 §9 装机清单要求 Node 20 | runner 镜像变更即断 | → **002-building-workflow T1.2 接办**（显式 `actions/setup-node`，随本批 dev） |
| 5 | 规划 §5 的 `libpip*.so` 壳脚本 vs 现行 provision 白名单 | 现行 `--check` 会把 jniLibs 内任何第二个 `.so`（含壳脚本）判不合格；规划 §6 已把「壳脚本白名单扩展」列为 M1-T6 | M1 落地时必须同步扩白名单，否则壳脚本过不了自检 | → **001-building FR-001-033 接办**（随本批 dev 实现白名单扩展 + 壳脚本内容校验） |
| 6 | `gradle.properties.local.example` 未列 `signing.keyData` | `publish.gradle.kts:85-88` 支持内存 PGP 通道 | 模板与代码面不一致（可用但未暴露） | 发布 runbook 时统一 |
