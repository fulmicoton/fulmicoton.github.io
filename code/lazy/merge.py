import random

import time



class LazyObject(object):
    
    __slots__ = [ "_recipe", "_result" ]

    def __init__(self, recipe):
        object.__setattr__(self, "_recipe", recipe)
        object.__setattr__(self, "_result", None)

    def _eval(self,):
        if self._result is None:
            object.__setattr__(self, "_result", self._recipe())
        return self._result

    def __getattr__(self, name, *args, **kargs):
        return getattr(self._eval(), name, *args, **kargs)
    
    def __setattr__(self, name, *args, **kargs):
        return setattr(self._eval(), name, *args, **kargs)
    
    def __getitem__(self, key, *args, **kargs):
        return self._eval().__getitem__(key, *args, **kargs)

    def __add__(self,*args,**kargs):
        return self._eval().__add__(*args,**kargs)
    
    # ... __mult__, __slice__ and so on ...


def lazy(f):
    def aux(*args, **kargs):
        def recipe():
            return f(*args,**kargs)
        return LazyObject(recipe)
    return aux

@lazy
def returns_two():
    print "evaluation for good"
    return 2

result = returns_two()
print "lazy evaluation"
print result + 1


def words():
    for l in open("/usr/share/dict/words", "r"):
        yield l.strip()

def sample(n):
    w = list(words())
    nwords = [ random.choice(w) for i in range(n) ]
    random.shuffle(nwords)
    return map(CompareCount, nwords)


class CompareCount(object):
    __slots__ = [ "s" ]
    c = 0
    def __init__(self,s):
        self.s = s
    def __cmp__(self, other):
        CompareCount.c +=1
        return cmp(self.s, other.s)
    def __repr__(self, ):
        return self.s



"""
def merge_sort(l):
    # Assuming l is a list, returns a
    # generator on a sorted version of
    # the list.
    L = len(l)
    if L <= 1:
        return l
    else:
        m = L/2
        left = merge_sort(l[0:m])
        right = merge_sort(l[m:])
        return zip_merge(left, right)

"""
import random
from heapq import merge as zip_merge

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
    CompareCount.c = 0
    l = range(N)
    random.shuffle(l)
    l = map(CompareCount, l)
    lazy_merge = merge_sort(l)
    res = []
    for i in range(100):
        lazy_merge.next()
        res.append(CompareCount.c)
    return res

print test(10000)

"""


print list(merge_sort([3,2,1,6]))





def test(n):
    CompareCount.c=0
    l = sample(n)
    start = time.time()
    sorted_l = merge_sort(l)
    for i in range(3):
        sorted_l.next()
    end = time.time()
    lazy_time = end-start
    start = time.time()
    c_lazy = CompareCount.c
    CompareCount.c = 0
    l = sorted(l)
    end = time.time()
    full_sort_time = end-start
    c_full = CompareCount.c
    print (lazy_time/float(full_sort_time)), c_full, c_lazy
    return (lazy_time/float(full_sort_time))

times = [test(i) for i in [10, 100, 1000, 10000, 100000, 1000000]]
print times

l = sample(1000)
m = merge_sort(l)

for i in range(10):
    print m.next()
"""