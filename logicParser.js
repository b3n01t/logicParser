(function(exports) {

	function Expecting(type) {
		this.name = 'Expecting';
		this.message = 'Expecting ' + type;
		this.type = type;
	}
	Expecting.prototype = new Error();
	Expecting.prototype.constructor = Error;

	function Token(type, value) {
		this.type = type;
		this.value = value.trim();
		this.isKey = function() {
			return this.type == 'key';
		}
		this.isValue = function() {
			return this.type == 'value';
		}
		this.isCondition = function() {
			return this.type == 'condition';
		}
		this.isOperator = function() {
			return this.type == 'operator';
		}
		this.isNot = function() {
			return (this.type == 'operator' && this.value == '!');
		}
		this.isAnd = function() {
			return (this.type == 'operator' && (this.value == 'and' || this.value == '&&'))
		}
		this.isOr = function() {
			return (this.type == 'operator' && (this.value == 'or' || this.value == '||'))
		}
		this.isEnd = function(){
			return this.type == 'END'
		}
	}

	function Tokenizer(expression) {
		// regexp for token must be / should be/ are? mutually exclusive
		var tokenDef = {
			'key': /^ *([a-zA-Z0-9-]{1,}) *(=|>|<|!=)/,
			'condition': /^ *(=|>|<|!=) */, // in['a','b'] -> $in:['a','b'];  >= ; <= 
			'value': /^ *(([a-zA-Z0-9-]{1,})|([\'\"][a-zA-Z0-9- ]{1,}[\'\"])) */,
			'operator': /^(and) ?|^(or) ?|^(&&) ?|^(\|\|) ?|^(\() ?|^(\)) ?/ //|^(!) ?
		};
		this.tokens = [];

		this.originalExpression = expression;
		this.peek = function() {
			var token = null;
			expression = expression.trim();
			for (tokenType in tokenDef) {
				var type = tokenType;
				var re = tokenDef[tokenType];
				var match = expression.match(re);
				if (match) {
					if (tokenType == 'value') { // lame because and cannot be a value
						var match2 = expression.match(tokenDef.operator);
						if (match2) {
							match = match2;
							type = 'operator';
						}
					}
					token = new Token(type, ((match[1] || match[0]).trim()));
					break;
				}
			}
			if (!token) {
				return new Token('END', '')
			} else {
				return token;
			}
		}

		this.next = function() {
			if (expression.length === 0) {
				console.log("no next!");
			}
			var token = this.peek();
			this.tokens.push(token);
			expression = expression.replace(token.value, '');

			return token;
		}

		this.tokenize = function() {
			while (expression.length > 0) {
				this.next();
			}
		}
	}

	function Parser(expression) {
		this.expression = expression;
		var tokenizer;
		if (expression) tokenizer = new Tokenizer(expression);
		// Condition ::= Key '=' Value | 
		// 		  		 Key '>' Value |
		//		 		 Key '<' Value 

		function parseCondition() {
			var keyToken = tokenizer.next();
			if (!keyToken.isKey() && !keyToken.isValue()) throw new Expecting('KEY');
			var compToken = tokenizer.next();
			if (!compToken || !compToken.isCondition()) throw new Expecting('COMPARATOR');
			var valueToken = tokenizer.next();
			if (!valueToken.isValue()) throw new Expecting('VALUE');

			return {
				comparator: compToken.value,
				key: keyToken.value,
				value: valueToken.value,
			}

		}

		// Primary ::= Condition |
		//			   '('OrExpression')'

		function parsePrimary() {
			var exp;
			var token = tokenizer.peek();
			if (token.isKey() || token.isValue()) {
				var condition = parseCondition();
				return {
					comparison: condition
				}
			}
			if (token.isOperator() && token.value == '(') {
				tokenizer.next();
				var exp = parseExpression();
				token = tokenizer.next();
				if (token.isOperator() && token.value == ')') {
					return {
						expression: exp
					}
				} else {
					throw new Error('Expecting ")"');
				}
			}
		}

		// Unary ::= Primary |
		//		 	 '!'Unary

		function parseUnary() {
			// var exp;
			// var token = tokenizer.peek();
			// if (token.isNot()) {
			// 	token = tokenizer.next();
			// 	exp = parseUnary();

			// 	return {
			// 		unary: {
			// 			operator: token.value,
			// 			expression: exp
			// 		}
			// 	}
			// }
			return parsePrimary()
		}

		// AndExpression ::= Unary | 
		//					 AndExpression 'and' unary|

		function parseAndExp() {
			var token, left, right;
			left = parseUnary();
			token = tokenizer.peek();
			console.log(token);
			if (token.isAnd()) {
				token = tokenizer.next();
				right = parseAndExp();
				if (!right) throw new Expecting('EXPRESSION');

				return {
					binary: {
						operator: token.value,
						left: left,
						right: right
					}
				}
			}else if(!token.isEnd() && !token.isOperator() ){
				throw new Expecting('OPERATOR');
			}
			return left;
		}

		// OrExpression ::= AndExpression |
		// 				    OrExpression 'or' AndExpression

		function parseOrExp() {
			var token, left, right;
			left = parseAndExp();
			token = tokenizer.peek();
			if (token.isOr()) {
				token = tokenizer.next();
				right = parseExpression();

				return {
					binary: {
						operator: token.value,
						left: left,
						right: right
					}
				}
			}

			return left;
		}

		// Expression ::= OrExpression

		function parseExpression() {
			var exp = parseOrExp();
			if (!exp) throw new Expecting('EXPRESSION');
			return exp
		}

		this.parse = function(expression) {
			if (expression) {
				tokenizer = new Tokenizer(expression);
			} else if (!(this.expression)) {
				throw new Error('No expression to parse...');
			}
			var exp = parseExpression();
			return {
				expression: exp
			}
		}
	}

	// context Needed? 



	function EvalToMongo(expression) {
		this.expression = expression;
		evalToMongo = this;

		function isArray(o) {
			// just not to depend on underscore.js
			return Object.prototype.toString.call(o) === "[object Array]";
		}

		function evaluate(node) {
			if (node.hasOwnProperty('expression')) {
				var exp = evaluate(node.expression);

				return exp
			}
			if (node.hasOwnProperty('binary')) {
				node = node.binary;
				var left = evaluate(node.left);
				var right = evaluate(node.right);
				if (node.operator == 'or') {
					return [].concat(left, right);
				}
				if (node.operator == 'and') {
					var and = extend(left, right);
					return and;
				}
			}
			if (node.hasOwnProperty('comparison')) {
				return genComparison(node.comparison);
			}
		}


		function extend(o1, o2) {
			var ret = {};
			if (isArray(o1) || isArray(o2)) {
				ret['$and'] = [];
				if (isArray(o1)) {
					ret['$and'].push({
						'$or': o1
					});
				} else {
					ret['$and'].push(o1);
				}
				if (isArray(o2)) {
					ret['$and'].push({
						'$or': o2
					});
				} else {
					ret['$and'].push(o2);
				}
				return ret;
			}
			for (k in o1) {
				ret[k] = o1[k];
			}
			for (k in o2) {
				ret[k] = o2[k];
			}
			return ret;
		}

		function genComparison(node) {
			/* {
              "comparator": "=",
              "key": "C",
              "value": "D"
            }*/
			var comparator = node.comparator,
				key = node.key,
				value = node.value,
				ret = {};

			switch (comparator) {
				case '=':
					ret[key] = value;
					break;
				case '>':
					ret[key] = {
						$gt: value
					};
					break;
				case '<':
					ret[key] = {
						$lt: value
					};
					break;
				case '!=':
					ret[key] = {
						$ne: value
					};
					break;
				default:
					break;
			}
			return ret;
		}

		this.run = function(exp) {
			this.query = [];
			prev = {};
			var query = evaluate(exp);

			if (isArray(query)) {
				return {
					$or: query
				}
			}
			return query;
		}
	}

	exports.Token = Token;
	exports.Tokenizer = Tokenizer;
	exports.Parser = Parser;
	exports.EvalToMongo = EvalToMongo;

})(typeof exports === 'undefined' ? this['logicParser'] = {} : exports)