---
layout: post
title:  Of a neat little programming/math puzzle  
category: posts
description: Solving the nintendo/codingames puzzle.
published: false
---



# Puzzles

I am quite fond of puzzles / programming competition of all kinds.
Just this year I spent more than 100+ hours on Yandex's kaggle competition. Spent quite somewhere like 20 hours on Kaggle's criteo competition. Around 30 hours on Google Hash code's
problems, and lately I spent between 7 hours and 10 hours to crack a cute little programming puzzle on codingames I could talk about on this blog.

**Disclaimer** I will gracefully accept any raging comment about such problems to be
stupid and irrelevant. This is true. Such puzzles are totally only recreational and are not likely to make you a better programmer in any way. Yet, some people actually like those. So just like I just acknowledged that this is a very sophisticated kind of masturbation, I would appreciate you to notice how your comment is just as dumb as commenting about hygiene on a foot fetish porn site. I do not support the use of such puzzles in a recruiting process.


# The nintendo puzzle

Ok so the puzzle I am about to tell you about is available on [codingames](http://www.codingame.com/ide/4523915178f42d7a43e66eeb76473edf66859a). Big shoutout to them for the terrific job they are doing on this website ; and sorry in advance for spoiling the puzzle.


Let aside the weird little story involving aliens coding in C.
You need to decode message that have been encoded using the following program.
The website gives you a few unit test to test your program.

    READ size
    READ size / 16 integers in array a
    WRITE size / 16 zeros in array b

    For i from 0 to size - 1:
        For j from 0 to size - 1:h
             b[(i+j)/32] ^= ((a[i/32] >> (i%32)) & (a[j/32 + size/32] >> (j%32)) & 1) << ((i+j)%32)

    PRINT b

or if you prefer it in C++:


    #include <iostream>

    using namespace std;

    int main()
    {
      int size;
      cin >> size;
     
      unsigned int* a = new unsigned int[size / 16]; // <- input tab to encrypt
      unsigned int* b = new unsigned int[size / 16]; // <- output tab
     
      for (int i = 0; i < size / 16; i++) {   // Read size / 16 integers to a
        cin >> hex >> a[i];
      }

      for (int i = 0; i < size / 16; i++) {   // Write size / 16 zeros to b
        b[i] = 0;
      } 
     
      for (int i = 0; i < size; i++)
        for (int j = 0; j < size; j++)
          b[(i + j) /32] ^= ( (a[i / 32] >> (i % 32)) &
                   (a[j / 32 + size / 32] >> (j % 32)) & 1 ) << ((i + j) % 32);
      for(int i = 0; i < size / 16; i++)
        cout << hex << b[i] << " ";       // print result
      return 0;
    }

Solving the puzzle required to actually understand what the code
was doing, and inverse the process.

# Steganography

You may have recognize in ``(x >> k) & 1`` a common idiom in C to return the k-th bit in x.
This code is definitely doing bit manipulation, and the 8 bit a byte is just obfuscating what is really done.

If `msg` and `enc` are was a vector of size*2 bits, what really is done here is.
    
    for i in range(size)
        for j in range(size)
            enc[i + j] ^= msg[i] & msg[j + size]

We see here actually that the first half of the msg and the second part 
are playing an independant role. If we call ``left`` and ``right`` respectively the first and the last size-bits of msg, we then have.

    for i in range(size)
        for j in range(size)
            enc[i + j] ^= left[i] & right[j] 

Do you recognize anything here? It mind makes you think of three different things, which are actually very similar : Convolution, forgetting integer multplication, and polynomial multiplication.

Let's just focus on the latter as it is the one that will lead us to the solution anyway.
So given two polynomials U and V encoded as the list of their coefficients, if you were to write a small function computing their product you would probably end up with something like this.

    def polynomial_product(U, V):
        res = [0] * (len(U) + len(V)) - 1
        for i in range(size)
            for j in range(size)
                res[i + j] += left[i] * right[j] 
        return res  

The only single difference with our little encoding routine is that addition was a xor operation, and multiplication was and AND operation.

That is actually totally cool, because if you consider the set  (`{0, 1}̀ , ^, *) and the operation xor and *, it is exactly the same as considering, integers modulo 2, with the addition and the multiplication, also called `Z/2Z`. It is the simplest famous finite field.

So the message encoding routine is all about :

* Cutting the message in half.
* Considering the two halves as two polynomials U and V with coefficients in Z/2Z
* Multiplying them
* Outputting the coefficient of the product U*V



# A bit of algebra

The puzzle is really about factorization of a big polynomial. 
Polynomials in Galois fields have a lot in common with integers. Just like with integers you can define 
polynomial division, decomposition in prime polynomials, the chinese reminder theorem and what not. 

Actually another 

