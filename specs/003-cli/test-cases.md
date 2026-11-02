# 003-cli 测试用例（python CLI 主要用例正典）

> 对应：[spec.md](./spec.md) §3（FR-003-001…014）· 规划 §7.1（回程探针 P1/P2/P3/P6）。
> **环境标记**：`host` = 构建机可执行（node/gradle/unzip）；`device` = 需 CI 首产产物 + PTY 终端
> （真机或 arm64 模拟器；本机 AVD 为 x86_64，不可承载 arm64 产物——探针须真机/arm64 环境执行）。
> **状态口径**：✅ 已执行 · ⬜ 待执行（C6：不得把未测当已测）。设备侧命令以
> `PTY$` 前缀表示「终端 App 内经 PTY 启动 `libpython_cli.so`」（别名 `python`）。

## 一、设备侧用例（⬜ 待 CI 首产 + M2-T2）

| # | 用例 | 环境 | 前置 | 步骤 | 期望（可证伪） | 探针 | FR | 状态 |
|---|---|---|---|---|---|---|---|---|
| TC-003-01 | 版本串回程 | device | 产物已物化 + env 注入（plan §3 模板） | `PTY$ python --version` | stdout = `Python <ver>`（= 制品版本，非其它串）；退出码 0 | P1 | FR-003-002 | ⬜ |
| TC-003-02 | `-c` 执行回程 | device | 同上 | `PTY$ python -c 'import sys;print(sys.version_info[:3])'` | stdout 回程 `(3, 14, x)` 与 `--version` 同源；exit 0 | P1 | FR-003-005 | ⬜ |
| TC-003-03 | 退出码传递 | device | 同上 | ①`python -c 'import sys;sys.exit(7)'`；②`python -c 'raise RuntimeError("x")'` | ①exit 7；②exit 1 且 stderr 含 `RuntimeError` | — | FR-003-003 | ⬜ |
| TC-003-04 | stderr 分流 | device | 同上 | `PTY$ python -c 'import sys;print("o");print("e",file=sys.stderr)' 2>/dev/null` | stdout 仅 `o`（`e` 被重定向吞掉） | — | FR-003-004 | ⬜ |
| TC-003-05 | UTF-8 输入输出 | device | 同上 | `PTY$ python -c 'print("你好世界🦆")'` | stdout 原样回程（无 `?`/乱码/转义泄漏） | — | FR-003-004 | ⬜ |
| TC-003-06 | sqlite3 闭环 | device | 同上 | `-c`：内存库建表→插入→查询→打印行 | 查询行与插入一致；exit 0 | P2 | FR-003-009 | ⬜ |
| TC-003-07 | zlib 闭环 | device | 同上 | `-c`：`compress`→`decompress`→比对 | 解压后与原文逐字节相等；exit 0 | P2 | FR-003-009 | ⬜ |
| TC-003-08 | hashlib 摘要 | device | 同上 | `-c`：`hashlib.sha256(b'aosp').hexdigest()` | 输出与宿主参考实现同值（固定向量） | P2 | FR-003-009 | ⬜ |
| TC-003-09 | TLS/CA 生效 | device | 同上 + 网络 | `-c`：`ssl.create_default_context()` + HTTPS GET 公网站点 | 握手成功 + 状态码 200 回程；`SSL_CERT_FILE` 指向不存在文件时失败可预期 | P3 | FR-003-011 | ⬜ |
| TC-003-10 | stdlib 导入抽查 | device | 同上 | `-c`：逐个 `importlib.import_module` json/os/sys/re/math/struct/socket/platform/uuid… | 全部成功；**ctypes 预期失败**（ModuleNotFoundError，能力边界） | — | FR-003-010/014 | ⬜ |
| TC-003-11 | `-m` 模块执行 | device | 同上 | `PTY$ echo '{"a":1}' | python -m json.tool` | 格式化 JSON 回程；`python -m pip --version` 有输出（详判据在 101） | — | FR-003-006 | ⬜ |
| TC-003-12 | 脚本文件执行 | device | filesDir 放 `t.py`（打印 `__file__`） | `PTY$ python t.py`；再以绝对路径执行 | 两次输出脚本内容一致，`__file__` 为实际路径 | — | FR-003-007 | ⬜ |
| TC-003-13 | REPL 交互 | device | 标准 PTY 终端 | 启动无参数 → 输入 `1+1` → Ctrl-D | 见 `>>>` 提示符、回显 `2`、Ctrl-D 干净退出 | — | FR-003-008 | ⬜ |
| TC-003-14 | 平台事实记录（P6） | device | 同上 | `-c`：打印 `sys.platform`/`os.cpu_count()`/`sys.path[:3]` | **只记录不断言**；结果回填本表下方事实区 | P6 | FR-003-013 | ⬜ |
| TC-003-15 | PYTHONHOME 缺失错误注入 | device | 故意不注入 PYTHONHOME | `PTY$ python -c 'print(1)'` | 明确报错（找不到 stdlib 类错误）而非崩溃/静默；退出码非 0 | — | FR-003-012 | ⬜ |

## 二、host 侧用例（构建机执行，验证打包面/门禁链——不断言解释器行为）

| # | 用例 | 环境 | 前置 | 步骤 | 期望 | FR | 状态 |
|---|---|---|---|---|---|---|---|
| TC-003-16 | exec 门禁全过（合成 fixture） | host | 合成 AArch64 PIE fixture + draft lock | `node tools/provision.mjs --inspect <fixture>` | 七项 ✔（sha/size 为「记录」语义，draft 不比对）；exit 0 | FR-003-001 | ⬜ |
| TC-003-17 | AAR 打包面 | host | TC-003-16 后 `--out` 投放 + `--assets` 投放 | `gradle :python-cli:assembleDebug` → 解包 AAR | `jni/arm64-v8a/libpython_cli.so` + `assets/python-bridge-tools/`（含 manifest.json）齐备；properties 字段与 lock 一致 | FR-003-001/002 | ⬜ |

## 三、事实记录区（P6 回填处，C6）

| 项 | 值 | 记录时间 |
|---|---|---|
| sys.platform | ⬜ 待 CI 首产 | — |
| os.cpu_count() | ⬜ | — |
| sys.path 首序 | ⬜ | — |
| 设备/系统版本 | ⬜ | — |

## 四、禁止的判据（沿用 overall-test-cases 纪律）

1. 不得以「host python 能跑」推断「设备 python 能跑」（环境面完全不同）。
2. 不得把合成 fixture 的门禁通过当作解释器可用。
3. 不得在 x86_64 模拟器上执行 arm64 产物探针并记录为通过。
