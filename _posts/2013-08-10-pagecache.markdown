---
layout: post
title:  Of how much of a file is in RAM
category: posts
description: We discuss about minor/major page fault, mmap, and how to measure how much of a file is in page cache.
---

# Memory my friend !

Nowadays RAM is so cheap, you might be tempted to just rely on his database being in RAM to get the wanted performance. Disk is just there for persistence.

Many people talk on the web about their production setup bein in TmpFs, or using the RAMDirectory.

But isn't your OS supposed to make sure that the stuff your accessing is page cache? Let's see how we can measure how much of your db/index/data is in page cache.


# What's page cache anyway?

It takes from 5 to 10ms to read something from a random part of your hard disk. Accessing data in RAM on the other hand, takes between 50 ns and 100 ns. It is only natural for the OS to make sure that the same data is not loaded twice if we can afford caching it in RAM. That's precisely the role of the page cache. 

If you are on Linux or MacOS, here is a very simple experiment to see the page cache in action. Go find a fat and useless file sleeping on your hard disk. That DivX of `Beethoven 2` will do. Do not open it, just run the following command twice

	time cat ./free-willy-2.mpg > /dev/null


The command reads your whole file and print out the duratio of the operation. The second time, you should get a pretty nice performance improvement. By reading the file the first time, we made sure that the file was sitting in RAM for the second turn. 

This trick is actually pretty legit. You can actually warmup files by cat'ing them to your good old `/dev/null`.

# pmap to the rescue

Assuming your database is using memory mapping (mmap), pmap will actually give a nice picture of what's in your virtual memory and help you a bit about how much of your database file are in RAM.

The default parameters however won't be helpful to know how much of your files are in RAM. To know that, you need to stick it the `-x` param.

	pmap -x <pid>

You can find the pid of your process by running

	ps -aux

Let's take a look at a very cold Solr in which I just pushed 1M+ documents.

	Address           Kbytes     RSS   Dirty Mode   Mapping
	0000000000400000       4       4       0 r-x--  java
	0000000000600000       4       4       4 rw---  java
	000000000234e000     132      12      12 rw---    [ anon ]
	00000006fae00000   56704   27564   27564 rw---    [ anon ]
	00000006fe560000    4800       0       0 -----    [ anon ]
	00000006fea10000   22464       0       0 rw---    [ anon ]
	0000000700000000  146304  144384  144384 rw---    [ anon ]
	0000000708ee0000   23744       0       0 -----    [ anon ]
	000000070a610000 2626176       0       0 rw---    [ anon ]
	00000007aaab0000 1398080 1387668 1387668 rw---    [ anon ]
	00007f6c071fe000     280       4       0 r--s-  _1.fdx
	00007f6c07244000   64492       4       0 r--s-  _1.fdt
	00007f6c0b13f000      36       4       0 r--s-  _1_nrm.cfs
	00007f6c0b148000    1460     540       0 r--s-  _1_Lucene40_0.tim
	00007f6c0b2b5000    3472       4       0 r--s-  _1_Lucene40_0.prx
	00007f6c0b619000    4732     184       0 r--s-  _1_Lucene40_0.frq
	00007f6c0bab8000     284       4       0 r--s-  _2.fdx
	00007f6c0baff000   66200       4       0 r--s-  _2.fdt
	00007f6c0fba5000      36       4       0 r--s-  _2_nrm.cfs
	00007f6c0fbae000    1392     488       0 r--s-  _2_Lucene40_0.tim
	00007f6c0fd0a000    3532       4       0 r--s-  _2_Lucene40_0.prx
	00007f6c1007d000    4892     164       0 r--s-  _2_Lucene40_0.frq
	00007f6c3f21f000     284       4       0 r--s-  _d.fdx
	00007f6c3f266000   69544       4       0 r--s-  _d.fdt
	00007f6c43650000   69224       4       0 r--s-  _e.fdt
	00007f6c479ea000     280       4       0 r--s-  _f.fdx
	00007f6c47a30000   68916       4       0 r--s-  _f.fdt
	00007f6c4bd7d000   68552       4       0 r--s-  _g.fdt
	00007f6c54f25000  705388       4       0 r--s-  _i.fdt
	00007f6c80000000     132       8       8 rw---    [ anon ]
	00007f6c80021000   65404       0       0 -----    [ anon ]
	00007f6d9789d000    1016     120     120 rw---    [ anon ]
	00007f6d9799b000      32      28       0 r-x--  libmanagement.so
	00007f6d979a3000    2044       0       0 -----  libmanagement.so
	00007f6d9c296000    1016      92      92 rw---    [ anon ]
	00007f6d9c394000      12      12       0 r--s-  lucene-highlighter-4.0.0.jar


Anonymous is all the stuff that is not associated with a file, in this case
your Java heap. You should see shared native libraries and jar. They indeed are mapped in your process virtual memory. At this point you need to locate which files are the actual data of your database. They may not appear here if you are using a database working mainly in anonymous space, or if your database does not rely on mmap to access the data. 

In my case, we see that the file of our index are mapped into memory. The so-called [posting lists](http://lucene.apache.org/core/4_0_0/core/org/apache/lucene/codecs/lucene40/Lucene40PostingsFormat.html#Termindex) are the file matching the _*_Lucene.(frq|tim|prx|tip).

Let's check how much of these are in RAM.

RSS stands for resident memory. It's the part of your virtual memory that is actually sitting on your actual physical memory rather than on your file in your filesystem (for mmapped files) or your swap for anonymous memory.


# Wait a minute... pmap showing its limits.

Ok, let's check whether the RSS column is working out as expected.

If we cat `_2_Lucene40_0.prx` to `/dev/null` we saw that it was loaded into RAM. Right now only 476 / 688 KBytes are in RAM, we should observe this figure to go 100%.

	cat _2_Lucene40_0.prx > /dev/null
	pmap -x 10988 | grep _2_Lucene40_0.prx

gives me back :

	00007f6c0fd0a000    3532       4       0 r--s-  _2_Lucene40_0.prx

This does not work as expected. Why the hell did this happen?


# Minor and major page faults

MMap mapped a segment of the virtual memory of our program to a segment of the disk. All this operation is lazy and at this point nothing was read from disk or anything.

On the first attempt to access data from this virtual memory range, the OS will do whatever necessary to map the virtual memory page to a physical memory page that holds the same information as the disk. 

If at this moment, the file is actually in page cache, the OS just have to create the mapping between the virtual memory and the page cache (yes most of the time mmap are actually direcly mapped to the page cache!). This is usually called `minor page fault`.

If however the page is not in page cache, we need to wait for the system to read the info from the disk and put it in page cache. This is the dreaded `major page fault`.

If our process tried to access a segment not marked as in resident in our Lucene file right now, this would result in a minor page fault... but not a major page fault. The OS would just have to map the virtual memory to the already filled page cache.

You can check for the number of page fault (minor and major) by using ps.
	ps -o min_flt,maj_flt <PID>




# What can we do? mincore to the rescue.

A database may mmap and munmap files or you may restart your process, or a process may mmap a file that have been just created by another process. Since what we really want to avoid is major page fault, `pmap`'s figures are not exactly reliable. 

I don't know any linux command that answer this question directly, but `[mincore](http://man7.org/linux/man-pages/man2/mincore.2.html)` is a system call that makes it possible to know whether accessing a page virtual memory page will require an IO or not.

We can therefore mmap a file, and ask mincore whether accessing each or each byte would trigger a major page fault or not.

I wrote a little utility doing that, and you can find it on [github](https://github.com/poulejapon/isresident).
Let's use it to take a look at our `_2_Lucene40_0.prx` file again.

	$ isresident _2_Lucene40_0.prx

             FILE    RSS    SIZE    PERCT
_2_Lucene40_0.prx    3530   3530    100 %

Hurray ! We indeed observe that the file is indeed completely in RAM.

You can run it use wildcard to use it on a directory as well.

	$ ./isresident /usr/lib/*	
