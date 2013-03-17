---
layout: post
title:  Of Bayesian average and star ratings
category: posts
---


E-Commerce (sometimes) doing it wrong
--------------------------------------------

Most e-commerce websites are offering you to sort your search results by customer ratings... and quite a lot are doing it wrong. Let's assume here I'm looking for a book about CSS. I want to get the best book money can buy, so I will definitely hit the sort by rating button. The website is offering two options

- book A : 1 rating of 5. Average rating of 5.
- book B : 50 ratings. Average rating of 4.5

Think about it, would you rather have *book A* come first of *book B*
come first. Probably *book B* right? That means we need some thing
smarter than just sorting by average rating.

A first simple answer, which would definitely be an improvement compared to sorting by average rating might be to put product with less than k ratings at the bottom. But then, how to choose k? What if we are looking for a niche and all products have less than k ratings except one, which has a k+1 awful ratings. Should it go on top ?

A second answer you might come up to would be to choose an empirical scoring formula that seems to match our constraints.

Most of the formulas out there rely on Bayesian estimation. Generally speaking, Bayesian estimation really shines on this kind of situation : you want to measure something, but you know you won't have enough data to reach a perfect estimation.

If m is the mean of the ratings and n is the number of the ratings, we might consider something like :
    
    $$ rating(m, n) = {mn \over {n+K}} $$

This will probably work just fine. **Probably**... Still you have to choose the right K without knowing to what physical values it relates. More importantly you will have to convince your coworker that this is the nice solution that will covers the edge cases perfectly.



Bayesian estimation crash course
------------------------------------------

The big idea is, rather than trying to directly compute our estimate, first we compute a probability distribution describing "what we know" of the value we want to estimate, and then (and only then) we can extract an estimate of this value that fits our purpose.

The separation of concern in that last bit is actually quite important. Depending on your point of view you may consider very different value as estimates of a physical value. 

For instance, if I need to estimate the number of serums that a government needs to buy in order to cope with an epidemic, I will want to deliver a figure for which I can say : I am sure at 90% that this will be sufficient. That figure can sometimes [be very far away from the expectation](http://www.infowars.com/french-government-plans-mass-swine-flu-vaccination-program/). If I am actually working as in accounting in the company selling those serums, and I want to get an idea of a lower bound for my income for next month, I will probably take a totally different [quantile](http://en.wikipedia.org/wiki/Quantile).



A simple example
------------------------------------

Let's assume you just discovered a parasite called toxoplasmosis and you want to estimate the ratio $X$ of the people infected by a parasite called [toxoplasmosis](http://en.wikipedia.org/wiki/Toxoplasmosis).

Human patients infected by the parasite does not show any symptoms at all, so you pretty as far as you know it could be anything. We might describe your vision on the probability distribution of this value to be a uniform distribution. .

Talking about probability here might feel a little bit weird. 
First of all is it legitimate to talk about probability when we are estimating something a very tangible, non-random value? In term of Bayesian probability, a variable is random if you don't know its value exactly. It is a piece of information that sums up our knowledge about something.

But let's get back to our problem. As you test people for toxoplasmosis, you will make **observations**.Each person will have a probability ``X`` to have toxoplasmosis, and you want to estimate this very X. Let's assume that after seing $n$ persons, you detected k people with toxoplasmosis.

You started with a uniform prior probability, and each observation will bend your vision on X, making it more and more accurate.
This updated vision of X is called its **posterior distribution**.
We call ``O`` (as in observation) the sequence of results of our N tests.

Bayes delivers a little formula to compute it 

    $$ P(X | O) = { P( O | X) P(X) \over { P(O)} }$$

$P(O)$ is the probability of observing what we observed. It is constant with X, and therefore of little interest. Likewise we chose our prior probability $P(X)$ to be uniform and it therefore does not vary with X. We are only interested into the proportionality relation : 

    $$ P(X | O) \propto P( O | X) $$

$$P( O | X)$$ is called the likelihood. It is given X (the value we are looking for) the probability of observing what we observed. That's usually something rather straightforward to compute.

In our case, the probability of observing the sequence of independent observations

    $$ O = ({o_1}, ..., {o_N}) $$

is given by multiplying the probability of each observation :
    
    $$ P(O | X) = P({o_1}| X) \times ... \times P({o_N} | X) $$

For one single observation, the probability to observe o<sub>i</sub> positive (respectively negative) is by definition X (respectively 1-X). In the end, if we observe K positive, and N-K negative the posterior probability is 

    $$ P(X | O) \propto X^{K}(1-X)^{N-K} $$

This distribution is also called [binomial distribution](http://en.wikipedia.org/wiki/Binomial_distribution).

It's interesting to see how the posterior probability evolves with the number of observations. The graph below shows how the posterior gets more and more refined with the number of observations we get.

![Posterior probabilities](https://docs.google.com/spreadsheet/oimg?key=0As3ux_ykgGX1dEk3LV9WQ1E0SE03RTMzbmlIbUFzbmc&oid=1&zx=2u5tfzvqm8zf)

Now that we have the exact probability, we might consider computing any kind of estimates from this distribution. Arguably the most common output would be to compute a confidence interval : an interval [a,b] for which we can claim with a confidence of 90% our value lies somewhere between a and b.

Nowadays everybody has a computer and probably the simplest way to produce such a confidence interval is probably to compute the cumulative distribution function of this distribution. 

A lot of statisticians also worked on finding very accurate confidence intervals for binomial distributions when the normal approximation does not hold. You might want to check for [this wikipedia page](http://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval) if you want to use one of this formulas.




Back to the stars
------------------------

Let's go back to star ratings! In this section, for simplification we will consider a range of 1, 2, or 3 stars. We will try to estimate, given people's answer, the posterior distribution of the proportion of people who would give it respectively 1,2, or 3 stars , if we had the chance to ask an infinite number of people.

The random variable we observe follows a so-called categorical distribution. That's basically a variable that takes its values within ``{1,2,3}`` with a some probabilities p<sub>1</sub>, p<sub>2</sub>, p<sub>3</sub> with 

$$ {p_1} + {p_2} + {p_3} = 1 $$

What makes it harder is that we are not looking at the distribution of a scalar value, but the joint distribution of three scalar values (or rather two considering the linear constraint).

Still, we can apply the same reasoning as we did with the estimation of a single probability :

    $$ P({p_1}, {p_2}, {p_3} | O) \propto P( O | {p_1}, {p_2}, {p_3}) P({p_1}, {p_2}, {p_3}) $$

This time we will however include a prior. In order to simplify computations, it is always a good idea to choose a prior that has the same shape as the likelihood. Let's first compute the likelihood.

Just like in our previous example parameter estimation, we can use the independance of our observation.

    $$ P(O |  {p_1}, {p_2}, {p_3}) = P({o_1}|  {p_1}, {p_2}, {p_3}) \times \cdots \times P({o_N} |  {p_1}, {p_2}, {p_3}) $$

And the likelihood of each individual observation is given by the associated probability 

    $$\forall j \in \{1,2,3\}, ~~ \forall 1\leq i \leq N, ~~P( {o_i = j} | {p_1}, {p_2}, {p_3})  = {p_j} $$

Therefore if within the N reviews we received there was respectively K<sub>1</sub>, K<sub>2</sub>, K<sub>3</sub> reviews with respectively 1,2 and 3 stars, we have a likelihood of 


    $$
        P(O | {p_1}, {p_2}, {p_3}) = {p_1}^{K_1} {p_2}^{K_2} {p_3}^{K_3} 
    $$

Which is called a [Dirichlet distribution](http://en.wikipedia.org/wiki/Dirichlet_distribution) with parameter 

    $$
    \alpha = \left( 
    \begin{array}{c}
        {K_1} + 1 \\
        {K_2} + 1 \\
        {K_3} + 1
    \end{array}
    \right)
    $$
.

In order to make the math much simpler, let's consider a prior with the very same shape, and parameter alpha<sup>0</sup>.

The posterior, is proportional to

    $$ P({p_1}, {p_2}, {p_3} | O) \propto  { {p_1}^{K_1} } { {p_2}^{K_2} } { {p_3}^{K_3} } { {p_1}^{ {\alpha_1^0} - 1 } } { {p_2}^{ {\alpha_2^0} - 1 } } { {p_3}^{ {\alpha_3^0} - 1 } } $$

Which we can factorize into

    $$ P({p_1}, {p_2}, {p_3} | O) \propto  { {p_1}^{ {K_1} + {\alpha_1^0} - 1 } } { {p_2}^{ {K_2} + {\alpha_2^0} - 1 } } { {p_3}^{ {K_3} + {\alpha_3^0} - 1 } }. $$

in which we see a dirichlet distribution with parameter 

    $$ {\alpha^1} = \left( \begin{array}{c}
        {K_1} + \alpha_1^0 \\
        {K_2} + \alpha_2^0  \\
        {K_3} + \alpha_3^0 
    \end{array}
    \right)
    $$

Now what we really want is an estimate of the average number of star. Let's consider the use of the expectancy of this average, given our posterior.

    $$ E( {p_1} + 2{p_2} + 3{p_3} | O ) = E( {p_1} | O ) + 2 E({p_2} | O  ) + 3E({p_3} | O ) $$

The expectancy of the probability of getting 1,2, or 3 number of stars is given by the dirichlet distribution 

    $$ E(p_i | O) = { {\alpha_i^1} \over { {\alpha_1^1} + {\alpha_2^1} + {\alpha_3^1} } } $$

We therefore have for our bayesian average :

    $$ rating({K_1}, {K_2}, {K_3}) =  \frac{ {K_1} + \alpha_1^0}{ N + A} +     2 \frac{ {K_2} + \alpha_2^0}{ N +  A} +  3 \frac{ {K_3} + \alpha_3^0}{  N + A}, $$
    
where we define

    $$ N = {K_1} + {K_2} + {K_3}~~and~~A = {\alpha_1^0} + {\alpha_2^0} + {\alpha_3^0} $$

We can regroup that as 

    $$ rating({K_1}, {K_2}, {K_3}) =  \frac{ \left(\alpha_1^0 + 2 \alpha_2^0 + 3 \alpha_3^0 \right)  + \left({K_1} + 2{K_2} + 3{K_3}\right) }{A + N} $$

Voilà ! Let's just digest this formula in order to make it something usable in real life. Bayesian average for star rating would consist of choosing some parameter C and m in which

- m represents a prior for the average of the stars
- C represents how confident we in our prior. It is equivalent to a number of observations.

Then the bayesian average will be 

    $$ rating({K_1}, {K_2}, {K_3}) =  \frac{ C \times m + total~number~of~stars }{C + number~of~reviews } $$


If you have the relevant data and infinite time, you may set these two values by fitting a Dirichlet distribution on the dataset of the ratings of all your computer books. However it is very common to just choose a pair of parameter that mimick the behavior that we are looking for. m is the value toward which we will adjust the average review of products with very few reviews. The bigger C is, the higher the number of reviews required to "get away from m". 


Let's now take a look at our first example. Two possible values might be for instance, ``m=3`` and ``C=5``.

The bayesian averages for the two books become

    $$ {rating_{book~A}} = \frac{5 \times 3 + 5 \times 1}{ 5 + 1 } = 3.3 $$
    $$ {rating_{book~B}} = \frac{5 \times 3 + 4.5 \times 50 }{ 5 + 50 } = 4.36 $$

As expected, Book 2 has a better bayesian average than Book 1.


