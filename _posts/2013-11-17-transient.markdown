---
layout: post
title: Of how to implement transient in JavaScript
category: posts
published: true
---

# What's transient anyway ?



![Ninjavascript](/images/transient/ninja1.jpg)


Java programmers are probably familiar with the concept of *transient* as it is a keyword in this language. By marking an object property as transient, you tell Java that this property should be skipped in serialization.

While  this kind of functionality should arguably not be part of a programming language, but live in its standard library (as a decorator maybe), last week at work, I kind of wished Javascript had such a functionality. 

We are using AngularJS for our UI, and our UI-model had some extra property that we don't want to persist on the server. There is a couple different ways to address this problem when it happens :

- Write a method extracting the part of the data you actually want to send the server. ``JSON.stringify(scope.model.getData())``
- Split your model into two objects, one holding the part that will be persisted, and one with the part that will not. ``JSON.stringify(scope.model.persisted)`` This can be especially tricky if your model is within a collection as it was in our case.
- Go NinJavascript and implement the transient keyword in Javascript !

*To tell the truth, I just went with solution 1. While tricks are exciting, they can rapidly make of you a bad coworker as magic tend to obsfuscate code.*

Anyway, let's state formally our ...

# Javascript puzzle of the day 

Implement the function called *transient* such that the following script does not print any error on your console.
Alternatively you can use this [JsFiddle](http://jsfiddle.net/9RpV9/).


{% highlight javascript %}

function transient(obj, key) {
    // ...  you need to implement this
}

// ... while the following should stay untouched

function assert(predicate, description) {  
    if (predicate !== true) {
        console.log("FAILED", description)
    }
}

function SomeObject() {
    this.someProp = { "name": "José Bové" }
    this.transientProp  = { "name": "Aimé Jacquet" }
}

var obj = new SomeObject();
transient(obj, "transientProp")

var obj2 = new SomeObject();
transient(obj2, "transientProp")
obj2.transientProp.age = 53;

assert(obj.someProp !== undefined,
    "someProp should stay accessible" )

assert(obj.transientProp !== undefined,
    "transientProp should stay accessible")

assert(obj.transientProp.age === undefined, 
    "transientProp should not be shared between objects")

assert(obj2.transientProp.age === 53,
    "transientProp should not be shared between objects")

assert(JSON.parse(JSON.stringify(obj)).someProp !== undefined,
    "someProp should still be serialized")

assert(JSON.parse(JSON.stringify(obj)).transientProp === undefined, 
    "transientProp should not be serialized")

{% endhighlight %}

# The solution 

**Disclaimer** *Some adaptation should be done to the following solution to make it compatible for IE, as it relies heavily on ``__proto__``. I wont do it here as it would make the trick harder to read.*

The idea relies on the fact that ``JSON.stringify`` will only serialized object's own property, and ignore those he has access to through prototypal inheritance. 

But what is JS's prototypal inheritance all about? 

<br/>
![Ninjavascript](/images/transient/shooting-stars.jpg)
<center><b>Linked lists</b>, by Jean-Francois Millet (1814 - 1875)</center><br/>
<br/>

Well prototypal inheritance is just about linked list. All javascript object belong to a [linked list](http://en.wikipedia.org/wiki/Linked_list). The reference leading to the next object in this linked list is explicitely accessible via ``youObj.__proto__`` on most browser (sorry for IE).

When looking for an object's property via ``obj.myattr`` or ``obj["myattr"]``, a JS interpreter will first check if ``obj`` has a property *of its own* named ``myattr``. If it doesn't, the interpreter will lookup recursively in the next element of the prototype chain, until he find the property, or the end of the prototype chain.

This mechanism is mostly used for inheritance purposes. In that case, instances' prototype are poiting to their class prototype, while classes on the other hand are pointing to their mother class.

But there are other uses to the prototype chain. For instance it brilliantly backs up the concept of child-scope in [angularJS](http://angularjs.org/).

In our problem, we use it to dynamically add an extra prototype layer to host the transient properties of our object. This layer will be unique for each instance of the object, which is kind of unusual.


{% highlight javascript %}
function transient(obj, k) {
    if (obj.hasOwnProperty(k)) {
        var v = obj[k]
        if (typeof v != "object") {
            throw "Does not work well with integral types.";
        }
        delete obj[k];
        if (!obj.__proto__.__transientninja__) {
            obj.__proto__ = {
                "__proto__": obj.__proto__,
                "__transientninja__": true
            }
        }
        obj.__proto__[k] = v;
    }
}
{% endhighlight %}

What other use of the prototype chain can you think of?
