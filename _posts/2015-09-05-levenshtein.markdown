---
layout: post
title: Of Levenshtein Automata implementations
category: posts
published: true
tags: draft
style: |
  
    <style type="text/css">
    .node-shape {
      stroke-width: 2px;
      stroke: #333333;
    }
    .node-shape.active {
      fill: #81ffec;
    }
    .arrow {
      stroke: #000000;
    }
    .arrow line,
    .arrow path {
      stroke-width: 2px;
      fill: none;
    }
    div.nfa-simulator {
        margin-top:-30px;
        margin-bottom: 30px;
    }
    div.query {
        display: none;
    }
    .arrow .marker {
      fill: black;
    }
    .arrow text {
      text-anchor: middle;
      stroke-width: 0px;
    }
    .nfa-simulator input {
      display: block;

    }
     input.input {
        font-size: 25px;
        border-width: 1px;
        border: solid;
    }
    .arrow-h {
      stroke: #780000;
    }
    .arrow-h .marker {
      fill: #780000;
    }
    .arrow-h text {
      fill: #780000;
    }
    .arrow-v {
      stroke: #007800;
    }
    .arrow-v .marker {
      fill: #007800;
    }
    .arrow-v text {
      fill: #007800;
    }
    .arrow-d {
      stroke: #000078;
    }
    .arrow-d .marker {
      fill: #000078;
    }
    .arrow-d text {
      fill: #000078;
    }
    .arrow-H {
      stroke: #007878;
    }
    .arrow-H .marker {
      fill: #007878;
    }
    .arrow-H text {
      fill: #007878;
    }
    .node {
      text-anchor: middle;
      dominant-baseline: central;
      cursor: pointer;
      -webkit-user-select: none;
      fill: white;
    }
    .node text {
      fill: #000000;
    }
    </style>
---


*Thanks to Ken Hironaka for kindly taking a lot of  time to read and fix countless errors in this blog post!*


# Back to Tokyo

It's been such a long time since my last post, and so much have happened. I moved to Tokyo in November 2014 and started working for Indeed Japan. I'm still kind of foreign to the dev community in Japan, so if you are also in Tokyo and you have some good tips about tech/startup event of anykind in Tokyo, drop me a message!

# Reacting to another blog post

Earlier this year, Jules Jacob wrote an awesome blog post titled [**Levenshtein automata can be simple and fast**](http://julesjacobs.github.io/2015/06/17/disqus-levenshtein-simple-and-fast.html). While reading it, you might notice that it is kind of a rebuke against the convoluted language of the original paper : [Fast String Correction with Levenshtein-Automata](http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.16.652) by Klaus Schulz and Stoyan Mihov. I read this paper, and I have to agree its style is rather abstract and opaque. 

Jules's blog post on the other hand wield great pedagogy, and walks the reader step-by-step through a simpler algorithm to build Levenshtein automata.

While I love this blogpost, I am afraid that I disagree with Jules, when he claims : **After a bit of tinkering I had a working Levenshtein automaton in just a handful of lines of code with the same time complexity as the paper claims to have.**

Jules's algorithm complexity is indeed linear in the number of characters. However, if you consider the complexity in the maximum edit distance supported, the algorithm does not do that well. The blog post dismisses it by saying that we will only consider edit distance < 2 anyway, so why not consider it constant. I would counter argue that at distance 2, the algorithm described here is already too slow to be usable in practise to build a search autocomplete system.

Moreover, the paper actually describes in ``Chapter 6`` a way to avoid computing the DFA at all... so isn't calling it ** same time complexity ** a bit of a stretch?

In this blog post I will try to take the subject where Jules left it, and explain the actual algorithm in the article. I will also explain some specificities about Lucene's implementation.

# What are Levenshtein Automata anyway?



I recently got interested in building an autocomplete service. You probably are familiar with those : the user starts typing a query, and is offered a bunch of suggestions before he has even finished typing.

Imagine you had to implement one of these...  
As a first shot, you might consider building a trie with 
a list of suggestions. For each of the suggestions, you also probably want to store some kind of score. When a request comes, you can then use the trie to list up the suggestions which admit the user input as a prefix, and serve back the top 10 best entries.

But users make typos, and sometimes they don't actually know how to spell the thing that they are search for. So you might want to relax the prefix constraint and allow for spelling mistake. The [paper](http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.16.652) precisely explains how to search rapidly in a dictionary which entries are at an edit distance lower than k from a query. I will leave the "prefix" part of the problem for a next blog post.


The solution starts by building a so-called Levenshtein Automaton for the user query. It is a Deterministic Finite Automaton ([DFA](https://en.wikipedia.org/wiki/Deterministic_finite_automaton)) which has the property matching strings that are at a edit distance of at most D from the query.

Now, if our dictionary is also stored in a trie (or a transducer, or any kind of automaton), the problem consists in running the automaton over the trie. This operation is called an intersection and is rather straightforward.

The construction of such a DFA on the other hand is a bit tricky. Building it fast is quite a challenge. In this blog post, I will precisely describe the algorithm described in the paper. I will also talk about the specifics about Lucene's implementation.

*If you are not familiar with the concept of NFA, DFA, or levenshtein distance I really advise you to have a look at Jules' blog post before reading this post.*

In my next post, I will talk about an extension of Levenshtein Automata, with hopefully some actual original material.


#  Let's get started

As a warm up, let's write the simplest implementation we can think of that checks if two strings are at an edit distance of lesser or equal to D.
In practise, you probably want to get the distance itself as an output as well, to compute a score for your suggestion, but for the sake of simplicity, I deliberately removed this refinement in this blog post : 
Our implementations will simply return True iff the matched string is at an edit distance lesser or equal to D.

{% highlight python %}

def levenshtein(s1, s2, D=2):
    """
    Returns True iff the two string
    s1 and s2 is lesser or equal to D
    """
    if D == -1:
        return False
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1) <= D
    return (levenshtein(s1[1:], s2[1:], D-1)   # substitution\
        or levenshtein(s1, s2[1:], D-1)       # insertion\
        or levenshtein(s1[1:], s2, D-1)       # deletion\
        or (
            # character match
            (s1[0] == s2[0]) and \
            levenshtein(s1[1:], s2[1:], D)
        ))

{% endhighlight %}

Pretty straightforward, isn't it? This version of the algorithm will unfortunately not help us building our automaton. `s1` and `s2` plays symmetric roles in this code. 

On our way to build our automaton, we will have to break this symmetry : we build the automaton for one of those string `s2` and apply the automaton on `s1`. 

So let's modify our algorithm to make sure that we munch one character `c` away from s1 at each call. 

At each step we will consider two cases. 
Either `c` will not be used to recreate `s2` from `s1`, or it will be used. If it is used, it has to be used in a position of at most `D` in `s2`.

{% highlight python %}

def levenshtein(s1, s2, D=2):
    """
    Returns True iff the edit distance between
    the two strings s1 and s2 is lesser or
    equal to D
    """
    if len(s1) == 0:
        return len(s2) <= D
    if len(s2) == 0:
        return len(s1) <= D
    # assuming s1[0] is NOT used to build s2,
    if D > 0:
        if levenshtein(s1[1:], s2, D - 1):
            # deletion
            return True
        if levenshtein(s1[1:], s2[1:], D - 1):
            # substitution
            return True
    # assuming s1[0] is used to build s2
    for d in range(min(D+1, len(s2))):
        # d is the position where s1[0]
        # might be used.
        # it is also the number of character
        # that are required to be inserted before
        # using s1[d].
        if s1[0] == s2[d]:
            if levenshtein(s1[1:], s2[d+1:], D - d):
                return True
    return False

{% endhighlight %}

I can already hear you rambling : Why are we copying all of this strings around? Let's replace the string arguments by offsets to a const string.


{% highlight python %}

def levenshtein(s1, s2, D=2, i1=0, i2=0):
    """
    Returns True iff the edit distance between
    the two strings s1 and s2 is lesser or
    equal to D
    """
    def aux(i1, i2, D):
        if i1 == len(s1):
            return len(s2) - i2 <= D
        if D > 0:
            if aux(i1 + 1, i2, D - 1):
                # deletion
                return True
            if aux(i1 + 1, i2 + 1, D - 1):
                # substitution
                return True
        for d in range(min(D + 1, len(s2) - i2)):
            if s1[i1] == s2[i2 + d]:
                # d insertion, followed
                # by a character match.
                if aux(i1 + 1, i2 + d + 1, D - d):
                    return True
        return False
    return aux(0, 0, D)


{% endhighlight %}

One of the problem with that kind of recursive program, is that aux is called many times with the same arguments.

Let's transform this method to make it iterative, and let's group the calls with the same arguments by putting them in a set.

{% highlight python %}

def levenshtein(s1, s2, D=2):
    """
    Returns True iff the edit distance between
    the two strings s1 and s2 is lesser or
    equal to D
    """
    def aux(c, i2, D):
        # i2 is the number of character
        # consumed in the string s2.
        # D is the number of error that we 
        # still alow.
        if D >= 1:
            # deletion
            yield i2, D - 1
            # substitution
            yield i2 + 1, D - 1
        for d in range(min(D + 1, len(s2) - i2)):
            if c == s2[i2 + d]:
                # d insertions followed by a
                # character match
                yield i2 + d + 1, D - d

    current_args = {(0, D)}
    for c in s1:
        next_args = set()
        for (i2, d) in current_args:
            for next_arg in aux(c, i2, d):              
                next_args.add(next_arg)
        current_args = next_args
    for (i2, D) in current_args:
        if len(s2) - i2 <= D:
            return True
    return False

{% endhighlight %}

Now this is seriously looking like an automaton, which labels are annotated by i2 and n.

Let's just rename some variables, and rearrange the code to let the NFA appear.

{% highlight python %}

class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()

    def initial_states(self,):
        raise NotImplementedError()
        
    def eval(self, input_string):
        states = self.initial_states()
        for c in input_string:
            next_states = set()
            for state in states:
                next_states |= set(self.transitions(state, c))    
            states = next_states
        for state in states:
            if self.accept(state):
                return True

class LevenshteinAutomaton(NFA):

    def __init__(self, query, D=2):
        self.query = query
        self.max_D = D

    def transitions(self, state, c):
        (offset, D) = state
        if D > 0:
            yield (offset, D - 1)
            yield (offset + 1, D - 1)
        for d in range(min(D + 1, len(self.query) - offset)):
            if c == self.query[offset + d]:
                yield offset + d + 1, D - d

    def accept(self, state):
        (offset, D) = state
        return len(self.query) - offset <= D

    def initial_states(self,):
        return {(0, self.max_D)}

def levenshtein(s1, s2, D=2):
    return LevenshteinAutomaton(s2, D).eval(s1)

{% endhighlight %}



That looks awesome!
Let's step back for a second here. The states of a Levenshtein NFA are parametered two integers.

- the `offset` that tells you how many of the query you already matched
- the number `d` of mistakes that are still allowed to to match the remaining `len(query) - offset` characters.

At this point our algorithm is very similar to that of Jules Jacob.


# Observations, let's count states.

The next step is to get a DFA from this. This is typically done by running a [powerset construction](https://en.wikipedia.org/wiki/Powerset_construction). The cost of the powerset operation is highly dependant on the number of set of states that are accessible. Let's get a reasonable upper bound of that.

To help us figure out what happens, here is a visualization of our Levenshtein Automaton for the word "flees" and a maximum edit distance of 1. You can type in strings (`flyers`, `flee`).
The states you end up after stepping into 
the automaton will be displayed in blue.

<b>Levenshtein Automaton for flees (type in!)</b>
<div id='levenshtein-simulator'>
</div>

The most striking thing to notice here, is that after consuming k characters with our NFA, while we end up in more than one state (in blue in the small visualization),  the set of states we are always very close one another.

When you think about it, the reason is actually pretty simple : after n characters, you cannot reach any state with an offset of more than `n + D` (that would mean that you have inserted more than D characters). The same applies with states with an offset of less than `n - D` as it would require to delete more than d characters.

In other words, at one point of time, you know that all of the active state will lie between the offset `n - D` and `n + D`. That's at most `2D + 1` possible positions.

At this point, the only upper bound we have for the complexity of the number of set of states in the DFA and its complexity.
(Note that this is an upperbound and that the reality is probably less grim)

    $$ O \left((D+1)^{2D + 1}N \right)$$

*Where N is the number of characters in the string we are building the automaton for, and D is the max edit distance allowed.*

We also said that our second parameter for each state was the number of edit operations that we can still do and still belong to the language.

So in a sense if we reached the `State(n, d)`, it does not really matter whether we are in `State(n, d-1)` as well. The texts that will match or not in the end will be the same.

# Removing the redundant states

Let's remove the states that are actually imply by other states.

The rule is for any integer k (note that k can be negative), `(n, d)` implies `(n+k, d-|k|)` as it is just a matter burning our jokers to insert or delete characters.

So with our simplification function, our code now looks like:

{% highlight python %}

class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()
    
    def initial_states(self,):
        raise NotImplementedError()
    
    def step(self, c, states):
        next_states = set()
        for state in states:
            next_states |= set(self.transitions(state, c))    
        states = self.simplify(next_states)
        return states

    def step_all(self, input_string):
        states = self.initial_states()
        for c in input_string:
            states = self.step(c, states)
        return states

    def eval(self, s):
        final_states = self.step_all(s)
        for state in final_states:
            if self.accept(state):
                return True
    
    def simplify(self, states):
        return states


class LevenshteinNFA(NFA):

    def __init__(self, query, D=2):
        self.query = query
        self.D = D

    def transitions(self, state, c):
        (offset, d) = state
        if d > 0:
            yield (offset, d - 1)
            yield (offset + 1, d - 1)
        for k in range(min(d + 1, len(self.query) - offset)):
            if c == self.query[offset + k]:
                yield offset + k + 1, d - k

    def accept(self, state):
        (offset, d) = state
        return len(self.query) - offset <= d

    def initial_states(self,):
        return {(0, self.D)}

    def simplify(self, states):

        def implies(state1, state2):
            """
            Returns true, if state1 implies state2
            """
            (offset, d) = state1
            (offset2, d2) = state2
            if d2 < 0:
                return True
            return d - d2 >= abs(offset2 - offset)
        
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        
        return filter(is_useful, states)

{% endhighlight %}

This will not necessarily make our automaton minimal, but it is definitely less hairy.

The new complexity for the number of states in our automaton is

    $$ O \left( D^2 N \right)$$


# So what's next

In their paper, Klaus Schulz and Stoyan Mihov then notice that the transitions function result actually only depends on what are the value of `d` for which we have ``c == query[i]``.  In plain english, as I am about to receive character c, the next state only depends on which of the n+1 characters following my offset is equal to c.
Because of that, they define what they call **a characteristic vector**, a vector of length `len(q)` (for the moment) where the value at offset `d` is True iff `query[i] == c`.

... And some noisy code to make sure that we go past the last character of query.


Our code now become :

{% highlight python %}

class LevenshteinNFA(NFA):

    def __init__(self, query_length, D=2):
        self.D = D

    def transitions(self, state, chi):
        (offset, D) = state
        if D > 0:
            yield (offset, D - 1)
            yield (offset + 1, D - 1)
        for (d, val) in enumerate(chi[offset:]):
            if val:
                yield offset + d + 1, D - d

    def accept(self, state):
        raise NotImplementedError()

    def initial_states(self,):
        return {(0, self.D)}

    def simplify(self, states):

        def implies(state1, state2):
            """
            Returns true, if state1 implies state2
            """
            (offset, D) = state1
            (offset2, D2) = state2
            if D2 < 0:
                return True
            return D - D2 >= abs(offset2 - offset)
        
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        
        return filter(is_useful, states)


def levenshtein(query, input_string, D=2):
    nfa = LevenshteinNFA(D)

    def characteristic(c):
        return tuple(
            v == c
            for (offset, v) in enumerate(query)
        )

    states = nfa.initial_states()
    for c in input_string:
        chi = characteristic(c)
        states = list(nfa.step(chi, states))
    for (offset, c) in states:
        if len(query) - offset <= D:
            return True
    return False

{% endhighlight %}



By doing so, we have built an NFA that works on the alphabet of characteristic vectors.
The benefit of that is that we almost completely removed the part that is dependant on the query. 

This opens the door to building a DFA once, and reuse it for all queries which is the key idea behind the paper.

There is still a bunch of issue before reaching this holy grail. 

First of all, the length of the characteristic vector is right now dependant on the length of the query. But if you look closely, it `transitions` yields a bunch of useless states for the values that go after `offset + D`. Also we saw before that the set of states had offset within a range of length `2D + 1`. We therefore will only need the values of the characteristic vector over a range of `3D + 1`. 

The second problem is that if we try and apply a [powerset construction](https://en.wikipedia.org/wiki/Powerset_construction) blindly on this NFA, we will see that it is not really finite. This NFA actually has an infinite number of states : Imagine it handles queries of any size! Well the trick here is to normalize our states into two parts

- a global offset that is the minimum offset of the states
- the shape of the shifted states (we already saw that there was around )

With this parametric DFA, transition will tell you, given a "shape", what shape to transition two, as well as how much you should add to the global offset.

The implementation of these ideas is a tad tricky, so I am too lazy to detail the code step-by-step, but here is an implementation for reference.


{% highlight python %}

class LevenshteinParametricDFA(object):

    def __init__(self, D=2):
        self.max_D = D

        def transitions(state, chi):
            (offset, D) = state
            yield (offset, D - 1)
            yield (offset + 1, D - 1)
            for (d, val) in enumerate(chi[offset:]):
                if val:
                    yield offset + d + 1, D - d

        def simplify(states):

            def implies(state1, state2):
                """
                Returns true, if state1 implies state2
                """
                (offset, D) = state1
                (offset2, D2) = state2
                if D2 < 0:
                    return True
                return D - D2 >= abs(offset2 - offset)
            
            def is_useful(s):
                for s2 in states:
                    if s != s2 and implies(s2, s):
                        return False
                return True
            
            return filter(is_useful, states)

        def step(c, states):
            next_states = set()
            for state in states:
                next_states |= set(transitions(state, c))    
            return simplify(next_states)
        
    
        def enumerate_chi_values(width):
            if width == 0:
                yield()
            else:
                for chi_value in enumerate_chi_values(width-1):
                    yield (False,) + chi_value
                    yield (True,) + chi_value

        width = 3 * self.max_D + 1
        chi_values = list(enumerate_chi_values(width))
        (global_offset, norm_states) = self.normalize(self.initial_states())
        dfa = {norm_states: {}}
        yet_to_visit = [norm_states]
        
        while yet_to_visit:
            current_state = yet_to_visit.pop()
            state_transitions = {}
            for chi in chi_values:
                new_states = step(chi, current_state)
                (min_offset, norm_states) = self.normalize(new_states)
                if norm_states not in dfa:
                    dfa[norm_states] = {}
                    yet_to_visit.append(norm_states)
                state_transitions[chi] = (min_offset, norm_states)
            dfa[norm_states] = state_transitions
        self.dfa = dfa

    def initial_states(self,):
        return {(0, self.max_D)}

    def normalize(self, states):
        if not states:
            return (0, ())
        min_offset = min(offset for (offset, _)  in states)
        shifted_states = tuple(
            sorted([(offset - min_offset, D)
                     for (offset, D) in states]))
        return (min_offset, shifted_states)

    def characteristic(self, query, c, offset):
        return tuple(
            query[offset + d] == c if offset + d < len(query) else False
            for d in range(3 * self.max_D + 1)
        )

    def step_all(self, query, s):
        (global_offset, norm_states) = self.normalize(self.initial_states())
        for c in s:
            chi = self.characteristic(query, c, global_offset)
            (shift_offset, norm_states) = self.dfa[norm_states][chi]
            global_offset += shift_offset
        return (global_offset, norm_states)

    def eval(self, query, input_string):
        (global_offset, final_state) = self.step_all(query, input_string)
        for (local_offset, d) in final_state:
            offset = local_offset + global_offset
            if len(query) - offset <= self.max_D:
                return True
        return False


param_dfa = LevenshteinParametricDFA(D=2)

def levenshtein(query, input_string):
    return param_dfa.eval(query, input_string)
{% endhighlight %}

The style is a bit weird, but I wanted to emphasize that all of the process is done in the constructor, and that at eval time, the class is behaving like a regular automaton.

So what's the catch? 
Well in a sense our automaton construction has a complexity of `O(1)` if we let alone the preprocessing. The catch is in the eval function. We do need to eval what we called our characteristic function. Why is it not all that bad? 

First, there are many ways to implement it in such a way that is it really cheap. I would be amazed if there wasn't any SSE methods to compute it. But that actually does not really matter.

In the process of building your dfa, you will need a way to map unicode codepoints to the alphabet that really matters. Basically the letters in your query PLUS a symbol that represents letters that are not in your query. Similarly building this alphabet and map it to values of characteristic vectors is very cheap. 
Sure if we want to talk about complexity that's `O(nD)` 

# Lucene's implementation

Lucene has an [implementation](https://github.com/apache/lucene-solr/blob/72aa5784ecd7024dce7599c358b658bed4b31596/lucene/core/src/java/org/apache/lucene/util/automaton/LevenshteinAutomata.java) of this algorithm. There is a bunch of interesting things and one quirk in its implementation.

First the result of the preprocessing is directly serialized into the java code. That approach will shave a few ms to the startup of the library.

Also, the parametric levenshtein automaton, is not used directly but is rather used to construct a DFA. This is also the approach that I take in my current project.

But this DFA works on unicode characters, while their dictionary structure is encoded in UTF-8. Rather than converting UTF-8 on the fly, they prefer to convert the DFA itself to UTF-8, which I found pretty nifty?

So where is the quirk? Well the algorithm used to build the DFA is very strange. 

Rather than just browsing the reachable states of the parametric automaton, it shoves all of the parametric states and all of their transitions.
This is hurting performance pretty badly, but I assume automaton creation is already fast enough for most user's need.


# Conclusion

I hope this blog post will help people who have to implement the construction of levenshtein automaton in an efficient manner.

In my next post, I will tell about extending the concept of Levenshtein Automaton, and building this parametric DFA will suddenly become crucial.

<script src='/js/levenshtein/demo.js'></script>
