/**
 * @neko233/dsh-plugin-global-memory — Host half.
 *
 * A single, machine-wide memory store shared by every DSH project, workspace,
 * session, and agent. The store is a directory:
 *
 *   ${DSH_HOME}/global-memory/
 *     MEMORY.md          index; the only file injected into prompts
 *     entries/*.md       one full memory per file, read on demand
 *
 * Both the index and the entry files are plain Markdown and can be edited by
 * hand. The directory is kept in a normal Git repository so it follows the
 * user across machines. Injecting only the index keeps prompts small; the
 * agent calls the `memory` tool to read an entry before relying on its details.
 *
 * The Host owns all mutations. The browser panel and the agent `memory` tool
 * both go through this one service. The panel talks to it over same-origin
 * loopback HTTP routes; the tool calls it in process.
 */
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, resolve } from 'node:path'

const PACKAGE = '@neko233/dsh-plugin-global-memory'
const FORMAT = 'dsh-global-memory'
const STORE_VERSION = 2
const INDEX_FILE_NAME = 'MEMORY.md'
const ENTRY_DIR_NAME = 'entries'
const API_PREFIX = '/api/global-memory'
const PROMPT_SECTION_ORDER = 210
const PLUGIN_VERSION = '0.4.0'
const HEALTH_STALE_DAYS = 180
const HEALTH_MIN_CONTENT = 20

const KINDS = ['preference', 'fact', 'decision', 'convention', 'project', 'reference', 'todo', 'credential']
const SCOPES = ['global', 'project']
const STATUSES = ['active', 'archived']

const MAX_TITLE = 200
const MAX_CONTENT = 100_000
const MAX_TAGS = 20
const MAX_TAG = 40
const MAX_PROJECT = 1_000
const ACTION_BODY_LIMIT = 2 * 1024 * 1024
const EXPORT_BODY_LIMIT = 2 * 1024 * 1024
const HEARTBEAT_MS = 15_000

/** Machine-local files that must never travel through the sync repository. */
const GITIGNORE_LINES = [
  'settings.json',
  'memory.json.migrated',
  'memory.json.migrated-*',
  'memory.corrupt-*.json',
]

/** Errors that cross the HTTP boundary with a stable machine-readable code. */
class MemoryError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'MemoryError'
    this.code = code
  }
}

function nowIso() {
  return new Date().toISOString()
}

function newId() {
  return `gm_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
}

function clampInt(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(number)))
}

function oneLine(value, max = 240) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`
}

function shortProject(value) {
  if (!value) return ''
  const parts = String(value).split(/[\\/]/).filter(Boolean)
  return (parts[parts.length - 1] || String(value)).replace(/[`\n\r]/g, '')
}

/** Compare workspace paths across Windows drive-letter and separator spellings. */
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

function secretKeyFor(id) {
  return `global-memory:${id}`
}

function cleanSecretPayload(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const allowed = ['username', 'password', 'token', 'url', 'host', 'port', 'note']
  const payload = {}
  for (const key of allowed) {
    if (typeof value[key] === 'string' && value[key] !== '') payload[key] = value[key].slice(0, 10_000)
  }
  return Object.keys(payload).length === 0 ? null : payload
}

function cloneEntry(entry) {
  return {
    ...entry,
    tags: [...entry.tags],
    source: entry.source === null ? null : { ...entry.source },
  }
}

function validIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function requiredText(value, label, max) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MemoryError('invalid-entry', `${label} is required`)
  }
  return value.trim().slice(0, max)
}

function optionalText(value, label, max) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new MemoryError('invalid-entry', `${label} must be a string`)
  return value.trim().slice(0, max)
}

function sanitizeTags(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const tags = []
  for (const raw of value) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim().replace(/^#/, '').slice(0, MAX_TAG)
    if (tag === '') continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }
  return tags
}

function sanitizeSource(value) {
  if (value === null) return null
  if (value === undefined || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = {}
  for (const key of ['project', 'sessionId', 'note']) {
    if (typeof value[key] === 'string' && value[key].trim() !== '') {
      source[key] = value[key].trim().slice(0, 500)
    }
  }
  return Object.keys(source).length === 0 ? null : source
}

function validKind(value) {
  return typeof value === 'string' && KINDS.includes(value) ? value : undefined
}

function validScope(value) {
  return typeof value === 'string' && SCOPES.includes(value) ? value : undefined
}

function validStatus(value) {
  return typeof value === 'string' && STATUSES.includes(value) ? value : undefined
}

function validBranch(value) {
  const branch = String(value ?? '').trim()
  if (branch === '' || branch.length > 120 || !/^[A-Za-z0-9._/-]+$/.test(branch)) {
    throw new MemoryError('invalid-branch', 'Branch must be 1-120 characters: letters, digits, dot, slash, underscore, or dash.')
  }
  return branch
}

function expandHome(path, home = homedir()) {
  if (path === '~') return home
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(home, path.slice(2))
  return path
}

function resolveDshHome(env = process.env, home = homedir()) {
  const configured = env.DSH_HOME?.trim()
  if (configured !== undefined && configured !== '') {
    const expanded = expandHome(configured, home)
    return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded)
  }
  return join(home, '.dsh')
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function writeAtomic(file, text) {
  ensureDir(join(file, '..'))
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, text, 'utf8')
  try {
    renameSync(temporary, file)
  } catch {
    // Windows can briefly refuse to replace a file another process has open.
    writeFileSync(file, text, 'utf8')
    try {
      unlinkSync(temporary)
    } catch {
      // The temp file is harmless; the next write will use a new name.
    }
  }
}

function readJsonFile(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new MemoryError('invalid-json', error instanceof Error ? error.message : String(error))
  }
}

/** Build a canonical entry from user/tool input, or merge into an existing one. */
function buildEntry(input, existing = undefined) {
  const now = nowIso()
  if (existing === undefined) {
    const title = requiredText(input.title, 'title', MAX_TITLE)
    const kind = validKind(input.kind) ?? 'fact'
    const content = kind === 'credential' && (input.content === undefined || String(input.content).trim() === '')
      ? ''
      : requiredText(input.content, 'content', MAX_CONTENT)
    const scope = validScope(input.scope) ?? 'global'
    const project = scope === 'project'
      ? requiredText(input.project, 'project (required for project scope)', MAX_PROJECT)
      : null
    const id = newId()
    const secret = input.secret === true || kind === 'credential'
    return {
      id,
      title,
      content,
      kind,
      scope,
      project,
      tags: sanitizeTags(input.tags),
      importance: clampInt(input.importance, 1, 5, 3),
      pinned: input.pinned === true,
      status: validStatus(input.status) ?? 'active',
      createdAt: now,
      updatedAt: now,
      secret,
      secretRef: secret ? (typeof input.secretRef === 'string' && input.secretRef.trim() !== '' ? input.secretRef.trim().slice(0, 200) : secretKeyFor(id)) : null,
      source: sanitizeSource(input.source) ?? null,
      version: 1,
    }
  }

  const title = input.title === undefined ? existing.title : requiredText(input.title, 'title', MAX_TITLE)
  const kind = input.kind === undefined ? existing.kind : (validKind(input.kind) ?? existing.kind)
  const content = input.content === undefined
    ? existing.content
    : (kind === 'credential' && String(input.content).trim() === '' ? '' : requiredText(input.content, 'content', MAX_CONTENT))
  const scope = input.scope === undefined ? existing.scope : (validScope(input.scope) ?? existing.scope)
  let project = existing.project
  if (scope === 'global') {
    project = null
  } else if (input.project !== undefined) {
    project = requiredText(input.project, 'project (required for project scope)', MAX_PROJECT)
  } else if (!project) {
    throw new MemoryError('invalid-entry', 'project is required for project scope')
  }
  const source = input.source === undefined ? existing.source : (sanitizeSource(input.source) ?? null)
  const secret = kind === 'credential' || (input.secret === undefined ? existing.secret === true : input.secret === true)
  return {
    ...existing,
    title,
    content,
    kind,
    scope,
    project,
    tags: input.tags === undefined ? existing.tags : sanitizeTags(input.tags),
    importance: input.importance === undefined
      ? existing.importance
      : clampInt(input.importance, 1, 5, existing.importance),
    pinned: input.pinned === undefined ? existing.pinned : input.pinned === true,
    status: input.status === undefined ? existing.status : (validStatus(input.status) ?? existing.status),
    updatedAt: now,
    secret,
    secretRef: secret ? (existing.secretRef || secretKeyFor(existing.id)) : null,
    source,
    version: existing.version + 1,
  }
}

/** Imported entries keep their original id and timestamps; invalid fields are corrected. */
function normalizeImported(raw, index) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new MemoryError('invalid-import', `entry ${index + 1} is not an object`)
  }
  const title = requiredText(raw.title, `entry ${index + 1} title`, MAX_TITLE)
  const content = typeof raw.content === 'string' ? raw.content.trim().slice(0, MAX_CONTENT) : ''
  const scope = validScope(raw.scope) ?? 'global'
  const project = scope === 'project'
    ? requiredText(raw.project, `entry ${index + 1} project`, MAX_PROJECT)
    : null
  const createdAt = validIso(raw.createdAt) ? raw.createdAt : nowIso()
  const updatedAt = validIso(raw.updatedAt) ? raw.updatedAt : createdAt
  const kind = validKind(raw.kind) ?? 'fact'
  const secret = raw.secret === true || kind === 'credential'
  const id = typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim().slice(0, 120) : newId()
  return {
    id,
    title,
    content,
    kind,
    scope,
    project,
    tags: sanitizeTags(raw.tags),
    importance: clampInt(raw.importance, 1, 5, 3),
    pinned: raw.pinned === true,
    status: validStatus(raw.status) ?? 'active',
    createdAt,
    updatedAt,
    secret,
    secretRef: secret ? (typeof raw.secretRef === 'string' && raw.secretRef.trim() !== '' ? raw.secretRef.trim().slice(0, 200) : secretKeyFor(id)) : null,
    source: sanitizeSource(raw.source) ?? null,
    version: clampInt(raw.version, 1, 1_000_000, 1),
  }
}

function rankEntries(left, right) {
  return Number(right.pinned) - Number(left.pinned)
    || right.importance - left.importance
    || String(right.updatedAt).localeCompare(String(left.updatedAt))
    || String(left.id).localeCompare(String(right.id))
}

function chronological(left, right) {
  return String(left.createdAt).localeCompare(String(right.createdAt))
    || String(left.id).localeCompare(String(right.id))
}

function entrySignature(entry) {
  return JSON.stringify([
    entry.title,
    entry.content,
    entry.kind,
    entry.scope,
    entry.project,
    entry.tags,
    entry.importance,
    entry.pinned,
    entry.status,
    entry.secret,
    entry.secretRef,
    entry.source,
  ])
}

function parseEntryMetadata(raw) {
  const map = Object.create(null)
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    if (key !== '') map[key] = line.slice(colon + 1).trim()
  }
  return map
}

/**
 * Parse the canonical Markdown file. Every level-three heading starts an entry;
 * an optional HTML comment immediately below it carries structured fields.
 * Headings inside fenced code blocks are ignored, so entries may contain code.
 */
function parseMemoryMarkdown(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const parsed = []
  let current = null
  let fence = null
  const flush = () => {
    if (current === null) return
    let body = current.body.join('\n').replace(/^\s*\n+/, '').trim()
    let metadataText = ''
    const metadata = /^<!--\s*dsh-memory-entry\s*([\s\S]*?)-->\s*/i.exec(body)
    if (metadata !== null) {
      metadataText = metadata[1]
      body = body.slice(metadata[0].length).trim()
    }
    let legacyId = ''
    let legacyVersion = ''
    const legacy = /<!--\s*id:\s*([^\s·]+)\s*·\s*version:\s*(\d+)\s*-->\s*$/i.exec(body)
    if (legacy !== null) {
      legacyId = legacy[1]
      legacyVersion = legacy[2]
      body = body.slice(0, legacy.index).trim()
    }
    const meta = parseEntryMetadata(metadataText)
    const title = current.title.trim().slice(0, MAX_TITLE)
    if (title !== '') {
      const project = String(meta.project ?? '').trim().slice(0, MAX_PROJECT)
      const scope = meta.scope === 'project' && project !== '' ? 'project' : 'global'
      const createdAt = validIso(meta.createdat) ? meta.createdat : nowIso()
      let source = null
      if (meta.source !== undefined && meta.source !== '') {
        try {
          source = sanitizeSource(JSON.parse(meta.source)) ?? null
        } catch {
          source = null
        }
      }
      const kind = validKind(meta.kind) ?? 'fact'
      const id = (meta.id || legacyId || newId()).slice(0, 120)
      const secret = /^(true|yes|1|on)$/i.test(String(meta.secret ?? '')) || kind === 'credential'
      parsed.push({
        id,
        title,
        content: body.slice(0, MAX_CONTENT),
        kind,
        scope,
        project: scope === 'project' ? project : null,
        tags: sanitizeTags(String(meta.tags ?? '').split(',')),
        importance: clampInt(meta.importance, 1, 5, 3),
        pinned: /^(true|yes|1|on)$/i.test(String(meta.pinned ?? '')),
        status: validStatus(meta.status) ?? 'active',
        createdAt,
        updatedAt: validIso(meta.updatedat) ? meta.updatedat : createdAt,
        secret,
        secretRef: secret ? (String(meta.secretref ?? '').trim().slice(0, 200) || secretKeyFor(id)) : null,
        source,
        version: clampInt(meta.version || legacyVersion, 1, 1_000_000, 1),
      })
    }
    current = null
  }
  for (const line of lines) {
    const fenceMatch = /^\s*(```|~~~)/.exec(line)
    if (fenceMatch !== null) {
      if (fence === null) fence = fenceMatch[1]
      else if (fence === fenceMatch[1]) fence = null
    }
    if (fence === null && /^##\s+/.test(line)) {
      flush()
      continue
    }
    if (fence === null && /^###\s+/.test(line)) {
      flush()
      current = { title: line.replace(/^###\s+/, '').replace(/\s+#+\s*$/, ''), body: [] }
      continue
    }
    if (current !== null) current.body.push(line)
  }
  flush()
  const seen = new Set()
  return parsed.map(entry => {
    if (seen.has(entry.id)) return { ...entry, id: newId() }
    seen.add(entry.id)
    return entry
  })
}

function isMemoryMarkdown(text) {
  const value = String(text ?? '')
  return value.trim() === ''
    || /^#\s+Global Memory\b/im.test(value)
    || value.includes('dsh-global-memory:meta')
    || value.includes('dsh-memory-entry')
}

function mergeReloadedEntries(parsed, previous) {
  const previousById = new Map(previous.map(entry => [entry.id, entry]))
  return parsed.map(entry => {
    const old = previousById.get(entry.id)
    if (old === undefined) return entry
    if (entrySignature(entry) === entrySignature(old)) {
      return {
        ...entry,
        createdAt: old.createdAt,
        updatedAt: old.updatedAt,
        version: Math.max(entry.version, old.version),
      }
    }
    return {
      ...entry,
      createdAt: old.createdAt,
      updatedAt: nowIso(),
      version: Math.max(old.version + 1, entry.version),
    }
  })
}

function renderEntryMarkdown(entry) {
  const metadata = [
    '<!-- dsh-memory-entry',
    `id: ${entry.id}`,
    `kind: ${entry.kind}`,
    `scope: ${entry.scope}`,
    `project: ${entry.project ?? ''}`,
    `tags: ${entry.tags.join(', ')}`,
    `importance: ${entry.importance}`,
    `pinned: ${entry.pinned}`,
    `status: ${entry.status}`,
    `createdAt: ${entry.createdAt}`,
    `updatedAt: ${entry.updatedAt}`,
    `version: ${entry.version}`,
    `secret: ${entry.secret === true}`,
    `secretRef: ${entry.secretRef ?? ''}`,
    `source: ${entry.source === null ? '' : JSON.stringify(entry.source)}`,
    '-->',
  ]
  return [`### ${entry.title}`, '', ...metadata, '', entry.content].join('\n').trimEnd()
}

/** One memory body file: level-one title plus the same structured comment. */
function renderEntryFile(entry) {
  return `${renderEntryMarkdown(entry).replace(/^###\s+/, '# ')}\n`
}

function markdownLinkLabel(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\r?\n/g, ' ')
    .trim()
}

function slugForFile(value) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return slug || 'memory'
}

/** Stable, readable path for one memory body. */
function entryFileFor(entry) {
  const safeId = String(entry.id ?? '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80) || 'entry'
  return `${ENTRY_DIR_NAME}/${slugForFile(entry.title)}--${safeId}.md`
}

/** Recover a stable id from a hand-created entry file name. */
function entryIdFromTarget(target) {
  const base = String(target ?? '').split('/').pop()?.replace(/\.md$/i, '') ?? ''
  const marker = base.lastIndexOf('--')
  if (marker >= 0 && marker + 2 < base.length) return base.slice(marker + 2).slice(0, 120)
  let hash = 5381
  for (const character of base) {
    hash = ((hash << 5) + hash + (character.codePointAt(0) ?? 0)) >>> 0
  }
  return `gm_file_${hash.toString(36)}`
}

function entrySection(entry) {
  if (entry.status === 'archived') return 'Archived'
  if (entry.pinned) return 'Pinned'
  return entry.scope === 'project' ? 'Projects' : 'Global'
}

/**
 * Parse one entry file. The title is the first level-one heading; structured
 * fields live in the optional `dsh-memory-entry` comment. Everything else is
 * body Markdown. Files created by hand need no metadata at all.
 */
function parseEntryFile(text, target = '') {
  const source = String(text ?? '')
  const heading = /^#{1,3}\s+(.+?)\s*#*\s*$/m.exec(source)
  const metadataMatch = /<!--\s*dsh-memory-entry\s*([\s\S]*?)-->/i.exec(source)
  const meta = parseEntryMetadata(metadataMatch === null ? '' : metadataMatch[1])
  let body = source
  if (heading !== null) body = body.replace(heading[0], '')
  if (metadataMatch !== null) body = body.replace(metadataMatch[0], '')
  let legacyVersion = ''
  const legacy = /<!--\s*id:\s*([^\s·]+)\s*·\s*version:\s*(\d+)\s*-->\s*$/i.exec(body)
  if (legacy !== null) {
    legacyVersion = legacy[2]
    body = body.slice(0, legacy.index)
  }
  body = body.replace(/^\s*\n+/, '').trim().slice(0, MAX_CONTENT)
  const project = String(meta.project ?? '').trim().slice(0, MAX_PROJECT)
  const scope = meta.scope === 'project' && project !== '' ? 'project' : 'global'
  const createdAt = validIso(meta.createdat) ? meta.createdat : nowIso()
  let sourceValue = null
  if (meta.source !== undefined && meta.source !== '') {
    try {
      sourceValue = sanitizeSource(JSON.parse(meta.source)) ?? null
    } catch {
      sourceValue = null
    }
  }
  const fallbackTitle = String(target ?? '')
    .split('/').pop()?.replace(/\.md$/i, '').split('--')[0]
    .replace(/-+/g, ' ').trim() ?? ''
  const title = (heading?.[1] ?? meta.title ?? '').trim().slice(0, MAX_TITLE)
    || fallbackTitle
    || 'Untitled memory'
  const id = (meta.id || entryIdFromTarget(target) || newId()).slice(0, 120)
  const kind = validKind(meta.kind) ?? 'fact'
  const secret = /^(true|yes|1|on)$/i.test(String(meta.secret ?? '')) || kind === 'credential'
  return {
    id,
    title,
    content: body,
    kind,
    scope,
    project: scope === 'project' ? project : null,
    tags: sanitizeTags(String(meta.tags ?? '').split(',')),
    importance: clampInt(meta.importance, 1, 5, 3),
    pinned: /^(true|yes|1|on)$/i.test(String(meta.pinned ?? '')),
    status: validStatus(meta.status) ?? 'active',
    createdAt,
    updatedAt: validIso(meta.updatedat) ? meta.updatedat : createdAt,
    secret,
    secretRef: secret ? (String(meta.secretref ?? '').trim().slice(0, 200) || secretKeyFor(id)) : null,
    source: sourceValue,
    version: clampInt(meta.version || legacyVersion, 1, 1_000_000, 1),
    file: String(target).replace(/\\/g, '/'),
  }
}

/** Extract index links and the section each one appears under. */
function parseIndexMarkdown(text) {
  const links = []
  let section = 'Global'
  const seen = new Set()
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading !== null) {
      section = heading[1].trim()
      continue
    }
    const match = /^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)/.exec(line)
    if (match === null) continue
    const target = match[2].trim().replace(/^<|>$/g, '').replace(/\\/g, '/')
    if (!target.startsWith(`${ENTRY_DIR_NAME}/`) || target.includes('..')) continue
    if (seen.has(target)) continue
    seen.add(target)
    links.push({
      title: match[1].replace(/\\\]/g, ']').replace(/\\\[/g, '[').trim(),
      target,
      section,
    })
  }
  return links
}

function renderIndexMarkdown(entries, options = {}) {
  const active = entries.filter(entry => entry.status === 'active').sort(chronological)
  const pinned = active.filter(entry => entry.pinned)
  const global = active.filter(entry => !entry.pinned && entry.scope === 'global')
  const projects = active.filter(entry => !entry.pinned && entry.scope === 'project')
  const archived = entries.filter(entry => entry.status === 'archived').sort(chronological)
  const updatedAt = options.updatedAt ?? nowIso()
  const lines = [
    '# Global Memory — Index',
    '',
    '> Shared by every DSH project and every DSH session on this machine.',
    '> Each entry is a separate Markdown file under `entries/`. Edit those files by hand; the plugin reloads them automatically.',
    '> This index is the only file injected into agent prompts. Use the `memory` tool to read a full entry on demand.',
    '> Moving a bullet into Pinned or Archived changes that entry\'s state. The rest of the line is generated metadata.',
    '',
    '<!-- dsh-global-memory:index',
    `format: ${FORMAT}`,
    `version: ${STORE_VERSION}`,
    `updatedAt: ${updatedAt}`,
    '-->',
    '',
    `- Active: ${active.length}`,
    `- Archived: ${archived.length}`,
    `- Updated: ${updatedAt}`,
  ]
  if (options.exportedAt) lines.push(`- Exported: ${options.exportedAt}`)
  lines.push('')
  const section = (title, list, empty) => {
    lines.push(`## ${title}`, '')
    if (list.length === 0) {
      lines.push(empty, '')
      return
    }
    for (const entry of list) {
      const target = String(entry.file ?? entryFileFor(entry)).replace(/\\/g, '/')
      const tags = entry.tags.length > 0 ? ` · tags: ${entry.tags.slice(0, 8).join(', ')}` : ''
      const project = entry.project ? ` · project: ${shortProject(entry.project)}` : ''
      lines.push(`- [${markdownLinkLabel(entry.title)}](${target}) — ${entry.kind} · importance ${entry.importance}/5${tags}${project} · id: ${entry.id}`)
    }
    lines.push('')
  }
  section('Pinned', pinned, '_No pinned entries._')
  section('Global', global, '_No global entries._')
  section('Projects', projects, '_No project-scoped entries._')
  section('Archived', archived, '_No archived entries._')
  return `${lines.join('\n').trimEnd()}\n`
}

/** Standalone Markdown export: one self-contained file for backups/sharing. */
function renderExportMarkdown(entries, options = {}) {
  const active = entries.filter(entry => entry.status === 'active').sort(chronological)
  const pinned = active.filter(entry => entry.pinned)
  const global = active.filter(entry => !entry.pinned && entry.scope === 'global')
  const projects = active.filter(entry => !entry.pinned && entry.scope === 'project')
  const archived = entries.filter(entry => entry.status === 'archived').sort(chronological)
  const lines = [
    '# Global Memory Export',
    '',
    '> Self-contained export of the global memory store. The live store keeps',
    '> one file per entry under `entries/`; `MEMORY.md` is only the index.',
    '',
    `- Exported: ${options.exportedAt ?? nowIso()}`,
    '',
  ]
  const section = (title, list, empty) => {
    lines.push(`## ${title}`, '')
    if (list.length === 0) {
      lines.push(empty, '')
      return
    }
    for (const entry of list) lines.push(renderEntryMarkdown(entry), '')
  }
  section('Pinned', pinned, '_No pinned entries._')
  section('Global', global, '_No global entries._')
  section('Projects', projects, '_No project-scoped entries._')
  section('Archived', archived, '_No archived entries._')
  return `${lines.join('\n').trimEnd()}\n`
}

class GlobalMemoryService {
  constructor(config = {}, runtime = {}) {
    this.config = {
      promptMaxEntries: clampInt(config.promptMaxEntries, 1, 50, 12),
      promptMaxChars: clampInt(config.promptMaxChars, 800, 20_000, 3_200),
      includeProjectEntries: config.includeProjectEntries !== false,
    }
    this.runtime = runtime
    this.dir = join(resolveDshHome(), 'global-memory')
    this.memoryFile = join(this.dir, 'memory.json')
    this.settingsFile = join(this.dir, 'settings.json')
    this.indexFile = join(this.dir, INDEX_FILE_NAME)
    this.entriesDir = join(this.dir, ENTRY_DIR_NAME)
    this.readmeFile = join(this.dir, 'README.md')
    this.entries = []
    this.settings = { gitRemote: '', gitBranch: 'main', lastSyncAt: null }
    this.revision = 1
    this.listeners = new Set()
    this.warning = null
    this.lastIndexText = ''
    this.lastEntryTexts = new Map()
    this.lastStoreSignature = ''
    this.reloadTimer = null
    this.pollTimer = null
    this.disposed = false
    ensureDir(this.dir)
    ensureDir(this.entriesDir)
    this.loadSettings()
    this.loadMemory()
    this.writeDocs()
    this.startWatcher()
  }

  dispose() {
    this.disposed = true
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer)
      this.reloadTimer = null
    }
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.listeners.clear()
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit() {
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch {
        // A broken panel connection must not break a memory write.
      }
    }
  }

  bump() {
    this.revision += 1
    this.emit()
  }

  loadSettings() {
    if (!existsSync(this.settingsFile)) {
      this.writeSettings()
      return
    }
    try {
      const raw = readJsonFile(this.settingsFile)
      this.settings = {
        gitRemote: typeof raw.gitRemote === 'string' ? raw.gitRemote.trim() : '',
        gitBranch: typeof raw.gitBranch === 'string' && raw.gitBranch.trim() !== '' ? raw.gitBranch.trim() : 'main',
        lastSyncAt: validIso(raw.lastSyncAt) ? raw.lastSyncAt : null,
      }
    } catch (error) {
      this.warning = `settings.json could not be read (${error instanceof Error ? error.message : String(error)}); defaults are in use.`
      this.settings = { gitRemote: '', gitBranch: 'main', lastSyncAt: null }
    }
  }

  writeSettings() {
    writeAtomic(this.settingsFile, `${JSON.stringify(this.settings, null, 2)}\n`)
  }

  loadMemory() {
    const hasIndex = existsSync(this.indexFile)
    const hasLegacy = existsSync(this.memoryFile)
    if (!hasIndex) {
      if (hasLegacy) {
        const legacy = this.loadLegacyMemory()
        this.entries = legacy ?? []
        this.assignEntryFiles()
        this.persist()
        this.migrateLegacyFile()
        return
      }
      this.entries = this.readStoreEntries()
      this.persist()
      return
    }

    let text
    try {
      text = readFileSync(this.indexFile, 'utf8')
    } catch (error) {
      this.entries = []
      this.warning = `${INDEX_FILE_NAME} could not be read (${error instanceof Error ? error.message : String(error)}).`
      return
    }

    const inline = /dsh-memory-entry/i.test(text) && !/dsh-global-memory:index/i.test(text)
    if (inline) {
      const parsed = parseMemoryMarkdown(text)
      if (parsed.length > 0 || text.trim() === '') {
        this.entries = parsed
        this.assignEntryFiles()
        this.persist()
        this.migrateLegacyFile()
        return
      }
    }

    if (hasLegacy) {
      const noLinks = parseIndexMarkdown(text).length === 0
      const noFiles = this.listEntryFiles().length === 0
      if (text.trim() === '' || (noLinks && noFiles)) {
        const legacy = this.loadLegacyMemory()
        this.entries = legacy ?? []
        this.assignEntryFiles()
        this.persist()
        this.migrateLegacyFile()
        return
      }
    }

    this.entries = this.readStoreEntries()
    if (!/dsh-global-memory:index/i.test(text)) {
      this.persist()
    } else {
      this.lastIndexText = text
    }
    this.migrateLegacyFile()
  }

  assignEntryFiles() {
    for (const entry of this.entries) {
      if (typeof entry.file !== 'string' || !entry.file.startsWith(`${ENTRY_DIR_NAME}/`) || entry.file.includes('..')) {
        entry.file = entryFileFor(entry)
      }
    }
  }

  listEntryFiles() {
    try {
      return readdirSync(this.entriesDir, { withFileTypes: true })
        .filter(item => item.isFile() && /\.md$/i.test(item.name))
        .map(item => `${ENTRY_DIR_NAME}/${item.name}`)
        .sort()
    } catch {
      return []
    }
  }

  entryPath(file) {
    const normalized = String(file ?? '').replace(/\\/g, '/')
    if (!normalized.startsWith(`${ENTRY_DIR_NAME}/`) || normalized.includes('..')) {
      throw new MemoryError('store-invalid', `Invalid memory file path: ${normalized}`)
    }
    return join(this.dir, normalized)
  }

  /** Read the index, then load each linked file plus any hand-added files. */
  readStoreEntries() {
    const warnings = []
    let text = ''
    try {
      if (existsSync(this.indexFile)) text = readFileSync(this.indexFile, 'utf8')
    } catch (error) {
      warnings.push(`${INDEX_FILE_NAME} could not be read (${error instanceof Error ? error.message : String(error)}).`)
    }
    const links = parseIndexMarkdown(text)
    const entries = []
    const seenFiles = new Set()
    const seenIds = new Set()

    for (const link of links) {
      const file = link.target.replace(/\\/g, '/')
      if (seenFiles.has(file)) continue
      seenFiles.add(file)
      let body
      try {
        body = readFileSync(this.entryPath(file), 'utf8')
      } catch {
        warnings.push(`Index points to a missing file: ${file}`)
        continue
      }
      let entry = parseEntryFile(body, file)
      entry.file = file
      if (link.title !== '') entry.title = link.title.slice(0, MAX_TITLE)
      if (link.section === 'Archived') {
        entry.status = 'archived'
        entry.pinned = false
      } else if (link.section === 'Pinned') {
        entry.status = 'active'
        entry.pinned = true
      } else if (link.section === 'Global' || link.section === 'Projects') {
        entry.status = 'active'
        entry.pinned = false
      }
      if (seenIds.has(entry.id)) entry = { ...entry, id: newId() }
      seenIds.add(entry.id)
      entries.push(entry)
    }

    for (const file of this.listEntryFiles()) {
      if (seenFiles.has(file)) continue
      let body
      try {
        body = readFileSync(this.entryPath(file), 'utf8')
      } catch {
        continue
      }
      let entry = parseEntryFile(body, file)
      entry.file = file
      if (seenIds.has(entry.id)) entry = { ...entry, id: newId() }
      seenIds.add(entry.id)
      entries.push(entry)
    }

    if (warnings.length > 0) this.warning = warnings.join(' ')
    return entries
  }

  loadLegacyMemory() {
    let raw
    try {
      raw = readJsonFile(this.memoryFile)
    } catch (error) {
      const backup = join(this.dir, `memory.corrupt-${Date.now()}.json`)
      try {
        renameSync(this.memoryFile, backup)
      } catch {
        // Leave the file in place if it cannot be moved; the warning names it.
      }
      this.warning = `memory.json was unreadable (${error instanceof Error ? error.message : String(error)}). A backup was kept at ${backup}.`
      return null
    }
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : null
    if (list === null) {
      this.warning = 'memory.json did not contain an entry array; it was ignored.'
      return null
    }
    const good = []
    let skipped = 0
    for (let index = 0; index < list.length; index += 1) {
      try {
        good.push(normalizeImported(list[index], index))
      } catch {
        skipped += 1
      }
    }
    if (skipped > 0) this.warning = `${skipped} malformed memory entr${skipped === 1 ? 'y was' : 'ies were'} skipped while migrating memory.json.`
    return good
  }

  migrateLegacyFile() {
    if (!existsSync(this.memoryFile)) return
    const base = join(this.dir, 'memory.json.migrated')
    const target = existsSync(base) ? join(this.dir, `memory.json.migrated-${Date.now()}`) : base
    try {
      renameSync(this.memoryFile, target)
    } catch {
      // A locked legacy file is harmless; the index and entry files are authoritative.
    }
  }

  writeDocs() {
    if (existsSync(this.readmeFile)) {
      try {
        const existing = readFileSync(this.readmeFile, 'utf8')
        if (existing.includes('one Markdown file per memory')) return
      } catch {
        return
      }
    }
    writeAtomic(this.readmeFile, [
      '# DSH Global Memory store',
      '',
      'This directory is the canonical, machine-wide memory store for dsh-plugin-global-memory.',
      '',
      '- `MEMORY.md` — the index. It is the only file injected into agent prompts.',
      '- `entries/` — one Markdown file per memory; full content is read on demand.',
      '- `settings.json` — machine-local Git remote and branch preferences; not committed.',
      '- `.gitignore` — keeps machine-local files and backups out of the sync repository.',
      '- `README.md` — this file.',
      '',
      'Every DSH project, workspace, and session uses the same store. Edit files under `entries/`',
      'by hand if you like; the plugin reloads them automatically. The index is regenerated from',
      'the entry files. Moving a bullet into Pinned or Archived changes that entry\'s state.',
      '',
      'Each entry file starts with a level-one title and an optional `dsh-memory-entry` HTML',
      'comment holding structured fields. Files without that comment are adopted automatically;',
      'the plugin fills in metadata on the next save. Use `##` or lower inside an entry body.',
      '',
      'Agent workflow: the prompt contains only the index. Use the `memory` tool with action="get"',
      '(or "read") to load one full entry before relying on details, and action="search" to find',
      'entries. This keeps prompts small and avoids guessing content from titles.',
      '',
      'Git sync: configure a remote in the panel, then use Sync now. The plugin commits,',
      'pulls with rebase, and pushes. Conflicts abort the rebase and leave local memory intact.',
      '',
      'Never store passwords, tokens, API keys, or other secrets in memory entries.',
      '',
    ].join('\n'))
  }

  persist() {
    ensureDir(this.entriesDir)
    this.assignEntryFiles()
    for (const entry of this.entries) {
      const file = entry.file.replace(/\\/g, '/')
      const text = renderEntryFile(entry)
      if (this.lastEntryTexts.get(file) !== text) {
        writeAtomic(this.entryPath(file), text)
        this.lastEntryTexts.set(file, text)
      }
    }
    const indexText = renderIndexMarkdown(this.entries)
    writeAtomic(this.indexFile, indexText)
    this.lastIndexText = indexText
    this.lastStoreSignature = this.storeSignature()
  }

  startWatcher() {
    try {
      this.lastStoreSignature = this.storeSignature()
      this.pollTimer = setInterval(() => this.pollStore(), 900)
      this.pollTimer.unref?.()
    } catch (error) {
      this.warning = `Memory watcher could not start: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  storeSignature() {
    const parts = []
    try {
      const index = statSync(this.indexFile)
      parts.push(`index:${index.mtimeMs}:${index.size}`)
    } catch {
      parts.push('index:-')
    }
    for (const file of this.listEntryFiles()) {
      try {
        const stat = statSync(this.entryPath(file))
        parts.push(`${file}:${stat.mtimeMs}:${stat.size}`)
      } catch {
        parts.push(`${file}:-`)
      }
    }
    return parts.join('|')
  }

  pollStore() {
    if (this.disposed) return
    const signature = this.storeSignature()
    if (signature === this.lastStoreSignature) return
    this.lastStoreSignature = signature
    this.scheduleReload()
  }

  scheduleReload() {
    if (this.disposed) return
    if (this.reloadTimer !== null) clearTimeout(this.reloadTimer)
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null
      this.reloadFromStore()
    }, 250)
  }

  reloadFromStore() {
    if (this.disposed) return
    this.warning = null
    const next = this.readStoreEntries()
    const keyOf = list => JSON.stringify(list.map(entry => [
      entry.id,
      entry.title,
      entry.content,
      entry.kind,
      entry.scope,
      entry.project,
      entry.tags,
      entry.importance,
      entry.pinned,
      entry.status,
      entry.file,
    ]))
    if (keyOf(next) === keyOf(this.entries)) return
    this.entries = mergeReloadedEntries(next, this.entries)
    this.persistIndex()
    this.bump()
  }

  /** Regenerate only the index after a hand-added or hand-edited entry. */
  persistIndex() {
    ensureDir(this.entriesDir)
    const indexText = renderIndexMarkdown(this.entries)
    writeAtomic(this.indexFile, indexText)
    this.lastIndexText = indexText
    this.lastStoreSignature = this.storeSignature()
  }

  stats() {
    const byKind = Object.fromEntries(KINDS.map(kind => [kind, 0]))
    let active = 0
    let archived = 0
    let pinned = 0
    let projects = 0
    for (const entry of this.entries) {
      byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1
      if (entry.status === 'active') active += 1
      else archived += 1
      if (entry.pinned && entry.status === 'active') pinned += 1
      if (entry.scope === 'project' && entry.status === 'active') projects += 1
    }
    const lastUpdated = this.entries.reduce((latest, entry) => (
      latest === null || String(entry.updatedAt) > latest ? String(entry.updatedAt) : latest
    ), null)
    return {
      total: this.entries.length,
      active,
      archived,
      pinned,
      projects,
      byKind,
      lastUpdated,
      storeDir: this.dir,
    }
  }

  /**
   * Structural health of the memory store, shown as progress bars in the panel.
   * It is advisory: a low score means the store is hard to trust or maintain,
   * not that the memories themselves are wrong.
   */
  health(promptText = this.renderPrompt()) {
    const active = this.entries.filter(entry => entry.status === 'active')
    const total = active.length
    const now = Date.now()
    const staleMs = HEALTH_STALE_DAYS * 24 * 60 * 60 * 1000
    const byImportance = Object.fromEntries([1, 2, 3, 4, 5].map(value => [value, 0]))
    const signatures = new Map()
    const projects = new Set()
    const tags = new Set()
    let withTags = 0
    let withContent = 0
    let fresh = 0
    let stale = 0
    let missingFiles = 0

    for (const entry of active) {
      if (entry.tags.length > 0) withTags += 1
      if (entry.kind === 'credential' || entry.content.trim().length >= HEALTH_MIN_CONTENT) withContent += 1
      const updated = Date.parse(entry.updatedAt)
      if (Number.isFinite(updated) && now - updated <= staleMs) fresh += 1
      else stale += 1
      if (!entry.file) missingFiles += 1
      else {
        try {
          if (!existsSync(this.entryPath(entry.file))) missingFiles += 1
        } catch {
          missingFiles += 1
        }
      }
      const importance = Number(entry.importance)
      if (byImportance[importance] !== undefined) byImportance[importance] += 1
      if (entry.project) projects.add(entry.project)
      for (const tag of entry.tags) tags.add(tag.toLowerCase())
      const signature = `${entry.title.toLowerCase()}\u0000${entry.content}`
      signatures.set(signature, (signatures.get(signature) ?? 0) + 1)
    }

    const duplicateGroups = [...signatures.values()].filter(count => count > 1).length
    const duplicateEntries = [...signatures.values()]
      .filter(count => count > 1)
      .reduce((sum, count) => sum + count - 1, 0)
    const coverage = total === 0 ? 0 : Math.round(((total - missingFiles) / total) * 100)
    const metadata = total === 0 ? 0 : Math.round(((withTags + withContent) / (2 * total)) * 100)
    const freshness = total === 0 ? 0 : Math.round((fresh / total) * 100)
    const promptMaxChars = Math.max(0, Number(this.config.promptMaxChars) || 0)
    const promptChars = String(promptText ?? '').length
    const promptPercent = promptMaxChars === 0 ? 0 : Math.round((promptChars / promptMaxChars) * 100)
    const headroom = Math.max(0, 100 - Math.min(100, promptPercent))
    const reviewIds = new Set()
    for (const entry of active) {
      if (entry.tags.length === 0
        || (entry.kind !== 'credential' && entry.content.trim().length < HEALTH_MIN_CONTENT)
        || !Number.isFinite(Date.parse(entry.updatedAt))
        || now - Date.parse(entry.updatedAt) > staleMs
        || !entry.file) {
        reviewIds.add(entry.id)
        continue
      }
      try {
        if (!existsSync(this.entryPath(entry.file))) reviewIds.add(entry.id)
      } catch {
        reviewIds.add(entry.id)
      }
    }
    const missingTags = total - withTags
    const shortContent = total - withContent
    let score = 0
    if (total > 0) {
      const weighted = coverage * 0.35 + metadata * 0.3 + freshness * 0.2 + headroom * 0.15
      score = Math.max(0, Math.min(100, Math.round(weighted - Math.min(12, duplicateGroups * 3 + missingFiles * 5))))
    }
    const grade = total === 0 ? 'empty'
      : score >= 90 ? 'excellent'
        : score >= 75 ? 'good'
          : score >= 55 ? 'fair'
            : 'attention'

    return {
      score,
      grade,
      total,
      active: total,
      archived: this.entries.length - total,
      pinned: active.filter(entry => entry.pinned).length,
      projects: projects.size,
      tags: tags.size,
      withTags,
      withContent,
      stale,
      staleDays: HEALTH_STALE_DAYS,
      duplicates: duplicateEntries,
      duplicateGroups,
      missingFiles,
      missingTags,
      shortContent,
      needsReview: reviewIds.size,
      coverage,
      metadata,
      freshness,
      headroom,
      promptChars,
      promptMaxChars,
      promptPercent,
      entryLimit: Math.max(0, Number(this.config.promptMaxEntries) || 0),
      byImportance,
      lastUpdated: this.stats().lastUpdated,
      generatedAt: nowIso(),
    }
  }

  snapshot() {
    const prompt = this.renderPrompt()
    return {
      format: FORMAT,
      version: STORE_VERSION,
      revision: this.revision,
      storeDir: this.dir,
      indexFile: this.indexFile,
      entriesDir: this.entriesDir,
      layout: 'index+entries',
      currentProject: this.currentProject(),
      entries: [...this.entries].map(cloneEntry),
      settings: { ...this.settings },
      stats: this.stats(),
      prompt,
      health: this.health(prompt),
      warning: this.warning,
    }
  }

  async statePayload() {
    return { ok: true, ...this.snapshot(), secrets: await this.secretStatusMap(), git: await this.gitStatus() }
  }

  findEntry(id) {
    const entry = this.entries.find(candidate => candidate.id === id)
    if (entry === undefined) throw new MemoryError('not-found', `Memory entry not found: ${id}`)
    return entry
  }

  /** Current session cwd, used to scope project entries without relying on prompts. */
  projectForAgent(agentId) {
    if (typeof agentId !== 'string' || agentId === '') return null
    try {
      const session = this.runtime.sessions?.get?.(agentId)
      const sessionCwd = session?.header?.cwd
      if (typeof sessionCwd === 'string' && sessionCwd.trim() !== '') return normalizeProjectPath(sessionCwd)
      const workingDirectory = this.runtime.workingDirectory
      if (session !== undefined && typeof workingDirectory?.get === 'function') {
        const cwd = workingDirectory.get(session)
        if (typeof cwd === 'string' && cwd.trim() !== '') return normalizeProjectPath(cwd)
      }
    } catch {
      // Fall through to the default directory.
    }
    return this.defaultProject()
  }

  defaultProject() {
    try {
      const cwd = this.runtime.workingDirectory?.defaultDirectory
      return typeof cwd === 'string' && cwd.trim() !== '' ? normalizeProjectPath(cwd) : null
    } catch {
      return null
    }
  }

  currentProject() {
    try {
      const agent = this.runtime.agents?.currentInitiator?.()
      return this.projectForAgent(agent?.id)
    } catch {
      return this.defaultProject()
    }
  }

  credentialStore() {
    const credentials = this.runtime.credentials
    if (credentials === undefined || credentials === null) {
      throw new MemoryError('credentials-unavailable', 'The credentials service is not available; secure credentials cannot be stored.')
    }
    return credentials
  }

  async setSecret(id, payload) {
    const clean = cleanSecretPayload(payload)
    if (clean === null) throw new MemoryError('invalid-secret', 'Provide at least one of username, password, token, url, host, port, or note.')
    await this.credentialStore().modifyRecord(secretKeyFor(id), () => ({ kind: 'grant', payload: clean }))
    return { ok: true, configured: true, fields: Object.keys(clean) }
  }

  async getSecret(id) {
    const record = await this.credentialStore().readRecord(secretKeyFor(id))
    if (record === undefined || record.kind !== 'grant') {
      throw new MemoryError('secret-missing', 'No secure credential is stored for this entry.')
    }
    return record.payload
  }

  async secretConfigured(id) {
    try {
      const record = await this.credentialStore().readRecord(secretKeyFor(id))
      return record !== undefined
    } catch {
      return false
    }
  }

  async deleteSecret(id) {
    try {
      await this.credentialStore().deleteRecord(secretKeyFor(id))
    } catch {
      // The Markdown entry is still removable if the credential store is absent.
    }
  }

  async secretStatusMap(entries = this.entries) {
    const map = {}
    const candidates = entries.filter(entry => entry.secret === true)
    await Promise.all(candidates.map(async (entry) => {
      try {
        if (await this.secretConfigured(entry.id)) map[entry.id] = true
      } catch {
        // A missing or unavailable credential store leaves the entry visible but unconfigured.
      }
    }))
    return map
  }

  async pruneSecrets(keepIds) {
    try {
      const records = await this.credentialStore().listRecords()
      const prefix = 'global-memory:'
      for (const record of records) {
        const key = String(record.key)
        if (!key.startsWith(prefix)) continue
        const id = key.slice(prefix.length)
        if (!keepIds.has(id)) await this.credentialStore().deleteRecord(key)
      }
    } catch {
      // Best-effort cleanup; orphaned records are never shown to an agent.
    }
  }

  async saveCredential(fields, secret, agentId) {
    const input = { ...(fields ?? {}), kind: 'credential', secret: true }
    if (input.scope === 'project' && (input.project === undefined || input.project === '')) {
      const project = this.projectForAgent(agentId) || this.currentProject()
      if (project === null) throw new MemoryError('invalid-entry', 'project is required for project scope')
      input.project = project
    }
    const clean = secret === undefined ? undefined : cleanSecretPayload(secret)
    if (clean === null) throw new MemoryError('invalid-secret', 'Provide at least one credential field.')
    const entry = this.saveEntry(input)
    if (clean !== undefined) await this.setSecret(entry.id, clean)
    return entry
  }

  saveEntry(input, agentId = undefined) {
    const fields = input?.entry !== undefined && typeof input.entry === 'object' ? { ...input.entry } : { ...input }
    if (fields === null || typeof fields !== 'object') throw new MemoryError('invalid-entry', 'entry is required')
    if (fields.scope === undefined && typeof fields.project === 'string' && fields.project.trim() !== '') {
      fields.scope = 'project'
    }
    if (fields.scope === 'project' && (fields.project === undefined || fields.project === '')) {
      const project = this.projectForAgent(agentId) || this.currentProject()
      if (project === null) throw new MemoryError('invalid-entry', 'project is required for project scope')
      fields.project = project
    }
    const id = typeof fields.id === 'string' && fields.id.trim() !== '' ? fields.id.trim() : undefined
    const existing = id === undefined ? undefined : this.findEntry(id)
    const entry = buildEntry(fields, existing)
    const sameContent = (candidate) => candidate.id !== entry.id
      && candidate.status === 'active'
      && candidate.title.toLowerCase() === entry.title.toLowerCase()
      && candidate.content === entry.content
    const duplicate = this.entries.find(sameContent)
    if (duplicate !== undefined) {
      throw new MemoryError('duplicate', `A memory entry with the same title and content already exists (${duplicate.id}). Update it instead.`)
    }
    if (typeof entry.file !== 'string' || entry.file === '') entry.file = entryFileFor(entry)
    if (existing === undefined) this.entries = [entry, ...this.entries]
    else this.entries = this.entries.map(candidate => (candidate.id === entry.id ? entry : candidate))
    if (existing?.secret === true && entry.secret !== true) void this.deleteSecret(entry.id).catch(() => {})
    this.persist()
    this.bump()
    return cloneEntry(entry)
  }

  async deleteEntry(id) {
    const entry = this.findEntry(id)
    this.entries = this.entries.filter(candidate => candidate.id !== id)
    try {
      unlinkSync(this.entryPath(entry.file))
    } catch {
      // The file may already be gone; the index is still authoritative.
    }
    if (entry.secret) await this.deleteSecret(id)
    this.lastEntryTexts.delete(String(entry.file).replace(/\\/g, '/'))
    this.persist()
    this.bump()
    return { ok: true, deleted: id }
  }

  pruneEntryFiles(keep = new Set()) {
    for (const file of this.listEntryFiles()) {
      if (keep.has(file)) continue
      try {
        unlinkSync(this.entryPath(file))
        this.lastEntryTexts.delete(file)
      } catch {
        // Leave an undeletable file for the user; it is no longer in the index.
      }
    }
  }

  setPinned(id, pinned) {
    const entry = this.findEntry(id)
    const updated = { ...entry, pinned: pinned === true, updatedAt: nowIso(), version: entry.version + 1 }
    this.entries = this.entries.map(candidate => (candidate.id === id ? updated : candidate))
    this.persist()
    this.bump()
    return cloneEntry(updated)
  }

  setStatus(id, status) {
    const next = validStatus(status)
    if (next === undefined) throw new MemoryError('invalid-entry', `status must be one of: ${STATUSES.join(', ')}`)
    const entry = this.findEntry(id)
    const updated = { ...entry, status: next, updatedAt: nowIso(), version: entry.version + 1 }
    this.entries = this.entries.map(candidate => (candidate.id === id ? updated : candidate))
    this.persist()
    this.bump()
    return cloneEntry(updated)
  }

  searchEntries(input = {}, projectContext = undefined) {
    const query = typeof input.query === 'string' ? input.query.trim().toLowerCase() : ''
    const kind = validKind(input.kind)
    const scope = validScope(input.scope)
    const status = input.status === 'all' ? 'all' : (validStatus(input.status) ?? 'active')
    const explicitProject = typeof input.project === 'string' ? normalizeProjectPath(input.project) : ''
    const current = explicitProject !== '' ? explicitProject : (projectContext ?? this.currentProject())
    const pinnedOnly = input.pinned === true
    const limit = clampInt(input.limit, 1, 200, 20)
    const list = this.entries.filter((entry) => {
      if (status !== 'all' && entry.status !== status) return false
      if (kind !== undefined && entry.kind !== kind) return false
      if (scope !== undefined) {
        if (entry.scope !== scope) return false
        if (scope === 'project' && !sameProject(entry.project, current)) return false
      } else if (entry.scope === 'project' && !sameProject(entry.project, current)) {
        return false
      }
      if (pinnedOnly && !entry.pinned) return false
      if (explicitProject !== '' && entry.scope === 'project' && !sameProject(entry.project, explicitProject)) return false
      if (query !== '') {
        const haystack = [entry.title, entry.content, entry.kind, entry.scope, entry.project ?? '', entry.tags.join(' ')]
          .join('\n')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
    return list.sort(rankEntries).slice(0, limit).map(cloneEntry)
  }

  importData(data, mode = 'merge') {
    if (typeof data !== 'string' || data.trim() === '') {
      throw new MemoryError('invalid-import', 'Import data is empty.')
    }
    if (data.length > EXPORT_BODY_LIMIT) {
      throw new MemoryError('import-too-large', 'Import data is too large (limit 2 MB).')
    }
    let parsed
    try {
      parsed = JSON.parse(data)
    } catch (error) {
      throw new MemoryError('invalid-import', `Import is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : null
    if (list === null) throw new MemoryError('invalid-import', 'Import must be a memory export object or an entry array.')
    if (list.length === 0) throw new MemoryError('invalid-import', 'Import contains no entries.')
    if (list.length > 10_000) throw new MemoryError('invalid-import', 'Import contains more than 10,000 entries.')
    const incoming = list.map((raw, index) => normalizeImported(raw, index))
    const counts = { mode, imported: 0, updated: 0, skipped: 0, total: incoming.length }
    if (mode === 'replace') {
      const byId = new Map()
      for (const entry of incoming) byId.set(entry.id, entry)
      this.entries = [...byId.values()]
      this.assignEntryFiles()
      this.pruneEntryFiles(new Set(this.entries.map(entry => entry.file)))
      void this.pruneSecrets(new Set(this.entries.filter(entry => entry.secret).map(entry => entry.id)))
      counts.imported = this.entries.length
      this.persist()
      this.bump()
      return counts
    }
    const byId = new Map(this.entries.map(entry => [entry.id, entry]))
    const bySignature = new Map(this.entries.map(entry => [`${entry.title.toLowerCase()}\u0000${entry.content}`, entry]))
    for (const entry of incoming) {
      const existing = byId.get(entry.id)
      if (existing !== undefined) {
        if (String(entry.updatedAt) > String(existing.updatedAt)) {
          const merged = { ...entry, file: existing.file, createdAt: existing.createdAt, updatedAt: nowIso(), version: existing.version + 1 }
          byId.set(entry.id, merged)
          counts.updated += 1
        } else {
          counts.skipped += 1
        }
        continue
      }
      const signature = `${entry.title.toLowerCase()}\u0000${entry.content}`
      if (bySignature.has(signature)) {
        counts.skipped += 1
        continue
      }
      byId.set(entry.id, entry)
      bySignature.set(signature, entry)
      counts.imported += 1
    }
    this.entries = [...byId.values()]
    this.persist()
    this.bump()
    return counts
  }

  exportJson() {
    return {
      format: FORMAT,
      version: STORE_VERSION,
      exportedAt: nowIso(),
      generator: `${PACKAGE}@${PLUGIN_VERSION}`,
      entries: [...this.entries].sort(chronological).map(cloneEntry),
    }
  }

  exportMarkdown() {
    return renderExportMarkdown(this.entries, { exportedAt: nowIso() })
  }

  renderPrompt(project = this.currentProject()) {
    const { promptMaxEntries, promptMaxChars, includeProjectEntries } = this.config
    const active = this.entries.filter(entry => entry.status === 'active'
      && (entry.scope === 'global' || (includeProjectEntries && sameProject(entry.project, project))))
    const sorted = [...active].sort(rankEntries)
    const pinnedCount = active.filter(entry => entry.pinned).length
    const globalCount = active.filter(entry => entry.scope === 'global').length
    const projectCount = active.length - globalCount
    const projectLabel = project ? shortProject(project) : null
    const header = [
      '## Persistent memory index (dsh-plugin-global-memory)',
      'Durable memory for this person and the current DSH project. The full text is stored as Markdown files in the memory directory; only this index is loaded into the prompt.',
      `Entries: ${active.length} in scope (${globalCount} global, ${projectCount} project), ${pinnedCount} pinned. Store: ${this.dir}`,
      projectLabel ? `Current project scope: ${projectLabel} (${project}). Project-scoped entries outside it are omitted.` : 'No project scope detected; only true-global entries are shown.',
      'Before relying on any entry, call the `memory` tool with action="get" and its id (or action="read") to load the full text. Do not guess details from a title.',
      'Use action="search" to find entries. Save durable preferences, conventions, decisions, project facts, and open todos. Credentials belong in the secure credential store, never in Markdown.',
      'When the user says "remember this" (记一下 / 记住), save it. Prefer small, single-topic entries with a clear title and tags. Search first and update an existing entry instead of duplicating it.',
    ].join('\n')
    const lines = [header]
    if (sorted.length === 0) {
      lines.push('', '_No active memory entries in this scope yet. Save durable facts with the memory tool._')
      return lines.join('\n')
    }
    lines.push('', '### Index')
    let budget = promptMaxChars - lines.join('\n').length
    let count = 0
    let omitted = 0
    for (const entry of sorted) {
      if (count >= promptMaxEntries) {
        omitted = sorted.length - count
        break
      }
      const scopeLabel = entry.scope === 'project' ? ` · project: ${shortProject(entry.project)}` : ''
      const tags = entry.tags.length > 0 ? ` · ${entry.tags.slice(0, 6).join(', ')}` : ''
      const hidden = entry.secret ? ' · secure' : ''
      const line = `- **${oneLine(entry.title, 120)}** — ${entry.kind}${entry.pinned ? ' · pinned' : ''}${scopeLabel}${hidden} · id: \`${entry.id}\`${tags}`
      if (line.length + 1 > budget) {
        omitted = sorted.length - count
        break
      }
      lines.push(line)
      budget -= line.length + 1
      count += 1
    }
    if (omitted > 0) {
      lines.push(`- … ${omitted} more active entr${omitted === 1 ? 'y' : 'ies'} not shown; use the memory tool to search.`)
    }
    return lines.join('\n')
  }

  // ---------------------------------------------------------------------------
  // Git
  // ---------------------------------------------------------------------------

  runGit(args, options = {}) {
    const okCodes = options.okCodes ?? [0]
    const timeout = options.timeout ?? 30_000
    return new Promise((resolvePromise, reject) => {
      execFile('git', args, {
        cwd: this.dir,
        timeout,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      }, (error, stdout, stderr) => {
        const output = String(stdout ?? '')
        const diagnostics = String(stderr ?? '')
        if (error === null) {
          resolvePromise({ code: 0, stdout: output.trim(), stderr: diagnostics.trim() })
          return
        }
        if (error.code === 'ENOENT') {
          reject(new MemoryError('git-not-found', 'Git is not installed or is not available on PATH.'))
          return
        }
        const code = typeof error.code === 'number' ? error.code : 1
        if (okCodes.includes(code)) {
          resolvePromise({ code, stdout: output.trim(), stderr: diagnostics.trim() })
          return
        }
        const detail = diagnostics.trim() || output.trim() || error.message
        reject(new MemoryError('git-failed', `git ${args[0]} failed: ${oneLine(detail, 800)}`))
      })
    })
  }

  async gitStatus() {
    const initialized = existsSync(join(this.dir, '.git'))
    const base = {
      available: true,
      initialized,
      remote: this.settings.gitRemote || null,
      branch: this.settings.gitBranch || 'main',
      dirty: 0,
      ahead: 0,
      behind: 0,
      lastCommit: null,
      lastSyncAt: this.settings.lastSyncAt ?? null,
      error: null,
    }
    if (!initialized) return base
    try {
      const status = await this.runGit(['status', '--porcelain=v1'])
      base.dirty = status.stdout === '' ? 0 : status.stdout.split('\n').length
      const branch = await this.runGit(['symbolic-ref', '--short', 'HEAD'], { okCodes: [0, 128] })
      if (branch.stdout !== '') base.branch = branch.stdout
      const remote = await this.runGit(['remote', 'get-url', 'origin'], { okCodes: [0, 2] })
      if (remote.stdout !== '') base.remote = remote.stdout
      const log = await this.runGit(['log', '-1', '--format=%h%x09%cI%x09%s'], { okCodes: [0, 128] })
      if (log.stdout !== '') {
        const [hash, date, subject] = log.stdout.split('\t')
        base.lastCommit = { hash, date, subject }
      }
      const counts = await this.runGit(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], { okCodes: [0, 128] })
      if (counts.stdout !== '') {
        const [ahead, behind] = counts.stdout.split(/\s+/).map(Number)
        if (Number.isFinite(ahead)) base.ahead = ahead
        if (Number.isFinite(behind)) base.behind = behind
      }
    } catch (error) {
      if (error instanceof MemoryError && error.code === 'git-not-found') {
        base.available = false
        base.error = error.message
      } else {
        base.error = error instanceof Error ? error.message : String(error)
      }
    }
    return base
  }

  async ensureGit() {
    if (!existsSync(join(this.dir, '.git'))) await this.gitInit()
  }

  async ensureGitIgnore() {
    const file = join(this.dir, '.gitignore')
    const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
    const present = new Set(current.split(/\r?\n/).map(line => line.trim()))
    const missing = GITIGNORE_LINES.filter(line => !present.has(line))
    if (missing.length === 0) return
    const prefix = current.trim() === '' ? '' : `${current.replace(/\s*$/, '')}\n`
    writeAtomic(file, `${prefix}${missing.join('\n')}\n`)
  }

  async prepareGitForSync() {
    await this.ensureGitIgnore()
    // settings.json is machine-local (remote URL, last sync time). Keep the file
    // on disk but stop tracking it, including for repositories created by older
    // versions of this plugin.
    await this.runGit(['rm', '--cached', '--ignore-unmatch', 'settings.json'], { okCodes: [0, 128] })
  }

  async gitInit() {
    if (existsSync(join(this.dir, '.git'))) {
      return { message: 'Git is already initialized.', git: await this.gitStatus() }
    }
    await this.runGit(['init', '-q'])
    await this.runGit(['symbolic-ref', 'HEAD', `refs/heads/${validBranch(this.settings.gitBranch)}`])
    this.settings.gitBranch = validBranch(this.settings.gitBranch)
    this.writeSettings()
    await this.prepareGitForSync()
    return { message: 'Initialized a Git repository in the memory store.', git: await this.gitStatus() }
  }

  async gitSetRemote(remote, branch) {
    const url = String(remote ?? '').trim()
    const nextBranch = validBranch(branch ?? this.settings.gitBranch ?? 'main')
    if (url === '') {
      if (existsSync(join(this.dir, '.git'))) {
        await this.runGit(['remote', 'remove', 'origin'], { okCodes: [0, 2] })
      }
      this.settings.gitRemote = ''
      this.settings.gitBranch = nextBranch
      this.writeSettings()
      return { message: 'Git remote cleared.', git: await this.gitStatus() }
    }
    if (url.length > 2_000) throw new MemoryError('invalid-remote', 'The Git remote URL is too long.')
    await this.ensureGit()
    const existing = await this.runGit(['remote', 'get-url', 'origin'], { okCodes: [0, 2] })
    if (existing.stdout === '') await this.runGit(['remote', 'add', 'origin', url])
    else await this.runGit(['remote', 'set-url', 'origin', url])
    this.settings.gitRemote = url
    this.settings.gitBranch = nextBranch
    this.writeSettings()
    return { message: 'Git remote saved.', git: await this.gitStatus() }
  }

  async abortGitOperation() {
    if (existsSync(join(this.dir, '.git', 'rebase-merge')) || existsSync(join(this.dir, '.git', 'rebase-apply'))) {
      try {
        await this.runGit(['rebase', '--abort'], { okCodes: [0, 128] })
      } catch {
        // Best effort: the original error is the useful one.
      }
    }
  }

  async requireRemote() {
    await this.ensureGit()
    const remote = this.settings.gitRemote.trim()
    if (remote === '') {
      const existing = await this.runGit(['remote', 'get-url', 'origin'], { okCodes: [0, 2] })
      if (existing.stdout === '') throw new MemoryError('git-remote-missing', 'Configure a Git remote before syncing.')
      this.settings.gitRemote = existing.stdout
    }
    return this.settings.gitRemote
  }

  async gitPull() {
    const remote = await this.requireRemote()
    const branch = validBranch(this.settings.gitBranch)
    try {
      const pull = await this.runGit(['pull', '--rebase', '--autostash', 'origin', branch], { timeout: 60_000 })
      this.reloadFromDisk()
      this.settings.lastSyncAt = nowIso()
      this.writeSettings()
      return { message: pull.stdout || 'Already up to date.', git: await this.gitStatus() }
    } catch (error) {
      await this.abortGitOperation()
      throw new MemoryError(
        'git-conflict',
        `${error instanceof Error ? error.message : String(error)} — the rebase was aborted and local memory is intact. Resolve the Git conflict manually in ${this.dir}, or push local memory to a new remote.`,
      )
    }
  }

  async gitPush() {
    await this.requireRemote()
    const branch = validBranch(this.settings.gitBranch)
    const push = await this.runGit(['push', '-u', 'origin', branch], { timeout: 60_000 })
    this.settings.lastSyncAt = nowIso()
    this.writeSettings()
    return { message: push.stderr || push.stdout || 'Pushed.', git: await this.gitStatus() }
  }

  async gitSync() {
    await this.requireRemote()
    const branch = validBranch(this.settings.gitBranch)
    await this.prepareGitForSync()
    await this.runGit(['add', '-A'])
    const staged = await this.runGit(['diff', '--cached', '--quiet'], { okCodes: [0, 1] })
    let committed = false
    if (staged.code === 1) {
      await this.runGit([
        '-c', 'user.name=DSH Global Memory',
        '-c', 'user.email=global-memory@dsh.local',
        'commit', '-m', `Update global memory (${nowIso()})`,
      ])
      committed = true
    }
    const remoteHeads = await this.runGit(['ls-remote', '--heads', 'origin', branch], { timeout: 60_000 })
    if (remoteHeads.stdout !== '') {
      try {
        await this.runGit(['pull', '--rebase', '--autostash', 'origin', branch], { timeout: 60_000 })
      } catch (error) {
        await this.abortGitOperation()
        throw new MemoryError(
          'git-conflict',
          `${error instanceof Error ? error.message : String(error)} — the rebase was aborted and local memory is intact. Resolve the Git conflict manually in ${this.dir}.`,
        )
      }
      this.reloadFromDisk()
    }
    await this.runGit(['push', '-u', 'origin', branch], { timeout: 60_000 })
    this.settings.lastSyncAt = nowIso()
    this.writeSettings()
    return {
      message: committed ? 'Committed local changes, pulled, and pushed.' : 'Pulled and pushed (no local changes to commit).',
      git: await this.gitStatus(),
    }
  }

  reloadFromDisk() {
    if (!existsSync(this.indexFile)) {
      throw new MemoryError('store-invalid', `The pulled repository does not contain ${INDEX_FILE_NAME}.`)
    }
    let text
    try {
      text = readFileSync(this.indexFile, 'utf8')
    } catch (error) {
      throw new MemoryError('store-invalid', `Pulled ${INDEX_FILE_NAME} could not be read: ${error instanceof Error ? error.message : String(error)}`)
    }
    const inline = /dsh-memory-entry/i.test(text) && !/dsh-global-memory:index/i.test(text)
    if (inline) {
      const parsed = parseMemoryMarkdown(text)
      if (parsed.length === 0 && text.trim() !== '') {
        throw new MemoryError('store-invalid', `Pulled ${INDEX_FILE_NAME} has an unexpected shape.`)
      }
      this.entries = mergeReloadedEntries(parsed, this.entries)
      this.assignEntryFiles()
      this.persist()
      this.bump()
      return
    }
    const next = this.readStoreEntries()
    const links = parseIndexMarkdown(text)
    if (next.length === 0 && links.length > 0) {
      throw new MemoryError('store-invalid', 'The pulled index points to entry files that are missing.')
    }
    if (next.length === 0 && text.trim() !== '' && !/dsh-global-memory:index/i.test(text)) {
      throw new MemoryError('store-invalid', `Pulled ${INDEX_FILE_NAME} has an unexpected shape.`)
    }
    this.entries = mergeReloadedEntries(next, this.entries)
    this.lastIndexText = text
    this.lastStoreSignature = this.storeSignature()
    this.warning = null
    this.bump()
  }

  async applyAction(action, payload = {}) {
    switch (action) {
      case 'save': {
        const raw = payload.entry ?? payload
        if (raw?.kind === 'credential' || raw?.secret === true || payload.secret !== undefined) {
          return { entry: await this.saveCredential(raw, payload.secret, payload.agentId) }
        }
        return { entry: this.saveEntry(raw, payload.agentId) }
      }
      case 'delete':
        return this.deleteEntry(String(payload.id ?? ''))
      case 'secret.get':
        return { id: String(payload.id ?? ''), secret: await this.getSecret(String(payload.id ?? '')) }
      case 'secret.set':
        return this.setSecret(String(payload.id ?? ''), payload.secret ?? payload)
      case 'secret.delete':
        await this.deleteSecret(String(payload.id ?? ''))
        return { ok: true, id: String(payload.id ?? '') }
      case 'pin':
        return { entry: this.setPinned(String(payload.id ?? ''), payload.pinned !== false) }
      case 'archive':
        return { entry: this.setStatus(String(payload.id ?? ''), payload.status === 'archived' ? 'archived' : 'active') }
      case 'import':
        return this.importData(String(payload.data ?? ''), payload.mode === 'replace' ? 'replace' : 'merge')
      case 'git.init':
        return this.gitInit()
      case 'git.remote':
        return this.gitSetRemote(payload.remote, payload.branch)
      case 'git.sync':
        return this.gitSync()
      case 'git.pull':
        return this.gitPull()
      case 'git.push':
        return this.gitPush()
      case 'stats':
        return { health: this.health(), stats: this.stats() }
      default:
        throw new MemoryError('unknown-action', `Unknown action: ${action}`)
    }
  }
}

// -----------------------------------------------------------------------------
// HTTP routes
// -----------------------------------------------------------------------------

function isIPv4Loopback(value) {
  const parts = value.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isLoopbackAddress(address) {
  if (address === undefined) return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isIPv4Loopback(normalized.slice('::ffff:'.length))
  return isIPv4Loopback(normalized)
}

function isLoopbackHostname(hostname) {
  return hostname === 'localhost' || hostname === '[::1]' || isIPv4Loopback(hostname)
}

function fenceDenial(req) {
  if (!isLoopbackAddress(req.socket.remoteAddress)) return 'non-loopback-socket'
  if (req.headers['sec-fetch-site'] === 'cross-site') return 'cross-site'
  const host = req.headers.host
  if (typeof host !== 'string') return 'missing-host'
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return 'non-loopback-host'
  }
  if (!isLoopbackHostname(hostUrl.hostname) && hostUrl.hostname !== 'dsh-app') return 'non-loopback-host'
  const origin = req.headers.origin
  if (origin === undefined) return undefined
  try {
    const parsed = new URL(origin)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.host === hostUrl.host ? undefined : 'origin-mismatch'
  } catch {
    return 'origin-mismatch'
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req, limit = ACTION_BODY_LIMIT) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new MemoryError('body-too-large', 'Request body is too large.')
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new MemoryError('invalid-json', `Request body is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function makeRoutes(service) {
  const guard = (req, res) => {
    const denial = fenceDenial(req)
    if (denial === undefined) return true
    json(res, 403, { ok: false, error: `forbidden: ${denial}` })
    return false
  }

  const state = {
    kind: 'exact',
    path: `${API_PREFIX}/state`,
    handler: async (req, res) => {
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!guard(req, res)) return
      try {
        json(res, 200, await service.statePayload())
      } catch (error) {
        json(res, 500, { ok: false, error: 'state-failed', message: error instanceof Error ? error.message : String(error) })
      }
    },
  }

  const action = {
    kind: 'exact',
    path: `${API_PREFIX}/action`,
    handler: async (req, res) => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!guard(req, res)) return
      if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        return json(res, 415, { ok: false, error: 'json-required' })
      }
      try {
        const body = await readBody(req)
        const actionName = typeof body?.action === 'string' ? body.action : ''
        if (actionName === '') throw new MemoryError('invalid-action', 'action is required')
        const result = await service.applyAction(actionName, body?.payload ?? {})
        json(res, 200, { ok: true, result, snapshot: await service.statePayload() })
      } catch (error) {
        const code = error instanceof MemoryError ? error.code : 'error'
        const status = code === 'body-too-large' ? 413 : code === 'not-found' ? 404 : 400
        json(res, status, {
          ok: false,
          error: code,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }

  const exportJson = {
    kind: 'exact',
    path: `${API_PREFIX}/export.json`,
    handler: (req, res) => {
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!guard(req, res)) return
      const text = `${JSON.stringify(service.exportJson(), null, 2)}\n`
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="dsh-global-memory-${nowIso().slice(0, 10)}.json"`,
        'cache-control': 'no-store',
      })
      res.end(text)
    },
  }

  const exportMarkdown = {
    kind: 'exact',
    path: `${API_PREFIX}/export.md`,
    handler: (req, res) => {
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!guard(req, res)) return
      res.writeHead(200, {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="dsh-global-memory-${nowIso().slice(0, 10)}.md"`,
        'cache-control': 'no-store',
      })
      res.end(service.exportMarkdown())
    },
  }

  const events = {
    kind: 'exact',
    path: `${API_PREFIX}/events`,
    handler: (req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end()
        return
      }
      if (!guard(req, res)) return
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no',
      })
      const send = () => {
        if (res.writableEnded) return
        try {
          res.write(`data: ${JSON.stringify({ revision: service.revision })}\n\n`)
        } catch {
          // The client went away; the close handlers clean up.
        }
      }
      send()
      const unsubscribe = service.subscribe(send)
      const heartbeat = setInterval(() => {
        if (res.writableEnded) return
        try {
          res.write(': ping\n\n')
        } catch {
          // The close handlers clean up.
        }
      }, HEARTBEAT_MS)
      const cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }
      req.on('close', cleanup)
      res.on('close', cleanup)
    },
  }

  return [state, action, exportJson, exportMarkdown, events]
}

// -----------------------------------------------------------------------------
// Agent tool
// -----------------------------------------------------------------------------

function formatEntryForTool(entry, full = false) {
  const meta = [
    entry.kind,
    entry.scope === 'project' ? `project ${entry.project}` : 'global',
    `importance ${entry.importance}/5`,
    entry.pinned ? 'pinned' : null,
    entry.status,
  ].filter(Boolean).join(' · ')
  const tags = entry.tags.length > 0 ? ` · tags: ${entry.tags.join(', ')}` : ''
  const file = entry.file ? ` · file: ${entry.file}` : ''
  if (!full) {
    return `- **${oneLine(entry.title, 120)}** · id: \`${entry.id}\` · ${meta}${tags}${file}`
  }
  return `### ${entry.title}\n_${meta}_ · id: \`${entry.id}\`${tags}${file}\n\n${entry.content || '_(empty)_'}`
}

function pickFields(input) {
  const fields = {}
  for (const key of ['id', 'title', 'content', 'kind', 'scope', 'project', 'tags', 'importance', 'pinned', 'status', 'source']) {
    if (input[key] !== undefined) fields[key] = input[key]
  }
  return fields
}

function createMemoryTool(service) {
  return {
    name: 'memory',
    description: [
      'Persistent memory for this machine, separated into true-global (personal, cross-project) and project-scoped entries. The prompt shows global entries plus entries for the current project only.',
      'The prompt contains only the memory index. Before relying on an entry, use action="get" (or "read") with its id to load the full Markdown text; do not guess details from a title.',
      'Use action="search" before answering questions about user preferences, conventions, past decisions, or project facts. Search defaults to global plus the current project.',
      'Use action="save" when the user asks you to remember something, or states a durable preference, convention, decision, project fact, or open todo. Set scope="project" (and optionally project) for facts that apply only to one workspace; omit scope for true-global personal assets such as SSH identity, accounts, and preferences.',
      'For accounts, passwords, tokens, and SSH secrets, use kind="credential" and pass a secret object. The secret is stored in the DSH credential store; Markdown holds only a reference. Never put a password or token in title, content, tags, or a normal entry.',
      'Keep entries small, single-topic, titled, and tagged. Search first; update an existing entry instead of duplicating it.',
      'Use action="stats" to inspect memory health, prompt-budget usage, stale entries, duplicates, and review warnings.',
      'Actions: search, list, get, read, save, update, delete, pin, archive, secret.get, secret.set, secret.delete, export, import, sync, pull, push, status, stats, digest.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'list', 'get', 'read', 'save', 'update', 'delete', 'pin', 'archive', 'secret.get', 'secret.set', 'secret.delete', 'export', 'import', 'sync', 'pull', 'push', 'status', 'stats', 'digest'],
          description: 'The memory operation to perform.',
        },
        id: { type: 'string', description: 'Entry id for get, read, update, delete, pin, or archive.' },
        title: { type: 'string', description: 'Entry title (required to create).' },
        content: { type: 'string', description: 'Markdown entry content (required to create).' },
        kind: { type: 'string', enum: KINDS, description: 'Entry kind. Defaults to fact.' },
        scope: { type: 'string', enum: SCOPES, description: 'global (default) or project.' },
        project: { type: 'string', description: 'Absolute workspace path; required when scope is project.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Short tags, without the leading #.' },
        importance: { type: 'integer', minimum: 1, maximum: 5, description: 'Importance from 1 to 5. Defaults to 3.' },
        pinned: { type: 'boolean', description: 'Pin this entry into the prompt digest, or unpin it.' },
        status: { type: 'string', enum: STATUSES, description: 'active or archived (for archive).' },
        query: { type: 'string', description: 'Case-insensitive search text.' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Maximum entries to return. Defaults to 20.' },
        format: { type: 'string', enum: ['json', 'markdown'], description: 'Export format. Defaults to json.' },
        data: { type: 'string', description: 'JSON export text to import.' },
        mode: { type: 'string', enum: ['merge', 'replace'], description: 'Import mode. Defaults to merge.' },
        remote: { type: 'string', description: 'Git remote URL.' },
        branch: { type: 'string', description: 'Git branch. Defaults to main.' },
        secret: {
          type: 'object',
          description: 'Secret payload for a credential entry. Stored in the DSH credential store, never in Markdown. Only pass fields the user explicitly asked to remember.',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            token: { type: 'string' },
            url: { type: 'string' },
            host: { type: 'string' },
            port: { type: 'string' },
            note: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string' },
        },
        additionalProperties: true,
      },
      render(_args, value) {
        const text = value !== null && typeof value === 'object' && typeof value.message === 'string'
          ? value.message
          : typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2)
        return [{ type: 'text', text }]
      },
    },
    async execute(args, exec) {
      const input = args !== null && typeof args === 'object' ? args : {}
      const action = input.action
      switch (action) {
        case 'search':
        case 'list': {
          const entries = service.searchEntries(input, service.projectForAgent(exec?.agent?.id))
          if (entries.length === 0) {
            return { ok: true, message: 'No matching memory entries.', entries: [] }
          }
          return {
            ok: true,
            message: `Found ${entries.length} memory entr${entries.length === 1 ? 'y' : 'ies'} (index only; use action=get with an id for full text):\n\n${entries.map(entry => formatEntryForTool(entry)).join('\n')}`,
            entries,
          }
        }
        case 'get':
        case 'read': {
          const entry = cloneEntry(service.findEntry(String(input.id ?? '')))
          const hint = entry.secret ? `\n\n_This entry is a credential reference. Use action="secret.get" with the same id only if the user explicitly needs the stored secret._` : ''
          return { ok: true, message: `${formatEntryForTool(entry, true)}${hint}`, entry }
        }
        case 'save':
        case 'update': {
          if (action === 'update' && (typeof input.id !== 'string' || input.id === '')) {
            throw new MemoryError('invalid-entry', 'update requires id')
          }
          const fields = pickFields(input)
          fields.source = {
            ...(typeof input.source === 'object' && input.source !== null ? input.source : {}),
            sessionId: exec?.agent?.id ?? undefined,
            note: 'agent',
          }
          const entry = input.secret !== undefined || fields.kind === 'credential'
            ? await service.saveCredential(fields, input.secret, exec?.agent?.id)
            : service.saveEntry(fields, exec?.agent?.id)
          return {
            ok: true,
            message: entry.secret
              ? (input.secret === undefined
                ? `Saved credential entry "${entry.title}" (${entry.id}). No secret value was provided yet; add one in the panel or with secret.set.`
                : `Saved credential entry "${entry.title}" (${entry.id}). The secret is stored securely; Markdown contains only a reference.`)
              : `Saved memory entry "${entry.title}" (${entry.id}).`,
            entry,
          }
        }
        case 'delete': {
          const result = await service.deleteEntry(String(input.id ?? ''))
          return { ok: true, message: `Deleted memory entry ${result.deleted}.`, ...result }
        }
        case 'secret.get': {
          const payload = await service.getSecret(String(input.id ?? ''))
          return { ok: true, message: JSON.stringify(payload, null, 2), secret: payload }
        }
        case 'secret.set': {
          const result = await service.setSecret(String(input.id ?? ''), input.secret ?? input)
          return { ok: true, message: 'Secure credential saved.', ...result }
        }
        case 'secret.delete': {
          await service.deleteSecret(String(input.id ?? ''))
          return { ok: true, message: 'Secure credential deleted.' }
        }
        case 'pin': {
          const entry = service.setPinned(String(input.id ?? ''), input.pinned !== false)
          return { ok: true, message: `${entry.pinned ? 'Pinned' : 'Unpinned'} "${entry.title}" (${entry.id}).`, entry }
        }
        case 'archive': {
          const entry = service.setStatus(String(input.id ?? ''), input.status === 'archived' ? 'archived' : 'active')
          return { ok: true, message: `${entry.status === 'archived' ? 'Archived' : 'Restored'} "${entry.title}" (${entry.id}).`, entry }
        }
        case 'export': {
          const format = input.format === 'markdown' ? 'markdown' : 'json'
          const text = format === 'markdown' ? service.exportMarkdown() : `${JSON.stringify(service.exportJson(), null, 2)}\n`
          return { ok: true, message: text, format }
        }
        case 'import': {
          const counts = service.importData(String(input.data ?? ''), input.mode === 'replace' ? 'replace' : 'merge')
          return {
            ok: true,
            message: `Import (${counts.mode}): ${counts.imported} new, ${counts.updated} updated, ${counts.skipped} skipped, ${counts.total} entries read.`,
            counts,
          }
        }
        case 'sync':
          return { ok: true, ...(await service.gitSync()) }
        case 'pull':
          return { ok: true, ...(await service.gitPull()) }
        case 'push':
          return { ok: true, ...(await service.gitPush()) }
        case 'status': {
          const snapshot = service.snapshot()
          const git = await service.gitStatus()
          const stats = snapshot.stats
          const health = snapshot.health
          return {
            ok: true,
            message: [
              `Memory: ${stats.active} active, ${stats.archived} archived, ${stats.pinned} pinned, ${stats.projects} project-scoped.`,
              `Current project scope: ${snapshot.currentProject ?? 'not detected (global only)'}.`,
              `Health: ${health.score}/100 (${health.grade}); index coverage ${health.coverage}%, metadata ${health.metadata}%, freshness ${health.freshness}%, prompt budget ${health.promptChars}/${health.promptMaxChars} chars (${health.promptPercent}%).`,
              `Review: ${health.needsReview} entr${health.needsReview === 1 ? 'y' : 'ies'} need attention, ${health.stale} stale, ${health.duplicateGroups} duplicate group(s).`,
              `Store: ${snapshot.storeDir}`,
              `Git: ${git.available ? (git.initialized ? `${git.branch}${git.remote ? ` → ${git.remote}` : ' (no remote)'}${git.dirty > 0 ? `, ${git.dirty} changed file(s)` : ', clean'}` : 'not initialized') : 'not available'}.`,
              git.lastSyncAt ? `Last sync: ${git.lastSyncAt}.` : null,
            ].filter(Boolean).join('\n'),
            stats,
            health,
            git,
          }
        }
        case 'stats': {
          const health = service.health()
          const stats = service.stats()
          return {
            ok: true,
            message: [
              `Memory health: ${health.score}/100 (${health.grade}).`,
              `${health.active} active, ${health.archived} archived, ${health.pinned} pinned, ${health.projects} project-scoped; ${health.tags} unique tags.`,
              `Index: ${health.promptChars}/${health.promptMaxChars} chars (${health.promptPercent}% of budget), limit ${health.entryLimit} entries.`,
              `Coverage ${health.coverage}%, metadata ${health.metadata}%, freshness ${health.freshness}%.`,
              `Review: ${health.needsReview} need attention; ${health.stale} stale; ${health.duplicateGroups} duplicate group(s); ${health.missingFiles} missing file(s); ${health.missingTags} without tags; ${health.shortContent} with short content.`,
            ].join('\n'),
            health,
            stats,
          }
        }
        case 'digest':
          return { ok: true, message: service.renderPrompt() }
        default:
          throw new MemoryError('unknown-action', `Unknown memory action: ${action}`)
      }
    },
  }
}

// -----------------------------------------------------------------------------
// Cordis plugin
// -----------------------------------------------------------------------------

/** Single-instance guard: the package can be linked and bundled at once. */
const MOUNTED = Symbol.for('@neko233/dsh-plugin-global-memory.mounted')

function mountOnce(packageName, fn) {
  return (...args) => {
    const registry = globalThis[MOUNTED] ?? (globalThis[MOUNTED] = new Set())
    if (registry.has(packageName)) return undefined
    registry.add(packageName)
    const ctx = args[0]
    ctx?.effect?.(() => () => {
      registry.delete(packageName)
    })
    return fn(...args)
  }
}

export const inject = ['systemPrompt', 'webServer', 'tools', 'credentials', 'agents', 'sessions', 'workingDirectory']

export { GlobalMemoryService }

export const apply = mountOnce(PACKAGE, (ctx, config) => {
  const enabled = config?.enabled !== false
  const service = new GlobalMemoryService(config ?? {}, {
    credentials: ctx.credentials,
    agents: ctx.agents,
    sessions: ctx.sessions,
    workingDirectory: ctx.workingDirectory,
  })
  ctx.effect(() => {
    const disposers = []
    try {
      for (const route of makeRoutes(service)) disposers.push(ctx.webServer.register(route))
    } catch (error) {
      for (const dispose of disposers) dispose()
      service.dispose()
      throw error
    }
    return () => {
      for (const dispose of disposers) dispose()
      service.dispose()
    }
  }, 'global-memory: store and HTTP routes')

  if (!enabled) return
  if (config?.announceToAgent !== false) {
    ctx.effect(() => ctx.systemPrompt.section({
      name: 'plugin:global-memory',
      order: PROMPT_SECTION_ORDER,
      text: () => service.renderPrompt(),
    }), 'global-memory: prompt digest')
  }
  ctx.effect(() => ctx.tools.register(createMemoryTool(service)), 'global-memory: memory tool')
})
