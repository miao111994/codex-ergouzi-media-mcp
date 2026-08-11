import { toolDefs } from '../plugins/ergouzi-media-mcp/scripts/lib.mjs';

const expected = ['list_models', 'create_prediction', 'get_prediction', 'cancel_prediction', 'download_prediction'];
const actual = toolDefs().map((tool) => tool.name);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected MCP tools: ${actual.join(', ')}`);
}
console.log(`MCP smoke check passed: ${actual.join(', ')}`);
