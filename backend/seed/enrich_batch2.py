import json, copy

with open('frameworks.json') as f:
    data = json.load(f)

# All remaining concepts from batch 2 and 3
e = {}

# === COMPETITIVE & MARKET ANALYSIS ===
e["Porter's Five Forces"] = {
    "why_it_matters": "Every industry has a natural profit pool determined by five structural forces. No amount of operational excellence can overcome a structurally terrible industry (think: airlines, where all five forces are unfavorable). Porter's Five Forces tells you whether you're swimming upstream or downstream BEFORE you commit resources. This is the first analysis every CEO should do before approving a major strategic move.",
    "steps": [
        {"title": "Assess threat of new entrants", "description": "What are the barriers to entry? Capital requirements, economies of scale, switching costs, regulatory licenses, brand equity, access to distribution. High barriers = low threat."},
        {"title": "Assess supplier power", "description": "How many suppliers? How differentiated are their products? What are switching costs? If your key component has only 2 global suppliers, they have pricing power over you."},
        {"title": "Assess buyer power", "description": "How concentrated are your customers? Can they backward-integrate? A company with 3 customers representing 80% of revenue has a buyer power problem regardless of product quality."},
        {"title": "Assess threat of substitutes", "description": "Not just direct competitors — substitutes. Video calls didn't compete with airlines; they substituted for business travel entirely. Ask: 'What else could solve the customer's problem?'"},
        {"title": "Assess competitive rivalry", "description": "How many competitors, how fast is industry growth, how high are exit barriers? Slow growth + high fixed costs + low differentiation = price wars."}
    ],
    "pitfalls": [
        {"title": "Treating forces as static", "description": "Forces shift. Deregulation can eliminate entry barriers overnight. Technology can create substitutes that didn't exist last year. Reassess forces annually."},
        {"title": "Confusing industry attractiveness with company performance", "description": "A great company in a terrible industry can still generate returns through superior execution — but eventually, the industry structure wins. Know the difference between a performance problem and a structural problem."}
    ],
    "related_concepts": [
        {"name": "SWOT", "relationship": "Forces analyzes the INDUSTRY; SWOT analyzes the COMPANY within that industry"},
        {"name": "VRIO", "relationship": "Forces tell you if the industry is attractive; VRIO tells you if your resources can sustain advantage within it"},
        {"name": "Blue Ocean Strategy", "relationship": "When all five forces are unfavorable, Blue Ocean shows how to redefine industry boundaries and change the forces themselves"}
    ],
    "case_study": {"company": "US Airline Industry (Post-1978 Deregulation)", "situation": "After deregulation, airlines became a textbook case of unfavorable forces: low barriers to entry, powerful suppliers (Boeing/Airbus duopoly, unionized pilots), powerful buyers (Expedia/Kayak created perfect price transparency), infinite substitutes, and brutal rivalry. Buffett quipped that investors would be richer if the Wright brothers had never been born.", "application": "Every airline CEO tried to fight the forces with better operations: loyalty programs, hub-and-spoke, fuel hedging. But the forces were stronger than any strategy. From 1978-2020, the US airline industry generated negative cumulative returns.", "result": "Buffett bought airline stocks in 2016 and sold all in 2020 at a loss during COVID. The forces reasserted themselves. The lesson: when Porter's Five Forces are comprehensively unfavorable, temporary profits are exactly that."},
    "exercise": {"scenario": "You're entering the EV charging market. Low barriers, powerful suppliers (utilities, landlords), powerful buyers (price-sensitive drivers), substitutes (home charging), intense rivalry. Should you enter?", "options": ["Yes — the EV market is growing rapidly", "Only if you have a structural advantage that neutralizes at least two forces", "No — all five forces are unfavorable", "Enter with a price war to gain market share"], "correct": 1, "explanation": "Fast growth doesn't overcome structural disadvantage. Tesla's Supercharger network succeeded because it was exclusive to Tesla vehicles (differentiation), broadly deployed before competitors (first-mover), and integrated with vehicle purchase (switching cost). Enter only if you identify structural countermeasures."}
}

e["VRIO"] = {
    "why_it_matters": "Not all resources create competitive advantage. Most create competitive parity at best. VRIO (Valuable, Rare, Inimitable, Organized) is the acid test for whether your strategic asset is actually strategic. Only resources scoring high on all four dimensions deliver sustained competitive advantage. Most companies spend billions on resources that are merely Valuable — VRIO explains why those investments don't translate to superior returns.",
    "steps": [
        {"title": "Valuable", "description": "Does it neutralize a threat or exploit an opportunity? If the resource doesn't increase revenue or reduce costs, it's not strategic. Stop here."},
        {"title": "Rare", "description": "How many competitors have it? If everyone has it, it's competitive parity. A CRM system is valuable but not rare. Ten years of proprietary customer behavior data is both."},
        {"title": "Inimitable", "description": "Can competitors copy it? How long and at what cost? Sources of inimitability: historical conditions, causal ambiguity ('we can't explain exactly why it works'), social complexity (culture, trust)."},
        {"title": "Organized", "description": "Is the company structured to capture value from this resource? A brilliant AI research team (Valuable, Rare, Inimitable) is wasted if they report to a VP who doesn't understand AI and won't fund their projects."},
        {"title": "Score and prioritize", "description": "Score each resource on V/R/I/O (1-5). Invest in resources scoring high on all four. Divest those scoring high on V but low on R/I/O — they're necessary but not differentiating."}
    ],
    "pitfalls": [
        {"title": "Overestimating rarity", "description": "Every CEO thinks their culture and team are unique. Most aren't. The test: if you described this resource to a competitor without naming your company, would they say 'we have that too'?"},
        {"title": "Confusing inimitability with temporary lead", "description": "A 6-month technology lead is imitable. True inimitability comes from path dependence, causal ambiguity, or social complexity built over decades."}
    ],
    "related_concepts": [
        {"name": "Porter's Five Forces", "relationship": "Forces assess INDUSTRY attractiveness; VRIO assesses COMPANY-LEVEL resources that create advantage within that industry"},
        {"name": "Core Competency", "relationship": "A core competency is a bundle of resources and capabilities that passes the VRIO test"},
        {"name": "SWOT", "relationship": "VRIO analyzes internal Strengths in depth — use VRIO for Strengths/Weaknesses and Forces for Opportunities/Threats"}
    ],
    "case_study": {"company": "Netflix Recommendation Algorithm", "situation": "Netflix invested heavily in its recommendation algorithm. It was Valuable (increased engagement, reduced churn) and Rare (200M+ users generating data competitors couldn't match). But was it Inimitable?", "application": "Competitors like Disney+ launched without sophisticated recommendation — but they could build it. The algorithm IS imitable given enough data and engineering investment. Result: recommendation is a temporary competitive advantage, not a sustained one. As competitors accumulated their own data, Netflix's data advantage eroded.", "result": "Netflix stock dropped from $700 to $180 in 2022 as subscriber growth stalled. Competitors caught up faster than expected. Netflix pivoted to new advantages (gaming, live sports, ad tier) as VRIO predicted the old advantage would decay."},
    "exercise": {"scenario": "Your company has: 1) Strong brand (valuable, somewhat rare, somewhat imitable), 2) Proprietary manufacturing process (valuable, rare, inimitable — trade secret), 3) Talented sales team (valuable, not rare). You can only invest in ONE. Which?", "options": ["The brand — most visible and impacts customer perception", "The manufacturing process — highest VRIO potential for sustained advantage", "The sales team — talent drives execution", "Split across all three"], "correct": 1, "explanation": "The manufacturing process is Valuable, Rare, and Inimitable (trade secret) — the highest VRIO potential. The brand is imitable (Tesla had no brand in 2010). The sales team is not rare. Invest where competitors cannot replicate even with unlimited money and time."}
}

e["Jobs-to-be-Done"] = {
    "why_it_matters": "Customers don't buy products — they 'hire' them to do a job. Understanding the job means you compete against ANYTHING that does that job, not just direct competitors. When Intuit asked 'what job do people hire QuickBooks for?', the answer wasn't 'accounting software' — it was 'avoid IRS trouble.' That reframing revealed competitors like 'doing nothing and hoping' and 'hiring a bookkeeper.' Jobs-to-be-Done prevents the most common strategic error: defining your market too narrowly.",
    "steps": [
        {"title": "Identify the functional job", "description": "What is the customer trying to accomplish? 'Ensure my small business pays the right taxes on time without spending 10 hours a week on bookkeeping.'"},
        {"title": "Identify the emotional jobs", "description": "Personal: 'feel confident about compliance.' Social: 'look professional with accountants.' Emotional jobs often drive purchase decisions more than functional ones."},
        {"title": "Map hiring and firing process", "description": "What solution did they 'hire' before? Why did they 'fire' it? The switching moment reveals unmet needs that the old solution wasn't addressing."},
        {"title": "Identify non-consumption competitors", "description": "Who is NOT using any product for this job? Non-consumers are often the biggest market — they're 'hiring' workarounds and manual processes."},
        {"title": "Define the job spec, not the product spec", "description": "'Help me know within 5 minutes whether I'm compliant' — not 'tax compliance dashboard.' The job is stable; the solution can change."}
    ],
    "pitfalls": [
        {"title": "Defining the job too narrowly or too broadly", "description": "Too narrow: 'drill a quarter-inch hole.' Too broad: 'improve my home.' Right level: 'hang a picture without damaging the wall' — here you can see substitutes like adhesive hooks."},
        {"title": "Assuming customers can articulate the job", "description": "Customers describe symptoms and frustrations. Observe them in their environment — watching them work around your product reveals the real job better than any survey."}
    ],
    "related_concepts": [
        {"name": "Blue Ocean Strategy", "relationship": "JTBD reveals the job; Blue Ocean's ERRC Grid shows how to deliver that job with a fundamentally different value proposition"},
        {"name": "First Principles Thinking", "relationship": "JTBD is First Principles applied to customers: decompose 'what they want' to the fundamental job, not the current product category"},
        {"name": "Product-Market Fit", "relationship": "PMF is achieved when your product is the OBVIOUS choice for a specific job — customers hire it without deliberation"}
    ],
    "case_study": {"company": "Intuit QuickBooks (1990s)", "situation": "Small business accounting was a crowded market. Competitors competed on features: more reports, more integrations. Intuit founder Scott Cook visited small business owners and watched them actually do their books at their desks.", "application": "Cook discovered they didn't want 'accounting software' — they wanted to avoid IRS penalties. The job: 'Make sure I don't get in trouble with tax authorities without understanding accounting.' Intuit simplified: interview-style data entry, plain-language explanations, tax compliance checks. Features not serving the 'avoid IRS trouble' job were removed.", "result": "QuickBooks captured 80%+ market share. Competitors who competed on accounting features were answering a question customers weren't asking. Intuit grew from ~$100M to $10B+."},
    "exercise": {"scenario": "A customer buys a drill. What's the job they're hiring it for?", "options": ["To make a hole in the wall", "To hang a picture that makes their home look good when guests visit", "To have a drill in their toolbox for future projects", "To feel like a capable DIY person"], "correct": 1, "explanation": "The full job includes functional AND emotional dimensions. If you only solve the functional job (making holes), you miss why they chose a drill instead of adhesive hooks or hiring a handyman. Understanding the full job — including social and emotional dimensions — reveals competition far broader than 'other power tool brands.'"}
}

e["SWOT"] = {
    "why_it_matters": "SWOT is the most widely used strategy framework — and the most frequently misused. Done right, SWOT forces disciplined separation between internal factors (Strengths/Weaknesses — you control) and external factors (Opportunities/Threats — you don't). The key is pairing Strengths with Opportunities (S-O strategies) and Weaknesses with Threats (W-T strategies). These pairings are where strategy lives.",
    "steps": [
        {"title": "List Strengths (internal, evidence-based)", "description": "What does your company do better than competitors? Use data: patents, market share, NPS scores, cost benchmarks. 'Great culture' isn't a strength without evidence."},
        {"title": "List Weaknesses (internal, honest)", "description": "What do competitors do better? Where do you lose deals? If you can't name at least 5 significant weaknesses, you're not trying."},
        {"title": "List Opportunities (external, future)", "description": "What trends, market shifts, or regulatory changes could benefit your company?"},
        {"title": "List Threats (external, future)", "description": "What external changes could harm you? New competitors, substitute technologies, regulatory crackdowns."},
        {"title": "Generate S-O and W-T strategies", "description": "S-O: Use strengths to capture opportunities. W-T: Minimize weaknesses to avoid threats. The best strategies come from these cross-pairings."}
    ],
    "pitfalls": [
        {"title": "Confusing internal and external", "description": "'Poor brand awareness' is internal (you could fix it). 'Competitor launching marketing campaign' is external (you can't stop them). Force every item into one box."},
        {"title": "Listing without prioritizing", "description": "A list of 25 strengths and 20 weaknesses is useless. Force-rank to top 3-5 in each category. Strategies come from specific pairings, not generic lists."}
    ],
    "related_concepts": [
        {"name": "Porter's Five Forces", "relationship": "Forces is a structured way to populate the Threats/Opportunities quadrants of SWOT"},
        {"name": "VRIO", "relationship": "VRIO provides rigorous analysis for the Strengths quadrant of SWOT"},
        {"name": "TOWS Matrix", "relationship": "TOWS is SWOT in reverse: start with external factors first, then assess internal factors against them"}
    ],
    "case_study": {"company": "Netflix Pivot from DVDs to Streaming (2007)", "situation": "Netflix's SWOT in 2007: Strengths — brand, customer base, recommendation algorithm. Weaknesses — no content ownership, dependent on USPS. Opportunities — broadband growing, YouTube proving people watch online. Threats — Blockbuster, Amazon, Apple, cable VOD.", "application": "Netflix paired Strength (algorithm + customer relationships) with Opportunity (streaming) to create Watch Instantly. They paired Weakness (DVD dependency) with Threat (broadband replacing physical) to create a self-disruption W-T strategy: transition customers before DVD demand collapsed.", "result": "Blockbuster filed for bankruptcy in 2010. Netflix grew from 7M subscribers to 260M+. The SWOT pairings correctly identified proactive self-disruption as the winning strategy."},
    "exercise": {"scenario": "Which is correctly categorized in a SWOT for a retail chain?", "options": ["'E-commerce growing 15%' is a Weakness because our online sales are low", "'E-commerce growing 15%' is an Opportunity because we could capture it", "'E-commerce growing 15%' is a Threat because it threatens stores", "It could be Opportunity OR Threat depending on our response — but it's EXTERNAL either way"], "correct": 3, "explanation": "The same external trend can be BOTH opportunity and threat. List it twice and develop strategies for both. What matters for SWOT purity: it's external. Whether it's positive or negative depends on your specific situation and response capability."}
}

e["BCG Matrix"] = {
    "why_it_matters": "The BCG Growth-Share Matrix forces a portfolio-level view. Most CEOs manage each business unit as if it's the only one. BCG corrects this: cash cows should fund stars and select question marks. Dogs should be divested. The fundamental insight — mature businesses should fund growth businesses — seems obvious but is consistently violated by CEOs who let cash cows hoard cash while starving stars of investment.",
    "steps": [
        {"title": "Plot each business unit", "description": "X-axis: Relative Market Share (your share / largest competitor). Y-axis: Market Growth Rate (%)."},
        {"title": "Classify into quadrants", "description": "Stars: high share, high growth (invest). Cash Cows: high share, low growth (milk). Question Marks: low share, high growth (invest selectively or divest). Dogs: low share, low growth (divest)."},
        {"title": "Map cash flow between quadrants", "description": "Stars consume roughly as much cash as they generate. Cash Cows generate surplus. Question Marks consume cash. The healthy portfolio: Cash Cows fund Question Marks that become Stars."},
        {"title": "Identify success sequence", "description": "Question Mark → Star → Cash Cow → Dog. Each business unit should have a trajectory."},
        {"title": "Make resource decisions", "description": "Cash Cows: maximize cash. Stars: invest aggressively. Question Marks: pick 1-2 winners. Dogs: sell, shut down, or harvest with zero new investment."}
    ],
    "pitfalls": [
        {"title": "Using market growth as sole proxy", "description": "Some low-growth markets are extraordinarily profitable. Some high-growth markets destroy value. Supplement with profit pool analysis."},
        {"title": "Killing Question Marks too early", "description": "Most future Stars start as Question Marks. If you divest all Question Marks, you have no future Stars. Look for increasing market share trajectory even if absolute share is low."}
    ],
    "related_concepts": [
        {"name": "Capital Allocation Framework", "relationship": "BCG tells you WHERE to allocate capital; the Capital Allocation Framework tells you HOW to evaluate each investment"},
        {"name": "Ansoff Matrix", "relationship": "BCG assesses current portfolio; Ansoff identifies growth paths for individual business units"},
        {"name": "MECE Principle", "relationship": "BCG quadrants should be MECE: mutually exclusive and collectively exhaustive"}
    ],
    "case_study": {"company": "GE Under Jack Welch (1981-2001)", "situation": "When Welch became CEO, GE was a conglomerate of hundreds of businesses. Welch explicitly applied BCG thinking: every GE business must be #1 or #2 in its market or face divestiture.", "application": "Lighting/Appliances were Cash Cows (milked). Jet Engines/Medical Systems were Stars (invested heavily). NBC/GE Capital were Question Marks — GE Capital became a massive profit engine. Over 200 businesses were divested. Cash from Dogs funded Stars and Question Marks.", "result": "GE market cap grew from $14B to $400B. However, after Welch's departure, GE Capital grew from Cash Cow to over-concentrated bet — nearly destroying the company in 2008 — illustrating that BCG classification must be continuously updated."},
    "exercise": {"scenario": "Three divisions: A (40% share, 3% market growth), B (15% share, 25% growth), C (5% share, 2% growth). How to allocate capital?", "options": ["Invest equally in all three", "A=Cash Cow (milk), B=Question Mark (selective), C=Dog (divest)", "A=Cash Cow (milk), B=Star (invest heavily), C=Dog (divest)", "A=Star (invest), B=Question Mark (kill), C=Cash Cow (milk)"], "correct": 1, "explanation": "A: 40% share in slow growth = Cash Cow. B: 15% share in high growth — if the leader has 25%, relative share is 0.6x = not a Star, it's a Question Mark. C: 5% share, slow growth = Dog. Cash from A funds B (the Question Mark with best chance of becoming Star). C adds no strategic value."}
}

e["Ansoff Matrix"] = {
    "why_it_matters": "The Ansoff Matrix is the simplest growth framework. Every growth initiative fits one of four boxes: Market Penetration (safest), Market Development (moderate risk), Product Development (moderate risk), Diversification (highest risk). The matrix makes explicit what many CEOs avoid: true growth requires risk. The CEO's job is to allocate the growth portfolio intentionally across the four boxes, with more bets in safer quadrants and fewer — but potentially transformational — bets in Diversification.",
    "steps": [
        {"title": "Categorize all initiatives", "description": "Market Penetration: same products, same markets. Market Development: same products, new markets. Product Development: new products, same markets. Diversification: new products, new markets."},
        {"title": "Audit current allocation", "description": "What percentage sits in each box? Most companies are 80%+ Market Penetration. Healthy: 50% penetration, 20% market development, 20% product development, 10% diversification."},
        {"title": "Risk-assess each initiative", "description": "Penetration: lowest risk, lowest upside. Diversification: highest risk, can be transformational. Size bets accordingly."},
        {"title": "Identify the adjacent possible", "description": "Adjacent moves (new products for existing customers, existing products for adjacent segments) have much higher success rates than true diversification."},
        {"title": "Set explicit targets", "description": "'We expect $10M from Penetration (80% confidence), $5M from Market Development (50% confidence), and one Diversification bet at $20M or $0 (10% confidence).' This honest board conversation is what most CEOs avoid."}
    ],
    "pitfalls": [
        {"title": "Over-investing in Market Penetration as markets saturate", "description": "Spending 2x on sales doesn't deliver 2x growth at 40% market share. Know your saturation point and shift resources BEFORE returns collapse."},
        {"title": "Treating Diversification as the exciting stuff", "description": "Diversification is the most likely to fail. Base rates for corporate ventures into new markets are poor. Diversification bets should be small, numerous, and treated as options."}
    ],
    "related_concepts": [
        {"name": "BCG Matrix", "relationship": "Ansoff tells you HOW to grow; BCG tells you WHICH business units deserve growth investment"},
        {"name": "Blue Ocean Strategy", "relationship": "Ansoff operates within industry boundaries; Blue Ocean shows how to create NEW market space that transcends the product/market distinction"},
        {"name": "Business Model Canvas", "relationship": "When Ansoff identifies a growth vector, the Canvas helps design the business model to serve it"}
    ],
    "case_study": {"company": "Amazon's Ansoff Evolution (1995-2020)", "situation": "Amazon's trajectory perfectly illustrates Ansoff: 1995-1999 (Penetration: more books online), 1999-2005 (Product Development: electronics, toys to existing shoppers), 2005-2015 (Market Development: international + Prime + AWS as adjacent Product Development), 2015-present (Diversification: Alexa, physical stores, healthcare).", "application": "Each move was adjacent, not random. AWS was adjacent because Amazon already operated massive data centers. Kindle was adjacent because they already sold books. The adjacency principle explains Amazon's success rate.", "result": "Amazon grew from $500K (1995) to $575B+ (2024). The Ansoff sequence — penetration → product development → market development → adjacent diversification — was methodically executed over 25 years."},
    "exercise": {"scenario": "Your B2B SaaS sells HR software to mid-market US companies ($50M ARR, 30% share). Which Ansoff strategy has the best success chance for next growth phase?", "options": ["Market Penetration: sell more HR to more mid-market US companies", "Product Development: build payroll software for existing HR customers", "Market Development: sell HR software to enterprise (>5000 employees)", "Diversification: launch consumer mobile app for career management"], "correct": 1, "explanation": "Product Development (new product to existing market) is the highest-probability adjacent move. You already have relationships, trust, and integration. This is the Salesforce playbook: Sales Cloud → Service Cloud → Marketing Cloud."}
}

e["Blue Ocean"] = {
    "why_it_matters": "Competing in red oceans means fighting for existing demand — margins compress and everyone loses. Blue Ocean Strategy creates uncontested market space. The ERRC Grid (Eliminate, Reduce, Raise, Create) forces simultaneous pursuit of differentiation AND low cost. The strategic move is to stop playing the existing game and create a new one where you set the rules.",
    "steps": [
        {"title": "Map the strategy canvas", "description": "List key competitive factors. Plot your company and top 3 competitors on each (1-10). You'll likely find convergence — all players look similar."},
        {"title": "Apply ERRC Grid", "description": "Eliminate: which factors should be removed? Reduce: which should be below standard? Raise: which above standard? Create: which have never been offered?"},
        {"title": "Reconstruct market boundaries", "description": "Look across alternative industries, strategic groups, buyer chain, complementary products, functional-emotional orientation, and time/trends."},
        {"title": "Design the new value curve", "description": "It should diverge from competitors, have a compelling tagline, and focus on 3-4 factors where you'll be dramatically better."},
        {"title": "Reach beyond existing customers", "description": "Target non-customers: soon-to-be (about to leave), refusing (consciously choose against), unexplored (never considered). Tier 3 is the biggest Blue Ocean."}
    ],
    "pitfalls": [
        {"title": "Confusing Blue Ocean with technology", "description": "Most Blue Oceans come from value innovation, not tech. Cirque du Soleil merged circus with theater — no new technology. The innovation was in the VALUE CURVE."},
        {"title": "Creating a Blue Ocean with no barriers", "description": "A Blue Ocean without defensibility becomes Red within 2-3 years. Build inimitability through brand, patents, network effects, or cost structure."}
    ],
    "related_concepts": [
        {"name": "Porter's Five Forces", "relationship": "Five Forces describes the Red Ocean; Blue Ocean shows how to escape it"},
        {"name": "Jobs-to-be-Done", "relationship": "JTBD reveals the job; Blue Ocean designs a new value proposition for that job"},
        {"name": "Business Model Canvas", "relationship": "The Canvas operationalizes the Blue Ocean strategy once the value curve is designed"}
    ],
    "case_study": {"company": "Cirque du Soleil (1984-present)", "situation": "In the 1980s, circuses were in decline. They competed on star performers, animal acts, multiple rings, and low-cost concessions. Red ocean: declining demand, increasing costs, animal rights concerns.", "application": "ERRC: ELIMINATED animal acts and star performers. REDUCED number of rings (one instead of three). RAISED artistic sophistication and venue quality. CREATED storyline and thematic through-line. Result: a new category — 'artistic entertainment' — between circus and theater, attracting adults at $100+ tickets.", "result": "Grew from Quebec street performers to $850M+ annual revenue, 180M+ audience across 450+ cities. Competitors couldn't enter because the value proposition was different from both circus AND theater."},
    "exercise": {"scenario": "You're CEO of a business hotel chain. Industry competes on: location, room quality, business amenities, loyalty, price. Apply Blue Ocean ERRC.", "options": ["Eliminate loyalty, Reduce room quality, Raise WiFi, Create minibars", "Eliminate business amenities, Reduce price 50%, become ultra-low-cost", "Eliminate front desk (mobile check-in), Reduce room size, Raise community spaces (co-working lobby), Create local experience (curated guides, local food)", "Blue Ocean doesn't apply to mature hotel categories"], "correct": 2, "explanation": "Option 3 describes CitizenM and similar affordable luxury hotels. Eliminated traditional front desk (expensive, slow), reduced room size (more rooms per floor), raised lobby experience (co-working/social), created sense of place. Value innovation: lower cost AND higher perceived value."}
}

e["Network Effects"] = {
    "why_it_matters": "Network effects are the strongest moat in the digital economy. When a product becomes MORE valuable as MORE people use it, you get a self-reinforcing cycle competitors can't break. But network effects aren't a strategy — they're an outcome. CEOs need to understand which type (direct, indirect, data, platform), the tipping point, and vulnerabilities (multi-tenanting, niche competitors). Companies like Facebook, LinkedIn, and Uber designed their products specifically to create and strengthen network effects.",
    "steps": [
        {"title": "Identify your network effect type", "description": "Direct (more users = more value per user — messaging), Indirect/Two-Sided (more of group A attracts more of group B — marketplaces), Data (more users = more data = better product), Platform (more developers = more apps = more users)."},
        {"title": "Measure effect strength", "description": "How much does each additional user increase value? Linear vs Exponential (Metcalfe's Law: value ~ N²). Measure retention and engagement as user base grows."},
        {"title": "Solve the chicken-and-egg problem", "description": "Marketplaces: no buyers without sellers. Solutions: subsidize one side, start constrained (Facebook at Harvard only), provide standalone value first (OpenTable gave restaurants management system even with zero diners)."},
        {"title": "Prevent multi-tenanting", "description": "If users use multiple platforms (Uber AND Lyft), network effect is weakened. Increase switching costs: ratings, data history, exclusive contracts."},
        {"title": "Monitor for reversal", "description": "Network effects work in reverse: users leaving → less value → more leaving. This killed MySpace and Friendster. Monitor engagement and retention weekly."}
    ],
    "pitfalls": [
        {"title": "Assuming network effects automatically create moats", "description": "Only a moat if switching costs are high. If users easily multi-tenant, network effect doesn't prevent competition — it just raises the floor."},
        {"title": "Ignoring the network effect ceiling", "description": "LinkedIn at 800M users isn't meaningfully more valuable than at 400M. At the ceiling, product quality becomes more important than network size. Keep innovating."}
    ],
    "related_concepts": [
        {"name": "Platform Business Models", "relationship": "Platform businesses derive value from network effects — understanding effect types is essential for platform design"},
        {"name": "Porter's Five Forces", "relationship": "Strong network effects are barriers to entry and reduce rivalry — making industry structure more favorable"},
        {"name": "Crossing the Chasm", "relationship": "The chasm is between early adopters and mainstream. Network effects don't kick in until you cross it"}
    ],
    "case_study": {"company": "Uber vs Traditional Taxis", "situation": "Traditional taxi markets had no network effects. Uber designed a two-sided marketplace: more riders → more drivers (make more money) → shorter wait times → more riders. Classic marketplace flywheel.", "application": "Uber subsidized riders aggressively (below-cost fares) to build the rider base, attracting drivers who earned more than traditional taxis. At scale, new entrants couldn't compete — worse wait times AND fewer drivers created a value deficit on both sides.", "result": "Grew from SF black car service (2010) to 130M+ monthly users across 70+ countries. Traditional taxi medallion values dropped from $1M+ to under $100K. The network effect — not technology (taxis had apps too) — was the competitive weapon."},
    "exercise": {"scenario": "You're building a new professional social network to compete with LinkedIn (800M+ users). Best strategy?", "options": ["Build better product with more features", "Find niche LinkedIn doesn't serve well and build specialized network before expanding", "Lower prices than LinkedIn", "Large marketing campaign"], "correct": 1, "explanation": "LinkedIn's network effect means a general-purpose competitor can't win — even with better product. Start with a niche where LinkedIn is weakest (GitHub for developers, Dribbble for designers). Expand only after niche network effect is strong. Every successful social network competitor started narrow, not broad."}
}

# === NEGOTIATION ===
e["BATNA"] = {
    "why_it_matters": "Your negotiating power doesn't come from charm, arguments, or leverage tactics. It comes from one thing: what happens if you walk away. A strong BATNA means you can afford to say no. A weak BATNA means you can't — and they know it. The single highest-ROI activity before any negotiation is improving your BATNA. Don't spend 10 hours preparing talking points — spend 10 hours making your BATNA stronger.",
    "steps": [
        {"title": "Identify your current BATNA", "description": "What is your best option if this negotiation fails? Be specific: 'sign with Supplier X at $Y price within Z weeks.' Quantify it."},
        {"title": "Improve your BATNA before negotiating", "description": "Get a competing offer. Qualify a backup supplier. Identify an alternative strategy. A BATNA that goes from 'do nothing' to 'sign with Competitor X at 10% less' transforms your position."},
        {"title": "Estimate THEIR BATNA", "description": "What happens to them if the deal fails? Your power is the GAP between your BATNA and theirs."},
        {"title": "Never reveal your BATNA unless it's strong", "description": "Weak BATNA: don't mention it. Strong BATNA: strategically reference it without threatening. Never bluff — getting caught destroys credibility permanently."},
        {"title": "Set your reservation price at your BATNA value", "description": "If the deal is worse than your BATNA, walk. Period. This sounds obvious but is violated constantly — CEOs fall in love with deals and negotiate past their walk-away point."}
    ],
    "pitfalls": [
        {"title": "Confusing BATNA with worst case", "description": "BATNA is your best ALTERNATIVE, not the worst outcome. Your BATNA is your floor, not the abyss."},
        {"title": "Not updating your BATNA during negotiation", "description": "A competing job offer might expire. A market window might close. Reassess your BATNA before every session — last week's truth may not hold today."}
    ],
    "related_concepts": [
        {"name": "ZOPA", "relationship": "BATNA defines each side's walk-away point; ZOPA is the space between them"},
        {"name": "Anchoring", "relationship": "Your BATNA determines how far you can deviate from their anchor before walking away"},
        {"name": "Principled Negotiation", "relationship": "BATNA is your source of power in principled negotiation — it's what allows you to insist on objective criteria"}
    ],
    "case_study": {"company": "Disney's Acquisition of Pixar (2006)", "situation": "Steve Jobs (Pixar CEO) had a strong BATNA: Pixar could partner with another distributor or self-distribute. Disney CEO Bob Iger had a weaker BATNA: Disney's animation studio was struggling. The power asymmetry was entirely about BATNAs.", "application": "Iger recognized the BATNA asymmetry and made a transformative move: instead of negotiating a better distribution deal, he proposed Disney ACQUIRE Pixar for $7.4B — essentially buying out Jobs' BATNA by making him Disney's largest shareholder.", "result": "The acquisition closed in 2006. Jobs became Disney's largest individual shareholder. Pixar leadership took over Disney Animation. Combined company produced a historic run of hits. Iger's recognition of BATNA asymmetry — and willingness to transform the negotiation rather than fight at a disadvantage — saved Disney's animation business."},
    "exercise": {"scenario": "Negotiating job offer: Company A offers $150K. Your current job pays $130K. No other offers. What's your BATNA and power?", "options": ["BATNA is $150K (the offer). Strong power.", "BATNA is $130K (current salary). Weak power — can't walk from $20K raise.", "BATNA is $130K but BLUFF another offer for $160K.", "Pause and get another offer before continuing — improve your BATNA first."], "correct": 3, "explanation": "Current BATNA: $130K (stay at current job). Weak. The right move: pause, get another offer. With a second offer, your BATNA rises. The best time to negotiate is when you can credibly say no."}
}

e["Anchoring"] = {
    "why_it_matters": "The first number mentioned becomes the gravitational center of the entire discussion — even when both parties know it shouldn't. Skilled negotiators make the first offer and make it aggressive but defensible. The unskilled wait for the other side to go first — and spend the rest of the negotiation fighting against an anchor they didn't set. Anchoring can swing outcomes by 20-30% or more.",
    "steps": [
        {"title": "Prepare your anchor with objective criteria", "description": "Ground in market data, precedent transactions, cost analysis. '$50M because comparable transactions close at 5-7x ARR, and our $10M ARR at 5x is the low end.'"},
        {"title": "Make the first offer", "description": "If you have good ZOPA information, go first. First offers predict final outcomes more than any other single factor."},
        {"title": "If they anchor first, reset the conversation", "description": "Don't counter-anchor against theirs. 'That number is based on assumptions we don't share. Let me explain how we think about value, then I'll share a proposal.'"},
        {"title": "Use precise numbers, not round ones", "description": "$47,350 anchors more effectively than $50,000. Precision signals detailed analysis. Round numbers signal approximation and invite negotiation."},
        {"title": "Anchor on multiple dimensions", "description": "Price, payment terms, scope, timeline, risk allocation. Multiple anchors create a package harder to deconstruct than a single price anchor."}
    ],
    "pitfalls": [
        {"title": "Setting an anchor so extreme you lose credibility", "description": "$500M for a $50M company causes the other side to question your competence. The anchor must be within a range where a reasonable person could argue it."},
        {"title": "Forgetting you're also susceptible", "description": "Even when you KNOW you're being anchored, the effect still works. Judges given random anchors (dice roll) showed effects on sentencing. Adjust your counter-offer more than feels comfortable."}
    ],
    "related_concepts": [
        {"name": "BATNA", "relationship": "Your anchor should be set relative to your BATNA and their estimated BATNA — not based on wishful thinking"},
        {"name": "ZOPA", "relationship": "The anchor should be OUTSIDE the ZOPA on your side to pull the final agreement in your direction"},
        {"name": "Cognitive Biases", "relationship": "Anchoring is one of the most powerful cognitive biases. Understanding it helps you recognize when it's being used on you"}
    ],
    "case_study": {"company": "Facebook's Acquisition of Instagram (2012)", "situation": "Instagram had 30M users, 13 employees, $0 revenue. Twitter had offered ~$500M. Kevin Systrom set an anchor with Facebook: $2 billion. Aggressive — Instagram had no revenue, and social media acquisitions rarely exceeded $1B.", "application": "Zuckerberg, aware of Twitter's interest and Instagram's growth, didn't dismiss the $2B anchor. He negotiated within that frame. The anchor shifted the conversation from 'what's a 13-person photo app worth?' to 'how much discount from $2B can we get?'", "result": "Facebook acquired Instagram for $1 billion — half the anchor but 2x Twitter's offer. By 2024, Instagram was estimated worth $100B+, making Systrom's aggressive anchor look like a bargain."},
    "exercise": {"scenario": "Buying a company. Seller opens: 'We want $30M.' Your analysis: worth $15-22M. How do you respond?", "options": ["Counter at $15M (your low-end)", "Counter at $12M (below range to offset anchor)", "Reset the frame: 'Let's agree on valuation methodology first. Once we agree on framework, the number follows.'", "Accept their $30M anchor and negotiate down"], "correct": 2, "explanation": "Option C refuses their anchor frame entirely. Countering at $15M makes midpoint = $22.5M — above your range. Instead, agree on methodology (multiple of EBITDA? DCF with agreed assumptions?). Once methodology is agreed, the number follows — and you haven't been pulled toward their anchor."}
}

e["Distributive Negotiation"] = {
    "why_it_matters": "Not all negotiations can be win-win. When interests are directly opposed — price, salary, budget allocation — one party's gain IS the other's loss. Distributive negotiation is the art of claiming value when the pie is fixed. CEOs who only know integrative negotiation get taken advantage of by counterparts who claim value aggressively. The skill is knowing when to shift between integrative (creating value) and distributive (claiming it). Most negotiations have both phases. Confuse them at your peril: being integrative when the other side is distributive makes you a mark; being distributive when value could be created leaves money on the table.",
    "steps": [
        {"title": "Set aggressive but realistic initial positions", "description": "Your opening should be at the edge of defensibility — not so extreme you lose credibility, not so moderate you leave no room to negotiate. Research supports: extreme but defensible openings produce better outcomes."},
        {"title": "Make small, decreasing concessions", "description": "Start with large concession room, then narrow each subsequent concession. Decreasing concessions signal you're approaching your limit. Constant-sized concessions signal you have more room."},
        {"title": "Use silence strategically", "description": "After making an offer or receiving one, stay silent. Most people are uncomfortable with silence and will fill it — often with concessions or information. The first person to speak after an offer usually loses."},
        {"title": "Never make unilateral concessions", "description": "Every concession should be exchanged for something: 'I can move on price if you can move on payment terms.' Unilateral concessions signal weakness and invite more demands."},
        {"title": "Know when to walk away", "description": "The ultimate distributive power is the willingness to walk. If the deal is worse than your BATNA, walk. No exceptions. The best deals happen when you're genuinely willing to say no."}
    ],
    "pitfalls": [
        {"title": "Over-negotiating and damaging relationships", "description": "Claiming every last dollar in a distributive negotiation leaves the other side feeling exploited. This destroys future deals and reputation. Leave something on the table — not out of weakness, but as investment in the relationship. The 80/20 rule: claim 80% of the available value, leave 20% for goodwill."},
        {"title": "Assuming every negotiation is distributive", "description": "Some negotiators treat EVERY issue as distributive when integrative value exists. Before claiming value, check whether the pie could be expanded. The most expensive mistake in negotiation is fighting over a $100 pie when a $200 pie was available."}
    ],
    "related_concepts": [
        {"name": "Integrative Negotiation", "relationship": "Every negotiation has integrative AND distributive phases. Integrative creates value; distributive claims it. Know which phase you're in"},
        {"name": "BATNA", "relationship": "Your BATNA is your ultimate distributive weapon — it determines your walk-away point and prevents you from accepting value-destroying deals"},
        {"name": "Anchoring", "relationship": "Anchoring is the primary distributive tactic — the first number sets the negotiation range. Master anchoring to master distributive negotiation"}
    ],
    "case_study": {
        "company": "Major League Baseball Free Agency Negotiations",
        "situation": "MLB free agent negotiations are highly distributive: there's one player, one contract, and a fixed economic value. The agent's gain is the team's loss. Scott Boras, baseball's most famous agent, is a master of distributive negotiation.",
        "application": "Boras' technique: 1) Set an extreme but defensible anchor based on comparable player contracts, 2) Create a bidding war (improving his BATNA by getting multiple teams interested), 3) Make small, calculated concessions that signal approaching limits, 4) Use media strategically to apply pressure, 5) Never accept the first or second offer, even if it meets his target — always extract one more concession. His $100M+ contracts are the result of masterful distributive technique.",
        "result": "Boras has negotiated over $4B in player contracts, including record-breaking deals across every position. Teams know his tactics but still pay — because his distributive skill extracts maximum value regardless of counterparty awareness."
    },
    "exercise": {
        "scenario": "You're buying a used car. Seller asks $15K. Your research says $10-12K is fair. After some negotiation, seller says '$13K is my absolute final offer.' What do you do?",
        "options": ["Accept $13K — you're still in your range", "Counter at $12.5K — always get one more concession", "Say: 'I appreciate that. I can do $12.5K if you can include the extended warranty and fill the tank. Otherwise, I'll need to think about it.' Then stay silent.", "Walk away — 'final offer' is always a bluff"],
        "correct": 2,
        "explanation": "Option C applies distributive technique: never accept a unilateral statement of finality without testing it, but also never directly challenge it (that escalates). Instead, trade: accept their 'final' price in exchange for non-price items. The silence after is crucial — it lets them feel the pressure of potentially losing the deal. If they agree to your add-ons, you got more value without re-opening price. If they don't, you can still accept $13K if it's within your range."
    }
}

# Apply
for fw in data:
    for concept in fw['concepts']:
        name = concept['name']
        if name in e:
            concept.update(e[name])
            print(f'  OK: {fw["title"]} > {name}')

with open('frameworks.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'\nSaved. Total: {len(json.dumps(data)):,} chars')
