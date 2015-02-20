React = require 'react'
PerspectoFace = require './perspecto_face.cjsx'
Panoramic = require './panoramic.cjsx'
geometry = require '../geometry.coffee'

Vec = geometry.Vec
Camera = geometry.Camera


PerspectoScene = React.createClass
	render: ->
		camera1 = new Camera(new Vec [0, 2.5, 0])
		camera2 = new Camera(new Vec [2.5, 0, 0])
		<div>
			<PerspectoFace camera=camera1 size=@props.size id="left" />
			<PerspectoFace camera=camera2 size=@props.size id="right" />
			<Panoramic size=@props.size />
		</div>

class Scene
	constructor: (@lines)->
		if not @lines?
			@lines = []
	addLine: (line)->
		@lines.push line

module.exports = PerspectoScene
