import json
import os
from typing import Optional
from dataclasses import dataclass
from app.config import settings


@dataclass
class LLMFeedback:
    feedback: str
    score: float
    next_framework_suggestion: Optional[str] = None
    key_insights: list[str] = None

    def __post_init__(self):
        if self.key_insights is None:
            self.key_insights = []


class LLMService:
    def __init__(self):
        self.provider = settings.llm_provider
        self.model = settings.llm_model
        self._client = None
    
    @property
    def client(self):
        if self._client is None:
            if self.provider == "openai" and settings.openai_api_key:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=settings.openai_api_key)
            elif self.provider == "anthropic" and settings.anthropic_api_key:
                from anthropic import AsyncAnthropic
                self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._client
    
    async def evaluate_scenario_response(
        self,
        stage_context: str,
        stage_type: str,
        user_response: str,
        correct_answer: Optional[str] = None,
        framework_context: str = "",
    ) -> LLMFeedback:
        """Evaluate user's response to a scenario stage."""
        
        prompt = self._build_evaluation_prompt(
            stage_context, stage_type, user_response, correct_answer, framework_context
        )
        
        try:
            if self.provider == "openai" and self.client:
                response = await self._call_openai(prompt)
            elif self.provider == "anthropic" and self.client:
                response = await self._call_anthropic(prompt)
            else:
                return self._mock_feedback(stage_type, user_response)
            
            return self._parse_feedback(response)
        except Exception as e:
            print(f"LLM evaluation error: {e}")
            return self._mock_feedback(stage_type, user_response)
    
    async def generate_scenario(
        self,
        framework_name: str,
        framework_concepts: list[str],
        difficulty: int,
        context_hint: str = "",
    ) -> dict:
        """Generate a new scenario using LLM."""
        
        prompt = f"""
Create a CEO decision scenario for the "{framework_name}" framework.

Framework concepts to incorporate: {', '.join(framework_concepts)}
Difficulty level: {difficulty}/5
Context hint: {context_hint}

Generate a JSON scenario with this exact structure:
{{
  "title": "Scenario title",
  "description": "One paragraph description",
  "difficulty": {difficulty},
  "context": {{
    "company": "Company description",
    "situation": "Situation description",
    "time_pressure": "Time constraint",
    "data_provided": ["Data point 1", "Data point 2"]
  }},
  "stages": [
    {{
      "id": "stage-1",
      "type": "diagnosis",
      "prompt": "What framework should you apply first?",
      "options": [
        {{"id": "a", "label": "Correct framework", "score": 0.9, "rationale": "Why this is best"}},
        {{"id": "b", "label": "Plausible but wrong", "score": 0.4, "rationale": "Why it's insufficient"}},
        {{"id": "c", "label": "Common mistake", "score": 0.1, "rationale": "Why this fails"}}
      ],
      "feedback_prompt_template": "User chose {{option}}. Give CEO-grade feedback."
    }},
    {{
      "id": "stage-2",
      "type": "analysis",
      "prompt": "Calculate/analyze X. Show your work.",
      "options": [],
      "free_response": true,
      "feedback_prompt_template": "User answered: {{response}}. Correct approach: ... Evaluate their reasoning."
    }}
  ],
  "outcome_branches": {{
    "optimal": {{"title": "Success", "description": "What happens when done well"}},
    "acceptable": {{"title": "Survivable", "description": "What happens with decent execution"}},
    "failure": {{"title": "Failure", "description": "What happens with poor decisions"}}
  }}
}}

Return ONLY valid JSON.
"""
        
        try:
            if self.provider == "openai" and self.client:
                response = await self._call_openai(prompt, temperature=0.7)
            elif self.provider == "anthropic" and self.client:
                response = await self._call_anthropic(prompt, temperature=0.7)
            else:
                return self._mock_scenario(framework_name, difficulty)
            
            return json.loads(response)
        except Exception as e:
            print(f"LLM scenario generation error: {e}")
            return self._mock_scenario(framework_name, difficulty)
    
    async def generate_quiz_questions(
        self,
        framework_name: str,
        framework_concepts: list[str],
        num_questions: int,
        difficulty: str,
    ) -> list[dict]:
        """Generate quiz questions for a framework."""
        
        prompt = f"""
Create {num_questions} quiz questions for the "{framework_name}" framework.

Concepts to test: {', '.join(framework_concepts)}
Difficulty: {difficulty}

Generate JSON array of questions:
[
  {{
    "id": "q1",
    "question": "Question text",
    "type": "multiple_choice|free_response|calculation",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "A",
    "explanation": "Why this is correct",
    "framework_concept": "Concept name"
  }}
]

Mix question types. For calculation questions, include realistic numbers.
Return ONLY valid JSON array.
"""
        
        try:
            if self.provider == "openai" and self.client:
                response = await self._call_openai(prompt, temperature=0.5)
            elif self.provider == "anthropic" and self.client:
                response = await self._call_anthropic(prompt, temperature=0.5)
            else:
                return self._mock_questions(framework_name, num_questions)
            
            return json.loads(response)
        except Exception as e:
            print(f"LLM quiz generation error: {e}")
            return self._mock_questions(framework_name, num_questions)
    
    def _build_evaluation_prompt(
        self,
        stage_context: str,
        stage_type: str,
        user_response: str,
        correct_answer: Optional[str],
        framework_context: str,
    ) -> str:
        base = f"""You are an expert CEO coach evaluating a leader's decision-making.

Framework context: {framework_context}
Stage type: {stage_type}
Situation: {stage_context}
User's response: {user_response}
"""
        
        if correct_answer:
            base += f"Correct answer/approach: {correct_answer}\n"
        
        base += """
Provide feedback as JSON:
{
  "feedback": "Specific, actionable feedback (2-3 sentences). What they got right, what they missed.",
  "score": 0.0-1.0,
  "next_framework_suggestion": "Related framework to study next",
  "key_insights": ["Insight 1", "Insight 2"]
}

Be rigorous but encouraging. CEO-grade feedback.
"""
        return base
    
    async def _call_openai(self, prompt: str, temperature: float = 0.3) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert CEO coach and business strategy expert. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content
    
    async def _call_anthropic(self, prompt: str, temperature: float = 0.3) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            temperature=temperature,
            system="You are an expert CEO coach and business strategy expert. Respond only with valid JSON.",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def _parse_feedback(self, response: str) -> LLMFeedback:
        try:
            data = json.loads(response)
            return LLMFeedback(
                feedback=data.get("feedback", "Good effort."),
                score=max(0.0, min(1.0, data.get("score", 0.5))),
                next_framework_suggestion=data.get("next_framework_suggestion"),
                key_insights=data.get("key_insights", []),
            )
        except Exception:
            return LLMFeedback(feedback="Feedback parsing error.", score=0.5)
    
    def _mock_feedback(self, stage_type: str, user_response: str) -> LLMFeedback:
        return LLMFeedback(
            feedback=f"Good {stage_type} work. In practice, ensure you quantify assumptions and consider second-order effects.",
            score=0.7,
            next_framework_suggestion="Financial Mastery" if stage_type == "analysis" else "Strategic Decision-Making",
            key_insights=["Quantify impact", "Consider stakeholder perspectives"],
        )
    
    def _mock_scenario(self, framework_name: str, difficulty: int) -> dict:
        return {
            "title": f"{framework_name} Challenge",
            "description": f"A scenario testing {framework_name} application.",
            "difficulty": difficulty,
            "context": {
                "company": "Mid-market SaaS company, $10M ARR",
                "situation": "Facing strategic decision requiring framework application",
                "time_pressure": "Board meeting in 2 weeks",
                "data_provided": ["Financial summary", "Market data", "Team capacity"]
            },
            "stages": [
                {
                    "id": "stage-1",
                    "type": "diagnosis",
                    "prompt": "Which framework applies first?",
                    "options": [
                        {"id": "a", "label": framework_name, "score": 0.9, "rationale": "Directly addresses the core challenge"},
                        {"id": "b", "label": "SWOT Analysis", "score": 0.3, "rationale": "Too general for this specific decision"},
                        {"id": "c", "label": "Gut instinct", "score": 0.1, "rationale": "Insufficient for high-stakes decision"}
                    ],
                    "feedback_prompt_template": "User chose {option}."
                }
            ],
            "outcome_branches": {
                "optimal": {"title": "Strategic Win", "description": "Framework applied correctly, strong outcome"},
                "acceptable": {"title": "Mixed Results", "description": "Partial application, survivable outcome"},
                "failure": {"title": "Value Destruction", "description": "Wrong framework, poor outcome"}
            }
        }
    
    def _mock_questions(self, framework_name: str, num_questions: int) -> list[dict]:
        questions = []
        for i in range(num_questions):
            questions.append({
                "id": f"q{i+1}",
                "question": f"Sample question about {framework_name} concept {i+1}",
                "type": "multiple_choice",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "Option A",
                "explanation": "This is correct because...",
                "framework_concept": f"Concept {i+1}"
            })
        return questions


llm_service = LLMService()