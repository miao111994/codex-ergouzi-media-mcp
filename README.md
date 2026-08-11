# codex-ergouzi-media-mcp

一个将 Ergouzi 媒体任务封装为 Codex 插件的本地 MCP 适配器。仓库本身是普通 GitHub 项目，不依赖 Codex marketplace。

## 功能

- 查询 API Key 可见的模型列表
- 创建、查询和取消图片/视频预测任务
- 下载任务输出并自动识别 JPEG、PNG、WebP、MP4 等文件后缀
- 支持本地媒体文件转换为 data URI
- 下载结果使用流式写入、大小限制和临时文件原子落盘

## 目录结构

```text
codex-ergouzi-media-mcp/
├─ plugins/ergouzi-media-mcp/
│  ├─ .codex-plugin/plugin.json  # Codex 插件清单
│  ├─ .mcp.json                  # MCP 启动配置
│  ├─ README.md                 # 插件说明
│  └─ scripts/
│     ├─ server.mjs             # MCP 协议入口
│     └─ lib.mjs                # API、媒体、任务和下载逻辑
├─ scripts/validate.mjs          # 清单和入口校验
├─ scripts/smoke.mjs             # 工具注册 Smoke 校验
├─ test/lib.test.mjs             # 本地契约测试
├─ .github/workflows/ci.yml      # GitHub Actions
├─ package.json
├─ package-lock.json
└─ CHANGELOG.md
```

## 环境要求

- Node.js `20.0.0` 或更高版本
- 一个可用的 Ergouzi API Key
- Codex Desktop 或其他支持 stdio MCP 的客户端

## 安装

```bash
git clone https://github.com/miao111994/codex-ergouzi-media-mcp.git
cd codex-ergouzi-media-mcp
npm ci
```

在 Windows PowerShell 中也可以使用同样的命令。

## 配置凭据

Windows 默认读取：

```text
C:\Users\<你的用户名>\AppData\Roaming\ergouzi\credentials.json
```

macOS / Linux 默认读取：

```text
~/.config/ergouzi/credentials.json
```

文件内容示例：

```json
{
  "api_key": "YOUR_API_KEY",
  "base_url": "https://ergouzi.life"
}
```

也可以用环境变量覆盖：

- `ERGOUZI_MEDIA_API_KEY`
- `ERGOUZI_MEDIA_BASE_URL`
- `ERGOUZI_CONFIG_FILE`

## 在 Codex 中安装

完成 `npm ci` 和凭据配置后，在 Codex 的插件管理界面添加本地插件目录：

```text
<仓库目录>/plugins/ergouzi-media-mcp
```

Codex 会读取 `.codex-plugin/plugin.json`，再根据 `.mcp.json` 执行：

```bash
node scripts/server.mjs
```

不需要把仓库根目录当作 MCP 入口，也不需要创建 marketplace 文件。

## 调用工具

插件提供以下 MCP 工具：

- `list_models`
- `create_prediction`
- `get_prediction`
- `cancel_prediction`
- `download_prediction`

在 Codex 中可以直接使用自然语言调用，例如：

```text
调用 ergouzi-media-mcp 的 list_models，列出可用模型。
```

```text
使用 ergouzi/e-image 创建一张雨夜街道图片，完成后下载到 F:\生图MCP制作\outputs。
```

默认下载目录为：

```text
<当前工作目录>/outputs/ergouzi-media-mcp
```

回执会写入该目录下的 `receipts/YYYY-MM-DD/` 子目录。

## 模型和本地文件行为

`list_models` 以服务端返回为准。创建任务不再依赖本地硬编码模型名单，因此服务端新增普通 JSON 模型时无需同步发布插件。

本地文件输入使用以下形式，并且只允许出现在插件已声明的媒体字段中：

```json
{
  "$local_file": "C:/path/to/file.png"
}
```

未知模型可以使用普通 JSON 或 HTTPS 媒体 URL，但未知媒体字段中的 `$local_file` 会被拒绝。

## 本地验证

```bash
npm run validate
npm test
npm run smoke
```

测试不会调用真实 API，下载测试使用本地模拟响应。

## 发布版本

当前版本为 `0.2.0`。版本变更记录见 `CHANGELOG.md`。
