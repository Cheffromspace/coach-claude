# Obsidian Template Specification

## Overview
This document outlines the template structure and metadata schema for our three-tier knowledge management system.

## Metadata Schema

### Common Metadata Fields
```yaml
metadata:
  effectiveness: 1-5
  trainingCategory: technique | insight | pattern | strategy
  privacyLevel: public | private | sensitive
  qualityMarkers: 
    - verified
    - needs_review
    - consolidated
    - in_progress
  clusters: []  # Topic clusters this note belongs to
  patterns: []  # Identified patterns
  relationships: []  # Related notes/insights
```

## Template Types

### 1. Daily Log Template
Purpose: Capture daily activities, insights, and progress
```yaml
---
title: "Daily Log YYYY-MM-DD"
type: daily_log
date: YYYY-MM-DD
mood: 1-5
energy: 1-5
focus_areas: []
session_type: checkin | deep_dive | followup
progress_rating: 1-5
metadata:
  effectiveness: 1-5
  trainingCategory: technique | insight | pattern | strategy
  privacyLevel: public | private | sensitive
  qualityMarkers: []
  clusters: []
  patterns: []
  relationships: []
---

## Summary
<!-- Brief overview of the coaching session -->

## Key Topics
<!-- Main points discussed -->

## Progress Updates
<!-- Progress on previous action items -->

## New Insights
<!-- Key realizations or breakthroughs -->

## Action Items
<!-- Tasks and next steps -->

## Follow-up Points
<!-- Areas needing future attention -->

## Notes
<!-- Additional observations -->

## Related Notes
<!-- Links to related notes -->
```

### 2. Insight Template
Purpose: Document specific realizations or breakthroughs
```yaml
---
title: ""
type: insight
date: YYYY-MM-DD
related_to: []
metadata:
  effectiveness: 1-5
  trainingCategory: technique | insight | pattern | strategy
  privacyLevel: public | private | sensitive
  qualityMarkers: []
  clusters: []
  patterns: []
  relationships: []
---

## Description
<!-- Detailed description of the insight -->

## Impact
<!-- Potential impact and implications -->

## Action Items
<!-- Specific actions derived from this insight -->

## Related Insights
<!-- Links to related insights -->

## External Links
<!-- Relevant external resources -->
```

### 3. Reflection Template
Purpose: Periodic review and pattern recognition
```yaml
---
title: ""
type: reflection
date: YYYY-MM-DD
period: daily | weekly | monthly
focus_areas: []
metadata:
  effectiveness: 1-5
  trainingCategory: technique | insight | pattern | strategy
  privacyLevel: public | private | sensitive
  qualityMarkers: []
  clusters: []
  patterns: []
  relationships: []
---

## Key Observations
<!-- Main observations during this period -->

## Patterns Identified
<!-- Recurring themes or patterns -->

## Progress Made
<!-- Areas of progress -->

## Challenges Faced
<!-- Obstacles and difficulties -->

## Next Steps
<!-- Action items and future direction -->

## Related Notes
<!-- Links to related notes -->

## Resources
<!-- Relevant links and resources -->
```

## Future Template Types (To Be Implemented)

### 4. Consolidated Knowledge Template
Purpose: Synthesize patterns and strategies
```yaml
---
title: ""
type: consolidated
date: YYYY-MM-DD
knowledge_type: pattern | strategy | trajectory
metadata:
  effectiveness: 1-5
  trainingCategory: technique | insight | pattern | strategy
  privacyLevel: public | private | sensitive
  qualityMarkers: []
  clusters: []
  patterns: []
  relationships: []
---

## Description
<!-- Detailed description of the pattern/strategy -->

## Evidence
<!-- Supporting notes and observations -->

## Key Insights
<!-- Core understanding gained -->

## Implications
<!-- Impact on coaching approach -->

## Action Items
<!-- Implementation steps -->

## Related Patterns
<!-- Links to related patterns -->
```

### 5. Training Example Template
Purpose: Document specific coaching interactions
```yaml
---
title: ""
type: training_example
date: YYYY-MM-DD
category: pattern_recognition | tool_usage | intervention
metadata:
  effectiveness: 1-5
  trainingCategory: technique | insight | pattern | strategy
  privacyLevel: public | private | sensitive
  qualityMarkers: []
  clusters: []
  patterns: []
  relationships: []
---

## Context
<!-- Situation background -->

## Input
<!-- User's initial state/query -->

## Response
<!-- Coaching approach used -->

## Outcome
<!-- Results and effectiveness -->

## Key Learnings
<!-- Insights for future application -->

## Related Examples
<!-- Links to similar cases -->
```

## Implementation Notes

### Phase 1: Enhance Existing Templates
1. Add metadata section to current templates
2. Update template tools to handle metadata
3. Maintain backward compatibility

### Phase 2: Add New Templates
1. Implement consolidated knowledge template
2. Implement training example template
3. Create corresponding tools

### Phase 3: Template Validation
1. Test metadata handling
2. Verify relationship tracking
3. Validate pattern detection

## Usage Guidelines

1. Metadata Fields
   - Fill in all relevant metadata fields
   - Use consistent terminology
   - Link related notes

2. Content Structure
   - Follow section order
   - Use bullet points for clarity
   - Include specific examples

3. Relationships
   - Link to supporting evidence
   - Connect related insights
   - Track pattern evolution

## Next Steps

1. Review and approve template specifications
2. Update existing templates
3. Create new template files
4. Enhance tool handlers
5. Test implementation
