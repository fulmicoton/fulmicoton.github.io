---
layout: post
title:  Of the implementations of Fibonacci 
category: posts
---



Fibonacci's sequence 
---------------------------------------

*My first post generated more interest than expected, but even
more rewarding, some people pointed out some of my mistakes, 
corrected me, and actually taught me a couple of things. I'll try to keep up the rythm and publish at least once a week.*

I've been asked once in an interview about efficient ways to compute Fibonacci. Below is what I tried to explain during the interview, but probably sounded like some kind of incoherent babbling about matrix to my interviewer.

I was talking about a little trick my computer science teacher taught my class, and which does not seem too famous.

If you feel like you already know everything about the Fibonacci sequence's implementations, jump to the [last implementation](#smarter). If you don't feel confortable with ``fibonacci``, tag along as we will make our way through different implementations of ``fibonacci``. 


What's Fibonacci anyway?
------------------------------------------

So Fibonacci sequence F<sub>n</sub> is defined as follows :

<img src="http://latex.codecogs.com/gif.latex?F_n = \begin{cases} 0 & \text{if } n = 0 \\ 1 & \text{if } n = 1 \\ F_{n-1} + F_{n-2} & elsewhere \end{cases}" title="Fibonacci sequence definition."/>

If you're not familiar with such notation, it basically says 
that it starts ```0, 1``` and the next value is defined as the sum of the two precedent numbers.

The first numbers are therefore :

```0, 1, 1, 2, 3, 5, 8, 13, ...``` 



Recursive Implementation
---------------------------------------

The simplest way to implement fibonacci's sequence is to 
just write its definition. 

{% highlight python %}

def fibo(n):
    if n==0:
        return 0
    elif n==1:
        return 1
    else:
        return fibo(n-1) + fibo(n-2)

{% endhighlight %}

Plain and simple right? Yes, as often with recursive 
algorithm the complexity of this algorithm is huge.
Fun fact, the number of calls C<sub>n</sub> required
to compute ``fibo(n)`` actually behaves like the fibonacci
sequence itself. It is very easy to show that 

<img src="http://latex.codecogs.com/gif.latex? F_{n+1} - 1 \leq C_n \leq F_{n+2} -  1" title="Recursive Fibonacci complexity."/>

Bad news, as we will see in [analytical formula](#analytical), F<sub>n</sub> is exponential. We will see an exact analytical formula for the n-th term of the fibonacci sequence in "Analytical formula". At the moment, we can convince ourselves that Fibonacci is exponential by noticing that

<img src="http://latex.codecogs.com/gif.latex?\forall n\geq 2,~F_{n+1} \geq 2 F_{n-1}" title="F_{n+1} \geq 2 F_{n}" />

Hence, 

<img src="http://latex.codecogs.com/gif.latex?\forall p\geq 0, ~ F_{2p+1} \geq 2^p" title="F_{2p} \geq 2^p" />

Let's see how we work out a better algorithm.


Memoization
---------------------------------------

Most of the time, the no-brainer in optimization is to cache results.
Fibonacci is an obvious candidate for memoization. mentally visualize the recursive calls of Fibonacci, and you'll notice that the function is called many times with the same arguments. If you find recursivity confusing, just notice that computing ``fibo(n)`` requires an exponential number of calls with arguments that takes values in ``[0, n]``. There must be some calls with the same arguments right?

Memoization is a technique which consists on keeping the results of your results in a cache. Next calls will return the cached result.
In python, as long as arguments are [good candidates to be used as the keys of a hash, we can do that transparently with a decorator.

{% highlight python %}


def memoize(f):
  cache = {}
  def aux(*args, **kargs):
    # dictionaries are not hashable,
    # we transform kargs in a tuple
    # of (k,v) items.
    k = (args, tuple(kargs.items()) )
    if k not in cache:
      cache[k] = f(*args, **kargs)
    return cache[k]
  return aux

@memoize
def fibo(n):
    if n==0:
        return 0
    elif n==1:
        return 1
    else:
        return fibo(n-1) + fibo(n-2)

{% endhighlight %}

Computing ``fibo(n)`` now requires only n calls to fibo. We achieved 
linear complexity here.




<a id="dynamic"></a>Dynamic Programming
---------------------------------------

What is nice with memoization is that results are cached on-the-fly, without requiring to make any change to the function. What is not so nice however is that the memory required. In order to compute ``fibo(n)``, we have been storing (n+1) (key,value)-pairs.

What we are doing naturally when trying to compute the first numbers of the sequence by hand is actually much more efficient. You just iteratively look at the two precedent numbers, sum them up, and write the new number. To compute the next number, you only had to look at the two precedent numbers. 

{% highlight python %}

def fibo_dynamic(n):
  cur = 0   # F_i
  next = 1  # F_i+1
  for i in xrange(n):
    (cur, next) = (next, cur+next)
  return cur

{% endhighlight %}

We now have a solution which is linear in computational time and constant in memory.


<a id="analytical"></a>Analytical Formula and the gold number
--------------------------------------------------------------------

Let's now try to find a closed-form expression of fibonacci.
To do so, we'll recycle an idea from [``fibo_dynamic``](#dynamic). Let's introduce X<sub>n</sub>, a sequence of vector that contains the two consecutives Fibonacci number F<sub>n</sub>, F<sub>n+1</sub>.

<img src="http://latex.codecogs.com/gif.latex?\forall n \geq 1, X_n = \begin{bmatrix} F_n \\ F_{n+1} \end{bmatrix}" title="\forall n \geq 1, X_n = \begin{bmatrix} F_n \\ F_{n+1} \end{bmatrix}" />

Now, we can reexpress python's line

    (cur, next) = (next, cur+next)

as a simple matrix multiplication :

<img src="http://latex.codecogs.com/gif.latex?X_{n+1} = \begin{pmatrix} 0 & 1\\ 1 & 1 \end{pmatrix} X_{n}" title="" />


Multiplying by the matrix 
  <img src="http://latex.codecogs.com/gif.latex?M = \begin{pmatrix} 0 & 1\\ 1 & 1 \end{pmatrix}" title="" />

therefore makes us advance one step ahead. That's one iteration of our loop in ``fibo_dynamic``. Going n step ahead from the initial values X<sub>0</sub> = [ 0, 1 ]<sup>t</sub>, is therefore equivalent to multiplying X<sub>0</sub> by M n-times. That's matrix exponentiation.

<a href="http://www.codecogs.com/eqnedit.php?latex=X_n=M^nX_0" target="_blank"><img src="http://latex.codecogs.com/gif.latex?X_n=M^nX_0" title="X_n=M^nX_0" /></a>

If you are allergic to such computations, skip to the [next section](#smarter).

One way to obtain the analytical formula of the fibonacci sequence is to diagonalize the matrix.

[Wolfram Alpha gives us S and J diagonal such that](http://www.wolframalpha.com/input/?i=diagonalize+%7B%7B0%2C1%7D%2C%7B1%2C1%7D%7D)

<img src="http://latex.codecogs.com/gif.latex?M=SJS^{-1}" title="M=SJS^{-1}" />

We can then use this diagonalized form to compute M<sup>n</sup>

<img src="http://latex.codecogs.com/gif.latex?\begin{align*} M^n&= SJ (S^{-1}S) J (S^{-1}S )J S^{-1}...JS^{-1} \\ &= SJ J J ...JS^{-1}\\ &= SJ^nS^{-1} \end{align*}" title="\begin{align*} M^n&= SJ (S^{-1}S) J (S^{-1}S )J S^{-1}...JS^{-1} \\ &= SJ J J ...JS^{-1}\\ &= SJ^nS^{-1} \end{align*}" />

Now, the exponentiation of the diagonal matrix ``J`` is simple as it consists only on the exponentiation of its diagonal terms (called eigen-values).

Eventually, you'll come up with the following formula, where φ is also called the gold number :

<img src="http://latex.codecogs.com/gif.latex?\begin{align*} &F_n = { \phi^n - \bar{\phi}^n\over{\sqrt{5}}}, \\ & where~~\phi = {1+\sqrt{5} \over 2}~and~\bar{\phi} = {1-\sqrt{5} \over 2} \end{align*}" title="\begin{align*} &F_n = \phi^n + \bar{\phi}^n, \\ & where~~\phi = {1+\sqrt{5} \over 2}~and~\bar{\phi} = {1-\sqrt{5} \over 2} \end{align*}" />

Now what is the complexity of computing this formula? 
Computing the power is typically done doing so-called fast exponentiation.

The idea is to use the fact that, x<sup>2p</sup> = ( x<sup>p</sup> )<sup>2</sup>. In python, the algorithm goes as follows

{% highlight python %}
def power(x,n):
  if n == 0:
    return 1
  if n%2 == 1:
    return x * power(x,n-1)
  else:
      root = power(x,n/2)
      return root*root
{% endhighlight %}

and requires log<sub>2</sub>(n) floating point multiplications.



<a id="smarter"></a>Smarter, better, stronger
-----------------------------------------------------------------

We found a solution with a logarithmic complexity, but it is based on floating point multiplication. Our algorithm will give us back 
floating point results that we will want to round or truncate.
Floating point have limitations, both in precision and they have
an upper bound as well.

Also, I didn't enjoy at all going through the diagonalization of the matrix. If I were to write an algorithm to compute the n-th term of such a sequence, I don't want to go through the trouble of 
writing an algorithm to diagonalize the matrix.

Finally, this is a bit crazy, why do I have to use float, where everything in my problem is screaming integer.

Let's get back at the matrix exponentiation :

<a href="http://www.codecogs.com/eqnedit.php?latex=X_n=M^nX_0" target="_blank"><img src="http://latex.codecogs.com/gif.latex?X_n=M^nX_0" title="X_n=M^nX_0" /></a>

The trick here is to apply the fast exponentiation algorithm directly on the matrix, without diagonalizing it. To do so, we need
to define matrix, and matrix multiplication, but this is way less cumbersome than doing what we did before, isn't it?

Here is now the fibonacci implementation based on 
integer matrix fast exponentiation.

{% highlight python %}

def matmult(A,B):
  # multiplies 2x2 matrix
  def val(i,j):
    return A[i][0]*B[0][j] + A[i][1]*B[1][j]
  return (
    (val(0,0), val(0,1)),
    (val(1,0), val(1,1)),
  )

def matrix_power(A,n):
  if n == 0:
    return ( (1, 0), (0,1) )
  if n%2 == 1:
    return matmult(A, matrix_power(A,n-1))
  else:
      root = matrix_power(A,n/2)
      return matmult(root,root)

def fibo_matrix(n):
  M = ( (0, 1), (1,1) )
  return matrix_power(M,n)[0][1]

{% endhighlight %}

We are doing 8 times more multiplications in this version, but that's
integer multiplications.

Moreover, python is handling big integers like a champ.
You will be able to compute fibonacci(100000) efficiently now.


Where I lied
---------------------------

Actually everything here is a lie. The truth is that [big integer multiplication](http://en.wikipedia.org/wiki/Multiplication_algorithm) shouldn't be considered constant time, so that all the complexity described here does not relate to actual computational time.


------------------------------------------------------------------------

*Thanks to Tordek to point out an error on reddit.*
*Thanks to Frank and Hameer for telling me about the error in the closed formula of Fibonacci.*
