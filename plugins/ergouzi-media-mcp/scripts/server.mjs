import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  apiJson,
  cancelPrediction,
  createPrediction,
  downloadPrediction,
  errorResult,
  jsonResult,
  loadCredentials,
  pollPrediction,
  toolDefs,
} from './lib.mjs';

const SERVER_INFO = {
  name: 'ergouzi-media-mcp',
  version: '0.2.1',
};

const credentialsPromise = loadCredentials();
const server = new Server(SERVER_INFO, {
  capabilities: {
    tools: { listChanged: false },
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefs(),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments || {};
  const credentials = await credentialsPromise;

  try {
    if (toolName === 'list_models') {
      return jsonResult(await apiJson(credentials, 'GET', '/customer/v1/models'));
    }
    if (toolName === 'create_prediction') {
      return jsonResult(await createPrediction(credentials, args.model, args.input, args.idempotency_key));
    }
    if (toolName === 'get_prediction') {
      return jsonResult(await pollPrediction(credentials, args.task_id, Number(args.wait_seconds || 0)));
    }
    if (toolName === 'cancel_prediction') {
      return jsonResult(await cancelPrediction(credentials, args.task_id));
    }
    if (toolName === 'download_prediction') {
      return jsonResult(await downloadPrediction(credentials, args.task_id, {
        outputDir: args.output_dir,
        outputPath: args.output_path,
      }));
    }
    return errorResult(`Unknown tool: ${toolName}`);
  } catch (error) {
    return errorResult(error.message || String(error), {
      status: error.status,
      task_id: error.taskId,
      body: error.body,
    });
  }
});

await server.connect(new StdioServerTransport());
