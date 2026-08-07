# codex-ergouzi-media-mcp
配合 Ergouzi 自研生图视频模型调用的 MCP 服务。

This repository packages the `ergouzi-media-mcp` Codex plugin as a standalone GitHub repo.

## What is included

- `plugins/ergouzi-media-mcp`: the Codex plugin
- `.agents/plugins/marketplace.json`: Codex marketplace entry
- `LICENSE`: MIT license

## Install in Codex

```bash
codex plugin marketplace add miao111994/codex-ergouzi-media-mcp
codex plugin add ergouzi-media-mcp@codex-ergouzi-media-mcp
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
