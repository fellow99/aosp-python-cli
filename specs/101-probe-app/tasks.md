# 101-probe-app 任务拆解

> 对应：[spec.md](./spec.md) / [plan.md](./plan.md)。性质：**specs-as-built**（记录 probe-app 现状）+ 本批增量（TC-VENV / autorun / 边界披露）。

## T1 规格冻结（as-built）
- [x] T1.1 逆向事实采集：MainActivity.java（596 行）+ 5 个 Gradle/manifest 文件 — FR-101-probe-001…009
- [x] T1.2 FR-101-probe-001…009 评审通过；编号段「101-probe」与 101-pip-integration 区分登记

## T2 用例正典
- [x] T2.1 [test-cases.md](./test-cases.md) 编写：载体既有链（TC-003/TC-101，32 PASS/2 BLOCKED ✅）+ TC-VENV 边界链（⬜）
- [x] T2.2 禁止判据登记（不臆测/不冒充已测/占位 AAR 不入功能链）

## T3 能力边界披露（文档先行，C8）
- [x] T3.1 `README_zh.md` / `README.md` 增加「能力边界 / 已知限制」小节（sdist 不可编 / venv·uv 依赖环境引导 / home 覆写自愈，引修复设计 §4.3）— T1
- [x] T3.2 `docs/000-工程规划.md` §7 追记 venv/uv 环境边界（不破坏既有内容，注明来源修复设计）

## T4 探针实现（代码）
- [x] T4.1 `TC-VENV-01`：`python -m venv .v` 行为事实（exit + pyvenv.cfg home + homeHasStdlib）— FR-101-probe-008
- [x] T4.2 `TC-VENV-02`：读取并打印 `.v/bin/pyvenv.cfg`（fact）— FR-101-probe-009
- [x] T4.3 `TC-VENV-03`：前置脚本覆写 home → `.v/bin/python -m ensurepip`（自愈验证，PASS / PASS-BOUNDARY / FAIL）— FR-101-probe-009
- [x] T4.4 autorun 无头触发（`--ez autorun true`，参照 git-cli probe）— FR-101-probe-007
- [x] T4.5 既有 TC-003/TC-101 探针**未改动**

## T5 构建验证
- [x] T5.1 `gradle :app:assembleDebug`（Gradle 9.4.1 发行版）BUILD SUCCESSFUL — FR-101-probe-001
- [x] T5.2 产物 `probe-app/app/build/outputs/apk/debug/app-debug.apk`（876 KB；classes3.dex 含 TC-VENV/autorun 字符串）— T1
- [x] T5.3 `logs/20261105-1/DEV_CHECKLIST.md` 撰写

## T6 设备侧执行准备（⬜ 后续窗口）
- [ ] T6.1 真实 `python-cli-release.aar`（CI 首产）放置 `probe-app/app/libs/` 后重编
- [ ] T6.2 TC-VENV-01…03 设备执行（真机/arm64 模拟器）+ 事实记录回填 test-cases.md §三
