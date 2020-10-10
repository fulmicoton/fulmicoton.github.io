Object = potato.Potato
    static:
        selector: "div"
        scrap: (dom)->
            @scrapFromContainer jquery(dom).find(@selector).first()        
        scrapFromContainer: ($container)->
            res = {}
            for k,v of @components()
                res[k] = v.scrap $container
            res

Text = potato.String
    selector: "div"
    scrap: (dom)->
        jquery(dom).find(@selector).first().text()


List = (type) -> potato.ListOf(type)
    selector: "div"   
    scrap: (dom)->
        @scrapFromContainer jquery(dom).find @selector
    scrapFromContainer: ($container)->
        $itemContainers = $container.find @itemType.selector
        res = []
        $itemContainers.each (elId, $el)=>
            res.push @itemType.scrapFromContainer $el
        res




###
And then one might use this to scrap forums easily 
just by describing the objects he wants to scrap and the 
javascript relative selector associated.
###

Post = Object
    # Describes a Post.
    #A Post has an author and a body.
    static:
        selector: "table.tborder"
    
    components:
        author: Text
            selector: "a.bigusername"            
        text: Text
            selector: "div.vb_postbit"

Thread =  Object
    # Describes the thread of a forum. 
    # A thread has a title and a list of posts.
    static:
        selector: "#container"

    components:
        posts: List(Post)
            selector: "#posts"
        title: Text
            selector: "table.tborder td.navbar strong"

ScraperExample = potato.View
    template: """
        <h1>No demo only code here sorry!</h1>
    """