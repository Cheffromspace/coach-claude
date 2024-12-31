"""
Scratch Pad Manager Module

Manages dynamic context information by reading/writing directly from the scratch pad file.
"""

import logging
import os
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

class ScratchPadManager:
    """Manages dynamic context information through file operations"""

    def __init__(self, config: dict, exit_stack):
        """Initialize the scratch pad manager"""
        self.file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'scratch-pad.txt')
        self._cached_content: Optional[str] = None
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Ensure the scratch pad file exists"""
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        if not os.path.exists(self.file_path):
            with open(self.file_path, 'w', encoding='utf-8') as f:
                f.write("No context available yet.")

    async def _get_content(self) -> str:
        """Get content from file"""
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                self._cached_content = content
                return content
        except Exception as e:
            logger.error(f"Failed to get scratch pad content: {e}")
            return self._cached_content if self._cached_content else "No context available yet."

    async def _update_content(self, content: str):
        """Update content in file"""
        try:
            with open(self.file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            self._cached_content = content
            logger.debug("Updated scratch pad content")
        except Exception as e:
            logger.error(f"Failed to update scratch pad content: {e}")
            raise

    async def update_content(self, content: str):
        """Update scratch pad content"""
        await self._update_content(content)

    async def append_content(self, new_content: str):
        """Append new content to scratch pad"""
        current_content = await self._get_content()
        if current_content == "No context available yet.":
            current_content = ""
            
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = f"\n[{timestamp}] {new_content}"
        await self._update_content(current_content + entry)

    async def clear_content(self):
        """Clear scratch pad content"""
        await self._update_content("")
        logger.debug("Cleared scratch pad content")

    async def get_content(self) -> str:
        """Get current scratch pad content"""
        return await self._get_content()
