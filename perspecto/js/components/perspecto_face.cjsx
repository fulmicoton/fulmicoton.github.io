React = require 'react'
Line = require('./line.cjsx').Line
geometry = require '../geometry.coffee'
store = require '../store.coffee'
actions = require '../actions.coffee'
states = require '../states.coffee'
Locus = require './locus.cjsx'


Vec = geometry.Vec
Camera = geometry.Camera
Coordinates = geometry.Coordinates


# P_Q = line1.P.diff(line2.P)
# P_Q_proj = line2.n.scale(line2.n.dot(P_Q))
# A = P_Q.diff(P_Q_proj)
# c = line1.n.dot(line2.n)
# B = line1.n.diff(line2.n.scale(c)).normalize()
# res = line1.P.add(line1.n.scale(A.dot(B)))
# res

resolve = (point1, camera1, point2, camera2)->
    # Because Cauchy sequences converge, bitches!
    line1 = camera1.antiprojection point1
    line2 = camera2.antiprojection point2
    point = line1.P
    for i in [0...100]
        point = line2.project(point)
        point = line1.project(point)
    point
    
PerspectoFace = React.createClass
    
    getInitialState: ->
        offset = new Vec([@props.size/2.0, @props.size / 2.0])
        scale = @props.size / 2.0
        {
            "points": [],
            "lines": store.getLines(),
            "incompleteLine": store.getIncompleteLine(),
            "coordinates": new Coordinates(offset, scale)
        }
    
    componentDidMount: ->
        store.events.change.bind (args...)=>
            @onChange(args...)

    componentWillUnmount: ->
        store.events.change.unbind (args...)=>@onChange(args...)

    onChange: ->
        @setState {
            "lines": store.getLines(),
            "incompleteLine": store.getIncompleteLine()
        }

    onClick: (evt)->
        el = @getDOMNode()
        coordinates = @state.coordinates
        mousePos = new Vec([evt.pageX - el.offsetLeft, evt.pageY -  el.offsetTop])
        pos = @state.coordinates.from mousePos
        faceState = @getFaceState()
        if faceState == states.INPUT
            points = @state.points.slice()
            points.push pos
            @setState({"points": points})
        
    onClickResolve: ->
        A = resolve(@state.incompleteLine.points[0], @state.incompleteLine.camera, @state.resolvedPoints.A, @props.camera)
        B = resolve(@state.incompleteLine.points[1], @state.incompleteLine.camera, @state.resolvedPoints.B, @props.camera)
        actions.resolve.trigger 
            points: [A.vals, B.vals]
            side: @props.id

    onClickCreate: ->
        points = @state.points.slice()
        @setState({"points": []})
        actions.newline.trigger
            points: points.slice()
            camera: @props.camera
            origin: @props.id

    setAB: (points)->
        resolvedPoints = $.extend({}, @state.resolvedPoints, points)
        @setState {"resolvedPoints": resolvedPoints}

    renderLastLine: ->
        if @props.viewOnly
            return null
        if not @state.incompleteLine?
            points = @state.points
            if points.length == 2
                [A, B] = points
                return <Line A={A} B={B} key={"incomplete"} coordinates={@state.coordinates} />
            else
                return null
        incompleteLine = @state.incompleteLine
        points = incompleteLine.points
        if points.length != 2
            return null
        else
            [A, B] = points
            if incompleteLine.origin == @props.id
                return <Line A={A} B={B} key={"incomplete"} coordinates={@state.coordinates} />
            else
                locusA = incompleteLine.camera.antiprojection A
                locusB = incompleteLine.camera.antiprojection B
                return <Locus onChange={@setAB} locusA={locusA} locusB={locusB} coordinates={@state.coordinates} camera={@props.camera} />

    getFaceState: ->
        store.getFaceState @props.id


    onClickCancel: ->
        @setState({"points": []})

    getButtons: (faceState)->
        if @props.viewOnly
            return null
        if faceState == states.RESOLVE
            <button className="big-button ok" onClick={@onClickResolve}>OK</button>
        else if (faceState == states.INPUT)
            if (@state.points.length == 2)
                [<button key="ok" className='big-button ok' onClick={@onClickCreate}>OK</button>,  <button key="cancel" className='big-button cancel' onClick={@onClickCancel}>Cancel</button>]
            else
                null

    render: ->
        lines = []
        offset = new Vec [@props.size/2,  @props.size/2]
        linesData = @state.lines
        camera = @props.camera
        lines = linesData.map (line, segmentId)=>
            points = line.points
            projA = camera.projection(new Vec(points[0]))
            projB = camera.projection(new Vec(points[1]))
            <Line A={projA} B={projB} key={segmentId} coordinates={@state.coordinates} className={line.className} />
        lastLine = @renderLastLine()
        faceState = @getFaceState()
        buttons = @getButtons faceState
        className = "perspecto " + "perspecto-" + faceState?.toLowerCase()
        <div className='perspecto-face'>
            <svg onClick={@onClick} className=className height={@props.size} width={@props.size}>
                {lines}
                {lastLine}
            </svg>
            {buttons}
        </div>


module.exports = PerspectoFace