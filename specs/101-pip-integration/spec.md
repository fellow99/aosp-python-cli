# 101 · pip 集成（pip-integration）功能规格

> 模块：101-pip-integration · 状态：⬜ 已立项（契约与用例本批冻结；执行依赖 CI 首产产物）
> 所属工程：aosp-python-cli · 规划基线：[`docs/000-工程规划.md`](../../docs/000-工程规划.md) §3.1 D6（pip 随包+壳脚本）/§5（制品）/§7.1（P4/P5 探针）
> 对应里程碑任务：M1-T5（pip 部分）+ M2-T2（P4/P5）；上游：[`003-cli`](../003-cli/spec.md)（`python -m` 入口）

## 1. 目的

定义「设备上的 `pip` 命令」的行为契约：随包 pip 树的组成与离线可用性、壳脚本直出、
安装纯 Python 包的全链、**安装边界（sdist/C 扩展拒绝）**、ensurepip 兜底与 uv 组合——
并给出可证伪的主测试用例集。

## 2. 范围

**在范围内（101）：** pip 树随包构成（钉版 wheel 解包、无 bin 脚本）；`libpip.so`/`libpip3.so`
壳脚本行为；`pip --version`/`pip list`/`pip show`/`pip install <纯py wheel>`/`pip uninstall`；
安装边界（sdist、含 C 扩展 wheel、CLI 入口脚本）；ensurepip 修复兜底；`pip install --upgrade pip`；
与 aosp-uv-cli 的组合（P5）。

**不在范围内（101）：** pip 本体的修改或补丁（上游 wheel 原样解包，C1）；pip 源码构建/交叉编译
（pip 是纯 py）；uv 本体（属 aosp-uv-cli 仓）；pip 装 CLI 脚本后脚本的 exec 问题处置
（消费方文档职责，本模块只定义**事实判据**）；PyPI 私有镜像/index 配置（消费方环境面）。

## 3. 功能需求

### 3.1 命令直出域（D6）

- **FR-101-001（MUST）**：`pip` 命令直出——`libpip.so` 壳脚本以 `exec
  <同目录>/libpython_cli.so -m pip "$@"` 实现；`pip3` 为别名（`libpip3.so`）；
  在 PTY 内 `pip --version` 回程版本串（含 pip 版本与 python 版本两段）与 lock 钉选一致（P4）。
- **FR-101-002（MUST）**：离线首启——pip 树随包（`Lib/site-packages/pip/`），首次运行
  `pip --version` **不触发任何网络请求**（飞行模式判据）。
- **FR-101-003（MUST）**：随包树构成——pip 官方 wheel 解包产物 + 钉版记录（lock
  `builtFrom.deps.pip`）；wheel 内 `bin/` 入口脚本**不随包**（命令入口唯一 = 壳脚本）。
- **FR-101-004（MUST）**：参数透传——壳脚本对参数零解释（`"$@"` 原样），退出码 = pip 退出码。

### 3.2 安装域（P4 主链）

- **FR-101-005（MUST）**：纯 py wheel 安装——`pip install <纯py包>`（如 `packaging`）从
  PyPI 下载并安装进 `<filesDir> python 环境` 的 `site-packages/`，随后 `python -c
  'import <mod>'` 成功（P4 判据）。
- **FR-101-006（MUST）**：安装清单——`pip list` 显示已装包（pip 自身 + 新装包）；
  `pip show <包>` 输出版本/位置。
- **FR-101-007（MUST）**：卸载——`pip uninstall -y <包>` 后 import 失败且 `pip list` 不再列出。
- **FR-101-008（MUST）**：安装边界拒绝——`pip install <sdist 包>` 失败且报错可读
  （无编译器/不支持构建）；`pip install <含 C 扩展 wheel 包>`（无 android arm64 wheel 场景）
  失败可读；两者**不得**留下半安装状态（import 不残留）。
- **FR-101-009（SHOULD）**：pip 自升级——`pip install --upgrade pip` 成功且升级后
  `pip --version` 反映新版本（写入 filesDir site-packages，不触碰随包只读树的事实记录）。

### 3.3 兜底与组合域

- **FR-101-010（MUST）**：ensurepip 兜底——随包 ensurepip wheels 保留；`python -m ensurepip
  [--upgrade]` 可在 pip 树损坏时修复（D6 的「修复/兜底路径保留」判据）。
- **FR-101-011（SHOULD）**：uv 组合（P5）——`uv pip install <纯py包>`（aosp-uv-cli 的 uv
  指向同一 python 环境）安装成功且 `python -c 'import <mod>'` 通过；失败模式如实记录
  （uv 线未 ready 时标 ⬜ BLOCKED，不删用例）。
- **FR-101-012（MUST）**：网络失败可读——无网络时 `pip install` 失败报错含网络语义，
  不崩溃、不静默成功。

## 4. 验收场景（主测试用例索引）

用例正典：[test-cases.md](./test-cases.md)（TC-101-01…18，host/device 分列）。设备侧判据 =
规划 §7.1 P4/P5；host 侧判据 = 随包树构成/壳脚本内容/清单登记。

- **P4 主链**：`pip --version` 直出（TC-101-01）→ 离线首启（TC-101-02）→
  `pip install packaging` + import（TC-101-04）→ list/show（TC-101-05）。
- **边界链**：sdist 拒绝、C 扩展拒绝、无网络可读失败（TC-101-06/07/08）。
- **兜底/组合**：ensurepip 修复（TC-101-09）、uv 组合（TC-101-10，⬜）。
