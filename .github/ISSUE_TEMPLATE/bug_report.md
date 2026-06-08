name: Bug Report
description: Report a bug or issue
title: "[BUG] "
labels: ["bug"]

body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug! Please fill out the form below to help us understand the issue.

  - type: textarea
    id: description
    attributes:
      label: Description
      description: A clear and concise description of what the bug is
      placeholder: "Describe the issue..."
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior
      placeholder: |
        1. Run command...
        2. Expected to see...
        3. Instead saw...
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What should happen?
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happens?
    validations:
      required: true

  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: |
        examples:
          - **OS**: Ubuntu 22.04
          - **Python**: 3.11
          - **Node**: 18.0
          - **Docker**: 20.10
      value: |
        - OS: 
        - Python: 
        - Node: 
        - Docker: 
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Relevant Logs
      description: Please paste any relevant logs
      render: shell

  - type: checkbox
    id: terms
    attributes:
      label: Code of Conduct
      description: By submitting this issue, you agree to follow our Code of Conduct
      options:
        - label: I agree to follow this project's Code of Conduct
          required: true
