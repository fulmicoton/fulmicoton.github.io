removeEl = (arr, el, n=1)->
    # Remove the n first occurrences of el in array arr.
    # Removes all the occurences if given -1.
    # Returns the number of suppressed elements
    nbOcc = n
    while (nbOcc != 0)
        elId = arr.indexOf el
        if elId != -1
            arr.splice(elId, 1)
            nbOcc -= 1
        else
            return n-nbOcc
    n

class Event

    constructor: (@action_name)->
        @__listeners = []

    trigger: (args...)->
        @__listeners = @__listeners.slice 0
        for callback in @__listeners
            callback args...
    
    bind: (callback)->
        @__listeners.push callback

    unbind: (evtName, callback)->
        if callback?
            callbackIdx = callbacks.indexOf callback
            if callbacks.length == 0
                delete @__listeners[evtName]
        else
            @__listeners = []
        this


class EventCaster

    constructor: ->
        @__listeners = {}

    createAction: (evtName)->
        action = @__listeners[evtName]
        if action?
            return undefined
        else
            action = new Event(evtName)
            @__listeners[evtName] = action
            return action

    trigger: (evtName, args...)->
        listeners = @__listeners[evtName]
        if listeners?
            listeners.trigger args...
        
    bind: (evtName, callback)->
        action = @__listeners[evtName]
        if not action?
            action = @createAction evtName
        action.bind callback

    unbind: (evtName, callback)->
        action = @__listeners[evtName]
        if action?
            action.unbind callback
        this

class Store extends EventCaster

    constructor: ->
        super()
        if @init?
            @init()
        if @bindActions
            @bindActions()
        event_names = []
        if @events?
            event_names = @events()
        @events = {}
        for event_name in event_names
            @events[event_name] = new Event(event_name)

actions = (actions)->
    res = {}
    for action_name in actions
        action = new Event action_name
        if action?
            res[action_name] = action
        else
            console.error("Defined the action " + action_name + "twice")
    res

module.exports =
    Store: Store
    Event: Event
    EventCaster: EventCaster
    Store: Store
    actions: actions
