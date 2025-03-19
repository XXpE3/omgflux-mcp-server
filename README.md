# Omg Flux MCP 

You can verify your Node.js installation by running:

```
node --version  # Should show v18.0.0 or higher
```
## Installation

1. Clone the repository:
```
git clone https://github.com/XXpE3/omgflux-mcp-server.git && cd omgflux-mcp-server
```

2. Install dependencies:
```
npm install
```

3. Build the project:
```
npm run build
```
## Configuration
```json
{
  "mcpServers": {
    "omgflux-mcp": {
      "command": "node",
      "args": ["/path/to/omgflux-mcp-server/build/index.js"],
      "env": {
        "OHMYGPT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```