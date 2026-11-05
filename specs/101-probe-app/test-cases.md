# 101-probe-app 测试用例（probe-app 载体实际探针正典）

> 对应：[spec.md](./spec.md) §3（FR-101-probe-001…009）· 003/101 正典的**设备侧执行载体**（003
> test-cases TC-003 / 101 test-cases TC-101，判据以那两份为准，本表以「载体实际执行」视角记录）。
> **环境**：device = arm64 payload + 物化后 exec（2026-11-02 用 x86_64 模拟器经 ndk_translation
> 承载 arm64 实证，证据 `logs/20261102-1/probe-report-device.json`）。host = 构建机（gradle 编译）。
> **状态口径**：✅ 已执行 · ⬜ 待执行（C6：不得把未测当已测）。

## 一、载体既有功能链（device：逐条已执行 ✅ 2026-11-02，证据 probe-report-device.json）

| # | 用例 | 前置 | 步骤（载体内执行） | 期望（可证伪） | 探针 | 状态 |
|---|---|---|---|---|---|---|
| TC-003-01 | 版本串回程 | 物化+env 注入 | `libpython_cli.so --version` | exit 0，stdout=`Python 3.14.…` | P1 | ✅ |
| TC-003-02 | `-c` 执行回程 | 同上 | `-c 'import sys;print(sys.version_info[:3])'` | `(3, 14, …)`；exit 0 | P1 | ✅ |
| TC-003-03a/b | 退出码传递 | 同上 | `-c 'sys.exit(7)'` / 未捕获异常 | a)exit 7；b)exit 1 + stderr 含 `RuntimeError` | — | ✅ |
| TC-003-04 | stderr 分流 | 同上 | `-c 'print("o");print("e",file=sys.stderr)'` | stdout=`o`，stderr 含 `e` | — | ✅ |
| TC-003-05 | UTF-8 输出 | 同上 | `-c 'print("你好世界🦆")'` | 原样回程不乱码 | — | ✅ |
| TC-003-06…08 | 静态扩展闭环 | 同上 | sqlite3/zlib/hashlib `-c` | 三闭环均 PASS | P2 | ✅ |
| TC-003-10 | stdlib 抽查 | 同上 | 12 模块 find_spec + ctypes | `OK 13` + `CTYPES=absent`（规划 R3） | — | ✅ |
| TC-003-11 | `-m json.tool` | stdin 喂入 | echo `{"a":1}` → `-m json.tool` | 格式化输出 | — | ✅ |
| TC-003-12 | 脚本文件执行 | filesDir 放 t.py | `python t.py` | `__file__` 正确 | — | ✅ |
| TC-003-13 | REPL 交互 | — | `-i` | **BLOCKED**（PTY 语义归终端 App） | — | ⛔ BLOCKED |
| TC-003-09/09b | TLS/CA | 网络 | HTTPS GET + 失败注入 | 200 / 失败可预期 | P3 | ✅ |
| TC-003-14 | 平台事实（P6） | 同上 | sys.platform/… | 记录事实 | P6 | ✅ |
| TC-003-15 | PYTHONHOME 缺失注入 | env 空 | `-c 'print(1)'` | 明确报错 + exit≠0 | — | ✅ |
| TC-101-01/02 | pip/pip3 直出 | 物化 | `libpip.so --version` 等 | `pip 26… (python 3.14…)` | P4 | ✅ |
| TC-101-03 | 离线首启 | 代理黑洞 | `pip --version` | 成功不触网 | — | ✅ |
| TC-101-13 | 参数透传 | — | `pip --help` | Usage 输出 | — | ✅ |
| TC-101-04/04b | 纯 py 包安装 | 网络 | `pip install packaging` + import | 装成 + import 有版号 | P4 | ✅ |
| TC-101-05 | list/show | TC-101-04 后 | `pip list` | 含 pip 与 packaging | — | ✅ |
| TC-101-06/06b | sdist 边界拒绝 | 网络 | `pip install --no-binary=:all: numpy` | 拒绝 + `CLEAN` 无残留 | — | ✅ |
| TC-101-07 | C 扩展包边界 | 网络 | `pip install numpy` | PASS-REJECTED / INSTALLED-RECORD 事实 | — | ✅ |
| TC-101-08/08b | 卸载 | TC-101-04 后 | `pip uninstall -y packaging` + import | 卸载成功 + import 失败 | — | ✅ |
| TC-101-09 | ensurepip 兜底 | — | `python -m ensurepip --upgrade` | exit 0 | — | ✅ |
| TC-101-11 | CLI 入口脚本事实 | filesDir 不可 exec | exec 脚本 | 预期不可 exec（PASS-EXPECTED-UNEXECUTABLE） | — | ✅ |
| TC-101-12 | 无网络失败可读 | 代理黑洞 | `pip install --no-cache-dir packaging` | exit≠0 且报网络语义 | — | ✅ |
| TC-101-14 | pip 自升级 | 网络 | `pip install --upgrade pip` | 升级成功 | — | ✅ |
| TC-101-10 | uv pip 组合 | 外部依赖 | `libuv.so --version` | **BLOCKED**（aosp-uv-cli 未就绪） | P5 | ⛔ BLOCKED |

> 上述为 **32 PASS / 2 BLOCKED**（2026-11-02 实测，`logs/20261102-1/probe-report-device.json`）；本批未改任何判据。

## 二、TC-VENV 能力边界链（⬜ 待真实 AAR 首产 + device 执行；引用修复设计文档 §2.2/§4.2/§4.3）

| # | 用例 | 步骤（载体内执行） | 判据（可证伪，不臆测） | FR | 状态 |
|---|---|---|---|---|---|
| TC-VENV-01 | `python -m venv .v` 行为事实 | `libpython_cli.so -m venv .v`；读 `.v/pyvenv.cfg`（CPython venv 把 pyvenv.cfg 写在环境**根目录**，非 bin/） | 回写 `exit`、`home=`、`homeHasStdlib`（`.v` 之 home 目录是否含 `lib/python3.14`）、`venvPython` 存在性；成功/失败均记为 **PASS-FACT**，探针自身崩溃才算 FAIL | FR-101-probe-008 | ⬜ |
| TC-VENV-02 | 读取 `.v/pyvenv.cfg` 并打印 | `-c` 打印 `CFG_EXISTS` + 全文件 | `CFG_EXISTS True` 且正文完整回写（fact） | FR-101-probe-009 | ⬜ |
| TC-VENV-03 | 覆写 home 后 `.v/bin/python -m ensurepip`（自愈验证） | 前置脚本覆写 `home=<stdlib prefix>` → 剥离 `PYTHONHOME` → `.v/bin/python -m ensurepip` | `Successfully installed` 或 `.v/bin/pip` 存在 ⇒ **PASS**（自愈生效）；stdlib 仍不可得（platform independent/init_fs_encoding/could not find/no module named）⇒ **PASS-BOUNDARY**（预 harness 自愈边界事实）；其余 ⇒ FAIL | FR-101-probe-009 | ⬜ |

## 三、事实记录区（P6 / TC-VENV 回填处，C6）

| 项 | 值 | 记录时间 |
|---|---|---|
| 2026-11-02 设备侧汇总 | PASS 32 / FAIL 0 / BLOCKED 2（REPL=PTY、uv=外部依赖） | 2026-11-02（probe-report-device.json） |
| `python -m venv .v` 的 exit / pyvenv.cfg home | ⬜ 待首产 | — |
| home 目录是否含 stdlib | ⬜ | — |
| 覆写 home 后 ensurepip 结果 | ⬜ | — |

## 四、禁止的判据

1. 不得以 host 构建机 python 行为推断设备行为（TC-003 正典纪律）。
2. 不得把「探针未执行」标为通过（C6）；TC-VENV 未执行前一律 ⬜。
3. TC-VENV 不许臆测无效 home 值——必须按实际读到的 `pyvenv.cfg` 回写事实。
4. 不得用「占位 AAR（无 payload）」在设备上跑并记为功能链通过（只可用于 host 编译验证）。

## 附、统一队列跑批记录（2026-11-06）

- 载体：`emulator-5554`（sdk_gphone64_x86_64 API 37 × ndk_translation；App 域 ABI=arm64）；由编排者统一排队串行执行（安装→`--ez autorun true`→`run-as cat` 回读报告）。
- 报告：`logs/20261105-1/report-python.json`（工程内留档，不入库）。
- 汇总：37 探针：PASS 6 / FAIL 28 / BLOCKED 3（占位 AAR 无真实引擎，功能链 FAIL 为预期；TC-003-13 PTY BLOCKED；TC-101-10 依赖 uv 未首产 BLOCKED；TC-101-14 网络 BLOCKED）。
- 判读纪律：翻译模拟器结果**仅记录**，正式 G3 需原生 arm64 复测；FAIL/BLOCKED 均按本节/Spec 既有分类如实记录，未伪造 PASS。
