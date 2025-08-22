# MCP Servers Documentation

## Configured MCP Servers

Based on the `.kilocode/mcp.json` configuration file, the following MCP servers are available:

### 1. Filesystem
- **Command**: `npx -y @modelcontextprotocol/server-filesystem e:/`
- **Description**: Provides access to the filesystem starting from the root E:/ directory
- **Capabilities**: 
  - Read/write files
  - Directory operations
  - File metadata retrieval

### 2. SQLite
- **Command**: `uvx mcp-server-sqlite --db-path /prisma`
- **Description**: Provides access to SQLite databases in the /prisma directory
- **Capabilities**:
  - Database queries
  - Schema inspection
  - Data manipulation

### 3. E-Signatures
- **Command**: `uvx mcp-server-esignatures`
- **Environment Variables**: 
 - `ESIGNATURES_SECRET_TOKEN`: "ara1nha1@alessandroaranha"
- **Description**: Service for electronic signatures
- **Capabilities**:
  - Digital signature operations
  - Document signing workflows

## Standard MCP Servers

In addition to the configured local MCP servers, the following standard MCP servers are also available:

### Context7
- **Purpose**: Retrieving up-to-date documentation and code examples for libraries
- **Tools**:
  - `resolve-library-id`: Resolves package names to Context7-compatible library IDs
  - `get-library-docs`: Fetches documentation for libraries

### Sequential Thinking
- **Purpose**: Dynamic and reflective problem-solving through structured thoughts
- **Tools**:
  - `sequentialthinking`: Detailed tool for complex problem analysis

### Puppeteer
- **Purpose**: Browser automation and screenshot capture
- **Tools**:
  - `puppeteer_navigate`: Navigate to URLs
  - `puppeteer_screenshot`: Take screenshots
  - `puppeteer_click`: Click elements
  - `puppeteer_fill`: Fill input fields
  - `puppeteer_evaluate`: Execute JavaScript in browser

## Usage Guidelines

1. **Filesystem MCP**: Best for file operations within the E:/ drive
2. **SQLite MCP**: Ideal for database interactions with Prisma-related data
3. **E-Signatures MCP**: Specialized for digital signature operations
4. **Context7 MCP**: Use for retrieving current documentation and examples
5. **Sequential Thinking MCP**: Apply for complex problem-solving tasks
6. **Puppeteer MCP**: Utilize for web scraping and browser automation tasks

## Security Notes

- The E-Signatures MCP contains a secret token that should be handled securely
- Access to filesystem and database operations should follow the principle of least privilege
- All MCP operations should be logged for audit purposes