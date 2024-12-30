# Tool Help Plugin for Obsidian MCP Server

A plugin that provides contextual help and documentation for MCP tools through YAML configuration files.

## Features

- Structured help documentation through YAML configs
- Dynamic help text generation
- Context-aware tool assistance
- Integrated examples and usage patterns
- Support for multiple help formats

## Installation

This plugin is part of the Obsidian MCP server. To use it:

1. Install the Obsidian MCP server
2. The tool-help plugin is included by default
3. Help configurations are automatically loaded from the help-configs directory

## Usage

The plugin manages help documentation for various MCP tools:

- Provides detailed usage instructions
- Shows examples and common patterns
- Explains parameter requirements
- Offers contextual suggestions

## Configuration

Help documentation is configured through YAML files in the help-configs directory:

```yaml
tool_name:
  description: Detailed description of the tool
  parameters:
    - name: parameter_name
      description: Parameter description
      required: true/false
  examples:
    - description: Example description
      usage: Example usage code
```

## Development

To add help for new tools:

1. Create a new YAML file in the help-configs directory
2. Follow the configuration format above
3. The help system will automatically load the new documentation

## License

Copyright (c) 2024 Jonathan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
