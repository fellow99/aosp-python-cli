# 000-scaffold — 模块技术方案（plan.md，as-built）

> **性质**：**实现特定**。回答 000-scaffold 的「怎么做」：真实文件路径、依赖版本、lock 字段模型、工具接口契约、实现策略与文件清单。
> **成对文档**：功能规格见 [spec.md](./spec.md)（FR-000-001…042 的**唯一权威定义处**，本文件逐条交叉引用，不重复定义、不改编号）；任务分解见 [tasks.md](./tasks.md)（全部勾选 ✅）；用例见 [test-cases.md](./test-cases.md)（TC-01…09 已执行）。
> **依据**：源码 ✅实测（行号取 **2026-11-02 快照**，仅作定位线索）· [`../docs/000-工程规划.md`](../../docs/000-工程规划.md)（规划 §；M1+ 内容标 ⬜规划）· [`../constitution.md`](../constitution.md)（C1–C8/S1–S8）。
> **版本**：v1.0 · 2026-11-02 · 状态：**已实现（scaffold 级）**——Gradle 骨架、exec 门禁 provision、draft lock、骨架脚本、配置期 CI；`libpython_cli.so` 本体不存在（M1 ⬜）。

---

## 1. 技术上下文

### 1.1 运行环境与工具链版本

| 项 | 值 | 证据 |
|---|---|---|
| 构建编排 | Gradle **9.4.1**（CI `gradle/actions/setup-gradle@v4` 钉定；**仓内无 wrapper** ⚠️） | `.github/workflows/build-python-cli-android.yml:26-29` |
| Android 插件 | AGP **9.2.1**（`gradle/libs.versions.toml` 唯一版本项） | 同文件 |
| 发布插件 | `com.vanniktech.maven.publish.base` **0.37.0**（pluginManagement 直载，非 buildscript 依赖） | `settings.gradle.kts:3-5` |
| JDK | Temurin **21** | workflow:19-24；test-cases 头注 |
| host JS 运行时 | Node（本机 v24.7.0 实测可跑全部工具）；CI 未显式 setup-node ⚠️ | workflow:34-48 |
| 模块 SDK 面 | `compileSdk 36` · `minSdk 24` · `abiFilters=[arm64-v8a]` · `useLegacyPackaging=true` | `python-cli/build.gradle.kts:22-42` |
| 目标版本（draft） | CPython **3.14.0** = `CLI_VERSION`（未设置任何一处构建即失败） | `gradle.properties:8`；`python-cli/build.gradle.kts:16-17` |

### 1.2 依赖（零第三方）

- **工具链零 npm 依赖**：`tools/provision.mjs` 与 `scripts/fetch-python-cli-source.mjs` 只用 `node:fs/path/crypto/url` 内置模块——CI 与任意机器「一个 node 就能跑」。
- **Gradle 侧依赖为零**：模块无 `dependencies {}`；仓库仅插件（AGP + vanniktech）。`dependencyResolutionManagement` 用 `FAIL_ON_PROJECT_REPOS` 锁死仓库源（`settings.gradle.kts:8-14`）。

---

## 2. 宪法合规检查（逐条，详见 [`../overall-plan.md`](../overall-plan.md) §2 全表）

| 条目 | 落点（本模块内） | 状态 |
|---|---|---|
| C1 fetch 不改源 | fetch 骨架注释 + exit 2；lock `builtFrom.source="…unmodified…"` | ✅纪律固化（逻辑 M1） |
| C2 lock 唯一事实源 | `provision.mjs:33,42,177-193` 读锁、未登记组合报错 | ✅ |
| C3 二进制不入库 | `.gitignore:23-24`；TC-09 | ✅ |
| C4 门禁强制 | 七项门禁 + 拒绝投放 + 显式放行告警 | ✅ |
| C5 发布卫生 | `RELEASE=false` 默认 + 任务禁用 + 凭据用户级 + draft 不伪造 | ✅ |
| C6 未实测标 ⬜ | lock TBD 字段；M1 设计不冒充现状 | ✅ |
| C7 许可合规 | `THIRD-PARTY-NOTICES.md`；POM MIT | ✅ |
| C8 先改文档再改实现 | 规划版本头 + git `docs(planning)` 提交序 | ✅ |

---

## 3. 研究发现（为什么这样建）

1. **exec 型门禁必须与 dlopen 库门禁分家**（沿用 aosp-node-pty 的解析器骨架，改判据）：PTY 仓要求 `PT_INTERP=0`，本仓要求**恰 1 个且内容为 `/system/bin/linker64`**；依赖门禁从「必须含 libnode.so」变为**白名单制**；无 NAPI 门禁。三处差异在 `provision.mjs:8-16` 头注释中成文，解析函数 `parseElf()`（`:58-130`）保留「极简 ELF64 小端」同款实现并新增 interp 内容读取（`:83-90`）。
2. **版本号不能落在构建脚本里**：`CLI_VERSION` 由命令行属性注入（多版本发布 `-PCLI_VERSION=<ver>`），模块与发布面对其缺失做 fail-fast（`python-cli/build.gradle.kts:16-17`、`publish.gradle.kts:37-38`），并用 afterEvaluate 反射覆写 publication 版本双保险（`:19-26`）——因为 AGP 9 下 vanniktech 的 publication 对象类型经反射访问最稳（`publish.gradle.kts:20-32` 的 `mp()` 反射 helper）。
3. **draft 必须能被工具识别**：`provision.mjs:141-142` 以「sha256 是否 64 位十六进制、size 是否 >0」判定有无锁值，而非读 `status` 字段——即使 `status` 被误改，空哈希也不会被当作校验通过（防御性设计，S5）。
4. **配置期 CI 的立足点**：AGP 在无 `jniLibs` 内容时配置/任务求值仍需成功（FR-000-005），这使「先骨架后产物」的开发顺序可行；TC-01/TC-02 实测证明（`python-cli-debug.aar` 已产出，内含 4 个容器条目、无 jni/assets）。
5. **scaffold 脚本选择 exit 2 而非 exit 0**：接口冻结期让「成功」不可能被伪造——CI/人拿到 0 才是真完成（M1），2 = 明确的未实现信号（S1/S7）。

---

## 4. 数据模型（`python-cli.lock.json` 逐字段，53 行 draft 实测）

### 4.1 顶层

| 字段 | 类型 | 现值 | 语义 | 关联 FR |
|---|---|---|---|---|
| `$comment` | string | 英文说明 | 声明唯一事实源地位 + 二进制不入库 + draft 占位性质 | FR-000-010 |
| `active` | object | `{version:"3.14.0", abi:"arm64-v8a"}` | 工具默认选取的版本/ABI（`provision.mjs:185-186`） | FR-000-030 |
| `releases` | array | 1 条 | 全部已知版本记录（多版本并存，`--version/--abi` 可选） | FR-000-010 |
| `matrix` | object | 见 4.4 | 仓库级门禁参数（白名单、ABI、打包口径） | FR-000-012 |

### 4.2 `releases[i]` 字段表（现值 = draft）

| 字段 | 类型 | 现值 | 语义 | 关联 FR |
|---|---|---|---|---|
| `version` | string | `"3.14.0"` | = CPython 上游版本；= Maven 坐标 version | FR-000-003 |
| `abi` | string | `"arm64-v8a"` | 单一 ABI | FR-000-002 |
| `androidApi` | number | `24` | 交叉编译目标 API（build 脚本 `--api` 默认同值） | FR-000-002 |
| `name` | string | `"libpython_cli.so"` | 产物文件名（`lib*.so` 是打包识别前提） | FR-000-034 |
| `size` | number | `0` | **draft 如实空**；首产回写实测字节数 | FR-000-011 |
| `sha256` | string | `""` | **draft 如实空**；首产回写 64 位十六进制 | FR-000-011 |
| `builtFrom.source` | string | "Python-<ver>.tgz (python.org), unmodified; PEP 738 …" | 源出处 + 不改源声明 | C1 |
| `builtFrom.extensionModules` | string | "STATIC (Modules/Setup.local *static*)…" | 静态扩展决策 | 规划 D1 ⬜ |
| `builtFrom.stdlib` | string | "Lib/ pure-python stdlib + ensurepip wheels + CA bundle …" | 随包数据构成 | 规划 §5 ⬜ |
| `builtFrom.ndk` | string | `"TBD (first CI build pins NDK line + version)"` | 未钉版（C6） | FR-000-011 |
| `builtFrom.flags` | string | `"TBD: -Wl,-z,max-page-size=16384; llvm-strip --strip-unneeded"` | 未实测（C6） | FR-000-011 |
| `gates` | object | 7 键全 `true` | 见 4.3 | FR-000-012 |
| `mavenCentral.coordinates` | string | `"io.github.fellow99:python-cli:3.14.0"` | 发布坐标镜像 | FR-000-003 |
| `mavenCentral.published` | bool | `false` | 只能由真实发布事件回写 | C5 |
| `status` | string | `"draft"` | `draft`→`released` 单向（M1-T7 回写） | FR-000-011 |

> 无 `pairedRuntime` 字段（FR-000-013）：代码侧 `rel.pairedRuntime?.coordinates`（`provision.mjs:196,263`）是沿自 pty 仓的可选兼容读取，python-cli 的 lock 永不设置该字段——输出回退为「无配对信息」、properties 不写 `paired.runtime` 行。

### 4.3 `gates` 七键（与 provision 门禁一一对应）

| 键 | 门禁 | 现值 | 工具落点 |
|---|---|---|---|
| `eTypeEtDyn` | ① `e_type==3` | `true` | `provision.mjs:146` |
| `ptInterpSystemLinker` | ② PT_INTERP 恰 1 且 = `/system/bin/linker64` | `true` | `:148-150` |
| `eMachineAArch64` | ③ `e_machine==183` | `true` | `:151` |
| `neededWhitelist` | ④ DT_NEEDED ⊆ `matrix.allowedNeeded` | `true` | `:152-155` |
| `sha256Match` | ⑤ 摘要一致（draft 仅记录） | `true` | `:156-157` |
| `sizeMatch` | ⑥ 大小一致（draft 仅记录） | `true` | `:158-159` |
| `pageAlign16k` | ⑦ PT_LOAD min align ≥ 0x4000 | `true` | `:160-167` |

### 4.4 `matrix`

| 字段 | 现值 | 语义 |
|---|---|---|
| `minSdk` | `24` | 与模块一致 |
| `abi` | `["arm64-v8a"]` | 单架构红线 |
| `allowedNeeded` | `["libc.so","libm.so","libdl.so","libz.so","liblog.so"]` | 依赖白名单（仅系统库；`provision.mjs:184` 读取，缺失时回退内置 4 项） |
| `execPackaging` | `"useLegacyPackaging=true (extractNativeLibs=true) …"` | 打包口径成文 |
| `note` | 引擎 `libc++_shared.so` 出现时的处置提示 + 无配对声明 | 决策备忘 |

### 4.5 写入规则

- M0（现状）：**任何人不得手填 `size`/`sha256`/`ndk`/`flags` 的"貌似实测"值**（S5）。
- M1-T7（⬜规划 §8/§10）：CI 首产回写四值 + `status="released"`；换 CPython 版本 = lock **增项**（`releases` 追加）+ `active` 切换 + CI 重建，不覆盖旧记录。

---

## 5. 接口契约

### 5.1 `tools/provision.mjs`（276 行）

| 参数 | 语义 | 行为 |
|---|---|---|
| `--check` | 校验已投放产物 | 目标 `python-cli/src/main/jniLibs/<abi>/<name>` 不存在 ⇒ **exit 2**（文案「未投放」）；存在 ⇒ 七项门禁 + jniLibs 兄弟 `.so` 白名单检查，全过 exit 0 否则 2（`:211-228`） |
| `--out <dir> --from <so>` | 投放 | 先过七项门禁，不合格 ⇒ **exit 2** 且不落盘（`:233-238`）；过 ⇒ 复制到 `<out>/<abi>/<name>` + 禁入检查（`libnode.so`）+ 写 `META-INF/python-cli.properties`（`:240-268`） |
| `--inspect <so>` | 只读体检 | 打印七项 ✔/✘，exit 0/2，不写任何文件（`:199-206`） |
| `--version <v>` `--abi <a>` | 覆盖 `active` | lock 无该组合 ⇒ 抛错（**exit 1**）并列出现有记录（`:185-193`） |
| `--allow-page-align-4k` | 显式放行⑦ | 打印「仅 bring-up，上架/16 KB 设备不合格」警告（`:162-167`） |

**退出码**：`0` 全过 · `2` 门禁不合格/未投放 · `1` 用法/IO/lock 缺失（`:24,271-276` 顶层 try/catch）。
**properties 输出**（`src/main/resources/META-INF/python-cli.properties`）：`tool.version` / `abi` / `name` / `size` / `sha256` / `provisionedAt`（ISO 时间），paired 行按 lock 有无条件写入（`:253-267`）。

### 5.2 `python-cli.lock.json` 字段契约

工具消费的键：`active.{version,abi}`（默认目标）、`releases[].{version,abi,name,size,sha256,status}`、`matrix.allowedNeeded`；其余键（`builtFrom.*`、`gates`、`mavenCentral`、`androidApi`）是**记录面**，M0 工具不读取——它们的服务对象是发布审计与 M1 的 CI 回写。

### 5.3 `scripts/fetch-python-cli-source.mjs`（54 行，骨架）

- 参数：`--python <ver>`（必需）· `--out <dir>`（默认 `.dist/src`）· `--help`（exit 0；缺 `--python` ⇒ exit 1）。
- 现行为：打印三条 SCAFFOLD 计划（输入 URL 模板 `https://www.python.org/ftp/python/<ver>/`、输出 `<out>/cpython/`）后 **exit 2**。
- M1 契约（⬜规划 §4.1）：下载 `Python-<ver>.tgz` → sha256 校验 → 解压 → 记录出处；**只做这三件事，不改源**。

### 5.4 `scripts/build-python-cli-android.sh`（58 行，骨架）

- 参数：`--python <ver>` · `--api <api>`（默认 24）· `--src <cpython 源码树>` · `--ndk <路径>` · `--out <dir>`；缺任一必需项或未知参数 ⇒ usage + **exit 1**。
- 现行为：打印 SCAFFOLD 计划（产物 `$OUT/libpython_cli.so` + stdlib assets）后 **exit 2**；头注释固化六条纪律（PEP 738 / 静态扩展 / OpenSSL+CA / 16KB / exec ELF / lib*.so 命名）。
- M1 契约（⬜规划 §4.2）：env → host python 校验 → configure（`--host=aarch64-linux-android`、`--with-build-python`、`LDFLAGS=-Wl,-z,max-page-size=16384`、Setup.local 静态段、禁用 tkinter/curses/readline/dbm/_test*）→ make → strip → stdlib 收集 → pip/ensurepip/CA 归集 → BUILD/FETCH-METADATA。

### 5.5 Gradle 面（`settings.gradle.kts` 21 行 · `python-cli/build.gradle.kts` 45 行 · `publish.gradle.kts` 139 行）

- 坐标：`io.github.fellow99:python-cli:$CLI_VERSION`（`publish.gradle.kts:36-39`）。
- Central Portal：`publishToMavenCentral(false, validation)`，`-PAUTOMATIC_RELEASE=true` ⇒ `PUBLISHED`（`:45-56`）；`signAllPublications`（`:57`）；release 单 variant + sources jar、无 javadoc（`:59-69`）。
- POM：`pomFromGradleProperties` 读 `POM_*`（`gradle.properties:9-18`）；`generatePomFile*` 任务 `doLast` 补 `<scm><url>`（`:116-131`）。
- 发布门禁：`signMaven*/publishToMavenCentral` 在 `RELEASE!=true` 或 Token 缺失时 `enabled=false`（`:133-139`）。

---

## 6. 实现策略

### 6.1 架构模式

- **lock 驱动的单向数据流**：lock（事实）→ provision（校验+投放）→ Gradle（打包）→ publish（发布）；每一步只读上游、只写自己的产物。
- **容器模块模式**：`:python-cli` 无源码，构建逻辑全部在根级共享脚本（`publish.gradle.kts` apply 进模块），模块文件只留「必须随模块走」的口径（packaging/SDK/版本）。

### 6.2 关键算法

- **极简 ELF64 解析**（`parseElf()`）：ELF 头 → 程序头表（PT_INTERP=3 计数与内容、PT_LOAD=1 对齐收集）→ 节头表（`.dynamic` 16 字节项扫描 tag 1=NEEDED / 14=SONAME，`.dynstr` 取名）。只回答门禁要问的七个问题，不做完整解析（`:58-130`）。
- **draft 容错判据**：`sha256.length===64` 与 `size>0` 决定「比对」还是「记录」（`:141-142,156-159`）。

### 6.3 错误处理

| 失败面 | 行为 |
|---|---|
| lock 文件缺失 / JSON 损坏 | 抛错 → 顶层 catch → stderr + **exit 1**（`:177-179,271-276`） |
| 请求未登记 version/abi | 明确报错并列出现有记录 → exit 1（`:188-193`） |
| 非 ELF / 大端 | 解析器抛「不是 ELF 文件 / 只支持小端」→ 门禁 ① 位记录失败 → exit 2（`:59-61,135-138`） |
| 门禁任一不过 | 拒绝投放 → exit 2（`:235-238`）；`--check` 场景目录脏同样 2（`:226-228`） |
| 投放后发现禁入库 | 抛错 → exit 1（注：发生在复制之后，属防御性二道闸；`--check` 才是投放前的目录白名单检查，`:246-250`） |

---

## 7. 测试考虑（呼应 [`test-cases.md`](./test-cases.md) / [`../overall-test-cases.md`](../overall-test-cases.md)）

- TC-01/02/03（配置与坐标）、TC-04/08（静态门）、TC-05/06/07（退出码语义）、TC-09（卫生）——9/9 已执行 ✅（2026-11-02）。
- **当前不可测**（如实）：七项门禁对真实二进制的判定（无产物）；`--out/--from` 投放全链（同因）；`--allow-page-align-4k` 放行告警（无产物）。M1 首产后按 `overall-test-cases.md` L5 立项。
- ⚠️ 已知缺陷：CI 的退出码断言在 `bash -e` 下不可达（详见 [`../overall-plan.md`](../overall-plan.md) §6 #1）；本地与 CI 的语义（TC-05 手工执行）不受影响。

---

## 8. 文件清单（真实行数，2026-11-02 快照 ✅）

| 文件 | 行数 | 职责 | 实现 FR |
|---|---|---|---|
| `settings.gradle.kts` | 21 | 根工程 + 插件管理 + 单模块 | FR-000-001 |
| `gradle/libs.versions.toml` | 5 | AGP 9.2.1 版本目录 | FR-000-002（支撑） |
| `gradle.properties` | 20 | 元数据 + CLI_VERSION + RELEASE=false | FR-000-003 · C5 |
| `gradle.properties.local.example` | 8 | 用户级凭据模板 | C5 |
| `publish.gradle.kts` | 139 | 发布面（coordinates/Portal/签名/POM/门禁） | FR-000-003 · C5 |
| `python-cli/build.gradle.kts` | 45 | 容器模块（packaging/SDK/版本覆写） | FR-000-002/003/004/005 |
| `python-cli.lock.json` | 53 | 唯一事实源（draft） | FR-000-010~013 |
| `tools/provision.mjs` | 276 | 投放 + 七项 exec 门禁 | FR-000-030~036 |
| `scripts/fetch-python-cli-source.mjs` | 54 | fetch 骨架（exit 2） | S7 |
| `scripts/build-python-cli-android.sh` | 58 | 交叉编译骨架（exit 2） | S7 |
| `.github/workflows/build-python-cli-android.yml` | 50 | 配置期 CI | FR-000-040~042 |
| `.gitignore` | 31 | 不入库纪律 | C3 |
| `python-cli/THIRD-PARTY-NOTICES.md` | 17 | 第三方许可 | C7 |
| `README.md` / `README_zh.md` | 86 / 77 | 中英总览 | — |
| `LICENSE` | 21 | MIT | C7 |

---

## 9. 与规划/文档的不一致 + 缺陷登记（评审必读）

| # | 项 | 事实 | 归属 |
|---|---|---|---|
| 1 | CI 退出码断言不可达 | workflow:34-40：GitHub Actions 默认 `bash -eo pipefail`，`node tools/provision.mjs --check` 退出 2 时 shell 在 `code=$?` 前终止，断言分支永不执行；步骤「红」的症状掩盖了断言从未生效的事实 | M1-T7 重写流水线时修复（`|| code=$?` 模式）；本批不改 workflow（边界约束） |
| 2 | `VERSION_NAME=0.1.0` 残留 | 与 `CLI_VERSION=3.14.0` 并存；坐标版本唯一取 CLI_VERSION，`VERSION_NAME` 仅 vanniktech pom 属性隐式消费 | 建议删除或加注；属 gradle.properties 一行改动，超出本批 specs-only 边界，仅登记 |
| 3 | 规划 M1 的 `libpip*.so` 壳脚本与现行白名单冲突 | 现行 `--check` 把 jniLibs 内任何第二个 `.so` 判不合格；规划 §6「M1 新增④」已登记壳脚本白名单扩展 | M1-T6 实现时同步扩白名单（规划已覆盖，无文档缺口） |
| 4 | lock `gates` 七键在 draft 期全为 `true` | 语义是「门禁项已启用」而非「已验证通过」；工具实际以字段存在性/哈希空值判 draft（`:141-142`），不受误导 | 保持；M1 回写时可在 `$comment` 补一句键义说明 |

> [NEEDS CLARIFICATION]（≤3，全部为实现层待办、不影响规格成立）：① `provision.mjs:263` 的 `paired.runtime` 属性行在 python-cli 永不触发（lock 无该字段）——是否删除该兼容分支，M1 时定；② workflow 的 provision 步骤预期文案与 `bash -e` 行为的最终修法（§9 #1）属 M1-T7；③ `VERSION_NAME` 去留（§9 #2）待维护者拍板。
