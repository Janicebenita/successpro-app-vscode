# UX writing guide

SuccessPro is written for job seekers and working professionals, not for engineers or AI specialists.

## Voice

- Clear, calm, practical, and respectful.
- Focus on the user’s goal and next action.
- Prefer familiar words and short sentences.
- Explain limits honestly without exposing implementation details.
- Never make guarantees about interviews, jobs, salaries, or hiring decisions.

## Use plain language

Prefer:

- “Resume review” instead of “deterministic rubric”
- “Your results” instead of “evidence-led analysis”
- “Career profile” instead of “canonical profile”
- “We found details in your resume” instead of “structured extraction”
- “Reviews left this month” instead of “remaining allowance”
- “We could not read this file” instead of “parsing failed”
- “Job suggestions are coming soon” instead of “no connector is enabled”
- “Your plan” instead of “billing and entitlements”

## Buttons

Buttons should describe the result of the click:

- “Review my resume”
- “Check my match”
- “Save profile”
- “Add resume details”
- “Sign in to send a message”

Avoid vague or implementation-focused labels such as “Run”, “Execute”, “Process”, “Configure”, or “Submit” unless the audience expects them.

## Errors

Every error should answer:

1. What happened?
2. What can the user do next?

Do not expose provider names, error codes, stack traces, parser names, schemas, or infrastructure terms.

## Review checklist

Before shipping visible copy, check that:

- a first-time job seeker can understand it without help;
- the primary action is obvious;
- technical safeguards are translated into a user benefit;
- unavailable features say “coming soon” and do not imply they work;
- privacy choices are explicit and use ordinary language;
- labels remain meaningful on mobile and to screen-reader users.
