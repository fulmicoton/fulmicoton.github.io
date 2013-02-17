def memoize_key(*args, **kargs):
  return (args, tuple(kargs.items()) )

def memoize(key=memoize_key):
  def decorator(f):
    cache = {}
    def aux(*args, **kargs):
      # dictionaries are not hashable,
      # we transform kargs in a tuple
      # of (k,v) items.
      k = key(*args, **kargs)
      if k not in cache:
        cache[k] = f(*args, **kargs)
      return cache[k]
    return aux
  return decorator
