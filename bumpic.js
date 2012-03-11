(function() {
  var Animation, create_animation, create_image_data, filter, load_img_data, main, render_scene;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  load_img_data = function(path, callback) {
    var img;
    if (callback == null) {
      callback = (function(img_data) {});
    }
    img = new Image();
    img.onload = function() {
      var H, W, canvas, ctx, img_data;
      W = img.width;
      H = img.height;
      canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      img_data = ctx.createImageData(W, H);
      return callback(ctx.getImageData(0, 0, W, H));
    };
    return img.src = path;
  };
  filter = function(l, predicate) {
    var res, x, _i, _len;
    res = [];
    for (_i = 0, _len = l.length; _i < _len; _i++) {
      x = l[_i];
      if (predicate(x)) {
        res.push(x);
      }
    }
    return res;
  };
  create_image_data = function(W, H) {
    var canvas, ctx;
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    return ctx.createImageData(W, H);
  };
  render_scene = function(img, depth, camera) {
    var H, N, NEIGHBORS, S, W, b, c, d, d0, depthp, dest, destc, destp, g, i, imgp, j, neighbor, neighbor_count, neighbor_offset, offset, r, x, x0, y, y0, _i, _len, _ref, _ref2;
    W = img.width;
    H = img.height;
    dest = create_image_data(W, H);
    imgp = img.data;
    depthp = depth.data;
    destp = dest.data;
    N = W * H * 4;
    offset = function(_arg) {
      var i, j;
      i = _arg[0], j = _arg[1];
      return (i + j * W) * 4;
    };
    x0 = W / 2;
    y0 = H / 2;
    d0 = depthp[offset([x0, y0])];
    S = x0 * (camera.L - d0) / (x0 + camera.x);
    for (i = 0; 0 <= W ? i < W : i > W; 0 <= W ? i++ : i--) {
      for (j = 0; 0 <= H ? j < H : j > H; 0 <= H ? j++ : j--) {
        c = offset([i, j]);
        d = depthp[c] * 0.05;
        x = Math.floor(x0 - camera.x + (camera.x + i - x0) * (camera.L - d0) / (camera.L - d));
        y = Math.floor(y0 - camera.y + (camera.y + j - y0) * (camera.L - d0) / (camera.L - d));
        if (((0 <= x && x < W)) && ((0 <= y && y < H))) {
          destc = offset([x, y]);
          destp[destc] = imgp[c];
          destp[destc + 1] = imgp[c + 1];
          destp[destc + 2] = imgp[c + 2];
          destp[destc + 3] = 255;
        }
      }
    }
    for (c = 0, _ref = W * H * 4; c < _ref; c += 4) {
      if (destp[c + 3] === 0) {
        neighbor_count = 0;
        _ref2 = [0, 0, 0], r = _ref2[0], g = _ref2[1], b = _ref2[2];
        NEIGHBORS = [-W * 4, W * 4, -4, 4];
        for (_i = 0, _len = NEIGHBORS.length; _i < _len; _i++) {
          neighbor = NEIGHBORS[_i];
          neighbor_offset = c + neighbor;
          if ((0 <= neighbor_offset && neighbor_offset < N)) {
            if (destp[neighbor_offset + 3] === 255) {
              neighbor_count += 1;
              r += destp[neighbor_offset + 0];
              g += destp[neighbor_offset + 1];
              b += destp[neighbor_offset + 2];
            }
          }
        }
        if (neighbor_count > 0) {
          destp[c] = Math.ceil(r / neighbor_count);
          destp[c + 1] = Math.ceil(g / neighbor_count);
          destp[c + 2] = Math.ceil(b / neighbor_count);
          destp[c + 3] = 255;
        }
      }
    }
    return dest;
  };
  /*
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
  */
  Animation = (function() {
    /*
        Just a small class hosting frames
        */    function Animation(frames) {
      this.frames = frames;
    }
    Animation.prototype.play = function(ctx, speed) {
      var frame_id, render_frame;
      if (speed == null) {
        speed = 12;
      }
      frame_id = 0;
      render_frame = __bind(function() {
        frame_id = (frame_id + 1) % this.frames.length;
        return ctx.putImageData(this.frames[frame_id], 0, 0);
      }, this);
      return setInterval(render_frame, 1000.0 / speed);
    };
    return Animation;
  })();
  create_animation = function(image, depth, amplitude) {
    var CAMERAS, N, camera, h, i, point_from_angle, theta, thetas;
    if (amplitude == null) {
      amplitude = 1.0;
    }
    h = 100.0;
    point_from_angle = function(theta) {
      return {
        x: Math.cos(theta) * h,
        y: Math.sin(theta) * h,
        L: 200
      };
    };
    N = 12;
    thetas = (function() {
      var _results;
      _results = [];
      for (i = 0; 0 <= N ? i < N : i > N; 0 <= N ? i++ : i--) {
        _results.push(Math.PI * 2.0 * i / N);
      }
      return _results;
    })();
    CAMERAS = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = thetas.length; _i < _len; _i++) {
        theta = thetas[_i];
        _results.push(point_from_angle(theta));
      }
      return _results;
    })();
    return new Animation((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = CAMERAS.length; _i < _len; _i++) {
        camera = CAMERAS[_i];
        _results.push(render_scene(image, depth, camera));
      }
      return _results;
    })());
  };
  main = function() {
    return load_img_data('image.png', function(img_data) {
      return load_img_data('depth.png', function(depth_data) {
        var animation, ctx;
        animation = create_animation(img_data, depth_data, 6.0);
        ctx = document.getElementById('autostereoscopy').getContext('2d');
        return animation.play(ctx, 24);
      });
    });
  };
  $(main);
}).call(this);
