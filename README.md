# DSH Global Memory

为 **所有 DSH 项目、工作区、会话和 Agent** 提供持久记忆，并区分两种范围：

- **全局（global）**：真正属于“你这个人”的资产，例如 SSH 主机、个人账号、常用偏好，所有项目共享。
- **项目（project）**：只对某个工作区成立的决策、约定和事实。例如“中心服取代 Redis”只应出现在 `server-project-sf-go`，不会污染其他项目。

账号密码等敏感值不写进 Markdown，而是存入 DSH 凭据库（credentials），只保留引用。记忆保存在本机，可导出 / 导入，也可以放进 Git 仓库做云同步。

记忆采用 **目录 + 索引 + 每条一个 Markdown 文件** 的结构：系统提示词里只注入当前范围（全局 + 当前项目）的索引，需要细节时 Agent 再按需读取对应文件。这样既能跨项目共享，又不会把整份记忆塞进每次请求。

插件 ID：`@neko233/dsh-plugin-global-memory` · 版本 `0.4.0` · 许可证 MIT

---

## 特性

- **全局 + 项目双范围**：全局条目对所有 DSH 项目生效；项目条目只在对应工作区的提示词和搜索结果中出现。新建条目可切换范围，项目路径可手填或自动使用当前会话目录。
- **一份记忆，所有项目共用**：不按 workspace 隔离存储；项目条目通过 `project` 字段精确匹配，而不是按文件夹各自维护一份记忆。
- **安全凭据**：`credential` 类型条目把用户名 / 密码 / 令牌存入 DSH 凭据库，Markdown、提示词、搜索、列表和导出只保留引用或“已配置”状态；只有显式 `secret.get` 才返回值。
- **索引 + 多文件**：`MEMORY.md` 只是索引；每条记忆是 `entries/` 下的一个独立 `.md` 文件，可直接用任何编辑器修改。
- **按需读取，减少 token 与幻觉**：系统提示词只包含当前范围索引，不包含正文；Agent 先看索引，再用 `memory` 工具读取需要的条目。
- **自动重载**：手动修改索引或条目文件后，插件轮询检测并重载，不会覆盖你的手改内容。
- **结构化条目**：标题、Markdown 内容、类型、范围、项目、标签、重要度、固定、归档、来源、版本、凭据引用；结构化字段保存在条目文件的 HTML 注释中，手写时可以省略。
- **记忆健康度**：面板顶部和「关于」页显示综合评分、索引覆盖率、元数据完整度、内容新鲜度和提示词预算进度条；低分项会给出待审阅原因。
- **待审阅队列**：自动找出缺标签、正文过短、超过 180 天未更新或文件缺失的条目，可一键筛选处理；列表支持按优先级、更新时间、重要度、标题排序。
- **`memory` 工具**：Agent 可以搜索、按 id 读取、保存、更新、删除、固定、归档、管理安全凭据、导入导出、查看健康统计和触发 Git 同步。
- **可视化管理面板**：侧边栏「全局记忆」图标打开，支持搜索、筛选、编辑、导入导出、Git 同步和健康度查看。
- **导入 / 导出**：JSON（可再次导入，不含凭据值）与 Markdown（自包含、人类可读）两种格式。
- **Git 云同步**：把记忆目录变成普通 Git 仓库，多台机器共享同一份记忆；冲突时中止 rebase，保护本地数据。
- **中英双语 UI**，跟随 DSH 当前语言。

---

## 全局与项目范围

| 范围 | 适用 | 示例 |
| --- | --- | --- |
| `global` | 所有项目、所有会话 | SSH 主机与登录习惯、个人偏好、常用工具约定、账号属于“我”的事实 |
| `project` | 仅 `project` 路径匹配的会话 | “本项目用中心服 RPC 取代 Redis”、本仓库目录约定、本项目的部署步骤 |

行为规则：

- 提示词只注入 **全局条目 + 当前项目匹配的条目**；其他项目条目不会出现。
- 当前项目由 Agent 对应会话的 `cwd` 推导；无法推导时只注入全局条目。
- `memory` 工具的 `search` / `list` 默认同样按当前项目过滤；显式传 `scope` / `project` 可查看或搜索其他项目。
- 面板会显示当前项目范围，列表中的项目条目带项目名徽标。
- 把一个全局条目改成项目条目，或反过来，会立即影响下一次提示词组装。

---

## 安全凭据

`credential` 类型用于账号、密码、令牌、SSH 口令等。**不要**把密码写进普通条目的正文。

- 面板新建 / 编辑条目时选择类型「凭据」，填写用户名、密码 / 令牌、备注；保存时密码写入 DSH 凭据库。
- 条目 Markdown 只包含：

  ```text
  secret: true
  secretRef: global-memory:<entryId>
  ```

- 提示词索引只显示 `· secure`，不包含凭据值；`search` / `list` / `get` 不返回凭据值。
- 只有显式调用 `memory` 工具 `secret.get` 才会返回凭据对象；面板中的「显示凭据」也走同一接口。
- 删除凭据条目会同时删除凭据库记录；导入 `replace` 会清理未引用的旧记录。
- 导出 JSON / Markdown **不包含**凭据值，只保留引用和“已配置”状态。
- 凭据库使用 DSH 自身的 credentials 服务，不额外落盘明文；插件不会在日志中打印凭据值。

---

## 安装

本插件是一个普通的 DSH bundle，不需要构建步骤（纯 ESM JavaScript），也不需要 npm 发布。

### 从 GitHub 安装（推荐）

在 DSH 的插件管理中选择「安装 bundle」，安装目标填：

```text
github:neko233-com/dsh-plugin-global-memory
```

或者使用仓库地址：

```text
https://github.com/neko233-com/dsh-plugin-global-memory
```

安装完成后重启 DSH（或按 DSH 提示重启），刷新 Web GUI。侧边栏会出现「全局记忆」图标，主面板可以打开完整管理页。

### 本地开发安装

1. 把本目录放在任意位置（推荐 `D:\Code\neko233-Projects\dsh-plugin-global-memory`）。
2. 在 DSH 的插件管理中使用「安装本地 bundle」，安装目标指向本目录的 **绝对路径**。
3. 安装后重启 DSH，刷新 Web GUI。

包清单已经包含：

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "immediately": true }
  }
}
```

`cordis.patch.yml` 会把插件插入当前 profile，并带上默认配置。

### 公开发布

- GitHub：<https://github.com/neko233-com/dsh-plugin-global-memory>
- Release：<https://github.com/neko233-com/dsh-plugin-global-memory/releases/tag/v0.4.0>

发布以 Git 仓库为唯一分发渠道，不依赖 npm registry。

---

## 数据位置

默认目录：

```text
%USERPROFILE%\.dsh\global-memory\
```

如果设置了 `DSH_HOME`，则使用：

```text
%DSH_HOME%\global-memory\
```

目录结构：

```text
global-memory/
├─ MEMORY.md          # 索引，唯一注入系统提示词的文件
├─ entries/           # 每条记忆一个 .md 文件
│  ├─ my-preference--gm_xxx.md
│  └─ project-convention--gm_yyy.md
├─ settings.json      # Git 远程 / 分支 / 上次同步时间；仅本机
├─ .gitignore         # 忽略 settings.json 与备份文件
├─ README.md          # 存储目录自带的格式说明
└─ .git/              # 执行 Git 初始化后出现
```

| 路径 | 作用 |
| --- | --- |
| `MEMORY.md` | **索引**。只含标题、链接、类型、标签、ID 和分区；会被注入提示词。 |
| `entries/*.md` | **记忆正文**。每条一个文件，按需读取；可直接手动编辑。 |
| `settings.json` | Git 远程地址、分支、上次同步时间；只保存在本机，不会提交到同步仓库。 |
| `.gitignore` | Git 初始化时生成，忽略 `settings.json`、旧版备份和损坏备份。 |
| `README.md` | 存储目录自带的格式与 Git 说明。 |
| `memory.json.migrated` | 从旧版本升级时保留的一次性备份，不参与运行。 |

写入采用临时文件 + 重命名的原子方式。索引由条目文件重新生成；旧版单文件 `MEMORY.md` 和旧版 `memory.json` 只会在首次升级时被迁移，原文件会保留为备份。

---

## 索引格式（`MEMORY.md`）

索引由插件生成，也可以手动修改。结构如下：

```markdown
# Global Memory — Index

> Shared by every DSH project and every DSH session on this machine.
> Each entry is a separate Markdown file under `entries/`.

<!-- dsh-global-memory:index
format: dsh-global-memory
version: 2
updatedAt: 2026-01-01T00:00:00.000Z
-->

- Active: 3
- Archived: 0
- Updated: 2026-01-01T00:00:00.000Z

## Pinned

- [回答风格](entries/answer-style--gm_xxx.md) — preference · importance 4/5 · tags: style · id: gm_xxx

## Global

- [项目约定](entries/project-convention--gm_yyy.md) — convention · importance 4/5 · id: gm_yyy

## Projects

_No project-scoped entries._

## Archived

_No archived entries._
```

索引规则：

- 每个列表项是一条记忆的入口，链接指向 `entries/` 下的文件。
- 列表项所在分区决定条目的状态：`Pinned` → 固定；`Archived` → 归档；`Global` / `Projects` → 活跃。
- 索引里的标题优先于条目文件里的 `#` 标题；改标题时改索引列表项或使用面板。
- 索引里只放标题、链接、类型、重要度、标签、项目、ID；**不要**在索引里写正文。
- 索引是自动生成的；手动增删条目文件后，插件会重新生成并补全索引。

---

## 条目文件格式（`entries/*.md`）

每个文件只放一条记忆，最简单的写法：

```markdown
# 我的偏好

回答时先给结论，再给理由。
```

插件首次保存或重载后会补全结构化字段：

```markdown
# 我的偏好

<!-- dsh-memory-entry
id: gm_example
kind: preference
scope: global
project:
tags: style, answers
importance: 4
pinned: true
status: active
createdAt: 2026-01-01T00:00:00.000Z
updatedAt: 2026-01-01T00:00:00.000Z
version: 1
source:
-->

回答时先给结论，再给理由。
```

手动编辑规则：

- 文件名建议保持 `<slug>--<id>.md`，这样 ID 稳定；直接新建 `entries/任意名字.md` 也会被自动收编，ID 从文件名生成。
- 文件开头的 `#` 标题是条目标题；如果索引里已有该条目，**索引标题优先**。
- HTML 注释是结构化字段，可以省略；缺失字段会用默认值补齐。
- HTML 注释之后的所有内容都是 Markdown 正文；正文里可以用 `##`、`###`、代码块等任意 Markdown。
- 正文里的 fenced code block（```` ``` ```` / `~~~`）不会影响解析。
- 删除一条记忆：删除对应的 `entries/*.md` 文件（面板删除也会删文件）。只删索引列表项不会删除正文，插件会重新收编该文件。
- 空文件或格式无法识别时，插件保留内存中的旧条目并给出警告，不会静默清空。
- 固定、归档、项目范围、标签、重要度等字段可以在面板里编辑；也可以改索引分区 / 条目注释，保存后自动重载。

---

## 条目字段

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定 ID，形如 `gm_...`。导入合并按它判断同一条目。 |
| `title` | 必填，短标题。 |
| `content` | Markdown 正文；普通条目必填，`kind=credential` 时可留空，用于说明用途。 |
| `kind` | `preference` / `fact` / `decision` / `convention` / `project` / `reference` / `todo` / `credential` |
| `scope` | `global`（默认）或 `project` |
| `project` | `scope=project` 时必填，通常是项目绝对路径。 |
| `tags` | 字符串数组，最多 20 个。 |
| `importance` | 1–5，默认 3。 |
| `pinned` | 是否固定进索引的 Pinned 分区。 |
| `status` | `active` / `archived`。 |
| `secret` | 仅 `credential` 为 `true`；密码等值存于 DSH 凭据库，不写进条目的正文。 |
| `secretRef` | 凭据库键，默认 `global-memory:<id>`；Markdown 只保存这个引用。 |
| `createdAt` / `updatedAt` | ISO 时间。 |
| `source` | `{ project, sessionId, note }`，记录来源。 |
| `version` | 每次修改递增。 |

同标题 + 同内容的活跃条目会被拒绝，避免重复记忆。

---

## 记忆健康度

面板顶部有一条常驻健康条，「关于」页有完整健康卡片。所有指标都是**只读**的，不会修改记忆。

| 指标 | 含义 |
| --- | --- |
| 综合评分 | 0–100。由索引覆盖率 35%、元数据完整度 30%、内容新鲜度 20%、提示词余量 15% 加权，再扣除重复组和缺失文件。 |
| 索引覆盖率 | 能正常从索引读取的活跃条目比例；索引链接指向不存在的文件会降低该项。 |
| 元数据完整度 | 同时有标签和有效正文的条目比例；`credential` 允许正文为空，按已完成计。 |
| 内容新鲜度 | 最近 180 天内更新过的活跃条目比例。 |
| 提示词预算 | 注入系统提示词的索引字符数 / `promptMaxChars`。占用越高，可用于条目摘要的空间越少。 |
| 待审阅 | 至少命中一项：无标签、正文少于 20 字符、超过 180 天未更新、条目文件缺失。 |

评分等级：`excellent` ≥ 90，`good` ≥ 75，`fair` ≥ 55，其余为 `attention`；空库显示 0 分。

在「记忆」页打开「Needs review · N」可以只看待审阅条目；详情页会列出具体原因。索引覆盖率和提示词预算同时会出现在顶部健康条中。Agent 可以用：

```text
memory action=stats
```

获取健康度、统计数字和 Git 状态。

---

## Agent 如何使用

插件注册一个 `memory` 工具，动作如下：

| 动作 | 用途 |
| --- | --- |
| `search` / `list` | 搜索或列出条目；只返回索引行（标题、类型、标签、ID），默认 20 条。 |
| `get` / `read` | 按 id 读取一条完整记忆（含正文和文件路径）。 |
| `save` | 新建条目；也可带 `id` 更新。 |
| `update` | 更新指定条目。 |
| `delete` | 删除条目和对应文件（不可撤销）。 |
| `pin` / `archive` | 固定 / 取消固定；归档 / 恢复。 |
| `secret.get` | 显式读取一条凭据的值；仅在用户明确要求时使用。 |
| `secret.set` / `secret.delete` | 给已有条目写入 / 删除凭据库记录。 |
| `export` | 导出 JSON 或 Markdown 文本。 |
| `import` | 导入 JSON 文本，`mode` 为 `merge` 或 `replace`。 |
| `sync` / `pull` / `push` | Git 同步 / 拉取 / 推送。 |
| `status` | 统计信息、健康度摘要与 Git 状态。 |
| `stats` | 只读：返回完整 `health` 和 `stats` 对象，适合自动化检查。 |
| `digest` | 查看当前注入提示词的索引。 |

系统提示词中的索引（section 名 `plugin:global-memory`，order `210`）会告诉 Agent：

- 记忆分全局与项目范围；只注入全局 + 当前项目条目；
- 这里只有索引，**在依赖细节前必须先用 `get` / `read` 读取完整条目**；
- 用户说「记住 / 记一下」时保存；保存前先搜索、优先更新；
- 个人资产（SSH、账号、偏好）用 `global`，项目决策用 `project`；
- 密码、令牌等用 `credential` + 凭据库，不要写进 Markdown 正文。

---

## 导出与导入

### 从 UI

- **导出 JSON**：下载 `dsh-global-memory-YYYY-MM-DD.json`，包含 `format`、`version`、`entries`（含完整正文），可以再次导入。
- **导出 MD**：下载自包含的 Markdown（索引 + 所有条目正文），适合备份 / 分享。
- **导入**：粘贴 JSON 或选择 `.json` 文件。
  - **合并（推荐）**：按 `id` 合并；导入条目更新则覆盖；同标题 + 同内容去重。
  - **替换**：用导入内容整体替换当前存储，并清理不再引用的旧条目文件。

### 从 Agent

```text
memory action=export format=json
memory action=import mode=merge data=<JSON>
```

导入数据上限 2 MB、10,000 条；格式错误会报错，不会部分写入。

---

## Git 云同步

记忆目录本身就是一个 Git 仓库。推荐使用**私有仓库**。

### 首次配置

1. 打开「全局记忆 → Git 同步」。
2. 点「初始化 Git」。
3. 填入远程地址，例如：
   - SSH：`git@github.com:you/dsh-memory.git`
   - HTTPS：`https://github.com/you/dsh-memory.git`
4. 点「保存远程」。
5. 点「立即同步」。

之后想换地址，直接在输入框里改成新的远程地址再点「保存远程」即可；`origin` 会被 `set-url` 覆盖，不会产生第二个远程。想断开远程但保留本地记忆，点「清除远程」。

### 同步行为

`Sync now` 依次执行：

1. `git add -A`
2. 有变更时提交（提交身份固定为 `DSH Global Memory <global-memory@dsh.local>`，不依赖全局 Git 配置）
3. 远程分支存在时：`git pull --rebase --autostash origin <branch>`
4. `git push -u origin <branch>`

`settings.json` 是机器本地配置（远程地址、上次同步时间），首次初始化会写入 `.gitignore`，不会进入提交；因此换机器后需要重新填一次远程地址。

发生冲突时：

- 自动执行 `git rebase --abort`；
- 本地 `MEMORY.md` 和 `entries/` 保持不变；
- UI / 工具返回冲突说明。

此时可以在存储目录手动处理：

```powershell
cd $env:USERPROFILE\.dsh\global-memory
git status
git pull --rebase origin main
# 解决冲突后
git rebase --continue
git push
```

### 认证

插件以 `GIT_TERMINAL_PROMPT=0` 运行 Git，因此不会弹出密码输入：

- 推荐使用 SSH key + ssh-agent；
- 或为 HTTPS 配置 Git credential helper / PAT；
- 不要把令牌写进记忆条目。

---

## 配置

配置位于 profile 的 `cordis.patch.yml` 插入行中：

```yaml
- insert:
    - id: global-memory
      name: '@neko233/dsh-plugin-global-memory'
      config:
        enabled: true
        announceToAgent: true
        promptMaxEntries: 12
        promptMaxChars: 3200
        includeProjectEntries: true
```

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 关闭后不注册提示词和工具（HTTP/UI 仍可用）。 |
| `announceToAgent` | `true` | 是否把记忆索引注入系统提示词。 |
| `promptMaxEntries` | `12` | 索引最多列出的条目数（1–50）。 |
| `promptMaxChars` | `3200` | 索引总字符预算（800–20000）。 |
| `includeProjectEntries` | `true` | 是否把 `scope=project` 的条目也放进索引。 |

修改后需要重启 DSH。

---

## HTTP API（面板与自动化）

所有路由只接受 loopback 请求，并校验 `Host` / `Origin` / `Sec-Fetch-Site`：

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/global-memory/state` | 完整快照：索引、条目、统计、健康度、设置、提示词、Git 状态。 |
| `POST /api/global-memory/action` | `{ "action": "...", "payload": { ... } }`，返回 `{ ok, result, snapshot }`。 |
| `GET /api/global-memory/export.json` | 下载 JSON。 |
| `GET /api/global-memory/export.md` | 下载自包含 Markdown。 |
| `GET /api/global-memory/events` | SSE，条目 revision 变化时推送。 |

`action` 支持：`save`、`delete`、`pin`、`archive`、`import`、`stats`、`secret.get`、`secret.set`、`secret.delete`、`git.init`、`git.remote`、`git.sync`、`git.pull`、`git.push`。

> `secret.get` 会把凭据值放进 HTTP 响应，只应在用户明确要求时使用；普通 `state` / `export` 不包含凭据值。

---

## 开发

纯 ESM，无构建、无第三方运行时依赖，只用 Node 内置模块。

```powershell
node --check index.js
node --check client.js
```

目录：

```text
index.js            Host 半区：多文件存储、索引、提示词、memory 工具、HTTP、Git
client.js           Client 半区：侧边栏图标 + 主面板 React UI
cordis.patch.yml    bundle 插入声明
locale/en.json     插件元数据（英文）
locale/zh.json     插件元数据（中文）
icon.svg           原始图标
```

客户端通过 `window.__ModuleLoader__.load({ id: '@neko233/dsh-plugin-global-memory', factory(require) { ... } })` 注册，使用官方 `sidebar.panellist`（id `global-memory`）和 `main`（key `global-memory`）插槽；没有 DOM hack、没有 iframe。

---

## 安全与隐私

- 普通记忆条目是本机明文 Markdown 文件；任何能读取该目录的程序都能读到。
- 建议只把 Git 远程设为**私有仓库**。
- 密码、令牌、私钥等使用 `credential` 类型：值只存在 DSH 凭据库，Markdown / 提示词 / 搜索 / 列表 / 导出都不包含凭据值。
- 不要把密码粘贴进普通条目的正文；`credential` 的正文只写用途和非机密上下文。
- 系统提示词中的索引会随会话发送给模型服务商；索引只包含标题、类型、标签、ID，不包含正文或凭据。
- 删除条目不可撤销；重要数据请先导出备份。
- `secret.get` 是唯一的读取路径；Agent 只有在你明确要求时才应调用。

---

## 故障排查

| 现象 | 处理 |
| --- | --- |
| 面板提示 Host 半区无响应 | 重启 DSH，确认插件已启用；打开 `http://127.0.0.1:<port>/api/global-memory/state` 检查。 |
| 侧边栏没有图标 | 确认客户端 bundle 已加载（重启 + 刷新页面）；查看 DSH 控制台错误。 |
| Git 未找到 | 安装 Git，确保 `git` 在 PATH 中；重启 DSH。 |
| 同步失败 / 认证失败 | 配置 SSH agent 或 credential helper；确认远程仓库存在且当前用户有写权限。 |
| 冲突 | 按上面的「Git 云同步 → 认证 / 冲突」手动处理；本地记忆不会被自动覆盖。 |
| 导入后条目重复 | 合并模式按 id 和标题 + 内容去重；不同标题的相似内容仍会保留，请手动整理。 |
| 手改条目后没变化 | 保存后最多约 1.5 秒自动重载；确认文件名以 `.md` 结尾且在 `entries/` 下，正文不是空的。 |
| 手改标题没生效 | 索引列表项的标题优先；改索引里的标题，或在面板里改。 |
| 删了索引列表项但记忆还在 | 只删列表项不会删文件；插件会重新收编 `entries/` 下的文件。删除记忆请删文件或用面板。 |
| 索引里出现警告 | 索引链接指向了不存在的文件；删除该链接或恢复对应文件。 |
| 旧版 `memory.json` 还在 | 升级后首次启动会把旧数据迁入 `entries/` 和索引，并将旧文件改名为 `memory.json.migrated`；这是备份，不影响运行。 |

---

## License

MIT © 2026 neko233
