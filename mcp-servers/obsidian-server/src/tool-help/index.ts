// Tool help documentation with detailed usage guides

export const toolHelp: Record<string, string> = {
  create_journal: `# Create Journal Tool Documentation

Required Fields:
---------------
- title: string
  Journal entry title

- date: string
  Date of the entry (YYYY-MM-DD)

- content: string
  Main content of the journal entry

- metadata:
  * privacyLevel: "public" | "private" | "sensitive"
  * tags: string[] - Array of relevant tags

Optional Fields:
---------------
- type: "reflection" | "health" | "activity" | "misc"
  Type of journal entry (default: "misc")

- mood: number (1-5)
  Mood rating for the day

- energy: number (1-5)
  Energy level rating for the day

- metrics: Array of:
  * name: string - Name of the metric
  * value: number|string - Measured value
  * unit?: string - Optional unit of measurement

- links: Array of:
  * source: string - Source note path
  * target: string - Target note path
  * type: string - Type of link
  * label?: string - Optional link label

Example Usage:
-------------
{
  "title": "Morning Reflection",
  "date": "2024-01-15",
  "type": "reflection",
  "content": "Today started with a productive morning routine...",
  "mood": 4,
  "energy": 3,
  "metrics": [{
    "name": "sleep_hours",
    "value": 7.5,
    "unit": "hours"
  }],
  "metadata": {
    "privacyLevel": "private",
    "tags": ["morning", "reflection"]
  }
}`,

  create_goal: `# Create Goal Tool Documentation

Required Fields:
---------------
- title: string
  Goal title/name

- description: string
  Detailed description of the goal

- type: "outcome" | "process" | "identity"
  The type of goal being created

- metrics: Array of:
  * name: string - Name of the metric
  * target: number|string - Target value
  * unit?: string - Optional unit of measurement
  * current?: number|string - Optional current value

- metadata:
  * priority: "low" | "medium" | "high"
  * tags: string[] - Array of relevant tags
  * privacyLevel: "public" | "private" | "sensitive"

Optional Fields:
---------------
- targetDate?: string
  Target completion date

- progress?: Array of:
  * date: string
  * value: number|string
  * notes?: string

- links?: Array of:
  * source: string
  * target: string
  * type: string
  * label?: string

Example Usage:
-------------
{
  "title": "Learn TypeScript",
  "description": "Master TypeScript for better code quality",
  "type": "outcome",
  "metrics": [{
    "name": "projects_completed",
    "target": 5,
    "unit": "projects"
  }],
  "metadata": {
    "priority": "high",
    "tags": ["programming", "skills"],
    "privacyLevel": "public"
  }
}`,

  create_habit: `# Create Habit Tool Documentation

Required Fields:
---------------
- title: string
  Habit name/title

- description: string
  Detailed description of the habit

- type: "build" | "break"
  Whether building a new habit or breaking an existing one

- cue: string
  The trigger that initiates the habit

- craving: string
  The motivation or desire behind the habit

- response: string
  The actual habit action/behavior

- reward: string
  The benefit or satisfaction gained

- implementation:
  * frequency: "daily" | "weekly" | "custom"
  * timeOfDay?: string - Preferred time (optional)
  * duration?: string - Expected duration (optional)
  * location?: string - Preferred location (optional)

- metadata:
  * difficulty: number (1-5)
  * tags: string[]
  * privacyLevel: "public" | "private" | "sensitive"

Optional Fields:
---------------
- tracking:
  * streaks:
    - current: number
    - longest: number
  * completion_history: Array of:
    - date: string
    - completed: boolean
    - notes?: string

- links: Array of:
  * source: string
  * target: string
  * type: string
  * label?: string

Example Usage:
-------------
{
  "title": "Daily Meditation",
  "description": "Practice mindfulness meditation",
  "type": "build",
  "cue": "After morning coffee",
  "craving": "Mental clarity and reduced stress",
  "response": "10 minutes of guided meditation",
  "reward": "Feeling centered and focused",
  "implementation": {
    "frequency": "daily",
    "timeOfDay": "morning",
    "duration": "10 minutes",
    "location": "bedroom"
  },
  "metadata": {
    "difficulty": 3,
    "tags": ["wellness", "mindfulness"],
    "privacyLevel": "private"
  }
}`,

  create_health_metric: `# Create Health Metric Tool Documentation

Required Fields:
---------------
- title: string
  Title of the health metric entry

- date: string
  Date of measurement (YYYY-MM-DD)

- type: "weight" | "blood_pressure" | "sleep" | "pain" | "medication" | "custom"
  Type of health metric being tracked

- values: Array of:
  * name: string - Name of the measurement
  * value: number|string - Measured value
  * unit?: string - Optional unit of measurement

- metadata:
  * privacyLevel: "public" | "private" | "sensitive"
  * tags: string[] - Array of relevant tags

Optional Fields:
---------------
- note: string
  Additional notes or context about the measurements

- links: Array of:
  * source: string - Source note path
  * target: string - Target note path
  * type: string - Type of link
  * label?: string - Optional link label

Example Usage:
-------------
{
  "title": "Morning Blood Pressure",
  "date": "2024-01-15",
  "type": "blood_pressure",
  "values": [
    {
      "name": "systolic",
      "value": 120,
      "unit": "mmHg"
    },
    {
      "name": "diastolic",
      "value": 80,
      "unit": "mmHg"
    }
  ],
  "note": "Measured after 5 minutes of rest",
  "metadata": {
    "privacyLevel": "private",
    "tags": ["health", "blood-pressure"]
  }
}`,

  search_notes: `# Search Notes Tool Documentation

Required Fields:
---------------
- pattern: string
  Regular expression pattern to search for in notes

Optional Fields:
---------------
- caseSensitive: boolean (default: false)
  Whether to perform case-sensitive matching

- maxMatchesPerFile: number (default: 3)
  Maximum number of matches to return per file

- contextLines: number (default: 2)
  Number of lines of context to include before and after each match

- filePattern: string
  Regular expression to filter files by name/path

Example Usage:
-------------
{
  "pattern": "\\b\\w+ing\\b",
  "caseSensitive": false,
  "maxMatchesPerFile": 5,
  "contextLines": 3,
  "filePattern": "^journal/.*\\.md$"
}

Response Format:
--------------
The tool returns matches in this format:

File: path/to/note.md
  Line 12:
    Previous context line
    Matched line with pattern
    Next context line

---

File: another/note.md
  Line 45:
    More context
    Another match
    Following context`,

  query_notes: `# Query Notes Tool Documentation

Required Fields:
---------------
- query: string
  Dataview-style query to filter and retrieve notes

Optional Fields:
---------------
- filters: object
  * tags: string[] - Filter by tags
  * type: string - Filter by note type
  * dateRange: object
    - start: string - Start date (YYYY-MM-DD)
    - end: string - End date (YYYY-MM-DD)
  * linkType: string - Filter by link type

Query Syntax:
------------
The query syntax follows Dataview conventions:
- FROM "folder" - Search in specific folder
- WHERE condition - Filter by conditions
- SORT field [ASC|DESC] - Sort results
- LIMIT n - Limit number of results

Example Usage:
-------------
{
  "query": "FROM \"journal\" WHERE type=reflection AND date >= 2024-01-01 SORT date DESC",
  "filters": {
    "tags": ["productivity", "health"],
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  }
}

Tag Query Shorthand:
------------------
You can also use #tag syntax in queries:
{
  "query": "#health #exercise"
}

This will be converted to:
FROM "" WHERE contains(tags, "health") or contains(tags, "exercise")`,

  search_by_tags: `# Search By Tags Tool Documentation

Required Fields:
---------------
- tags: string[]
  Array of tags to search for

Optional Fields:
---------------
- operator: "AND" | "OR" (default: "AND")
  Whether to match all tags (AND) or any tag (OR)

- includeChildren: boolean (default: false)
  Whether to include notes tagged with child tags

- caseSensitive: boolean (default: false)
  Whether to perform case-sensitive tag matching

Example Usage:
-------------
{
  "tags": ["health", "exercise"],
  "operator": "AND",
  "includeChildren": true,
  "caseSensitive": false
}`,

  set_tag_hierarchy: `# Set Tag Hierarchy Tool Documentation

Required Fields:
---------------
- tag: string
  The tag to set hierarchy for

Optional Fields:
---------------
- parent: string
  Parent tag to set for this tag

- children: string[]
  Array of child tags for this tag

Example Usage:
-------------
{
  "tag": "exercise",
  "parent": "health",
  "children": ["running", "weightlifting", "yoga"]
}`,

  set_tag_relationship: `# Set Tag Relationship Tool Documentation

Required Fields:
---------------
- tag: string
  The primary tag

- relatedTag: string
  The tag to create a relationship with

- type: "similar" | "opposite" | "broader" | "narrower" | "custom"
  Type of relationship between the tags

Optional Fields:
---------------
- strength: number (1-5)
  Strength of the relationship (1=weak, 5=strong)

Example Usage:
-------------
{
  "tag": "meditation",
  "relatedTag": "mindfulness",
  "type": "similar",
  "strength": 4
}`,

  get_tag_stats: `# Get Tag Statistics Tool Documentation

No required or optional fields - this tool takes an empty object as input.

Response Format:
--------------
Returns tag statistics in this format:
{
  "totalTags": number,
  "usageStatistics": {
    "highUsage": [{ name: string, count: number }],    // > 20 uses
    "mediumUsage": [{ name: string, count: number }],  // 6-20 uses
    "lowUsage": [{ name: string, count: number }],     // 2-5 uses
    "singleUse": [{ name: string, count: number }]     // 1 use
  },
  "allTags": [{ name: string, count: number }]
}

Example Usage:
-------------
{}`,

  discover_vault: `# Discover Vault Tool Documentation

No required or optional fields - this tool takes an empty object as input.

Description:
-----------
Analyzes the vault structure and available fields in notes. This tool helps understand:
- What folders exist in the vault
- What frontmatter fields are used in each folder
- Common patterns and structures

Response Format:
--------------
Returns vault structure in this format:
[
  {
    "folder": "path/to/folder",
    "fields": ["title", "date", "type", ...]  // Fields found in notes
  },
  ...
]

Example Usage:
-------------
{}`,

  read_notes: `# Read Notes Tool Documentation

Required Fields:
---------------
- paths: string[]
  Array of relative paths to notes (must include .md extension)

Example Usage:
-------------
{
  "paths": [
    "journal/2024-01-15-morning-reflection.md",
    "goals/learn-typescript.md"
  ]
}

Response Format:
--------------
Returns an array of note contents, each including:
- Frontmatter (parsed as object)
- Content (main body text)
- File metadata (creation date, modification date)

Notes are returned in the same order as the input paths.`
};
