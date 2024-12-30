import { parse } from 'yaml';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ToolHelp } from '../plugins/tool-help/types.js';
import { z } from 'zod';

// Schema for validating loaded YAML configs
const ToolHelpSectionSchema = z.object({
  title: z.string(),
  content: z.string()
});

const ToolHelpSchema = z.object({
  summary: z.string(),
  description: z.string(),
  examples: z.array(z.string()),
  sections: z.array(ToolHelpSectionSchema).optional()
});

const loadHelpConfigs = (): Record<string, ToolHelp> => {
  const helpStore: Record<string, ToolHelp> = {};
  const configDir = join(__dirname, 'help-configs');

  try {
    const files = readdirSync(configDir);
    
    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      
      const toolName = file.replace('.yaml', '');
      const configPath = join(configDir, file);
      const content = readFileSync(configPath, 'utf-8');
      
      try {
        const config = parse(content);
        
        // Validate the parsed YAML against our schema
        const validatedConfig = ToolHelpSchema.parse(config);
        helpStore[toolName] = validatedConfig;
      } catch (err) {
        if (err instanceof z.ZodError) {
          console.error(`Validation error in ${file}:`, err.errors);
        } else {
          console.error(`Error parsing ${file}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error loading help configs:', err);
  }

  return helpStore;
};

// Export the loaded and validated help configurations
export const toolHelp = loadHelpConfigs();
