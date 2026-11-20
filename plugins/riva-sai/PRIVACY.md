# Riva Sai plugin for Claude: privacy

Last updated: 20 November 2026

The Riva Sai plugin (skill, commands and the `riva-sai` MCP server) runs entirely on your computer.

- **No data collection.** The MCP server makes no network requests and sends nothing to Riva Sai or
  to anyone else. It reads only the data files that ship with the plugin (the catalog, the API method
  list and the design guides) and writes no files.
- **Designs stay in the link.** A Riva Sai link carries the design after the `#` of the URL (the
  fragment). Browsers do not send the fragment to the web server, so opening a link does not upload
  your design. The Riva Sai web app keeps your designs in your browser's local storage only.
- **What Claude sees.** What you tell Claude about your home, and the designs it makes, are part of
  your conversation with Claude and are handled under your agreement with Anthropic.
- **The website.** rivasai.com is a static site. Like any website, its host may keep standard request
  logs (such as IP address, time and page requested). The app itself uses no analytics, cookies or
  tracking.

Questions: open an issue at https://github.com/samsam32118/rivasai-plugin/issues.
