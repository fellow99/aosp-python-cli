# 101-probe-app · 设备侧回程探针载体（probe-app）功能规格 —— as-built

> 模块：101-probe-app · 状态：✅ 已实现（specs-as-built：逆向 probe-app 现有代码，非新立需求）
> 所属工程：aosp-python-cli · 规划基线：[`docs/000-工程规划.md`](../../docs/000-工程规划.md)
> §3（消费方环境引导层）/§5（AAR 形态）/§6（exec 门禁）/§7（运行期契约）/§7.1（回程探针 P1–P6）
> 能力边界口径：[`docs/20261105-cli-实测问题-修复设计.md`](https://github.com/fellow99/node-bridge-workspace/blob/main/docs/20261105-cli-实测问题-修复设计.md)（父仓 workspace docs/，本子仓 docs/ 无此文）
> §2.2/§4.2/§4.3（venv/uv 边界与自愈；本模块复用「101」编号段，与 101-pip-integration 不同名，见 specs/README.md 编号说明）
> 上游：`003-cli`（P1–P3/P6 探针）与 `101-pip-integration`（P4/P5 探针）共用的设备侧执行载体（003 tasks T4.1 / 101 tasks T4.1）

## 1. 目的

定义「probe-app」这一**设备侧回程探针载体 App** 的行为契约：何时构建、如何物化 python
payload、注入哪些环境变量、以何种程序形态逐条执行 `003-cli` 与 `101-pip-integration` 的
设备侧用例、如何产出结构化报告，以及新增的 venv 能力边界事实探针（TC-VENV-01…03）。

本模块记录**已建成事实**（MainActivity 596 行 + 5 个 Gradle/manifest 文件），供消费方
环境引导层（dsh-desktop-android）接入时对照验收。

## 2. 范围

**在范围内（101-probe-app）：** probe-app 的工程形态（独立 Gradle 工程 + AAR 输入）；
assets 幂等物化；规划 §7 环境变量注入；探针执行框架（PASS/FAIL/BLOCKED + JSON 报告）；
003/101 既有探针**逐条保留**；TC-VENV-01…03（venv 行为事实 + pyvenv.cfg home + 覆写 home
自愈验证）；launcher 无头触发（`--ez autorun true`）。

**不在范围内（101-probe-app）：** 解释器二进制怎么编（→ 001/002）；`python` / `pip` 行为
语义本身（→ 003 / 101-pip-integration）；环境引导层 / dsh 层代码（本仓不实现 C1 自洽
prefix，只做事实探针与边界披露）；REPL/PTY 语义与 uv 本体（TC-003-13 / TC-101-10 按
BLOCKED 出口，002/101 已登记）。

## 3. 功能需求

### 3.1 工程与物化域

- **FR-101-probe-001（MUST）**：独立工程——probe-app 为**独立 Gradle 工程**（不在
  aosp-python-cli 根 `settings.gradle` 内），根 `build.gradle.kts` 声明 AGP 9.2.1（apply false），
  `settings.gradle.kts` `include(":app")`；`app` 模块通过
  `implementation(files("libs/python-cli-release.aar"))` 依赖 CI 首产 AAR（app/build.gradle.kts:44），
  `:app:assembleDebug` 产出可安装 APK。
- **FR-101-probe-002（MUST）**：payload 物化——`assets/python-bridge-tools/**` 幂等物化到
  `filesDir/python-bridge-tools`，以 `manifest.json totalSha256` 作 marker，一致则跳过、升级时
  清残留重物化（MainActivity.materialize，as-built L114）。
- **FR-101-probe-003（MUST）**：环境注入——exec 前注入规划 §7 全表
  `PYTHONHOME/SSL_CERT_FILE/HOME/TMPDIR/PATH` + `ANDROID_ROOT/ANDROID_DATA/LD_LIBRARY_PATH`
  （baseEnv/exec，as-built L165/L186）。

### 3.2 探针执行域

- **FR-101-probe-004（MUST）**：既有探针保留且判据不回退——TC-003-01…15（含 03a/03b/09b）
  与 TC-101-01…14（含 04b/06b/08b）逐条存在并执行；TC-003-13（REPL）与 TC-101-10（uv pip
  组合）为 **BLOCKED** 出口（分别因 PTY 语义 / aosp-uv-cli 外部依赖）。as-built L286…L414。
- **FR-101-probe-005（MUST）**：探针框架——`Probe` 声明式（id/title/argv/envOverride/
  stdin/timeoutMs/check），`check` 返回 null=PASS、`PASS-…`=PASS（带事实备注）、
  `BLOCKED:`=BLOCKED、其余=FAIL；预期失败类探针由 check 判据承载，runner 层不预先判 FAIL
  （probes() as-built L283；runAll L506）。
- **FR-101-probe-006（MUST）**：结构化报告——每次 runAll 汇总 PASS/FAIL/BLOCKED，写
  `filesDir/probe-report.json`（runAt/device/nativeDir/probes[]，逐条
  id/title/verdict/detail/exit/ms/stdout/stderr，stdout 截断 800 字符）供 `adb pull` 取回
  （as-built L578–L594）。
- **FR-101-probe-007（MUST）**：无头触发——onCreate 读 launcher intent，`--ez autorun true`
  时自动 runAll（参照 aosp-git-cli probe 同款写法的 `--ez autorun` 契约）；便于 CI/
  自动化在无 UI 交互下执行（as-built L86–L88）。

### 3.3 venv 能力边界域（TC-VENV，引修复设计文档）

- **FR-101-probe-008（MUST）**：venv 行为事实——`python -m venv .v` 记录 exit/报错与
  `pyvenv.cfg` 内 `home` 值及「home 目录是否含 stdlib」判据，按事实记为 **PASS-FACT** 或明确
  FAIL 原因，**不臆测**（as-built L417–L430，TC-VENV-01）。
- **FR-101-probe-009（MUST）**：venv 自愈路径验证——读取并打印 `.v/bin/pyvenv.cfg`
  （TC-VENV-02，as-built L431–L441）；覆写 `home` 指向含 stdlib 的 prefix 后执行
  `.v/bin/python -m ensurepip`，成功 ⇒ **PASS**（自愈生效），stdlib 仍不可得 ⇒
  **PASS-BOUNDARY**（预 harness 自愈边界事实），其余异常 ⇒ FAIL（TC-VENV-03，as-built
  L442–L458）。

## 4. 实体

| 实体 | 位置 | 说明 |
|---|---|---|
| `python-cli-release.aar` | `probe-app/app/libs/`（gitignored） | 探针输入：jni/arm64-v8a 三件 + assets/python-bridge-tools 全树（规划 §5） |
| `filesDir/python-bridge-tools/` | 设备端物化目录 | payload 物化目标（FR-101-probe-002） |
| `filesDir/probe-report.json` | 设备端报告 | FR-101-probe-006 的 JSON 报告 |
| `filesDir/.v/` | venv 工作目录 | TC-VENV 探针产物：`.v/bin/pyvenv.cfg`、`.v/bin/python`、`.v/bin/pip` |
| `filesDir/venv-prep-ensurepip.py` | 探针辅助脚本 | TC-VENV-03 的 home 覆写 + ensurepip 驱动（runAll 前置生成，as-built L523–L543） |

## 5. NFR

| # | 项 | 判据 |
|---|---|---|
| NFR-1 | 探针超时 | 本地探针默认 30s；venv/网络类 90–300s（Probe.timeoutMs），超时 `destroyForcibly` + 记 timedOut |
| NFR-2 | 幂等物化 | marker 一致即跳过；版本升级清残留重物化（FR-101-probe-002） |
| NFR-3 | UI 线程隔离 | 探针在后台线程执行，`log()` 经 `runOnUiThread` 回写（as-built L92–L97） |
| NFR-4 | 平台覆盖 | 仅 arm64-v8a（`abiFilters`，app/build.gradle.kts:16）；x86_64 模拟器经 ndk_translation 实测（2026-11-02 probe-report-device 记录） |
| NFR-5 | 报告可读 | JSON UTF-8、字段固定、stdout/stderr 截断 800 字符防超长 |

## 6. 验收场景

用例正典：[**test-cases.md**](./test-cases.md)。三条主链：

- **载体链**：物化（FR-101-probe-002）→ env 注入（003）→ 探针逐条执行（004）→ 报告落盘（006）。
- **既有功能链**：TC-003-01…15 + TC-101-01…14 设备侧 ✅（2026-11-02，32 PASS / 2 BLOCKED，
  证据 `logs/20261102-1/probe-report-device.json` + `TEST_REPORT.md`）。
- **venv 边界链**：TC-VENV-01→02→03 依序执行；判据按 FR-101-probe-008/009（PASS-FACT /
  PASS / PASS-BOUNDARY，不臆测）。

## 7. 依赖

- `python-cli-release.aar`（CI M1 首产物；当前未实产 ⇒ 探针设备侧 ⬜ 待首产，C6）；
- Gradle 9.4.1 + AGP 9.2.1 + JDK 17+/21/compileSdk 36（探针工程自审通过）；
- 消费方环境引导层（dsh-desktop-android，非本仓）——C1 自洽 prefix 与 venv/uv home 覆写自愈。
