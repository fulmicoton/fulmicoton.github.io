# One can describes Potato as a composition of 
# literal object. Here we extend the potato "Model"
Name = potato.Model
    components:
        firstName: potato.String
            default: "Marcel"
        lastName: potato.String
            default: "Patulacci"
    methods:
        toString: ->
            @firstName + " " + @lastName

# Use his defined potatoes within other 
# objects.
Profile = potato.Potato   
    components:
        name: Name

# Or even define such potatoes inline.
Profile = potato.Potato   
    components:
        name: potato.Potato
            components:
                firstName: potato.String
                lastName: potato.String

# Extend and override stuff (here american name have
# firstnames, lastnames, and middle names)
AmericanName = Name
    components:
        middleName: potato.String
            default: "Robert"
    methods:
        toString: ->
            @firstName + " " + @middleName + " " + @lastName

# Override components m( O_O )m
ItalianName = AmericanName
    components:
        middleName: potato.String
            default: "Roberto"


InheritanceExample = potato.View
    template: """
        <h1>No demo only code here sorry!</h1>
    """
    events:
        "": "render": ->
            # And obviously free lunch !
            potato.log AmericanName.make().toJSON()
            potato.log AmericanName.make({ firstName: "Richard" }).toJSON()
