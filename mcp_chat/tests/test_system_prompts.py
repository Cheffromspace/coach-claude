"""
Tests for system prompts functionality
"""

import unittest
import tempfile
import shutil
import os
from mcp_chat.system_prompts import SystemPromptManager, analyze_message_context, get_system_datetime

class TestSystemPrompts(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for test prompts
        self.test_dir = tempfile.mkdtemp()
        # Force clean initialization with temporary directory
        self.prompt_manager = SystemPromptManager(self.test_dir)
        # Verify templates are loaded
        print("\nLoaded templates:", list(self.prompt_manager.templates.keys()))
        
    def tearDown(self):
        # Clean up the temporary directory after each test
        shutil.rmtree(self.test_dir)

    def test_message_context_analysis(self):
        # Test task detection
        task_message = "Create a new project for me"
        task_context = analyze_message_context(task_message)
        self.assertEqual(task_context['message_type'], 'task')
        
        # Test reflection detection
        reflection_message = "Let's reflect on yesterday's progress"
        reflection_context = analyze_message_context(reflection_message)
        self.assertEqual(reflection_context['message_type'], 'reflection')
        
        # Test insight detection
        insight_message = "I've realized a pattern in my work habits"
        insight_context = analyze_message_context(insight_message)
        self.assertEqual(insight_context['message_type'], 'insight')
        
        # Test tool detection
        tool_message = "Create a note about this in my Obsidian vault"
        tool_context = analyze_message_context(tool_message)
        self.assertIn('obsidian', tool_context['tools_needed'])
        
        # Test sensitive data detection
        sensitive_message = "Let me share some private thoughts"
        sensitive_context = analyze_message_context(sensitive_message)
        self.assertTrue(sensitive_context['sensitive_data'])

    def test_context_based_prompt_selection(self):
        # Test task context
        task_context = {
            'message_type': 'task',
            'interaction_phase': 'start',
            'sensitive_data': False,
            'tools_needed': []
        }
        task_prompts = self.prompt_manager.get_prompts_by_context(task_context)
        task_prompts_text = [p['text'] for p in task_prompts]
        print("\nTask prompts:", task_prompts_text)
        
        # Verify capabilities prompt is included with correct content
        self.assertTrue(any('AVAILABLE TOOLS' in text for text in task_prompts_text),
                       "Expected 'AVAILABLE TOOLS' in capabilities prompt")
        
        # Test reflection context
        reflection_context = {
            'message_type': 'reflection',
            'interaction_phase': 'start',
            'sensitive_data': False,
            'tools_needed': []
        }
        reflection_prompts = self.prompt_manager.get_prompts_by_context(reflection_context)
        reflection_prompts_text = [p['text'] for p in reflection_prompts]
        self.assertTrue(any('Maintain continuity and progress' in text for text in reflection_prompts_text))
        
        # Test privacy handling
        private_context = {
            'message_type': 'task',
            'interaction_phase': 'start',
            'sensitive_data': True,
            'tools_needed': []
        }
        private_prompts = self.prompt_manager.get_prompts_by_context(private_context)
        private_prompts_text = [p['text'] for p in private_prompts]
        self.assertTrue(any('Prioritize user privacy' in text for text in private_prompts_text))

    def test_prompt_template_variables(self):
        # Test datetime variable substitution
        dt = get_system_datetime()
        print(f"\nUsing datetime: {dt}")
        
        # Generate capabilities prompt with datetime
        capabilities_prompt = self.prompt_manager.generate_prompt('capabilities', {
            'datetime': dt
        })
        
        self.assertIsNotNone(capabilities_prompt)
        print("\nCapabilities prompt:", capabilities_prompt['text'])
        
        # Verify datetime substitution
        self.assertIn('Current Time:', capabilities_prompt['text'],
                     "Expected 'Current Time:' in capabilities prompt")
        self.assertIn(dt, capabilities_prompt['text'],
                     f"Expected datetime '{dt}' to be substituted in prompt")
        
if __name__ == '__main__':
    unittest.main()
