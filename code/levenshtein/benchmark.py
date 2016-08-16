class Index(object):
    def __init__(self,):
        self.idx_to_val = []
        self.val_to_idx = {}

    def get_id(self, val):
        return self.val_to_idx[val]

    def get_val(self, idx):
        return self.idx_to_val[idx]

    def __contains__(self, val):
        return val in self.val_to_idx

    def allocate_id(self, val):
        assert val not in self.val_to_idx
        new_idx = len(self.idx_to_val)
        self.idx_to_val.append(val)
        self.val_to_idx[val] = new_idx

class LevenshteinParametricDFA(object):

    def __init__(self, D=2):
        self.max_D = D

        index = Index()
        self.index = index

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

        self.characteristic_map = {
            chi_value: i
            for (i, chi_value) in enumerate(enumerate_chi_values(width))
        }

        chi_values = list(enumerate_chi_values(width))
        (global_offset, norm_states) = self.normalize(self.initial_states())
        dfa = []
        self.index.val_to_idx[()] = -1
        self.index.allocate_id(norm_states)
        yet_to_visit = [norm_states]
        self.accept_values = []

        def add_accept(norm_state):
            state_accept = [-1] * (2 * self.max_D + 1)
            for (local_offset, d) in norm_state:
                for i in range(2 * self.max_D + 1):
                    new_d = d - abs(i-local_offset)
                    state_accept[i] = max(state_accept[i], new_d)
            self.accept_values.append(state_accept)
        
        add_accept(norm_states)

        while yet_to_visit:
            current_state = yet_to_visit.pop(0)
            state_transitions = []
            for chi in chi_values:
                new_states = step(chi, current_state)
                (min_offset, norm_states) = self.normalize(new_states)
                if norm_states not in index:
                    index.allocate_id(norm_states)
                    add_accept(norm_states)
                    yet_to_visit.append(norm_states)
                state_transitions.append((min_offset, index.get_id(norm_states)))
            dfa.append(state_transitions)
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
        chi = tuple(
            query[offset + d] == c if offset + d < len(query) else False
            for d in range(3 * self.max_D + 1)
        )
        return self.characteristic_map[chi]

    def step_all(self, query, s):
        (global_offset, norm_states) = (0, 0)
        for c in s:
            chi = self.characteristic(query, c, global_offset)
            (shift_offset, norm_states) = self.dfa[norm_states][chi]
            global_offset += shift_offset
        return (global_offset, norm_states)

    def eval(self, query, input_string):
        (global_offset, final_state_idx) = self.step_all(query, input_string)
        remaining_offset = len(query) - global_offset
        if remaining_offset < 2 * self.max_D + 1:
            return self.accept_values[final_state_idx][remaining_offset] >= 0
        else:
            return False


MAXIMUM_DISTANCE = 4
PARAM_DFA = []


class Automaton:

    def initial_state(self,):
        """ returns the initial state.
        can be any kind of object."""
        raise NotImplementedError()

    def accept(self, state):
        """ returns True iff the state
        is accepted."""
        raise NotImplementedError()

    def step(self, state, c):
        """ Given a state and a character,
        returns the new state."""
        raise NotImplementedError()

    def can_match(self, state):
        """ Returns False iff whatever
        the next characters are, there is
        not chance that we can match
        again. """
        raise NotImplementedError()

MAX_LENGTH_QUERY = 30
ALPHABET = [0] * 30 * 256

class ParametricAutomaton(Automaton):
    # Not really a DFA as it is not technically
    # finite.
    def __init__(self, query, D=2):
        assert D <= MAXIMUM_DISTANCE
        self.max_D = D
        self.w = 2 * D + 1
        self.len_query = len(query)
        param_dfa = PARAM_DFA[D]
        self.dfa = param_dfa.dfa
        self.accept_values = param_dfa.accept_values
        query_letters = set(query)
        self.alphabet = []
        for offset in range(len(query) + 1):
            self.alphabet.append({
                c: param_dfa.characteristic(query, c, offset)
                for c in query_letters
            })

    def can_match(self, (offset, norm_state)):
        return norm_state >= 0

    def initial_state(self,):
        return (0, 0)

    def step(self, state, c):
        (global_offset, norm_state) = state
        letter = self.alphabet[global_offset].get(c, 0)
        (shift_offset, norm_state) = self.dfa[norm_state][letter]
        return (global_offset + shift_offset, norm_state)

    def accept(self, (global_offset, final_state_idx)):
        remaining_offset = self.len_query - global_offset
        return (remaining_offset < self.w) and\
            self.accept_values[final_state_idx][remaining_offset] >= 0

# -----------------------------------------

class SparseLevenshteinAutomaton(Automaton):
    def __init__(self, string, D=2):
        self.string = string
        self.max_edits = D

    def initial_state(self):
        return (range(self.max_edits+1), range(self.max_edits+1))

    def step(self, (indices, values), c):
        if indices and indices[0] == 0 and values[0] < self.max_edits:
            new_indices = [0]
            new_values = [values[0] + 1]
        else:
            new_indices = []
            new_values = []

        for j,i in enumerate(indices):
            if i == len(self.string): break
            cost = 0 if self.string[i] == c else 1
            val = values[j] + cost
            if new_indices and new_indices[-1] == i:
                val = min(val, new_values[-1] + 1)
            if j+1 < len(indices) and indices[j+1] == i+1:
                val = min(val, values[j+1] + 1)
            if val <= self.max_edits:
                new_indices.append(i+1)
                new_values.append(val)
        return (new_indices, new_values)

    def accept(self, (indices, values)):
        return bool(indices) and indices[-1] == len(self.string)

    def can_match(self, (indices, values)):
        return bool(indices)

    def transitions(self, (indices, values)):
        return set(self.string[i] for i in indices if i < len(self.string))


def levenshtein(query, input_string, D=2):
    automaton = ParametricAutomaton(query, D=D)
    state = automaton.initial_state()
    for c in input_string:
        state = automaton.step(state, c)
    return automaton.accept(state)

# -------------------------------------

from collections import defaultdict

class Trie:

    def __init__(self,):
        self.children = defaultdict(Trie)
        self.term_id = -1

    def append(self, s, term_id):
        if len(s) == 0:
            self.term_id = term_id
        else:
            (h, t) = s[0], s[1:]
            self.children[h].append(t, term_id)

class MutableCounter:

    def __init__(self,):
        self.val = 0

    def inc(self,):
        self.val += 1

def intersect(trie, automaton, counter):
    def aux(trie, automaton, state):
        if trie.term_id >= 0 and automaton.accept(state):
            yield trie.term_id
        for (letter, child) in trie.children.items():
            counter.inc()
            new_state = automaton.step(state, letter)
            if automaton.can_match(new_state):
                for v in aux(child, automaton, new_state):
                    yield v
    return aux(trie, automaton, automaton.initial_state())

# -------------------------------------

FILEPATH = "/usr/share/dict/words"

def load(limit=100):
    num_read = 0
    for line in open(FILEPATH, 'r'):
        num_read += 1
        yield line.strip().lower()
        if num_read >= limit:
            break

import time

def benchmark(trie, tests, D):
    print "\n\n--------------"
    print "D=", D
    for Impl in [ParametricAutomaton, SparseLevenshteinAutomaton]:
        num_calls = MutableCounter()
        start = time.time()
        total_count = 0
        total_calls = 0
        for test in tests:
            automaton = Impl(test, D=D)
            total_count += sum(1 for w in intersect(trie, automaton, num_calls))
            total_calls += num_calls.val
        print total_count, total_calls
        stop = time.time()
        print Impl.__name__, (stop - start) / len(tests),  (stop - start) * 1000000 / (total_calls)

import random

lines = list(load(limit=100000))
trie = Trie()
for (line_id, line) in enumerate(lines):
    trie.append(line, line_id)
tests = random.sample(lines, 200)

for D in range(10):
    PARAM_DFA.append(LevenshteinParametricDFA(D=D))
    for i in range(2):
        benchmark(trie, tests, D=D)
    # benchmark(trie, tests, D=D)

# for word in test:
#     for dfa in [ParametricAutomaton(word, D=2), SparseLevenshteinAutomaton(word, D=2)]:
#         print "-----"
#         print word
#         for w in intersect(trie, dfa):
#             print w


# assert levenshtein("a", "abc") == 2
# assert levenshtein("a", "abcd") == 3
# assert levenshtein("abcd", "a") == 3
# assert levenshtein("abc", "a") == 2
# assert levenshtein("abcd", "ad") == 2
# assert levenshtein("abcd", "ade") == 3
# assert levenshtein("bcd", "cd", D=1) == 1
# assert levenshtein("bcd", "cd", D=2) == 1

#assert levenshtein("abcd", "acd") == 1
#assert levenshtein("accd", "acd") == 1