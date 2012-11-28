var foo = function(x, y, z) {
  return bar(x, y);
}

var bar = function(a, b) {
  return baz(a);
}

var baz = function(c) {
  return c;
}

result = foo(1, 2, 3);
