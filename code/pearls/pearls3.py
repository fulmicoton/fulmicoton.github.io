from math import floor, log
from memoize import memoize

# Let's call that the "pignolage" algorithm
def heavier(pop):
  (anything, light, heavy, real) = pop
  return (0, 0, heavy + anything, real + light)

def lighter(pop):
  (anything, light, heavy, real) = pop
  return (0, light + anything, 0, real + heavy)

def even(pop):
  return (0, 0, 0, sum(pop))

def pop_cost(pop):
  (anything, light, heavy, real) = pop
  return anything * 2 + light+heavy

def diff(pop_a, pop_b):
  return tuple(a-b for (a,b) in zip(pop_a,pop_b))

def add(*pops):
  return tuple(sum(els) for els in zip(*pops))

def minus(pop):
  return tuple(-el for el in pop)

def max_with_limit(g, m):
  res = g.next()
  for x in g:
      res = max(res, x)
      if res>m:
          return res
  return m

def population_after_measures(population, measure):
  (left, right) = measure
  pop_no_weighted = add(population, minus(left), minus(right))
  # if the balance says the two plates are even
  yield add(pop_no_weighted, even(left), even(right))
  O = sum(pop_no_weighted)
  # if the balance says the left plate is lighter
  yield add( lighter(left), heavier(right), (0,0,0,O) )
  # if the balance says the left plate is heavier
  yield add( heavier(left), lighter(right), (0,0,0,O) )
  
def fill_plate_list(pop, plate_size):
  head,tail = pop[0], pop[1:]
  if len(pop)==1:
    if head >= plate_size:
      yield (plate_size,)
  else:
    for i in range(min(plate_size,pop[0])+1):
      for fill_remaining in fill_plate_list(tail, plate_size-i):
        yield (i,) + fill_remaining

def fill_plate(pop, plate_size):
  for plate in fill_plate_list(list(pop), plate_size):
    yield plate

def measures(population):
  N = sum(population)
  cost = cost_branch(population)
  possible_plate_sizes = range(1, N/2+1)
  possible_plate_sizes.sort(key=lambda k:abs( 2*(N-2*k)-cost/3) )
  for plate_size in possible_plate_sizes:
    for left in fill_plate(population, plate_size):
      remaining = diff(population, left)
      for right in fill_plate(remaining, plate_size):
        yield (left, right)

def cost_branch(pop):
  return pop[0]*2 + pop[1] + pop[2]

def cost_estimate(branches):
  return max( cost_branch(branch) for branch in branches )

def is_normalized(measure):
  (left, right) = measure
  return left >= right

def browse_solutions(population, m):
  pops_updated_per_measure = []
  for measure in measures(population):
    if is_normalized(measure):
      pops_updated_per_measure.append(list(population_after_measures(population, measure)))
  pops_updated_per_measure.sort(key=cost_estimate)
  for pops_updated in pops_updated_per_measure:
    measure_score = (
      solve(pop, m-1)
      for pop in pops_updated
    )
    if max_with_limit(measure_score, m-1) == m-1:
      return m
  return m+1

def pearl_key(pop, limit):
  return (tuple(pop), limit)

def solved(pop):
  return pop[0]==0 and sum(pop[1:3]) <= 1

@memoize(key=pearl_key)
def solve(pop, m):
  if solved(pop):
    return 0
  if 3**m < cost_branch(pop):
    # we won't be able to reach the 
    # limit of m
    return m+1
  return browse_solutions(pop, m)
  
def pearl_smart(n):
  if n<3:
    return None
  pop = (n, 0, 0, 0)
  m = int(floor(log(n, 3)))+1 # min limit
                            #  m+1 is the max limit
  return solve(pop, m)

if __name__ == "__main__":
  assert pearl_smart(3) == 2
  assert pearl_smart(12) == 3
  assert pearl_smart(13) == 4