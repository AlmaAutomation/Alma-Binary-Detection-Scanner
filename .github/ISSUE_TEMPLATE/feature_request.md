name: Feature Request
description: Suggest an idea for improvement
title: "[FEATURE] "
labels: ["enhancement"]

body:
  - type: markdown
    attributes:
      value: |
        Thank you for suggesting a feature! Please describe your feature request below.

  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: Is your feature request related to a problem? Describe the problem.
      placeholder: "When I try to..., I need to..."
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: Describe the solution or feature you'd like to see
      placeholder: "The feature should..."
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternative Solutions
      description: Are there other ways to solve this problem?
      placeholder: "Alternative approaches..."

  - type: textarea
    id: context
    attributes:
      label: Additional Context
      description: Any other context, screenshots, or examples

  - type: checkbox
    id: terms
    attributes:
      label: Code of Conduct
      description: By submitting this issue, you agree to follow our Code of Conduct
      options:
        - label: I agree to follow this project's Code of Conduct
          required: true
