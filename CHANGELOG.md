# Changelog

All notable changes to Alma Scanner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Live demo endpoint (/demo/run) for showcasing full workflow
- EWS telemetry integration with real-time system monitoring
- React-based web dashboard with interactive UI
- Docker and Docker Compose support
- Comprehensive API documentation
- GitHub Actions CI/CD pipeline
- Systemd service configuration

### Changed
- Restructured backend for better modularity
- Improved caching system performance
- Enhanced compatibility evaluation engine
- Updated frontend to React 19

### Fixed
- Fixed scan result caching issues
- Resolved memory leaks in telemetry collection
- Fixed CORS configuration for cross-origin requests

## [0.2.0] - 2024-06-07

### Added
- Live Demo endpoint: `/demo/run` - Full demonstration workflow
- EWS (Extended Wellness System) telemetry monitoring
- Real-time system metrics (CPU, memory, disk, network, processes)
- React-based interactive dashboard
- Multiple execution strategy recommendations
- Bridge compatibility verdict system
- Forensic scanning mode (recursive, no cache)
- Cache management endpoints
- Metrics tracking (precision, recall, F1 score)

### Changed
- Complete backend refactoring to modular structure
- Improved binary classification accuracy
- Enhanced execution planning algorithm
- Updated UI/UX with Tailwind CSS
- Better error handling and validation
- Optimized database queries

### Fixed
- Memory leak in scan cache
- Incorrect compatibility verdicts for certain binaries
- Frontend CORS issues
- API response timeout issues

### Security
- Added input validation and sanitization
- Implemented CORS protection
- Added security headers
- Request rate limiting

## [0.1.0] - 2024-01-15

### Added
- Initial release
- Binary scanning engine
- File type and architecture detection
- Compatibility evaluation framework
- Execution strategy planning
- Web-based REST API
- SQLite database storage
- Result caching system
- CSV/JSON export capabilities
- Basic metrics computation

### Features
- Scan arbitrary folders for binary artifacts
- Detect ELF binary metadata (arch, bitness, interpreter)
- Evaluate compatibility with multiple strategies
- Generate execution plans
- Cache scan results for performance
- Export results in multiple formats
- Comprehensive API with OpenAPI docs

### Known Limitations
- Linux-only (requires ELF binary support)
- No GPU acceleration
- Single-machine only (no distributed scanning)
- Limited ML model capabilities

## Deprecated

### [0.1.0]
- Legacy binary analysis format (use new Insight format instead)

## Migration Guides

### Upgrading from 0.1.0 to 0.2.0

1. **Database Migration**
   ```bash
   # New schema required, backup old data
   cp almasysdet.db almasysdet.db.backup
   # Schema will be auto-created on first run
   ```

2. **API Endpoint Changes**
   - `/scan/folder` → `/scan/quick` or `/scan/forensic`
   - `/analyze/binary` → `/core/evaluate`

3. **Configuration Updates**
   - Update API_PORT if using custom port
   - Add PYTHONUNBUFFERED=1 for better logging

4. **Frontend Updates**
   - Clear browser cache (localStorage)
   - Rebuild frontend: `npm run build`

## Future Roadmap

### v0.3.0 (Q3 2024)
- Kubernetes support
- Distributed scanning
- Advanced ML models
- Multi-user support
- Audit logging
- RBAC (Role-Based Access Control)

### v0.4.0 (Q4 2024)
- Cloud deployment templates
- Web-based configuration UI
- Real-time collaboration
- Plugin system
- Custom strategy definitions

### v1.0.0 (2025)
- Production-grade stability
- Enterprise features
- Full SLA support
- Commercial plugins
- White-label support

## Contributors

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for a list of all contributors.

## License

MIT License - See [LICENSE](LICENSE) for details.
