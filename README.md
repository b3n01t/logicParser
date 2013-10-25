logicParser
===========

http://mongo-logic.herokuapp.com/

### Turn humain readable logical expressions into mongo query objects. ###

The main file is [logicParser.js](https://github.com/b3n01t/logicParser/blob/master/logicParser.js)
This librairie is usable in both the browser and node.js

Three objects are available:
	* A lexer: require('logicParser.js').Tokenizer
	* A parser: require('logicParser.js').Parser
	* A compiler to a mongo query: require('logicParser.js').EvalToMongo


Example:

```JavaScript

var Mongofier = require('logicParser.js').EvalToMongo;
var evalToMongo = new Mongofier();

var expression = "a = 4 and b = 2 or ab = 42";
var mongoQuery = evalToMongo.run(expression);

console.log(JSON.stringify(mongoQuery, null, '  '));

```
