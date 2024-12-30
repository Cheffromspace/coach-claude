import { BaseServer } from "./core/base-server.js"
import { ServerConfig } from "./core/interfaces.js"
import fs from "fs/promises"

export class ObsidianServer {
  private baseServer: BaseServer

  constructor(private vaultDirectories: string[]) {
    const config: ServerConfig = {
      vaultDirectories,
      pluginDirectory: "plugins",
      pluginConfigs: {}
    }
    this.baseServer = new BaseServer(config)
  }

  async validateAndCreateDirectories() {
    await Promise.all(
      this.vaultDirectories.map(async (dir) => {
        try {
          await fs.mkdir(dir, { recursive: true })
          const stats = await fs.stat(dir)
          if (!stats.isDirectory()) {
            console.error(`Error: ${dir} is not a directory`)
            process.exit(1)
          }
        } catch (error) {
          console.error(`Error creating/accessing directory ${dir}:`, error)
          process.exit(1)
        }
      })
    )
  }

  async run() {
    await this.validateAndCreateDirectories()
    await this.baseServer.start()
    console.error("Allowed directories:", this.vaultDirectories)
  }
}
