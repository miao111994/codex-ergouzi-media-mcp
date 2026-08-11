# Changelog

## 0.2.1 - 2026-08-11

- 增加 `npm run audit`，在 npm audit endpoint 不可用时回退到 OSV Scanner API。
- 增加 GitHub Dependabot 配置。

## 0.2.0 - 2026-08-11

- 校验每一跳下载重定向，阻止私有、回环和链路本地地址。
- 为输出下载增加 HTTPS 边界、超时、HTTP 状态码和大小限制。
- 使用临时文件流式写入，完成后原子重命名，避免留下半成品或覆盖已有文件。
- 允许服务端新增模型；本地文件转换仍只对已声明媒体字段启用。
- 移除未实现的 MCP Resources 能力声明。
- 补充 Node.js 版本要求、测试、Smoke 校验和 GitHub Actions CI。
