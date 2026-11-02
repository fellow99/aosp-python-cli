# 规格文档索引 —— `aosp-python-cli`

**项目名称：** `aosp-python-cli`（Maven 坐标 `io.github.fellow99:python-cli`）
**需求：** 多模块：000-scaffold（已完成）· 001-building · 002-building-workflow · 003-cli · 101-pip-integration（后四者 2026-11-02 立项，见规划 §10.2） · 规范文档存放目录：`specs/`
**工程版本：** `3.14.0`（draft；= CPython 上游计划版本，独立 semver，以 CI 实际钉选为准）
**技术栈：** Gradle 9.4.1 + AGP 9.2.1（AAR 容器，arm64-v8a，`useLegacyPackaging=true`）+ vanniktech 0.37.0 发布面 + 纯 Node exec 型 ELF 门禁（`tools/provision.mjs`）+ draft 事实源 `python-cli.lock.json`；M1 立项：PEP 738 交叉编译 + OpenSSL/sqlite vendored（代码本批实现，重编译验证 ⬜ CI）
**文档生成时间：** 2026-11-02 · **最后更新：** 2026-11-02（新增四模块规格）
**as-built 口径：** 只描述**已建成的事实**（M0 脚手架 ✅；M1 代码 ⬜ 本批实现中）；`docs/000-工程规划.md` 中 M1+ 的设计一律以「⬜规划 + § 号」引用，**不把规划当现实**。python 本体二进制**尚未构建**（M1，CI）。

> **权威规划文档是 [`../docs/000-工程规划.md`](../docs/000-工程规划.md)（v2.1）。**
> 本目录是它的 **as-built 收敛/展开版**：只做已建成事实的细化与验收，不复制粘贴规划；实现与规划的偏差登记在 [`overall-plan.md`](./overall-plan.md) §6 与 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §9。
> 新增平台结论必须先写进规划文档，再回到这里引用（宪法 C8）。

---

## 一、文档总览

| 层级 | 分类 | 文档数量 | 说明 |
|---|---|---|---|
| 整体 | 项目级顶层文档 | 5 | `constitution.md` · `ARCHITECTURE.md` · `TECH.md` · `STRUCTURE.md` · `SPECS_CHECKLIST.md` |
| 整体 | 整体规格文档 | 3 | `overall-spec.md` · `overall-plan.md` · `overall-test-cases.md` |
| 模块 | 000-scaffold 工程搭建 | 4 | `spec.md`（既有）· `plan.md`（新增）· `tasks.md` · `test-cases.md` |
| 模块 | 001-building 构建 | 3 | `spec.md` · `plan.md` · `tasks.md`（2026-11-02 立项，⬜） |
| 模块 | 002-building-workflow 构建流水线 | 3 | `spec.md` · `plan.md` · `tasks.md`（⬜） |
| 模块 | 003-cli python 命令行 | 4 | `spec.md` · `plan.md` · `tasks.md` · `test-cases.md`（TC-003-01…17，⬜） |
| 模块 | 101-pip-integration pip 集成 | 4 | `spec.md` · `plan.md` · `tasks.md` · `test-cases.md`（TC-101-01…18，⬜） |
| 索引 | 本索引 | 1 | `README.md` |
 | **合计** | **5 模块目录 / 27 文件** | | 顶层 9 份 + 模块 18 份（2026-11-02 实测 `wc -l` 2252 行，含本 README） |

> **刻意不生成** `API.md` / `overall-api.md` / `overall-data-model.md`（需求方排除）：本仓**不含任何嵌入 API**，无 API 契约面；工具 CLI 契约在 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §5，lock 数据模型（唯一数据实体）在 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §4。

---

## 二、项目级顶层文档

| 文档 | 路径 | 说明 |
|---|---|---|
| **项目宪法** | [constitution.md](./constitution.md) | 8 条不可协商原则（C1 fetch 不改源 · C2 lock 唯一事实源 · C3 二进制不入库 · C4 门禁强制不静默降级 · C5 发布卫生 · C6 未实测标 ⬜ · C7 许可合规 · C8 先改文档再改实现）+ 8 条工程规约（S1–S8）+ 证据纪律 + 合规红线 G1–G6 + 评审清单 + 变更流程（全部从代码与文档**提取**，逐条带依据） |
| **整体架构** | [ARCHITECTURE.md](./ARCHITECTURE.md) | host 构建链 → AAR 容器 → 设备侧运行 ASCII 架构图与数据流；exec 型 vs dlopen 型制品形态对照（PT_INTERP/DT_NEEDED/打包三处相反）；七项门禁实现落点；发布两段式；系统责任分界；M0 缺口表 |
| **技术选型** | [TECH.md](./TECH.md) | 选型总表（**已实现 vs 规划中状态列**：Gradle 9.4.1 / AGP 9.2.1 / vanniktech 0.37.0 / exec 门禁纯 Node / PEP 738 ⬜ / OpenSSL+sqlite vendored ⬜ / CI runner 规格）+ 被否方案（动态扩展、false packaging、版本配对、fork 补丁…）+ 版本矩阵 + 依赖清单 + 6 项风险 |
| **项目结构** | [STRUCTURE.md](./STRUCTURE.md) | 实测目录树（逐文件一行用途 + 真实行数）+ python-cli 模块现状（AAR 解包实证：容器空壳、无 jni/assets）+ 关键配置文件表 + 目录↔模块映射 + 不入库清单 + git 事实（submodule/main/5 commits） |
| **检查清单** | [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) | 规格完成度追踪（P-01…P-09 + 模块 M-01）+ 生成顺序 + 质量检查表 + 未闭合项 |

---

## 三、整体规格文档

| 文档 | 路径 | 说明 |
|---|---|---|
| **整体规格** | [overall-spec.md](./overall-spec.md) | 技术无关（WHAT/WHY，RFC 2119）：系统目的与目标用户、系统边界（**在范围**：构建骨架/事实源/投放门禁/配置期 CI/发布面；**不在范围**：嵌入 API、sdist 与 C 扩展 wheel、tkinter 类 UI 模块、venv、uv 本体、设备侧环境引导）、`FR-000-001…042` 按四域索引（每条带可证伪验收判据与现状）、NFR-1…7、用户故事、里程碑出口 |
| **整体方案** | [overall-plan.md](./overall-plan.md) | 技术上下文（真实文件/版本）、宪法符合性检查表（C1–C8/S1–S8 逐条）、M0↔文件↔FR 映射与 M1 策略映射、横切关注点（门禁 / 物化 / 发布三道防误发闸）、测试途径（六层）、部署（发布）策略、**与规划/文档的不一致 + 缺陷登记 6 项（含 CI 退出码断言缺陷）** |
| **测试用例索引** | [overall-test-cases.md](./overall-test-cases.md) | 六层测试分层（L1 静态门…L6 真机探针）+ [`000-scaffold/test-cases.md`](./000-scaffold/test-cases.md) TC-01…09 逐条索引与执行状态（9/9 ✅，2026-11-02）+ 四条禁止判据 + 快照命令 |

---

## 四、模块 `000-scaffold`（工程搭建）

> 单模块工程：000-scaffold 覆盖全仓骨架（Gradle 骨架 / useLegacyPackaging / lock / exec 门禁 provision / 脚本接口 / 配置期 CI / 卫生与许可）。状态：**已实现（scaffold 级）**；`libpython_cli.so` 本体属 M1（⬜规划，非本模块范围）。

| 文档 | 链接 | 说明 |
|---|---|---|
| 功能规格 | [000-scaffold/spec.md](./000-scaffold/spec.md) | **FR 编号唯一权威定义处**（`FR-000-001…005` 骨架域 · `010…013` 事实源域 · `030…036` 投放门禁域 · `040…042` CI 域）；目的/范围/验收场景（既有文件，保留） |
| 技术方案 | [000-scaffold/plan.md](./000-scaffold/plan.md) | **本批新增（as-built）**：技术上下文（Gradle 9.4.1/AGP 9.2.1/vanniktech 0.37.0/Node/bash）· 宪法合规逐条 · 研究发现（exec 门禁为何与 dlopen 分家、CLI_VERSION fail-fast、draft 容错判据、exit 2 语义）· **数据模型（lock JSON 逐字段表）** · **接口契约（provision CLI 参数与退出码、fetch/build 脚本参数、Gradle 发布面）** · 实现策略 · 文件清单（真实行数）· 与 spec.md FR 逐条交叉引用 · 不一致与缺陷登记 + 3 处 `[NEEDS CLARIFICATION]` |
| 任务拆解 | [000-scaffold/tasks.md](./000-scaffold/tasks.md) | T1–T8 全部勾选 ✅（既有文件，保留） |
| 测试用例 | [000-scaffold/test-cases.md](./000-scaffold/test-cases.md) | TC-01…09 + 2026-11-02 执行记录（9/9 通过）（既有文件，保留） |

### 四.1 新立模块（2026-11-02，全部 ⬜）

| 模块 | spec / plan / tasks / test-cases | 要点 |
|---|---|---|
| [001-building](./001-building/spec.md) | ✅/✅/✅/—（用例内嵌 tasks） | 五源 fetch、交叉编译八步、pip 壳脚本、provision 扩展（assets/manifest/静态性/白名单）；FR-001-001…035 |
| [002-building-workflow](./002-building-workflow/spec.md) | ✅/✅/✅/— | CI 双 Job（gate+release）、退出码断言缺陷修复、归档与 lock 回写物；FR-002-001…009 |
| [003-cli](./003-cli/spec.md) | ✅/✅/✅/✅（TC-003-01…17） | python 命令行为契约 + 探针 P1/P2/P3/P6 用例正典；FR-003-001…014 |
| [101-pip-integration](./101-pip-integration/spec.md) | ✅/✅/✅/✅（TC-101-01…18） | pip 直出/安装/边界拒绝/ensurepip 兜底/uv 组合（P4/P5）用例正典；FR-101-001…012 |

---

## 五、模块编号一览

| 编号 | 模块名 | 英文名 | 状态 | FR 段 |
|---|---|---|---|---|
| **000** | 工程搭建（scaffold） | scaffold | ✅ 已实现（骨架级） | FR-000-001…042 |
| **001** | 构建 | building | ⬜ 已立项（代码本批实现；编译验证 CI ⬜） | FR-001-001…035 |
| **002** | 构建流水线 | building-workflow | ⬜ 已立项（workflow 本批实现；跑批 ⬜） | FR-002-001…009 |
| **003** | python 命令行 | cli | ⬜ 契约冻结（执行待 CI 首产 + M2-T2） | FR-003-001…014 |
| **101** | pip 集成 | pip-integration | ⬜ 契约冻结（同上；uv 组合外部依赖） | FR-101-001…012 |

> 编号约定（规划 §10.2）：`0NN` = 构建工程/产品域（000–003），`1NN` = 设备侧集成域（101 起）。
> FR 段唯一权威定义处在各模块 `spec.md`；里程碑（M1–M4）与模块映射见规划 §10/§10.2。

---

## 六、模块文档结构规范

每个模块目录 `NNN-<模块>/` 下**必须成对**提供：

| 文件 | 命名 | 说明 |
|---|---|---|
| 功能规格 | `spec.md` | **技术无关**：目的、范围边界、功能需求（`FR-0NN-NNN`，RFC 2119）、验收场景（编号引用 `test-cases.md`） |
| 技术方案 | `plan.md` | **实现特定**：技术上下文与依赖版本、宪法合规检查、研究发现、数据模型、接口契约、实现策略、测试考虑、文件清单（真实行数）、不一致登记；逐条交叉引用本模块 `spec.md` 的 FR |

复杂模块可追加 `tasks.md`（任务拆解）与 `test-cases.md`（用例正典，由 [`overall-test-cases.md`](./overall-test-cases.md) 索引）。

**三条纪律**：

1. `spec.md` 写「做什么、验收判据是什么」；`plan.md` 写「怎么做」；两份都回引 `docs/000-工程规划.md` 的 § 号（M1+ 内容必须带 ⬜规划标记）。
2. `spec.md` 不出现框架名与文件路径；`plan.md` 不出现没有源码依据的断言（`path:line` 为 2026-11-02 快照）。
3. as-built 与 planned 逐条区分：未实现的写 ⬜规划（Phase/里程碑），不得把规划当既成事实；未实测不写「已验证」（宪法 C6）。

---

## 七、快速导航

| 目标读者 | 推荐阅读顺序 |
|---|---|
| **新加入开发者** | [constitution.md](./constitution.md) → [STRUCTURE.md](./STRUCTURE.md) → [overall-spec.md](./overall-spec.md) → [ARCHITECTURE.md](./ARCHITECTURE.md) → [000-scaffold/spec.md](./000-scaffold/spec.md) |
| **架构师 / Tech Lead** | [ARCHITECTURE.md](./ARCHITECTURE.md) → [TECH.md](./TECH.md) → [overall-plan.md](./overall-plan.md) → 规划文档 §3/§5/§10 |
| **实现者（M1 交叉编译）** | [constitution.md](./constitution.md) §二 → [000-scaffold/plan.md](./000-scaffold/plan.md) §5（接口契约，先冻结再填实现）→ 规划 §4 → [000-scaffold/spec.md](./000-scaffold/spec.md) |
| **发布管理员** | [overall-plan.md](./overall-plan.md) §4.3（发布三道闸）→ [TECH.md](./TECH.md) §1（发布通道行）→ 规划 §10.1 → `gradle.properties.local.example` |
| **测试 / QA** | [overall-test-cases.md](./overall-test-cases.md) → [000-scaffold/test-cases.md](./000-scaffold/test-cases.md) → [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) §五 |
| **合规 / 上架** | [constitution.md](./constitution.md) §四（红线）→ `../python-cli/THIRD-PARTY-NOTICES.md` → [ARCHITECTURE.md](./ARCHITECTURE.md) §⑤ |
| **排障 / 评审** | [overall-plan.md](./overall-plan.md) §6 + [000-scaffold/plan.md](./000-scaffold/plan.md) §9（不一致与缺陷登记） |

### 快照命令（先看证据，再看结论）

```bash
node tools/provision.mjs --check            # 未投放 ⇒ 预期退出码 2（draft 不比对 sha/size）
node --check tools/provision.mjs && bash -n scripts/build-python-cli-android.sh
node scripts/fetch-python-cli-source.mjs --python 3.14.0   # SCAFFOLD ⇒ 预期退出码 2
gradle :python-cli:tasks --console=plain    # 配置门：无 .so 必须通过（Gradle 9.4.1 + JDK 21）
git status --porcelain                      # jniLibs/assets 必须无条目（二进制不入库）
```

---

**文档维护者：** `aosp-python-cli` 开发团队 · **权威来源：** [`../docs/000-工程规划.md`](../docs/000-工程规划.md)（v2.1）· **索引校验：** 2026-11-02 对 `specs/` 实际扫描生成，全部链接逐一核对存在
