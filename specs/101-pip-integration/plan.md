# 101-pip-integration — 模块技术方案（plan.md）

> **性质**：**实现特定**。101 的实现落点在 **001 的构建产物**（pip 树解包/壳脚本生成/provision
> 白名单）与**本模块用例正典**；本仓不修改 pip 本体（C1：上游 wheel 原样解包）。
> **成对文档**：功能规格见 [spec.md](./spec.md)（`FR-101-001…012` 唯一权威定义处）；用例正典见
> [test-cases.md](./test-cases.md)（TC-101-01…18）。
> **状态**：⬜ 契约冻结；设备侧执行 ⬜ 依赖 CI 首产 + M2-T2；host 侧（树构成/壳脚本/清单）随本批 dev 验证。

---

## 1. 技术上下文

| 项 | 取值 | 说明 |
|---|---|---|
| 随包 pip 树 | `assets/python-bridge-tools/Lib/site-packages/pip/`（wheel 解包） | 001 build 步⑦生成 |
| 命令入口 | `jni/arm64-v8a/libpip.so` / `libpip3.so`（sh 壳，001 §3.3 模板） | provision 白名单（001 FR-001-033） |
| 钉版事实 | `python-cli.lock.json` `builtFrom.deps.pip`（version/url/sha256） | 001 §3.1 |
| ensurepip 树 | `assets/python-bridge-tools/ensurepip/`（wheels） | 修复兜底（D6） |
| 安装目标 | `<filesDir>/…/Lib/site-packages/`（消费方物化环境的可写层） | 消费方注入 PYTHONHOME（003 §3 模板） |
| uv 组合 | aosp-uv-cli 的 `libuv.so` 同 nativeLibraryDir；`uv pip --python <python 环境>` | P5 ⬜（uv 线状态外部依赖） |

## 2. 宪法合规

| 条目 | 落点 |
|---|---|
| C1 不改源 | pip wheel **解包不重打包**；壳脚本是我们自己的入口件，非 pip 修改 |
| C2 唯一事实源 | pip 版本/sha256 只在 lock `builtFrom.deps.pip`；用例期望值引用 lock，不写死副本 |
| C6 未实测标 ⬜ | 设备侧用例全 ⬜；uv 组合 BLOCKED 机制（不删用例） |
| C7 许可 | pip(MIT) 已在 `python-cli/THIRD-PARTY-NOTICES.md`；wheel 解包含 `LICENSE.txt` 随包 |

## 3. 设计决策

1. **壳脚本而非 symlink**：Android apks 解包后 symlink 语义不可靠；sh 壳 + `dirname "$0"`
   自定位是最稳的 nativeLibraryDir 内入口（001 §3.3 已固化模板）。
2. **不随包 wheel 的 `bin/`**：pip wheel 解包含 `pip/` 包目录 + `bin/pip` 入口文本；后者
   shebang 指向构建机 python 路径，在设备无意义——剔除并在 build 步⑦登记剔除计数。
3. **安装边界的判据口径**：「失败可读」= 退出码非 0 且 stderr 含可分类错误串（无编译器/
   无匹配 wheel/网络），同时 `pip list` 无半安装残留——**不**断言具体错误文案（上游版本会变）。
4. **pip 自升级的落点**：升级安装进可写层 site-packages（Python 路径序使新版本遮蔽随包版），
   随包只读树不动——用例记录 `pip --version` 与 `pip 的 __file__` 位置作为事实。

## 4. 用例设计（与 003 同构纪律）

- 编号 `TC-101-NN`；环境列 host/device；设备侧映射 P4（TC-101-01…05、08）、P5（TC-101-10）。
- host 侧可本批执行：pip 树构成（wheel 解包正确性）、壳脚本内容与语法、manifest 登记
  site-packages/pip、ensurepip wheels 存在性——由 001 dev 阶段的本地构建（⑥⑦ 步替身实测）覆盖。
- 设备侧全部 ⬜；uv 组合用例带 BLOCKED 出口（外部依赖 uv 线）。

## 5. 实现策略（本批）

- 本模块**不新增代码文件**：实现载体是 001 的 build 步⑦ + provision 扩展（壳脚本白名单/manifest
  含 pip 树）+ 本用例正典。dev 阶段在 001 的 tasks 下执行，验收口径在此引用。
- 设备侧探针执行 ⬜ M2-T1/M2-T2 窗口（与 003 共用载体）。

## 6. 不一致与风险登记

| # | 项 | 处置 |
|---|---|---|
| 1 | pip 版本与 CPython 3.14 兼容矩阵 ⬜（规划 R8） | lock 钉版独立升级；用例期望值引用 lock |
| 2 | `pip install` 走 HTTPS 需 TLS 可用（依赖 003 P3 链路） | 用例前置声明 P3 通过；P3 未过则 P4 用例 BLOCKED |
| 3 | pip 装 CLI 脚本（console_scripts）落 filesDir 不可 exec（规划 §7 已知限制） | TC-101-11 记录事实判据（`python -m` 可替代）；处置归消费方文档 |
| 4 | uv 线（aosp-uv-cli）就绪时间外部依赖 | TC-101-10 BLOCKED 机制；不阻塞本模块其余验收 |
