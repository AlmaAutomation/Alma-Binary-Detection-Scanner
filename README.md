Alma Scanner

*CURRENTLY INTENDED FOR LOCAL USE ONLY*

High-Performance Binary Scanner for Alma Automation

Alma Scanner is a FastAPI-powered backend service designed for
high-speed system scanning, architecture detection, and binary analysis.
It is part of the Alma Automation Ecosystem, providing secure and
intelligent diagnostics for legacy and modern systems.

This repository contains the source code, build scripts, and .deb
packaging configuration for deploying Alma Scanner as a systemd service
on Linux.

Features

-   Fast, parallelized system scanning
-   Architecture recognition powered by python-magic
-   File metadata extraction and classification
-   LRU + persistent caching
-   Optional RBAC and authentication support
-   Systemd service installation via .deb
-   Zero-config local API server via FastAPI
-   Clean, isolated environment using Python venv

Installation (Debian/Ubuntu)

1. Install the Alma Scanner .deb package

    sudo dpkg -i alma-scanner_<version>_all.deb

If dependencies need fixing:

    sudo apt --fix-broken install

Starting the Service

    sudo systemctl start alma-scanner
    systemctl status alma-scanner
    sudo systemctl enable alma-scanner

Accessing the API

Default: http://localhost:8002

Health check:

    curl http://localhost:8002/health

Logs & Debugging

View live logs:

    journalctl -u alma-scanner -f

Manual run:

    sudo /opt/alma-scanner/run.sh

Run through venv:

    cd /opt/alma-scanner
    sudo ./venv/bin/python3 -m alma_scanner

File Locations

-   /opt/alma-scanner/ — Application root
-   /opt/alma-scanner/venv/ — Python virtual environment
-   /opt/alma-scanner/run.sh — Startup script
-   /etc/systemd/system/alma-scanner.service — Systemd service
-   /var/log/alma-scanner/ — Log directory (optional)

Development Setup

Clone:

    git clone https://github.com/YOUR-ORG/alma-scanner.git
    cd alma-scanner

Create venv:

    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    python3 -m alma_scanner

Building the .deb Package

    dpkg-deb --build pkg alma-scanner_<version>_all.deb

Uninstallation

    sudo systemctl stop alma-scanner
    sudo systemctl disable alma-scanner
    sudo apt remove alma-scanner
    sudo rm -rf /opt/alma-scanner

API Documentation

Swagger UI: http://localhost:8002/docs

ReDoc: http://localhost:8002/redoc

Architecture Overview

(ASCII diagram omitted for text export)

Alma Automation

Alma Automation is dedicated to reviving legacy systems, extending their
life, and empowering users with intelligent system tools. Alma Scanner
is one core component of the Alma System Optimization & Diagnostics
Suite (ASOD).

License:
MIT

© 2025 Alma Automation. All rights reserved.
Alma Automation is a project developed and maintained by Possum
