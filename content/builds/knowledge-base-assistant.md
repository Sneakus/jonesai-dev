---
order: 0
title: Knowledge base assistant
slug: builds/knowledge-base-assistant
summary: Whenever we updated something, it would automatically find every new contradiction and suggest a list of fixes.
card: Finds every contradiction an update causes across our documents, and suggests the fixes.
fixes:
  update: "Matches now last 8 minutes, down from 12."
  close: "Nothing changed until someone approved each fix."
  approved: approved
  items:
    - title: Game design document
      clash: "Each half lasts 6 minutes."
      fix: "Each half lasts 4 minutes."
    - title: Investor notes
      clash: "A typical session is three 12-minute matches."
      fix: "A typical session is three 8-minute matches."
    - title: Tournament rules
      clash: "A full knockout round takes about an hour."
      fix: "A full knockout round takes about 40 minutes."
---

## Where it came from

At my last company (a gaming startup) most of our knowledge base had quietly filled up with contradictions as we fleshed our design documentation out, so I built an assistant to fix it.

## An example (made up, so I can show it - the real documents were confidential)

The update: "Matches now last 8 minutes, down from 12."

What it found:

1. Game design document: "Each half lasts 6 minutes." Suggested fix: "Each half lasts 4 minutes."

2. Investor notes: "A typical session is three 12-minute matches." Suggested fix: "A typical session is three 8-minute matches."

3. Tournament rules: "A full knockout round takes about an hour." Suggested fix: "A full knockout round takes about 40 minutes."

"Nothing changed until someone approved each fix."

<!-- FIXES -->

## What I changed

The first version made the changes itself and over-complicated the wording, so I added a step where someone had to approve each fix and told it to write more simply.

## What happened

The knowledge base ended up being the basis for our investor materials.

The code belongs to my last company, so there's no link.
