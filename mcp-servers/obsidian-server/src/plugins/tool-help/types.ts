import { z } from 'zod';

export interface ToolHelpSection {
  title: string;
  content: string;
}

export interface ToolHelp {
  summary: string;
  description: string;
  examples: string[];
  sections?: ToolHelpSection[];
}

export interface ToolHelpStore {
  [pluginName: string]: {
    [toolName: string]: ToolHelp;
  };
}

export const GetToolHelpSchema = z.object({
  toolName: z.string()
});

export type GetToolHelpArgs = z.infer<typeof GetToolHelpSchema>;
