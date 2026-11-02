# 003 · CLI（python 命令行）功能规格

> 模块：003-cli · 状态：⬜ 已立项（契约与用例本批冻结；执行依赖 CI 首产产物）
> 所属工程：aosp-python-cli · 规划基线：[`docs/000-工程规划.md`](../../docs/000-工程规划.md) §1.1（定位）/§6（exec 门禁）/§7（运行期契约）/§7.1（回程探针）
> 对应里程碑任务：M1 产物行为 + M2-T2 探针（P1–P3/P6 部分）；构建见 [`001-building`](../001-building/spec.md)

## 1. 目的

定义「设备上的 `python` 命令」这一产品本体的行为契约：进程形态、版本身份、代码执行、
标准库与静态扩展可用性、TLS 信任链、运行环境变量约定与**能力边界**——并给出可证伪的
主测试用例集（host 侧 + 设备侧）。

## 2. 范围

**在范围内（003）：** 解释器进程契约（exec/PTY/退出码/stdio）；`python -c` / `-m` / 脚本文件 /
REPL 行为；stdlib 抽查与静态扩展（sqlite3/zlib/hashlib）；ssl/CA；环境变量契约
（PYTHONHOME/PYTHONPATH/SSL_CERT_FILE/HOME/TMPDIR/PATH 的**语义定义**）；平台事实记录（P6）。

**不在范围内（003）：** 二进制怎么编出来（→ 001）；流水线（→ 002）；`pip` 命令语义（→
[`101-pip-integration`](../101-pip-integration/spec.md)，`python -m pip` 的模块入口归 003）；
环境引导层的物化实现（消费方职责，规划 §7）；venv 管理（不在范围，规划 §1.3）。

## 3. 功能需求

### 3.1 进程与身份域

- **FR-003-001（MUST）**：独立进程解释器——经终端 PTY（forkpty+execve）启动
  `libpython_cli.so`，进程有独立生命周期；ELF 形态服从 000 七项 exec 门禁
  （ET_DYN PIE / PT_INTERP=/system/bin/linker64 / 16KB 对齐）。
- **FR-003-002（MUST）**：版本身份——`python --version`（经 PTY）输出 CPython 版本串且
  与制品版本一致；`sys.version`/`sys.version_info` 可编程获取同值（P1）。
- **FR-003-003（MUST）**：退出码传递——`python -c '<exit N>'` 与未捕获异常（exit 1）的
  退出码经 PTY 回程一致。
- **FR-003-004（MUST）**：stdio 语义——stdout/stderr 分流（`2>` 重定向可见）、UTF-8 编码
  输入输出不乱码。

### 3.2 执行与标准库域

- **FR-003-005（MUST）**：`-c` 执行——单行/多行代码、print 回程（P1 主判据）。
- **FR-003-006（MUST）**：`-m` 模块执行——`python -m <mod>` 可运行标准库模块
  （`python -m pip` 是 101 的依赖入口；`python -m json.tool` 等抽查）。
- **FR-003-007（MUST）**：脚本文件执行——物化在 filesDir 的 `.py` 文件可执行
  （相对/绝对路径、`__file__` 正确）。
- **FR-003-008（MUST）**：REPL——交互式 `>>>` 提示符回程、多行续行、Ctrl-D 退出
  （PTY 真终端语义）。
- **FR-003-009（MUST）**：静态扩展可用——`import sqlite3`（建表/插入/查询闭环）、
  `import zlib`（压缩/解压闭环）、`import hashlib`（sha256 摘要）全通过（P2）。
- **FR-003-010（MUST）**：stdlib 抽查——标准库导入清单（json/os/sys/re/math/struct/
  socket/ctypes 除外等）逐项 import 成功；**ctypes 明确不在首版**（规划 §4.1 R3）。

### 3.3 网络与平台域

- **FR-003-011（MUST）**：TLS 信任链——`ssl.create_default_context()` 使用随包 CA；
  HTTPS GET（公网）握手成功（P3）；证书校验失败路径可预期（错误而非静默）。
- **FR-003-012（MUST）**：环境变量契约（规划 §7 全表在本模块验收）：
  `PYTHONHOME`=物化 stdlib 根、`PYTHONPATH` 默认空、`SSL_CERT_FILE`=随包 CA、
  `HOME`/`TMPDIR`=filesDir 子目录、`PATH` 含 nativeLibraryDir——错误注入下的失败模式
  （缺 PYTHONHOME ⇒ 找不到 stdlib 的明确报错）可观察。
- **FR-003-013（MUST）**：平台事实——`sys.platform`、`os.cpu_count()`、`sys.path` 首序
  记录入验收记录（P6；记录事实，不断言特定值）。
- **FR-003-014（MUST）**：能力边界如实呈现——sdist/C 扩展 wheel 不可装（→101 判据）、
  无 ctypes、tkinter/curses/readline 不编；消费方文档口径以本模块用例记录为准。

## 4. 验收场景（主测试用例索引）

设备侧判据 = 规划 §7.1 P1/P2/P3/P6；host 侧判据 = 产物门禁与打包面。用例正典：
[test-cases.md](./test-cases.md)（TC-003-01…17，含执行环境/前置/状态列）。

- **P1 主链**：PTY 内 `--version` 与 `-c` 双回程（TC-003-01/02）。
- **P2 扩展链**：sqlite3/zlib/hashlib 三闭环（TC-003-06…08）。
- **P3 TLS 链**：CA 生效的 HTTPS GET（TC-003-09）。
- **边界链**：错误注入（PYTHONHOME 缺失）、退出码、UTF-8（TC-003-03/04/05）。
