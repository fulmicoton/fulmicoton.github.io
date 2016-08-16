---
layout: post
title: Of Caret awareness
category: posts
published: false
tags: draft
---

# Caret Awareness : A neat feature for autocomplete

Around 8 years ago, I read the description of a possible UI
improvement to the traditional autocomplete search box.
I cannot recall the name they used for the feature, but I like to call it
**caret awareness**. (caret is just another fancy name for text cursor). 

Here is the problem it was addressing.
When I search for something, and the results do not seem accurate, I like to add
an extra keyword to refine my query. Sometimes (especially in English), it makes more sense 
to prepend than to append this keyword. In that case I bring the caret at the beginning
of the search box and start typing my extra keyword.

As I am typing these new words, an autocomplete system strictly working on prefix matching
will have a hard time offering me any suggestion. 

*"BarObama", what the hell is this user searching for?*

The idea of caret awareness is to send the autocomplete service
the position of the caret along with the query.  For the query above,
the request to the service is along the line of 

    ?q=BarObama&caret=3


Well I like to do that but is it a power user habit?

According to our logs, 3.5% of the search session involve the user moving the edition
cursor, and starting typing in the middle of the query. 

3.5% is nothing to sneeze at, plus Google does it, so why shouldn't we?
So we added the feature to indeed.com.

<img src="/images/caret_aware/caret_aware.gif">



There are several ways this can be implemented. But here is the twist,
our autocomplete is also fuzzy : if your query is long enough, it 
will start considering options that at Levenshtein-Damerau distance of up to 2.

For instance, even if you mispelled **"attorney"**, indeed will guess that **"litigation attorney"** is really what 
you are searching.

<img src="/images/caret_aware/caret_aware_fuzzy.gif">

But how does it work?


# Caret aware Levenshtein automaton for the win! 

When I first heard about the existence of Levenshtein automaton, I was very surprised.

A mindboggling implication for instance, is that for any given a string s for any given k, there is a regular expression
that match exactly the strings that are at a levenshtein distance from s shorter than k, .

While the result is not really practical at all, it is pretty cool isn't it?

Well actually let's go further : let's consider a regular expression s.
For instance, `ab*c`. In words, we would describe it as "an a, any number of b, followed by a c".

It matches an infinite set of strings :

    {abc, abbc, abbbc, abbbbc, ...}

Let's now extend this set by adding all of the strings that are at a levenshtein distance of less than 1 
from one of the original elements.

We end up with a much larger set, as the string below have been added.

    {yabc, ac, bac, ...}

One can show that there once again exists a finite definite automaton *(hence a regular expression)*
that matches only the strings of this new set.


# What does this have to do with caret awareness ?

Well, our caret-awareness fuzzy search really is all about trying to find entries in a dictionary
that are at levenshtein distance of 2 of a string that matches the regular expression `lit.*atorney`.

We know that there is a DFA that actually does the job. But can we build it efficiently ?

Well adapting the implicit NFA approach is relatively simple.

Essentially, we change our transition function

    def transitions(self, state, c):
        (offset, D) = state
        if D > 0:
            yield (offset, D - 1)
            yield (offset + 1, D - 1)
        for d in range(min(D + 1, len(self.query) - offset)):
            if c == self.query[offset + d]:
                yield offset + d + 1, D - d 

by adding the caret information

    def transitions(self, state, c, offset):
        (offset, D) = state
        # we matched up to the caret, 
        # any character we get can be matched thanks to the ".*"
        # pattern, so staying in the same state is always an option
        if offset == self.caret:
        	yield (offset, D)
        if D > 0:
            yield (offset, D - 1)
            yield (offset + 1, D - 1)
        for d in range(min(D + 1, len(self.query) - offset)):
            if c == self.query[offset + d]:
                yield offset + d + 1, D - d 



In my previous post, I argued that the implicit NFA solution was not as efficient as the parametric
DFA approach of the original paper of Klaus Schulz and Stoyan Mihov.
Caret-awereness is very pathological, as the number of states can rapidly explode.

The problem is that while given a specific `(query,caret)` pair,
the number of states of this automaton is finite, it is not bounded for any query.
In fact, the number of state in the NFA grows linearly with the length from the caret position to the end of
the string **ouch**.

For this very reason, Klaus Schulz and Stoyan Mihov parametric DFA caching trick cannot be applied directly :
The parametric DFA would have an infinity of states. 

I won't go into further detail but what we do is that we approximate the automaton by one that
is kind enough to be bounded. The approximation works as follows : when implementing the NFA 
that is then used to build the parametric DFA, we always trim the set of states by removing the
states with an offset that is lower than the `rightmost state's offset  - 2k + 1 + some margin`.

This approximation only creates very rare false negative for terms in the dictionary that includes some
repetition. For instance if we are searching for `I love<caret> Jar Binks` and our dictionary contains `I love Jar Jar Binks`,
the trimmed automaton will make a mistake because of the repetition `Jar ` coming right after the caret. 
 
So we pre-built the parametric caret-aware automaton for Levenshtein Damerau with a distance of 1, and 2.
The resulting file takes around 2MB.

Once we have that, we can either use a parametric DFA, or build an explicit DFA for our language.
We currently built the DFA because it was pretty fast in practise anyway. 

# The bizarro dictionary

Another issue with caret awareness is that if the caret is toward the beginning of the string,
our automaton has to visit all or most of the our trie.

Let's forget Levenshtein, and consider no fuzzy matching what so ever.
In the case of `l.*atorney`, the intersection with the trie will end up exploring
all of words starting by an `l`.

We solved this problem by processing such queries in the bizarro world, where all string are reversed.
In this world, our query: `l.*atorney`, becomes `yenrita.*l`, and our prefix is suddenly much longer
and way more restrictive. 

This means we ship a bizarro dictionary with our original dictionary. 
If the caret is in the first half of the query, we do our regular matching, but 
if the caret is the second half of the query, then we reverse the query, and 
run it against our bizarro dictionary.  

# All for nothing

Despite the juicy 3.5% of users moving their caret around during queries,
we have not been able to see a measurable impact (positive nor negative)
of caret awareness on any metric that we monitor.

Fuzzy matching on the other hand had a significant impact. 
Most significantly, if we could recycle the keystrokes this feature spared
our user, we could type the complete series of Harry Potter every week.
