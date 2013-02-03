import random

from compare_count import CompareCount
#from heapq import merge as zip_merge

def zip_merge(g1,g2):
    el1 = g1.next()
    el2 = g2.next()
    while True:
        if el1 <= el2:
            yield el1
            try:
                el1 = g1.next()
            except:
                yield el2
                for el2 in g2:
                    yield el2
                break
        else:
            yield el2
            try:
                el2= g2.next()
            except:
                yield el1
                for el1 in g1:
                    yield el1
                break


def merge_sort(l):
    # Assuming l is a list, returns an
    # iterator on a sorted version of
    # the list.
    L = len(l)
    if L <= 1:
        return iter(l)
    else:
        m = L/2
        left = merge_sort(l[0:m])
        right = merge_sort(l[m:])
        return zip_merge(left, right)


def test(N):
    CompareCount.count = 0
    l = range(N)
    random.shuffle(l)
    l = map(CompareCount, l)
    lazy_merge = merge_sort(l)
    res = []
    for i in range(N):
        lazy_merge.next()
        print CompareCount.count
    return res

print test(100)


"""#
l1 = (CompareCount(i) for i in [1,2,3] )
l2 = (CompareCount(i) for i in [1,4] )
CompareCount.count = 0
for i in zip_merge(iter(l1), iter(l2)):
    print i
"""
#print CompareCount.count



