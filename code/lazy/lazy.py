
class LazyObject(object):
    
    __slots__ = [ "_recipe", "_result", "_evaluated" ]

    def __init__(self, recipe):
        object.__setattr__(self, "_recipe", recipe)
        object.__setattr__(self, "_result", None)
        object.__setattr__(self, "_evaluated", False)

    def _eval(self,):
        if not self._evaluated:
            object.__setattr__(self, "_result", self._recipe())
            object.__setattr__(self, "_evaluated", True)
        return self._result

    def __getattr__(self, name, *args, **kargs):
        return getattr(self._eval(), name, *args, **kargs)
    
    def __setattr__(self, name, *args, **kargs):
        return setattr(self._eval(), name, *args, **kargs)
    
    def __getitem__(self, key, *args, **kargs):
        return self._eval().__getitem__(key, *args, **kargs)

    def __len__(self,):
        return len(self._eval())

    def __add__(self,*args,**kargs):
        return self._eval().__add__(*args,**kargs)

    def __repr__(self,):
        return repr(self._eval())
    
    # ... __mult__, __slice__ and so on ...


def lazy(f):
    def aux(*args, **kargs):
        def recipe():
            return f(*args,**kargs)
        return LazyObject(recipe)
    return aux

@lazy
def returns_two():
    print "evaluation for good"
    return 2

if __name__ == "__main__":
    result = returns_two()
    print "lazy evaluation"
    print result + 1