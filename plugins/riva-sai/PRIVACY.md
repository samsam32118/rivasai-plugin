# Riva Sai plugin for Claude: privacy

Last updated: 20 November 2026

The Riva Sai plugin is a skill, two commands and reference text. It contains no programs.

- **No data collection.** The plugin sends nothing to Riva Sai or to anyone else.
- **Optional local tools.** The separate `riva-sai-tools` plugin runs a small local MCP server. It
  makes no network requests, reads only its own data files (the catalog, the API method list and the
  design guides) and writes no files.
- **Designs stay in the link.** A Riva Sai link carries the design after the `#` of the URL (the
  fragment). Browsers do not send the fragment to the web server, so opening a link does not upload
  your design. The Riva Sai web app keeps your designs in your browser's local storage only.
- **What Claude sees.** What you tell Claude about your home, and the designs it makes, are part of
  your conversation with Claude and are handled under your agreement with Anthropic.
- **The website.** rivasai.com is a static site. Like any website, its host may keep standard request
  logs (such as IP address, time and page requested). The app itself uses no analytics, cookies or
  tracking.

Questions: open an issue at https://github.com/samsam32118/rivasai-plugin/issues.
