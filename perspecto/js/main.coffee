PerspectoScene = require './components/perspecto.cjsx'
React = require 'react'
store = require './store.coffee'

$ ->
	React.render <PerspectoScene size="400" store={store}/>, $(".perspecto")[0]
