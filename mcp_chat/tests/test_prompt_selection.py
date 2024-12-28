"""
Test module for prompt selection functionality
"""

import unittest
from datetime import datetime
import os
import json
from mcp_chat.prompts.prompt_manager import SystemPromptManager, PromptTemplate

class TestPromptSelection(unittest.TestCase):
    """Test cases for prompt selection system"""

    def setUp(self):
        """Set up test environment"""
        self.test_prompts_dir = "chat_history/test_prompts"
        self.prompt_manager = SystemPromptManager(self.test_prompts_dir)

    def tearDown(self):
        """Clean up test environment"""
        if os.path.exists(self.test_prompts_dir):
            for file in os.listdir(self.test_prompts_dir):
                os.remove(os.path.join(self.test_prompts_dir, file))
            os.rmdir(self.test_prompts_dir)

    def test_task_context_prompts(self):
        """Test prompt selection for task context"""
        context = {
            'message_type': 'task',
            'interaction_phase': 'start',
            'sensitive_data': False
        }
        
        prompts = self.prompt_manager.get_prompts_by_context(context)
        
        # Should include personality and capabilities prompts
        self.assertEqual(len(prompts), 3)  # personality + capabilities + session_structure
        
        # Verify prompt types by checking content signatures
        prompt_types = set()
        for prompt in prompts:
            text = prompt["text"].lower()
            if "coach claude" in text and "empathetic" in text:
                prompt_types.add("personality")
            if "current time:" in text and "available tools" in text:
                prompt_types.add("capabilities")
            if "opening check-in" in text and "session close" in text:
                prompt_types.add("session_structure")
        
        self.assertEqual(prompt_types, {"personality", "capabilities", "session_structure"})

    def test_reflection_context_prompts(self):
        """Test prompt selection for reflection context"""
        context = {
            'message_type': 'reflection',
            'interaction_phase': 'middle',
            'sensitive_data': False
        }
        
        prompts = self.prompt_manager.get_prompts_by_context(context)
        
        # Should include personality and memory management prompts
        self.assertEqual(len(prompts), 2)  # personality + memory_management
        
        # Verify prompt types by checking content signatures
        prompt_types = set()
        for prompt in prompts:
            text = prompt["text"].lower()
            if "coach claude" in text and "empathetic" in text:
                prompt_types.add("personality")
            if "maintain continuity" in text and "obsidian notes" in text:
                prompt_types.add("memory_management")
        
        self.assertEqual(prompt_types, {"personality", "memory_management"})

    def test_sensitive_data_prompts(self):
        """Test prompt selection with sensitive data flag"""
        context = {
            'message_type': 'task',
            'interaction_phase': 'middle',
            'sensitive_data': True
        }
        
        prompts = self.prompt_manager.get_prompts_by_context(context)
        
        # Should include privacy prompt
        privacy_included = False
        for prompt in prompts:
            if "privacy" in prompt["text"].lower():
                privacy_included = True
                break
        
        self.assertTrue(privacy_included)

    def test_template_variable_substitution(self):
        """Test template variable substitution"""
        # Create test template with variables
        test_template = PromptTemplate(
            name="test_template",
            content="Time: {{datetime}}, Custom: {{custom_var}}",
            description="Test template",
            variables=["datetime", "custom_var"],
            tags=["test"]
        )
        
        self.prompt_manager.add_template(test_template)
        
        # Generate prompt with variables
        variables = {
            "custom_var": "test_value"
        }
        
        result = self.prompt_manager.generate_prompt("test_template", variables)
        
        # Verify datetime was auto-added and custom variable was substituted
        self.assertIn("Time: ", result["text"])
        self.assertIn("test_value", result["text"])

    def test_cache_control(self):
        """Test cache control settings"""
        # Create test template with cache control
        test_template = PromptTemplate(
            name="cache_test",
            content="Cache controlled content",
            description="Test cache control",
            variables=[],
            tags=["test"],
            cache_control=True
        )
        
        self.prompt_manager.add_template(test_template)
        
        result = self.prompt_manager.generate_prompt("cache_test")
        
        # Verify cache control is included
        self.assertIn("cache_control", result)
        self.assertEqual(result["cache_control"]["type"], "ephemeral")

if __name__ == '__main__':
    unittest.main()
