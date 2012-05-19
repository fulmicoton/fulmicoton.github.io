Example = potato.Model
    
    properties:
        application: potato.View
    
    components:
        label: potato.String
        coffeeScript: potato.String
    
    static:
        makeFromCoffeeScript: (label, coffeeScript) ->
            example = Example.make
                "label": label
                "coffeeScript": coffeeScript
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
        
        editorConfig: ->
            lineNumbers: true
            lineWrapping: true
            theme: "neat"
            smartIndent: false
            tabSize: 2
            indentWithTabs: false
            indentUnit: 2
            mode:  "coffeescript"

ExamplePreview = potato.View
    
    el : "<div class='preview'>"
    components:
        example: potato.View
    methods:
        load: (example) ->
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
                <#editor/>
            </div>
            <div id="content" class="span4 content">
               <#preview/>
            </div>
        </div>
    """

    model: potato.MapOf(Example)

    methods:
        load: (exampleLabel, exampleSrc)->
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
        exampleApplication.load exampleId, exampleSrc
