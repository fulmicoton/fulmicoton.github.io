import random
from compare_count import CompareCount

def test(N):
    CompareCount.count = 0
    l = range(N)
    random.shuffle(l)
    l = map(CompareCount, l)
    nb_comparisons = []
    l.sort()
    print CompareCount.count

print test(100)
#print merge_sort([1,2,5,3,-4])[0]
