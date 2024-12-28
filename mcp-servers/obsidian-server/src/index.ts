#!/usr/bin/env node
import { ObsidianServer } from './server.js'

interface ServerConfig {
  mode: 'session' | 'consolidation'
  vaultRoot: string
}

const parseArgs = (args: string[]): ServerConfig => {
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'session'
  const vaultRoot = args.find(arg => arg.startsWith('--vault='))?.split('=')[1] || process.env.VAULT_ROOT
  
  if (!vaultRoot) {
    throw new Error('Vault root must be specified via --vault= argument or VAULT_ROOT environment variable')
  }

  if (mode !== 'session' && mode !== 'consolidation') {
    throw new Error('Mode must be either "session" or "consolidation"')
  }

  return { mode, vaultRoot }
}

const main = async () => {
  try {
    const config = parseArgs(process.argv.slice(2))
    console.error(`Starting Obsidian MCP server in ${config.mode} mode`)

    const server = new ObsidianServer([config.vaultRoot], config.mode)
    await server.run()
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

main()
