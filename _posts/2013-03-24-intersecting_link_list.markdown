---
layout: post
title:  Of Intersecting linked lists
category: pythonistas
---




The problem
---------------------------------------------

You are given two linked list. Basically given a node, you can only access its successor. You know that they merge at one point. Find an algorithm to detect the merging point. Optimize for computational time first, and if possible, memory.

The problem was supposed to be solved in Java, but considering there is more pythonistas reading this blog, I will rather translate everything into python.

So a node of our linked list might be implemented as its first node, also named head :

{% highlight python %}

class Node:
    
    def __init__(self,next=None):
        self.next = next

    def __iter__(self,):
        cur = self
        while cur is not None:
            yield cur
            cur = cur.next

{% endhighlight %}


Note that accessing the n-th item of this chain requires stepping ahead n-times.

We need to write a function ``find_intersection`` that given two linked lists ``left`` and ``right``, returns the first common node. For instance in the following example, ``find_intersection(L1,R1)`` should return ``L3``.

![Merging linked list](/images/chain/chain.png)



A first answer
------------------------


![Kangaroo ahead](/images/chain/oneleg.jpg)

Let's call our two lists ``left`` and ``right``
A first very simple answer would be go through all of the nodes of ``left`` and store them in a set. We can then go through the ``right`` and stop as soon as we reach a node we have already met in ``left``.

The python implementation is actually probably shorter and clearer than plain english :

{% highlight python %}

def find_intersection_simple(left,right):
    visited = set(left)
    for cur_right in right:
        if cur_right in visited:
            return cur_right
    return None

{% endhighlight %}

Simple isn't it? 
Now let's take a look at the complexity of this algorithm.

Python sets are basically hash sets, we can consider they have a bounded complexity for both inserting or checking if an element is within our set. All the element of the list we choose  within the set. Let's call L and R length of our two lists, and l and r the number of nodes before the intersection.

- **time** : O(L+r)
- **memory** : O(L)

Since the algorithm gives a different role to ``left`` and ``right``, the complexity is 
also assymetric. If we had some clue that ``right`` is actually much shorter that ``left`` we might prefer to inverse their roles, but well, we don't have that kind of information.






Walking is the way to go
---------------------------


![Kangaroo ahead](/images/chain/walking.jpg)

We can improve this a lot by advancing alternatively on the left and right leg. As soon as both legs reach the intersection, our program can terminate.

{% highlight python %}

def find_intersection_walking(left,right):
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

{% endhighlight %}

This is version is a huge improvement over the first implementation in the case the two list interestects very quickly. The resulting complexity is :

- **time** : O(max(l,r))
- **memory** : O(max(l,r))



Naaaa, skipping is the way to go!
------------------------------------------------------- 


![Kangaroo ahead](/images/chain/bunny.jpg)

Obviously we won't be able to improve the time complexity of this algorithm, as we will definitely need to at least reach the ancester to discover it.

But maybe we can do something for memory without impacting computational time too much.

Rather than storing all the elements we encounter, let's consider what would happen if we were skipping an exponentially increasing number of elements.

Let's assume the ``left leg`` reachs a node we have marked as visited by the ``right leg``, we cannot know for sure that it is the first common node. What we know however, is that we crossed the intersection somewhere between this ``right leg`` checkpoint, and its previous checkpoint.

We need to have extra information to make it possible to step backwards to the last checkpoint. The trick is that instead of only storing visited nodes into a set, we will associate to each of these checkpoints a node to step back to.

That's it for the right leg, but we need to step backward in the left leg as well don't we? To be accurate we need to go back at least the number of steps between the two checkpoint of the ``right leg``. This can be done without extra information, by going back to the last checkpoint, and going to its previous checkpoint. Since the 
step between checkpoints is increasing we know that we went back sufficiently.

And here is the implementation... I'm afraid it won't 
help much about understanding the algorithm as it is 
getting hairy by the need to handle all the edge cases.

I someone find a more elegant way to implement it, I'd
be happy to see it!

{% highlight python %}

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

{% endhighlight %}

The time complexity of this algorithm is still linear, but
we are logarithmic in memory.

- **time** : O(max(l,r))
- **memory** : O(log(max(l,r))

