
# The six directions
DIRECTIONS = (
	( 1,  0,  0), #right
	( 0,  1,  0), #up
	( 0,  0,  1), #front 
	(-1,  0,  0), #left
	( 0, -1,  0), #down
	( 0,  0, -1)  #back
)


def cross(axis,direction):
	# cross product
	return (axis[1]*direction[2] - axis[2]*direction[1],
         	axis[2]*direction[0] - axis[0]*direction[2],
         	axis[0]*direction[1] - axis[1]*direction[0])

def dot(va,vb):
	# dot product
	return sum(a*b for (a,b) in zip(va,vb))

def scale(alpha, v):
	# scaling a vector
	(x,y,z) = v
	return (alpha*x, alpha*y, alpha*z)

def add(u,v):
	# adding two vectors
	return (u[0] + v[0], u[1] + v[1], u[2] + v[2])

def rotate(axis, u):
	# rotation by a quarter in the
	# positive sense around a normal vector.
	axis_projection = scale(dot(axis,u), axis)
	ortho_projection = cross(axis, u)
	return add(axis_projection, ortho_projection)


from itertools import product, count
from copy import copy

def degree(coords):
	# Given the position of a block
	# return the number of faces that
	# that are visible.
	return sum(map(abs,coords))

class NonOrientedCube(object):
	def rotate(self, axis):
		return self

class OrientedCube(object):
	__slots__=("orientation")	
	def __init__(self, orientation=DIRECTIONS[:2]):
		self.orientation = orientation
	def rotate(self, axis):
		return OrientedCube(
			tuple(rotate(axis,u)
			for u in self.orientation)
		)
	def __eq__(self, other):
		return self.orientation == other.orientation
	def __ne__(self, other):
		return self.orientation != other.orientation

# The oriented rubix cube at its initial
# state. All blocks are oriented the same way.
zero_oriented = {
	coords: OrientedCube()
	for coords in product(*([(-1,0,1)]*3))
	if degree(coords) >= 2
}

# The oriented rubix cube at its initial
# state. Cube are not oriented. Only their position counts.
zero_non_oriented = {
	coords: NonOrientedCube()
	for coords in product(*([(-1,0,1)]*3))
	if degree(coords) >= 2
}

# Applying a basic operation on the rubix
# cube.
#
# Turning the face facing the direction
# axis by a quarter in the positive sense.
# (counter clockwise)
def turn(axis, rubix_cube):
	parts = {}
	for (coord, cube) in rubix_cube.items():
		if any( x==y!=0 for x,y in zip(axis, coord)):
			# this cube is on the face rotating,
			# let's rotate it and register it to
			# its destination.
			new_cube = cube.rotate(axis)
			new_coord = rotate(axis, coord)
			parts[new_coord] = new_cube
		else:
			# this cube is not on the face that is rotating.
			parts[coord] = cube
	return parts

# Returns a partial rubix cube :
# only the blocks with d faces visibles.
def project(rubix, d):
	return {
		coords:v 
		for (coords,v) in rubix.items()
		if degree(coords) == d
	}

# Returns a partial rubix cube :
# only the side blocks
def sides(rubix):
	return project(rubix, 2)


# Returns a partial rubix cube :
# only the corner blocks
def corners(rubix):
	return project(rubix, 3)

# Possible moves
# we add clockwise quater turn (counterclockwise * 3)
# and half turn (counterclockwise * 2)
OPERATIONS = [
	[ direction ]*i
	for direction in DIRECTIONS
	for i in range(1,4)
]

def sequence(seq, rubix):
	for axis in seq:
		rubix = turn(axis, rubix)
	return rubix

def differences(rubix_1, rubix_2):
	return [
		k
		for k in rubix_1.keys()
		if rubix_1[k] != rubix_2[k]
	]

# yields all possible tuples of size n 
# of a given set of elements
def browse_with_length(els, n):
	if n==0:
		yield []
	else:
		for head in els:
			for tail in browse_with_length(els, n-1):
				yield head + tail

# yields all possible tuples of a
# given set of elements
def browse_tuples(els):
	for n in count(1):
		for seq in browse_with_length(els, n):
			yield seq

# Returns true if all the position given 
# belong to the same face
def all_on_one_face(positions):
	for els in zip(*positions):
		if len(set(els)) == 1:
			return True
	return False

# Search within the orbit of an operation
# for an operation that leaves fixed_rubix fix,
# and has a diff with diff rubix of at most 3
# elements, all from the same face. 
def search_orbit(seq, fixed_rubix, diff_rubix, max_depth):
	iter_fixed_rubix = fixed_rubix
	iter_diff_rubix = diff_rubix
	for i in range(1,max_depth+1): # we don't want to find moves 
						 # that we repeat more than 6 times.
		iter_fixed_rubix = sequence(seq, iter_fixed_rubix)
		iter_diff_rubix = sequence(seq, iter_diff_rubix)
		if not differences(fixed_rubix, iter_fixed_rubix):
			diff = differences(diff_rubix, iter_diff_rubix)
			if not diff:
				break # we ran through a full orbit.
			elif all_on_one_face(diff) and len(diff) <= 3:
				return (seq, i, diff)

DIRECTIONS_NAME = dict(zip(DIRECTIONS,
	["right",
	 "up",
	 "front",
	 "left",
	 "down",
	 "back" ]))

def operation_to_string(seq):
	return "-".join([ DIRECTIONS_NAME[axis]
		for axis in seq ])

print """

Step 2

Searching for a move letting sides
untouched, letting all but three corners belonging to the
same face at the same place.

"""

def search_step2_move():
	for seq in browse_tuples(OPERATIONS):
		seq = [DIRECTIONS[0]] + seq
		if len(seq) % 2 == 0:
			magic_move = search_orbit(seq,
				sides(zero_oriented),
				corners(zero_non_oriented), 2)
			if magic_move:
				(operation, repeat, dist)=magic_move
				print operation_to_string(operation),
				print "x" +str(repeat),
				print dist
				break

search_step2_move()

print "\n---------------\n"
def search_step3_move():
	for seq in browse_tuples(OPERATIONS):
		seq = [DIRECTIONS[0]] + seq
		if len(seq) %2 == 0:
			corners_non_oriented = dict(
				zero_oriented,
				**corners(zero_non_oriented))
			magic_move = search_orbit(seq,
				corners_non_oriented,
				corners(zero_oriented),
				6)
			if magic_move:
				(operation, repeat, dist)=magic_move
				print operation_to_string(operation),
				print "x" +str(repeat),
				print dist
				break


print """
Step 3

Searching a sequence that only change the orientation
of three corners.
"""

search_step3_move()
