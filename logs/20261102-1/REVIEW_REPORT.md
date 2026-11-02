# REVIEW_REPORT — 20261102-1（代码评审阶段）

> 评审人：code-reviewer 子代理（requesting-code-review 技能派发；base `f58534f` → head `4950cc5`，5 笔 dev 提交）
> 处置人：主代理（receiving-code-review 技能：逐条对照代码核实后实施，无表演性接受；修复后逐项回归）。
> 评审结论原文：12 项发现（1 Critical / 4 Important / 7 Minor），「修完 #1/#2 才可 CI 首跑」。

## 发现与处置（全部 12 项均经本地核实成立后处置）

| # | 级别 | 发现 | 核实 | 处置 | 回归验证 |
|---|---|---|---|---|---|
| 1 | Critical | Setup.local 静态段漏 zlib（FR-001-012 起步集四件只落三件；不落段 ⇒ lib-dynload 动态 .so 永不随包 ⇒ 设备 import zlib 失败 = 静默降级 C4） | 成立（注释自相矛盾） | 加 `zlib zlibmodule.c -lz` 行 + 修正注释 | dry-run 输出含 zlib 行 ✅ |
| 2 | Important | --skip-extensions 匹配断裂：短名（ssl）静默无效；all 打印"空段"却仍输出全部行（BUILD-METADATA 误记录） | 成立 | normalize_skip()：短名/模块名/all 规范化 + 未知名 exit 1；all 真清空段 | skip=ssl → _ssl 行消失；bogus → exit 1；all → 空段+C4 注记 ✅ |
| 3 | Important | cache restore-keys + fetch 缓存污染防线 = lock 变更后流水线死锁（旧缓存哈希必不匹配 → exit 1，无自愈） | 成立 | 移除 restore-keys（精确键未命中=重新下载，即 plan §5 原设计） | grep 确认无 restore-keys 键（仅注释提及） ✅ |
| 4 | Important | --report-sha256 信任既有缓存 ⇒ 陈旧/外来文件哈希冒充官方钉选（cacert.pem 无版本文件名场景） | 成立 | 引导模式强制重新下载 + 文案「引导模式不信任缓存」 | cacert 重下后哈希与已钉值一致 ✅ |
| 5 | Important | 禁用集（tkinter/curses/readline/dbm/_test*）两种 configure 模式都未注入 | 成立 | Setup.local 增加 `*disabled*` 段（make 期生效，两模式共用）+ manual 模式补 `--disable-test-modules` | dry-run 输出 *disabled* 段五族模块 ✅ |
| 6 | Minor | --collect-only 缺 --out ⇒ ASSETS 落根目录；--deps 默认错位 | 成立 | collect-only 强制要求 --out（usage exit 1）；DEPS 缺省仅在 .dist/src 存在时取 | 缺 --out → exit 1 ✅ |
| 7 | Minor | host python 版本不符 exit 2，plan §3.2 冻结口径为 exit 1 | 成立（对冻结契约的偏离） | 改 exit 1（对齐冻结契约） | 代码审查确认 err 默认码 1 ✅ |
| 8 | Minor | `cp aar || true` 静默丢 AAR | 成立 | 移除 `|| true`（fail loudly） | grep 确认 ✅ |
| 9 | Minor | ccache 层空转（绝对路径 clang 绕过 PATH shim） | 成立 | 移除 ccache 步骤 + 注释登记延后（002 plan §5 原定"首轮实测后决定"；FR-002-008 SHOULD 级） | grep 确认无 ccache-action ✅ |
| 10 | Minor | symlink 盲区（不进 manifest/躲过静态性检查）+ manifest 不与 lock 版本/ABI 交叉核对 | 成立 | walkFiles 遇 symlink fail-closed throw；verifyAssets 增 version/abi 交叉核对 | 篡改 manifest version → `版本不匹配` exit 2 ✅；symlink 路径本机无创建特权，未实测（如实登记 ⚠️） |
| 11 | Minor | --api 不与 lock androidApi 校验；workflow 手抄 24 会漂移 | 成立 | 脚本 ② 步读 lock 校验（不符 exit 1）；workflow API 一律取自 lock（env 不再钉） | grep 确认 ANDROID_API 来自 lock 导出 ✅ |
| 12 | Minor | BUILD-METADATA 用第 N 次 "version" 出现位取依赖版本（--only 场景错位） | 成立 | 改按 sources.<key>.version 精确取值 | 代码审查确认 ✅（collect-only 路径待 CI 首产复核） |

## 评审确认无问题（未重复验证，列作记录）

断言可达模式与 step 顺序、tag 触发/needs 语义、permissions 收敛、manifest 自排除与缺/多/漂移检出、
夹具与 parseElf 的结构一致性、壳脚本白名单防 BOM/前缀伪装、下载重定向上界、退出码三值纪律。

## 未修复项（如实登记）

- **#10 symlink 拒绝路径未实测**：本机（Windows 无 symlink 特权）无法创建测试用 symlink；
  代码为单行 isSymbolicLink() fail-closed，登记待 CI 或真机环境补测。
- **#9 ccache**：延后到首轮 CI 实测耗时后决定接入方式（002 plan §5 既定口径），非遗忘。

## 结论

- Critical 0 遗留 / Important 0 遗留 → **达到进入测试阶段的门槛**（评审人标准：#1/#2 修复后方可 CI 首跑）。
- 修复提交见 git log（fix 前缀）；回归全部通过（除上述如实登记的 1 项）。
