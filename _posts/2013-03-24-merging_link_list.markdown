---
layout: post
title:  Of Intersecting linked list
category: pythonistas
---




The problem
---------------------------------------------

I once applied for a job at a tech startup in Japan. Like many other startups they would make a first selection of their candidates by giving them a set of problems to solve at home. The first one was actually pretty interesting, and I had never heard about it.

You are given two linked list. Basically given a node, you can only access its successor. You know that they merge at one point. Find an algorithm to detect the merging point. Optimize for computational time first, and if possible, memory. I was also given a Java class...But there is more pythonistas reading this blog, so I will rather translate everything into python.

So a node of our linked list might be implemented as 

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

The linked list is simply represented by its head.
Accessing the n-th item of this chain requires stepping ahead n-times.

We need to write a function ``find_intersection`` that given two linked lists ``left`` and ``right``, returns the first common node.
For instance in the following example, ``find_intersection(L1,R1)`` should return ``L3 == R4``.

![Merging linked list](/images/chain/chain.png)





A first answer
------------------------

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


![Kangaroo ahead](/images/chain/kangaroo.jpg)

Obviously we won't be able to improve the time complexity of this algorithm, as we will definitely need to at least reach the ancester to discover it.

But maybe we can do something for memory without impacting computational time.

Rather than storing all the elements we encounter, let's first consider what would happen
if we were storing only one out of two nodes for instance. As we reached a node we already visited, we cannot know for sure that it is the first common node. However we know that 
the intersection happened somewhere between this node, and the node we stored before.
Rather than keeping a set of elements, we will therefore store a dictionary in which keys 
are visited nodes, and values are nodes that have were store in the dictionary before.

If we keep track of enough stuff, we can probably just step back k-times and just run ``find_intersection_walking``.




{% highlight python %}

def find_intersection_skipping_fail(left,right,k=2):
    visited_left = {}
    visited_right = {}
    checkpoint_left = left
    checkpoint_right = right
    i = 0
    if left==right:
        return left
    for (cur_left, cur_right) in izip_longest(left, right):
        i += 1
        if cur_left == cur_right:
            return find_intersection_left_and_right(checkpoint_left, checkpoint_right)
        if cur_left in visited_right:
            prev_right = visited_right[cur_left]
            prev_left = visited_left[checkpoint_left]
            return find_intersection_left_and_right(prev_left, prev_right)
        if cur_right in visited_left:
            prev_left = visited_left[cur_right]
            prev_right = visited_right[checkpoint_right]
            return find_intersection_left_and_right(prev_left, prev_right)
        if i % k == 0:
            if cur_left not in visited_left:
                visited_left[cur_left] = checkpoint_left
                checkpoint_left = cur_left
            if cur_right not in visited_right:
                visited_right[cur_right] = checkpoint_right
                checkpoint_right = cur_right
    return find_intersection_skipping_fail(checkpoint_left, checkpoint_right)

{% endhighlight %}

Since we stored only one out k elements, our memory usage has been divided by k. This improvment does not change however the complexity. We are still linear with the number of nodes to the intersection.
In term of computational time, we had to re-walk through k elements in order to solve the problem. The complexity is therefore. k being a fixed parameter we choose, we can consider it bounded. The resulting complexity is :

- **time** : O(max(l,r))
- **memory** : O(max(l,r))

Oh, well nothing has changed.



Then, just skip further
------------------------------------------------------- 

The trick is to skip an exponentially increasing distance.
That way, when we detect we reached the intersection we will
have to go back as many nodes as the current skipping step.
This skipping step will be linearly related with the ``max(l,r)``.

Because of that the computational time will still be linear with  
``max(l,r)``.

Memory however, will be logarithmic. 


