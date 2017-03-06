---
layout: post
title: Of tantivy (part 2) - Indexing
category: posts
published: false
tags: search, tantivy, rust, information retrieval
---

# Avant-propos

In my [last blog post](behold-tantivy), I talked about the datastructures that are used in a tantivy index,
but I did not explain how indexes are actually built.

You may have notice that the data representation is very compact.
If you do not index positions, or store documents, an inverted index is in fact typically
smaller in size than the original data itself.

This compactness is great because this makes it possible to put a larger portion of 
the index in RAM, and offers great locality in general.
Unfortunately, compact structures are typically not very easy to modify.

Let's assume that you have indexed 10 millions document, and you want to add a new one.
The document might contain for instance a single token, the word "rabbit".

In order to add this new document, we need to add the document id `10_000_000` to the posting list
associated with the word "rabbit". No matter how optimized our algorithm is, this will require
moving around all of the postings list coming after the one associate with the word "rabbit".

Well, this blog post will explain how this is done ... 


# A lot of small indexes called segments

While my last post describe a large single index,
a [tantivy](http://github.com/tantivy-search/tantivy) index actually
consists in several smaller pieces called segments.

If you went through tantivy's tutorial, you may have noticed that after
indexing wikipedia, your index directory contains a bunch of files,
and if you exclude `meta.json`, all of their filenames follow the pattern 

	SOME_UUID . SOME_EXTENSION

The UUID identifies the segment the files belong too, while the extension
identifies which datastructure is stored in the file (as described in the first
post). Really, each segment contains all of the information to be a complete
index, including its own entire term dictionary.

The file called `meta.json` specifies a bunch of information about your index. This file is written in plain human-readable JSON, so you may absolutely have a look at its content.

The `committed_segments` field contains the list of segments that are ready to use for search. If you were to edit this file and removed half of the segments within this index, your index would still be entirely functional... It would only contain less documents.



# Segments and commits

Let's assume we want to create a brand new index.

<p class="disclaimer">
I will not address deletes in this blog post, as they are unsupported in `tantivy 0.2`
and add a lot of complexity to the index. The feature is scheduled for `tantivy 0.3`, 
which should be released very soon.
</p>

After defining our schema, and creating our brand new empty index,
we need to add our documents. This is done in batches. Rather than really adding one
document at a time, you are expected to add a bunch of documents all at once.

API wise, this is done by creating an `IndexWriter`, call `index_writer.add_document(doc)` once for each document of your batch,
and finally call `index_writer.commit()` to finalize the batch.

<p class="disclaimer">
Before calling `.commit()` none of your document is visible for search. 
In fact, before calling `.commit()`, none of our operations is persisted either.

If a power surge happens while you are indexing some documents, or even during `commit`,
your index will not be corrupted, and tantivy will restart in the state of your last successful commit.
</p>

Under the hood, when you call `.add_document(...)`, your document is in fact just added
to an indexing queue. Provided the queue is not saturated, it should return right away.

The index writer internally handles several indexing threads who consume this queue.
Each thread is working on building its own little segment. Eventually one of the thread
will pick your document and add it to the segment it is writing. You have no control on which
segment will be routed.

These indexing threads are working mostly in RAM and use very different datastructures than
what was described in part 1. These datastructures are way more adapted to modification.
For instance, our term dictionary is a hashmap, and our inverted lists are a variant of
unrolled linked lists. 

Every thread has a memory limit (that is defined by the user). Once this limit is hit, the indexing
thread stops processing documents and proceeds to serialize this in-RAM representation of a segment
to the compact representation I described in my last post.

The resulting segment has reached its final form, and will not be modified anymore. At this point, your document is
however, still not searchable.

Our fresh segment, is called an `uncommitted segment`. 
In order to make your document searchable you need, as a user to call an operation called `commit()`.

When you commit, all documents that were added to the queue before the commit keeps being processed by the indexing threads. All of the indexing threads then finalize the 
segment that they were building, regardless of their sizes.

Finally, all `uncommitted segments` become `committed segments` and your document is now searchable.



# Search performance, merging

Having many segments, possibly small, has an impact both in the index size and on 
search CPU time.

For instance, many terms might are likely to be present in the dictionary
of all of every little segments. In comparison, one big segments with a single
big dictionary is likely to be smaller than the sum of the size of the different dictionaries.

On the search side, executing a search query actually requires to loop over all of the segments
and combining the different results. For each of segmetns and for each terms of the query, we will have to do
a lookup in the term dictionary and then go through the posting lists.
Once again, one big dictionary will spare use `N-1` term dictionary lookup.

Assuming we are building an index with 10M documents, and our individual thread heap memory limit
was producing segments of around 100K, indexing all of the documents would produce 100 segments.
This is definitely too many.

For this reason, tantivy's `index_writer` also continuously considers the opportunity of merging
segments together. The strategy used by the `index_writer` is defined by a `MergePolicy`.
You can read about [merge policy in this blog post](http://blog.mikemccandless.com/2011/02/visualizing-lucenes-segment-merges.html).

The merge policy by default in tantivy is called [LogMergePolicy](`https://github.com/tantivy-search/tantivy/blob/master/src/indexer/log_merge_policy.rs`)
and was contributed by **currymj**.

<p class="disclaimer">
As you merge segments, the benefit of having less segments will
become less apparent, as the cost of lookup will become 
relatively less and less expensive compared to going through
the postings list and computing the matching
docset.

For this reason, for most usage, having half a dozen of segments instead of
having one big segment will make very little difference in performance.
</p>


# Indexing Latency vs Throughput, search performance

As we explained  **adding a document, does not make it searchable right away.**
You might be tempted to call `.commit()` very often in order to lower the time
it takes for a document you added to become visible for search. This time is also
called the indexing latency.

Please do this carefully as it as there are downsides to call `.commit()` frequently.

First, calling `.commit()` currently stops all of the indexing threads, and document ingestion
is stopped until all indexing threads have finished serializing the segments they were working on.
Some threads might finish earlier than others. Some of those segments may be very small.

Producing smaller segments means that each document will have to go through more
merge operations in order to reach a segment with the optimal size.

In other words, committing too often will hurt your throughput considerably, as well as 
you search performance if the merge policy do not keep the number of segments low.

Yet again we face the everlasting war of latency versus throughput.
