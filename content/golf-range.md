---
draft: true
# Driving range outcomes for the Golf Agent page.
# "swipe" says what the visitor's swipe did (drafted by Claude).
# "tip" is a plain-English version of a fix from AJ's Golf Agent notes (golf-fault-corpus-v3.md), same meaning, simpler words.
# "source" is the entry it came from. Never shown to visitors.
good:
  - key: straight
    name: Straight
    swipe: A straight swipe through the middle of the ball.
    messages:
      - "Pure. Frame that one."
      - "Right down the middle."
  - key: draw
    name: Draw
    swipe: Your swipe curled slightly left at the end.
    messages:
      - "A tidy little draw."
  - key: fade
    name: Fade
    swipe: Your swipe curled slightly right at the end.
    messages:
      - "A gentle fade. Very controlled."
faults:
  - key: pull
    name: Pull
    swipe: You swiped up and to the left, in a straight line.
    tip: "Check where you're aiming before changing your swing. This one is usually an aim problem."
    source: F005
  - key: push
    name: Push
    swipe: You swiped up and to the right, in a straight line.
    tip: "Check where you're aiming first."
    source: F006
  - key: slice
    name: Slice
    swipe: Your swipe curled hard right at the end.
    tip: "Feel the clubhead swing out to the right of the target as it hits the ball."
    source: F001
  - key: pull-slice
    name: Pull-slice
    swipe: You swiped up and to the left, then curled right at the end.
    tip: "Swing more out to the right, but keep the clubface pointing at the target, or it'll just fly straight left instead."
    source: F002
  - key: push-slice
    name: Push-slice
    swipe: You swiped up and to the right, then curled right at the end.
    tip: "Let the clubface close a little earlier as you hit the ball."
    source: F003
  - key: hook
    name: Hook
    swipe: Your swipe curled hard left at the end.
    tip: "Keep your chest turning through the ball, instead of letting your hands flick it."
    source: F004
  - key: heel
    name: Heel strike
    swipe: You caught the ball on the side nearest you.
    tip: "Check how far you're standing from the ball before you change anything in your swing."
    source: F013
  - key: toe
    name: Toe strike
    swipe: You caught the ball on the side furthest from you.
    tip: "Keep your chest turning through, instead of pulling your arms in."
    source: F014
  - key: fat
    name: Fat
    swipe: You slowed down just before the ball.
    tip: "Get your hands slightly ahead of the club as you hit the ball."
    source: F007
  - key: thin
    name: Thin
    swipe: You rushed the swing through the ball.
    tip: "Feel the club brush the grass just after the ball."
    source: F008
  - key: topped
    name: Topped
    swipe: You snatched at it, really fast.
    tip: "Keep your chest over the ball as you hit it."
    source: F008 (F009 says "Same as F008")
  - key: air-shot
    name: Air shot
    swipe: Your swipe missed the ball completely.
    # Picked by how hard they swung. No tip from the notes, these are jokes with a nudge.
    messages:
      hard:
        - "Swung like you meant it. The ball didn't notice. Try easing off a bit."
        - "Big swing, no contact. Golf isn't a strength contest."
        - "All that effort and it's still on the tee. Swing at 80% and watch what happens."
      normal:
        - "Missed it. Happens to the best of us. Mostly to the rest of us."
        - "The ball is still sat there, judging you."
      slow:
        - "Was that a practice swing? Give it a proper go."
        - "Gentle. Too gentle. Commit to it."
        - "The ball will wait, but it won't move itself. Swing through it."
---
