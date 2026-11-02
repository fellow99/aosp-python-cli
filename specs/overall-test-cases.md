# overall-test-cases.md —— `aosp-python-cli` 全模块测试用例索引

> **性质**：测试用例**索引**。用例正典分布：[`000-scaffold/test-cases.md`](./000-scaffold/test-cases.md)（TC-01…TC-09，含 2026-11-02 执行记录）· [`003-cli/test-cases.md`](./003-cli/test-cases.md)（TC-003-01…17）· [`101-pip-integration/test-cases.md`](./101-pip-integration/test-cases.md)（TC-101-01…18）；本文按测试分层归位、给出执行状态与规划层的用例归属，**不复制用例正文**。
> **依据**：`specs/constitution.md`（证据纪律 §三）· 各模块 test-cases.md · `../docs/000-工程规划.md`（规划 §7.1 探针、§12 门禁、§10.2 模块划分——⬜规划引用）。
> **版本**：v1.1 · 2026-11-02 · 状态：M0 用例 9/9 已执行全过；001/002 的 host 侧用例随本批 dev 执行；003/101 设备侧用例已立项（⬜ 待 CI 首产，如实登记）。

---

## 1. 测试分层

| 层 | 判定手段 | 用例族 | 状态 |
|---|---|---|---|
| L1 静态语法门 | `node --check` / `bash -n` | TC-04、TC-08 | ✅ 已执行 |
| L2 构建配置门 | 构建系统任务图求值与产物产出 | TC-01、TC-02、TC-03 | ✅ 已执行 |
| L3 工具语义门 | 退出码纪律（0/2/1）与文案 | TC-05、TC-06、TC-07 | ✅ 已执行 |
| L4 仓库卫生门 | git 视角的不入库断言 | TC-09 | ✅ 已执行 |
| L5 门禁/投放全链（七项门禁 + manifest 校验 + 白名单） | 产物/fixtures | TC-003-16/17、TC-101-15…18（host，合成 fixture 驱动）＋ 真实产物 ⬜ CI 首产后 | 已立项；host 子集随本批 dev 执行 |
| L6 真机回程探针（PTY 内 python/pip） | 规划 §7.1 P1–P6 | TC-003-01…15（P1/P2/P3/P6）、TC-101-01…14（P4/P5）——正典在模块目录 | 已立项；⬜ 待 CI 首产 + M2-T2 |

> L5 的 host 子集以**合成 ELF fixture + stdlib 替身**验证投放链（不断言解释器行为）；L6 全部
> ⬜——仓内无二进制，任何「真机可用」的说法都必须等 PTY 回程证据（C6）。

---

## 2. 用例索引（正典：`000-scaffold/test-cases.md`）

| # | 用例 | 验证的 FR / 宪法条目 | 执行状态（2026-11-02 记录） |
|---|---|---|---|
| TC-01 | 干净工程可配置（无 `.so` 任务求值成功） | FR-000-005 · FR-000-040 | ✅ BUILD SUCCESSFUL |
| TC-02 | AAR 容器可产出 | FR-000-002 | ✅ `python-cli-debug.aar` 产出（仍可复核：`python-cli/build/outputs/aar/`） |
| TC-03 | 版本坐标解析 = `CLI_VERSION`（执行时 3.14.0；现 3.14.10 draft） | FR-000-003 | ✅ |
| TC-04 | provision 语法检查 | FR-000-042 · S1 | ✅ exit 0 |
| TC-05 | provision 未投放语义（`--check` = 2，文案含「未投放」与「draft 无锁值」） | FR-000-031/032 · C4/C5 | ✅ exit 2 |
| TC-06 | fetch 骨架语义（SCAFFOLD = 2） | S7 · S1 | ✅ exit 2 |
| TC-07 | build 骨架语义（SCAFFOLD = 2） | S7 · S1 | ✅ exit 2 |
| TC-08 | build 脚本语法检查 | FR-000-042 | ✅ exit 0 |
| TC-09 | 二进制不入库（`git status --porcelain` 无 jniLibs/assets 条目） | C3 · FR（卫生） | ✅ |

> 执行环境：Windows + Gradle 9.4.1 + Temurin 21（`000-scaffold/test-cases.md` 头注）。

### 2.1 新模块用例索引（2026-11-02 立项）

| 模块 | 正典位置 | 用例段 | 环境 | 状态 |
|---|---|---|---|---|
| 001-building | tasks T2/T3/T4 内嵌（fetch/build/provision 各步验收） | TC-001-xx（host 子集） | host | 随本批 dev 执行；CI 子集 ⬜ |
| 002-building-workflow | tasks T4 内嵌（YAML/断言模式/结构） | TC-002-xx | host | 随本批 dev 执行；跑批 ⬜ |
| 003-cli | [`003-cli/test-cases.md`](./003-cli/test-cases.md) | TC-003-01…15（device）/ 16…17（host） | host+device | host 随本批执行；device ⬜ |
| 101-pip-integration | [`101-pip-integration/test-cases.md`](./101-pip-integration/test-cases.md) | TC-101-01…14（device）/ 15…18（host） | host+device | host 随本批执行；device ⬜（uv 组合 BLOCKED 机制） |


---

## 3. 禁止的判据（写进未来所有用例的验收纪律）

1. **不得以「工具没报错」代替门禁通过**——七项门禁必须逐项 ✔ 打印（`provision.mjs` 输出即证据）。
2. **不得在 draft 阶段宣称「sha/size 已校验」**——draft 只记录不比对（FR-000-011；`provision.mjs:156-159`）。
3. **不得以本机模拟器/本地跑通代替真机回程**——M1+ 的任何「可用」结论必须出自 PTY 回程探针（规划 §7.1，⬜）。
4. **不得把规划当已测**——M1/M2 用例立项前，L5/L6 一律保持「无用例」的如实状态。

---

## 4. 快照命令（先看证据，再看结论）

```bash
node tools/provision.mjs --check                                   # 未投放 ⇒ 预期退出码 2
node --check tools/provision.mjs && bash -n scripts/build-python-cli-android.sh   # 静态门
node scripts/fetch-python-cli-source.mjs --python 3.14.10           # 五源钉选后 exit 0（sha256 未钉 ⇒ exit 1）
bash scripts/build-python-cli-android.sh --python 3.14.10 --src x --ndk y --out z --dry-run  # 干跑打印全流程（真实编译 CI ⬜）
gradle :python-cli:tasks --console=plain                           # 配置门（需 Gradle 9.4.1 + JDK 21）
git status --porcelain                                             # 卫生门：jniLibs/assets 无条目
```
