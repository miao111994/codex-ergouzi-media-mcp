import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
const required = (value, field, file) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${file}: ${field} must be a non-empty string`);
};

const packageJson = await readJson('package.json');
const pluginJson = await readJson('plugins/ergouzi-media-mcp/.codex-plugin/plugin.json');
const mcpJson = await readJson('plugins/ergouzi-media-mcp/.mcp.json');

required(packageJson.name, 'name', 'package.json');
required(packageJson.version, 'version', 'package.json');
required(pluginJson.name, 'name', 'plugin.json');
required(pluginJson.version, 'version', 'plugin.json');
required(pluginJson.description, 'description', 'plugin.json');
required(pluginJson.author?.name, 'author.name', 'plugin.json');
required(pluginJson.interface?.displayName, 'interface.displayName', 'plugin.json');
required(pluginJson.interface?.shortDescription, 'interface.shortDescription', 'plugin.json');
required(pluginJson.interface?.longDescription, 'interface.longDescription', 'plugin.json');
required(pluginJson.interface?.developerName, 'interface.developerName', 'plugin.json');
required(pluginJson.interface?.category, 'interface.category', 'plugin.json');

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pluginJson.version)) {
  throw new Error(`plugin.json: invalid semver ${pluginJson.version}`);
}
if (pluginJson.name !== 'ergouzi-media-mcp') throw new Error('plugin.json: name must match the plugin directory');
if (pluginJson.mcpServers !== './.mcp.json') throw new Error('plugin.json: mcpServers must point to ./.mcp.json');
if (!mcpJson.mcpServers?.['ergouzi-media-mcp']) throw new Error('.mcp.json: missing ergouzi-media-mcp server');
if (mcpJson.mcpServers['ergouzi-media-mcp'].command !== 'node') throw new Error('.mcp.json: server command must be node');
if (!(await fs.stat(path.join(root, 'plugins/ergouzi-media-mcp/scripts/server.mjs'))).isFile()) {
  throw new Error('Missing MCP server entrypoint');
}

console.log('Plugin validation passed');
