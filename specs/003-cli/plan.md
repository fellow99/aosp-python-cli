# 003-cli — 模块技术方案（plan.md）

> **性质**：**实现特定**。003-cli 是产品行为契约模块——本仓**不新增解释器代码**（CPython 上游
> 即实现），实现落点是：① 探针用例的可执行化（脚本化判据）；② 打包面/门禁对行为的支撑核对；
> ③ 环境变量契约的注入模板。
> **成对文档**：功能规格见 [spec.md](./spec.md)（`FR-003-001…014` 唯一权威定义处）；用例正典见
> [test-cases.md](./test-cases.md)（TC-003-01…17）。
> **状态**：⬜ 契约冻结；设备侧执行 ⬜ 依赖 CI 首产（[`002`](../002-building-workflow/spec.md)）+ M2-T2 验收窗口。

---

## 1. 技术上下文

| 项 | 取值 | 说明 |
|---|---|---|
| 产品件 | `jni/arm64-v8a/libpython_cli.so`（exec 型 PIE） | 001 产出、002 归档 |
| 启动方式 | 消费方 PTY：`pty.spawn(<nativeLibraryDir>/libpython_cli.so, argv, env)` | 规划 §3 图 |
| 环境注入 | `tools/provision.mjs` 投放时生成的 properties 是**事实来源**；设备侧注入模板见 §3 | FR-003-012 |
| 探针执行面 | host：门禁/打包检查（`node`/`gradle`/`unzip`）；设备：adb shell + 真机 PTY App（M2-T1）⬜ | 用例正典分列 |

## 2. 宪法合规

C6（未实测标 ⬜）是本模块主纪律：设备侧用例全部 ⬜ 待产物；host 侧用例本批可执行。
C8：本文件与 [test-cases.md](./test-cases.md) 先于设备侧验收存在。

## 3. 环境变量注入模板（FR-003-012 验收载体）

```
PYTHONHOME=<filesDir>/python-bridge-tools
PYTHONPATH=（默认不设；消费方追加自定义目录）
SSL_CERT_FILE=<filesDir>/python-bridge-tools/cacert.pem
PATH=<nativeLibraryDir>:$HOME/bin:/system/bin
HOME=<filesDir>/home
TMPDIR=<filesDir>/tmp
```

（与规划 §7 全表一致；物化 marker/失败上报/清残留纪律归消费方环境引导层，本模板只锁语义。）

## 4. 用例设计决策

1. **编号**：`TC-003-NN`；设备侧判据直接映射规划 §7.1 探针（P1→TC-003-01/02、P2→TC-003-06…08、
   P3→TC-003-09、P6→TC-003-14），消费方验收按本表逐条引用，不另造判据。
2. **环境列**：`host`（本批可跑）/ `device`（⬜ CI 首产 + M2-T2）；禁止把 host 通过冒充 device。
3. **判据可证伪**：每条写「期望输出/退出码」而非「正常工作」；UTF-8/退出码/错误注入等
   负路径与正路径同权重。
4. host 侧用例（TC-003-16/17）以**合成 ELF fixture + stdlib 替身**驱动（001 §5 测试基础设施），
   验证的是打包面/门禁链，**不**断言解释器行为。

## 5. 实现策略（本批）

- 用例正典（test-cases.md）随规格入库；TC-003-15/16 并入 [`../overall-test-cases.md`](../overall-test-cases.md) 索引。
- 设备侧执行脚本（`scripts/probe-device.mjs` 或消费方探针 App 用例）⬜ M2-T1 立项时实现，
  本批不写空壳脚本（C4：不静默降级、S1：接口先冻结再填实现）。

## 6. 不一致与风险登记

| # | 项 | 处置 |
|---|---|---|
| 1 | REPL/UTF-8/PTY 行为受终端 App 影响（消费方变量） | 用例注明「在标准 PTY 终端下」前置；消费方差异记入 P6 事实记录 |
| 2 | `sys.platform` 实际值（linux/android 之争）⬜ | TC-003-14 只记录不断言；回填后固化 |
| 3 | sqlite3/zlib/hashlib 若 CI 首轮静态化失败被裁剪（001 FR-001-013） | 对应用例标 BLOCKED 并引用 BUILD-METADATA 裁剪登记；不得删用例 |
