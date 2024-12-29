import { NoteData, Version, VersionChange } from "../types.js";
import path from "path";
import fs from "fs/promises";
import { validatePath, normalizeNotePath } from "../utils.js";

export function getTimestamp(): string {
  return new Date().toISOString();
}

export function addMetadata<T extends NoteData<V>, V = void>(
  data: T,
  previousVersion?: T
): T & { versions: Version[] } {
  const timestamp = getTimestamp();
  const newVersion = previousVersion ? previousVersion.metadata.version + 1 : 1;
  
  // Track changes if this is an update
  const versions: Version[] = [...(data.versions || [])];
  if (previousVersion) {
    const changes = Object.entries(data)
      .filter(([key, value]) => {
        return key !== 'metadata' && key !== 'versions' &&
          JSON.stringify((previousVersion as Record<string, unknown>)[key]) !== 
          JSON.stringify(value);
      })
      .map(([field, current]): VersionChange => ({
        field,
        previous: (previousVersion as Record<string, unknown>)[field],
        current
      }));
      
    if (changes.length > 0) {
      const version: Version = {
        version: newVersion,
        timestamp,
        author: 'system',
        changes,
        message: `Updated ${changes.map(c => c.field).join(', ')}`
      };
      versions.push(version);
    }
  }

  return {
    ...data,
    metadata: {
      ...data.metadata,
      created: data.metadata?.created || timestamp,
      modified: timestamp,
      version: newVersion,
      privacyLevel: data.metadata.privacyLevel,
      tags: data.metadata.tags
    },
    versions
  };
}

export async function createNote(
  vaultRoot: string,
  folder: string,
  title: string,
  content: string,
  options: {
    useDate?: boolean; // Use date instead of full timestamp (for journals)
    additionalPath?: string; // Additional path components
  } = {}
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Construct the filename with timestamp/date prefix
  const prefix = options.useDate ? today : timestamp;
  const sanitizedTitle = title.toLowerCase().replace(/\s+/g, '-');
  const filename = `${prefix}-${sanitizedTitle}.md`;
  
  // Construct the full path
  const pathComponents = [folder];
  if (options.additionalPath) {
    pathComponents.push(options.additionalPath);
  }
  pathComponents.push(filename);
  
  const notePath = pathComponents.join('/');
  const normalizedPath = normalizeNotePath(notePath);
  const fullPath = path.join(vaultRoot, normalizedPath);
  const validPath = await validatePath(fullPath, [vaultRoot]);

  // Write the file
  await fs.writeFile(validPath, content);

  return notePath;
}
