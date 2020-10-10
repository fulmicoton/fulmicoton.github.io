from heapq import heappush,  heappop
import random

from compare_count import CompareCount

def heapsort(l):
        heap = []
        for x in l[:]:
            heappush(heap, x)
        while heap:
            yield heappop(heap)

def test(N):
    CompareCount.count = 0
    l = map(CompareCount, range(N))
    random.shuffle(l)
    sortl = heapsort(l)
    for i in range(N):
        sortl.next()
        print CompareCount.count


from heapq import nlargest

def test2(N):
    l = map(CompareCount, range(N))
    random.shuffle(l)
    for k in range(1,N+1):
        CompareCount.count = 0
        list(nlargest(k, l))
        print CompareCount.count


print test2(100)


