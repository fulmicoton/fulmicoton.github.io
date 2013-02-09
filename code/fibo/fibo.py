

def memoize(f):
  cache = {}
  def aux(*args, **kargs):
    k = (args, tuple(kargs.items()) )
    if k not in cache:
      cache[k] = f(*args, **kargs)
    return cache[k]
  return aux

@memoize
def fibo_memoize(n):
    if n==0:
        return 0
    elif n==1:
        return 1
    else:
        return fibo_memoize(n-1) + fibo_memoize(n-2)

assert fibo_memoize(0) == 0
assert fibo_memoize(1) == 1
assert fibo_memoize(10) == 55

# -----------------------------------------------------------------


def fibo_dynamic(n):
  cur = 0   # F_n
  next = 1  # F_n+1
  for i in xrange(n):
    (cur, next) = (next, cur+next)
  return cur

assert fibo_dynamic(0) == 0
assert fibo_dynamic(1) == 1
assert fibo_dynamic(10) == 55

# -----------------------------------------------------------------

def power(x,n):
  if n == 0:
    return 1
  if n%2 == 1:
    return x * power(x,n-1)
  else:
      root = power(x,n/2)
      return root*root

assert power(10,0) == 1
assert power(10,1) == 10
assert power(10,6) == 1000000

# -----------------------------------------------------------------


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

assert fibo_matrix(0) == 0
assert fibo_matrix(1) == 1
assert fibo_matrix(10) == 55

print fibo_matrix(100000)