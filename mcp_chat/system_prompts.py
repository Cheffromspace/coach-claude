"""
System Prompts Module

Manages system prompts for the MCP chat system, including templates and dynamic generation.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import json
import os

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

    def _ensure_directories(self):
        """Ensure required directories exist"""
        os.makedirs(self.prompts_dir, exist_ok=True)

    def _load_templates(self):
        """Load prompt templates from disk"""
        template_file = os.path.join(self.prompts_dir, 'templates.json')
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

    def generate_prompt(self, template_name: str, variables: Dict[str, str]) -> Optional[Dict]:
        """Generate a prompt from a template with variables"""
        template = self.get_template(template_name)
        if not template:
            return None

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

    def get_default_prompts(self) -> List[Dict]:
        """Get default system prompts for new sessions"""
        return [
            self.generate_prompt('base', {}),
            self.generate_prompt('privacy', {}),
            self.generate_prompt('capabilities', {})
        ]

# Initialize with default templates
def create_default_templates() -> List[PromptTemplate]:
    """Create default system prompt templates"""
    return [
        PromptTemplate(
            name="base",
            content="""You are an AI assistant focused on helping users achieve their goals efficiently and effectively. 
            Maintain a clear and professional communication style.""",
            description="Base system prompt for all sessions",
            variables=[],
            tags=["core"],
            cache_control=True
        ),
        PromptTemplate(
            name="privacy",
            content="""Prioritize user privacy and data security in all operations. 
            Do not request or store sensitive information. All data should be handled locally.""",
            description="Privacy-focused system prompt",
            variables=[],
            tags=["core", "privacy"],
            cache_control=True
        ),
        PromptTemplate(
            name="capabilities",
            content="""You have access to various tools and capabilities through the MCP system.
            Use these tools effectively to assist users while maintaining security and privacy.""",
            description="Capabilities and tools system prompt",
            variables=[],
            tags=["core", "tools"],
            cache_control=True
        ),
        PromptTemplate(
            name="task",
            content="""Focus on the task: {{task_description}}
            Consider the following context: {{context}}
            Approach: {{approach}}""",
            description="Task-specific system prompt",
            variables=["task_description", "context", "approach"],
            tags=["task"],
            cache_control=False  # Dynamic content should not be cached
        )
    ]

def initialize_prompt_system(prompts_dir: str = 'chat_history/prompts'):
    """Initialize the prompt system with default templates"""
    manager = SystemPromptManager(prompts_dir)
    if not manager.templates:
        for template in create_default_templates():
            manager.add_template(template)
    return manager
