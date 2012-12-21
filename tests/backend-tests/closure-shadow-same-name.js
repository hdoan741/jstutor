function f(x, y, z) {
  function g(x, y) {
    return x;
  }
  return g(y, x);
}

f(1, 2, 3);
