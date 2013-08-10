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


For instance if you take a look at Chromium, you should see something like this.

	Address   Kbytes     RSS   Dirty Mode   Mapping
	ae125000     328     156       0 r-x--  libGL.so.1.2.0
	ae177000       8       8       8 r----  libGL.so.1.2.0
	ae179000      16      16       8 rwx--  libGL.so.1.2.0
	ae17d000       4       4       4 rwx--    [ anon ]
	ae17e000     392     324       0 r-x--  libnssckbi.so
	ae1e0000      44      44      44 r----  libnssckbi.so
	ae1eb000      24      24      24 rw---  libnssckbi.so
	ae1f1000     360      88       0 r-x--  libfreebl3.so
	ae24b000       4       4       4 r----  libfreebl3.so
	ae24c000       4       4       4 rw---  libfreebl3.so
	ae24d000      16       8       8 rw---    [ anon ]
	ae251000     688     476       0 r-x--  libsqlite3.so.0.8.6
	ae2fd000       4       4       4 r----  libsqlite3.so.0.8.6
	...

RSS stands for for resident memory. It's the part of your virtual memory that is actually sitting on your memory rather than on your file in your filesystem (for mmapped files) or your swap for anonymous memory.

You see here that shared library are mapped in your process just like the file that have been mmaped. It's one simple way to check which libraries a program is using.



# Wait a minute... pmap showing its limits.

Ok, let's check whether this figure is working out as expected.
If we cat `libsqlite3.so` to `/dev/null` we saw that it was loaded into RAM. Right now only 476 / 688 KBytes are in RAM, we should observe this figure to go 100%.

	cat /usr/lib/i386-linux-gnu/libsqlite3.so.0.8.6 > /dev/null
	pmap -x 10988 | grep libsqlite

gives me back :

	ae251000     688     476       0 r-x--  libsqlite3.so.0.8.6
	ae2fd000       4       4       4 r----  libsqlite3.so.0.8.6
	ae2fe000       4       4       4 rw---  libsqlite3.so.0.8.6


This does not work as expected. Why the hell did this happen?


# Minor and major page faults

MMap mapped a segment of the virtual memory of our program to a segment of the disk. All this operation is lazy and at this point nothing was read from disk or anything.

On the first attempt to access data from this virtual memory range, the OS will do whatever necessary to map the virtual memory page to a physical memory page that holds the same information as the disk. 

If at this moment, the file is actually in page cache, the OS just have to create the mapping between the virtual memory and the page cache (yes most of the time mmap are actually direcly mapped to the page cache!). This is usually called `minor page fault`.

If however the page is not in page cache, we need to wait for the system to read the info from the disk and put it in page cache. This is the dreaded `major page fault`.

If our process tried to access a segment not marked as in resident in libsqlite3 right now, this would result in a minor page fault.
The OS would just have to map the virtual memory to the already filled page cache.

You can check for the number of page fault (minor and major) by using ps.
	ps -o min_flt,maj_flt <PID>




# What can we do? mincore to the rescue.

A database may mmap and munmap files or you may restart your process, or a process may mmap a file that have been just created by another process. Since what we really want to avoid is major page fault, `pmap`'s figures are not exactly reliable. 

I don't know any linux command that answer this question directly, but `[mincore](http://man7.org/linux/man-pages/man2/mincore.2.html)` is a system call that makes it possible to know whether accessing a page virtual memory page will require an IO or not.

We can therefore mmap a file, and ask mincore whether accessing each or each byte would trigger a major page fault or not.

I wrote a little utility doing that, and you can find it on [github](https://github.com/poulejapon/isresident).
Let's use it to take a look at our `libsqlite3` file again.

	$ ./isresident /usr/lib/i386-linux-gnu/libsqlite3.so.0.8.6
                   FILE    RSS    SIZE   PERCT	
	libsqlite3.so.0.8.6    696    696    100 %

Hurray ! We indeed observe that the file is indeed completely in RAM.

You can run it use wildcard to use it on a directory as well.

	$ ./isresident /usr/lib/*	
