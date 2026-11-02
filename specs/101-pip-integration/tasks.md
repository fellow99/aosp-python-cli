# 101-pip-integration 任务拆解

> 对应：[spec.md](./spec.md) / [plan.md](./plan.md)。原则：契约与用例本批冻结；实现载体在 001（build 步⑦ + provision 扩展）。

## T1 契约冻结
- [x] T1.1 FR-101-001…012 评审通过（P4/P5 映射 ↔ TC 编号）— 全 FR
- [x] T1.2 pip 钉版版本核对（lock `builtFrom.deps.pip.version`）— FR-101-003

## T2 用例正典
- [x] T2.1 [test-cases.md](./test-cases.md) TC-101-01…18 编写（host/device 列 + 状态 ⬜）
- [x] T2.2 host 侧子集并入 overall-test-cases.md 索引并执行（随 001 dev 验证）
- [x] T2.3 设备侧子集标注「待 CI 首产 + M2-T2」；uv 组合标 BLOCKED 出口 — C6

## T3 实现载体核对（引用 001 tasks，不重复实现）
- [x] T3.1 build 步⑦ pip 树解包 + bin 剔除 + 壳脚本生成（001 T3.7）— FR-101-001/003/004
- [x] T3.2 provision 白名单放行 libpip*.so 且内容校验（001 T4.4）— FR-101-001
- [x] T3.3 manifest 登记含 `Lib/site-packages/pip/`（001 T4.2）— FR-101-003

## T4 设备侧执行准备（⬜ 后续窗口）
- [ ] T4.1 TC-101-01…09/11…14 逐条执行（与 003 共用 M2-T1 探针载体）— M2-T2
- [ ] T4.2 uv 组合 TC-101-10 待 aosp-uv-cli 就绪后执行（P5）
- [ ] T4.3 事实记录回填（pip 升级落点/CLI 脚本不可 exec 实证）— FR-101-009
