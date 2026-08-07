# Ergouzi Media MCP

This Codex plugin exposes Ergouzi media model lifecycle actions through a local MCP server.

## Tools

- `list_models`
- `create_prediction`
- `get_prediction`
- `cancel_prediction`
- `download_prediction`

## Runtime

The server reads credentials from:

1. `ERGOUZI_MEDIA_API_KEY`
2. `ERGOUZI_API_KEY`
3. `~/.config/ergouzi/credentials.json` on Unix-like systems
4. `%APPDATA%\ergouzi\credentials.json` on Windows

The base URL defaults to `https://ergouzi.life` and can be overridden with:

- `ERGOUZI_MEDIA_BASE_URL`
- `ERGOUZI_BASE_URL`

## Local file handling

Model inputs may include `{ "$local_file": "C:/path/to/file.png" }` for documented media fields.
The server converts the file to a data URI before submission and rejects oversized inputs.

## Notes

- This plugin keeps prompt construction and model choice in the Skill layer.
- The MCP server is transport-only and does not add server-side billing or routing logic.
