# CEO Compass

**[Live Demo →](https://kevinkicho.github.io/TheCEOCompass/)**

> Navigate every leadership decision with 57 frameworks, interactive scenarios, and AI-powered coaching.

CEO Compass helps leaders master the frameworks of world-class CEOs. It combines an encyclopedia of decision-making tools with AI-generated quizzes and concept explanations.

Built by DeepSeek V4 Pro AI model via OpenCode Go AI provider.

---

## Architecture

```
GitHub Pages (browser)        Firebase RTDB           Local Agent (WSL)
       │                          │                         │
       ├── push /requests/ ──────►│                         │
       │                          ├── onChildAdded ────────►│
       │                          │                         ├── POST localhost:11434/api/generate
       │                          │                         │
       │                          │◄─── write /responses/ ──┤
       │◄─── onChildAdded ───────┤                         │
       └─ render result ─────────┘                         ┘
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) + TypeScript + Tailwind CSS | Static SPA deployed to GitHub Pages |
| **AI Bridge** | Firebase Realtime Database | Message bus: browser → Firebase → local agent → Firebase → browser |
| **Local Agent** | Node.js + firebase-admin | Watches Firebase RTDB, calls Ollama at `localhost:11434`, writes response |
| **AI Engine** | Ollama (gemma4:latest) | Local LLM running on `localhost:11434` |
| **Framework Data** | `staticData.ts` (57 frameworks) | Built into the frontend — no backend needed for browsing |
| **CI/CD** | GitHub Actions | Tests, builds, and deploys to GitHub Pages |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Ollama with `gemma4:latest` pulled (`ollama pull gemma4:latest`)
- Firebase project with RTDB enabled
- Firebase service account key (download from Firebase Console → Project Settings → Service Accounts)

### 1. Setup environment variables

```bash
cd frontend
cp .env.example .env
# Fill in your Firebase config values
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:33221
```

### 3. Start the Ollama agent

```bash
cd agent
npm install
# Place your Firebase service account key in agent/
# (e.g., theceocompass-785f72e97854.json — detected automatically)
node index.js
```

The agent watches `/requests` in Firebase RTDB, calls Ollama at `localhost:11434`, and writes responses back.

---

## Frontend Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing | Hero, stats, domain filter pills, framework grid |
| `/frameworks` | Framework Browser | Browse all 57 frameworks with category filter |
| `/frameworks/[slug]` | Framework Detail | Concept cards with AI explanation button |
| `/scenarios` | Scenario Browser | Browse practice scenarios |
| `/scenarios/[slug]` | Scenario Engine | Multi-stage branching decision simulator |
| `/quiz` | Quiz Generator | AI-generated quiz questions via Firebase + Ollama |
| `/journal` | Decision Journal | Log decisions, record outcomes |
| `/pathway` | Learning Pathway | 7-step structured curriculum |
| `/profile` | Progress Dashboard | Stats, AI settings, agent instructions |
| `/cheatsheet` | Quick Reference | All concepts filterable by domain |

---

## AI Features (via Firebase RTDB + Ollama)

| Feature | How it works |
|---------|-------------|
| **Concept Explanation** | Click "Explain Further with AI" on any concept → frontend pushes request to Firebase → agent calls Ollama → response appears |
| **Quiz Generation** | Select framework + difficulty → frontend pushes request to Firebase → agent calls Ollama → quiz renders |

These work from both `localhost` and `kevinkicho.github.io` — no CORS issues because the browser only talks to Firebase.

---

## GitHub Secrets

For CI/CD to build with Firebase config, set these in repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `FIREBASE_API_KEY` | Your Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `FIREBASE_DATABASE_URL` | `https://your-project-rtdb.firebaseio.com` |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Your Firebase storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `FIREBASE_APP_ID` | Your Firebase app ID |

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
├── frontend/
│   ├── src/
│   │   ├── app/                      # Next.js App Router pages
│   │   ├── components/               # React components (Navbar, DemoFooter, etc.)
│   │   └── lib/
│   │       ├── api.ts              # Framework data from staticData.ts
│   │       ├── ollama.ts           # Firebase RTDB push/subscribe for AI
│   │       ├── firebase.ts         # Firebase RTDB initialization (env vars)
│   │       ├── staticData.ts       # 57 frameworks with 282 concepts
│   │       ├── settings.ts         # User settings (localStorage)
│   │       └── types.ts            # TypeScript interfaces
│   ├── .env.example                 # Required env vars
│   ├── package.json
│   └── next.config.js
├── agent/
│   ├── index.js                     # Firebase → Ollama bridge agent
│   ├── package.json
│   └── .gitignore                   # serviceAccountKey.json ignored
├── AGENTS.md                        # AI agent instructions
├── .github/workflows/
│   ├── ci.yml                       # Tests + build verification
│   └── deploy.yml                   # GitHub Pages deploy
└── README.md
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
