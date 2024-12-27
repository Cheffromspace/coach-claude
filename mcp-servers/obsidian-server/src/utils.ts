import fs from "fs/promises"
import path from "path"
import os from "os"
import yaml from 'js-yaml'

// Normalize all paths consistently
export function normalizePath(p: string): string {
  // Convert to forward slashes and lowercase
  return path.normalize(p).replace(/\\/g, '/').toLowerCase()
}

// Handle relative paths within vault
export function normalizeNotePath(notePath: string): string {
  // Remove leading slashes and normalize
  return notePath.replace(/^[/\\]+/, '').replace(/\\/g, '/')
}

export function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return path.join(os.homedir(), filepath.slice(1))
  }
  return filepath
}

// Security utilities
export async function validatePath(
  requestedPath: string,
  vaultDirectories: string[]
): Promise<string> {
  // Ignore hidden files/directories starting with "."
  const pathParts = requestedPath.split(path.sep)
  if (pathParts.some((part) => part.startsWith("."))) {
    throw new Error("Access denied - hidden files/directories not allowed")
  }

  const expandedPath = expandHome(requestedPath)
  const absolute = path.isAbsolute(expandedPath)
    ? path.resolve(expandedPath)
    : path.resolve(process.cwd(), expandedPath)

  const normalizedRequested = normalizePath(absolute)

  // Check if path is within allowed directories
  const isAllowed = vaultDirectories.some((dir) =>
    normalizedRequested.startsWith(dir)
  )
  if (!isAllowed) {
    throw new Error(
      `Access denied - path outside allowed directories: ${absolute} not in ${vaultDirectories.join(
        ", "
      )}`
    )
  }

  // Create parent directory if it doesn't exist
  const parentDir = path.dirname(absolute)
  await fs.mkdir(parentDir, { recursive: true })

  // Handle symlinks by checking their real path
  try {
    const realPath = await fs.realpath(absolute)
    const normalizedReal = normalizePath(realPath)
    const isRealPathAllowed = vaultDirectories.some((dir) =>
      normalizedReal.startsWith(dir)
    )
    if (!isRealPathAllowed) {
      throw new Error(
        "Access denied - symlink target outside allowed directories"
      )
    }
    return realPath
  } catch (error) {
    // For new files that don't exist yet, return the absolute path
    return absolute
  }
}

// Parse YAML frontmatter from note content
export async function parseFrontmatter(content: string): Promise<Record<string, any>> {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/
  const match = content.match(frontmatterRegex)
  
  if (!match) {
    return {}
  }

  try {
    return yaml.load(match[1]) as Record<string, any>
  } catch (error) {
    console.error('Error parsing frontmatter:', error)
    return {}
  }
}

// Read and parse a note file
export async function readNote(filePath: string): Promise<{
  path: string,
  content: string,
  frontmatter: Record<string, any>
}> {
  const content = await fs.readFile(filePath, 'utf-8')
  const frontmatter = await parseFrontmatter(content)
  return {
    path: filePath,
    content,
    frontmatter
  }
}

// Template utilities
export async function listTemplates(
  vaultRoot: string,
  folder?: string
): Promise<string[]> {
  const templatesPath = path.join(vaultRoot, 'templates', folder || '')
  try {
    await validatePath(templatesPath, [vaultRoot])
    const entries = await fs.readdir(templatesPath, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
      .map(entry => folder ? path.join(folder, entry.name) : entry.name)
  } catch (error) {
    console.error('Error listing templates:', error)
    return []
  }
}

export async function readTemplate(
  vaultRoot: string,
  templateName: string
): Promise<string> {
  const templatePath = path.join(vaultRoot, 'templates', templateName)
  try {
    await validatePath(templatePath, [vaultRoot])
    return await fs.readFile(templatePath, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to read template ${templateName}: ${error}`)
  }
}

export function substituteVariables(
  content: string,
  variables?: Record<string, string>
): string {
  if (!variables) return content
  
  return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    if (trimmedKey === 'date') {
      return new Date().toISOString().split('T')[0]
    }
    return variables[trimmedKey] || match
  })
}

/**
 * Search for notes in the allowed directories that match the query.
 * @param query - The query to search for.
 * @param vaultRoot - The root directory of the vault.
 * @param searchLimit - Maximum number of results to return.
 * @returns An array of relative paths to the notes (from root) that match the query.
 */
export async function searchNotes(
  query: string,
  vaultRoot: string,
  searchLimit: number
): Promise<string[]> {
  const results: string[] = []

  async function search(basePath: string, currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)

      try {
        // Validate each path before processing
        await validatePath(fullPath, [vaultRoot])

        let matches = entry.name.toLowerCase().includes(query.toLowerCase())
        try {
          matches =
            matches ||
            new RegExp(query.replace(/[*]/g, ".*"), "i").test(entry.name)
        } catch {
          // Ignore invalid regex
        }

        if (entry.name.endsWith(".md") && matches) {
          // Turn into relative path
          // Ensure we get a clean relative path
          const relativePath = path.relative(basePath, fullPath)
          results.push(normalizeNotePath(relativePath))
        }

        if (entry.isDirectory()) {
          await search(basePath, fullPath)
        }
      } catch (error) {
        // Skip invalid paths during search
        continue
      }
    }
  }

  await search(vaultRoot, vaultRoot)
  return results.slice(0, searchLimit)
}
