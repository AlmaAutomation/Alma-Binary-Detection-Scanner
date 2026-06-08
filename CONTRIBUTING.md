# Contributing to Alma Scanner

Thank you for your interest in contributing to Alma Scanner! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

## Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/alma-scanner.git
   cd alma-scanner
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Install development dependencies**
   ```bash
   pip install -r backend/requirements.txt
   pip install -r backend/requirements-dev.txt
   cd alma-frontend && npm install
   ```

## Development Workflow

### Backend Development

```bash
# Start backend in development mode
export PYTHONPATH=backend
python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 9002

# Run tests
python -m pytest backend/tests/ -v

# Format code
black backend/

# Lint code
flake8 backend/

# Type checking
mypy backend/
```

### Frontend Development

```bash
cd alma-frontend

# Start dev server
npm start

# Run tests
npm test

# Format code
npm run format

# Lint
npm run lint

# Build production
npm run build
```

## Commit Guidelines

Follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (no logic change)
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Test additions/changes
- `chore`: Dependency, build, CI changes

Examples:
```
feat(demo): add live demo endpoint
fix(scan): resolve race condition in cache
docs(readme): update installation instructions
```

## Pull Request Process

1. **Update documentation**
   - Add docstrings to new functions
   - Update README if user-facing changes
   - Add changelog entry

2. **Test your changes**
   - Write unit tests for new code
   - Ensure all existing tests pass
   - Test manually in both dev and production modes

3. **Code quality**
   - Run formatters and linters
   - Ensure no unrelated changes
   - Keep PRs focused and reasonably sized

4. **Submit PR**
   - Use descriptive title
   - Reference related issues (#123)
   - Describe changes and rationale
   - Include screenshots if UI changes

## File Structure

```
alma-scanner/
├── backend/
│   ├── app/
│   │   ├── api/           # Route handlers
│   │   ├── scanning/      # Scanning engine
│   │   ├── core/          # Evaluation logic
│   │   ├── execution/     # Execution planning
│   │   ├── ml/           # ML models
│   │   ├── storage/      # Data persistence
│   │   └── main.py       # App factory
│   ├── tests/            # Unit tests
│   └── requirements.txt
├── alma-frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── api/         # API clients
│   │   ├── App.js       # Main app
│   │   └── index.js     # Entry point
│   ├── public/
│   ├── package.json
│   └── build/           # Production build
├── ews/                 # Telemetry system
├── core/                # Shared logic
├── data/                # Cache, models, reports
├── tests/               # Integration tests
└── README.md
```

## Naming Conventions

### Python
- Functions/variables: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_leading_underscore`

### JavaScript/React
- Functions/variables: `camelCase`
- Components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case`

## Documentation

All public APIs must include docstrings:

### Python
```python
def scan_folder(path: str, limit: int = 100) -> Dict[str, Any]:
    """
    Scan a folder for binary artifacts.
    
    Args:
        path: Folder path to scan
        limit: Maximum results to return
        
    Returns:
        Dictionary with scan results and metadata
        
    Raises:
        FileNotFoundError: If path doesn't exist
        PermissionError: If no read access
    """
    pass
```

### JavaScript
```javascript
/**
 * Fetch scan results from API
 * @param {string} folder - Folder path to scan
 * @param {number} limit - Max results
 * @returns {Promise<Object>} Scan results
 * @throws {Error} Network or API error
 */
async function scanFolder(folder, limit = 100) {
  // implementation
}
```

## Testing

### Unit Tests

```bash
# Backend
python -m pytest backend/tests/test_scanner.py -v

# Frontend
npm test -- --coverage
```

### Integration Tests

```bash
# Start services
docker-compose up -d

# Run integration tests
python -m pytest tests/integration/ -v
```

### Manual Testing

- Test in dev and production environments
- Test with various input sizes
- Test error scenarios
- Test performance with large datasets

## Performance Considerations

- Cache frequently accessed data
- Use pagination for large result sets
- Optimize database queries
- Minimize API request size
- Use async/await for I/O operations

## Security

- Never commit secrets (API keys, passwords)
- Validate and sanitize user input
- Use parameterized queries
- Keep dependencies updated
- Report security issues privately (security@example.com)

## Release Process

1. Update version in `backend/app/main.py` and `alma-frontend/package.json`
2. Add changelog entry in `CHANGELOG.md`
3. Create git tag: `git tag v0.2.0`
4. Push tag: `git push origin v0.2.0`
5. GitHub Actions will build and publish release

## Questions?

- **Documentation**: Check [README.md](README.md) and [INSTALLATION.md](INSTALLATION.md)
- **API Questions**: See [API_DOCUMENTATION.md](docs/API.md)
- **Issues**: Search [GitHub Issues](https://github.com/yourusername/alma-scanner/issues)
- **Discussions**: Use [GitHub Discussions](https://github.com/yourusername/alma-scanner/discussions)

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md
- GitHub contributors page
- Release notes

Thank you for contributing!
