React = require 'react'

path = (p1, p2)->
    [x1, y1] = p1.vals
    [x2, y2] = p2.vals
    "M " + (x1|0) + " " + (y1|0) + " L " + (x2|0) + " " + (y2|0)

Line = React.createClass
    render: ->
        coordinates = @props.coordinates
        A = coordinates.to @props.A
        B = coordinates.to @props.B
        className = "perspecto-line"
        if @props.className?
        	className += " " + @props.className
        <path d={path(A, B)} className=className />

module.exports =
	Line: Line
	path: path