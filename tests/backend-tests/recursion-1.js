function repeat(f, n) {
  if (n == 0) {
    return [];
  }
  return [f()].concat(repeat(f, n - 1))
}

var res = repeat(function() { return 5;}, 5);
console.log(res);
