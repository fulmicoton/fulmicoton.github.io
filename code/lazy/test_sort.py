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
    #for i in range(999):
    #    print CompareCount.count
    #return nb_comparisons

print test(1000)
#print merge_sort([1,2,5,3,-4])[0]
