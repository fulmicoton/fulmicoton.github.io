from itertools import izip_longest


class Node:
    
    def __init__(self,next=None):
        self.next = next

    def __iter__(self,):
        cur = self
        while cur is not None:
            yield cur
            cur = cur.next

    def __repr__(self,):
        return "-".join(hex(id(x))[-4:] for x in self)

def make_chain(k, next=None):
    if k==0:
        return Node(next)
    else:
        return Node(next=make_chain(k-1, next))


def find_intersection_simple(left,right):
    visited = set(left)
    for cur_right in right:
        if cur_right in visited:
            return cur_right
    return None

def find_intersection_left_and_right(left,right):
    visited = set()
    for (cur_left, cur_right) in izip_longest(left, right):
        if cur_left == cur_right:
            return cur_left
        if cur_left in visited:
            return cur_left
        if cur_right in visited:
            return cur_right
        if cur_left is not None:
            visited.add(cur_left)
        if cur_right is not None:
            visited.add(cur_right)
    return None

def test(find_intersection_impl, n, l, r):
    main = make_chain(n)
    left = make_chain(l, next=main)
    right = make_chain(r, next=main)
    assert find_intersection_impl(left,right) == main


def tests(find_intersection_impl):
    for n in range(1, 10):
        for l in range(0, 10):
            for r in range(0, 10):
                test(find_intersection_impl, n,l,r)



if __name__ == "__main__":
    tests(find_intersection_simple)
    tests(find_intersection_left_and_right)