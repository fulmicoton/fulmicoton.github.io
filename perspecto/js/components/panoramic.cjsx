React = require 'react'
PerspectoFace = require './perspecto_face.cjsx'
geometry = require('../geometry.coffee')
Camera = geometry.Camera
Vec = geometry.Vec

Panoramic = React.createClass
    
    getInitialState: ->
        {
            angle: 0.0,
            angleSpeed: 0.1
        }
    
    componentDidMount: ->
        @timer = window.setInterval @updateAngle, 100

    updateAngle: ->
        angle = @state.angle
        angleSpeed = @state.angleSpeed
        angle += angleSpeed
        if angle > Math.PI / 2
            angleSpeed = -Math.abs(angleSpeed)
        if angle < 0
            angleSpeed = Math.abs(angleSpeed)
        @setState 
            angle: angle
            angleSpeed: angleSpeed

    componentWillUnmount: ->
        console.log @timer
        window.clearInterval @timer

    render: ->
        cx = 2.5*Math.cos @state.angle
        cy = 2.5*Math.sin @state.angle
        camera = new Camera(new Vec [cx, cy, 0])
        <PerspectoFace camera=camera size=@props.size noLastLine />


module.exports = Panoramic
