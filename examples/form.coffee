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

FormModel = potato.Model

    components:
        first_player: Profile
            components:
                age: potato.Integer
                    label: "ageeeeee"
            static:
                label: "First Player"
        second_player: Profile
            static:
                label: "Second Player"

FormExample = potato.View
    
    template: """
            <h1>Form Model Demonstration</h1>
            <#exampleForm/>
        """
    
    components:
        exampleForm: potato.FormFactory.FormOf(FormModel)
