var x = [1, 2, 3];
var y = [4, 5, 6];
var z = y;
y = x;
x = z;

x = [1, 2, 3]; // a different [1, 2, 3] list!
y = x;
x.push(4);
y.push(5);
z = [1, 2, 3, 4, 5]; // a different list!
x.push(6);
y.push(7);
y = "hello";


var foo = function(lst) {
    lst.push("hello");
    bar(lst);
}

var bar = function(myLst){
    console.log(myLst);
}

foo(x);
foo(z);