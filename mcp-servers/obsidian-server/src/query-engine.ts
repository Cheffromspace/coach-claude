import fs from "fs/promises"
import path from "path"
import { readNote, validatePath, normalizeNotePath } from "./utils.js"

// Parse Dataview-style query
export function parseDataviewQuery(query: string): {
  from?: string,
  where?: Record<string, any>,
  sort?: string,
  limit?: number,
  fields?: string[]
} {
  const result: ReturnType<typeof parseDataviewQuery> = {}
  
  // Basic regex patterns
  const fromMatch = query.match(/FROM\s+"([^"]+)"/i)
  const whereMatch = query.match(/WHERE\s+([^\n]+)/i)
  const sortMatch = query.match(/SORT\s+([^\n]+)/i)
  const limitMatch = query.match(/LIMIT\s+(\d+)/i)
  const tableMatch = query.match(/TABLE\s+([^\n]+)/i)
  
  if (fromMatch) {
    result.from = fromMatch[1]
  }
  
  if (whereMatch) {
    const conditions = whereMatch[1].split(/\s+(?:AND|OR)\s+/i)
    result.where = conditions.reduce((acc, condition) => {
      // Handle contains() function
      const containsMatch = condition.match(/contains\((\w+),\s*"([^"]+)"\)/)
      if (containsMatch) {
        const [_, field, value] = containsMatch
        acc[field] = { op: 'contains', value }
        return acc
      }
      
      // Handle standard operators
      const [field, op, value] = condition.split(/\s*(=|!=|>|<|>=|<=)\s*/)
      acc[field.trim()] = { 
        op: op || '=',
        value: value.trim().replace(/^"(.*)"$/, '$1') // Remove quotes
      }
      return acc
    }, {} as Record<string, { op: string, value: any }>)
  }
  
  if (sortMatch) {
    result.sort = sortMatch[1]
  }
  
  if (limitMatch) {
    result.limit = parseInt(limitMatch[1], 10)
  }
  
  if (tableMatch) {
    result.fields = tableMatch[1].split(/,\s*/).map(field => {
      const asMatch = field.match(/(\w+)\s+as\s+["']?([^"',\s]+)["']?/i)
      return asMatch ? asMatch[1] : field.trim()
    })
  }
  
  return result
}

// Format query results
export function formatQueryResults(
  results: Array<{path: string, frontmatter: Record<string, any>}>,
  format: 'table' | 'list',
  fields?: string[]
): string {
  if (format === 'table') {
    // Create table header
    const headers = fields || ['path']
    let table = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`
    
    // Add rows
    results.forEach(result => {
      const row = headers.map(field => {
        const value = field === 'path' ? result.path : result.frontmatter[field]
        return Array.isArray(value) ? value.join(', ') : String(value || '')
      })
      table += `| ${row.join(' | ')} |\n`
    })
    
    return table
  } else {
    // List format
    return results.map(result => {
      const items = fields?.map(field => 
        `${field}: ${result.frontmatter[field] || ''}`
      ) || [`path: ${result.path}`]
      return `- ${items.join(', ')}`
    }).join('\n')
  }
}

// Get all markdown files recursively from a directory
export async function getMarkdownFiles(dir: string, vaultRoot: string): Promise<string[]> {
  const files: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await getMarkdownFiles(fullPath, vaultRoot))
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  
  return files
}

// Execute a query against the vault
export async function executeQuery(
  vaultRoot: string,
  params: {
    from?: string,
    where?: Record<string, any>,
    sort?: string,
    limit?: number,
    fields?: string[],
    format: 'table' | 'list'
  }
): Promise<string> {
  // Start with vault root or specified folder
  const baseDir = params.from
    ? path.join(vaultRoot, normalizeNotePath(params.from))
    : vaultRoot
  
  // Get all markdown files
  const files = await getMarkdownFiles(baseDir, vaultRoot)
  
  // Read and parse all files
  const notes = await Promise.all(
    files.map(async (file) => {
      try {
        const note = await readNote(file)
        return {
          ...note,
          path: path.relative(vaultRoot, file)
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error)
        return null
      }
    })
  )

  // Filter out failed reads and apply where conditions
  let results = notes.filter((note): note is NonNullable<typeof note> => {
    if (!note) return false
    
    if (!params.where) return true
    
    return Object.entries(params.where).every(([field, condition]) => {
      const noteValue = note.frontmatter[field]
      
      switch (condition.op) {
        case 'contains':
          return Array.isArray(noteValue) && noteValue.includes(condition.value)
        case '=':
          return noteValue === condition.value
        case '!=':
          return noteValue !== condition.value
        case '>':
          return noteValue > condition.value
        case '<':
          return noteValue < condition.value
        case '>=':
          return noteValue >= condition.value
        case '<=':
          return noteValue <= condition.value
        default:
          return false
      }
    })
  })

  // Apply sorting
  if (params.sort) {
    const [field, direction] = params.sort.split(/\s+/)
    const order = direction?.toLowerCase() === 'desc' ? -1 : 1
    
    results.sort((a, b) => {
      const aVal = a.frontmatter[field]
      const bVal = b.frontmatter[field]
      return aVal < bVal ? -order : order
    })
  }

  // Apply limit
  if (params.limit) {
    results = results.slice(0, params.limit)
  }

  // Format results
  return formatQueryResults(results, params.format, params.fields)
}
