#!/usr/bin/env node
import { ObsidianServer } from './server.js'

const parseArgs = (args: string[]): string => {
  const vaultRoot = args.find(arg => arg.startsWith('--vault='))?.split('=')[1] || process.env.VAULT_ROOT
  
  if (!vaultRoot) {
    throw new Error('Vault root must be specified via --vault= argument or VAULT_ROOT environment variable')
  }

  return vaultRoot
}

const main = async () => {
  try {
    const vaultRoot = parseArgs(process.argv.slice(2))
    console.error('Starting Obsidian MCP server')

    const server = new ObsidianServer([vaultRoot])
    await server.run()
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

main()
