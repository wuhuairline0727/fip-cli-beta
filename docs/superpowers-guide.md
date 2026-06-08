# Superpowers 功能实现指南

> **项目地址**: [obra/superpowers](https://github.com/obra/superpowers)  
> **作者**: Jesse Vincent  
> **定位**: 为 AI 编码代理（Claude、Codex 等）提供系统化软件开发方法论

---

## 一、项目概述

Superpowers 是一个**基于技能组合（Skill-based）**的完整软件开发工作流系统。它不是直接生成代码的工具，而是**强制实施系统化的开发流程**，确保 AI 编码代理遵循软件工程最佳实践。

### 核心哲学

| 原则 | 说明 |
|------|------|
| **TDD（测试驱动开发）** | 先写测试，后写代码，红-绿-重构循环 |
| **YAGNI** | 你不会需要它， ruthlessly 移除不必要的功能 |
| **DRY** | 不要重复自己，保持代码简洁 |
| **系统化而非随意** | 流程优先于猜测 |
| **证据优先于主张** | 验证后再声明成功 |

---

## 二、核心工作流阶段

Superpowers 将软件开发划分为 **7 个核心阶段**，每个阶段都有对应的 Skill 自动触发：

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. Brainstorm  │───▶│ 2. Git Worktree │───▶│ 3. Writing Plans│
│   (头脑风暴)     │    │  (隔离工作区)    │    │  (编写计划)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ 7. Finish Branch│◀───│ 6. Code Review  │◀───│ 4. Subagent Dev │
│  (完成分支)     │    │  (代码审查)     │    │ (子代理开发)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              ▲
                              │
                       ┌─────────────────┐
                       │ 5. TDD (测试驱动) │
                       └─────────────────┘
```

---

## 三、各阶段详细说明

### 阶段 1: Brainstorming（头脑风暴）

**触发时机**: 用户开始描述需求，准备构建任何功能时  
**核心目标**: 通过苏格拉底式提问提炼真实需求，探索替代方案

#### 实现机制

```yaml
技能文件: skills/brainstorming/SKILL.md
触发条件: 检测到用户开始构建功能
强制门控: <HARD-GATE> - 未经设计批准不得进入实现阶段
```

#### 执行流程

1. **探索项目上下文** - 检查文件、文档、最近提交
2. **提供视觉伴侣**（可选）- 浏览器展示 mockups、图表
3. **澄清问题** - 一次一个问题，理解目的/约束/成功标准
4. **提出 2-3 种方案** - 附带权衡分析和推荐
5. **展示设计** - 分段展示，每段获得用户确认
6. **编写设计文档** - 保存到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
7. **规范自检** - 检查 TBD、TODO、内部一致性
8. **用户审查规范** - 用户确认后才继续
9. **过渡到实现** - 调用 `writing-plans` Skill

#### 关键原则

- **一次一个问题** - 不要一次性抛出多个问题
- **YAGNI ruthlessly** - 从所有设计中移除不必要的功能
- **探索替代方案** - 在确定前总是提出 2-3 种方法
- **增量验证** - 展示设计，获得批准后再继续

---

### 阶段 2: Using Git Worktrees（使用 Git 工作树）

**触发时机**: 设计批准后，开始实施前  
**核心目标**: 创建隔离的工作空间，保护当前分支

#### 实现机制

```yaml
技能文件: skills/using-git-worktrees/SKILL.md
触发条件: 设计批准后自动触发
检测逻辑: 检查是否已在隔离工作区（GIT_DIR != GIT_COMMON）
```

#### 执行流程

**Step 0: 检测现有隔离**
```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

- 如果 `GIT_DIR != GIT_COMMON`（且不是子模块）→ 已在工作区，跳过创建
- 如果 `GIT_DIR == GIT_COMMON` → 正常仓库，需要创建工作区

**Step 1: 创建隔离工作区**

优先级顺序：
1. **原生工具**（首选）- 如 `EnterWorktree`、`/worktree` 命令
2. **Git Worktree 回退** - 手动创建

目录选择优先级：
1. 用户明确指定的目录
2. 项目本地 `.worktrees/` 或 `worktrees/`
3. 全局目录 `~/.config/superpowers/worktrees/$project/`
4. 默认 `.worktrees/`

**Step 3: 项目设置**
```bash
# 自动检测并运行设置
if [ -f package.json ]; then npm install; fi      # Node.js
if [ -f Cargo.toml ]; then cargo build; fi        # Rust
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi  # Python
if [ -f go.mod ]; then go mod download; fi        # Go
```

**Step 4: 验证干净基线**
```bash
npm test / cargo test / pytest / go test ./...
```
- 如果测试失败 → 报告失败，询问是否继续
- 如果测试通过 → 报告就绪

---

### 阶段 3: Writing Plans（编写计划）

**触发时机**: 设计文档完成后  
**核心目标**: 将工作分解为 2-5 分钟可完成的 bite-sized 任务

#### 实现机制

```yaml
技能文件: skills/writing-plans/SKILL.md
输入: 已批准的设计规范
输出: 详细的实施计划文档
保存位置: docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md
```

#### 计划文档结构

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development 
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [一句话描述构建目标]
**Architecture:** [2-3 句话描述方法]
**Tech Stack:** [关键技术/库]

---

### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**
```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**
```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
```

#### 关键规则

| 规则 | 说明 |
|------|------|
| **无占位符** | 禁止 "TBD"、"TODO"、"implement later" |
| **精确文件路径** | 始终使用完整路径 |
| **完整代码** | 每个步骤包含实际代码 |
| **精确命令** | 包含预期输出 |
| **DRY** | 不要重复自己 |
| **YAGNI** | 你不会需要它 |
| **TDD** | 测试驱动开发 |
| **频繁提交** | 每个任务后提交 |

#### 自检清单

1. **规范覆盖** - 每个规范要求都有对应的任务
2. **占位符扫描** - 搜索 "TBD"、"TODO" 等红旗词汇
3. **类型一致性** - 函数名、方法签名前后一致

---

### 阶段 4: Subagent-Driven Development（子代理驱动开发）

**触发时机**: 计划完成后，用户选择执行方式  
**核心目标**: 每个任务派发给独立的子代理，两阶段审查确保质量

#### 实现机制

```yaml
技能文件: skills/subagent-driven-development/SKILL.md
执行模式: 同会话内执行（非并行会话）
核心原则: 每个任务新鲜子代理 + 两阶段审查
```

#### 执行流程

```
读取计划 → 提取所有任务 → 创建 TodoWrite
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                      每个任务的循环                          │
├─────────────────────────────────────────────────────────────┤
│ 1. 派发实现子代理 (implementer-prompt.md)                    │
│    └─ 子代理提问？→ 回答问题 → 重新派发                       │
│    └─ 子代理实现、测试、提交、自检                           │
│                                                             │
│ 2. 派发规范审查子代理 (spec-reviewer-prompt.md)              │
│    └─ 不符合规范？→ 实现子代理修复 → 重新审查                 │
│    └─ 符合规范 ✓                                             │
│                                                             │
│ 3. 派发代码质量审查子代理 (code-quality-reviewer-prompt.md)   │
│    └─ 未批准？→ 实现子代理修复 → 重新审查                     │
│    └─ 已批准 ✓                                               │
│                                                             │
│ 4. 标记任务完成 (TodoWrite)                                  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
所有任务完成 → 派发最终代码审查 → 使用 finishing-a-development-branch
```

#### 子代理状态处理

| 状态 | 含义 | 处理方式 |
|------|------|----------|
| **DONE** | 完成 | 进入规范审查 |
| **DONE_WITH_CONCERNS** | 完成但有疑虑 | 阅读疑虑，必要时处理 |
| **NEEDS_CONTEXT** | 需要上下文 | 提供缺失上下文，重新派发 |
| **BLOCKED** | 被阻塞 | 评估阻塞原因：上下文问题→提供更多上下文；需要更多推理→使用更强模型；任务太大→拆分；计划错误→升级给人类 |

#### 模型选择策略

| 任务类型 | 推荐模型 |
|----------|----------|
| 机械实现任务（1-2 文件，完整规范） | 快速、便宜的模型 |
| 集成和判断任务（多文件协调） | 标准模型 |
| 架构、设计和审查任务 | 最强可用模型 |

---

### 阶段 5: Test-Driven Development（测试驱动开发）

**触发时机**: 每个任务的实现阶段  
**核心目标**: 严格执行红-绿-重构循环

#### 实现机制

```yaml
技能文件: skills/test-driven-development/SKILL.md
铁律: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

#### 红-绿-重构循环

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│    RED      │────▶│  Verify RED     │────▶│   GREEN     │
│ 编写失败测试  │     │ 确认正确失败     │     │ 最简代码通过  │
└─────────────┘     └─────────────────┘     └─────────────┘
                                                    │
                       ┌─────────────────┐         │
                       │  Verify GREEN   │◀────────┘
                       │ 确认通过且干净   │
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   REFACTOR      │
                       │    清理代码      │
                       └─────────────────┘
```

#### 详细步骤

**RED - 编写失败测试**
```typescript
// Good: 清晰名称，测试真实行为，单一职责
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };
  const result = await retryOperation(operation);
  expect(result).toBe('success');
  expect(attempts).toBe(3);
});

// Bad: 模糊名称，测试 mock 而非代码
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```

**Verify RED - 强制步骤**
```bash
npm test path/to/test.test.ts
```
- 确认测试失败（不是报错）
- 失败消息符合预期
- 因功能缺失而失败（不是拼写错误）

**GREEN - 最简代码**
```typescript
// Good: 刚好通过
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}

// Bad: 过度工程
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; backoff?: 'linear' | 'exponential'; }
): Promise<T> { /* YAGNI */ }
```

**Verify GREEN - 强制步骤**
- 测试通过
- 其他测试仍通过
- 输出干净（无错误、警告）

**REFACTOR - 清理**
- 仅在绿色后
- 移除重复
- 改进命名
- 提取辅助函数
- 保持测试绿色

#### 红旗词汇（立即停止并重新开始）

| 借口 | 现实 |
|------|------|
| "太简单不需要测试" | 简单代码也会坏。测试只需30秒 |
| "我稍后测试" | 立即通过的测试证明不了什么 |
| "测试后能达到同样目标" | 测试后 = "这是什么？" 测试前 = "这应该是什么？" |
| "我已经手动测试过了" | 随意 ≠ 系统。无记录，无法重跑 |
| "删除 X 小时工作是浪费" | 沉没成本谬误。保留未验证代码是技术债 |
| "保留作为参考，先写测试" | 你会改编它。那就是测试后 |
| "TDD 是教条，我是务实的" | TDD 比调试更快。务实 = 测试优先 |

---

### 阶段 6: Requesting Code Review（请求代码审查）

**触发时机**: 任务之间自动激活  
**核心目标**: 根据预定义清单审查，按严重程度报告问题

#### 实现机制

```yaml
技能文件: skills/requesting-code-review/SKILL.md
触发条件: 任务完成后自动触发
审查类型: 两阶段审查（规范符合性 + 代码质量）
```

#### 审查流程

1. **规范符合性审查**（先执行）
   - 确认代码符合规范
   - 检查是否过度构建或构建不足
   - 验证所有需求都已实现

2. **代码质量审查**（后执行）
   - 代码清晰度
   - 测试覆盖率
   - 命名规范
   - 设计模式遵循

#### 严重程度分类

| 级别 | 说明 | 处理方式 |
|------|------|----------|
| **Critical** | 阻止进展 | 必须修复 |
| **Important** | 应该修复 | 强烈建议修复 |
| **Minor** | 可选 | 可以忽略 |

---

### 阶段 7: Finishing a Development Branch（完成开发分支）

**触发时机**: 所有任务完成后  
**核心目标**: 验证测试，提供合并/PR/保留/丢弃选项，清理工作区

#### 实现机制

```yaml
技能文件: skills/finishing-a-development-branch/SKILL.md
触发条件: 所有任务和审查完成后
```

#### 完成选项

1. **合并** - 合并到主分支
2. **创建 PR** - 创建 Pull Request
3. **保留分支** - 保留工作分支
4. **丢弃** - 删除分支和工作区

#### 清理工作区

```bash
# 清理 git worktree
git worktree remove <path>
# 或清理原生工作区工具创建的工作区
```

---

## 四、辅助技能

### Systematic Debugging（系统化调试）

**触发时机**: 遇到任何 bug、测试失败或意外行为  
**铁律**: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

#### 四阶段调试流程

```
Phase 1: Root Cause Investigation (根因调查)
  ├── 仔细阅读错误消息
  ├── 一致复现问题
  ├── 检查最近变更
  ├── 在多组件系统中收集证据
  └── 追踪数据流

Phase 2: Pattern Analysis (模式分析)
  ├── 找到工作示例
  ├── 与参考实现比较
  ├── 识别差异
  └── 理解依赖关系

Phase 3: Hypothesis and Testing (假设与测试)
  ├── 形成单一假设
  ├── 最小化测试
  ├── 验证后再继续
  └── 不知道时承认

Phase 4: Implementation (实施)
  ├── 创建失败测试用例
  ├── 实施单一修复
  ├── 验证修复
  └── 如果 3+ 次修复失败：质疑架构
```

### Verification Before Completion（完成前验证）

**触发时机**: 声称修复完成前  
**核心目标**: 确保问题真正解决，而非仅掩盖症状

---

## 五、技术实现架构

### 项目结构

```
superpowers/
├── .claude-plugin/      # Claude Code 插件配置
├── .codex-plugin/       # Codex CLI/App 插件配置
├── .cursor-plugin/      # Cursor 插件配置
├── .opencode/           # OpenCode 配置
├── docs/                # 文档
│   └── superpowers/
│       ├── specs/       # 设计规范
│       └── plans/       # 实施计划
├── hooks/               # 会话启动钩子
├── scripts/             # 实用脚本
├── skills/              # 核心技能库
│   ├── brainstorming/
│   ├── writing-plans/
│   ├── subagent-driven-development/
│   ├── test-driven-development/
│   ├── systematic-debugging/
│   ├── requesting-code-review/
│   ├── using-git-worktrees/
│   └── finishing-a-development-branch/
└── tests/               # 测试
```

### 技能文件格式

每个 Skill 是一个 Markdown 文件，包含 YAML frontmatter：

```markdown
---
name: skill-name
description: "Use when..."
---

# Skill Title

## Overview
...
```

### 钩子系统

会话启动时自动注入技能上下文：

```bash
# hooks/session-start
# 自动加载技能目录到 AI 上下文
```

---

## 六、使用方式

### 支持的 AI 平台

| 平台 | 安装命令 |
|------|----------|
| **Claude Code** | `/plugin install superpowers@claude-plugins-official` |
| **Codex CLI** | `/plugins` → 搜索 "superpowers" |
| **Codex App** | 侧边栏 Plugins → Superpowers → + |
| **Cursor** | `/add-plugin superpowers` |
| **OpenCode** | `Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md` |
| **Gemini CLI** | `gemini extensions install https://github.com/obra/superpowers` |

### 基本工作流示例

```
用户: "帮我实现一个用户认证系统"

AI: [自动触发 brainstorming]
   "在写代码之前，我需要先理解你的需求。这个认证系统需要支持哪些功能？
    1. 仅邮箱密码登录
    2. 支持社交登录（Google/GitHub）
    3. 需要多因素认证吗？"

用户: "只需要邮箱密码，但需要邮箱验证"

AI: [继续提问...]
   
   [提出 2-3 种架构方案]
   
   [展示设计文档分段]
   
   "设计文档已保存到 docs/superpowers/specs/2026-01-15-auth-design.md，
    请审查确认后我们开始编写实施计划。"

用户: "看起来不错，继续"

AI: [自动触发 using-git-worktrees]
   "正在设置隔离工作区..."
   
   [自动触发 writing-plans]
   "实施计划已保存到 docs/superpowers/plans/2026-01-15-auth-plan.md
    选择执行方式：
    1. Subagent-Driven（推荐）- 每个任务独立子代理
    2. Inline Execution - 当前会话批量执行"

用户: "选 1"

AI: [自动触发 subagent-driven-development]
   "开始使用子代理驱动开发执行计划..."
   
   [Task 1: 数据库模型]
   [Task 2: 注册 API]
   [Task 3: 登录 API]
   ...
   
   [自动触发 finishing-a-development-branch]
   "所有任务完成！测试通过。选项：
    1. 合并到主分支
    2. 创建 PR
    3. 保留分支
    4. 丢弃"
```

---

## 七、总结

Superpowers 的核心价值在于**强制实施系统化开发流程**，而不是建议。它通过以下方式实现：

1. **硬门控（HARD-GATE）** - 未经设计批准不得进入实现
2. **自动触发** - 技能在正确时机自动激活
3. **子代理隔离** - 每个任务独立上下文，避免污染
4. **两阶段审查** - 规范符合性 + 代码质量双重把关
5. **TDD 铁律** - 无失败测试不写生产代码

这种设计让 AI 编码代理能够像资深工程师一样思考、规划和执行复杂的软件开发任务。

---

**参考链接**:
- 主仓库: https://github.com/obra/superpowers
- 技能仓库: https://github.com/obra/superpowers-skills
- 发布说明: https://github.com/obra/superpowers/blob/main/RELEASE-NOTES.md
