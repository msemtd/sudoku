// Sudoku Generator and Solver for node.js
// Copyright (c) 2011 Blagovest Dachev.  All rights reserved.
//
// This is a port of David Bau's python  implementation:
// http://davidbau.com/archives/2006/09/04/sudoku_generator.html
function makePuzzle (board) {
  const puzzle = []
  const deduced = Array(81).fill(null)
  const order = [...Array(81).keys()]
  shuffleArray(order)

  for (let i = 0; i < order.length; i++) {
    const pos = order[i]

    if (deduced[pos] === null) {
      puzzle.push({
        pos,
        num: board[pos]
      })
      deduced[pos] = board[pos]
      deduce(deduced)
    }
  }

  shuffleArray(puzzle)

  for (let i = puzzle.length - 1; i >= 0; i--) {
    const e = puzzle[i]
    removeElement(puzzle, i)
    const rating = checkPuzzle(boardForEntries(puzzle), board)

    if (rating === -1) {
      puzzle.push(e)
    }
  }

  return boardForEntries(puzzle)
}

function ratePuzzle (puzzle, samples) {
  let total = 0

  for (let i = 0; i < samples; i++) {
    const tuple = solveBoard(puzzle)

    if (tuple.answer === null) {
      return -1
    }

    total += tuple.state.length
  }

  return total / samples
}

function checkPuzzle (puzzle, board) {
  if (board === undefined) {
    board = null
  }

  const tuple1 = solveBoard(puzzle)

  if (tuple1.answer === null) {
    return -1
  }

  if (board != null && !boardMatches(board, tuple1.answer)) {
    return -1
  }

  const difficulty = tuple1.state.length
  const tuple2 = solveNext(tuple1.state)

  if (tuple2.answer != null) {
    return -1
  }

  return difficulty
}

function solvePuzzle (board) {
  return solveBoard(board).answer
}

function solveBoard (original) {
  const board = [].concat(original)
  const guesses = deduce(board)

  if (guesses === null) {
    return {
      state: [],
      answer: board
    }
  }

  const track = [{
    guesses,
    count: 0,
    board
  }]
  return solveNext(track)
}

function solveNext (remembered) {
  while (remembered.length > 0) {
    const tuple1 = remembered.pop()

    if (tuple1.count >= tuple1.guesses.length) {
      continue
    }

    remembered.push({
      guesses: tuple1.guesses,
      count: tuple1.count + 1,
      board: tuple1.board
    })
    const workspace = [].concat(tuple1.board)
    const tuple2 = tuple1.guesses[tuple1.count]
    workspace[tuple2.pos] = tuple2.num
    const guesses = deduce(workspace)

    if (guesses === null) {
      return {
        state: remembered,
        answer: workspace
      }
    }

    remembered.push({
      guesses,
      count: 0,
      board: workspace
    })
  }

  return {
    state: [],
    answer: null
  }
}

function deduce (board) {
  while (true) {
    let stuck = true
    let guess = null
    let count = 0 // fill in any spots determined by direct conflicts

    const tuple1 = figureBits(board)
    let allowed = tuple1.allowed
    let needed = tuple1.needed

    for (let pos = 0; pos < 81; pos++) {
      if (board[pos] === null) {
        const numbers = listBits(allowed[pos])

        if (numbers.length === 0) {
          return []
        } else if (numbers.length === 1) {
          board[pos] = numbers[0]
          stuck = false
        } else if (stuck) {
          const t = numbers.map(function (val, key) {
            return {
              pos,
              num: val
            }
          })
          const tuple2 = pickBetter(guess, count, t)
          guess = tuple2.guess
          count = tuple2.count
        }
      }
    }

    if (!stuck) {
      const tuple3 = figureBits(board)
      allowed = tuple3.allowed
      needed = tuple3.needed
    } // fill in any spots determined by elimination of other locations

    for (let axis = 0; axis < 3; axis++) {
      for (let x = 0; x < 9; x++) {
        const numbers = listBits(needed[axis * 9 + x])

        for (let i = 0; i < numbers.length; i++) {
          const n = numbers[i]
          const bit = 1 << n
          const spots = []

          for (let y = 0; y < 9; y++) {
            const pos = posFor(x, y, axis)

            if (allowed[pos] & bit) {
              spots.push(pos)
            }
          }

          if (spots.length === 0) {
            return []
          } else if (spots.length === 1) {
            board[spots[0]] = n
            stuck = false
          } else if (stuck) {
            const t = spots.map(function (val, key) {
              return {
                pos: val,
                num: n
              }
            })
            const tuple4 = pickBetter(guess, count, t)
            guess = tuple4.guess
            count = tuple4.count
          }
        }
      }
    }

    if (stuck) {
      if (guess != null) {
        shuffleArray(guess)
      }

      return guess
    }
  }
}

function figureBits (board) {
  const needed = []
  const allowed = board.map(function (val, key) {
    return val === null ? 511 : 0
  }, [])

  for (let axis = 0; axis < 3; axis++) {
    for (let x = 0; x < 9; x++) {
      const bits = axisMissing(board, x, axis)
      needed.push(bits)

      for (let y = 0; y < 9; y++) {
        const pos = posFor(x, y, axis)
        allowed[pos] = allowed[pos] & bits
      }
    }
  }

  return {
    allowed,
    needed
  }
}

function posFor (x, y, axis) {
  if (axis === undefined) {
    axis = 0
  }

  if (axis === 0) {
    return x * 9 + y
  } else if (axis === 1) {
    return y * 9 + x
  }

  return [0, 3, 6, 27, 30, 33, 54, 57, 60][x] + [0, 1, 2, 9, 10, 11, 18, 19, 20][y]
}

function axisFor (pos, axis) {
  if (axis === 0) {
    return Math.floor(pos / 9)
  } else if (axis === 1) {
    return pos % 9
  }

  return Math.floor(pos / 27) * 3 + Math.floor(pos / 3) % 3
}

function axisMissing (board, x, axis) {
  let bits = 0

  for (let y = 0; y < 9; y++) {
    const e = board[posFor(x, y, axis)]

    if (e != null) {
      bits |= 1 << e
    }
  }

  return 511 ^ bits
}

function listBits (bits) {
  const list = []

  for (let y = 0; y < 9; y++) {
    if ((bits & 1 << y) !== 0) {
      list.push(y)
    }
  }

  return list
}

function allowed (board, pos) {
  let bits = 511

  for (let axis = 0; axis < 3; axis++) {
    const x = axisFor(pos, axis)
    bits = bits & axisMissing(board, x, axis)
  }

  return bits
} // TODO: make sure callers utilize the return value correctly

function pickBetter (b, c, t) {
  if (b === null || t.length < b.length) {
    return {
      guess: t,
      count: 1
    }
  } else if (t.length > b.length) {
    return {
      guess: b,
      count: c
    }
  } else if (randomInt(c) === 0) {
    return {
      guess: t,
      count: c + 1
    }
  }

  return {
    guess: b,
    count: c + 1
  }
}

function boardForEntries (entries) {
  const board = Array(81).fill(null)

  for (let i = 0; i < entries.length; i++) {
    const item = entries[i]
    const pos = item.pos
    const num = item.num
    board[pos] = num
  }

  return board
}

function boardMatches (b1, b2) {
  for (let i = 0; i < 81; i++) {
    if (b1[i] !== b2[i]) {
      return false
    }
  }

  return true
}

function randomInt (max) {
  return Math.floor(Math.random() * (max + 1))
}

function shuffleArray (original) {
  // Swap each element with another randomly selected one.
  for (let i = original.length - 1; i > 0; i--) {
    const j = randomInt(i)
    const contents = original[i]
    original[i] = original[j]
    original[j] = contents
  }
}

function removeElement (array, from, to) {
  const rest = array.slice((to || from) + 1 || array.length)
  array.length = from < 0 ? array.length + from : from
  return array.push.apply(array, rest)
}

;
module.exports = {
  makePuzzle: function () {
    return makePuzzle(solvePuzzle(Array(81).fill(null)))
  },
  solvePuzzle,
  ratePuzzle,
  posFor
}
