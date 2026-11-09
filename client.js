/**
 * @neko233/dsh-plugin-global-memory — Client half.
 *
 * Registers one sidebar panel and one main panel with the official DSH slots,
 * then renders the Global Memory manager as React. All writes go through the
 * Host half's same-origin HTTP routes, so the browser never owns the store.
 */
window.__ModuleLoader__.load({
  id: '@neko233/dsh-plugin-global-memory',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'global-memory'
    const API = '/api/global-memory'
    const VERSION = '0.5.0'

    // -------------------------------------------------------------------------
    // Text
    // -------------------------------------------------------------------------

    const EN = {
      'panel.title': 'Global Memory',
      'panel.subtitle': 'Global (personal, cross-project) and project-scoped memory for DSH.',
      'panel.live': 'Live',
      'panel.offline': 'Reconnecting',
      'tab.memory': 'Memory',
      'tab.git': 'Git sync',
      'tab.about': 'About',
      'action.new': 'New entry',
      'action.refresh': 'Refresh',
      'action.import': 'Import',
      'action.exportJson': 'Export JSON',
      'action.exportMarkdown': 'Export MD',
      'action.save': 'Save',
      'action.cancel': 'Cancel',
      'action.edit': 'Edit',
      'action.delete': 'Delete',
      'action.pin': 'Pin',
      'action.unpin': 'Unpin',
      'action.archive': 'Archive',
      'action.restore': 'Restore',
      'action.copy': 'Copy',
      'action.sync': 'Sync now',
      'action.pull': 'Pull',
      'action.push': 'Push',
      'action.init': 'Initialize Git',
      'action.saveRemote': 'Save remote',
      'action.clearRemote': 'Clear remote',
      'action.chooseFile': 'Choose file',
      'action.close': 'Close',
      'action.working': 'Working…',
      'search.placeholder': 'Search title, content, tags…',
      'filter.allKinds': 'All kinds',
      'filter.allScopes': 'All scopes',
      'filter.allWorkspaces': 'All workspaces',
      'filter.currentWorkspace': 'Current project',
      'filter.workspaceCount': '{count} entries',
      'filter.statusActive': 'Active',
      'filter.statusArchived': 'Archived',
      'filter.statusAll': 'All',
      'filter.review': 'Needs review · {count}',
      'filter.sortPriority': 'Priority',
      'filter.sortUpdated': 'Recently updated',
      'filter.sortImportance': 'Importance',
      'filter.sortTitle': 'Title',
      'filter.sort': 'Sort',
      'kind.preference': 'Preference',
      'kind.fact': 'Fact',
      'kind.decision': 'Decision',
      'kind.convention': 'Convention',
      'kind.project': 'Project',
      'kind.reference': 'Reference',
      'kind.todo': 'Todo',
      'kind.credential': 'Credential',
      'scope.global': 'Global',
      'scope.project': 'Project',
      'status.active': 'Active',
      'status.archived': 'Archived',
      'badge.pinned': 'Pinned',
      'badge.archived': 'Archived',
      'counts.active': '{count} active',
      'counts.pinned': '{count} pinned',
      'counts.projects': '{count} project',
      'counts.workspaces': '{count} workspaces',
      'counts.currentProject': 'Project scope: {project}',
      'counts.archived': '{count} archived',
      'health.title': 'Memory health',
      'health.empty': 'No memories yet',
      'health.grade.empty': 'Empty',
      'health.grade.excellent': 'Excellent',
      'health.grade.good': 'Good',
      'health.grade.fair': 'Fair',
      'health.grade.attention': 'Needs attention',
      'health.summary': '{active} active · {indexed} indexed · {review} to review',
      'health.prompt': 'Prompt index budget',
      'health.promptDetail': '{entries} entries against a limit of {limit}',
      'health.overall': 'Overall score',
      'health.coverage': 'Index coverage',
      'health.metadata': 'Metadata completeness',
      'health.freshness': 'Freshness (last {days} days)',
      'health.needsReview': '{count} to review',
      'health.stale': '{count} stale',
      'health.duplicates': '{count} duplicate group(s)',
      'health.missingTags': '{count} without tags',
      'health.shortContent': '{count} with short content',
      'health.missingFiles': '{count} missing file(s)',
      'health.importance': 'Importance mix',
      'health.description': 'A quick structural check of this memory store. A low score means entries are missing tags or content, are stale, are duplicated, or are using too much of the prompt budget.',
      'health.reviewAction': 'Review entries that need attention',
      'health.noEntries': 'No active memories. Create one to start tracking progress.',
      'health.score': '{score}/100',
      'review.needs': 'Needs review',
      'review.noTags': 'no tags',
      'review.shortContent': 'short content',
      'review.stale': 'stale',
      'list.emptyReview': 'Nothing needs review right now.',
      'store.label': 'Store',
      'editor.newTitle': 'New memory entry',
      'editor.editTitle': 'Edit memory entry',
      'editor.title': 'Title',
      'editor.titlePlaceholder': 'Short, specific title',
      'editor.content': 'Content',
      'editor.contentPlaceholder': 'One durable fact, preference, decision, convention, or todo. Markdown is fine.',
      'editor.kind': 'Kind',
      'editor.scope': 'Scope',
      'editor.project': 'Project path',
      'editor.projectPlaceholder': 'D:\\path\\to\\project',
      'editor.tags': 'Tags',
      'editor.tagsPlaceholder': 'comma, separated, tags',
      'editor.importance': 'Importance',
      'editor.pinned': 'Pin to the prompt digest',
      'editor.status': 'Status',
      'editor.required': 'Title and content are required.',
      'editor.projectRequired': 'A project path is required for project scope.',
      'editor.secretTitle': 'Secure credential',
      'editor.secretHint': 'Stored in the DSH credential store, never written to Markdown, exported, or injected into prompts. Leave fields blank to keep the current secret.',
      'editor.username': 'Username / account',
      'editor.password': 'Password / token',
      'editor.secretNote': 'Note (optional)',
      'editor.secretNotePlaceholder': 'What this credential is for',
      'editor.secretConfigured': 'A secure credential is already stored.',
      'editor.secretMissing': 'No secure credential stored yet.',
      'editor.contentCredentialPlaceholder': 'What this credential is for, where it is used, and any non-secret context.',
      'notice.saved': 'Memory saved.',
      'notice.deleted': 'Memory deleted.',
      'notice.pinned': 'Pinned to the prompt digest.',
      'notice.unpinned': 'Unpinned.',
      'notice.archived': 'Entry archived.',
      'notice.restored': 'Entry restored.',
      'notice.imported': 'Imported {imported} new, updated {updated}, skipped {skipped}.',
      'notice.remote': 'Git remote saved.',
      'notice.remoteCleared': 'Git remote cleared.',
      'notice.sync': 'Sync complete.',
      'notice.pull': 'Pull complete.',
      'notice.push': 'Push complete.',
      'notice.init': 'Git repository initialized.',
      'notice.secretSaved': 'Secure credential saved.',
      'notice.copied': 'Store path copied.',
      'error.hostMissing': 'The Global Memory host half is not responding. Restart DSH and reopen this panel.',
      'error.load': 'Could not load memory.',
      'error.generic': 'Something went wrong.',
      'confirm.delete': 'Delete "{title}"? This cannot be undone.',
      'list.empty': 'No entries match the current filters.',
      'list.emptyAll': 'No memory entries yet. Create one, or ask an agent to remember something.',
      'detail.empty': 'Select an entry to read it, or create a new one.',
      'detail.importance': 'Importance {value}/5',
      'detail.tags': 'Tags',
      'detail.created': 'Created {date}',
      'detail.updated': 'Updated {date}',
      'detail.source': 'Source',
      'detail.version': 'Version {version}',
      'detail.id': 'ID',
      'detail.file': 'File',
      'detail.secretConfigured': 'Secure credential stored',
      'detail.secretMissing': 'No secure credential stored',
      'detail.reveal': 'Reveal secret',
      'detail.hide': 'Hide secret',
      'detail.secretWarning': 'Handle with care. Revealing writes the credential into this page only; the prompt and exports never include it.',
      'detail.contentEmpty': 'No content.',
      'git.title': 'Git cloud sync',
      'git.description': 'Keep this memory in a Git repository so every machine shares the same brain. Sync commits local changes, pulls with rebase, then pushes. A conflict aborts the rebase and leaves local memory intact.',
      'git.unavailable': 'Git is not available on PATH. Install Git to enable cloud sync.',
      'git.repository': 'Repository',
      'git.initialized': 'Initialized',
      'git.notInitialized': 'Not initialized',
      'git.remote': 'Remote URL',
      'git.remotePlaceholder': 'git@github.com:you/dsh-memory.git',
      'git.branch': 'Branch',
      'git.branchPlaceholder': 'main',
      'git.clean': 'Working tree clean',
      'git.dirty': '{count} changed file(s)',
      'git.aheadBehind': 'Ahead / behind',
      'git.ahead': '{count} ahead',
      'git.behind': '{count} behind',
      'git.lastCommit': 'Last commit',
      'git.lastSync': 'Last sync',
      'git.never': 'Never',
      'git.noRemote': 'No remote configured',
      'git.state': 'State',
      'git.hint': 'Use a private repository: memory may contain personal preferences and project details.',
      'git.initHint': 'Initialize a repository, then add a remote and sync.',
      'git.syncHint': 'Sync is safe to run repeatedly. It creates a commit only when files changed.',
      'git.lastCommitValue': '{hash} · {date} · {subject}',
      'about.title': 'About Global Memory',
      'about.what': 'One machine-wide memory store with two scopes: global personal assets shared across every DSH project (for example SSH hosts and personal preferences), and project-scoped entries shown only in their workspace. Agents see only the index and read full entries on demand. Credentials live in the DSH credential store; Markdown holds only a reference.',
      'about.store': 'Store location',
      'about.files': 'Files',
      'about.filesMemory': 'MEMORY.md is the index. It is the only file injected into prompts; edit entries below it.',
      'about.filesEntries': 'One Markdown file per memory. These are the files you edit by hand.',
      'about.filesReadme': 'Store notes, format, and Git instructions.',
      'about.filesSettings': 'Git remote and branch settings.',
      'memory.editHint': 'Tip: MEMORY.md is the generated index. Edit the full entry files under entries/ and save; this panel reloads them automatically.',
      'about.prompt': 'Current prompt index',
      'about.promptNote': 'Only this index (titles, ids, and tags, not full text) is appended to every agent system prompt, within the configured budget.',
      'about.safety': 'Passwords, tokens, and private keys are stored only in the DSH credential store. Do not paste them into entry Markdown; exports and prompts never include secret values.',
      'about.version': 'Version {version}',
      'import.title': 'Import memory',
      'import.description': 'Paste a JSON export or choose a .json file. Merge keeps existing entries and updates newer ones by id; replace overwrites the whole store.',
      'import.placeholder': 'Paste dsh-global-memory JSON here…',
      'import.modeMerge': 'Merge (recommended)',
      'import.modeReplace': 'Replace everything',
      'import.fileHint': 'Nothing is written until you press Import.',
      'import.empty': 'Paste JSON or choose a file first.',
      'loading': 'Loading memory…',
      'time.unknown': 'Unknown',
    }

    const ZH = {
      'panel.title': '全局记忆',
      'panel.subtitle': '区分个人全局资产与项目级事实，供所有 DSH 会话使用。',
      'panel.live': '实时',
      'panel.offline': '重连中',
      'tab.memory': '记忆',
      'tab.git': 'Git 同步',
      'tab.about': '关于',
      'action.new': '新建条目',
      'action.refresh': '刷新',
      'action.import': '导入',
      'action.exportJson': '导出 JSON',
      'action.exportMarkdown': '导出 MD',
      'action.save': '保存',
      'action.cancel': '取消',
      'action.edit': '编辑',
      'action.delete': '删除',
      'action.pin': '固定',
      'action.unpin': '取消固定',
      'action.archive': '归档',
      'action.restore': '恢复',
      'action.copy': '复制',
      'action.sync': '立即同步',
      'action.pull': '拉取',
      'action.push': '推送',
      'action.init': '初始化 Git',
      'action.saveRemote': '保存远程',
      'action.clearRemote': '清除远程',
      'action.chooseFile': '选择文件',
      'action.close': '关闭',
      'action.working': '处理中…',
      'search.placeholder': '搜索标题、内容、标签…',
      'filter.allKinds': '全部类型',
      'filter.allScopes': '全部范围',
      'filter.allWorkspaces': '全部工作区',
      'filter.currentWorkspace': '当前项目',
      'filter.workspaceCount': '{count} 条',
      'filter.statusActive': '活跃',
      'filter.statusArchived': '已归档',
      'filter.statusAll': '全部',
      'filter.review': '待检查 · {count}',
      'filter.sortPriority': '优先级',
      'filter.sortUpdated': '最近更新',
      'filter.sortImportance': '重要度',
      'filter.sortTitle': '标题',
      'filter.sort': '排序',
      'kind.preference': '偏好',
      'kind.fact': '事实',
      'kind.decision': '决策',
      'kind.convention': '约定',
      'kind.project': '项目',
      'kind.reference': '参考',
      'kind.todo': '待办',
      'kind.credential': '凭据',
      'scope.global': '全局',
      'scope.project': '项目',
      'status.active': '活跃',
      'status.archived': '已归档',
      'badge.pinned': '已固定',
      'badge.archived': '已归档',
      'counts.active': '{count} 条活跃',
      'counts.pinned': '{count} 条固定',
      'counts.projects': '{count} 条项目',
      'counts.workspaces': '{count} 个工作区',
      'counts.currentProject': '项目范围：{project}',
      'counts.archived': '{count} 条归档',
      'health.title': '记忆健康度',
      'health.empty': '还没有记忆',
      'health.grade.empty': '空',
      'health.grade.excellent': '优秀',
      'health.grade.good': '良好',
      'health.grade.fair': '一般',
      'health.grade.attention': '需要关注',
      'health.summary': '{active} 条活跃 · {indexed} 条已索引 · {review} 条待检查',
      'health.prompt': '提示词索引预算',
      'health.promptDetail': '{entries} 条记忆，上限 {limit} 条',
      'health.overall': '总体评分',
      'health.coverage': '索引覆盖率',
      'health.metadata': '元数据完整度',
      'health.freshness': '新鲜度（最近 {days} 天）',
      'health.needsReview': '{count} 条待检查',
      'health.stale': '{count} 条陈旧',
      'health.duplicates': '{count} 组重复',
      'health.missingTags': '{count} 条缺少标签',
      'health.shortContent': '{count} 条内容过短',
      'health.missingFiles': '{count} 个文件缺失',
      'health.importance': '重要度分布',
      'health.description': '对记忆库做一次结构化体检。评分低通常意味着条目缺少标签或内容、内容陈旧、存在重复，或占用了过多提示词预算。',
      'health.reviewAction': '检查需要关注的条目',
      'health.noEntries': '还没有活跃记忆。新建一条，开始记录进度。',
      'health.score': '{score}/100',
      'review.needs': '需要检查',
      'review.noTags': '没有标签',
      'review.shortContent': '内容过短',
      'review.stale': '内容陈旧',
      'list.emptyReview': '目前没有需要检查的条目。',
      'store.label': '存储',
      'editor.newTitle': '新建记忆条目',
      'editor.editTitle': '编辑记忆条目',
      'editor.title': '标题',
      'editor.titlePlaceholder': '简短、明确的标题',
      'editor.content': '内容',
      'editor.contentPlaceholder': '一条持久的事实、偏好、决策、约定或待办。支持 Markdown。',
      'editor.kind': '类型',
      'editor.scope': '范围',
      'editor.project': '项目路径',
      'editor.projectPlaceholder': 'D:\\path\\to\\project',
      'editor.tags': '标签',
      'editor.tagsPlaceholder': '用逗号分隔的标签',
      'editor.importance': '重要度',
      'editor.pinned': '固定到提示词摘要',
      'editor.status': '状态',
      'editor.required': '标题和内容不能为空。',
      'editor.projectRequired': '项目范围需要填写项目路径。',
      'editor.secretTitle': '安全凭据',
      'editor.secretHint': '保存到 DSH 凭据库，不会写入 Markdown、导出文件或提示词。留空表示保留现有凭据。',
      'editor.username': '用户名 / 账号',
      'editor.password': '密码 / 令牌',
      'editor.secretNote': '备注（可选）',
      'editor.secretNotePlaceholder': '这条凭据用于什么',
      'editor.secretConfigured': '已存有安全凭据。',
      'editor.secretMissing': '尚未存储安全凭据。',
      'editor.contentCredentialPlaceholder': '说明这条凭据的用途、使用位置，以及非机密的上下文。',
      'notice.saved': '记忆已保存。',
      'notice.deleted': '记忆已删除。',
      'notice.pinned': '已固定到提示词摘要。',
      'notice.unpinned': '已取消固定。',
      'notice.archived': '条目已归档。',
      'notice.restored': '条目已恢复。',
      'notice.imported': '已导入 {imported} 条新条目，更新 {updated} 条，跳过 {skipped} 条。',
      'notice.remote': 'Git 远程已保存。',
      'notice.remoteCleared': 'Git 远程已清除。',
      'notice.sync': '同步完成。',
      'notice.pull': '拉取完成。',
      'notice.push': '推送完成。',
      'notice.init': 'Git 仓库已初始化。',
      'notice.secretSaved': '安全凭据已保存。',
      'notice.copied': '已复制存储路径。',
      'error.hostMissing': '全局记忆的 Host 半区无响应。请重启 DSH 后重新打开此面板。',
      'error.load': '无法加载记忆。',
      'error.generic': '出错了。',
      'confirm.delete': '删除“{title}”？此操作无法撤销。',
      'list.empty': '没有条目符合当前筛选条件。',
      'list.emptyAll': '还没有记忆条目。新建一条，或让 Agent 记住一些内容。',
      'detail.empty': '选择一个条目查看，或新建一条。',
      'detail.importance': '重要度 {value}/5',
      'detail.tags': '标签',
      'detail.created': '创建于 {date}',
      'detail.updated': '更新于 {date}',
      'detail.source': '来源',
      'detail.version': '版本 {version}',
      'detail.id': 'ID',
      'detail.file': '文件',
      'detail.secretConfigured': '已存安全凭据',
      'detail.secretMissing': '尚未存储安全凭据',
      'detail.reveal': '显示凭据',
      'detail.hide': '隐藏凭据',
      'detail.secretWarning': '请谨慎操作。凭据只显示在当前页面，不会进入提示词或导出文件。',
      'detail.contentEmpty': '没有内容。',
      'git.title': 'Git 云同步',
      'git.description': '将记忆保存在 Git 仓库中，让每台机器共享同一份记忆。同步会提交本地更改、以 rebase 方式拉取，然后推送。发生冲突时会中止 rebase，本地记忆保持完整。',
      'git.unavailable': 'PATH 中未找到 Git。安装 Git 后可启用云同步。',
      'git.repository': '仓库',
      'git.initialized': '已初始化',
      'git.notInitialized': '未初始化',
      'git.remote': '远程 URL',
      'git.remotePlaceholder': 'git@github.com:you/dsh-memory.git',
      'git.branch': '分支',
      'git.branchPlaceholder': 'main',
      'git.clean': '工作区干净',
      'git.dirty': '{count} 个文件有更改',
      'git.aheadBehind': '领先 / 落后',
      'git.ahead': '领先 {count} 个提交',
      'git.behind': '落后 {count} 个提交',
      'git.lastCommit': '最近提交',
      'git.lastSync': '上次同步',
      'git.never': '从未',
      'git.noRemote': '未配置远程',
      'git.state': '状态',
      'git.hint': '建议使用私有仓库：记忆可能包含个人偏好和项目细节。',
      'git.initHint': '先初始化仓库，再添加远程并同步。',
      'git.syncHint': '同步可重复执行；只有文件发生变化时才会创建提交。',
      'git.lastCommitValue': '{hash} · {date} · {subject}',
      'about.title': '关于全局记忆',
      'about.what': '一份机器级记忆存储，分两种范围：个人全局资产（如 SSH 主机、个人偏好）对所有 DSH 项目生效；项目级条目只在对应工作区出现。Agent 的系统提示词只包含索引，需要细节时再按需读取完整条目。账号密码保存在 DSH 凭据库，Markdown 只保留引用。',
      'about.store': '存储位置',
      'about.files': '文件',
      'about.filesMemory': 'MEMORY.md 是索引。只有该文件会注入提示词；请编辑下面的条目文件。',
      'about.filesEntries': '每条记忆一个 Markdown 文件。手动编辑这些文件即可。',
      'about.filesReadme': '存储说明、格式与 Git 使用提示。',
      'about.filesSettings': 'Git 远程与分支设置。',
      'memory.editHint': '提示：MEMORY.md 是自动生成的索引。请编辑 entries/ 下的完整条目文件并保存，面板会自动重载。',
      'about.prompt': '当前提示词索引',
      'about.promptNote': '只有索引（标题、ID、标签，不含正文）会在配置的预算内附加到每个 Agent 的系统提示词。',
      'about.safety': '密码、令牌和私钥只保存在 DSH 凭据库；不要粘贴到条目 Markdown 中。导出文件和提示词都不会包含凭据值。',
      'about.version': '版本 {version}',
      'import.title': '导入记忆',
      'import.description': '粘贴 JSON 导出内容，或选择 .json 文件。合并会保留现有条目，并按 id 更新较新的条目；替换会覆盖整个存储。',
      'import.placeholder': '在此粘贴 dsh-global-memory JSON…',
      'import.modeMerge': '合并（推荐）',
      'import.modeReplace': '全部替换',
      'import.fileHint': '按下“导入”前不会写入任何内容。',
      'import.empty': '请先粘贴 JSON 或选择文件。',
      'loading': '正在加载记忆…',
      'time.unknown': '未知',
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function fmt(template, params) {
      return String(template ?? '').replace(/\{(\w+)\}/g, (_match, key) => (
        params !== undefined && params[key] !== undefined ? String(params[key]) : `{${key}}`
      ))
    }

    function snippet(text, max) {
      const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
      return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1))}…`
    }

    function splitTags(value) {
      const seen = new Set()
      const tags = []
      for (const raw of String(value ?? '').split(',')) {
        const tag = raw.trim().replace(/^#/, '')
        if (tag === '') continue
        const key = tag.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        tags.push(tag)
        if (tags.length >= 20) break
      }
      return tags
    }

    function projectName(value) {
      if (!value) return ''
      const parts = String(value).split(/[\\/]/).filter(Boolean)
      return parts[parts.length - 1] || String(value)
    }

    function normalizeProjectPath(value) {
      const text = String(value ?? '').trim()
      if (text === '') return ''
      const slash = text.replace(/\\/g, '/').replace(/\/+$/, '')
      return /^[A-Za-z]:\//.test(slash) ? slash.toLowerCase() : slash
    }

    function sameProject(left, right) {
      const a = normalizeProjectPath(left)
      const b = normalizeProjectPath(right)
      return a !== '' && b !== '' && a === b
    }

    function formatDate(value) {
      if (!value) return '—'
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
    }

    function rankEntries(left, right) {
      return Number(right.pinned) - Number(left.pinned)
        || right.importance - left.importance
        || String(right.updatedAt).localeCompare(String(left.updatedAt))
        || String(left.id).localeCompare(String(right.id))
    }

    const REVIEW_STALE_DAYS = 180
    const REVIEW_MIN_CONTENT = 20

    function ageInDays(value) {
      const time = Date.parse(value)
      if (!Number.isFinite(time)) return null
      return (Date.now() - time) / (24 * 60 * 60 * 1000)
    }

    function isStale(entry) {
      const age = ageInDays(entry.updatedAt)
      return age !== null && age > REVIEW_STALE_DAYS
    }

    function needsReview(entry) {
      return entry.tags.length === 0
        || (entry.kind !== 'credential' && String(entry.content ?? '').trim().length < REVIEW_MIN_CONTENT)
        || isStale(entry)
    }

    function sortEntries(list, mode) {
      if (mode === 'updated') {
        return [...list].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      }
      if (mode === 'importance') {
        return [...list].sort((left, right) => right.importance - left.importance
          || String(right.updatedAt).localeCompare(String(left.updatedAt)))
      }
      if (mode === 'title') {
        return [...list].sort((left, right) => String(left.title).localeCompare(String(right.title)))
      }
      return [...list].sort(rankEntries)
    }

    function clampPercent(value) {
      const number = Number(value)
      return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0
    }

    function scoreTone(value) {
      const percent = clampPercent(value)
      return percent >= 75 ? 'ok' : percent >= 40 ? 'warn' : 'bad'
    }

    function usageTone(value) {
      const percent = clampPercent(value)
      return percent >= 90 ? 'bad' : percent >= 70 ? 'warn' : 'ok'
    }

    function sourceText(source) {
      if (!source) return '—'
      return [source.project, source.sessionId, source.note].filter(Boolean).join(' · ') || '—'
    }

    class ApiError extends Error {
      constructor(message, status) {
        super(message)
        this.name = 'ApiError'
        this.status = status
      }
    }

    async function fetchJson(path, init) {
      let response
      try {
        response = await fetch(path, {
          credentials: 'same-origin',
          cache: 'no-store',
          ...init,
        })
      } catch (cause) {
        throw new ApiError(cause instanceof Error ? cause.message : 'network error', 0)
      }
      const text = await response.text()
      let data = null
      try {
        data = text === '' ? null : JSON.parse(text)
      } catch {
        data = null
      }
      if (!response.ok) {
        throw new ApiError(
          (data !== null && typeof data.message === 'string' && data.message)
            || (data !== null && typeof data.error === 'string' && data.error)
            || `HTTP ${response.status}`,
          response.status,
        )
      }
      return data
    }

    function useTranslation(locale) {
      const [, force] = React.useReducer(value => value + 1, 0)
      React.useEffect(() => locale.subscribe(() => force()), [locale])
      return React.useMemo(() => {
        const bound = locale.bind(NS)
        return (key, params) => fmt(bound(key), params)
      }, [locale])
    }

    // -------------------------------------------------------------------------
    // Icon
    // -------------------------------------------------------------------------

    function SidebarIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 18
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
        h('circle', { cx: 12, cy: 12, r: 8.5 }),
        h('path', { d: 'M3.5 12h17' }),
        h('path', { d: 'M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z' }),
        h('path', { d: 'M17.6 5.1l1.7 1.7-2.4 2.4-1.7-1.7z' }),
      )
    }

    // -------------------------------------------------------------------------
    // Styles
    // -------------------------------------------------------------------------

    const CSS = `
.gm-root {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
}
.gm-root *, .gm-root *::before, .gm-root *::after { box-sizing: border-box; }
.gm-header { flex: none; padding: 18px 22px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.gm-header-row { display: flex; align-items: flex-start; gap: 18px; justify-content: space-between; }
.gm-title { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
.gm-subtitle { margin: 4px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.gm-header-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; align-items: center; }
.gm-tabs { display: flex; gap: 2px; margin-top: 14px; }
.gm-tab {
  appearance: none; border: 0; background: transparent;
  color: var(--dsw-alias-label-secondary);
  padding: 8px 10px; border-bottom: 2px solid transparent;
  cursor: pointer; font: inherit;
}
.gm-tab:hover { color: var(--dsw-alias-label-primary); }
.gm-tab-active { color: var(--dsw-alias-label-primary); border-bottom-color: var(--dsw-alias-brand-primary); }
.gm-toolbar {
  flex: none; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 9px 22px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.gm-store { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.gm-store code {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 460px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.gm-counts { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
.gm-edit-hint { flex-basis: 100%; margin: 0; font-size: 11px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.gm-count {
  font-size: 11px; color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 2px 8px;
}
.gm-health-strip {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px 26px; padding: 10px 22px 0;
}
.gm-health-item { min-width: 0; }
.gm-health-line {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  color: var(--dsw-alias-label-secondary); font-size: 11px;
}
.gm-health-value { color: var(--dsw-alias-label-primary); font-weight: 600; white-space: nowrap; }
.gm-health-detail { color: var(--dsw-alias-label-secondary); font-size: 10.5px; margin-top: 4px; }
.gm-bar {
  height: 6px; margin-top: 5px; overflow: hidden; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2);
}
.gm-bar-fill {
  display: block; height: 100%; max-width: 100%; border-radius: 999px;
  background: var(--dsw-alias-brand-primary); transition: width 220ms ease;
}
.gm-bar-ok { background: var(--dsw-alias-state-success-primary); }
.gm-bar-warn { background: var(--dsw-alias-state-warn-primary); }
.gm-bar-bad { background: var(--dsw-alias-state-error-primary); }
.gm-health-bars { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 22px; margin: 14px 0 4px; }
.gm-health-card-counts { margin-top: 14px; margin-left: 0; justify-content: flex-start; }
.gm-importance-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.gm-review-toggle {
  appearance: none; width: 100%; border: 1px solid var(--dsw-alias-border-l1);
  background: transparent; color: var(--dsw-alias-label-secondary);
  border-radius: 6px; padding: 5px 8px; font: inherit; font-size: 11px; cursor: pointer;
}
.gm-review-toggle:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); }
.gm-review-on {
  color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-bg-layer-2);
}
.gm-detail-warn { margin: 0 0 12px; }
.gm-detail-warn span + span::before { content: ' · '; color: var(--dsw-alias-label-secondary); }
.gm-live { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.gm-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
.gm-dot-on { background: var(--dsw-alias-state-success-primary); }
.gm-body { display: flex; flex: 1; min-height: 0; }
.gm-sidebar {
  width: 340px; flex: none; display: flex; flex-direction: column; min-height: 0;
  border-right: 1px solid var(--dsw-alias-border-l1);
}
.gm-filters { padding: 12px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.gm-filter-row { display: flex; gap: 6px; }
.gm-filter-row > * { flex: 1; min-width: 0; }
.gm-segmented { display: flex; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; overflow: hidden; }
.gm-segmented button {
  flex: 1; appearance: none; border: 0; background: transparent;
  color: var(--dsw-alias-label-secondary); padding: 5px 6px; font: inherit; cursor: pointer;
}
.gm-segmented button + button { border-left: 1px solid var(--dsw-alias-border-l1); }
.gm-segmented .gm-seg-active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.gm-list { flex: 1; overflow: auto; padding: 6px; }
.gm-item {
  display: block; width: 100%; text-align: left; appearance: none;
  border: 1px solid transparent; background: transparent; color: inherit;
  border-radius: 6px; padding: 9px 10px; cursor: pointer; font: inherit;
}
.gm-item:hover { background: var(--dsw-alias-bg-layer-1); }
.gm-item-active { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l1); }
.gm-item-top { display: flex; gap: 6px; align-items: center; }
.gm-item-title { font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gm-item-meta { color: var(--dsw-alias-label-secondary); font-size: 11px; margin-top: 2px; }
.gm-item-snippet {
  color: var(--dsw-alias-label-secondary); font-size: 12px; margin-top: 4px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.gm-item-foot { color: var(--dsw-alias-label-secondary); font-size: 11px; margin-top: 5px; }
.gm-detail { flex: 1; overflow: auto; min-width: 0; }
.gm-detail-inner { padding: 20px 24px; max-width: 900px; }
.gm-detail-head { display: flex; gap: 14px; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.gm-detail-head h2 { margin: 0; font-size: 18px; line-height: 1.3; }
.gm-meta-line { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.gm-badge {
  font-size: 10px; border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px; padding: 1px 7px; color: var(--dsw-alias-label-secondary); white-space: nowrap;
}
.gm-badge-pin { color: var(--dsw-alias-state-warn-primary); border-color: currentColor; }
.gm-tags { display: flex; gap: 5px; flex-wrap: wrap; margin: 10px 0 14px; }
.gm-tag {
  font-size: 11px; color: var(--dsw-alias-brand-primary);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 4px; padding: 1px 6px;
}
.gm-secret-card { margin: 12px 0; padding: 12px 14px; }
.gm-secret-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.gm-secret-value {
  margin: 8px 0 0; padding: 10px 12px; border-radius: 8px;
  background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1);
  white-space: pre-wrap; word-break: break-word; font-size: 12px;
}
.gm-badge-warn { color: var(--dsw-alias-state-warn-primary); border-color: currentColor; }
.gm-content { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.65; border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 14px; }
.gm-detail-foot {
  margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1);
  display: flex; flex-wrap: wrap; gap: 10px 18px; font-size: 11px; color: var(--dsw-alias-label-secondary);
}
.gm-detail-actions { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.gm-btn {
  appearance: none; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  border-radius: 6px; padding: 6px 10px; font: inherit; font-size: 12px;
  cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;
}
.gm-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.gm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.gm-btn-ghost { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }
.gm-btn-ghost:hover { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.gm-btn-accent { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.gm-btn-danger { color: var(--dsw-alias-state-error-primary); }
.gm-input, .gm-select, .gm-textarea {
  width: 100%; background: var(--dsw-alias-bg-layer-1); color: inherit;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  padding: 7px 9px; font: inherit; outline: none;
}
.gm-input:focus, .gm-select:focus, .gm-textarea:focus { border-color: var(--dsw-alias-brand-primary); }
.gm-textarea {
  resize: vertical; min-height: 220px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px; line-height: 1.6;
}
.gm-form { display: flex; flex-direction: column; gap: 12px; }
.gm-field { display: flex; flex-direction: column; gap: 4px; }
.gm-label { font-size: 11px; color: var(--dsw-alias-label-secondary); font-weight: 500; }
.gm-form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.gm-check { display: flex; align-items: center; gap: 7px; font-size: 12px; }
.gm-check input { margin: 0; }
.gm-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.gm-editor-head h2 { margin: 0; font-size: 17px; }
.gm-page { padding: 20px 24px; overflow: auto; flex: 1; }
.gm-card {
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  border-radius: 8px; padding: 18px; margin-bottom: 14px; max-width: 920px;
}
.gm-card h2 { margin: 0 0 6px; font-size: 15px; }
.gm-card p { margin: 0 0 12px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.gm-card p:last-child { margin-bottom: 0; }
.gm-grid { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; font-size: 12px; }
.gm-grid dt { color: var(--dsw-alias-label-secondary); }
.gm-grid dd { margin: 0; word-break: break-word; }
.gm-banner {
  margin: 12px 22px 0; padding: 8px 10px; border-radius: 6px; font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
}
.gm-banner-error { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.gm-banner-warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.gm-banner-ok { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.gm-empty { padding: 48px 28px; text-align: center; color: var(--dsw-alias-label-secondary); }
.gm-empty h3 { color: var(--dsw-alias-label-primary); margin: 0 0 6px; font-size: 14px; }
.gm-empty p { margin: 0 auto; max-width: 420px; }
.gm-center { align-items: center; justify-content: center; }
.gm-muted { color: var(--dsw-alias-label-secondary); }
.gm-pre {
  white-space: pre-wrap; word-break: break-word;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px; padding: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px; max-height: 420px; overflow: auto;
}
.gm-backdrop {
  position: fixed; inset: 0; z-index: 1000; padding: 24px;
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 65%, transparent);
  display: flex; align-items: center; justify-content: center;
}
.gm-modal {
  width: min(700px, 100%); max-height: 85vh; overflow: auto;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; padding: 18px;
}
.gm-modal h2 { margin: 0 0 6px; font-size: 16px; }
.gm-modal-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 12px; flex-wrap: wrap; }
.gm-file-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.gm-radio-row { display: flex; gap: 14px; flex-wrap: wrap; margin: 8px 0; font-size: 12px; }
.gm-radio { display: flex; align-items: center; gap: 6px; }
.gm-hint { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.gm-loading { display: flex; align-items: center; justify-content: center; flex: 1; color: var(--dsw-alias-label-secondary); }
@media (max-width: 860px) {
  .gm-body { flex-direction: column; }
  .gm-sidebar { width: 100%; max-height: 45vh; border-right: 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .gm-form-row { grid-template-columns: 1fr; }
  .gm-header-row { flex-direction: column; }
  .gm-header-actions { justify-content: flex-start; }
  .gm-health-strip, .gm-health-bars { grid-template-columns: 1fr; }
}
`

    // -------------------------------------------------------------------------
    // Manager
    // -------------------------------------------------------------------------

    function makeManager(locale) {
      return function GlobalMemoryPanel() {
        const t = useTranslation(locale)
        const [state, setState] = React.useState(null)
        const [loading, setLoading] = React.useState(true)
        const [loadError, setLoadError] = React.useState(null)
        const [live, setLive] = React.useState(false)
        const [tab, setTab] = React.useState('memory')
        const [query, setQuery] = React.useState('')
        const [kindFilter, setKindFilter] = React.useState('')
        const [scopeFilter, setScopeFilter] = React.useState('')
        const [projectFilter, setProjectFilter] = React.useState('')
        const [statusFilter, setStatusFilter] = React.useState('active')
        const [reviewOnly, setReviewOnly] = React.useState(false)
        const [sortMode, setSortMode] = React.useState('priority')
        const [selectedId, setSelectedId] = React.useState(null)
        const [draft, setDraft] = React.useState(null)
        const [revealedId, setRevealedId] = React.useState(null)
        const [revealedSecret, setRevealedSecret] = React.useState(null)
        const [busy, setBusy] = React.useState('')
        const [actionError, setActionError] = React.useState('')
        const [notice, setNotice] = React.useState('')
        const [importOpen, setImportOpen] = React.useState(false)
        const [importText, setImportText] = React.useState('')
        const [importMode, setImportMode] = React.useState('merge')
        const [remoteDraft, setRemoteDraft] = React.useState('')
        const [branchDraft, setBranchDraft] = React.useState('main')
        const revisionRef = React.useRef(0)
        const initializedRef = React.useRef(false)

        const loadState = React.useCallback(async () => {
          try {
            const data = await fetchJson(`${API}/state`)
            if (data !== null && data.ok !== false) {
              setState(data)
              revisionRef.current = typeof data.revision === 'number' ? data.revision : revisionRef.current
              setLoadError(null)
            }
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) setLoadError('host-missing')
            else setLoadError('failed')
          } finally {
            setLoading(false)
          }
        }, [])

        React.useEffect(() => {
          loadState()
          const source = new EventSource(`${API}/events`)
          source.onopen = () => setLive(true)
          source.onerror = () => setLive(false)
          source.onmessage = event => {
            let payload
            try {
              payload = JSON.parse(event.data)
            } catch {
              return
            }
            if (typeof payload.revision === 'number' && payload.revision !== revisionRef.current) {
              loadState()
            }
          }
          return () => source.close()
        }, [loadState])

        React.useEffect(() => {
          if (!state || initializedRef.current) return
          initializedRef.current = true
          setRemoteDraft(state.settings?.gitRemote ?? '')
          setBranchDraft(state.settings?.gitBranch ?? 'main')
        }, [state])

        React.useEffect(() => {
          if (tab === 'git') loadState()
        }, [tab, loadState])

        React.useEffect(() => {
          setRevealedId(null)
          setRevealedSecret(null)
        }, [selectedId])

        React.useEffect(() => {
          if (notice === '') return undefined
          const timeout = setTimeout(() => setNotice(''), 6000)
          return () => clearTimeout(timeout)
        }, [notice])

        React.useEffect(() => {
          if (!importOpen) return undefined
          const onKey = event => {
            if (event.key === 'Escape') setImportOpen(false)
          }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [importOpen])

        const act = React.useCallback(async (action, payload) => {
          setBusy(action)
          setActionError('')
          try {
            const data = await fetchJson(`${API}/action`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action, payload }),
            })
            if (data === null || data.ok === false) {
              throw new ApiError(data?.message ?? 'request failed', 0)
            }
            if (data.snapshot) {
              setState(current => ({
                ...data.snapshot,
                git: data.result?.git ?? current?.git ?? null,
              }))
              revisionRef.current = typeof data.snapshot.revision === 'number' ? data.snapshot.revision : revisionRef.current
            }
            return data.result
          } catch (error) {
            setActionError(error instanceof Error ? error.message : String(error))
            return null
          } finally {
            setBusy('')
          }
        }, [])

        const entries = state?.entries ?? []
        const projects = state?.projects ?? []
        const currentProject = state?.currentProject ?? ''
        const stats = state?.stats ?? { active: 0, archived: 0, pinned: 0, projects: 0 }
        const health = state?.health ?? null
        const git = state?.git ?? null
        const secrets = state?.secrets ?? {}
        const reviewCount = React.useMemo(
          () => entries.filter(entry => entry.status === 'active' && needsReview(entry)).length,
          [entries],
        )

        const filtered = React.useMemo(() => {
          const needle = query.trim().toLowerCase()
          const list = (state?.entries ?? [])
            .filter(entry => {
              if (statusFilter !== 'all' && entry.status !== statusFilter) return false
              if (kindFilter !== '' && entry.kind !== kindFilter) return false
              if (scopeFilter !== '' && entry.scope !== scopeFilter) return false
              if (projectFilter !== '') {
                const target = projectFilter === '__current__' ? currentProject : projectFilter
                if (entry.scope !== 'project' || !sameProject(entry.project, target)) return false
              }
              if (reviewOnly && (!needsReview(entry) || entry.status !== 'active')) return false
              if (needle !== '') {
                const haystack = [entry.title, entry.content, entry.kind, entry.scope, entry.project ?? '', entry.tags.join(' ')]
                  .join('\n')
                  .toLowerCase()
                if (!haystack.includes(needle)) return false
              }
              return true
            })
          return sortEntries(list, sortMode)
        }, [state, query, kindFilter, scopeFilter, projectFilter, statusFilter, reviewOnly, sortMode, currentProject])

        React.useEffect(() => {
          if (draft !== null) return
          if (selectedId !== null && filtered.some(entry => entry.id === selectedId)) return
          setSelectedId(filtered.length > 0 ? filtered[0].id : null)
        }, [filtered, selectedId, draft, entries])

        const selected = selectedId === null ? null : entries.find(entry => entry.id === selectedId) ?? null
        const working = busy !== ''

        const setDraftField = (key, value) => {
          setDraft(current => (current === null ? current : { ...current, [key]: value }))
        }

        const startNew = () => {
          const currentProject = state?.currentProject ?? ''
          setDraft({
            id: undefined,
            title: '',
            content: '',
            kind: 'fact',
            scope: 'global',
            project: currentProject,
            tags: '',
            importance: 3,
            pinned: false,
            status: 'active',
            secretUsername: '',
            secretPassword: '',
            secretNote: '',
            secretConfigured: false,
          })
          setSelectedId(null)
          setActionError('')
          setTab('memory')
        }

        const startEdit = entry => {
          setDraft({
            ...entry,
            tags: entry.tags.join(', '),
            secretUsername: '',
            secretPassword: '',
            secretNote: '',
            secretConfigured: Boolean(state?.secrets?.[entry.id]),
          })
          setActionError('')
          setTab('memory')
        }

        const closeDraft = () => {
          setDraft(null)
          setActionError('')
        }

        const saveDraft = async () => {
          if (draft === null) return
          if (draft.title.trim() === '') {
            setActionError(t('editor.required'))
            return
          }
          if (draft.kind !== 'credential' && draft.content.trim() === '') {
            setActionError(t('editor.required'))
            return
          }
          if (draft.scope === 'project' && draft.project.trim() === '') {
            setActionError(t('editor.projectRequired'))
            return
          }
          const entry = {
            title: draft.title.trim(),
            content: draft.content.trim(),
            kind: draft.kind,
            scope: draft.scope,
            project: draft.scope === 'project' ? draft.project.trim() : null,
            tags: splitTags(draft.tags),
            importance: Number(draft.importance) || 3,
            pinned: Boolean(draft.pinned),
            status: draft.status,
          }
          if (draft.id !== undefined) entry.id = draft.id
          const secret = draft.kind === 'credential'
            ? [draft.secretUsername, draft.secretPassword, draft.secretNote]
              .some(value => String(value ?? '').trim() !== '')
              ? {
                ...(draft.secretUsername.trim() !== '' ? { username: draft.secretUsername.trim() } : {}),
                ...(draft.secretPassword.trim() !== '' ? { password: draft.secretPassword.trim() } : {}),
                ...(draft.secretNote.trim() !== '' ? { note: draft.secretNote.trim() } : {}),
              }
              : undefined
            : undefined
          const result = await act('save', secret === undefined ? { entry } : { entry, secret })
          if (result?.entry) {
            setSelectedId(result.entry.id)
            setDraft(null)
            setNotice(t(secret === undefined ? 'notice.saved' : 'notice.secretSaved'))
          }
        }

        const deleteSelected = async () => {
          if (selected === null) return
          if (!window.confirm(fmt(t('confirm.delete'), { title: selected.title }))) return
          const result = await act('delete', { id: selected.id })
          if (result !== null) {
            setSelectedId(null)
            setNotice(t('notice.deleted'))
          }
        }

        const togglePin = async () => {
          if (selected === null) return
          const result = await act('pin', { id: selected.id, pinned: !selected.pinned })
          if (result !== null) setNotice(t(result.entry?.pinned ? 'notice.pinned' : 'notice.unpinned'))
        }

        const toggleArchive = async () => {
          if (selected === null) return
          const next = selected.status === 'archived' ? 'active' : 'archived'
          const result = await act('archive', { id: selected.id, status: next })
          if (result !== null) setNotice(t(next === 'archived' ? 'notice.archived' : 'notice.restored'))
        }

        const toggleReveal = async () => {
          if (selected === null) return
          if (revealedId === selected.id) {
            setRevealedId(null)
            setRevealedSecret(null)
            return
          }
          const result = await act('secret.get', { id: selected.id })
          if (result?.secret) {
            setRevealedId(selected.id)
            setRevealedSecret(result.secret)
          }
        }

        const openImport = () => {
          setImportOpen(true)
          setImportText('')
          setImportMode('merge')
          setActionError('')
        }

        const runImport = async () => {
          if (importText.trim() === '') {
            setActionError(t('import.empty'))
            return
          }
          const result = await act('import', { data: importText, mode: importMode })
          if (result !== null) {
            setNotice(fmt(t('notice.imported'), result))
            setImportOpen(false)
            setImportText('')
          }
        }

        const onImportFile = async event => {
          const file = event.target.files?.[0]
          if (!file) return
          try {
            setImportText(await file.text())
          } catch (error) {
            setActionError(error instanceof Error ? error.message : String(error))
          }
        }

        const copyStore = async () => {
          try {
            await navigator.clipboard.writeText(state?.storeDir ?? '')
            setNotice(t('notice.copied'))
          } catch {
            setActionError(t('error.generic'))
          }
        }

        const runGit = async (action, noticeKey) => {
          const result = await act(action, {})
          if (result !== null) setNotice(t(noticeKey))
        }

        const saveRemote = async () => {
          const result = await act('git.remote', {
            remote: remoteDraft.trim(),
            branch: branchDraft.trim() === '' ? 'main' : branchDraft.trim(),
          })
          if (result !== null) setNotice(t('notice.remote'))
        }

        const clearRemote = async () => {
          const result = await act('git.remote', {
            remote: '',
            branch: branchDraft.trim() === '' ? 'main' : branchDraft.trim(),
          })
          if (result !== null) {
            setRemoteDraft('')
            setNotice(t('notice.remoteCleared'))
          }
        }

        const canRemote = Boolean(git?.remote || remoteDraft.trim() !== '')

        const renderHealthBar = (label, value, detail, tone = scoreTone(value)) => {
          const percent = clampPercent(value)
          return h('div', { className: 'gm-health-item' },
            h('div', { className: 'gm-health-line' },
              h('span', null, label),
              h('span', { className: 'gm-health-value' }, `${percent}%`),
            ),
            h('div', { className: 'gm-bar' },
              h('span', { className: `gm-bar-fill gm-bar-${tone}`, style: { width: `${percent}%` } }),
            ),
            detail ? h('div', { className: 'gm-health-detail' }, detail) : null,
          )
        }

        const renderHealthStrip = () => {
          if (!health) return null
          const score = health.total === 0 ? 0 : clampPercent(health.score)
          const promptPercent = clampPercent(health.promptPercent)
          const indexed = Math.max(0, health.active - health.missingFiles)
          return h('div', { className: 'gm-health-strip' },
            h('div', { className: 'gm-health-item' },
              h('div', { className: 'gm-health-line' },
                h('span', null, t('health.title')),
                h('span', { className: 'gm-health-value' }, `${score}/100`),
              ),
              h('div', { className: 'gm-bar' },
                h('span', { className: `gm-bar-fill gm-bar-${scoreTone(score)}`, style: { width: `${score}%` } }),
              ),
              h('div', { className: 'gm-health-detail' },
                health.total === 0
                  ? t('health.empty')
                  : fmt(t('health.summary'), { active: health.active, indexed, review: health.needsReview }),
              ),
            ),
            h('div', { className: 'gm-health-item' },
              h('div', { className: 'gm-health-line' },
                h('span', null, t('health.prompt')),
                h('span', { className: 'gm-health-value' }, `${health.promptChars}/${health.promptMaxChars} · ${promptPercent}%`),
              ),
              h('div', { className: 'gm-bar' },
                h('span', { className: `gm-bar-fill gm-bar-${usageTone(promptPercent)}`, style: { width: `${promptPercent}%` } }),
              ),
              h('div', { className: 'gm-health-detail' },
                fmt(t('health.promptDetail'), { entries: health.active, limit: health.entryLimit }),
              ),
            ),
          )
        }

        const renderHeader = () => h('header', { className: 'gm-header' },
          h('div', { className: 'gm-header-row' },
            h('div', null,
              h('h1', { className: 'gm-title' }, t('panel.title')),
              h('p', { className: 'gm-subtitle' }, t('panel.subtitle')),
            ),
            h('div', { className: 'gm-header-actions' },
              h('span', { className: 'gm-live', title: live ? t('panel.live') : t('panel.offline') },
                h('span', { className: `gm-dot${live ? ' gm-dot-on' : ''}` }),
                live ? t('panel.live') : t('panel.offline'),
              ),
              h('button', { className: 'gm-btn', type: 'button', onClick: loadState, disabled: working }, t('action.refresh')),
              h('a', { className: 'gm-btn', href: `${API}/export.json`, download: '' }, t('action.exportJson')),
              h('a', { className: 'gm-btn', href: `${API}/export.md`, download: '' }, t('action.exportMarkdown')),
              h('button', { className: 'gm-btn', type: 'button', onClick: openImport, disabled: working }, t('action.import')),
              h('button', { className: 'gm-btn gm-btn-accent', type: 'button', onClick: startNew, disabled: working }, t('action.new')),
            ),
          ),
          renderHealthStrip(),
          h('nav', { className: 'gm-tabs' },
            h('button', { type: 'button', className: `gm-tab${tab === 'memory' ? ' gm-tab-active' : ''}`, onClick: () => setTab('memory') }, t('tab.memory')),
            h('button', { type: 'button', className: `gm-tab${tab === 'git' ? ' gm-tab-active' : ''}`, onClick: () => setTab('git') }, t('tab.git')),
            h('button', { type: 'button', className: `gm-tab${tab === 'about' ? ' gm-tab-active' : ''}`, onClick: () => setTab('about') }, t('tab.about')),
          ),
        )

        const renderToolbar = () => h('div', { className: 'gm-toolbar' },
          h('span', { className: 'gm-store' },
            h('span', null, `${t('store.label')}:`),
            h('code', { title: state?.storeDir ?? '' }, state?.storeDir ?? ''),
            h('button', { className: 'gm-btn gm-btn-ghost', type: 'button', onClick: copyStore }, t('action.copy')),
          ),
          h('div', { className: 'gm-counts' },
            h('span', { className: 'gm-count' }, fmt(t('counts.active'), { count: stats.active })),
            h('span', { className: 'gm-count' }, fmt(t('counts.pinned'), { count: stats.pinned })),
            h('span', { className: 'gm-count' }, fmt(t('counts.projects'), { count: stats.projects })),
            projects.length > 0 ? h('span', { className: 'gm-count' }, fmt(t('counts.workspaces'), { count: projects.length })) : null,
            state?.currentProject
              ? h('span', { className: 'gm-count', title: state.currentProject }, fmt(t('counts.currentProject'), { project: projectName(state.currentProject) }))
              : null,
            h('span', { className: 'gm-count' }, fmt(t('counts.archived'), { count: stats.archived })),
          ),
          h('p', { className: 'gm-edit-hint' }, t('memory.editHint')),
        )

        const renderEntryItem = entry => h('button', {
          key: entry.id,
          type: 'button',
          className: `gm-item${selectedId === entry.id ? ' gm-item-active' : ''}`,
          onClick: () => {
            setSelectedId(entry.id)
            setDraft(null)
            setActionError('')
          },
        },
          h('div', { className: 'gm-item-top' },
            h('span', { className: 'gm-item-title' }, entry.title),
            entry.pinned ? h('span', { className: 'gm-badge gm-badge-pin' }, t('badge.pinned')) : null,
            entry.status === 'archived' ? h('span', { className: 'gm-badge' }, t('badge.archived')) : null,
          ),
          h('div', { className: 'gm-item-meta' },
            t(`kind.${entry.kind}`),
            ' · ',
            t(`scope.${entry.scope}`),
            entry.scope === 'project' ? ` · ${projectName(entry.project)}` : '',
            ` · ${entry.importance}/5`,
          ),
          h('div', { className: 'gm-item-snippet' }, snippet(entry.content, 130) || t('detail.contentEmpty')),
          h('div', { className: 'gm-item-foot' }, formatDate(entry.updatedAt)),
        )

        const renderList = () => h('div', { className: 'gm-body' },
          h('aside', { className: 'gm-sidebar' },
            h('div', { className: 'gm-filters' },
              h('input', {
                className: 'gm-input',
                type: 'search',
                value: query,
                placeholder: t('search.placeholder'),
                onChange: event => setQuery(event.target.value),
              }),
              h('div', { className: 'gm-filter-row' },
                h('select', { className: 'gm-select', value: kindFilter, onChange: event => setKindFilter(event.target.value) },
                  h('option', { value: '' }, t('filter.allKinds')),
                  ...['preference', 'fact', 'decision', 'convention', 'project', 'reference', 'todo', 'credential']
                    .map(kind => h('option', { key: kind, value: kind }, t(`kind.${kind}`))),
                ),
                h('select', { className: 'gm-select', value: scopeFilter, onChange: event => setScopeFilter(event.target.value) },
                  h('option', { value: '' }, t('filter.allScopes')),
                  h('option', { value: 'global' }, t('scope.global')),
                  h('option', { value: 'project' }, t('scope.project')),
                ),
              ),
              h('select', {
                className: 'gm-select',
                value: projectFilter,
                title: t('filter.allWorkspaces'),
                onChange: event => setProjectFilter(event.target.value),
              },
                h('option', { value: '' }, t('filter.allWorkspaces')),
                currentProject ? h('option', { value: '__current__' }, `${t('filter.currentWorkspace')} · ${projectName(currentProject)}`) : null,
                ...projects.map(row => h('option', { key: row.path, value: row.path }, `${row.label} · ${row.active}`)),
              ),
              h('div', { className: 'gm-segmented' },
                h('button', { type: 'button', className: statusFilter === 'active' ? 'gm-seg-active' : '', onClick: () => setStatusFilter('active') }, t('filter.statusActive')),
                h('button', { type: 'button', className: statusFilter === 'archived' ? 'gm-seg-active' : '', onClick: () => setStatusFilter('archived') }, t('filter.statusArchived')),
                h('button', { type: 'button', className: statusFilter === 'all' ? 'gm-seg-active' : '', onClick: () => setStatusFilter('all') }, t('filter.statusAll')),
              ),
              h('div', { className: 'gm-filter-row' },
                h('select', {
                  className: 'gm-select',
                  value: sortMode,
                  title: t('filter.sort'),
                  onChange: event => setSortMode(event.target.value),
                },
                  h('option', { value: 'priority' }, t('filter.sortPriority')),
                  h('option', { value: 'updated' }, t('filter.sortUpdated')),
                  h('option', { value: 'importance' }, t('filter.sortImportance')),
                  h('option', { value: 'title' }, t('filter.sortTitle')),
                ),
                h('button', {
                  type: 'button',
                  className: `gm-review-toggle${reviewOnly ? ' gm-review-on' : ''}`,
                  onClick: () => setReviewOnly(value => !value),
                }, fmt(t('filter.review'), { count: reviewCount })),
              ),
            ),
            h('div', { className: 'gm-list' },
              filtered.length === 0
                ? h('div', { className: 'gm-empty' },
                  h('h3', null, t('list.empty')),
                  h('p', null, entries.length === 0
                    ? t('list.emptyAll')
                    : reviewOnly ? t('list.emptyReview') : t('list.empty')),
                )
                : filtered.map(renderEntryItem),
            ),
          ),
          h('section', { className: 'gm-detail' },
            draft !== null
              ? renderEditor()
              : selected !== null
                ? renderDetail(selected)
                : h('div', { className: 'gm-empty' }, h('p', null, t('detail.empty'))),
          ),
        )

        const renderDetail = entry => h('div', { className: 'gm-detail-inner' },
          h('div', { className: 'gm-detail-head' },
            h('div', null,
              h('h2', null, entry.title),
              h('div', { className: 'gm-meta-line' },
                h('span', { className: 'gm-badge' }, t(`kind.${entry.kind}`)),
                h('span', { className: 'gm-badge' }, t(`scope.${entry.scope}`)),
                entry.scope === 'project' ? h('span', { className: 'gm-badge' }, projectName(entry.project)) : null,
                h('span', { className: 'gm-badge' }, fmt(t('detail.importance'), { value: entry.importance })),
                entry.pinned ? h('span', { className: 'gm-badge gm-badge-pin' }, t('badge.pinned')) : null,
                entry.status === 'archived' ? h('span', { className: 'gm-badge' }, t('badge.archived')) : null,
              ),
            ),
            h('div', { className: 'gm-detail-actions' },
              h('button', { className: 'gm-btn', type: 'button', disabled: working, onClick: () => startEdit(entry) }, t('action.edit')),
              h('button', { className: 'gm-btn', type: 'button', disabled: working, onClick: togglePin }, entry.pinned ? t('action.unpin') : t('action.pin')),
              h('button', { className: 'gm-btn', type: 'button', disabled: working, onClick: toggleArchive }, entry.status === 'archived' ? t('action.restore') : t('action.archive')),
              h('button', { className: 'gm-btn gm-btn-danger', type: 'button', disabled: working, onClick: deleteSelected }, t('action.delete')),
            ),
          ),
          entry.status === 'active' && needsReview(entry)
            ? h('div', { className: 'gm-banner gm-banner-warn gm-detail-warn' },
              h('strong', null, `${t('review.needs')}: `),
              [
                entry.tags.length === 0 ? t('review.noTags') : null,
                String(entry.content ?? '').trim().length < REVIEW_MIN_CONTENT && entry.kind !== 'credential' ? t('review.shortContent') : null,
                isStale(entry) ? t('review.stale') : null,
              ].filter(Boolean).join(' · '),
            )
            : null,
          entry.tags.length > 0
            ? h('div', { className: 'gm-tags' }, entry.tags.map(tag => h('span', { key: tag, className: 'gm-tag' }, `#${tag}`)))
            : null,
          entry.secret
            ? h('div', { className: 'gm-card gm-secret-card' },
              h('div', { className: 'gm-secret-head' },
                h('strong', null, t('editor.secretTitle')),
                h('span', { className: `gm-badge${secrets[entry.id] ? '' : ' gm-badge-warn'}` },
                  t(secrets[entry.id] ? 'detail.secretConfigured' : 'detail.secretMissing')),
                secrets[entry.id]
                  ? h('button', { className: 'gm-btn', type: 'button', disabled: working, onClick: toggleReveal },
                    t(revealedId === entry.id ? 'detail.hide' : 'detail.reveal'))
                  : null,
              ),
              h('p', { className: 'gm-hint' }, t('detail.secretWarning')),
              revealedId === entry.id && revealedSecret !== null
                ? h('pre', { className: 'gm-secret-value' }, JSON.stringify(revealedSecret, null, 2))
                : null,
            )
            : null,
          h('div', { className: 'gm-content' }, entry.content || t('detail.contentEmpty')),
          h('div', { className: 'gm-detail-foot' },
            h('span', null, `${t('detail.id')}: ${entry.id}`),
            entry.file ? h('span', null, `${t('detail.file')}: ${entry.file}`) : null,
            h('span', null, fmt(t('detail.version'), { version: entry.version })),
            h('span', null, fmt(t('detail.created'), { date: formatDate(entry.createdAt) })),
            h('span', null, fmt(t('detail.updated'), { date: formatDate(entry.updatedAt) })),
            h('span', null, `${t('detail.source')}: ${sourceText(entry.source)}`),
          ),
        )

        const renderEditor = () => h('div', { className: 'gm-detail-inner' },
          h('div', { className: 'gm-editor-head' },
            h('h2', null, draft.id === undefined ? t('editor.newTitle') : t('editor.editTitle')),
            h('div', { className: 'gm-detail-actions' },
              h('button', { className: 'gm-btn', type: 'button', onClick: closeDraft, disabled: working }, t('action.cancel')),
              h('button', { className: 'gm-btn gm-btn-accent', type: 'button', onClick: saveDraft, disabled: working }, t('action.save')),
            ),
          ),
          h('div', { className: 'gm-form' },
            h('label', { className: 'gm-field' },
              h('span', { className: 'gm-label' }, t('editor.title')),
              h('input', {
                className: 'gm-input',
                value: draft.title,
                placeholder: t('editor.titlePlaceholder'),
                onChange: event => setDraftField('title', event.target.value),
              }),
            ),
            h('div', { className: 'gm-form-row' },
              h('label', { className: 'gm-field' },
                h('span', { className: 'gm-label' }, t('editor.kind')),
                h('select', { className: 'gm-select', value: draft.kind, onChange: event => setDraftField('kind', event.target.value) },
                  ...['preference', 'fact', 'decision', 'convention', 'project', 'reference', 'todo', 'credential']
                    .map(kind => h('option', { key: kind, value: kind }, t(`kind.${kind}`))),
                ),
              ),
              h('label', { className: 'gm-field' },
                h('span', { className: 'gm-label' }, t('editor.scope')),
                h('select', { className: 'gm-select', value: draft.scope, onChange: event => setDraftField('scope', event.target.value) },
                  h('option', { value: 'global' }, t('scope.global')),
                  h('option', { value: 'project' }, t('scope.project')),
                ),
              ),
              h('label', { className: 'gm-field' },
                h('span', { className: 'gm-label' }, t('editor.importance')),
                h('select', { className: 'gm-select', value: draft.importance, onChange: event => setDraftField('importance', Number(event.target.value)) },
                  ...[1, 2, 3, 4, 5].map(value => h('option', { key: value, value }, `${value} / 5`)),
                ),
              ),
            ),
            draft.scope === 'project'
              ? h('label', { className: 'gm-field' },
                h('span', { className: 'gm-label' }, t('editor.project')),
                h('input', {
                  className: 'gm-input',
                  value: draft.project,
                  placeholder: t('editor.projectPlaceholder'),
                  onChange: event => setDraftField('project', event.target.value),
                }),
              )
              : null,
            h('label', { className: 'gm-field' },
              h('span', { className: 'gm-label' }, t('editor.tags')),
              h('input', {
                className: 'gm-input',
                value: draft.tags,
                placeholder: t('editor.tagsPlaceholder'),
                onChange: event => setDraftField('tags', event.target.value),
              }),
            ),
            h('label', { className: 'gm-field' },
              h('span', { className: 'gm-label' }, t('editor.content')),
              h('textarea', {
                className: 'gm-textarea',
                value: draft.content,
                placeholder: draft.kind === 'credential' ? t('editor.contentCredentialPlaceholder') : t('editor.contentPlaceholder'),
                rows: 16,
                onChange: event => setDraftField('content', event.target.value),
              }),
            ),
            draft.kind === 'credential'
              ? h('div', { className: 'gm-card gm-secret-card' },
                h('h3', null, t('editor.secretTitle')),
                h('p', { className: 'gm-hint' }, t('editor.secretHint')),
                h('p', { className: 'gm-hint' },
                  t(draft.secretConfigured ? 'editor.secretConfigured' : 'editor.secretMissing')),
                h('div', { className: 'gm-form-row' },
                  h('label', { className: 'gm-field' },
                    h('span', { className: 'gm-label' }, t('editor.username')),
                    h('input', {
                      className: 'gm-input',
                      autoComplete: 'off',
                      value: draft.secretUsername,
                      onChange: event => setDraftField('secretUsername', event.target.value),
                    }),
                  ),
                  h('label', { className: 'gm-field' },
                    h('span', { className: 'gm-label' }, t('editor.password')),
                    h('input', {
                      className: 'gm-input',
                      type: 'password',
                      autoComplete: 'new-password',
                      value: draft.secretPassword,
                      onChange: event => setDraftField('secretPassword', event.target.value),
                    }),
                  ),
                ),
                h('label', { className: 'gm-field' },
                  h('span', { className: 'gm-label' }, t('editor.secretNote')),
                  h('input', {
                    className: 'gm-input',
                    value: draft.secretNote,
                    placeholder: t('editor.secretNotePlaceholder'),
                    onChange: event => setDraftField('secretNote', event.target.value),
                  }),
                ),
              )
              : null,
            h('div', { className: 'gm-form-row' },
              h('label', { className: 'gm-check' },
                h('input', { type: 'checkbox', checked: draft.pinned, onChange: event => setDraftField('pinned', event.target.checked) }),
                h('span', null, t('editor.pinned')),
              ),
              h('label', { className: 'gm-field' },
                h('span', { className: 'gm-label' }, t('editor.status')),
                h('select', { className: 'gm-select', value: draft.status, onChange: event => setDraftField('status', event.target.value) },
                  h('option', { value: 'active' }, t('status.active')),
                  h('option', { value: 'archived' }, t('status.archived')),
                ),
              ),
            ),
          ),
        )

        const renderGit = () => {
          const status = git ?? {}
          return h('div', { className: 'gm-page' },
            h('div', { className: 'gm-card' },
              h('h2', null, t('git.title')),
              h('p', null, t('git.description')),
              status.available === false
                ? h('div', { className: 'gm-banner gm-banner-warn' }, t('git.unavailable'))
                : null,
              status.error
                ? h('div', { className: 'gm-banner gm-banner-warn' }, status.error)
                : null,
              h('dl', { className: 'gm-grid' },
                h('dt', null, t('git.repository')),
                h('dd', null, status.initialized ? t('git.initialized') : t('git.notInitialized')),
                h('dt', null, t('git.branch')),
                h('dd', null, status.branch ?? 'main'),
                h('dt', null, t('git.remote')),
                h('dd', null, status.remote ?? t('git.noRemote')),
                h('dt', null, t('git.state')),
                h('dd', null, status.dirty > 0 ? fmt(t('git.dirty'), { count: status.dirty }) : t('git.clean')),
                h('dt', null, t('git.aheadBehind')),
                h('dd', null, `${fmt(t('git.ahead'), { count: status.ahead ?? 0 })} · ${fmt(t('git.behind'), { count: status.behind ?? 0 })}`),
                h('dt', null, t('git.lastCommit')),
                h('dd', null, status.lastCommit
                  ? fmt(t('git.lastCommitValue'), {
                    hash: status.lastCommit.hash,
                    date: formatDate(status.lastCommit.date),
                    subject: status.lastCommit.subject,
                  })
                  : t('git.never')),
                h('dt', null, t('git.lastSync')),
                h('dd', null, status.lastSyncAt ? formatDate(status.lastSyncAt) : t('git.never')),
              ),
              h('div', { className: 'gm-file-row' },
                h('button', { className: 'gm-btn', type: 'button', disabled: working || status.available === false, onClick: () => runGit('git.init', 'notice.init') }, t('action.init')),
                h('button', { className: 'gm-btn gm-btn-accent', type: 'button', disabled: working || !canRemote, onClick: () => runGit('git.sync', 'notice.sync') }, working ? t('action.working') : t('action.sync')),
                h('button', { className: 'gm-btn', type: 'button', disabled: working || !canRemote, onClick: () => runGit('git.pull', 'notice.pull') }, t('action.pull')),
                h('button', { className: 'gm-btn', type: 'button', disabled: working || !canRemote, onClick: () => runGit('git.push', 'notice.push') }, t('action.push')),
              ),
              h('p', { className: 'gm-hint' }, t('git.syncHint')),
              h('p', { className: 'gm-hint' }, t('git.initHint')),
            ),
            h('div', { className: 'gm-card' },
              h('h2', null, t('git.remote')),
              h('div', { className: 'gm-form' },
                h('label', { className: 'gm-field' },
                  h('span', { className: 'gm-label' }, t('git.remote')),
                  h('input', {
                    className: 'gm-input',
                    value: remoteDraft,
                    placeholder: t('git.remotePlaceholder'),
                    onChange: event => setRemoteDraft(event.target.value),
                  }),
                ),
                h('label', { className: 'gm-field' },
                  h('span', { className: 'gm-label' }, t('git.branch')),
                  h('input', {
                    className: 'gm-input',
                    value: branchDraft,
                    placeholder: t('git.branchPlaceholder'),
                    onChange: event => setBranchDraft(event.target.value),
                  }),
                ),
                h('div', { className: 'gm-file-row' },
                  h('button', { className: 'gm-btn gm-btn-accent', type: 'button', disabled: working, onClick: saveRemote }, t('action.saveRemote')),
                  h('button', { className: 'gm-btn', type: 'button', disabled: working || !git?.remote, onClick: clearRemote }, t('action.clearRemote')),
                ),
                h('p', { className: 'gm-hint' }, t('git.hint')),
              ),
            ),
          )
        }

        const renderHealthCard = () => {
          if (!health) return null
          const indexed = Math.max(0, health.active - health.missingFiles)
          const reviewChips = [
            ['health.needsReview', health.needsReview],
            ['health.stale', health.stale],
            ['health.duplicates', health.duplicateGroups],
            ['health.missingTags', health.missingTags],
            ['health.shortContent', health.shortContent],
            ['health.missingFiles', health.missingFiles],
          ].filter(([, count]) => count > 0)
          return h('div', { className: 'gm-card' },
            h('h2', null, t('health.title')),
            h('p', null, t('health.description')),
            h('div', { className: 'gm-health-bars' },
              renderHealthBar(t('health.overall'), health.score, `${health.score}/100 · ${t(`health.grade.${health.grade}`)}`),
              renderHealthBar(t('health.coverage'), health.coverage, fmt(t('health.summary'), { active: health.active, indexed, review: health.needsReview })),
              renderHealthBar(t('health.metadata'), health.metadata),
              renderHealthBar(fmt(t('health.freshness'), { days: health.staleDays }), health.freshness),
              renderHealthBar(t('health.prompt'), health.promptPercent, `${health.promptChars}/${health.promptMaxChars} chars`, usageTone(health.promptPercent)),
            ),
            health.total === 0
              ? h('p', { className: 'gm-hint' }, t('health.noEntries'))
              : h('div', { className: 'gm-counts gm-health-card-counts' },
                reviewChips.length > 0
                  ? reviewChips.map(([key, count]) => h('span', { key, className: 'gm-count' }, fmt(t(key), { count })))
                  : h('span', { className: 'gm-count' }, t('health.grade.excellent')),
              ),
            h('div', { className: 'gm-importance-row' },
              h('span', { className: 'gm-hint' }, `${t('health.importance')}:`),
              [1, 2, 3, 4, 5].map(value => h('span', { key: value, className: 'gm-count' }, `${value}/5 · ${health.byImportance[value] ?? 0}`)),
            ),
            health.needsReview > 0
              ? h('div', { className: 'gm-file-row' },
                h('button', {
                  className: 'gm-btn gm-btn-accent',
                  type: 'button',
                  onClick: () => {
                    setTab('memory')
                    setStatusFilter('active')
                    setReviewOnly(true)
                  },
                }, t('health.reviewAction')),
              )
              : null,
          )
        }

        const renderAbout = () => h('div', { className: 'gm-page' },
          renderHealthCard(),
          h('div', { className: 'gm-card' },
            h('h2', null, t('about.title')),
            h('p', null, t('about.what')),
            h('dl', { className: 'gm-grid' },
              h('dt', null, t('about.store')),
              h('dd', null, state?.storeDir ?? '—'),
              h('dt', null, t('about.version')),
              h('dd', null, VERSION),
              h('dt', null, t('about.files')),
              h('dd', null, `MEMORY.md — ${t('about.filesMemory')}`),
              h('dd', null, `entries/ — ${t('about.filesEntries')}`),
              h('dd', null, `README.md — ${t('about.filesReadme')}`),
              h('dd', null, `settings.json — ${t('about.filesSettings')}`),
            ),
            h('p', { className: 'gm-hint' }, t('about.safety')),
          ),
          h('div', { className: 'gm-card' },
            h('h2', null, t('about.prompt')),
            h('p', null, t('about.promptNote')),
            h('pre', { className: 'gm-pre' }, state?.prompt ?? ''),
          ),
        )

        const renderImportModal = () => (importOpen
          ? h('div', {
            className: 'gm-backdrop',
            onMouseDown: event => {
              if (event.target === event.currentTarget) setImportOpen(false)
            },
          },
            h('div', { className: 'gm-modal' },
              h('h2', null, t('import.title')),
              h('p', { className: 'gm-hint' }, t('import.description')),
              h('div', { className: 'gm-file-row' },
                h('label', { className: 'gm-btn' },
                  t('action.chooseFile'),
                  h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onChange: onImportFile }),
                ),
                h('span', { className: 'gm-hint' }, t('import.fileHint')),
              ),
              h('div', { className: 'gm-radio-row' },
                h('label', { className: 'gm-radio' },
                  h('input', { type: 'radio', name: 'gm-import-mode', checked: importMode === 'merge', onChange: () => setImportMode('merge') }),
                  h('span', null, t('import.modeMerge')),
                ),
                h('label', { className: 'gm-radio' },
                  h('input', { type: 'radio', name: 'gm-import-mode', checked: importMode === 'replace', onChange: () => setImportMode('replace') }),
                  h('span', null, t('import.modeReplace')),
                ),
              ),
              h('textarea', {
                className: 'gm-textarea',
                value: importText,
                rows: 12,
                placeholder: t('import.placeholder'),
                onChange: event => setImportText(event.target.value),
              }),
              h('div', { className: 'gm-modal-actions' },
                h('button', { className: 'gm-btn', type: 'button', onClick: () => setImportOpen(false), disabled: working }, t('action.cancel')),
                h('button', { className: 'gm-btn gm-btn-accent', type: 'button', onClick: runImport, disabled: working }, working ? t('action.working') : t('action.import')),
              ),
            ),
          )
          : null)

        const banners = []
        if (actionError !== '') banners.push(h('div', { key: 'error', className: 'gm-banner gm-banner-error' }, actionError))
        if (notice !== '') banners.push(h('div', { key: 'notice', className: 'gm-banner gm-banner-ok' }, notice))
        if (state?.warning) banners.push(h('div', { key: 'warning', className: 'gm-banner gm-banner-warn' }, state.warning))

        const shell = (...children) => h(React.Fragment, null,
          h('style', null, CSS),
          h('div', { className: 'gm-root' }, ...children),
        )

        if (loading) {
          return shell(
            renderHeader(),
            h('div', { className: 'gm-loading' }, t('loading')),
          )
        }

        if (loadError !== null) {
          return shell(
            renderHeader(),
            h('div', { className: 'gm-empty' },
              h('h3', null, loadError === 'host-missing' ? t('error.hostMissing') : t('error.load')),
              h('p', null, t('error.generic')),
              h('div', { className: 'gm-file-row', style: { justifyContent: 'center' } },
                h('button', { className: 'gm-btn', type: 'button', onClick: loadState }, t('action.refresh')),
              ),
            ),
          )
        }

        return shell(
          renderHeader(),
          renderToolbar(),
          ...banners,
          tab === 'git' ? renderGit() : tab === 'about' ? renderAbout() : renderList(),
          renderImportModal(),
        )
      }
    }

    // -------------------------------------------------------------------------
    // Plugin registration
    // -------------------------------------------------------------------------

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        try {
          const locale = ctx.get('locale')
          const manager = makeManager(locale)
          const bound = locale.bind(NS)

          ctx.effect(() => {
            const disposers = []
            for (const [language, dictionary] of Object.entries({ en: EN, zh: ZH })) {
              const dispose = locale.register(NS, language, dictionary)
              if (typeof dispose === 'function') disposers.push(dispose)
            }
            return () => {
              for (const dispose of disposers) dispose()
            }
          }, 'global-memory: locale dictionaries')

          ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'global-memory',
            order: 30,
            label: () => bound('panel.title'),
          }, SidebarIcon))

          ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main',
            key: 'global-memory',
          }, manager))
        } catch (error) {
          // A UI plugin must never take down GUI boot.
          console.error('[global-memory] failed to mount UI', error)
        }
      },
    }
  },
})
