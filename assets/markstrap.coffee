addMenus = ($h1)->
	major = 0
	minor = 0
	$navbar = $ "#sectionList ul.nav-list"
	$("h1, h2").each ->
		$headEl = $ this
		title = $headEl.html()
		$navElement = $ "<li>"
		if @tagName == "H1"
			major += 1
			minor = 0
			sectionId = "section_" + major
			$navElement.addClass "nav-header"
			$navElement.html "#{ title }"
		else
			@tagName == "H2"
			minor += 1
			sectionId = "section_" + major + "_" + minor
			$navElement.html "<a href='##{ sectionId }'>#{ title }</a>"
		$headEl.before $ "<span id='#{sectionId}' class='bookmark'></span>"
		$navbar.append $navElement
	
	$('[data-spy="scroll"]').each ->
		$(this).scrollspy 'refresh'

$ ->
	addMenus $ "body"
	$('#navbar').scrollspy {offset: 50}
