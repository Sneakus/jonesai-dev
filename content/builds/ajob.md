---
order: 2
title: AJob
slug: ajob
summary: Checks London startup job pages twice a day and emails me the few worth reading.
image:
  src: /builds/ajob-email.webp
  alt: An AJob email from 15 September. Job details are blurred. It shows 261 new jobs processed, 260 filtered out, and one fit
funnel:
  date: "15 September 2026, before the rebuild"
  start: 261 new jobs
  steps:
    - label: Keyword check
      out: 177
    - label: Cheap AI model
      out: 77
    - label: Stronger AI model
      out: 6
  end: 1 worth reading
---

## Where it came from

My current job is the job search, and I've already automated it.

## How it works

It checks 33 companies' job boards directly, plus the job boards of 16 venture capital firms, which covers hundreds of startups. A quick rules check and a cheap AI model screen every new job, then a stronger one reads the ones that get through. Every job it recommends comes with the line from the ad that decided it, and a check that the line is really in the ad.

Early runs have cost between 5p and 16p each. It runs twice a day, and it runs my current job search.

## What went wrong, and what I changed

The first version stopped being useful. It was meant to remember every job it had already checked, but it was only reading back about a third of that memory, so the same roles kept coming back. One closed job showed up six times. My search had also moved on from the criteria I built it with.

I fixed the memory, rewrote the criteria around the roles I actually fit, and made every recommendation show the line from the job ad that decided it. I tested the new version against 21 real roles I'd already judged by hand. After three rounds of fixes it agreed with me on 17, and it rejected every role I would have rejected.
