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
If you do not index positions nor store documents, an inverted index is in fact typically
much smaller in size than the original data itself.

This compactness is great because this makes it possible to put a large portion, if not all, of 
the index in RAM. Unfortunately, compact structures like this are typically not very easy to modify.

Let's assume that you have indexed 10 millions document, and you want to add a new one.
The document might contain for instance a single token, the word "rabbit".

In order to add this new document, we need to add the document id `10_000_000` to the posting list
associated with the word "rabbit". No matter how optimized our algorithm is, this will require
moving around all of the postings list coming after the one associated with the word "rabbit".

Another problem is that *tantivy* is supposed to be designed to handle building an index that
does not fit in RAM. How are we going to handle the book keeping of a possibly huge term dictionary 
for instance.

Well, this blog post will explain how this is done ... 


# A lot of small indexes called segments


Well, our problems are quite similar to the problem of 
[sorting a list of integers that does not fit in RAM](http://neopythonic.blogspot.jp/2008/10/sorting-million-32-bit-integers-in-2mb.html).
The most common solution to this is to split the input file, in more chewable chunks (that fits in RAM
that is). You can then sort the different parts independently, 
and merge the resulting parts (altogether using a priority queue, or in a pyramid fashion for multithreading).
Tantivy's indexing works in a similar fashion.

While my [last post](/posts/behold-tantivy/) described a large single index,
a [tantivy](http://github.com/tantivy-search/tantivy) index actually
consists in several smaller pieces called **segments**.

If you went through tantivy's tutorial, you may have noticed that after
indexing wikipedia, your index directory contains a bunch of files,
and all of their filenames follow the pattern 

	SOME_UUID . SOME_EXTENSION

The UUID part identifies the segment the files belong too, while the extension
identifies which datastructure is stored in the file (as described in the first
post). Really, each segment contains all of the information to be a complete
index, including its own entire term dictionary.

An exception to this rule is the `meta.json` file. It specifies a bunch of
meta information about your index. This file is written in plain human-readable JSON,
so you may have a look at its content.

The `segments` field contains the list of segments that belong to the segment.
If you were to edit this file and removed half of the segments within this index,
your index would still be entirely functional...
It would simply contain less documents. This design simplifies parallelized
or distributed indexing, as well as sharding.



# Segments and commits

Let's assume we want to create a brand new index.

<p class="disclaimer">
I will not address deletes in this blog post, as they add a lot of
complexity to the index.
</p>

After defining our schema, and creating our brand new empty index,
we need to add our documents. Tantivy is designed to ingest documents
in large batches : rather than really adding one document at a time,
you are expected to add a bunch of documents all at once.

API wise, this is done by getting an `IndexWriter`, 
and calling `index_writer.add_document(doc)`
once for each document of your batch, and finally call `index_writer.commit()`
to finalize the batch.


<p class="disclaimer">
Before calling `.commit()` none of your document is visible for search. 
In fact, before calling `.commit()`, none of our operations is persisted either.

If a power surge happens while you are indexing some documents, or even during `commit`,
your index will not be corrupted. Tantivy will just restart in the state of your last successful commit.
</p>

Under the hood, when you call `.add_document(...)`, your document is in fact just added
to an indexing queue. As long as the queue is not saturated, the call should not block
and return right away. Application using `tantivy` are in charge of managing a journal if they 
want to ensure persistency of each insert.

The index writer internally handles several indexing threads who are consumign this queue.
Each thread is working on building its own little segment. Eventually one of the thread
will pick your newly added document and add it to the segment it is writing.
You have no control on which segment your document will be routed to.

These indexing threads are working mostly in RAM and use very different datastructures than
what was described in part 1. They are adapted to receive modifications.
We will discuss their nature in detail in the [stacker section](#stacker).

Every thread has a memory limit (that is defined by the user). Once this limit is hit, the indexing
thread stops processing documents and proceeds to serialize this in-RAM representation of a segment
to the compact representation I described in my [previous post](/posts/behold-tantivy/).

The resulting segment has reached its final form, and will not be modified anymore. At this point, your document is
however, still not searchable.

Our fresh segment, is internally called an `uncommitted segment`. 
An uncommitted segment will not be used in search queries until the user calls `.commit()`.

When you commit, your call block and all documents that were added to the queue before the commit
get processed by the indexing threads. All of the indexing threads get a signal that they 
need to finalize the segment they were building, regardless of their sizes.

Finally, all `uncommitted segments` become `committed segments` and your document is now searchable.
Your call returns there.


# Search performance, the need for some merging

Having many segments, possibly small, has on search IO time, search CPU time, and index size.


---

### Search IO time

This assumes that the postings list are not in page cache initially. 
When searching for a single term for instance, we will have to do `N` random seeks
to start reading the posting list of each segments. Each of this random seek will take
around `10ms` on a hard drive, `100 microsecs` on an SSD. In both case, this IO 
will overwhelmingly dwarf CPU time, and it is very important to merge our segments.


### Search CPU time

When executing a search query actually requires to loop over all of the segments
and combining the different results. Some of the work 
will have to be done once per segment. For instance, for each of segments and
for each terms of the query, we will have to do a lookup in the term dictionary.

### Index size

All of the individual segment dictionary may contain similar terms. 
One big dictionary is likely to be smaller than the sum of all of these 
smaller dictionaries. Also compression is likely to be more efficient.


---

Assuming we are building an index with 10M documents, and our individual thread heap memory limit
was producing segments of around 100K documents, indexing all of the documents would produce 100 segments.
This is definitely too many.

For this reason, while indexing tantivy's `index_writer` also continuously considers the opportunity of merging
segments together. The strategy used by the `index_writer` is defined by a `MergePolicy`.

You can read about [merge policies in Lucene in this blog post](http://blog.mikemccandless.com/2011/02/visualizing-lucenes-segment-merges.html).

The merge policy by default in tantivy is called [LogMergePolicy](`https://github.com/tantivy-search/tantivy/blob/master/src/indexer/log_merge_policy.rs`)
and was contributed by **currymj**.


<p class="disclaimer">
It may be tempting to always try to have one single segment.

In practise, if most of your index fits in RAM, as you merge
segments, the benefit of having less segments will
become less and less apparent.

Having half a dozen of segments instead of having one big
segment make very little difference in performance.
</p>


# Indexing Latency vs Throughput, search performance

As we explained  **adding a document, does not make it searchable right away.**
You might be tempted to call `.commit()` very often in order to lower the time
it takes for a document you added to become visible for search. Let's call this timing
the **indexing latency** of our search engine.

Please do this carefully as it as there are downsides to call `.commit()` frequently.

First, calling `.commit()` currently stops all of the indexing threads, and document ingestion
is stopped until all indexing threads have finished serializing the segments they were working on.
Some threads might finish earlier than others, in which case, tantivy will be wasting CPU time by keeping
some of your CPU cores idle. 

Also, when you commit, you typically produce small segments.
Smaller segments means that in average a document will have to go through more
merge operations in order to reach a segment with the optimal size.

In other words, committing too often will hurt your indexing throughput considerably, as well as 
you search performance if the merge policy do not keep the number of segments low.

Yet again we face the everlasting war of latency versus throughput.



# <a name="stacker"></a>Stacker datastructure

Now let's talk a little bit about how the segments are built in RAM.
I will not talk about how fast fields or stored fields are written, as their implementation 
is quite straightforward. Let's focus instead on the inverted index instead. 

When serializing the segment on disk, we will need to iterate over the sorted terms,
and for each of these terms, have access to an iterator over the `docids` that contain this term.

The first prototype of `tantivy` was simply using a `BTreeMap<String, Vec<u32>>`  to do this job.
The code would simply go through the document one by one, and :
	- increment the doc id
	- tokenize the document
	- for each token look for the posting list (`Vec<u32>`) associated to the term and append the `DocId` to each of the postings list.

Depending on the indexing options, we may also need to keep the term frequencies and the term positions.

If we index term frequencies, then the `Vec<u32>` above will contain a lasagna of `doc_id_1`, `term_freq_1`, `doc_id_2`, `term_freq_2`, etc.
If we index positions as well, then the `Vec<u32>` will also contain the term position as follows, 
`doc_id`, `term_freq`, `position1`, ..., `position_termfreq` .



## No more BTreemap

The current version of tantivy is slightly more complicated than `BtreeMap`. I call this component the *stacker*, as it feels like we are trying put `DocId`s on top of FIFO stacks associated with each terms.

First, since we only need the terms to be sorted when the segment is flushed to disk, it is better to use a `HashMap` and just sort the terms at the very end.

# A small disappointment at the standard library `HashMap`.

The solution that just uses the standard library's `HashMap<Vec<u8>, Vec<u32>>` is already a nice improvement but it is not really perfect.

Let's assume that we meet a token. We will `.get_or_create()` the `Vec<u32>` associated to our term.
There is 2 ways to implement this `.get_or_create()`.

- using the [Entry API](https://doc.rust-lang.org/std/collections/struct.HashMap.html#method.entry)
sounds like a great idea, but it will require us to create a `Vec<u8>` for our `&[u8]` key 
regardless of whether a postings list exists or not. Ideally we would like to only create this `Vec<u8>`
when this entry does not exist yet.

- calling `.get(key: &[u8])` does not require any allocation, but we will end up 
computing our hash key twice, in the case we end up needing to insert the key.

Surely, one could imagine workarounds to this problem (wrapping the key into an object
that can cache its hash for instance). Yet the fact remains (as far as I know), Rust's default hashmap does
not offer to get the best of two worlds.



<p class="disclaimer">
You might be thinking that optimizing for the case where we insert a term for the first time is irrelevant. 

In the end, the Zipf distribution will probably rapidly give us only one or two new terms per documents.
<br/><br/>
Well, tantivy can also be used to implement an analytics data store. This is arguably the type of usage for which it shines the most. 
<br/><br/>
In these use cases, fields can take very different distributions, ranging from being 
close to unique (user ids), to belonging to all documents.

Lately, in addition to good'ol Wikipedia, I have been working a lot with the <a href="https://grouplens.org/datasets/movielens/">movielens</a> analytics dataset in order to optimize indexing for different ranges of use cases.

Both exhibits very different bottlenecks and are extremely complementary.
</p>

If we want to avoid these we're going to have to implement our own `HashMap`.


# Using a memory arena

As explained when a term is found for the first time, we will probably have to 
allocate a new version of it for our HashMap entry. 

Considering the number of such allocations, it might be interesting to 
make those as fast as possible by using an adhoc memory arena with a bump 
allocator.

In addition, the user needs to somehow tell tantivy how far a segment
can grow before being finalized. The first version of tantivy was using a number of documents
as a limit. The problem with this, is that the user typically have no idea of what a 
reasonable parameter should be. There is no reasonable default value either as it is highly dependant
on the size of the documents.

Instead, current versions of tantivy let the user define a memory budget for tantivy to work with.
This memory budget is then split between the threads, and used to choose the size of the hash table
as well as the size of the memory arena.

This memory arena does not offer any API to deallocate objects. We just erase the heap entirely [*Magna doodle style*](https://en.wikipedia.org/wiki/Magna_Doodle) when the segment is finalized and we start writing a new segment.

![magna doodle](/images/tantivy/magnadoodle.jpg)

By looking at the top of the heap, we also know at all time how much memory is used. After each document, we can check whether we are close to 
capacity of the memory arena, and, if is reached, we can decide to finalize the segment.


# Location, location, location

Stacking -or building this postings list- requires jumping in memory quite a lot.
The array used to store the bucket for the `HashMap` cannot reasonably include our keys as keys may have 
a random length. Instead each bucket contains a pair 

	(hash: u32, addr: u32)
	
An empty bucket is expressed by the special value `addr==u32::max_value()`.

When the bucket is not empty, on the other hand, `addr` is the address, in the memory arena, where both
the key and the value are stored.

At this address, we encode, in this order :
- the length of the string over two bytes
- the key follows (variable length)
- the posting list object (24 bytes).

You might be surprised that the posting list is fixed. Its size is constant in the same sense that the a `Vec`
object is `Sized`. It simply has a pointer to another 
area in memory. Let's describe it in detail.


# Exponential unrolled linked list

We cannot reimplement   `Vec` over our memory arena : when it reaches capacity it would have to reallocate a greater version of itself and deallocation is not possible. Also, we do not really care about having fast random access. We only read our values when our segment is serialized to disc, so we are satisfied with a decent sequential access.

A common solution to this problem is to encode this as an *unrolled linked list*, or, if like me you are not too 
familiar with the term, a linked list of blocks of `B` values.
Assuming a block size of `B`, browsing through a list of `N` elements now requires `N` / `B` jumps in memory.
Of course, the last block may not be full, but we will only end wasting at most `4 * (B - 1)` (we are storing `u32`)
slots of memory.

Choosing a good value of `B` is a bit tricky. Ideally, we would like a large `B` for a dataset where there are 
few terms, and some of them are extremly frequent, and we would like a very small `B` for a dataset where some of the terms
are unique `id`s for instance.

Instead, `tantivy` chooses to use the same trick as `Vec` here, and allocates blocks that are exponentially bigger and bigger.
That way, if the last block contains only one element, we know for sure that we are wasting at most half of the memory.
We also require only `log_(N)` jumps in memory to go through a long posting list of `N` elements.

In addition, in order to further optimize, the first 3 elements are inlined with the value, so that our value looks like this.

	struct ExpUnrolledLinkedList {
		len: u32,
		end: u32,
		// -- inlined first block
		val0: u32,
		val1: u32,
		val2: u32,
		// -- pointer to the next block
		next: u32,
	}

`end` contains the address where the next value to be added should be written, so that we do not need to browse through the list to stack a new value.

`len` is also required in order to detect when a new block should be created.


# Which hash function ?

At this point, profiling showed that the major part of the time is spent hashing our terms.

I tested a bunch of keys. Previous version of tantivy were using `djb2` ; which has the benefit of being fast and simple.

It performed really well on the wikipedia dataset, but not as well on the `movielens` dataset. `movielens` is a dataset of movie reviews and it includes a lot of *close to unique* terms, like userIds.

More precisely, I noticed that indexing a segment was relatively fast at the beginning of the segment. But as the hash table was getting more saturated, indexing would get slower and slower, and finish about twice as slow.


I suspected that we were suffering from collisions. 
There is really two kind of collisions : 
- two keys are mapped to the same bucket, in which case testing the equality of the hash key in the hash table should help identifying that we need to find another bucket using a probing method that has an ok locality (`tantivy` uses quadratic probing).
This happens very frequently. As often as our table is saturated.

- two keys are different but have the same hash, in which *tantivy* has to check for string equality. This requires painfully jumping in memory and comparing the two strings.
Assuming a good 32-bits hash key, so the rate at which these collisions it should happen with a rate of roughly `K / 2^32`, where K is the number of keys inserted so far. (In fact slightly less than this but this is a good approximation). So if we have 1 million terms in our segment, this should happen at a rate of roughly 1 out of 4000 new term inserted. 

Unfortunately, by construction, `djb2` gives comparatively a lot of `hash` collisions for short terms.
I tried different crates offering implementation of various hash, and ended up settling for a short rust reimplementation 
of murmurhash32. Problem solved !


# Benchmark

The first version of tantivy would take 40mn to index Wikipedia, without merging any segments.