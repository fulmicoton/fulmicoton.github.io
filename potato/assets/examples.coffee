Example = potato.Model
    
    properties:
        application: potato.View
    
    components:
        label: potato.String
        coffeeScript: potato.String

    methods:
        loadFromCoffeescript: (source)->
            @application = CoffeeScript.eval source
            this
    
    static:
        makeFromCoffeeScript: (label, coffeeScript) ->
            example = Example.make
                label: label
                coffeeScript: coffeeScript
            example.application = CoffeeScript.eval coffeeScript
            example

ExampleEditor = potato.View
    
    el: "<div class='editor-container'>"

    events:
        "": "render":  ->
            @editor = CodeMirror @el.get(0), @editorConfig()
    
    methods:
        load: (example)->
            @editor.setValue example.coffeeScript
        
        content: ->
            @editor.getValue()
        
        editorConfig: ->
            lineNumbers: true
            lineWrapping: true
            theme: "neat"
            smartIndent: false
            tabSize: 2
            indentWithTabs: false
            indentUnit: 4
            mode:  "coffeescript"

ExamplePreview = potato.View
    
    el : "<div class='preview loading'>"
    components:
        example: potato.View
    methods:
        load: (example) ->
            @el.removeClass "loading"
            setTimeout =>
                @el.addClass "loading", 1
                @application = example.application.loadInto @el

ExampleApplication = potato.View
    
    template: """
        <div class="row-fluid">
            <div class="span2">
                <div class="sidebar-nav sidebar-nav-fixed">
                    <#menu/>
                </div>
            </div>
            <div class="span6 content">
                <button class="reload"><i class="icon-refresh"> </i> Reload</button>
                <button class="play"><i class="icon-play"></i> Run Code</button>
                <#editor/>
            </div>
            <div id="content" class="span4 content">
                <#preview/>
            </div>
        </div>
    """

    model: potato.MapOf(Example)

    methods:
        loadUrl: (exampleLabel, exampleSrc)->
            $.get "examples/"+exampleSrc, {}, (source)=>
                example = Example.makeFromCoffeeScript exampleLabel, source
                @addExample exampleSrc, example
        
        addExample: (exampleId, example)->
            @menu.addItem exampleId, example.label
            @model[exampleId] = example
            @menu.render()
                
    components:
        menu: potato.TabMenu
            el: "<ul class='menu nav nav-list'>"
            template: """
                <li class="nav-header">Examples</li>
                {{#model}}<li data-item_id='{{id}}'><a>{{label}}</a></li>{{/model}}
            """
        editor:     ExampleEditor
        preview:    ExamplePreview
    
    events:
        "button.play": "click": ->
            source = @editor.content()
            exampleId = @menu.selected
            example = @model[exampleId]
            example.loadFromCoffeescript source
            @preview.load example
        "button.reload": "click": ->
            exampleId = @menu.selected
            example = @model[exampleId]
            @editor.load example
            @preview.load example
        "@menu" : "select" : (exampleId)-> 
            example = @model[exampleId]
            @editor.load example
            @preview.load example
        
# --------------------------

EXAMPLES = 
    Todo: "todo.coffee"
    Form: "form.coffee"
    Scraper: "scraper.coffee"
    Inheritance: "inheritance.coffee"

$ ->
    window.exampleApplication = ExampleApplication.loadInto $ "#container"
    for exampleId, exampleSrc of EXAMPLES
        exampleApplication.loadUrl exampleId, exampleSrc
