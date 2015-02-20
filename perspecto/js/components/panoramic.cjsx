React = require 'react'
PerspectoFace = require './perspecto_face.cjsx'
geometry = require('../geometry.coffee')
Camera = geometry.Camera
Vec = geometry.Vec

Panoramic = React.createClass
    
    getInitialState: ->
        t: 0.0
        angle: 0.0,
        
    componentDidMount: ->
        @timer = window.setInterval @updateAngle, 50

    updateAngle: ->
        t = @state.t
        t += 0.1
        if t > 2*Math.PI
            t -= 2*Math.PI
        cos = Math.cos(t)
        angle = Math.PI / 4.0 + (Math.PI / 2.5)*Math.cos(t)
        if angle > Math.PI/2.0
            angle = Math.PI/2.0
        else if angle < 0
            angle = 0
        # angle = @state.angle
        # angleSpeed = @state.angleSpeed
        # angle += angleSpeed
        # if angle > Math.PI / 2
        #     angleSpeed = -Math.abs(angleSpeed)
        # if angle < 0
        #     angleSpeed = Math.abs(angleSpeed)
        @setState
            t: t
            angle: angle
        

    componentWillUnmount: ->
        console.log @timer
        window.clearInterval @timer

    render: ->
        cx = 2.5*Math.cos @state.angle
        cy = 2.5*Math.sin @state.angle
        camera = new Camera(new Vec [cx, cy, 0])
        <PerspectoFace camera=camera size=@props.size viewOnly />


module.exports = Panoramic
