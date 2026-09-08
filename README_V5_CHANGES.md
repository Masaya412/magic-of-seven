# v5 changes

## Online 2–4 players
- Room creator chooses 2, 3, or 4 players.
- Waiting room shows occupied/empty seats.
- Game starts only when the configured number of players has joined.
- Seat reservation uses Firestore transactions to reduce simultaneous-join collisions.
- Simultaneous draft waits for every player in the round.
- Existing engine turn order and scoring are reused for 2–4 players.

## Live opponent action tracking
- During another player's turn, a face-down card floats in the LIVE ACTION panel.
- Statuses: thinking, card selected, target selecting, committing.
- No card identity, number, or unconfirmed target is sent in preview documents.
- After the action is committed, the existing dark action overlay appears on all other clients.

## Firebase rules
New collections are used:
- `rooms/{code}/seats/{seat}`
- `rooms/{code}/previews/{uid}`

Publish the included `firebase/firestore.rules` before testing v5.
