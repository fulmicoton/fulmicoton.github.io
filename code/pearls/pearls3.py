from math import floor, log

# Let's call that the "smart" algorithm

"""In this implementation we represent our knowledge
on the pearls as a quadruplet (n,h,l,r) where

 * n is the number pearls for which we don't 
   know anything.
 * h is the number pearls for which we know
   that if they are fake, they must be heavier
   than the real pearls.
 * l is the number of pearls for which we know
   that if they are fake they must be lighter
  than the real pearls
 * r is the number of pearls for which we know they are real.
"""

def diff(pop_a, pop_b):
  return tuple(a-b for (a,b) in zip(pop_a,pop_b))

def add(*pops):
  return tuple(sum(els) for els in zip(*pops))

def minus(pop):
  return tuple(-el for el in pop)

def heavier(pop):
  (anything, light, heavy, real) = pop
  return (0, 0, heavy + anything, real + light)

def lighter(pop):
  (anything, light, heavy, real) = pop
  return (0, light + anything, 0, real + heavy)

def even(pop):
  return (0, 0, 0, sum(pop))

def measure_branches(population, measure):
  """Given a population and a measure, returns 
  the three resulting populations, depending on 
  the outcome of the measure.
  """
  (left, right) = measure
  pop_no_weighted = add(population, minus(left), minus(right))
  # if the balance says the two plates are even
  yield add(pop_no_weighted, even(left), even(right))
  O = sum(pop_no_weighted)
  # if the balance says the left plate is lighter
  yield add( lighter(left), heavier(right), (0,0,0,O) )
  # if the balance says the left plate is heavier
  yield add( heavier(left), lighter(right), (0,0,0,O) )


def nb_of_answers(pop):
  """ Returns the number of possible
  answer given a population.
  """
  return pop[0]*2 + pop[1] + pop[2]

def fill_plate(pop, plate_size):
  """ Yields all the possible sub population 
  of plate_size pearls within pop.
  """
  head,tail = pop[0], pop[1:]
  if len(pop)==1:
    if head >= plate_size:
      yield (plate_size,)
  else:
    for i in range(min(plate_size,pop[0])+1):
      for fill_remaining in fill_plate(tail, plate_size-i):
        yield (i,) + fill_remaining

def measures(pop):
  """ Returns all possible normalized.
  measures for a given population.
  A measure is described as a couple (left, right)
  where left is the population to put in the left
  plate and right is the population to put in the
  right plate.

  Since (left,right) is equivalent to 
  (right, left), we only yield measures for 
  which left >= right
  """
  N = sum(pop) # the number of pearls
  possible_plate_sizes = range(1, N/2+1)
  for plate_size in possible_plate_sizes:
    for left in fill_plate(pop, plate_size):
      remaining = diff(pop, left)
      for right in fill_plate(remaining, plate_size):
        if left >= right:
          yield (left, right)

def solved(pop):
  return pop[0]==0 and sum(pop[1:3]) <= 1

def solve(pop, m):
  """Returns True if the pearl problem
  of the population pop can be solved
  in less than m measures.

  To do so, apart from the special cases
  we test all possible measures. 

  If one measure makes it possible to
  solve the problem in m, we return m.

  If one outcome of one measure gives
  a result greater than m-1, we 
  test the next measure.
  """
  if m < 0:
    return False
  if solved(pop):
    return True
  if 3**m < nb_of_answers(pop):
    # we will never be able to
    # reach the limit of m
    # because of the information
    # argument
    return False
  for measure in measures(pop):
    for branch in measure_branches(pop, measure):
      if not solve(branch, m-1):
         break
    else:
      return True
  return False
  
def pearl_smart(n):
  if n<3:
    return None
  pop = (n, 0, 0, 0)
  # our solution is either m
  # or m+1
  m = int(floor(log(n, 3)))+1 
  if solve(pop, m):
    return m
  else:
    return m+1

if __name__ == "__main__":
  assert pearl_smart(3) == 2
  assert pearl_smart(12) == 3
  assert pearl_smart(13) == 4
  pearl_smart(120)

