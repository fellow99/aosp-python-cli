# 101-probe-app — 模块技术方案（plan.md，as-built）

> **性质**：**实现特定**。记录 probe-app 现状 + 本批增量（TC-VENV 三探针 + autorun 无头触发 +
> README 能力边界披露）。本仓**不实现** C1 自洽 prefix（属 dsh 层需求交接）；只做事实探针与边界披露。
> **成对文档**：功能规格见 [spec.md](./spec.md)（`FR-101-probe-001…009` 唯一权威定义处）；用例正典见
> [test-cases.md](./test-cases.md)（TC-003 / TC-101 既有 + TC-VENV-01…03）。
> **状态**：✅ 已实现（本批 DEV_CHECKLIST：`logs/20261105-1/DEV_CHECKLIST.md`）。
> **能力边界口径**：`docs/20261105-cli-实测问题-修复设计.md` §2.2/§4.2/§4.3。

---

## 1. 技术上下文（真实路径 · as-built）

| 项 | 取值 | as-built 依据 |
|---|---|---|
| 探针载体 | `probe-app/` 独立 Gradle 工程 | `probe-app/settings.gradle.kts:11` `include(":app")`；根 `build.gradle.kts:5` AGP 9.2.1（apply false） |
| app 模块 | `probe-app/app/build.gradle.kts` | namespace/applicationId `org.fellow99.pythonprobe`(:6/:10)；compileSdk 36(:7)、minSdk 24(:11)、abiFilters arm64-v8a(:16)、useLegacyPackaging(:21) |
| AAR 输入 | `probe-app/app/libs/python-cli-release.aar`（gitignored，`.gitignore:3`） | `app/build.gradle.kts:44` `implementation(files(...))` |
| 主实现 | `probe-app/app/src/main/java/org/fellow99/pythonprobe/MainActivity.java`（596 行） | class L48 |
| 物化 | `materialize()` L114；`copyAssetTree` L137 | marker=`manifest.json totalSha256`（L91 assetsMarker） |
| env 注入 | `baseEnv()` L165 / `exec()` L186 | 规划 §7 全表 + ANDROID_ROOT/ANDROID_DATA/LD_LIBRARY_PATH |
| 探针定义 | `probes()` L283（37 条） | TC-003 L286…L330；TC-101 L354…L412；TC-VENV L417…L458 |
| 执行主循环 | `runAll()` L506 | 前置（t.py L513 / bin-noexec-probe L517 / venv-prep L523）→ 逐条 exec → 汇总 L578 → 报告 L586 |
| 报告 | `filesDir/probe-report.json` L586 | `logs/20261102-1/probe-report-device.json`（32 PASS/2 BLOCKED，2026-11-02） |

## 2. 宪法合规

| 条目 | 落点 |
|---|---|
| C1 不改源 | probe 载体只消费 AAR payload，不触碰 CPython/产物；自愈由 dsh 环境层做，本仓不写 |
| C6 未实测标 ⬜ | TC-VENV 为事实探针（PASS-FACT/FAIL 不臆测）；设备侧⬜以 2026 首产为准（本批无真实 AAR） |
| C8 先文档后实现 | 本批顺序：README/README_zh/规划 §7 边界披露（文档）→ MainActivity TC-VENV+autorun（实现）；specs as-built 记录实现后事实 |
| 二进制不入库 | AAR 在 gitignored 路径；probe-app 源码入 git |

## 3. 设计决策

1. **探针声明式 + check 判据**：`Probe` 承载 argv/env/stdin/timeout；判据全在 `Check.check(Out)`
   ——null=PASS、`PASS-…`=PASS（事实）、`BLOCKED:`=BLOCKED、其余=FAIL；runner 只归并标签，不预判
   （避免把「预期失败」误判为 FAIL，uv/REPL/不可 exec 类探针依赖此）。
2. **TC-VENV 自愈验证的落点**：不把覆写逻辑写死在判据里，而是在 runAll 前置生成
   `venv-prep-ensurepip.py`（L523–L543）：读取 `VENV_PREFIX` → 覆写 `.v/bin/pyvenv.cfg home` →
   剥离 `PYTHONHOME` 后 `subprocess.run(['.v/bin/python','-m','ensurepip'])` → 以 returncode 传递。
   TC-VENV-03 只观测结果（stdlib 可寻=PASS；stdlib 不可寻=PASS-BOUNDARY 边界事实；其余=FAIL），
   与修复设计 §4.2 C1 的「env 层自愈」判据同源。
3. **autorun 无头触发**：`getIntent().getBooleanExtra("autorun", false)`（L86–L88），
   `adb shell am start -n org.fellow99.pythonprobe/.MainActivity --ez autorun true`——与
   aosp-git-cli probe 同款契约，便于 CI/自动化无重启 UI。
4. **判定平台事实而非期望值**：TC-VENV-01 把 `pyvenv.cfg home`、`homeHasStdlib`、venv python
   存在性全量回写 detail；成功与否都记为 PASS-FACT（事实探针口径），只有探针自身崩溃才算 FAIL。

## 4. 用例设计

- `TC-003-NN`（003 正典）与 `TC-101-NN`（101 正典）**原样保留**，不在本模块改判据；
  本模块以「载体行为」为主视角重复列出并记录执行状态。
- `TC-VENV-01…03` 为本模块新增（ID 前缀 TC-VENV-*，并注明引用修复设计文档 §2.2/§4.2/§4.3）。
- 执行顺序依赖：`probes()` 列表序 = TC-003 → TC-101 → TC-VENV；TC-VENV-01（建 .v）在
  02/03 之前，天然满足前置。

## 5. 实现策略（本批）

- 文档（先）：README.md / README_zh.md「能力边界 / 已知限制」小节 + `docs/000-工程规划.md`
  §7 边界追记（不破坏既有 §7 内容）。
- 代码（后）：MainActivity.java 增 `TC-VENV-01…03`、`readPyvenvHome` helper、
  runAll 前置 venv-prep 脚本、onCreate autorun 无头触发（对照 git-cli probe 的 `--ez autorun`）。
- 构建验证：`gradle :app:assembleDebug`（Gradle 9.4.1 发行版）通过；产物
  `probe-app/app/build/outputs/apk/debug/app-debug.apk`。
- specs-as-built（本文件 + spec/test-cases/tasks）记录上述实现。

## 6. 文件清单（真实行数）

| 文件 | 行数 | 说明 |
|---|---|---|
| `probe-app/build.gradle.kts` | 6 | 独立工程根；AGP 9.2.1(apply false) |
| `probe-app/settings.gradle.kts` | 16 | rootProject `python-cli-probe-app`；include :app |
| `probe-app/gradle.properties` | 4 | jvmargs；`PROBE_APP_VERSION=3.14.10` |
| `probe-app/app/build.gradle.kts` | 45 | namespace/abi/useLegacyPackaging/ignoreAssets；AAR 依赖 |
| `probe-app/app/src/main/AndroidManifest.xml` | 20 | INTERNET 权限；launcher activity exported |
| `probe-app/app/src/main/java/org/fellow99/pythonprobe/MainActivity.java` | 596 | 探针实现（本批 +95 行（HEAD 501→596）） |
| `probe-app/.gitignore` | 4 | 忽略 .gradle/build/local.properties/app/libs/*.aar |

## 7. FR 交叉引用

| FR | 落点（as-built） |
|---|---|
| FR-101-probe-001 | `probe-app/{build.gradle.kts,settings.gradle.kts,app/build.gradle.kts}` |
| FR-101-probe-002 | MainActivity `materialize()` L114 / `copyAssetTree` L137 |
| FR-101-probe-003 | `baseEnv()` L165 / `exec()` L186 |
| FR-101-probe-004 | `probes()` L286…L414（TC-003/TC-101 全量） |
| FR-101-probe-005 | `Probe`/`Check`（L243–L258）+ runner 归并（L546 起） |
| FR-101-probe-006 | `runAll()` 汇总 L578 / 报告 L586 |
| FR-101-probe-007 | `onCreate()` autorun L86–L88 |
| FR-101-probe-008 | `TC-VENV-01` L417–L430 |
| FR-101-probe-009 | `TC-VENV-02` L431–L441 / `TC-VENV-03` L442–L458 + 前置脚本 L523–L543 |

## 8. 不一致与风险登记

| # | 项 | 处置 |
|---|---|---|
| 1 | 当前仓无真实 `python-cli-release.aar`（交叉编译 CI-only） | 本批构建以**占位 AAR**（gitignored，仅无 payload 的空壳）验证 compile+packaging；真实 payload 探针设备侧 ⬜ 待 CI 首产，C6 如实登记 |
| 2 | venv/uv 边界属生态/环境引导面，probe 仅记录事实 | TC-VENV 判据按事实（PASS-FACT/PASS-BOUNDARY），不回写实现期望 |
| 3 | TC-VENV 依赖设备端 `.v/bin/python` 可 exec（软链/拷贝） | 以 `venvPython=` 字段记录存在性事实；不存在则 TC-VENV-03 报明确 FAIL 原因 |
| 4 | README 披露与修复设计 §4.3 需随 dsh 层落地再校 | 已双向标注文档来源（修复设计 §2.2/§4.2/§4.3 路径），dsh 变更后对照更新 |
