---
layout: post
title: Of tantivy's indexer datastructure, the stacker
category: posts
published: false
tags: tantivy, datastructure 
---

Of stuff tantivy does differently : the stacker
---------------

It is not a secret : Tantivy is very heavily inspired by Lucene's design and implementation.
Whenever I have a doubt about how to implement something, I dive into Lucene codes and make it 
my default choice. Lucene is simply the most robust and readable search engine implementation.

There are however a couple of tiny points that tantivy does a bit differently than lucene.
And hopefully a little better (?)... I'd love it if these ideas proved to be good, and were to be 
stolen by other projects.

I hope I will be able to find time in the future to describe these ideas one by one, 
but let's be honest: my life has been very busy lately, and it is fairly difficult for me to find time to blog.

In this first post, I will describe a datastructure that is at the core of tantivy's indexer
and differs from what I have seen so far. I suspect it could be hopeful outside of search,
for instance sort a log into user sessions, implement an alternative `sort -k`, etc.


## The problem we are trying to solve : Building an inverted index.

Most search engine rely on a central datastructure called an inverted index.
For simplification purpose, let's consider documents simply consist of a single String, and are identified by a `DocId`.

Conceptually, a document text is split into a sequence of words. We call those words *tokens* and the splitting operation *tokenization*.
The inverted index on the other hand, makes it possible to access the list of documents given a token. This list of document is also called a *posting list*.

In other words, your set of document might look like 

```
doc1 -> [life, is, a, moderately, good, play, with, a, badly, written, third, act]
doc2 -> [life, is, a, long, process, of, getting, tired]
doc3 -> [life, is, not, so, bad, if, you, have, plenty, of, luck,...]
...
```

Your inverted index looks like :

```
play -> [1]
plenty -> [3]
luck -> [3]
process -> [2]
life -> [1,2,3]
is -> [1,2,3]
a -> [1,2]
moderately -> [1]
...
```

We therefore need to take a infinite stream of documents and build our inverted index.
We need this process to be performant. 


A naive implementation could look like this `HashMap<String, Vec<DocId>>`.
Our indexing function would then look as follows.
 
```rust
use std::collections::HashMap;

pub type DocId = u32;
pub type Document<'a> = (DocId, &'a str);
pub type InvertedIndex = HashMap<String, Vec<DocId>>;

fn tokenize(text: &str) -> impl Iterator<Item=&str> {
  text.split_whitespace()
}

pub fn build_index<'a, Corpus: Iterator<Item=Document<'a>>>(corpus: Corpus) -> InvertedIndex {
    let mut inverted_index = InvertedIndex::default();
    for (doc_id, doc_text) in corpus {
        for token in tokenize(doc_text) {
            inverted_index
                .entry(token.to_string())
                .or_insert_with(Vec::new)
                .push(doc_id);
        }
    }
    inverted_index
}
```

# Internally ...

Tantivy's actual representation of the inverted index is considerably more efficient than this. Terms are represented by a finite state transducer and the posting lists are compressed using bitpacking... 

But this highly compact datastructure is not mutable, so that we still need a mutable in-memory datastructure similar to the index `HashMap<...>` above.

Conceptually speaking, Tantivy's indexing look like this :

```rust
use std::collections::HashMap;

pub type DocId = u32;
pub type Document<'a> = (DocId, &'a str);
pub type DynamicInvertedIndex = HashMap<String, Vec<DocId>>;

fn tokenize(text: &str) -> impl Iterator<Item=&str> {
    text.split_whitespace()
}

fn memory_budget_reached() -> bool {
    // Not implemented!
    // We need to somehow find a way to monitor our memory usage.
    true
}

fn serialize_segment(inverted_index: &DynamicInvertedIndex) {
    // write our segment on disk and add it to our segment list.
}

pub fn build_index<'a, Corpus: Iterator<Item=Document<'a>>>(mut corpus: Corpus) {
    let mut inverted_index = DynamicInvertedIndex::default();
    for (doc_id, doc_text) in &mut corpus {
        for token in tokenize(doc_text) {
            inverted_index
                .entry(token.to_string())
                .or_insert_with(Vec::new)
                .push(doc_id);
        }
        if memory_budget_reached() {
            serialize_segment(&inverted_index);
            inverted_index.clear();
        }
    }
    index_serializer.serialize_segment(&inverted_index);
}
``` 

In plain english, we create an in-memory index, add documents into it until we 
reach a memory budget, at which point we build our read-only super compact and  efficient on-disk index representation.

Each time we flush, we create a new read-only independant index that is called a segment. As the number of segments raises, a background task is in charge of merging segments together to keep the number of segments reasonable...

But this post is not actually about our in-memory datastructure. Can you do better than the hashmap above?

# Requirements and observations

Here is a bunch of observations that gives a hint of what could be improved about this `HashMap` solution.

### 1. We'd love to know the memory usage accurately

Tantivy's API let's the user give tantivy a memory budget and tantivy 
does a very good job at sticking to it. That way tantivy 
can index datasets of any size (I already indexed corpuses of 5TB on a 8GB RAM machine) without swapping. This is extremly comfortable for the user.

It is very difficult to estimate the amount of memory used by our `HashMap`
however. 

### 2. We never delete terms, and we only append stuff to the posting lists

The pattern with which we populate our HashMap is very simple. We only insert new terms, and never delete any.  We only append new data to posting lists.
Memory is released in bulk at the very end.

### 3. We only read postings lists once, when we serialize the segment.

Indeed, as we add documents, we only append new doc ids at the very end of our process. We never read which docs are part of the posting list before that.

### 4. `HashMap<String, Vec<_>>` do not enforce great locality.

Think about it. After you found the matching entry in your table, you still need to check for string equality because we cannot really rule out the chance of a collision. It will require to follow a pointer and access the `String` characters. Similarly, appending to the `Vec<_>` will require you to follow
write in distant memory address. 

### 5. On normal payload frequent strings are likely to happen rapidly.

Your most frequent words are likely to appear very rapidly as you go through your doc. I'll leave this enigmatic statement here, and discuss it further later. 

### 6. We need to be cpu and memory efficient, regardless of the distribution of words. 

Typically on natural text, one can expect a [Zipf distribution](https://en.wikipedia.org/wiki/Zipf%27s_law), but when indexing logs, we might encounter a lot of sparse fields (e.g. user cookie), or saturated fields (e.g. application name).

# Discussions

1. 2. (and 5) are screaming for the usage of a memory arena.
Instead of spending time allocating things and asking our memory allocator to handle all of this book keeping, let's simply put these in a memory arena.
The 
