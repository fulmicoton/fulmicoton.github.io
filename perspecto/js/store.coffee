actions = require './actions.coffee'
fulmicoton = require './fulmicoton.coffee'
states = require './states.coffee'


# 3 possible "external" state for a face
# - INPUT    waiting for line
# - RESOLVE  resolve line
# - WAITING  


class PerspectoStore extends fulmicoton.Store

    events: -> ["change"]

    bindActions: ->
        actions.newline.bind (line) =>
            @onNewLine(line)
        actions.resolve.bind (line) =>
            @onResolve(line)

    init: ->
        @lines = [
            {'points': [[1,1,1],[-1,1,1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[1,1,1],[1,-1,1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[1,1,1],[1,1,-1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[-1,-1,-1],[-1,1,-1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[-1,-1,-1],[1,-1,-1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[-1,-1,-1],[-1,-1,1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[-1,1,1],[-1,1,-1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[-1,1,1],[-1,-1,1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[1,-1,1],[ 1,-1, -1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[1,-1,1],[-1,-1, 1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[1,1,-1],[ 1,-1,-1]], 'side': 'l', 'className': 'perspecto-cube'},
            {'points': [[1,1,-1],[-1, 1,-1]], 'origin': 'right', 'className': 'perspecto-cube'},
        ]
        @incompleteLine = null
    
    getLines:->
        @lines

    getFaceState: (faceId)->
        if @incompleteLine?
            if @incompleteLine.origin == faceId
                states.WAITING
            else
                states.RESOLVE
        else if @lines.length == 0
            {'left': states.INPUT, 'right': states.IDLE}[faceId]
        else
            lastLineOrigin = @lines[@lines.length - 1].origin
            if lastLineOrigin == faceId
                states.WAITING
            else
                states.INPUT

    getIncompleteLine: ->
        @incompleteLine

    #---------------------
    onNewLine: (line)->
        @incompleteLine = line
        @events.change.trigger()

    onResolve: (line)->
        console.log "line", line
        @incompleteLine = undefined
        @lines.push line
        @events.change.trigger()



module.exports = new PerspectoStore()
