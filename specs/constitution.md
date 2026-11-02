# constitution.md —— `aosp-python-cli` 工程宪法（治理原则）

> 本文件是 `aosp-python-cli` 的**最高约束**。任何 `spec.md` / `plan.md` / 实现 / 评审都必须先过这一关。
> 原则**不是发明的，而是从已落地的代码与文档中提取的**——每条末尾给出依据（源码 `path:line` 取 2026-11-02 快照）。
> - 权威规划文档：[`../docs/000-工程规划.md`](../docs/000-工程规划.md)（v2.1，下称「规划 §」；其 §13「与工作区纪律的对应」是本表的规划侧母本）
> - 版本：v1.0 · 2026-11-02 · 状态：**生效**
> - 适用：`python-cli/`（AAR 容器）· `tools/` · `scripts/` · `.github/` · `specs/` · `docs/`

---

## 一、八条不可协商的原则

### C1. fetch 不改源（Zero-Patch Fetch）

**构建输入一律取官方原件；Android 专用配置经构建系统参数注入，绝不打补丁。**

- fetch 只做「下载、解压、记录出处与 sha256」；源码树保持 unmodified。
- 交叉编译走 PEP 738 官方支持路径（`configure --host=…`），禁第三方 fork / 源码补丁（规划 D5 反面列）。
- 依据：`scripts/fetch-python-cli-source.mjs:5-12`（「源码不改（工作区纪律：fetch 不打补丁）」）；`python-cli.lock.json` `builtFrom.source`（"unmodified"）；规划 §13 行 1。

### C2. lock 唯一事实源（Single Source of Truth）

**版本 + 大小 + SHA-256 + 门禁 + 出处，只记录在 `python-cli.lock.json` 一处；其它文件只能引用。**

- 工具启动即读 lock；lock 里没有的 version/abi 组合必须报错，不得猜。
- 坐标版本唯一取 `CLI_VERSION`（= 上游 CPython 版本，独立 semver，无 node 系配对）。
 - 依据：`tools/provision.mjs:5,177-193`；`python-cli.lock.json` `$comment`；`gradle.properties:4-8`；规划 §8。

### C3. 二进制不入库（Binaries Never Committed）

**`.so` 与随包 assets 树一律不进 git；由 CI 构建、工具投放；lock 入库（diff 即审计）。**

 - 依据：`.gitignore:22-24`（`python-cli/src/main/jniLibs/**/*.so`、`python-cli/src/main/assets/**`）；`python-cli/build.gradle.kts:10`（「二进制/随包树不入库」）；lock `$comment`（"Binaries are NOT committed"）。

### C4. 门禁强制，不静默降级（Gates Enforced, Never Silently Degraded）

**门禁不合格 ⇒ 拒绝投放并以退出码 2 终止；任何放行必须是显式传参且打印告警。**

- 七项 exec 门禁（ET_DYN / PT_INTERP=系统 linker64 / AArch64 / DT_NEEDED 白名单 / sha / size / 16KB）任一不过即 `exit 2`。
- 唯一放行通道 `--allow-page-align-4k` 必须显式传入，并打印「仅 bring-up，上架/16 KB 设备不合格」警告。
- jniLibs 兄弟文件白名单：目录内只允许本工具二进制；`libnode.so` 永久禁入。
- 依据：`provision.mjs:146-167,221-228,235-238,246-250`；规划 §6/§12；README「Lock & verification」退出码段。

### C5. 发布卫生（Release Hygiene）

**默认绝不发布：`RELEASE=false`；凭据只存用户级配置；draft 不伪造哈希。**

- `RELEASE=false`（默认）或缺 Token/GPG 时，Central 发布与签名任务一律禁用——防误发。
- Token/GPG 只放 `~/.gradle/gradle.properties`（用户级，不提交）；仓内只有模板 `gradle.properties.local.example`。
- draft 阶段 lock 的 `size=0`、`sha256=""`、`ndk="TBD"` —— **如实空缺，不编造**；首产实测后回写。
- 依据：`gradle.properties:19-20`；`publish.gradle.kts:12-14,71-73,133-139`；`python-cli.lock.json`（draft 值）；规划 §12「发布卫生」。

### C6. 未实测标 ⬜（Unverified Is Unproven）

**未经真机/真实流水线验证的结论，一律标 ⬜（或「规划」），绝不当作已定事实引用。**

- 规划文档纪律原文：「⬜ 为未实测项，绝不当作已定事实引用」；lock 的 TBD 字段同口径。
- 本套 specs 延续：M1+ 的设计（交叉编译、assets 物化、真机探针、发布）全部标 ⬜规划。
- 依据：`docs/000-工程规划.md` 版本头「纪律」行；规划 §11 风险表（R1–R8 多处 ⬜）；本目录各文档标记口径。

### C7. 许可合规（License Compliance）

**本仓 MIT；随包分发的第三方组件（CPython PSF-2.0、pip MIT、OpenSSL、CA bundle）必须有清单与出处，完整许可全文随 Release 归档。**

- 依据：`LICENSE`（MIT，Copyright 2026 fellow99）；`python-cli/THIRD-PARTY-NOTICES.md`（逐项列出 + 纪律两条）；`gradle.properties` `POM_LICENCE_*`；规划 §12「许可」。

### C8. 先改文档，再改实现（Docs Before Code）

**规划基线（`docs/000-工程规划.md`）是唯一事实源；实现与它偏差时随里程碑回写规划，而不是让文档烂掉。**

- 规划版本头原文：「本文件是**唯一规划基线**，变更走"先改本文件，再改实现"」「实现与本文件的偏差随各里程碑直接回写本文件」。
- specs 只做细化与验收：as-built 描述已建成事实；规划内容只能以「规划引用 ⬜」出现，不得把规划当现实。
- 依据：`docs/000-工程规划.md:3-4`；git 历史（三笔 `docs(planning)` 先于/伴随实现提交，2026-11-02）。

---

## 二、工程规约（从现有代码提取，实现必须一致）

| # | 规约 | 依据 ✅ |
|---|---|---|
| S1 | **退出码三值纪律**：工具只允许 `0`（全过）/ `2`（门禁不合格·未投放·SCAFFOLD）/ `1`（用法/IO 错误）；三件工具（provision / fetch / build）一致 | `provision.mjs:24` · `fetch-*.mjs:15` · `build-*.sh`（尾部 `exit 2`） |
| S2 | **AAR 容器零源码**：`:python-cli` 不含任何 Kotlin/Java 源，只作原生件与 assets 的容器 | `python-cli/build.gradle.kts:11`（「本模块不含任何 Kotlin/Java 源」）；`src/main` 实测为空 |
 | S3 | **`useLegacyPackaging=true` 不可回归**：exec 型必须物理落盘 `nativeLibraryDir`；注释必须保留理由 | `python-cli/build.gradle.kts:40-42`（注释含 ENOENT 与 SELinux 理由） |
 | S4 | **版本唯一源 `CLI_VERSION`**：未设置即构建失败（fail-fast），publication 版本反射覆写双保险 | `python-cli/build.gradle.kts:16-17`（`?: error(...)`）· `:19-26`（afterEvaluate 覆写）· `publish.gradle.kts:37-38` |
| S5 | **draft 不伪造哈希**：无实测值就留空/0/TBD，工具对 draft「只记录不比对」并打印警示 | lock draft 值 · `provision.mjs:141-142,156-159,197` |
| S6 | **jniLibs 白名单**：只允许 `libpython_cli.so`；`libnode.so` 禁入（`BANNED_IN_AAR`）；`--check` 同时查兄弟文件 | `provision.mjs:36-38,221-228,246-250` |
| S7 | **脚本骨架先固化接口**：未实现的管线以「用法 + 纪律注释 + SCAFFOLD 退出码 2」存在，接口（参数名/默认值/输出目录）先冻结 | `fetch-*.mjs`（`--python`/`--out`，默认 `.dist/src`）· `build-*.sh`（`--python/--api/--src/--ndk/--out`，API 默认 24） |
| S8 | **提交纪律**：Conventional Commits；本仓为 workspace 的 submodule，父工程不随本仓提交 | `specs/000-scaffold/tasks.md` T8.3 · git 历史（`feat(scaffold)`/`docs(planning)` 前缀） |

---

## 三、证据纪律（Evidence Discipline）

全文使用以下标记，**不要把推断当实测**：

| 标记 | 含义 |
|---|---|
| ✅ **已实现/实测** | 本仓库内可复核的一手证据（源码 `path:line`、实测 AAR、退出码记录） |
| ⬜ **规划** | `docs/000-工程规划.md` 有设计、仓内无实现（M1+）；**不得当作现状引用** |
| ⚠️ **冲突/风险** | 文档与脚手架不一致、或存在已知硬缺陷（逐条登记在 `000-scaffold/plan.md` §9） |

两条纪律：

1. `⬜规划` 的结论不得作为本仓对外承诺的依据——「CI 实际钉住的 CPython 版本为准」（README 版本节、规划 §2）。
2. 每条非显然结论必须能回溯到源码 `path:line` 或规划 § 号；回溯不到的写入处即删。

---

## 四、合规红线（Release Gate，规划 §12 落点）

| # | 红线 | 处置（现状） |
|---|---|---|
| G1 | ELF 形态与依赖白名单（门禁①–④⑦） | provision 硬校验 ✅ + CI（M1 起全流水线）⬜ |
| G2 | 静态扩展：产物不携带独立扩展 `.so`；stdlib 资产内无 `.so` | ⬜M1-T6（规划 §6）；门禁工具已具备拦截框架 ✅ |
| G3 | 不入库：jniLibs `.so` 与 assets 树被 git 忽略 | `.gitignore` ✅ + review |
| G4 | 可复现：干净 runner 单条 workflow 重出同口径产物 | ⬜M1（规划 §12） |
| G5 | 许可：CPython PSF-2.0 + pip(MIT) + OpenSSL + wheel 许可清单随包 | `THIRD-PARTY-NOTICES.md` ✅；全文随 Release 归档 ⬜ |
| G6 | 发布卫生：`RELEASE=false` 默认；Token/GPG 不入库 | `gradle.properties` + `publish.gradle.kts` 任务禁用 ✅ |

---

## 五、评审清单（Reviewer Checklist）

评审任何 `spec.md` / `plan.md` / PR 时逐条问：

- [ ] 构建输入是否仍为官方原件、无补丁？（C1）
- [ ] 版本/哈希/门禁是否仍只以 lock 为准？（C2）
- [ ] 有没有把二进制或 assets 树提交进来？（C3）
- [ ] 门禁有没有被绕过或静默降级？放行是否显式且告警？（C4）
- [ ] 发布开关是否仍默认关闭？凭据是否只在用户级？（C5）
- [ ] 新结论是否区分了 ✅实测 与 ⬜规划？（C6）
- [ ] 第三方许可清单是否同步？（C7）
- [ ] 与规划的偏差是否已回写规划文档？（C8）
- [ ] 工具退出码是否仍是 0/2/1 三值？（S1）

---

## 六、变更流程

1. 改制品口径（门禁/打包/版本规则）⇒ **先改 `docs/000-工程规划.md`**（C8），再改实现；specs 的 `overall-*` 与 `000-scaffold/plan.md` 同步回写。
2. 改 `python-cli.lock.json` ⇒ 必须重跑 `node tools/provision.mjs --check`（投放态）或确认退出码 2 语义（未投放态）；`status` 与 `mavenCentral.published` 只能由真实事件回写。
3. 换 Gradle/AGP/vanniktech 版本 ⇒ `gradle/libs.versions.toml` + `settings.gradle.kts` + CI workflow 三处一致，并在 `specs/TECH.md` §3 版本矩阵登记。
