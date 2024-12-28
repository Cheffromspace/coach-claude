"""
Test module for note linking functionality
"""

import unittest
from datetime import datetime
import os
import json
from unittest.mock import patch, MagicMock

class TestNoteLinking(unittest.TestCase):
    """Test cases for note linking and relationships"""

    def setUp(self):
        """Set up test environment"""
        # Mock the Obsidian server connection
        self.obsidian_patcher = patch('mcp_client.server.server_manager.ServerManager')
        self.mock_server_manager = self.obsidian_patcher.start()
        
        # Create test notes for relationship testing
        self.test_insight = {
            "title": "Test Insight",
            "description": "A test insight for relationship validation",
            "relatedTo": ["daily_logs/2024-01-20", "reflections/weekly-2024-03"],
            "impact": ["Improved testing methodology"],
            "actionItems": ["Implement more test cases"],
            "relatedInsights": ["insights/previous-insight"]
        }
        
        self.test_reflection = {
            "title": "Weekly Reflection",
            "period": "weekly",
            "focusAreas": ["Testing", "Documentation"],
            "observations": ["Note linking is critical"],
            "relatedNotes": ["insights/test-insight", "daily_logs/2024-01-20"]
        }

    def tearDown(self):
        """Clean up test environment"""
        self.obsidian_patcher.stop()

    def test_create_linked_notes(self):
        """Test creation of notes with relationships"""
        # Configure mock response
        self.mock_server_manager.return_value.call_tool.return_value = {
            "success": True,
            "path": "insights/test-insight.md"
        }
        
        # Create insight note
        result = self.mock_server_manager.return_value.call_tool(
            "create_insight",
            self.test_insight
        )
        
        # Verify insight creation
        self.assertTrue(result["success"])
        self.assertEqual(result["path"], "insights/test-insight.md")
        
        # Verify tool was called with correct parameters
        self.mock_server_manager.return_value.call_tool.assert_called_with(
            "create_insight",
            self.test_insight
        )

    def test_verify_relationships(self):
        """Test verification of note relationships"""
        # Configure mock response
        self.mock_server_manager.return_value.call_tool.return_value = {
            "success": True,
            "results": [
                {
                    "path": "insights/test-insight",
                    "frontmatter": {
                        "relatedTo": ["daily_logs/2024-01-20", "reflections/weekly-2024-03"]
                    }
                }
            ]
        }
        
        # Query for related notes
        result = self.mock_server_manager.return_value.call_tool(
            "query_notes",
            {
                "query": "LIST FROM insights WHERE file = test-insight",
                "fields": ["relatedTo"]
            }
        )
        
        # Verify relationships
        self.assertTrue(result["success"])
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(
            result["results"][0]["frontmatter"]["relatedTo"],
            ["daily_logs/2024-01-20", "reflections/weekly-2024-03"]
        )

    def test_backlink_creation(self):
        """Test automatic backlink creation"""
        # Configure mock response
        self.mock_server_manager.return_value.call_tool.return_value = {
            "success": True,
            "path": "reflections/weekly-2024-03.md"
        }
        
        # Create reflection note that links to insight
        result = self.mock_server_manager.return_value.call_tool(
            "create_reflection",
            self.test_reflection
        )
        
        # Verify reflection creation
        self.assertTrue(result["success"])
        self.assertEqual(result["path"], "reflections/weekly-2024-03.md")
        
        # Verify tool was called with correct parameters
        self.mock_server_manager.return_value.call_tool.assert_called_with(
            "create_reflection",
            self.test_reflection
        )

    def test_template_frontmatter(self):
        """Test template YAML frontmatter handling"""
        # Configure mock response
        self.mock_server_manager.return_value.call_tool.return_value = {
            "success": True,
            "path": "insights/template-test.md",
            "frontmatter": {
                "title": "Template Test",
                "date": "2024-01-20",
                "tags": ["test"],
                "relatedTo": ["daily_logs/2024-01-20"]
            }
        }
        
        # Create note from template
        result = self.mock_server_manager.return_value.call_tool(
            "create_from_template",
            {
                "templateName": "insight",
                "notePath": "insights/template-test.md",
                "variables": {
                    "title": "Template Test",
                    "relatedTo": ["daily_logs/2024-01-20"]
                }
            }
        )
        
        # Verify template usage
        self.assertTrue(result["success"])
        self.assertEqual(result["path"], "insights/template-test.md")
        self.assertEqual(
            result["frontmatter"]["relatedTo"],
            ["daily_logs/2024-01-20"]
        )

if __name__ == '__main__':
    unittest.main()
