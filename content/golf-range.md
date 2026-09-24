---
draft: true
# Driving range outcomes for the Golf Agent page.
# "cause" says what happened in the swing, in plain words (drafted by Claude).
# "tip" is a plain-English version of a fix from AJ's Golf Agent notes (golf-fault-corpus-v3.md), same meaning, simpler words.
# "source" is the entry it came from. Never shown to visitors.
good:
  - key: straight
    name: Straight
    cause: "Smooth tempo, the club at the right height, and the face and swing lined up."
    messages:
      - "Pure. Frame that one."
      - "Right down the middle."
  - key: draw
    name: Draw
    cause: "The clubhead came through a touch early, curving it gently left."
    messages:
      - "A tidy little draw."
  - key: fade
    name: Fade
    cause: "The clubhead came through a touch late, curving it gently right."
    messages:
      - "A gentle fade. Very controlled."
faults:
  - key: pull
    name: Pull
    cause: "You came down steep, across the ball, with the face pointing the same way."
    tip: "Check where you're aiming before changing your swing. This one is usually an aim problem."
    source: F005
  - key: push
    name: Push
    cause: "You came from underneath, out to the right, with the face pointing the same way."
    tip: "Check where you're aiming first."
    source: F006
  - key: slice
    name: Slice
    cause: "The club lagged behind your hands at impact, so the face was open."
    tip: "Feel the clubhead swing out to the right of the target as it hits the ball."
    source: F001
  - key: pull-slice
    name: Pull-slice
    cause: "You came down steep across the ball, and the club lagged behind your hands."
    tip: "Swing more out to the right, but keep the clubface pointing at the target, or it'll just fly straight left instead."
    source: F002
  - key: push-slice
    name: Push-slice
    cause: "You came from underneath, and the club lagged behind your hands."
    tip: "Let the clubface close a little earlier as you hit the ball."
    source: F003
  - key: hook
    name: Hook
    cause: "The clubhead overtook your hands before impact, so the face shut."
    tip: "Keep your chest turning through the ball, instead of letting your hands flick it."
    source: F004
  - key: heel
    name: Heel strike
    cause: "Your hands drifted away from your body, so you caught it near the heel of the club."
    tip: "Check how far you're standing from the ball before you change anything in your swing."
    source: F013
  - key: toe
    name: Toe strike
    cause: "You pulled your arms in, so you caught it near the tip of the club."
    tip: "Keep your chest turning through, instead of pulling your arms in."
    source: F014
  - key: fat
    name: Fat
    cause: "The club hit the ground before it reached the ball."
    tip: "Get your hands slightly ahead of the club as you hit the ball."
    source: F007
  - key: thin
    name: Thin
    cause: "The club came in too high and caught the middle of the ball."
    tip: "Feel the club brush the grass just after the ball."
    source: F008
  - key: topped
    name: Topped
    cause: "The club came in way too high and only caught the top of the ball."
    tip: "Keep your chest over the ball as you hit it."
    source: F008 (F009 says "Same as F008")
  - key: air-shot
    name: Air shot
    cause: "The club missed the ball completely."
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
