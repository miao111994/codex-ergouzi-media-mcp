# codex-ergouzi-media-mcp

这是一个把 `ergouzi-media-mcp` 封装成独立 GitHub 仓库的 Codex 插件项目。

它的目标是：让你可以在本地安装、调试和分享这个 MCP 服务，而不依赖额外的发布平台流程。

## 项目内容

- `plugins/ergouzi-media-mcp/`：实际可被 Codex 识别的插件目录
- `LICENSE`：开源协议
- `package.json` / `package-lock.json`：仓库级依赖入口

## 目录结构

```text
codex-ergouzi-media-mcp/
├─ plugins/
│  └─ ergouzi-media-mcp/
│     ├─ .codex-plugin/plugin.json
│     ├─ .mcp.json
│     ├─ README.md
│     └─ scripts/
│        ├─ server.mjs
│        └─ lib.mjs
├─ package.json
├─ package-lock.json
├─ README.md
└─ LICENSE
```

## 安装

先把仓库拉到本地，再安装依赖：

```bash
git clone https://github.com/miao111994/codex-ergouzi-media-mcp
cd codex-ergouzi-media-mcp
npm install
```

## Ergouzi 配置

MCP 服务会从以下位置读取凭据：

- Windows：`%APPDATA%\ergouzi\credentials.json`
- macOS / Linux：`~/.config/ergouzi/credentials.json`

示例内容：

```json
{
  "api_key": "YOUR_API_KEY",
  "base_url": "https://ergouzi.life"
}
```

也可以使用环境变量覆盖：

- `ERGOUZI_MEDIA_API_KEY`
- `ERGOUZI_MEDIA_BASE_URL`
- `ERGOUZI_CONFIG_FILE`

## 在 Codex 中使用

把 Codex 指向插件目录：

```text
plugins/ergouzi-media-mcp
```

插件会通过 `.mcp.json` 启动 `scripts/server.mjs`，再由 `server.mjs` 调用 `lib.mjs` 里的实际逻辑。

## 运行时工具

插件当前提供这些 MCP 工具：

- `list_models`
- `create_prediction`
- `get_prediction`
- `cancel_prediction`
- `download_prediction`

## 说明

- `author.name` 用于标识发布者。
- `author.email` 可选，不写也可以。
- `author.url` 建议保留，便于确认仓库来源。
