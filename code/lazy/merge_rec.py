import random
from compare_count import CompareCount
from lazy import lazy

@lazy
def zip_merge(left,right):
    if left == ():
        return right # right is never empty.
    else:
        (left_head, left_tail) = left
        (right_head, right_tail) = right
        if left_head <= right_head:
            return (left_head, zip_merge(left_tail, right))
        else:
            return (right_head, zip_merge(right_tail,left))

def merge_sort(l):
    # Assuming l is a list, returns a sorted
    # version of l in the format (t,q)
    L = len(l)
    if L==0:
        return ()
    elif len(l)==1:
        return (l[0], ())
    else:
        m = L/2
        left = merge_sort(l[0:m])
        right = merge_sort(l[m:])
        return zip_merge(left, right)

l = range(100)
random.shuffle(l)
print merge_sort([2,1])


def test(N):
    CompareCount.count = 0
    l = range(N)
    random.shuffle(l)
    l = map(CompareCount, l)
    nb_comparisons = []
    (t,q) = merge_sort(l)
    for i in range(100):
        print CompareCount.count
        (t,q) = q
    return nb_comparisons

print test(100)
#print merge_sort([1,2,5,3,-4])[0]



