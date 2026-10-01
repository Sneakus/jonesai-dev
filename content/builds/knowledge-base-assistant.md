---
order: 4
title: Knowledge base assistant
slug: builds/knowledge-base-assistant
summary: Whenever we updated something, it would automatically find every new contradiction and suggest a list of fixes.
card: Finds every contradiction an update causes across our documents, and suggests the fixes.
fixes:
  update: "Matches now last 15 minutes, down from 20."
  close: "Nothing changed until someone approved each fix."
  approved: approved
  items:
    - title: Game design document
      clash: "Each match is four 5-minute rounds."
      fix: "Each match is three 5-minute rounds."
    - title: Store page
      clash: "Jump in for a quick 20-minute match."
      fix: "Jump in for a quick 15-minute match."
    - title: Tournament rules
      clash: "A best-of-three final takes about an hour."
      fix: "A best-of-three final takes about 45 minutes."
---

## Where it came from

At my last company (a gaming startup) most of our knowledge base had quietly filled up with contradictions as we fleshed our design documentation out, so I built an assistant to fix it.

## An example

The update: "Matches now last 15 minutes, down from 20."

What it found:

1. Game design document: "Each match is four 5-minute rounds." Suggested fix: "Each match is three 5-minute rounds."

2. Store page: "Jump in for a quick 20-minute match." Suggested fix: "Jump in for a quick 15-minute match."

3. Tournament rules: "A best-of-three final takes about an hour." Suggested fix: "A best-of-three final takes about 45 minutes."

"Nothing changed until someone approved each fix."

<!-- FIXES -->

## What I changed

The first version made the changes itself and over-complicated the wording, so I added a step where someone had to approve each fix and told it to write more simply.

## What happened

The knowledge base ended up being the basis for our investor materials.

The code belongs to my last company, so there's no link.
