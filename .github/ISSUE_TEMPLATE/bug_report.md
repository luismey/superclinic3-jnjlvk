---
name: Bug Report
about: Create a detailed bug report to help us improve the platform
title: '[BUG] '
labels: bug
assignees: ''
---

## Bug Description
<!-- Provide a clear and comprehensive description of the bug -->

### Expected Behavior
<!-- Describe what should happen, referencing documentation if applicable -->

### Actual Behavior
<!-- Describe what actually happens -->

### Impact Assessment
- [ ] Users Affected: <!-- Estimate of impacted users -->
- [ ] Business Impact: <!-- Impact on business metrics/operations -->
- [ ] Security Implications: <!-- Any security concerns -->
- [ ] Data Privacy Impact: <!-- Any data privacy concerns -->

### Severity Level
<!-- Select the appropriate severity level -->
- [ ] Critical (System down, data loss, security breach, WhatsApp connection failure)
- [ ] High (Major feature broken, AI malfunction, message delivery issues)
- [ ] Medium (Feature partially broken, performance degradation)
- [ ] Low (Minor issue, UI/UX problems, non-critical bugs)

## System Context
### Component Category
<!-- Select the affected component(s) -->
- [ ] WhatsApp Integration
  - [ ] Message Handling
  - [ ] Media Processing
  - [ ] Connection Management
  - [ ] Business API Integration
  - [ ] Rate Limiting
  - [ ] Queue Management
- [ ] AI Assistant
  - [ ] Conversation Flow
  - [ ] Response Generation
  - [ ] Training System
  - [ ] Model Performance
  - [ ] Context Management
  - [ ] Integration Points
- [ ] Campaign Management
  - [ ] Scheduling System
  - [ ] Message Templates
  - [ ] Rate Limiting
  - [ ] Analytics Tracking
  - [ ] Audience Management
  - [ ] Performance Metrics
- [ ] System Core
  - [ ] Authentication
  - [ ] Database Operations
  - [ ] API Endpoints
  - [ ] Background Jobs
  - [ ] Caching System
  - [ ] Security Controls

### Environment Information
- Environment: <!-- Production/Staging/Development -->
- Component: <!-- Frontend/Backend/WhatsApp Service/AI Service -->
- Feature Area: <!-- Chat/Assistant/Campaign/Analytics -->
- Browser/OS/Device: <!-- If applicable -->
- WhatsApp API Version: <!-- Current version -->
- AI Model Version: <!-- If applicable -->

### System Metrics
- System Load: <!-- CPU, Memory, Network metrics -->
- Recent Deployments: <!-- Any recent changes -->
- Third-party Status: <!-- Status of dependent services -->

## Reproduction Steps
<!-- Provide detailed steps to reproduce the issue -->

### Prerequisites
1. Environment setup: <!-- Required configuration -->
2. Test data requirements: <!-- Sample data needed (PII removed) -->
3. User role/permissions: <!-- Required access levels -->

### Steps to Reproduce
1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->

### Configuration Context
- Rate Limiting Status: <!-- If applicable -->
- Message Queue State: <!-- If relevant -->
- Database State: <!-- Required state -->

<details>
<summary>## Error Information</summary>

### Error Details
```
<!-- Insert error messages, codes, stack traces (sanitized) -->
```

### System State
- Error Messages: <!-- Specific error text -->
- WhatsApp API Errors: <!-- API-specific errors -->
- AI Model Logs: <!-- AI-related logs -->
- System Metrics: <!-- At time of error -->
- Related Logs: <!-- Relevant log entries -->

### Visual Evidence
<!-- Attach screenshots or recordings (ensure no sensitive data) -->

### Performance Data
<!-- Include relevant performance metrics -->
</details>

## Additional Context
### Related Items
- Related Issues: <!-- Link to related issues -->
- Related PRs: <!-- Link to related pull requests -->

### Business Context
- Business Impact: <!-- Specific metric impacts -->
- Customer Feedback: <!-- Any customer reports -->
- Compliance Issues: <!-- Regulatory concerns -->

### Resolution
- Workarounds: <!-- Any temporary solutions -->
- Recovery Steps: <!-- Actions taken -->
- Suggested Fixes: <!-- Potential solutions -->

<!-- 
Checklist before submitting:
- [ ] Removed all sensitive/PII data
- [ ] Included all required system context
- [ ] Provided clear reproduction steps
- [ ] Added relevant logs and screenshots
- [ ] Assessed security implications
- [ ] Evaluated business impact
-->