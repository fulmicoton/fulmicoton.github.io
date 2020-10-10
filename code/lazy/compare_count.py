class CompareCount(object):
    __slots__ = [ "val" ]
    count = 0
    def __init__(self,val):
        self.val = val
    def __cmp__(self, other):
        CompareCount.count +=1
        return cmp(self.val, other.val)
    def __repr__(self, ):
        return repr(self.val)

