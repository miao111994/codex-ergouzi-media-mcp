import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'https://ergouzi.life';
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_LOCAL_MEDIA_BYTES = 3 * 1024 * 1024;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'canceled', 'unknown']);

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AUDIO_TYPES = new Set(['audio/flac', 'audio/mpeg', 'audio/wav']);
const VIDEO_TYPES = new Set(['video/mp4']);

const MODEL_MEDIA_FIELDS = {
  'ergouzi/e-image': {},
  'ergouzi/e-image-edit': {
    images: { multiple: true, types: IMAGE_TYPES },
  },
  'ergouzi/e-image-ideogram': {},
  'ergouzi/e-image-try-on': {
    person_image: { types: IMAGE_TYPES },
    garment_images: { multiple: true, types: IMAGE_TYPES },
    reference_pose: { types: IMAGE_TYPES },
  },
  'ergouzi/e-image-upscale': {
    image: { types: IMAGE_TYPES },
  },
  'ergouzi/e-video': {
    image: { types: IMAGE_TYPES },
    last_frame_image: { types: IMAGE_TYPES },
    audio: { types: AUDIO_TYPES },
  },
  'ergouzi/e-video-animate': {
    video: { types: VIDEO_TYPES },
    image: { types: IMAGE_TYPES },
  },
  'ergouzi/e-video-avatar': {
    image: { types: IMAGE_TYPES },
    audio: { types: AUDIO_TYPES },
  },
  'ergouzi/e-video-replace': {
    video: { types: VIDEO_TYPES },
    images: { multiple: true, types: IMAGE_TYPES },
  },
};

export function nowUuid() {
  return crypto.randomUUID();
}

export function textContent(value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }];
}

export function jsonResult(value) {
  return { content: textContent(value) };
}

export function errorResult(message, extra = {}) {
  return {
    content: textContent({ error: message, ...extra }),
    isError: true,
  };
}

export function getConfigPath() {
  const override = (process.env.ERGOUZI_CONFIG_FILE || '').trim();
  if (override) return path.resolve(override);
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ergouzi', 'credentials.json');
  }
  const xdg = (process.env.XDG_CONFIG_HOME || '').trim();
  return path.join(xdg || path.join(os.homedir(), '.config'), 'ergouzi', 'credentials.json');
}

export function normalizeBaseUrl(value) {
  let raw = String(value || '').trim().replace(/\/+$/, '');
  if (raw.endsWith('/v1')) raw = raw.slice(0, -3);
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Ergouzi base URL must use HTTP or HTTPS');
  }
  if (parsed.search || parsed.hash || (parsed.pathname !== '' && parsed.pathname !== '/')) {
    throw new Error('Ergouzi base URL must not include a path, query, or fragment');
  }
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error('Ergouzi base URL must use HTTPS unless it targets localhost');
  }
  return raw;
}

export async function loadCredentials() {
  const saved = {};
  const configPath = getConfigPath();
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') Object.assign(saved, parsed);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Unable to read Ergouzi config: ${configPath}`);
    }
  }
  const baseUrl = normalizeBaseUrl(
    process.env.ERGOUZI_MEDIA_BASE_URL ||
      saved.base_url ||
      process.env.ERGOUZI_BASE_URL ||
      DEFAULT_BASE_URL,
  );
  const apiKey =
    process.env.ERGOUZI_MEDIA_API_KEY ||
    saved.api_key ||
    process.env.ERGOUZI_API_KEY ||
    '';
  if (!String(apiKey).trim()) {
    throw new Error('Ergouzi API key is not configured; set env vars or save credentials locally');
  }
  return { baseUrl, apiKey: String(apiKey).trim() };
}

export async function apiJson(credentials, method, pathName, payload = undefined, extraHeaders = {}, timeoutMs = 120000) {
  if (!pathName.startsWith('/')) throw new Error('API path must start with /');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${credentials.apiKey}`,
    'User-Agent': 'ergouzi-media-mcp/0.1.0',
    ...extraHeaders,
  };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(credentials.baseUrl + pathName, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await res.text();
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }
    if (!res.ok) {
      const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      const err = new Error(`Ergouzi API returned HTTP ${res.status}: ${String(detail || '').slice(0, 512)}`);
      err.status = res.status;
      err.body = parsed;
      throw err;
    }
    if (parsed && typeof parsed === 'object') return parsed;
    return {};
  } finally {
    clearTimeout(timer);
  }
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isDataUri(value, allowedTypes) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return false;
  const header = value.slice(5, value.indexOf(','));
  const type = header.split(';', 1)[0].toLowerCase();
  return header.toLowerCase().includes(';base64') && allowedTypes.has(type);
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function detectLocalMediaType(filePath) {
  const suffix = path.extname(filePath).toLowerCase();
  if (suffix === '.jpg' || suffix === '.jpeg') return 'image/jpeg';
  if (suffix === '.png') return 'image/png';
  if (suffix === '.webp') return 'image/webp';
  if (suffix === '.mp4') return 'video/mp4';
  if (suffix === '.mp3') return 'audio/mpeg';
  if (suffix === '.wav') return 'audio/wav';
  if (suffix === '.flac') return 'audio/flac';
  return '';
}

function containsLocalPlaceholder(value) {
  if (Array.isArray(value)) return value.some((item) => containsLocalPlaceholder(item));
  if (isObject(value)) {
    if (Object.keys(value).length === 1 && Object.hasOwn(value, '$local_file')) return true;
    return Object.values(value).some((item) => containsLocalPlaceholder(item));
  }
  return false;
}

function makeDataUri(mediaType, bytes) {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`;
}

async function prepareOne(value, allowedTypes) {
  if (isHttpsUrl(value) || isDataUri(value, allowedTypes)) return value;
  if (!isObject(value) || !Object.hasOwn(value, '$local_file') || Object.keys(value).length !== 1) {
    throw new Error('Media input must be an HTTPS URL, supported data URI, or {$local_file: ...} object');
  }
  const filePath = path.resolve(String(value.$local_file || '').trim());
  if (!filePath) throw new Error('$local_file must contain a path');
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat) throw new Error(`Local media file does not exist: ${filePath}`);
  if (!stat.isFile()) throw new Error(`Local media path is not a file: ${filePath}`);
  if (stat.size <= 0) throw new Error(`Local media file is empty: ${filePath}`);
  if (stat.size > MAX_LOCAL_MEDIA_BYTES) {
    throw new Error('Local media is too large for the 4 MiB JSON request limit; use an HTTPS URL');
  }
  const mediaType = detectLocalMediaType(filePath);
  if (!allowedTypes.has(mediaType)) {
    throw new Error(`Unsupported media type for this field: ${mediaType || path.extname(filePath) || 'unknown'}`);
  }
  const bytes = await fs.readFile(filePath);
  return makeDataUri(mediaType, bytes);
}

async function resolveModelInput(model, input) {
  const spec = MODEL_MEDIA_FIELDS[model];
  if (!spec) throw new Error(`Unsupported model: ${model}`);
  if (!isObject(input)) throw new Error('Prediction input must be a JSON object');
  const resolved = structuredClone(input);
  for (const [fieldName, fieldSpec] of Object.entries(spec)) {
    if (!(fieldName in resolved)) continue;
    const current = resolved[fieldName];
    if (fieldSpec.multiple) {
      if (!Array.isArray(current)) throw new Error(`Media field ${fieldName} must be an array`);
      resolved[fieldName] = await Promise.all(
        current.map((item) => prepareOne(item, fieldSpec.types)),
      );
    } else {
      resolved[fieldName] = await prepareOne(current, fieldSpec.types);
    }
  }
  if (containsLocalPlaceholder(resolved)) {
    throw new Error('$local_file is only allowed in documented media fields');
  }
  const encoded = JSON.stringify(resolved, null, 0);
  if (Buffer.byteLength(encoded, 'utf8') > MAX_JSON_BYTES) {
    throw new Error('Expanded input JSON exceeds the 4 MiB API request limit; use HTTPS URLs for media');
  }
  return resolved;
}

export async function createPrediction(credentials, model, input, idempotencyKey = nowUuid()) {
  const [owner, modelName] = String(model).split('/', 2);
  if (!owner || !modelName || modelName.includes('/')) {
    throw new Error(`Invalid model name: ${model}`);
  }
  const resolvedInput = await resolveModelInput(model, input);
  const response = await apiJson(
    credentials,
    'POST',
    `/customer/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(modelName)}/predictions`,
    { input: resolvedInput },
    { 'Idempotency-Key': idempotencyKey },
  );
  return response;
}

export async function getPrediction(credentials, taskId) {
  return apiJson(credentials, 'GET', `/customer/v1/predictions/${encodeURIComponent(taskId)}`);
}

export async function cancelPrediction(credentials, taskId) {
  return apiJson(credentials, 'POST', `/customer/v1/predictions/${encodeURIComponent(taskId)}/cancel`);
}

export function predictionStatus(value) {
  return String(value?.status || '').trim().toLowerCase();
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(String(status).trim().toLowerCase());
}

export async function pollPrediction(credentials, taskId, waitSeconds = 0, pollIntervalMs = 2000) {
  if (waitSeconds <= 0) return getPrediction(credentials, taskId);
  const deadline = Date.now() + waitSeconds * 1000;
  let delay = Math.max(250, pollIntervalMs);
  let lastStatus = '';
  while (Date.now() < deadline) {
    const payload = await getPrediction(credentials, taskId);
    const status = predictionStatus(payload);
    if (status !== lastStatus) {
      lastStatus = status;
      process.stderr.write(`Task ${taskId}: ${status || 'pending'}\n`);
    }
    if (isTerminalStatus(status)) return payload;
    const remaining = deadline - Date.now();
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, Math.max(0, remaining))));
    delay = Math.min(Math.floor(delay * 1.5), 10000);
  }
  const err = new Error(`Prediction timed out; resume task ${taskId} with get_prediction`);
  err.taskId = taskId;
  throw err;
}

function outputDirPath(value) {
  const raw = value ? String(value) : '';
  return path.resolve(raw || path.join(process.cwd(), 'output', 'ergouzi-media-mcp'));
}

function sanitizeFileStem(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, '_');
}

function receiptDateStamp(date = new Date()) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function extensionFromType(contentType, sourceUrl) {
  const mediaType = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/flac': '.flac',
  };
  if (map[mediaType]) return map[mediaType];
  let pathname = '';
  try {
    pathname = new URL(sourceUrl, 'https://fixture.local').pathname;
  } catch {
    pathname = String(sourceUrl || '');
  }
  const suffix = path.extname(pathname).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(suffix) ? suffix : '.bin';
}

function replaceAutoExtension(targetFile, extension) {
  const parsed = path.parse(targetFile);
  if (parsed.ext && parsed.ext.toLowerCase() !== '.bin') return targetFile;
  return path.join(parsed.dir, parsed.name + extension);
}

async function fetchRedirectSafe(url, headers = {}, maxRedirects = 5) {
  let currentUrl = url;
  let currentHeaders = { ...headers };
  for (let attempt = 0; attempt <= maxRedirects; attempt += 1) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      headers: currentHeaders,
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect response without Location for ${currentUrl}`);
      const nextUrl = new URL(location, currentUrl).toString();
      const previousOrigin = new URL(currentUrl).origin;
      const nextOrigin = new URL(nextUrl).origin;
      currentUrl = nextUrl;
      currentHeaders = { ...headers };
      if (previousOrigin !== nextOrigin) delete currentHeaders.Authorization;
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects while downloading prediction output');
}

function normalizeOutputs(output) {
  if (typeof output === 'string') return [output];
  if (Array.isArray(output) && output.every((item) => typeof item === 'string')) return output;
  if (isObject(output) && Array.isArray(output.files)) {
    return output.files.filter((item) => typeof item === 'string');
  }
  return [];
}

async function saveOneDownload(credentials, source, targetFile) {
  const absoluteTarget = path.resolve(targetFile);
  const baseUrl = new URL(credentials.baseUrl);
  const resolvedSource = new URL(source, credentials.baseUrl).toString();
  const parsed = new URL(resolvedSource);
  const localBase =
    baseUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname);
  const localOutput = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(localBase && parsed.protocol === 'http:')) {
    throw new Error('Completed prediction output must be an HTTP or HTTPS URL');
  }
  if (localOutput && !localBase) {
    throw new Error('Completed prediction output must not target localhost');
  }
  const headers = { Accept: '*/*', 'User-Agent': 'ergouzi-media-mcp/0.1.0' };
  if (parsed.origin === baseUrl.origin) headers.Authorization = `Bearer ${credentials.apiKey}`;
  const response = await fetchRedirectSafe(parsed.toString(), headers);
  const finalTarget = path.resolve(
    replaceAutoExtension(absoluteTarget, extensionFromType(response.headers.get('content-type') || '', response.url || resolvedSource)),
  );
  if (await fs.stat(finalTarget).catch(() => null)) {
    throw new Error(`Output file already exists: ${finalTarget}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(finalTarget), { recursive: true });
  await fs.writeFile(finalTarget, buffer);
  return {
    source: source,
    url: response.url,
    path: finalTarget,
    contentType: response.headers.get('content-type') || '',
    bytes: buffer.length,
  };
}

export async function downloadPrediction(credentials, taskId, options = {}) {
  const payload = options.payload || (await getPrediction(credentials, taskId));
  const status = predictionStatus(payload);
  const output = normalizeOutputs(payload.output);
  const targetDir = outputDirPath(options.outputDir);
  const explicitPath = options.outputPath ? path.resolve(String(options.outputPath)) : null;
  const files = [];

  if (status === 'succeeded' && output.length > 0) {
    for (let index = 0; index < output.length; index += 1) {
      const source = output[index];
      const tempName =
        explicitPath && output.length === 1
          ? explicitPath
          : path.join(
              targetDir,
              `result-${index + 1}-${sanitizeFileStem(taskId)}${extensionFromType('', source)}`,
            );
      const downloaded = await saveOneDownload(credentials, source, tempName);
      files.push(downloaded.path);
    }
  }

  await fs.mkdir(targetDir, { recursive: true });
  const receiptPath = path.join(
    targetDir,
    'receipts',
    receiptDateStamp(),
    `${sanitizeFileStem(taskId)}.json`,
  );
  await fs.mkdir(path.dirname(receiptPath), { recursive: true });
  const receipt = {
    task_id: taskId,
    model: payload.model || '',
    status,
    files: files.map((item) => path.resolve(item)),
  };
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');

  return {
    task_id: taskId,
    model: payload.model || '',
    status,
    files: files.map((item) => path.resolve(item)),
    receipt: path.resolve(receiptPath),
    output: files.length > 0 ? undefined : payload.output,
  };
}

export function toolDefs() {
  return [
    {
      name: 'list_models',
      description: 'List Ergouzi models visible to the current API key.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'create_prediction',
      description: 'Create one Ergouzi prediction and return the task ID.',
      inputSchema: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model name such as ergouzi/e-image or ergouzi/e-video' },
          input: { type: 'object', description: 'Model input object' },
          idempotency_key: { type: 'string', description: 'Optional idempotency key' },
        },
        required: ['model', 'input'],
        additionalProperties: false,
      },
    },
    {
      name: 'get_prediction',
      description: 'Read one prediction by task ID, optionally waiting for completion.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          wait_seconds: { type: 'number', minimum: 0, default: 0 },
        },
        required: ['task_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'cancel_prediction',
      description: 'Cancel one prediction task.',
      inputSchema: {
        type: 'object',
        properties: { task_id: { type: 'string' } },
        required: ['task_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'download_prediction',
      description: 'Download successful prediction outputs and write a receipt file.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          output_dir: { type: 'string', description: 'Optional output directory' },
          output_path: { type: 'string', description: 'Exact file path for single-output predictions' },
        },
        required: ['task_id'],
        additionalProperties: false,
      },
    },
  ];
}
