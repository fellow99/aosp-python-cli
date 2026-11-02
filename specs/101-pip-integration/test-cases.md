# 101-pip-integration 测试用例（pip 主要用例正典）

> 对应：[spec.md](./spec.md) §3（FR-101-001…012）· 规划 §7.1（探针 P4/P5）· 决策 D6。
> **环境/状态口径**：同 [`../003-cli/test-cases.md`](../003-cli/test-cases.md)（host/device 分列，
> ⬜ 待执行，C6）。`PTY$` = 终端 App 内经 PTY 执行（`pip` = `libpip.so` 壳脚本别名）。
> **期望值引用规则**：pip 版本串一律引用 lock `builtFrom.deps.pip.version`（记 `<pipver>`），
> python 版本引用 `active.version`（记 `<pyver>`）——不写死副本。

## 一、设备侧用例（⬜ 待 CI 首产 + M2-T2）

| # | 用例 | 环境 | 前置 | 步骤 | 期望（可证伪） | 探针 | FR | 状态 |
|---|---|---|---|---|---|---|---|---|
| TC-101-01 | pip --version 直出 | device | 产物物化 + env 注入 | `PTY$ pip --version` | stdout = `pip <pipver> (python <pyver>)` 形态；exit 0 | P4 | FR-101-001 | ✅（2026-11-02） |
| TC-101-02 | pip3 别名 | device | 同上 | `PTY$ pip3 --version` | 与 TC-101-01 输出一致 | P4 | FR-101-001 | ✅（2026-11-02） |
| TC-101-03 | 离线首启 | device | 飞行模式/无网络 | `PTY$ pip --version` | 成功（不触网）；`pip list` 成功列出 pip | — | FR-101-002 | ⬜ |
| TC-101-04 | 纯 py 包安装 | device | 网络可用（P3 已过） | `PTY$ pip install packaging` → `python -c 'import packaging;print(packaging.__version__)'` | 安装成功 + import 有输出；`pip list` 出现 packaging | P4 | FR-101-005 | ⬜ |
| TC-101-05 | list/show | device | TC-101-04 后 | `pip list`；`pip show packaging` | list 含 pip 与 packaging；show 输出 Version/Location 字段 | — | FR-101-006 | ⬜ |
| TC-101-06 | sdist 安装拒绝 | device | 网络可用 | `pip install <已知仅 sdist 的包>` | exit ≠ 0；stderr 可分类（无编译器/构建失败语义）；`pip list` 无残留 | — | FR-101-008 | ⬜ |
| TC-101-07 | C 扩展包安装边界 | device | 网络可用 | `pip install <纯 C 扩展包（无 android arm64 wheel 场景）>` | exit ≠ 0；无半安装残留 | — | FR-101-008 | ⬜ |
| TC-101-08 | 卸载 | device | TC-101-04 后 | `pip uninstall -y packaging` | exit 0；import 失败；`pip list` 不再列出 | — | FR-101-007 | ⬜ |
| TC-101-09 | ensurepip 兜底修复 | device | 删除/损坏可写层 pip 后 | `python -m ensurepip --upgrade` → `pip --version` | 修复成功且 pip 可用（D6 兜底判据） | — | FR-101-010 | ⬜ |
| TC-101-10 | uv pip 组合 | device | aosp-uv-cli 就绪（外部依赖） | `PTY$ uv pip install <纯py包>` → `python -c 'import …'` | 安装 + import 成功；未就绪 ⇒ **BLOCKED（不判失败）** | P5 | FR-101-011 | ⬜ |
| TC-101-11 | CLI 入口脚本事实 | device | 装 `pip install <带 console_scripts 的包>` | 尝试直接 exec 安装的脚本；再 `python -m <mod>` | 直接 exec 预期失败（SELinux C1，记录事实）；`python -m` 可替代成功 | — | FR-101-012（事实面） | ⬜ |
| TC-101-12 | 无网络失败可读 | device | 飞行模式 | `pip install packaging` | exit ≠ 0；报错含网络语义；不崩溃不静默 | — | FR-101-012 | ⬜ |
| TC-101-13 | 参数透传 | device | — | `PTY$ pip --help`；`pip check` | 壳脚本零解释：help 输出完整；退出码与 pip 一致 | — | FR-101-004 | ⬜ |
| TC-101-14 | pip 自升级 | device | 网络可用 | `pip install --upgrade pip` → `pip --version`；记录 `python -c 'import pip;print(pip.__file__)'` | 新版本生效；`__file__` 落可写层（事实记录回填） | — | FR-101-009 | ⬜ |

## 二、host 侧用例（构建机执行——随 001 dev 验证）

| # | 用例 | 环境 | 前置 | 步骤 | 期望 | FR | 状态 |
|---|---|---|---|---|---|---|---|
| TC-101-15 | pip 树构成 | host | 001 build 步⑦产物（或本地替身构建） | 检查 `stdlib-assets/Lib/site-packages/pip/` | `pip/__init__.py` 存在；**无 `bin/` 入口**；`pip-<ver>.dist-info/METADATA` 的 `Version:` = lock `<pipver>`（pip 26.x 树无 `__version__.py`，以 dist-info 为准——2026-11-02 实测修正） | FR-101-003 | ✅（2026-11-02） |
| TC-101-16 | 壳脚本内容与语法 | host | 同上 | 查看 `libpip.so`/`libpip3.so` 内容；`sh -n` 语法检查 | 内容 = 001 §3.3 模板（`#!/system/bin/sh` + `exec … -m pip "$@"`）；语法过 | FR-101-001/004 | ✅（2026-11-02） |
| TC-101-17 | manifest 登记 pip 树 | host | provision `--assets` 投放后 | 检查 manifest.json | `files` 含 `Lib/site-packages/pip/…` 条目；ensurepip 条目齐备 | FR-101-003/010 | ✅（2026-11-02） |
| TC-101-18 | 白名单放行 | host | jniLibs 投放后 `--check` | 含 libpip*.so 的目录检查 | `--check` exit 0（白名单生效）；换成真二进制内容的伪 libpip.so ⇒ exit 2 | FR-101-001 | ✅（2026-11-02） |

## 三、事实记录区（回填处，C6）

| 项 | 值 | 记录时间 |
|---|---|---|
| pip 自升级后 `__file__` 落点 | ⬜ | — |
| CLI 脚本直接 exec 失败形态（errno/文案） | ⬜ | — |
| sdist 拒绝错误串样例 | ⬜ | — |
| uv 组合可用性 | ⬜（外部依赖） | — |

## 四、禁止的判据

1. 不得以 host pip 行为推断设备 pip（路径/权限/网络面不同）。
2. 不得断言上游错误文案逐字匹配（版本会变），只断言可分类语义 + 退出码 + 无残留。
3. uv 组合未就绪时不得删除或跳过用例不记录——必须标 BLOCKED 并注明外部依赖。
