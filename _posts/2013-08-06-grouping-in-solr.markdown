---
layout: post
title: Of collapsing in Solr
category: posts
published: true
---



## A post about Solr.


This post is about the innerworkings of one of the two most popular open source search engines : [Solr](http://wiki.apache.org/solr/SchemaRESTAPI). I noticed that many questions (one or two everyday) on solr-user's mailing list were about Solr's collapsing functionality. 

I thought it would be a good idea to explain how Solr's collapsing is working. Because its documentation is very sparse, and because a search engine is the kind of car you to take a peek under the hood to make sure you'll drive it right.


## Regular search


### Phase 1 - Getting the document ids list.

Before jumping into collapsing let's review without going into the details how a regular search engine works. 

When ingesting a document, a search engine starts by attributing it a document id that usually takes shape into an integer as small as possible. Consider it a simple incremental index.

Then, it splits the text of the document into words. For each word encounterred, it creates a list of doc ids that contained this word. This data structure is usually called inverted list, or posting list.

What happens then when someone search for the ten most recent documents containing the words `Burgundy` and `wine`. Both posting for `Burgundy` and `wine` are opened. The list of document ids containing both words is then logically the intersection of the two lists.

An important point here is that posting lists are sorted. The main benefit for that is that it makes computing the intersection or the union of two posting lists much easier. You just need to scan the two lists at the same time, and check for their first two elements. Here is the implementation of this algorithm in Python. The algorithm is linear in time and bounded in memory.

    {% highlight python %}

    def intersection(left, right):
        left_head = left.next()
        right_head = right.next()
        while True:
            if left_head == right_head:
                yield left_head
                left_head = left.next()
                right_head = right.next()
            elif left_head < right_head:
                left_head = left.next()
            else:
                right_head = right.next()
    {% endhighlight %}

This simple scan makes it possible to keep correct performances even when your posting list is still on your hard disk.

### Phase 2 - Getting the ten best document ids sorted.

Once the list of document ids have been retrieved, the search engine 
goes through this list of document ids and retrieves the sorting field for each of the document. Here it is the date. For this reason, it is very important that the index holds in RAM a map going from document ids to the sort field.
For this reason you need to use an indexed field (in which case it will get uninverted, one of Lucene's exotic feature) or a docValue.

It then appends the document to a collector object which will make sure to only retain the n-best documents. Many algorithm exists for that. A pythonista could just call [``heapq.nlargest``](http://docs.python.org/2/library/heapq.html).

All of these algorithms are linear in the number of document ids we have, and bounded in memory.

### Phase 3 - Get the storables

Once the document have been selected, we can finally iterate on them, and fetch for all the other field that we need to give back to the user. There is only ten documents here, so it is ok if some of the documents actually require to hit the disk. These fields are what Solr calls storable field.


## Distributed search



When your reached a big number of document, Solr makes it easy to cut your index and distribute it into different computers called shards.

The server receiving the request will play the role of a master for the request. It will dispatch relevant requests to the shards, 
and merge their answers.

A typical search query will be done in two rounds.

### Round 1
The server receiving the query asks all of the shards for their ten best document ids, along with their score (here the date). 
He can then merge these list and retrieve the ten best document ids  in the whole index.

### Round 2
The computer asks the different shards for the full document associated to these document ids.

I think we are all set to think about how things are done when grouping / collapsing.


## Non-distributed Grouping queries 

As we did for a regular search, let's first consider the non-distributed case.

### Phase 1


We fetch the list of document ids matching the query. Nothing different here.

### Phase 2

We loop on the document and fetch in some map living in RAM both 
the score and the grouping field value. Our collector is slightly
more tricky here. Instead of keeping a data structure holding the ten best doc ids, we will keep the ten best group values.

The collector implementation in Lucene is in AbstractFirstPassGroupingCollector](https://github.com/apache/lucene-solr/search?q=AbstractFirstPassGroupingCollector&ref=cmdform) and maintains the list of the n-best groups until now implicitely sorted.

We are once again bounded in memory and linear in number of doc ids.

Below is a simple possible implementation of such a collector.
Python doesn't come with any equivalent of a red-black tree. I used here the very nice bintree package that needs to be pip-installed. It basically acts as a dictionary for which items remains sorted by their keys.

Lucene itself relies on Java's TreeMap.

{% highlight python %}

from bintrees import BinaryTree

def collapsing_first_round_collector(docs, n_bests):
    # we actually use it as an ordered set.
    top_score_group = BinaryTree()
    top_group_score = {}
    for (doc_id, group_val, score) in docs:
        if len(top_score_group) >= n_bests:
            worst_score, worst_group = top_score_group.min_key()
            if score <= worst_score:
                # there is already n candidates and 
                # not better than the worst of them
                continue
        if group_val in top_group_score:
            former_score = top_group_score[group_val]
            if score < former_score:
                # we just need to update the score
                # associated to the group
                continue
            del top_score_group[(former_score, group_val)] 
        top_group_score[group_val] = score
        top_score_group[(score, group_val)] = True
        if len(top_score_group) == n_bests + 1:
            # we need to erase one the extra element
            (last_score, last_group) = top_score_group.pop_min()[0]
            del top_group_score[last_group]
    return list(reversed(list(top_score_group.keys())))


{% endhighlight %}


### Phase 3

Once the groups to be returned are selected, we need to return the best `group.limit` hits associated to this group.

Once again this will only be a matter of scanning through the doc ids, check if the group value belongs to the top 10 groups, and if so, append it to a dedicated collector. The sort used here to select the best hits belonging to a group can be completely different from the one used to select groups.


## Distributed Grouping queries


The server receiving the request will play the role of a master for the request. It will dispatch relevant requests to the shards, 
and merge their answers.

Distributed grouping queries are done in three rounds.


### Round 1

The master asks all of the shards for their ten best group ids, along with their score (here the date).
Each shard computes them by running phase 1 and 2 of the non-distributed case. They give back their local ten bests group values and their score.

The master can then merge these lists and retrieve the ten best group ids in the whole index.

### Round 2

All of the shards are asked for their best `group.limit` representant doc ids and their score for each of these best groups. The group ids are passed within the query.

The server can then merge these results and deduce the best hits to be returned for each of the best groups.

### Round 3

The shard are requested for the documents.


## What can we deduce from that?

At this point, all the extra queries appearing in your log should start to make sense.

In addition, you should rapidly get the sense of what can be done and what cannot be done. Sorting groups by descending lowest value of a field is conceptually impossible in linear time, and bounded memory without pre-processing, while ascending lowest value is very simple.

You should also get a sense that giving back the exact number of groups would require at one point for the shards to send back the list of all the group term they encounterred which is way too expensive. Solr chose to have the shard send back the number of groups encounterred, and returning the sum of all of these. This result is actually only correct if you made sure to partition your index with respect to your group values. If it is not the case, Solr 
will only give you back a big upper bound.

We also now understand that, grouped or not, queries asking for results from the 100th to the 110th (page 10) to a distributed search engine are very expensive, as they require to query the shards for the results from 0 to 100.

Finally we observe that solr could run round 2 and round 3 at once if the index was partitioned with respect to the group values.


