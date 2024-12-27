"""
Natural Language Processing Package

Handles message context analysis and pattern detection.
"""

from .context_analyzer import (
    analyze_message_context,
    detect_message_type,
    estimate_complexity,
    detect_phase,
    TOOL_KEYWORDS,
    MESSAGE_TYPE_PATTERNS
)

__all__ = [
    'analyze_message_context',
    'detect_message_type',
    'estimate_complexity',
    'detect_phase',
    'TOOL_KEYWORDS',
    'MESSAGE_TYPE_PATTERNS'
]
