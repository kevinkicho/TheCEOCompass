# CEO Compass

> Navigate every leadership decision with 57 frameworks, interactive scenarios, and AI-powered coaching.

**CEO Compass** is a full-stack web application that helps leaders master the frameworks of world-class CEOs. It combines an encyclopedia of decision-making tools with an interactive scenario simulator, quiz engine, and personal decision journal.

Built by DeepSeek V4 Pro AI model via OpenCode Go AI provider.

---

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) + TypeScript + Tailwind CSS | React SPA with server-side rendering |
| **Backend** | FastAPI (Python 3.12) + SQLAlchemy (async) | REST API with Pydantic validation |
| **Database** | SQLite (async via aiosqlite) / PostgreSQL (via asyncpg) | Persistent storage for all app data |
| **Testing** | Vitest + Playwright (frontend), pytest (backend) | Unit, integration, and E2E tests |
| **Infrastructure** | Docker + Docker Compose + GitHub Actions CI | Containerized deployment and CI/CD |

---

## Quick Start

```bash
# Backend (port 50128)
cd ceo-platform
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=backend DATABASE_URL=sqlite+aiosqlite:///./ceo_platform.db \
  python backend/seed/seed_db.py
PYTHONPATH=backend DATABASE_URL=sqlite+aiosqlite:///./ceo_platform.db \
  uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 50128

# Frontend (port 33221)
cd frontend
npm install
npm run dev
# → http://localhost:33221
```

---

## Frontend Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing | Hero, stats (frameworks/domains/scenarios), domain filter pills, framework grid |
| `/frameworks` | Framework Browser | Browse all 57 frameworks with category filter |
| `/frameworks/[slug]` | Framework Detail | Interactive concept cards with modal popups showing definitions + 3 real-world examples |
| `/scenarios` | Scenario Browser | Browse 6 interactive practice scenarios |
| `/scenarios/[slug]` | Scenario Engine | Multi-stage branching decision simulator with hints/model answers and AI feedback |
| `/quiz` | Quiz Generator | Select a framework, answer 5 AI-generated multiple-choice questions with answer explanation |
| `/journal` | Decision Journal | Log decisions, record outcomes, calibrate confidence over time |
| `/pathway` | Learning Pathway | 7-step structured curriculum with progress tracking |
| `/profile` | Progress Dashboard | Stats, calibration charts, framework mastery bars |
| `/cheatsheet` | Quick Reference | All concepts with one-liner definitions and filterable by domain |

---

## Backend API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/frameworks` | List all frameworks |
| `GET` | `/api/frameworks/slug/{slug}` | Get framework detail by slug |
| `GET` | `/api/frameworks/{id}` | Get framework detail by UUID |
| `GET` | `/api/scenarios` | List all scenarios |
| `GET` | `/api/scenarios/slug/{slug}` | Get scenario detail by slug |
| `GET` | `/api/scenarios/{id}` | Get scenario detail by UUID |
| `POST` | `/api/scenarios/{id}/start` | Start a scenario run |
| `POST` | `/api/scenarios/{id}/evaluate` | Submit choice and get feedback |
| `POST` | `/api/quiz/generate` | Generate quiz questions for a framework |
| `POST` | `/api/quiz/evaluate` | Evaluate quiz answers |
| `POST` | `/api/journal` | Create decision journal entry |
| `GET` | `/api/journal` | List all journal entries |
| `GET` | `/api/journal/{id}` | Get journal entry detail |
| `PATCH` | `/api/journal/{id}` | Update journal entry |
| `POST` | `/api/journal/{id}/outcome` | Record outcome for a decision |
| `GET` | `/api/progress` | Get user progress (scenarios, streaks, mastery) |
| `GET` | `/api/progress/calibration` | Get calibration summary |
| `GET` | `/api/search?q=` | Full-text search across frameworks |

---

## Domain & Framework Inventory (57 Frameworks)

### Decision-Making (7)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Strategic Decision-Making | 6 | First Principles, Inversion, OODA Loop, Pre-Mortem, Probabilistic Thinking, Second-Order Thinking |
| Cognitive Biases & Debiasing | 8 | Confirmation Bias, Anchoring, Overconfidence, Availability, Survivorship, Sunk Cost, Framing, Hindsight |
| Multi-Criteria Decision Analysis | 6 | Weighted Scoring Matrix, AHP, Trade-Off Curves, Sensitivity at Decision Points, Non-Compensatory Rules |
| Decision Quality Framework | 6 | Appropriate Frame, Creative Alternatives, Sound Reasoning, Commitment to Action, Meaningful Information, Clear Values & Trade-offs |
| Intuition vs Analysis | 6 | Klein's RPD Model, When Intuition Works/Fails, Deliberation-Without-Attention Effect, Calibrating Expert Judgment |
| Decision Speed & Velocity | 6 | Type 1 vs Type 2 Decisions (Bezos), 70% Rule (Bezos), Disagree and Commit, Decision Fatigue, Batching & Cadence, Escalation Paths |
| Red Teaming & Wargaming | 5 | Red Team Structure, Competitor Simulation, Pre-Mortem vs War Game, After-Action Review |

### Analysis (9)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Cause Analysis Methods | 7 | 5 Whys, Fishbone/Ishikawa, Causal Loop Diagrams, Root Cause Analysis, Fault Tree Analysis, Just Culture, Causal Inference |
| Decision Tree Analysis | 6 | Expected Value Calculation, Decision vs Chance Nodes, Value of Information, Real Options, Bayesian Updating, Sensitivity at Decision Nodes |
| Sensitivity Analysis | 6 | Tornado Charts, Break-Even Analysis, Scenario Testing, Assumption Auditing, Spider Charts, One-Way vs Two-Way Sensitivity |
| Stakeholder Analysis & Mapping | 6 | Power/Interest Grid, Stakeholder Salience, RACI Mapping, Influence Networks, Communication Planning, Coalition Building |
| Cohort Analysis | 6 | Retention Cohorts, Revenue Cohorts, Cohort vs Aggregate Metrics, Leading Churn Indicators, Cohort Definition, Cohort Lifecycle Patterns |
| Monte Carlo Simulation | 5 | Distribution Thinking, Confidence Intervals (P10/P50/P90), Value at Risk (VaR) & CVaR, Correlated Assumptions, Convergence Testing |
| Value Driver Tree Analysis | 6 | DuPont-Style Driver Trees, Leading vs Lagging Indicators, Operational Levers, KPI Design, Top-Down Decomposition, Cost Driver Trees |
| A/B Testing & Experiments | 6 | Randomized Controlled Trials, Sample Size & Power, Practical vs Statistical Significance, A/A Testing, Confidence Intervals, The Peeking Problem |
| Force Field Analysis | 5 | Driving vs Restraining Forces, Force Scoring, Force Reduction Strategy, Equilibrium Analysis, Change Management Integration |

### Financial (6)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Financial Mastery | 8 | EBITDA, Free Cash Flow, ROIC, DuPont Analysis, DCF Valuation, LBO Modeling, Unit Economics, Cap Table |
| Capital Allocation Framework | 4 | Capital Allocation Hierarchy, ROIC vs WACC Test, Share Buyback Math, Dividend Policy |
| Working Capital Management | 4 | Cash Conversion Cycle, Days Sales Outstanding, Negative Working Capital, Working Capital Optimization |
| Fundraising & Capital Structure | 4 | Debt vs Equity Decision, Liquidation Preferences, Dilution Waterfall, Venture Debt |
| M&A Financial Modeling | 4 | Accretion/Dilution Analysis, Synergy Quantification, Goodwill & Intangibles, Earnout Modeling |
| Investor Relations & Earnings | 4 | Earnings Call Strategy, Guidance Philosophy, Shareholder Letter Writing, Activist Investor Defense |

### Engineering (7)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Engineering & Product Leadership | 8 | DORA Metrics, RICE Prioritization, Tech Debt Quadrant, Build vs Buy, Kano Model, SPACE Framework, Tech Debt Management |
| Systems Architecture & Design | 5 | Monolith vs Microservices, Conway's Law, Coupling & Cohesion, Evolutionary Architecture, Strangler Fig Pattern |
| SRE for CEOs | 4 | SLI/SLO/SLA Hierarchy, Error Budgets, Blameless Postmortems, Chaos Engineering |
| Technical Diligence | 4 | Code Quality Assessment, Engineering Team Assessment, Tech Debt Audit, Scalability Assessment |
| Data Strategy & Analytics | 4 | Data Warehouse vs Lake vs Mesh, Metrics Layer, Data Quality & Observability, GDPR/CCPA Compliance |
| AI/ML Engineering & MLOps | 4 | ML Model Lifecycle, Feature Stores & Training Pipelines, LLM/Foundation Model Strategy, AI Governance & Responsible AI |
| Security & Compliance Engineering | 4 | Shift-Left Security/DevSecOps, Zero Trust Architecture, Threat Modeling (STRIDE), SOC2/ISO 27001 |

### Organisational (4)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Organizational & People | 8 | Span of Control, Nine-Box Grid, Psychological Safety, OKRs, ADKAR Change Management, Org Design, Talent Density, Kotter's 8-Step |
| Hiring & Talent Acquisition | 4 | Structured Interviewing, Hiring Scorecards, Bar Raiser Programs, Onboarding Acceleration |
| Performance Management Systems | 4 | OKR-Linked Reviews, 360-Degree Feedback, Calibration Sessions, Performance Improvement Plans (PIPs) |
| Compensation & Incentive Design | 4 | Total Rewards Philosophy, Equity Grant Design, Sales Compensation Models, Performance-Based Bonus Structures |

### Risk (8)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Risk, Governance & Crisis | 9 | FMEA, Crisis First Hour, Business Judgment Rule, COSO ERM, ISO 31000, Crisis Communication, Fiduciary Duties, Board Governance, Turnaround Playbook |
| Business Continuity & Disaster Recovery | 3 | RTO & RPO, Business Impact Analysis, Failover Testing |
| Regulatory Risk & Compliance | 3 | Regulatory Landscape Mapping, Compliance Program Design, Audit Readiness |
| Quantitative Risk Assessment | 3 | Risk Matrix, VaR & CVaR, Risk Appetite Statements |
| Insurance & Risk Transfer | 3 | Risk Transfer Spectrum, Captive Insurance, Parametric Insurance |
| Cyber Risk Management Framework | 3 | NIST CSF, FAIR Model, Ransomware Readiness |
| Geopolitical Risk Analysis | 3 | Country Risk Assessment, Sanctions & Export Controls, Supply Chain Geopolitical Mapping |
| Financial Risk Management (Treasury) | 3 | FX Hedging Strategies, Counterparty Credit Risk, Treasury Policy Design |

### Strategy (5)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Competitive & Market Analysis | 8 | Porter's Five Forces, VRIO, Jobs-to-be-Done, SWOT, BCG Matrix, Ansoff Matrix, Blue Ocean, Network Effects |
| Business Model & Strategy Design | 8 | Business Model Canvas, Porter's Generic Strategies, Core Competency, Balanced Scorecard, Strategy Map, Gap Analysis, OGSM Framework, MECE Principle |
| Platform Business Models & Network Effects | 3 | Network Effect Types, Chicken-and-Egg Problem, Platform Pricing |
| Disruption Response Playbook | 3 | Disruption Detection, Ignore vs Acquire vs Compete, Self-Disruption |
| Blue Ocean Strategy (ERRC Grid) | 3 | ERRC Grid, Strategy Canvas, Three Tiers of Non-Customers |

### Negotiation (3)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Negotiation & Deal-Making | 8 | BATNA, ZOPA, Anchoring, Integrative/Distributive, Principled Negotiation, Game Theory, M&A Deal Structure |
| Cross-Cultural Negotiation | 3 | High-Context vs Low-Context, Relationship-First vs Deal-First, Face-Saving Dynamics |
| Multi-Party Coalition Negotiation | 3 | Coalition Formation, Minimum Winning Coalition, Multi-Party Agenda Setting |

### Innovation (4)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Innovation & R&D Management | 8 | Disruptive Innovation, Crossing the Chasm, Lean Startup, Design Thinking, Stage-Gate, Ambidextrous Org, Tech S-Curve, Innovator's Dilemma |
| Product-Market Fit & Growth Engines | 4 | PMF Survey, Growth Loops vs Funnels, Flywheel Design, Expansion Revenue Mechanics |
| Intellectual Property Strategy | 3 | Patent Portfolio Strategy, Trade Secret vs Patent, Freedom to Operate |
| Open Innovation & Corporate Venturing | 3 | Open Innovation Models, Corporate Venture Capital, Innovation Scouting |

### Operations (4)
| Framework | Concepts | Description |
|-----------|----------|-------------|
| Operations & Quality Management | 7 | Six Sigma/DMAIC, Theory of Constraints, Lean/TPS, Pareto Principle, Just-in-Time, Hoshin Kanri, Statistical Process Control, TQM |
| Supply Chain Management | 3 | Supplier Diversification, JIT vs JIC, Supply Chain Risk Mapping |
| Capacity Planning & Forecasting | 3 | Little's Law, The Bullwhip Effect, Demand Forecasting Methods |
| Process Mining & Optimization | 3 | Process Discovery, Conformance Checking, Bottleneck Identification |

---

## Project File Structure

```
ceo-platform/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI entry point with CORS, routers, lifespan
│   │   ├── config.py                  # Settings: DB URL, LLM keys, CORS origins
│   │   ├── models/
│   │   │   ├── database.py            # SQLAlchemy async engine + session factory
│   │   │   ├── framework.py           # Framework + FrameworkConcept ORM models
│   │   │   ├── scenario.py            # Scenario + ScenarioAttempt ORM models
│   │   │   ├── journal.py             # JournalEntry + JournalOutcome ORM models
│   │   │   ├── progress.py            # UserProgress + CalibrationRecord ORM models
│   │   │   └── user.py               # User ORM model
│   │   ├── routers/
│   │   │   ├── frameworks.py          # GET /api/frameworks, /slug/{slug}, /{id}
│   │   │   ├── scenarios.py           # GET/POST /api/scenarios with start/evaluate
│   │   │   ├── quiz.py               # POST /api/quiz/generate + /evaluate
│   │   │   ├── journal.py            # CRUD /api/journal + /outcome
│   │   │   ├── progress.py           # GET /api/progress + /calibration
│   │   │   └── search.py            # GET /api/search?q=
│   │   ├── schemas/                   # Pydantic request/response models
│   │   │   ├── framework.py          # FrameworkRead, FrameworkListItem, FrameworkConceptRead
│   │   │   ├── scenario.py           # ScenarioRead, ScenarioAttemptRead, ScenarioStage
│   │   │   ├── quiz.py              # QuizGenerateRequest, QuizQuestionRead, QuizEvaluateRequest/Response
│   │   │   ├── journal.py           # JournalEntryCreate/Read/Update, JournalOutcomeCreate/Read
│   │   │   └── progress.py          # ProgressRead, CalibrationRecordRead, CalibrationSummary
│   │   └── services/
│   │       ├── scenario_service.py   # ScenarioEngine: branching logic, scoring, outcome determination
│   │       └── llm_service.py        # LLM integration (OpenAI/Anthropic) with mock fallbacks
│   ├── seed/
│   │   ├── frameworks.json           # 57 frameworks with ~200 concepts + definitions + examples
│   │   ├── scenarios.json            # 6 multi-stage scenarios with branching outcomes
│   │   ├── quiz_questions.json       # 55 curated quiz questions across all frameworks
│   │   └── seed_db.py               # Database seeder
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── test_scenario_engine.py  # 8 tests: branching logic, scoring, outcomes
│   │   │   └── test_llm_service.py     # 7 tests: parsing, mocking, schema validation
│   │   ├── integration/
│   │   │   └── test_frameworks_api.py  # 10 tests: API contracts, CRUD, search
│   │   └── conftest.py               # Test fixtures + SQLite test DB setup
│   ├── Dockerfile                    # Production container
│   ├── requirements.txt              # Python dependencies
│   └── pytest.ini                    # Pytest configuration
├── frontend/
│   ├── src/
│   │   ├── app/                      # Next.js App Router pages
│   │   │   ├── layout.tsx           # Root layout: nav bar, metadata, favicon
│   │   │   ├── page.tsx             # Landing page: hero, stats, domain filters, framework grid
│   │   │   ├── frameworks/
│   │   │   │   ├── page.tsx         # Framework browser with category filter
│   │   │   │   └── [slug]/page.tsx # Framework detail: concept grid + modal with examples
│   │   │   ├── scenarios/
│   │   │   │   ├── page.tsx         # Scenario browser
│   │   │   │   └── [slug]/page.tsx # Scenario engine page
│   │   │   ├── quiz/page.tsx        # Quiz generator + answer evaluation
│   │   │   ├── journal/page.tsx     # Decision journal with CRUD + outcome capture
│   │   │   ├── pathway/page.tsx     # 7-step learning pathway
│   │   │   ├── profile/page.tsx     # Progress dashboard + calibration chart
│   │   │   └── cheatsheet/page.tsx  # Quick reference: all concepts in filterable table
│   │   ├── components/
│   │   │   └── ScenarioEngine.tsx   # Branching scenario engine with DecisionPrompt + FeedbackPanel
│   │   ├── lib/
│   │   │   ├── api.ts              # Axios API client
│   │   │   └── types.ts            # TypeScript interfaces for all data models
│   │   └── app/globals.css          # Tailwind globals + custom animations
│   ├── public/
│   │   └── favicon.svg             # CC monogram favicon
│   ├── e2e/
│   │   └── scenario-flow.spec.ts   # Playwright E2E test: scenario flow
│   ├── Dockerfile                   # Production container
│   ├── package.json                 # Dependencies + scripts
│   ├── vitest.config.ts             # Vitest test configuration
│   ├── playwright.config.ts         # Playwright E2E configuration
│   └── tailwind.config.ts           # Tailwind CSS theme
├── ceo-toolkit/                      # Reference documents (separate project)
│   ├── frameworks/                   # Markdown playbooks for each domain
│   ├── templates/                    # Decision journal, context pack, etc.
│   ├── tools/
│   │   ├── consolidated-glossary.md  # 1500+ line glossary of all concepts
│   │   └── ceo-cheat-sheet.md       # Quick decision map
│   ├── ai-patterns/                  # AI-native thinking patterns for humans
│   ├── meta/
│   │   ├── working-dossier-system.md # Personal knowledge management
│   │   └── personal-operating-system.md # CEO daily/weekly rhythms
│   └── docs/
│       └── implementation-plan.md    # Full implementation plan with testing strategy
├── .github/workflows/ci.yml         # GitHub Actions CI pipeline
├── docker-compose.yml               # PostgreSQL + Redis + App services
└── docker-compose.test.yml          # Test services
```

---

## License

MIT License

Copyright (c) 2025 CEO Compass

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Attribution

Built by **DeepSeek V4 Pro** AI model via **OpenCode Go** AI provider. Domain knowledge synthesized from public sources including Wikipedia, Investopedia, Harvard Business Review, McKinsey, BCG, and Bain frameworks, plus decades of published CEO literature (Drucker, Porter, Christensen, Collins, Munger, Bezos, Buffett, Dalio).