# 002 · 构建流水线（building-workflow）功能规格

> 模块：002-building-workflow · 状态：⬜ 已立项（本批实现 workflow 代码；真实跑批 ⬜ 待推送触发）
> 所属工程：aosp-python-cli · 规划基线：[`docs/000-工程规划.md`](../../docs/000-工程规划.md) §9（CI 设计）/§10.1（发布模式）
> 对应里程碑任务：M1-T7（规划 §10）；上游：[`001-building`](../001-building/spec.md)（构建脚本与门禁扩展）

## 1. 目的

把 001 的构建能力编排成**一条可复现的流水线**：干净 runner 装机 → 五源获取 → 交叉编译 →
门禁与投放 → 归档发布 → 事实源回写——全程无手工步骤，并修复 000 已登记的 CI 退出码断言缺陷。

## 2. 范围

**在范围内（002）：** CI workflow 文件（真实流水线）；runner 装机（NDK/JDK/Node/host python）；
触发条件（tag/手动）；归档制品（tar.gz + sha256 + 许可/元数据）；GitHub Release；lock 回写
（draft→released 的人工 PR 口径）；缓存策略；配置期门禁保留（PR/push 路径）。

**不在范围内（002）：** 构建脚本内部逻辑与门禁判据（→ 001）；Maven Central 发布（M3，规划 §10.1）；
lock 回写自动化（M4 评估）；探针 App 与真机验收（M2）。

## 3. 功能需求

- **FR-002-001（MUST）**：单流水线全链——resolve 版本 → fetch 五源 → 构建 → 门禁/投放 →
  打包 → Release → artifact 上传，任何一步失败即整体失败（无继续语义）。
- **FR-002-002（MUST）**：runner 装机钉版——系统镜像、JDK、Node、NDK、host build python
  各自版本在 workflow 内显式钉选；host python 与目标 CPython 版本一致性断言前置（衔接 FR-001-010）。
- **FR-002-003（MUST）**：触发条件——`v<pyver>` tag 推送或手动 dispatch 触发发布流水线；
  普通 push/PR 只跑配置期门禁（FR-000-040~042 语义保留）。
- **FR-002-004（MUST）**：退出码断言可达——预期非零退出的自检必须用「先捕获后断言」模式
  （修复 000 登记缺陷 #1：`bash -e` 下断言分支不可达）。
- **FR-002-005（MUST）**：归档形态——`python-cli-v<ver>-android-arm64-v8a.tar.gz`（so + 壳脚本 +
  stdlib-assets + BUILD/FETCH-METADATA + LICENSES）+ `.sha256` 侧车（规划 §9/§10.1）。
- **FR-002-006（MUST）**：Release 纪律——tag 钉 commit；Release 资产 = 归档 + 侧车；发布流水线
  与配置期门禁分 Job（权限最小化，`permissions: contents: read|write` 显式声明）。
- **FR-002-007（MUST）**：lock 回写路径——Release 成功后产出 lock 回写 diff（size/sha256/ndk/
  flags + `status=released`）作为 artifact 供维护者 PR（M4 前人工合入；不直接 push main）。
- **FR-002-008（SHOULD）**：缓存——fetch 五源与 OpenSSL/sqlite 构建中间物按锁值键缓存，
  命中时跳过（衔接 FR-001-002 可重入）。
- **FR-002-009（MUST）**：卫生——凭据不入流水线日志；RELEASE 类敏感参数不在 push 路径出现；
  产物只经 artifact/Release 通道出仓。

## 4. 验收场景

- **配置期路径不回归**：PR/push 触发的门禁 Job 与 000 行为一致（含修复后的退出码断言）。
- **发布流水线可复现**：同 tag 重跑产出同 sha256 归档（NFR-1；⬜ 首跑后验证）。
- **断言缺陷已修**：provision `--check` 未投放场景在 CI 中真实走到断言分支并按预期「绿」。
- **lock 回写物就绪**：Release Job 产出可直接应用的 lock diff artifact（⬜ 首跑后验证）。

（本批可验证 = workflow 语法/结构/断言模式静态检查 + 本地 actionlint 等价校验；真实跑批 ⬜。）
