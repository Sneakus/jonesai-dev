---
draft: true
order: 4
title: Meeting plan agent
slug: meeting-plan-agent
summary: Turns a call with a customer into a clear plan, and lists what the call forgot to ask.
callPlan:
  callLabel: A two-minute call (made up, so I can show it)
  call:
    - who: Sam
      said: Thanks for making time, Rosie. Talk me through how wedding orders come in today.
    - who: Rosie
      said: They all come in by email. Couples send me their colours, the flowers they like, the date, sometimes a Pinterest board.
    - who: Sam
      said: And what happens after that?
    - who: Rosie
      said: Every Monday I copy each one into a spreadsheet by hand. It takes me most of the morning, about four hours.
    - who: Sam
      said: Is anyone else involved?
    - who: Rosie
      said: Just me. My assistant does the deliveries, she never touches the orders.
    - who: Sam
      said: What goes wrong?
    - who: Rosie
      said: I miss things. Last month I got a date wrong and nearly sent a whole wedding's flowers to the wrong Saturday.
    - who: Sam
      said: What would you want to end up with?
    - who: Rosie
      said: One sheet per wedding with everything on it, so I can order my stock straight from it.
    - who: Sam
      said: Does that sheet need to go anywhere else, like your accounts software?
    - who: Rosie
      said: I'm not sure. I'd have to ask my accountant.
    - who: Sam
      said: Okay. Thanks, Rosie, that's really useful.
  planLabel: The plan it wrote (real output, unedited lines)
  groups:
    - label: What Rosie told us
      items:
        - text: Rosie manually copies each order into a spreadsheet once a week, taking about four hours.
          quote: Every Monday I copy each one into a spreadsheet by hand. It takes me most of the morning, about four hours.
        - text: The manual process leads to mistakes, including a near-miss where a wedding's flowers were almost sent on the wrong date.
          quote: Last month I got a date wrong and nearly sent a whole wedding's flowers to the wrong Saturday.
    - label: What it suggests
      items:
        - text: Introduce a structured intake form (e.g. a simple web form or templated email reply) that couples fill in directly, which auto-populates a single per-wedding record - eliminating the manual weekly copy step and reducing the chance of transcription errors like the date mix-up.
    - label: What the call missed
      items:
        - text: The call did not establish a timeline for when Rosie wants a solution in place, nor any concrete definition of what a successful reduction in wasted time or errors would look like to her.
        - text: When would you like a new process in place by?
        - text: Can you check with your accountant whether the sheet needs to feed into your accounting software, and if so, which one?
links:
  - label: Read the full plan
    url: https://github.com/Sneakus/Meeting-Plan-Agent/blob/main/florist_call_plan.md
  - label: Code on GitHub
    url: https://github.com/Sneakus/Meeting-Plan-Agent
---

## Where it came from

It started as a take-home for an AI agency. The brief was verbal and left vague on purpose: after calls with customers, their team was taking too long to work out a plan. This solution took me about 90 minutes to build.

<!-- CALLPLAN -->

Every quote in the plan is checked against the call by plain code, not by the AI. On this call it checked 7 quotes and found all 7.

It's only been run on made-up calls so far.
