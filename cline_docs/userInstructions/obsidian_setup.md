# Obsidian Vault Setup Instructions

## Directory Structure Setup

Please create the following directories in your Obsidian vault (C:/Users/Jonathan/Documents/coach-claude/):

1. `/coaching` - For daily coaching sessions
2. `/insights` - For key realizations and breakthroughs
3. `/reflections` - For periodic reviews
4. `/templates` - Already exists with our templates

## Templates

The following templates have been created with YAML frontmatter for better querying:

1. `templates/daily_log.md` - For coaching sessions
2. `templates/insight.md` - For capturing insights
3. `templates/reflection.md` - For periodic reflections

## Dataview Setup

To enable the queries defined in structure.md:

1. Install the Dataview plugin in Obsidian
   - Open Settings
   - Go to Community Plugins
   - Browse and search for "Dataview"
   - Install and enable the plugin

## Next Steps

After creating the directories:

1. Review structure.md for the complete vault organization
2. Test creating a note using each template
3. Verify that Dataview queries work as expected

## YAML Frontmatter Reference

Each note type uses specific YAML frontmatter fields for structured data:

### Daily Logs
```yaml
title: Daily Log YYYY-MM-DD
date: YYYY-MM-DD
type: daily_log
tags: []
mood: 1|2|3|4|5
energy: 1|2|3|4|5
focus_areas: []
session_type: checkin|deep_dive|followup
progress_rating: 1|2|3|4|5
```

### Insights
```yaml
title: string
date: YYYY-MM-DD
type: insight
related_to: []
tags: []
status: active|completed|archived
impact_level: low|medium|high
```

### Reflections
```yaml
title: string
date: YYYY-MM-DD
type: reflection
period: daily|weekly|monthly
focus_areas: []
tags: []
status: active|archived
progress_rating: 1|2|3|4|5
