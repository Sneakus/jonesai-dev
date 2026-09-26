---
# Driving range outcomes for the Golf Agent page.
# "cause" says what happened in the swing, in plain words (drafted by Claude).
# "tip" is a plain-English version of a fix from AJ's Golf Agent notes (golf-fault-corpus-v3.md), same meaning, simpler words.
# "source" is the entry it came from. Never shown to visitors.
good:
  - key: straight
    name: Straight
    cause: "Smooth tempo, and your swipe came straight back up through where you started."
    messages:
      - "Right down the middle."
      - "Solid strike. That'll do nicely."
  - key: draw
    name: Draw
    cause: "A slight curl left at the end of your swipe closed the face a touch."
    messages:
      - "A tidy little draw."
  - key: fade
    name: Fade
    cause: "A slight curl right at the end of your swipe opened the face a touch."
    messages:
      - "A gentle fade. Very controlled."
faults:
  - key: pull
    name: Pull
    cause: "You swiped up and to the left with no curl, so it started left and stayed left."
    tip: "Check where you're aiming before changing your swing. This one is usually an aim problem."
    source: F005
  - key: push
    name: Push
    cause: "You swiped up and to the right with no curl, so it started right and stayed right."
    tip: "Check where you're aiming first."
    source: F006
  - key: slice
    name: Slice
    cause: "You swiped up and to the left, then curled right: across the ball with the face open."
    tip: "Feel the clubhead swing out to the right of the target as it hits the ball."
    source: F001
  - key: pull-slice
    name: Pull-slice
    cause: "You swiped well up and to the left and curled right, so it started left and bent right."
    tip: "Swing more out to the right, but keep the clubface pointing at the target, or it'll just fly straight left instead."
    source: F002
  - key: push-slice
    name: Push-slice
    cause: "Your swipe curled right at the end, so the face was open: it started right and kept going."
    tip: "Let the clubface close a little earlier as you hit the ball."
    source: F003
  - key: hook
    name: Hook
    cause: "Your swipe curled left at the end, shutting the face."
    tip: "Keep your chest turning through the ball, instead of letting your hands flick it."
    source: F004
  - key: heel
    name: Heel strike
    cause: "Your swipe came back up left of where you started, so you caught it near the heel."
    tip: "Check how far you're standing from the ball before you change anything in your swing."
    source: F013
  - key: toe
    name: Toe strike
    cause: "Your swipe came back up right of where you started, so you caught it out on the toe."
    tip: "Keep your chest turning through, instead of pulling your arms in."
    source: F014
  - key: fat
    name: Fat
    cause: "You slowed down or let go on the way up, so the club hit the ground first."
    tip: "Get your hands slightly ahead of the club as you hit the ball."
    source: F007
  - key: thin
    name: Thin
    cause: "You rushed the downswing and caught the middle of the ball."
    tip: "Feel the club brush the grass just after the ball."
    source: F008
  - key: topped
    name: Topped
    cause: "You snatched at it, far too fast, and only caught the top of the ball."
    tip: "Keep your chest over the ball as you hit it."
    source: F008 (F009 says "Same as F008")
  - key: air-shot
    name: Air shot
    cause: "Your swipe missed the ball completely."
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
hint: "Press when the balance marker crosses the gold bullseye, drag down into the gold band, then swipe up through the ball."
play: "Tap to play"
done: "Done"
perfect: "Perfect"
perfectName: "Perfect strike"
longest: "Longest drive"
balance: "Balance"
close: "Tap to close"
carry: "Carry"
noContact: "No contact"
onLine: "on line"
also: "Also"
letDown: "What let it down"
whyNot: "Why it wasn't perfect"
intro: "Try hitting a bad shot in the demo below."
resultSpot: "Your shot result appears here"
noWebgl: "This demo needs a browser that can show 3D. The real Golf Agent answer is below."
onRange: "On a real range"
purity: "Everything lined up: balance, length, tempo, path, face and strike. This one was"
pureTail: "% pure."
weightToes: "forward on your toes"
weightHeels: "back on your heels"
weightTrail: "back on your trail side"
weightLead: "lunging onto your lead side"
pressed: "You pressed with your weight"
pressFix: "Press as the marker crosses the bullseye."
letGo: "You let go before your swipe got back to the dotted line."
letGoFix: "Swipe all the way up through where you started."
tooShort: "Your backswing was too short."
overswung: "You overswung."
lengthFix: "Stop in the gold band on the meter."
rushed: "You rushed the downswing."
tooSlow: "Your downswing was too slow."
tempoFix: "Swipe up at a smooth, even pace."
wentLeft: "Your swipe went up to the left."
wentRight: "Your swipe went up to the right."
pathFix: "Swipe straight back up."
curledLeft: "Your swipe curled left at the end."
curledRight: "Your swipe curled right at the end."
faceFix: "Keep the end of your swipe straight."
missedLeft: "You came back up left of the dotted line"
missedRight: "You came back up right of the dotted line"
fromBalance: ", partly from your balance"
strikeFix: "Come back up through the middle of the dotted line."
---
