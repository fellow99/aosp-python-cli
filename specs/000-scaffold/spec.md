# 000 · 工程搭建（scaffold）功能规格

> 模块：000-scaffold · 状态：已实现（scaffold 级）
> 所属工程：aosp-python-cli · 规划基线：[`docs/000-工程规划.md`](../../docs/000-工程规划.md)
> （pty 仓的 spec/plan/test-cases 四件套在本仓折叠为三件。）

## 1. 目的

确立 `aosp-python-cli`（Android `python` 命令行，exec 型 PIE，静态扩展）的仓库结构、构建
系统、版本纪律、exec 门禁工具与 CI（配置期），使 M1 的"PEP 738 交叉编译 libpython_cli.so"
只需在既定骨架内填充实现。

## 2. 范围

**在范围内（000）：** Gradle 骨架（`:python-cli`，**useLegacyPackaging=true**）、
`python-cli.lock.json`（draft）、`tools/provision.mjs`（exec 门禁）、脚本骨架
（fetch/build，接口固化）、配置期 CI、README（中英）/docs/000/THIRD-PARTY/.gitignore/LICENSE。

**不在范围内（000）：** 不产出 `libpython_cli.so`（M1 在 CI 完成）；不实现嵌入 API；
不发布 Maven Central。

## 3. 功能需求（摘要）

- FR-000-001：root 工程名 `aosp-python-cli`，仅 include `:python-cli`。
- FR-000-002：`:python-cli` 是 Android library，namespace `org.fellow99.pythoncli`，
  `minSdk 24`、`compileSdk 36`，ABI 仅 arm64-v8a。
- FR-000-003：坐标 `io.github.fellow99:python-cli:<CLI_VERSION>`；`CLI_VERSION` = CPython
  上游版本，独立 semver，与 node 系无配对。
- FR-000-004：**packaging.jniLibs.useLegacyPackaging = true**（exec 型硬要求）。
- FR-000-005：无 `.so` 时 Gradle 配置/任务求值必须成功。
- FR-000-010~013：lock 纪律（draft 不伪造哈希；gates 键含 `ptInterpSystemLinker` 与
  `neededWhitelist`；无 pairedRuntime 字段）。
- FR-000-030~036：provision（退出码 0/2/1；仅投放 `libpython_cli.so`；jniLibs 禁入
  `libnode.so`；写 META-INF/python-cli.properties）。
- FR-000-040~042：CI 配置期门禁（`gradle :python-cli:tasks`；provision `--check` 未投放=2；
  `node --check` / `bash -n`）。

## 4. 验收场景

- **干净工程可配置**：无 `.so` 时 `gradle :python-cli:tasks` 成功。
- **provision 退出码纪律**：未投放时 `--check` 退出码 = 2。
- **二进制不入库**：投放后 jniLibs/assets 均被 git 忽略。

（逐条用例见 [test-cases.md](./test-cases.md)。）
