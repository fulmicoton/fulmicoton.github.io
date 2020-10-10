---
layout: post
title:  Of Berlekamp factorization algorithm  
category: posts
description: Solving a math puzzle
published: false
---



# Puzzles, puzzles, puzzles

I am quite fond of puzzles / programming competition of all kinds.
Just this year I spent maybe

- 150 hours on Yandex's kaggle competition.
- 15 hours on Kaggle's criteo competition
- 30 hours on Google Hash code's problems
- and lately I spent around 8 hours to crack a cute little programming puzzle I could talk about on this blog.

This puzzle is sponsored by a major video game company, and they use to attract and select candidates.
I could not care less about this prize as I just got hired and will relocate back to Japan very soon.

I understand that people get very passionnate about the practise of using programming puzzles
to select candidates and I will gracefully accept any raging comment.

Such puzzles are just not likely to select candidates who is good for the job, nor are they likely to make you a better programmer. Yet, they are still fun! So just like I just acknowledged that this is blog post is just a very sophisticated kind of masturbation, I would dearly appreciate you to notice how a raging comment is just as funny as commenting about hygiene on a foot fetish porn site. :)

# The puzzle

**I had the chance to chat a little with the guys hosting the challenge. They were concerned that
spoiling out the answer was counterproductive for their customer (it is used for recruiting). I therefore offered to get rid of their name / reference in this blog post, in order to make this page stealthier to people googling for the solution.**

You need to decode message that have been encoded using the following program.
The website is giving you a few unit test to test your program.


{% highlight c++ %}

#include <iostream>

using namespace std;

int main()
{
  int size;
  cin >> size;

  // <- input
  unsigned int* a = new unsigned int[size / 16];
   // <- output
  unsigned int* b = new unsigned int[size / 16];

  // Read size / 16 integers to a
  for (int i = 0; i < size / 16; i++) {
    cin >> hex >> a[i];
  }

  // Write size / 16 zeros to b
  for (int i = 0; i < size / 16; i++) {
    b[i] = 0;
  }

  for (int i = 0; i < size; i++)
  for (int j = 0; j < size; j++) {
      b[(i+j)/32] ^= ( (a[i/32] >> (i%32)) &
                       (a[j/32 + size/32] >> (j%32)) & 1 ) << ((i+j)%32);
  }

  for(int i = 0; i < size / 16; i++)
    cout << hex << b[i] << " ";
  return 0;
}

{% endhighlight %}

Solving the puzzle required to actually understand what the code
was doing, and inverse the process.


# Steganography

You may have recognize in ``(x >> k) & 1`` a common idiom in C to return
the k-th bit in a 32-bit integer x. This code is definitely doing bit
manipulation, and the 8-bit a byte is just obfuscating what is really done.

If `msg` and `enc` are was a vector of `size*2` bits, what really is done here is.


{% highlight python %}
    for i in range(size)
        for j in range(size)
            enc[i + j] ^= msg[i] & msg[j + size]
{% endhighlight %}


We see here actually that the first half of the msg and the second part
are playing an independant role. If we call ``left`` and ``right`` respectively the first and the last size-bits of msg, we then have.


{% highlight python %}
    for i in range(size)
        for j in range(size)
            enc[i + j] ^= left[i] & right[j]
{% endhighlight %}

Do you recognize anything here? It mind makes you think of three different things, which are actually very similar: Convolution, integer multplication in which you forgot the carrying, and polynomial multiplication.

Let's just focus on the latter as it is the one that will lead us to the solution anyway.

So given two polynomials $U$ and $V$ encoded as the list of their coefficients, if you were to write a small function computing their product you would probably end up with something like this.

{% highlight python %}
  def polynomial_product(U, V):
    res = [0] * (len(U) + len(V)) - 1
    for i in range(size)
      for j in range(size)
        # multiplication of u_i X^i and v_j X^j
        res[i + j] += left[i] * right[j]
        # ... is (u_i * v_j ) X^(i + j)
    return res  
{% endhighlight %}

This does look very much like our encryption, doesn't it?


# Polynomials with coefficients in a finite field

The only single difference with our little encoding routine is that addition was a xor operation, and multiplication was and AND operation.

But what if the coefficient of our polynomials were actually bits? If you read a bit about how RSA works, you probably remember that if p is prime, the set of integer considered modulo p is a so called [finite field](http://en.wikipedia.org/wiki/Finite_field). That basically means that for any integer n there exists an inverse m such that $m n \equiv 1[p]$.

Well out of these fields, $\mathbb{Z}/2 \mathbb{Z}$ is the simplest. The field contains only 2 elements 0 and 1.
In this space, addition is actually equivalent `xor` `(1 + 1 = 2 = 0[2])`, and multiplication is your usual multiplication.

So the message encoding routine is all about :

* Cutting the message in half.
* Considering the two halves as two polynomials U and V with coefficients in $\mathbb{Z}/2 \mathbb{Z}$
* Multiplying them
* Outputting the coefficient of the product UV


# Polynomial factorization


The puzzle is really about factorization of a big polynomial (256 bits!).

Note that if the problem had been to factorize two 256 bits integers,
it would have been equivalent to asking you to crack a 256 bits RSA key.

Interestingly, polynomials with coefficients in $\mathbb{Z}/2 \mathbb{Z}$ share a lot of property with integers.
The complexity of factorization, on the other hand, is much simpler.

A bit of googling will convince you that the problem is well studied.

I settled up studying [Berlekamp's algorithm](http://en.wikipedia.org/wiki/Berlekamp's_algorithm).

# Outline of the algorithm

Ok assuming we want to factorize a polynomial P in $\mathbb{Z}/2 \mathbb{Z}$.
For the sake of simplicity we will assume that this polynomial has a prime decomposition for which all factors have a multiplicity of 1. (You can easily extract factors with a greater multiplicity by computing the $gcd(P, P')$.

The big idea, is to first find a polynomial $B$ for which we have :

<pre>
$$  B^2 - B \equiv 0[P]  $$
</pre>

By applying the chinese reminder theorem, we then know that for each prime factor $F_k$,
we have :


<pre>
$$ B^2 - B \equiv 0[F_k] $$
</pre>

That can be rewritten as

<pre>
$$ B(B - 1) \equiv 0[F_k] $$
</pre>

Since $F_k$ is prime we now know that $F_k$ divides either $B$ or $B - 1$.
The idea of the algorithm is that, once we found a polynomial B, we are certain to find at least one non trivial factor in `gcd(P, B)` or `gcd(P, B - 1)`.

# Finding a berlekamp polynomial

Now how do we find such a polynomial B? First you
need to notice that the squaring application $q$ for polynomials with binary coefficients is linear.

You can get convince about that easily by developing :

<pre>
$$ ({Q_1} + {Q_2})^2 \equiv {Q_1} ^ 2 + {Q_2} ^ 2 + 2{Q_1}{Q_2} [P] $$
</pre>


All the coefficient of $2{Q_1}{Q_2}$ are obviously even and therefore null in $\mathbb{Z} / 2\mathbb{Z}$.

Since this application is linear, we can compute its matrix representation $M$ in the canonical
basis. This is done by squaring the monomials, compute the rest modulo P, and shoving the result in a matrix. A Gauss-Jordan elimination can then find a basis of the kernel of $M - I$ and "voilà".


# Implementation

I actually had to implement twice : once in Python and once in `C++`. CodingGame
has a pretty hard timeout at around 5 seconds, and CPython took around 18s to solve
the 256bits unit test. Though Pypy was not an option, I noted it would have limboed its
ways below the limit at less than 2s.

I put here the python version of the algorithm, because it is more readable and because
having people copy paste the solution on CodingGame is not the point of this post.

Note that I assume that the multiplicity of the prime factor in decomposition of P is always 1, and that I extract factor one by one, and recursively factor, which is not required in the original algorithm.

{% highlight python %}

def bits_to_int(bits,):
  n = 0
  for b in bits[::-1]:
    n *= 2
    n += b
  return n


def zeros_matrix(N):
  return [[0] * N for i in range(N)]


def eye_matrix(N):
  res = zeros_matrix(N)
  for i in range(N):
    res[i][i] = 1
  return res


def format_hex(bits):
  return hex(bits_to_int(bits))[2:].replace("L", "").rjust(8, "0")


class Polynomial(object):

  def __init__(self, bits):
    bits = tuple(bits)
    max_weight = max([-1] + [bit_id
             for (bit_id, bit) in enumerate(bits) if bit == 1])
    self.bits = bits[:max_weight + 1]
    self.degree = len(self.bits) - 1

  def to_hexs(self, nb_ints):
    bits = self.bits + (0,) * (32 * nb_ints - len(self.bits))
    return " ".join(
      format_hex(bits[i * 32:(i + 1) * 32])
      for i in range(nb_ints)
    )

  @staticmethod
  def from_hexs(s):
    bits = []
    for number in s.split(" "):
      assert len(number) == 8
      n = int(number, 16)
      for i in range(32):
        bits.append(n & 1)
        n /= 2
    return Polynomial(bits)

  def __mul__(self, other):
    I = len(self.bits)
    J = len(other.bits)
    bits = [0] * (I + J)
    for i in range(I):
      for j in range(J):
        bits[i + j] ^= self.bits[i] & other.bits[j]
    return Polynomial(bits)

  def __eq__(self, other):
    return self.bits == other.bits

  def __add__(self, other):
    if self.degree < other.degree:
      return other + self
    other_bits = other.bits + (0,) * (self.degree - other.degree)
    return Polynomial(a ^ b for (a, b) in zip(self.bits, other_bits))

  def __mod__(self, q):
    qbits = q.bits
    Q = len(qbits)
    v = list(self.bits)
    while True:
      d = len(v)
      if d == 0:
        return ZERO
      if d < Q:
        return Polynomial(v)
      n = d - Q
      for i in range(Q):
        v[i + n] ^= qbits[i]
      for i in range(d - 1, -1, -1):
        if v[i]:
          break
        v.pop()
      assert len(v) < d

  def __div__(self, q):
    if q.degree > self.degree:
      return ZERO
    return X(self.degree - q.degree) +\
         (self + q * X(self.degree - q.degree)) / q

  def find_kernel_vec(self,):
    N = self.degree + 1
    M = zeros_matrix(N)
    for d in range(N):
      monome = X(d)
      square_monome = (monome * monome) % self
      image = square_monome.bits
      for i in range(len(image)):
        M[i][d - 1] = image[i]
      M[d - 1][d - 1] ^= 1
    # shadow matrix
    S = eye_matrix(N)
    frozen_cols = 0
    for row in range(N):
      pivot = 0
      for pivot in range(frozen_cols, N):
        if M[row][pivot]:
          break
      pivot_val = M[row][pivot]
      if pivot_val == 0:
        continue
      else:
        for i in range(N):
          (M[i][frozen_cols], M[i][pivot]) = (M[i][pivot], M[i][frozen_cols])
          (S[i][frozen_cols], S[i][pivot]) = (S[i][pivot], S[i][frozen_cols])
      for j in range(frozen_cols + 1, N):
        if M[row][j]:
          for i in range(N):
            M[i][j] = ((M[i][j]) ^ M[i][frozen_cols])
            S[i][j] = (S[i][j] ^ S[i][frozen_cols])
      frozen_cols += 1
    for j in range(N - 1, -1, -1):
      if sum(M[i][j] for i in range(N)) == 0:
        yield [S[i][j] for i in range(N)]
      else:
        break

  def factorize(self,):
    for v in self.find_kernel_vec():
      F = Polynomial(v)
      for C in [ZERO, ONE]:
        if F.degree >= 1:
          factor = gcd(Polynomial(v) + C, self)
          if not factor == ONE and factor.degree < self.degree:
            return factor.factorize() + (self / factor).factorize()
    return [self]


def X(k):
  return Polynomial((0,) * k + (1,))

ZERO = Polynomial(())
ONE = X(0)

def gcd(a, b):
  if a.degree < b.degree:
    return gcd(b, a)
  r = a % b
  if r == ZERO:
    return b
  else:
    return gcd(b, r)


def iter_splits(l):
  if not l:
    yield ONE, ONE
  else:
    head, tail = l[0], l[1:]
    for (left, right) in iter_splits(tail):
      yield left * head, right
      yield left, right * head


def iter_solutions(l, n_bits):
  for (left, right) in iter_splits(l):
    if left.degree < n_bits and right.degree < n_bits:
      yield " ".join([left.to_hexs(n_bits / 32), right.to_hexs(n_bits / 32)])


if __name__ == "__main__":
  n_bits = int(raw_input())
  P = Polynomial.from_hexs(raw_input())
  factors = list((P).factorize())
  for sol in sorted(set(iter_solutions(factors, n_bits))):
    print sol

main()

{% endhighlight %}
