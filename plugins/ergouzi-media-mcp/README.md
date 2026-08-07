# Ergouzi Media MCP

这个插件把 Ergouzi 的媒体能力暴露给 Codex，可用于管理图片、视频相关的预测任务。

## 插件职责

- 提供 MCP 工具
- 读取本地凭据
- 把本地图片、视频或音频路径转换为后端可接受的输入
- 下载任务输出到本地

## 入口文件

- `.codex-plugin/plugin.json`：插件清单
- `.mcp.json`：MCP 启动配置
- `scripts/server.mjs`：MCP 服务入口
- `scripts/lib.mjs`：核心业务逻辑

## 可用工具

- `list_models`：列出可用模型
- `create_prediction`：创建预测任务
- `get_prediction`：查询任务状态
- `cancel_prediction`：取消任务
- `download_prediction`：下载任务结果

## 本地配置

请确保存在 Ergouzi 配置文件：

```text
%APPDATA%\ergouzi\credentials.json
```

示例：

```json
{
  "api_key": "YOUR_API_KEY",
  "base_url": "https://ergouzi.life"
}
```

## 启动方式

插件启动时会执行：

```bash
node scripts/server.mjs
```

MCP 服务随后会接收 Codex 的工具调用请求。
