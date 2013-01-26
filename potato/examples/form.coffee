Profile = potato.Model
    static:
        label: "Profile"
    components:
        nickname: potato.String
            label: "Nickname"
            is_valid: ->
        first_name: potato.String
            label: "First Name"
        last_name: potato.String
            label: "Last Name"
        age: potato.Integer
            label: "Age"
            MIN: 14
            MAX: 130
        admin: potato.Boolean
            label: "Admin"


FormModel = potato.Model

    components:
        first_player: Profile
            static:
                label: "First Player"
        second_player: Profile
            static:
                label: "Second Player"

FormExample = potato.View
    
    template: """
            <h1>Form Model Demonstration</h1>
            <#exampleForm/>
            <button>click</button>
        """
    events:
        "button": "click": ->
            window.exampleForm = @exampleForm
            potato.log "Current form info :", @exampleForm.validate()
        "": "render": ->
            model = FormModel.make
                first_player:
                    nickname: "Patoulette"
                    age: 12
                second_player:
                    age: 15
            @exampleForm.val model
                
    components:
        exampleForm: potato.FormFactory.FormOf(FormModel)
