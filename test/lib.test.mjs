import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import {
  createPrediction,
  downloadPrediction,
  toolDefs,
} from '../plugins/ergouzi-media-mcp/scripts/lib.mjs';

const credentials = {
  baseUrl: 'http://127.0.0.1:43123',
  apiKey: 'test-key',
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('tool definitions expose the stable MCP surface', () => {
  assert.deepEqual(
    toolDefs().map((tool) => tool.name),
    ['list_models', 'create_prediction', 'get_prediction', 'cancel_prediction', 'download_prediction'],
  );
});

test('createPrediction accepts a model that is not in the local media map', async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: 'task-1', status: 'starting' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await createPrediction(credentials, 'sample/new-model', { prompt: 'a small elephant' });
  assert.equal(result.id, 'task-1');
  assert.match(request.url, /\/customer\/v1\/models\/sample\/new-model\/predictions$/);
  assert.deepEqual(JSON.parse(request.options.body).input, { prompt: 'a small elephant' });
});

test('unknown models still reject undocumented local file placeholders', async () => {
  await assert.rejects(
    createPrediction(credentials, 'sample/new-model', { image: { $local_file: 'C:/missing.png' } }),
    /\$local_file is only allowed in documented media fields/,
  );
});

test('downloadPrediction streams output to a typed file and writes a receipt', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ergouzi-media-mcp-'));
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'image/png', 'content-length': '3' },
  });

  try {
    const result = await downloadPrediction(credentials, 'task-1', {
      outputDir,
      payload: {
        task_id: 'task-1',
        model: 'sample/new-model',
        status: 'succeeded',
        output: 'http://127.0.0.1:43123/result',
      },
    });
    assert.equal(result.files.length, 1);
    assert.match(result.files[0], /\.png$/);
    assert.deepEqual([...await fs.readFile(result.files[0])], [1, 2, 3]);
    const receipt = JSON.parse(await fs.readFile(result.receipt, 'utf8'));
    assert.deepEqual(receipt.files, result.files);
    assert.equal((await fs.readdir(outputDir)).some((item) => item.includes('.part-')), false);
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true });
  }
});

test('downloadPrediction rejects non-success HTTP responses without creating a file', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ergouzi-media-mcp-'));
  globalThis.fetch = async () => new Response('not found', { status: 404 });

  try {
    await assert.rejects(
      downloadPrediction(credentials, 'task-404', {
        outputDir,
        payload: { model: 'sample/new-model', status: 'succeeded', output: 'http://127.0.0.1:43123/missing' },
      }),
      /returned HTTP 404/,
    );
    assert.deepEqual(await fs.readdir(outputDir), []);
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true });
  }
});

test('downloadPrediction validates every redirect before making the next request', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: 'https://169.254.169.254/latest/meta-data/' },
    });
  };

  await assert.rejects(
    downloadPrediction(credentials, 'task-ssrf', {
      payload: { model: 'sample/new-model', status: 'succeeded', output: 'http://127.0.0.1:43123/redirect' },
    }),
    /private or local address/,
  );
  assert.equal(calls, 1);
});
