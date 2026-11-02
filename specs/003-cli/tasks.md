# 003-cli 任务拆解

> 对应：[spec.md](./spec.md) / [plan.md](./plan.md)。原则：契约与用例本批冻结；设备侧执行依赖 CI 首产 + M2-T2。

## T1 契约冻结
- [ ] T1.1 FR-003-001…014 评审通过（探针映射：P1/P2/P3/P6 ↔ TC 编号）— 全 FR
- [ ] T1.2 环境变量注入模板与规划 §7 全表核对一致 — FR-003-012

## T2 用例正典
- [ ] T2.1 [test-cases.md](./test-cases.md) TC-003-01…17 编写（host/device 列 + 状态 ⬜）— §4 验收
- [ ] T2.2 host 侧子集并入 overall-test-cases.md 索引并执行
- [ ] T2.3 设备侧子集标注「待 CI 首产 + M2-T2」（不得标已执行，C6）

## T3 打包面支撑核对（host，本批）
- [ ] T3.1 合成 fixture 下 AAR 含 jni/arm64-v8a 条目 + assets/python-bridge-tools/ 树 — FR-003-001 打包面
- [ ] T3.2 META-INF/python-cli.properties 字段与 lock 一致 — FR-003-002 事实面

## T4 设备侧执行准备（⬜ 后续窗口）
- [ ] T4.1 探针执行载体立项（消费方探针 App 或 scripts/probe-device）— M2-T1
- [ ] T4.2 TC-003-01…14 逐条执行 + P6 事实记录回填 — M2-T2
