#!/usr/bin/env node

import path from "path"
import { expandHome, normalizePath } from "./utils.js"
import { ObsidianServer } from "./server.js"

// Command line argument parsing
const args = process.argv.slice(2)
if (args.length === 0) {
  console.error("Usage: mcp-obsidian <vault-directory>")
  process.exit(1)
}

// Store allowed directories in normalized form
const vaultDirectories = [normalizePath(path.resolve(expandHome(args[0])))]

// Create and run the server
const server = new ObsidianServer(vaultDirectories)
server.run().catch((error) => {
  console.error("Fatal error running server:", error)
  process.exit(1)
})
