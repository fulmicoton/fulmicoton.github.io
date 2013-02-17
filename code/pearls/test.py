from pearls import pearl_naive
from pearls1b import pearl_cutting_branches
from pearls1c import pearl_cutting_sooner
import pearls2
from pearls2 import pearl_pignolage
import time

from functools import wraps
import errno
import os
import signal

class TimeoutError(Exception):
    pass

def timeout(seconds=10, error_message=os.strerror(errno.ETIME)):
    def decorator(func):
        def _handle_timeout(signum, frame):
            raise TimeoutError(error_message)

        def wrapper(*args, **kwargs):
            signal.signal(signal.SIGALRM, _handle_timeout)
            signal.alarm(seconds)
            try:
                result = func(*args, **kwargs)
            finally:
                signal.alarm(0)
            return result

        return wraps(func)(wrapper)

    return decorator

for impl in [pearl_naive, pearl_cutting_branches, pearl_cutting_sooner, pearl_pignolage]:
    print ""
    print impl.__name__
    for i in range(3, 100):
        reload(pearls2)
        pearl_pignolage = pearls2.pearl_pignolage
        impl = timeout(seconds=60)(impl)
        start = time.time()
        try:
            impl(i)
            end = time.time()
            print i, end-start
        except TimeoutError:
            break
