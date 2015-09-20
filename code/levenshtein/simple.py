

# ------------------------------------
# Snippet 1

def levenshtein(s1, s2, D=2):
    """
    Returns True iff the edit distance between
    the two strings s1 and s2 is lesser or
    equal to D
    """
    if D == -1:
        return False
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1) <= D
    return (levenshtein(s1[1:], s2[1:], D-1)   # substitution\
        or levenshtein(s1, s2[1:], D-1)       # insertion\
        or levenshtein(s1[1:], s2, D-1)       # deletion\
        or (
            # character match
            (s1[0] == s2[0]) and \
            levenshtein(s1[1:], s2[1:], D)
        ))

assert levenshtein("abc", "a")


# ------------------------------------
# Snippet 2

def levenshtein(s1, s2, D=2):
    """
    Returns True iff the edit distance between
    the two strings s1 and s2 is lesser or
    equal to D
    """
    if len(s1) == 0:
        return len(s2) <= D
    if len(s2) == 0:
        return len(s1) <= D
    # assuming s1[0] is NOT used to build s2,
    if D > 0:
        if levenshtein(s1[1:], s2, D - 1):
            # deletion
            return True
        if levenshtein(s1[1:], s2[1:], D - 1):
            # substitution
            return True
    # assuming s1[0] is used to build s2
    for d in range(min(D, len(s2))):
        # d is the position where s1[0]
        # might be used.
        # it is also the number of character
        # that are required to be inserted before
        # using s1[d].
        if s1[0] == s2[d]:
            if levenshtein(s1[1:], s2[d+1:], D - d):
                return True
    return False


assert levenshtein("a", "abc")
assert not levenshtein("a", "abcd")
assert not levenshtein("abcd", "a")
assert levenshtein("abc", "a")

print "----"

# ------------------------------------
# Snippet 3

def levenshtein(s1, s2, D=2, i1=0, i2=0):
    """
    Returns True iff the edit distance between
    the two strings s1 and s2 is lesser or
    equal to D
    """
    def aux(i1, i2, D):
        if i1 == len(s1):
            return len(s2) - i2 <= D
        if D > 0:
            if aux(i1 + 1, i2, D - 1):
                # deletion
                return True
            if aux(i1 + 1, i2 + 1, D - 1):
                # substitution
                return True
        for d in range(min(D, len(s2) - i2)):
            if s1[i1] == s2[i2 + d]:
                # d insertion, followed
                # by a character match.
                if aux(i1 + 1, i2 + d + 1, D - d):
                    return True
        return False
    return aux(0, 0, D)

assert levenshtein("a", "abc")
assert not levenshtein("a", "abcd")
assert not levenshtein("abcd", "a")
assert levenshtein("abc", "a")

# --------

def levenshtein(s1, s2, D=2):
    """
    Returns True iff the edit distance between
    the two strings s1 and s2 is lesser or
    equal to D
    """
    def aux(c, i2, D):
        # i2 is the number of character
        # consumed in the string s2.
        # D is the number of error that we 
        # still alow.
        if D >= 1:
            # deletion
            yield i2, D - 1
            # substitution
            yield i2 + 1, D - 1
        for d in range(min(D, len(s2) - i2)):
            if c == s2[i2 + d]:
                # d insertions followed by a
                # character match
                yield d + 1, D - d

    current_args = {(0, D)}
    for c in s1:
        next_args = set()
        for (i2, d) in current_args:
            for next_arg in aux(c, i2, d):              
                next_args.add(next_arg)
        current_args = next_args
    
    for (i2, D) in current_args:
        if len(s2) - i2 <= D:
            return True
    return False

assert levenshtein("a", "abc")
assert not levenshtein("a", "abcd")
assert not levenshtein("abcd", "a")
assert levenshtein("abc", "a")


def levenshtein(query, n=2):
    """
    Returns a function that test
    if a string is at an edit distance 
    lesser or equal to n.
    """
    def transitions(c, state):
        (offset, n) = state
        yield (offset, n - 1)
        yield (offset + 1, n - 1)
        for d in range(min(n + 1, len(query) - offset)):
            if c == query[offset + d]:
                yield offset + d + 1, n - d

    def accept(state):
        (offset, n) = state
        return len(query) - offset <= n

    initial_state = {(0, n)}

    def close_to_query(s):
        states = initial_state
        for c in s:
            next_states = set()
            for state in states:
                for next_state in transitions(c, state):            
                    next_states.add(next_state)
            states = next_states
        for state in states:
            if accept(state):
                return True

    return close_to_query


def levenshtein(query, n=2):
    """
    Returns a function that test
    if a string is at an edit distance 
    lesser or equal to n.
    """
    def transitions(c, state):
        (offset, n) = state
        yield (offset, n - 1)
        yield (offset + 1, n - 1)
        for d in range(min(n + 1, len(query) - offset)):
            if c == query[offset + d]:
                yield offset + d + 1, n - d

    def accept(state):
        (offset, n) = state
        return len(query) - offset <= n

    initial_state = {(0, n)}

    def implies(state1, state2):
        """
        Returns true, if state1 implies state2
        """
        (offset, n) = state1
        (offset2, n2) = state2
        if n2 < 0:
            return True
        return n - n2 >= abs(offset2 - offset)

    def simplify(states):
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        return filter(is_useful, states)

    def close_to_query(s):
        states = initial_state
        for c in s:
            next_states = set()
            for state in states:
                next_states |= set(transitions(c, state))    
            states = simplify(next_states)
        for state in states:
            if accept(state):
                return True

    return close_to_query



def levenshtein(query, n=2):
    """
    Returns a function that test
    if a string is at an edit distance 
    lesser or equal to n.
    """
    def characteristic(c, offset):
        return [
            d
            for d in range(n + 1)
            if offset + d < len(query) and query[offset + d] == c
        ]

    def transitions(chi, state):
        (offset, n) = state
        yield (offset, n - 1)
        yield (offset + 1, n - 1)
        for d in chi:
            yield offset + d + 1, n - d

    def accept(state):
        (offset, n) = state
        return len(query) - offset <= n

    initial_state = {(0, n)}

    def implies(state1, state2):
        """
        Returns true, if state1 implies state2
        """
        (offset, n) = state1
        (offset2, n2) = state2
        if n2 < 0:
            return True
        return n - n2 >= abs(offset2 - offset)

    def simplify(states):
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        return filter(is_useful, states)

    def close_to_query(s):
        states = initial_state
        for c in s:
            next_states = set()
            for state in states:
                offset = state[0]
                chi = characteristic(c, offset) 
                next_states |= set(transitions(chi, state))    
            states = simplify(next_states)
        for state in states:
            if accept(state):
                return True

    return close_to_query

#---------------------

class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()

    def initial_states(self,):
        raise NotImplementedError()
        
    def eval(self, input_string):
        states = self.initial_states()
        for c in input_string:
            next_states = set()
            for state in states:
                next_states |= set(self.transitions(state, c))    
            states = next_states
        for state in states:
            if self.accept(state):
                return True

class LevenshteinAutomaton(NFA):

    def __init__(self, query, D=2):
        self.query = query
        self.max_D = D

    def transitions(self, state, c):
        (offset, D) = state
        if D > 0:
            yield (offset, D - 1)
            yield (offset + 1, D - 1)
        for d in range(min(D, len(self.query) - offset)):
            if c == self.query[offset + d]:
                yield offset + d + 1, D - d

    def accept(self, state):
        (offset, D) = state
        return len(self.query) - offset <= D

    def initial_states(self,):
        return {(0, self.max_D)}

def levenshtein(s1, s2, D=2):
    return LevenshteinAutomaton(s2, D).eval(s1)


assert levenshtein("a", "abc")
assert not levenshtein("a", "abcd")
assert not levenshtein("abcd", "a")
assert levenshtein("abc", "a")


# -----------------------------

class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()
    
    def initial_states(self,):
        raise NotImplementedError()
    
    def step(self, c, states):
        next_states = set()
        for state in states:
            next_states |= set(self.transitions(state, c))    
        states = self.simplify(next_states)
        return states

    def step_all(self, input_string):
        states = self.initial_states()
        for c in input_string:
            states = self.step(c, states)
        return states

    def eval(self, s):
        final_states = self.step_all(s)
        for state in final_states:
            if self.accept(state):
                return True
    
    def simplify(self, states):
        return states


class LevenshteinNFA(NFA):

    def __init__(self, query, D=2):
        self.query = query
        self.D = D

    def transitions(self, state, c):
        (offset, d) = state
        if d > 0:
            yield (offset, d - 1)
            yield (offset + 1, d - 1)
        for k in range(min(d, len(self.query) - offset)):
            if c == self.query[offset + k]:
                yield offset + k + 1, d - k

    def accept(self, state):
        (offset, d) = state
        return len(self.query) - offset <= d

    def initial_states(self,):
        return {(0, self.D)}

    def simplify(self, states):

        def implies(state1, state2):
            """
            Returns true, if state1 implies state2
            """
            (offset, d) = state1
            (offset2, d2) = state2
            if d2 < 0:
                return True
            return d - d2 >= abs(offset2 - offset)
        
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        
        return filter(is_useful, states)


def levenshtein(s1, s2, D=2):
    return LevenshteinAutomaton(s2, D).eval(s1)


assert levenshtein("a", "abc")
assert not levenshtein("a", "abcd")
assert not levenshtein("abcd", "a")
assert levenshtein("abc", "a")


#-------------------


class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()
        
    def eval(self, input_string):
        states = self.initial_states()
        for c in input_string:
            next_states = set()
            for state in states:
                next_states |= set(self.transitions(state, c))    
        for state in states:
            if self.accept(state):
                return True


class LevenshteinNFA(NFA):

    def __init__(self, query, n=2):
        self.query = query
        self.n = n

    def transitions(self, state, c):
        (offset, n) = state
        yield (offset, n - 1)
        yield (offset + 1, n - 1)
        for d in range(min(n, len(self.query) - offset)):
            if c == self.query[offset + d]:
                yield offset + d + 1, n - d

    def accept(self, state):
        (offset, n) = state
        return len(self.query) - offset <= n

    def initial_states(self,):
        return {(0, self.n)}



# -------------------

class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()
        
    def eval(self, input_string):
        states = self.initial_states()
        for c in input_string:
            next_states = set()
            for state in states:
                next_states |= set(self.transitions(state, c))    
            states = self.simplify(next_states)
        for state in states:
            if self.accept(state):
                return True

    def simplify(self, states):
        return states


class LevenshteinNFA(NFA):

    def __init__(self, query, n=2):
        self.query = query
        self.n = n

    def transitions(self, state, c):
        (offset, n) = state
        yield (offset, n - 1)
        yield (offset + 1, n - 1)
        for d in range(min(n, len(self.query) - offset)):
            if c == self.query[offset + d]:
                yield offset + d + 1, n - d

    def accept(self, state):
        (offset, n) = state
        return len(self.query) - offset <= n

    def initial_states(self,):
        return {(0, self.n)}

    def simplify(self, states):

        def implies(state1, state2):
            """
            Returns true, if state1 implies state2
            """
            (offset, n) = state1
            (offset2, n2) = state2
            if n2 < 0:
                return True
            return n - n2 >= abs(offset2 - offset)
        
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        
        return filter(is_useful, states)

# --------------------------------

class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()
    
    def step(self, c, states):
        next_states = set()
        for state in states:
            next_states |= set(self.transitions(state, c))    
        states = self.simplify(next_states)
        return states

    def step_all(self, s):
        states = self.initial_states()
        for c in s:
            states = self.step(c, states)
        return states

    def eval(self, s):
        final_states = self.step_all(s)
        for state in final_states:
            if self.accept(state):
                return True

    def simplify(self, states):
        return states


class LevenshteinNFA(NFA):

    def __init__(self, query_length, n=2):
        self.n = n

    def transitions(self, state, chi):
        (offset, n) = state
        yield (offset, n - 1)
        yield (offset + 1, n - 1)
        for (d, val) in enumerate(chi[offset:]):
            if val:
                yield offset + d + 1, n - d

    def accept(self, state):
        raise NotImplementedError()

    def initial_states(self,):
        return {(0, self.n)}

    def simplify(self, states):

        def implies(state1, state2):
            """
            Returns true, if state1 implies state2
            """
            (offset, n) = state1
            (offset2, n2) = state2
            if n2 < 0:
                return True
            return n - n2 >= abs(offset2 - offset)
        
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        
        return filter(is_useful, states)


def levenshtein(query, n=2):

    nfa = LevenshteinNFA(n)

    def characteristic(c):
        return tuple(
            v == c
            for (offset, v) in enumerate(query)
        )

    def eval(s):
        states = nfa.initial_states()
        for c in s:
            chi = characteristic(c)
            states = list(nfa.step(chi, states))
        for (offset, c) in states:
            if len(query) - offset <= n:
                return True
        return False

    return eval

# ---------------
levenshtein("abc", 2)("abd")
# --------------


class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()
    
    def step(self, c, states):
        next_states = set()
        for state in states:
            next_states |= set(self.transitions(state, c))    
        states = self.simplify(next_states)
        return states

    def step_all(self, s):
        states = self.initial_states()
        for c in s:
            states = self.step(c, states)
        return states

    def eval(self, s):
        final_states = self.step_all(s)
        for state in final_states:
            if self.accept(state):
                return True

    def simplify(self, states):
        return states


class LevenshteinNFA(NFA):

    def __init__(self, query_length, n=2):
        self.n = n

    def transitions(self, state, chi):
        (offset, n) = state
        yield (offset, n - 1)
        yield (offset + 1, n - 1)
        for (d, val) in enumerate(chi[offset:]):
            if val:
                yield offset + d + 1, n - d

    def accept(self, state):
        raise NotImplementedError()

    def initial_states(self,):
        return {(0, self.n)}

    def simplify(self, states):

        def implies(state1, state2):
            """
            Returns true, if state1 implies state2
            """
            (offset, n) = state1
            (offset2, n2) = state2
            if n2 < 0:
                return True
            return n - n2 >= abs(offset2 - offset)
        
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        
        return filter(is_useful, states)


def levenshtein(query, n=2):

    nfa = LevenshteinNFA(n)

    def normalize(states):
        min_offset = min(offset for (offset, _)  in states)
        return (min_offset, [(offset - min_offset, d) for (offset, d) in states])

    def characteristic(c, offset):
        return tuple(
            query[offset + d] == c if offset + d < len(query) else False
            for d in range(3 * n + 1)
        )

    def eval(s):
        global_offset = 0
        norm_states = nfa.initial_states()
        for c in s:
            chi = characteristic(c, global_offset)
            new_states = nfa.step(chi, norm_states)
            (min_offset, norm_states) = normalize(new_states)
            global_offset += min_offset
            print norm_states
        for (offset, c) in norm_states:
            if len(query) - offset - global_offset <= n:
                return True
        return False

    return eval

# ---------------------------------------------

class NFA(object):

    def transitions(self, state, c):
        raise NotImplementedError()

    def accept(self, state):
        raise NotImplementedError()
    
    def step(self, c, states):
        next_states = set()
        for state in states:
            next_states |= set(self.transitions(state, c))    
        states = self.simplify(next_states)
        return states

    def step_all(self, s):
        states = self.initial_states()
        for c in s:
            states = self.step(c, states)
        return states

    def eval(self, s):
        final_states = self.step_all(s)
        for state in final_states:
            if self.accept(state):
                return True

    def simplify(self, states):
        return states


class LevenshteinNFA(NFA):

    def __init__(self, query_length, n=2):
        self.n = n

    def transitions(self, state, chi):
        (offset, n) = state
        yield (offset, n - 1)
        yield (offset + 1, n - 1)
        for (d, val) in enumerate(chi[offset:]):
            if val:
                yield offset + d + 1, n - d

    def accept(self, state):
        raise NotImplementedError()

    def initial_states(self,):
        return {(0, self.n)}

    def simplify(self, states):

        def implies(state1, state2):
            """
            Returns true, if state1 implies state2
            """
            (offset, n) = state1
            (offset2, n2) = state2
            if n2 < 0:
                return True
            return n - n2 >= abs(offset2 - offset)
        
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        
        return filter(is_useful, states)

# ------------------------------


class Index:
    """ Just a helper class that 
    helps associated object to an ID.
    """
    def __init__(self,):
        self.idx = {}
        self.objs = []

    def from_idx(self, idx):
        return self.objs[idx]

    def allocate_idx(self, obj):
        new_id = len(self.idx)
        self.objs.append(obj)
        self.idx[obj] = new_id

    def get(self, obj):
        return self.idx.get(obj)

    def __contains__(self, obj):
        return obj in self.idx


class LevenshteinParametricDFA(object):

    def __init__(self, n=1):
        self.n = n
        self.idx = Index()

        def transitions(state, chi):
            (offset, n) = state
            yield (offset, n - 1)
            yield (offset + 1, n - 1)
            for (d, val) in enumerate(chi[offset:]):
                if val:
                    yield offset + d + 1, n - d

        def simplify(states):

            def implies(state1, state2):
                """
                Returns true, if state1 implies state2
                """
                (offset, n) = state1
                (offset2, n2) = state2
                if n2 < 0:
                    return True
                return n - n2 >= abs(offset2 - offset)
            
            def is_useful(s):
                for s2 in states:
                    if s != s2 and implies(s2, s):
                        return False
                return True
            
            return filter(is_useful, states)

        def step(c, states):
            next_states = set()
            for state in states:
                next_states |= set(transitions(state, c))    
            return simplify(next_states)
        
        def initial_states():
            return {(0, self.n)}

        def normalize(states):
            if not states:
                return (0, ())
            min_offset = min(offset for (offset, _)  in states)
            shifted_states = tuple(
                sorted([(offset - min_offset, d)
                         for (offset, d) in states]))
            return (min_offset, shifted_states)

        def enumerate_chi_values(n):
            if n == 0:
                yield()
            else:
                for chi_value in enumerate_chi_values(n-1):
                    yield (False,) + chi_value
                    yield (True,) + chi_value

        chi_values = list(enumerate_chi_values(3*n + 1))
        (global_offset, norm_states) = normalize(initial_states())
        self.idx.allocate_idx(norm_states)
        yet_to_visit = [norm_states]

        dfa = {}
        while yet_to_visit:
            current_state = yet_to_visit.pop()
            state_transitions = {}
            for chi in chi_values:
                new_states = step(chi, current_state)
                (min_offset, norm_states) = normalize(new_states)
                if norm_states not in self.idx:
                    dfa[norm_states] = {}
                    self.idx.allocate_idx(norm_states)
                    yet_to_visit.append(norm_states) 
                next_state_id = self.idx.get(norm_states)
                state_transitions[chi] = (min_offset, next_state_id)
            dfa[self.idx.get(current_state)] = state_transitions
        self.dfa = dfa

    def characteristic(self, query, c, offset):
        return tuple(
            query[offset + d] == c if offset + d < len(query) else False
            for d in range(3 * self.n + 1)
        )

    def step_all(self, query, s):
        (global_offset, state) = (0, 0)
        for c in s:
            chi = self.characteristic(query, c, global_offset)
            (shift_offset, state) = self.dfa[state][chi]
            global_offset += shift_offset
        final_state = self.idx.from_idx(state)
        return (global_offset, final_state)

    def eval(self, query, s):
        (global_offset, final_state) = self.step_all(query, s)
        for (local_offset, d) in final_state:
            offset = local_offset + global_offset
            if len(query) - offset <= self.n:
                return True
        return False

levenshtein_parametric = LevenshteinParametricDFA()
print levenshtein_parametric.eval("flees", "flyes")
print levenshtein_parametric.eval("fleys", "flyes")




class LevenshteinNFA(NFA):

    def __init__(self, query_length, D=2):
        self.D = D

    def transitions(self, state, chi):
        (offset, D) = state
        if D > 0:
            yield (offset, D - 1)
            yield (offset + 1, D - 1)
        for (d, val) in enumerate(chi[offset:]):
            if val:
                yield offset + d + 1, D - d

    def accept(self, state):
        raise NotImplementedError()

    def initial_states(self,):
        return {(0, self.D)}

    def simplify(self, states):

        def implies(state1, state2):
            """
            Returns true, if state1 implies state2
            """
            (offset, D) = state1
            (offset2, D2) = state2
            if D2 < 0:
                return True
            return D - D2 >= abs(offset2 - offset)
        
        def is_useful(s):
            for s2 in states:
                if s != s2 and implies(s2, s):
                    return False
            return True
        
        return filter(is_useful, states)


def levenshtein(query, input_string, D=2):
    nfa = LevenshteinNFA(D)

    def characteristic(c):
        return tuple(
            v == c
            for (offset, v) in enumerate(query)
        )

    states = nfa.initial_states()
    for c in input_string:
        chi = characteristic(c)
        states = list(nfa.step(chi, states))
    for (offset, c) in states:
        if len(query) - offset <= D:
            return True
    return False


assert levenshtein("a", "abc")
assert not levenshtein("a", "abcd")
assert not levenshtein("abcd", "a")
assert levenshtein("abc", "a")

# ------------

class LevenshteinParametricDFA(object):

    def __init__(self, D=2):
        self.max_D = D

        def transitions(state, chi):
            (offset, D) = state
            yield (offset, D - 1)
            yield (offset + 1, D - 1)
            for (d, val) in enumerate(chi[offset:]):
                if val:
                    yield offset + d + 1, D - d

        def simplify(states):

            def implies(state1, state2):
                """
                Returns true, if state1 implies state2
                """
                (offset, D) = state1
                (offset2, D2) = state2
                if D2 < 0:
                    return True
                return D - D2 >= abs(offset2 - offset)
            
            def is_useful(s):
                for s2 in states:
                    if s != s2 and implies(s2, s):
                        return False
                return True
            
            return filter(is_useful, states)

        def step(c, states):
            next_states = set()
            for state in states:
                next_states |= set(transitions(state, c))    
            return simplify(next_states)
        
    
        def enumerate_chi_values(width):
            if width == 0:
                yield()
            else:
                for chi_value in enumerate_chi_values(width-1):
                    yield (False,) + chi_value
                    yield (True,) + chi_value

        width = 3 * self.max_D + 1
        chi_values = list(enumerate_chi_values(width))
        (global_offset, norm_states) = self.normalize(self.initial_states())
        dfa = {norm_states: {}}
        yet_to_visit = [norm_states]
        
        while yet_to_visit:
            current_state = yet_to_visit.pop()
            state_transitions = {}
            for chi in chi_values:
                new_states = step(chi, current_state)
                (min_offset, norm_states) = self.normalize(new_states)
                if norm_states not in dfa:
                    dfa[norm_states] = {}
                    yet_to_visit.append(norm_states)
                state_transitions[chi] = (min_offset, norm_states)
            dfa[norm_states] = state_transitions
        self.dfa = dfa

    def initial_states(self,):
        return {(0, self.max_D)}

    def normalize(self, states):
        if not states:
            return (0, ())
        min_offset = min(offset for (offset, _)  in states)
        shifted_states = tuple(
            sorted([(offset - min_offset, D)
                     for (offset, D) in states]))
        return (min_offset, shifted_states)

    def characteristic(self, query, c, offset):
        return tuple(
            query[offset + d] == c if offset + d < len(query) else False
            for d in range(3 * self.max_D + 1)
        )

    def step_all(self, query, s):
        (global_offset, norm_states) = self.normalize(self.initial_states())
        for c in s:
            chi = self.characteristic(query, c, global_offset)
            (shift_offset, norm_states) = self.dfa[norm_states][chi]
            global_offset += shift_offset
        return (global_offset, norm_states)

    def eval(self, query, input_string):
        (global_offset, final_state) = self.step_all(query, input_string)
        for (local_offset, d) in final_state:
            offset = local_offset + global_offset
            if len(query) - offset <= self.max_D:
                return True
        return False


param_dfa = LevenshteinParametricDFA(D=2)

def levenshtein(query, input_string):
    return param_dfa.eval(query, input_string)

assert levenshtein("a", "abc")
assert not levenshtein("a", "abcd")
assert not levenshtein("abcd", "a")
assert levenshtein("abc", "a")

# assert levenshtein("c")("abc")
#assert levenshtein("flier")("flyer")
#assert LevenshteinNFA("flier", 2).eval("flyer")
# assert levenshtein("happiness", "tastiness") == 1
# assert levenshtein("abcd", "adcd") == 1
# assert levenshtein("abcd", "abcd") == 0
# # assert levenshtein("acbd", "abcd") == 2
# # assert levenshtein("ffff", "acbd") == 3
# assert levenshtein("ab", "abcd") == 2