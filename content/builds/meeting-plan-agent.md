---
draft: true
title: Meeting plan agent
slug: meeting-plan-agent
summary: A tool that turns a customer call transcript into a plan, and flags anything the call didn't cover.
repo: https://github.com/Sneakus/Meeting-Plan-Agent
transcript: https://github.com/Sneakus/Meeting-Plan-Agent/blob/main/sample_transcript.txt
plan: https://github.com/Sneakus/Meeting-Plan-Agent/blob/main/sample_transcript_plan.md
excerptLabel: From the plan it wrote for the test call. Unedited.
excerpt:
  findings:
    - claim: The customer identifies carrier sourcing on unfamiliar lanes as the primary bottleneck, not the rate lookup or margin steps.
      quote: |-
        Honestly? It's the carrier sourcing on the unfamiliar lanes. That's where the hours go. The rate sheet lookup is fine, the margin is fine, the sign-off is annoying but it's minutes not hours most of the time.
    - claim: Duplicated work from the unassigned inbox is called out as a second, separate source of wasted time.
      quote: |-
        I'd add the duplication. When two of us pick up the same request that's an hour of someone's day gone for nothing.
  gap: |-
    The 6-8 hour average and the split between 'known lane' and 'unfamiliar lane' cases is self-reported and explicitly unmeasured. It's also unclear how many people besides Marcus can approve sign-offs, and how often the >$8k threshold is actually triggered.
  questions:
    - Would you be open to a short measurement period (1-2 weeks) logging actual timestamps from email receipt to quote sent, so we're working from real numbers rather than a gut estimate?
    - Roughly what proportion of the 60-70 weekly requests fall into 'known lane' versus 'unfamiliar lane, needs sourcing'?
  judgementLabel: Agent judgement, built on the findings above - not customer-stated fact.
  judgement: |-
    Introduce a lightweight claiming/assignment mechanism on the shared inbox to eliminate duplicate quoting, and pair it with a structured carrier-sourcing aid (e.g. a maintained directory of carrier contacts and historical pricing per lane) to cut the hours currently spent cold-calling or waiting on load boards.
---

## Where it came from

It started as a take-home for an AI agency. The brief was verbal and left vague on purpose. Their team builds things for customers, and after discovery calls it was taking too long to work out a plan. The task was to fix that.

It took about 90 minutes. I didn't want the work to go to waste.

## What it does

Give it a call transcript and it writes a plan around three questions: how the work gets done today, what the customer wants to end up with, and when they need it.

Every line in the plan is one of three things:

- Quoted: something the customer actually said, with the line from the transcript underneath.
- Judgement: the tool's own read, labelled as that.
- Gaps: anything the call left open, with follow-up questions for next time.

<!-- EXCERPT -->

The quotes are checked by plain code, not by the model. If a quote isn't in the transcript, it gets flagged.

It's only been run on a made-up test call so far.
