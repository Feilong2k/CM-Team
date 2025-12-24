That Plan B makes sense, and it’s a known pattern: __“planner model” → “executor model”__ (sometimes called a broker / tool proxy).

### Why it can work (especially vs DeepSeek tool issues)

- You isolate tool-call correctness into a model that is better at structured outputs (4o-mini).

- DeepSeek only has to produce a __small, constrained JSON step plan__, not perfect tool call syntax.

- You can make the executor *purely deterministic*:

  - it must emit only tool calls
  - it must stop after N tool calls
  - it must return a strict JSON result

### Key design choice: what JSON does DeepSeek output?

I’d keep it extremely simple, like:

- `intent`: short string
- `steps`: array of `{ tool, action, params, rationale }`
- `constraints`: `{ maxTools, allowWrite, projectId, requestId }`

Then 4o-mini’s job is:

1. Validate the JSON against schema
2. Execute the next step only
3. Return `{ result, nextQuestion? }`

### Failure modes / risks

- Higher cost + latency (two model calls per iteration)
- Cross-model mismatch (planner assumes a tool exists / params shape differs)
- You still need the same orchestration controls (budgets, dedupe, refusal injection)

### How it relates to triggered-phase protocol

Triggered-phase protocol is “controller-side enforcement”. Planner→executor is “model-side specialization”. They can combine well:

- Triggered-phase remains the outer controller.
- Executor model (4o-mini) handles tool correctness inside the Tool Phase.

### My recommendation

- Try triggered-phase first (cheaper, simpler, doesn’t add a second model).
- If DeepSeek still causes issues, adopt Plan B __but keep the same outer budgets/guardrails__.

If you want, I can draft a short spec for Plan B in a new design doc (JSON schema + orchestration sequence + acceptance criteria).
