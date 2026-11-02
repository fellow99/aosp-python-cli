# 002-building-workflow 任务拆解

> 对应：[spec.md](./spec.md) / [plan.md](./plan.md)。原则：workflow 代码本批落地；真实跑批留 tag 推送后。

## T1 gate Job 重排（配置期门禁保留 + 缺陷修复）
- [ ] T1.1 push/PR/dispatch 触发的 gate Job 与 000 行为对齐（gradle tasks + 语法门）— FR-002-003
- [ ] T1.2 显式 setup-node 20（修复 000 登记建议项「CI 未 setup-node」）
- [ ] T1.3 退出码断言改 `|| code=$?` 模式（缺陷 #1 修复）— FR-002-004
- [ ] T1.4 release Job 触发隔离（tag v* / dispatch）+ `permissions` 收敛 — FR-002-006

## T2 release Job 流水线
- [ ] T2.1 装机矩阵（JDK21/Node20/NDK r28c/host python，版本集中 env 钉选）— FR-002-002
- [ ] T2.2 resolve 版本（tag→版本，与 lock active 一致性断言）
- [ ] T2.3 fetch → build → provision（jniLibs + assets + --check 全门禁）— FR-002-001
- [ ] T2.4 `gradle :python-cli:assembleRelease`（AAR 归档验证）
- [ ] T2.5 tar.gz + sha256 侧车打包（so/壳/stdlib-assets/元数据/许可）— FR-002-005
- [ ] T2.6 gh-release 上传（tag 钉 commit）— FR-002-006
- [ ] T2.7 lock 回写 diff artifact（tools/lock-writeback.mjs）— FR-002-007
- [ ] T2.8 缓存层（fetch 五源 + ccache）— FR-002-008

## T3 lock 回写工具
- [ ] T3.1 `tools/lock-writeback.mjs`（读 BUILD-METADATA + 实测产物 → 输出新 lock 文本 + diff；不落库）
- [ ] T3.2 `node --check` 过 + 本地 fixtures 自测

## T4 验证与登记
- [ ] T4.1 YAML 语法/结构静态检查（本批可跑）
- [ ] T4.2 断言模式存在性检查（grep `\|\| code=\$?`）
- [ ] T4.3 000-scaffold plan §9 缺陷 #1 状态更新为「已修复（002）」
- [ ] T4.4 提交（feat(ci): …）
