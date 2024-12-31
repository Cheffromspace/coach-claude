"""
Context Analyzer Module

Handles natural language processing for message context analysis and pattern detection.
Uses spaCy and flashtext for efficient text processing.
"""

import logging
import spacy
from typing import Dict, Set
from flashtext import KeywordProcessor

logger = logging.getLogger(__name__)

# Load spaCy model at module level for reuse
try:
    nlp = spacy.load("en_core_web_sm")
    logger.info("Loaded spaCy model successfully")
except OSError:
    logger.warning("spaCy model not found. Run: python -m spacy download en_core_web_sm")
    raise

# Enhanced keyword configurations
TOOL_KEYWORDS = {
    'obsidian': ['note', 'vault', 'template', 'link', 'knowledge base', 'wiki'],
    'browser': ['web', 'search', 'browse', 'url', 'website', 'internet'],
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
        'sentiment': doc.sentiment
    }
    
    # Detect sensitive data handling
    sensitive_processor = KeywordProcessor(case_sensitive=False)
    sensitive_keywords = ['private', 'secret', 'sensitive', 'personal', 'confidential']
    sensitive_processor.add_keywords_from_list(sensitive_keywords)
    context['sensitive_data'] = bool(sensitive_processor.extract_keywords(message))
    
    logger.debug(f"Analyzed context: {context}")
    return context
