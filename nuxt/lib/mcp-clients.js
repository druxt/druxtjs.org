/**
 * How each AI client connects to the docs server: the page's tabs.
 *
 * @param {string} url - The server's address.
 * @returns {Array<object>} The clients, in the order the page shows them.
 */
export const mcpClients = (url) => {
  const json = (value) => JSON.stringify(value, null, 2)
  // Cursor's install link carries the server's settings, without its name.
  const cursor = btoa(JSON.stringify({ url }))
  return [
    {
      name: 'Claude Code',
      note: 'Run this once.',
      code: `claude mcp add --transport http druxt ${url}`,
    },
    {
      name: 'Cursor',
      note: 'Add it in one click, or put this in .cursor/mcp.json.',
      code: json({ mcpServers: { druxt: { url } } }),
      action: 'Add to Cursor',
      install: `cursor://anysphere.cursor-deeplink/mcp/install?name=druxt&config=${cursor}`,
    },
    {
      name: 'VS Code',
      note: 'Put this in .vscode/mcp.json.',
      code: json({ servers: { druxt: { type: 'http', url } } }),
    },
    {
      name: 'OpenCode',
      note: 'Put this in opencode.json.',
      code: json({ mcp: { druxt: { type: 'remote', url } } }),
    },
  ]
}
