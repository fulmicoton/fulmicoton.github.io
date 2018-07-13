---
layout: post
title: Of hosting files in url minifiers
category: posts
published: true
tags: hack, python, url minifiers
---

# Of storing files in url minifiers

Today I had an epiphany while staring at a very long url.
I thought: "Url minifiers are really nice to store all of this data for free".
And then it stroke me... One can really store 4KB of arbitrary data
with a url minifier system and share it for free.


# Storing files as a programming puzzle

So here is a programming puzzle. You are given a service that has two operations:
- *PUT*: accepts payloads of at most 4KB of data, stores it and returns
a unique key of exactly 16 bytes
- *GET*: if you supply  a key, you can then fetch your original payload.

Given this abstraction, how would you store files of an arbitrary length,
such that random seek, and download concurrently is possible?


# A solution

We first split the file into 4KB pages and store each of them.

We are then left with a long list of keys aiming at these pages.
Of course sharing the list of keys would be lame. We want to store this list in
the url minifier service as well.

One page can hold 256 urls. We build packs of 256 urls and store them
as we did for the pages.

We can recursively apply the same trick until we are left with a single root key.

Anyone who knows this root key could now download all of our file.


Even better, the urls are forming a tree structure that allows for efficient
random access in the middle of the file.

# Actual implementation

I actually experimented with the idea with a famous url minifying service.
The first version was single threaded and I was downloading at a bit less than 20KB/s.
But when I tried to download 30 pages concurrently, I reached a very decent download
speed of 400KB/s, downloading my 3MB file in a little bit more than 7s.
I did not hit any rate-limiting at any time.

Since I don't want to cause any trouble to any service, I will not share my script
as is... Instead here is a proof-of-concept version of my script, without
multithreading and with a mock in place of the url minifier implementation.

{% highlight python %}

#!/usr/bin/python
# -*- coding: utf-8 -*-

import json
import base64

KEY_SIZE = 1 << 4    # the url size
PAGE_SIZE = 1 << 12         # the page size
NUM_KEY_PER_PAGE = PAGE_SIZE / KEY_SIZE

class Minifier:
    def put(self):
        raise NotImplementedError()
    def get(self):
        raise NotImplementedError()


class MockMinifier(Minifier):
    """ This replace our url shortener service.
    Very handy for unit tests."""
    def __init__(self,):
        self.dictionary = []

    def put(self, data):
        key = len(self.dictionary)
        self.dictionary.append(data)
        return ":" + str(key).zfill(KEY_SIZE - 1) # in the mock we
            # do not return a url... just a small key.

    def get(self, key):
        return self.dictionary[int(key[1:])]

class CachedMinifier(Minifier):
    def __init__(self, minifier):
        self.cache = {}
        self.minifier = minifier

    def get(self, key):
        if key not in self.cache:
            self.cache[key] = self.minifier.get(key)
        return self.cache[key]

def chunk(arr, chunk_len):
    num_full_chunks = len(arr) / chunk_len
    start_chunk = 0
    for i in range(num_full_chunks):
        end_chunk = start_chunk + chunk_len
        yield arr[start_chunk:end_chunk]
        start_chunk = end_chunk
    if start_chunk != len(arr):
        yield arr[start_chunk:]

def upload_aux(minifier, data):
    keys = []
    for page in chunk(data, PAGE_SIZE):
        page_key = minifier.put(page)
        assert len(page_key) == KEY_SIZE
        keys.append(page_key)
    if len(keys) == 1:
        return keys[0]
    else:
        return upload_aux(minifier, "".join(keys))


def upload(compressor, data):
    key = upload_aux(compressor, data)
    return compressor.put(json.dumps({
        "root": key,
        "len": len(data)
    }))

def download(minifier, key):
    meta = json.loads(minifier.get(key))
    len = meta["len"]
    root = meta["root"]
    cached_minifier = CachedMinifier(minifier)
    return download_aux(cached_minifier, root, len)

def extract_key(page, key_ord):
    return page[key_ord * KEY_SIZE:(key_ord + 1)*KEY_SIZE]

def get_path(minifier, key, path):
    page = minifier.get(key)
    if path:
        head, tail = path[0], path[1:]
        return get_path(minifier, extract_key(page, head), tail)
    else:
        return page

def build_path(page_id, len):
    if len <= PAGE_SIZE:
        return []
    else:
        return build_path(page_id / NUM_KEY_PER_PAGE, (len + NUM_KEY_PER_PAGE - 1) / NUM_KEY_PER_PAGE) + [page_id % NUM_KEY_PER_PAGE]

def download_aux(minifier, root, len):
    num_pages = (len + PAGE_SIZE - 1) / PAGE_SIZE
    pages = []
    for page_id in range(num_pages):
        path = build_path(page_id, len)
        pages.append(get_path(minifier, root, path))
    return "".join(pages)


if __name__ == "__main__":
    # a small test
    dummy = MockMinifier()
    msg = "arbitrary long message..." * 1000000
    key = upload(dummy, msg)
    assert download(dummy, key) == msg


{% endhighlight %}
