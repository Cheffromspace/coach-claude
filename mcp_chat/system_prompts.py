"""
System Prompts Module

Manages system prompts for the MCP chat system, including templates and dynamic generation.
Uses spaCy and flashtext for efficient natural language processing and pattern matching.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Set
import json
import os
import logging
from datetime import datetime
import time
import spacy
from flashtext import KeywordProcessor

logger = logging.getLogger(__name__)

# Load spaCy model at module level for reuse
try:
    nlp = spacy.load("en_core_web_sm")
    logger.info("Loaded spaCy model successfully")
except OSError:
    logger.warning("spaCy model not found. Run: python -m spacy download en_core_web_sm")
    raise

@dataclass
class PromptTemplate:
    """Represents a system prompt template"""
    name: str
    content: str
    description: str
    variables: List[str]
    tags: List[str]
    cache_control: bool = False  # Whether this prompt should be cached

class SystemPromptManager:
    """Manages system prompts and templates"""

    def __init__(self, prompts_dir: str = 'chat_history/prompts'):
        self.prompts_dir = prompts_dir
        self.templates: Dict[str, PromptTemplate] = {}
        self._ensure_directories()
        self._load_templates()
        if not self.templates:
            logger.debug("No templates loaded, initializing defaults")
            for template in create_default_templates():
                self.add_template(template)

    def _ensure_directories(self):
        """Ensure required directories exist"""
        os.makedirs(self.prompts_dir, exist_ok=True)

    def _load_templates(self):
        """Load prompt templates from disk"""
        template_file = os.path.join(self.prompts_dir, 'templates.json')
        logger.debug(f"Loading templates from {template_file}")
        if os.path.exists(template_file):
            with open(template_file, 'r') as f:
                data = json.load(f)
                for template_data in data:
                    template = PromptTemplate(
                        name=template_data['name'],
                        content=template_data['content'],
                        description=template_data['description'],
                        variables=template_data['variables'],
                        tags=template_data['tags']
                    )
                    self.templates[template.name] = template
                    logger.debug(f"Loaded template: {template.name} with tags: {template.tags}")
        else:
            logger.debug("No templates.json found, will create default templates")

    def save_templates(self):
        """Save prompt templates to disk"""
        template_file = os.path.join(self.prompts_dir, 'templates.json')
        data = [
            {
                'name': t.name,
                'content': t.content,
                'description': t.description,
                'variables': t.variables,
                'tags': t.tags
            }
            for t in self.templates.values()
        ]
        with open(template_file, 'w') as f:
            json.dump(data, f, indent=2)

    def add_template(self, template: PromptTemplate):
        """Add a new prompt template"""
        self.templates[template.name] = template
        self.save_templates()

    def get_template(self, name: str) -> Optional[PromptTemplate]:
        """Get a prompt template by name"""
        return self.templates.get(name)

    def list_templates(self, tag: str = None) -> List[PromptTemplate]:
        """List available templates, optionally filtered by tag"""
        if tag:
            return [t for t in self.templates.values() if tag in t.tags]
        return list(self.templates.values())

    def generate_prompt(self, template_name: str, variables: Dict[str, str] = None) -> Optional[Dict]:
        """Generate a prompt from a template with variables"""
        template = self.get_template(template_name)
        if not template:
            return None

        # Initialize variables dict if None
        variables = variables or {}
        
        # Add system datetime if needed
        if 'datetime' in template.variables and 'datetime' not in variables:
            variables['datetime'] = get_system_datetime()

        prompt = template.content
        for var in template.variables:
            if var in variables:
                prompt = prompt.replace(f"{{{{{var}}}}}", variables[var])

        result = {
            "type": "text",
            "text": prompt
        }
        
        if template.cache_control:
            result["cache_control"] = {"type": "ephemeral"}

        return result

    def get_prompts_by_context(self, context: Dict) -> List[Dict]:
        """Get system prompts based on conversation context
        
        Args:
            context: Dictionary containing context information like:
                - message_type: Type of message (e.g., 'task', 'reflection', 'insight')
                - tools_needed: List of tools likely needed
                - interaction_phase: Current phase of interaction
                - previous_context: Previous conversation context
        
        Returns:
            List of relevant system prompts
        """
        logger.debug(f"Getting prompts for context: {json.dumps(context, indent=2)}")
        selected_prompts = []
        
        # Always include core personality prompt
        logger.debug("Attempting to add core personality prompt")
        personality = self.generate_prompt('coach_personality', {})
        if personality:
            logger.debug("Added core personality prompt")
            selected_prompts.append(personality)
        else:
            logger.warning("Failed to generate core personality prompt")

        # Add context-specific prompts
        message_type = context.get('message_type', '')
        logger.debug(f"Processing message type: {message_type}")
        
        # Add capabilities for task messages
        if message_type == 'task':
            logger.debug("Task message type - adding capabilities prompt")
            capabilities = self.generate_prompt('capabilities', {
                'datetime': get_system_datetime()
            })
            if capabilities:
                selected_prompts.append(capabilities)
                logger.debug("Added capabilities prompt")
        
        # Add memory management for reflection or insight messages
        if message_type in ['reflection', 'insight']:
            logger.debug(f"{message_type} message type - adding memory management prompt")
            memory = self.generate_prompt('memory_management', {})
            if memory:
                selected_prompts.append(memory)
                logger.debug("Added memory management prompt")
                
        # Add session structure based on interaction phase
        phase = context.get('interaction_phase', '')
        logger.debug(f"Processing interaction phase: {phase}")
        if phase == 'start':
            logger.debug("Start phase - adding session structure prompt")
            structure = self.generate_prompt('session_structure', {})
            if structure:
                selected_prompts.append(structure)
                logger.debug("Added session structure prompt")
                
        # Add privacy prompt when handling sensitive data
        if context.get('sensitive_data', False):
            logger.debug("Sensitive data detected - adding privacy prompt")
            privacy = self.generate_prompt('privacy', {})
            if privacy:
                selected_prompts.append(privacy)
                logger.debug("Added privacy prompt")
        
        logger.debug(f"Selected {len(selected_prompts)} prompts total")
        return selected_prompts

    def get_default_prompts(self) -> List[Dict]:
        """Get default system prompts for new sessions"""
        return self.get_prompts_by_context({
            'message_type': 'task',
            'interaction_phase': 'start',
            'sensitive_data': True
        })

def get_system_datetime() -> str:
    """Get current date and time in system timezone"""
    current_time = datetime.now()
    timezone = time.tzname[time.daylight if time.daylight and time.localtime().tm_isdst else 0]
    return f"{current_time.strftime('%Y-%m-%d %H:%M:%S')} {timezone}"

# Enhanced keyword configurations
TOOL_KEYWORDS = {
    'obsidian': ['note', 'vault', 'template', 'link', 'knowledge base', 'wiki'],
    'browser': ['web', 'search', 'browse', 'url', 'website', 'internet'],
    'weather': ['weather', 'forecast', 'temperature', 'climate', 'precipitation'],
    'file': ['file', 'directory', 'folder', 'path', 'document', 'storage'],
    'database': ['database', 'query', 'record', 'data', 'store'],
    'api': ['api', 'endpoint', 'request', 'service', 'integration']
}

MESSAGE_TYPE_PATTERNS = {
    'reflection': ['reflect', 'review', 'summarize', 'analyze', 'evaluate', 'assess'],
    'insight': ['insight', 'realize', 'understand', 'pattern', 'discover', 'learn'],
    'planning': ['plan', 'strategy', 'roadmap', 'timeline', 'schedule'],
    'implementation': ['implement', 'code', 'develop', 'build'],
    'task': ['create', 'make', 'add', 'setup', 'help', 'can you', 'please']
}

def detect_message_type(doc: spacy.tokens.Doc) -> str:
    """Determine message type using spaCy doc analysis"""
    # Initialize keyword processor
    keyword_processor = KeywordProcessor(case_sensitive=False)
    for msg_type, patterns in MESSAGE_TYPE_PATTERNS.items():
        keyword_processor.add_keywords_from_list(patterns)
    
    # Get all matches
    matches = set(keyword_processor.extract_keywords(doc.text))
    
    # Count matches for each type
    type_counts = {}
    for msg_type, patterns in MESSAGE_TYPE_PATTERNS.items():
        type_counts[msg_type] = len(matches.intersection(patterns))
    
    # Return most frequent type, or 'task' if no matches
    if type_counts:
        return max(type_counts.items(), key=lambda x: x[1])[0]
    return 'task'

def estimate_complexity(doc: spacy.tokens.Doc) -> str:
    """Estimate message complexity based on linguistic features"""
    # Analyze sentence structure
    avg_tokens_per_sent = len(doc) / len(list(doc.sents))
    named_entities = len(doc.ents)
    unique_pos = len(set(token.pos_ for token in doc))
    
    # Simple scoring system
    complexity_score = (
        (avg_tokens_per_sent / 10) +  # Normalized sentence length
        (named_entities / 5) +        # Entity complexity
        (unique_pos / 10)            # Syntactic complexity
    )
    
    if complexity_score > 3:
        return 'high'
    elif complexity_score > 1.5:
        return 'medium'
    return 'low'

def detect_phase(doc: spacy.tokens.Doc) -> str:
    """Detect interaction phase based on linguistic markers"""
    # Check for temporal markers
    temporal_markers = {
        'start': ['begin', 'start', 'initial', 'first'],
        'middle': ['continue', 'ongoing', 'next'],
        'end': ['finish', 'complete', 'final']
    }
    
    text_lower = doc.text.lower()
    for phase, markers in temporal_markers.items():
        if any(marker in text_lower for marker in markers):
            return phase
            
    return 'start'  # Default to start if no clear markers

def analyze_message_context(message: str) -> Dict:
    """Analyze message to determine context for prompt selection using NLP
    
    Args:
        message: The user's message
        
    Returns:
        Dictionary containing enhanced context information
    """
    # Process message with spaCy
    doc = nlp(message)
    
    # Initialize keyword processor for tools
    tool_processor = KeywordProcessor(case_sensitive=False)
    for tool, keywords in TOOL_KEYWORDS.items():
        tool_processor.add_keywords_from_dict({tool: keywords})
    
    # Build enhanced context
    context = {
        'message_type': detect_message_type(doc),
        'interaction_phase': detect_phase(doc),
        'complexity': estimate_complexity(doc),
        'tools_needed': list(set(tool_processor.extract_keywords(message))),
        'entities': [{'text': ent.text, 'label': ent.label_} for ent in doc.ents],
        'sentiment': doc.sentiment,
        'system_info': {
            'datetime': get_system_datetime()
        }
    }
    
    # Detect sensitive data handling
    sensitive_processor = KeywordProcessor(case_sensitive=False)
    sensitive_keywords = ['private', 'secret', 'sensitive', 'personal', 'confidential']
    sensitive_processor.add_keywords_from_list(sensitive_keywords)
    context['sensitive_data'] = bool(sensitive_processor.extract_keywords(message))
    
    logger.debug(f"Analyzed context: {json.dumps(context, indent=2)}")
    return context

# Initialize with default templates
def create_default_templates() -> List[PromptTemplate]:
    """Create default system prompt templates"""
    return [
        PromptTemplate(
            name="coach_personality",
            content="""You are Coach Claude, an empathetic and insightful personal development coach with a warm yet professional demeanor. Your approach combines:

1. Active Listening: You pay careful attention to both what is said and unsaid, picking up on patterns and underlying themes.
2. Structured Support: While maintaining a natural conversation flow, you guide discussions through clear phases:
   - Understanding the current situation
   - Exploring possibilities and challenges
   - Developing actionable steps
   - Setting clear accountability
3. Memory Integration: You reference past conversations and insights stored in Obsidian notes to build continuity and track progress.
4. Balanced Guidance: You balance being supportive with challenging users to grow, always maintaining a foundation of trust and respect.

Key Traits:
- Empathetic but focused on growth
- Direct but kind in feedback
- Practical in approach while acknowledging emotions
- Consistent in following up on previous discussions
- Professional while maintaining warmth""",
            description="Defines the coach's personality and approach",
            variables=[],
            tags=["core", "personality"],
            cache_control=True
        ),
        PromptTemplate(
            name="session_structure",
            content="""Structure each coaching interaction with:

1. Opening Check-in:
   - Review recent progress and challenges
   - Set focus for current session
   
2. Exploration:
   - Deep dive into current challenges/goals
   - Use active listening and targeted questions
   - Reference relevant past insights
   
3. Action Planning:
   - Develop specific, achievable next steps
   - Address potential obstacles
   - Set clear success metrics
   
4. Session Close:
   - Summarize key points and commitments
   - Create Obsidian note capturing insights
   - Schedule/confirm next check-in""",
            description="Standard coaching session structure",
            variables=[],
            tags=["core", "session"],
            cache_control=True
        ),
        PromptTemplate(
            name="memory_management",
            content="""Maintain continuity and progress through Obsidian notes:

1. After each significant interaction:
   - Create an insight note capturing key realizations
   - Update daily log with session summary
   - Link related notes for context

2. During sessions:
   - Reference relevant past insights
   - Track progress on previous commitments
   - Identify emerging patterns

3. Use templates:
   - Insight template for breakthrough moments
   - Reflection template for periodic reviews
   - Daily logs for continuous tracking""",
            description="Guidelines for managing coaching memory",
            variables=[],
            tags=["core", "memory"],
            cache_control=True
        ),
        PromptTemplate(
            name="privacy",
            content="""Prioritize user privacy and data security in all operations. 
All personal data stays local in Obsidian vault.
Focus on maintaining trust while gathering necessary context.""",
            description="Privacy-focused system prompt",
            variables=[],
            tags=["core", "privacy"],
            cache_control=True
        ),
        PromptTemplate(
            name="capabilities",
            content="""CAPABILITIES
Current Time: {{datetime}}

AVAILABLE TOOLS
1. Obsidian for memory management:
   - Reading and writing notes
   - Using templates
   - Managing knowledge connections
2. Core coaching tools:
   - Session structuring
   - Progress tracking
   - Pattern recognition
Use these capabilities to provide consistent, effective coaching support.""",
            description="Capabilities and tools system prompt",
            variables=['datetime'],
            tags=["core", "tools"],
            cache_control=True
        )
    ]

def initialize_prompt_system(prompts_dir: str = 'chat_history/prompts'):
    """Initialize the prompt system with default templates"""
    logger.debug("Initializing prompt system")
    manager = SystemPromptManager(prompts_dir)
    if not manager.templates:
        logger.debug("Creating default templates")
        for template in create_default_templates():
            logger.debug(f"Adding default template: {template.name}")
            manager.add_template(template)
    else:
        logger.debug(f"Loaded {len(manager.templates)} existing templates")
    return manager
