# Modern RAT - Security Requirements Automation Tool

A modern tool for generating and managing security requirements based on OWASP ASVS and SPVS standards. Answer a few questions about your application and get a tailored, role-aware security checklist.

## Features

- **Questionnaire-driven**: Answer 10 questions to get personalized security requirements
- **Deterministic results**: Same answers always produce the same checklist
- **Full traceability**: Every requirement links back to ASVS/SPVS with canonical IDs
- **Multiple exports**: JSON, CSV, and Markdown formats
- **Ticketing integration**: Create tickets in Rally (extensible to Jira, Azure DevOps)
- **Transparency**: See which requirements were excluded and why

## Quick Start

```bash
# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Start development servers
cd ..
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Architecture

```
modern-rat/
├── backend/                 # Fastify API server
│   ├── src/
│   │   ├── data/           # ASVS/SPVS data files + rules
│   │   ├── lib/
│   │   │   ├── rules/      # Declarative rules engine
│   │   │   └── questionnaire/
│   │   ├── routes/         # API endpoints
│   │   └── ticketing/      # Adapter pattern for ticketing
│   └── tests/
└── frontend/               # React + Vite + shadcn/ui
    └── src/
        ├── components/
        ├── hooks/
        ├── lib/
        └── pages/
```

## Key Design Decisions

### Declarative Rules Engine

Rules are defined as JSON predicates, not scattered if/else statements:

```json
{
  "id": "confidential-data-crypto",
  "description": "Include cryptography for confidential data",
  "predicate": {
    "type": "or",
    "conditions": [
      { "type": "attribute", "field": "dataSensitivity", "operator": "equals", "value": "confidential" },
      { "type": "attribute", "field": "dataSensitivity", "operator": "equals", "value": "regulated" }
    ]
  },
  "includes": { "asvs": { "chapters": ["V6"] } }
}
```

### Traceability

Every shortlisted requirement includes:
- `standard`: ASVS | SPVS
- `standardVersion`: e.g., "5.0.0"
- `requirementId`: Canonical ID (e.g., `v5.0.0-1.2.3`)
- `rationale`: Machine-generated explanation

### Adapter Pattern for Ticketing

Ticketing integrations implement a common interface:

```typescript
interface TicketingAdapter {
  name: string;
  createTicket(requirement: ShortlistedRequirement): Promise<TicketReference>;
  linkTicket(requirement: ShortlistedRequirement, ticketId: string): Promise<TicketReference>;
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/questions` | GET | Get questionnaire questions |
| `/api/questionnaire/submit` | POST | Submit answers, get session ID |
| `/api/checklist` | GET | Get shortlisted requirements |
| `/api/checklist/export/:format` | GET | Export as JSON/CSV/Markdown |
| `/api/exclusions` | GET | Get excluded requirements with reasons |
| `/api/ticketing/create` | POST | Create tickets for requirements |

## Standards

- **ASVS 5.0.0**: 345 requirements across 17 chapters
- **SPVS 1.0.0**: 110 requirements across 5 lifecycle stages

## Testing

```bash
cd backend
npm test
```

## License

MIT
