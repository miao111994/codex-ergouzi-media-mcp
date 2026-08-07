# codex-ergouzi-media-mcp
配合 Ergouzi 自研生图视频模型调用的 MCP 服务。

This repository packages the `ergouzi-media-mcp` Codex plugin as a standalone GitHub repo.

## What is included

- `plugins/ergouzi-media-mcp`: the Codex plugin
- `LICENSE`: MIT license

## Install in Codex

Clone this repository, then install the plugin from the local repo path in Codex.
If you are testing locally, point Codex at `plugins/ergouzi-media-mcp`.

### Suggested local setup

```bash
git clone https://github.com/miao111994/codex-ergouzi-media-mcp
cd codex-ergouzi-media-mcp
npm install
```

## Local runtime setup

Install dependencies at the repository root:

```bash
npm install
```

Then configure your Ergouzi credentials in:

```text
C:\Users\<you>\AppData\Roaming\ergouzi\credentials.json
```

Example:

```json
{
  "api_key": "YOUR_API_KEY",
  "base_url": "https://ergouzi.life"
}
```

## Notes

- The plugin manifest uses `author.name` and `author.url`.
- `author.email` is optional and intentionally omitted here.
- The server expects `@modelcontextprotocol/sdk` to be available from the repo root after `npm install`.
