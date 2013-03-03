NB_FRAMES = 10
FPS = 20

runWiggle = ->
    window.animation?.stop()
    window.animation = createAnimation()
    window.animation.play $("#result")[0], 20

createAnimation = ->
    $image = $ "#editor > img"
    $canvas = $ "#editor > canvas" 
    stackBlurCanvasRGB $canvas[0], 0, 0, 450, 300, 20.0
    img = wiggle.extract_image_data $image[0]
    depth = $canvas[0].getContext('2d').getImageData 0,0,450,300
    thetas = ( Math.PI*2.0*i/NB_FRAMES for i in [0...NB_FRAMES] )
    cameras = ( wiggle.camera_from_angle(60.0,theta) for theta in thetas )
    wiggle.compute_animation img, depth, cameras

setupToolbox = ->   
    brush_attr =
        brush: 40
        color: "medium"
    $("div.toolbox div").click ->
        [k,v] = $(this).attr('class').split("-")
        brush_attr[k] = v
        offset = brush_attr.brush / 2
        cursor_url = "img/cursor_" + brush_attr.brush + "_" + brush_attr.color + ".png"
        cursor_css = "url('#{cursor_url}') #{offset} #{offset}, pointer"
        $("#editor canvas").css "cursor", cursor_css

chainAsync = (operations, cb)->
    if operations.length == 0
        cb()
    else
        head = operations.shift()    
        head()
        setTimeout (-> chainAsync operations,cb), 0


clear_depth_map = ->
    depth_map = $('#editor-canvas').sketch()
    depth_map.actions = []
    depth_map.redraw()

depth_map_sketch = ->
    $('#editor-canvas').sketch
        defaultSize: 40
        defaultColor: "#999"
    

download = ->
    $("body").addClass "downloading"
    runWiggle()
    encoder = new GIFEncoder()
    encoder.setRepeat 0
    encoder.setDelay 1000.0 / FPS
    encoder.setSize 450,300
    encoder.start()
    canvas = document.createElement 'canvas'
    canvas.width = 450
    canvas.height = 300

    ctx = canvas.getContext '2d'
    i = 0
    $progress = $ "progress.download"
    operations = []
    for frame in animation.frames
        do (frame)->
            operations.push ->
                $progress.val i++
                ctx.putImageData frame, 0, 0
                encoder.addFrame ctx
    chainAsync operations, ->
        encoder.finish()
        downloadLink = document.createElement 'a'
        downloadLink.href = 'data:image/gif;base64,'+encode64(encoder.stream().getData())
        downloadLink.download = "wiggle.gif"
        downloadLink.click()
        $("body").removeClass "downloading"

upload_image = ->
    $file_input = $("<input type='file'>")
    $file_input.click()
    $img = $('#editor > img')
    $file_input.change ->
        if $file_input[0].files.length == 0
            return
        file = $file_input[0].files[0]
        $img.attr 'src', URL.createObjectURL file
        clear_depth_map()
        runWiggle()

main = ->
    $('#process-upload').click upload_image
    depth_map_sketch()
    $img = $('#editor > img')
    $img.load depth_map_sketch
    $('#process-button').click runWiggle
    $ runWiggle
    setupToolbox()
    $('#download-button').click download
    

$ main