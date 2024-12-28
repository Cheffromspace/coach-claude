"""Handles cache performance metrics and analysis."""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class CacheMetrics:
    """Manages cache performance metrics and analysis."""
    
    @staticmethod
    def process_metrics(usage) -> Dict:
        """Process and return cache metrics from API usage data."""
        try:
            metrics = {
                'cache_creation_input_tokens': usage.cache_creation_input_tokens,
                'cache_read_input_tokens': usage.cache_read_input_tokens,
                'input_tokens': usage.input_tokens,
                'output_tokens': usage.output_tokens
            }
        except AttributeError:
            logger.info("Cache metrics not available in response")
            metrics = {
                'cache_creation_input_tokens': 0,
                'cache_read_input_tokens': 0,
                'input_tokens': getattr(usage, 'input_tokens', 0),
                'output_tokens': getattr(usage, 'output_tokens', 0)
            }
            
        return metrics
    
    @staticmethod
    def format_metrics_display(metrics: Dict) -> list:
        """Format cache metrics for display."""
        display = [
            "\n[Cache Performance]",
            f"Cache Creation Tokens: {metrics['cache_creation_input_tokens']}",
            f"Cache Read Tokens: {metrics['cache_read_input_tokens']}",
            f"Uncached Input Tokens: {metrics['input_tokens']}",
            f"Output Tokens: {metrics['output_tokens']}"
        ]
        
        # Calculate and add cache hit rate
        total_input = (metrics['cache_creation_input_tokens'] + 
                      metrics['cache_read_input_tokens'] + 
                      metrics['input_tokens'])
        if total_input > 0:
            cache_hit_rate = (metrics['cache_read_input_tokens'] / total_input) * 100
            display.append(f"Cache Hit Rate: {cache_hit_rate:.1f}%")
            logger.info(f"Cache Hit Rate: {cache_hit_rate:.1f}%")
            
        return display

    @staticmethod
    def log_metrics(metrics: Dict):
        """Log cache performance metrics."""
        logger.info("Cache Performance Metrics:")
        logger.info(f"  Cache Creation Tokens: {metrics['cache_creation_input_tokens']}")
        logger.info(f"  Cache Read Tokens: {metrics['cache_read_input_tokens']}")
        logger.info(f"  Uncached Input Tokens: {metrics['input_tokens']}")
        logger.info(f"  Output Tokens: {metrics['output_tokens']}")
