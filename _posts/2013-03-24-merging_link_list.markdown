---
layout: post
title:  Of Intersecting linked list
category: posts
published: false
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

A first very simple answer would be to just choose one of the two list, go through all of its node and store them in a set. We can then go through the other list and stop as soon as we reach a node we have already met.

{% highlight python %}

def find_intersection_simple(left,right):
    visited = set(left)
    for cur_right in right:
        if cur_right in visited:
            return cur_right
    return None

{% endhighlight %}

Simple isn't it? 

Python sets are basically hash sets, we can consider they have a bounded complexity for both inserting / checking for an element.
We will store one of the list we choose and we will choose it arbitrarily so that if we call ``L`` and ``R`` the length of the two linked list, we have the following complexity

- **computational time** : O(max(L,R))
- **memory** : O(max(L,R))


Walking is the way to go
---------------------------

We can improve this a lot by advancing alternatively on the left and right leg. As soon as both legs reach the intersection, our program can terminate.

{% highlight python %}

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

{% endhighlight %}
