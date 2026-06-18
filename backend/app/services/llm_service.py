import json
from typing import Optional
from dataclasses import dataclass, field
import httpx
from app.config import settings


@dataclass
class LLMFeedback:
    feedback: str
    score: float
    next_framework_suggestion: Optional[str] = None
    key_insights: list[str] = field(default_factory=list)


class LLMService:
    def __init__(self, ollama_url: str = "", ollama_model: str = ""):
        self.provider = settings.llm_provider
        self.model = settings.llm_model
        self.ollama_url = ollama_url or settings.ollama_base_url or "http://localhost:11434"
        self.ollama_model = ollama_model or settings.ollama_model or "gemma3:latest"
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
            elif self.provider == "ollama":
                return "ollama_ready"
        return self._client

    def _check_api(self):
        if self.provider == "ollama":
            return  # Ollama requires no API key
        if not self.client:
            raise RuntimeError(
                "No LLM API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in backend/.env, "
                "or set LLM_PROVIDER=ollama to use a local Ollama instance."
            )

    def _get_system_prompt(self) -> str:
        return "You are an expert CEO coach and business strategy expert. Respond only with valid JSON."

    async def _call_provider(self, prompt: str, temperature: float = 0.3) -> str:
        if self.provider == "openai":
            return await self._call_openai(prompt, temperature)
        elif self.provider == "anthropic":
            return await self._call_anthropic(prompt, temperature)
        else:
            return await self._call_ollama(prompt, temperature)

    async def evaluate_scenario_response(
        self,
        stage_context: str,
        stage_type: str,
        user_response: str,
        correct_answer: Optional[str] = None,
        framework_context: str = "",
    ) -> LLMFeedback:
        self._check_api()
        prompt = self._build_evaluation_prompt(
            stage_context, stage_type, user_response, correct_answer, framework_context
        )
        response = await self._call_provider(prompt)
        return self._parse_feedback(response)

    async def generate_scenario(
        self,
        framework_name: str,
        framework_concepts: list[str],
        difficulty: int,
        context_hint: str = "",
    ) -> dict:
        self._check_api()
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
        response = await self._call_provider(prompt, temperature=0.7)
        return json.loads(response)

    async def generate_quiz_questions(
        self,
        framework_name: str,
        framework_concepts: list[str],
        num_questions: int,
        difficulty: str,
    ) -> list[dict]:
        self._check_api()
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
        response = await self._call_provider(prompt, temperature=0.5)
        return json.loads(response)

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
                {"role": "system", "content": self._get_system_prompt()},
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
            system=self._get_system_prompt(),
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    async def _call_ollama(self, prompt: str, temperature: float = 0.3) -> str:
        url = f"{self.ollama_url.rstrip('/')}/api/generate"
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json={
                "model": self.ollama_model,
                "prompt": f"{self._get_system_prompt()}\n\n{prompt}",
                "stream": False,
                "options": {"temperature": temperature},
            })
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

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


llm_service = LLMService()
