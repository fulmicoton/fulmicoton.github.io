from itertools import izip_longest

class Node:
  
  def __init__(self,next=None):
    self.next = next

  def __iter__(self,):
    cur = self
    while cur is not None:
      yield cur
      cur = cur.next

  def __repr__(self,):
    return "-".join(hex(id(x))[-4:] for x in self)

def make_chain(k, next=None):
  res = Node(next)
  for i in range(k):
    res = Node(next=res)
  return res

def find_intersection_simple(left,right):
  visited = set(left)
  for cur_right in right:
    if cur_right in visited:
      return cur_right
  return None

def find_intersection_left_and_right(left,right):
  visited = set()
  for (cur_left, cur_right) in izip_longest(left, right):
    if cur_left == cur_right:
      return cur_left
    if cur_left in visited:
      return cur_left
    if cur_right in visited:
      return cur_right
    if cur_left is not None:
      visited.add(cur_left)
    if cur_right is not None:
      visited.add(cur_right)
  return None


def steps():
  c = 1
  while True:
    yield c
    c = (c+1)*6/5

def find_intersection_skipping(left,right):
  visited_left = { left: left }
  visited_right = { right: right }
  checkpoint_left = left
  checkpoint_right = right
  if left==right:
    return left
  walk_it = izip_longest(left, right)
  (cur_left, cur_right) = walk_it.next()
  for step in steps():
    for skip in xrange(step):
      try:
        (cur_left, cur_right) = walk_it.next()
      except StopIteration:
        back_left = visited_left[checkpoint_left]
        back_right = visited_right[checkpoint_right]
        return find_intersection_skipping(
                back_left, 
                back_right)
      if cur_left == cur_right:
        return cur_left
      if cur_left in visited_right:
        if step == 1:
          return cur_left
        else:
          back_left = visited_left[checkpoint_left]
          back_right = visited_right[cur_left]
          return find_intersection_skipping(
                    back_left,
                    back_right)
      if cur_right in visited_left:
        if step == 1:
          return cur_right
        else:
          back_left = visited_left[cur_right]
          back_right = visited_right[checkpoint_right]
          return find_intersection_skipping(back_left, back_right)
    if cur_left not in visited_left:
      visited_left[cur_left] = checkpoint_left.next
      checkpoint_left = cur_left
    if cur_right not in visited_right:
      visited_right[cur_right] = checkpoint_right.next
      checkpoint_right = cur_right

import time

def test(find_intersection_impl, n, l, r):
  main = make_chain(n)
  left = make_chain(l, next=main)
  right = make_chain(r, next=main)
  start = time.time()
  res = find_intersection_impl(left,right)
  end = time.time()
  assert res == main
  return end-start

def tests(find_intersection_impl):
  total = 0
  for n in range(20):
    for l in range(20):
      for r in range(20):
        total += test(find_intersection_impl, n,l,r)
  return total


if __name__ == "__main__":
  print tests(find_intersection_simple)
  print tests(find_intersection_left_and_right)
  print tests(find_intersection_skipping)