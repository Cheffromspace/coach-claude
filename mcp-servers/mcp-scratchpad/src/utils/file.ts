import { promises as fs } from 'fs';
import path from 'path';

// Path to the scratch pad content file
const SCRATCH_PAD_FILE = path.join(process.cwd(), 'data', 'scratch-pad.txt');

export class FileManager {
  /**
   * Initialize the file system by ensuring the data directory and file exist
   */
  static async initialize(): Promise<void> {
    const dataDir = path.dirname(SCRATCH_PAD_FILE);
    
    try {
      await fs.mkdir(dataDir, { recursive: true });
      
      try {
        await fs.access(SCRATCH_PAD_FILE);
      } catch {
        // File doesn't exist, create it with empty content
        await fs.writeFile(SCRATCH_PAD_FILE, '');
      }
    } catch (error) {
      throw new Error(`Failed to initialize file system: ${error}`);
    }
  }

  /**
   * Read the current scratch pad content
   */
  static async readContent(): Promise<string> {
    try {
      return await fs.readFile(SCRATCH_PAD_FILE, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read scratch pad content: ${error}`);
    }
  }

  /**
   * Update the scratch pad content
   */
  static async updateContent(content: string): Promise<void> {
    try {
      await fs.writeFile(SCRATCH_PAD_FILE, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to update scratch pad content: ${error}`);
    }
  }
}
