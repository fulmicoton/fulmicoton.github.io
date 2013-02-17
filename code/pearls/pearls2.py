import numpy as np
from math import ceil, log
from memoize import memoize


# Let's call that the "pignolage" algorithm


PEARL_STATES = (
  anything,
  lighter_if_fake,
  heavier_if_fake,
  real
) = range(4)


NB_PEARL_STATES = len(PEARL_STATES)

EVEN = np.zeros((NB_PEARL_STATES, NB_PEARL_STATES), np.int)
EVEN[:, real] = 1

HEAVIER = np.zeros((NB_PEARL_STATES, NB_PEARL_STATES), np.int)
HEAVIER[heavier_if_fake, anything] = 1
HEAVIER[real, lighter_if_fake] = 1
HEAVIER[heavier_if_fake, heavier_if_fake] = 1
HEAVIER[real, real] = 1

LIGHTER = np.zeros((NB_PEARL_STATES, NB_PEARL_STATES), np.int)
LIGHTER[lighter_if_fake,anything] = 1
LIGHTER[lighter_if_fake, lighter_if_fake] = 1
LIGHTER[real, heavier_if_fake] = 1
LIGHTER[real, real] = 1

MEASURE_OUTCOMES = ( HEAVIER, LIGHTER, EVEN )

def min_with_limit(g, theoretical_limit):
  res = g.next()
  for x in g:
      res = min(res, x)
      if res<=theoretical_limit:
          # we reached the best possible result
          return res
  return res

def max_with_limit(g, upper_limit):
  res = g.next()
  for x in g:
      res = max(res, x)
      if res>upper_limit:
          # we reached the best possible result
          return res
  return res

def population_after_measures(population, measure):
  (left, right) = measure
  outcomes = []
  pop_no_weighted = population - left - right
  # if the balance says the two plates are even
  outcomes.append( pop_no_weighted + np.dot(left, EVEN) + np.dot(right,EVEN) )
  nb_pearls_outside = pop_no_weighted.sum()
  pop_outside_updated = np.zeros(4, np.int)
  pop_outside_updated[real] = nb_pearls_outside
  # if the balance says the left plate is lighter
  outcomes.append( pop_outside_updated + np.dot(LIGHTER, left) + np.dot(HEAVIER, right) )
  # if the balance says the left plate is heavier
  outcomes.append( pop_outside_updated + np.dot(HEAVIER, left) + np.dot(LIGHTER, right) )
  return outcomes

def fill_plate_list(pop, plate_size):
  if len(pop)==1:
    if pop[0] >= plate_size:
      yield [plate_size]
  else:
    for i in range(min(plate_size,pop[0])+1):
      for fill_remaining in fill_plate_list(pop[1:], plate_size-i):
        yield [i] + fill_remaining

def fill_plate(population, plate_size):
  for plate in fill_plate_list(list(population), plate_size):
    yield np.array(plate, np.int)

def measures(population):
  N = population.sum()
  cost = cost_branch(population)
  possible_plate_sizes = range(1, N/2+1)
  possible_plate_sizes.sort(key=lambda k:abs( 2*(N-2*k)-cost/3) )
  for plate_size in possible_plate_sizes:
    for left in fill_plate(population, plate_size):
      remaining = population - left
      for right in fill_plate(remaining, plate_size):
        yield (left, right)

def cost_branch(pop):
  return pop[0]*2 + pop[1] + pop[2]

def cost_estimate(branches):
  return max( cost_branch(branch) for branch in branches )

def is_normalized(measure):
  (left, right) = measure
  return tuple(left) >= tuple(right)

def browse_solutions(population, limit):
  yield limit
  best_at_the_moment = limit
  pops_updated_per_measure = []
  for measure in measures(population):
    if is_normalized(measure):
      pops_updated_per_measure.append(population_after_measures(population, measure))
  pops_updated_per_measure.sort(key=cost_estimate)
  for pops_updated in pops_updated_per_measure:
    measure_score = (
      solve(pop, best_at_the_moment-1)
      for pop in pops_updated
    )
    cur_measure = 1 + max_with_limit(measure_score, best_at_the_moment-2)
    if cur_measure < best_at_the_moment:
      best_at_the_moment = cur_measure
      yield best_at_the_moment

def pearl_key(pop, limit):
  return (tuple(pop), limit)


def solved(population):
  if population[anything] > 0:
    return False
  return population[lighter_if_fake] + population[heavier_if_fake] <= 1

@memoize(key=pearl_key)
def solve(pop, limit):
  if solved(pop):
    return 0
  theoretical_limit = ceil(log(cost_branch(pop),3))
  if theoretical_limit >= limit:
    return limit
  solutions = browse_solutions(pop, limit)
  return min_with_limit(solutions, theoretical_limit)


def pearl_pignolage(n):
  if n<3:
    return None
  possibilities = np.array([n, 0, 0, 0], np.int)
  return solve(possibilities, n*n)
