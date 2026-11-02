# 001 · 构建（building）功能规格

> 模块：001-building · 状态：⬜ 已立项（本批实现全部代码；重编译验证在 CI，规划 §10.2）
> 所属工程：aosp-python-cli · 规划基线：[`docs/000-工程规划.md`](../../docs/000-工程规划.md) §4（构建设计）/§5（制品形态）/§6（门禁扩展）
> 对应里程碑任务：M1-T1～T6（规划 §10）；上游：[`000-scaffold`](../000-scaffold/spec.md)（骨架与 exec 门禁已就位）

## 1. 目的

把「候选 CPython 源码」变成「过全部 exec 门禁、可投放进 AAR 的构建产物目录」：
钉选获取五类上游源、按 PEP 738 交叉编译出静态扩展的 `libpython_cli.so`、收集随包数据
（stdlib/pip 树/ensurepip/CA）、生成 pip 壳脚本，并把投放门禁工具扩展到 assets/清单/壳脚本。

## 2. 范围

**在范围内（001）：** fetch 五源（CPython/OpenSSL/sqlite/pip wheel/cacert）钉选+校验+解压；
host build python 版本断言；configure/make/静态扩展/strip；stdlib 收集与剔除；pip 树解包；
`libpip*.so` 壳脚本生成；ensurepip/CA 归集；构建元数据；provision 工具扩展
（`--assets` 投放、manifest 生成与校验、静态性检查、jniLibs 壳脚本白名单）。

**不在范围内（001）：** CI 流水线编排与 Release/lock 回写（→ [`002-building-workflow`](../002-building-workflow/spec.md)）；
产物在设备上的行为契约（→ [`003-cli`](../003-cli/spec.md)）；pip 命令语义与安装边界（→
[`101-pip-integration`](../101-pip-integration/spec.md)）；任何源码补丁（宪法 C1 禁止）。

## 3. 功能需求

### 3.1 源获取域（M1-T1）

- **FR-001-001（MUST）**：五源钉选获取——CPython 源码包、OpenSSL 源码包、sqlite amalgamation、
  pip 官方 wheel、CA bundle，各自**版本 + URL + SHA-256 出自唯一事实源**；任一哈希不符即失败。
- **FR-001-002（MUST）**：获取可重入——已下载且哈希一致的文件跳过重复下载（CI 缓存友好）。
- **FR-001-003（MUST）**：不改源（C1）——fetch 只做下载/校验/解压/记录出处（FETCH-METADATA），
  无任何补丁步骤；配置差异一律经 configure 参数与 Setup.local 注入。
- **FR-001-004（MUST）**：事实源扩展——五源版本/哈希进 lock 的 `builtFrom` 记录面，draft 期
  哈希空值照录不伪造（沿用 FR-000-011 纪律）。

### 3.2 交叉编译域（M1-T2~T4）

- **FR-001-010（MUST）**：host build python 断言——交叉编译前置：host 解释器版本 ≠ 目标
  CPython 版本即失败（PEP 738 `--with-build-python` 要求）。
- **FR-001-011（MUST）**：configure 纪律——目标三元组 aarch64-linux-android、API 下限与 lock
  一致、16KB 页对齐链接参数、静态扩展段（`Modules/Setup.local` `*static*`）、禁用
  tkinter/curses/readline/dbm/`_test*` 全家。
- **FR-001-012（MUST）**：静态扩展——`_ssl`/`_hashlib`/`zlib`/`_sqlite3`（起步集）静态链入，
  产物不得携带独立扩展 `.so`；OpenSSL/sqlite 以 vendored 钉版源参与链接。
- **FR-001-013（MUST）**：降级显式——任一扩展静态化失败时，构建**不得静默降级**（C4）：
  要么失败退出，要么以显式登记的裁剪清单继续并在元数据记录。
- **FR-001-014（MUST）**：strip 纪律——`llvm-strip --strip-unneeded`，产物命名
  `libpython_cli.so`（`lib*.so` 是打包识别前提，FR-000-034）。

### 3.3 随包数据域（M1-T5）

- **FR-001-020（MUST）**：stdlib 收集——`Lib/` 剔除 `test/`、`idlelib/`、`tkinter/`、
  `__pycache__/`、`*.pyc`，形成 stdlib-assets 树；纯数据无执行位要求（D4）。
- **FR-001-021（MUST）**：pip 树随包（D6）——官方 pip wheel（钉版+sha256）解包进
  `Lib/site-packages/`；wheel 内 `bin/` 脚本不使用（命令入口是壳脚本）。
- **FR-001-022（MUST）**：壳脚本入口——`libpip.so`/`libpip3.so` 为 sh 壳：exec
  `libpython_cli.so -m pip "$@"`；落在原生库目录（规划 §5）。
- **FR-001-023（MUST）**：ensurepip wheels 从源码树提取随包（修复/兜底路径保留）；
  CA bundle 钉 sha256 随包。

### 3.4 投放门禁扩展域（M1-T6）

- **FR-001-030（MUST）**：assets 投放——provision 新增把 stdlib-assets 树投放到容器
  assets 目录的能力，幂等（重复执行结果一致）。
- **FR-001-031（MUST）**：manifest 生成与校验——投放时生成逐文件 SHA-256 + 总 SHA-256 的
  清单；校验模式下按清单复验，缺文件/多文件/哈希漂移任一即失败。
- **FR-001-032（MUST）**：静态性检查——stdlib-assets 树内**不得出现 `.so`**（防动态扩展
  漏网，规划 §6）。
- **FR-001-033（MUST）**：jniLibs 壳脚本白名单——兄弟 `.so` 检查从「仅
  `libpython_cli.so`」扩展为「+ `libpip.so`/`libpip3.so`（内容须为 sh 壳）」，其余仍拒绝
  （扩展 000 已登记的缺陷 #3 处置）。
- **FR-001-034（MUST）**：构建元数据——BUILD-METADATA 记录目标版本/NDK/flags/时间，
  与 FETCH-METADATA 一同归档（镜像 pty 仓纪律）。
- **FR-001-035（MUST）**：退出码纪律沿用——0 成功 / 2 门禁或校验不合格 / 1 用法或 IO 错误
  （与 FR-000-032 同口径）。

## 4. 验收场景

- **五源可复现**：两台干净机器跑同一 fetch 命令，得到字节一致的五源（哈希全对）。
- **门禁全过**：构建产物过 000 七项 exec 门禁 + 本模块静态性检查 + 壳脚本白名单。
- **manifest 可复验**：投放后的 assets 树按清单校验通过；人为改动一个文件后校验失败。
- **壳脚本直出**：jniLibs 内 `libpip.so` 存在且内容为 sh 壳（`python -m pip` 入口）。

（交叉编译本体的首轮验证在 CI（⬜），判据见 [`002-building-workflow`](../002-building-workflow/spec.md) §4；
本批代码级验收见 [tasks.md](./tasks.md) 与 [`overall-test-cases.md`](../overall-test-cases.md)。）
