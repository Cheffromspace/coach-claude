# Testing Framework Documentation

This directory contains the test suite for the MCP client project. The testing framework uses pytest with additional plugins for coverage reporting and async support.

## Structure

```
tests/
├── README.md
├── conftest.py              # Global pytest fixtures and configuration
├── utils/
│   └── test_mocks.py       # Mock classes for testing
├── test_server_manager.py   # Tests for server management
├── test_message_processor.py # Tests for message processing
├── test_query_processor.py  # Tests for query processing
└── test_config_manager.py   # Tests for configuration management
```

## Setup

The testing environment requires the following packages (configured in pyproject.toml):
- pytest>=7.4.0
- pytest-cov>=4.1.0 (for coverage reporting)
- pytest-asyncio>=0.21.1 (for async test support)
- pytest-mock>=3.11.1 (for mocking)

Install test dependencies:
```bash
pip install -e ".[test]"
```

## Running Tests

The default test configuration is set in pyproject.toml to run with verbose output and coverage reporting:
```bash
pytest
```

This is equivalent to:
```bash
pytest -v --cov=mcp_client --cov-report=term-missing
```

Run specific test file:
```bash
pytest tests/test_server_manager.py -v
```

Run tests matching a pattern:
```bash
pytest -v -k "server"
```

## Writing Tests

### Test Organization
- Place test files in the root `tests/` directory
- Name test files with `test_` prefix
- Group related test utilities in `tests/utils/`
- Use fixtures from `conftest.py` for common setup

### Async Testing
The project uses strict asyncio mode and function-scoped event loops. For async tests, use the `@pytest.mark.asyncio` decorator:
```python
@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_function()
    assert result == expected_value
```

### Mock Usage
The `test_mocks.py` module provides mock classes for:
- MCP Servers
- Transport layer
- Common test scenarios

Example:
```python
from tests.utils.test_mocks import MockMcpServer

def test_with_mock_server():
    server = MockMcpServer()
    # Test implementation
```

### Coverage
Aim for high test coverage, especially for:
- Error handling paths
- Edge cases
- Configuration validation
- Server lifecycle management
- Message processing logic
- Query processing and transformation
- Async operation flows

## Guidelines

1. Each test function should test one specific behavior
2. Use descriptive test names that indicate what is being tested
3. Include both positive and negative test cases
4. Mock external dependencies appropriately
5. Add comments explaining complex test scenarios
6. Keep tests independent and idempotent
7. Ensure proper async/await usage in async tests
8. Test both success and error paths for async operations
