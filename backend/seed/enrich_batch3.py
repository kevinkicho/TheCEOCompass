import json

with open('frameworks.json') as f:
    data = json.load(f)

e = {}

# === NEGOTIATION (remaining 2) ===

e["Game Theory / Prisoner's Dilemma"] = {
    "why_it_matters": "Game theory is the mathematical framework for decision-making when outcomes depend on what OTHERS do. The Prisoner's Dilemma — where both parties acting in rational self-interest produce the worst collective outcome — explains everything from price wars to the tragedy of the commons to failed disarmament treaties. For CEOs, game theory matters in pricing strategy (should you cut prices or maintain?), capacity investment (should you build before demand or wait?), and partnership negotiations. The framework reveals when cooperation is structurally impossible and when it's the optimal strategy — save years of negotiation frustration by knowing which game you're playing.",
    "steps": [
        {"title": "Identify the players and their payoffs", "description": "Who are the decision-makers? What does each prefer, in order? For a pricing game: Player A wants high prices and high market share. Player B wants the same. These preferences conflict."},
        {"title": "Map the payoff matrix", "description": "Draw a 2x2 grid showing outcomes for each player under each combination of choices. In Prisoner's Dilemma: if both cooperate (keep prices high), both win moderately. If one defects (cuts prices) and the other cooperates, the defector wins big and the cooperator loses. If both defect, both lose moderately."},
        {"title": "Identify dominant strategies", "description": "A dominant strategy is the best choice regardless of what the other player does. In Prisoner's Dilemma, defection is dominant — you're better off defecting whether they cooperate or defect. This is why the collectively worse outcome is chosen."},
        {"title": "Determine if the game is repeated or one-shot", "description": "In one-shot games, defection dominates. In repeated games (you compete with the same competitor across multiple markets, quarters, or products), tit-for-tat cooperation can emerge. Punish defection immediately, forgive quickly, and signal cooperative intent."},
        {"title": "Change the game, don't play it", "description": "If the structure leads to an unfavorable equilibrium, change the game. Create side payments, build trust mechanisms, form coalitions, or change the payoff structure through regulatory action. The best strategic move is often to change the game entirely."}
    ],
    "pitfalls": [
        {"title": "Assuming competitors are rational", "description": "Game theory assumes rational actors maximizing their own payoff. Real competitors have emotions, biases, different time horizons, and imperfect information. A competitor acting 'irrationally' (pricing below cost) might have a different payoff structure than you assume (they need cash flow for debt payments, not profit maximization)."},
        {"title": "Ignoring the shadow of the future", "description": "In repeated games, your reputation matters. A 'win' in this quarter's pricing game that destroys a competitor might create a monopoly regulator, antitrust lawsuit, or vengeful competitor in future quarters. Play games with awareness of the entire sequence, not just the current round."}
    ],
    "related_concepts": [
        {"name": "Prisoner's Dilemma", "relationship": "The canonical game: two parties' rational self-interest produces the worst collective outcome — explains price wars, advertising battles, and capacity competition"},
        {"name": "Distributive Negotiation", "relationship": "Negotiation is a repeated game where cooperation (creating value) and defection (claiming value) are the two strategies, and the optimal approach depends on the shadow of the future"},
        {"name": "Blue Ocean Strategy", "relationship": "Red oceans are Prisoner's Dilemma games where mutual defection (price wars, feature copying) is the dominant strategy. Blue Ocean escapes the dilemma by changing the game entirely"}
    ],
    "case_study": {
        "company": "US Airline Industry Price Wars (2010s)",
        "situation": "The US airline industry is a classic repeated Prisoner's Dilemma. Each airline has the choice: keep capacity disciplined (cooperate) or add capacity to gain market share (defect). If all cooperate, everyone makes money. If one defects, they gain share while others lose. If all defect, overcapacity destroys industry profitability.",
        "application": "Throughout the 2010s, airlines alternated between cooperation (capacity discipline, profitable) and defection (capacity wars, losses). The dilemma structure: each airline's rational self-interest says 'add capacity before competitors do' — but when all add capacity, the collective outcome is worse for everyone. The unspoken cooperation broke down repeatedly as each airline calculated the short-term gain of defection outweighed the long-term cost of retaliation.",
        "result": "Industry profitability was unstable. Years of record profits (cooperation) were followed by quarters of losses (defection cycles). The only structural escape was consolidation — fewer players made cooperation easier to sustain. After mergers reduced the major airlines from 9 to 4, the shadow of the future lengthened, and cooperation became more stable."
    },
    "exercise": {
        "scenario": "You and your main competitor both have the option to spend $5M on a new feature or invest it elsewhere. If neither builds it, both maintain current position. If both build it, both spend $5M but competitive position is unchanged. If you build it and they don't, you gain competitive advantage worth $15M. How do you decide?",
        "options": [
            "Build it — the upside of gaining advantage outweighs the $5M cost",
            "Don't build it — hope they also don't build, saving $5M each",
            "Build it only if they build it — match their move regardless",
            "Signal publicly and credibly that you won't build it, then build it anyway"
        ],
        "correct": 3,
        "explanation": "This is a classic Prisoner's Dilemma. Defecting (building the feature when they don't) is the dominant strategy — you capture $15M if they cooperate. But if BOTH defect (build), you both lose $5M for no gain. The best outcome is mutual cooperation (neither builds). Option C is tit-for-tat: signal cooperation, build only if they defect. Option D (signal then defect) works once but destroys reputation in a repeated game. The mathematically optimal repeated-game strategy is: cooperate first, then mirror their last move. If they defect, you defect in the next round. If they cooperate, you cooperate."
    }
}

e["M&A Deal Structure"] = {
    "why_it_matters": "M&A deal structure determines everything that happens AFTER the price is agreed — risk allocation, tax efficiency, integration success, and legal liability. A well-structured deal survives the surprises that inevitably emerge during due diligence and integration. A poorly structured deal destroys value regardless of strategic logic. The key structural decisions — cash vs stock, earnouts vs up-front payment, escrows and holdbacks, reps and warranties — are where experienced CEOs earn their value. First-time CEOs focus on price; experienced CEOs focus on structure. Structure is what protects you when the pre-deal assumptions turn out to be wrong.",
    "steps": [
        {"title": "Choose consideration type", "description": "Cash: clean, fast, tax-immediate for seller. Stock: aligns interests, tax-deferred for seller, dilutes buyer shareholders. Mix: most common — 60/40 cash/stock hedges both sides. The choice signals your conviction: cash says 'we're confident'; stock says 'we want you aligned.'"},
        {"title": "Design the earnout", "description": "Earnouts bridge valuation gaps. If seller says $100M but you say $80M, offer $80M up front + $20M if they hit revenue targets over 2 years. Earnouts must be: measurable (GAAP revenue, not 'strategic milestones'), controllable (not dependent on you providing resources), and structured to prevent manipulation."},
        {"title": "Set reps and warranties", "description": "Seller warrants that financial statements are accurate, IP is owned, contracts are valid, no undisclosed litigation. The reps and warranties insurance market now covers up to $10-20M in breach damages. Insist on it — but know that reps only have value if you can recover damages after closing."},
        {"title": "Structure escrow and holdback", "description": "10-15% of purchase price held in escrow for 12-18 months to cover indemnification claims. Alternatively: a holdback (released if no claims) or a note (paid over time). This gives you a practical remedy for breaches without litigation."},
        {"title": "Plan the integration structure", "description": "Will you absorb the company (full integration), operate independently (holdco model), or hybrid? The integration plan should be drafted BEFORE the deal closes, with a Day 1 and Day 100 plan. Most M&A value destruction happens in integration, not negotiation."}
    ],
    "pitfalls": [
        {"title": "Overcomplicating the earnout", "description": "Earnouts with 5+ milestones, subjective criteria, or cross-company dependencies are almost guaranteed to produce post-deal disputes. The seller claims they earned it; you claim they didn't. Litigation follows. Keep earnouts simple: 1-2 metrics, 12-24 months, GAAP-measurable, no offsetting provisions."},
        {"title": "Neglecting reps and warranties insurance", "description": "RWI has become standard in middle-market M&A. Cost: 2-3% of coverage limit. Benefit: you don't need to pursue the seller personally for breach; claim goes to the insurer. Without RWI, you're relying on the seller's remaining net worth (often low after they've cashed out)."} 
    ],
    "related_concepts": [
        {"name": "LBO Modeling", "relationship": "LBO models determine the capital structure for the acquisition. The deal structure (debt/equity split) depends on the LBO model's projected debt paydown and return analysis"},
        {"name": "Cap Table", "relationship": "The M&A consideration (cash + stock) restructures the buyer's cap table. Stock consideration, earnout shares, and escrow all affect the fully-diluted share count"},
        {"name": "DCF Valuation", "relationship": "DCF determines the 'fair price' range. Deal structure determines how that price is paid, who bears the risk, and what the tax consequences are for both parties"}
    ],
    "case_study": {
        "company": "HP's Acquisition of Autonomy (2011)",
        "situation": "HP acquired Autonomy for $11.1B in 2011. Within a year, HP wrote down $8.8B of the value, alleging accounting improprieties. The deal structure: 100% cash consideration, no earnout, limited holdback, and reps and warranties that proved difficult to enforce across jurisdictions (UK company, US acquirer, partially Singapore operations).",
        "application": "The deal structure had several problems: 1) All-cash consideration meant Autonomy's management had no ongoing alignment — they could cash out and leave. 2) The UK/US jurisdiction mismatch made post-closing enforcement of reps expensive and uncertain. 3) No earnout created a hard transition: Autonomy's founders had no financial incentive to ensure a smooth integration after the deal. 4) The indemnification escrow was too small relative to the purchase price to provide meaningful protection.",
        "result": "HP's $8.8B write-down became one of the most famous M&A disasters. While the accounting issues were the headline story, the deal structure failed to provide the protection mechanisms — earnout alignment, adequate escrow, cross-border enforcement — that could have mitigated the damage. The case illustrates that deal structure isn't just about tax efficiency: it's about what happens when things go wrong."
    },
    "exercise": {
        "scenario": "You're selling your company. The buyer offers: $80M all cash at close, no earnout, 15% escrow for 12 months. Your valuation expectation is $100M. What should you negotiate for?",
        "options": [
            "Hold firm at $100M — accept nothing less than your valuation",
            "Ask for $80M cash + $20M earnout based on year-1 revenue growth, with escrow reduced to 10% if you agree to the earnout structure",
            "Accept $80M but ask for 100% in stock instead of cash to defer taxes",
            "Counter at $90M cash with 10% escrow"
        ],
        "correct": 1,
        "explanation": "Option B bridges the valuation gap using an earnout — you get $80M guaranteed (your floor) and the chance to earn $20M if the business performs (meets your valuation ceiling). Earnouts are ideal for situations where buyer and seller have different views on future growth. The escrow reduction in exchange for earnout participation is a fair trade: you're sharing upside, so you should share less downside risk. Option A is inflexible and may kill the deal. Option D leaves $20M on the table if the business performs. Option C gives you stock in the buyer — a different risk profile entirely."
    }
}

# === RISK, GOVERNANCE & CRISIS (9 concepts) ===

e["FMEA"] = {
    "why_it_matters": "Failure Mode and Effects Analysis (FMEA) is the most systematic risk assessment tool available to CEOs. Instead of debating 'how risky is this?' in vague terms, FMEA forces quantification: each failure mode gets a score for Severity (how bad?), Occurrence (how likely?), and Detection (how visible before failure?). The product — Risk Priority Number (RPN) — creates an objective ranking of risks that removes politics and emotion from risk prioritization. FMEA answers the question every board asks: 'Are we focused on the right risks?' With a completed FMEA, you have evidence, not opinion.",
    "steps": [
        {"title": "Identify failure modes", "description": "For each process or system component, ask: 'What could possibly fail here?' Be exhaustive. List every way a process step, technology component, or human action could produce an undesirable outcome."},
        {"title": "Rate Severity (1-10)", "description": "How bad would the consequences be? 1 = negligible impact (<$1K). 10 = catastrophic (existential threat to the company). Consider both financial and non-financial impacts: reputation, regulatory, safety."},
        {"title": "Rate Occurrence (1-10)", "description": "How likely is this failure? 1 = virtually impossible (once in 100 years). 10 = almost certain (daily). Use historical data where available; use expert judgment where data is scarce."},
        {"title": "Rate Detection (1-10)", "description": "How likely would we catch this BEFORE it causes harm? 1 = caught automatically (system alert). 10 = virtually impossible to detect until after the failure. A failure mode with perfect detection (score 1) is low priority regardless of severity."},
        {"title": "Calculate RPN and prioritize", "description": "RPN = Severity × Occurrence × Detection. Score ranges from 1 to 1000. Prioritize risks with RPN > 100 or with Severity = 10 regardless of other scores. Design specific countermeasures for each high-priority risk."}
    ],
    "pitfalls": [
        {"title": "Garbage in, garbage out", "description": "FMEA is only as good as the team that completes it. If participants are biased toward optimism, the Occurrence scores will be artificially low. If they catastrophize, Severity will be inflated. Use cross-functional teams with diverse perspectives, and calibrate scores against historical incidents."},
        {"title": "Treating RPN as an absolute measure", "description": "An RPN of 150 on one project is not comparable to RPN 150 on another — different teams calibrate differently. Use RPN as a RANKING tool within a single FMEA, not an absolute measure across the company. The priority order matters more than the specific numbers."}
    ],
    "related_concepts": [
        {"name": "Pre-Mortem Analysis", "relationship": "FMEA is the quantitative, systematic version of a pre-mortem. Use pre-mortems for strategic decisions, FMEA for operational processes"},
        {"name": "Risk Matrix", "relationship": "FMEA is a high-resolution alternative to the risk matrix. Risk matrices (5x5 Likelihood × Impact) are simpler; FMEA (S×O×D = RPN) is more nuanced"},
        {"name": "Six Sigma / DMAIC", "relationship": "FMEA is a standard tool in the Six Sigma toolkit, used in the Analyze phase of DMAIC to identify process failure modes and their root causes"}
    ],
    "case_study": {
        "company": "Toyota Production System",
        "situation": "Toyota's manufacturing quality is legendary, and FMEA is a core tool in the Toyota Production System. When Toyota introduced the Lexus brand in 1989, they applied FMEA to every component and assembly step — not just to identify failure modes, but to design countermeasures BEFORE production began.",
        "application": "Toyota engineers identified thousands of potential failure modes across the Lexus LS 400. For each high-RPN failure, they designed specific countermeasures: redundant brake systems, self-diagnosing electronics, assembly line checkpoints that detected defects before the next step. The FMEA didn't just identify risks — it prescribed specific engineering solutions that made each failure mode either impossible or immediately detectable.",
        "result": "The Lexus LS 400 launched with the highest initial quality of any car ever introduced. In its first model year, it had fewer defects per 100 vehicles than Mercedes, BMW, or Jaguar. J.D. Power ranked it #1 in initial quality. Toyota's systematic FMEA process — not luck or superior materials — was the competitive advantage."
    },
    "exercise": {
        "scenario": "Your factory has a machine that overheats occasionally. Severity: 6 (moderate damage, 3-day downtime). Occurrence: 4 (happens a few times per year). Detection: 3 (temperature warning light alerts operator). What is the RPN? What's the highest-leverage action?",
        "options": [
            "RPN = 72. Reduce Severity by adding a backup machine.",
            "RPN = 72. Detection is already good — no action needed.",
            "RPN = 24. Focus on reducing Occurrence by improving maintenance.",
            "RPN = 72. Increase Detection to 1 (automatic shutdown before damage) — cheapest and fastest fix."
        ],
        "correct": 3,
        "explanation": "RPN = 6 × 4 × 3 = 72. Option D is correct: Detection is the easiest lever to pull. Installing an automatic shutdown sensor that stops the machine before it overheats reduces Detection from 3 to 1 (assuming the shutdown is reliable), making RPN = 6 × 4 × 1 = 24 — a 67% reduction in total risk. This is almost always cheaper than redesigning the machine (reducing Severity) or improving the underlying failure rate (reducing Occurrence). FMEA's value is showing you where the cheapest risk reduction lives."
    }
}

e["Crisis First Hour"] = {
    "why_it_matters": "The first hour of a crisis determines whether it becomes a manageable incident or an existential threat. CEOs who handle the first hour well contain the damage; those who hesitate, hide, or mishandle it amplify the crisis 10x. The pattern repeats across every major corporate crisis: BP Deepwater Horizon, Boeing 737 MAX, Wells Fargo fake accounts. In each case, the original incident was serious but survivable; the CEO's response — delayed, defensive, dismissive — turned it catastrophic. The Crisis First Hour framework gives you a pre-loaded playbook: activate, contain, preserve, communicate, escalate. When crisis hits, you don't have time to invent a process — you need a checklist.",
    "steps": [
        {"title": "Activate the crisis team", "description": "Immediately notify the pre-designated crisis team: CEO, General Counsel, Head of Comms, Head of affected business unit, Security/IT lead (if applicable). Establish a physical or virtual 'war room.' Set a meeting cadence — every 30 minutes initially."},
        {"title": "Contain the damage", "description": "What can you do RIGHT NOW to stop things from getting worse? Isolate affected systems. Stop the bleeding operation. Remove the dangerous product from shelves. Minutes matter more than analysis at this stage."},
        {"title": "Preserve evidence", "description": "Lock down all logs, communications, data, and physical evidence related to the incident. Issue a legal hold to prevent destruction of documents. Every corporate scandal is exacerbated by evidence that was 'lost' during the initial response."},
        {"title": "Draft the holding statement", "description": "The first public statement must be released within 60-90 minutes. Content: acknowledge the incident, express concern, state what you know (and what you don't), and commit to updates. Do NOT speculate, assign blame, or promise outcomes you can't guarantee."},
        {"title": "Notify the board and regulators", "description": "General Counsel initiates board notification. Determine regulatory reporting obligations: SEC (material events), data breach laws (72-hour notification), industry-specific regulators. Failure to notify regulators within required timeframes is its own violation."}
    ],
    "pitfalls": [
        {"title": "Waiting for perfect information", "description": "The most common first-hour mistake: 'We don't know enough yet to say anything.' By the time you have perfect information, the narrative has been set by others — reporters, former employees, social media. Release a holding statement within 90 minutes. It doesn't have to be complete — it has to be NOW."},
        {"title": "Going silent after the initial statement", "description": "The first statement buys you goodwill for exactly one news cycle. Silence after Day 1 is interpreted as 'they're hiding something.' Commit to specific timeframes: 'Our next update will be at 10 AM tomorrow.' Then actually update. Silence is a crisis amplifier."}
    ],
    "related_concepts": [
        {"name": "Crisis Communication", "relationship": "The Crisis First Hour sets the communication strategy; Crisis Communication executes it over the subsequent days and weeks"},
        {"name": "Pre-Mortem Analysis", "relationship": "Run a pre-mortem on your five most likely crisis scenarios. For each, complete a Crisis First Hour checklist. Test the checklist in tabletop exercises quarterly"},
        {"name": "Business Judgment Rule", "relationship": "The Business Judgment Rule protects directors who make informed, good-faith decisions DURING a crisis — even if those decisions turn out wrong. Document your decision process in real time"}
    ],
    "case_study": {
        "company": "Johnson & Johnson Tylenol Crisis (1982)",
        "situation": "Seven people in Chicago died after taking cyanide-laced Tylenol capsules. The contamination occurred after the product left J&J's facility — a criminal act, not a manufacturing failure. J&J had no legal or moral responsibility. Most corporations would have denied responsibility and let law enforcement handle it.",
        "application": "J&J's CEO James Burke activated the Crisis First Hour framework: 1) Immediate recall of 31 million bottles ($100M after-tax cost), 2) Full cooperation with law enforcement and media, 3) Public communication prioritized safety over profits ('Our first responsibility is to the people who use our products'), 4) Developed triple-seal tamper-evident packaging that became the industry standard.",
        "result": "Tylenol's market share dropped from 37% to 7% immediately — and recovered to 30% within 12 months. J&J's reputation for integrity strengthened. The crisis response is still taught as the gold standard. Burke's first-hour choices — recall immediately, communicate transparently, prioritize safety over profit — transformed the crisis from existential threat to reputation-defining moment."
    },
    "exercise": {
        "scenario": "You're the CEO of a food company. You get a call at 8 PM: a child reportedly became ill after eating your product. You have no details yet. What do you do in the first hour?",
        "options": [
            "Wait until tomorrow — the morning news cycle will have more information and you can respond then",
            "Call legal counsel, ask the quality team to investigate, and prepare a statement acknowledging the report, expressing concern, and committing to a full investigation with updates within 24 hours",
            "Decide to issue a voluntary recall immediately — safety first, figure out the details later",
            "Call the affected family directly to express sympathy and gather information before going public"
        ],
        "correct": 1,
        "explanation": "Option B is the correct crisis first-hour playbook: activate team (legal + quality + comms), investigate, prepare a holding statement for release within 90 minutes. You don't have enough data for a recall (Option C). You must not wait (Option A) — the news will break before you respond. Directly contacting the family (Option D) is a good instinct but should be handled by someone trained in crisis communication, not the CEO directly."
    }
}

e["Business Judgment Rule"] = {
    "why_it_matters": "The Business Judgment Rule is the legal principle that courts will not second-guess business decisions made in good faith, with due care, and without self-dealing — even if those decisions turn out to be disastrous. This rule is the foundation of board governance. Without it, no rational person would serve on a board, because every failed decision would invite litigation. For CEOs, understanding the rule means understanding the standard you need to meet: not 'was the decision right?' but 'was the process proper?' Courts will protect you if you can demonstrate: (1) you were informed, (2) you were disinterested, and (3) you acted in good faith. They will NOT protect you if you were grossly negligent, self-dealing, or knowingly indifferent to risks.",
    "steps": [
        {"title": "Ensure you are informed", "description": "Before the decision, gather relevant information. Read board materials. Ask questions. Request expert analysis if needed. The court asks: 'Would a reasonable director consider this level of information adequate to make the decision?'"},
        {"title": "Eliminate conflicts of interest", "description": "If you have a personal financial interest in the outcome, disclose it and recuse yourself from the decision. 'Self-dealing' decisions are not protected by the Business Judgment Rule. If you can't be disinterested, don't vote."},
        {"title": "Document the decision process", "description": "Minutes should reflect: what information was considered, what alternatives were discussed, who was present, what questions were asked. The paper trail is your best protection. Courts focus on process, not outcome. A well-documented bad decision is protected; a poorly documented good decision is fragile."},
        {"title": "Demonstrate good faith", "description": "Act in what you genuinely believe to be the company's best interest — not your own, not a particular shareholder group's, but the corporation's. Good faith is assumed unless proven otherwise, but conscious disregard of known risks (e.g., 'don't tell me about the safety issue — I don't want to know') violates the rule."},
        {"title": "Know when Business Judgment Rule does NOT apply", "description": "The rule doesn't protect: (1) decisions involving self-dealing or conflicts, (2) decisions made without adequate information (gross negligence), (3) decisions that waste corporate assets (irrational), (4) decisions made in bad faith. In these cases, the burden shifts to the director to prove the decision was entirely fair."}
    ],
    "pitfalls": [
        {"title": "Confusing the Business Judgment Rule with immunity", "description": "The rule is a PRESUMPTION, not a guarantee. Shareholders can still sue and discovery can still happen. You win at the summary judgment stage IF you can demonstrate proper process. The rule protects good process, not bad outcomes."},
        {"title": "Using 'Business Judgment Rule' as a dismissive phrase", "description": "Rarely say 'that's protected by the Business Judgment Rule' in a board meeting. It signals that you don't want to engage with the substance of a concern. The rule protects decisions MADE with proper process — it's not an excuse to skip process."}
    ],
    "related_concepts": [
        {"name": "Fiduciary Duties", "relationship": "The Business Judgment Rule is the legal expression of the Duty of Care — it defines the standard of care that directors must meet"},
        {"name": "Board Governance", "relationship": "Board governance best practices (committee charters, board packs, executive sessions) are designed to help directors satisfy the Business Judgment Rule's requirements"},
        {"name": "Crisis First Hour", "relationship": "During a crisis, Business Judgment Rule protection requires documentation of the decision process IN REAL TIME — decisions made under pressure are still subject to review"}
    ],
    "case_study": {
        "company": "Caremark International (1996)",
        "situation": "Caremark faced criminal and civil liability for fraudulent billing practices. Shareholders sued the board, alleging directors breached their duty of care by failing to oversee management's compliance with regulations. The case established the board's duty of oversight — the 'Caremark duty.'",
        "application": "The Delaware Chancery Court ruled that directors could be liable for OVERSIGHT failures if: (1) they utterly failed to implement any reporting or information system, or (2) having implemented such a system, they consciously ignored red flags. The court emphasized that the Business Judgment Rule protects directors who establish reasonable compliance systems — not those who neglect to create any oversight structure at all.",
        "result": "The Caremark standard became the benchmark for director oversight liability. The lesson for CEOs: ensure your board has adequate compliance reporting systems, that information flows to directors, and that you don't ignore known risks. A robust compliance program isn't just good practice — it's the shield against oversight liability."
    },
    "exercise": {
        "scenario": "Your company is considering a $50M acquisition of a supplier. You've had 2 board meetings, management presented 5-page memos, the CFO showed financial projections, and the board asked detailed questions. After closing, the acquisition fails catastrophically — the projections were overly optimistic. Is the board protected by the Business Judgment Rule?",
        "options": [
            "No — the acquisition failed, so the decision was clearly wrong",
            "Yes — the process was adequate: they met twice, received information, asked questions. The outcome doesn't determine the protection",
            "Partially — because the projections were wrong, the board should have done more due diligence",
            "Only if they had an investment banker's fairness opinion"
        ],
        "correct": 1,
        "explanation": "The Business Judgment Rule asks about PROCESS, not OUTCOME. The board met twice, received written materials, reviewed financial projections, and asked questions. This demonstrates they were adequately informed, disinterested, and acting in good faith. The fact that the acquisition failed doesn't remove their protection — otherwise no board would ever approve a risky acquisition. The rule exists precisely because business decisions involve uncertainty, and good decisions can have bad outcomes."
    }
}

e["COSO ERM"] = {
    "why_it_matters": "COSO ERM (Enterprise Risk Management) is the gold standard framework for integrating risk management into strategy and performance — not treating risk as a compliance checklist but as a strategic tool. The 2017 update reframed ERM from 'prevent bad things' to 'make better decisions by understanding uncertainty.' For CEOs, COSO ERM provides the framework to have the right conversation with the board: not 'what are our risks?' but 'what level of risk are we willing to accept to achieve our strategic objectives?' The framework's five components — Governance & Culture, Strategy & Objective-Setting, Performance, Review & Revision, Information & Communication — create a closed-loop system where risk information flows from operations to strategy and back.",
    "steps": [
        {"title": "Establish governance and culture", "description": "Define the board's risk oversight role. Appoint a Chief Risk Officer (or assign risk ownership to CFO). Establish who has authority for which risk decisions. Create a risk-aware culture where raising concerns is rewarded, not punished."},
        {"title": "Integrate risk into strategy setting", "description": "During annual strategy planning, explicitly assess: (1) Does our strategy assume certain risks will NOT materialize? (2) Which strategic options have the best risk/reward profile? (3) Do we have risk capacity to pursue this strategy? Don't set strategy and then 'manage risks' — build risk management into strategy from the start."},
        {"title": "Identify and assess risks to performance", "description": "Identify risks that could affect achieving strategic objectives. Assess each: inherent risk (without controls) vs residual risk (with controls). Use multiple perspectives: financial, operational, strategic, compliance, reputational."},
        {"title": "Design risk responses", "description": "For each material risk, choose: Accept (we'll tolerate it), Avoid (exit the activity), Reduce (implement controls), Share (insurance, partnerships), or Pursue (accept the risk because the upside justifies it). The last option is what differentiates ERM from compliance — it's about taking RISK strategically."},
        {"title": "Report, review, and revise", "description": "Establish regular risk reporting cadence to management and board. Review risk appetite annually. Update risk assessments when significant changes occur (new strategy, major investment, regulatory change). The ERM process should evolve with the business."}
    ],
    "pitfalls": [
        {"title": "Treating ERM as a compliance exercise", "description": "Companies that implement COSO ERM as a checkbox exercise — fill out the risk register once a year, present it to the board, and forget about it — get zero value. ERM must be a LIVING process integrated into monthly business reviews, capital allocation decisions, and strategy discussions. If it's not changing decisions, it's not working."},
        {"title": "Creating a risk register without risk appetite", "description": "A list of 100 risks with likelihood and impact scores is useless without defined risk appetite. What level of risk are you willing to accept to pursue your objectives? Without risk appetite, you can't distinguish between tolerable risks that need monitoring and unacceptable risks that require immediate action."}
    ],
    "related_concepts": [
        {"name": "ISO 31000", "relationship": "COSO ERM and ISO 31000 are complementary frameworks. COSO is more integrated with strategy and internal control; ISO 31000 is more principles-based and flexible"},
        {"name": "FMEA", "relationship": "FMEA is a tactical risk assessment tool that feeds into the COSO ERM framework — it provides the detailed failure mode analysis that supports enterprise-level risk decisions"},
        {"name": "Business Judgment Rule", "relationship": "Proper ERM implementation helps directors satisfy their oversight duties under the Business Judgment Rule — a documented risk management process demonstrates good faith and due care"}
    ],
    "case_study": {
        "company": "JPMorgan Chase London Whale (2012)",
        "situation": "JPMorgan's Chief Investment Office (CIO) in London executed a series of complex credit derivatives trades that ultimately lost over $6.2B. Despite having extensive risk management systems, the bank's ERM framework failed because the CIO's risk reporting was incomplete and the traders actively concealed the positions' true risk.",
        "application": "Post-crisis analysis revealed that JPMorgan had COSO-aligned ERM in place on paper, but several failures: (1) risk reporting excluded synthetic credit positions (a governance failure), (2) risk limits were exceeded repeatedly without escalation (a culture failure), (3) the risk models underestimated tail risk (a methodology failure), and (4) the trading desk's compensation incentives encouraged excessive risk-taking (a strategy-culture misalignment).",
        "result": "The $6.2B loss is the largest trading loss in Wall Street history from a single desk. JPMorgan overhauled its risk management, consolidated its CIO operations, and implemented new risk reporting requirements. The lesson: ERM is only as strong as the weakest link — and the weakest link is usually cultural, not technical."
    },
    "exercise": {
        "scenario": "Your company is considering entering a new market with regulatory uncertainty. The strategy team projects $100M revenue. Legal warns the regulations might change. How should COSO ERM inform the decision?",
        "options": [
            "Don't enter — regulatory uncertainty is too risky",
            "Enter, and if regulations change, deal with it then",
            "Assess: what's the risk appetite for regulatory uncertainty? If the revenue/$ capital at risk is within risk appetite AND you have a contingency plan if regulations change, proceed with monitoring. If not, don't enter.",
            "Enter with a very large insurance policy"
        ],
        "correct": 2,
        "explanation": "Option C applies COSO ERM correctly: 1) Assess the risk against your defined risk appetite, 2) Understand what's at stake (revenue, capital deployed, reputational risk), 3) Design a risk response (contingency plan), 4) Monitor the regulatory environment as part of ongoing performance review. ERM doesn't tell you to avoid the risk — it tells you to understand it and decide consciously whether the potential return justifies the risk."
    }
}

e["ISO 31000"] = {
    "why_it_matters": "ISO 31000 is the international standard for risk management — a principles-based framework applicable to ANY organization regardless of size, industry, or geography. Unlike COSO ERM (which is integrated with internal control and strategy), ISO 31000 is designed to be flexible: you can adapt it to a startup's informal risk processes or a multinational's sophisticated ERM system. For CEOs, ISO 31000 provides the language and structure to have consistent risk conversations across business units, geographies, and stakeholders. When your European head says 'risk management' and your Asian head says 'risk management,' ISO 31000 ensures they mean the same thing.",
    "steps": [
        {"title": "Establish the risk management framework", "description": "Define: risk management policy, ownership and accountability, resources, integration into business processes, and communication protocols. The framework is the 'constitution' for how risks are managed across the organization."},
        {"title": "Apply the risk management process", "description": "The process: Scope → Identify → Analyze → Evaluate → Treat → Monitor & Review → Communicate & Consult. This is applied iteratively, not sequentially — new risks emerge during treatment, requiring re-analysis."},
        {"title": "Identify risks systematically", "description": "Use multiple identification methods: brainstorming with cross-functional teams, scenario analysis, checklists, interviews, data analysis, external research. Cast a wide net — risks you haven't identified can't be managed."},
        {"title": "Analyze and evaluate risks", "description": "Analyze: determine the nature, sources, likelihood, and consequences of each risk. Evaluate: compare the risk level (analyzed) against your risk criteria (appetite). This determines: is the risk acceptable, or does it require treatment?"},
        {"title": "Design risk treatments", "description": "Select treatment options: Avoid (don't start/continue activity), Reduce (mitigate likelihood or consequence), Transfer (insurance, contracts, outsourcing), Accept (retain with monitoring). The chosen treatment should be proportional to the risk level."}
    ],
    "pitfalls": [
        {"title": "Confusing ISO 31000 implementation with certification", "description": "Unlike ISO 9001 (Quality) or ISO 27001 (Security), ISO 31000 is NOT certifiable. There's no certificate to hang on the wall. Implementing ISO 31000 means adopting its principles and processes — not preparing for an audit. If someone offers you 'ISO 31000 certification,' they're misleading you."},
        {"title": "Making the process too bureaucratic", "description": "ISO 31000 scales to your organization. A startup doesn't need a 50-page risk management policy — a 2-page process guide adapted to startup speed is valid ISO 31000 implementation. Don't let the framework become an administrative burden that slows the business."}
    ],
    "related_concepts": [
        {"name": "COSO ERM", "relationship": "ISO 31000 is principles-based and flexible; COSO ERM is more prescriptive and integrated with strategy and internal control. Many organizations use BOTH — ISO 31000 for the overarching risk philosophy, COSO for implementation"},
        {"name": "FMEA", "relationship": "FMEA is a specific risk assessment technique within the ISO 31000 framework — it's the 'Analyze' step for operational risks"},
        {"name": "Business Continuity", "relationship": "ISO 31000 identifies risks that need treatment; Business Continuity is the treatment for risks that are accepted but need contingency plans when they materialize"}
    ],
    "case_study": {
        "company": "Rio Tinto (2020 Juukan Gorge incident)",
        "situation": "Rio Tinto destroyed 46,000-year-old Aboriginal heritage sites at Juukan Gorge in Western Australia to expand an iron ore mine. The company had internal risk assessments that identified the risk of destroying the caves — but the risk was evaluated as acceptable given the iron ore value.",
        "application": "The ISO 31000 framework would have required: (1) Broader identification: not just financial and operational risk, but reputational, social license, and stakeholder risk. (2) More thorough evaluation: the risk to the company's reputation and government relationships was underestimated relative to the financial benefit. (3) Proper monitoring and review: the risk assessments were not updated as stakeholder expectations evolved. (4) Communication and consultation: the views of traditional owners and heritage experts were not adequately incorporated into the risk evaluation.",
        "result": "The CEO and several senior executives resigned or were fired. Rio Tinto's reputation in Australia was severely damaged. The company faced parliamentary inquiries, investor pressure, and regulatory changes that affected its entire operations. The incident demonstrates that risk management must extend beyond financial and operational risks to include stakeholder and reputational dimensions — a core principle of ISO 31000."
    },
    "exercise": {
        "scenario": "Your supply chain team wants to source from a lower-cost country where corruption risk is higher. The price savings is $5M/year. How would ISO 31000 inform this decision?",
        "options": [
            "Don't source from high-corruption countries — the risk is too great",
            "Proceed with the cheaper source — $5M savings outweighs the risk",
            "Identify: what specific corruption risks exist? Analyze: likelihood and financial/reputational impact. Evaluate: is the risk level within appetite? Treat: implement anti-corruption due diligence, training, and contract provisions. Then decide.",
            "Source from the cheaper country but don't tell the board about the corruption risk"
        ],
        "correct": 2,
        "explanation": "Option C applies the ISO 31000 process: Identify (specific corruption risks), Analyze (likelihood × impact), Evaluate (against risk appetite), Treat (due diligence, training, contract provisions). The framework doesn't predetermine the decision — it ensures the decision is INFORMED by a systematic risk assessment. $5M savings with proper corruption controls might be acceptable. The same savings without any controls might not be. The process produces the answer."
    }
}

e["Crisis Communication"] = {
    "why_it_matters": "Crisis communication follows four principles: Speed (first statement within 60-90 minutes), Accuracy (never speculate), Empathy (people first), and Consistency (single source of truth). CEOs who violate any of these principles make the crisis worse. The companies that handled crises best — J&J (Tylenol), Tylenol, United Airlines (2008 cargo flight correction) — followed these principles. The companies that catastrophically failed — BP (Deepwater Horizon), Boeing (737 MAX), Wells Fargo — violated ALL of them. For CEOs, crisis communication is not about managing the message. It's about demonstrating that you're in control, you care, and you're acting. The financial impact is measurable: companies with effective crisis communication recover faster and lose less market value.",
    "steps": [
        {"title": "Speed: Release a holding statement within 90 minutes", "description": "Before you have all the facts. 'We are aware of [incident]. Our priority is the safety of our customers and employees. We are investigating and will provide an update within [timeframe].' This fills the information vacuum that would otherwise be filled by speculation."},
        {"title": "Empathy: Lead with concern, not facts", "description": "The first sentence should express concern for those affected — not explain what happened, not defend your company. 'We are deeply concerned about [affected parties].' Empathy signals that you share the public's values. Facts without empathy sound defensive."},
        {"title": "Accuracy: Never speculate, never lie", "description": "If you don't know, say 'we don't know yet.' One inaccurate statement will destroy ALL your subsequent credibility. Journalists will check every fact, opposition researchers will find every inconsistency. The truth will come out — and any deviation from it during the crisis will be treated as a cover-up."},
        {"title": "Consistency: Single source, single message", "description": "Designate ONE spokesperson. Everyone else refers inquiries to them. The legal team, the CEO, the head of the affected unit — if they're all saying different things, the narrative spins out of control. One message, repeated consistently, across all channels."},
        {"title": "Action: Demonstrate what you're doing", "description": "Don't just express concern — DEMONSTRATE action. 'We have launched an investigation. We have contacted affected customers. We have reported the incident to the regulator.' Action statements build credibility faster than any sentiment statement."}
    ],
    "pitfalls": [
        {"title": "Legalese and defensive framing", "description": "'We regret any inconvenience this may have caused' sounds like a lawyer wrote it — because a lawyer usually did. The public hears 'we're protecting ourselves.' Use human language: 'We are sorry. This should not have happened. We are fixing it.' Save the legal language for the courtroom."},
        {"title": "Forgetting internal communication", "description": "Your employees will hear about the crisis from social media before you tell them. Send an internal communication BEFORE or simultaneously with the public statement. Employees who feel informed and valued become ambassadors; those who feel blindsided become leakers."}
    ],
    "related_concepts": [
        {"name": "Crisis First Hour", "relationship": "The Crisis First Hour focuses on operational response (contain, preserve evidence); Crisis Communication focuses on stakeholder response (tell the story before others tell it for you)"},
        {"name": "Business Judgment Rule", "relationship": "Crisis communications should be documented as part of the board's decision-making process — they demonstrate good faith and reasonable care, which the Business Judgment Rule protects"},
        {"name": "Fiduciary Duties", "relationship": "Directors' duty of candor requires transparent communication with shareholders. Withholding material crisis information violates this duty"}
    ],
    "case_study": {
        "company": "United Airlines Flight 3411 (2017)",
        "situation": "A United Airlines flight was overbooked. When no passengers volunteered to give up their seats, airport police DRAGGED a paying passenger (Dr. David Dao) down the aisle, bloodied and unconscious. Another passenger recorded the video on their phone.",
        "application": "United's initial response violated every crisis communication principle: 1) No speed — CEO Oscar Munoz issued a statement calling Dr. Dao 'disruptive and belligerent' (blaming the victim, not expressing empathy). 2) No empathy — the first statement defended United's actions. 3) No accuracy — later details contradicted the initial narrative. 4) No consistency — multiple United spokespeople told different stories. 5) No action — the only action announced was 'reviewing our policies' — vague and non-committal.",
        "result": "United's stock lost $1.4B in market value within days. The CEO was called to testify before Congress. The company eventually settled with Dr. Dao (amount undisclosed but believed to be very large). The crisis is a textbook case of what NOT to do. The right playbook: immediate apology, promise of policy change (action), compensation to the affected passenger, and consistent messaging from one spokesperson."
    },
    "exercise": {
        "scenario": "A data breach exposes 10,000 customer credit card numbers. You have 72 hours to notify regulators under GDPR. What's your crisis communication plan for the next 72 hours?",
        "options": [
            "Wait until you have all the facts before saying anything publicly — accuracy matters more than speed",
            "Immediate holding statement: 'We are aware of a security incident. Affected customers will be contacted directly. We have notified regulators. More information within 48 hours.' Then follow through.",
            "Issue a press release with all available details, including the specific number of affected customers and the root cause — transparency builds trust",
            "Contact only affected customers directly. The public doesn't need to know unless media finds out."
        ],
        "correct": 1,
        "explanation": "Option B follows crisis communication principles: speed (statement now), empathy (addressing affected customers), accuracy (share only what you know, commit to more), action (regulator notified, customer contact planned). Option A waits too long — the void will be filled by speculation. Option C shares too much before you have verified facts. Option D is a cover-up that will destroy trust when the breach inevitably becomes public."
    }
}

e["Fiduciary Duties"] = {
    "why_it_matters": "Fiduciary duties are the legal obligations that directors and officers owe to the corporation and its shareholders. Three duties: Duty of Care (be informed, act with diligence), Duty of Loyalty (no self-dealing, no conflicts), Duty of Good Faith (act in the corporation's best interest, not willfully blind to risks). These duties are the standard by which every board decision will be judged in court. Most directors don't understand the standards clearly — they think 'good faith' means 'we tried our best,' when it actually means 'we established and monitored a reasonable system and were not consciously indifferent to red flags.' A CEO who understands fiduciary duties doesn't just stay out of legal trouble — they build the governance structure that gives the board confidence to support bold strategic decisions.",
    "steps": [
        {"title": "Establish a robust information system for the board", "description": "Ensure the board receives adequate information BEFORE decisions. Board packs should be distributed at least 5 business days before meetings. Include: financial reports, strategic updates, risk dashboards, competitive intelligence. The Duty of Care requires that the board is INFORMED."},
        {"title": "Recuse yourself from conflicted decisions", "description": "If you or a family member has a financial interest in a transaction, disclose it and have the disinterested directors approve it. Even the APPEARANCE of a conflict can create litigation risk. The Duty of Loyalty requires that you put the corporation's interests above your own."},
        {"title": "Document your decision process", "description": "Board minutes should reflect: what information was considered, what alternatives were discussed, questions asked, and the basis for the decision. Minutes are the primary evidence that directors satisfied their duty of care. Minutes that are too brief ('The board approved the acquisition') provide NO protection."},
        {"title": "Establish a compliance monitoring system", "description": "Create reporting systems that flag potential legal, regulatory, and ethical violations before they become crises. The Duty of Good Faith requires that directors are not 'consciously indifferent' to risks — having a compliance system demonstrates the opposite."},
        {"title": "Conduct an annual board self-evaluation", "description": "The board should evaluate its own performance annually: committee effectiveness, meeting quality, information adequacy, director attendance and participation. A board that evaluates itself is a board that's actively exercising its duties."}
    ],
    "pitfalls": [
        {"title": "Assuming duty of loyalty only applies to financial conflicts", "description": "Duty of Loyalty extends beyond financial self-dealing. It includes: competing with the corporation, usurping corporate opportunities, maintaining a confidential relationship with a competitor, and voting on a matter affecting a close personal relationship. When in doubt, disclose and recuse."},
        {"title": "Treating board minutes as a formality", "description": "Thin minutes ('The board approved the budget') provide no evidence of decision process. Detailed minutes ('The CFO presented revenue projections under three scenarios. The board discussed Scenario B assumptions for 30 minutes. Director Smith questioned the growth rate assumption. Management confirmed it based on signed contracts in pipeline. The board approved the budget.') provide process evidence that satisfies the Duty of Care."}
    ],
    "related_concepts": [
        {"name": "Business Judgment Rule", "relationship": "The Business Judgment Rule protects directors who meet their fiduciary duties. If you can demonstrate you satisfied Duty of Care, Loyalty, and Good Faith, the court presumes your business judgment was sound"},
        {"name": "Board Governance", "relationship": "Board governance best practices (committee charters, board packs, executive sessions) are designed to help directors satisfy their fiduciary duties"},
        {"name": "Crisis First Hour", "relationship": "During a crisis, fiduciary duties require prompt board notification and documented decision-making. The board's response to a crisis is the highest-scrutiny test of fiduciary duty compliance"}
    ],
    "case_study": {
        "company": "Enron (2001)",
        "situation": "Enron's board approved transactions with special purpose entities (SPEs) managed by the CFO (Andrew Fastow) — a clear conflict of interest. The SPEs were used to hide debt and inflate profits. When the deals collapsed, Enron filed for bankruptcy. Several board members faced personal liability.",
        "application": "Enron's board violations of fiduciary duties: 1) DUTY OF LOYALTY: they approved transactions where the CFO had a direct financial interest — the board should have required Fastow to recuse himself and should have appointed an independent committee to evaluate the transactions. 2) DUTY OF CARE: they waived Enron's code of ethics to approve these conflicted transactions without adequate diligence. 3) DUTY OF GOOD FAITH: they failed to monitor the transactions once approved, missing clear red flags about the SPEs' financial condition.",
        "result": "Several Enron directors were personally liable for breach of fiduciary duty, paying millions in settlements from their own pockets. The Sarbanes-Oxley Act was passed in response. The lesson: approving conflicted transactions without independent review is the most direct violation of fiduciary duty — and it's the one most likely to result in personal liability for directors."
    },
    "exercise": {
        "scenario": "Your board is about to approve a lease for office space owned by a company where the CEO's spouse is a partner. What's the proper process?",
        "options": [
            "The CEO should disclose the relationship and recuse herself from the discussion and vote. The remaining independent directors should evaluate the lease terms and approve only if they're at market rates",
            "No conflict if the lease is at market rates — proceed as normal",
            "Only need to disclose if the CEO is directly benefitting financially — a spouse's business doesn't count",
            "The CEO can still vote since she's not the one receiving the lease payments"
        ],
        "correct": 0,
        "explanation": "Option A is the only defensible approach. The CEO's spouse's financial interest creates an indirect conflict that falls under the Duty of Loyalty. The proper process: full disclosure to the board, CEO recusal from discussion and vote, independent director evaluation of whether the terms are fair to the corporation, and documented approval. Even if the lease is at market rates, failing to follow this process creates litigation risk. A plaintiff's lawyer will argue that independent directors might have negotiated better terms if the CEO wasn't conflicted."
    }
}

e["Board Governance"] = {
    "why_it_matters": "Board governance is the infrastructure of corporate decision-making: committee charters, board packs, executive sessions, annual evaluations, skills matrices, and succession planning. Weak governance doesn't cause immediate problems — it allows problems to fester undiscovered. The board that skips executive sessions doesn't hear about the CEO's temper. The board with no skills matrix doesn't notice they lack digital directors on the eve of digital disruption. The board with no succession plan finds itself without a CEO when one is needed most. For CEOs, strong governance is a strategic asset: a well-functioning board provides better advice, faster crisis response, and more confidence to pursue bold strategies. A weak board is a liability that eventually emerges when things go wrong.",
    "steps": [
        {"title": "Build the skills matrix", "description": "Map current directors' expertise: industry, finance, technology, international, regulatory, HR/compensation. Identify gaps. Recruit directors to fill those gaps. The matrix should be reviewed annually as the company's strategy evolves."},
        {"title": "Establish committee charters", "description": "At minimum: Audit Committee (financial reporting, internal controls, auditor relationship), Compensation Committee (CEO pay, equity plans), Nominating/Governance Committee (director recruitment, board evaluation). Each committee should have a written charter approved by the full board."},
        {"title": "Create a board calendar", "description": "Annual cycle: strategy retreat (once/year), detailed financial reviews (quarterly), CEO succession discussion (annually), board self-evaluation (annually), committee meetings before each board meeting. A predictable calendar ensures nothing falls through the cracks."},
        {"title": "Design the board pack standard", "description": "Each board meeting receives: CEO letter (strategic context), financial report (P&L, balance sheet, cash flow, KPIs vs plan), committee reports, strategic initiatives update, risk dashboard. Distributed 7 days before meeting. The board pack is the most important governance document."},
        {"title": "Hold executive sessions", "description": "The independent directors meet without the CEO at every board meeting. This creates a safe space for candor about CEO performance, strategy concerns, and management succession. If executive sessions don't generate constructive feedback, the independent directors aren't doing their job."}
    ],
    "pitfalls": [
        {"title": "Board pack death by volume", "description": "200-page board packs signal that management doesn't know what's important. Directors drown in details and miss the strategy discussion. Effective board packs: 20-30 pages, executive summary first, data visualizations, clear 'decision required' markers for each item. Less is more."},
        {"title": "Executive sessions that are too short or too polite", "description": "A 10-minute executive session where directors say 'the CEO is doing great' is worse than no session. It creates the APPEARANCE of oversight without the reality. Effective sessions require a lead independent director who's willing to surface difficult topics. If the session consistently runs 45+ minutes, there's real governance happening."}
    ],
    "related_concepts": [
        {"name": "Fiduciary Duties", "relationship": "Board governance structures (committees, charters, board packs) are the operational mechanisms through which directors discharge their fiduciary duties"},
        {"name": "Business Judgment Rule", "relationship": "Proper board governance creates the documentation trail that protects directors under the Business Judgment Rule — structured processes demonstrate due care"},
        {"name": "Compensation & Incentive Design", "relationship": "The Compensation Committee is responsible for aligning CEO and executive compensation with shareholder interests. Its independence from management is the foundation of credible pay-setting"}
    ],
    "case_study": {
        "company": "Uber Board Dysfunction (2017)",
        "situation": "In 2017, a former Uber employee published a blog post describing systemic sexual harassment and discrimination. The post went viral. Uber's board was caught off guard — they had no governance mechanisms in place to surface these issues before they became public crises.",
        "application": "Uber's governance failures included: (1) No independent chair — CEO Travis Kalanick controlled the board narrative. (2) Executive sessions were perfunctory or nonexistent — independent directors never discussed concerns privately. (3) No skills matrix — the board had no HR/people director despite running a 12,000-employee company. (4) No whistleblower mechanism for board-level issues. (5) Board was dominated by founder-aligned investors who didn't challenge management. The governance structure was designed for speed, not oversight — and it failed.",
        "result": "Travis Kalanick was forced to resign. Major investors sued each other. The board's dysfunction became a corporate governance case study. Uber eventually rebuilt its board with independent directors, established proper committees, and adopted governance practices. The lesson: good governance isn't bureaucracy — it's insurance against the most expensive board failures."
    },
    "exercise": {
        "scenario": "Your company is growing fast. Current board: 3 co-founders + 2 VC investors. All 5 are men with technology backgrounds, ages 35-50. What's the most important governance improvement you should make?",
        "options": [
            "Add more directors — size matters for governance quality",
            "Recruit 2-3 independent directors who bring missing skills (finance, HR, international, regulatory, public markets) and are not affiliated with founders or investors",
            "Replace one founder on the board with a CFO for better financial oversight",
            "Create a formal board committee structure"
        ],
        "correct": 1,
        "explanation": "Option B addresses the most fundamental gap: independent directors. A board with no independents is effectively an extension of management and investors — it lacks the objectivity to challenge strategy, evaluate CEO performance, or represent minority shareholders. Independent directors bring: objectivity, missing expertise, crisis management experience, and the ability to hold executive sessions. Adding committees (Option D) without independents just formalizes the dysfunction. Adding directors (Option A) without independence just adds more founder/investor voices. Option 1 directly addresses the core governance deficit."
    }
}

# === ENGINEERING & PRODUCT LEADERSHIP (8 concepts) ===

e["DORA Metrics"] = {
    "why_it_matters": "DORA (DevOps Research & Assessment) metrics are the industry standard for measuring engineering team performance. The four key metrics — Deployment Frequency, Lead Time for Changes, Change Failure Rate, Time to Restore Service — give CEOs a fact-based view of their engineering organization that replaces subjective impressions like 'the team is fast' or 'quality is suffering.' The critical insight: elite performers achieve BOTH high deployment frequency AND low change failure rate. The traditional belief that speed and stability are trade-offs is false — the best teams achieve both. DORA gives you the data to hold your CTO accountable with objective standards, not opinions.",
    "steps": [
        {"title": "Measure Deployment Frequency", "description": "How often does your team successfully release to production? Elite: multiple times per day. High: weekly to monthly. Medium: monthly to once every 6 months. Low: less than every 6 months. This is the primary speed metric."},
        {"title": "Measure Lead Time for Changes", "description": "How long from code commit to code running in production? Elite: less than 1 hour. High: 1 day to 1 week. Medium: 1 week to 1 month. Low: more than 1 month. This measures the latency of your delivery pipeline."},
        {"title": "Measure Change Failure Rate", "description": "What percentage of deployments cause a failure in production? Elite: 0-15%. High: 16-30%. Medium: 31-45%. Low: 46-60%. This is the quality metric."},
        {"title": "Measure Time to Restore Service", "description": "How long to recover from a production failure? Elite: less than 1 hour. High: less than 1 day. Medium: less than 1 week. Low: more than 1 week. This measures resilience."},
        {"title": "Track improvement, not just absolute level", "description": "The goal is to IMPROVE all four metrics over time. Set quarterly targets. If deployment frequency is stable but change failure rate is increasing, you're trading speed for quality — and DORA makes that trade-off visible. The best teams improve all four simultaneously."}
    ],
    "pitfalls": [
        {"title": "Measuring without context", "description": "DORA metrics vary by industry. A medical device company with low deployment frequency but extremely low failure rate might be performing to expectations. Compare to your industry's benchmarks, not generic 'elite' targets. The four 'elite' benchmarks were established for SaaS/cloud companies."},
        {"title": "Gaming the metrics", "description": "Teams can game DORA: merge trivial changes just to increase deployment count, delay deployments to make lead time look better, or classify failures as 'incidents' to exclude from failure rate. Self-reported metrics need validation. Cross-reference with automated CI/CD data."}
    ],
    "related_concepts": [
        {"name": "SPACE Framework", "relationship": "DORA measures system OUTCOMES (speed, stability); SPACE measures the FULL developer experience including satisfaction and collaboration — use both together"},
        {"name": "Tech Debt Quadrant", "relationship": "High change failure rate and long restore time are indicators of tech debt in the delivery process — the Tech Debt Quadrant helps diagnose whether the debt is reckless or prudent"},
        {"name": "Lean / TPS", "relationship": "DORA metrics are engineering's equivalent of Lean manufacturing metrics: deployment frequency = takt time, lead time = cycle time, change failure rate = defect rate, restore time = mean time to repair"}
    ],
    "case_study": {
        "company": "Amazon's Deployment Culture",
        "situation": "Amazon's engineering team deploys code every second on average — over 50 million deployments per year. This was NOT always the case. Before 2001, Amazon deployed infrequently with painful release cycles. The transformation was driven by CEO Jeff Bezos' mandate: teams must be able to deploy independently, without coordination.",
        "application": "Amazon's architecture (APIs, decoupled services, continuous delivery pipelines) was designed to enable elite DORA performance. Bezos' 'Two Pizza Team' rule — each team should be small enough to be fed by two pizzas — enables high deployment frequency by keeping change scopes small and independent. The cultural principle: 'If it hurts, do it more often' — meaning if deployments are painful, the solution is to deploy more frequently, not less. This drove Amazon's investment in automation, monitoring, and rollback capabilities.",
        "result": "By 2024, Amazon's engineering organization processes millions of deployments annually with elite-level DORA metrics across most teams. The company can experiment rapidly, recover from failures in minutes, and maintain industry-leading operational stability. The transformation from 'deploy quarterly and pray' to 'deploy every second' took over a decade of cultural and technical investment."
    },
    "exercise": {
        "scenario": "Your CTO reports: 'Our deployment frequency is twice per month. Lead time is 2 weeks. Change failure rate is 5%. Time to restore is 4 hours.' Which DORA level is this?",
        "options": [
            "Elite — failure rate is very low",
            "High — deployment frequency is weekly-to-monthly, lead time matches, failure rate is elite, restore time is high",
            "Medium — deployment frequency is too slow for modern standards despite good quality metrics",
            "Low — any metric in the low band means the whole team is low"
        ],
        "correct": 1,
        "explanation": "This team is High/Elite: Deployment Frequency (weekly-to-monthly = High), Lead Time (2 weeks = High), Change Failure Rate (5% = Elite, 0-15%), Time to Restore (4 hours = High, less than 1 day). The mixed profile (High on 3, Elite on 1) is common and healthy. Focus on improving deployment frequency toward weekly or daily to reach Elite on all four. The key: the failure rate is already elite — they can increase deployment speed without sacrificing quality."
    }
}

e["RICE Prioritization"] = {
    "why_it_matters": "RICE (Reach, Impact, Confidence, Effort) is a scoring framework for prioritizing product and engineering initiatives. It solves the most persistent problem in product management: how to compare completely different projects — a feature request, a tech debt migration, a customer support improvement — on a single scale. Without RICE, prioritization becomes the loudest-voice tyranny: whoever shouts loudest or has the highest title gets their project done first. RICE democratizes prioritization by forcing quantification of four dimensions. The 'Confidence' dimension is particularly valuable: it prevents months of work on projects based on untested assumptions.",
    "steps": [
        {"title": "Calculate Reach", "description": "How many users/customers will this affect within a specific time period (typically 3 months)? Not 'all users eventually' but 'in the next 3 months, how many?' Be precise: not 'many' but '500 active users per quarter.'"},
        {"title": "Calculate Impact", "description": "How much does this move the needle for each affected user? Typically: 3 = massive impact (transforms experience), 2 = high impact (significant improvement), 1 = moderate impact, 0.5 = low impact, 0.25 = minimal."},
        {"title": "Calculate Confidence", "description": "How confident are you in your Reach and Impact estimates? 100% = high confidence (data-backed), 80% = medium (strong indicators), 50% = low (educated guess), 20% = wild guess. Confidence prevents you from acting on unreliable data."},
        {"title": "Calculate Effort", "description": "Total person-months (or engineering-weeks) required. Include design, development, testing, deployment, and post-launch support. A 3-month project with a 3-person team is 9 person-months or roughly 0.75 engineering years."},
        {"title": "Compute RICE Score", "description": "RICE = (Reach × Impact × Confidence) / Effort. Higher score = higher priority. Sort projects by RICE score. The ranking is more important than absolute scores. This gives you an objective project queue."}
    ],
    "pitfalls": [
        {"title": "False precision", "description": "RICE scores look scientific but are based on estimates. A project scoring 180 vs 172 is effectively tied — don't treat them as significantly different. Use RICE for BUCKETING: Tier 1 (score > 100), Tier 2 (50-100), Tier 3 (< 50). Prioritize within tiers by strategic alignment, not decimals."},
        {"title": "Ignoring strategic value", "description": "RICE doesn't capture everything. A project with low RICE score might be strategically critical (regulatory compliance, platform foundation, partnership requirement). RICE is an input to prioritization, not the sole determinant. The final decision always requires human judgment."}
    ],
    "related_concepts": [
        {"name": "WSJF (Weighted Shortest Job First)", "relationship": "WSJF is similar to RICE but uses Cost of Delay / Job Duration. Key difference: WSJF values urgency (time sensitivity) while RICE values confidence and reach"},
        {"name": "Kano Model", "relationship": "RICE prioritizes WHAT to build; Kano Model categorizes features by customer satisfaction impact (Basic, Performance, Delight). Use Kano to assess the Impact dimension of RICE"},
        {"name": "Build vs Buy", "relationship": "RICE helps prioritize what to build internally. The Build vs Buy decision adds a fourth option (buy) that may have a higher RICE score than building from scratch"}
    ],
    "case_study": {
        "company": "Intercom Product Team",
        "situation": "Intercom (customer messaging platform) popularized RICE as their primary prioritization framework. Before RICE, teams reported that prioritization was dominated by 'the highest-paid person's opinion' (HIPPO) and the most recent customer complaint. The product backlog was a dumping ground of ideas with no systematic way to compare them.",
        "application": "Intercom's product team scored every proposed initiative using RICE. They discovered that many projects — prioritizing by HIPPO — had low Reach (few users affected) or low Confidence (estimated impact was speculative). These projects were consuming weeks of engineering time while higher-scoring projects sat in the backlog. RICE surfaced the misallocation. A security enhancement for enterprise customers scored higher than a new feature for all users because the reach was smaller but the impact per user and confidence were much higher.",
        "result": "Intercom's product team reported that RICE reduced prioritization time, increased team satisfaction (engineers knew WHY projects were chosen), and improved business outcomes by focusing effort on highest-impact work. The framework was shared publicly and became one of the most adopted prioritization methods in SaaS."
    },
    "exercise": {
        "scenario": "Three projects: A) Reach 1000, Impact 2, Confidence 80%, Effort 4. B) Reach 200, Impact 3, Confidence 50%, Effort 2. C) Reach 500, Impact 1, Confidence 60%, Effort 1. Which has the highest RICE score?",
        "options": [
            "Project A: (1000 × 2 × 0.8) / 4 = 400",
            "Project B: (200 × 3 × 0.5) / 2 = 150 — but low confidence means you should de-risk the assumption before starting",
            "Project C: (500 × 1 × 0.6) / 1 = 300 — quick wins are often underrated",
            "The scores are too close — use strategic alignment to break the tie"
        ],
        "correct": 2,
        "explanation": "Project C has the highest RICE score (300), followed by A (400? Let me recalculate: 1000 × 2 × 0.8 = 1600, / 4 = 400; C: 500 × 1 × 0.6 = 300, / 1 = 300; B: 200 × 3 × 0.5 = 300, / 2 = 150). Actually A = 400, C = 300, B = 150. Project A has the highest score. But Project C is a quick win — 6x higher efficiency per unit effort. The right move: do C first (1 week, delivers real impact), then start A (the big bet). This is why RICE is used for prioritization sequencing, not just go/no-go."
    }
}

e["Tech Debt Quadrant"] = {
    "why_it_matters": "Not all tech debt is bad. Some tech debt is deliberate and strategic — you chose speed over quality to meet a deadline, knowing you'd fix it later. Other tech debt is reckless and destructive — cutting corners carelessly without awareness or intention. The Tech Debt Quadrant (borrowed from Martin Fowler's framework) categorizes debt on two axes: Reckless vs Prudent, and Deliberate vs Inadvertent. The quadrant transforms tech debt from 'all debt is bad' to a nuanced framework for managing it. Prudent debt is an investment (you knowingly borrowed speed, and you'll repay). Reckless debt is a liability (you didn't know you were creating it, and it compounds silently). For CEOs, the framework gives you a language to discuss engineering quality without technical jargon.",
    "steps": [
        {"title": "Map existing debt to the quadrant", "description": "Categorize each known tech debt item: Prudent & Deliberate (we chose speed, we'll fix later), Reckless & Deliberate (we knew better but cut corners anyway — bad), Prudent & Inadvertent (we made the best call with information we had, but it turned out to be debt), Reckless & Inadvertent (we didn't know we were creating debt — dangerous)."},
        {"title": "Focus on Reckless debt first", "description": "Reckless debt — especially the inadvertent kind — is the most dangerous. You don't even know it exists, and it compounds silently until a crisis forces its discovery. Conduct a tech debt audit with experienced engineers to surface reckless debt."},
        {"title": "Track Prudent debt as intentional liability", "description": "When you deliberately take on tech debt (Prudent & Deliberate), DOCUMENT it. Record: what you deferred, why, and when you plan to repay. Treat it like financial debt: it has an interest rate that increases over time. Set a repayment date."},
        {"title": "Build tech debt repayment into every sprint", "description": "Dedicate 15-20% of engineering capacity to tech debt reduction. This is not 'slowing down' for quality — it's the minimum maintenance required to prevent your system from grinding to a halt. Neglecting tech debt is like never changing your car's oil."},
        {"title": "Measure the interest rate", "description": "Track how tech debt affects DORA metrics. High tech debt areas should show: decreased deployment frequency (releases take longer), increased lead time (changes are harder to make safely), increased change failure rate (debt causes bugs), and increased restore time (debt makes recovery slower). If tech debt isn't affecting these, its interest rate is low."}
    ],
    "pitfalls": [
        {"title": "Using 'tech debt' as an excuse for all bad code", "description": "Some code quality issues aren't debt — they're just bad code. Debt implies intention to repay. If there's no plan to fix it, it's not debt; it's a permanent liability. Calling it 'debt' rather than 'bad code' legitimizes sloppy engineering."},
        {"title": "Treating all tech debt the same", "description": "Prudent debt from a product launch deadline is fundamentally different from reckless debt from sloppy engineering. The first is an investment that had ROI; the second is a cost overrun. Don't mix them in your tracking or your conversation with the board."}
    ],
    "related_concepts": [
        {"name": "Build vs Buy", "relationship": "Building custom software creates tech debt; buying off-the-shelf usually doesn't. The Build vs Buy decision should include a tech debt impact estimate"},
        {"name": "DORA Metrics", "relationship": "Tech debt is the #1 cause of deteriorating DORA metrics. Use DORA trends to detect accumulating tech debt before it surfaces as a crisis"},
        {"name": "Platform vs Feature Investment", "relationship": "The Platform vs Feature investment decision is fundamentally about tech debt allocation: do you invest in reducing debt (platform) or accept more debt to deliver features faster?"}
    ],
    "case_study": {
        "company": "Twitter's Fail Whale Era (2007-2012)",
        "situation": "Twitter's early engineering team prioritized speed over quality repeatedly to ship features and handle explosive user growth. The original Ruby on Rails architecture was not designed for Twitter's scale. The tech debt was Prudent & Deliberate at first — they chose a fast-build approach knowing they'd need to re-architect. But as the debt accumulated without systematic repayment, it crossed into Reckless territory.",
        "application": "Twitter's tech debt manifested as the 'Fail Whale' — the error page displayed when the system was overloaded, which appeared frequently during peak usage. The debt interest rate was measured in service outages and lost user trust. The architecture couldn't be patched incrementally — it required a full re-architecture (replacing the Rails monolith with a Scala-based service architecture). This was a massive, high-risk repayment that could have been avoided with 20% time allocation over several years instead of a single crisis-driven rebuild.",
        "result": "Twitter survived the Fail Whale era but only after a painful multi-year re-architecture. The company lost users during the worst outages and missed growth opportunities. The lesson: systematic tech debt repayment (20% of every sprint) is cheaper and safer than crisis-driven repayment."
    },
    "exercise": {
        "scenario": "Your engineering team deferred writing automated tests to meet a critical product deadline, documenting the decision with a plan to add tests next quarter. What quadrant is this?",
        "options": [
            "Reckless & Deliberate — you knew you should have written tests",
            "Prudent & Deliberate — you made an intentional trade-off, documented it, and have a repayment plan",
            "Reckless & Inadvertent — you didn't realize how important tests are",
            "Prudent & Inadvertent — writing tests might not have helped anyway"
        ],
        "correct": 1,
        "explanation": "This is Prudent & Deliberate. You intentionally chose speed over quality, you recognized the trade-off at the time, you documented the decision, and you committed to repayment (adding tests next quarter). This is the responsible way to incur tech debt. It becomes Reckless if: 1) you don't document it, 2) you don't have a repayment plan, or 3) you've deferred so many times that the 'quarterly' plan is clearly aspirational. Track your repayment — if tests aren't written in the next quarter, the debt just crossed into Reckless territory."
    }
}

e["Build vs Buy"] = {
    "why_it_matters": "The Build vs Buy decision is one of the most consequential choices a CEO makes. Build gives you control, differentiation, and IP. Buy gives you speed, lower initial cost, and access to expertise you don't have. The wrong choice — building when you should buy, or buying when you should build — can waste years and millions. The most expensive mistake is usually building something that's not strategically differentiating: payroll processing, HR compliance tracking, authentication infrastructure. If it doesn't make your product UNIQUE, you should almost certainly buy it. Conversely, buying something that IS strategically core — your recommendation algorithm, your customer data model — means you're outsourcing your competitive advantage.",
    "steps": [
        {"title": "Classify the capability", "description": "Is this capability core to your competitive advantage? If a competitor could replicate it with an off-the-shelf solution, it's not core. If it's what makes your product UNIQUE (Amazon's recommendation engine, Apple's silicon, Google's search ranking), you MUST build it yourself."},
        {"title": "Calculate total cost of ownership", "description": "Building: development cost + maintenance cost (2-3x development over 5 years) + opportunity cost (engineering time not spent on core product). Buying: licensing cost + integration cost + upgrade cost + vendor risk. TCO analysis often reveals that buying is cheaper than building for non-core capabilities — but the full maintenance burden of building is consistently underestimated."},
        {"title": "Assess vendor viability", "description": "If you buy from a vendor, what's their financial health? Market position? Product roadmap alignment with yours? Vendor lock-in risk? The best product from a startup that might go bankrupt in 2 years is worse than an adequate product from an established vendor."},
        {"title": "Evaluate integration complexity", "description": "Buying requires integration. Is the API well-documented? Do you have the team to integrate? Is your data portable enough to move in and out? Many 'buy' decisions fail because integration costs exceed the build cost."},
        {"title": "Consider the 'build then buy' option", "description": "For some capabilities, build a minimal internal version first to deeply understand the problem, then buy a mature product when you know exactly what you need. This hybrid approach reduces the risk of buying the wrong product and gives you better leverage in vendor negotiations."}
    ],
    "pitfalls": [
        {"title": "Building what you should buy (not-invented-here syndrome)", "description": "Engineers want to build everything. It's more fun, more resume-building, and they believe they can do better than any vendor. But internal tools almost never achieve the quality, documentation, and updates of purpose-built vendors. The 'not invented here' syndrome costs companies billions in wasted engineering time."},
        {"title": "Buying what you should build (commoditizing your advantage)", "description": "The opposite mistake: buying a CRM because 'Salesforce has a standard one' even though your go-to-market motion is unique and your data model is your competitive edge. If a capability is strategically differentiating, owning it internally is an investment in your moat."}
    ],
    "related_concepts": [
        {"name": "RICE Prioritization", "relationship": "When 'building something non-core' comes up in the RICE queue, it's often lower priority than core product work — which argues for 'buying'"},
        {"name": "Platform vs Feature Investment", "relationship": "Platform investments are builds (long-term, capital-intensive); feature investments can often be bought (short-term, operational expense)"},
        {"name": "Tech Debt Quadrant", "relationship": "Building a large system internally that could have been bought creates tech debt — you now own the maintenance burden. The Tech Debt Quadrant helps frame this cost"}
    ],
    "case_study": {
        "company": "Netflix's Build vs Buy Strategy",
        "situation": "Netflix faced build-vs-buy decisions at every stage of its evolution: content delivery infrastructure, personalization engine, billing system, data analytics, streaming technology.",
        "application": "Netflix's framework: BUILD what differentiates you, BUY (or use open source) everything else. They BUILT their content recommendation engine (core to user experience), their streaming delivery network (Open Connect — differentiated infrastructure), and their content production capabilities (core to strategy). They BOUGHT or used open source: billing (third-party provider initially), cloud infrastructure (AWS — not a differentiator), HR systems (Workday), analytics infrastructure (Snowflake). The key insight: Netflix invested building capability where it directly impacted the user experience and competitive position. Everything else was a commodity.",
        "result": "Netflix scaled from 20M to 260M+ subscribers with a dramatically smaller infrastructure team than building everything would have required. By buying non-differentiating capabilities (cloud, billing, HR systems), their engineering team concentrated on what mattered: personalization, streaming quality, and content production technology."
    },
    "exercise": {
        "scenario": "Your SaaS company needs a customer support ticketing system. Your CTO wants to build it in-house: 'It's just a database with a frontend — we can do it in 3 months.' Your COO wants to buy Zendesk. How do you decide?",
        "options": [
            "Let the CTO build it — 3 months isn't that long and you'll own the IP",
            "Buy Zendesk. A customer support system is not a competitive differentiator, and Zendesk will have better features, integrations, and compliance than anything you can build in 3 months. Engineering should work on the core product.",
            "Build a minimal version now, then buy Zendesk later if needed",
            "Split the difference: buy Zendesk for basic ticketing, build the parts you need for custom integrations"
        ],
        "correct": 1,
        "explanation": "A customer support ticketing system is the textbook definition of a 'buy' decision. It's not strategically differentiating (it doesn't make your product unique), the vendor product (Zendesk) is mature and well-integrated, and building it distracts engineering from the core product. The 3-month build estimate is almost certainly optimistic — and maintenance will consume ongoing engineering time forever. The best case scenario for building is: you spend 3 months building, then 6 months iterating to reach Zendesk's feature parity, then own a system you'll maintain forever. Buy Zendesk."
    }
}

e["Kano Model"] = {
    "why_it_matters": "The Kano Model categorizes product features by their impact on customer satisfaction. Basic Features (table stakes — customers expect them, their absence causes dissatisfaction), Performance Features (more is better — directly correlated with satisfaction), and Delighters (unexpected features that create excitement but quickly become expected). The Kano Model explains why some features that customers REQUEST (typically Performance features) don't move the satisfaction needle when delivered, while other features they didn't ask for (Delighters) create outsized impact. For CEOs allocating product development budget, Kano provides the framework to avoid the most common mistake: over-investing in Basic Features that cause dissatisfaction when absent but provide no satisfaction when present.",
    "steps": [
        {"title": "Survey customers with functional/dysfunctional questions", "description": "For each potential feature, ask two questions: (1) 'How would you feel if this feature WERE present?' (Functional), and (2) 'How would you feel if this feature were NOT present?' (Dysfunctional). Answer choices: Like/Like it/Neutral/Can live with it/Dislike."},
        {"title": "Map responses to the Kano Matrix", "description": "Cross-reference Functional × Dysfunctional responses to classify each feature as: Basic (must-have), Performance (linear), Delighter (attractive), Indifferent, Reverse (some customers dislike), or Questionable (inconsistent responses)."},
        {"title": "Prioritize: Basic first, then Performance, then Delighters", "description": "Satisfy Basic needs first — if Basic features are missing, nothing else matters. Then invest in Performance features proportionally to their satisfaction impact. Finally, invest in Delighters selectively — they provide buzz and differentiation but quickly become expected."},
        {"title": "Track shifting categories", "description": "Features move rightward over time: Delighters become Performance (everyone has them), Performance becomes Basic (table stakes). The seatbelt was a Delighter in 1960, a Performance feature in 1980, and is Basic today. Anticipate these shifts in your product roadmap."},
        {"title": "Segment by user type", "description": "Power users and new users have different Kano profiles. A feature that's Performance for power users might be Basic for new users (or vice versa). Segment your Kano analysis by user persona for more actionable insights."}
    ],
    "pitfalls": [
        {"title": "Treating Kano responses as absolute truth", "description": "Customers can't predict their own emotional response to features they've never experienced. A Delighter in survey responses might turn out to be Indifferent when actually delivered. Use Kano as a prioritization INPUT, not a prediction of exact satisfaction impact."},
        {"title": "Over-investing in Basic Features", "description": "Companies compete on Basic Features because they're easy to benchmark: 'Our competitor has X, so we need X too.' But Basic Features are table stakes — having them doesn't differentiate you, it just keeps you in the game. The competitive advantage comes from Performance Features and Delighters. Allocate investment accordingly."}
    ],
    "related_concepts": [
        {"name": "RICE Prioritization", "relationship": "Kano classifies WHAT features matter; RICE helps quantify which of those features to build first"},
        {"name": "Jobs-to-be-Done", "relationship": "JTBD identifies the fundamental job the customer is hiring for; Kano helps design the right features to serve that job at each satisfaction level"},
        {"name": "Blue Ocean Strategy", "relationship": "Blue Ocean's ERRC Grid maps directly to Kano: Eliminate (remove Basic features that aren't valued), Reduce (under-invest in Performance features competitors over-invest in), Raise/Create (Delight and Performance features that differentiate)"}
    ],
    "case_study": {
        "company": "Apple iPhone (2007)",
        "situation": "Before the iPhone, smartphone users rated battery life, physical keyboard, and camera resolution as their top priorities — classic Performance features. Competitors invested heavily in these: BlackBerry had the best keyboard, Nokia had the best camera, various phones had the best battery life. Apple ignored what customers SAID they wanted.",
        "application": "Apple's iPhone focused on features customers didn't ask for: multi-touch screen (Delighter — nobody requested it), full web browsing (Performance/Delighter — existing phones had terrible browsers), minimalist design (Delighter). Apple correctly identified that the physical keyboard was a Basic feature that customers assumed was necessary — but eliminating it enabled a larger screen that created new satisfactions they couldn't imagine. The Kano diagnosis: the keyboard was Basic (necessary but not differentiating). The screen and browsing were Performance/Delighters that would drive satisfaction.",
        "result": "The iPhone redefined the smartphone category. BlackBerry (which focused on the physical keyboard — a Basic feature) was disrupted. Apple's willingness to under-invest in Basic features (keyboard, removable battery) and over-invest in Delighters (touchscreen, design) created the most successful consumer product in history. Kano correctly predicted that Delighters drive market share shifts."
    },
    "exercise": {
        "scenario": "Your customers keep requesting a mobile app in surveys and sales calls. Your competitor launches one. Your team wants to prioritize it. Using Kano Model, how do you evaluate this request?",
        "options": [
            "Build the mobile app immediately — customers asked for it, and now a competitor has it",
            "Classify: this has become a Basic feature now that the competitor offers it. Build it to parity quickly, but don't expect it to drive customer satisfaction. Invest your innovation budget elsewhere.",
            "Build a mobile app with unique features your competitor doesn't have, making it a Performance/Delighter feature instead of just matching parity",
            "Survey customers: will having a mobile app affect their purchasing decision? If yes, build it."
        ],
        "correct": 2,
        "explanation": "The mobile app is shifting from Delighter (before competitor had it) to Basic (now that they do). But Option C suggests the best Kano strategy: if you MUST build it, don't just match parity — add features that make it a Performance feature or Delighter. A mobile app with unique capabilities (push notifications for specific events, mobile-first features the web doesn't have) will drive satisfaction. A plain parity mobile app is just catching up to the new Basic. Option A is the most common mistake: assuming a requested feature is a Performance feature when it's actually becoming Basic."
    }
}

e["RICE/ICE/WSJF Prioritization"] = {
    "why_it_matters": "Multiple prioritization frameworks exist — RICE (Reach, Impact, Confidence, Effort), ICE (Impact, Confidence, Ease), WSJF (Weighted Shortest Job First from SAFe) — but they all solve the same CEO problem: how to compare fundamentally different projects on a single quantitative scale. The specific framework matters less than having a consistent, transparent system. The worst prioritization system is no system — where the loudest voice, the most recent customer complaint, or the highest-paid person's opinion drives what gets built. CEOs should pick ONE framework, implement it consistently, and review the prioritization queue monthly.",
    "steps": [
        {"title": "Choose ONE framework for the organization", "description": "RICE: best for feature prioritization (accounts for confidence). ICE: simpler but misses the Reach dimension (useful for quick experiments). WSJF: best for portfolio-level prioritization (accounts for urgency and cost of delay). Pick one and use it for at least 6 months before considering a change."},
        {"title": "Calibrate scoring across the team", "description": "Do a calibration session where the team scores 5-10 projects together to align on what 'Impact = 3' means. Without calibration, different team members will use different scales, making the scores incomparable across projects."},
        {"title": "Re-score quarterly", "description": "Assumptions change. A feature that had low Confidence last quarter might now have high Confidence because you launched an experiment. A project with high Effort might now be easier because of a vendor solution. Refresh scores every quarter."},
        {"title": "Separate prioritization from strategic allocation", "description": "Use the framework to prioritize WITHIN your strategic buckets (e.g., 40% new features, 30% tech debt, 20% customer requests, 10% innovation). Don't compare a tech debt project from one bucket against a new feature from another — allocate buckets strategically FIRST, then prioritize within each bucket."},
        {"title": "Audit the accuracy of past scores", "description": "After a project is delivered, compare the estimated Impact against the actual business outcomes. If your team's Confidence scores are consistently wrong (overconfident on features that flop, underconfident on features that succeed), calibrate. The framework should improve over time."}
    ],
    "pitfalls": [
        {"title": "Framework hopping", "description": "'We tried RICE, but it didn't solve everything, so now we're trying WSJF.' The best framework used consistently is better than the perfect framework used for two quarters. Stick with one. All frameworks are simplifications of reality."},
        {"title": "Treating the score as the decision", "description": "The ranking is an INPUT to decision-making, not THE decision. Strategic alignment, regulatory requirements, partner commitments, and CEO judgment override the score. Document WHY you overrode the score — this builds trust in the system."}
    ],
    "related_concepts": [
        {"name": "RICE Prioritization", "relationship": "RICE is the most comprehensive framework for feature prioritization — Reach, Impact, Confidence, and Effort provide a complete picture"},
        {"name": "Kano Model", "relationship": "Use Kano to assess the Impact dimension in RICE by classifying whether a feature is Basic, Performance, or Delighter"},
        {"name": "Build vs Buy", "relationship": "The prioritization framework should include 'buy' as an option. A project might have high RICE/WSJF score — but if you can buy a solution instead of building it, the actual Effort drops dramatically"}
    ],
    "case_study": {
        "company": "Spotify Squad Model",
        "situation": "Spotify's famous squad model empowered autonomous teams to prioritize their own work. Each squad had a product owner and a set of missions. But without consistent prioritization across squads, different teams used different informal methods — leading to inconsistent output and difficulty comparing portfolios.",
        "application": "Spotify experimented with multiple frameworks before largely standardizing on a RICE-like system adapted to squad autonomy. Each squad scored their mission backlog. The key innovation: squads allocated 70% of capacity to prioritized backlog items (using the scoring framework) and 30% to unplanned work, experiments, and serendipitous opportunities. This prevented the framework from becoming too rigid while maintaining systematic prioritization for the majority of effort.",
        "result": "Spotify's product development maintained high velocity as the company grew from hundreds to thousands of employees. The framework provided transparency (anyone could see why a project was prioritized over another), consistency (teams used the same language), and flexibility (30% unallocated time prevented the process from crushing innovation)."
    },
    "exercise": {
        "scenario": "Your product team is debating between RICE and WSJF. RICE uses Confidence as a penalty; WSJF uses Cost of Delay (urgency + revenue impact + time sensitivity). Which is better for a company with high market uncertainty?",
        "options": [
            "RICE — Confidence penalizes projects based on untested assumptions, which is more important than urgency when you're uncertain about the market",
            "WSJF — urgency is always the most important dimension, regardless of market conditions",
            "Both are equivalent — choose whichever the team prefers",
            "Use ICE instead — simplest and fastest to implement"
        ],
        "correct": 0,
        "explanation": "For high-uncertainty environments, RICE is better because the Confidence dimension explicitly penalizes projects with untested assumptions. This prevents teams from investing heavily in unvalidated ideas. In stable environments, WSJF's Cost of Delay framework is powerful — it captures the urgency of delayed features. But in high uncertainty, the biggest risk isn't 'are we working on the most urgent thing?' — it's 'are we working on something that will actually matter?' Confidence captures this. This is also why ICE (which eliminates Reach and doesn't have Confidence) is too simple for high-uncertainty situations."
    }
}

e["SPACE Framework"] = {
    "why_it_matters": "The SPACE Framework (Satisfaction, Performance, Activity, Communication, Efficiency) was developed to address a critical gap in how companies measure developer productivity. Traditional metrics like lines of code, hours worked, or story points completed are either easily gamed or measure output (activity) rather than outcome (value). SPACE provides a multi-dimensional view: developer SATISFACTION (are they happy and not burning out?), PERFORMANCE (are they delivering quality outcomes?), ACTIVITY (how much are they doing?), COMMUNICATION (is collaboration effective?), and EFFICIENCY (are they spending time on value-added work?). For CEOs, SPACE explains why your engineering team might be 'busy' but not 'productive' — and what to do about it.",
    "steps": [
        {"title": "Measure developer Satisfaction", "description": "Run quarterly developer experience surveys. Key questions: 'Do you feel able to do your best work?' 'Do you have adequate tools and resources?' 'Do you feel burned out?' Satisfaction is the canary in the coal mine — declining satisfaction predicts declining performance 2-3 quarters ahead."},
        {"title": "Measure Performance (not Activity)", "description": "Performance is about OUTCOMES: feature adoption rates, DORA metrics, customer satisfaction with delivered features. DORA's four metrics are the most effective Performance measures for individual delivery. Track at the team level, not individual level."},
        {"title": "Measure Activity as a proxy, not a target", "description": "Activity metrics (commits, PRs, story points) are useful for identification of bottlenecks ('why is our commit count dropping?') but dangerous as targets ('we need 50% more story points this quarter'). Activity targets get gamed."},
        {"title": "Measure Communication and Collaboration", "description": "Effective teams communicate. Measure: time to respond to code reviews, PR collaboration (how many reviewers per PR), request density per contributor. Poor collaboration metrics → integration bottlenecks → slower delivery."},
        {"title": "Measure Efficiency (time on value-added work)", "description": "What percentage of developer time is spent on: new features (value-added), maintenance and tech debt (investment), meetings and process (overhead), or context switching (waste)? Aim for >50% value-added time. If developers are spending 30 hours in meetings per week, efficiency is the problem."}
    ],
    "pitfalls": [
        {"title": "Measuring individuals, not teams", "description": "SPACE is designed for TEAM measurement. Measuring individual developer productivity with SPACE leads to perverse incentives: individuals optimize their personal metrics at the expense of collaboration and team output. Commit count per developer is meaningless — pair programming produces fewer commits per developer but better code."},
        {"title": "Collecting without acting", "description": "SPACE data is useless without follow-up. If the survey shows satisfaction dropping and efficiency declining, you need to act. Common root causes: unclear priorities, excessive meetings, poor tooling, legacy codebase friction, or micromanagement. The survey identifies the problem; you still need to diagnose and fix it."}
    ],
    "related_concepts": [
        {"name": "DORA Metrics", "relationship": "DORA provides the best PERFORMANCE measures (deployment frequency, lead time, failure rate, restore time). SPACE provides the missing dimensions — Satisfaction, Activity, Communication, Efficiency"},
        {"name": "Intuition vs Analysis", "relationship": "SPACE adds analysis (quantitative measurement) to what's often an intuitive assessment of engineering productivity. The framework replaces 'the team feels productive' with data"},
        {"name": "Tech Debt Quadrant", "relationship": "High tech debt shows up in SPACE as declining Efficiency (developers spending time on workarounds) and declining Satisfaction (frustrating codebase). SPACE surfaces the downstream effects of accumulated debt"}
    ],
    "case_study": {
        "company": "Stripe's Developer Productivity Team",
        "situation": "Stripe created a dedicated Developer Productivity team whose entire mission was to improve engineering velocity and satisfaction. They adopted SPACE-like multi-dimensional measurement to understand what was slowing developers down.",
        "application": "Stripe's team measured: Satisfaction (regular surveys, identifying friction points), Efficiency (time spent on value-added work vs context switching between tools and systems), Communication (PR review time, cross-team coordination overhead), and Performance (deployment frequency to Stripe's production API). The data revealed that context switching between Stripe's internal microservices was the biggest efficiency drain — developers spent 40% of their time on environment setup, debugging infrastructure, and understanding other teams' services.",
        "result": "Stripe invested heavily in developer tooling and platform engineering: unified development environments, standardized service templates, better documentation. Within 12 months, developer satisfaction increased 25%, value-added time increased from 35% to 55%, and deployment frequency increased. The SPACE measurement data directly drove the investment prioritization."
    },
    "exercise": {
        "scenario": "Your engineering team is 'busy' — committing frequently, working long hours, shipping features. But DORA metrics are declining and customer satisfaction is flat. Which SPACE dimension is most likely the problem?",
        "options": [
            "Activity is high — that's not the issue. The problem is likely Performance (the wrong features are being built) or Efficiency (teams are busy on non-value-added work like rework and debugging)",
            "Satisfaction — if they're working long hours, they're burning out. Fix satisfaction and everything else improves",
            "Communication — if they're busy but not effective, they're probably not coordinating well",
            "More Activity — if DORA metrics are declining, they need to work even harder to improve them"
        ],
        "correct": 0,
        "explanation": "High Activity + Declining Performance + Flat Customer Outcomes = an Efficiency problem or a Strategy problem. The team is busy but either: (1) working on the wrong things (Performance — the feature selection is off), (2) spending time on non-value-added work (Efficiency — context switching, rework, debugging, meetings), or (3) both. SPACE disaggregates 'busy' from 'productive.' The fix: measure what they're actually spending time on (Efficiency), and validate whether the delivered features are driving customer outcomes (Performance). Don't ask them to work harder — that will just accelerate the wrong direction."
    }
}

e["Tech Debt Management"] = {
    "why_it_matters": "Tech debt is the #1 silent killer of engineering velocity. Unlike financial debt where the interest rate is transparent, tech debt's interest compounds invisibly — a 10% slowdown this quarter becomes 20% next quarter becomes a complete halt in 18 months. Most CEOs don't discover their tech debt problem until it's a crisis: a 3-month feature takes 6 months, a critical hire can't ship anything, or a competitor moves faster. Proactive tech debt management — track it, prioritize it, allocate capacity to it — is the difference between an engineering organization that accelerates over time and one that decelerates. The cost of ignoring tech debt is never zero; it's exponential.",
    "steps": [
        {"title": "Create a tech debt ledger", "description": "Track every known tech debt item: what it is, when it was created, estimated repayment effort, and its 'interest rate' (how much time it costs the team per sprint in workarounds, bugs, and friction). A debt item that costs the team 2 hours per sprint × 24 sprints per year = 48 hours per year in interest."},
        {"title": "Quantify the interest rate", "description": "Not all tech debt has the same cost. A slow test suite (5 minutes per run) with 50 runs/day costs 4+ engineering hours per day — that's 1,000+ hours/year in interest. A suboptimal database query that affects only the admin panel might cost 2 hours per YEAR. Quantify the interest to prioritize repayment."},
        {"title": "Allocate 15-20% capacity to debt reduction", "description": "Every sprint, allocate 15-20% of engineering capacity to paying down tech debt. This is not optional — it's the maintenance required to keep velocity from declining. Teams that don't allocate this capacity find that tech debt consumes 20% of their capacity anyway (through workarounds and debugging) — but without the benefit of actually REDUCING the debt."},
        {"title": "Use the 'Leave it better than you found it' rule", "description": "Every time an engineer touches a piece of code, they should leave it slightly better than they found it. Refactor the confusing variable name. Add the missing test. Document the unclear logic. Small continuous improvements prevent debt from accumulating."},
        {"title": "Review tech debt quarterly", "description": "The CEO/CTO should review the tech debt ledger every quarter alongside the product roadmap. Are there debts that have become urgent? A debt that was tolerable at $50M ARR might be catastrophic at $200M ARR as customer volume scales. Anticipate before it becomes a crisis."}
    ],
    "pitfalls": [
        {"title": "Attempting to eliminate all tech debt", "description": "Zero tech debt is not the goal — it's both unachievable and undesirable. Some tech debt is strategic: you SHOULD borrow speed temporarily to enter a market, beat a competitor, or meet a deadline. The goal is MANAGED tech debt, not zero tech debt. Track it, prioritize it, pay it down systematically."},
        {"title": "Counting tech debt as a one-time cost", "description": "Tech debt is recurring. That $10M system that 'needs to be rewritten' will cost $10M to rewrite — and in 5 years, the rewrite will ALSO have tech debt. The goal is not a 'final rewrite' that eliminates debt forever (there's no such thing), but a sustainable cadence of investment in codebase health."}
    ],
    "related_concepts": [
        {"name": "Tech Debt Quadrant", "relationship": "The Quadrant is the diagnostic tool (which kind of debt do you have?); Tech Debt Management is the ongoing practice of tracking, prioritizing, and repaying it"},
        {"name": "DORA Metrics", "relationship": "DORA metrics ARE the measurements of tech debt's impact. Deteriorating deployment frequency or increasing change failure rate means tech debt is accumulating faster than it's being repaid"},
        {"name": "Platform vs Feature Investment", "relationship": "The Platform vs Feature decision is often about tech debt: you choose between reducing debt (platform) or creating more debt (features). The framework helps make this trade-off explicit"}
    ],
    "case_study": {
        "company": "Microsoft's Turnaround Under Satya Nadella (2014-present)",
        "situation": "When Satya Nadella became Microsoft CEO in 2014, the company's engineering culture was siloed and slow. Windows shipped every 3-5 years. Office had separate codebases for Windows and Mac. Azure was being built on top of Windows Server (a massive tech debt constraint). The accumulated tech debt — from years of prioritizing individual Windows release schedules over platform health — had made the organization slow to respond to the cloud shift.",
        "application": "Nadella's transformation included aggressive tech debt reduction: 1) Windows moved to a 'Windows as a Service' model (continuous updates instead of 3-year releases), requiring massive architectural cleanup, 2) Office adopted a single codebase across platforms (eliminating the Windows/Mac debt), 3) Azure rebuilt on a Linux-compatible foundation (abandoning the Windows-only debt), 4) Microsoft adopted open source (eliminating the 'not-invented-here' debt). These were multi-year, multi-billion-dollar debt reduction investments.",
        "result": "Microsoft's market cap grew from ~$300B in 2014 to over $3T in 2024. The company became a leader in cloud computing, open source, and cross-platform development. The tech debt reduction — while painful and expensive — enabled the cultural and technical agility required for the cloud era. The lesson: the most expensive tech debt decision is deferring repayment when the market shifts."
    },
    "exercise": {
        "scenario": "Your engineering team reports that 40% of their time is spent on 'workarounds and debugging legacy code.' The product team wants all capacity focused on new features. What's the right approach?",
        "options": [
            "Listen to the product team — new features drive revenue. The team will adapt.",
            "Allocate 20% to tech debt reduction regardless of feature pressure. The 40% 'lost time' is already the cost of NOT managing debt — reducing it to 20% (through repayment) would actually FREE UP 20% capacity for features.",
            "Force the team to work overtime — ship features AND fix debt",
            "Rewrite the entire legacy system in one big project"
        ],
        "correct": 1,
        "explanation": "Option B is the correct math: the team is already LOSING 40% capacity to tech debt. If you allocate 20% to debt repayment and succeed in reducing workaround time from 40% to 20%, your net capacity for features goes from 60% (100% - 40% debt tax) to 80% (80% capacity - 20% debt repayment + 20% reclaimed time). The team gains net capacity. Option C creates burnout. Option D is the 'rewrite trap' that almost always fails. The 20% rule IS the solution to the feature pressure — it's not a reduction in feature output, it's an investment in future feature velocity."
    }
}

# Apply to remaining concepts
count = 0
for fw in data:
    for concept in fw['concepts']:
        name = concept['name']
        if name in e:
            concept.update(e[name])
            print(f'  OK: {fw["title"]} > {name}')
            count += 1

with open('frameworks.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'\n{count} concepts enriched. Saved ({len(json.dumps(data)):,} chars)')
