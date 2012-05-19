TodoModel = potato.Model
    components:
        text: potato.NonEmptyString
        done: potato.Boolean

TodoForm = potato.View
    template: "<input class='addTodo'/>"
    events:
        "@el input.addTodo" : keyup : (e)->
            if e.keyCode == 13
                newTodoData = 
                    text : @find("input").val()
                    done: false
                if TodoModel.isValid newTodoData
                    newTodo = TodoModel.make newTodoData
                    @trigger "submit", newTodo
    methods:
        clear: -> @find("input").val ""

TodoView = potato.View
    template: """
      <input class="check" {{tagChecked}} type="checkbox"/>
      <div class="todo-text {{tagChecked}}">{{ model.text }}</div>
      <button class='delete'><i class="icon-remove"></i></button>
    """
    el: "<li>"
    model: TodoModel   
    events:
        "@el input.check" : change : (evt)->
            isDone = @find("input").attr("checked")=="checked"
            @model.set "done": isDone
        "@el button.delete": click : ->
            @model.destroy()
        "@model":
            "change": -> @render()
            "delete": -> @destroy()
    methods:
        tagChecked: ->
            if @model.done then "checked" else ""

TodoExample = potato.View
    template: """
        <h1>Todo List</h1>
        <#addToDoForm/>
        <#todoListView/>
        <#counter/>
        """

    model: potato.CollectionOf(TodoModel)
        methods:
            remaining: ->
                ( @filter (todo)->not todo.done ).length

    components:
        addToDoForm: TodoForm
        todoListView: potato.CollectionViewOf(TodoView)
            el: "<ul class='todos'>"
        counter: potato.TemplateView
            template: "{{ count }} remaining"
            context: -> count: @model.remaining()

    events:   
        "@addToDoForm": submit: (todo)->
            @addToDoForm.clear()
            @model.addData todo
        "@model":
            add: (todo) -> @todoListView.addData todo
            change: -> @counter.render this