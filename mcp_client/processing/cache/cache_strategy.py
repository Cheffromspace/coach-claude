"""Handles cache block reduction strategies."""

import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

class CacheStrategy:
    """Manages cache block reduction strategies."""
    
    @staticmethod
    def remove_cache_control(block: Dict) -> Dict:
        """Remove cache_control from a block while preserving other fields."""
        return {k: v for k, v in block.items() if k != 'cache_control'}
    
    @staticmethod
    def strategy_keep_recent_system(system: List[Dict], tools: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Strategy 1: Keep only two most recent system blocks cached."""
        return (
            [block if i >= len(system)-2 else CacheStrategy.remove_cache_control(block) 
             for i, block in enumerate(system)],
            tools
        )
    
    @staticmethod
    def strategy_minimal_cache(system: List[Dict], tools: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Strategy 2: Keep only one system block and one tool cached."""
        return (
            [block if i == len(system)-1 else CacheStrategy.remove_cache_control(block) 
             for i, block in enumerate(system)],
            [tools[0]] + [CacheStrategy.remove_cache_control(tool) for tool in tools[1:]]
        )
    
    @staticmethod
    def strategy_no_cache(system: List[Dict], tools: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Strategy 3: Remove all cache blocks."""
        return (
            [CacheStrategy.remove_cache_control(block) for block in system],
            [CacheStrategy.remove_cache_control(tool) for tool in tools]
        )
    
    @classmethod
    def get_strategies(cls):
        """Return list of available cache reduction strategies."""
        return [
            cls.strategy_keep_recent_system,
            cls.strategy_minimal_cache,
            cls.strategy_no_cache
        ]
    
    @classmethod
    async def apply_strategies(cls, system: List[Dict], tools: List[Dict], api_call_func) -> Tuple[bool, Dict, List[Dict], List[Dict]]:
        """Apply cache reduction strategies until one succeeds.
        
        Returns:
            Tuple containing:
            - Success flag
            - API response (if successful)
            - Modified system blocks
            - Modified tools
        """
        # Create copies to preserve originals
        system_copy = [block.copy() for block in system]
        tools_copy = [tool.copy() for tool in tools]
        
        for strategy_num, strategy in enumerate(cls.get_strategies(), 1):
            try:
                logger.info(f"Trying cache reduction strategy {strategy_num}")
                
                # Apply strategy
                system_modified, tools_modified = strategy(system_copy, tools_copy)
                
                # Attempt API call with reduced caching
                response = await api_call_func(system_modified, tools_modified)
                
                logger.info(f"Strategy {strategy_num} succeeded")
                return True, response, system_modified, tools_modified
                
            except Exception as e:
                if "maximum of 4 blocks with cache_control" not in str(e):
                    raise
                logger.warning(f"Strategy {strategy_num} failed, trying next")
                continue
                
        return False, None, system_copy, tools_copy
