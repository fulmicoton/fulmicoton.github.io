---
layout: post
title:  Of peeping on the page cache
category: posts
---

# Memory my friend !

Nowadays RAM is so cheap, one is tempted to just rely on his database being
in RAM to get the wanted performance. Disk is just the persistence thingy.
Stackoverflow is full of questions on Solr, talking about the RAM directory, storing everything in tmpfs, and so on.

But isn't your OS supposed to make sure that the stuff your accessing is page cache? Let's sree how we can measure how much of your index is in page cache.


# What's page cache anyway?

It takes from 5 to 10ms to read something in a random part of your hard disk. Accessing data in RAM on the other, takes between 50 ns and 100 ns. It is only natural whenever possible to make sure that the same data is not loaded twice if we can afford caching it in RAM. That's precisely the role of the page cache. 

If you are on Linux or MacOS, here is a very simple experiment to see the page cache in action. Go find a fat and useless file sleeping on your hard disk. That DivX of `Beethoven 2` will do. Do not open it, just 
run the following command twice

	time cat ./free-willy-2.mpg > /dev/null


The second time, you should get a pretty nice performance improvement. And that's sequential access we're doing here?
You can actually warmup files by cat'ing them to your good old `/dev/null`.


# pmap to the rescue

Assuming your database is using MMAP, pmap will actually give a nice picture
of what's in your virtual memory. The default parameters however won't be helpful to know how much of your files are in RAM. To know that, you need to stick it the `-x` param.

	pmap -x <pid>


You should see something like this.

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

RSS is for resident memory. It's the part of your virtual memory
that is actually sitting on your memory rather than on your file in your 
filesystem (for mmapped files) or your swap for anonymous memory.

You see here that shared library are mapped in your process just like the file that have been mmaped. It's one simple way to check which libraries a program is using.




# Wait a minute... pmap showing its limits.

Ok, let's check whether this figure is working out as expected
by cat'ing `pkgcache.bin` and check with pmap that it is indeed in memory.

	cat /usr/lib/i386-linux-gnu/libsqlite3.so.0.8.6 > /dev/null
	pmap -x 10988 | grep libsqlite

gives me back. 

	ae251000     688     476       0 r-x--  libsqlite3.so.0.8.6
	ae2fd000       4       4       4 r----  libsqlite3.so.0.8.6
	ae2fe000       4       4       4 rw---  libsqlite3.so.0.8.6


This does not work as expected. Let's explain what happened.


# Minor and major page faults

MMap mapped part of the virtual memory of our program into its virtual memory. At this point nothing was read from disk or anything.

On the first attempt to access data from this virtual memory range, the OS will do whatever necessary to map the virtual memory page to a physical memory page that holds the same information as the disk. 

If at this moment, the file is actually in page cache, the OS just have to create the mapping between the virtual memory and the page cache (yes most of the time mmap are actually direcly mapped to the page cache!). This is usually called `minor page fault`.

If however the page is not in page cache, we need to wait for the system to read the info from the disk and put it in page cache. This is the dreaded `major page fault`.

In our case, even though ps doesn't show anything, cat'ing our file to ̀
/dev/null` can help transforming major page fault into minor page fault.

You can check for the number of page fault (minor and major) by using ps.
	ps -o min_flt,maj_flt <PID>




# What can we do? Mincore to the rescue.

What can we do then? A database may mmap and munmap files or you may restart your process, or a process may mmap a file that have been just created by another process. In that case, `pmap` figures are not exactly reliable.

I don't know any linux command that answer this question, but `[mincore](http://man7.org/linux/man-pages/man2/mincore.2.html)` is a system call that makes it possible to give and accurate map of the page of your virtual memory that are resident.

We can therefore, mmap a file, and ask mincore whether accessing each or each byte would trigger a major page fault or not.

I wrote a little utility doing that, and you can find it on [github](https://github.com/poulejapon/isresident).
Let's use to take a look at our `libsqlite3` file.

	$ ./isresident /usr/lib/i386-linux-gnu/libsqlite3.so.0.8.6
                   FILE    RSS    SIZE   PERCT	
	libsqlite3.so.0.8.6    696    696    100 %

Hurray !