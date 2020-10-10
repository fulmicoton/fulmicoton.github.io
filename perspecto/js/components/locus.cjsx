React = require 'react'
line = require('./line.cjsx')
geometry = require '../geometry.coffee'
action = require '../actions.coffee'
Line = line.Line
path = line.path
Vec = geometry.Vec


eps = 0.001

withinCube = (point)->
    for i in [0...3]
        v = point.vals[i]
        if v > 1.0 or v < -1.0
            return false
    return true

findFrontier = (locus, outside, inside)->
    m = (outside + inside) / 2.0
    middlePoint = locus.getPoint(m)
    if -eps < outside - inside < eps
        middlePoint
    else
        if withinCube(middlePoint)
            findFrontier locus, outside, m
        else
            findFrontier locus, m, inside

cutLocus = (locus)->
    # given a locus returns the segment of its intersection
    # with the cube of radius 1
    leftOutside = -10.0
    rightOutside = 10.0
    inside = -locus.P.dot(locus.n)
    A = findFrontier locus, leftOutside, inside
    B = findFrontier locus, rightOutside, inside
    [A, B]


Handle = React.createClass
    # TODO had unbind on unmount
    onHandleDrag: (evt)->
        # $el = $ @getDOMNode()
        # $svg = $el.parents "svg"
        # offset = $svg.offset()
        # $svg.on "touchend.handledrag", (evt)=>
        #     $svg.off "mouseup.handledrag"
        #     $svg.off "touchmove.handledrag"
        # $svg.on "touchmove.handledrag", (evt)=>
        #     evtx = e.originalEvent.touches[0].pageX
        #     evty = e.originalEvent.touches[0].pageY
        #     pos = new Vec([evtx - offset.left, evty - offset.top])
        #     @props.moveCursor @props.coordinates.from(pos)
        #     e.preventDefault()


    onMouseDown: (evt)->
        $el = $ @getDOMNode()
        $svg = $el.parents "svg"
        offset = $svg.offset()
        $svg.on "mouseup.handledrag", (evt)=>
            $svg.off "mouseup.handledrag"
            $svg.off "mousemove.handledrag"
        $svg.on "mousemove.handledrag", (evt)=>
            pos = new Vec([evt.pageX - offset.left, evt.pageY - offset.top])
            @props.moveCursor @props.coordinates.from(pos)
            
    render: ->
        pos =  @props.coordinates.to @props.pos
        [cx, cy] = pos.vals
        <circle onMouseDown={@onMouseDown} onTouchStart={@onHandleDrag} className="handle" cx=cx cy=cy r="10" className="handle" />

projectOnSegment = (segment, pos)->
    A = segment.start
    B = segment.end
    n = B.diff(A).normalize()
    cos = pos.diff(A).dot(n)
    P = A.add(n.scale(cos))
    AP = P.diff(A)
    PB = B.diff(P)
    if AP.dot(PB) > 0
        P
    else
        if AP.norm() < PB.norm()
            A
        else
            B

Locus = React.createClass
    getInitialState: ->
        camera = @props.camera
        coordinates = @props.coordinates
        project = camera.projection.bind(camera) 
        [Astart, Aend] = cutLocus(@props.locusA).map project
        [Bstart, Bend] = cutLocus(@props.locusB).map project
        cursorA = Astart.add(Aend).scale 0.5
        cursorB = Bstart.add(Bend).scale 0.5
        "A":
            "start": Astart
            "end": Aend
        "B":
            "start": Bstart
            "end": Bend
        "cursorA": cursorA
        "cursorB": cursorB

    
    componentDidMount: ->       
        @moveCursorDic
            A: @state.cursorA
            B: @state.cursorB
        
    moveCursorDic: (dic)->
        c = {}
        c2 = {}
        for k, pos of dic
            projectedPos = projectOnSegment @state[k], pos
            c["cursor" + k] = projectedPos
            c2[k] = projectedPos
        @setState c   
        @props.onChange c2

    moveCursor: (handleId)->
        (pos)=>
            c = {}
            c[handleId] = pos
            @moveCursorDic c

    render: ->
        coordinates = @props.coordinates
        state = @state
        <g className="perspecto-rail">
            <Line A=state.A.start B=state.A.end coordinates=coordinates key="locusA" className="rail" />
            <Line A=state.B.start B=state.B.end coordinates=coordinates key="locusB" className="rail" />
            <Line className="candidate" A=state.cursorA B=state.cursorB coordinates=coordinates key="cursor"/>
            <Handle pos={state.cursorA} moveCursor={@moveCursor("A")} coordinates=coordinates id="A" key="handleA"/>
            <Handle pos={state.cursorB} moveCursor={@moveCursor("B")} coordinates=coordinates id="B" key="handleB"/>
        </g>

module.exports = Locus
