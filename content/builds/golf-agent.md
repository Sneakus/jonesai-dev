---
draft: true
order: 2
title: Golf Agent
slug: golf-agent
summary: You describe a bad golf shot in your own words, and it works out the likely cause, then gives you one thing to focus on.
example:
  label: One of my test questions, in my own words
  question: "3w shot where ball was beneath my feet ended up in a slice wide right"
  answerLabel: What it said back (a real answer, 23 Sep 2026)
  answer:
    - "Slice caused by ball-below-feet lie, not a swing fault"
    - "Try this: Stay in your posture and let the club brush through low."
links:
  - label: Code on GitHub
    url: https://github.com/Sneakus/Golf-Agent
---

## How I tested it

I wrote the reference material by hand, plus 67 test questions to check its answers, including some it should refuse.

It had the right cause in its top five 97% of the time, and as its first choice 73% of the time. It turned down every question it couldn't answer.

<!-- EXAMPLE -->

It's still in testing.
