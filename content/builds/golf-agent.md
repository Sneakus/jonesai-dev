---
draft: true
order: 2
title: Golf Agent
slug: golf-agent
summary: You describe a bad golf shot in your own words, and it works out the likely cause, then gives you one thing to focus on.
example:
  label: One of my test questions, in my own words
  question: "3w shot where ball was beneath my feet ended up in a slice wide right"
  answerLabel: What it said back (a real answer, 25 Sep 2026)
  answer:
    - "What happened: A ball-below-feet sidehill lie naturally promotes a slice with a fairway wood."
    - "Before your next shot:"
    - "- Aim left to allow for the right curve."
    - "- Flex your knees more at address to get down to the ball."
    - "- Hold the club near the end of the grip, ball is further away."
    - "Swing thought: Feel the same height through the ball, no rising up."
links:
  - label: Code on GitHub
    url: https://github.com/Sneakus/Golf-Agent
---

## How I tested it

I wrote the reference material by hand, plus 67 test questions to check its answers, including some it should refuse.

It had the right cause in its top five 97% of the time, and as its first choice 73% of the time. It turned down every question it couldn't answer.

<!-- EXAMPLE -->

It's still in testing.
