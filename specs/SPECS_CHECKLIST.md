# SPECS_CHECKLIST.md —— 规格文档完成度追踪

> 工程：`aosp-python-cli`（`io.github.fellow99:python-cli`）· 需求：**000-scaffold 工程搭建**
> 规范文档存放目录：`specs/` · 生成日期：**2026-11-02**
> 权威规划文档：[`../docs/000-工程规划.md`](../docs/000-工程规划.md)（v2.1；M0 现状 + M1/M2 规划，**结论以它为准**）
>
> 状态口径：✅ 已完成 · ⚠️ 已完成但含未闭合项（见备注）· ⬜ 待生成

---

## 一、项目级文档

| # | 文档 | 路径 | 状态 | 说明 |
|---|---|---|---|---|
| P-01 | 项目宪法 | [constitution.md](./constitution.md) | ✅ | 8 条不可协商原则（C1 fetch 不改源 · C2 lock 唯一事实源 · C3 二进制不入库 · C4 门禁强制不静默降级 · C5 发布卫生 · C6 未实测标 ⬜ · C7 许可合规 · C8 先改文档再改实现）+ 8 条工程规约（S1–S8）+ 证据纪律 + 合规红线 G1–G6 + 评审清单 + 变更流程 |
| P-02 | 整体架构 | [ARCHITECTURE.md](./ARCHITECTURE.md) | ✅ | host 构建链→AAR→设备侧运行 ASCII 图、exec vs dlopen 制品形态对照、七项门禁落点、lock 数据流、发布两段式、系统边界、M0 缺口表（M1+ 全部标 ⬜规划） |
| P-03 | 技术选型 | [TECH.md](./TECH.md) | ✅ | 选型总表（Gradle 9.4.1/AGP 9.2.1/vanniktech 0.37.0/exec 门禁纯 Node/PEP 738/OpenSSL+sqlite vendored/CI runner 规格，**含「已实现 vs 规划中」状态列**）+ 被否方案 + 版本矩阵 + 依赖清单 + 6 项风险 |
| P-04 | 目录结构 | [STRUCTURE.md](./STRUCTURE.md) | ✅ | 实测目录树（逐文件行数）+ python-cli 模块现状（AAR 解包实证）+ 关键配置表 + 模块编号映射 + 不入库清单 + git 事实 |
| P-05 | 整体规格 | [overall-spec.md](./overall-spec.md) | ✅ | 技术无关（无框架名/路径）：目的、用户故事、系统边界（sdist 不可装、无编译器、无嵌入 API 等）、FR-000-001…042 按域索引（RFC 2119 + 可证伪判据）、NFR-1…7、里程碑出口 |
| P-06 | 整体技术方案 | [overall-plan.md](./overall-plan.md) | ✅ | 技术上下文、宪法符合性检查表（C1–C8/S1–S8 逐条）、M0↔FR 映射 + M1 策略映射、横切关注点（门禁/物化/发布）、测试途径、部署策略、**不一致与缺陷登记（6 项）** |
| P-07 | 测试用例索引 | [overall-test-cases.md](./overall-test-cases.md) | ✅ | 六层测试分层 + TC-01…09 逐条索引与执行状态 + 禁止的判据 + 快照命令 |
| P-08 | 规格检查清单 | SPECS_CHECKLIST.md | ✅ | 本文件 |
| P-09 | 规格索引 | [README.md](./README.md) | ✅ | 最后生成：文档总览计数 + 分层索引 + 模块编号一览 + 文档结构规范 + 快速导航；链接逐一校验存在 |
| — | `API.md` / `overall-api.md` | — | ⛔ 刻意不生成 | 需求方明确排除：本仓**不含任何嵌入 API**（README 明文边界），无 API 契约面可写；工具 CLI 契约在 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §5 |
| — | `overall-data-model.md` | — | ⛔ 刻意不生成 | 需求方明确排除；本仓唯一数据实体是 lock 文件，其全字段模型已并入 [`000-scaffold/plan.md`](./000-scaffold/plan.md) §4（避免单实体成卷） |

---

## 二、模块级文档

| # | 模块 | 目录 | spec.md | plan.md | tasks.md | test-cases.md | 状态 | 备注 |
|---|---|---|---|---|---|---|---|---|
 | M-01 | 000-scaffold 工程搭建 | [`000-scaffold/spec.md`](./000-scaffold/spec.md) | ✅（既有，保留） | ✅（本批新增） | ✅（既有，保留；T1–T8 全勾） | ✅（既有，保留；TC-01…09 已执行） | ⚠️ | 骨架级完成；⚠️ 未闭合项：① CI 退出码断言在 `bash -e` 下不可达（plan §9 #1 → **002 已接修复**）；② 二进制未产出——七项门禁对真实产物、投放全链、放行告警不可测（属 M1）；③ lock 四值为 draft 空值/TBD（如实，待 M1 回写） |
| M-02 | 001-building 构建 | [`001-building/spec.md`](./001-building/spec.md) | ✅（2026-11-02） | ✅ | ✅ | —（用例内嵌 tasks，host 子集随 dev 执行） | ⬜ 已立项 | FR-001-001…035；代码本批实现，重编译验证 ⬜ CI |
| M-03 | 002-building-workflow 构建流水线 | [`002-building-workflow/spec.md`](./002-building-workflow/spec.md) | ✅（2026-11-02） | ✅ | ✅ | —（同上） | ⬜ 已立项 | FR-002-001…009；workflow 本批实现（含 000 缺陷 #1 修复），真实跑批 ⬜ |
| M-04 | 003-cli python 命令行 | [`003-cli/spec.md`](./003-cli/spec.md) | ✅（2026-11-02） | ✅ | ✅ | ✅（TC-003-01…17） | ⬜ 已立项 | FR-003-001…014；host 子集本批执行，设备侧 ⬜ 待 CI 首产 + M2-T2 |
| M-05 | 101-pip-integration pip 集成 | [`101-pip-integration/spec.md`](./101-pip-integration/spec.md) | ✅（2026-11-02） | ✅ | ✅ | ✅（TC-101-01…18） | ⬜ 已立项 | FR-101-001…012；host 子集本批执行，设备侧 ⬜（uv 组合 BLOCKED 机制） |
 | M-06 | 101-probe-app 设备侧回程探针载体 | [`101-probe-app/spec.md`](./101-probe-app/spec.md) | ✅（2026-11-05 as-built） | ✅ | ✅ | ✅（TC-003/TC-101 载体链 + TC-VENV-01…03） | ✅ 已实现 | FR-101-probe-001…009；specs-as-built 逆向 probe-app；TC-VENV 设备侧 ⬜ 待 CI 首产；能力边界披露引修复设计 §4.3 |

**每模块 spec.md（WHAT/WHY）与 plan.md（HOW）成对提供**；000-scaffold 另有 tasks.md 与 test-cases.md（M0 为单模块工程，两者保留在模块目录内）。

---

## 三、生成顺序与依据

1. **先项目级、后模块级**：P-01…P-07 先建立术语、证据口径与 FR 编号索引，模块 plan.md 再细化——避免引用不存在的文件或编号。
2. **最后生成索引**：`README.md` 与本文件按**实际目录内容**扫描核对生成（`ls -R specs/`），不预测结构。
3. **不复制粘贴规划**：所有 M1+ 结论以「⬜规划 + § 号」引用 `docs/000-工程规划.md`，不把规划当 as-built。
4. **证据标记**：每条非显然结论带 ✅实测 / ⬜规划 / ⚠️风险（口径见 [`constitution.md`](./constitution.md) §三）。

---

## 四、质量检查

| 检查项 | 结果 |
|---|---|
| 每条结论可回溯到源码 `path:line` 或规划 § 号 | ✅（行号为 2026-11-02 快照，逐条 grep 核对过关键引用） |
| 无占位内容（`TODO` / `TBD` / 「待补充」） | ✅（lock 内的 `TBD` 是**被记录的事实**，非文档占位） |
| `spec.md` / `overall-spec.md` 不含实现细节（框架名、文件路径） | ✅（技术无关词面已复核） |
| `plan.md` 引用真实文件路径与真实行数 | ✅（`000-scaffold/plan.md` §8 文件清单行数实测） |
| `plan.md` 交叉引用本模块 `spec.md` 的 `FR-000-*` | ✅（§4/§5/§8 逐条；未新造 FR 编号） |
| 模块同时有 `spec.md` 与 `plan.md` | ✅（6 个模块均成对；101-probe-app 另有 tasks/test-cases 共 4 件） |
| `README.md` 链接全部指向存在的文件 | ✅（生成后逐一 `test -f` 校验） |
| 模块目录数与登记一致 | ✅（specs/ 共 6 个模块目录：000-scaffold / 001-building / 002-building-workflow / 003-cli / 101-pip-integration / 101-probe-app） |
| as-built 与 planned 逐条区分（⬜ 标记） | ✅（M1+ 全部 ⬜规划；AAR 实测内容、退出码、行数均 ✅） |
| 未伪造任何哈希/体积/版本事实 | ✅（draft 空值照录；AAR 内容为解包实测） |

---

## 五、未闭合项（不属文档缺失，属**实现**阶段工作）

| 项 | 归属 | 依据 |
|---|---|---|
| `libpython_cli.so` 交叉编译（PEP 738 + 静态扩展 + OpenSSL/sqlite vendored） | ⬜M1（T1–T6）→ 模块 [001-building](./001-building/spec.md)（代码本批实现；编译验证 CI ⬜） | 规划 §4/§10/§10.2 |
| fetch/build 脚本真实逻辑替换（现 exit 2 骨架） | ⬜M1-T1/T3 → [001-building](./001-building/tasks.md) T2/T3 | 规划 §4.1/§4.2 |
| provision 扩展（`--assets`/manifest/静态性检查/壳脚本白名单） | ⬜M1-T6 → [001-building](./001-building/tasks.md) T4 | 规划 §6 |
| CI 真实流水线 + GitHub Release + lock 回写（**含修复退出码断言缺陷**） | ⬜M1-T7 → [002-building-workflow](./002-building-workflow/tasks.md) | 规划 §9/§10.1；`000-scaffold/plan.md` §9 #1 |
| 真机回程探针 P1–P6（TC-003/TC-101 设备侧） | ⬜M2 残余：载体 [101-probe-app](./101-probe-app/test-cases.md) 已实现且 2026-11-02 实测 32 PASS/2 BLOCKED；真实 payload 首产后的复核/回归 ⬜ | 规划 §7.1；`logs/20261102-1/probe-report-device.json` |
| Maven Central 首发 + lock `published=true` | ⬜M3 | 规划 §10.1 |
| Gradle Wrapper 引入 / `VERSION_NAME` 取舍 | ⬜建议项（CI setup-node 已由 002 T1.2 接办） | `overall-plan.md` §6 #2/#3/#4 |
| TC-VENV-01…03 设备侧执行 + 事实回填 | ⬜（101-probe-app tasks T6）待真实 `python-cli-release.aar` CI 首产后执行 | [101-probe-app/test-cases.md](./101-probe-app/test-cases.md) §二/§三 |
