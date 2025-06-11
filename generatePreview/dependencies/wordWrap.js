function splitWord(text, wordBreak) {
  text = text.trim()
  if (wordBreak === 'break-all') {
    return text.split('')
  } else {
    var array = text.split('')
    var reg = /[\d\w<:>]/
    return array.reduce(function(newArray, item) {
      if (!reg.test(item) || reg.test(item) && !reg.test(newArray[newArray.length - 1])) {
        newArray.push(item)
      } else if (!newArray.length) {
        newArray.push(item)
      } else {
        newArray[newArray.length - 1] += item
      }
      return newArray
    }, [])
  }
}

function getTextLine(ctx, text, font, containerWidth, options) {
  text = text.trim()
  options = options || {}
  var textOverflow = options.textOverflow
  var wordBreak = options.wordBreak || 'keep-all'
  var left = splitWord(text, wordBreak)
  var right = []
  var result = []
  var rest = []
  ctx.font = font

  var splitArray = function(textArray) {
    var count = Math.ceil(textArray.length / 2)
    left = textArray.slice(0, count)
    right = textArray.slice(count)
  }

  var joinText = function(textArrayA, textArrayB) {
    return textArrayA.concat(textArrayB).join('')
  }

  while (true) {
    var width = ctx.measureText(joinText(result, left)).width
    if (width <= containerWidth) {
      result =  result.concat(left) 
      splitArray(right)
    } else if (left.length === 1) {
      if (!result.length) {
        result = left
        rest = right.concat(rest)
      } else {
        rest = left.concat(right, rest)
      }
      break
    } else {
      rest = right.concat(rest)
      splitArray(left)
    }
  }

  if (typeof textOverflow === 'string' && textOverflow !== '' || typeof textOverflow === 'undefined') {
    if (textOverflow === 'ellipsis' || typeof textOverflow === 'undefined') {
      var postFix =['...']
    } else {
      var postFix = [textOverflow]
    }
    result = result.join('').split('')
    result = result.slice(0, result.length - 1).concat(postFix)
    while (true) {
      var width = ctx.measureText(result.join('')).width
      if (width <= containerWidth) {
        break
      } else {
        result = result.slice(0, result.length - 2).concat(postFix)
      }
    }
  }
  return {result: result.join('').trim(), rest: rest.join('').trim()}
}

function wrap(ctx, text, font, containerWidth, options) {
  options = options || {}
  var lineClamp = options.lineClamp || -1
  var textOverflow = options.textOverflow
  var wordBreak = options.wordBreak || 'keep-all'
  var resultArray = []
  var rest = text
  if (typeof font === 'number' && font.toString() !== 'NaN') {
    font = '' + font + 'px sans-serif'
  } 
  var i = 0
  while (true) {
    if (ctx.measureText(rest).width <= containerWidth) {
      resultArray.push(rest)
      break
    } else {
      var textLineObj = getTextLine(ctx, rest, font, containerWidth, {
        textOverflow: i >= lineClamp - 1 && lineClamp > 0 ? textOverflow : '', wordBreak})
      var result = textLineObj.result
      var rest = textLineObj.rest
      resultArray.push(result)
    }
    i += 1
    if (i == lineClamp) break
  }
  return resultArray
}

module.exports = wrap