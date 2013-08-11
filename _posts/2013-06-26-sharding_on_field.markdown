---
layout: post
title: Of the risks of sharding on a field
category: posts
published: true
description: Is it ok to partition your data along a field that is not unique?
---



# What's sharding and what's my problem anyway?

You have a DB. It used to do very well when it was small and cute.
But it has gone fat. It doesn't wag its tail when you offer to take it for a walk anymore. When you throw it a query, it looks you with its big placid eye for seconds before bringing back any results.

Sharding consists of partition your database rows into as many smaller database. With S shards, a simple sharding strategy would be to assign to assign ``hash(primary_id) % S``.
Unless we are very unlucky, a good hash should balance these partition pretty well.

However, for certain type of queries (typically *join-like* queries)
you might want for optimization reason, to make sure that all documents with the same value for this certain field are on the same shard.

For instance, assuming our database contains people, and we want to have people living in the same city to sit in the same shard. Your simple formula is now ``hash(city) % S``.

Intuitively, we see that we may just have ruined the good repartition of our documents. In France, for instance 15% of people 
live in Paris. The shard containing Paris will probably be much bigger than the other. We also rapidly get the feeling that the bigger the number of shards, the unbalanced they will be. But let's get the math right, and find out a rule on whether we should avoid or not to shard along a field.

My real-life puzzle at work today was to find out whether it was reasonable to shard on one of our non-unique field.

When may we shard, when should we avoid to do it blindly ?

# Rule of thumb

You want to shard by a specific field. Let's define

- $\mu$ and $\sigma$ the average and the standard deviation of the number of documents associated to a given value of our sharding field,
- N being the overall number of documents,
- S being the number of shards.

You can reasonably shard on your field if you have :

    $$ { \sqrt{ S \left({ \mu  } + {\sigma^2 \over {N}} \right)  \over N } } < 5 \% $$ 

