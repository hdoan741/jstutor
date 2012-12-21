function f(k) {
  var t = 1;
  var g = function(a) {
    return t + a * k;
  }
  return  g;
}

f(10)(5);
