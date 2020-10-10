
class Vec
	constructor: (@vals)-> @dim = @vals.length
	diff: (other)-> new Vec (@vals[i] - other.vals[i] for i in [0...@dim])
	add: (other)-> new Vec (@vals[i] + other.vals[i] for i in [0...@dim])
	scale: (l)-> new Vec (@vals[i] * l for i in [0...@dim])
	norm: -> Math.sqrt(@dot this)
	normalize: -> @scale(1.0 / @norm())
	dot: (other)-> 
		res = 0
		for i in [0...@dim]
			res += @vals[i] * other.vals[i]
		res
	prod: (other)->
		[xa, ya, za] = @vals
		[xb, yb, zb] = other.vals
		new Vec([
			ya*zb - yb*za,
			za*xb - zb*xa,
			xa*yb - ya*xa,
		])

class Camera
	constructor: (@O)->
		@n = @O.scale(-1.0).normalize()
		down = new Vec([0,0,1])
		@y_axis = down.diff(@n.scale(@n.dot(down))).normalize()
		@x_axis = @y_axis.prod @n

	projection: (A)->
		OA = A.diff(@O)
		d = @n.dot(OA)
		v = (OA.diff(@n.scale(d))).scale(1.0/d)
		new Vec [v.dot(@x_axis), v.dot(@y_axis)]

	projectLine: (line)->
		P_ = @projection line.P
		Q_ = @projection line.getPoint()
		n_ = Q_.diff(P_).normalize()
		new Line(P_, n_)

	antiprojection: (A)->
		n = @n.add(@x_axis.scale(A.vals[0])).add(@y_axis.scale(A.vals[1])).normalize()
		new Line @O, n


class Line
	constructor: (@P, n)->
		@n = n.normalize()
	getPoint: (param = 1.0)->
		@P.add @n.scale(param)
	project: (Q)->
		diff = Q.diff(@P)
		@P.add(@n.scale(diff.dot(@n)))

class Coordinates

	constructor: (@offset, @scale)->
		@invScale = 1.0 / @scale

	to: (v)->
		v.scale(@scale).add(@offset)

	from: (v)->
		v.diff(@offset).scale(@invScale)


module.exports = 
	Camera: Camera
	Vec: Vec
	Coordinates: Coordinates