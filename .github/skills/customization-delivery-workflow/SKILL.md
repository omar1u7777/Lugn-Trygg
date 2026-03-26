---
name: customization-delivery-workflow
description: 'Create or update customizations (.instructions.md, .agent.md, hooks, SKILL.md) with a strict workflow: draft, validate schema/errors, fix issues, summarize outcomes, and finish with completion signaling. Use for reliable customization delivery in Lugn & Trygg.'
argument-hint: 'What customization should be created or updated, and what policy/workflow should it enforce?'
user-invocable: true
disable-model-invocation: false
---

# Customization Delivery Workflow

This skill packages a repeatable method for creating and hardening Copilot customizations in this repository.

## When to Use
- You need to create or update any of: instructions, hooks, custom agents, or skills.
- You want deterministic quality checks before considering customization work done.
- You want consistent completion behavior with explicit verification notes.

## Inputs to Capture First
1. Scope: workspace or personal customization.
2. Primitive: instruction, hook, agent, or skill.
3. Enforcement level: guidance-only, ask-for-approval, or hard block.
4. Target files/folders and stack impact (React/TypeScript, Flask/Python, or cross-layer).

## Procedure
1. Extract workflow intent from user request and recent conversation patterns.
2. Select the correct customization primitive and destination path.
3. Draft minimal, keyword-rich frontmatter for discoverability.
4. Implement concise, actionable body content with explicit completion criteria.
5. Validate created/edited files using diagnostics.
6. If validation fails, repair schema/content and revalidate.
7. Summarize enforcement behavior, test strategy, and residual risk.

## Decision Points
- Instruction vs Hook:
Instruction when behavior is guidance.
Hook when behavior must be deterministic at runtime.

- Agent vs Skill:
Agent for focused persona/tool boundaries.
Skill for reusable multi-step workflow.

- applyTo usage:
Use applyTo only for file-pattern rules.
Avoid broad always-on scope unless truly global.

## Quality Gates
- Frontmatter is valid and discoverable (name/description rules met).
- Paths and filenames follow expected customization locations.
- Behavior is auditable and not over-broad.
- Validation results are reported, including skipped checks and why.

## Completion Contract
1. Provide a short summary of what was implemented.
2. Confirm validation status and any fixes applied.
3. End with explicit completion signaling when required by runtime policy.

## Output Format
- Created/updated files
- What the customization enforces
- Validation run and result
- Open risks or follow-up recommendations
