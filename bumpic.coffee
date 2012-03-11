
load_img_data = (path, callback=((img_data)->))->
    img = new Image()
    img.onload = ->
        W = img.width
        H = img.height
        canvas = document.createElement 'canvas'
        canvas.width = W
        canvas.height = H
        ctx = canvas.getContext '2d'
        ctx.drawImage img,0,0,W,H
        img_data = ctx.createImageData W,H
        callback ctx.getImageData 0,0,W,H
    img.src = path

   
filter = (l, predicate)->
    res = []
    for x in l
        if predicate x
            res.push x
    res

create_image_data = (W,H)->
    canvas = document.createElement 'canvas'
    ctx = canvas.getContext '2d'
    ctx.createImageData W,H

render_scene = (img, depth, camera)->
    # the poor man's 3d
    W = img.width
    H = img.height
    dest = create_image_data W,H
    imgp = img.data
    depthp = depth.data
    destp = dest.data
    N = W*H*4
    offset = ([i,j])->
        (i + j*W) * 4
    x0 = Math.ceil (W/2)
    y0 = Math.ceil (H/2)
    d0 = depthp[ offset([x0,y0]) ]*0.05
    
    S  = x0 * (camera.L - d0) / ( x0 + camera.x) 
    z = 1.0
    for i in [0...W]
        for j in [0...H]
            c = offset [i,j] 
            d = depthp[c]*0.05
            x = Math.floor(x0 - z*camera.x + z*(camera.x + i - x0) * (camera.L)  / (camera.L - d + d0))
            y = Math.floor(y0 - z*camera.y + z*(camera.y + j - y0) * (camera.L)  / (camera.L - d + d0))
            if (0 <= x < W) and (0 <= y < H)
                destc = offset [x,y]
                destp[destc  ] = imgp[c]
                destp[destc+1] = imgp[c+1]
                destp[destc+2] = imgp[c+2]
                destp[destc+3] = 255
    for c in [0...W*H*4] by 4
        if destp[c + 3] == 0
            neighbor_count = 0
            [r,g,b] = [0,0,0]
            NEIGHBORS = [-W*4,W*4,-4,4]
            for neighbor in NEIGHBORS
                neighbor_offset = c+neighbor
                if 0 <= neighbor_offset < N
                    if destp[neighbor_offset+3] == 255
                        neighbor_count += 1
                        r += destp[neighbor_offset+0]
                        g += destp[neighbor_offset+1]
                        b += destp[neighbor_offset+2]
            if neighbor_count>0
                destp[c] = Math.ceil(r/neighbor_count)
                destp[c+1] = Math.ceil(g/neighbor_count)
                destp[c+2] = Math.ceil(b/neighbor_count)
                #destp[c+3] = 255
    for c in [0...W*H*4] by 4
        destp[c+3] = 255
    
    return dest

###
is_within = (P,triangle)->
    
    
inner_points = (triangle)->
    xs = ( Math.ceil(P[0]) for P in triangle )
    ys = ( Math.ceil(P[1]) for P in triangle )
    x_min = Math.min( xs... )
    y_min = Math.min( ys... )
    x_max = Math.max( xs... )
    y_max = Math.max( ys... )
    res = []
    for i in [x_min..x_max]
        for j in [y_min..y_max]
            P = [i,j]
            if is_within P,triangle
                res.push P
    res

render_scene = (img, depth, camera)->
    # the poor man's 3d
    W = img.width
    H = img.height
    dest = create_image_data W,H
    imgp = img.data
    depthp = depth.data
    destp = dest.data
    N = W*H*4
    d0 = depthp[ W/2 + H*W/2 ]
    dx0 = Math.ceil d0*camera.hx*W/2
    dy0 = Math.ceil d0*camera.hy*H/2
    warp_position = (P)->
        [i,j] = P
        offset = (i + j*W) * 4
        d =  depthp[offset]
        x = i + Math.ceil(d*camera.hx*i)-dx0
        y = j + Math.ceil(d*camera.hy*j)-dy0
        [x,y]
    process = (i,j)->
        source_points = [P1,P2,P3] = [[i,j], [i+1,j], [i+1,j+1]]
        dest_points = ( warp_position(P) for P in source_points )

    for i in [0...W]
        for j in [0...H]
            process i,j
            if 0 <= x < W and 0 <= y < H
                dest_offset = (x + y*W) * 4
                destp[dest_offset  ] = imgp[offset]
                destp[dest_offset+1] = imgp[offset+1]
                destp[dest_offset+2] = imgp[offset+2]
                destp[dest_offset+3] = 255
    for offset in [0...W*H*4] by 4
        if destp[offset + 3] == 0
            c = 0
            [r,g,b] = [0,0,0]
            NEIGHBORS = [-W*4,W*4,-4,4]
            for neighbor in NEIGHBORS
                neighbor_offset = offset+neighbor
                if 0 <= neighbor_offset < N
                    if destp[neighbor_offset+3] == 255
                        c += 1
                        r += destp[neighbor_offset+0]
                        g += destp[neighbor_offset+1]
                        b += destp[neighbor_offset+2]
            if c>0
                destp[offset] = Math.ceil(r/c)
                destp[offset+1] = Math.ceil(g/c)
                destp[offset+2] = Math.ceil(b/c)
                destp[offset+3] = 255
    return dest
###

class Animation
    ###
    Just a small class hosting frames
    ###
    constructor: (@frames)->

    play: (ctx,speed=12)->
        # speed is in frame per second
        frame_id = 0
        render_frame = =>
            frame_id = (frame_id + 1) % @frames.length
            ctx.putImageData @frames[frame_id], 0, 0    
        @timer = setInterval render_frame, 1000.0/speed

    stop: ->
        if @timer?
            clearInterval @timer

create_animation = (image, depth, amplitude=1.0)->
    h = 60.0
    point_from_angle = (theta)->
        { x: Math.cos(theta)*h, y: Math.sin(theta)*h, L: 100}
    N = 12
    thetas = ( Math.PI*2.0*i/N for i in [0...N] )
    CAMERAS = ( point_from_angle(theta) for theta in thetas )
    return new Animation( render_scene(image,depth,camera) for camera in CAMERAS )

@load_animation = (animation_id)->
    load_img_data (animation_id + '.png'), (img_data)->
        load_img_data (animation_id + '_depth.png'), (depth_data)->
            window.animation?.stop()
            window.animation = create_animation img_data, depth_data, 6.0
            canvas = document.getElementById('autostereoscopy')
            canvas.width = img_data.width
            canvas.height = img_data.height
            ctx = document.getElementById('autostereoscopy').getContext('2d')
            animation.play ctx, 24

main = ->
    window.load_animation 'poulejapon'

$ main