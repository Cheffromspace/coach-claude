import { z } from "zod";
import { BaseMetadataSchema, LinkSchema, VersionSchema, TagHierarchySchema } from "./plugins/core/schemas.js";

// Metadata and version management types
export type Metadata = z.infer<typeof BaseMetadataSchema>;
export type TagRelationship = z.infer<typeof TagHierarchySchema>['relationships'][number];
export type VersionChange = z.infer<typeof VersionSchema>['changes'][number];
export type Version = z.infer<typeof VersionSchema>;

// Note type interfaces
export interface JournalNote {
  title: string;
  date: string;
  type?: 'reflection' | 'health' | 'activity' | 'misc';
  mood?: number;
  energy?: number;
  metrics?: Array<{name: string; value: string | number; unit?: string}>;
  links?: z.infer<typeof LinkSchema>[];
  content: string;
}

export interface GoalNote {
  title: string;
  description: string;
  type: 'outcome' | 'process' | 'identity';
  status: 'active' | 'completed' | 'abandoned';
  targetDate?: string;
  metrics: Array<{name: string; value: string | number; unit?: string}>;
  progress?: Array<{date: string; value: string | number; notes?: string}>;
  links?: z.infer<typeof LinkSchema>[];
}

export interface HabitNote {
  title: string;
  description: string;
  type: 'build' | 'break';
  cue: string;
  craving: string;
  response: string;
  reward: string;
  implementation: {
    frequency: 'daily' | 'weekly' | 'custom';
    timeOfDay?: string;
    duration?: string;
    location?: string;
  };
}

export interface HealthMetricNote {
  title: string;
  date: string;
  type: 'weight' | 'blood_pressure' | 'sleep' | 'pain' | 'medication' | 'custom';
  values: Array<{name: string; value: string | number; unit?: string}>;
  note?: string;
  links?: z.infer<typeof LinkSchema>[];
}

// Generic type for note data with required fields
export interface NoteData<T = JournalNote | GoalNote | HabitNote | HealthMetricNote> {
  metadata: Metadata;
  versions?: Version[];
}

export interface Section {
  title: string;
  items: string[] | undefined;
  prefix: string;
  suffix?: string;
}

export type ToolResponse = {
  content: Array<{
    type: string;
    text: string;
  }>;
};
