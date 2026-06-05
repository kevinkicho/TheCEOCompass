import json
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class StageResult:
    next_stage_id: Optional[str]
    feedback: Optional[dict]
    is_complete: bool
    outcome_branch: Optional[str]
    final_score: Optional[float]


class ScenarioEngine:
    def __init__(self, scenario):
        self.scenario = scenario
        self.stages = json.loads(scenario.stages)
        self.outcome_branches = json.loads(scenario.outcome_branches)
        self.stage_map = {stage["id"]: stage for stage in self.stages}
        self.choices = {}
        self.scores = []
    
    def now(self):
        return datetime.utcnow()
    
    def evaluate_stage(self, stage_id: str, choice_id: Optional[str], free_response: Optional[str]) -> StageResult:
        stage = self.stage_map.get(stage_id)
        if not stage:
            raise ValueError(f"Stage {stage_id} not found")
        
        # Store choice
        self.choices[stage_id] = {"choice_id": choice_id, "free_response": free_response}
        
        # Score the choice if multiple choice
        if choice_id and stage.get("options"):
            option = next((opt for opt in stage["options"] if opt["id"] == choice_id), None)
            if option:
                self.scores.append(option["score"])
        
        # Determine next stage
        current_index = self.stages.index(stage)
        next_stage = self.stages[current_index + 1] if current_index + 1 < len(self.stages) else None
        
        # Generate feedback for this stage
        feedback = None
        if choice_id or free_response:
            feedback = self._generate_feedback(stage, choice_id, free_response)
        
        if next_stage:
            return StageResult(
                next_stage_id=next_stage["id"],
                feedback=feedback,
                is_complete=False,
                outcome_branch=None,
                final_score=None,
            )
        else:
            # Scenario complete - calculate final outcome
            final_score = sum(self.scores) / len(self.scores) if self.scores else 0.0
            outcome_branch = self._determine_outcome(final_score)
            
            return StageResult(
                next_stage_id=None,
                feedback=feedback,
                is_complete=True,
                outcome_branch=outcome_branch,
                final_score=final_score,
            )
    
    def _generate_feedback(self, stage: dict, choice_id: Optional[str], free_response: Optional[str]) -> dict:
        # This is a placeholder - in production, this would call the LLM service
        if stage["type"] in ["diagnosis", "analysis"] and choice_id:
            option = next((opt for opt in stage.get("options", []) if opt["id"] == choice_id), None)
            if option:
                return {
                    "feedback": option.get("rationale", "Good choice."),
                    "score": option["score"],
                    "next_framework_suggestion": self._suggest_next_framework(stage, choice_id),
                    "key_insights": [option.get("rationale", "")]
                }
        
        if stage["type"] in ["analysis", "decision"] and free_response:
            return {
                "feedback": "Good analysis. Consider the financial implications more deeply.",
                "score": 0.75,
                "next_framework_suggestion": "Financial Mastery",
                "key_insights": ["Quantify impact", "Consider second-order effects"]
            }
        
        return {
            "feedback": "Stage completed.",
            "score": 0.5,
            "next_framework_suggestion": None,
            "key_insights": []
        }
    
    def _suggest_next_framework(self, stage: dict, choice_id: str) -> Optional[str]:
        suggestions = {
            "stage-1": "competitive-market-analysis",
            "stage-2": "financial-mastery",
            "stage-3": "strategic-decision-making",
            "stage-4": "organizational-people",
        }
        return suggestions.get(stage["id"])
    
    def _determine_outcome(self, final_score: float) -> str:
        if final_score >= 0.8:
            return "optimal"
        elif final_score >= 0.5:
            return "acceptable"
        else:
            return "failure"